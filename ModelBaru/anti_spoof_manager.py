"""
Anti-Spoofing Manager
=====================
Wrapper yang aman untuk integrasi Silent-Face-Anti-Spoofing ke dalam
sistem face recognition yang sudah ada.

Desain:
  - ZERO modifikasi ke file existing (enhanced_system.py, face_preprocessing.py, dll.)
  - Graceful degradation: jika model .pth tidak ada atau PyTorch tidak terinstall,
    sistem berjalan normal tanpa anti-spoofing (tidak crash).
  - Lazy imports: semua import PyTorch dilakukan di dalam method,
    bukan di level modul -- aman meski PyTorch belum terinstall.
  - AntiSpoofGuardedSystem: wrapper komposisi atas EnhancedFaceRecognitionSystem.
    File enhanced_system.py TIDAK disentuh sama sekali.

Cara penggunaan:
  # Opt-in -- hanya gunakan jika ingin anti-spoofing aktif
  from anti_spoof_manager import AntiSpoofManager, AntiSpoofGuardedSystem

  mgr = AntiSpoofManager.from_config()         # Baca dari ANTI_SPOOF_CONFIG
  system = AntiSpoofGuardedSystem.create(mgr)  # Wrapper atas EnhancedFaceRecognitionSystem
  result = system.recognize(frame)             # API identik dengan sistem lama

  # Atau tetap gunakan sistem lama tanpa anti-spoofing (tidak ada perubahan):
  from enhanced_system import EnhancedFaceRecognitionSystem
  system = EnhancedFaceRecognitionSystem()
  result = system.recognize(frame)

Author: Skripsi 2026
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional, Dict, List

import cv2
import numpy as np

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Konstanta internal
# ---------------------------------------------------------------------------
_PASSTHROUGH_RESULT = {
    'is_real': True,
    'real_prob': 1.0,
    'fake_prob': 0.0,
    'confidence': 1.0,
    'label': 'REAL',
    'passthrough': True,
}


# ---------------------------------------------------------------------------
# AntiSpoofManager
# ---------------------------------------------------------------------------

class AntiSpoofManager:
    """
    Manager untuk anti-spoofing detection menggunakan MiniFASNet.

    Graceful degradation: self.enabled = False jika setup gagal (tidak crash).
    """

    def __init__(
        self,
        model_dir: str,
        spoof_lib_path: str,
        default_model: str = "2.7_80x80_MiniFASNetV2.pth",
        real_threshold: float = 0.5,
        device: Optional[str] = None,
        scale_factor: float = 2.7,
        use_multi_model_voting: bool = False,
    ):
        self.model_dir = Path(model_dir)
        self.spoof_lib_path = Path(spoof_lib_path)
        self.default_model = default_model
        self.real_threshold = real_threshold
        self.scale_factor = scale_factor
        self.use_multi_model_voting = use_multi_model_voting

        self.enabled = False
        self._model = None
        self._device = None

        self._setup(device)

    def _setup(self, device_hint: Optional[str]):
        try:
            import torch
            _torch = torch
        except ImportError:
            log.warning("[AntiSpoof] PyTorch tidak tersedia. Anti-spoofing dinonaktifkan.")
            return

        if not self.spoof_lib_path.exists():
            log.warning(
                f"[AntiSpoof] SilentFaceAntiSpoofing tidak ditemukan di: {self.spoof_lib_path}\n"
                "  Clone: git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing SilentFaceAntiSpoofing\n"
                "  Anti-spoofing dinonaktifkan."
            )
            return

        if not self.model_dir.exists():
            log.warning(
                f"[AntiSpoof] Folder model tidak ditemukan: {self.model_dir}\n"
                "  Anti-spoofing dinonaktifkan."
            )
            return

        model_path = self.model_dir / self.default_model
        if not model_path.exists():
            log.warning(
                f"[AntiSpoof] Model tidak ditemukan: {model_path}\n"
                "  Download dari: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/releases\n"
                "  Anti-spoofing dinonaktifkan."
            )
            return

        lib_str = str(self.spoof_lib_path)
        if lib_str not in sys.path:
            sys.path.insert(0, lib_str)

        if device_hint is None:
            self._device = 'cuda' if _torch.cuda.is_available() else 'cpu'
        else:
            self._device = device_hint

        try:
            self._model = self._load_model(model_path, _torch)
            self.enabled = True
            log.info(
                f"[AntiSpoof] Model dimuat: {self.default_model} "
                f"(device={self._device}, threshold={self.real_threshold})"
            )
        except Exception as e:
            log.error(f"[AntiSpoof] Gagal memuat model: {e}\n  Anti-spoofing dinonaktifkan.")

    def _load_model(self, model_path: Path, torch_module):
        model_class = self._detect_model_class(model_path.name)
        checkpoint = torch_module.load(
            str(model_path),
            map_location=self._device,
            weights_only=False,
        )
        model = model_class(conv6_kernel=(5, 5)).to(self._device)

        if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
            state_dict = checkpoint['state_dict']
        else:
            state_dict = checkpoint

        cleaned = {
            (k[7:] if k.startswith('module.') else k): v
            for k, v in state_dict.items()
        }
        model.load_state_dict(cleaned, strict=False)
        model.eval()
        return model

    @staticmethod
    def _detect_model_class(filename: str):
        try:
            from src.model_lib.MiniFASNet import MiniFASNetV2, MiniFASNetV1SE
        except ImportError as e:
            raise ImportError(
                f"Tidak dapat import MiniFASNet: {e}. "
                "Pastikan SilentFaceAntiSpoofing ter-clone dengan benar."
            ) from e

        fname_lower = filename.lower()
        if 'v1se' in fname_lower or 'minifasnetv1se' in fname_lower:
            return MiniFASNetV1SE
        return MiniFASNetV2

    def _crop_face_for_antispoof(
        self,
        image: np.ndarray,
        bbox: tuple,
    ) -> Optional[np.ndarray]:
        if image is None or bbox is None:
            return None

        x, y, w, h = bbox
        h_img, w_img = image.shape[:2]
        cx, cy = x + w // 2, y + h // 2
        new_w, new_h = int(w * self.scale_factor), int(h * self.scale_factor)

        x1 = max(0, cx - new_w // 2)
        y1 = max(0, cy - new_h // 2)
        x2 = min(w_img, cx + new_w // 2)
        y2 = min(h_img, cy + new_h // 2)

        if x2 <= x1 or y2 <= y1:
            return None

        face_crop = image[y1:y2, x1:x2]
        return cv2.resize(face_crop, (80, 80)) if face_crop.size > 0 else None

    def _preprocess_tensor(self, face_80x80: np.ndarray):
        import torch  # lazy
        face_rgb = cv2.cvtColor(face_80x80, cv2.COLOR_BGR2RGB)
        face_norm = face_rgb.astype(np.float32) / 255.0
        return torch.from_numpy(face_norm).permute(2, 0, 1).unsqueeze(0).to(self._device)

    def predict(self, face_img: np.ndarray) -> Dict:
        if not self.enabled or self._model is None:
            return _PASSTHROUGH_RESULT.copy()

        try:
            import torch  # lazy
            face_80x80 = cv2.resize(face_img, (80, 80))
            tensor = self._preprocess_tensor(face_80x80)

            with torch.no_grad():
                output = self._model(tensor)

            probs = torch.softmax(output, dim=1).cpu().numpy()[0]
            fake_prob = float(probs[0])
            real_prob = float(probs[1])
            is_real = real_prob >= self.real_threshold

            result = {
                'is_real': is_real,
                'real_prob': real_prob,
                'fake_prob': fake_prob,
                'confidence': max(real_prob, fake_prob),
                'label': 'REAL' if is_real else 'FAKE',
                'passthrough': False,
            }
            log.debug(f"[AntiSpoof] {result['label']} (real={real_prob:.3f}, fake={fake_prob:.3f})")
            return result

        except Exception as e:
            log.warning(f"[AntiSpoof] Predict gagal (fallback REAL): {e}")
            return _PASSTHROUGH_RESULT.copy()

    def predict_with_bbox(self, image: np.ndarray, bbox: tuple) -> Dict:
        if not self.enabled:
            return _PASSTHROUGH_RESULT.copy()
        face_crop = self._crop_face_for_antispoof(image, bbox)
        if face_crop is None:
            return _PASSTHROUGH_RESULT.copy()
        return self.predict(face_crop)

    def predict_multi_model(self, face_img: np.ndarray) -> Dict:
        if not self.enabled:
            return _PASSTHROUGH_RESULT.copy()

        try:
            import torch  # lazy
            pth_files = sorted(self.model_dir.glob("*.pth"))
            if not pth_files:
                return self.predict(face_img)

            face_80x80 = cv2.resize(face_img, (80, 80))
            tensor = self._preprocess_tensor(face_80x80)

            model_results: List[Dict] = []
            vote_real = 0
            vote_fake = 0

            for pth_path in pth_files:
                try:
                    m = self._load_model(pth_path, torch)
                    with torch.no_grad():
                        out = m(tensor)
                    probs = torch.softmax(out, dim=1).cpu().numpy()[0]
                    real_p = float(probs[1])
                    fake_p = float(probs[0])
                    is_real_vote = real_p >= self.real_threshold
                    model_results.append({
                        'model': pth_path.name,
                        'real_prob': real_p,
                        'fake_prob': fake_p,
                        'label': 'REAL' if is_real_vote else 'FAKE',
                    })
                    if is_real_vote:
                        vote_real += 1
                    else:
                        vote_fake += 1
                    del m
                except Exception as e:
                    log.warning(f"[AntiSpoof] Model {pth_path.name} gagal: {e}")

            if not model_results:
                return self.predict(face_img)

            is_real = vote_real > vote_fake
            avg_real = float(np.mean([r['real_prob'] for r in model_results]))
            avg_fake = float(np.mean([r['fake_prob'] for r in model_results]))

            return {
                'is_real': is_real,
                'real_prob': avg_real,
                'fake_prob': avg_fake,
                'confidence': max(avg_real, avg_fake),
                'label': 'REAL' if is_real else 'FAKE',
                'passthrough': False,
                'model_results': model_results,
                'vote_real': vote_real,
                'vote_fake': vote_fake,
            }

        except Exception as e:
            log.warning(f"[AntiSpoof] Multi-model predict gagal: {e}")
            return _PASSTHROUGH_RESULT.copy()

    @classmethod
    def from_config(cls) -> 'AntiSpoofManager':
        try:
            from config import ANTI_SPOOF_CONFIG as cfg
        except ImportError:
            log.warning("[AntiSpoof] Tidak dapat import ANTI_SPOOF_CONFIG.")
            inst = object.__new__(cls)
            inst.enabled = False
            inst._model = None
            inst._device = None
            inst.model_dir = Path('')
            inst.spoof_lib_path = Path('')
            inst.default_model = ''
            inst.real_threshold = 0.5
            inst.scale_factor = 2.7
            inst.use_multi_model_voting = False
            return inst

        return cls(
            model_dir=cfg['model_dir'],
            spoof_lib_path=cfg['spoof_lib_path'],
            default_model=cfg['default_model'],
            real_threshold=cfg['real_threshold'],
            device=cfg['device'],
            scale_factor=cfg['scale_factor'],
            use_multi_model_voting=cfg['use_multi_model_voting'],
        )

    def __repr__(self) -> str:
        status = f"enabled, model={self.default_model}" if self.enabled else "disabled"
        return f"AntiSpoofManager({status})"


# ---------------------------------------------------------------------------
# AntiSpoofGuardedSystem
# ---------------------------------------------------------------------------

class AntiSpoofGuardedSystem:
    """
    Wrapper komposisi atas EnhancedFaceRecognitionSystem dengan anti-spoofing.

    File enhanced_system.py TIDAK dimodifikasi.
    API identik sehingga bisa digunakan sebagai drop-in replacement.
    """

    def __init__(
        self,
        base_system,
        anti_spoof_manager: Optional[AntiSpoofManager] = None,
    ):
        self._base = base_system
        self._anti_spoof = anti_spoof_manager
        self._spoof_active = (
            anti_spoof_manager is not None and anti_spoof_manager.enabled
        )

        status = "AKTIF" if self._spoof_active else "TIDAK AKTIF"
        log.info(f"[GuardedSystem] Anti-spoofing {status}")

    @classmethod
    def create(
        cls,
        anti_spoof_manager: Optional[AntiSpoofManager] = None,
    ) -> 'AntiSpoofGuardedSystem':
        from enhanced_system import EnhancedFaceRecognitionSystem
        base = EnhancedFaceRecognitionSystem()
        if anti_spoof_manager is None:
            anti_spoof_manager = AntiSpoofManager.from_config()
        return cls(base, anti_spoof_manager)

    # ------------------------------------------------------------------
    # Core: recognize() dengan anti-spoof check
    # ------------------------------------------------------------------

    def recognize(self, frame: np.ndarray, update_template: bool = True):
        """
        Recognize wajah dengan anti-spoofing check.

        Flow:
          1. Jika anti-spoof aktif: deteksi wajah, cek spoof via bbox
          2. Jika FAKE: return RecognitionResult(nim=None, similarity=0.0)
          3. Jika REAL / disabled: lanjut ke pipeline normal
        """
        if self._spoof_active:
            preproc = self._base.preprocessor.detect_and_preprocess(
                frame, for_enrollment=False
            )

            if preproc['face'] is not None and preproc.get('bbox') is not None:
                if self._anti_spoof.use_multi_model_voting:
                    spoof_result = self._anti_spoof.predict_multi_model(preproc['face'])
                else:
                    spoof_result = self._anti_spoof.predict_with_bbox(
                        frame, preproc['bbox']
                    )

                if not spoof_result['is_real']:
                    log.info(
                        f"[GuardedSystem] Wajah FAKE terdeteksi "
                        f"(real={spoof_result['real_prob']:.3f}, "
                        f"fake={spoof_result['fake_prob']:.3f})"
                    )
                    from faiss_gallery import RecognitionResult
                    return RecognitionResult(
                        nim=None,
                        similarity=0.0,
                        is_recognized=False,
                    )

        return self._base.recognize(frame, update_template)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    @property
    def anti_spoof_active(self) -> bool:
        return self._spoof_active

    def get_spoof_status(self) -> Dict:
        return {
            'active': self._spoof_active,
            'model': self._anti_spoof.default_model if self._anti_spoof else None,
            'threshold': self._anti_spoof.real_threshold if self._anti_spoof else None,
            'device': self._anti_spoof._device if self._anti_spoof else None,
        }

    # ------------------------------------------------------------------
    # Delegasi ke base system (transparent proxy)
    # ------------------------------------------------------------------

    def enroll(self, nim: str, frames, metadata=None) -> bool:
        return self._base.enroll(nim, frames, metadata)

    def enroll_from_images(self, nim: str, image_paths, metadata=None) -> bool:
        return self._base.enroll_from_images(nim, image_paths, metadata)

    def verify(self, frame: np.ndarray, nim: str):
        return self._base.verify(frame, nim)

    def recognize_from_image(self, image_path: str, update_template: bool = True):
        return self._base.recognize_from_image(image_path, update_template)

    def get_gallery_size(self) -> int:
        return self._base.get_gallery_size()

    def list_identities(self):
        return self._base.list_identities()

    def remove_identity(self, nim: str) -> bool:
        return self._base.remove_identity(nim)

    def get_gallery_info(self) -> Dict:
        return self._base.get_gallery_info()

    @property
    def preprocessor(self):
        return self._base.preprocessor

    @property
    def calibrator(self):
        return self._base.calibrator

    @property
    def gallery(self):
        return self._base.gallery

    def __repr__(self) -> str:
        return (
            f"AntiSpoofGuardedSystem("
            f"base={self._base.__class__.__name__}, "
            f"spoof={self._anti_spoof})"
        )


# ---------------------------------------------------------------------------
# Quick test / demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    print("=" * 60)
    print("Anti-Spoofing Manager -- Quick Test")
    print("=" * 60)

    print("\n[Test 1] Load AntiSpoofManager dari config...")
    mgr = AntiSpoofManager.from_config()
    print(f"  {mgr}")

    print("\n[Test 2] Predict passthrough saat disabled...")
    dummy = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    result = mgr.predict(dummy)
    assert result['is_real'] is True, "Passthrough harus REAL saat disabled"
    print(f"  is_real={result['is_real']}, passthrough={result.get('passthrough')}")

    print("\n[Test 3] Buat AntiSpoofGuardedSystem...")
    try:
        system = AntiSpoofGuardedSystem.create(anti_spoof_manager=mgr)
        print(f"  {system}")
        print(f"  Anti-spoof active: {system.anti_spoof_active}")
        print(f"  Gallery size: {system.get_gallery_size()}")
    except Exception as e:
        print(f"  [!] GuardedSystem: {e}")

    print("\nDone! Untuk mengaktifkan anti-spoofing:")
    print("  1. Clone SilentFaceAntiSpoofing ke root proyek")
    print("  2. Letakkan .pth di ModelBaru/resources/anti_spoof_models/")
    print("  3. Set 'enabled': True di ANTI_SPOOF_CONFIG (config.py)")
