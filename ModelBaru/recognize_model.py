"""
Recognition and Accuracy Test Tool
==================================
Pakai model utama ModelBaru: EnhancedFaceRecognitionSystem
(LBPH + MobileFaceNet score-level fusion).

Mode:
- Single image recognition
- Single image verification against expected NIM
- Webcam live recognition / sampled accuracy
- Folder evaluation, where subfolder name is the expected NIM
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import cv2
import logging

_CURRENT_FILE = Path(__file__).resolve()
_MODELBARU_DIR = _CURRENT_FILE.parent
sys.path.insert(0, str(_MODELBARU_DIR))

from config import get_quality_weights
from threshold_calibrator import CalibrationResult
from enhanced_system import EnhancedFaceRecognitionSystem

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _same_id(left: Optional[str], right: Optional[str]) -> bool:
    return bool(left and right and str(left).strip().lower() == str(right).strip().lower())


def _image_files(paths: Iterable[Path]) -> List[Path]:
    images = []
    for path in paths:
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(path)
    return sorted(images)


def apply_test_threshold(system: EnhancedFaceRecognitionSystem, threshold: Optional[float]):
    """Override threshold only for this test process."""
    if threshold is None:
        return

    threshold = float(threshold)
    system.calibrator.calibration = CalibrationResult(
        optimal_threshold=threshold,
        eer_threshold=threshold,
        eer=0.0,
        far_at_optimal=0.0,
        frr_at_optimal=0.0,
        roc_points=0,
        calibration_date="temporary_test_override",
    )
    system.gallery.set_threshold(threshold)
    log.info(f"[Test] Temporary threshold override: {threshold:.4f}")


def best_candidate(result) -> Optional[Dict]:
    if result and result.top_k_results:
        return result.top_k_results[0]
    return None


def _print_quality(system: EnhancedFaceRecognitionSystem, image, verbose: bool) -> Dict:
    preproc = system.preprocessor.detect_and_preprocess(image, for_enrollment=False)
    if preproc["face"] is None:
        log.warning("[!] No face detected")
        return {}

    quality = preproc.get("quality") or {}
    if verbose and quality:
        weights = get_quality_weights(float(quality.get("quality_score", 0.5)))
        log.info("\nQuality")
        log.info(f"  Overall    : {quality['quality_score']:.3f} ({quality['status']})")
        log.info(f"  Blur       : {quality['blur']['score']:.3f} ok={quality['blur']['ok']}")
        log.info(f"  Brightness : {quality['brightness']['score']:.3f} ok={quality['brightness']['ok']}")
        log.info(f"  Pose       : {quality['pose']['score']:.3f} ok={quality['pose']['ok']}")
        log.info("\nFusion Weights")
        log.info(f"  CNN        : {weights['mobilefacenet']:.3f}")
        log.info(f"  LBPH       : {weights['lbph']:.3f}")

    return preproc


def recognize_image(
    system: EnhancedFaceRecognitionSystem,
    image_path: str,
    expected: Optional[str] = None,
    verbose: bool = False,
    update_template: bool = False,
) -> Dict:
    """Recognize one image and optionally verify against expected NIM."""
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Cannot read image: {image_path}")

    log.info("\n" + "=" * 70)
    log.info(f"IMAGE TEST: {image_path}")
    log.info("=" * 70)

    preproc = _print_quality(system, image, verbose)
    if preproc.get("face") is None:
        return {
            "image": str(image_path),
            "expected": expected,
            "predicted": None,
            "recognized": False,
            "score": 0.0,
            "correct": False if expected else None,
            "verified": False if expected else None,
        }

    result = system.recognize(image, update_template=update_template)
    predicted = result.nim if result.is_recognized else None
    best = best_candidate(result)
    correct = _same_id(predicted, expected) if expected else None

    verified = None
    verify_similarity = None
    if expected:
        verified, verify_similarity = system.verify(image, expected)

    log.info("\nResult")
    log.info(f"  Expected   : {expected or '-'}")
    log.info(f"  Predicted  : {predicted or 'Unknown'}")
    if not predicted and best:
        log.info(f"  Best below : {best['nim']} ({best['fused']:.4f})")
    log.info(f"  Final      : {result.similarity:.4f}")
    log.info(f"  CNN        : {result.cnn_similarity:.4f}")
    log.info(f"  LBPH       : {result.lbph_similarity:.4f}")
    log.info(f"  Threshold  : {system.calibrator.get_threshold():.4f}")
    if expected:
        log.info(f"  Correct    : {correct}")
        log.info(f"  Verify     : {verified} ({verify_similarity:.4f})")

    if result.top_k_results:
        log.info("\nTop-3")
        for i, item in enumerate(result.top_k_results[:3], 1):
            marker = " <- expected" if expected and _same_id(item["nim"], expected) else ""
            log.info(
                f"  {i}. {item['nim']}: {item['fused']:.4f} "
                f"(CNN={item['cnn_sim']:.3f}, LBPH={item['lbph_sim']:.3f}){marker}"
            )

    return {
        "image": str(image_path),
        "expected": expected,
        "predicted": predicted,
        "recognized": bool(result.is_recognized),
        "score": float(result.similarity),
        "cnn": float(result.cnn_similarity),
        "lbph": float(result.lbph_similarity),
        "correct": correct,
        "verified": verified,
        "verify_similarity": verify_similarity,
    }


def verify_identity(system: EnhancedFaceRecognitionSystem, image_path: str, nim: str) -> Dict:
    """Verify one image against a specific NIM."""
    return recognize_image(system, image_path, expected=nim, verbose=True, update_template=False)


def evaluate_dataset(
    system: EnhancedFaceRecognitionSystem,
    dataset_dir: str,
    limit_per_identity: int = 0,
) -> Dict:
    """
    Evaluate a folder where each direct subfolder is one NIM.

    Example:
      face_mahasiswa/E41253330/foto_001.jpg
      face_mahasiswa/E41253355/foto_001.jpg
    """
    root = Path(dataset_dir)
    if not root.exists():
        raise ValueError(f"Dataset folder not found: {dataset_dir}")

    samples = []
    for identity_dir in sorted(root.iterdir()):
        if not identity_dir.is_dir():
            continue
        images = _image_files(identity_dir.iterdir())
        if limit_per_identity > 0:
            images = images[:limit_per_identity]
        for image_path in images:
            samples.append((identity_dir.name, image_path))

    if not samples:
        raise ValueError(f"No images found in: {dataset_dir}")

    total = len(samples)
    correct = 0
    verified_ok = 0
    unknown = 0
    wrong = 0
    rows = []

    log.info("\n" + "=" * 70)
    log.info(f"DATASET EVALUATION: {dataset_dir}")
    log.info(f"Samples: {total}")
    log.info(f"Threshold: {system.calibrator.get_threshold():.4f}")
    log.info("=" * 70)

    for index, (expected, image_path) in enumerate(samples, 1):
        image = cv2.imread(str(image_path))
        if image is None:
            log.warning(f"[{index}/{total}] unreadable: {image_path}")
            continue

        result = system.recognize(image, update_template=False)
        predicted = result.nim if result.is_recognized else None
        best = best_candidate(result)
        is_correct = _same_id(predicted, expected)
        verified, verify_similarity = system.verify(image, expected)

        correct += 1 if is_correct else 0
        verified_ok += 1 if verified else 0
        unknown += 1 if predicted is None else 0
        wrong += 1 if predicted is not None and not is_correct else 0

        rows.append({
            "expected": expected,
            "predicted": predicted,
            "score": float(result.similarity),
            "verified": bool(verified),
            "verify_similarity": float(verify_similarity),
            "image": str(image_path),
        })

        status = "OK" if is_correct else ("UNKNOWN" if predicted is None else "WRONG")
        best_text = ""
        if predicted is None and best:
            best_text = f" best={best['nim']}({best['fused']:.4f})"
        log.info(
            f"[{index:03d}/{total:03d}] {status:<7} "
            f"expected={expected:<12} predicted={predicted or 'Unknown':<12} "
            f"score={result.similarity:.4f} verify={verify_similarity:.4f}{best_text}"
        )

    accuracy = correct / total if total else 0.0
    verify_accuracy = verified_ok / total if total else 0.0

    log.info("\n" + "=" * 70)
    log.info("SUMMARY")
    log.info("=" * 70)
    log.info(f"  Top-1 accuracy      : {accuracy:.2%} ({correct}/{total})")
    log.info(f"  Verify accuracy     : {verify_accuracy:.2%} ({verified_ok}/{total})")
    log.info(f"  Unknown             : {unknown}")
    log.info(f"  Wrong identity      : {wrong}")
    log.info(f"  Threshold           : {system.calibrator.get_threshold():.4f}")

    return {
        "total": total,
        "correct": correct,
        "accuracy": accuracy,
        "verified_ok": verified_ok,
        "verify_accuracy": verify_accuracy,
        "unknown": unknown,
        "wrong": wrong,
        "rows": rows,
    }


def webcam_recognition(
    system: EnhancedFaceRecognitionSystem,
    expected: Optional[str] = None,
    camera_index: int = 0,
    samples: int = 0,
    update_template: bool = False,
):
    """
    Webcam live recognition.

    Press:
    - s: save one sample into accuracy counter
    - q: quit
    """
    log.info("\n" + "=" * 70)
    log.info("WEBCAM TEST")
    log.info("=" * 70)

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        log.error(f"[!] Cannot open webcam index {camera_index}")
        return

    log.info(f"Gallery   : {system.get_gallery_size()} identities")
    log.info(f"Threshold : {system.calibrator.get_threshold():.4f}")
    log.info(f"Expected  : {expected or '-'}")
    log.info("Controls  : press 's' to sample, 'q' to quit")

    sampled = 0
    correct = 0
    last_result = None
    last_text = "No sample"
    last_frame_time = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        now = time.time()
        if now - last_frame_time > 0.25:
            last_result = system.recognize(frame, update_template=update_template)
            last_frame_time = now

        result = last_result
        if result is not None:
            predicted = result.nim if result.is_recognized else None
            best = best_candidate(result)
            is_correct = _same_id(predicted, expected) if expected else None
            color = (0, 255, 0) if is_correct else (0, 255, 255)
            if expected and not is_correct:
                color = (0, 0, 255)

            if predicted:
                text = f"{predicted} score={result.similarity:.2f}"
            elif best:
                text = f"Unknown best={best['nim']} score={best['fused']:.2f}"
            else:
                text = f"Unknown score={result.similarity:.2f}"
            cv2.putText(frame, text, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

            if expected:
                verified, verify_similarity = system.verify(frame, expected)
                verify_text = f"verify {expected}: {verify_similarity:.2f} {'MATCH' if verified else 'NO'}"
                cv2.putText(frame, verify_text, (12, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

        if expected and sampled:
            acc = correct / sampled
            last_text = f"Samples={sampled} Correct={correct} Acc={acc:.1%}"
        elif samples:
            last_text = f"Samples={sampled}/{samples}"

        cv2.putText(frame, last_text, (12, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(frame, "s=sample  q=quit", (12, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
        cv2.imshow("ModelBaru Accuracy Test", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == ord("s") and result is not None:
            sampled += 1
            predicted = result.nim if result.is_recognized else None
            best = best_candidate(result)
            is_correct = _same_id(predicted, expected) if expected else None
            if is_correct:
                correct += 1
            log.info(
                f"[sample {sampled}] expected={expected or '-'} "
                f"predicted={predicted or 'Unknown'} score={result.similarity:.4f} "
                f"best={best['nim'] if best else '-'} "
                f"best_score={best['fused'] if best else 0.0:.4f} correct={is_correct}"
            )
            if samples > 0 and sampled >= samples:
                break

    cap.release()
    cv2.destroyAllWindows()

    if expected and sampled:
        log.info("\nWebcam Accuracy")
        log.info(f"  Accuracy : {correct / sampled:.2%} ({correct}/{sampled})")


def show_gallery(system: EnhancedFaceRecognitionSystem):
    log.info("\n" + "=" * 70)
    log.info("GALLERY")
    log.info("=" * 70)
    log.info(f"Identities : {system.get_gallery_size()}")
    log.info(f"Threshold  : {system.calibrator.get_threshold():.4f}")
    metadata_path = _MODELBARU_DIR / "models" / "face_metadata.pkl"
    if metadata_path.exists():
        modified = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(metadata_path.stat().st_mtime))
        log.info(f"Metadata   : {metadata_path} ({modified})")

    for nim in sorted(system.list_identities()):
        info = system.gallery.get_identity_info(nim)
        if info:
            log.info(
                f"  - {nim}: Q={info.quality_score:.2f}, "
                f"photos={info.num_registrations}, "
                f"enrolled={info.enrollment_date[:10] if info.enrollment_date else 'N/A'}"
            )


def main():
    parser = argparse.ArgumentParser(description="Test ModelBaru face recognition")
    parser.add_argument("--image", "-i", type=str, help="single image path")
    parser.add_argument("--expected", "-e", type=str, help="expected NIM for accuracy/verification")
    parser.add_argument("--verify", "-v", type=str, help="alias for --expected")
    parser.add_argument("--dataset", "-d", type=str, help="folder with NIM subfolders")
    parser.add_argument("--limit", type=int, default=0, help="limit images per identity for dataset mode")
    parser.add_argument("--camera", "-c", action="store_true", help="webcam mode")
    parser.add_argument("--camera-index", type=int, default=0, help="webcam index")
    parser.add_argument("--samples", type=int, default=0, help="stop webcam after N manual samples")
    parser.add_argument("--threshold", type=float, help="temporary threshold for this test only")
    parser.add_argument("--gallery", "-g", action="store_true", help="show enrolled gallery")
    parser.add_argument("--verbose", action="store_true", help="show quality details")
    parser.add_argument("--update-template", action="store_true", help="allow template update during test")

    args = parser.parse_args()
    expected = args.expected or args.verify

    system = EnhancedFaceRecognitionSystem()
    apply_test_threshold(system, args.threshold)

    if args.gallery:
        show_gallery(system)
    elif args.dataset:
        evaluate_dataset(system, args.dataset, args.limit)
    elif args.camera:
        webcam_recognition(
            system,
            expected=expected,
            camera_index=args.camera_index,
            samples=args.samples,
            update_template=args.update_template,
        )
    elif args.image:
        recognize_image(
            system,
            args.image,
            expected=expected,
            verbose=args.verbose,
            update_template=args.update_template,
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
