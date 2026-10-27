"""
Config - Face Recognition System (Revisi)
=====================================
Quality-Aware Score-Level Fusion Architecture

Perubahan utama:
1. Hapus Dense Layer - langsung normalize dan fuse
2. Score-Level Fusion - similarity, bukan feature concatenation
3. Quality-Aware Weights: wCNN = QualityScore, wLBPH = 1 - QualityScore
4. Quality sederhana: Blur, Brightness, Pose (3 metrik)
5. Multi-frame: 15 → 5 terbaik
6. Hapus dynamic threshold adjustment
7. Incremental update: similarity ≥ 0.98
8. Gallery Quality: simpan quality score, tanggal, jumlah registrasi
9. Top-3 (bukan Top-5)
10. MobileFaceNet → ArcFace Loss (penjelasan)

Author: Skripsi 2026
"""

from pathlib import Path
import numpy as np

# === PATH CONFIGURATION ===
_CURRENT_DIR = Path(__file__).resolve().parent
MODEL_DIR = _CURRENT_DIR
FACE_MAHASISWA_DIR = MODEL_DIR / "face_mahasiswa"

# === MODEL PATHS ===
YUNET_MODEL_PATH = MODEL_DIR / "models" / "face_detection_yunet_2023mar.onnx"
MOBILEFACENET_MODEL_PATH = MODEL_DIR / "models" / "mobilefacenet.onnx"

# === IMAGE SIZES ===
IMG_SIZE_LBPH = 96        # Grayscale input for LBPH
IMG_SIZE_CNN = 112        # RGB input for MobileFaceNet
IMG_SIZE_ALIGN = 112      # For alignment reference

# === LBPH PARAMETERS ===
LBPH_RADIUS = 1
LBPH_NEIGHBORS = 8
LBPH_GRID_X = 8
LBPH_GRID_Y = 8
LBPH_DIM = (LBPH_NEIGHBORS + 2) * LBPH_GRID_X * LBPH_GRID_Y  # 640

# === MOBILEFACENET PARAMETERS ===
# MobileFaceNet menggunakan ArcFace Loss untuk training
# Output: 512-D face embedding yang discriminative
CNN_DIM = 512

# =============================================================================
# 1. FACE ALIGNMENT CONFIG (YuNet 5 Landmarks)
# =============================================================================
ALIGNMENT_CONFIG = {
    'enabled': True,
    'target_size': IMG_SIZE_ALIGN,

    # Reference points untuk frontal face (112x112 template)
    # STANDARD InsightFace / ArcFace — WAJIB SAMA dengan training distribution
    # Sumber: insightface/utils/face_align.py arcface_dst
    # 5 landmark: left_eye, right_eye, nose, left_mouth, right_mouth
    'reference_points': np.array([
        # Official InsightFace/ArcFace 112x112 alignment template.
        [38.2946, 51.6963],  # left_eye
        [73.5318, 51.5014],  # right_eye
        [56.0252, 71.7366],  # nose
        [41.5493, 92.3655],  # left_mouth
        [70.7299, 92.2041],  # right_mouth
    ], dtype=np.float64),

    'reference_scale': 112.0,
}

# =============================================================================
# 2. FACE QUALITY ASSESSMENT (Sederhana - 3 Metrik)
# =============================================================================
# Revisi: Hanya 3 metrik, semakin sedikit semakin mudah divalidasi
QUALITY_CONFIG = {
    'enabled': True,

    # Blur Detection (Variance of Laplacian)
    # < 30 = blur (reject)
    'blur': {
        'threshold': 30.0,
    },

    # Brightness Assessment
    # Revisi Low-Light: diturunkan dari min=40 → 20, max=220 → 230
    # Alasan: Di gedung jurusan indoor, mean brightness wajah bisa 20-45px.
    # Threshold lama (40) terlalu ketat dan menolak wajah yang sebenarnya valid.
    'brightness': {
        'min': 20,   # Revisi: 40 → 20 (toleransi kondisi indoor gelap)
        'max': 230,  # Revisi: 220 → 230 (toleransi sedikit overexposed)
    },

    # Pose Estimation (dari landmark offset)
    # Yaw/Pitch > 15° = reject
    'pose': {
        'yaw_threshold': 15.0,
        'pitch_threshold': 15.0,
    },

    # Pass threshold
    'pass_threshold': 0.5,  # Minimal 2 dari 3 metrik harus bagus
}

