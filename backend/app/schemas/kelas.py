from typing import Optional

from pydantic import BaseModel


class KelasCreate(BaseModel):
    id_prodi: int
    nama_kelas: str
    golongan: Optional[str] = None
    angkatan: Optional[int] = None
    tahun_ajaran: Optional[str] = None
    keterangan: Optional[str] = None


class KelasUpdate(BaseModel):
    id_prodi: Optional[int] = None
    nama_kelas: Optional[str] = None
    golongan: Optional[str] = None
    angkatan: Optional[int] = None
    tahun_ajaran: Optional[str] = None
    keterangan: Optional[str] = None


class KelasResponse(BaseModel):
    id: int
    id_prodi: int
    nama_kelas: str
    golongan: Optional[str] = None
    angkatan: Optional[int] = None
    tahun_ajaran: Optional[str] = None
    keterangan: Optional[str] = None

    model_config = {"from_attributes": True}
