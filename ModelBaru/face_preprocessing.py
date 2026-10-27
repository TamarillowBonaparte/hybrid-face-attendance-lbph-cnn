"""
Face Preprocessing Module (Revisi)
================================
Contains:
1. FaceAlignment - Using YuNet 5 landmarks for affine transformation
2. FaceQualityAssessment - Simplified to 3 metrics (Blur, Brightness, Pose)

Revisi: Quality assessment disederhanakan menjadi 3 metrik saja
- Blur (Variance of Laplacian)
- Brightness (Mean pixel)
- Pose (Yaw/Pitch dari landmark)

Author: Skripsi 2026
"""

import cv2
import numpy as np
from typing import Tuple, Dict, Optional
import logging

from config import (
    ALIGNMENT_CONFIG, QUALITY_CONFIG, DETECTION_CONFIG,
    YUNET_MODEL_PATH
)

log = logging.getLogger(__name__)


class FaceAlignment:
    """
    Face Alignment using YuNet's 5 facial landmarks.

    Uses 5-point similarity transform (cv2.estimateAffinePartial2D) for better
    alignment, matching how ArcFace models are trained with InsightFace.

    YuNet outputs 5 landmarks:
    0: left_eye
    1: right_eye
    2: nose
    3: left_mouth
    4: right_mouth
    """

    def __init__(self, target_size: int = None):
        self.target_size = target_size or ALIGNMENT_CONFIG['target_size']
        self.reference_points = ALIGNMENT_CONFIG['reference_points'].copy()
        scale = self.target_size / ALIGNMENT_CONFIG['reference_scale']
        self.reference_points *= scale

    def align_face(
        self,
        face_crop: np.ndarray,
        landmarks: np.ndarray
    ) -> Tuple[np.ndarray, Dict]:
        """
        Align face using 5-point similarity transform.

        Uses cv2.estimateAffinePartial2D for better alignment that matches
        how ArcFace/InsightFace models are trained.

        Args:
            face_crop: Original face crop (BGR)
            landmarks: 5 facial landmarks

        Returns:
            Tuple of (aligned_face, alignment_info)
        """
        if landmarks is None or len(landmarks) < 5:
            return face_crop, {'aligned': False}

        try:
            # Use all 5 landmarks for better alignment
            src_points = landmarks.astype(np.float64)

            # 5-point similarity transform using RANSAC for robustness
            # estimateAffinePartial2D finds the optimal similarity transform
            # that best maps src_points to reference_points
            matrix, inliers = cv2.estimateAffinePartial2D(
                src_points,
                self.reference_points,
                method=cv2.RANSAC,
                ransacReprojThreshold=3.0
            )

            if matrix is None:
                return face_crop, {'aligned': False}

            aligned = cv2.warpAffine(
                face_crop,
                matrix,
                (self.target_size, self.target_size),
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_REFLECT
            )

            # Count inliers for quality assessment
            n_inliers = np.sum(inliers) if inliers is not None else 5
            alignment_quality = n_inliers / 5.0

            return aligned, {
                'aligned': True,
                'matrix': matrix,
                'inliers': int(n_inliers),
                'quality': alignment_quality
            }

        except Exception as e:
            log.warning(f"Alignment failed: {e}")
            return face_crop, {'aligned': False}


