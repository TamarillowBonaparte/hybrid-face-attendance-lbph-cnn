from sqlalchemy import BigInteger, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class Angkatan(Base):
    __tablename__ = "angkatan"

    id_angkatan: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tahun_angkatan: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    mahasiswa_list: Mapped[list["Mahasiswa"]] = relationship("Mahasiswa", back_populates="angkatan")
    penawaran_kelas_list: Mapped[list["PenawaranKelas"]] = relationship("PenawaranKelas", back_populates="angkatan")
