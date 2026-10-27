"""
enrollment_backend_service.py
============================
Backend service untuk Face Enrollment System.

Integrasi dengan FastAPI backend untuk:
- Enroll mahasiswa baru (dari Android)
- Recognize wajah saat presensi
- Auto-enroll dari database

Usage:
    from enrollment_backend_service import EnrollmentBackendService
    service = EnrollmentBackendService()
    service.initialize()  # Setup FAISS dari database
"""

import base64
import logging
import os
from pathlib import Path
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass

import numpy as np

log = logging.getLogger(__name__)

# Add paths - ModelBaru (BARU)
_CURRENT_FILE = Path(__file__).resolve()
_PROJECT_ROOT = _CURRENT_FILE.parent.parent.parent  # face_recognition_system/
_MODELBARU_DIR = _PROJECT_ROOT / "ModelBaru"
_MODELS_DIR = _MODELBARU_DIR / "models"
_FACE_MAHASISWA_DIR = _MODELBARU_DIR / "face_mahasiswa"

import sys
sys.path.insert(0, str(_MODELBARU_DIR))
sys.path.insert(0, str(_MODELS_DIR))


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class RecognitionResult:
    """Result dari face recognition."""
    success: bool
    name: str
    similarity: float
    bbox: List[int]
    message: str
    metadata: Dict = None


@dataclass
class EnrollmentResult:
    """Result dari enrollment."""
    success: bool
    name: str
    message: str


# ============================================================
# BACKEND SERVICE
# ============================================================

