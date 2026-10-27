from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from app.config.database import get_db
from app.models.user import User
from app.controllers.master_controller import (
    get_all_prodi, get_prodi_by_id, create_prodi, update_prodi, delete_prodi,
    get_all_angkatan, get_angkatan_by_id, create_angkatan, update_angkatan, delete_angkatan,
    get_all_golongan, get_golongan_by_id, create_golongan, update_golongan, delete_golongan,
    get_all_matakuliah, get_matakuliah_by_id, create_matakuliah, update_matakuliah, delete_matakuliah,
    get_all_dosen, get_dosen_by_id, get_dosen_by_nidn, create_dosen, update_dosen, delete_dosen,
)
from app.schemas.master import (
    ProdiCreate, ProdiUpdate, ProdiResponse,
    AngkatanCreate, AngkatanUpdate, AngkatanResponse,
    GolonganCreate, GolonganUpdate, GolonganResponse,
    MataKuliahCreate, MataKuliahUpdate, MataKuliahResponse,
)
from app.schemas.dosen import DosenCreate, DosenUpdate, DosenResponse
from app.utils.dependencies import get_current_user, require_admin

router = APIRouter()

# ─── PRODI ────────────────────────────────────────────────────────────────────
prodi_router = APIRouter(prefix="/prodi", tags=["Prodi"])

@prodi_router.get("/", response_model=List[ProdiResponse])
def list_prodi(db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_prodi(db)

@prodi_router.post("/", response_model=ProdiResponse, status_code=201)
def add_prodi(payload: ProdiCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_prodi(db, payload)

@prodi_router.get("/{prodi_id}", response_model=ProdiResponse)
def detail_prodi(prodi_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_prodi_by_id(db, prodi_id)

@prodi_router.put("/{prodi_id}", response_model=ProdiResponse)
def edit_prodi(prodi_id: int, payload: ProdiUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_prodi(db, prodi_id, payload)

@prodi_router.delete("/{prodi_id}", status_code=204)
def hapus_prodi(prodi_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_prodi(db, prodi_id)

# ─── ANGKATAN ─────────────────────────────────────────────────────────────────
angkatan_router = APIRouter(prefix="/angkatan", tags=["Angkatan"])

@angkatan_router.get("/", response_model=List[AngkatanResponse])
def list_angkatan(db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_angkatan(db)

@angkatan_router.post("/", response_model=AngkatanResponse, status_code=201)
def add_angkatan(payload: AngkatanCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_angkatan(db, payload)

@angkatan_router.get("/{angkatan_id}", response_model=AngkatanResponse)
def detail_angkatan(angkatan_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_angkatan_by_id(db, angkatan_id)

@angkatan_router.put("/{angkatan_id}", response_model=AngkatanResponse)
def edit_angkatan(angkatan_id: int, payload: AngkatanUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_angkatan(db, angkatan_id, payload)

@angkatan_router.delete("/{angkatan_id}", status_code=204)
def hapus_angkatan(angkatan_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_angkatan(db, angkatan_id)

# ─── GOLONGAN ─────────────────────────────────────────────────────────────────
golongan_router = APIRouter(prefix="/golongan", tags=["Golongan"])

@golongan_router.get("/", response_model=List[GolonganResponse])
def list_golongan(db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_golongan(db)

@golongan_router.post("/", response_model=GolonganResponse, status_code=201)
def add_golongan(payload: GolonganCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_golongan(db, payload)

@golongan_router.get("/{golongan_id}", response_model=GolonganResponse)
def detail_golongan(golongan_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_golongan_by_id(db, golongan_id)

@golongan_router.put("/{golongan_id}", response_model=GolonganResponse)
def edit_golongan(golongan_id: int, payload: GolonganUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_golongan(db, golongan_id, payload)

@golongan_router.delete("/{golongan_id}", status_code=204)
def hapus_golongan(golongan_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_golongan(db, golongan_id)

# ─── MATA KULIAH ──────────────────────────────────────────────────────────────
mk_router = APIRouter(prefix="/matakuliah", tags=["Mata Kuliah"])

@mk_router.get("/", response_model=List[MataKuliahResponse])
def list_mk(db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_matakuliah(db)

@mk_router.post("/", response_model=MataKuliahResponse, status_code=201)
def add_mk(payload: MataKuliahCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_matakuliah(db, payload)

@mk_router.get("/{mk_id}", response_model=MataKuliahResponse)
def detail_mk(mk_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_matakuliah_by_id(db, mk_id)

@mk_router.put("/{mk_id}", response_model=MataKuliahResponse)
def edit_mk(mk_id: int, payload: MataKuliahUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_matakuliah(db, mk_id, payload)

@mk_router.delete("/{mk_id}", status_code=204)
def hapus_mk(mk_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_matakuliah(db, mk_id)

# ─── DOSEN ────────────────────────────────────────────────────────────────────
dosen_router = APIRouter(prefix="/dosen", tags=["Dosen"])

@dosen_router.get("/", response_model=List[DosenResponse])
def list_dosen(status_filter: str | None = None, db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_dosen(db, status_filter)

@dosen_router.post("/", response_model=DosenResponse, status_code=201)
def add_dosen(payload: DosenCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_dosen(db, payload)

@dosen_router.get("/nidn/{nidn}", response_model=DosenResponse)
def cari_dosen_nidn(nidn: str, db=Depends(get_db), _=Depends(get_current_user)):
    return get_dosen_by_nidn(db, nidn)

@dosen_router.get("/{dosen_id}", response_model=DosenResponse)
def detail_dosen(dosen_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_dosen_by_id(db, dosen_id)

@dosen_router.put("/{dosen_id}", response_model=DosenResponse)
def edit_dosen(dosen_id: int, payload: DosenUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_dosen(db, dosen_id, payload)

@dosen_router.delete("/{dosen_id}", status_code=204)
def hapus_dosen(dosen_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_dosen(db, dosen_id)
