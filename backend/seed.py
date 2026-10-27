"""Create an administrator interactively, without a shared default password."""
from getpass import getpass
from app.config.database import SessionLocal
from app.models.user import User, UserRoleEnum
from app.utils.security import get_password_hash


def seed():
    name = input("Nama admin: ").strip()
    email = input("Email admin: ").strip()
    if not name or "@" not in email:
        raise SystemExit("Nama dan email valid wajib diisi.")
    password = getpass("Password admin (12-72 byte UTF-8): ")
    if not 12 <= len(password.encode("utf-8")) <= 72:
        raise SystemExit("Panjang password harus 12-72 byte UTF-8.")
    if password != getpass("Ulangi password: "):
        raise SystemExit("Password tidak cocok.")
    with SessionLocal() as db:
        if db.query(User).filter(User.email == email).first():
            raise SystemExit("Email sudah terdaftar; akun tidak diubah.")
        db.add(User(name=name, email=email, password=get_password_hash(password),
                    role=UserRoleEnum.admin))
        db.commit()
        print("Admin berhasil dibuat.")


if __name__ == "__main__":
    seed()
