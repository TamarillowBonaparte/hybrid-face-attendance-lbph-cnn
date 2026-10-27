from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel

# ── Presensi Schemas ─────────────────────────────────────────────────────────


class StatusPresensiEnum(str, Enum):
    belum = "belum"  # Belum presensi (initial state)
    hadir = "hadir"
    terlambat = "terlambat"
    izin = "izin"
    sakit = "sakit"
    alpha = "alpha"


class PresensiCreate(BaseModel):
    id_mahasiswa: int
    id_pertemuan: int
    status_presensi: StatusPresensiEnum = StatusPresensiEnum.belum
    waktu_presensi: Optional[datetime] = None
    foto_verifikasi: Optional[str] = None
    confidence_score: Optional[float] = None
    lbph_score: Optional[float] = None
    cnn_score: Optional[float] = None
    metode_deteksi: Optional[str] = None


class PresensiUpdate(BaseModel):
    status_presensi: Optional[StatusPresensiEnum] = None
    waktu_presensi: Optional[datetime] = None
    foto_verifikasi: Optional[str] = None
    confidence_score: Optional[float] = None
    lbph_score: Optional[float] = None
    cnn_score: Optional[float] = None
    metode_deteksi: Optional[str] = None


class PresensiResponse(PresensiCreate):
    id_presensi: int
    latitude_presensi: Optional[float] = None
    longitude_presensi: Optional[float] = None
    jarak_meter: Optional[float] = None
    model_config = {"from_attributes": True}


class FaceRecognitionAbsenRequest(BaseModel):
    """Request dari ML model setelah deteksi wajah berhasil."""

    id_pertemuan: int
    id_mahasiswa: int
    confidence_score: float
    lbph_score: Optional[float] = None
    cnn_score: Optional[float] = None
    metode_deteksi: Optional[str] = None
    foto_verifikasi: Optional[str] = None
    # Geolocation (wajib dikirim jika pertemuan mode_lokasi == 'wajib')
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class RekapPresensiResponse(BaseModel):
    id_mahasiswa: int
    nim: str
    nama_mahasiswa: str
    total_hadir: int
    total_terlambat: int
    total_izin: int
    total_sakit: int
    total_alpha: int
    total_pertemuan: int
    persentase_kehadiran: float


# ── Dataset Wajah Schemas ────────────────────────────────────────────────────


class JenisFotoEnum(str, Enum):
    registrasi = "registrasi"
    training = "training"
    augmentasi = "augmentasi"


class DatasetWajahUpdate(BaseModel):
    jenis_foto: Optional[JenisFotoEnum] = None
    digunakan_training: Optional[int] = None


class DatasetWajahResponse(BaseModel):
    id_dataset: int
    id_mahasiswa: int
    foto_path: str
    jenis_foto: JenisFotoEnum
    digunakan_training: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Registrasi Wajah Schemas ─────────────────────────────────────────────────


class StatusRegistrasiEnum(str, Enum):
    pending = "pending"
    berhasil = "berhasil"
    gagal = "gagal"


class RegistrasiWajahCreate(BaseModel):
    id_mahasiswa: int
    jumlah_foto: int = 0
    similarity_check: Optional[float] = None
    status_registrasi: StatusRegistrasiEnum = StatusRegistrasiEnum.pending


class RegistrasiWajahUpdate(BaseModel):
    jumlah_foto: Optional[int] = None
    similarity_check: Optional[float] = None
    status_registrasi: Optional[StatusRegistrasiEnum] = None


class RegistrasiWajahResponse(RegistrasiWajahCreate):
    id_registrasi: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Log Deteksi Schemas ───────────────────────────────────────────────────────


class HasilDeteksiEnum(str, Enum):
    match = "match"
    unknown = "unknown"
    no_face = "no_face"
    error = "error"


class LogDeteksiCreate(BaseModel):
    id_mahasiswa: Optional[int] = None
    lbph_score: Optional[float] = None
    cnn_score: Optional[float] = None
    confidence_score: Optional[float] = None
    predicted_label: Optional[str] = None
    hasil_deteksi: HasilDeteksiEnum
    foto_capture: Optional[str] = None


class LogDeteksiUpdate(BaseModel):
    id_mahasiswa: Optional[int] = None
    lbph_score: Optional[float] = None
    cnn_score: Optional[float] = None
    confidence_score: Optional[float] = None
    predicted_label: Optional[str] = None
    hasil_deteksi: Optional[HasilDeteksiEnum] = None
    foto_capture: Optional[str] = None


class LogDeteksiResponse(LogDeteksiCreate):
    id_log: int
    waktu_deteksi: datetime
    model_config = {"from_attributes": True}
