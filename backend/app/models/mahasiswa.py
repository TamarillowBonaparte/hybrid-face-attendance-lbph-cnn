import enum
from sqlalchemy import BigInteger, String, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.config.database import Base


class JenisKelaminEnum(str, enum.Enum):
    L = "L"
    P = "P"


class StatusMahasiswaEnum(str, enum.Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"
    lulus = "lulus"
    cuti = "cuti"


class Mahasiswa(Base):
    __tablename__ = "mahasiswa"

    id_mahasiswa: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nim: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nama_mahasiswa: Mapped[str] = mapped_column(String(100), nullable=False)
    jenis_kelamin: Mapped[JenisKelaminEnum | None] = mapped_column(Enum(JenisKelaminEnum), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    no_hp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    id_prodi: Mapped[int] = mapped_column(BigInteger, ForeignKey("prodi.id_prodi", ondelete="RESTRICT"), nullable=False)
    id_angkatan: Mapped[int] = mapped_column(BigInteger, ForeignKey("angkatan.id_angkatan", ondelete="RESTRICT"), nullable=False)
    id_golongan: Mapped[int] = mapped_column(BigInteger, ForeignKey("golongan.id_golongan", ondelete="RESTRICT"), nullable=False)
    id_kelas: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("kelas.id", ondelete="SET NULL"), nullable=True)
    foto_profil: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[StatusMahasiswaEnum] = mapped_column(Enum(StatusMahasiswaEnum), nullable=False, default=StatusMahasiswaEnum.aktif)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), server_default=func.now(), onupdate=func.now())

    # Relationships
    prodi: Mapped["Prodi"] = relationship("Prodi", back_populates="mahasiswa_list")
    angkatan: Mapped["Angkatan"] = relationship("Angkatan", back_populates="mahasiswa_list")
    golongan: Mapped["Golongan"] = relationship("Golongan", back_populates="mahasiswa_list")
    kelas: Mapped["Kelas"] = relationship("Kelas", back_populates="mahasiswa_list", foreign_keys=[id_kelas])
    presensi_list: Mapped[list["Presensi"]] = relationship("Presensi", back_populates="mahasiswa")
    dataset_wajah_list: Mapped[list["DatasetWajah"]] = relationship("DatasetWajah", back_populates="mahasiswa")
    registrasi_wajah_list: Mapped[list["RegistrasiWajah"]] = relationship("RegistrasiWajah", back_populates="mahasiswa")
    log_deteksi_list: Mapped[list["LogDeteksi"]] = relationship("LogDeteksi", back_populates="mahasiswa")
