from app.config.database import Base
from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.mahasiswa import Mahasiswa
    from app.models.prodi import Prodi


class Kelas(Base):
    __tablename__ = "kelas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_prodi: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("prodi.id_prodi", ondelete="RESTRICT"), nullable=False
    )
    nama_kelas: Mapped[str] = mapped_column(String(100), nullable=False)
    golongan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    angkatan: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tahun_ajaran: Mapped[str | None] = mapped_column(String(20), nullable=True)
    keterangan: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship (no back_populates needed on Prodi for this read-only join)
    prodi: Mapped["Prodi"] = relationship("Prodi")
    mahasiswa_list: Mapped[list["Mahasiswa"]] = relationship("Mahasiswa", back_populates="kelas", foreign_keys="[Mahasiswa.id_kelas]")
