"""
Migration script: Add id_geolokasi and mode_lokasi columns to pertemuan table.
Run once from the backend directory: python migrate_pertemuan.py
"""
import sys
sys.path.insert(0, ".")

from app.config.database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        # Step 1: Check if geolokasi table exists; create it if not
        result = conn.execute(text("SHOW TABLES LIKE 'geolokasi'"))
        geolokasi_exists = len(result.fetchall()) > 0
        print(f"geolokasi table exists: {geolokasi_exists}")

        if not geolokasi_exists:
            print("Creating geolokasi table...")
            conn.execute(text("""
                CREATE TABLE geolokasi (
                    id_geolokasi BIGINT AUTO_INCREMENT PRIMARY KEY,
                    nama_lokasi VARCHAR(255) NOT NULL,
                    latitude DOUBLE NOT NULL,
                    longitude DOUBLE NOT NULL,
                    radius_meter INT NOT NULL DEFAULT 100,
                    status ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
                    keterangan TEXT NULL
                )
            """))
            conn.commit()
            print("geolokasi table created.")

        # Step 2: Check current columns in pertemuan
        result = conn.execute(text("DESCRIBE pertemuan"))
        cols = {row[0] for row in result.fetchall()}
        print(f"Current pertemuan columns: {cols}")

        # Step 3: Add id_geolokasi if missing
        if "id_geolokasi" not in cols:
            print("Adding id_geolokasi column...")
            conn.execute(text("""
                ALTER TABLE pertemuan
                ADD COLUMN id_geolokasi BIGINT NULL,
                ADD CONSTRAINT fk_pertemuan_geolokasi
                    FOREIGN KEY (id_geolokasi)
                    REFERENCES geolokasi(id_geolokasi)
                    ON DELETE SET NULL
            """))
            conn.commit()
            print("id_geolokasi added.")
        else:
            print("id_geolokasi already exists, skipping.")

        # Step 4: Add mode_lokasi if missing
        if "mode_lokasi" not in cols:
            print("Adding mode_lokasi column...")
            conn.execute(text("""
                ALTER TABLE pertemuan
                ADD COLUMN mode_lokasi ENUM('bebas','wajib') NOT NULL DEFAULT 'bebas'
            """))
            conn.commit()
            print("mode_lokasi added.")
        else:
            print("mode_lokasi already exists, skipping.")

        # Verify final state
        result = conn.execute(text("DESCRIBE pertemuan"))
        print("\nFinal pertemuan columns:")
        for row in result.fetchall():
            print(" ", row)

    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
