from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum
from datetime import datetime


# ── User / Auth Schemas ──────────────────────────────────────────────────────

class UserRoleEnum(str, Enum):
    admin = "admin"
    dosen = "dosen"
    mahasiswa = "mahasiswa"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRoleEnum = UserRoleEnum.mahasiswa


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRoleEnum] = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRoleEnum
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ── Prodi Schemas ────────────────────────────────────────────────────────────

class ProdiCreate(BaseModel):
    kode_prodi: str
    nama_prodi: str
    jenjang: Optional[str] = None


class ProdiUpdate(BaseModel):
    kode_prodi: Optional[str] = None
    nama_prodi: Optional[str] = None
    jenjang: Optional[str] = None


class ProdiResponse(ProdiCreate):
    id_prodi: int
    model_config = {"from_attributes": True}


# ── Angkatan Schemas ─────────────────────────────────────────────────────────

class AngkatanCreate(BaseModel):
    tahun_angkatan: int


class AngkatanUpdate(BaseModel):
    tahun_angkatan: Optional[int] = None


class AngkatanResponse(AngkatanCreate):
    id_angkatan: int
    model_config = {"from_attributes": True}


# ── Golongan Schemas ─────────────────────────────────────────────────────────

class GolonganCreate(BaseModel):
    nama_golongan: str


class GolonganUpdate(BaseModel):
    nama_golongan: Optional[str] = None


class GolonganResponse(GolonganCreate):
    id_golongan: int
    model_config = {"from_attributes": True}


# ── MataKuliah Schemas ───────────────────────────────────────────────────────

class MataKuliahCreate(BaseModel):
    kode_matakuliah: str
    nama_matakuliah: str
    sks: int


class MataKuliahUpdate(BaseModel):
    kode_matakuliah: Optional[str] = None
    nama_matakuliah: Optional[str] = None
    sks: Optional[int] = None


class MataKuliahResponse(MataKuliahCreate):
    id_matakuliah: int
    model_config = {"from_attributes": True}
