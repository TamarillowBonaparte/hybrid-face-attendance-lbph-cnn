"""
Quality-Aware Engine for Face Recognition System
================================================
Modul komprehensif untuk Penilaian Kualitas Wajah (Face Image Quality Assessment / FIQA),
Penyaringan Kualitas (Quality Gatekeeper), Fusi Skor Sadar-Kualitas (Quality-Aware Score Fusion),
serta Ambang Batas Adaptif (Quality-Aware Adaptive Thresholding).

Didesain selaras dengan standar biometrika ISO/IEC 29794-5 dan NIST FRVT,
terintegrasi langsung dengan pipeline ModelBaru (YuNet + MobileFaceNet + LBPH).

Author: Skripsi 2026
"""

import math
import logging
from typing import Dict, Tuple, Optional, Any, List
from dataclasses import dataclass, field
import numpy as np
import cv2

log = logging.getLogger(__name__)


@dataclass
class QualityMetrics:
    """Struktur data detail untuk seluruh metrik kualitas wajah."""
    blur_score: float              # Skor ketajaman [0, 1]
    blur_variance: float           # Nilai varians Laplacian asli
    blur_threshold: float          # Threshold Laplacian adaptif yang digunakan
    blur_ok: bool                  # Status ketajaman

    brightness_score: float        # Skor pencahayaan [0, 1]
    mean_brightness: float         # Rata-rata intensitas piksel (0 - 255)
    brightness_ok: bool            # Status pencahayaan

    pose_score: float              # Skor simetri / pose [0, 1]
    yaw_deg: float                 # Estimasi sudut yaw (derajat)
    pitch_deg: float               # Estimasi sudut pitch (derajat)
    pose_ok: bool                  # Status pose

    resolution_score: float        # Skor resolusi / scale [0, 1]
    ipd_pixels: float              # Inter-Pupillary Distance (jarak antar pupil/mata)
    resolution_ok: bool            # Status resolusi

    quality_score: float           # Unified Quality Score Q in [0, 1]
    status: str                    # 'good', 'acceptable', 'poor'
    metriks_passed: int            # Jumlah metrik lolos (0 - 4)
    feedback_messages: List[str] = field(default_factory=list)  # Instruksi saran untuk user


@dataclass
class FusionResult:
    """Struktur data hasil Quality-Aware Score Fusion."""
    fused_score: float             # Skor kemiripan gabungan akhir [0, 1]
    w_cnn: float                   # Bobot yang dialokasikan untuk CNN
    w_lbph: float                  # Bobot yang dialokasikan untuk LBPH
    cnn_raw: float                 # Skor kemiripan mentah CNN
    lbph_raw: float                # Skor kemiripan mentah LBPH
    cnn_norm: float                # Skor CNN setelah normalisasi sigmoid probabilitas
    lbph_norm: float               # Skor LBPH setelah normalisasi sigmoid probabilitas
    quality_score: float           # Kualitas citra yang digunakan sebagai acuan
    adaptive_threshold: float      # Ambang batas keputusan yang disesuaikan kualitas
    is_recognized: bool            # Keputusan akhir verifikasi / rekognisi


