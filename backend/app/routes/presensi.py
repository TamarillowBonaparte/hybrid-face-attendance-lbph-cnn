from fastapi import APIRouter, Depends, UploadFile, File
from typing import List
from app.config.database import get_db
from app.models.dataset_wajah import DatasetWajah, JenisFotoEnum
from app.models.mahasiswa import Mahasiswa
from app.models.registrasi_wajah import RegistrasiWajah
from app.models.log_deteksi import LogDeteksi
from app.controllers.presensi_controller import (
    get_all_presensi, get_presensi_by_id, create_presensi_manual,
    absensi_face_recognition, update_presensi, delete_presensi,
    rekap_per_pertemuan, rekap_mahasiswa_per_jadwal,
    create_log_deteksi, get_all_log, get_log_by_id, update_log_deteksi, delete_log_deteksi,
    create_registrasi, update_registrasi, get_registrasi_by_id, delete_registrasi,
    get_dataset_by_id, update_dataset_wajah,
)
from app.schemas.presensi import (
    PresensiCreate, PresensiUpdate, PresensiResponse,
    FaceRecognitionAbsenRequest, RekapPresensiResponse,
    DatasetWajahUpdate, DatasetWajahResponse,
    RegistrasiWajahCreate, RegistrasiWajahUpdate, RegistrasiWajahResponse,
    LogDeteksiCreate, LogDeteksiUpdate, LogDeteksiResponse,
)
from app.utils.dependencies import get_current_user, require_admin, require_dosen
from app.utils.helpers import save_dataset_file, delete_file_if_exists

# ─── PRESENSI ─────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/presensi", tags=["Presensi"])


