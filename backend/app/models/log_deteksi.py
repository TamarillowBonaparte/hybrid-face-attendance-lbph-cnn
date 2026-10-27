import enum
from sqlalchemy import BigInteger, String, Float, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.config.database import Base


class HasilDeteksiEnum(str, enum.Enum):
    match = "match"
    unknown = "unknown"
    no_face = "no_face"
    error = "error"


class LogDeteksi(Base):
    __tablename__ = "log_deteksi"

    id_log: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_mahasiswa: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("mahasiswa.id_mahasiswa", ondelete="SET NULL"), nullable=True)
    waktu_deteksi: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now(), server_default=func.now())
    lbph_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cnn_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    predicted_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hasil_deteksi: Mapped[HasilDeteksiEnum] = mapped_column(Enum(HasilDeteksiEnum), nullable=False)
    foto_capture: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    mahasiswa: Mapped["Mahasiswa | None"] = relationship("Mahasiswa", back_populates="log_deteksi_list")