# =============================================================================
# 3. SCORE-LEVEL FUSION CONFIG (BUKAN Feature-Level)
# =============================================================================
# Revisi: Score-Level Fusion, bukan Feature-Level Fusion
#
# Arsitektur lama (Feature-Level):
#   LBPH → Dense → BN → ReLU ─┐
#                              ├─► Concat ─► L2Norm ─► Embedding
#   CNN → Dense → BN → ReLU ─┘
#
# Arsitektur baru (Score-Level):
#   LBPH → Normalize ──────────────┐
#                                 ├─► Final Score = α·CNN_sim + β·LBPH_sim
#   CNN → Normalize ──────────────┤
#                                 │
#   Quality → Weight Calculator ──┘
#
# Keuntungan Score-Level:
# - Tidak perlu training Dense layer
# - Lebih mudah dijelaskan
# - Sering dipakai di sistem biometrik
# - Zero retraining
#
# Adaptive Fusion Weight (Revisi Cross-Condition):
# Masalah sebelumnya: CNN weight 70-90% terlalu dominan.
# Saat foto beda kamera/kondisi, CNN sim bisa turun ke 0.37 meski LBPH bagus (0.72).
# Solusi: buat weight adaptif berdasarkan CNN score aktual:
#   - CNN > 0.75 (kondisi bagus, kamera sama): CNN 85%, LBPH 15%
#   - CNN 0.55-0.75 (kondisi agak beda): CNN 65%, LBPH 35%
#   - CNN < 0.55 (cross-camera/kondisi berbeda): CNN 50%, LBPH 50%
#
# Logika: jika CNN sendiri tidak yakin, beri LBPH lebih banyak suara.
FUSION_CONFIG = {
    'method': 'score_level',
    'use_quality_weighted': True,

    # Weight formula parameters (Revisi Cross-Condition: Adaptive CNN/LBPH)
    # CNN weight sekarang adaptif berdasarkan CNN score aktual (bukan quality saja)
    'weight': {
        'base_cnn': 0.65,      # Base CNN weight (turun dari 0.80)
        'slope': 0.10,         # Slope adaptif berdasarkan quality
        'min_cnn': 0.50,       # Minimal CNN 50% (turun dari 70%) — cross-condition mode
        'max_cnn': 0.85,       # Maksimal CNN 85% (turun dari 90%) — normal mode
        'min_lbph': 0.15,      # Minimal LBPH 15%
        'max_lbph': 0.50,      # Maksimal LBPH 50% — bisa dominan saat CNN rendah
    },

    # Threshold CNN untuk memutuskan mode fusion
    # Jika CNN sim < cross_condition_cnn_threshold → aktifkan LBPH rescue mode
    'cross_condition': {
        'enabled': True,
        'cnn_low_threshold': 0.55,    # CNN di bawah ini dianggap cross-condition
        'cnn_high_threshold': 0.75,   # CNN di atas ini dianggap kondisi bagus
        # CNN lebih tahan terhadap perubahan pencahayaan daripada LBPH.
        # Namun saat CNN rendah (cross-condition), LBPH harus bisa rescue.
        # Sebelumnya w_cnn_low=0.70 masih terlalu tinggi → LBPH tidak efektif.
        'w_cnn_low': 0.55,            # CNN rendah: lebih seimbang (55/45)
        'w_cnn_high': 0.85,           # kondisi bagus: CNN dominan tapi tidak ekstrem
    }
}

# =============================================================================
# 4. MULTI-FRAME EMBEDDING
# =============================================================================
MULTIFRAME_CONFIG = {
    'capture_frames': 15,        # Untuk webcam (15 frame video)
    'quality_pass_frames': 5,    # Untuk webcam: ambil 5 terbaik
    'photo_mode_use_all': True,  # Untuk enrollment foto: gunakan semua foto
}

