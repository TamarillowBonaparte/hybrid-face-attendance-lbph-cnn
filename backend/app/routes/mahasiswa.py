from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from typing import List
import os
from app.config.database import get_db
from app.config.settings import settings
from app.controllers.mahasiswa_controller import (
    get_all_mahasiswa, get_mahasiswa_by_id, get_mahasiswa_by_nim,
    create_mahasiswa, update_mahasiswa, delete_mahasiswa, bulk_create_mahasiswa, bulk_delete_mahasiswa
)
from app.schemas.dosen import MahasiswaCreate, MahasiswaUpdate, MahasiswaResponse
from app.utils.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/mahasiswa", tags=["Mahasiswa"])

@router.get("/nim/{nim}/foto", response_class=FileResponse)
def get_foto_mahasiswa(nim: str):
    """
    Mengambil foto profile mahasiswa berdasarkan NIM.
    Akan mencari foto pertama (foto_001.jpg) di folder face_mahasiswa/{nim}.
    """
    foto_dir = settings.FACE_MAHASISWA_DIR / nim
    
    foto_path = foto_dir / "foto_001.jpg"
    
    if foto_path.exists():
        return FileResponse(str(foto_path))
        
    # Jika foto_001.jpg tidak ada, cari foto .jpg apa saja
    if foto_dir.exists():
        for f in os.listdir(foto_dir):
            if f.endswith(".jpg"):
                return FileResponse(str(foto_dir / f))
                
    raise HTTPException(status_code=404, detail="Foto tidak ditemukan")


@router.get("/", response_model=List[MahasiswaResponse])
def list_mahasiswa(
    id_prodi: int | None = None, id_angkatan: int | None = None,
    id_golongan: int | None = None, status_filter: str | None = None,
    skip: int = 0, limit: int = 100,
    db=Depends(get_db), _=Depends(get_current_user),
):
    return get_all_mahasiswa(db, id_prodi, id_angkatan, id_golongan, status_filter, skip, limit)


@router.post("/", response_model=MahasiswaResponse, status_code=201)
def add_mahasiswa(payload: MahasiswaCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_mahasiswa(db, payload)


@router.post("/bulk", status_code=201)
def add_mahasiswa_bulk(payloads: List[MahasiswaCreate], db=Depends(get_db), _=Depends(require_admin)):
    return bulk_create_mahasiswa(db, payloads)

@router.post("/bulk-delete", status_code=200)
def hapus_mahasiswa_bulk(payload: List[int], db=Depends(get_db), _=Depends(require_admin)):
    return bulk_delete_mahasiswa(db, payload)


@router.get("/nim/{nim}", response_model=MahasiswaResponse)
def cari_mahasiswa_nim(nim: str, db=Depends(get_db), _=Depends(get_current_user)):
    return get_mahasiswa_by_nim(db, nim)


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def detail_mahasiswa(mahasiswa_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_mahasiswa_by_id(db, mahasiswa_id)


@router.put("/{mahasiswa_id}", response_model=MahasiswaResponse)
def edit_mahasiswa(mahasiswa_id: int, payload: MahasiswaUpdate, db=Depends(get_db), _=Depends(require_admin)):
    return update_mahasiswa(db, mahasiswa_id, payload)


@router.delete("/{mahasiswa_id}", status_code=204)
def hapus_mahasiswa(mahasiswa_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_mahasiswa(db, mahasiswa_id)
