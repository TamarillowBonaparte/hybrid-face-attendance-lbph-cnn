import enum
from sqlalchemy import BigInteger, Integer, Date, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date, datetime
from app.config.database import Base


class StatusPertemuanEnum(str, enum.Enum):
    belum = "belum"
    sedang = "sedang"
    selesai = "selesai"
    dibatalkan = "dibatalkan"


class ModeLokasikEnum(str, enum.Enum):
    bebas = "bebas"
    wajib = "wajib"


class Pertemuan(Base):
    __tablename__ = "pertemuan"

    id_pertemuan: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_jadwal: Mapped[int] = mapped_column(BigInteger, ForeignKey("jadwal.id_jadwal", ondelete="CASCADE"), nullable=False)
    pertemuan_ke: Mapped[int] = mapped_column(Integer, nullable=False)
    tanggal: Mapped[date] = mapped_column(Date, nullable=False)
    batas_presensi: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status_pertemuan: Mapped[StatusPertemuanEnum] = mapped_column(Enum(StatusPertemuanEnum), nullable=False, default=StatusPertemuanEnum.belum)
    id_geolokasi: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("geolokasi.id_geolokasi", ondelete="SET NULL"), nullable=True)
    mode_lokasi: Mapped[ModeLokasikEnum] = mapped_column(Enum(ModeLokasikEnum), nullable=False, default=ModeLokasikEnum.bebas)

    # Relationships
    jadwal: Mapped["Jadwal"] = relationship("Jadwal", back_populates="pertemuan_list")
    presensi_list: Mapped[list["Presensi"]] = relationship("Presensi", back_populates="pertemuan", cascade="all, delete-orphan")
    pengajar_pertemuan_list: Mapped[list["PengajarPertemuan"]] = relationship("PengajarPertemuan", back_populates="pertemuan", cascade="all, delete-orphan")
    geolokasi: Mapped["Geolokasi | None"] = relationship("Geolokasi", back_populates="pertemuan_list", foreign_keys=[id_geolokasi])
