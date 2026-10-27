"""
enhanced_face_service.py
========================
Service untuk integrasi EnhancedFaceRecognitionSystem (ModelBaru)
ke dalam backend FastAPI.

ModelBaru Architecture:
- Score-Level Fusion: LBPH + MobileFaceNet (ONNX)
- Quality-Aware Weighting: wCNN = QualityScore, wLBPH = 1 - QualityScore
- FAISS Gallery untuk similarity search
- YuNet face detector

Fitur:
- Single photo enrollment dengan quality validation
- Augmentation untuk stabilitas (10 versi)
- Incremental template update
- Top-K recognition results
- Quality assessment (Blur, Brightness, Pose)

Author: Skripsi 2026
"""

import logging
import sys
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

import numpy as np

log = logging.getLogger(__name__)

# ─── Path Configuration ─────────────────────────────────────────────────────────

_CURRENT_FILE = Path(__file__).resolve()
_BACKEND_DIR = _CURRENT_FILE.parent.parent.parent  # backend/
_ROOT_DIR = _BACKEND_DIR.parent  # face_recognition_system/
_MODELBARU_DIR = _ROOT_DIR / "ModelBaru"  # ModelBaru/
_MODELS_DIR = _MODELBARU_DIR / "models"  # ModelBaru/models/
_FACE_MAHASISWA_DIR = _MODELBARU_DIR / "face_mahasiswa"  # ModelBaru/face_mahasiswa/

# Tambahkan ModelBaru ke sys.path SEBELUM import
if str(_MODELBARU_DIR) not in sys.path:
    sys.path.insert(0, str(_MODELBARU_DIR))

log.info(f"[EnhancedFace] Backend dir: {_BACKEND_DIR}")
log.info(f"[EnhancedFace] ModelBaru dir: {_MODELBARU_DIR}")
log.info(f"[EnhancedFace] Models dir: {_MODELS_DIR}")


# ─── Enhanced Face Recognition Wrapper ─────────────────────────────────────────

