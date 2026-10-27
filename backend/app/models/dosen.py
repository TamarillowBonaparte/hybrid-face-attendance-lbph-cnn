import enum
from sqlalchemy import BigInteger, String, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.config.database import Base


class StatusDosenEnum(str, enum.Enum):
    aktif = "aktif"
    nonaktif = "nonaktif"


class Dosen(Base):
    __tablename__ = "dosen"

    id_dosen: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nidn: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nama_dosen: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    no_hp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[StatusDosenEnum] = mapped_column(
        Enum(StatusDosenEnum), nullable=False, default=StatusDosenEnum.aktif
    )

    # Relationships
    pengajar_list: Mapped[list["Pengajar"]] = relationship("Pengajar", back_populates="dosen")
    pengajar_pertemuan_list: Mapped[list["PengajarPertemuan"]] = relationship("PengajarPertemuan", back_populates="dosen")
