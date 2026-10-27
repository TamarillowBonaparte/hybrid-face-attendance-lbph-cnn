import enum
from sqlalchemy import BigInteger, String, Enum, SmallInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.config.database import Base


class JenisFotoEnum(str, enum.Enum):
    registrasi = "registrasi"
    training = "training"
    augmentasi = "augmentasi"


class DatasetWajah(Base):
    __tablename__ = "dataset_wajah"

    id_dataset: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_mahasiswa: Mapped[int] = mapped_column(BigInteger, ForeignKey("mahasiswa.id_mahasiswa", ondelete="CASCADE"), nullable=False)
    foto_path: Mapped[str] = mapped_column(String(255), nullable=False)
    jenis_foto: Mapped[JenisFotoEnum] = mapped_column(Enum(JenisFotoEnum), nullable=False, default=JenisFotoEnum.registrasi)
    digunakan_training: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())

    # Relationships
    mahasiswa: Mapped["Mahasiswa"] = relationship("Mahasiswa", back_populates="dataset_wajah_list")
