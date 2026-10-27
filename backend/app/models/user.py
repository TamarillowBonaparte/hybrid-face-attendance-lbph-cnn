import enum
from sqlalchemy import BigInteger, String, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.config.database import Base


class UserRoleEnum(str, enum.Enum):
    admin = "admin"
    dosen = "dosen"
    mahasiswa = "mahasiswa"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRoleEnum] = mapped_column(
        Enum(UserRoleEnum), nullable=False, default=UserRoleEnum.mahasiswa
    )
