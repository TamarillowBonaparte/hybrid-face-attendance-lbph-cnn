"""
Migration: Tambah kolom id_kelas ke tabel mahasiswa
Jalankan sekali: python migrate_kelas_mahasiswa.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        # Cek apakah kolom sudah ada
        result = conn.execute(text("""
            SELECT COUNT(*) as cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'mahasiswa'
              AND COLUMN_NAME = 'id_kelas'
        """))
        row = result.fetchone()
        if row[0] > 0:
            print("✓ Kolom id_kelas sudah ada di tabel mahasiswa. Skip.")
            return

        # Tambah kolom id_kelas
        conn.execute(text("""
            ALTER TABLE mahasiswa
            ADD COLUMN id_kelas BIGINT NULL AFTER id_golongan,
            ADD CONSTRAINT fk_mahasiswa_kelas
                FOREIGN KEY (id_kelas) REFERENCES kelas(id) ON DELETE SET NULL
        """))
        conn.commit()
        print("✓ Kolom id_kelas berhasil ditambahkan ke tabel mahasiswa!")


if __name__ == "__main__":
    migrate()
