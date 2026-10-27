"""Create missing tables for a NEW database; never drops existing tables."""
import app.models  # noqa: F401
from app.config.database import Base, engine

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Schema siap. Tabel yang sudah ada tidak diubah:")
    for name in sorted(Base.metadata.tables):
        print(" -", name)
