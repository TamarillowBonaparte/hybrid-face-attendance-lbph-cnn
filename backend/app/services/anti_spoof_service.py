"""
anti_spoof_service.py
=====================
Anti-Spoofing Service menggunakan Silent-Face-Anti-Spoofing (minivision-ai).

Mendeteksi:
- Foto cetak (kertas/print attack)
- Foto dari layar HP/monitor (replay attack)
- Video replay
- Wajah asli (REAL)

Model: MiniFASNetV2 + MiniFASNetV1SE (ensemble)
File model: SilentFaceAntiSpoofing/resources/anti_spoof_models/*.pth

Cara kerja:
1. Deteksi wajah menggunakan RetinaFace (bawaan SilentFace) → fallback Haar
2. Crop wajah dengan scale berbeda untuk tiap model
3. Prediksi probabilitas REAL vs FAKE per model
4. Ensemble sum → keputusan final

Author: Skripsi 2026
"""

import logging
import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np

log = logging.getLogger(__name__)

# ─── Path Configuration ──────────────────────────────────────────────────────────
_CURRENT_FILE = Path(__file__).resolve()
_BACKEND_DIR  = _CURRENT_FILE.parent.parent.parent           # backend/
_ROOT_DIR     = _BACKEND_DIR.parent                           # face_recognition_system/
_SILENT_DIR   = _ROOT_DIR / "SilentFaceAntiSpoofing"         # SilentFaceAntiSpoofing/
_MODELS_DIR   = _SILENT_DIR / "resources" / "anti_spoof_models"
_DETECT_DIR   = _SILENT_DIR / "resources" / "detection_model"

log.info(f"[AntiSpoof] SilentFace dir : {_SILENT_DIR}")
log.info(f"[AntiSpoof] Models dir     : {_MODELS_DIR}")