# =============================================================================
# 5. THRESHOLD CONFIG (ROC + EER, tanpa dynamic adjustment)
# =============================================================================
THRESHOLD_CONFIG = {
    'initial_threshold': 0.58,  # Diturunkan ke 0.58 (dari 0.62)
                                 # Alasan: test cross-condition menunjukkan
                                 # fused score gelap/terang ekstrem di 0.58-0.61.
                                 # 0.58 = titik yang aman:
                                 #   - Genuine cross-condition: ~0.58-0.97 ✓
                                 #   - Impostor (orang lain): ~0.35-0.55 ✗

    # Kalibrasi menggunakan ROC Curve dan EER
    # Revisi: Hapus dynamic adjustment
    # Quality sudah dipakai di fusion, tidak perlu di threshold
    'calibration': {
        'method': 'eer',
        'roc_points': 100,
    },
}

# =============================================================================
# 6. FAISS GALLERY CONFIG
# =============================================================================
FAISS_CONFIG = {
    'index_type': 'IP',              # Inner Product (cosine sim)
    'exact_threshold': 1000,        # Use exact search untuk < 1000
    'top_k': 3,                     # Revisi: Top-3 (bukan Top-5)
    'gallery_path': MODEL_DIR / "models" / "face_gallery_faiss",
}

# =============================================================================
# 7. INCREMENTAL TEMPLATE UPDATE
# =============================================================================
# Revisi: Similarity ≥ 0.98 (lebih tinggi dari 0.90)
TEMPLATE_UPDATE_CONFIG = {
    'enabled': True,
    'similarity_threshold': 0.98,  # Revisi: 0.98 (lebih konservatif)

    # Exponential Moving Average
    'ema_alpha': 0.2,  # Weight untuk embedding baru
}

# =============================================================================
# 8. GALLERY QUALITY (Metadata untuk Template)
# =============================================================================
# Revisi: Tambahkan Gallery Quality
# Saat menyimpan embedding, simpan juga:
# - Quality Score saat enrollment
# - Tanggal registrasi
# - Jumlah foto yang digunakan
# Berguna untuk memilih template terbaik nanti
GALLERY_QUALITY_CONFIG = {
    'enabled': True,
    'track_quality': True,
    'track_date': True,
    'track_count': True,
}

# =============================================================================
# 9. DATABASE PATHS
# =============================================================================
DATABASE_CONFIG = {
    'faiss_index': MODEL_DIR / "models" / "face_index.faiss",
    'metadata': MODEL_DIR / "models" / "face_metadata.pkl",
    'calibration': MODEL_DIR / "models" / "threshold_calibration.json",
    'templates': MODEL_DIR / "models" / "face_templates.npy",
}

# =============================================================================
# FACE DETECTION CONFIG
# =============================================================================
# Revisi Akurasi v3: Threshold dinaikkan untuk hindari false detection
DETECTION_CONFIG = {
    'face_confidence_threshold': 0.65,   # Ditingkatkan dari 0.50 → pastikan hanya wajah jelas yang diproses
    'face_nms_threshold': 0.3,
    'face_max_faces': 5,
    'min_face_size': 80,                 # Ditingkatkan dari 50 → embedding wajah kecil tidak reliable
    'padding_ratio': 0.15,               # Sedikit lebih besar untuk konteks
}

# =============================================================================
# PREPROCESSING CONFIG
# =============================================================================
PREPROCESSING_CONFIG = {
    'clahe_clip_limit': 2.0,
    'clahe_tile_size': (8, 8),
}

# =============================================================================
# ENROLLMENT CONFIG
# =============================================================================
ENROLLMENT_CONFIG = {
    'min_frames': 1,              # Minimal 1 foto (fallback)
    'recommended_frames': 6,      # Optimal: 6 foto per orang
    'min_quality_score': 0.5,     # Minimum quality per foto
    'multi_template_cnn': True,   # Simpan semua CNN templates individual
    'use_quality_weighted_centroid': True,  # Centroid tertimbang kualitas
}

