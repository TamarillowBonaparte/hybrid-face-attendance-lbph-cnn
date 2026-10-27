import os
import shutil
from fastapi import UploadFile
from app.config.settings import settings


def save_upload_file(file: UploadFile, subfolder: str, prefix: str = "") -> str:
    """Simpan file upload ke disk, kembalikan path relatif."""
    save_dir = os.path.join(settings.UPLOAD_DIR, subfolder)
    os.makedirs(save_dir, exist_ok=True)
    filename = f"{prefix}_{file.filename}" if prefix else file.filename
    file_path = os.path.join(save_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return file_path


def save_dataset_file(file: UploadFile, mahasiswa_id: int, nim: str, count: int) -> str:
    """Simpan foto dataset wajah mahasiswa."""
    save_dir = os.path.join(settings.DATASET_DIR, str(mahasiswa_id))
    os.makedirs(save_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "foto.jpg")[1] or ".jpg"
    filename = f"{nim}_{count}{ext}"
    file_path = os.path.join(save_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return file_path


def delete_file_if_exists(path: str) -> bool:
    """Hapus file jika ada."""
    if path and os.path.exists(path):
        os.remove(path)
        return True
    return False
