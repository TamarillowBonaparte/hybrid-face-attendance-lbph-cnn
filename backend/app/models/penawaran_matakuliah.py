import enum
from sqlalchemy import BigInteger, Integer, String, Enum, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.config.database import Base


class StatusPenawaranEnum(str, enum.Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class RolePengajarEnum(str, enum.Enum):
    koordinator = "koordinator"
    anggota = "anggota"


# ─── Penawaran Mata Kuliah ────────────────────────────────────────────────────

class PenawaranMatakuliah(Base):
    __tablename__ = "penawaran_matakuliah"

    id_penawaran: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_matakuliah: Mapped[int] = mapped_column(BigInteger, ForeignKey("matakuliah.id_matakuliah", ondelete="CASCADE"), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    tahun_ajaran: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[StatusPenawaranEnum] = mapped_column(Enum(StatusPenawaranEnum), nullable=False, default=StatusPenawaranEnum.aktif)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    matakuliah: Mapped["MataKuliah"] = relationship("MataKuliah", back_populates="penawaran_list")
    penawaran_kelas_list: Mapped[list["PenawaranKelas"]] = relationship("PenawaranKelas", back_populates="penawaran", cascade="all, delete-orphan")
    pengajar_list: Mapped[list["Pengajar"]] = relationship("Pengajar", back_populates="penawaran", cascade="all, delete-orphan")
    jadwal_list: Mapped[list["Jadwal"]] = relationship("Jadwal", back_populates="penawaran", cascade="all, delete-orphan", passive_deletes=True)


# ─── Penawaran Kelas ──────────────────────────────────────────────────────────

class PenawaranKelas(Base):
    __tablename__ = "penawaran_kelas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_penawaran: Mapped[int] = mapped_column(BigInteger, ForeignKey("penawaran_matakuliah.id_penawaran", ondelete="CASCADE"), nullable=False)
    id_prodi: Mapped[int] = mapped_column(BigInteger, ForeignKey("prodi.id_prodi", ondelete="RESTRICT"), nullable=False)
    id_angkatan: Mapped[int] = mapped_column(BigInteger, ForeignKey("angkatan.id_angkatan", ondelete="RESTRICT"), nullable=False)
    id_golongan: Mapped[int] = mapped_column(BigInteger, ForeignKey("golongan.id_golongan", ondelete="RESTRICT"), nullable=False)

    # Relationships
    penawaran: Mapped["PenawaranMatakuliah"] = relationship("PenawaranMatakuliah", back_populates="penawaran_kelas_list")
    prodi: Mapped["Prodi"] = relationship("Prodi", back_populates="penawaran_kelas_list")
    angkatan: Mapped["Angkatan"] = relationship("Angkatan", back_populates="penawaran_kelas_list")
    golongan: Mapped["Golongan"] = relationship("Golongan", back_populates="penawaran_kelas_list")


# ─── Pengajar ────────────────────────────────────────────────────────────────

class Pengajar(Base):
    __tablename__ = "pengajar"

    id_pengajar: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_penawaran: Mapped[int] = mapped_column(BigInteger, ForeignKey("penawaran_matakuliah.id_penawaran", ondelete="CASCADE"), nullable=False)
    id_dosen: Mapped[int] = mapped_column(BigInteger, ForeignKey("dosen.id_dosen", ondelete="RESTRICT"), nullable=False)
    role: Mapped[RolePengajarEnum] = mapped_column(Enum(RolePengajarEnum), nullable=False, default=RolePengajarEnum.anggota)

    # Relationships
    penawaran: Mapped["PenawaranMatakuliah"] = relationship("PenawaranMatakuliah", back_populates="pengajar_list")
    dosen: Mapped["Dosen"] = relationship("Dosen", back_populates="pengajar_list")