@router.get("/", response_model=List[PresensiResponse])
def list_presensi(id_pertemuan: int | None = None, id_mahasiswa: int | None = None, status_filter: str | None = None, skip: int = 0, limit: int = 100, db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_presensi(db, id_pertemuan, id_mahasiswa, status_filter, skip, limit)


@router.post("/", response_model=PresensiResponse, status_code=201, summary="Buat presensi manual")
def add_presensi(payload: PresensiCreate, db=Depends(get_db), _=Depends(require_dosen)):
    return create_presensi_manual(db, payload)


@router.post("/face-recognition", response_model=PresensiResponse, summary="Absensi via face recognition")
def absen_face(payload: FaceRecognitionAbsenRequest, db=Depends(get_db), _=Depends(get_current_user)):
    return absensi_face_recognition(db, payload)


@router.get("/rekap/pertemuan/{pertemuan_id}", summary="Rekap presensi per pertemuan")
def rekap_pertemuan(pertemuan_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return rekap_per_pertemuan(db, pertemuan_id)


@router.get("/rekap/mahasiswa/{mahasiswa_id}/jadwal/{jadwal_id}", response_model=RekapPresensiResponse)
def rekap_mahasiswa(mahasiswa_id: int, jadwal_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return rekap_mahasiswa_per_jadwal(db, mahasiswa_id, jadwal_id)


@router.get("/{presensi_id}", response_model=PresensiResponse)
def detail_presensi(presensi_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_presensi_by_id(db, presensi_id)


@router.put("/{presensi_id}", response_model=PresensiResponse)
def edit_presensi(presensi_id: int, payload: PresensiUpdate, db=Depends(get_db), _=Depends(require_dosen)):
    return update_presensi(db, presensi_id, payload)


@router.delete("/{presensi_id}", status_code=204)
def hapus_presensi(presensi_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_presensi(db, presensi_id)


# ─── DATASET WAJAH ────────────────────────────────────────────────────────────
dataset_router = APIRouter(prefix="/dataset-wajah", tags=["Dataset Wajah"])


@dataset_router.get("/", response_model=List[DatasetWajahResponse])
def list_dataset(id_mahasiswa: int | None = None, jenis_foto: str | None = None, db=Depends(get_db), _=Depends(get_current_user)):
    q = db.query(DatasetWajah)
    if id_mahasiswa:
        q = q.filter(DatasetWajah.id_mahasiswa == id_mahasiswa)
    if jenis_foto:
        q = q.filter(DatasetWajah.jenis_foto == jenis_foto)
    return q.order_by(DatasetWajah.created_at.desc()).all()


@dataset_router.post("/upload/{mahasiswa_id}", response_model=DatasetWajahResponse, status_code=201)
def upload_foto(mahasiswa_id: int, file: UploadFile = File(...), jenis_foto: JenisFotoEnum = JenisFotoEnum.registrasi, db=Depends(get_db), _=Depends(require_dosen)):
    from fastapi import HTTPException
    mhs = db.query(Mahasiswa).filter(
        Mahasiswa.id_mahasiswa == mahasiswa_id).first()
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    count = db.query(DatasetWajah).filter(
        DatasetWajah.id_mahasiswa == mahasiswa_id).count()
    path = save_dataset_file(file, mahasiswa_id, mhs.nim, count + 1)
    d = DatasetWajah(id_mahasiswa=mahasiswa_id,
                     foto_path=path, jenis_foto=jenis_foto)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@dataset_router.get("/mahasiswa/{mahasiswa_id}/count")
def count_dataset(mahasiswa_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    total = db.query(DatasetWajah).filter(
        DatasetWajah.id_mahasiswa == mahasiswa_id).count()
    return {"id_mahasiswa": mahasiswa_id, "total_foto": total, "siap_registrasi": total >= 3}


@dataset_router.get("/{dataset_id}", response_model=DatasetWajahResponse)
def detail_dataset(dataset_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_dataset_by_id(db, dataset_id)


@dataset_router.put("/{dataset_id}", response_model=DatasetWajahResponse)
def edit_dataset(dataset_id: int, payload: DatasetWajahUpdate, db=Depends(get_db), _=Depends(require_dosen)):
    return update_dataset_wajah(db, dataset_id, payload)


@dataset_router.delete("/{dataset_id}", status_code=204)
def hapus_dataset(dataset_id: int, db=Depends(get_db), _=Depends(require_admin)):
    from fastapi import HTTPException
    d = db.query(DatasetWajah).filter(
        DatasetWajah.id_dataset == dataset_id).first()
    if not d:
        raise HTTPException(404, "Dataset tidak ditemukan")
    delete_file_if_exists(d.foto_path)
    db.delete(d)
    db.commit()


# ─── REGISTRASI WAJAH ─────────────────────────────────────────────────────────
registrasi_router = APIRouter(
    prefix="/registrasi-wajah", tags=["Registrasi Wajah"])


@registrasi_router.get("/", response_model=List[RegistrasiWajahResponse])
def list_registrasi(id_mahasiswa: int | None = None, db=Depends(get_db), _=Depends(get_current_user)):
    q = db.query(RegistrasiWajah)
    if id_mahasiswa:
        q = q.filter(RegistrasiWajah.id_mahasiswa == id_mahasiswa)
    return q.order_by(RegistrasiWajah.created_at.desc()).all()


@registrasi_router.post("/", response_model=RegistrasiWajahResponse, status_code=201)
def add_registrasi(payload: RegistrasiWajahCreate, db=Depends(get_db), _=Depends(require_dosen)):
    return create_registrasi(db, payload)


@registrasi_router.get("/{reg_id}", response_model=RegistrasiWajahResponse)
def detail_registrasi(reg_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_registrasi_by_id(db, reg_id)


@registrasi_router.put("/{reg_id}", response_model=RegistrasiWajahResponse)
def edit_registrasi(reg_id: int, payload: RegistrasiWajahUpdate, db=Depends(get_db), _=Depends(require_dosen)):
    return update_registrasi(db, reg_id, payload)


@registrasi_router.delete("/{reg_id}", status_code=204)
def hapus_registrasi(reg_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_registrasi(db, reg_id)


# ─── LOG DETEKSI ──────────────────────────────────────────────────────────────
log_router = APIRouter(prefix="/log-deteksi", tags=["Log Deteksi"])


@log_router.get("/", response_model=List[LogDeteksiResponse])
def list_log(id_mahasiswa: int | None = None, hasil_filter: str | None = None, skip: int = 0, limit: int = 100, db=Depends(get_db), _=Depends(get_current_user)):
    return get_all_log(db, id_mahasiswa, hasil_filter, skip, limit)


@log_router.get("/statistik")
def statistik_log(db=Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import func
    stats = db.query(LogDeteksi.hasil_deteksi, func.count(
        LogDeteksi.id_log)).group_by(LogDeteksi.hasil_deteksi).all()
    total = sum(c for _, c in stats)
    return {"total_deteksi": total, "ringkasan": {h.value: c for h, c in stats}}


@log_router.post("/", response_model=LogDeteksiResponse, status_code=201)
def add_log(payload: LogDeteksiCreate, db=Depends(get_db), _=Depends(get_current_user)):
    return create_log_deteksi(db, payload)


@log_router.get("/{log_id}", response_model=LogDeteksiResponse)
def detail_log(log_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_log_by_id(db, log_id)


@log_router.put("/{log_id}", response_model=LogDeteksiResponse)
def edit_log(log_id: int, payload: LogDeteksiUpdate, db=Depends(get_db), _=Depends(require_dosen)):
    return update_log_deteksi(db, log_id, payload)


@log_router.delete("/{log_id}", status_code=204)
def hapus_log(log_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_log_deteksi(db, log_id)
