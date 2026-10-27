"""
Migration script: Fix FK constraints to use CASCADE for proper cascading deletes.

Run: python migrate_fk_cascade.py

This script changes ondelete behavior:
- matakuliah -> penawaran_matakuliah: RESTRICT -> CASCADE
- penawaran_matakuliah -> jadwal: RESTRICT -> CASCADE  
- jadwal -> pertemuan: RESTRICT -> CASCADE
"""

import pymysql
from app.config.settings import settings

def get_connection():
    return pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        charset="utf8mb4",
    )

def get_fk_name(cursor, table, column, ref_table):
    """Get the FK constraint name for a given column/table combination."""
    cursor.execute("""
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
          AND REFERENCED_TABLE_NAME = %s
    """, (settings.DB_NAME, table, column, ref_table))
    row = cursor.fetchone()
    return row[0] if row else None

def fix_fk(cursor, table, column, ref_table, ref_column):
    fk_name = get_fk_name(cursor, table, column, ref_table)
    if not fk_name:
        print(f"  [SKIP] No FK found for {table}.{column} -> {ref_table}.{ref_column}")
        return

    print(f"  [FIX] {table}.{column} -> {ref_table}.{ref_column} (FK: {fk_name})")
    # Drop existing FK
    cursor.execute(f"ALTER TABLE `{table}` DROP FOREIGN KEY `{fk_name}`")
    # Add new FK with CASCADE
    cursor.execute(f"""
        ALTER TABLE `{table}` 
        ADD CONSTRAINT `{fk_name}` 
        FOREIGN KEY (`{column}`) 
        REFERENCES `{ref_table}` (`{ref_column}`) 
        ON DELETE CASCADE ON UPDATE RESTRICT
    """)
    print(f"  [OK]  {table}.{column} -> {ref_table}.{ref_column} now CASCADE")

def main():
    print("=== FK Cascade Migration ===\n")
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Disable FK checks temporarily
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        # 1. penawaran_matakuliah.id_matakuliah -> matakuliah.id_matakuliah
        print("1. Fixing penawaran_matakuliah -> matakuliah")
        fix_fk(cursor, "penawaran_matakuliah", "id_matakuliah", "matakuliah", "id_matakuliah")
        
        # 2. jadwal.id_penawaran -> penawaran_matakuliah.id_penawaran
        print("\n2. Fixing jadwal -> penawaran_matakuliah")
        fix_fk(cursor, "jadwal", "id_penawaran", "penawaran_matakuliah", "id_penawaran")
        
        # 3. pertemuan.id_jadwal -> jadwal.id_jadwal
        print("\n3. Fixing pertemuan -> jadwal")
        fix_fk(cursor, "pertemuan", "id_jadwal", "jadwal", "id_jadwal")
        
        # Re-enable FK checks
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        conn.commit()
        print("\n=== Migration completed successfully! ===")
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
