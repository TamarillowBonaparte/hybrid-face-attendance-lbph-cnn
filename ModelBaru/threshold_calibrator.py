"""
Threshold Calibration Module (Revisi)
==================================
Dynamic threshold calibration using ROC Curve and EER.

Revisi: Hapus dynamic adjustment
- Quality sudah dipakai di Score-Level Fusion
- Tidak perlu dipakai lagi di threshold
- Threshold = ROC + EER saja

Author: Skripsi 2026
"""

import numpy as np
from typing import List, Tuple, Optional
import json
import logging
from dataclasses import dataclass

from config import THRESHOLD_CONFIG, DATABASE_CONFIG

log = logging.getLogger(__name__)


@dataclass
class CalibrationResult:
    """Results from threshold calibration."""
    optimal_threshold: float
    eer_threshold: float
    eer: float
    far_at_optimal: float
    frr_at_optimal: float
    roc_points: int
    calibration_date: str


class ThresholdCalibrator:
    """
    Threshold calibrator using ROC Curve and EER.

    Metode:
    1. Hitung ROC Curve dari genuine dan impostor scores
    2. Cari EER point (dimana FAR = FRR)
    3. Threshold = EER threshold

    Revisi: Tidak ada dynamic adjustment
    - Quality sudah dipakai di fusion
    - Threshold tetap untuk semua kualitas wajah
    """

    def __init__(self):
        self.config = THRESHOLD_CONFIG
        self.calibration: Optional[CalibrationResult] = None
        self._load_calibration()

    def _load_calibration(self):
        """Load calibration from file."""
        calib_path = DATABASE_CONFIG['calibration']
        if calib_path.exists():
            try:
                with open(calib_path, 'r') as f:
                    data = json.load(f)
                    self.calibration = CalibrationResult(**data)
                log.info(f"[Calibrator] Loaded: threshold={self.calibration.optimal_threshold:.4f}")
            except Exception as e:
                log.warning(f"[Calibrator] Load failed: {e}")

    def _save_calibration(self):
        """Save calibration to file."""
        if self.calibration is None:
            return

        calib_path = DATABASE_CONFIG['calibration']
        calib_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            'optimal_threshold': self.calibration.optimal_threshold,
            'eer_threshold': self.calibration.eer_threshold,
            'eer': self.calibration.eer,
            'far_at_optimal': self.calibration.far_at_optimal,
            'frr_at_optimal': self.calibration.frr_at_optimal,
            'roc_points': self.calibration.roc_points,
            'calibration_date': self.calibration.calibration_date
        }

        with open(calib_path, 'w') as f:
            json.dump(data, f, indent=2)

        log.info(f"[Calibrator] Saved to {calib_path}")

    def compute_roc_curve(
        self,
        genuine_scores: np.ndarray,
        impostor_scores: np.ndarray,
        n_points: int = 100
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Compute ROC curve.

        Args:
            genuine_scores: Scores for genuine matches (same identity)
            impostor_scores: Scores for impostor matches (different identity)
            n_points: Number of threshold points

        Returns:
            (thresholds, far, frr)
        """
        min_score = min(genuine_scores.min(), impostor_scores.min())
        max_score = max(genuine_scores.max(), impostor_scores.max())
        thresholds = np.linspace(max_score, min_score, n_points)

        far = []
        frr = []

        for thresh in thresholds:
            # FAR = impostors accepted / total impostors
            n_false_accept = np.sum(impostor_scores >= thresh)
            far_rate = n_false_accept / len(impostor_scores) if len(impostor_scores) > 0 else 0

            # FRR = genuine rejected / total genuine
            n_false_reject = np.sum(genuine_scores < thresh)
            frr_rate = n_false_reject / len(genuine_scores) if len(genuine_scores) > 0 else 0

            far.append(far_rate)
            frr.append(frr_rate)

        return thresholds, np.array(far), np.array(frr)

    def compute_eer(
        self,
        genuine_scores: np.ndarray,
        impostor_scores: np.ndarray,
        n_points: int = 100
    ) -> Tuple[float, float]:
        """
        Compute Equal Error Rate (EER).

        EER adalah titik dimana FAR = FRR.

        Returns:
            (eer, eer_threshold)
        """
        thresholds, far, frr = self.compute_roc_curve(
            genuine_scores, impostor_scores, n_points
        )

        diff = np.abs(far - frr)
        eer_idx = np.argmin(diff)
        eer = (far[eer_idx] + frr[eer_idx]) / 2
        eer_threshold = thresholds[eer_idx]

        return float(eer), float(eer_threshold)

    def find_optimal_threshold(
        self,
        genuine_scores: np.ndarray,
        impostor_scores: np.ndarray
    ) -> Tuple[float, float, float, float]:
        """
        Find optimal threshold using EER method.

        Returns:
            (threshold, far, frr, eer)
        """
        eer, threshold = self.compute_eer(genuine_scores, impostor_scores)

        # Find FAR/FRR at this threshold
        thresholds, far, frr = self.compute_roc_curve(genuine_scores, impostor_scores)
        idx = np.argmin(np.abs(thresholds - threshold))

        return threshold, far[idx], frr[idx], eer

    def calibrate(
        self,
        genuine_scores: List[float],
        impostor_scores: List[float]
    ) -> CalibrationResult:
        """
        Calibrate threshold using validation data.

        Args:
            genuine_scores: List of similarity scores for genuine matches
            impostor_scores: List of similarity scores for impostor matches

        Returns:
            CalibrationResult
        """
        genuine = np.array(genuine_scores)
        impostor = np.array(impostor_scores)

        if len(genuine) < 10 or len(impostor) < 10:
            log.warning(f"[Calibrator] Insufficient data: {len(genuine)} genuine, {len(impostor)} impostor")
            self.calibration = CalibrationResult(
                optimal_threshold=self.config['initial_threshold'],
                eer_threshold=self.config['initial_threshold'],
                eer=0.0,
                far_at_optimal=0.0,
                frr_at_optimal=0.0,
                roc_points=0,
                calibration_date=""
            )
            return self.calibration

        log.info(f"[Calibrator] Calibrating with {len(genuine)} genuine, {len(impostor)} impostor...")

        threshold, far, frr, eer = self.find_optimal_threshold(genuine, impostor)

        # Clamp the threshold to the operating range supported by the
        # score-level matcher, then recompute FAR/FRR at the clamped value.
        min_th = 0.35
        max_th = 0.65
        threshold = np.clip(threshold, min_th, max_th)

        eer, eer_thresh = self.compute_eer(genuine, impostor)
        eer_thresh = np.clip(eer_thresh, min_th, max_th)

        far_at_threshold = float(np.mean(impostor >= threshold))
        frr_at_threshold = float(np.mean(genuine < threshold))

        self.calibration = CalibrationResult(
            optimal_threshold=float(threshold),
            eer_threshold=float(eer_thresh),
            eer=float(eer),
            far_at_optimal=far_at_threshold,
            frr_at_optimal=frr_at_threshold,
            roc_points=len(genuine) + len(impostor),
            calibration_date=str(np.datetime64('now'))
        )

        self._save_calibration()

        log.info(f"[Calibrator] Result:")
        log.info(f"  Threshold: {threshold:.4f}")
        log.info(f"  EER: {eer:.4f} ({eer*100:.2f}%)")

        return self.calibration

    def get_threshold(self) -> float:
        """
        Get recognition threshold.

        Revisi: Tidak ada dynamic adjustment
        - Quality sudah dipakai di Score-Level Fusion
        - Threshold tetap untuk semua kualitas wajah

        Returns:
            Threshold value
        """
        if self.calibration is None:
            return self.config['initial_threshold']
        return self.calibration.optimal_threshold

    def get_threshold_description(self) -> str:
        """
        Get scientific description for thesis/skripsi.

        Returns:
            Description string
        """
        if self.calibration is None:
            return (
                f"Threshold ditetapkan pada nilai awal {self.config['initial_threshold']:.2f}. "
                f"Rekomendasi: lakukan kalibrasi dengan data validasi menggunakan "
                f"ROC Curve dan Equal Error Rate (EER)."
            )

        return (
            f"Threshold diperoleh melalui proses kalibrasi menggunakan ROC Curve "
            f"dan Equal Error Rate (EER) pada data validasi ({self.calibration.roc_points} pasangan). "
            f"Threshold optimal: {self.calibration.optimal_threshold:.4f}, "
            f"EER: {self.calibration.eer:.4f} ({self.calibration.eer*100:.2f}%), "
            f"FAR: {self.calibration.far_at_optimal:.4f}, "
            f"FRR: {self.calibration.frr_at_optimal:.4f}."
        )

    def calibrate_from_gallery(
        self,
        gallery,
        _augmentation=None,
        _lbph_extractor=None,
        _mobile_extractor=None
    ) -> Optional[CalibrationResult]:
        """
        Auto-calibrate threshold from gallery using genuine and impostor scores.

        Revisi Akurasi v3: Automatic calibration from enrolled identities.

        Genuine scores: similarity between template vs augmented versions
                       from photos of the SAME enrolled identity.

        Impostor scores: similarity between templates of DIFFERENT identities
                        in the gallery.

        Args:
            gallery: FAISSGallery instance with enrolled identities
            _augmentation: Reserved for future use (generate genuine scores from original photos)
            _lbph_extractor: Reserved for future use
            _mobile_extractor: Reserved for future use

        Returns:
            CalibrationResult or None if insufficient data
        """
        if gallery.get_identity_count() < 2:
            log.warning("[Calibrator] Need at least 2 identities for auto-calibration")
            return None

        log.info("[Calibrator] Starting auto-calibration from gallery...")

        genuine_scores = []
        impostor_scores = []

        identity_list = gallery.list_identities()

        # Generate genuine and impostor scores
        for nim in identity_list:
            # Get identity info to find enrollment photos (stored in metadata)
            meta = gallery.get_identity_info(nim)
            if meta is None:
                continue

            # Get stored templates
            cnn_template = gallery.identities.get(nim)
            lbph_templates = gallery.lbph_gallery.get(nim, [])

            if cnn_template is None or len(lbph_templates) == 0:
                continue

            # Generate augmented versions to compute genuine scores
            # Note: In real scenario, we'd use the original enrollment photos
            # For auto-calibration, we use stored LBPH templates to compute impostor scores

            # IMPOSTOR SCORES: CNN similarity between different identities
            for other_nim in identity_list:
                if other_nim == nim:
                    continue
                other_template = gallery.identities.get(other_nim)
                if other_template is not None:
                    # CNN cosine similarity (dot product)
                    cnn_sim = float(np.dot(cnn_template, other_template))
                    impostor_scores.append(cnn_sim)

            # IMPOSTOR SCORES: LBPH histogram intersection between different identities
            other_lbph = gallery.lbph_gallery.get(other_nim, [])
            if len(other_lbph) > 0:
                # Use first LBPH template for impostor comparison
                other_lbph_template = other_lbph[0]
                for lbph_t in lbph_templates:
                    # L1-normalize both
                    lbph_t_norm = lbph_t / (lbph_t.sum() + 1e-7)
                    other_norm = other_lbph_template / (other_lbph_template.sum() + 1e-7)
                    # Histogram intersection
                    lbph_sim = float(np.sum(np.minimum(lbph_t_norm, other_norm)))
                    impostor_scores.append(lbph_sim)

            # GENUINE SCORES: We need original enrollment photos
            # For auto-calibration without original photos, we estimate genuine scores
            # based on template consistency (within-identity similarity)
            # This is an approximation - ideally we'd have original photos

            # For now, estimate genuine scores as high similarity within same identity
            # Using stored LBPH templates (they should be similar if from same person)
            if len(lbph_templates) > 1:
                for i in range(len(lbph_templates)):
                    for j in range(i + 1, len(lbph_templates)):
                        t1 = lbph_templates[i]
                        t2 = lbph_templates[j]
                        # L1-normalize
                        t1_norm = t1 / (t1.sum() + 1e-7)
                        t2_norm = t2 / (t2.sum() + 1e-7)
                        # Histogram intersection (within identity should be high)
                        lbph_sim = float(np.sum(np.minimum(t1_norm, t2_norm)))
                        genuine_scores.append(lbph_sim)

        # Check if we have enough data
        min_samples = 10
        if len(genuine_scores) < min_samples or len(impostor_scores) < min_samples:
            log.warning(f"[Calibrator] Insufficient calibration data: "
                       f"genuine={len(genuine_scores)}, impostor={len(impostor_scores)}")
            return None

        # Compute final scores (fused for comparison)
        # For simplicity, we use CNN scores for threshold calibration
        # since CNN is dominant (80-95%)
        final_genuine = np.array(genuine_scores)
        final_impostor = np.array(impostor_scores)

        # Filter outliers (keep 99th percentile)
        if len(final_genuine) > 10:
            threshold_99 = np.percentile(final_genuine, 99)
            final_genuine = final_genuine[final_genuine <= threshold_99]

        if len(final_impostor) > 10:
            threshold_1 = np.percentile(final_impostor, 1)
            final_impostor = final_impostor[final_impostor >= threshold_1]

        log.info(f"[Calibrator] Using {len(final_genuine)} genuine, "
                f"{len(final_impostor)} impostor scores")

        # Calibrate using the collected scores
        return self.calibrate(final_genuine.tolist(), final_impostor.tolist())


def generate_synthetic_validation_data(
    n_identities: int = 50,
    n_genuine_per_id: int = 5,
    n_impostor_per_id: int = 20
) -> Tuple[List[float], List[float]]:
    """Generate synthetic validation data."""
    genuine_scores = []
    impostor_scores = []

    for _ in range(n_identities * n_genuine_per_id):
        score = np.random.normal(0.75, 0.1)
        score = np.clip(score, 0.5, 1.0)
        genuine_scores.append(score)

    for _ in range(n_identities * n_impostor_per_id):
        score = np.random.normal(0.25, 0.1)
        score = np.clip(score, 0.0, 0.5)
        impostor_scores.append(score)

    return genuine_scores, impostor_scores


# Test function
if __name__ == "__main__":
    log.info("Testing ThresholdCalibrator (Revisi)...")

    calibrator = ThresholdCalibrator()

    # Generate synthetic data
    genuine, impostor = generate_synthetic_validation_data(
        n_identities=100,
        n_genuine_per_id=10,
        n_impostor_per_id=50
    )

    log.info(f"Generated {len(genuine)} genuine, {len(impostor)} impostor scores")

    # Calibrate
    result = calibrator.calibrate(genuine, impostor)

    # Description
    description = calibrator.get_threshold_description()
    log.info(f"\nDescription:\n{description}")

    # Test (no dynamic adjustment anymore)
    log.info(f"\nThreshold: {calibrator.get_threshold():.4f}")
