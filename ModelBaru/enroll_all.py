import sys
import os
import argparse
from pathlib import Path

MODELBARU_DIR = Path(__file__).resolve().parent
FACE_DIR = MODELBARU_DIR / "face_mahasiswa"
MODELS_DIR = MODELBARU_DIR / "models"

CURRENT_GALLERY_FILES = [
    MODELS_DIR / "face_metadata.pkl",
    MODELS_DIR / "face_index.faiss",
]
LEGACY_GALLERY_FILES = [
    MODELS_DIR / "face_gallery.pkl",
    MODELS_DIR / "face_gallery_faiss",
]

sys.path.insert(0, str(MODELBARU_DIR))
from enroll_model import enroll_identity


def find_identities():
    identities = []
    for nim_dir in sorted(FACE_DIR.iterdir()):
        if not nim_dir.is_dir():
            continue
        images = [
            str(path)
            for path in sorted(nim_dir.iterdir())
            if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ]
        if images:
            identities.append((nim_dir.name, images))
    return identities


def reset_gallery():
    for path in CURRENT_GALLERY_FILES + LEGACY_GALLERY_FILES:
        if path.exists() and path.is_file():
            os.remove(path)
            print(f"[*] Deleted {path.name}")


def main():
    parser = argparse.ArgumentParser(description="Enroll semua folder di face_mahasiswa")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="hapus gallery lama sebelum enroll ulang",
    )
    args = parser.parse_args()

    if args.reset:
        reset_gallery()

    identities = find_identities()

    print("=" * 60)
    print("ENROLLING ALL IDENTITIES (LBPH + MobileFaceNet)")
    print("=" * 60)

    success = 0
    for nim, image_paths in identities:
        print(f"\n[*] Enrolling {nim} ({len(image_paths)} foto)...")
        if enroll_identity(nim, image_paths):
            print(f"[OK] {nim} enrolled!")
            success += 1
        else:
            print(f"[FAIL] {nim}")

    print("\n" + "=" * 60)
    print(f"DONE! {success}/{len(identities)} enrolled successfully.")
    print("=" * 60)


if __name__ == "__main__":
    main()
