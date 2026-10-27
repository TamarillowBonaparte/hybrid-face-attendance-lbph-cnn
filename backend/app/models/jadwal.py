import enum
from sqlalchemy import BigInteger, String, Enum, Time, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import time
from app.config.database import Base


class HariEnum(str, enum.Enum):
    senin = "Senin"
    selasa = "Selasa"
    rabu = "Rabu"
    kamis = "Kamis"
    jumat = "Jumat"
    sabtu = "Sabtu"
    minggu = "Minggu"


class StatusJadwalEnum(str, enum.Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class Jadwal(Base):
    __tablename__ = "jadwal"

    id_jadwal: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_penawaran: Mapped[int] = mapped_column(BigInteger, ForeignKey("penawaran_matakuliah.id_penawaran", ondelete="CASCADE"), nullable=False)
    hari: Mapped[HariEnum] = mapped_column(Enum(HariEnum), nullable=False)
    jam_mulai: Mapped[time] = mapped_column(Time, nullable=False)
    jam_selesai: Mapped[time] = mapped_column(Time, nullable=False)
    ruangan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[StatusJadwalEnum] = mapped_column(Enum(StatusJadwalEnum), nullable=False, default=StatusJadwalEnum.aktif)

    # Relationships
    penawaran: Mapped["PenawaranMatakuliah"] = relationship("PenawaranMatakuliah", back_populates="jadwal_list")
    pertemuan_list: Mapped[list["Pertemuan"]] = relationship("Pertemuan", back_populates="jadwal", cascade="all, delete-orphan", passive_deletes=True)