class EnrollmentBackendService:
    """
    Backend service untuk face enrollment dan recognition.

    Methods:
        - initialize(): Setup FAISS dari database
        - enroll_from_db(): Enroll semua mahasiswa dari database
        - enroll_single(): Enroll satu mahasiswa
        - recognize_from_base64(): Recognize dari base64 image
        - recognize_from_file(): Recognize dari file
    """

    def __init__(self):
        self.detector = None
        self.extractor = None
        self.index = None
        self._initialized = False
        self._embedding_dim = 1280

    def initialize(self, db_session=None) -> bool:
        """
        Initialize semua komponen.

        Args:
            db_session: SQLAlchemy session (optional)

        Returns:
            True jika berhasil
        """
        if self._initialized:
            return True

        log.info("[EnrollmentBackend] Initializing...")

        # Import FAISS
        try:
            import faiss
        except ImportError:
            log.error("FAISS not installed. Run: pip install faiss-cpu")
            return False

        # Load detector
        try:
            self.detector = self._create_detector()
            if not self.detector.load():
                log.error("Failed to load face detector")
                return False
        except Exception as e:
            log.error(f"Detector error: {e}")
            return False

        # Load extractor
        try:
            self.extractor = self._create_extractor()
            if not self.extractor.load():
                log.error("Failed to load embedding extractor")
                return False
        except Exception as e:
            log.error(f"Extractor error: {e}")
            return False

        # Load or create index
        self.index = self._create_index()
        if not self.index.load():
            log.error("Failed to load FAISS index")
            return False

        self._initialized = True
        log.info("[EnrollmentBackend] Initialized successfully")

        # Auto-enroll dari database jika ada session
        if db_session:
            self.enroll_from_database(db_session)

        return True

    def _create_detector(self):
        """Create face detector."""
        class FaceDetector:
            def __init__(self):
                self.yunet = None
                self.haar = None

            def load(self) -> bool:
                yunet_path = _MODELS_DIR / "face_detection_yunet_2023mar.onnx"
                if yunet_path.exists():
                    try:
                        self.yunet = cv2.FaceDetectorYN.create(
                            str(yunet_path), "", (320, 320),
                            score_threshold=0.4, nms_threshold=0.3, top_k=5
                        )
                        log.info("[Detector] YuNet loaded")
                        return True
                    except Exception as e:
                        log.warning(f"[Detector] YuNet failed: {e}")

                haar_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                cascade = cv2.CascadeClassifier(haar_path)
                if not cascade.empty():
                    self.haar = cascade
                    log.info("[Detector] Haar loaded")
                    return True
                return False

            def detect(self, image):
                h, w = image.shape[:2]

                if self.yunet:
                    self.yunet.setInputSize((w, h))
                    _, faces = self.yunet.detect(image)
                    if faces is not None and len(faces) > 0:
                        best = faces[np.argmax(faces[:, 14])]
                        x, y, bw, bh = map(int, best[:4])
                        if bw >= 60 and bh >= 60:
                            return image[y:y+bh, x:x+bw], [x, y, bw, bh]

                if self.haar:
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    gray = cv2.equalizeHist(gray)
                    faces = self.haar.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
                    if len(faces) > 0:
                        x, y, w, h = max(faces, key=lambda f: f[2]*f[3])
                        pad = int(0.1 * min(w, h))
                        x1, y1 = max(0, x-pad), max(0, y-pad)
                        x2, y2 = min(w, x+w+pad), min(h, y+h+pad)
                        return image[y1:y2, x1:x2], [x1, y1, x2-x1, y2-y1]

                return None

        return FaceDetector()

    def _create_extractor(self):
        """Create embedding extractor."""
        import tensorflow as tf
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

        class EmbeddingExtractor:
            def __init__(self):
                self.model = None
                self.img_size = (224, 224)

            def load(self) -> bool:
                try:
                    base = tf.keras.applications.MobileNetV2(
                        input_shape=(224, 224, 3),
                        weights='imagenet',
                        include_top=False,
                        pooling='avg'
                    )
                    for layer in base.layers:
                        layer.trainable = False
                    self.model = tf.keras.Model(inputs=base.input, outputs=base.output)
                    log.info("[Extractor] MobileNetV2 loaded")
                    return True
                except Exception as e:
                    log.error(f"[Extractor] Failed: {e}")
                    return False

            def extract(self, face):
                if not self.model:
                    return None
                try:
                    face = cv2.resize(face, self.img_size)
                    face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
                    face = face.astype(np.float32)
                    face = tf.keras.applications.mobilenet_v2.preprocess_input(face)
                    emb = self.model.predict(face[np.newaxis], verbose=0)[0]
                    return (emb / np.linalg.norm(emb)).astype(np.float32)
                except Exception as e:
                    log.error(f"[Extractor] Error: {e}")
                    return None

        return EmbeddingExtractor()

    def _create_index(self):
        """Create FAISS index."""
        import faiss
        import pickle

        class EmbeddingIndex:
            def __init__(self, dim):
                self.dim = dim
                self.index = None
                self.labels = []
                self.metadata = {}
                self.index_path = _MODELS_DIR / "backend_index.bin"
                self.labels_path = _MODELS_DIR / "backend_labels.pkl"
                self.meta_path = _MODELS_DIR / "backend_metadata.pkl"

            def load(self) -> bool:
                try:
                    if self.index_path.exists():
                        self.index = faiss.read_index(str(self.index_path))
                        with open(self.labels_path, 'rb') as f:
                            self.labels = pickle.load(f).get('labels', [])
                        if self.meta_path.exists():
                            with open(self.meta_path, 'rb') as f:
                                self.metadata = pickle.load(f)
                        log.info(f"[Index] Loaded {len(self.labels)} embeddings")
                    else:
                        self.index = faiss.IndexFlatIP(self.dim)
                        log.info("[Index] Created new index")
                    return True
                except Exception as e:
                    log.error(f"[Index] Load error: {e}")
                    return False

            def save(self):
                try:
                    faiss.write_index(self.index, str(self.index_path))
                    with open(self.labels_path, 'wb') as f:
                        pickle.dump({'labels': self.labels}, f)
                    with open(self.meta_path, 'wb') as f:
                        pickle.dump(self.metadata, f)
                    log.info(f"[Index] Saved {len(self.labels)} embeddings")
                except Exception as e:
                    log.error(f"[Index] Save error: {e}")

            def add(self, emb, label, meta=None):
                self.index.add(emb.reshape(1, -1))
                self.labels.append(label)
                if meta:
                    self.metadata[label] = meta

            def search(self, emb, k=3):
                if not self.index or self.index.ntotal == 0:
                    return []
                dists, idxs = self.index.search(emb.reshape(1, -1), min(k, self.index.ntotal))
                return [(self.labels[i], float(d)) for d, i in zip(dists[0], idxs[0]) if i < len(self.labels)]

        return EmbeddingIndex(self._embedding_dim)

    def enroll_from_database(self, db_session) -> int:
        """
        Enroll semua mahasiswa dari database.

        Args:
            db_session: SQLAlchemy session

        Returns:
            Jumlah mahasiswa yang berhasil di-enroll
        """
        log.info("[EnrollmentBackend] Enrolling from database...")

        try:
            # Import model
            from app.models.mahasiswa import Mahasiswa

            # Get all mahasiswa with foto_profil
            mahasiswa_list = db_session.query(Mahasiswa).filter(
                Mahasiswa.foto_profil.isnot(None)
            ).all()

            enrolled = 0
            skipped = 0

            for mhs in mahasiswa_list:
                # Skip if already enrolled
                if mhs.nim in self.index.labels:
                    skipped += 1
                    continue

                # Get foto path
                foto_path = _PROJECT_ROOT / mhs.foto_profil.lstrip('/')
                if not foto_path.exists():
                    log.warning(f"[EnrollmentBackend] Foto not found: {foto_path}")
                    skipped += 1
                    continue

                # Load and detect face
                img = cv2.imread(str(foto_path))
                if img is None:
                    skipped += 1
                    continue

                result = self.detector.detect(img)
                if result is None:
                    log.warning(f"[EnrollmentBackend] No face in {mhs.nim}")
                    skipped += 1
                    continue

                face, bbox = result

                # Extract embedding
                emb = self.extractor.extract(face)
                if emb is None:
                    skipped += 1
                    continue

                # Add to index
                self.index.add(emb, mhs.nim, {
                    "nama": mhs.nama_mahasiswa,
                    "nim": mhs.nim,
                    "id": mhs.id_mahasiswa
                })

                enrolled += 1
                log.info(f"[EnrollmentBackend] Enrolled: {mhs.nim} - {mhs.nama_mahasiswa}")

            # Save index
            self.index.save()

            log.info(f"[EnrollmentBackend] Enrollment complete: {enrolled} enrolled, {skipped} skipped")
            return enrolled

        except Exception as e:
            log.error(f"[EnrollmentBackend] Database enrollment failed: {e}")
            import traceback
            traceback.print_exc()
            return 0

    def enroll_single(
        self,
        name: str,
        image_path: str = None,
        base64_image: str = None,
        metadata: dict = None
    ) -> EnrollmentResult:
        """
        Enroll satu mahasiswa baru.

        Args:
            name: NIM atau nama
            image_path: Path ke file gambar
            base64_image: Base64 encoded image
            metadata: Info tambahan

        Returns:
            EnrollmentResult
        """
        if not self._initialized:
            return EnrollmentResult(False, name, "System not initialized")

        # Load image
        if image_path:
            img = cv2.imread(str(image_path))
        elif base64_image:
            try:
                if "," in base64_image:
                    base64_image = base64_image.split(",", 1)[1]
                data = base64.b64decode(base64_image)
                nparr = np.frombuffer(data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                return EnrollmentResult(False, name, f"Base64 decode error: {e}")
        else:
            return EnrollmentResult(False, name, "No image provided")

        if img is None:
            return EnrollmentResult(False, name, "Cannot load image")

        # Detect face
        result = self.detector.detect(img)
        if result is None:
            return EnrollmentResult(False, name, "No face detected")

        face, bbox = result

        # Extract embedding
        emb = self.extractor.extract(face)
        if emb is None:
            return EnrollmentResult(False, name, "Failed to extract embedding")

        # Add to index
        self.index.add(emb, name, metadata or {})
        self.index.save()

        log.info(f"[EnrollmentBackend] Enrolled: {name}")
        return EnrollmentResult(True, name, f"Successfully enrolled: {name}")

    def recognize(
        self,
        image_path: str = None,
        base64_image: str = None,
        threshold: float = 0.5,
        return_top_k: int = 3
    ) -> Tuple[bool, str, float, List[dict]]:
        """
        Recognize wajah.

        Args:
            image_path: Path ke file gambar
            base64_image: Base64 encoded image
            threshold: Minimum similarity threshold
            return_top_k: Number of results to return

        Returns:
            (success, name, similarity, top_results)
        """
        if not self._initialized:
            return False, "System not initialized", 0.0, []

        # Load image
        if image_path:
            img = cv2.imread(str(image_path))
        elif base64_image:
            try:
                if "," in base64_image:
                    base64_image = base64_image.split(",", 1)[1]
                data = base64.b64decode(base64_image)
                nparr = np.frombuffer(data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                return False, f"Base64 error: {e}", 0.0, []
        else:
            return False, "No image provided", 0.0, []

        if img is None:
            return False, "Cannot load image", 0.0, []

        # Detect face
        result = self.detector.detect(img)
        if result is None:
            return False, "No face detected", 0.0, []

        face, bbox = result

        # Extract embedding
        emb = self.extractor.extract(face)
        if emb is None:
            return False, "Embedding extraction failed", 0.0, []

        # Search
        if self.index.index is None or self.index.index.ntotal == 0:
            return False, "No enrolled faces", 0.0, []

        results = self.index.search(emb, k=return_top_k)

        if not results:
            return False, "Search failed", 0.0, []

        # Format results
        top_results = []
        for name, similarity in results:
            meta = self.index.metadata.get(name, {})
            top_results.append({
                "name": name,
                "similarity": similarity,
                "metadata": meta
            })

        best_name, best_sim = results[0]

        # Check threshold
        if best_sim < threshold:
            return False, f"Low confidence ({best_sim:.3f})", best_sim, top_results

        log.info(f"[EnrollmentBackend] Recognized: {best_name} ({best_sim:.4f})")
        return True, best_name, best_sim, top_results

    def is_ready(self) -> bool:
        """Check if system is ready."""
        return self._initialized

    def get_stats(self) -> dict:
        """Get enrollment stats."""
        if not self._initialized:
            return {"ready": False}

        return {
            "ready": True,
            "total_enrolled": len(self.index.labels),
            "index_size": self.index.index.ntotal if self.index.index else 0
        }


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_enrollment_service = None


def get_enrollment_service() -> EnrollmentBackendService:
    """Get singleton instance."""
    global _enrollment_service
    if _enrollment_service is None:
        _enrollment_service = EnrollmentBackendService()
    return _enrollment_service


def initialize_enrollment_service(db_session=None) -> bool:
    """Initialize enrollment service."""
    service = get_enrollment_service()
    return service.initialize(db_session)
