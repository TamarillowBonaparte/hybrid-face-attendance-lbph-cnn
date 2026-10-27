from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.models.mahasiswa import Mahasiswa
from app.models.prodi import Prodi
from app.models.angkatan import Angkatan
from app.models.golongan import Golongan
from app.models.kelas import Kelas
from app.models.user import User, UserRoleEnum
from app.schemas.dosen import MahasiswaCreate, MahasiswaUpdate
from app.utils.security import get_password_hash


def get_all_mahasiswa(db: Session, id_prodi=None, id_angkatan=None, id_golongan=None, status_filter=None, skip=0, limit=100):
    q = db.query(Mahasiswa)
    if id_prodi:    q = q.filter(Mahasiswa.id_prodi == id_prodi)
    if id_angkatan: q = q.filter(Mahasiswa.id_angkatan == id_angkatan)
    if id_golongan: q = q.filter(Mahasiswa.id_golongan == id_golongan)
    if status_filter: q = q.filter(Mahasiswa.status == status_filter)
    return q.offset(skip).limit(limit).all()


def get_mahasiswa_by_id(db: Session, mahasiswa_id: int):
    m = db.query(Mahasiswa).filter(Mahasiswa.id_mahasiswa == mahasiswa_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return m


def get_mahasiswa_by_nim(db: Session, nim: str):
    m = db.query(Mahasiswa).filter(Mahasiswa.nim == nim).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return m


def create_mahasiswa(db: Session, payload: MahasiswaCreate):
    # Cek NIM duplikat
    if db.query(Mahasiswa).filter(Mahasiswa.nim == payload.nim).first():
        raise HTTPException(status_code=400, detail="NIM sudah terdaftar")

    # Cek email duplikat (jika diisi manual)
    if payload.email and db.query(Mahasiswa).filter(Mahasiswa.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email mahasiswa sudah terdaftar")

    # Validasi foreign key
    if not db.query(Prodi).filter(Prodi.id_prodi == payload.id_prodi).first():
        raise HTTPException(status_code=404, detail="Prodi tidak ditemukan")
    if not db.query(Angkatan).filter(Angkatan.id_angkatan == payload.id_angkatan).first():
        raise HTTPException(status_code=404, detail="Angkatan tidak ditemukan")
    if not db.query(Golongan).filter(Golongan.id_golongan == payload.id_golongan).first():
        raise HTTPException(status_code=404, detail="Golongan tidak ditemukan")
    if payload.id_kelas and not db.query(Kelas).filter(Kelas.id == payload.id_kelas).first():
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")

    # Format email otomatis dari NIM jika tidak ada email manual
    student_email = payload.email if payload.email else f"{payload.nim.lower()}@student.polije.ac.id"

    # Cek apakah user dengan email tsb sudah ada
    if db.query(User).filter(User.email == student_email).first():
        raise HTTPException(status_code=400, detail=f"User dengan email {student_email} sudah terdaftar")

    try:
        # Buat entri mahasiswa
        mahasiswa_data = payload.model_dump()
        mahasiswa_data["email"] = student_email
        m = Mahasiswa(**mahasiswa_data)
        db.add(m)

        # Buat entri user secara otomatis
        # name = NIM, email = nim@student.polije.ac.id, password = NIM, role = mahasiswa
        new_user = User(
            name=payload.nim,
            email=student_email,
            password=get_password_hash(payload.nim),
            role=UserRoleEnum.mahasiswa,
        )
        db.add(new_user)

        db.commit()
        db.refresh(m)
        return m
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan data mahasiswa: {str(e)}")


def update_mahasiswa(db: Session, mahasiswa_id: int, payload: MahasiswaUpdate):
    m = get_mahasiswa_by_id(db, mahasiswa_id)
    data = payload.model_dump(exclude_none=True)
    if "id_prodi" in data and not db.query(Prodi).filter(Prodi.id_prodi == data["id_prodi"]).first():
        raise HTTPException(status_code=404, detail="Prodi tidak ditemukan")
    if "id_angkatan" in data and not db.query(Angkatan).filter(Angkatan.id_angkatan == data["id_angkatan"]).first():
        raise HTTPException(status_code=404, detail="Angkatan tidak ditemukan")
    if "id_golongan" in data and not db.query(Golongan).filter(Golongan.id_golongan == data["id_golongan"]).first():
        raise HTTPException(status_code=404, detail="Golongan tidak ditemukan")
    if "id_kelas" in data and data["id_kelas"] and not db.query(Kelas).filter(Kelas.id == data["id_kelas"]).first():
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    for k, v in data.items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return m


def delete_mahasiswa(db: Session, mahasiswa_id: int):
    m = get_mahasiswa_by_id(db, mahasiswa_id)
    db.delete(m); db.commit()

def bulk_create_mahasiswa(db: Session, payloads: list[MahasiswaCreate]):
    success_count = 0
    errors = []
    
    for i, payload in enumerate(payloads):
        try:
            if db.query(Mahasiswa).filter(Mahasiswa.nim == payload.nim).first():
                errors.append(f"Baris {i+1}: NIM {payload.nim} sudah terdaftar")
                continue
            
            student_email = payload.email if payload.email else f"{payload.nim.lower()}@student.polije.ac.id"
            if db.query(User).filter(User.email == student_email).first():
                errors.append(f"Baris {i+1}: Email {student_email} sudah terdaftar")
                continue
            
            # Validasi foreign key minimal untuk keamanan
            if not db.query(Prodi).filter(Prodi.id_prodi == payload.id_prodi).first():
                errors.append(f"Baris {i+1}: Prodi tidak ditemukan")
                continue
            if not db.query(Angkatan).filter(Angkatan.id_angkatan == payload.id_angkatan).first():
                errors.append(f"Baris {i+1}: Angkatan tidak ditemukan")
                continue
            if not db.query(Golongan).filter(Golongan.id_golongan == payload.id_golongan).first():
                errors.append(f"Baris {i+1}: Golongan tidak ditemukan")
                continue
            if payload.id_kelas and not db.query(Kelas).filter(Kelas.id == payload.id_kelas).first():
                errors.append(f"Baris {i+1}: Kelas tidak ditemukan")
                continue

            mahasiswa_data = payload.model_dump()
            mahasiswa_data["email"] = student_email
            m = Mahasiswa(**mahasiswa_data)
            db.add(m)
            
            new_user = User(
                name=payload.nim,
                email=student_email,
                password=get_password_hash(payload.nim),
                role=UserRoleEnum.mahasiswa,
            )
            db.add(new_user)
            db.commit()
            success_count += 1
        except Exception as e:
            db.rollback()
            errors.append(f"Baris {i+1}: {str(e)}")
            
    return {"success": success_count, "failed": len(errors), "errors": errors}

def bulk_delete_mahasiswa(db: Session, mahasiswa_ids: list[int]):
    try:
        mahasiswa_list = db.query(Mahasiswa).filter(Mahasiswa.id_mahasiswa.in_(mahasiswa_ids)).all()
        for m in mahasiswa_list:
            db.delete(m)
        db.commit()
        return {"success": len(mahasiswa_list)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus bulk: {str(e)}")
