from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class Golongan(Base):
    __tablename__ = "golongan"

    id_golongan: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nama_golongan: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    mahasiswa_list: Mapped[list["Mahasiswa"]] = relationship("Mahasiswa", back_populates="golongan")
    penawaran_kelas_list: Mapped[list["PenawaranKelas"]] = relationship("PenawaranKelas", back_populates="golongan")
