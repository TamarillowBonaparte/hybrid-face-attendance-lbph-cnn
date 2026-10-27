"""
face_recognition.py (Updated for New Embedding Model)
================================================
Face Verification using LBPH + MobileNetV2 Embedding Model.

Changes:
- Uses embedding_model.keras instead of hybrid_face_model.keras
- Embedding dimension: 256
- FAISS index rebuilt with new embeddings
"""

from __future__ import annotations

import base64
import logging
import pickle
import time
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import faiss
import cv2

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.mahasiswa import Mahasiswa
from app.models.pertemuan import Pertemuan, StatusPertemuanEnum
from app.models.presensi import Presensi, StatusPresensiEnum
from app.utils.dependencies import get_current_user
from app.models.user import User
from app.services.enhanced_face_service import get_enhanced_face_wrapper
from app.services.anti_spoof_service import get_anti_spoof_manager

log = logging.getLogger(__name__)

router = APIRouter(prefix="/presensi", tags=["Face Recognition Absensi"])

# ─── Path Configuration ────────────────────────────────────────────────────────

def _get_ml_paths():
    """Get ML paths for ModelBaru."""
    from app.config.settings import settings
    return {
        "models_dir": settings.MODELS_DIR,
        "face_mahasiswa_dir": settings.FACE_MAHASISWA_DIR,
    }

_ML_PATHS = _get_ml_paths()

# Config - must match ModelBaru config
IMG_SIZE_LBPH = 96
IMG_SIZE_MOBILE = 224
LBPH_DIM = 640
CNN_DIM = 1280
EMBEDDING_DIM = 256
SIMILARITY_THRESHOLD = 0.35  # Lowered for new model


# ─── Singleton Face Recognition Engine ───────────────────────────────────────────

