"""
enhanced_recognition.py
====================
API routes untuk Enhanced Face Recognition System (ModelBaru).

Arsitektur:
- Score-Level Fusion: LBPH + MobileFaceNet (ONNX)
- Quality-Aware Weighting
- FAISS Gallery
- Multi-frame enrollment

Endpoints:
- POST /api/v1/enhanced/enroll     - Enroll wajah mahasiswa (multi-frame)
- POST /api/v1/enhanced/recognize   - Recognize wajah
- POST /api/v1/enhanced/verify      - Verify terhadap NIM tertentu
- GET  /api/v1/enhanced/stats       - Statistik sistem
- GET  /api/v1/enhanced/list        - List enrolled students
- DELETE /api/v1/enhanced/{nim}     - Hapus enrollment

Author: Skripsi 2026
"""

from __future__ import annotations

import base64
import logging
from typing import Optional, List

import numpy as np
import cv2

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.mahasiswa import Mahasiswa
from app.models.registrasi_wajah import RegistrasiWajah, StatusRegistrasiEnum
from app.models.user import User
from app.utils.dependencies import get_current_user, require_admin
from app.services.enhanced_face_service import get_enhanced_face_wrapper

log = logging.getLogger(__name__)

router = APIRouter(prefix="/enhanced", tags=["Enhanced Face Recognition"])


# ─── Path Configuration ────────────────────────────────────────────────────────

def _get_paths():
    """Get paths for enhanced face system."""
    from app.config.settings import settings
    return {
        "modelbaruu_dir": settings.MODELBARU_DIR,
        "models_dir": settings.MODELS_DIR,
        "face_mahasiswa_dir": settings.FACE_MAHASISWA_DIR,
    }

_ML_PATHS = _get_paths()


# ─── Request / Response Schemas ────────────────────────────────────────────────

class EnrollRequest(BaseModel):
    """Request untuk enroll dengan 1 foto (quality validated)."""
    nim: str
    foto_base64: str
    force_update: bool = False


class EnrollResponse(BaseModel):
    """Response hasil enroll."""
    success: bool
    message: str
    nim: Optional[str] = None
    nama: Optional[str] = None
    gallery_size: Optional[int] = None
    quality_score: Optional[float] = None
    quality_details: Optional[dict] = None
    num_frames: Optional[int] = None
    augmentation_count: Optional[int] = None


class CheckQualityRequest(BaseModel):
    """Request untuk check kualitas foto."""
    foto_base64: str


class CheckQualityResponse(BaseModel):
    """Response hasil quality check."""
    success: bool
    face_detected: bool
    quality_score: float
    can_enroll: bool
    quality_details: Optional[dict] = None
    face_size: Optional[int] = None
    bbox: Optional[list] = None
    recommendations: Optional[List[str]] = None
    message: str


class RecognizeRequest(BaseModel):
    """Request untuk recognize wajah."""
    foto_base64: str


class RecognizeResponse(BaseModel):
    """Response hasil recognize."""
    success: bool
    is_known: bool
    nim: Optional[str] = None
    person_name: Optional[str] = None
    confidence: float
    cnn_similarity: float
    lbph_similarity: float
    final_score: float
    message: str
    threshold: float
    top_k_results: Optional[List[dict]] = None


class VerifyRequest(BaseModel):
    """Request untuk verify terhadap NIM."""
    foto_base64: str
    nim: str


class VerifyResponse(BaseModel):
    """Response hasil verify."""
    valid: bool
    nim: str
    similarity: float
    threshold: float
    message: str


class StatsResponse(BaseModel):
    """Response statistik sistem."""
    model_loaded: bool
    model_type: str
    architecture: str
    gallery_size: int
    threshold: float
    identities: List[str]


class EnrolledListResponse(BaseModel):
    """Response list enrolled students."""
    success: bool
    total: int
    identities: List[dict]


# ─── Helper Functions ──────────────────────────────────────────────────────────

