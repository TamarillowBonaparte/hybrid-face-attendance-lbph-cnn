from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class Prodi(Base):
    __tablename__ = "prodi"

    id_prodi: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    kode_prodi: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nama_prodi: Mapped[str] = mapped_column(String(100), nullable=False)
    jenjang: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Relationships
    mahasiswa_list: Mapped[list["Mahasiswa"]] = relationship("Mahasiswa", back_populates="prodi")
    penawaran_kelas_list: Mapped[list["PenawaranKelas"]] = relationship("PenawaranKelas", back_populates="prodi")