class FaceVerificationEngine:
    """
    Singleton engine for face verification using new embedding model.
    """
    _instance = None
    _embedding_model = None
    _mobilenet_extractor = None
    _detector = None
    _faiss_index = None
    _metadata = {}
    _is_loaded = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self) -> bool:
        """Load all ML components."""
        if self._is_loaded:
            return True

        log.info("[FaceVerify] Loading Face Verification Engine (New Model)...")

        try:
            import tensorflow as tf
            from tensorflow.keras import layers, Model, Input
            from tensorflow.keras.applications import MobileNetV2
            tf.get_logger().setLevel('ERROR')

            # Load embedding model
            model_path = _ML_PATHS["models_dir"] / "embedding_model.keras"
            if not model_path.exists():
                log.error(f"[FaceVerify] Embedding model not found: {model_path}")
                return False

            # Custom L2 Normalize layer for loading
            class L2Normalize(tf.keras.layers.Layer):
                def call(self, inputs):
                    return tf.math.l2_normalize(inputs, axis=1)
                def compute_output_shape(self, input_shape):
                    return input_shape

            self._embedding_model = tf.keras.models.load_model(
                str(model_path),
                compile=False,
                custom_objects={'L2Normalize': L2Normalize}
            )
            log.info(f"[FaceVerify] Embedding model loaded: {model_path}")

            # Load MobileNet feature extractor
            base_mobile = MobileNetV2(
                input_shape=(IMG_SIZE_MOBILE, IMG_SIZE_MOBILE, 3),
                include_top=False,
                weights='imagenet'
            )
            base_mobile.trainable = False
            mobile_input = Input(shape=(IMG_SIZE_MOBILE, IMG_SIZE_MOBILE, 3))
            x = base_mobile(mobile_input)
            x = layers.GlobalAveragePooling2D()(x)
            self._mobilenet_extractor = Model(inputs=mobile_input, outputs=x)
            log.info("[FaceVerify] MobileNet extractor loaded")

        except Exception as e:
            log.error(f"[FaceVerify] Failed to load models: {e}")
            return False

        # Load face detector
        yunet_path = _ML_PATHS["models_dir"] / "face_detection_yunet_2023mar.onnx"
        if yunet_path.exists():
            try:
                self._detector = cv2.FaceDetectorYN.create(
                    str(yunet_path), "", (320, 320),
                    score_threshold=0.2, nms_threshold=0.3, top_k=5
                )
                log.info("[FaceVerify] YuNet detector loaded")
            except Exception as e:
                log.warning(f"[FaceVerify] YuNet failed: {e}")
                self._detector = None
        else:
            self._detector = None

        if self._detector is None:
            haar_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            cascade = cv2.CascadeClassifier(haar_path)
            if not cascade.empty():
                self._detector = cascade
                log.info("[FaceVerify] Haar Cascade loaded")

        # Load FAISS index
        try:
            index_path = _ML_PATHS["models_dir"] / "face_embeddings.index"
            metadata_path = _ML_PATHS["models_dir"] / "face_embeddings_metadata.pkl"

            if index_path.exists():
                self._faiss_index = faiss.read_index(str(index_path))
                log.info(f"[FaceVerify] FAISS index loaded: {self._faiss_index.ntotal} vectors")

                if metadata_path.exists():
                    with open(metadata_path, 'rb') as f:
                        self._metadata = pickle.load(f)
                    log.info(f"[FaceVerify] Metadata loaded: {len(self._metadata)} entries")
            else:
                log.warning("[FaceVerify] FAISS index not found")

        except Exception as e:
            log.error(f"[FaceVerify] Failed to load FAISS: {e}")

        self._is_loaded = True
        log.info("[FaceVerify] Face Verification Engine loaded!")
        return True

    def _extract_lbph_features(self, gray: np.ndarray) -> np.ndarray:
        """Extract LBPH features (640-D)."""
        h, w = gray.shape
        grid_x, grid_y = 8, 8
        neighbors = 8
        radius = 1
        n_bins = neighbors + 2
        cell_h, cell_w = h // grid_y, w // grid_x

        # Compute LBP
        lbp = np.zeros((h, w), dtype=np.uint8)
        padded = np.pad(gray, radius, mode='edge')

        for i in range(radius, h + radius):
            for j in range(radius, w + radius):
                center = padded[i, j]
                binary = 0
                for k in range(neighbors):
                    angle = 2 * np.pi * k / neighbors
                    ni = int(round(i + radius * np.sin(angle)))
                    nj = int(round(j + radius * np.cos(angle)))
                    if padded[ni, nj] >= center:
                        binary |= (1 << k)
                lbp[i - radius, j - radius] = binary

        # Compute histograms
        histograms = []
        for gy in range(grid_y):
            for gx in range(grid_x):
                y1, y2 = gy * cell_h, (gy + 1) * cell_h
                x1, x2 = gx * cell_w, (gx + 1) * cell_w
                cell = lbp[y1:y2, x1:x2]
                hist, _ = np.histogram(cell, bins=n_bins, range=(0, n_bins))
                hist = hist.astype(np.float32)
                hist /= (hist.sum() + 1e-7)
                histograms.append(hist)

        return np.concatenate(histograms)

    def _preprocess_lbph(self, face: np.ndarray) -> np.ndarray:
        """Preprocess for LBPH."""
        face = cv2.resize(face, (IMG_SIZE_LBPH, IMG_SIZE_LBPH))
        if len(face.shape) == 3:
            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        else:
            gray = face

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Extract LBPH features
        lbph_features = self._extract_lbph_features(enhanced)
        return lbph_features

    def _preprocess_mobilenet(self, face: np.ndarray) -> np.ndarray:
        """Preprocess for MobileNetV2."""
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

        face = cv2.resize(face, (IMG_SIZE_MOBILE, IMG_SIZE_MOBILE))
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        face = face.astype(np.float32)
        face = preprocess_input(face)
        return face

    def extract_embedding(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract embedding from face crop."""
        if self._embedding_model is None or self._mobilenet_extractor is None:
            return None

        try:
            # Preprocess
            lbph_features = self._preprocess_lbph(face_crop)
            mobile_input = self._preprocess_mobilenet(face_crop)

            # Get MobileNet features (1280-D)
            cnn_features = self._mobilenet_extractor.predict(
                np.expand_dims(mobile_input, 0), verbose=0
            )[0]

            # Get embedding (256-D)
            embedding = self._embedding_model.predict(
                [np.expand_dims(lbph_features, 0), np.expand_dims(cnn_features, 0)],
                verbose=0
            )[0]

            return embedding.astype(np.float32)

        except Exception as e:
            log.error(f"[FaceVerify] Embedding extraction failed: {e}")
            return None

    def detect_face(self, image: np.ndarray) -> Optional[dict]:
        """Detect face in image."""
        if self._detector is None:
            return None

        h, w = image.shape[:2]

        # Try YuNet
        if hasattr(self._detector, 'setInputSize'):
            self._detector.setInputSize((w, h))
            _, faces = self._detector.detect(image)

            if faces is not None and len(faces) > 0:
                best_idx = np.argmax(faces[:, 14])
                face = faces[best_idx]
                x, y, bw, bh = map(int, face[:4])
                confidence = float(face[14])

                if bw >= 50 and bh >= 50 and confidence >= 0.2:
                    face_crop = image[y:y+bh, x:x+bw]
                    return {
                        'face_crop': face_crop,
                        'bbox': (x, y, bw, bh),
                        'confidence': confidence
                    }

        # Try Haar
        else:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            faces = self._detector.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))

            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                pad = int(0.1 * min(w, h))
                x1, y1 = max(0, x - pad), max(0, y - pad)
                x2, y2 = min(image.shape[1], x + w + pad), min(image.shape[0], y + h + pad)
                face_crop = image[y1:y2, x1:x2]

                return {
                    'face_crop': face_crop,
                    'bbox': (x1, y1, x2 - x1, y2 - y1),
                    'confidence': 0.7
                }

        return None

    def verify_face(self, image: np.ndarray, nim: str) -> dict:
        """Verify face against specific NIM using FAISS."""
        if self._faiss_index is None or self._faiss_index.ntotal == 0:
            return {
                'valid': False,
                'nim': nim,
                'similarity': 0.0,
                'message': 'Sistem belum siap.'
            }

        # Extract embedding
        embedding = self.extract_embedding(image)
        if embedding is None:
            return {
                'valid': False,
                'nim': nim,
                'similarity': 0.0,
                'message': 'Gagal ekstrak wajah.'
            }

        # Search in FAISS
        query = embedding.reshape(1, -1).astype(np.float32)
        faiss.normalize_L2(query)

        k = min(10, self._faiss_index.ntotal)
        distances, indices = self._faiss_index.search(query, k)

        # Find best match
        best_idx = indices[0][0]
        best_dist = distances[0][0]

        if best_dist >= SIMILARITY_THRESHOLD:
            entry = self._metadata.get(str(best_idx), {})
            person_name = entry.get('person_name', 'Unknown')
            return {
                'valid': True,
                'nim': nim,
                'person_name': person_name,
                'similarity': float(best_dist),
                'message': f'Wajah terverifikasi: {person_name}'
            }

        return {
            'valid': False,
            'nim': nim,
            'similarity': float(best_dist),
            'message': f'Similarity {best_dist:.2f} < threshold {SIMILARITY_THRESHOLD}'
        }


# ─── Pydantic Models ────────────────────────────────────────────────────────────

from typing import Optional as Opt

class FaceScanRequest(BaseModel):
    # Frontend mengirim 'foto_base64', tapi backward-compatible dengan 'foto_wajah'
    foto_base64: Opt[str] = None  # field dari frontend
    foto_wajah: Opt[str] = None  # field lama (compat)
    id_pertemuan: int
    latitude: Opt[float] = None
    longitude: Opt[float] = None

    @property
    def foto(self) -> str:
        """Ambil foto dari field manapun yang terisi."""
        val = self.foto_base64 or self.foto_wajah
        if not val:
            raise ValueError("foto_base64 atau foto_wajah harus diisi")
        return val


class FaceVerifyResponse(BaseModel):
    # Response kompatibel dengan FaceScanResult di frontend
    success: bool
    message: str
    nama_mahasiswa: Opt[str] = None
    nim: Opt[str] = None
    status_presensi: Opt[str] = None
    confidence: Opt[float] = None
    lbph_score: Opt[float] = None   # detail score LBPH
    cnn_score: Opt[float] = None    # detail score CNN
    is_known: Opt[bool] = None
    waktu_presensi: Opt[str] = None
    inference_time_ms: Opt[float] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/face-scan", response_model=FaceVerifyResponse)
def face_scan_absensi(
    request: FaceScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifikasi wajah untuk presensi.
    """
    import time as _time
    t_start = _time.time()

    # Validasi ada foto
    try:
        raw_foto = request.foto
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Decode base64 image
    try:
        foto_wajah = raw_foto.split(",", 1)[1] if "," in raw_foto else raw_foto
        image_data = base64.b64decode(foto_wajah)
        nparr = np.frombuffer(image_data, np.uint8)
        bgr_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if bgr_image is None:
            raise HTTPException(status_code=400, detail="Invalid image data")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decode failed: {str(e)}")

    mahasiswa = db.query(Mahasiswa).filter(Mahasiswa.email == current_user.email).first()
    if not mahasiswa:
        if current_user.role.value in ("admin", "dosen"):
            mahasiswa = db.query(Mahasiswa).first()
        else:
            raise HTTPException(status_code=404, detail="Mahasiswa not found")


    nim = mahasiswa.nim
    nama = mahasiswa.nama_mahasiswa

    wrapper = get_enhanced_face_wrapper()
    if not wrapper._is_loaded and not wrapper.load():
        raise HTTPException(status_code=500, detail="Enhanced face recognition system not ready")

    # ── Anti-Spoofing Check ────────────────────────────────────────────────
    # Periksa apakah gambar adalah foto cetak/layar HP sebelum proses recognition.
    # Jika terdeteksi FAKE → tolak presensi langsung.
    # Jika anti-spoof tidak tersedia (ERROR) → tetap lanjut (graceful fallback).
    anti_spoof_mgr = get_anti_spoof_manager()
    if not anti_spoof_mgr._is_loaded:
        anti_spoof_mgr.load()

    spoof_result = anti_spoof_mgr.predict(bgr_image)
    spoof_label  = spoof_result.get("label", "ERROR")
    spoof_score  = spoof_result.get("score", 0.0)

    log.info(
        f"[face-scan][anti-spoof] NIM={nim} label={spoof_label} "
        f"real_score={spoof_score:.4f} msg={spoof_result.get('message','')}"
    )

    if spoof_label == "FAKE":
        # Blokir presensi — foto palsu/cetak/layar terdeteksi
        return FaceVerifyResponse(
            success=False,
            message=(
                "Terdeteksi foto palsu atau layar HP. "
                "Presensi harus menggunakan wajah asli secara langsung!"
            ),
            nama_mahasiswa=nama,
            nim=nim,
            is_known=False,
            confidence=float(spoof_score),
            cnn_score=0.0,
            lbph_score=0.0,
            inference_time_ms=(_time.time() - t_start) * 1000,
        )
    elif spoof_label == "NO_FACE":
        # Wajah tidak terdeteksi oleh anti-spoof
        return FaceVerifyResponse(
            success=False,
            message="Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.",
            nama_mahasiswa=nama,
            nim=nim,
            is_known=False,
            confidence=0.0,
            cnn_score=0.0,
            lbph_score=0.0,
            inference_time_ms=(_time.time() - t_start) * 1000,
        )
    # label == 'REAL' atau 'ERROR' (fallback) → lanjut ke recognition

    # ── Gunakan recognize() bukan verify() ────────────────────────────────
    # recognize() memanfaatkan multi-template CNN matching (max-similarity)
    # verify() hanya compare ke centroid sehingga skor lebih rendah ~10-15%
    result = wrapper.recognize(bgr_image)

    t_end = _time.time()
    inference_ms = (t_end - t_start) * 1000

    # Map hasil recognize ke format sebelumnya
    recognized_nim = result.get("nim")
    is_match = result.get("is_known", False) and (recognized_nim == nim)
    similarity  = result.get("confidence", result.get("final_score", 0.0))
    cnn_sim     = result.get("cnn_similarity", 0.0)
    lbph_sim    = result.get("lbph_similarity", 0.0)
    threshold   = result.get("threshold", 0.0)
    msg         = result.get("message", "")

    # Logging detail ke uvicorn console — mudah dimonitor
    log.info(
        f"[face-scan] NIM={nim} | recognized_as={recognized_nim} | match={is_match} | "
        f"fused={similarity:.4f} | cnn={cnn_sim:.4f} | lbph={lbph_sim:.4f} | "
        f"threshold={threshold:.4f} | inference={inference_ms:.0f}ms | img={bgr_image.shape}"
    )

    if is_match:
        # Catat presensi jika berhasil
        from datetime import datetime, timezone as tz
        from app.models.pertemuan import Pertemuan, StatusPertemuanEnum
        from app.models.presensi import Presensi, StatusPresensiEnum

        pertemuan = db.query(Pertemuan).filter(Pertemuan.id_pertemuan == request.id_pertemuan).first()
        if not pertemuan:
            raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")

        # Cek apakah sudah ada record presensi yang BENAR-BENAR sudah dicatat
        # (status selain "belum" = sudah scan sebelumnya)
        existing_done = db.query(Presensi).filter(
            Presensi.id_pertemuan == request.id_pertemuan,
            Presensi.id_mahasiswa == mahasiswa.id_mahasiswa,
            Presensi.status_presensi != StatusPresensiEnum.belum,
        ).first()

        if existing_done:
            # Sudah benar-benar presensi sebelumnya (hadir/terlambat/dll)
            return FaceVerifyResponse(
                success=False,
                message="Anda sudah melakukan presensi untuk pertemuan ini",
                nama_mahasiswa=nama,
                nim=nim,
                status_presensi=existing_done.status_presensi.value if existing_done.status_presensi else None,
                confidence=float(similarity),
                cnn_score=float(cnn_sim),
                lbph_score=float(lbph_sim),
                is_known=True,
                inference_time_ms=inference_ms,
            )

        import zoneinfo
        now = datetime.now(zoneinfo.ZoneInfo("Asia/Jakarta")).replace(tzinfo=None)
        # Tentukan status presensi berdasarkan batas_presensi pertemuan
        status = StatusPresensiEnum.hadir
        if pertemuan.batas_presensi:
            # batas_presensi mungkin naive datetime, bandingkan dengan aman
            batas = pertemuan.batas_presensi
            if batas.tzinfo is not None:
                batas = batas.replace(tzinfo=None)
            if now > batas:
                status = StatusPresensiEnum.terlambat

        # Cek apakah ada record pre-populated dengan status "belum"
        # Jika ada, update record tersebut (bukan insert baru)
        existing_belum = db.query(Presensi).filter(
            Presensi.id_pertemuan == request.id_pertemuan,
            Presensi.id_mahasiswa == mahasiswa.id_mahasiswa,
            Presensi.status_presensi == StatusPresensiEnum.belum,
        ).first()

        if existing_belum:
            # Update record yang sudah ada (pre-populated)
            existing_belum.status_presensi = status
            existing_belum.waktu_presensi = now
            existing_belum.latitude_presensi = request.latitude
            existing_belum.longitude_presensi = request.longitude
            existing_belum.confidence_score = float(similarity)
            existing_belum.lbph_score = float(lbph_sim)
            existing_belum.cnn_score = float(cnn_sim)
            existing_belum.metode_deteksi = "face_recognition"
            db.commit()
            db.refresh(existing_belum)
            new_presensi = existing_belum
        else:
            # Insert record baru jika belum ada sama sekali
            new_presensi = Presensi(
                id_pertemuan=request.id_pertemuan,
                id_mahasiswa=mahasiswa.id_mahasiswa,
                status_presensi=status,
                waktu_presensi=now,
                latitude_presensi=request.latitude,
                longitude_presensi=request.longitude,
                confidence_score=float(similarity),
                lbph_score=float(lbph_sim),
                cnn_score=float(cnn_sim),
                metode_deteksi="face_recognition",
            )
            db.add(new_presensi)
            db.commit()
            db.refresh(new_presensi)

        return FaceVerifyResponse(
            success=True,
            message="Presensi berhasil dicatat",
            nama_mahasiswa=nama,
            nim=nim,
            status_presensi=status.value,
            confidence=float(similarity),
            cnn_score=float(cnn_sim),
            lbph_score=float(lbph_sim),
            is_known=True,
            waktu_presensi=now.isoformat(),
            inference_time_ms=inference_ms,
        )
    else:
        return FaceVerifyResponse(
            success=False,
            message=msg or "Wajah tidak dikenali",
            confidence=float(similarity),
            cnn_score=float(cnn_sim),
            lbph_score=float(lbph_sim),
            is_known=False,
            inference_time_ms=inference_ms,
        )


@router.get("/test-model")
def test_model():
    """Test endpoint to verify model is loaded."""
    wrapper = get_enhanced_face_wrapper()
    loaded = wrapper._is_loaded or wrapper.load()
    health = wrapper.health()

    return {
        "loaded": loaded,
        "model": "Enhanced LBPH + MobileFaceNet Score-Level Fusion",
        "gallery_size": health.get("gallery_size", 0),
        "similarity_threshold": health.get("threshold", 0.0),
        "architecture": health.get("architecture", "Score-Level Fusion")
    }


@router.post("/anti-spoof-test")
def anti_spoof_test(
    request: FaceScanRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Test anti-spoofing tanpa melakukan face recognition.
    Berguna untuk debug: kirim foto dan lihat apakah terdeteksi REAL atau FAKE.

    Returns:
        is_real   : True jika wajah asli
        label     : 'REAL', 'FAKE', 'NO_FACE', atau 'ERROR'
        score     : Probabilitas wajah asli (0-1)
        message   : Deskripsi hasil
        raw_scores: Skor detail per model
    """
    try:
        raw_foto = request.foto
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        foto_wajah = raw_foto.split(",", 1)[1] if "," in raw_foto else raw_foto
        image_data = base64.b64decode(foto_wajah)
        nparr = np.frombuffer(image_data, np.uint8)
        bgr_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if bgr_image is None:
            raise HTTPException(status_code=400, detail="Invalid image data")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decode failed: {str(e)}")

    anti_spoof_mgr = get_anti_spoof_manager()
    if not anti_spoof_mgr._is_loaded:
        anti_spoof_mgr.load()

    result = anti_spoof_mgr.predict(bgr_image)

    return {
        "success"   : True,
        "is_real"   : result.get("is_real"),
        "label"     : result.get("label"),
        "score"     : result.get("score"),
        "message"   : result.get("message"),
        "raw_scores": result.get("raw_scores", {}),
        "anti_spoof_health": anti_spoof_mgr.health()
    }


@router.post("/reload-gallery")
def reload_gallery():
    """
    Reload gallery dari disk tanpa restart server.
    Diperlukan setelah enrollment baru via enroll_model.py agar backend
    menggunakan gallery terbaru (multi-template LBPH).
    """
    from app.utils.dependencies import require_dosen
    wrapper = get_enhanced_face_wrapper()
    if not wrapper._is_loaded:
        wrapper.load()
        return {"success": True, "message": "System loaded", "gallery_size": wrapper.get_gallery_size()}

    # Reload gallery dari file .pkl
    try:
        gallery = wrapper._system.gallery
        gallery.load()   # load dari disk
        size = wrapper.get_gallery_size()
        log.info(f"[reload-gallery] Gallery reloaded: {size} identities")
        return {
            "success": True,
            "message": f"Gallery reloaded: {size} identities",
            "gallery_size": size,
            "identities": wrapper.list_identities()
        }
    except Exception as e:
        log.error(f"[reload-gallery] Error: {e}")
        return {"success": False, "message": str(e)}
