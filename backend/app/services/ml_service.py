"""
ml_service.py
=============
Bridge service untuk mengintegrasikan Face Recognition Pipeline
dengan backend FastAPI.

Mendukung DUA model:
1. Classification Model (LBPH + MobileNetV2 + Softmax)
   - Training-based recognition
   - Requires retraining for new students

2. ArcFace Model (LBPH + MobileNetV2 + ArcFace Loss + FAISS)
   - Embedding-based recognition
   - Zero-shot enrollment (no retraining needed)
   - FAISS for similarity search

Author: Face Recognition Skripsi
"""

import logging
import sys
import os
from pathlib import Path
from typing import Dict, Any

log = logging.getLogger(__name__)

# Path absolut ke folder ModelBaru (BARU)
_CURRENT_FILE = Path(__file__).resolve()
_BACKEND_DIR = _CURRENT_FILE.parent.parent.parent  # backend/
_ROOT_DIR = _BACKEND_DIR.parent  # face_recognition_system/
_MODELBARU_DIR = _ROOT_DIR / "ModelBaru"  # ModelBaru/
_MODELS_DIR = _MODELBARU_DIR / "models"  # ModelBaru/models/
_FACE_MAHASISWA_DIR = _MODELBARU_DIR / "face_mahasiswa"  # ModelBaru/face_mahasiswa/

log.info(f"[ML] Backend dir: {_BACKEND_DIR}")
log.info(f"[ML] ModelBaru dir: {_MODELBARU_DIR}")
log.info(f"[ML] Models dir: {_MODELS_DIR}")

# Singleton models
_classification_model = None
_arcface_model = None
_enhanced_model = None

# Get active model type from environment or settings
def _get_model_type() -> str:
    """Get active model type from environment variable or settings."""
    # Try settings first
    try:
        from app.config.settings import settings
        return settings.FACE_MODEL_TYPE.lower()
    except Exception:
        pass

    # Fallback to environment
    return os.getenv("FACE_MODEL_TYPE", "enhanced").lower()


def _ensure_ml_path():
    """Tambahkan folder ModelBaru ke sys.path."""
    paths_to_add = [
        str(_MODELS_DIR),
        str(_MODELBARU_DIR),
        str(_ROOT_DIR / "ML"),
    ]

    for path in paths_to_add:
        if path not in sys.path:
            sys.path.insert(0, path)
            log.info(f"[ML] Added to sys.path: {path}")
        else:
            log.debug(f"[ML] Already in sys.path: {path}")


# ============================================================
# CLASSIFICATION MODEL (LBPH + MobileNetV2 + Softmax)
# ============================================================