class FaceQualityAssessment:
    """
    Simplified Face Quality Assessment (3 Metrik).

    Revisi: Hanya 3 metrik untuk kemudahan validasi:
    1. Blur - Variance of Laplacian
    2. Brightness - Mean pixel intensity
    3. Pose - Yaw/Pitch dari landmark offset

    Formula Quality Score:
    Q = (blur_ok + brightness_ok + pose_ok) / 3
    Pass if Q >= 0.5 (minimal 2 dari 3 metrik bagus)
    """

    def __init__(self):
        self.config = QUALITY_CONFIG

    def assess_blur(self, face: np.ndarray, brightness_hint: float = None) -> Tuple[bool, float]:
        """
        Assess blur using Variance of Laplacian.

        Revisi Low-Light: Threshold adaptif berdasarkan kecerahan.
        Gambar gelap secara natural memiliki Laplacian variance lebih rendah
        karena kontras lokal memang lebih rendah — bukan berarti blur!
        Threshold diturunkan saat gelap agar wajah valid tidak ditolak.

        Args:
            face: Face crop
            brightness_hint: Mean brightness (opsional, untuk threshold adaptif)

        Returns:
            Tuple of (is_good, score)
        """
        if len(face.shape) == 3:
            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        else:
            gray = face

        gray = cv2.resize(gray, (128, 128))
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()

        # Revisi: threshold adaptif berdasarkan brightness
        # Saat gelap (mean < 60): threshold diturunkan ke 12 (dari 30)
        # Saat normal (mean >= 60): threshold tetap 30
        if brightness_hint is None:
            brightness_hint = float(np.mean(gray))

        if brightness_hint < 40:
            threshold = 12.0  # Sangat gelap: sangat toleran
        elif brightness_hint < 60:
            threshold = 18.0  # Gelap: toleran
        elif brightness_hint < 80:
            threshold = 22.0  # Agak gelap: sedikit toleran
        else:
            threshold = self.config['blur']['threshold']  # Normal: 30.0

        if variance < threshold:
            return False, variance / threshold  # 0-1 score
        else:
            return True, min(1.0, variance / (threshold * 2))

    def assess_brightness(self, face: np.ndarray) -> Tuple[bool, float]:
        """
        Assess brightness level.

        Revisi Low-Light: Score lebih smooth untuk kondisi indoor.
        Menggunakan curve yang lebih gradual agar skor tidak langsung 0
        saat kondisi gelap.

        Args:
            face: Face crop

        Returns:
            Tuple of (is_good, score)
        """
        if len(face.shape) == 3:
            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        else:
            gray = face

        mean_brightness = np.mean(gray)
        min_b = self.config['brightness']['min']  # 20 (revisi)
        max_b = self.config['brightness']['max']  # 230 (revisi)

        if mean_brightness < min_b or mean_brightness > max_b:
            # Score berdasarkan jarak ke range optimal
            if mean_brightness < min_b:
                # Low-light: score lebih smooth (tidak langsung 0)
                # Saat brightness=10 dengan min=20 → score = 0.5 (bukan 0.25)
                score = 0.3 + 0.7 * (mean_brightness / min_b)
            else:
                score = max_b / mean_brightness
            return False, float(max(0.0, min(1.0, score)))
        else:
            # Dalam range: score 1.0 di tengah, sedikit turun di pinggir
            optimal = (min_b + max_b) / 2
            deviation = abs(mean_brightness - optimal) / ((max_b - min_b) / 2)
            return True, float(max(0.7, 1.0 - 0.3 * deviation))

    def assess_pose(self, landmarks: np.ndarray = None) -> Tuple[bool, float]:
        """
        Assess head pose from landmarks.

        Args:
            landmarks: 5 facial landmarks

        Returns:
            Tuple of (is_good, score)
        """
        if landmarks is None or len(landmarks) < 5:
            return True, 0.7  # Unknown = assume good

        left_eye = landmarks[0]
        right_eye = landmarks[1]
        nose = landmarks[2]

        eye_dist = np.linalg.norm(right_eye - left_eye)
        if eye_dist < 1:
            return True, 0.7

        eye_mid = (left_eye + right_eye) / 2

        # Yaw: nose horizontal offset from the eye line.  This is a
        # scale-normalized proxy, so it remains meaningful for different
        # face-crop sizes.
        yaw = abs(nose[0] - eye_mid[0]) / eye_dist * 45

        # Pitch must not be computed from the absolute eye-to-nose distance.
        # On a normal frontal face the nose is naturally below the eyes, so
        # the old formula marked many frontal faces as strongly pitched.
        # Compare the observed ratio with the frontal reference geometry
        # instead.  This keeps the quality score about pose, not anatomy.
        mouth_mid = (landmarks[3] + landmarks[4]) / 2
        ref = ALIGNMENT_CONFIG['reference_points']
        ref_eye_dist = np.linalg.norm(ref[1] - ref[0])
        ref_eye_nose = (ref[2][1] - (ref[0][1] + ref[1][1]) / 2) / ref_eye_dist
        ref_nose_mouth = (ref[3][1] + ref[4][1]) / 2 - ref[2][1]
        ref_nose_mouth /= ref_eye_dist

        eye_nose = (nose[1] - eye_mid[1]) / eye_dist
        nose_mouth = (mouth_mid[1] - nose[1]) / eye_dist
        pitch = (abs(eye_nose - ref_eye_nose) +
                 abs(nose_mouth - ref_nose_mouth)) * 22.5

        yaw_th = self.config['pose']['yaw_threshold']
        pitch_th = self.config['pose']['pitch_threshold']

        # Score based on deviation
        yaw_score = max(0, 1 - yaw / yaw_th)
        pitch_score = max(0, 1 - pitch / pitch_th)

        is_good = yaw < yaw_th and pitch < pitch_th

        return is_good, (yaw_score + pitch_score) / 2

    def assess(
        self,
        face: np.ndarray,
        landmarks: np.ndarray = None
    ) -> Dict:
        """
        Comprehensive face quality assessment (3 metrik).

        Revisi Low-Light: brightness dihitung terlebih dahulu,
        lalu nilainya diteruskan ke assess_blur sebagai hint
        untuk menentukan threshold adaptif.

        Args:
            face: Face crop (BGR)
            landmarks: 5 facial landmarks (optional)

        Returns:
            Dictionary with quality scores
        """
        # Hitung brightness terlebih dahulu (sebagai hint untuk blur)
        brightness_ok, brightness_score = self.assess_brightness(face)

        # Hitung mean brightness untuk hint adaptif blur threshold
        if len(face.shape) == 3:
            gray_hint = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        else:
            gray_hint = face
        mean_brightness_hint = float(np.mean(gray_hint))

        # Blur assessment dengan hint brightness (threshold adaptif)
        blur_ok, blur_score = self.assess_blur(face, brightness_hint=mean_brightness_hint)

        pose_ok, pose_score = self.assess_pose(landmarks)

        # Calculate quality score
        # Q = rata-rata dari 3 metrik
        quality_score = (blur_score + brightness_score + pose_score) / 3

        # Determine status
        metriks_passed = sum([blur_ok, brightness_ok, pose_ok])

        if metriks_passed >= 2:
            status = 'good' if quality_score >= 0.6 else 'acceptable'
        else:
            status = 'poor'

        return {
            'blur': {
                'ok': blur_ok,
                'score': blur_score
            },
            'brightness': {
                'ok': brightness_ok,
                'score': brightness_score
            },
            'pose': {
                'ok': pose_ok,
                'score': pose_score
            },
            'quality_score': quality_score,
            'status': status,
            'metriks_passed': metriks_passed,
            'mean_brightness': mean_brightness_hint,  # Tambahan: untuk debug low-light
        }

    def meets_threshold(self, quality_results: Dict) -> bool:
        """Check if face meets quality threshold."""
        return quality_results['quality_score'] >= self.config.get('pass_threshold', 0.5)


