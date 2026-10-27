from sqlalchemy import BigInteger, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class MataKuliah(Base):
    __tablename__ = "matakuliah"

    id_matakuliah: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    kode_matakuliah: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nama_matakuliah: Mapped[str] = mapped_column(String(100), nullable=False)
    sks: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    penawaran_list: Mapped[list["PenawaranMatakuliah"]] = relationship("PenawaranMatakuliah", back_populates="matakuliah", cascade="all, delete-orphan", passive_deletes=True)