# =============================================================================
# SINGLE PHOTO ENROLLMENT CONFIG
# =============================================================================
SINGLE_PHOTO_CONFIG = {
    'enabled': True,
    'min_quality_score': 0.6,     # Single photo perlu quality score >= 0.6
    'augmentation_versions': 10,  # Generate 10 augmented versions untuk stabilitas
    'quality_weight_cnn': 0.75,   # Higher CNN weight untuk quality yang bagus
    'quality_weight_lbph': 0.25,
}

# =============================================================================
# AUGMENTATION CONFIG
# =============================================================================
AUGMENTATION_CONFIG = {
    'enabled': True,
    'enrollment_copies': 10,  # Lebih banyak versi untuk single photo
    'max_combined': 3,        # Max 3 augmentations sekaligus
    'methods': {
        # CLAHE: clip limit lebih agresif untuk simulasi indoor
        'clahe': {
            'enabled': True,
            'clip_limit': (2.0, 4.0),   # Revisi: (1.5,3.0) → (2.0,4.0) lebih agresif
            'tile_size': (8, 8),
            'probability': 0.8,          # Revisi: 0.7 → 0.8 (lebih sering diterapkan)
        },
        # Gamma: lebih ekstrem untuk simulasi pencahayaan indoor gelap
        # Gamma < 1 → mencerahkan; Gamma > 1 → menggelapkan
        'gamma': {
            'enabled': True,
            'gamma_range': (0.4, 1.5),  # Revisi: (0.7,1.3) → (0.4,1.5) simulasi indoor
            'probability': 0.7,          # Revisi: 0.5 → 0.7
        },
        'sharpen': {
            'enabled': True,
            'kernel_range': (0.5, 1.5),
            'probability': 0.4,
        },
        'hist_eq': {
            'enabled': True,
            'probability': 0.3,
        },
        # Brightness: range lebih lebar untuk simulasi gelap-terang indoor
        'brightness': {
            'enabled': True,
            'factor_range': (0.45, 1.2), # Revisi: (0.85,1.15) → (0.45,1.2) simulasi indoor
            'probability': 0.7,           # Revisi: 0.5 → 0.7
        },
        'rotation': {
            'enabled': True,
            'max_angle': 8.0,
            'probability': 0.4,
        },
        # Noise: lebih tinggi untuk simulasi grain kamera di kondisi gelap
        'noise': {
            'enabled': True,
            'std_range': (3.0, 12.0),   # Revisi: (2.0,8.0) → (3.0,12.0) simulasi noise
            'probability': 0.5,          # Revisi: 0.3 → 0.5
        },
        # Shadows: augmentasi bayangan/vignette — simulasi pencahayaan satu arah
        'shadows': {
            'enabled': True,
            'intensity_range': (0.3, 0.7), # Intensitas shadow: 30-70% area gelap
            'probability': 0.4,
        },
        # Color Temperature: simulasi perbedaan lampu (tungsten warm vs neon cool)
        # Kamera Android auto white-balance sering menghasilkan color cast
        'color_temp': {
            'enabled': True,
            'warm_shift': (10, 30),   # Red boost, Blue reduce (lampu tungsten)
            'cool_shift': (10, 30),   # Blue boost, Red reduce (lampu neon/TL)
            'probability': 0.5,
        },
        # JPEG Compression: simulasi artefak kompresi kamera HP & WhatsApp
        # Foto dari Android sering di-compress ulang sebelum dikirim ke server
        'jpeg_compression': {
            'enabled': True,
            'quality_range': (30, 70),  # Quality rendah = artefak lebih banyak
            'probability': 0.4,
        },
        # Gaussian Blur: simulasi sedikit out-of-focus dari kamera HP
        'gaussian_blur': {
            'enabled': True,
            'kernel_range': (3, 5),     # Kernel kecil, blur ringan
            'probability': 0.3,
        },
        # Exposure Simulation: simulasi auto-exposure kamera Android
        # Kombinasi brightness + gamma + saturation shift yang realistis
        'exposure_simulation': {
            'enabled': True,
            'underexpose_range': (0.4, 0.7),   # Gelap (indoor tanpa flash)
            'overexpose_range': (1.3, 1.8),     # Terang (outdoor / flash)
            'probability': 0.5,
        },
    }
}

