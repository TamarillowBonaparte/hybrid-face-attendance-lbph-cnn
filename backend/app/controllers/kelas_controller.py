from app.models.kelas import Kelas
from app.models.prodi import Prodi
from app.schemas.kelas import KelasCreate, KelasUpdate
from fastapi import HTTPException
from sqlalchemy.orm import Session


def get_all_kelas(
    db: Session, id_prodi: int | None = None, angkatan: int | None = None
):
    q = db.query(Kelas)
    if id_prodi:
        q = q.filter(Kelas.id_prodi == id_prodi)
    if angkatan:
        q = q.filter(Kelas.angkatan == angkatan)
    return q.order_by(Kelas.nama_kelas).all()


def get_kelas_by_id(db: Session, kelas_id: int) -> Kelas:
    k = db.query(Kelas).filter(Kelas.id == kelas_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    return k


def create_kelas(db: Session, payload: KelasCreate) -> Kelas:
    # Validate prodi exists
    if not db.query(Prodi).filter(Prodi.id_prodi == payload.id_prodi).first():
        raise HTTPException(status_code=400, detail="Program Studi tidak ditemukan")
    # Prevent duplicate nama_kelas within the same prodi + angkatan
    dup = (
        db.query(Kelas)
        .filter(
            Kelas.id_prodi == payload.id_prodi,
            Kelas.nama_kelas == payload.nama_kelas,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=400, detail="Nama kelas sudah ada untuk prodi ini"
        )
    k = Kelas(**payload.model_dump())
    db.add(k)
    db.commit()
    db.refresh(k)
    return k


def update_kelas(db: Session, kelas_id: int, payload: KelasUpdate) -> Kelas:
    k = get_kelas_by_id(db, kelas_id)
    data = payload.model_dump(exclude_none=True)
    if "id_prodi" in data:
        if not db.query(Prodi).filter(Prodi.id_prodi == data["id_prodi"]).first():
            raise HTTPException(status_code=400, detail="Program Studi tidak ditemukan")
    # Duplicate check (exclude self)
    new_name = data.get("nama_kelas", k.nama_kelas)
    new_prodi = data.get("id_prodi", k.id_prodi)
    dup = (
        db.query(Kelas)
        .filter(
            Kelas.id_prodi == new_prodi,
            Kelas.nama_kelas == new_name,
            Kelas.id != kelas_id,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=400, detail="Nama kelas sudah ada untuk prodi ini"
        )
    for field, val in data.items():
        setattr(k, field, val)
    db.commit()
    db.refresh(k)
    return k


def delete_kelas(db: Session, kelas_id: int):
    k = get_kelas_by_id(db, kelas_id)
    db.delete(k)
    db.commit()
