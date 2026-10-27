"""
Enhanced Data Augmentation Module
=================================
Enhanced augmentation methods for face recognition:
1. CLAHE (Contrast Limited Adaptive Histogram Equalization)
2. Gamma Correction
3. Sharpening
4. Histogram Equalization
5. Original methods (brightness, contrast, rotation, noise)

These augmentations are moderate - not too extreme to preserve embedding quality.

Author: Skripsi 2026
"""

import cv2
import numpy as np
from typing import Tuple, List, Optional
import logging

from config import AUGMENTATION_CONFIG

log = logging.getLogger(__name__)


class EnhancedAugmentation:
    """
    Enhanced face augmentation with multiple transformation methods.

    Unlike standard augmentations, these are designed to be moderate
    and preserve the essential face features for recognition.
    """

    def __init__(self):
        self.config = AUGMENTATION_CONFIG
        self.methods = self.config['methods']

    def apply_clahe(self, image: np.ndarray) -> np.ndarray:
        """
        Apply CLAHE (Contrast Limited Adaptive Histogram Equalization).

        CLAHE is particularly useful for faces with poor lighting
        as it enhances local contrast without over-amplifying noise.

        Args:
            image: BGR or grayscale image

        Returns:
            CLAHE-enhanced image
        """
        cfg = self.methods['clahe']
        if not cfg.get('enabled', True):
            return image

        # Convert to grayscale if needed (for LBPH)
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Random clip limit
        clip_limit = np.random.uniform(*cfg['clip_limit'])

        # Create CLAHE
        clahe = cv2.createCLAHE(
            clipLimit=clip_limit,
            tileGridSize=cfg['tile_size']
        )

        # Apply
        enhanced = clahe.apply(gray)

        # Convert back to BGR if input was BGR
        if len(image.shape) == 3:
            enhanced = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

        return enhanced

    def apply_gamma(self, image: np.ndarray) -> np.ndarray:
        """
        Apply Gamma correction.

        Gamma < 1: Brighten dark areas
        Gamma > 1: Darken bright areas

        Args:
            image: BGR or grayscale image

        Returns:
            Gamma-corrected image
        """
        cfg = self.methods['gamma']
        if not cfg.get('enabled', True):
            return image

        gamma = np.random.uniform(*cfg['gamma_range'])

        # Build lookup table
        inv_gamma = 1.0 / gamma
        table = np.array([
            ((i / 255.0) ** inv_gamma) * 255
            for i in np.arange(0, 256)
        ]).astype("uint8")

        # Apply
        return cv2.LUT(image, table)

    def apply_sharpen(self, image: np.ndarray) -> np.ndarray:
        """
        Apply sharpening filter.

        Uses an unsharp masking approach which enhances edges
        without introducing artifacts.

        Args:
            image: BGR or grayscale image

        Returns:
            Sharpened image
        """
        cfg = self.methods['sharpen']
        if not cfg.get('enabled', True):
            return image

        strength = np.random.uniform(*cfg['kernel_range'])

        # Create sharpening kernel
        # Standard sharpening kernel with adjustable strength
        kernel = np.array([
            [0, -1, 0],
            [-1, 4 + strength, -1],
            [0, -1, 0]
        ]) / (strength + 1)

        # Apply
        if len(image.shape) == 3:
            sharpened = cv2.filter2D(image, -1, kernel)
        else:
            sharpened = cv2.filter2D(image, -1, kernel)

        # Blend with original (0.3 = 30% sharpened, 70% original)
        # This keeps the augmentation moderate
        alpha = 0.3
        result = cv2.addWeighted(
            image, 1 - alpha,
            sharpened, alpha,
            0
        )

        return result

    def apply_histogram_equalization(self, image: np.ndarray) -> np.ndarray:
        """
        Apply global histogram equalization.

        This stretches the histogram to use the full dynamic range,
        improving overall contrast.

        Note: CLAHE is generally preferred for faces as it preserves
        local structure better.

        Args:
            image: BGR or grayscale image

        Returns:
            Histogram-equalized image
        """
        cfg = self.methods['hist_eq']
        if not cfg.get('enabled', True):
            return image

        if len(image.shape) == 3:
            # Convert to YCrCb, equalize Y channel
            ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
            ycrcb[:, :, 0] = cv2.equalizeHist(ycrcb[:, :, 0])
            return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
        else:
            return cv2.equalizeHist(image)

    def apply_brightness(self, image: np.ndarray) -> np.ndarray:
        """
        Adjust brightness.

        Args:
            image: BGR or grayscale image

        Returns:
            Brightness-adjusted image
        """
        cfg = self.methods['brightness']
        if not cfg.get('enabled', True):
            return image

        factor = np.random.uniform(*cfg['factor_range'])

        if len(image.shape) == 3:
            # For BGR, adjust each channel
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2].astype(np.float32) * factor, 0, 255).astype(np.uint8)
            return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        else:
            return np.clip(image.astype(np.float32) * factor, 0, 255).astype(np.uint8)

    def apply_rotation(self, image: np.ndarray) -> np.ndarray:
        """
        Apply slight rotation.

        Rotation is kept small (±8°) to avoid drastic changes
        to the embedding.

        Args:
            image: BGR or grayscale image

        Returns:
            Rotated image
        """
        cfg = self.methods['rotation']
        if not cfg.get('enabled', True):
            return image

        angle = np.random.uniform(-cfg['max_angle'], cfg['max_angle'])
        h, w = image.shape[:2]

        # Get rotation matrix
        M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)

        # Apply rotation
        return cv2.warpAffine(
            image, M, (w, h),
            borderMode=cv2.BORDER_REFLECT,
            borderValue=0
        )

    def apply_noise(self, image: np.ndarray) -> np.ndarray:
        """
        Add Gaussian noise.

        Args:
            image: BGR or grayscale image

        Returns:
            Noisy image
        """
        cfg = self.methods.get('noise', {})
        if not cfg.get('enabled', True):
            return image

        std = np.random.uniform(*cfg.get('std_range', (3.0, 12.0)))

        # Gaussian noise
        noise = np.random.normal(0, std, image.shape)
        noisy = image.astype(np.float32) + noise

        return np.clip(noisy, 0, 255).astype(np.uint8)

    def apply_shadows(self, image: np.ndarray) -> np.ndarray:
        """
        Simulasi shadow / pencahayaan tidak merata (vignette satu sisi).

        Ini mensimulasi kondisi di gedung jurusan di mana cahaya datang dari
        satu arah (jendela atau lampu overhead), menghasilkan bayangan gradien
        pada separuh wajah. Augmentasi ini sangat penting untuk membuat gallery
        embedding robust terhadap kondisi pencahayaan tidak merata.

        Args:
            image: BGR or grayscale image

        Returns:
            Image dengan shadow gradient
        """
        cfg = self.methods.get('shadows', {})
        if not cfg.get('enabled', True):
            return image

        intensity_range = cfg.get('intensity_range', (0.3, 0.7))
        intensity = np.random.uniform(*intensity_range)

        h, w = image.shape[:2]

        # Pilih arah shadow secara random:
        # 0 = dari kiri, 1 = dari kanan, 2 = dari atas, 3 = dari bawah
        direction = np.random.randint(0, 4)

        # Buat gradient mask (0.0 = shadow gelap, 1.0 = normal)
        mask = np.ones((h, w), dtype=np.float32)

        shadow_strength = 1.0 - intensity  # Misal intensity=0.5 → shadow=0.5

        if direction == 0:   # Shadow dari kiri
            for col in range(w // 2):
                alpha = shadow_strength + (1.0 - shadow_strength) * (col / (w / 2))
                mask[:, col] = alpha
        elif direction == 1:  # Shadow dari kanan
            for col in range(w // 2, w):
                alpha = shadow_strength + (1.0 - shadow_strength) * ((w - col) / (w / 2))
                mask[:, col] = alpha
        elif direction == 2:  # Shadow dari atas
            for row in range(h // 2):
                alpha = shadow_strength + (1.0 - shadow_strength) * (row / (h / 2))
                mask[row, :] = alpha
        else:                # Shadow dari bawah
            for row in range(h // 2, h):
                alpha = shadow_strength + (1.0 - shadow_strength) * ((h - row) / (h / 2))
                mask[row, :] = alpha

        # Apply mask
        if len(image.shape) == 3:
            mask_3ch = np.stack([mask, mask, mask], axis=2)
            result = (image.astype(np.float32) * mask_3ch)
        else:
            result = (image.astype(np.float32) * mask)

        return np.clip(result, 0, 255).astype(np.uint8)

    def apply_color_temperature(self, image: np.ndarray,
                                 temp: str = None) -> np.ndarray:
        """
        Simulasi perbedaan color temperature pencahayaan.

        Kamera Android sering menghasilkan color cast yang berbeda
        tergantung sumber cahaya:
        - Warm (tungsten/incandescent): kekuningan, boost Red, reduce Blue
        - Cool (neon/fluorescent/TL): kebiruan, boost Blue, reduce Red

        Args:
            image: BGR image
            temp: 'warm', 'cool', atau None (random)

        Returns:
            Image dengan color temperature shift
        """
        cfg = self.methods.get('color_temp', {})
        if not cfg.get('enabled', True):
            return image

        if len(image.shape) != 3:
            return image  # Hanya untuk BGR

        if temp is None:
            temp = np.random.choice(['warm', 'cool'])

        result = image.astype(np.float32)

        if temp == 'warm':
            shift = np.random.uniform(*cfg.get('warm_shift', (10, 30)))
            # BGR: boost Red (channel 2), reduce Blue (channel 0)
            result[:, :, 2] = np.clip(result[:, :, 2] + shift, 0, 255)
            result[:, :, 0] = np.clip(result[:, :, 0] - shift * 0.5, 0, 255)
        else:  # cool
            shift = np.random.uniform(*cfg.get('cool_shift', (10, 30)))
            # BGR: boost Blue (channel 0), reduce Red (channel 2)
            result[:, :, 0] = np.clip(result[:, :, 0] + shift, 0, 255)
            result[:, :, 2] = np.clip(result[:, :, 2] - shift * 0.5, 0, 255)

        return result.astype(np.uint8)

    def apply_jpeg_compression(self, image: np.ndarray,
                                quality: int = None) -> np.ndarray:
        """
        Simulasi artefak kompresi JPEG dari kamera Android & WhatsApp.

        Foto dari HP sering di-compress beberapa kali:
        1. Kamera HP compress saat save (quality ~85)
        2. App/WhatsApp compress ulang saat kirim (quality ~60)
        3. Server bisa compress lagi saat simpan

        Ini menyebabkan artefak blok yang mengubah distribusi pixel.

        Args:
            image: BGR image
            quality: JPEG quality (1-100), lower = more artifacts

        Returns:
            Image dengan JPEG compression artifacts
        """
        cfg = self.methods.get('jpeg_compression', {})
        if not cfg.get('enabled', True):
            return image

        if quality is None:
            quality = int(np.random.uniform(*cfg.get('quality_range', (30, 70))))

        # Encode ke JPEG buffer dan decode kembali
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        _, encoded = cv2.imencode('.jpg', image, encode_param)
        decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)

        if decoded is None:
            return image

        # Pastikan ukuran sama (seharusnya selalu sama)
        if decoded.shape != image.shape:
            decoded = cv2.resize(decoded, (image.shape[1], image.shape[0]))

        return decoded

    def apply_gaussian_blur(self, image: np.ndarray,
                             kernel_size: int = None) -> np.ndarray:
        """
        Simulasi sedikit out-of-focus dari kamera HP.

        Kamera Android (terutama front camera) sering sedikit tidak fokus
        saat autofocus gagal atau objek bergerak.

        Args:
            image: BGR or grayscale image
            kernel_size: Kernel size (harus ganjil: 3, 5)

        Returns:
            Slightly blurred image
        """
        cfg = self.methods.get('gaussian_blur', {})
        if not cfg.get('enabled', True):
            return image

        if kernel_size is None:
            k_range = cfg.get('kernel_range', (3, 5))
            kernel_size = np.random.choice(
                [k for k in range(k_range[0], k_range[1] + 1) if k % 2 == 1]
            )

        return cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)

    def apply_exposure_simulation(self, image: np.ndarray,
                                   mode: str = None) -> np.ndarray:
        """
        Simulasi auto-exposure kamera Android yang realistis.

        Berbeda dari simple brightness adjustment, ini mengkombinasikan:
        - Brightness adjustment
        - Gamma correction
        - Sedikit saturation shift

        Ini lebih mendekati bagaimana kamera HP sebenarnya menghandle
        exposure otomatis di berbagai kondisi.

        Args:
            image: BGR image
            mode: 'under' (indoor gelap), 'over' (outdoor terang), atau None (random)

        Returns:
            Exposure-adjusted image
        """
        cfg = self.methods.get('exposure_simulation', {})
        if not cfg.get('enabled', True):
            return image

        if len(image.shape) != 3:
            return image

        if mode is None:
            mode = np.random.choice(['under', 'over'])

        result = image.copy()

        if mode == 'under':
            # Underexposed: gelap + gamma tinggi + saturation turun
            factor = np.random.uniform(*cfg.get('underexpose_range', (0.4, 0.7)))
            gamma = np.random.uniform(1.2, 1.6)

            # Apply brightness
            hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 2] *= factor
            hsv[:, :, 1] *= 0.85  # Saturation turun sedikit saat gelap
            hsv = np.clip(hsv, 0, 255).astype(np.uint8)
            result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

            # Apply gamma
            inv_gamma = 1.0 / gamma
            table = np.array([(i / 255.0) ** inv_gamma * 255
                              for i in range(256)]).astype(np.uint8)
            result = cv2.LUT(result, table)
        else:
            # Overexposed: terang + gamma rendah + saturation naik sedikit
            factor = np.random.uniform(*cfg.get('overexpose_range', (1.3, 1.8)))
            gamma = np.random.uniform(0.6, 0.85)

            # Apply brightness
            hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 2] *= factor
            hsv[:, :, 1] *= 1.1  # Saturation naik sedikit saat overexposed
            hsv = np.clip(hsv, 0, 255).astype(np.uint8)
            result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

            # Apply gamma
            inv_gamma = 1.0 / gamma
            table = np.array([(i / 255.0) ** inv_gamma * 255
                              for i in range(256)]).astype(np.uint8)
            result = cv2.LUT(result, table)

        return result

    def augment(
        self,
        image: np.ndarray,
        max_methods: int = None,
        methods: List[str] = None
    ) -> np.ndarray:
        """
        Apply random augmentation combination.

        Args:
            image: Input image (BGR or grayscale)
            max_methods: Maximum number of methods to apply (default: config)
            methods: Specific methods to apply (default: random selection)

        Returns:
            Augmented image
        """
        if not self.config.get('enabled', True):
            return image

        max_methods = max_methods or self.config.get('max_combined', 3)

        # Select methods based on probability
        if methods is None:
            available_methods = []
            # Daftar semua augmentasi yang tersedia (termasuk yang baru)
            all_aug_names = ['clahe', 'gamma', 'sharpen', 'hist_eq',
                             'brightness', 'rotation', 'noise', 'shadows',
                             'color_temp', 'jpeg_compression',
                             'gaussian_blur', 'exposure_simulation']
            for name in all_aug_names:
                cfg = self.methods.get(name, {})
                if cfg.get('enabled', True) and np.random.random() < cfg.get('probability', 0.5):
                    available_methods.append(name)

            # Randomly select up to max_methods
            if len(available_methods) > max_methods:
                methods = list(np.random.choice(available_methods, max_methods, replace=False))
            else:
                methods = available_methods

        # Apply selected methods
        augmented = image.copy()
        for method in methods:
            if method == 'clahe':
                augmented = self.apply_clahe(augmented)
            elif method == 'gamma':
                augmented = self.apply_gamma(augmented)
            elif method == 'sharpen':
                augmented = self.apply_sharpen(augmented)
            elif method == 'hist_eq':
                augmented = self.apply_histogram_equalization(augmented)
            elif method == 'brightness':
                augmented = self.apply_brightness(augmented)
            elif method == 'rotation':
                augmented = self.apply_rotation(augmented)
            elif method == 'noise':
                augmented = self.apply_noise(augmented)
            elif method == 'shadows':
                augmented = self.apply_shadows(augmented)
            elif method == 'color_temp':
                augmented = self.apply_color_temperature(augmented)
            elif method == 'jpeg_compression':
                augmented = self.apply_jpeg_compression(augmented)
            elif method == 'gaussian_blur':
                augmented = self.apply_gaussian_blur(augmented)
            elif method == 'exposure_simulation':
                augmented = self.apply_exposure_simulation(augmented)

        return augmented

    def generate_versions(
        self,
        image: np.ndarray,
        n_versions: int = None,
        include_original: bool = True
    ) -> List[np.ndarray]:
        """
        Generate multiple augmented versions.

        Args:
            image: Original image
            n_versions: Number of augmented versions (default: config)
            include_original: Include original in output

        Returns:
            List of image versions (original + augmentations)
        """
        n_versions = n_versions or self.config.get('enrollment_copies', 3)

        versions = []
        if include_original:
            versions.append(image)

        for _ in range(n_versions):
            versions.append(self.augment(image))

        return versions

    def generate_lighting_variants(
        self,
        image: np.ndarray,
        include_original: bool = False
    ) -> List[np.ndarray]:
        """
        Generate 7 kondisi cahaya deterministik untuk enrollment.

        Berbeda dari generate_versions() yang random, method ini
        MENJAMIN gallery mencakup 7 skenario cahaya nyata:
        1. Terang (gamma 0.6, brightness 1.25) — outdoor / lampu kuat
        2. Gelap (gamma 1.5, brightness 0.6) — indoor sore
        3. Sangat gelap + CLAHE (brightness 0.4) — indoor malam
        4. Overexposed (brightness 1.5, sedikit saturasi) — flash HP
        5. Shadow kiri (cahaya dari kanan) — dekat jendela
        6. Shadow kanan (cahaya dari kiri) — dekat jendela sisi lain
        7. CLAHE agresif (normalisasi histogram) — kamera kualitas rendah

        Args:
            image: Original BGR face crop
            include_original: Apakah menyertakan gambar original

        Returns:
            List of augmented images (7 atau 8 item)
        """
        variants = []
        if include_original:
            variants.append(image.copy())

        h, w = image.shape[:2]

        # ── Variant 1: TERANG — Outdoor / lampu studio ──────────────────────
        # Simulasi: foto enrollment diambil di luar ruangan atau dekat jendela
        bright = image.astype(np.float32)
        # Gamma < 1 → mencerahkan (inverse gamma correction)
        gamma_table = np.array([(i / 255.0) ** (1.0 / 0.6) * 255
                                 for i in range(256)]).astype(np.uint8)
        v1 = cv2.LUT(image, gamma_table)
        v1 = cv2.convertScaleAbs(v1, alpha=1.0, beta=10)  # sedikit offset
        variants.append(np.clip(v1, 0, 255).astype(np.uint8))

        # ── Variant 2: GELAP — Indoor sore ──────────────────────────────────
        # Simulasi: ruang kelas di sore hari tanpa lampu cukup
        gamma_table_dark = np.array([(i / 255.0) ** 1.5 * 255
                                      for i in range(256)]).astype(np.uint8)
        v2 = cv2.LUT(image, gamma_table_dark)
        hsv = cv2.cvtColor(v2, cv2.COLOR_BGR2HSV)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2].astype(np.float32) * 0.65, 0, 255).astype(np.uint8)
        variants.append(cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR))

        # ── Variant 3: SANGAT GELAP + CLAHE ─────────────────────────────────
        # Simulasi: indoor malam, kamera HP dengan auto-brightness
        hsv3 = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        hsv3[:, :, 2] = np.clip(hsv3[:, :, 2].astype(np.float32) * 0.42, 0, 255).astype(np.uint8)
        dark_face = cv2.cvtColor(hsv3, cv2.COLOR_HSV2BGR)
        lab3 = cv2.cvtColor(dark_face, cv2.COLOR_BGR2LAB)
        clahe_strong = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
        lab3[:, :, 0] = clahe_strong.apply(lab3[:, :, 0])
        variants.append(cv2.cvtColor(lab3, cv2.COLOR_LAB2BGR))

        # ── Variant 4: OVEREXPOSED ───────────────────────────────────────────
        # Simulasi: flash HP langsung, atau foto di luar ruangan tengah hari
        hsv4 = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        hsv4[:, :, 2] = np.clip(hsv4[:, :, 2].astype(np.float32) * 1.55, 0, 255).astype(np.uint8)
        v4 = cv2.cvtColor(hsv4, cv2.COLOR_HSV2BGR)
        variants.append(np.clip(v4, 0, 255).astype(np.uint8))

        # ── Variant 5: SHADOW KIRI ───────────────────────────────────────────
        # Simulasi: cahaya dari kanan (jendela sisi kanan), wajah kiri gelap
        mask_left = np.ones((h, w), dtype=np.float32)
        for col in range(w // 2):
            alpha = 0.35 + 0.65 * (col / (w / 2))
            mask_left[:, col] = alpha
        mask_left_3ch = np.stack([mask_left] * 3, axis=2)
        v5 = np.clip(image.astype(np.float32) * mask_left_3ch, 0, 255).astype(np.uint8)
        variants.append(v5)

        # ── Variant 6: SHADOW KANAN ──────────────────────────────────────────
        # Simulasi: cahaya dari kiri (jendela sisi kiri), wajah kanan gelap
        mask_right = np.ones((h, w), dtype=np.float32)
        for col in range(w // 2, w):
            alpha = 0.35 + 0.65 * ((w - col) / (w / 2))
            mask_right[:, col] = alpha
        mask_right_3ch = np.stack([mask_right] * 3, axis=2)
        v6 = np.clip(image.astype(np.float32) * mask_right_3ch, 0, 255).astype(np.uint8)
        variants.append(v6)

        # ── Variant 7: CLAHE AGRESIF ─────────────────────────────────────────
        # Simulasi: kamera kualitas rendah / foto lama — histogram sangat normalized
        lab7 = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        clahe_agg = cv2.createCLAHE(clipLimit=4.5, tileGridSize=(4, 4))
        lab7[:, :, 0] = clahe_agg.apply(lab7[:, :, 0])
        v7 = cv2.cvtColor(lab7, cv2.COLOR_LAB2BGR)
        variants.append(v7)

        return variants

    def generate_android_variants(
        self,
        image: np.ndarray,
        include_original: bool = False
    ) -> List[np.ndarray]:
        """
        Generate 10 kondisi deterministik yang mensimulasi kamera Android.

        Method ini fokus pada kondisi yang TIDAK tercakup oleh
        generate_lighting_variants, khususnya:
        - Color temperature shift (warm/cool)
        - JPEG compression artifacts
        - Noise sensor di kondisi gelap
        - Kombinasi realistis dari beberapa faktor sekaligus

        10 varian:
        1. Indoor lampu neon (cool temp + gelap ringan)
        2. Indoor lampu tungsten (warm temp + shadow ringan)
        3. Outdoor teduh (gamma ringan + noise ringan + JPEG)
        4. Outdoor terang langsung (overexposed + slight warm + JPEG)
        5. Malam/gelap total (very dark + noise tinggi + CLAHE agresif)
        6. Backlight (shadow atas kuat + terang bawah)
        7. HP dekat jendela kiri (shadow kanan kuat + warm)
        8. HP dekat jendela kanan (shadow kiri kuat + cool)
        9. Foto terkompresi (JPEG q=25 + slight blur + noise)
        10. Kamera depan HP (flip + slight warm + noise + JPEG)

        Args:
            image: Original BGR face crop
            include_original: Apakah menyertakan gambar original

        Returns:
            List of augmented images (10 atau 11 item)
        """
        variants = []
        if include_original:
            variants.append(image.copy())

        h, w = image.shape[:2]

        # ── Variant 1: INDOOR LAMPU NEON ─────────────────────────────────────
        # Lampu TL/neon menghasilkan cahaya kebiruan + sedikit gelap
        v1 = image.astype(np.float32)
        v1[:, :, 0] = np.clip(v1[:, :, 0] + 20, 0, 255)  # Blue boost
        v1[:, :, 2] = np.clip(v1[:, :, 2] - 10, 0, 255)   # Red reduce
        hsv1 = cv2.cvtColor(v1.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv1[:, :, 2] *= 0.80  # Gelap ringan
        hsv1 = np.clip(hsv1, 0, 255).astype(np.uint8)
        variants.append(cv2.cvtColor(hsv1, cv2.COLOR_HSV2BGR))

        # ── Variant 2: INDOOR LAMPU TUNGSTEN ─────────────────────────────────
        # Lampu pijar/tungsten = kekuningan + shadow ringan dari satu sisi
        v2 = image.astype(np.float32)
        v2[:, :, 2] = np.clip(v2[:, :, 2] + 25, 0, 255)  # Red boost
        v2[:, :, 0] = np.clip(v2[:, :, 0] - 15, 0, 255)   # Blue reduce
        v2[:, :, 1] = np.clip(v2[:, :, 1] + 5, 0, 255)    # Green sedikit naik
        # Shadow ringan dari kiri
        mask2 = np.ones((h, w), dtype=np.float32)
        for col in range(w // 3):
            mask2[:, col] = 0.6 + 0.4 * (col / (w / 3))
        mask2_3ch = np.stack([mask2] * 3, axis=2)
        v2 = np.clip(v2 * mask2_3ch, 0, 255).astype(np.uint8)
        variants.append(v2)

        # ── Variant 3: OUTDOOR TEDUH ─────────────────────────────────────────
        # Teduh = cahaya diffuse, sedikit noise, JPEG dari share HP
        gamma_table = np.array([(i / 255.0) ** 0.85 * 255
                                 for i in range(256)]).astype(np.uint8)
        v3 = cv2.LUT(image, gamma_table)
        # Noise ringan
        noise3 = np.random.normal(0, 5, v3.shape).astype(np.float32)
        v3 = np.clip(v3.astype(np.float32) + noise3, 0, 255).astype(np.uint8)
        # JPEG compression
        _, enc3 = cv2.imencode('.jpg', v3, [cv2.IMWRITE_JPEG_QUALITY, 55])
        v3 = cv2.imdecode(enc3, cv2.IMREAD_COLOR)
        if v3 is not None:
            variants.append(v3)
        else:
            variants.append(image.copy())

        # ── Variant 4: OUTDOOR TERANG LANGSUNG ───────────────────────────────
        # Sinar matahari langsung = overexposed + slight warm + JPEG
        hsv4 = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv4[:, :, 2] = np.clip(hsv4[:, :, 2] * 1.6, 0, 255)
        hsv4[:, :, 1] = np.clip(hsv4[:, :, 1] * 1.1, 0, 255)  # Sedikit saturasi
        v4 = cv2.cvtColor(np.clip(hsv4, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
        # Slight warm (matahari = warm)
        v4 = v4.astype(np.float32)
        v4[:, :, 2] = np.clip(v4[:, :, 2] + 10, 0, 255)
        v4 = v4.astype(np.uint8)
        # JPEG
        _, enc4 = cv2.imencode('.jpg', v4, [cv2.IMWRITE_JPEG_QUALITY, 50])
        v4 = cv2.imdecode(enc4, cv2.IMREAD_COLOR)
        if v4 is not None:
            variants.append(v4)
        else:
            variants.append(image.copy())

        # ── Variant 5: MALAM / GELAP TOTAL ───────────────────────────────────
        # Kamera HP di malam hari: sangat gelap + noise tinggi + auto-CLAHE
        hsv5 = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv5[:, :, 2] *= 0.30  # Sangat gelap
        hsv5[:, :, 1] *= 0.7   # Saturation turun
        v5 = cv2.cvtColor(np.clip(hsv5, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
        # Noise tinggi (sensor noise di low light)
        noise5 = np.random.normal(0, 15, v5.shape).astype(np.float32)
        v5 = np.clip(v5.astype(np.float32) + noise5, 0, 255).astype(np.uint8)
        # CLAHE agresif (simulasi auto-brightness HP)
        lab5 = cv2.cvtColor(v5, cv2.COLOR_BGR2LAB)
        clahe5 = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
        lab5[:, :, 0] = clahe5.apply(lab5[:, :, 0])
        variants.append(cv2.cvtColor(lab5, cv2.COLOR_LAB2BGR))

        # ── Variant 6: BACKLIGHT ─────────────────────────────────────────────
        # Cahaya dari belakang subjek: bagian atas terang, bawah gelap
        mask6 = np.ones((h, w), dtype=np.float32)
        for row in range(h):
            # Gradien: atas terang (1.3), tengah normal (1.0), bawah gelap (0.5)
            if row < h // 3:
                mask6[row, :] = 1.3 - 0.3 * (row / (h / 3))
            elif row > 2 * h // 3:
                mask6[row, :] = 1.0 - 0.5 * ((row - 2 * h // 3) / (h / 3))
        mask6_3ch = np.stack([mask6] * 3, axis=2)
        v6 = np.clip(image.astype(np.float32) * mask6_3ch, 0, 255).astype(np.uint8)
        variants.append(v6)

        # ── Variant 7: HP DEKAT JENDELA KIRI ─────────────────────────────────
        # Cahaya kuat dari kiri: wajah kanan sangat gelap + warm tint
        mask7 = np.ones((h, w), dtype=np.float32)
        for col in range(w):
            if col > w // 3:
                mask7[:, col] = 1.0 - 0.6 * ((col - w // 3) / (2 * w / 3))
        mask7_3ch = np.stack([mask7] * 3, axis=2)
        v7 = np.clip(image.astype(np.float32) * mask7_3ch, 0, 255)
        v7[:, :, 2] = np.clip(v7[:, :, 2] + 10, 0, 255)  # Warm tint
        variants.append(v7.astype(np.uint8))

        # ── Variant 8: HP DEKAT JENDELA KANAN ────────────────────────────────
        # Cahaya kuat dari kanan: wajah kiri sangat gelap + cool tint
        mask8 = np.ones((h, w), dtype=np.float32)
        for col in range(w):
            if col < 2 * w // 3:
                mask8[:, col] = 0.4 + 0.6 * (col / (2 * w / 3))
        mask8_3ch = np.stack([mask8] * 3, axis=2)
        v8 = np.clip(image.astype(np.float32) * mask8_3ch, 0, 255)
        v8[:, :, 0] = np.clip(v8[:, :, 0] + 10, 0, 255)  # Cool tint
        variants.append(v8.astype(np.uint8))

        # ── Variant 9: FOTO TERKOMPRESI ──────────────────────────────────────
        # Foto yang sudah di-share berkali-kali: heavy JPEG + blur + noise
        v9 = cv2.GaussianBlur(image, (3, 3), 0)
        noise9 = np.random.normal(0, 8, v9.shape).astype(np.float32)
        v9 = np.clip(v9.astype(np.float32) + noise9, 0, 255).astype(np.uint8)
        _, enc9 = cv2.imencode('.jpg', v9, [cv2.IMWRITE_JPEG_QUALITY, 25])
        v9 = cv2.imdecode(enc9, cv2.IMREAD_COLOR)
        if v9 is not None:
            variants.append(v9)
        else:
            variants.append(image.copy())

        # ── Variant 10: KAMERA DEPAN HP ──────────────────────────────────────
        # Front camera = mirrored + slight warm + noise + JPEG
        v10 = cv2.flip(image, 1)  # Horizontal flip (mirror)
        v10 = v10.astype(np.float32)
        v10[:, :, 2] = np.clip(v10[:, :, 2] + 8, 0, 255)   # Slight warm
        v10[:, :, 0] = np.clip(v10[:, :, 0] - 5, 0, 255)
        noise10 = np.random.normal(0, 6, v10.shape).astype(np.float32)
        v10 = np.clip(v10 + noise10, 0, 255).astype(np.uint8)
        _, enc10 = cv2.imencode('.jpg', v10, [cv2.IMWRITE_JPEG_QUALITY, 60])
        v10 = cv2.imdecode(enc10, cv2.IMREAD_COLOR)
        if v10 is not None:
            variants.append(v10)
        else:
            variants.append(image.copy())

        return variants


# Backward compatibility with old Augmentation class
class Augmentation(EnhancedAugmentation):
    """
    Backward compatibility wrapper.
    Uses the new EnhancedAugmentation class.
    """

    def __init__(self):
        super().__init__()

    @staticmethod
    def random_brightness(image, factor_range=(0.8, 1.2)):
        """Legacy method - use enhanced version."""
        cfg = {'factor_range': factor_range, 'enabled': True}
        result = image.copy()
        factor = np.random.uniform(*factor_range)
        if len(image.shape) == 3:
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2].astype(np.float32) * factor, 0, 255).astype(np.uint8)
            result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        else:
            result = np.clip(image.astype(np.float32) * factor, 0, 255).astype(np.uint8)
        return result

    @staticmethod
    def random_contrast(image, factor_range=(0.8, 1.2)):
        """Legacy method."""
        factor = np.random.uniform(*factor_range)
        mean = image.mean()
        return np.clip((image - mean) * factor + mean, 0, 255).astype(np.uint8)

    @staticmethod
    def random_rotation(image, max_angle=10):
        """Legacy method."""
        angle = np.random.uniform(-max_angle, max_angle)
        h, w = image.shape[:2]
        M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
        return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)

    @staticmethod
    def random_noise(image, std=5.0):
        """Legacy method."""
        noise = np.random.normal(0, std, image.shape)
        return np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    @classmethod
    def augment(cls, image):
        """Legacy method."""
        aug = cls()
        return aug.augment(image)

    @classmethod
    def generate_versions(cls, image, n=4):
        """Legacy method."""
        aug = cls()
        return aug.generate_versions(image, n_versions=n, include_original=True)


def augment_face(
    face: np.ndarray,
    method: str = 'random',
    seed: Optional[int] = None
) -> np.ndarray:
    """
    Convenience function for face augmentation.

    Args:
        face: Face crop
        method: Augmentation method ('clahe', 'gamma', 'sharpen', 'hist_eq', 'random')
        seed: Random seed for reproducibility

    Returns:
        Augmented face
    """
    if seed is not None:
        np.random.seed(seed)

    aug = EnhancedAugmentation()

    if method == 'clahe':
        return aug.apply_clahe(face)
    elif method == 'gamma':
        return aug.apply_gamma(face)
    elif method == 'sharpen':
        return aug.apply_sharpen(face)
    elif method == 'hist_eq':
        return aug.apply_histogram_equalization(face)
    else:  # 'random'
        return aug.augment(face)


# Test function
if __name__ == "__main__":
    import sys

    log.info("Testing EnhancedAugmentation...")

    # Test with sample image
    if len(sys.argv) > 1:
        image = cv2.imread(sys.argv[1])
        if image is not None:
            aug = EnhancedAugmentation()

            # Generate versions
            versions = aug.generate_versions(image, n_versions=4)
            log.info(f"Generated {len(versions)} versions")

            # Save examples
            for i, v in enumerate(versions):
                cv2.imwrite(f"aug_test_{i}.jpg", v)
            log.info("Saved augmented versions")
    else:
        # Synthetic test
        image = np.random.randint(0, 255, (112, 112, 3), dtype=np.uint8)
        aug = EnhancedAugmentation()

        versions = aug.generate_versions(image, n_versions=3)
        log.info(f"Generated {len(versions)} versions")