# =============================================================================
# LEGACY SUPPORT
# =============================================================================
FACE_GALLERY_PATH = MODEL_DIR / "models" / "face_gallery.pkl"
RECOGNITION_THRESHOLD = THRESHOLD_CONFIG['initial_threshold']

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================
def get_lbph_dim():
    """Calculate LBPH feature dimension."""
    return LBPH_DIM

def get_reference_points():
    """Get normalized reference points for face alignment."""
    return ALIGNMENT_CONFIG['reference_points'].copy()

# =============================================================================
# ANTI-SPOOFING CONFIG (Opsional — tidak mempengaruhi sistem existing)
# =============================================================================
# Konfigurasi untuk AntiSpoofManager dan AntiSpoofGuardedSystem.
#
# PENTING: enabled=False by default.
# Sistem existing (EnhancedFaceRecognitionSystem) TIDAK membaca config ini.
# Hanya AntiSpoofGuardedSystem yang menggunakannya secara eksplisit.
#
# Cara mengaktifkan:
#   from anti_spoof_manager import AntiSpoofManager, AntiSpoofGuardedSystem
#   mgr = AntiSpoofManager.from_config()
#   system = AntiSpoofGuardedSystem(anti_spoof_manager=mgr)
#
ANTI_SPOOF_CONFIG = {
    # Aktifkan/nonaktifkan anti-spoofing. Default: False (tidak aktif).
    'enabled': False,

    # Folder tempat menyimpan file .pth model MiniFASNet.
    # Buat folder ini dan letakkan file .pth di dalamnya secara manual.
    'model_dir': str(_CURRENT_DIR / "resources" / "anti_spoof_models"),

    # Path ke hasil clone SilentFaceAntiSpoofing repository.
    # Clone di root proyek: git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing SilentFaceAntiSpoofing
    'spoof_lib_path': str(_CURRENT_DIR.parent / "SilentFaceAntiSpoofing"),

    # Model default yang digunakan (ringan, ~0.4M params, ~1.6MB).
    # Tersedia: 2.7_80x80_MiniFASNetV2.pth, 4_0_0_80x80_MiniFASNetV1SE.pth
    'default_model': "2.7_80x80_MiniFASNetV2.pth",

    # Threshold probability untuk klasifikasi "REAL".
    # Turunkan (0.3-0.4) untuk lebih sensitif, naikkan (0.6-0.7) untuk lebih strict.
    'real_threshold': 0.5,

    # Device inferensi: None = auto-detect (CUDA jika ada, fallback CPU).
    'device': None,

    # Scale factor untuk crop wajah sebelum anti-spoofing.
    # 2.7 sesuai dengan paper MiniFASNet (context wajah lebih lebar diperlukan).
    'scale_factor': 2.7,

    # Jika True, jalankan semua model .pth dan lakukan majority voting.
    # Jika False, hanya gunakan default_model.
    'use_multi_model_voting': False,
}


def get_quality_weights(quality_score: float) -> dict:
    """
    Calculate fusion weights based on quality score.

    Formula (Revisi - CNN dan LBPH Seimbang 50:50):
    wCNN = clip(0.50 + 0.10(Q - 0.5), 0.40, 0.60)
    wLBPH = 1 - wCNN

    Range:
    - CNN: 40% - 60% (seimbang)
    - LBPH: 40% - 60% (seimbang)

    Args:
        quality_score: Q ∈ [0, 1]

    Returns:
        Dictionary dengan w_lbph dan w_mobilefacenet
    """
    cfg = FUSION_CONFIG['weight']

    # wCNN = clip(base + slope * (Q - 0.5), min_cnn, max_cnn)
    w_cnn = cfg['base_cnn'] + cfg['slope'] * (quality_score - 0.5)
    w_cnn = max(cfg['min_cnn'], min(cfg['max_cnn'], w_cnn))

    # wLBPH = 1 - wCNN
    w_lbph = 1.0 - w_cnn

    return {
        'lbph': w_lbph,
        'mobilefacenet': w_cnn
    }
