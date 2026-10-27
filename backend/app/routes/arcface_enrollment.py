"""
arcface_enrollment.py
====================
API routes untuk Face Enrollment dengan Model LBPH + MobileFaceNet (ModelBaru).

Fitur:
- Enroll mahasiswa baru (1 foto)
- Extract embedding menggunakan LBPH + MobileFaceNet
- Quality-Aware Score-Level Fusion
- Simpan ke FAISS gallery
- Simpan foto ke face_mahasiswa/{nim}/

Path Configuration (ModelBaru):
- Backend: D:\PAJ TIF\Projek Skripsi\face_recognition_system\backend
- ModelBaru: D:\PAJ TIF\Projek Skripsi\face_recognition_system\ModelBaru
- Models: ModelBaru/models/
- Enrollment Folder: ModelBaru/face_mahasiswa/{nim}/

Usage:
    POST /api/v1/arcface/enroll     - Enroll wajah mahasiswa
    GET  /api/v1/arcface/stats      - Statistik sistem
    GET  /api/v1/arcface/list       - List enrolled students

Author: Face Recognition Skripsi
"""

from __future__ import annotations

import sys
import base64
import logging
import pickle
from pathlib import Path
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.mahasiswa import Mahasiswa
from app.models.registrasi_wajah import RegistrasiWajah
from app.utils.dependencies import get_current_user, require_admin
from app.models.user import User

log = logging.getLogger(__name__)

router = APIRouter(prefix="/arcface", tags=["Face Enrollment"])

# ─── Path Configuration ────────────────────────────────────────────────────────

def _get_ml_paths():
    """
    Get ML paths dari ModelBaru folder.
    """
    from app.config.settings import settings

    return {
        "modelbaru_dir": settings.MODELBARU_DIR,
        "models_dir": settings.MODELS_DIR,
        "face_mahasiswa_dir": settings.FACE_MAHASISWA_DIR,
    }

# Initialize paths
_ML_PATHS = _get_ml_paths()

# Add ModelBaru to sys.path for imports
if str(_ML_PATHS["modelbaru_dir"]) not in sys.path:
    sys.path.insert(0, str(_ML_PATHS["modelbaru_dir"]))

log.info(f"[Enrollment] ModelBaru dir: {_ML_PATHS['modelbaru_dir']}")
log.info(f"[Enrollment] Models dir: {_ML_PATHS['models_dir']}")


# ─── Request / Response Schemas ────────────────────────────────────────────────

class EnrollRequest(BaseModel):
    """Request untuk enroll mahasiswa baru."""
    nim: str                    # NIM mahasiswa
    foto_base64: str | List[str]  # Foto wajah dalam base64 (single atau array)
    force_update: bool = False # Update jika sudah ada


class EnrollResponse(BaseModel):
    """Response hasil enroll."""
    success: bool
    message: str
    nim: Optional[str] = None
    nama: Optional[str] = None
    quality_score: Optional[float] = None
    foto_path: Optional[str] = None


class StatsResponse(BaseModel):
    """Response statistik sistem."""
    model_loaded: bool
    total_identities: int
    model_type: str


class EnrolledListResponse(BaseModel):
    """Response list enrolled students."""
    success: bool
    total: int
    enrolled: list


# ─── Face Recognition System (ModelBaru - LBPH + MobileFaceNet) ─────────────────