def _decode_base64_to_bgr(foto_base64: str) -> np.ndarray:
    """Decode base64 string menjadi BGR numpy array."""
    if "," in foto_base64:
        foto_base64 = foto_base64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(foto_base64)
        arr = np.frombuffer(img_bytes, np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if bgr is None:
            raise ValueError("Cannot decode image")

        return bgr

    except Exception as e:
        raise HTTPException(400, f"Failed to decode image: {str(e)}")


def _decode_base64_list_to_frames(foto_list: List[str]) -> List[np.ndarray]:
    """Decode list of base64 strings menjadi list of BGR images."""
    frames = []
    for i, foto in enumerate(foto_list):
        try:
            frame = _decode_base64_to_bgr(foto)
            frames.append(frame)
        except HTTPException:
            log.warning(f"[Enhanced] Failed to decode frame {i+1}")
            continue

    return frames


def _save_photos_to_face_mahasiswa(nim: str, foto_list: List[str]) -> Optional[List[str]]:
    """Simpan foto wajah ke folder face_mahasiswa/{nim}/."""
    try:
        face_mahasiswa_dir = _ML_PATHS["face_mahasiswa_dir"]

        # Buat folder jika belum ada
        nim_folder = face_mahasiswa_dir / nim
        nim_folder.mkdir(parents=True, exist_ok=True)

        saved_paths = []
        for i, foto in enumerate(foto_list):
            try:
                bgr = _decode_base64_to_bgr(foto)

                # Tentukan nama file
                filename = f"foto_{i+1:03d}.jpg"
                filepath = nim_folder / filename

                # Simpan foto
                success = cv2.imwrite(str(filepath), bgr)
                if success:
                    saved_paths.append(str(filepath))

            except HTTPException:
                log.warning(f"[Enhanced] Failed to save frame {i+1}")
                continue

        return saved_paths if saved_paths else None

    except Exception as e:
        log.exception(f"[Enhanced] Error saving photos: {e}")
        return None


def _get_or_create_mahasiswa(db: Session, nim: str) -> Optional[Mahasiswa]:
    """Get mahasiswa by NIM."""
    return db.query(Mahasiswa).filter(Mahasiswa.nim == nim).first()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/enroll", response_model=EnrollResponse)
async def enroll_student(
    payload: EnrollRequest,
    db: Session = Depends(get_db),
):
    """
    Enroll mahasiswa baru dengan 1 foto berkualitas.

    Sistem akan:
    1. Validasi quality foto (blur, brightness, pose)
    2. Generate 10 augmented versions untuk stabilitas
    3. Extract embedding dan simpan ke gallery

    Quality threshold: Minimal 0.60
    """
    # Find mahasiswa
    mahasiswa = _get_or_create_mahasiswa(db, payload.nim)
    if not mahasiswa:
        return EnrollResponse(
            success=False,
            message=f"Mahasiswa dengan NIM {payload.nim} tidak ditemukan"
        )

    # Check existing enrollment
    registrasi = db.query(RegistrasiWajah).filter(
        RegistrasiWajah.id_mahasiswa == mahasiswa.id_mahasiswa
    ).first()

    if registrasi and not payload.force_update:
        return EnrollResponse(
            success=False,
            message=f"Mahasiswa {mahasiswa.nama_mahasiswa} sudah ter-enroll. "
                    f"Set force_update=true untuk override."
        )

    # Decode image
    try:
        bgr_image = _decode_base64_to_bgr(payload.foto_base64)
    except HTTPException:
        return EnrollResponse(
            success=False,
            message="Gagal decode gambar"
        )

    # Save photo
    saved_paths = _save_photos_to_face_mahasiswa(payload.nim, [payload.foto_base64])

    # Enroll using enhanced system
    try:
        wrapper = get_enhanced_face_wrapper()

        if not wrapper._is_loaded:
            if not wrapper.load():
                return EnrollResponse(
                    success=False,
                    message="Gagal load EnhancedFace system"
                )

        # Use enroll() which handles single photo with quality validation
        result = wrapper.enroll(payload.nim, [bgr_image])

        if result.get("success"):
            # Update database
            if registrasi:
                registrasi.jumlah_foto = 1
                registrasi.similarity_check = result.get("quality_score", 0.0)
                registrasi.status_registrasi = StatusRegistrasiEnum.berhasil
            else:
                registrasi = RegistrasiWajah(
                    id_mahasiswa=mahasiswa.id_mahasiswa,
                    jumlah_foto=1,
                    similarity_check=result.get("quality_score", 0.0),
                    status_registrasi=StatusRegistrasiEnum.berhasil
                )
                db.add(registrasi)

            db.commit()

            return EnrollResponse(
                success=True,
                message=f"Berhasil enroll {mahasiswa.nama_mahasiswa} dengan 1 foto berkualitas!",
                nim=mahasiswa.nim,
                nama=mahasiswa.nama_mahasiswa,
                gallery_size=result.get("gallery_size"),
                quality_score=result.get("quality_score"),
                quality_details=result.get("quality_details"),
                num_frames=1,
                augmentation_count=result.get("augmentation_count")
            )
        else:
            # Quality check failed
            return EnrollResponse(
                success=False,
                message=result.get("message", "Enrollment failed"),
                quality_score=result.get("quality_score"),
                quality_details=result.get("quality_details")
            )

    except Exception as e:
        log.exception("[Enhanced] Enrollment error")
        db.rollback()
        return EnrollResponse(
            success=False,
            message=f"Enrollment error: {str(e)}"
        )


@router.post("/check-quality", response_model=CheckQualityResponse)
async def check_photo_quality(
    payload: CheckQualityRequest,
):
    """
    Check kualitas foto sebelum enrollment.

    Returns:
    - face_detected: Apakah wajah terdeteksi
    - quality_score: Score 0-1
    - can_enroll: Apakah foto bisa digunakan untuk enrollment
    - recommendations: Saran untuk memperbaiki quality
    """
    try:
        bgr_image = _decode_base64_to_bgr(payload.foto_base64)
    except HTTPException:
        return CheckQualityResponse(
            success=False,
            face_detected=False,
            quality_score=0.0,
            can_enroll=False,
            message="Gagal decode gambar"
        )

    try:
        wrapper = get_enhanced_face_wrapper()

        if not wrapper._is_loaded:
            if not wrapper.load():
                return CheckQualityResponse(
                    success=False,
                    face_detected=False,
                    quality_score=0.0,
                    can_enroll=False,
                    message="System tidak tersedia"
                )

        result = wrapper.check_quality(bgr_image)

        return CheckQualityResponse(
            success=True,
            face_detected=result.get("face_detected", False),
            quality_score=result.get("quality_score", 0.0),
            can_enroll=result.get("can_enroll", False),
            quality_details=result.get("quality_details"),
            face_size=result.get("face_size"),
            bbox=result.get("bbox"),
            recommendations=result.get("recommendations", []),
            message=result.get("message", "")
        )

    except Exception as e:
        log.exception("[Enhanced] Quality check error")
        return CheckQualityResponse(
            success=False,
            face_detected=False,
            quality_score=0.0,
            can_enroll=False,
            message=f"Error: {str(e)}"
        )


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_face(
    payload: RecognizeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Recognize wajah dalam gambar.

    Score-Level Fusion:
    - LBPH features (640-D)
    - MobileFaceNet embedding (512-D) via ONNX
    - wCNN = QualityScore, wLBPH = 1 - QualityScore

    Returns Top-K results untuk analisis lebih lanjut.
    """
    # Decode image
    try:
        bgr_image = _decode_base64_to_bgr(payload.foto_base64)
    except HTTPException:
        raise HTTPException(400, "Failed to decode image")

    # Recognize
    try:
        wrapper = get_enhanced_face_wrapper()

        if not wrapper._is_loaded:
            if not wrapper.load():
                return RecognizeResponse(
                    success=False,
                    is_known=False,
                    confidence=0.0,
                    cnn_similarity=0.0,
                    lbph_similarity=0.0,
                    final_score=0.0,
                    message="EnhancedFace system not loaded",
                    threshold=0.0
                )

        result = wrapper.recognize(bgr_image)

        return RecognizeResponse(
            success=True,
            is_known=result.get("is_known", False),
            nim=result.get("nim"),
            person_name=result.get("person_name"),
            confidence=result.get("confidence", 0.0),
            cnn_similarity=result.get("cnn_similarity", 0.0),
            lbph_similarity=result.get("lbph_similarity", 0.0),
            final_score=result.get("final_score", 0.0),
            message=result.get("message", ""),
            threshold=result.get("threshold", 0.0),
            top_k_results=result.get("top_k_results")
        )

    except Exception as e:
        log.exception("[Enhanced] Recognition error")
        return RecognizeResponse(
            success=False,
            is_known=False,
            confidence=0.0,
            cnn_similarity=0.0,
            lbph_similarity=0.0,
            final_score=0.0,
            message=f"Recognition error: {str(e)}",
            threshold=0.0
        )


@router.post("/verify", response_model=VerifyResponse)
async def verify_face(
    payload: VerifyRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Verify wajah terhadap NIM tertentu.

    Berguna untuk absensi - verifikasi bahwa wajah yang di-scan
   确实是 milik mahasiswa yang claim.
    """
    # Decode image
    try:
        bgr_image = _decode_base64_to_bgr(payload.foto_base64)
    except HTTPException:
        raise HTTPException(400, "Failed to decode image")

    # Verify
    try:
        wrapper = get_enhanced_face_wrapper()

        if not wrapper._is_loaded:
            if not wrapper.load():
                return VerifyResponse(
                    valid=False,
                    nim=payload.nim,
                    similarity=0.0,
                    threshold=0.0,
                    message="EnhancedFace system not loaded"
                )

        result = wrapper.verify(bgr_image, payload.nim)

        return VerifyResponse(
            valid=result.get("valid", False),
            nim=payload.nim,
            similarity=result.get("similarity", 0.0),
            threshold=result.get("threshold", 0.0),
            message=result.get("message", "")
        )

    except Exception as e:
        log.exception("[Enhanced] Verify error")
        return VerifyResponse(
            valid=False,
            nim=payload.nim,
            similarity=0.0,
            threshold=0.0,
            message=f"Verify error: {str(e)}"
        )


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get statistik Enhanced Face Recognition System."""
    try:
        wrapper = get_enhanced_face_wrapper()

        if not wrapper._is_loaded:
            wrapper.load()

        health = wrapper.health()

        return StatsResponse(
            model_loaded=health.get("model_loaded", False),
            model_type=health.get("model_type", "unknown"),
            architecture=health.get("architecture", "unknown"),
            gallery_size=health.get("gallery_size", 0),
            threshold=health.get("threshold", 0.0),
            identities=health.get("identities", [])
        )

    except Exception as e:
        log.exception("[Enhanced] Stats error")
        return StatsResponse(
            model_loaded=False,
            model_type="error",
            architecture="unknown",
            gallery_size=0,
            threshold=0.0,
            identities=[]
        )


@router.get("/list", response_model=EnrolledListResponse)
async def list_identities():
    """List semua enrolled identities dengan info quality."""
    try:
        wrapper = get_enhanced_face_wrapper()

        if not wrapper._is_loaded:
            wrapper.load()

        identities = wrapper.list_identities()
        result = []

        for nim in identities:
            info = wrapper.get_identity_info(nim)
            if info:
                result.append(info)

        return EnrolledListResponse(
            success=True,
            total=len(result),
            identities=result
        )

    except Exception as e:
        log.exception("[Enhanced] List error")
        return EnrolledListResponse(
            success=False,
            total=0,
            identities=[]
        )


@router.delete("/{nim}")
async def delete_enrollment(
    nim: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Hapus enrollment mahasiswa berdasarkan NIM.

    Ini akan:
    1. Hapus dari gallery
    2. Hapus dari database
    3. Hapus folder foto
    """
    try:
        # Find mahasiswa
        mahasiswa = _get_or_create_mahasiswa(db, nim)
        if not mahasiswa:
            return {"success": False, "message": f"Mahasiswa dengan NIM {nim} tidak ditemukan"}

        # Hapus dari gallery
        wrapper = get_enhanced_face_wrapper()
        if not wrapper._is_loaded:
            wrapper.load()

        removed = wrapper.remove_identity(nim)

        # Hapus dari database
        registrasi = db.query(RegistrasiWajah).filter(
            RegistrasiWajah.id_mahasiswa == mahasiswa.id_mahasiswa
        ).first()

        if registrasi:
            db.delete(registrasi)

        db.commit()
        log.info(f"[Enhanced] Deleted enrollment for {nim}")

        # Hapus folder foto
        import shutil
        foto_folder = _ML_PATHS["face_mahasiswa_dir"] / nim
        if foto_folder.exists():
            shutil.rmtree(foto_folder)
            log.info(f"[Enhanced] Deleted photo folder: {foto_folder}")

        return {
            "success": True,
            "message": f"Enrollment {nim} berhasil dihapus",
            "removed_from_gallery": removed
        }

    except Exception as e:
        log.exception("[Enhanced] Delete error")
        return {"success": False, "message": f"Delete error: {str(e)}"}


@router.get("/health")
async def health_check():
    """Check health status of Enhanced Face Recognition System."""
    try:
        wrapper = get_enhanced_face_wrapper()
        return wrapper.health()
    except Exception as e:
        return {
            "model_loaded": False,
            "error": str(e)
        }


@router.post("/reload")
async def reload_model():
    """Reload EnhancedFaceRecognitionSystem."""
    try:
        wrapper = get_enhanced_face_wrapper()
        wrapper._is_loaded = False
        wrapper._system = None
        success = wrapper.load()

        return {
            "success": success,
            "message": "Model reloaded" if success else "Failed to reload model"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Reload error: {str(e)}"
        }
