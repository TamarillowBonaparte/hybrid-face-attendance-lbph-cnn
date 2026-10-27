"""
Enhanced Face Recognition System (Revisi)
=====================================
Quality-Aware Score-Level Fusion Architecture

Arsitektur Final:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   INPUT IMAGE                                                                │
│        │                                                                     │
│        ▼                                                                     │
│   Face Detection (YuNet)                                                     │
│        │                                                                     │
│        ▼                                                                     │
│   Face Quality Assessment (3 metrik: Blur, Brightness, Pose)               │
│        │                                                                     │
│        ▼                                                                     │
│   Face Alignment (5 Landmark)                                                │
│        │                                                                     │
│        ├──► LBPH Extractor ──► LBPH Features (640-D)                       │
│        │                              │                                       │
│        │                              │                                       │
│        ├──► CNN Extractor ──► CNN Embedding (512-D)                        │
│        │                              │                                       │
│        │              ┌───────────────┴───────────────┐                    │
│        │              │                               │                      │
│        ▼              ▼                               ▼                      │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                                                              │           │
│   │   SCORE-LEVEL FUSION                                        │           │
│   │                                                              │           │
│   │   LBPH Similarity    = dot(Query_LBPH, Gallery_LBPH)       │           │
│   │   CNN Similarity     = dot(Query_CNN, Gallery_CNN)          │           │
│   │                                                              │           │
│   │   wCNN = QualityScore                                       │           │
│   │   wLBPH = 1 - QualityScore                                  │           │
│   │                                                              │           │
│   │   Final = wCNN × CNN_sim + wLBPH × LBPH_sim                 │           │
│   │                                                              │           │
│   └────────────────────────────┬────────────────────────────────┘           │
│                                │                                             │
│                                ▼                                             │
│                       Threshold (ROC + EER)                                 │
│                                │                                             │
│                     ┌──────────┴──────────┐                               │
│                     ▼                     ▼                                │
│               Recognized             Unknown                                │
│                     │                                                     │
│                     ▼                                                     │
│          Incremental Update (sim ≥ 0.98)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Revisi:
1. Score-Level Fusion (bukan Feature-Level)
2. Quality-Aware Weights: wCNN = QualityScore
3. 3 metrik quality (Blur, Brightness, Pose)
4. Hapus Dense Layer
5. Multi-frame: 15 → 5 terbaik
6. Top-3 (bukan Top-5)
7. Gallery Quality metadata
8. Incremental update: sim ≥ 0.98

Author: Skripsi 2026
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Tuple
from pathlib import Path

from config import (
    MOBILEFACENET_MODEL_PATH,
    IMG_SIZE_LBPH, IMG_SIZE_CNN,
    MULTIFRAME_CONFIG, ENROLLMENT_CONFIG
)

from face_preprocessing import FacePreprocessor, FaceQualityAssessment
from enhanced_augmentation import EnhancedAugmentation
from faiss_gallery import FAISSGallery, RecognitionResult
from threshold_calibrator import ThresholdCalibrator

log = logging.getLogger(__name__)


class LBPHExtractor:
    """LBPH Feature Extractor."""

    def __init__(self):
        self.grid_x = 8
        self.grid_y = 8
        self.neighbors = 8
        self.radius = 1
        self.n_bins = self.neighbors + 2
        self._clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        # CLAHE agresif untuk kondisi indoor gelap
        self._clahe_aggressive = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))

    def extract(self, face: np.ndarray) -> np.ndarray:
        """Extract LBPH features from face."""
        face_lbph = cv2.resize(face, (IMG_SIZE_LBPH, IMG_SIZE_LBPH))

        if len(face_lbph.shape) == 3:
            gray = cv2.cvtColor(face_lbph, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_lbph

        # Gunakan CLAHE agresif jika kondisi gelap (mean < 60)
        mean_brightness = float(np.mean(gray))
        clahe_op = self._clahe_aggressive if mean_brightness < 60 else self._clahe
        enhanced = clahe_op.apply(gray)
        lbp = self._compute_lbp(enhanced)

        h, w = lbp.shape
        cell_h, cell_w = h // self.grid_y, w // self.grid_x

        histograms = []
        for gy in range(self.grid_y):
            for gx in range(self.grid_x):
                y1, y2 = gy * cell_h, (gy + 1) * cell_h
                x1, x2 = gx * cell_w, (gx + 1) * cell_w
                cell = lbp[y1:y2, x1:x2]

                hist, _ = np.histogram(cell, bins=self.n_bins, range=(0, self.n_bins))
                hist = hist.astype(np.float32)
                hist /= (hist.sum() + 1e-7)
                histograms.append(hist)

        return np.concatenate(histograms)

    def _compute_lbp(self, gray: np.ndarray) -> np.ndarray:
        """Compute uniform LBP codes (vectorized — stabil & cepat).

        Mengganti pixel-loop lama yang punya float-rounding inconsistency
        dengan implementasi vectorized numpy:
        - Tidak ada int(round(sin/cos)) per-pixel → tidak ada rounding drift
        - Semua 8 neighbors di-shift sekaligus → reproducible untuk gambar sama
        - ~50x lebih cepat dari loop Python
        """
        h, w = gray.shape
        padded = np.pad(gray, self.radius, mode='edge').astype(np.int16)

        # Pre-compute tetap offset untuk 8 neighbors (radius=1, neighbors=8)
        # Urutan: mulai dari kanan (0°), searah jarum jam
        offsets = [
            (0,  1),   # 0°   East
            (-1, 1),   # 45°  NE
            (-1, 0),   # 90°  North
            (-1, -1),  # 135° NW
            (0, -1),   # 180° West
            (1, -1),   # 225° SW
            (1,  0),   # 270° South
            (1,  1),   # 315° SE
        ]

        center = padded[self.radius:self.radius + h,
                        self.radius:self.radius + w]

        # Stack 8 shifted neighbor planes
        neighbors_stack = []
        for di, dj in offsets:
            r0 = self.radius + di
            r1 = self.radius + di + h
            c0 = self.radius + dj
            c1 = self.radius + dj + w
            neighbors_stack.append(padded[r0:r1, c0:c1])

        # Binary bits: neighbor >= center
        bits = np.stack([(n >= center).astype(np.uint8)
                         for n in neighbors_stack], axis=0)  # (8, H, W)

        # Count transitions untuk uniform LBP
        # transitions[k] = bits[k] XOR bits[(k+1)%8]
        transitions = np.zeros((h, w), dtype=np.uint8)
        for k in range(self.neighbors):
            transitions += (bits[k] != bits[(k + 1) % self.neighbors]).astype(np.uint8)

        # Sum of bits (value 0-8 untuk uniform, 9 untuk non-uniform)
        bit_sum = bits.sum(axis=0).astype(np.uint8)  # (H, W)

        # Uniform: transitions <= 2  → code = bit_sum (0-8)
        # Non-uniform: transitions > 2 → code = neighbors + 1 = 9
        lbp = np.where(transitions <= 2, bit_sum,
                       np.uint8(self.neighbors + 1))

        return lbp.astype(np.uint8)


class MobileFaceNetExtractor:
    """
    MobileFaceNet Feature Extractor.

    MobileFaceNet adalah lightweight face recognition network yang di-train
    dengan ArcFace Loss. ArcFace Loss memberikan margin angular yang besar
    untuk meningkatkan separabilitas antar kelas.

    Arsitektur:
    - Input: 112×112 RGB face crop
    - Preprocessing: (pixel - 127.5) / 127.5 → [-1, 1]
    - Backbone: MobileNetV2-style depthwise separable convolutions
    - Head: ArcFace margin-based softmax
    - Output: 512-D discriminative face embedding

    Model pretrained:buffalo_l dari insightface
    (https://github.com/deepinsight/insightface)

    Referensi:
    - MobileFaceNet: https://arxiv.org/abs/1804.07573
    - ArcFace: https://arxiv.org/abs/1801.07698
    """

    def __init__(self):
        import onnxruntime as ort

        model_path = str(MOBILEFACENET_MODEL_PATH)

        if not Path(model_path).exists():
            log.info("[MobileFaceNet] Model not found")
            self._session = None
            self._input_name = None
            return

        self._session = ort.InferenceSession(
            model_path,
            providers=['CPUExecutionProvider']
        )
        self._input_name = self._session.get_inputs()[0].name
        log.info("[MobileFaceNet] Loaded (ArcFace pretrained)")

    def extract(self, face: np.ndarray) -> np.ndarray:
        """Extract face embedding dari face crop.

        Revisi Low-Light:
        Ditambahkan CLAHE di LAB colorspace sebelum normalisasi.
        LAB memisahkan luminance (L) dari chrominance (A,B),
        sehingga CLAHE hanya memperkuat kecerahan tanpa mengubah warna.
        Ini sangat membantu di kondisi indoor gelap karena CNN mengharapkan
        distribusi pixel yang cukup terang untuk menghasilkan embedding yang stabil.
        """
        if self._session is None:
            raise RuntimeError(
                f"MobileFaceNet tidak berhasil dimuat: {model_path}. "
                "Periksa file ONNX dan instalasi onnxruntime."
            )

        face_cnn = cv2.resize(face, (IMG_SIZE_CNN, IMG_SIZE_CNN))

        # ─────────────────────────────────────────────────────────────────────
        # NORMALISASI PENCAHAYAAN: CLAHE di LAB colorspace — SELALU AKTIF
        #
        # Perubahan dari kondisional (brightness<80) menjadi always-on:
        # Alasan: Foto enrollment sering diambil di kondisi terang (luar ruangan
        # atau lampu studio), sedangkan recognition terjadi di dalam ruangan gelap.
        # Jika normalisasi HANYA aktif untuk gambar gelap, dua gambar orang yang
        # sama punya distribusi pixel sangat berbeda → CNN similarity turun ke 0.56.
        # Dengan always-on CLAHE (clip ringan untuk gambar terang), distribusi
        # dinormalisasi di kedua sisi → CNN similarity stabil di 0.80+.
        #
        # Clip adaptif:
        #   < 40  (sangat gelap): clip=3.0 — agresif, naikkan kontrasl lokal
        #   < 80  (gelap)       : clip=2.0 — moderat
        #   >= 80 (normal/terang): clip=1.5 — ringan, normalisasi saja
        # ─────────────────────────────────────────────────────────────────────
        # Keep the input distribution expected by ArcFace/MobileFaceNet:
        # aligned face -> RGB -> [-1, 1]. The previous Tan-Triggs + CLAHE
        # chain was too aggressive and reduced cross-camera similarity.
        face_cnn = cv2.cvtColor(face_cnn, cv2.COLOR_BGR2RGB)
        face_cnn = face_cnn.astype(np.float32)

        # Normalize to [-1, 1]
        face_cnn = (face_cnn - 127.5) / 127.5

        # NCHW format
        face_cnn = np.transpose(face_cnn, (2, 0, 1))
        face_cnn = np.expand_dims(face_cnn, axis=0)

        features = self._session.run(None, {self._input_name: face_cnn})[0][0]
        features = np.asarray(features, dtype=np.float32).reshape(-1)
        norm = np.linalg.norm(features)
        if norm < 1e-7:
            raise RuntimeError("MobileFaceNet menghasilkan embedding kosong")
        return features / norm


class EnhancedFaceRecognitionSystem:
    """
    Enhanced Face Recognition System dengan Score-Level Fusion.

    Novelty: Quality-Aware Score-Level Fusion
    """

    def __init__(self):
        log.info("[System] Initializing Face Recognition System (Score-Level Fusion)...")

        # 1. Preprocessing (Alignment + Quality)
        self.preprocessor = FacePreprocessor()
        self.quality = FaceQualityAssessment()

        # 2. Feature Extractors
        self.lbph_extractor = LBPHExtractor()
        self.mobile_extractor = MobileFaceNetExtractor()

        # 3. Gallery
        self.gallery = FAISSGallery(embedding_dim=512)

        # 4. Threshold Calibrator
        self.calibrator = ThresholdCalibrator()

        # 5. Augmentation
        self.augmentation = EnhancedAugmentation()

        log.info("[System] Initialization complete")

    def _extract_features(
        self,
        face: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract LBPH and CNN features from face.

        Returns:
            (lbph_features, cnn_features)
        """
        lbph = self.lbph_extractor.extract(face)
        cnn = self.mobile_extractor.extract(face)
        return lbph, cnn

    def _process_multi_frame(
        self,
        frames: List[np.ndarray],
        quality_list: List[Dict],
        n_keep: int = 5
    ) -> Tuple[np.ndarray, np.ndarray, float]:
        """
        Process multiple frames and select best by quality.

        Untuk webcam: 15 frame → 5 terbaik.
        Untuk foto: gunakan semua foto (photo_mode_use_all).

        Returns:
            (mean_lbph, mean_cnn, avg_quality)
        """
        if len(frames) == 0:
            return None, None, 0.0

        lbph_features = []
        cnn_features = []

        for face in frames:
            lbph, cnn = self._extract_features(face)
            lbph_features.append(lbph)
            cnn_features.append(cnn)

        # Select top-K by quality (atau semua jika photo mode)
        use_all = MULTIFRAME_CONFIG.get('photo_mode_use_all', False)
        if use_all or n_keep >= len(frames):
            top_indices = list(range(len(frames)))
        elif quality_list and len(quality_list) == len(frames):
            scores = [q.get('quality_score', 0.5) for q in quality_list]
            top_indices = np.argsort(scores)[-n_keep:]
        else:
            top_indices = list(range(len(frames)))

        # Average
        lbph_avg = np.mean([lbph_features[i] for i in top_indices], axis=0)
        cnn_avg = np.mean([cnn_features[i] for i in top_indices], axis=0)

        # Normalize — PENTING: keduanya pakai L1-norm agar konsisten
        # dengan histogram intersection di gallery matching.
        # L1 untuk LBPH (histogram sum = 1), L2 untuk CNN (cosine similarity)
        lbph_sum = lbph_avg.sum()
        lbph_avg = lbph_avg / (lbph_sum + 1e-7)     # L1-norm for histogram
        cnn_avg = cnn_avg / (np.linalg.norm(cnn_avg) + 1e-7)  # L2-norm for cosine

        # Average quality
        avg_quality = np.mean([quality_list[i]['quality_score'] for i in top_indices]) if quality_list else 0.5

        return lbph_avg, cnn_avg, avg_quality

    def enroll(
        self,
        nim: str,
        frames: List[np.ndarray],
        metadata: Dict = None
    ) -> bool:
        """
        Enroll a new identity.

        Strategi Embedding untuk Multi-Foto (6 foto):
        ─────────────────────────────────────────────
        CNN:
        - Quality-Weighted Centroid: rata-rata tertimbang kualitas
          (foto berkualitas tinggi berkontribusi lebih besar)
        - Multi-Template: simpan semua embedding individual
          (saat recognition, gunakan max-similarity rule)

        LBPH:
        - Multi-template dari semua foto (L1-norm konsisten)
        - Augmentasi dari 2 foto terbaik (diversitas)
        - Histogram Intersection untuk matching

        Args:
            nim: Unique identifier
            frames: List of face crops (idealnya 6 foto)
            metadata: Optional metadata

        Returns:
            True if successful
        """
        log.info(f"\n{'='*60}")
        log.info(f"ENROLLING: {nim}")
        log.info(f"{'='*60}")

        processed_frames = []
        quality_list = []

        for i, frame in enumerate(frames):
            result = self.preprocessor.detect_and_preprocess(frame, for_enrollment=True)

            if result['face'] is None:
                log.warning(f"  Frame {i+1}: No face detected")
                continue

            if result.get('is_masked', False):
                log.warning(f"  Frame {i+1}: Ditolak karena terdeteksi masker ({result.get('mask_reason')})")
                continue

            face = result['aligned_face'] if result['aligned_face'] is not None else result['face']
            processed_frames.append(face)

            if result['quality']:
                quality_list.append(result['quality'])
                log.info(f"  Frame {i+1}: OK (quality: {result['quality']['quality_score']:.2f})")
            else:
                quality_list.append({'quality_score': 0.5})

        if len(processed_frames) < ENROLLMENT_CONFIG.get('min_frames', 1):
            log.error(f"[FAIL] Only {len(processed_frames)} valid frames")
            return False

        n_photos = len(processed_frames)
        quality_scores = [q.get('quality_score', 0.5) for q in quality_list]

        # =================================================================
        # CNN: Outlier Filtering + Robust Centroid + Multi-Template
        # =================================================================
        # Extract CNN embedding dari setiap foto
        all_cnn_embeddings = []
        for face in processed_frames:
            _, cnn = self._extract_features(face)
            cnn = cnn / (np.linalg.norm(cnn) + 1e-7)  # L2-norm
            all_cnn_embeddings.append(cnn)

        # ─────────────────────────────────────────────────────────────────
        # OUTLIER FILTERING: Hapus foto dengan pose/kondisi terlalu berbeda
        #
        # Jika ada foto yang CNN similarity-nya < 0.45 terhadap SEMUA foto
        # lain, foto itu kemungkinan: pose terlalu berbeda (strong profile),
        # alignment gagal, atau ada artefak.  Centroid yang mengandung
        # outlier seperti ini akan "tertarik" dan tidak representatif.
        #
        # Strategi: hitung average mutual similarity tiap foto,
        # buang yang di bawah threshold (kecuali hanya tersisa 1 foto).
        # ─────────────────────────────────────────────────────────────────
        n_emb = len(all_cnn_embeddings)
        mutual_sims = np.zeros(n_emb)
        if n_emb >= 2:
            for i in range(n_emb):
                sims = []
                for j in range(n_emb):
                    if i != j:
                        sims.append(float(np.dot(all_cnn_embeddings[i],
                                                  all_cnn_embeddings[j])))
                mutual_sims[i] = np.mean(sims)

            # Filter: buang embedding dengan mutual sim < 0.45
            outlier_threshold = 0.45
            keep_mask = mutual_sims >= outlier_threshold

            # Minimal tetap simpan 1 foto (yang terbaik)
            if keep_mask.sum() == 0:
                keep_mask[np.argmax(mutual_sims)] = True

            n_removed = n_emb - int(keep_mask.sum())
            if n_removed > 0:
                log.info(f"  CNN: Outlier filtering — removed {n_removed} "
                         f"foto(s) with mutual sim < {outlier_threshold}")
                for i in range(n_emb):
                    if not keep_mask[i]:
                        log.info(f"    Removed foto {i+1}: mutual_sim={mutual_sims[i]:.3f}")

            # Apply filter
            filtered_embeddings = [e for e, k in zip(all_cnn_embeddings, keep_mask) if k]
            filtered_frames = [f for f, k in zip(processed_frames, keep_mask) if k]
            filtered_quality = [q for q, k in zip(quality_scores, keep_mask) if k]
            filtered_mutual = mutual_sims[keep_mask]
        else:
            filtered_embeddings = all_cnn_embeddings
            filtered_frames = processed_frames
            filtered_quality = quality_scores
            filtered_mutual = np.array([1.0])

        # ─────────────────────────────────────────────────────────────────
        # ROBUST CENTROID: Mutual-Similarity Weighted (bukan Quality-Weighted)
        #
        # Masalah quality-weighted centroid: quality score mengukur blur,
        # brightness, pose — tapi BUKAN apakah foto konsisten dengan foto
        # lain.  Foto bisa quality=0.85 tapi pose sangat berbeda → centroid
        # tertarik ke arah yang salah.
        #
        # Solusi: gunakan mutual similarity sebagai weight.
        # Foto yang konsisten dengan mayoritas → bobot besar.
        # Foto yang "sendirian" → bobot kecil.
        # ─────────────────────────────────────────────────────────────────
        ms_weights = filtered_mutual.astype(np.float32)
        ms_weights = ms_weights / (ms_weights.sum() + 1e-7)

        final_cnn = np.zeros_like(filtered_embeddings[0])
        for emb, w in zip(filtered_embeddings, ms_weights):
            final_cnn += w * emb
        final_cnn = final_cnn / (np.linalg.norm(final_cnn) + 1e-7)  # L2-norm

        # ─────────────────────────────────────────────────────────────────
        # BEST-TEMPLATE AS FAISS PRIMARY ENTRY POINT
        #
        # Centroid (rata-rata) bisa berada di "no-man's-land" jika ada
        # variasi pose.  Untuk FAISS search (entry point), gunakan template
        # yang paling representatif (avg mutual sim tertinggi) sebagai
        # primary vector.  Centroid tetap disimpan sebagai salah satu
        # template untuk coverage tambahan.
        # ─────────────────────────────────────────────────────────────────
        best_template_idx = int(np.argmax(filtered_mutual))
        faiss_primary = filtered_embeddings[best_template_idx].copy()
        faiss_primary = faiss_primary / (np.linalg.norm(faiss_primary) + 1e-7)

        log.info(f"  CNN: {len(filtered_embeddings)} foto setelah filtering "
                 f"(dari {n_photos} asli)")
        log.info(f"  CNN: Mutual-sim weights = "
                 f"{[f'{w:.2f}' for w in ms_weights]}")
        log.info(f"  CNN: Best template = foto {best_template_idx+1} "
                 f"(mutual_sim={filtered_mutual[best_template_idx]:.3f})")

        # all_cnn_embeddings sekarang berisi hanya yang filtered
        # Tambahkan centroid sebagai template tambahan
        all_cnn_embeddings = list(filtered_embeddings)
        all_cnn_embeddings.append(final_cnn)  # centroid juga jadi template

        # Update processed_frames dan quality_scores untuk LBPH
        processed_frames = filtered_frames
        quality_scores = filtered_quality
        n_photos = len(processed_frames)

        # =================================================================
        # LBPH: Multi-Template dari Semua Foto + Augmentasi Lighting Variants
        # =================================================================
        lbph_templates = []

        # 1. Extract LBPH dari SEMUA foto (bukan hanya average)
        for face in processed_frames:
            lbph_single = self.lbph_extractor.extract(face)
            lbph_single = lbph_single / (lbph_single.sum() + 1e-7)  # L1-norm konsisten
            lbph_templates.append(lbph_single)

        # 2. Augmentasi dari 2 foto terbaik — 2 arah:
        #    a) Random augmentation (variasi noise/blur/rotasi)
        #    b) Lighting variants deterministik (7 kondisi cahaya nyata)
        sorted_indices = np.argsort(quality_scores)[::-1]
        top_2_indices = sorted_indices[:min(2, len(sorted_indices))]

        for idx in top_2_indices:
            # --- 2a. Random augmentation (seperti sebelumnya) ---
            aug_versions = self.augmentation.generate_versions(
                processed_frames[idx],
                n_versions=2,
                include_original=False
            )
            for aug_face in aug_versions:
                if aug_face is not None:
                    lbph = self.lbph_extractor.extract(aug_face)
                    lbph = lbph / (lbph.sum() + 1e-7)  # L1-norm konsisten
                    lbph_templates.append(lbph)

            # --- 2b. Lighting variants deterministik dari foto terbaik ---
            # Menghasilkan 7 kondisi cahaya: terang, gelap, sangat gelap,
            # overexposed, shadow kiri, shadow kanan, CLAHE agresif
            lighting_variants = self.augmentation.generate_lighting_variants(
                processed_frames[idx],
                include_original=False
            )
            for light_face in lighting_variants:
                if light_face is not None:
                    lbph = self.lbph_extractor.extract(light_face)
                    lbph = lbph / (lbph.sum() + 1e-7)  # L1-norm konsisten
                    lbph_templates.append(lbph)

            # --- 2c. Android camera variants deterministik ---
            # Menghasilkan 10 kondisi spesifik kamera Android:
            # neon, tungsten, outdoor teduh, outdoor terang, malam,
            # backlight, jendela kiri/kanan, terkompresi, kamera depan
            android_variants = self.augmentation.generate_android_variants(
                processed_frames[idx],
                include_original=False
            )
            for android_face in android_variants:
                if android_face is not None:
                    lbph = self.lbph_extractor.extract(android_face)
                    lbph = lbph / (lbph.sum() + 1e-7)  # L1-norm konsisten
                    lbph_templates.append(lbph)

        # =================================================================
        # CNN: Augmented Templates dari Foto Terbaik
        # =================================================================
        # Selain centroid dan foto individual, tambahkan CNN embedding
        # dari lighting + android variants foto terbaik.
        # Ini memastikan gallery CNN punya coverage di berbagai kondisi
        # pencahayaan, sehingga similarity tetap tinggi saat foto real
        # dari Android berbeda kondisi dari foto enrollment.
        best_photo_idx = sorted_indices[0] if len(sorted_indices) > 0 else 0

        # Lighting variants → CNN templates
        light_cnn_variants = self.augmentation.generate_lighting_variants(
            processed_frames[best_photo_idx],
            include_original=False
        )
        for light_face in light_cnn_variants:
            if light_face is not None:
                _, cnn = self._extract_features(light_face)
                cnn = cnn / (np.linalg.norm(cnn) + 1e-7)
                all_cnn_embeddings.append(cnn)

        # Android variants → CNN templates
        android_cnn_variants = self.augmentation.generate_android_variants(
            processed_frames[best_photo_idx],
            include_original=False
        )
        for android_face in android_cnn_variants:
            if android_face is not None:
                _, cnn = self._extract_features(android_face)
                cnn = cnn / (np.linalg.norm(cnn) + 1e-7)
                all_cnn_embeddings.append(cnn)

        log.info(f"  CNN: +{len(light_cnn_variants) + len(android_cnn_variants)} "
                 f"augmented templates (7 lighting + 10 android)")

        # LBPH: Kirim SEMUA templates individual ke gallery
        # Gallery akan menyimpan semuanya dan melakukan max/avg matching
        # (tidak di-average di sini agar gallery punya cakupan variasi lebih luas)
        # Tetap buat final_lbph sebagai fallback saja
        final_lbph = np.mean(lbph_templates, axis=0)
        final_lbph = final_lbph / (final_lbph.sum() + 1e-7)  # L1-norm

        log.info(f"  LBPH: {len(lbph_templates)} templates individual ({n_photos} foto + augmentasi)"
                 f" — akan disimpan semua di gallery")

        # =================================================================
        # Add to Gallery
        # =================================================================
        meta = metadata or {}
        avg_quality = float(np.mean(quality_scores))
        meta['quality_score'] = avg_quality
        meta['num_registrations'] = n_photos

        # Multi-template CNN: simpan semua embedding individual
        use_multi_template = ENROLLMENT_CONFIG.get('multi_template_cnn', True)

        success = self.gallery.add_identity(
            nim,
            faiss_primary,  # Best-template sebagai FAISS primary (bukan centroid)
            final_lbph,
            meta,
            cnn_templates=all_cnn_embeddings if use_multi_template else None,
            lbph_templates=lbph_templates  # Fix 4: kirim semua LBPH individual
        )

        if success:
            log.info(f"\n{'='*60}")
            log.info(f"ENROLLMENT SUCCESS")
            log.info(f"{'='*60}")
            log.info(f"  NIM: {nim}")
            log.info(f"  Foto: {n_photos}")
            log.info(f"  Avg Quality: {avg_quality:.2f}")
            log.info(f"  CNN: Quality-Weighted Centroid + {len(all_cnn_embeddings)} individual templates")
            log.info(f"  LBPH: {len(lbph_templates)} individual templates (multi-foto + augmentasi)")

        return success


    def enroll_from_images(
        self,
        nim: str,
        image_paths: List[str],
        metadata: Dict = None
    ) -> bool:
        """Enroll from image files."""
        frames = []
        for path in image_paths:
            if isinstance(path, str):
                img = cv2.imread(str(path))
                if img is not None:
                    frames.append(img)

        return self.enroll(nim, frames, metadata)

    def recognize(
        self,
        frame: np.ndarray,
        update_template: bool = True
    ) -> RecognitionResult:
        """
        Recognize face in a frame.

        Score-Level Fusion:
        1. Extract LBPH and CNN features
        2. Match against gallery
        3. Fuse scores with quality-aware weights
        """
        # Detect and preprocess
        result = self.preprocessor.detect_and_preprocess(frame, for_enrollment=False)

        if result['face'] is None:
            return RecognitionResult(nim=None, similarity=0.0, message="Wajah tidak terdeteksi")

        # Cek apakah wajah menggunakan masker
        if result.get('is_masked', False):
            mask_reason = result.get('mask_reason', 'Terdeteksi masker')
            log.warning(f"[EnhancedSystem] Rekognisi ditolak: {mask_reason}")
            return RecognitionResult(
                nim=None,
                similarity=0.0,
                cnn_similarity=0.0,
                lbph_similarity=0.0,
                is_recognized=False,
                message="Wajah terdeteksi menggunakan masker. Harap lepas masker Anda terlebih dahulu!"
            )

        # Use aligned face
        face = result['aligned_face'] if result['aligned_face'] is not None else result['face']
        quality = result['quality']

        # Extract features
        lbph, cnn = self._extract_features(face)

        # Normalize
        lbph = lbph / (lbph.sum() + 1e-7)              # L1-norm (histogram intersection)
        cnn = cnn / (np.linalg.norm(cnn) + 1e-7)        # L2-norm (cosine similarity)

        # Get threshold
        threshold = self.calibrator.get_threshold()

        # Recognize with Score-Level Fusion
        result = self.gallery.recognize(
            cnn,
            lbph,
            quality_score=quality['quality_score'] if quality else 0.5,
            threshold=threshold,
            update_template=update_template
        )

        return result

    def recognize_from_image(
        self,
        image_path: str,
        update_template: bool = True
    ) -> RecognitionResult:
        """Recognize from image file."""
        img = cv2.imread(str(image_path))
        if img is None:
            return RecognitionResult(nim=None, similarity=0.0)

        return self.recognize(img, update_template)

    def verify(
        self,
        frame: np.ndarray,
        nim: str
    ) -> Tuple[bool, float]:
        """Verify if face matches specific identity."""
        result = self.preprocessor.detect_and_preprocess(frame, for_enrollment=False)

        if result['face'] is None:
            return False, 0.0

        face = result['aligned_face'] if result['aligned_face'] is not None else result['face']
        quality = result['quality']

        lbph, cnn = self._extract_features(face)
        lbph = lbph / (lbph.sum() + 1e-7)              # L1-norm (histogram intersection)
        cnn = cnn / (np.linalg.norm(cnn) + 1e-7)        # L2-norm (cosine similarity)

        threshold = self.calibrator.get_threshold()

        # Normalize NIM ke uppercase untuk case-insensitive matching
        nim_upper = nim.strip().upper()

        return self.gallery.verify_identity(
            nim_upper, cnn, lbph,
            quality_score=quality['quality_score'] if quality else 0.5,
            threshold=threshold
        )

    def get_gallery_size(self) -> int:
        """Get number of enrolled identities."""
        return self.gallery.get_identity_count()

    def list_identities(self) -> List[str]:
        """List enrolled identities."""
        return self.gallery.list_identities()

    def remove_identity(self, nim: str) -> bool:
        """Remove identity from gallery."""
        return self.gallery.remove_identity(nim)

    def get_gallery_info(self) -> Dict:
        """Get gallery info including quality stats."""
        return self.gallery.get_gallery_stats()


# Backward compatibility
class SimpleFusionExtractor:
    """Simple fusion extractor (for testing)."""

    def __init__(self):
        self.lbph = LBPHExtractor()
        self.cnn = MobileFaceNetExtractor()

    def extract_embedding(self, face: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Extract LBPH and CNN features."""
        lbph = self.lbph.extract(face)
        cnn = self.cnn.extract(face)
        return lbph, cnn


# Factory function
def create_system() -> EnhancedFaceRecognitionSystem:
    """Create enhanced face recognition system."""
    return EnhancedFaceRecognitionSystem()


# Test function
if __name__ == "__main__":
    log.info("Testing Enhanced Face Recognition System (Revisi)...")

    system = EnhancedFaceRecognitionSystem()
    log.info(f"Gallery size: {system.get_gallery_size()}")
    log.info("\nSystem initialized with Score-Level Fusion!")
