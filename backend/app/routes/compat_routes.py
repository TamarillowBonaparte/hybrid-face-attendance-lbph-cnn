"""
Compatibility / composite routes to bridge backend models with frontend expectations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db
from app.models.user import User, UserRoleEnum
from app.models.dosen import Dosen
from app.models.mahasiswa import Mahasiswa
from app.models.matakuliah import MataKuliah
from app.models.prodi import Prodi
from app.models.angkatan import Angkatan
from app.models.golongan import Golongan
from app.models.jadwal import Jadwal
from app.models.pertemuan import Pertemuan
from app.models.presensi import Presensi
from app.models.penawaran_matakuliah import PenawaranMatakuliah, PenawaranKelas, Pengajar
from app.utils.security import get_password_hash
from app.utils.dependencies import get_current_user, require_admin

# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/")
def get_dashboard_stats(db: Session = Depends(get_db), _=Depends(get_current_user)):
    total_jadwal = db.query(Jadwal).count()
    total_mahasiswa = db.query(Mahasiswa).count()
    total_matakuliah = db.query(MataKuliah).count()
    total_dosen = db.query(Dosen).count()

    from datetime import date
    today = date.today()

    presensi_hari_ini = 0
    try:
        pertemuan_ids = db.query(Pertemuan.id_pertemuan).filter(Pertemuan.tanggal == today).all()
        if pertemuan_ids:
            pid_list = [p[0] for p in pertemuan_ids]
            presensi_hari_ini = db.query(Presensi).filter(Presensi.id_pertemuan.in_(pid_list)).count()
    except Exception:
        presensi_hari_ini = 0

    recent_presensi = []
    try:
        pertemuan_with_presensi = db.query(Presensi.id_pertemuan).distinct().all()
        if pertemuan_with_presensi:
            pid_list = [p[0] for p in pertemuan_with_presensi]
            recent_pertemuan = (
                db.query(Pertemuan)
                .options(
                    joinedload(Pertemuan.jadwal).joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.matakuliah),
                    joinedload(Pertemuan.jadwal).joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.prodi),
                    joinedload(Pertemuan.jadwal).joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.angkatan),
                    joinedload(Pertemuan.jadwal).joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.golongan),
                )
                .filter(Pertemuan.id_pertemuan.in_(pid_list))
                .order_by(Pertemuan.tanggal.desc())
                .limit(5)
                .all()
            )
            for p in recent_pertemuan:
                j = p.jadwal
                pen = j.penawaran if j else None
                mk = pen.matakuliah if pen else None
                kelas_names = []
                if pen:
                    for k in pen.penawaran_kelas_list:
                        if k.prodi and k.angkatan and k.golongan:
                            kelas_names.append(f"{k.prodi.kode_prodi}-{k.angkatan.tahun_angkatan}-{k.golongan.nama_golongan}")
                hadir = db.query(Presensi).filter(Presensi.id_pertemuan == p.id_pertemuan, Presensi.status_presensi == "hadir").count()
                alpha = db.query(Presensi).filter(Presensi.id_pertemuan == p.id_pertemuan, Presensi.status_presensi == "alpha").count()
                total = db.query(Presensi).filter(Presensi.id_pertemuan == p.id_pertemuan).count()
                recent_presensi.append({
                    "pertemuan_ke": p.pertemuan_ke,
                    "tanggal": str(p.tanggal),
                    "nama_mk": mk.nama_matakuliah if mk else "-",
                    "kode_mk": mk.kode_matakuliah if mk else "-",
                    "kelas": ", ".join(kelas_names) if kelas_names else "-",
                    "hadir": hadir,
                    "alfa": alpha,
                    "total_mhs": total,
                })
    except Exception:
        recent_presensi = []

    return {
        "stats": {
            "total_kelas_mk": total_jadwal,
            "total_mahasiswa": total_mahasiswa,
            "total_materi": total_matakuliah,
            "presensi_hari_ini": presensi_hari_ini,
            "total_dosen": total_dosen,
        },
        "recent_presensi": recent_presensi,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  KELAS MATA KULIAH (Jadwal + joined data)
# ═══════════════════════════════════════════════════════════════════════════════
kelas_mk_router = APIRouter(prefix="/kelas-mata-kuliah", tags=["Kelas Mata Kuliah"])


def _load_jadwal_full(db: Session, jadwal_id: int = None, query_filter=None):
    q = db.query(Jadwal).options(
        joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.matakuliah),
        joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.prodi),
        joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.angkatan),
        joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.penawaran_kelas_list).joinedload(PenawaranKelas.golongan),
        joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.pengajar_list).joinedload(Pengajar.dosen),
    )
    if query_filter is not None:
        q = q.filter(query_filter)
    if jadwal_id is not None:
        return q.filter(Jadwal.id_jadwal == jadwal_id).first()
    return q.all()


def _jadwal_to_kelas_mk(j: Jadwal) -> dict:
    pen = j.penawaran
    mk = pen.matakuliah if pen else None
    kelas_list = pen.penawaran_kelas_list if pen else []
    pengajar_list = pen.pengajar_list if pen else []

    # For backwards compat — use first kelas as representative
    first_kelas = kelas_list[0] if kelas_list else None
    first_pengajar = pengajar_list[0] if pengajar_list else None

    kelas_names = [
        f"{k.prodi.kode_prodi}-{k.angkatan.tahun_angkatan}-{k.golongan.nama_golongan}"
        for k in kelas_list if k.prodi and k.angkatan and k.golongan
    ]

    return {
        "id_kelas_mk": j.id_jadwal,
        "id_jadwal": j.id_jadwal,
        "id_penawaran": j.id_penawaran,
        "kode_mk": mk.kode_matakuliah if mk else None,
        "nama_mk": mk.nama_matakuliah if mk else None,
        "id_matakuliah": pen.id_matakuliah if pen else None,
        "semester": pen.semester if pen else None,
        "tahun_ajaran": pen.tahun_ajaran if pen else None,
        "nama_kelas": ", ".join(kelas_names) if kelas_names else None,
        "kelas_list": [
            {
                "id": k.id,
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
            for k in kelas_list
        ],
        "pengajar_list": [
            {
                "id_pengajar": g.id_pengajar,
                "id_dosen": g.id_dosen,
                "role": g.role.value if g.role else "anggota",
                "nama_dosen": g.dosen.nama_dosen if g.dosen else None,
                "nidn": g.dosen.nidn if g.dosen else None,
            }
            for g in pengajar_list
        ],
        # Legacy compat fields (first dosen/kelas)
        "prodi": first_kelas.prodi.kode_prodi if first_kelas and first_kelas.prodi else None,
        "id_prodi": first_kelas.id_prodi if first_kelas else None,
        "tahun_angkatan": first_kelas.angkatan.tahun_angkatan if first_kelas and first_kelas.angkatan else None,
        "id_angkatan": first_kelas.id_angkatan if first_kelas else None,
        "golongan": first_kelas.golongan.nama_golongan if first_kelas and first_kelas.golongan else None,
        "id_golongan": first_kelas.id_golongan if first_kelas else None,
        "id_dosen": first_pengajar.id_dosen if first_pengajar else None,
        "nama_dosen": first_pengajar.dosen.nama_dosen if first_pengajar and first_pengajar.dosen else None,
        "hari": j.hari.value if j.hari else None,
        "jam_mulai": str(j.jam_mulai) if j.jam_mulai else None,
        "jam_selesai": str(j.jam_selesai) if j.jam_selesai else None,
        "ruangan": j.ruangan,
        "status": j.status.value if j.status else "aktif",
    }


@kelas_mk_router.get("/")
def list_all_kelas_mk(status_filter: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = _load_jadwal_full(db, query_filter=(Jadwal.status == status_filter) if status_filter else None)
    if not isinstance(items, list):
        items = []
    return [_jadwal_to_kelas_mk(j) for j in items]


@kelas_mk_router.get("/me")
def list_my_kelas_mk(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = _load_jadwal_full(db)
    if not isinstance(items, list):
        items = []

    if current_user.role == UserRoleEnum.dosen:
        dosen = db.query(Dosen).filter(Dosen.email == current_user.email).first()
        if not dosen:
            return []
        # Filter jadwal where this dosen is a pengajar
        filtered = [
            j for j in items
            if j.penawaran and any(g.id_dosen == dosen.id_dosen for g in j.penawaran.pengajar_list)
        ]
        return [_jadwal_to_kelas_mk(j) for j in filtered]

    elif current_user.role == UserRoleEnum.mahasiswa:
        mhs = db.query(Mahasiswa).filter(Mahasiswa.email == current_user.email).first()
        if not mhs:
            return []
        # Filter jadwal where penawaran_kelas matches mahasiswa's prodi/angkatan/golongan
        filtered = [
            j for j in items
            if j.penawaran and any(
                k.id_prodi == mhs.id_prodi and k.id_angkatan == mhs.id_angkatan and k.id_golongan == mhs.id_golongan
                for k in j.penawaran.penawaran_kelas_list
            )
        ]
        return [_jadwal_to_kelas_mk(j) for j in filtered]

    # admin sees all
    return [_jadwal_to_kelas_mk(j) for j in items]


@kelas_mk_router.get("/dosen/{id_dosen}")
def list_kelas_mk_by_dosen(id_dosen: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = _load_jadwal_full(db)
    if not isinstance(items, list):
        items = []
    filtered = [
        j for j in items
        if j.penawaran and any(g.id_dosen == id_dosen for g in j.penawaran.pengajar_list)
    ]
    return [_jadwal_to_kelas_mk(j) for j in filtered]


@kelas_mk_router.get("/{id_kelas_mk}")
def detail_kelas_mk(id_kelas_mk: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    j = _load_jadwal_full(db, jadwal_id=id_kelas_mk)
    if not j:
        raise HTTPException(404, "Kelas mata kuliah tidak ditemukan")
    return _jadwal_to_kelas_mk(j)


class KelasMKUpdate(BaseModel):
    status: Optional[str] = None
    hari: Optional[str] = None
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    ruangan: Optional[str] = None


@kelas_mk_router.put("/{id_kelas_mk}")
def update_kelas_mk(id_kelas_mk: int, payload: KelasMKUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    j = db.query(Jadwal).filter(Jadwal.id_jadwal == id_kelas_mk).first()
    if not j:
        raise HTTPException(404, "Kelas mata kuliah tidak ditemukan")
    if payload.status:
        j.status = payload.status
    if payload.hari:
        j.hari = payload.hari
    if payload.ruangan is not None:
        j.ruangan = payload.ruangan
    db.commit()
    j = _load_jadwal_full(db, jadwal_id=id_kelas_mk)
    return _jadwal_to_kelas_mk(j)


@kelas_mk_router.delete("/{id_kelas_mk}", status_code=204)
def delete_kelas_mk(id_kelas_mk: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    j = db.query(Jadwal).filter(Jadwal.id_jadwal == id_kelas_mk).first()
    if not j:
        raise HTTPException(404, "Kelas mata kuliah tidak ditemukan")
    db.delete(j)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
#  USERS (composite view: User + Dosen/Mahasiswa)
# ═══════════════════════════════════════════════════════════════════════════════
users_router = APIRouter(prefix="/users", tags=["Users"])


def _user_to_composite(user: User, db: Session) -> dict:
    result = {
        "id_user": user.id,
        "nama": user.name,
        "username": user.email,
        "email": user.email,
        "role": user.role.value,
    }
    if user.role == UserRoleEnum.dosen or user.role == UserRoleEnum.admin:
        dosen = db.query(Dosen).filter(Dosen.email == user.email).first()
        if dosen:
            result["nip"] = dosen.nidn
            result["nama_dosen"] = dosen.nama_dosen
            result["email_dosen"] = dosen.email
            result["no_hp"] = dosen.no_hp
            result["status"] = dosen.status.value if dosen.status else "aktif"
            result["id_dosen"] = dosen.id_dosen
    elif user.role == UserRoleEnum.mahasiswa:
        mhs = db.query(Mahasiswa).filter(Mahasiswa.email == user.email).first()
        if mhs:
            result["nim"] = mhs.nim
            result["nama_mahasiswa"] = mhs.nama_mahasiswa
            result["id_prodi"] = mhs.id_prodi
            result["id_angkatan"] = mhs.id_angkatan
            result["id_golongan"] = mhs.id_golongan
            prodi = db.query(Prodi).filter(Prodi.id_prodi == mhs.id_prodi).first()
            angk = db.query(Angkatan).filter(Angkatan.id_angkatan == mhs.id_angkatan).first()
            gol = db.query(Golongan).filter(Golongan.id_golongan == mhs.id_golongan).first()
            result["nama_kelas"] = f"{prodi.kode_prodi}-{angk.tahun_angkatan}-{gol.nama_golongan}" if prodi and angk and gol else None
            result["id_mahasiswa"] = mhs.id_mahasiswa
    return result


@users_router.get("/")
def list_all_users(db: Session = Depends(get_db), _=Depends(get_current_user)):
    users = db.query(User).all()
    return [_user_to_composite(u, db) for u in users]


@users_router.get("/{user_id}")
def get_user_detail(user_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    return _user_to_composite(user, db)


class CreateUserComposite(BaseModel):
    name: str
    email: str
    password: str
    role: str
    nidn: Optional[str] = None
    nama_dosen: Optional[str] = None
    no_hp: Optional[str] = None
    nim: Optional[str] = None
    nama_mahasiswa: Optional[str] = None
    jenis_kelamin: Optional[str] = "L"
    id_prodi: Optional[int] = None
    id_angkatan: Optional[int] = None
    id_golongan: Optional[int] = None


@users_router.post("/", status_code=201)
def create_user_composite(payload: CreateUserComposite, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email sudah terdaftar")
    role_map = {"admin": UserRoleEnum.admin, "dosen": UserRoleEnum.dosen, "mahasiswa": UserRoleEnum.mahasiswa}
    role_enum = role_map.get(payload.role, UserRoleEnum.mahasiswa)
    try:
        user = User(name=payload.name, email=payload.email, password=get_password_hash(payload.password), role=role_enum)
        db.add(user)
        db.flush()
        if payload.role in ("admin", "dosen") and payload.nidn:
            if db.query(Dosen).filter(Dosen.nidn == payload.nidn).first():
                db.rollback()
                raise HTTPException(400, "NIDN sudah terdaftar")
            db.add(Dosen(nidn=payload.nidn, nama_dosen=payload.nama_dosen or payload.name, email=payload.email, no_hp=payload.no_hp))
        elif payload.role == "mahasiswa" and payload.nim:
            if db.query(Mahasiswa).filter(Mahasiswa.nim == payload.nim).first():
                db.rollback()
                raise HTTPException(400, "NIM sudah terdaftar")
            prodi_id = payload.id_prodi
            angkatan_id = payload.id_angkatan
            golongan_id = payload.id_golongan
            if not prodi_id:
                fp = db.query(Prodi).first()
                if not fp:
                    fp = Prodi(kode_prodi="TIF", nama_prodi="Teknik Informatika", jenjang="S1")
                    db.add(fp); db.flush(); db.refresh(fp)
                prodi_id = fp.id_prodi
            if not angkatan_id:
                fa = db.query(Angkatan).first()
                if not fa:
                    fa = Angkatan(tahun_angkatan=2024)
                    db.add(fa); db.flush(); db.refresh(fa)
                angkatan_id = fa.id_angkatan
            if not golongan_id:
                fg = db.query(Golongan).first()
                if not fg:
                    fg = Golongan(nama_golongan="A")
                    db.add(fg); db.flush(); db.refresh(fg)
                golongan_id = fg.id_golongan
            db.add(Mahasiswa(nim=payload.nim, nama_mahasiswa=payload.nama_mahasiswa or payload.name, email=payload.email, id_prodi=prodi_id, id_angkatan=angkatan_id, id_golongan=golongan_id, jenis_kelamin=payload.jenis_kelamin or "L"))
        db.commit()
        db.refresh(user)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Gagal membuat user: {str(e)}")
    return _user_to_composite(user, db)


class UpdateUserComposite(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    nidn: Optional[str] = None
    nama_dosen: Optional[str] = None
    no_hp: Optional[str] = None
    nim: Optional[str] = None
    nama_mahasiswa: Optional[str] = None
    id_prodi: Optional[int] = None
    id_angkatan: Optional[int] = None
    id_golongan: Optional[int] = None


@users_router.put("/{user_id}")
def update_user_composite(user_id: int, payload: UpdateUserComposite, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    old_email = user.email

    if user.role in (UserRoleEnum.admin, UserRoleEnum.dosen):
        dosen = db.query(Dosen).filter(Dosen.email == old_email).first()
        if dosen:
            if payload.nama_dosen: dosen.nama_dosen = payload.nama_dosen
            if payload.nidn: dosen.nidn = payload.nidn
            if payload.no_hp is not None: dosen.no_hp = payload.no_hp
            if payload.email: dosen.email = payload.email
    elif user.role == UserRoleEnum.mahasiswa:
        mhs = db.query(Mahasiswa).filter(Mahasiswa.email == old_email).first()
        if mhs:
            if payload.nama_mahasiswa: mhs.nama_mahasiswa = payload.nama_mahasiswa
            if payload.nim: mhs.nim = payload.nim
            if payload.id_prodi: mhs.id_prodi = payload.id_prodi
            if payload.id_angkatan: mhs.id_angkatan = payload.id_angkatan
            if payload.id_golongan: mhs.id_golongan = payload.id_golongan
            if payload.email: mhs.email = payload.email

    if payload.name:
        user.name = payload.name
    if payload.email:
        user.email = payload.email
    db.commit()
    db.refresh(user)
    return _user_to_composite(user, db)


@users_router.delete("/{user_id}", status_code=204)
def delete_user_composite(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    if user.role in (UserRoleEnum.admin, UserRoleEnum.dosen):
        dosen = db.query(Dosen).filter(Dosen.email == user.email).first()
        if dosen: db.delete(dosen)
    elif user.role == UserRoleEnum.mahasiswa:
        mhs = db.query(Mahasiswa).filter(Mahasiswa.email == user.email).first()
        if mhs: db.delete(mhs)
    db.delete(user)
    db.commit()
