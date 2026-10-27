from sqlalchemy import BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class PengajarPertemuan(Base):
    __tablename__ = "pengajar_pertemuan"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_pertemuan: Mapped[int] = mapped_column(BigInteger, ForeignKey("pertemuan.id_pertemuan", ondelete="CASCADE"), nullable=False)
    id_dosen: Mapped[int] = mapped_column(BigInteger, ForeignKey("dosen.id_dosen", ondelete="RESTRICT"), nullable=False)

    # Relationships
    pertemuan: Mapped["Pertemuan"] = relationship("Pertemuan", back_populates="pengajar_pertemuan_list")
    dosen: Mapped["Dosen"] = relationship("Dosen", back_populates="pengajar_pertemuan_list")