class EnhancedFaceRecognitionWrapper:
    """
    Wrapper untuk EnhancedFaceRecognitionSystem dari ModelBaru.

    Arsitektur Score-Level Fusion:
    ┌─────────────────────────────────────────────────────────────┐
    │  INPUT IMAGE                                                │
    │       │                                                     │
    │       ▼                                                     │
    │  Face Detection (YuNet)                                     │
    │       │                                                     │
    │       ▼                                                     │
    │  Face Quality Assessment (Blur, Brightness, Pose)           │
    │       │                                                     │
    │       ▼                                                     │
    │  Face Alignment (5 Landmark)                               │
    │       │                                                     │
    │       ├──► LBPH Extractor ──► LBPH Features (640-D)       │
    │       │                              │                       │
    │       ├──► CNN Extractor ──► CNN Embedding (512-D)        │
    │       │                              │                       │
    │       ▼              ┌───────────────┴───────────────┐     │
    │                       │                               │      │
    │                       ▼                               ▼      │
    │  SCORE-LEVEL FUSION  wCNN × CNN_sim + wLBPH × LBPH_sim │
    │                       │                               │      │
    │                       ▼                               ▼      │
    │              Threshold (ROC + EER)                              │
    │                       │                                        │
    │                       ▼                                        │
    │              Recognized / Unknown                              │
    └─────────────────────────────────────────────────────────────┘

    Quality-Aware Weights:
    - wCNN = QualityScore (0.5 - 0.8)
    - wLBPH = 1 - wCNN (0.2 - 0.5)
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
        """Load EnhancedFaceRecognitionSystem dari ModelBaru."""
        if self._is_loaded:
            log.info("[EnhancedFace] System already loaded")
            return True

        log.info("[EnhancedFace] Loading EnhancedFaceRecognitionSystem...")
        log.info("[EnhancedFace] Architecture: Score-Level Fusion (LBPH + MobileFaceNet)")

        try:
            # Import EnhancedFaceRecognitionSystem dari ModelBaru
            # sys.path sudah di-set di atas file ini
            import importlib

            # Force reload semua modul ModelBaru agar perubahan kode
            # (config, faiss_gallery, dll) langsung aktif tanpa restart server
            for mod_name in ['config', 'face_preprocessing', 'enhanced_augmentation',
                             'faiss_gallery', 'score_fusion', 'threshold_calibrator',
                             'enhanced_system']:
                if mod_name in sys.modules:
                    importlib.reload(sys.modules[mod_name])
                    log.info(f"[EnhancedFace] Reloaded module: {mod_name}")

            from enhanced_system import EnhancedFaceRecognitionSystem

            # Matikan TF noise
            os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

            # Buat instance sistem
            self._system = EnhancedFaceRecognitionSystem()

            self._is_loaded = True

            # Log info
            gallery_size = self._system.get_gallery_size()
            threshold = self._system.calibrator.get_threshold()

            log.info("[EnhancedFace] ============================================")
            log.info("[EnhancedFace] System loaded successfully!")
            log.info(f"[EnhancedFace] Gallery size: {gallery_size} identities")
            log.info(f"[EnhancedFace] Threshold: {threshold:.4f}")
            log.info("[EnhancedFace] Architecture: Score-Level Fusion")
            log.info("[EnhancedFace] ============================================")

            return True

        except ImportError as e:
            log.error(f"[EnhancedFace] Import error: {e}")
            log.error(f"[EnhancedFace] ModelBaru path: {_MODELBARU_DIR}")
            log.error("[EnhancedFace] Pastikan ModelBaru folder ada dan accessible")
            # Debug: print sys.path
            log.error(f"[EnhancedFace] sys.path: {sys.path[:3]}...")
            return False
        except Exception as e:
            log.error(f"[EnhancedFace] Failed to load system: {e}")
            import traceback
            traceback.print_exc()
            return False

    def enroll(
        self,
        nim: str,
        frames: List[np.ndarray],
        metadata: Dict = None
    ) -> Dict[str, Any]:
        """
        Enroll mahasiswa dengan multi-frame atau single photo.

        Untuk single photo:
        - Quality validation ketat
        - Augmentation lebih banyak (10 versi)
        - Validasi face detection dan alignment

        Args:
            nim: NIM mahasiswa
            frames: List of BGR images (1 atau lebih)
            metadata: Optional metadata dict

        Returns:
            Dict dengan enrollment result
        """
        if not self._is_loaded:
            if not self.load():
                return {
                    "success": False,
                    "message": "EnhancedFace system not loaded"
                }

        try:
            # Ensure nim is string
            nim = str(nim)

            # Prepare metadata
            meta = metadata or {}
            meta['enrolled_via'] = 'enhanced_face_service'
            meta['enrolled_at'] = datetime.now().isoformat()

            # Check if single photo mode
            is_single_photo = len(frames) == 1

            if is_single_photo:
                # Single photo enrollment with quality check
                result = self._enroll_single_photo(nim, frames[0], meta)
            else:
                # Multi-frame enrollment
                success = self._system.enroll(nim, frames, meta)
                result = {
                    "success": success,
                    "message": f"Berhasil enroll {nim}" if success else f"Gagal enroll {nim}",
                    "nim": nim,
                    "gallery_size": self._system.get_gallery_size(),
                    "num_frames": len(frames)
                }

            return result

        except Exception as e:
            log.error(f"[EnhancedFace] Enrollment error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"Enrollment error: {str(e)}"
            }

    def _enroll_single_photo(
        self,
        nim: str,
        bgr_image: np.ndarray,
        metadata: Dict = None
    ) -> Dict[str, Any]:
        """
        Enroll dengan single photo dan quality validation.

        Args:
            nim: NIM mahasiswa
            bgr_image: Single BGR image
            metadata: Metadata dict

        Returns:
            Dict dengan enrollment result
        """
        import cv2

        log.info(f"[EnhancedFace] Single photo enrollment for {nim}")

        # 1. Preprocess dan quality assessment
        result = self._system.preprocessor.detect_and_preprocess(
            bgr_image, for_enrollment=True
        )

        if result['face'] is None:
            return {
                "success": False,
                "message": "Wajah tidak terdeteksi. Pastikan foto wajah jelas.",
                "nim": nim,
                "quality_score": 0.0,
                "quality_details": None
            }

        # Get quality assessment
        quality = result['quality']
        quality_score = quality['quality_score'] if quality else 0.0

        log.info(f"[EnhancedFace] Quality score: {quality_score:.3f}")

        # 2. Validate quality (single photo perlu quality >= 0.6)
        if quality_score < 0.6:
            quality_details = self._get_quality_details(quality)
            return {
                "success": False,
                "message": f"Quality score ({quality_score:.2f}) terlalu rendah. Minimal 0.60 untuk single photo.",
                "nim": nim,
                "quality_score": quality_score,
                "quality_details": quality_details
            }

        # 3. Get aligned face
        face = result['aligned_face'] if result['aligned_face'] is not None else result['face']

        # 4. Generate multiple augmented versions
        log.info("[EnhancedFace] Generating augmented versions...")
        aug_versions = self._generate_augmented_versions(face, n_versions=10)

        # 5. Extract features dari original + augmented + lighting variants
        all_lbph = []
        all_cnn = []

        # Original
        lbph, cnn = self._system._extract_features(face)
        all_lbph.append(lbph)
        all_cnn.append(cnn)

        # Augmented versions (random: noise, blur, rotasi, brightness, dll.)
        for aug_face in aug_versions:
            if aug_face is not None:
                lbph, cnn = self._system._extract_features(aug_face)
                all_lbph.append(lbph)
                all_cnn.append(cnn)

        # Lighting variants deterministik (7 kondisi cahaya nyata)
        # Ini MENJAMIN gallery mencakup: terang, gelap, sangat gelap,
        # overexposed, shadow kiri, shadow kanan, CLAHE agresif
        log.info("[EnhancedFace] Generating lighting variants...")
        lighting_variants = self._system.augmentation.generate_lighting_variants(
            face, include_original=False
        )
        for light_face in lighting_variants:
            if light_face is not None:
                lbph, cnn = self._system._extract_features(light_face)
                all_lbph.append(lbph)
                all_cnn.append(cnn)

        log.info(
            f"[EnhancedFace] Total embeddings: {len(all_lbph)} "
            f"(1 original + {len(aug_versions)} random aug + {len(lighting_variants)} lighting variants)"
        )

        # 6. Normalize individual embeddings sebelum averaging
        # FIX #1: LBPH wajib pakai L1-norm (sum=1) agar konsisten dengan
        #         Histogram Intersection di faiss_gallery.match_lbph().
        #         L2-norm mengubah distribusi histogram → LBPH similarity turun drastis.
        all_lbph_l1 = []
        for lbph_raw in all_lbph:
            lbph_sum = lbph_raw.sum()
            all_lbph_l1.append(lbph_raw / (lbph_sum + 1e-7))  # L1-norm

        # CNN tetap L2-norm (cosine similarity)
        all_cnn_l2 = []
        for cnn_raw in all_cnn:
            all_cnn_l2.append(cnn_raw / (np.linalg.norm(cnn_raw) + 1e-7))  # L2-norm

        # Centroid: rata-rata semua embedding yang sudah ternormalisasi
        final_lbph = np.mean(all_lbph_l1, axis=0)
        final_lbph = final_lbph / (final_lbph.sum() + 1e-7)   # L1-norm centroid

        final_cnn = np.mean(all_cnn_l2, axis=0)
        final_cnn = final_cnn / (np.linalg.norm(final_cnn) + 1e-7)  # L2-norm centroid

        log.info(
            f"[EnhancedFace] Single photo templates: {len(all_lbph_l1)} LBPH (L1-norm), "
            f"{len(all_cnn_l2)} CNN (L2-norm)"
        )

        # 7. Add to gallery
        meta = metadata or {}
        meta['quality_score'] = quality_score
        meta['num_registrations'] = 1
        meta['is_single_photo'] = True
        meta['augmentation_versions'] = len(aug_versions) + 1

        # FIX #2: Kirim semua template individual agar max-similarity rule aktif.
        # Sebelumnya hanya centroid yang disimpan → recognition kurang robust
        # saat kondisi foto berbeda dengan kondisi enrollment.
        success = self._system.gallery.add_identity(
            nim,
            final_cnn,
            final_lbph,
            meta,
            cnn_templates=all_cnn_l2,    # semua CNN individual (L2-norm)
            lbph_templates=all_lbph_l1,  # semua LBPH individual (L1-norm)
        )

        if success:
            log.info(f"[EnhancedFace] Enrolled {nim} (single photo, Q={quality_score:.3f})")
            return {
                "success": True,
                "message": f"Berhasil enroll {nim} dengan 1 foto berkualitas",
                "nim": nim,
                "gallery_size": self._system.get_gallery_size(),
                "quality_score": quality_score,
                "quality_details": self._get_quality_details(quality),
                "num_frames": 1,
                "augmentation_count": len(aug_versions) + 1
            }
        else:
            return {
                "success": False,
                "message": "Gagal menyimpan ke gallery",
                "nim": nim,
                "quality_score": quality_score
            }

    def _generate_augmented_versions(
        self,
        face: np.ndarray,
        n_versions: int = 10
    ) -> List[np.ndarray]:
        """
        Generate augmented versions dari satu foto.

        Args:
            face: Face crop (BGR)
            n_versions: Jumlah versi augmented

        Returns:
            List of augmented faces
        """
        versions = []

        for i in range(n_versions):
            aug_face = self._system.augmentation.augment(face)
            versions.append(aug_face)

        return versions

    def _get_quality_details(self, quality: Dict) -> Optional[Dict]:
        """Get detailed quality metrics."""
        if not quality:
            return None

        return {
            "blur": {
                "score": quality.get('blur', {}).get('score', 0),
                "ok": quality.get('blur', {}).get('ok', False)
            },
            "brightness": {
                "score": quality.get('brightness', {}).get('score', 0),
                "ok": quality.get('brightness', {}).get('ok', False)
            },
            "pose": {
                "score": quality.get('pose', {}).get('score', 0),
                "ok": quality.get('pose', {}).get('ok', False)
            },
            "overall_score": quality.get('quality_score', 0)
        }

    def check_quality(self, bgr_image: np.ndarray) -> Dict[str, Any]:
        """
        Check quality dari foto sebelum enrollment.

        Args:
            bgr_image: BGR image

        Returns:
            Dict dengan quality assessment
        """
        if not self._is_loaded:
            if not self.load():
                return {
                    "success": False,
                    "message": "System not loaded"
                }

        try:
            # Preprocess
            result = self._system.preprocessor.detect_and_preprocess(
                bgr_image, for_enrollment=True
            )

            if result['face'] is None:
                return {
                    "success": False,
                    "message": "Wajah tidak terdeteksi",
                    "face_detected": False,
                    "quality_score": 0.0
                }

            quality = result['quality']
            quality_score = quality['quality_score'] if quality else 0.0

            # Get bounding box info
            bbox = result['bbox']
            face_size = max(bbox[2], bbox[3]) if bbox else 0

            # Determine if ready for enrollment
            can_enroll = quality_score >= 0.6

            # Recommendations
            recommendations = []
            if quality_score < 0.6:
                if quality.get('blur', {}).get('ok') == False:
                    recommendations.append("Foto terlalu blur - pastikan fokus kamera")
                if quality.get('brightness', {}).get('ok') == False:
                    recommendations.append("Pencahayaan tidak ideal - hindari terlalu terang/gelap")
                if quality.get('pose', {}).get('ok') == False:
                    recommendations.append("Hadap kamera secara frontal")
            if face_size < 100:
                recommendations.append("Dekatkan wajah ke kamera")

            return {
                "success": True,
                "face_detected": True,
                "quality_score": quality_score,
                "can_enroll": can_enroll,
                "quality_details": self._get_quality_details(quality),
                "face_size": face_size,
                "bbox": bbox,
                "recommendations": recommendations,
                "message": "Foto siap untuk enrollment" if can_enroll else "Quality score terlalu rendah"
            }

        except Exception as e:
            log.error(f"[EnhancedFace] Quality check error: {e}")
            return {
                "success": False,
                "message": f"Quality check error: {str(e)}"
            }

    def enroll_from_image(
        self,
        nim: str,
        bgr_image: np.ndarray,
        metadata: Dict = None
    ) -> Dict[str, Any]:
        """Enroll dari single image."""
        return self.enroll(nim, [bgr_image], metadata)

    def recognize(
        self,
        bgr_image: np.ndarray,
        update_template: bool = True
    ) -> Dict[str, Any]:
        """
        Recognize wajah dalam gambar.

        Args:
            bgr_image: BGR image
            update_template: Update gallery template jika similarity >= 0.98

        Returns:
            Dict dengan recognition result
        """
        if not self._is_loaded:
            if not self.load():
                return self._error_response("EnhancedFace system not loaded")

        try:
            # Recognize
            result = self._system.recognize(bgr_image, update_template=update_template)

            # Diagnostic breakdown for real mobile captures.  The mobile UI
            # displays only the final confidence, which hides whether a low
            # score comes from CNN, LBPH, quality, or fusion.
            log.info(
                "[EnhancedFace][SCORE] cnn=%.4f lbph=%.4f final=%.4f threshold=%.4f "
                "recognized=%s nim=%s image_shape=%s",
                float(result.cnn_similarity),
                float(result.lbph_similarity),
                float(result.similarity),
                float(self._system.calibrator.get_threshold()),
                bool(result.is_recognized),
                result.nim,
                getattr(bgr_image, "shape", None),
            )

            if result.is_recognized:
                return {
                    "success": True,
                    "is_known": True,
                    "nim": result.nim,
                    "person_name": result.nim,  # NIM is the identifier
                    "confidence": float(result.similarity),
                    "cnn_similarity": float(result.cnn_similarity),
                    "lbph_similarity": float(result.lbph_similarity),
                    "final_score": float(result.similarity),
                    "message": f"Recognized: {result.nim}",
                    "threshold": float(self._system.calibrator.get_threshold()),
                    "top_k_results": [
                        {
                            "nim": r['nim'],
                            "fused_score": float(r['fused']),
                            "cnn_sim": float(r['cnn_sim']),
                            "lbph_sim": float(r['lbph_sim'])
                        }
                        for r in result.top_k_results
                    ] if result.top_k_results else []
                }
            else:
                custom_msg = getattr(result, 'message', '') or f"Unknown (similarity: {result.similarity:.4f})"
                return {
                    "success": False if "masker" in custom_msg.lower() else True,
                    "is_known": False,
                    "nim": None,
                    "person_name": "Unknown",
                    "confidence": float(result.similarity),
                    "cnn_similarity": float(result.cnn_similarity),
                    "lbph_similarity": float(result.lbph_similarity),
                    "final_score": float(result.similarity),
                    "message": custom_msg,
                    "threshold": float(self._system.calibrator.get_threshold()),
                    "top_k_results": [
                        {
                            "nim": r['nim'],
                            "fused_score": float(r['fused']),
                            "cnn_sim": float(r['cnn_sim']),
                            "lbph_sim": float(r['lbph_sim'])
                        }
                        for r in result.top_k_results
                    ] if result.top_k_results else []
                }

        except Exception as e:
            log.error(f"[EnhancedFace] Recognition error: {e}")
            import traceback
            traceback.print_exc()
            return self._error_response(f"Recognition error: {str(e)}")

    def verify(
        self,
        bgr_image: np.ndarray,
        nim: str
    ) -> Dict[str, Any]:
        """
        Verify wajah terhadap NIM tertentu.

        Args:
            bgr_image: BGR image
            nim: NIM untuk verifikasi

        Returns:
            Dict dengan verification result
        """
        if not self._is_loaded:
            if not self.load():
                return {
                    "valid": False,
                    "message": "EnhancedFace system not loaded"
                }

        try:
            is_verified, similarity = self._system.verify(bgr_image, nim)

            return {
                "valid": is_verified,
                "nim": nim,
                "similarity": float(similarity),
                "threshold": float(self._system.calibrator.get_threshold()),
                "message": f"{'MATCH' if is_verified else 'NO MATCH'} (sim={similarity:.4f})"
            }

        except Exception as e:
            log.error(f"[EnhancedFace] Verify error: {e}")
            return {
                "valid": False,
                "nim": nim,
                "similarity": 0.0,
                "message": f"Verify error: {str(e)}"
            }

    def get_gallery_size(self) -> int:
        """Get number of enrolled identities."""
        if not self._is_loaded:
            return 0
        return self._system.get_gallery_size()

    def list_identities(self) -> List[str]:
        """List semua enrolled identities."""
        if not self._is_loaded:
            return []
        return self._system.list_identities()

    def remove_identity(self, nim: str) -> bool:
        """Remove identity dari gallery."""
        if not self._is_loaded:
            return False
        return self._system.remove_identity(nim)

    def get_identity_info(self, nim: str) -> Optional[Dict[str, Any]]:
        """Get info tentang identity tertentu."""
        if not self._is_loaded or self._system.gallery is None:
            return None

        info = self._system.gallery.get_identity_info(nim)
        if info:
            return {
                "nim": nim,
                "quality_score": float(info.quality_score),
                "enrollment_date": info.enrollment_date,
                "num_registrations": info.num_registrations
            }
        return None

    def health(self) -> Dict[str, Any]:
        """Return health status."""
        if not self._is_loaded:
            return {
                "model_loaded": False,
                "model_type": "enhanced_score_fusion",
                "model_name": "EnhancedFaceRecognitionSystem",
                "architecture": "Score-Level Fusion (LBPH + MobileFaceNet)",
                "embedding_or_classification": "embedding",
                "features": [
                    "YuNet face detection",
                    "Quality Assessment (Blur, Brightness, Pose)",
                    "Face Alignment (5 Landmark)",
                    "LBPH features (640-D)",
                    "MobileFaceNet embedding (512-D) via ONNX",
                    "Score-Level Fusion with Quality-Aware Weights",
                    "FAISS Gallery for fast search",
                    "Incremental Template Update (sim >= 0.98)",
                    "Multi-frame enrollment (15 → 5 best frames)",
                    "Top-K results"
                ],
                "paths": {
                    "modelbaruu_dir": str(_MODELBARU_DIR),
                    "models_dir": str(_MODELS_DIR),
                    "face_mahasiswa_dir": str(_FACE_MAHASISWA_DIR)
                }
            }

        return {
            "model_loaded": self._is_loaded,
            "model_type": "enhanced_score_fusion",
            "model_name": "EnhancedFaceRecognitionSystem",
            "architecture": "Score-Level Fusion (LBPH + MobileFaceNet)",
            "embedding_or_classification": "embedding",
            "gallery_size": self._system.get_gallery_size(),
            "threshold": float(self._system.calibrator.get_threshold()),
            "identities": self._system.list_identities(),
            "features": [
                "YuNet face detection",
                "Quality Assessment (Blur, Brightness, Pose)",
                "Face Alignment (5 Landmark)",
                "LBPH features (640-D)",
                "MobileFaceNet embedding (512-D) via ONNX",
                "Score-Level Fusion with Quality-Aware Weights",
                "FAISS Gallery for fast search",
                "Incremental Template Update (sim >= 0.98)",
                "Multi-frame enrollment (15 → 5 best frames)",
                "Top-K results"
            ],
            "paths": {
                "modelbaruu_dir": str(_MODELBARU_DIR),
                "models_dir": str(_MODELS_DIR),
                "face_mahasiswa_dir": str(_FACE_MAHASISWA_DIR)
            }
        }

    def _error_response(self, message: str) -> Dict[str, Any]:
        """Return error response."""
        return {
            "success": False,
            "is_known": False,
            "nim": None,
            "person_name": "Unknown",
            "confidence": 0.0,
            "cnn_similarity": 0.0,
            "lbph_similarity": 0.0,
            "final_score": 0.0,
            "message": message,
            "error": True
        }


# ─── Singleton Functions ───────────────────────────────────────────────────────

_wrapper_instance = None


def get_enhanced_face_wrapper() -> EnhancedFaceRecognitionWrapper:
    """Get singleton EnhancedFaceRecognitionWrapper."""
    global _wrapper_instance
    if _wrapper_instance is None:
        _wrapper_instance = EnhancedFaceRecognitionWrapper()
    return _wrapper_instance


def preload_enhanced_face_model() -> bool:
    """Pre-load EnhancedFaceRecognitionSystem saat startup."""
    try:
        wrapper = get_enhanced_face_wrapper()
        return wrapper.load()
    except Exception as e:
        log.warning(f"[EnhancedFace] Pre-load failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def is_enhanced_face_available() -> bool:
    """Check if EnhancedFace model is available."""
    wrapper = get_enhanced_face_wrapper()
    return wrapper._is_loaded
