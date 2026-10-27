from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from app.config.database import get_db
from app.controllers.penawaran_controller import (
    get_all_penawaran, get_penawaran_by_id, create_penawaran, update_penawaran, delete_penawaran,
    get_kelas_by_penawaran, add_kelas_to_penawaran, add_kelas_to_penawaran_by_kelas_id, remove_kelas_from_penawaran,
    get_pengajar_by_penawaran, add_pengajar_to_penawaran, update_pengajar_role, remove_pengajar,
    get_pengajar_pertemuan, add_pengajar_pertemuan, remove_pengajar_pertemuan,
)
from app.schemas.penawaran import (
    PenawaranCreate, PenawaranUpdate,
    PenawaranKelasCreate, PenawaranKelasUpdate,
    PengajarCreate, PengajarUpdate,
    PengajarPertemuanCreate,
)
from app.utils.dependencies import get_current_user, require_admin, require_dosen

# ─── PENAWARAN MATA KULIAH ────────────────────────────────────────────────────
penawaran_router = APIRouter(prefix="/penawaran-matakuliah", tags=["Penawaran Mata Kuliah"])


@penawaran_router.get("/")
def list_penawaran(
    id_matakuliah: int | None = None,
    status_filter: str | None = None,
    skip: int = 0, limit: int = 100,
    db=Depends(get_db), _=Depends(get_current_user),
):
    return get_all_penawaran(db, id_matakuliah, status_filter, skip, limit)


@penawaran_router.post("/", status_code=201)
def create_penawaran_mk(payload: PenawaranCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_penawaran(db, payload)


@penawaran_router.get("/{id_penawaran}")
def detail_penawaran(id_penawaran: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_penawaran_by_id(db, id_penawaran)


@penawaran_router.put("/{id_penawaran}")
def edit_penawaran(id_penawaran: int, payload: PenawaranUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_penawaran(db, id_penawaran, payload)


@penawaran_router.delete("/{id_penawaran}", status_code=204)
def hapus_penawaran(id_penawaran: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_penawaran(db, id_penawaran)


# ─── PENAWARAN KELAS ──────────────────────────────────────────────────────────
penawaran_kelas_router = APIRouter(prefix="/penawaran-kelas", tags=["Penawaran Kelas"])


@penawaran_kelas_router.get("/penawaran/{id_penawaran}")
def list_kelas(id_penawaran: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_kelas_by_penawaran(db, id_penawaran)


@penawaran_kelas_router.post("/", status_code=201)
def add_kelas(payload: PenawaranKelasCreate, db=Depends(get_db), _=Depends(require_admin)):
    return add_kelas_to_penawaran(db, payload)


class KelasFromKelasPayload(BaseModel):
    id_penawaran: int
    id_kelas: int


@penawaran_kelas_router.post("/from-kelas", status_code=201)
def add_kelas_from_kelas_id(payload: KelasFromKelasPayload, db=Depends(get_db), _=Depends(require_admin)):
    """Tambah kelas ke penawaran menggunakan id_kelas dari tabel kelas langsung."""
    return add_kelas_to_penawaran_by_kelas_id(db, payload.id_penawaran, payload.id_kelas)


@penawaran_kelas_router.delete("/{kelas_id}", status_code=204)
def hapus_kelas(kelas_id: int, db=Depends(get_db), _=Depends(require_admin)):
    remove_kelas_from_penawaran(db, kelas_id)


# ─── PENGAJAR ─────────────────────────────────────────────────────────────────
pengajar_router = APIRouter(prefix="/pengajar", tags=["Pengajar"])


@pengajar_router.get("/penawaran/{id_penawaran}")
def list_pengajar(id_penawaran: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_pengajar_by_penawaran(db, id_penawaran)


@pengajar_router.post("/", status_code=201)
def add_pengajar(payload: PengajarCreate, db=Depends(get_db), _=Depends(require_admin)):
    return add_pengajar_to_penawaran(db, payload)


@pengajar_router.put("/{pengajar_id}")
def edit_pengajar_role(pengajar_id: int, payload: PengajarUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_pengajar_role(db, pengajar_id, payload)


@pengajar_router.delete("/{pengajar_id}", status_code=204)
def hapus_pengajar(pengajar_id: int, db=Depends(get_db), _=Depends(require_admin)):
    remove_pengajar(db, pengajar_id)


# ─── PENGAJAR PERTEMUAN ───────────────────────────────────────────────────────
pengajar_pertemuan_router = APIRouter(prefix="/pengajar-pertemuan", tags=["Pengajar Pertemuan"])


@pengajar_pertemuan_router.get("/pertemuan/{id_pertemuan}")
def list_pengajar_pertemuan(id_pertemuan: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_pengajar_pertemuan(db, id_pertemuan)


@pengajar_pertemuan_router.post("/", status_code=201)
def add_pengajar_in_pertemuan(payload: PengajarPertemuanCreate, db=Depends(get_db), _=Depends(require_dosen)):
    return add_pengajar_pertemuan(db, payload)


@pengajar_pertemuan_router.delete("/{pp_id}", status_code=204)
def hapus_pengajar_pertemuan(pp_id: int, db=Depends(get_db), _=Depends(require_admin)):
    remove_pengajar_pertemuan(db, pp_id)
