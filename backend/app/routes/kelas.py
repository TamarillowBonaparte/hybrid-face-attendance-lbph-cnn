from typing import List

from app.config.database import get_db
from app.controllers.kelas_controller import (
    create_kelas,
    delete_kelas,
    get_all_kelas,
    get_kelas_by_id,
    update_kelas,
)
from app.schemas.kelas import KelasCreate, KelasResponse, KelasUpdate
from app.utils.dependencies import get_current_user, require_admin
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/kelas", tags=["Kelas"])


@router.get("/", response_model=List[KelasResponse])
def list_kelas(
    id_prodi: int | None = None,
    angkatan: int | None = None,
    db=Depends(get_db),
    _=Depends(get_current_user),
):
    return get_all_kelas(db, id_prodi, angkatan)


@router.post("/", response_model=KelasResponse, status_code=201)
def add_kelas(payload: KelasCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_kelas(db, payload)


@router.get("/{kelas_id}", response_model=KelasResponse)
def detail_kelas(kelas_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_kelas_by_id(db, kelas_id)


@router.put("/{kelas_id}", response_model=KelasResponse)
def edit_kelas(
    kelas_id: int, payload: KelasUpdate, db=Depends(get_db), _=Depends(require_admin)
):
    return update_kelas(db, kelas_id, payload)


@router.delete("/{kelas_id}", status_code=204)
def hapus_kelas(kelas_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_kelas(db, kelas_id)