class EnhancedEnrollmentSystem:
    """
    Enrollment system menggunakan LBPH + MobileFaceNet dari ModelBaru.

    Arsitektur:
    - LBPH Extractor (640-D features)
    - MobileFaceNet Extractor (512-D ONNX)
    - Quality-Aware Score-Level Fusion
    """

    _instance = None
    _system = None
    _is_loaded = False

    @classmethod
    def get_instance(cls):
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self) -> bool:
        """Load Enhanced Face Recognition System dari ModelBaru."""
        if self._is_loaded:
            return True

        log.info("[Enrollment] Loading Enhanced System (LBPH + MobileFaceNet)...")

        try:
            # Import dari ModelBaru
            from enhanced_system import EnhancedFaceRecognitionSystem

            self._system = EnhancedFaceRecognitionSystem()
            self._is_loaded = True
            log.info("[Enrollment] Enhanced System loaded successfully")
            return True

        except ImportError as e:
            log.error(f"[Enrollment] Failed to import ModelBaru system: {e}")
            return False
        except Exception as e:
            log.error(f"[Enrollment] Failed to load system: {e}")
            import traceback
            traceback.print_exc()
            return False

    def enroll(self, nim: str, frames: List, metadata: Dict = None) -> tuple:
        """
        Enroll wajah mahasiswa.

        Args:
            nim: NIM mahasiswa
            frames: List of face images (numpy arrays)
            metadata: Optional metadata

        Returns:
            (success: bool, quality_score: float)
        """
        if not self._is_loaded or self._system is None:
            log.error("[Enrollment] System not loaded")
            return False, 0.0

        try:
            # Extract quality score dari hasil enrollment
            import numpy as np

            # Hitung quality score dari frame
            quality_scores = []
            for frame in frames:
                result = self._system.preprocessor.detect_and_preprocess(frame, for_enrollment=True)
                if result['face'] is not None and result['quality']:
                    quality_scores.append(result['quality']['quality_score'])

            avg_quality = np.mean(quality_scores) if quality_scores else 0.5

            # Enroll
            success = self._system.enroll(nim, frames, metadata)

            return success, avg_quality

        except Exception as e:
            log.error(f"[Enrollment] Enrollment failed: {e}")
            import traceback
            traceback.print_exc()
            return False, 0.0

    def get_stats(self) -> Dict[str, Any]:
        """Get system statistics."""
        if not self._is_loaded or self._system is None:
            return {
                'model_loaded': False,
                'total_identities': 0,
                'model_type': 'LBPH + MobileFaceNet (Enhanced)',
            }

        return {
            'model_loaded': True,
            'total_identities': self._system.get_gallery_size(),
            'model_type': 'LBPH + MobileFaceNet (Enhanced)',
        }

    def list_enrolled(self) -> list:
        """List semua enrolled identities."""
        if not self._is_loaded or self._system is None:
            return []

        return self._system.gallery.list_identities()

    def is_enrolled(self, nim: str) -> bool:
        """Check apakah NIM sudah enrolled."""
        if not self._is_loaded or self._system is None:
            return False

        identities = self._system.gallery.list_identities()
        return nim in identities


# ─── Helper Functions ───────────────────────────────────────────────────────────

def _decode_base64_to_image(foto_base64: str):
    """Decode base64 string menjadi numpy array (BGR)."""
    import cv2
    import numpy as np

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


def _save_photo_to_face_mahasiswa(nim: str, image, force_update: bool = False) -> Optional[str]:
    """Simpan foto wajah ke folder face_mahasiswa/{nim}/ (standar resolusi 800x1066)."""
    import os
    import cv2
    import glob

    try:
        face_mahasiswa_dir = _ML_PATHS["face_mahasiswa_dir"]

        # Resize ke ukuran standar gallery (width 800, height 1066) jika perlu
        if image is not None:
            h, w = image.shape[:2]
            if w != 800 or h != 1066:
                image = cv2.resize(image, (800, 1066), interpolation=cv2.INTER_AREA)

        # Buat folder jika belum ada
        nim_folder = face_mahasiswa_dir / nim
        nim_folder.mkdir(parents=True, exist_ok=True)

        # Jika force_update, hapus foto lama terlebih dahulu
        if force_update:
            existing_files = glob.glob(str(nim_folder / "*.jpg"))
            for old_file in existing_files:
                try:
                    os.remove(old_file)
                    log.info(f"[Enrollment] Deleted old photo: {old_file}")
                except Exception as e:
                    log.warning(f"[Enrollment] Failed to delete old photo: {e}")

        # Tentukan nama file
        existing_count = len(glob.glob(str(nim_folder / "*.jpg")))
        filename = f"foto_{existing_count + 1:03d}.jpg"

        filepath = nim_folder / filename

        # Simpan foto
        success = cv2.imwrite(str(filepath), image)

        if success:
            relative_path = f"face_mahasiswa/{nim}/{filename}"
            log.info(f"[Enrollment] Foto disimpan: {relative_path}")
            return relative_path
        else:
            log.error(f"[Enrollment] Gagal menyimpan foto ke {filepath}")
            return None

    except Exception as e:
        log.exception(f"[Enrollment] Error menyimpan foto: {e}")
        return None


