"""
Migration script: drop all existing tables dan recreate dengan schema baru.
Jalankan SEKALI sebelum menjalankan backend server.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config.database import engine, Base

# Import semua models agar Base.metadata mengetahui seluruh tabel
import app.models  # noqa: F401

def migrate():
    print("Menghapus semua tabel lama...")
    Base.metadata.drop_all(bind=engine)
    print("Semua tabel dihapus.")

    print("Membuat ulang tabel dengan schema baru...")
    Base.metadata.create_all(bind=engine)
    print("Semua tabel berhasil dibuat ulang!")
    print()
    print("Tabel yang dibuat:")
    for table in Base.metadata.sorted_tables:
        print(f"  - {table.name}")

if __name__ == "__main__":
    confirm = input("\nPERINGATAN: Semua data akan TERHAPUS! Ketik 'ya' untuk lanjut: ")
    if confirm.strip().lower() == "ya":
        migrate()
    else:
        print("Dibatalkan.")
