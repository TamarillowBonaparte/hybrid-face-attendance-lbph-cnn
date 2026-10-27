"""
Enhanced Enrollment Script (Revisi)
================================
Enrollment dengan Quality-Aware Score-Level Fusion.

Author: Skripsi 2026
"""

import os
import sys
import cv2
import logging
from pathlib import Path
from typing import List
import argparse

_CURRENT_FILE = Path(__file__).resolve()
_MODELBARU_DIR = _CURRENT_FILE.parent
sys.path.insert(0, str(_MODELBARU_DIR))

from config import FACE_MAHASISWA_DIR, ENROLLMENT_CONFIG
from enhanced_system import EnhancedFaceRecognitionSystem

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
logging.basicConfig(level=logging.INFO, format='%(message)s')
log = logging.getLogger(__name__)


def enroll_single(
    system: EnhancedFaceRecognitionSystem,
    nim: str,
    image_paths: List[str]
) -> bool:
    """Enroll single identity."""
    log.info(f"\n{'='*60}")
    log.info(f"ENROLLING: {nim}")
    log.info(f"{'='*60}")

    frames = []
    for path in image_paths:
        if isinstance(path, str):
            img = cv2.imread(str(path))
        else:
            img = path
        if img is not None:
            frames.append(img)

    if len(frames) == 0:
        log.error(f"[FAIL] No valid images for {nim}")
        return False

    log.info(f"  Loaded {len(frames)} images")
    return system.enroll(nim, frames)


def enroll_directory(system: EnhancedFaceRecognitionSystem) -> dict:
    """Batch enrollment from face_mahasiswa directory."""
    log.info(f"\n{'='*60}")
    log.info(f"BATCH ENROLLMENT")
    log.info(f"{'='*60}")

    results = {}
    total = 0
    success = 0

    for nim_dir in sorted(FACE_MAHASISWA_DIR.iterdir()):
        if not nim_dir.is_dir():
            continue

        nim = nim_dir.name
        images = [str(f) for f in sorted(nim_dir.iterdir())
                  if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]

        if images:
            total += 1
            results[nim] = enroll_single(system, nim, images)
            if results[nim]:
                success += 1

    log.info(f"\n{'='*60}")
    log.info(f"RESULT: {success}/{total} successful")
    log.info(f"{'='*60}")

    return results


def webcam_enrollment(system: EnhancedFaceRecognitionSystem, nim: str, n_frames: int = 15):
    """Webcam enrollment with auto-capture."""
    log.info(f"\n{'='*60}")
    log.info(f"WEBCAM ENROLLMENT: {nim}")
    log.info(f"{'='*60}")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        log.error("[!] Cannot open webcam")
        return False

    frames = []
    log.info("[*] Press SPACE to capture, 'q' to finish")

    while len(frames) < n_frames:
        ret, frame = cap.read()
        if not ret:
            break

        # Detect face
        result = system.preprocessor.detect_and_preprocess(frame, for_enrollment=True)

        if result['face'] is not None:
            x, y, bw, bh = result['bbox']
            color = (0, 255, 0)
            cv2.rectangle(frame, (x, y), (x+bw, y+bh), color, 2)

            if result['quality']:
                q = result['quality']['quality_score']
                cv2.putText(frame, f"Q: {q:.2f}", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.putText(frame, f"Frames: {len(frames)}/{n_frames}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.imshow('Webcam Enrollment', frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        elif key == ord(' ') or len(frames) < 3:
            if result['face'] is not None:
                frames.append(frame.copy())
                log.info(f"  Captured {len(frames)} (Q: {result['quality']['quality_score']:.2f})")

    cap.release()
    cv2.destroyAllWindows()

    if len(frames) < ENROLLMENT_CONFIG.get('min_frames', 3):
        log.error(f"[FAIL] Only {len(frames)} frames")
        return False

    return system.enroll(nim, frames)


def main():
    parser = argparse.ArgumentParser(description='Face Enrollment (Score-Level Fusion)')
    parser.add_argument('--nim', '-n', type=str, help='NIM/ID')
    parser.add_argument('--images', '-i', type=str, nargs='+', help='Image files')
    parser.add_argument('--batch', '-b', action='store_true', help='Batch enroll')
    parser.add_argument('--webcam', '-w', action='store_true', help='Webcam enrollment')
    parser.add_argument('--frames', '-f', type=int, default=15, help='Frames for webcam')
    parser.add_argument('--gallery', '-g', action='store_true', help='Show gallery')
    parser.add_argument('--remove', '-r', type=str, help='Remove identity')

    args = parser.parse_args()

    system = EnhancedFaceRecognitionSystem()

    if args.gallery:
        log.info(f"\nGallery: {system.get_gallery_size()} identities")
        for nim in system.list_identities():
            info = system.gallery.get_identity_info(nim)
            if info:
                log.info(f"  - {nim}: Q={info.quality_score:.2f}, "
                        f"enrolled={info.enrollment_date[:10] if info.enrollment_date else 'N/A'}")

    elif args.remove:
        system.remove_identity(args.remove)
        log.info(f"[OK] Removed {args.remove}")

    elif args.batch:
        enroll_directory(system)

    elif args.webcam and args.nim:
        if webcam_enrollment(system, args.nim, args.frames):
            log.info(f"\n[OK] {args.nim} enrolled!")

    elif args.nim and args.images:
        if enroll_single(system, args.nim, args.images):
            log.info(f"\n[OK] {args.nim} enrolled!")
        else:
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