class QualityAwareEngine:
    """
    Engine terpadu untuk Quality-Aware Face Recognition.
    
    Menyediakan fungsionalitas:
    1. Multi-metric Quality Assessment (Blur adaptif, Brightness, Pose, Resolusi)
    2. Quality Gatekeeper (Penyaring kelayakan enroll & rekognisi)
    3. Dynamic Weight Allocation (Alokasi bobot multimodal berdasarkan kualitas)
    4. Sigmoid-Quality Modulated Score Fusion (Fusi skor non-linear terkalibrasi)
    5. Adaptive Decision Thresholding (Penyesuaian batas keputusan berbasis kualitas)
    """

    def __init__(
        self,
        # Konfigurasi Blur (Laplacian)
        blur_base_threshold: float = 30.0,
        # Konfigurasi Brightness
        brightness_min: float = 20.0,
        brightness_max: float = 230.0,
        brightness_optimal: float = 125.0,
        # Konfigurasi Pose (5 landmark)
        yaw_threshold: float = 15.0,
        pitch_threshold: float = 15.0,
        # Konfigurasi Resolusi (Inter-pupillary distance)
        ipd_min_threshold: float = 28.0,
        # Konfigurasi Gatekeeper
        enrollment_threshold: float = 0.40,
        recognition_threshold: float = 0.50,
        # Konfigurasi Bobot Fusi
        base_w_cnn: float = 0.75,
        alpha_cnn: float = 0.20,
        w_cnn_min: float = 0.60,
        w_cnn_max: float = 0.90,
        # Konfigurasi Ambang Batas Verifikasi
        base_verification_threshold: float = 0.58
    ):
        self.blur_base_threshold = blur_base_threshold
        self.brightness_min = brightness_min
        self.brightness_max = brightness_max
        self.brightness_optimal = brightness_optimal
        self.yaw_threshold = yaw_threshold
        self.pitch_threshold = pitch_threshold
        self.ipd_min_threshold = ipd_min_threshold
        self.enrollment_threshold = enrollment_threshold
        self.recognition_threshold = recognition_threshold
        self.base_w_cnn = base_w_cnn
        self.alpha_cnn = alpha_cnn
        self.w_cnn_min = w_cnn_min
        self.w_cnn_max = w_cnn_max
        self.base_verification_threshold = base_verification_threshold

        # Geometri acuan standar wajah frontal (reference points 112x112)
        # Digunakan untuk menghitung deviasi pitch anatomis yang invarian
        self.ref_points = np.array([
            [38.2946, 51.6963],   # Mata kiri
            [73.5318, 51.5014],   # Mata kanan
            [56.0252, 71.7366],   # Hidung
            [41.5493, 92.3655],   # Sudut mulut kiri
            [70.7299, 92.2041]    # Sudut mulut kanan
        ], dtype=np.float32)

        ref_eye_dist = np.linalg.norm(self.ref_points[1] - self.ref_points[0])
        ref_eye_mid_y = (self.ref_points[0][1] + self.ref_points[1][1]) / 2.0
        ref_mouth_mid_y = (self.ref_points[3][1] + self.ref_points[4][1]) / 2.0

        self.ref_eye_dist = ref_eye_dist
        self.ref_eye_nose_ratio = (self.ref_points[2][1] - ref_eye_mid_y) / ref_eye_dist
        self.ref_nose_mouth_ratio = (ref_mouth_mid_y - self.ref_points[2][1]) / ref_eye_dist

    # =========================================================================
    # 1. FACE IMAGE QUALITY ASSESSMENT (FIQA)
    # =========================================================================

    def assess_blur(self, face: np.ndarray, brightness_hint: Optional[float] = None) -> Tuple[bool, float, float, float]:
        """
        Menilai ketajaman citra wajah menggunakan Laplacian Variance dengan
        Threshold Adaptif berbasis intensitas pencahayaan lokal.
        """
        if len(face.shape) == 3:
            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        else:
            gray = face.copy()

        # Normalisasi ukuran untuk komputasi Laplacian yang konsisten
        gray_resized = cv2.resize(gray, (128, 128))
        variance = float(cv2.Laplacian(gray_resized, cv2.CV_64F).var())

        # Gunakan brightness hint jika disediakan, atau hitung mean piksel
        b = brightness_hint if brightness_hint is not None else float(np.mean(gray))

        # Threshold adaptif: pada kondisi gelap, kontras lokal menurun alami
        if b < 40.0:
            threshold = 12.0
        elif b < 60.0:
            threshold = 18.0
        elif b < 80.0:
            threshold = 22.0
        else:
            threshold = self.blur_base_threshold  # Default 30.0

        if variance < threshold:
            score = float(np.clip(variance / max(threshold, 1e-5), 0.0, 1.0))
            is_ok = False
        else:
            score = float(min(1.0, variance / max(threshold * 2.0, 1e-5)))
            is_ok = True

        return is_ok, score, variance, threshold

    def assess_brightness(self, face: np.ndarray) -> Tuple[bool, float, float]:
        """
        Menilai tingkat pencahayaan wajah dengan toleransi kondisi indoor (smooth curve).
        """
        if len(face.shape) == 3:
            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        else:
            gray = face.copy()

        mean_val = float(np.mean(gray))

        if mean_val < self.brightness_min:
            # Underexposure / low-light: curve bertahap (tidak langsung 0)
            score = 0.3 + 0.7 * (mean_val / max(self.brightness_min, 1e-5))
            score = float(np.clip(score, 0.0, 1.0))
            is_ok = False
        elif mean_val > self.brightness_max:
            # Overexposure
            score = float(np.clip(self.brightness_max / max(mean_val, 1e-5), 0.0, 1.0))
            is_ok = False
        else:
            # Optimal zone
            half_range = (self.brightness_max - self.brightness_min) / 2.0
            deviation = abs(mean_val - self.brightness_optimal) / max(half_range, 1e-5)
            score = float(max(0.70, 1.0 - 0.30 * deviation))
            is_ok = True

        return is_ok, score, mean_val

    def assess_pose(self, landmarks: Optional[np.ndarray]) -> Tuple[bool, float, float, float]:
        """
        Menilai pose kepala (sudut rotasi horizontal yaw & rotasi vertikal pitch)
        menggunakan 5 titik facial landmark relatif terhadap template frontal.
        """
        if landmarks is None or len(landmarks) < 5:
            # Fallback jika landmark tidak terdeteksi
            return True, 0.70, 0.0, 0.0

        left_eye = landmarks[0]
        right_eye = landmarks[1]
        nose = landmarks[2]
        left_mouth = landmarks[3]
        right_mouth = landmarks[4]

        eye_dist = float(np.linalg.norm(right_eye - left_eye))
        if eye_dist < 1.0:
            return True, 0.70, 0.0, 0.0

        eye_mid = (left_eye + right_eye) / 2.0
        mouth_mid = (left_mouth + right_mouth) / 2.0

        # Yaw (Rotasi horizontal)
        yaw = float(abs(nose[0] - eye_mid[0]) / eye_dist * 45.0)

        # Pitch (Rotasi vertikal menggunakan deviasi rasio anatomis)
        eye_nose_ratio = float((nose[1] - eye_mid[1]) / eye_dist)
        nose_mouth_ratio = float((mouth_mid[1] - nose[1]) / eye_dist)

        dev_eye_nose = abs(eye_nose_ratio - self.ref_eye_nose_ratio)
        dev_nose_mouth = abs(nose_mouth_ratio - self.ref_nose_mouth_ratio)
        pitch = float((dev_eye_nose + dev_nose_mouth) * 22.5)

        yaw_score = max(0.0, 1.0 - yaw / self.yaw_threshold)
        pitch_score = max(0.0, 1.0 - pitch / self.pitch_threshold)
        pose_score = float((yaw_score + pitch_score) / 2.0)

        is_ok = (yaw <= self.yaw_threshold) and (pitch <= self.pitch_threshold)
        return is_ok, pose_score, yaw, pitch

    def assess_resolution(self, landmarks: Optional[np.ndarray], face_shape: Tuple[int, int]) -> Tuple[bool, float, float]:
        """
        Menilai resolusi wajah berdasarkan Inter-Pupillary Distance (IPD) dalam piksel.
        Standar ISO/IEC 29794-5 mensyaratkan IPD memadai (minimal ~30 piksel untuk rekognisi andal).
        """
        if landmarks is not None and len(landmarks) >= 2:
            ipd = float(np.linalg.norm(landmarks[1] - landmarks[0]))
        else:
            ipd = float(face_shape[1] * 0.35)  # Estimasi 35% lebar crop wajah

        if ipd >= self.ipd_min_threshold * 1.5:
            score = 1.0
            is_ok = True
        elif ipd >= self.ipd_min_threshold:
            score = 0.75 + 0.25 * ((ipd - self.ipd_min_threshold) / (self.ipd_min_threshold * 0.5))
            is_ok = True
        else:
            score = float(max(0.2, ipd / max(self.ipd_min_threshold, 1e-5)))
            is_ok = False

        return is_ok, float(np.clip(score, 0.0, 1.0)), ipd

    def assess(self, face: np.ndarray, landmarks: Optional[np.ndarray] = None) -> QualityMetrics:
        """
        Mengevaluasi seluruh metrik kualitas secara holistik.
        
        Formula skor gabungan:
        Q = 0.35 * blur_score + 0.30 * brightness_score + 0.25 * pose_score + 0.10 * resolution_score
        """
        # 1. Brightness
        b_ok, b_score, mean_b = self.assess_brightness(face)

        # 2. Blur (dengan brightness hint)
        blur_ok, blur_score, variance, blur_th = self.assess_blur(face, brightness_hint=mean_b)

        # 3. Pose
        pose_ok, pose_score, yaw, pitch = self.assess_pose(landmarks)

        # 4. Resolution
        res_ok, res_score, ipd = self.assess_resolution(landmarks, face.shape[:2])

        # Bobot komposit kualitas
        w_blur = 0.35
        w_bright = 0.30
        w_pose = 0.25
        w_res = 0.10

        composite_q = (
            w_blur * blur_score +
            w_bright * b_score +
            w_pose * pose_score +
            w_res * res_score
        )
        composite_q = float(np.clip(composite_q, 0.0, 1.0))

        metriks_passed = int(blur_ok) + int(b_ok) + int(pose_ok) + int(res_ok)

        # Penentuan status kategori kualitas
        if metriks_passed >= 3 and composite_q >= 0.60:
            status = 'good'
        elif metriks_passed >= 2 and composite_q >= 0.40:
            status = 'acceptable'
        else:
            status = 'poor'

        # Generate panduan instruksi (feedback) untuk pengguna
        feedback = []
        if not blur_ok:
            feedback.append("Gambar buram atau fokus lensa tidak tajam. Mohon stabilkan kamera.")
        if mean_b < self.brightness_min:
            feedback.append("Pencahayaan terlalu redup / gelap. Mohon hadapkan wajah ke arah cahaya.")
        elif mean_b > self.brightness_max:
            feedback.append("Pencahayaan terlalu terang / backlight (overexposed).")
        if not pose_ok:
            if yaw > self.yaw_threshold:
                feedback.append(f"Wajah menoleh ke samping ({yaw:.1f}°). Mohon hadap lurus ke kamera.")
            if pitch > self.pitch_threshold:
                feedback.append(f"Wajah menunduk / menengadah ({pitch:.1f}°). Mohon pandang sejajar kamera.")
        if not res_ok:
            feedback.append("Posisi wajah terlalu jauh dari kamera. Mohon dekati layar.")

        if not feedback:
            feedback.append("Kualitas wajah prima, siap untuk verifikasi.")

        return QualityMetrics(
            blur_score=blur_score,
            blur_variance=variance,
            blur_threshold=blur_th,
            blur_ok=blur_ok,
            brightness_score=b_score,
            mean_brightness=mean_b,
            brightness_ok=b_ok,
            pose_score=pose_score,
            yaw_deg=yaw,
            pitch_deg=pitch,
            pose_ok=pose_ok,
            resolution_score=res_score,
            ipd_pixels=ipd,
            resolution_ok=res_ok,
            quality_score=composite_q,
            status=status,
            metriks_passed=metriks_passed,
            feedback_messages=feedback
        )

    # =========================================================================
    # 2. QUALITY GATEKEEPER
    # =========================================================================

    def check_gatekeeper(self, quality: QualityMetrics, mode: str = 'recognition') -> Tuple[bool, str]:
        """
        Memeriksa apakah citra wajah memenuhi standar ambang batas kualitas minimum.
        
        Args:
            quality: Objek QualityMetrics hasil evaluasi
            mode: 'enrollment' (Q >= 0.40) atau 'recognition' (Q >= 0.50)
        """
        required_th = self.enrollment_threshold if mode == 'enrollment' else self.recognition_threshold
        if quality.quality_score >= required_th:
            return True, f"Lolos Quality Gatekeeper ({quality.status.upper()} - Q={quality.quality_score:.2f})"
        else:
            reasons = "; ".join(quality.feedback_messages)
            return False, f"Ditolak Quality Gatekeeper (Q={quality.quality_score:.2f} < {required_th:.2f}). Alasan: {reasons}"

    # =========================================================================
    # 3. QUALITY-AWARE SCORE FUSION & DYNAMIC WEIGHTING
    # =========================================================================

    def compute_quality_weights(self, quality_score: float) -> Tuple[float, float]:
        """
        Menghitung alokasi bobot multimodal secara dinamis berdasarkan skor kualitas citra Q.
        
        Formula:
            w_CNN  = clip(0.75 + 0.20 * (Q - 0.50), min=0.60, max=0.90)
            w_LBPH = 1.0 - w_CNN
            
        Intuisi Biometrik:
        - Jika citra sangat tajam dan prima (Q=1.00), CNN diberi bobot dominan (0.90).
        - Jika citra terdegradasi (Q=0.20), embedding semantik CNN rentan terdistorsi,
          sehingga LBPH (tekstur lokal mikro) dinaikkan bobotnya hingga 0.40 sebagai kompensator.
        """
        q_clamped = max(0.0, min(1.0, quality_score))
        w_cnn = self.base_w_cnn + self.alpha_cnn * (q_clamped - 0.50)
        w_cnn = float(np.clip(w_cnn, self.w_cnn_min, self.w_cnn_max))
        w_lbph = float(round(1.0 - w_cnn, 4))
        return w_cnn, w_lbph

    def compute_adaptive_threshold(self, quality_score: float) -> float:
        """
        Menghitung ambang batas verifikasi adaptif berdasarkan kualitas citra:
            tau(Q) = tau_base + delta_tau * (1.0 - Q) * 0.10
        Menghindari lonjakan False Acceptance Rate (FAR) ketika citra input berkualitas rendah.
        """
        q_clamped = max(0.0, min(1.0, quality_score))
        delta = (1.0 - q_clamped) * 0.05
        return float(self.base_verification_threshold + delta)

    def fuse(
        self,
        cnn_similarity: float,
        lbph_similarity: float,
        quality_score: float,
        use_sigmoid_normalization: bool = True
    ) -> FusionResult:
        """
        Melakukan Quality-Aware Score-Level Fusion.
        
        Args:
            cnn_similarity: Cosine similarity dari MobileFaceNet [-1.0, 1.0]
            lbph_similarity: Histogram intersection dari LBPH [0.0, 1.0]
            quality_score: Kualitas citra wajah [0.0, 1.0]
            use_sigmoid_normalization: Menggunakan pemetaan sigmoid non-linear
        """
        w_cnn, w_lbph = self.compute_quality_weights(quality_score)
        adaptive_th = self.compute_adaptive_threshold(quality_score)

        if not use_sigmoid_normalization:
            # Linear fusion sederhana
            fused_score = w_cnn * cnn_similarity + w_lbph * lbph_similarity
            cnn_norm = cnn_similarity
            lbph_norm = lbph_similarity
        else:
            # Sigmoid-normalized fusion (Revisi v4 Final)
            # Menyelaraskan distribusi skor CNN (center 0.45) dan LBPH (center 0.65)
            k = 12.0
            cnn_center = 0.45
            lbph_center = 0.65

            cnn_norm = 1.0 / (1.0 + math.exp(-k * (cnn_similarity - cnn_center)))
            lbph_norm = 1.0 / (1.0 + math.exp(-k * (lbph_similarity - lbph_center)))

            # Penyesuaian halus bobot berdasarkan kualitas & konfidensi CNN
            if cnn_norm >= 0.75:
                w_cnn_adj = min(self.w_cnn_max, w_cnn + 0.05)
            elif cnn_norm < 0.40:
                w_cnn_adj = max(self.w_cnn_min, w_cnn - 0.05)
            else:
                w_cnn_adj = w_cnn

            w_lbph_adj = 1.0 - w_cnn_adj

            fused_norm = w_cnn_adj * cnn_norm + w_lbph_adj * lbph_norm
            # Rescale ke domain operasional [0.40, 1.00]
            fused_score = 0.40 + fused_norm * 0.60
            w_cnn, w_lbph = w_cnn_adj, w_lbph_adj

        is_recognized = (fused_score >= adaptive_th)

        return FusionResult(
            fused_score=fused_score,
            w_cnn=w_cnn,
            w_lbph=w_lbph,
            cnn_raw=cnn_similarity,
            lbph_raw=lbph_similarity,
            cnn_norm=cnn_norm,
            lbph_norm=lbph_norm,
            quality_score=quality_score,
            adaptive_threshold=adaptive_th,
            is_recognized=is_recognized
        )


if __name__ == "__main__":
    # Self-test sederhana
    engine = QualityAwareEngine()
    print("Quality-Aware Engine initialized successfully!")
    w_c, w_l = engine.compute_quality_weights(0.85)
    print(f"Sample weights at Q=0.85 -> w_CNN: {w_c:.2f}, w_LBPH: {w_l:.2f}")
    w_c, w_l = engine.compute_quality_weights(0.25)
    print(f"Sample weights at Q=0.25 -> w_CNN: {w_c:.2f}, w_LBPH: {w_l:.2f}")
