"""
Re-Enrollment Script — Multi-Template Embedding
================================================
Script untuk re-enroll semua mahasiswa dengan strategi embedding baru:
- CNN: Quality-Weighted Centroid + Multi-Template (max-similarity matching)
- LBPH: Multi-template dari semua foto + augmentasi dari top-2
- L1-norm konsisten untuk LBPH (histogram intersection)

Jalankan setelah perbaikan kode untuk menghasilkan gallery baru.

Usage:
    python reenroll_improved.py
    python reenroll_improved.py --reset   # Hapus gallery lama sebelum enroll

Author: Skripsi 2026
"""

import os
import sys
import logging
from pathlib import Path

# Setup path
_CURRENT_FILE = Path(__file__).resolve()
_MODELBARU_DIR = _CURRENT_FILE.parent
sys.path.insert(0, str(_MODELBARU_DIR))

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
logging.basicConfig(level=logging.INFO, format='%(message)s')
log = logging.getLogger(__name__)

from config import FACE_MAHASISWA_DIR, DATABASE_CONFIG
from enhanced_system import EnhancedFaceRecognitionSystem

import cv2


def reset_gallery():
    """Hapus semua file gallery lama."""
    gallery_files = [
        DATABASE_CONFIG['metadata'],
        DATABASE_CONFIG['faiss_index'],
        DATABASE_CONFIG['calibration'],
        DATABASE_CONFIG['templates'],
        _MODELBARU_DIR / "models" / "face_gallery.pkl",
        _MODELBARU_DIR / "models" / "face_gallery_faiss",
    ]
    for path in gallery_files:
        if path.exists() and path.is_file():
            os.remove(path)
            log.info(f"[*] Deleted: {path.name}")


def reenroll_all(reset: bool = False):
    """Re-enroll semua mahasiswa."""
    log.info("=" * 60)
    log.info("RE-ENROLLMENT — Multi-Template Embedding")
    log.info("=" * 60)

    if reset:
        log.info("\n[*] Resetting gallery...")
        reset_gallery()

    # Initialize system
    log.info("\n[*] Initializing system...")
    system = EnhancedFaceRecognitionSystem()
    log.info(f"[*] Current gallery size: {system.get_gallery_size()}")

    # Find identities
    identities = []
    for nim_dir in sorted(FACE_MAHASISWA_DIR.iterdir()):
        if not nim_dir.is_dir():
            continue
        images = sorted([
            str(f) for f in nim_dir.iterdir()
            if f.suffix.lower() in {'.jpg', '.jpeg', '.png'}
        ])
        if images:
            identities.append((nim_dir.name, images))

    log.info(f"\n[*] Found {len(identities)} identities to enroll")

    # Enroll each
    success = 0
    failed = 0
    for nim, image_paths in identities:
        log.info(f"\n{'─'*60}")
        log.info(f"[*] Enrolling {nim} ({len(image_paths)} foto)")

        # Remove existing (if re-enrolling)
        if nim in system.list_identities():
            system.remove_identity(nim)

        # Enroll
        result = system.enroll_from_images(nim, image_paths)
        if result:
            success += 1
            log.info(f"[OK] {nim} enrolled successfully")
        else:
            failed += 1
            log.info(f"[FAIL] {nim} enrollment failed")

    # Summary
    log.info(f"\n{'='*60}")
    log.info(f"RE-ENROLLMENT COMPLETE")
    log.info(f"{'='*60}")
    log.info(f"  Success: {success}/{len(identities)}")
    log.info(f"  Failed:  {failed}/{len(identities)}")
    log.info(f"  Gallery: {system.get_gallery_size()} identities")

    # Gallery quality info
    stats = system.get_gallery_info()
    log.info(f"\n  Gallery Quality Stats:")
    log.info(f"    Count:       {stats.get('count', 0)}")
    log.info(f"    Avg Quality: {stats.get('avg_quality', 0):.2f}")
    log.info(f"    Min Quality: {stats.get('min_quality', 0):.2f}")
    log.info(f"    Max Quality: {stats.get('max_quality', 0):.2f}")

    # Per-identity detail
    log.info(f"\n  Per-Identity Detail:")
    for nim in system.list_identities():
        info = system.gallery.get_identity_info(nim)
        n_templates = len(system.gallery.cnn_templates.get(nim, []))
        n_lbph = len(system.gallery.lbph_gallery.get(nim, []))
        if info:
            log.info(f"    {nim}: Q={info.quality_score:.2f}, "
                     f"CNN templates={n_templates}, "
                     f"LBPH templates={n_lbph}, "
                     f"fotos={info.num_registrations}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Re-enroll semua mahasiswa (Multi-Template)")
    parser.add_argument("--reset", action="store_true",
                        help="Hapus gallery lama sebelum re-enroll")
    args = parser.parse_args()

    reenroll_all(reset=args.reset)
