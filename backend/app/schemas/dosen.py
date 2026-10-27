from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum
from datetime import datetime


# ── Dosen Schemas ────────────────────────────────────────────────────────────

class StatusDosenEnum(str, Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class DosenCreate(BaseModel):
    nidn: str
    nama_dosen: str
    email: Optional[EmailStr] = None
    no_hp: Optional[str] = None
    status: StatusDosenEnum = StatusDosenEnum.aktif


class DosenUpdate(BaseModel):
    nidn: Optional[str] = None
    nama_dosen: Optional[str] = None
    email: Optional[EmailStr] = None
    no_hp: Optional[str] = None
    status: Optional[StatusDosenEnum] = None


class DosenResponse(DosenCreate):
    id_dosen: int
    model_config = {"from_attributes": True}


# ── Mahasiswa Schemas ────────────────────────────────────────────────────────

class JenisKelaminEnum(str, Enum):
    L = "L"
    P = "P"


class StatusMahasiswaEnum(str, Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"
    lulus = "lulus"
    cuti = "cuti"


class MahasiswaCreate(BaseModel):
    nim: str
    nama_mahasiswa: str
    jenis_kelamin: Optional[JenisKelaminEnum] = None
    email: Optional[EmailStr] = None
    no_hp: Optional[str] = None
    id_prodi: int
    id_angkatan: int
    id_golongan: int
    id_kelas: Optional[int] = None
    foto_profil: Optional[str] = None
    status: StatusMahasiswaEnum = StatusMahasiswaEnum.aktif


class MahasiswaUpdate(BaseModel):
    nim: Optional[str] = None
    nama_mahasiswa: Optional[str] = None
    jenis_kelamin: Optional[JenisKelaminEnum] = None
    email: Optional[EmailStr] = None
    no_hp: Optional[str] = None
    id_prodi: Optional[int] = None
    id_angkatan: Optional[int] = None
    id_golongan: Optional[int] = None
    id_kelas: Optional[int] = None
    foto_profil: Optional[str] = None
    status: Optional[StatusMahasiswaEnum] = None


class MahasiswaResponse(MahasiswaCreate):
    id_mahasiswa: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
