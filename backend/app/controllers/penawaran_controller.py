from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.models.penawaran_matakuliah import PenawaranMatakuliah, PenawaranKelas, Pengajar
from app.models.pengajar_pertemuan import PengajarPertemuan
from app.models.matakuliah import MataKuliah
from app.models.dosen import Dosen
from app.models.prodi import Prodi
from app.models.angkatan import Angkatan
from app.models.golongan import Golongan
from app.models.pertemuan import Pertemuan
from app.schemas.penawaran import (
    PenawaranCreate, PenawaranUpdate,
    PenawaranKelasCreate, PenawaranKelasUpdate,
    PengajarCreate, PengajarUpdate,
    PengajarPertemuanCreate,
)


# ─── Helper: build response dict ─────────────────────────────────────────────

def _penawaran_to_dict(p: PenawaranMatakuliah) -> dict:
    return {
        "id_penawaran": p.id_penawaran,
        "id_matakuliah": p.id_matakuliah,
        "kode_matakuliah": p.matakuliah.kode_matakuliah if p.matakuliah else None,
        "nama_matakuliah": p.matakuliah.nama_matakuliah if p.matakuliah else None,
        "semester": p.semester,
        "tahun_ajaran": p.tahun_ajaran,
        "status": p.status.value if p.status else "aktif",
        "created_at": p.created_at,
        "kelas_list": [_kelas_to_dict(k) for k in (p.penawaran_kelas_list or [])],
        "pengajar_list": [_pengajar_to_dict(g) for g in (p.pengajar_list or [])],
    }


def _kelas_to_dict(k: PenawaranKelas) -> dict:
    return {
        "id": k.id,
        "id_penawaran": k.id_penawaran,
        "id_prodi": k.id_prodi,
        "id_angkatan": k.id_angkatan,
        "id_golongan": k.id_golongan,
        "kode_prodi": k.prodi.kode_prodi if k.prodi else None,
        "tahun_angkatan": k.angkatan.tahun_angkatan if k.angkatan else None,
        "nama_golongan": k.golongan.nama_golongan if k.golongan else None,
        "nama_kelas": (
            f"{k.prodi.kode_prodi}-{k.angkatan.tahun_angkatan}-{k.golongan.nama_golongan}"
            if k.prodi and k.angkatan and k.golongan else None
        ),
    }


def _pengajar_to_dict(g: Pengajar) -> dict:
    return {
        "id_pengajar": g.id_pengajar,
        "id_penawaran": g.id_penawaran,
        "id_dosen": g.id_dosen,
        "role": g.role.value if g.role else "anggota",
        "nama_dosen": g.dosen.nama_dosen if g.dosen else None,
        "nidn": g.dosen.nidn if g.dosen else None,
    }


def _pengajar_pertemuan_to_dict(pp: PengajarPertemuan) -> dict:
    return {
        "id": pp.id,
        "id_pertemuan": pp.id_pertemuan,
        "id_dosen": pp.id_dosen,
        "nama_dosen": pp.dosen.nama_dosen if pp.dosen else None,
        "nidn": pp.dosen.nidn if pp.dosen else None,
    }


def _load_penawaran(db: Session, id_penawaran: int) -> PenawaranMatakuliah:
    p = db.query(PenawaranMatakuliah).options(
        joinedload(PenawaranMatakuliah.matakuliah),
        joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.prodi),
        joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.angkatan),
        joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.golongan),
        joinedload(PenawaranMatakuliah.pengajar_list).joinedload(Pengajar.dosen),
    ).filter(PenawaranMatakuliah.id_penawaran == id_penawaran).first()
    if not p:
        raise HTTPException(404, "Penawaran mata kuliah tidak ditemukan")
    return p


# ─── Penawaran Mata Kuliah CRUD ───────────────────────────────────────────────

def get_all_penawaran(db: Session, id_matakuliah=None, status_filter=None, skip=0, limit=100):
    q = db.query(PenawaranMatakuliah).options(
        joinedload(PenawaranMatakuliah.matakuliah),
        joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.prodi),
        joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.angkatan),
        joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.golongan),
        joinedload(PenawaranMatakuliah.pengajar_list).joinedload(Pengajar.dosen),
    )
    if id_matakuliah:
        q = q.filter(PenawaranMatakuliah.id_matakuliah == id_matakuliah)
    if status_filter:
        q = q.filter(PenawaranMatakuliah.status == status_filter)
    return [_penawaran_to_dict(p) for p in q.offset(skip).limit(limit).all()]


def get_penawaran_by_id(db: Session, id_penawaran: int):
    return _penawaran_to_dict(_load_penawaran(db, id_penawaran))


