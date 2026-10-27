import enum
from datetime import datetime

from app.config.database import Base
from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship


class StatusHistoryPresensiEnum(str, enum.Enum):
    hadir = "hadir"
    terlambat = "terlambat"
    izin = "izin"
    sakit = "sakit"
    alpha = "alpha"


class HistoryPresensi(Base):
    __tablename__ = "history_presensi"

    id_history: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    id_mahasiswa: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("mahasiswa.id_mahasiswa", ondelete="RESTRICT"),
        nullable=False,
    )
    id_pertemuan: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("pertemuan.id_pertemuan", ondelete="CASCADE"),
        nullable=False,
    )
    waktu_presensi: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status_presensi: Mapped[StatusHistoryPresensiEnum] = mapped_column(
        Enum(StatusHistoryPresensiEnum), nullable=False
    )
    foto_verifikasi: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    lbph_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cnn_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    metode_deteksi: Mapped[str | None] = mapped_column(String(50), nullable=True)
    latitude_presensi: Mapped[float | None] = mapped_column(
        Numeric(10, 8), nullable=True
    )
    longitude_presensi: Mapped[float | None] = mapped_column(
        Numeric(11, 8), nullable=True
    )
    jarak_meter: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, default=func.now(), server_default=func.now()
    )

    # Relationships
    pertemuan: Mapped["Pertemuan"] = relationship("Pertemuan")
    mahasiswa: Mapped["Mahasiswa"] = relationship("Mahasiswa")