class HybridFaceRecognitionWrapper:
    """
    Wrapper untuk Hybrid Face Recognition Model (Classification).

    Model: LBPH (640-D) + MobileNetV2 (1280-D) = 1920-D Feature Fusion
    Output: Softmax classification
    """

    def __init__(self):
        self._engine = None
        self._label_encoder = {}
        self._is_loaded = False
        self._model_path = str(_MODELS_DIR / "hybrid_face_model.keras")
        self._label_path = str(_MODELS_DIR / "label_encoder.pkl")
        self._engine_class = None

        log.info(f"[ML-Classification] Model path: {self._model_path}")

    def load(self) -> bool:
        """Load the hybrid face recognition model."""
        if self._is_loaded:
            log.info("[ML-Classification] Model already loaded")
            return True

        _ensure_ml_path()

        # Use importlib to load modules from ML/new_pipeline/models
        import importlib.util

        def load_module_from_path(module_name: str, file_path: Path):
            """Load a module from a specific file path."""
            spec = importlib.util.spec_from_file_location(module_name, file_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = module
                spec.loader.exec_module(module)
                return module
            return None

        # Try to load hybrid_inference
        hybrid_inference_path = _MODELS_DIR / "hybrid_inference.py"
        if hybrid_inference_path.exists():
            try:
                module = load_module_from_path("hybrid_inference", hybrid_inference_path)
                if module and hasattr(module, 'HybridInferenceEngine'):
                    self._engine_class = module.HybridInferenceEngine
                    log.info("[ML-Classification] Engine class loaded via importlib")
                else:
                    raise ImportError("HybridInferenceEngine not found in module")
            except Exception as e:
                log.error(f"[ML-Classification] Failed to load hybrid_inference: {e}")
                return False
        else:
            log.error(f"[ML-Classification] hybrid_inference.py not found at {hybrid_inference_path}")
            return False

        try:
            self._engine = self._engine_class(
                model_path=self._model_path,
                label_path=self._label_path,
                confidence_threshold=0.40
            )

            success = self._engine.load()

            if success:
                self._is_loaded = True
                log.info("[ML-Classification] ✅ Model loaded successfully!")
            else:
                log.error("[ML-Classification] Model load returned False")

            return success

        except Exception as e:
            log.error(f"[ML-Classification] Failed to load engine: {e}")
            import traceback
            traceback.print_exc()
            return False

    def recognize(self, bgr_image) -> Dict[str, Any]:
        """
        Kenali wajah dalam gambar.

        Returns:
            Dict dengan keys:
            - is_known: bool
            - person_name: str (NIM or name)
            - confidence: float (0-1)
            - lbph_confidence: float
            - cnn_similarity: float
            - message: str
            - detector: str
            - inference_time_ms: float
            - bbox: list
        """
        if not self._is_loaded:
            if not self.load():
                return self._error_response("Model not loaded")

        try:
            import cv2
            log.info(f"[ML-Classification] Recognizing face from image shape: {bgr_image.shape}")

            # Try multiple approaches
            approaches = [
                ("original", bgr_image),
                ("flipped_h", cv2.flip(bgr_image, 1)),
            ]

            best_result = None
            best_confidence_result = None

            for name, img in approaches:
                try:
                    result = self._engine.recognize(img)

                    if best_confidence_result is None or result.confidence > best_confidence_result.confidence:
                        best_confidence_result = result

                    if result.recognized:
                        best_result = result
                        if result.confidence > 0.6:
                            break
                except Exception as approach_err:
                    log.warning(f"[ML-Classification] Approach {name} failed: {approach_err}")

            if best_result is None:
                if best_confidence_result is not None:
                    best_result = best_confidence_result
                else:
                    return self._error_response("All detection approaches failed")

            return {
                "is_known": best_result.recognized,
                "person_name": best_result.person_name,
                "confidence": float(best_result.confidence),
                "lbph_confidence": float(best_result.confidence),
                "cnn_similarity": float(best_result.confidence),
                "message": best_result.message,
                "detector": best_result.detector,
                "inference_time_ms": float(best_result.inference_time_ms),
                "bbox": best_result.bbox,
                "predictions": best_result.predictions if hasattr(best_result, 'predictions') else [],
                "model_type": "classification"
            }

        except Exception as e:
            log.error(f"[ML-Classification] Recognition error: {e}")
            import traceback
            traceback.print_exc()
            return self._error_response(f"Recognition error: {str(e)}")

    def _error_response(self, message: str) -> Dict[str, Any]:
        """Return error response."""
        return {
            "is_known": False,
            "person_name": "Unknown",
            "confidence": 0.0,
            "lbph_confidence": 0.0,
            "cnn_similarity": 0.0,
            "message": message,
            "detector": "error",
            "inference_time_ms": 0.0,
            "bbox": [0, 0, 0, 0],
            "model_type": "classification"
        }

    def health(self) -> Dict[str, Any]:
        """Return health status."""
        return {
            "model_loaded": self._is_loaded,
            "model_type": "classification",
            "model_name": "Hybrid LBPH + MobileNetV2",
            "architecture": "Softmax classification",
            "embedding_or_classification": "classification",
            "features": [
                "LBPH texture features (640-D)",
                "MobileNetV2 deep features (1280-D)",
                "Feature-level fusion (1920-D)",
                "Eye landmark face alignment",
                "CLAHE preprocessing"
            ],
            "paths": {
                "model": self._model_path,
                "labels": self._label_path,
                "pipeline": str(_MODELBARU_DIR)
            }
        }


# ============================================================
# ARCFACE MODEL (Embedding + FAISS)
# ============================================================

class ArcFaceRecognitionWrapper:
    """
    Wrapper untuk Oneshot Face Recognition dengan LBPH + MobileNetV2.

    Model: LBPH + MobileNetV2 untuk extract embedding (tanpa training)
    Output: 1920-D embeddings + FAISS similarity search

    Features:
    - Oneshot enrollment (no retraining)
    - FAISS for fast nearest neighbor search
    - Menggunakan model hybrid yang sudah ada
    """

    def __init__(self):
        self._enrollment_system = None
        self._is_loaded = False
        log.info("[ML-Oneshot] Initialized (uses Hybrid LBPH + MobileNetV2)")

    def load(self) -> bool:
        """Load the enrollment system for oneshot recognition."""
        if self._is_loaded:
            log.info("[ML-Oneshot] System already loaded")
            return True

        try:
            # Import enrollment system
            from app.routes.arcface_enrollment import HybridEnrollmentSystem

            self._enrollment_system = HybridEnrollmentSystem.get_instance()

            if not self._enrollment_system._is_loaded:
                success = self._enrollment_system.load()
                if not success:
                    log.error("[ML-Oneshot] Failed to load enrollment system")
                    return False

            self._is_loaded = True
            log.info("[ML-Oneshot] ✅ Hybrid LBPH + MobileNetV2 loaded successfully!")
            stats = self._enrollment_system.get_stats()
            log.info(f"[ML-Oneshot] FAISS index: {stats.get('total_embeddings', 0)} embeddings")

            return True

        except Exception as e:
            log.error(f"[ML-Oneshot] Failed to load: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _search_faiss(self, embedding) -> tuple:
        """Search embedding in FAISS index."""
        import numpy as np

        try:
            # Get FAISS index from enrollment system
            if self._enrollment_system._faiss_index is None:
                return None, 0.0

            index = self._enrollment_system._faiss_index
            metadata = self._enrollment_system._metadata

            if index.ntotal == 0:
                return None, 0.0

            # Normalize query embedding
            query = embedding.reshape(1, -1).astype(np.float32)
            norm = np.linalg.norm(query)
            if norm > 0:
                query = query / norm

            # Search FAISS
            k = min(5, index.ntotal)  # Search top 5
            scores, indices = index.search(query, k)

            # Get best match
            best_idx = indices[0][0]
            best_score = scores[0][0]

            # Skip if deleted
            if best_idx >= 0 and str(best_idx) in metadata:
                entry = metadata[str(best_idx)]
                if not entry.get('deleted', False):
                    return entry, float(best_score)

            return None, 0.0

        except Exception as e:
            log.error(f"[ML-Oneshot] FAISS search failed: {e}")
            return None, 0.0

    def recognize(self, bgr_image) -> Dict[str, Any]:
        """
        Kenali wajah dalam gambar menggunakan oneshot LBPH + MobileNetV2.

        Returns:
            Dict dengan keys:
            - is_known: bool
            - person_name: str
            - confidence: float (similarity 0-1)
            - person_id: str
            - message: str
            - detector: str
            - inference_time_ms: float
            - bbox: list
        """
        import time
        start_time = time.time()

        if not self._is_loaded:
            if not self.load():
                return self._error_response("System not loaded")

        try:
            import cv2
            log.info(f"[ML-Oneshot] Recognizing face from image shape: {bgr_image.shape}")

            # Detect face
            face_result = self._enrollment_system._detect_face(bgr_image)
            if face_result is None:
                return self._error_response("No face detected")

            face_crop = face_result['face_crop']
            bbox = face_result['bbox']
            log.info(f"[ML-Oneshot] Face detected: bbox={bbox}")

            # Extract embedding using hybrid model
            embedding = self._enrollment_system.extract_embedding(face_crop)
            if embedding is None:
                return self._error_response("Failed to extract embedding")

            # Search in FAISS
            match, score = self._search_faiss(embedding)

            inference_time = (time.time() - start_time) * 1000

            if match is not None:
                return {
                    "is_known": True,
                    "person_name": match.get('person_name', 'Unknown'),
                    "person_id": match.get('person_id', 'Unknown'),
                    "confidence": float(score),
                    "lbph_confidence": float(score),
                    "cnn_similarity": float(score),
                    "message": f"Recognized: {match.get('person_name')}",
                    "detector": "yunet",
                    "inference_time_ms": float(inference_time),
                    "bbox": bbox,
                    "predictions": [],
                    "model_type": "arcface"
                }
            else:
                return {
                    "is_known": False,
                    "person_name": "Unknown",
                    "person_id": "Unknown",
                    "confidence": 0.0,
                    "lbph_confidence": 0.0,
                    "cnn_similarity": 0.0,
                    "message": "Face not recognized - enroll first!",
                    "detector": "yunet",
                    "inference_time_ms": float(inference_time),
                    "bbox": bbox,
                    "predictions": [],
                    "model_type": "arcface"
                }

        except Exception as e:
            log.error(f"[ML-Oneshot] Recognition error: {e}")
            import traceback
            traceback.print_exc()
            return self._error_response(f"Recognition error: {str(e)}")

    def _error_response(self, message: str) -> Dict[str, Any]:
        """Return error response."""
        return {
            "is_known": False,
            "person_name": "Unknown",
            "person_id": "Unknown",
            "confidence": 0.0,
            "lbph_confidence": 0.0,
            "cnn_similarity": 0.0,
            "message": message,
            "detector": "error",
            "inference_time_ms": 0.0,
            "bbox": [0, 0, 0, 0],
            "model_type": "arcface"
        }

    def health(self) -> Dict[str, Any]:
        """Return health status."""
        stats = {}
        if self._enrollment_system:
            stats = self._enrollment_system.get_stats()

        return {
            "model_loaded": self._is_loaded,
            "model_type": "arcface",
            "model_name": "Hybrid LBPH + MobileNetV2 (Oneshot)",
            "architecture": "Embedding (1920-D) + FAISS search",
            "embedding_or_classification": "embedding",
            "features": [
                "LBPH texture features (640-D)",
                "MobileNetV2 deep features (1280-D)",
                "Feature-level fusion (1920-D)",
                "FAISS IndexFlatIP for fast search",
                "Oneshot enrollment (no retraining)"
            ],
            "index_stats": stats,
            "paths": {
                "pipeline": str(_MODELBARU_DIR),
                "index": str(_MODELS_DIR / "face_embeddings.index")
            }
        }

    def enroll(
        self,
        person_id: str,
        person_name: str,
        bgr_image
    ) -> Dict[str, Any]:
        """
        Enroll new person (Oneshot mode).

        Args:
            person_id: Unique identifier (e.g., NIM)
            person_name: Display name
            bgr_image: BGR image

        Returns:
            Dict dengan enrollment result
        """
        if not self._is_loaded:
            if not self.load():
                return {"success": False, "message": "System not loaded"}

        try:
            success = self._enrollment_system.enroll(person_id, person_name, bgr_image)
            return {
                "success": success,
                "message": f"Enrolled: {person_name} ({person_id})" if success else "Enrollment failed"
            }
        except Exception as e:
            log.error(f"[ML-Oneshot] Enrollment error: {e}")
            return {"success": False, "message": str(e)}


# ============================================================
# ENHANCED FACE MODEL (Score-Level Fusion)
# ============================================================

class EnhancedFaceRecognitionWrapper:
    """
    Wrapper untuk EnhancedFaceRecognitionSystem dari ModelBaru.

    Arsitektur Score-Level Fusion:
    - LBPH features (640-D)
    - MobileFaceNet embedding (512-D) via ONNX
    - wCNN = QualityScore (0.5 - 0.8)
    - wLBPH = 1 - wCNN (0.2 - 0.5)

    Features:
    - YuNet face detection
    - Quality Assessment (Blur, Brightness, Pose)
    - Multi-frame enrollment (15 → 5 best frames)
    - Incremental Template Update (sim >= 0.98)
    - Top-K results
    """

    _instance = None
    _system = None
    _is_loaded = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self) -> bool:
        """Load EnhancedFaceRecognitionSystem."""
        if self._is_loaded:
            return True

        try:
            # Tambahkan ModelBaru ke sys.path
            _ensure_ml_path()

            from enhanced_system import EnhancedFaceRecognitionSystem

            os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

            self._system = EnhancedFaceRecognitionSystem()
            self._is_loaded = True

            log.info("[ML-Enhanced] EnhancedFaceRecognitionSystem loaded!")
            log.info(f"[ML-Enhanced] Gallery: {self._system.get_gallery_size()} identities")
            log.info(f"[ML-Enhanced] Threshold: {self._system.calibrator.get_threshold():.4f}")

            return True

        except ImportError as e:
            log.error(f"[ML-Enhanced] Import error: {e}")
            return False
        except Exception as e:
            log.error(f"[ML-Enhanced] Load error: {e}")
            import traceback
            traceback.print_exc()
            return False

    def enroll(self, nim: str, frames: list, metadata: dict = None) -> dict:
        """Enroll with multi-frame."""
        if not self._is_loaded:
            if not self.load():
                return {"success": False, "message": "System not loaded"}

        try:
            success = self._system.enroll(nim, frames, metadata)
            return {
                "success": success,
                "message": f"Enrolled: {nim}" if success else "Failed"
            }
        except Exception as e:
            log.error(f"[ML-Enhanced] Enrollment error: {e}")
            return {"success": False, "message": str(e)}

    def recognize(self, bgr_image) -> dict:
        """Recognize face."""
        if not self._is_loaded:
            if not self.load():
                return self._error_response("System not loaded")

        try:
            result = self._system.recognize(bgr_image, update_template=True)

            if result.is_recognized:
                return {
                    "is_known": True,
                    "person_name": result.nim,
                    "confidence": float(result.similarity),
                    "cnn_similarity": float(result.cnn_similarity),
                    "lbph_similarity": float(result.lbph_similarity),
                    "message": f"Recognized: {result.nim}",
                    "model_type": "enhanced_score_fusion",
                    "top_k": [
                        {"nim": r['nim'], "score": float(r['fused'])}
                        for r in (result.top_k_results or [])[:3]
                    ]
                }
            else:
                return {
                    "is_known": False,
                    "person_name": "Unknown",
                    "confidence": float(result.similarity),
                    "cnn_similarity": float(result.cnn_similarity),
                    "lbph_similarity": float(result.lbph_similarity),
                    "message": f"Unknown (sim={result.similarity:.4f})",
                    "model_type": "enhanced_score_fusion"
                }
        except Exception as e:
            log.error(f"[ML-Enhanced] Recognition error: {e}")
            return self._error_response(str(e))

    def verify(self, bgr_image, nim: str) -> tuple:
        """Verify against specific NIM."""
        if not self._is_loaded:
            if not self.load():
                return False, 0.0

        try:
            return self._system.verify(bgr_image, nim)
        except Exception as e:
            log.error(f"[ML-Enhanced] Verify error: {e}")
            return False, 0.0

    def get_gallery_size(self) -> int:
        return self._system.get_gallery_size() if self._is_loaded else 0

    def list_identities(self) -> list:
        return self._system.list_identities() if self._is_loaded else []

    def health(self) -> dict:
        if not self._is_loaded:
            return {
                "model_loaded": False,
                "model_type": "enhanced_score_fusion",
                "architecture": "Score-Level Fusion"
            }

        return {
            "model_loaded": True,
            "model_type": "enhanced_score_fusion",
            "model_name": "EnhancedFaceRecognitionSystem",
            "architecture": "Score-Level Fusion (LBPH + MobileFaceNet)",
            "gallery_size": self._system.get_gallery_size(),
            "threshold": float(self._system.calibrator.get_threshold()),
            "features": [
                "YuNet face detection",
                "Quality Assessment (Blur, Brightness, Pose)",
                "LBPH (640-D) + MobileFaceNet (512-D)",
                "Score-Level Fusion with Quality-Aware Weights",
                "Multi-frame enrollment (15 → 5)",
                "Incremental Template Update"
            ]
        }

    def _error_response(self, message: str) -> dict:
        return {
            "is_known": False,
            "person_name": "Unknown",
            "confidence": 0.0,
            "cnn_similarity": 0.0,
            "lbph_similarity": 0.0,
            "message": message,
            "model_type": "enhanced_score_fusion"
        }


# ============================================================
# UNIFIED MODEL MANAGER
# ============================================================

class FaceRecognitionManager:
    """
    Unified manager untuk face recognition models.

    Mendukung tiga model:
    - Classification model (softmax) - legacy
    - ArcFace model (embedding + FAISS) - hybrid
    - Enhanced model (Score-Level Fusion) - ModelBaru

    Usage:
        # Get current model
        manager = get_model_manager()
        result = manager.recognize(image)

        # Switch model
        manager.set_model_type("enhanced")
        result = manager.recognize(image)
    """

    def __init__(self):
        self._current_type = _get_model_type()
        self._classification_wrapper = None
        self._arcface_wrapper = None
        self._enhanced_wrapper = None

        log.info(f"[FaceRecognitionManager] Active model type: {self._current_type}")

    def set_model_type(self, model_type: str) -> bool:
        """
        Switch model type.

        Args:
            model_type: "classification", "arcface", atau "enhanced"

        Returns:
            True if successful
        """
        model_type = model_type.lower()

        if model_type not in ["classification", "arcface", "enhanced"]:
            log.error(f"[FaceRecognitionManager] Invalid model type: {model_type}")
            return False

        if model_type == self._current_type:
            log.info(f"[FaceRecognitionManager] Model type unchanged: {model_type}")
            return True

        log.info(f"[FaceRecognitionManager] Switching model: {self._current_type} -> {model_type}")
        self._current_type = model_type
        return True

    def get_model_type(self) -> str:
        """Get current model type."""
        return self._current_type

    def recognize(self, bgr_image) -> Dict[str, Any]:
        """
        Recognize wajah menggunakan model yang aktif.

        Returns:
            Dict dengan recognition result
        """
        if self._current_type == "enhanced":
            if self._enhanced_wrapper is None:
                self._enhanced_wrapper = EnhancedFaceRecognitionWrapper()
            return self._enhanced_wrapper.recognize(bgr_image)
        elif self._current_type == "arcface":
            if self._arcface_wrapper is None:
                self._arcface_wrapper = ArcFaceRecognitionWrapper()
            return self._arcface_wrapper.recognize(bgr_image)
        else:
            if self._classification_wrapper is None:
                self._classification_wrapper = HybridFaceRecognitionWrapper()
            return self._classification_wrapper.recognize(bgr_image)

    def enroll(self, person_id: str, person_name: str, bgr_image) -> Dict[str, Any]:
        """
        Enroll new person (ArcFace and Enhanced models only).

        Returns:
            Dict dengan enrollment result
        """
        if self._current_type == "enhanced":
            if self._enhanced_wrapper is None:
                self._enhanced_wrapper = EnhancedFaceRecognitionWrapper()
            return self._enhanced_wrapper.enroll(person_id, [bgr_image], {"person_name": person_name})
        elif self._current_type == "arcface":
            if self._arcface_wrapper is None:
                self._arcface_wrapper = ArcFaceRecognitionWrapper()
            return self._arcface_wrapper.enroll(person_id, person_name, bgr_image)
        else:
            return {
                "success": False,
                "message": "Enrollment only supported in ArcFace/Enhanced mode"
            }

    def health(self) -> Dict[str, Any]:
        """Get health status of active model."""
        if self._current_type == "enhanced":
            if self._enhanced_wrapper is None:
                self._enhanced_wrapper = EnhancedFaceRecognitionWrapper()
            return self._enhanced_wrapper.health()
        elif self._current_type == "arcface":
            if self._arcface_wrapper is None:
                self._arcface_wrapper = ArcFaceRecognitionWrapper()
            return self._arcface_wrapper.health()
        else:
            if self._classification_wrapper is None:
                self._classification_wrapper = HybridFaceRecognitionWrapper()
            return self._classification_wrapper.health()

    def preload(self) -> bool:
        """Preload the active model."""
        log.info(f"[FaceRecognitionManager] Preloading model: {self._current_type}")

        if self._current_type == "enhanced":
            if self._enhanced_wrapper is None:
                self._enhanced_wrapper = EnhancedFaceRecognitionWrapper()
            return self._enhanced_wrapper.load()
        elif self._current_type == "arcface":
            if self._arcface_wrapper is None:
                self._arcface_wrapper = ArcFaceRecognitionWrapper()
            return self._arcface_wrapper.load()
        else:
            if self._classification_wrapper is None:
                self._classification_wrapper = HybridFaceRecognitionWrapper()
            return self._classification_wrapper.load()


# ============================================================
# GLOBAL FUNCTIONS
# ============================================================

_manager = None


def get_model_manager() -> FaceRecognitionManager:
    """Get singleton FaceRecognitionManager."""
    global _manager
    if _manager is None:
        _ensure_ml_path()
        _manager = FaceRecognitionManager()
    return _manager


def get_ml_model():
    """
    Get ML model (legacy compatibility).

    Returns:
        FaceRecognitionManager instance
    """
    return get_model_manager()


def preload_ml_model() -> bool:
    """Pre-load model saat startup backend."""
    try:
        manager = get_model_manager()
        return manager.preload()
    except Exception as e:
        log.warning(f"[ML] Pre-load failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def is_ml_available() -> bool:
    """Check if ML model is available."""
    global _manager
    if _manager is None:
        return False

    try:
        model_manager = get_model_manager()
        return model_manager.health().get("model_loaded", False)
    except:
        return False


def switch_model(model_type: str) -> bool:
    """
    Switch to a different model type.

    Args:
        model_type: "classification", "arcface", atau "enhanced"

    Returns:
        True if successful
    """
    manager = get_model_manager()
    return manager.set_model_type(model_type)


def get_current_model_type() -> str:
    """Get current model type."""
    manager = get_model_manager()
    return manager.get_model_type()


def enroll_person(person_id: str, person_name: str, bgr_image) -> Dict[str, Any]:
    """
    Enroll new person (ArcFace only).

    Args:
        person_id: Unique identifier
        person_name: Display name
        bgr_image: BGR image

    Returns:
        Dict dengan enrollment result
    """
    manager = get_model_manager()
    return manager.enroll(person_id, person_name, bgr_image)
