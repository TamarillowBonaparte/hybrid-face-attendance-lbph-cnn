import enum
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Enum, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class StatusGeolokasiEnum(str, enum.Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class Geolokasi(Base):
    __tablename__ = "geolokasi"

    id_geolokasi: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nama_lokasi: Mapped[str] = mapped_column(String(100), nullable=False)
    deskripsi: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 8), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(11, 8), nullable=False)
    radius_meter: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    status: Mapped[StatusGeolokasiEnum] = mapped_column(
        Enum(StatusGeolokasiEnum), nullable=False, default=StatusGeolokasiEnum.aktif
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    # Relationships
    pertemuan_list: Mapped[list["Pertemuan"]] = relationship(
        "Pertemuan", back_populates="geolokasi", foreign_keys="Pertemuan.id_geolokasi"
    )
