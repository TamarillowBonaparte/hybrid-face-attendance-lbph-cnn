from typing import List, Optional
from fastapi import APIRouter, Depends
from app.config.database import get_db
from app.controllers.geolokasi_controller import (
    get_all_geolokasi,
    get_geolokasi_by_id,
    create_geolokasi,
    update_geolokasi,
    delete_geolokasi,
)
from app.schemas.geolokasi import GeolokasiCreate, GeolokasiUpdate, GeolokasiResponse
from app.utils.dependencies import get_current_user, require_admin, require_dosen

router = APIRouter(prefix="/geolokasi", tags=["Geolokasi"])


@router.get("/", response_model=List[GeolokasiResponse], summary="Daftar semua lokasi presensi")
def list_geolokasi(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db=Depends(get_db),
    _=Depends(get_current_user),
):
    return get_all_geolokasi(db, status_filter, skip, limit)


@router.post("/", response_model=GeolokasiResponse, status_code=201, summary="Tambah lokasi presensi baru")
def add_geolokasi(payload: GeolokasiCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_geolokasi(db, payload)


@router.get("/{geolokasi_id}", response_model=GeolokasiResponse, summary="Detail lokasi presensi")
def detail_geolokasi(geolokasi_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_geolokasi_by_id(db, geolokasi_id)


@router.put("/{geolokasi_id}", response_model=GeolokasiResponse, summary="Update lokasi presensi")
def edit_geolokasi(
    geolokasi_id: int,
    payload: GeolokasiUpdate,
    db=Depends(get_db),
    _=Depends(require_admin),
):
    return update_geolokasi(db, geolokasi_id, payload)


@router.delete("/{geolokasi_id}", status_code=204, summary="Hapus lokasi presensi")
def hapus_geolokasi(geolokasi_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_geolokasi(db, geolokasi_id)