def _get_or_create_mahasiswa(db: Session, nim: str) -> Optional[Mahasiswa]:
    """Get mahasiswa by NIM or return None."""
    return db.query(Mahasiswa).filter(Mahasiswa.nim == nim).first()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/enroll", response_model=EnrollResponse)
async def enroll_student(
    payload: EnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enroll mahasiswa baru dengan LBPH + MobileFaceNet (ModelBaru).

    Alur:
    1. Decode foto base64
    2. Simpan foto ke face_mahasiswa/{nim}/
    3. Extract embedding menggunakan LBPH + MobileFaceNet
    4. Enroll ke FAISS gallery
    5. Update database
    """
    # Find mahasiswa
    mahasiswa = _get_or_create_mahasiswa(db, payload.nim)
    if not mahasiswa:
        return EnrollResponse(
            success=False,
            message=f"Mahasiswa dengan NIM {payload.nim} tidak ditemukan"
        )

    # Check apakah mahasiswa sudah ter-enroll
    registrasi = db.query(RegistrasiWajah).filter(
        RegistrasiWajah.id_mahasiswa == mahasiswa.id_mahasiswa
    ).first()

    log.info(f"[Enrollment] Check: registrasi exists={registrasi is not None}, force_update={payload.force_update}")

    if registrasi and not payload.force_update:
        return EnrollResponse(
            success=False,
            message=f"Mahasiswa {mahasiswa.nama_mahasiswa} sudah ter-enroll. "
                    f"Set force_update=true untuk override."
        )

    # Decode image(s)
    try:
        # Handle both single image and array of images
        if isinstance(payload.foto_base64, list):
            foto_list = payload.foto_base64
        else:
            foto_list = [payload.foto_base64]

        bgr_images = []
        for foto in foto_list:
            bgr_image = _decode_base64_to_image(foto)
            bgr_images.append(bgr_image)
    except HTTPException as e:
        return EnrollResponse(
            success=False,
            message=f"Failed to decode image: {str(e)}"
        )

    # Simpan foto ke folder face_mahasiswa/{nim}/
    log.info(f"[Enrollment] Saving {len(bgr_images)} photo(s) with force_update={payload.force_update}")
    foto_paths = []
    for idx, bgr_image in enumerate(bgr_images):
        # idx=0: use original force_update value
        # idx>0: always False (don't delete previously saved photos in this batch)
        foto_path = _save_photo_to_face_mahasiswa(payload.nim, bgr_image, payload.force_update if idx == 0 else False)
        if foto_path:
            foto_paths.append(foto_path)
        else:
            log.error(f"[Enrollment] Failed to save photo {idx + 1}/{len(bgr_images)}")

    if not foto_paths:
        return EnrollResponse(
            success=False,
            message="Gagal menyimpan foto wajah"
        )

    log.info(f"[Enrollment] {len(foto_paths)} photo(s) saved, proceeding to enrollment...")

    # Load enrollment system dan enroll
    try:
        enrollment_system = EnhancedEnrollmentSystem.get_instance()

        if not enrollment_system._is_loaded:
            if not enrollment_system.load():
                return EnrollResponse(
                    success=False,
                    message="Gagal load Enhanced System. Pastikan ModelBaru terinstall dengan benar."
                )

        # Enroll to gallery
        metadata = {
            'enrolled_by': current_user.name if current_user else 'unknown',
        }

        ml_success, quality_score = enrollment_system.enroll(
            nim=payload.nim,
            frames=bgr_images,
            metadata=metadata
        )

        # Get stats
        stats = enrollment_system.get_stats()

        # Update database
        from datetime import datetime

        if registrasi:
            registrasi.jumlah_foto = len(bgr_images)
            registrasi.status_registrasi = "berhasil"
        else:
            registrasi = RegistrasiWajah(
                id_mahasiswa=mahasiswa.id_mahasiswa,
                jumlah_foto=len(bgr_images),
                similarity_check=float(quality_score),
                status_registrasi="berhasil"
            )
            db.add(registrasi)

        db.commit()
        log.info(f"[Enrollment] Database updated for {mahasiswa.nim}")

        return EnrollResponse(
            success=True,
            message=f"Berhasil enroll {mahasiswa.nama_mahasiswa} dengan {len(bgr_images)} foto, Quality Score: {quality_score:.2f}",
            nim=mahasiswa.nim,
            nama=mahasiswa.nama_mahasiswa,
            quality_score=float(quality_score),
            foto_path=", ".join(foto_paths)
        )

    except Exception as e:
        log.exception("[Enrollment] Enrollment error")
        db.rollback()
        return EnrollResponse(
            success=False,
            message=f"Enrollment error: {str(e)}"
        )


@router.get("/status/{nim}")
async def check_registration_status(
    nim: str,
    db: Session = Depends(get_db),
):
    """
    Cek apakah mahasiswa sudah terdaftar wajahnya.
    """
    try:
        # Check di database
        mahasiswa = db.query(Mahasiswa).filter(Mahasiswa.nim == nim).first()
        if not mahasiswa:
            return {
                "is_registered": False,
                "nim": nim,
                "message": "Mahasiswa tidak ditemukan"
            }

        # Check di tabel registrasi_wajah
        registrasi = db.query(RegistrasiWajah).filter(
            RegistrasiWajah.id_mahasiswa == mahasiswa.id_mahasiswa
        ).first()

        is_registered = registrasi is not None and registrasi.status_registrasi == "berhasil"

        return {
            "is_registered": is_registered,
            "nim": nim,
            "nama": mahasiswa.nama_mahasiswa,
            "message": "Mahasiswa sudah terdaftar" if is_registered else "Mahasiswa belum terdaftar"
        }

    except Exception as e:
        log.exception("[Enrollment] Status check error")
        return {
            "is_registered": False,
            "nim": nim,
            "message": f"Error: {str(e)}"
        }


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get sistem statistics."""
    try:
        enrollment_system = EnhancedEnrollmentSystem.get_instance()

        if not enrollment_system._is_loaded:
            enrollment_system.load()

        stats = enrollment_system.get_stats()

        return StatsResponse(
            model_loaded=stats.get('model_loaded', False),
            total_identities=stats.get('total_identities', 0),
            model_type=stats.get('model_type', 'LBPH + MobileFaceNet (Enhanced)'),
        )

    except Exception as e:
        log.exception("[Enrollment] Stats error")
        return StatsResponse(
            model_loaded=False,
            total_identities=0,
            model_type="error",
        )


@router.get("/list", response_model=EnrolledListResponse)
async def list_enrolled():
    """List semua enrolled students."""
    try:
        enrollment_system = EnhancedEnrollmentSystem.get_instance()

        if not enrollment_system._is_loaded:
            enrollment_system.load()

        enrolled = enrollment_system.list_enrolled()

        return EnrolledListResponse(
            success=True,
            total=len(enrolled),
            enrolled=enrolled
        )

    except Exception as e:
        log.exception("[Enrollment] List error")
        return EnrolledListResponse(
            success=False,
            total=0,
            enrolled=[]
        )


@router.delete("/{nim}")
async def delete_enrollment(
    nim: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Hapus enrollment mahasiswa berdasarkan NIM.

    Butuh akses admin.
    """
    try:
        # Find mahasiswa
        mahasiswa = _get_or_create_mahasiswa(db, nim)
        if not mahasiswa:
            return {"success": False, "message": f"Mahasiswa dengan NIM {nim} tidak ditemukan"}

        # Hapus dari database
        registrasi = db.query(RegistrasiWajah).filter(
            RegistrasiWajah.id_mahasiswa == mahasiswa.id_mahasiswa
        ).first()

        if registrasi:
            db.delete(registrasi)
            db.commit()
            log.info(f"[Enrollment] Deleted database record for {nim}")

        # Opsional: hapus folder foto
        import shutil
        foto_folder = _ML_PATHS["face_mahasiswa_dir"] / nim
        if foto_folder.exists():
            shutil.rmtree(foto_folder)
            log.info(f"[Enrollment] Deleted photo folder: {foto_folder}")

        return {
            "success": True,
            "message": f"Enrollment {nim} berhasil dihapus",
        }

    except Exception as e:
        log.exception("[Enrollment] Delete error")
        return {"success": False, "message": f"Delete error: {str(e)}"}
