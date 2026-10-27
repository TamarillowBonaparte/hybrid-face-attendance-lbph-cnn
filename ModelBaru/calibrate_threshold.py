"""Calibrate ModelBaru's score-level threshold from a labelled holdout set.

The calibration is zero-shot: it does not train a classifier.  It only
measures the existing LBPH + MobileFaceNet fused score for genuine and
impostor comparisons, then selects an ROC/EER operating threshold.

Dataset layout:
    validation_root/
        NIM_1/query_01.jpg
        NIM_2/query_01.jpg

The validation images must be separate captures from the enrollment images.
"""

import argparse
import logging
import sys
from pathlib import Path

import cv2
import numpy as np

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from enhanced_system import EnhancedFaceRecognitionSystem


IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}


def collect_scores(system, dataset_root: Path, limit_per_identity: int = 0):
    genuine = []
    impostor = []
    skipped = 0

    for identity_dir in sorted(dataset_root.iterdir()):
        if not identity_dir.is_dir():
            continue
        expected = identity_dir.name
        if expected not in system.list_identities():
            logging.warning("Skipping %s: identity is not enrolled", expected)
            continue

        image_paths = sorted(
            p for p in identity_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        )
        if limit_per_identity > 0:
            image_paths = image_paths[:limit_per_identity]

        for image_path in image_paths:
            image = cv2.imread(str(image_path))
            if image is None:
                skipped += 1
                continue

            pre = system.preprocessor.detect_and_preprocess(
                image, for_enrollment=False
            )
            if pre['face'] is None:
                skipped += 1
                continue

            face = pre['aligned_face'] if pre['aligned_face'] is not None else pre['face']
            lbph, cnn = system._extract_features(face)
            lbph = lbph / (lbph.sum() + 1e-7)
            cnn = cnn / (np.linalg.norm(cnn) + 1e-7)
            quality = pre['quality']['quality_score'] if pre['quality'] else 0.5

            # Score the same query against every enrolled identity.  The
            # expected identity is a genuine comparison; all others are
            # impostor comparisons for the same real query.
            for enrolled in system.list_identities():
                _, score = system.gallery.verify_identity(
                    enrolled,
                    cnn,
                    lbph,
                    quality_score=quality,
                    threshold=0.0,
                )
                if enrolled == expected:
                    genuine.append(float(score))
                else:
                    impostor.append(float(score))

    return genuine, impostor, skipped


def main():
    parser = argparse.ArgumentParser(
        description='Kalibrasi threshold ROC/EER untuk ModelBaru'
    )
    parser.add_argument('dataset', help='Folder validasi berisi subfolder per NIM')
    parser.add_argument('--limit-per-identity', type=int, default=0)
    args = parser.parse_args()

    root = Path(args.dataset).resolve()
    if not root.is_dir():
        raise SystemExit(f'Dataset tidak ditemukan: {root}')

    logging.basicConfig(level=logging.INFO, format='%(message)s')
    system = EnhancedFaceRecognitionSystem()
    genuine, impostor, skipped = collect_scores(
        system, root, args.limit_per_identity
    )

    print(f'Genuine scores : {len(genuine)}')
    print(f'Impostor scores: {len(impostor)}')
    print(f'Skipped        : {skipped}')

    if len(genuine) < 10 or len(impostor) < 10:
        raise SystemExit(
            'Data kalibrasi belum cukup. Sediakan minimal 10 genuine dan 10 impostor scores.'
        )

    result = system.calibrator.calibrate(genuine, impostor)
    system.gallery.set_threshold(result.optimal_threshold)
    print(f'Threshold      : {result.optimal_threshold:.4f}')
    print(f'FAR            : {result.far_at_optimal:.4f}')
    print(f'FRR            : {result.frr_at_optimal:.4f}')
    print(f'EER            : {result.eer:.4f}')
    print('Tersimpan      : ModelBaru/models/threshold_calibration.json')


if __name__ == '__main__':
    main()
