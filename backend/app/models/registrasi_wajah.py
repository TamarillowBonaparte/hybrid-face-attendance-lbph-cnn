import enum
from sqlalchemy import BigInteger, Integer, Float, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.config.database import Base


class StatusRegistrasiEnum(str, enum.Enum):
    pending = "pending"
    berhasil = "berhasil"
    gagal = "gagal"


class RegistrasiWajah(Base):
    __tablename__ = "registrasi_wajah"

    id_registrasi: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_mahasiswa: Mapped[int] = mapped_column(BigInteger, ForeignKey("mahasiswa.id_mahasiswa", ondelete="CASCADE"), nullable=False)
    jumlah_foto: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    similarity_check: Mapped[float | None] = mapped_column(Float, nullable=True)
    status_registrasi: Mapped[StatusRegistrasiEnum] = mapped_column(Enum(StatusRegistrasiEnum), nullable=False, default=StatusRegistrasiEnum.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())

    # Relationships
    mahasiswa: Mapped["Mahasiswa"] = relationship("Mahasiswa", back_populates="registrasi_wajah_list")