class FacePreprocessor:
    """
    Unified Face Preprocessing Pipeline.
    """

    def __init__(self):
        self.detector = None
        self.haar = None
        self.alignment = FaceAlignment()
        self.quality = FaceQualityAssessment()
        self._load_detector()

    def _load_detector(self):
        """Load YuNet face detector."""
        if YUNET_MODEL_PATH.exists():
            try:
                self.detector = cv2.FaceDetectorYN.create(
                    str(YUNET_MODEL_PATH),
                    "",
                    (320, 320),
                    score_threshold=DETECTION_CONFIG['face_confidence_threshold'],
                    nms_threshold=DETECTION_CONFIG['face_nms_threshold'],
                    top_k=DETECTION_CONFIG['face_max_faces']
                )
                log.info("[Preprocessor] YuNet loaded")
            except Exception as e:
                log.warning(f"[Preprocessor] YuNet failed: {e}")
                self.detector = None

        # Haar is a conservative fallback for low-resolution or low-light
        # images where YuNet may return no candidate at all.  It is not used
        # when YuNet succeeds, so normal inference remains YuNet-based.
        haar_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        haar = cv2.CascadeClassifier(haar_path)
        if not haar.empty():
            self.haar = haar
            log.info('[Preprocessor] Haar fallback loaded')

    def detect_mask(self, aligned_face: np.ndarray) -> Tuple[bool, str, Dict]:
        """
        Deteksi apakah wajah pada citra aligned (112x112) tertutup masker
        atau memiliki oklusi pada area hidung & mulut.

        Metode: Analisis krominans kulit (YCrCb) dan fotometri warna pada
        daerah periokular atas (dahi/mata) vs daerah wajah bawah (hidung/mulut).

        Returns:
            Tuple[is_masked (bool), reason (str), metrics (dict)]
        """
        if aligned_face is None or aligned_face.shape[:2] != (112, 112):
            return False, "Wajah tidak valid", {}

        upper_roi = aligned_face[25:55, 25:87]
        lower_roi = aligned_face[65:105, 25:87]
        mouth_roi = aligned_face[80:105, 30:82]

        ycrcb_upper = cv2.cvtColor(upper_roi, cv2.COLOR_BGR2YCrCb)
        ycrcb_lower = cv2.cvtColor(lower_roi, cv2.COLOR_BGR2YCrCb)
        ycrcb_mouth = cv2.cvtColor(mouth_roi, cv2.COLOR_BGR2YCrCb)

        def compute_skin_ratio(ycrcb_img):
            cr = ycrcb_img[:, :, 1]
            cb = ycrcb_img[:, :, 2]
            # Rentang standar krominans kulit manusia: Cr in [133, 173], Cb in [77, 127]
            mask = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
            return float(np.mean(mask))

        skin_upper = compute_skin_ratio(ycrcb_upper)
        skin_lower = compute_skin_ratio(ycrcb_lower)
        skin_mouth = compute_skin_ratio(ycrcb_mouth)

        mean_upper = float(np.mean(upper_roi))
        mean_lower = float(np.mean(lower_roi))
        bright_ratio = mean_lower / (mean_upper + 1e-5)

        hsv_lower = cv2.cvtColor(lower_roi, cv2.COLOR_BGR2HSV)
        hsv_upper = cv2.cvtColor(upper_roi, cv2.COLOR_BGR2HSV)
        sat_lower = float(np.mean(hsv_lower[:, :, 1]))
        sat_upper = float(np.mean(hsv_upper[:, :, 1]))

        b_mean = float(np.mean(lower_roi[:, :, 0]))
        g_mean = float(np.mean(lower_roi[:, :, 1]))
        r_mean = float(np.mean(lower_roi[:, :, 2]))

        metrics = {
            'skin_upper': skin_upper,
            'skin_lower': skin_lower,
            'skin_mouth': skin_mouth,
            'bright_ratio': bright_ratio,
            'mean_lower': mean_lower,
            'sat_lower': sat_lower
        }

        # 1. Masker Gelap / Hitam (kain scuba / medis hitam)
        if skin_lower < 0.40 and (bright_ratio < 0.60 or mean_lower < 60.0):
            return True, "Terdeteksi masker gelap/hitam menutupi mulut dan hidung", metrics

        # 2. Masker Medis Biru / Hijau (surgical mask)
        if (b_mean > r_mean + 10 or g_mean > r_mean + 15) and skin_lower < 0.45:
            return True, "Terdeteksi masker medis biru/hijau menutupi mulut dan hidung", metrics

        # 3. Masker Putih / Abu-abu terang (achromatic mask)
        if sat_lower < 25.0 and sat_upper > 35.0 and skin_lower < 0.45:
            return True, "Terdeteksi masker putih/terang menutupi mulut dan hidung", metrics

        # 4. Oklusi Kulit Umum (Kain / masker motif lain pada area mulut)
        if skin_upper >= 0.50 and skin_mouth < 0.30:
            return True, "Area mulut dan hidung terhalang masker atau penutup wajah", metrics

        return False, "Wajah terbuka normal", metrics

    def detect_and_preprocess(
        self,
        image: np.ndarray,
        for_enrollment: bool = False
    ) -> Dict:
        """
        Full detection and preprocessing pipeline.

        Returns:
            Dictionary with face, aligned_face, landmarks, quality, ready status, is_masked
        """
        h, w = image.shape[:2]

        result = {
            'face': None,
            'aligned_face': None,
            'landmarks': None,
            'quality': None,
            'bbox': None,
            'ready': False,
            'detection_confidence': 0.0,
            'is_masked': False,
            'mask_reason': '',
            'mask_metrics': {}
        }

        # Face Detection with Multi-Scale fallback
        # ─────────────────────────────────────────────────────────────────
        # Close-up selfie photos (common from Android front camera) often
        # have faces filling >80% of the frame.  YuNet works best when
        # faces occupy 20-60% of the input.  When detection at native
        # resolution fails, we try progressively downscaled versions so
        # the face becomes proportionally smaller and detectable.
        # Coordinates are mapped back to the original image space.
        # ─────────────────────────────────────────────────────────────────
        if self.detector is not None:
            face_info = self._detect_face_multiscale(image)

            if face_info is not None:
                x, y, bw, bh = map(int, face_info[:4])
                conf = float(face_info[14])

                if bw >= DETECTION_CONFIG['min_face_size'] and conf >= DETECTION_CONFIG['face_confidence_threshold']:
                    # Crop with padding
                    pad = int(DETECTION_CONFIG['padding_ratio'] * min(bw, bh))
                    x1 = max(0, x - pad)
                    y1 = max(0, y - pad)
                    x2 = min(w, x + bw + pad)
                    y2 = min(h, y + bh + pad)

                    result['face'] = image[y1:y2, x1:x2]
                    result['bbox'] = (x1, y1, x2 - x1, y2 - y1)
                    result['detection_confidence'] = conf

                    # Extract landmarks from image coordinates and translate them
                    # into the padded face crop coordinate space before alignment.
                    landmarks_global = face_info[4:14].reshape(5, 2).astype(np.float64)
                    crop_offset = np.array([x1, y1], dtype=np.float64)
                    result['landmarks'] = landmarks_global - crop_offset

                    # Align face
                    aligned, align_info = self.alignment.align_face(
                        result['face'],
                        result['landmarks']
                    )
                    result['aligned_face'] = aligned

                    # Assess quality on the detected crop and its original
                    # landmarks.  The aligned image changes the coordinate
                    # system; using the old landmarks on that image makes
                    # pose scores inconsistent.
                    result['quality'] = self.quality.assess(
                        result['face'],
                        result['landmarks']
                    )

                    # Check for mask / occlusion on aligned face
                    is_masked, mask_reason, mask_metrics = self.detect_mask(result['aligned_face'])
                    result['is_masked'] = is_masked
                    result['mask_reason'] = mask_reason
                    result['mask_metrics'] = mask_metrics

                    if is_masked:
                        result['ready'] = False
                        if result['quality']:
                            result['quality']['status'] = 'masked'
                            result['quality']['mask_ok'] = False
                            result['quality']['quality_score'] = min(result['quality']['quality_score'], 0.20)
                            result['quality']['feedback_messages'] = [
                                "Wajah terdeteksi menggunakan masker. Harap lepas masker Anda terlebih dahulu!"
                            ]
                    else:
                        # Check if ready
                        threshold = 0.4 if for_enrollment else 0.5
                        result['ready'] = result['quality']['quality_score'] >= threshold

        # Fallback detection for difficult camera frames.  Haar does not
        # provide the five landmarks required for alignment, so the original
        # crop is used and pose quality receives the documented neutral score.
        if result['face'] is None and self.haar is not None:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            min_side = max(40, min(DETECTION_CONFIG['min_face_size'], min(h, w) // 8))
            haar_faces = self.haar.detectMultiScale(
                gray,
                scaleFactor=1.08,
                minNeighbors=4,
                minSize=(min_side, min_side),
            )
            if len(haar_faces) > 0:
                x, y, bw, bh = max(haar_faces, key=lambda box: box[2] * box[3])
                pad = int(DETECTION_CONFIG['padding_ratio'] * min(bw, bh))
                x1 = max(0, int(x - pad))
                y1 = max(0, int(y - pad))
                x2 = min(w, int(x + bw + pad))
                y2 = min(h, int(y + bh + pad))
                result['face'] = image[y1:y2, x1:x2]
                result['bbox'] = (x1, y1, x2 - x1, y2 - y1)
                result['detection_confidence'] = 0.0
                result['quality'] = self.quality.assess(result['face'], None)
                threshold = 0.4 if for_enrollment else 0.5
                result['ready'] = result['quality']['quality_score'] >= threshold

        return result

    def _detect_face_multiscale(self, image: np.ndarray):
        """
        Multi-scale face detection using YuNet.

        Always tries native resolution AND downscaled versions, then
        returns whichever detection has the **highest confidence**.

        This is critical for close-up selfie photos: native detection may
        find a face with low confidence (0.67) and poor landmarks, while
        detection at 0.5x scale finds the same face with high confidence
        (0.91) and much better landmarks.  Using the highest-confidence
        detection ensures consistent alignment across all photos.

        Returns:
            face_info array (15 values: x,y,w,h, 5 landmarks x 2, conf)
            or None if no face detected at any scale.
        """
        h, w = image.shape[:2]
        best_face = None
        best_conf = -1.0
        best_scale_name = "native"

        # Try native resolution
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)
        if faces is not None and len(faces) > 0:
            idx = np.argmax(faces[:, 14])
            conf = float(faces[idx, 14])
            if conf > best_conf:
                best_face = faces[idx].copy()
                best_conf = conf
                best_scale_name = "1.0"

        # Also try downscaled versions — always, not just as fallback
        # For close-up photos, downscaled often gives BETTER detection
        scales = [0.5, 0.4, 0.3]
        for scale in scales:
            sh, sw = int(h * scale), int(w * scale)
            if sh < 100 or sw < 100:
                continue

            small = cv2.resize(image, (sw, sh), interpolation=cv2.INTER_AREA)
            self.detector.setInputSize((sw, sh))
            _, faces = self.detector.detect(small)

            if faces is not None and len(faces) > 0:
                idx = np.argmax(faces[:, 14])
                conf = float(faces[idx, 14])

                if conf > best_conf:
                    face_info = faces[idx].copy()
                    # Scale coordinates back to original image space
                    inv_scale = 1.0 / scale
                    face_info[0:4] *= inv_scale    # bbox
                    face_info[4:14] *= inv_scale   # landmarks

                    best_face = face_info
                    best_conf = conf
                    best_scale_name = f"{scale}"

        if best_face is not None and best_scale_name != "1.0":
            log.info(f"[Preprocessor] Best detection at scale={best_scale_name} "
                     f"(conf={best_conf:.2f})")

        return best_face


def assess_face_quality(
    face: np.ndarray,
    landmarks: np.ndarray = None
) -> Dict:
    """
    Convenience function to assess face quality.

    Returns:
        Quality assessment dictionary with 3 metriks
    """
    assessor = FaceQualityAssessment()
    return assessor.assess(face, landmarks)


# Test function
if __name__ == "__main__":
    log.info("Testing FacePreprocessor...")

    preprocessor = FacePreprocessor()

    import sys
    if len(sys.argv) > 1:
        image = cv2.imread(sys.argv[1])
        if image is not None:
            result = preprocessor.detect_and_preprocess(image, for_enrollment=True)
            log.info(f"Detection confidence: {result['detection_confidence']:.2f}")
            if result['quality']:
                q = result['quality']
                log.info(f"Quality Score: {q['quality_score']:.2f} ({q['status']})")
                log.info(f"  Blur: {q['blur']['score']:.2f} (ok={q['blur']['ok']})")
                log.info(f"  Brightness: {q['brightness']['score']:.2f} (ok={q['brightness']['ok']})")
                log.info(f"  Pose: {q['pose']['score']:.2f} (ok={q['pose']['ok']})")