class AntiSpoofManager:
    """
    Singleton manager untuk anti-spoofing.

    Penggunaan:
        manager = AntiSpoofManager.get_instance()
        result  = manager.predict(bgr_image)
        # result['is_real']  -> True jika wajah asli
        # result['score']    -> confidence REAL (0-1)
        # result['label']    -> 'REAL', 'FAKE', 'NO_FACE', atau 'ERROR'
        # result['message']  -> deskripsi
    """

    _instance: "AntiSpoofManager" = None
    _is_loaded: bool = False
    _predictor = None   # AntiSpoofPredict
    _cropper   = None   # CropImage

    @classmethod
    def get_instance(cls) -> "AntiSpoofManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ─── Loading ────────────────────────────────────────────────────────────────

    def load(self) -> bool:
        """Load SilentFace komponen ke memori."""
        if self._is_loaded:
            return True

        if not _SILENT_DIR.exists():
            log.error(f"[AntiSpoof] Folder SilentFace tidak ada: {_SILENT_DIR}")
            return False

        model_files = list(_MODELS_DIR.glob("*.pth"))
        if not model_files:
            log.error(f"[AntiSpoof] Tidak ada model .pth di: {_MODELS_DIR}")
            return False

        # Tambahkan SilentFaceAntiSpoofing ke sys.path
        silent_str = str(_SILENT_DIR)
        if silent_str not in sys.path:
            sys.path.insert(0, silent_str)
            log.info(f"[AntiSpoof] sys.path += {silent_str}")

        try:
            import warnings
            warnings.filterwarnings("ignore")

            from src.anti_spoof_predict import AntiSpoofPredict
            from src.generate_patches import CropImage

            self._predictor = AntiSpoofPredict(device_id=0)   # auto CPU jika tidak ada GPU
            self._cropper   = CropImage()
            self._is_loaded = True

            log.info(
                f"[AntiSpoof] Loaded! Models: {[m.name for m in model_files]}"
            )
            return True

        except ImportError as e:
            log.error(f"[AntiSpoof] Import error: {e}")
            log.error(
                "[AntiSpoof] Pastikan torch & torchvision terinstall di venv backend.\n"
                "  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu"
            )
            return False
        except Exception as e:
            log.error(f"[AntiSpoof] Load error: {e}")
            import traceback
            traceback.print_exc()
            return False

    # ─── Predict ────────────────────────────────────────────────────────────────

    def predict(self, bgr_image: np.ndarray) -> Dict[str, Any]:
        """
        Prediksi apakah wajah REAL atau FAKE (spoof).

        Args:
            bgr_image: Gambar BGR (numpy array)

        Returns:
            {
                is_real   (bool | None): True=asli, False=spoof, None=error
                score     (float)      : probabilitas REAL (0-1)
                label     (str)        : 'REAL', 'FAKE', 'NO_FACE', 'ERROR'
                message   (str)        : deskripsi singkat
                raw_scores (dict)      : skor per model
            }
        """
        if not self._is_loaded:
            if not self.load():
                return self._error_response("Anti-spoof system tidak tersedia")

        try:
            import warnings
            warnings.filterwarnings("ignore")
            from src.utility import parse_model_name

            # 1. Deteksi wajah
            image_bbox = self._get_bbox(bgr_image)
            if image_bbox is None:
                log.warning("[AntiSpoof] Wajah tidak terdeteksi")
                return {
                    "is_real"   : False,
                    "score"     : 0.0,
                    "label"     : "NO_FACE",
                    "message"   : "Wajah tidak terdeteksi oleh anti-spoof detector",
                    "raw_scores": {}
                }

            # 2. Jalankan setiap model .pth (ensemble sum)
            prediction  = np.zeros((1, 3))
            raw_scores: Dict[str, Any] = {}
            model_files = list(_MODELS_DIR.glob("*.pth"))

            for model_path in model_files:
                model_name = model_path.name
                try:
                    h_input, w_input, model_type, scale = parse_model_name(model_name)
                    param = {
                        "org_img": bgr_image,
                        "bbox"   : image_bbox,
                        "scale"  : scale,
                        "out_w"  : w_input,
                        "out_h"  : h_input,
                        "crop"   : scale is not None,
                    }
                    img_patch = self._cropper.crop(**param)
                    pred      = self._predictor.predict(img_patch, str(model_path))
                    prediction += pred

                    label_idx = int(np.argmax(pred))
                    raw_scores[model_name] = {
                        "label"    : "REAL" if label_idx == 1 else "FAKE",
                        "real_prob": float(pred[0][1]),
                        "fake_prob": float(pred[0][0]),
                    }
                    log.debug(
                        f"[AntiSpoof] {model_name}: "
                        f"label={raw_scores[model_name]['label']} "
                        f"real={raw_scores[model_name]['real_prob']:.3f}"
                    )
                except Exception as model_err:
                    log.warning(f"[AntiSpoof] Model {model_name} error: {model_err}")

            if not raw_scores:
                return self._error_response("Semua model anti-spoof gagal dijalankan")

            # 3. Keputusan final
            final_label_idx = int(np.argmax(prediction))
            total           = float(prediction.sum()) + 1e-7
            real_score      = float(prediction[0][1]) / total  # index 1 = REAL
            is_real         = (final_label_idx == 1)

            log.info(
                f"[AntiSpoof] Result: label={'REAL' if is_real else 'FAKE'} "
                f"real_score={real_score:.4f} models={list(raw_scores.keys())}"
            )

            if is_real:
                return {
                    "is_real"   : True,
                    "score"     : real_score,
                    "label"     : "REAL",
                    "message"   : f"Wajah asli terdeteksi (score: {real_score:.2f})",
                    "raw_scores": raw_scores
                }
            else:
                return {
                    "is_real"   : False,
                    "score"     : real_score,
                    "label"     : "FAKE",
                    "message"   : (
                        f"Terdeteksi spoofing/foto palsu (real_score: {real_score:.2f}). "
                        "Gunakan wajah asli Anda secara langsung!"
                    ),
                    "raw_scores": raw_scores
                }

        except Exception as e:
            log.error(f"[AntiSpoof] Predict error: {e}")
            import traceback
            traceback.print_exc()
            return self._error_response(f"Anti-spoof internal error: {str(e)}")

    # ─── Helpers ────────────────────────────────────────────────────────────────

    def _get_bbox(self, bgr_image: np.ndarray) -> Optional[list]:
        """
        Deteksi wajah → bounding box [x, y, w, h].
        Primary: RetinaFace bawaan SilentFace.
        Fallback: Haar cascade OpenCV.
        """
        # Primary: RetinaFace (bawaan SilentFace)
        try:
            bbox = self._predictor.get_bbox(bgr_image)
            if bbox and len(bbox) == 4 and bbox[2] > 0 and bbox[3] > 0:
                return bbox
        except Exception as e:
            log.debug(f"[AntiSpoof] RetinaFace bbox error: {e}")

        # Fallback: Haar cascade
        try:
            import cv2
            gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
            haar_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            cascade   = cv2.CascadeClassifier(haar_path)
            faces     = cascade.detectMultiScale(gray, 1.1, 4, minSize=(60, 60))
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                log.debug(f"[AntiSpoof] Haar fallback bbox: [{x},{y},{w},{h}]")
                return [int(x), int(y), int(w), int(h)]
        except Exception as e:
            log.debug(f"[AntiSpoof] Haar fallback error: {e}")

        return None

    def _error_response(self, message: str) -> Dict[str, Any]:
        return {
            "is_real"   : None,
            "score"     : 0.0,
            "label"     : "ERROR",
            "message"   : message,
            "raw_scores": {}
        }

    @property
    def available(self) -> bool:
        return self._is_loaded

    def health(self) -> Dict[str, Any]:
        model_files = list(_MODELS_DIR.glob("*.pth")) if _MODELS_DIR.exists() else []
        return {
            "available"      : self._is_loaded,
            "silent_face_dir": str(_SILENT_DIR),
            "models_dir"     : str(_MODELS_DIR),
            "models"         : [m.name for m in model_files],
            "model_count"    : len(model_files),
        }


# ─── Singleton helpers ───────────────────────────────────────────────────────────

_manager_instance: Optional[AntiSpoofManager] = None


def get_anti_spoof_manager() -> AntiSpoofManager:
    """Singleton AntiSpoofManager."""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = AntiSpoofManager()
    return _manager_instance


def preload_anti_spoof() -> bool:
    """Pre-load saat startup backend."""
    try:
        return get_anti_spoof_manager().load()
    except Exception as e:
        log.warning(f"[AntiSpoof] Preload failed: {e}")
        return False


def check_anti_spoof(bgr_image: np.ndarray) -> Dict[str, Any]:
    """
    Convenience function: check apakah gambar spoofing.

    Returns:
        Dict dengan is_real, score, label, message
    """
    manager = get_anti_spoof_manager()
    if not manager._is_loaded:
        manager.load()
    return manager.predict(bgr_image)
