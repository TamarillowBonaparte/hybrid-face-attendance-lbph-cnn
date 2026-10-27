from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class StatusGeolokasiEnum(str, Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class GeolokasiCreate(BaseModel):
    nama_lokasi: str = Field(..., max_length=100, description="Nama lokasi presensi")
    deskripsi: Optional[str] = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    radius_meter: int = Field(default=100, ge=10, le=10000, description="Radius validasi dalam meter")
    status: StatusGeolokasiEnum = StatusGeolokasiEnum.aktif


class GeolokasiUpdate(BaseModel):
    nama_lokasi: Optional[str] = Field(None, max_length=100)
    deskripsi: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    radius_meter: Optional[int] = Field(None, ge=10, le=10000)
    status: Optional[StatusGeolokasiEnum] = None


class GeolokasiResponse(BaseModel):
    id_geolokasi: int
    nama_lokasi: str
    deskripsi: Optional[str] = None
    latitude: float
    longitude: float
    radius_meter: int
    status: StatusGeolokasiEnum
    updated_at: datetime

    model_config = {"from_attributes": True}