def create_penawaran(db: Session, payload: PenawaranCreate):
    if not db.query(MataKuliah).filter(MataKuliah.id_matakuliah == payload.id_matakuliah).first():
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    p = PenawaranMatakuliah(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _penawaran_to_dict(_load_penawaran(db, p.id_penawaran))


def update_penawaran(db: Session, id_penawaran: int, payload: PenawaranUpdate):
    p = db.query(PenawaranMatakuliah).filter(PenawaranMatakuliah.id_penawaran == id_penawaran).first()
    if not p:
        raise HTTPException(404, "Penawaran tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    return _penawaran_to_dict(_load_penawaran(db, id_penawaran))


def delete_penawaran(db: Session, id_penawaran: int):
    p = db.query(PenawaranMatakuliah).filter(PenawaranMatakuliah.id_penawaran == id_penawaran).first()
    if not p:
        raise HTTPException(404, "Penawaran tidak ditemukan")
    db.delete(p)
    db.commit()


# ─── Penawaran Kelas CRUD ─────────────────────────────────────────────────────

def get_kelas_by_penawaran(db: Session, id_penawaran: int):
    rows = db.query(PenawaranKelas).options(
        joinedload(PenawaranKelas.prodi),
        joinedload(PenawaranKelas.angkatan),
        joinedload(PenawaranKelas.golongan),
    ).filter(PenawaranKelas.id_penawaran == id_penawaran).all()
    return [_kelas_to_dict(k) for k in rows]


def add_kelas_to_penawaran(db: Session, payload: PenawaranKelasCreate):
    if not db.query(PenawaranMatakuliah).filter(PenawaranMatakuliah.id_penawaran == payload.id_penawaran).first():
        raise HTTPException(404, "Penawaran tidak ditemukan")
    # Check duplicate
    existing = db.query(PenawaranKelas).filter(
        PenawaranKelas.id_penawaran == payload.id_penawaran,
        PenawaranKelas.id_prodi == payload.id_prodi,
        PenawaranKelas.id_angkatan == payload.id_angkatan,
        PenawaranKelas.id_golongan == payload.id_golongan,
    ).first()
    if existing:
        raise HTTPException(400, "Kelas sudah ada di penawaran ini")
    k = PenawaranKelas(**payload.model_dump())
    db.add(k)
    db.commit()
    db.refresh(k)
    # Reload with joins
    k = db.query(PenawaranKelas).options(
        joinedload(PenawaranKelas.prodi),
        joinedload(PenawaranKelas.angkatan),
        joinedload(PenawaranKelas.golongan),
    ).filter(PenawaranKelas.id == k.id).first()
    return _kelas_to_dict(k)


def add_kelas_to_penawaran_by_kelas_id(db: Session, id_penawaran: int, id_kelas: int):
    """Tambah kelas ke penawaran menggunakan id_kelas langsung (dari tabel kelas)."""
    from app.models.angkatan import Angkatan
    from app.models.golongan import Golongan
    from app.models.kelas import Kelas

    if not db.query(PenawaranMatakuliah).filter(PenawaranMatakuliah.id_penawaran == id_penawaran).first():
        raise HTTPException(404, "Penawaran tidak ditemukan")

    kelas = db.query(Kelas).filter(Kelas.id == id_kelas).first()
    if not kelas:
        raise HTTPException(404, "Kelas tidak ditemukan")

    ang_obj = None
    if kelas.angkatan:
        ang_obj = db.query(Angkatan).filter(Angkatan.tahun_angkatan == kelas.angkatan).first()
    gol_obj = None
    if kelas.golongan:
        gol_obj = db.query(Golongan).filter(Golongan.nama_golongan == kelas.golongan).first()

    if not ang_obj:
        raise HTTPException(400, "Data angkatan pada kelas tidak valid")
    if not gol_obj:
        raise HTTPException(400, "Data golongan pada kelas tidak valid")

    existing = db.query(PenawaranKelas).filter(
        PenawaranKelas.id_penawaran == id_penawaran,
        PenawaranKelas.id_prodi == kelas.id_prodi,
        PenawaranKelas.id_angkatan == ang_obj.id_angkatan,
        PenawaranKelas.id_golongan == gol_obj.id_golongan,
    ).first()
    if existing:
        raise HTTPException(400, "Kelas sudah ada di penawaran ini")

    pk = PenawaranKelas(
        id_penawaran=id_penawaran,
        id_prodi=kelas.id_prodi,
        id_angkatan=ang_obj.id_angkatan,
        id_golongan=gol_obj.id_golongan,
    )
    db.add(pk)
    db.commit()
    db.refresh(pk)
    pk = db.query(PenawaranKelas).options(
        joinedload(PenawaranKelas.prodi),
        joinedload(PenawaranKelas.angkatan),
        joinedload(PenawaranKelas.golongan),
    ).filter(PenawaranKelas.id == pk.id).first()
    return _kelas_to_dict(pk)


def remove_kelas_from_penawaran(db: Session, kelas_id: int):
    k = db.query(PenawaranKelas).filter(PenawaranKelas.id == kelas_id).first()
    if not k:
        raise HTTPException(404, "Kelas tidak ditemukan")
    db.delete(k)
    db.commit()


# ─── Pengajar CRUD ────────────────────────────────────────────────────────────

def get_pengajar_by_penawaran(db: Session, id_penawaran: int):
    rows = db.query(Pengajar).options(
        joinedload(Pengajar.dosen),
    ).filter(Pengajar.id_penawaran == id_penawaran).all()
    return [_pengajar_to_dict(g) for g in rows]


def add_pengajar_to_penawaran(db: Session, payload: PengajarCreate):
    if not db.query(PenawaranMatakuliah).filter(PenawaranMatakuliah.id_penawaran == payload.id_penawaran).first():
        raise HTTPException(404, "Penawaran tidak ditemukan")
    if not db.query(Dosen).filter(Dosen.id_dosen == payload.id_dosen).first():
        raise HTTPException(404, "Dosen tidak ditemukan")
    existing = db.query(Pengajar).filter(
        Pengajar.id_penawaran == payload.id_penawaran,
        Pengajar.id_dosen == payload.id_dosen,
    ).first()
    if existing:
        raise HTTPException(400, "Dosen sudah terdaftar sebagai pengajar di penawaran ini")
    g = Pengajar(**payload.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    g = db.query(Pengajar).options(joinedload(Pengajar.dosen)).filter(Pengajar.id_pengajar == g.id_pengajar).first()
    return _pengajar_to_dict(g)


def update_pengajar_role(db: Session, pengajar_id: int, payload: PengajarUpdate):
    g = db.query(Pengajar).filter(Pengajar.id_pengajar == pengajar_id).first()
    if not g:
        raise HTTPException(404, "Pengajar tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    db.commit()
    g = db.query(Pengajar).options(joinedload(Pengajar.dosen)).filter(Pengajar.id_pengajar == pengajar_id).first()
    return _pengajar_to_dict(g)


def remove_pengajar(db: Session, pengajar_id: int):
    g = db.query(Pengajar).filter(Pengajar.id_pengajar == pengajar_id).first()
    if not g:
        raise HTTPException(404, "Pengajar tidak ditemukan")
    db.delete(g)
    db.commit()


# ─── Pengajar Pertemuan CRUD ──────────────────────────────────────────────────

def get_pengajar_pertemuan(db: Session, id_pertemuan: int):
    rows = db.query(PengajarPertemuan).options(
        joinedload(PengajarPertemuan.dosen),
    ).filter(PengajarPertemuan.id_pertemuan == id_pertemuan).all()
    return [_pengajar_pertemuan_to_dict(pp) for pp in rows]


def add_pengajar_pertemuan(db: Session, payload: PengajarPertemuanCreate):
    from app.models.pertemuan import Pertemuan
    if not db.query(Pertemuan).filter(Pertemuan.id_pertemuan == payload.id_pertemuan).first():
        raise HTTPException(404, "Pertemuan tidak ditemukan")
    if not db.query(Dosen).filter(Dosen.id_dosen == payload.id_dosen).first():
        raise HTTPException(404, "Dosen tidak ditemukan")
    existing = db.query(PengajarPertemuan).filter(
        PengajarPertemuan.id_pertemuan == payload.id_pertemuan,
        PengajarPertemuan.id_dosen == payload.id_dosen,
    ).first()
    if existing:
        raise HTTPException(400, "Dosen sudah terdaftar sebagai pengajar di pertemuan ini")
    pp = PengajarPertemuan(**payload.model_dump())
    db.add(pp)
    db.commit()
    db.refresh(pp)
    pp = db.query(PengajarPertemuan).options(joinedload(PengajarPertemuan.dosen)).filter(PengajarPertemuan.id == pp.id).first()
    return _pengajar_pertemuan_to_dict(pp)


def remove_pengajar_pertemuan(db: Session, pp_id: int):
    pp = db.query(PengajarPertemuan).filter(PengajarPertemuan.id == pp_id).first()
    if not pp:
        raise HTTPException(404, "Pengajar pertemuan tidak ditemukan")
    db.delete(pp)
    db.commit()
