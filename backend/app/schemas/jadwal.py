from datetime import date, datetime, time
from enum import Enum
from typing import Optional

from pydantic import BaseModel

# ── Jadwal Schemas ───────────────────────────────────────────────────────────


class HariEnum(str, Enum):
    senin = "Senin"
    selasa = "Selasa"
    rabu = "Rabu"
    kamis = "Kamis"
    jumat = "Jumat"
    sabtu = "Sabtu"
    minggu = "Minggu"


class StatusJadwalEnum(str, Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class JadwalCreate(BaseModel):
    id_penawaran: int
    hari: HariEnum
    jam_mulai: time
    jam_selesai: time
    ruangan: Optional[str] = None
    status: StatusJadwalEnum = StatusJadwalEnum.aktif


class JadwalFromMatakuliahCreate(BaseModel):
    """Buat jadwal langsung dari mata kuliah — auto-create penawaran jika belum ada."""

    id_matakuliah: int
    semester: int
    tahun_ajaran: str  # e.g. "2024/2025"
    hari: HariEnum
    jam_mulai: time
    jam_selesai: time
    ruangan: Optional[str] = None
    id_kelas: Optional[int] = None  # Jika diisi, langsung tambahkan kelas ke penawaran


class JadwalUpdate(BaseModel):
    id_penawaran: Optional[int] = None
    hari: Optional[HariEnum] = None
    jam_mulai: Optional[time] = None
    jam_selesai: Optional[time] = None
    ruangan: Optional[str] = None
    status: Optional[StatusJadwalEnum] = None


class JadwalResponse(JadwalCreate):
    id_jadwal: int
    # Derived/joined fields from penawaran
    id_matakuliah: Optional[int] = None
    kode_matakuliah: Optional[str] = None
    nama_matakuliah: Optional[str] = None
    semester: Optional[int] = None
    tahun_ajaran: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Pertemuan Schemas ────────────────────────────────────────────────────────


class StatusPertemuanEnum(str, Enum):
    belum = "belum"
    sedang = "sedang"
    selesai = "selesai"
    dibatalkan = "dibatalkan"


class PertemuanCreate(BaseModel):
    id_jadwal: int
    pertemuan_ke: int
    tanggal: date
    batas_presensi: Optional[datetime] = None
    status_pertemuan: StatusPertemuanEnum = StatusPertemuanEnum.belum
    id_geolokasi: Optional[int] = None
    mode_lokasi: str = "bebas"  # "bebas" | "wajib"


class PertemuanUpdate(BaseModel):
    pertemuan_ke: Optional[int] = None
    tanggal: Optional[date] = None
    batas_presensi: Optional[datetime] = None
    status_pertemuan: Optional[StatusPertemuanEnum] = None
    id_geolokasi: Optional[int] = None
    mode_lokasi: Optional[str] = None


class PertemuanResponse(PertemuanCreate):
    id_pertemuan: int
    id_geolokasi: Optional[int] = None
    mode_lokasi: str = "bebas"
    # Derived fields — populated by list endpoint
    nama_matakuliah: Optional[str] = None
    kode_matakuliah: Optional[str] = None
    nama_kelas: Optional[str] = None  # e.g. "TI-2022-A"
    total_mahasiswa: Optional[int] = None
    sudah_hadir: Optional[int] = None
    belum_presensi: Optional[int] = None
    total_hadir: Optional[int] = None  # alias for sudah_hadir
    total_alpa: Optional[int] = None   # students marked as alpha/izin/sakit
    model_config = {"from_attributes": True}


class PertemuanStatusToggle(BaseModel):
    status_pertemuan: StatusPertemuanEnum


class PertemuanBebasCreate(BaseModel):
    """Buat sesi presensi langsung dari matakuliah + kelas, tanpa perlu jadwal yang sudah ada."""

    id_matakuliah: int
    id_kelas: int  # FK ke tabel kelas (bukan penawaran_kelas)
    pertemuan_ke: int
    tanggal: date
    tahun_ajaran: str  # e.g. "2024/2025"
    semester: int = 1
    jam_mulai: Optional[time] = None
    jam_selesai: Optional[time] = None
    id_geolokasi: Optional[int] = None
    mode_lokasi: str = "bebas"  # "bebas" | "wajib"


class PertemuanBebasResponse(BaseModel):
    id_pertemuan: int
    id_jadwal: int
    pertemuan_ke: int
    tanggal: str
    status_pertemuan: str
    nama_mk: str
    kode_mk: str
    nama_kelas: str
    total_mahasiswa: int
