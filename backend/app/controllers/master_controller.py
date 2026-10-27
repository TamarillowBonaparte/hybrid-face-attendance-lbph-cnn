"""
Controllers untuk semua entitas master data:
Prodi, Angkatan, Golongan, MataKuliah, Dosen
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.prodi import Prodi
from app.models.angkatan import Angkatan
from app.models.golongan import Golongan
from app.models.matakuliah import MataKuliah
from app.models.dosen import Dosen
from app.schemas.master import (
    ProdiCreate, ProdiUpdate,
    AngkatanCreate, AngkatanUpdate,
    GolonganCreate, GolonganUpdate,
    MataKuliahCreate, MataKuliahUpdate,
)
from app.schemas.dosen import DosenCreate, DosenUpdate


# ─── PRODI ────────────────────────────────────────────────────────────────────

def get_all_prodi(db: Session):
    return db.query(Prodi).all()

def get_prodi_by_id(db: Session, prodi_id: int):
    p = db.query(Prodi).filter(Prodi.id_prodi == prodi_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Prodi tidak ditemukan")
    return p

def create_prodi(db: Session, payload: ProdiCreate):
    if db.query(Prodi).filter(Prodi.kode_prodi == payload.kode_prodi).first():
        raise HTTPException(status_code=400, detail="Kode prodi sudah ada")
    p = Prodi(**payload.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return p

def update_prodi(db: Session, prodi_id: int, payload: ProdiUpdate):
    p = get_prodi_by_id(db, prodi_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

def delete_prodi(db: Session, prodi_id: int):
    p = get_prodi_by_id(db, prodi_id)
    db.delete(p); db.commit()


# ─── ANGKATAN ─────────────────────────────────────────────────────────────────

def get_all_angkatan(db: Session):
    return db.query(Angkatan).order_by(Angkatan.tahun_angkatan).all()

def get_angkatan_by_id(db: Session, angkatan_id: int):
    a = db.query(Angkatan).filter(Angkatan.id_angkatan == angkatan_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Angkatan tidak ditemukan")
    return a

def create_angkatan(db: Session, payload: AngkatanCreate):
    if db.query(Angkatan).filter(Angkatan.tahun_angkatan == payload.tahun_angkatan).first():
        raise HTTPException(status_code=400, detail="Tahun angkatan sudah ada")
    a = Angkatan(**payload.model_dump())
    db.add(a); db.commit(); db.refresh(a)
    return a

def update_angkatan(db: Session, angkatan_id: int, payload: AngkatanUpdate):
    a = get_angkatan_by_id(db, angkatan_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    db.commit(); db.refresh(a)
    return a

def delete_angkatan(db: Session, angkatan_id: int):
    a = get_angkatan_by_id(db, angkatan_id)
    db.delete(a); db.commit()


# ─── GOLONGAN ─────────────────────────────────────────────────────────────────

def get_all_golongan(db: Session):
    return db.query(Golongan).order_by(Golongan.nama_golongan).all()

def get_golongan_by_id(db: Session, golongan_id: int):
    g = db.query(Golongan).filter(Golongan.id_golongan == golongan_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Golongan tidak ditemukan")
    return g

def create_golongan(db: Session, payload: GolonganCreate):
    g = Golongan(**payload.model_dump())
    db.add(g); db.commit(); db.refresh(g)
    return g

def update_golongan(db: Session, golongan_id: int, payload: GolonganUpdate):
    g = get_golongan_by_id(db, golongan_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    db.commit(); db.refresh(g)
    return g

def delete_golongan(db: Session, golongan_id: int):
    g = get_golongan_by_id(db, golongan_id)
    db.delete(g); db.commit()


# ─── MATA KULIAH ──────────────────────────────────────────────────────────────

def get_all_matakuliah(db: Session):
    return db.query(MataKuliah).all()

def get_matakuliah_by_id(db: Session, mk_id: int):
    mk = db.query(MataKuliah).filter(MataKuliah.id_matakuliah == mk_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    return mk

def create_matakuliah(db: Session, payload: MataKuliahCreate):
    if db.query(MataKuliah).filter(MataKuliah.kode_matakuliah == payload.kode_matakuliah).first():
        raise HTTPException(status_code=400, detail="Kode mata kuliah sudah ada")
    mk = MataKuliah(**payload.model_dump())
    db.add(mk); db.commit(); db.refresh(mk)
    return mk

def update_matakuliah(db: Session, mk_id: int, payload: MataKuliahUpdate):
    mk = get_matakuliah_by_id(db, mk_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(mk, k, v)
    db.commit(); db.refresh(mk)
    return mk

def delete_matakuliah(db: Session, mk_id: int):
    mk = get_matakuliah_by_id(db, mk_id)
    try:
        db.delete(mk)
        db.commit()
    except Exception as e:
        db.rollback()
        # Check for FK constraint violations
        err = str(e).lower()
        if "foreign key" in err or "constraint" in err or "restrict" in err:
            raise HTTPException(
                status_code=409,
                detail="Mata kuliah tidak dapat dihapus karena masih memiliki data terkait (penawaran/jadwal). Hapus data terkait terlebih dahulu atau hubungi admin."
            )
        raise HTTPException(status_code=500, detail=f"Gagal menghapus mata kuliah: {str(e)}")


# ─── DOSEN ────────────────────────────────────────────────────────────────────

def get_all_dosen(db: Session, status_filter: str | None = None):
    q = db.query(Dosen)
    if status_filter:
        q = q.filter(Dosen.status == status_filter)
    return q.all()

def get_dosen_by_id(db: Session, dosen_id: int):
    d = db.query(Dosen).filter(Dosen.id_dosen == dosen_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dosen tidak ditemukan")
    return d

def get_dosen_by_nidn(db: Session, nidn: str):
    d = db.query(Dosen).filter(Dosen.nidn == nidn).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dosen tidak ditemukan")
    return d

def create_dosen(db: Session, payload: DosenCreate):
    if db.query(Dosen).filter(Dosen.nidn == payload.nidn).first():
        raise HTTPException(status_code=400, detail="NIDN sudah terdaftar")
    if payload.email and db.query(Dosen).filter(Dosen.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email dosen sudah terdaftar")
    d = Dosen(**payload.model_dump())
    db.add(d); db.commit(); db.refresh(d)
    return d

def update_dosen(db: Session, dosen_id: int, payload: DosenUpdate):
    d = get_dosen_by_id(db, dosen_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit(); db.refresh(d)
    return d

def delete_dosen(db: Session, dosen_id: int):
    d = get_dosen_by_id(db, dosen_id)
    db.delete(d); db.commit()
