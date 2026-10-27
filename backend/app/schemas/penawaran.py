from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import datetime


# ── Enums ─────────────────────────────────────────────────────────────────────

class StatusPenawaranEnum(str, Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class RolePengajarEnum(str, Enum):
    koordinator = "koordinator"
    anggota = "anggota"


# ── Penawaran Mata Kuliah ─────────────────────────────────────────────────────

class PenawaranCreate(BaseModel):
    id_matakuliah: int
    semester: int
    tahun_ajaran: str
    status: StatusPenawaranEnum = StatusPenawaranEnum.aktif


class PenawaranUpdate(BaseModel):
    semester: Optional[int] = None
    tahun_ajaran: Optional[str] = None
    status: Optional[StatusPenawaranEnum] = None


class PenawaranResponse(PenawaranCreate):
    id_penawaran: int
    created_at: Optional[datetime] = None
    # Derived/joined fields
    nama_matakuliah: Optional[str] = None
    kode_matakuliah: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Penawaran Kelas ───────────────────────────────────────────────────────────

class PenawaranKelasCreate(BaseModel):
    id_penawaran: int
    id_prodi: int
    id_angkatan: int
    id_golongan: int


class PenawaranKelasUpdate(BaseModel):
    id_prodi: Optional[int] = None
    id_angkatan: Optional[int] = None
    id_golongan: Optional[int] = None


class PenawaranKelasResponse(PenawaranKelasCreate):
    id: int
    # Derived/joined fields
    kode_prodi: Optional[str] = None
    tahun_angkatan: Optional[int] = None
    nama_golongan: Optional[str] = None
    nama_kelas: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Pengajar ──────────────────────────────────────────────────────────────────

class PengajarCreate(BaseModel):
    id_penawaran: int
    id_dosen: int
    role: RolePengajarEnum = RolePengajarEnum.anggota


class PengajarUpdate(BaseModel):
    role: Optional[RolePengajarEnum] = None


class PengajarResponse(PengajarCreate):
    id_pengajar: int
    # Derived/joined fields
    nama_dosen: Optional[str] = None
    nidn: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Pengajar Pertemuan ────────────────────────────────────────────────────────

class PengajarPertemuanCreate(BaseModel):
    id_pertemuan: int
    id_dosen: int


class PengajarPertemuanResponse(PengajarPertemuanCreate):
    id: int
    # Derived/joined fields
    nama_dosen: Optional[str] = None
    nidn: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Composite Response (full detail dengan nested data) ───────────────────────

class PenawaranDetailResponse(BaseModel):
    id_penawaran: int
    id_matakuliah: int
    kode_matakuliah: Optional[str] = None
    nama_matakuliah: Optional[str] = None
    semester: int
    tahun_ajaran: str
    status: StatusPenawaranEnum
    created_at: Optional[datetime] = None
    kelas_list: List[PenawaranKelasResponse] = []
    pengajar_list: List[PengajarResponse] = []
    model_config = {"from_attributes": True}
