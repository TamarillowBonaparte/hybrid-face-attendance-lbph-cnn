from datetime import datetime, timezone

from app.models.dataset_wajah import DatasetWajah, JenisFotoEnum
from app.models.log_deteksi import LogDeteksi
from app.models.mahasiswa import Mahasiswa
from app.models.pertemuan import Pertemuan, StatusPertemuanEnum
from app.models.presensi import Presensi, StatusPresensiEnum
from app.models.registrasi_wajah import RegistrasiWajah
from app.schemas.presensi import (
    DatasetWajahUpdate,
    FaceRecognitionAbsenRequest,
    LogDeteksiCreate,
    LogDeteksiUpdate,
    PresensiCreate,
    PresensiUpdate,
    RegistrasiWajahCreate,
    RegistrasiWajahUpdate,
    RekapPresensiResponse,
)
from fastapi import HTTPException
from sqlalchemy.orm import Session

# ─── PRESENSI ─────────────────────────────────────────────────────────────────


def get_all_presensi(
    db, id_pertemuan=None, id_mahasiswa=None, status_filter=None, skip=0, limit=100
):
    q = db.query(Presensi)
    if id_pertemuan:
        q = q.filter(Presensi.id_pertemuan == id_pertemuan)
    if id_mahasiswa:
        q = q.filter(Presensi.id_mahasiswa == id_mahasiswa)
    if status_filter:
        q = q.filter(Presensi.status_presensi == status_filter)
    return q.offset(skip).limit(limit).all()


def get_presensi_by_id(db, presensi_id: int):
    p = db.query(Presensi).filter(Presensi.id_presensi == presensi_id).first()
    if not p:
        raise HTTPException(404, "Presensi tidak ditemukan")
    return p


def create_presensi_manual(db, payload: PresensiCreate):
    if (
        not db.query(Pertemuan)
        .filter(Pertemuan.id_pertemuan == payload.id_pertemuan)
        .first()
    ):
        raise HTTPException(404, "Pertemuan tidak ditemukan")
    if (
        not db.query(Mahasiswa)
        .filter(Mahasiswa.id_mahasiswa == payload.id_mahasiswa)
        .first()
    ):
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    if (
        db.query(Presensi)
        .filter(
            Presensi.id_pertemuan == payload.id_pertemuan,
            Presensi.id_mahasiswa == payload.id_mahasiswa,
        )
        .first()
    ):
        raise HTTPException(400, "Presensi sudah tercatat")
    p = Presensi(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def absensi_face_recognition(db, payload: FaceRecognitionAbsenRequest):
    pertemuan = (
        db.query(Pertemuan)
        .filter(Pertemuan.id_pertemuan == payload.id_pertemuan)
        .first()
    )
    if not pertemuan:
        raise HTTPException(404, "Pertemuan tidak ditemukan")
    if pertemuan.status_pertemuan != StatusPertemuanEnum.sedang:
        raise HTTPException(400, "Sesi absensi tidak sedang berlangsung")
    mahasiswa = (
        db.query(Mahasiswa)
        .filter(Mahasiswa.id_mahasiswa == payload.id_mahasiswa)
        .first()
    )
    if not mahasiswa:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")

    # ── Validasi Geolokasi ───────────────────────────────────────────────────
    jarak_meter = None
    if pertemuan.mode_lokasi and pertemuan.mode_lokasi.value == "wajib":
        if payload.latitude is None or payload.longitude is None:
            raise HTTPException(
                400,
                "Presensi ini memerlukan verifikasi lokasi. "
                "Mohon aktifkan GPS dan coba lagi.",
            )
        if pertemuan.id_geolokasi:
            from app.controllers.geolokasi_controller import validasi_lokasi
            from app.models.geolokasi import Geolokasi

            geo = (
                db.query(Geolokasi)
                .filter(Geolokasi.id_geolokasi == pertemuan.id_geolokasi)
                .first()
            )
            if geo:
                jarak_meter = validasi_lokasi(payload.latitude, payload.longitude, geo)

    import zoneinfo
    waktu = datetime.now(zoneinfo.ZoneInfo("Asia/Jakarta")).replace(tzinfo=None)
    # Tentukan status hadir/terlambat
    status = StatusPresensiEnum.hadir
    if pertemuan.batas_presensi:
        batas = pertemuan.batas_presensi
        if batas.tzinfo is not None:
            batas = batas.replace(tzinfo=None)
        if waktu > batas:
            status = StatusPresensiEnum.terlambat

    existing = (
        db.query(Presensi)
        .filter(
            Presensi.id_pertemuan == payload.id_pertemuan,
            Presensi.id_mahasiswa == payload.id_mahasiswa,
        )
        .first()
    )
    if existing:
        if existing.status_presensi in (
            StatusPresensiEnum.belum,
            StatusPresensiEnum.alpha,
        ):
            existing.status_presensi = status
            existing.waktu_presensi = waktu
            existing.confidence_score = payload.confidence_score
            existing.lbph_score = payload.lbph_score
            existing.cnn_score = payload.cnn_score
            existing.metode_deteksi = payload.metode_deteksi
            existing.foto_verifikasi = payload.foto_verifikasi
            existing.latitude_presensi = payload.latitude
            existing.longitude_presensi = payload.longitude
            existing.jarak_meter = jarak_meter
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(400, "Mahasiswa sudah melakukan absensi")

    p = Presensi(
        id_pertemuan=payload.id_pertemuan,
        id_mahasiswa=payload.id_mahasiswa,
        waktu_presensi=waktu,
        status_presensi=status,
        confidence_score=payload.confidence_score,
        lbph_score=payload.lbph_score,
        cnn_score=payload.cnn_score,
        metode_deteksi=payload.metode_deteksi,
        foto_verifikasi=payload.foto_verifikasi,
        latitude_presensi=payload.latitude,
        longitude_presensi=payload.longitude,
        jarak_meter=jarak_meter,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def update_presensi(db, presensi_id: int, payload: PresensiUpdate):
    p = get_presensi_by_id(db, presensi_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


def delete_presensi(db, presensi_id: int):
    p = get_presensi_by_id(db, presensi_id)
    db.delete(p)
    db.commit()


def rekap_per_pertemuan(db, pertemuan_id: int):
    pertemuan = (
        db.query(Pertemuan).filter(Pertemuan.id_pertemuan == pertemuan_id).first()
    )
    if not pertemuan:
        raise HTTPException(404, "Pertemuan tidak ditemukan")
    records = (
        db.query(Presensi, Mahasiswa)
        .join(Mahasiswa, Presensi.id_mahasiswa == Mahasiswa.id_mahasiswa)
        .filter(Presensi.id_pertemuan == pertemuan_id)
        .all()
    )
    return [
        {
            "id_presensi": p.id_presensi,
            "id_mahasiswa": m.id_mahasiswa,
            "nim": m.nim,
            "nama_mahasiswa": m.nama_mahasiswa,
            "status_presensi": p.status_presensi.value,
            "waktu_presensi": p.waktu_presensi,
            "confidence_score": p.confidence_score,
            "lbph_score": p.lbph_score,
            "cnn_score": p.cnn_score,
        }
        for p, m in records
    ]


def rekap_mahasiswa_per_jadwal(db, mahasiswa_id: int, jadwal_id: int):
    mhs = db.query(Mahasiswa).filter(Mahasiswa.id_mahasiswa == mahasiswa_id).first()
    if not mhs:
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    pertemuan_ids = [
        p.id_pertemuan
        for p in db.query(Pertemuan).filter(Pertemuan.id_jadwal == jadwal_id).all()
    ]
    total = len(pertemuan_ids)
    plist = (
        db.query(Presensi)
        .filter(
            Presensi.id_mahasiswa == mahasiswa_id,
            Presensi.id_pertemuan.in_(pertemuan_ids),
        )
        .all()
    )
    hadir = sum(1 for p in plist if p.status_presensi.value == "hadir")
    terlambat = sum(1 for p in plist if p.status_presensi.value == "terlambat")
    izin = sum(1 for p in plist if p.status_presensi.value == "izin")
    sakit = sum(1 for p in plist if p.status_presensi.value == "sakit")
    alpha = sum(1 for p in plist if p.status_presensi.value == "alpha")
    persen = round(((hadir + terlambat) / total * 100), 2) if total > 0 else 0.0
    return RekapPresensiResponse(
        id_mahasiswa=mhs.id_mahasiswa,
        nim=mhs.nim,
        nama_mahasiswa=mhs.nama_mahasiswa,
        total_hadir=hadir,
        total_terlambat=terlambat,
        total_izin=izin,
        total_sakit=sakit,
        total_alpha=alpha,
        total_pertemuan=total,
        persentase_kehadiran=persen,
    )


# ─── LOG DETEKSI ──────────────────────────────────────────────────────────────


def create_log_deteksi(db, payload: LogDeteksiCreate):
    log = LogDeteksi(**payload.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_all_log(db, id_mahasiswa=None, hasil_filter=None, skip=0, limit=100):
    q = db.query(LogDeteksi)
    if id_mahasiswa:
        q = q.filter(LogDeteksi.id_mahasiswa == id_mahasiswa)
    if hasil_filter:
        q = q.filter(LogDeteksi.hasil_deteksi == hasil_filter)
    return q.order_by(LogDeteksi.waktu_deteksi.desc()).offset(skip).limit(limit).all()


# ─── REGISTRASI WAJAH ─────────────────────────────────────────────────────────


def create_registrasi(db, payload: RegistrasiWajahCreate):
    if (
        not db.query(Mahasiswa)
        .filter(Mahasiswa.id_mahasiswa == payload.id_mahasiswa)
        .first()
    ):
        raise HTTPException(404, "Mahasiswa tidak ditemukan")
    jumlah_foto = (
        db.query(DatasetWajah)
        .filter(DatasetWajah.id_mahasiswa == payload.id_mahasiswa)
        .count()
    )
    if jumlah_foto < 3:
        raise HTTPException(400, f"Minimal 3 foto diperlukan (saat ini: {jumlah_foto})")
    data = payload.model_dump()
    data["jumlah_foto"] = jumlah_foto
    reg = RegistrasiWajah(**data)
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg




def update_registrasi(db, reg_id: int, payload: RegistrasiWajahUpdate):
    reg = (
        db.query(RegistrasiWajah)
        .filter(RegistrasiWajah.id_registrasi == reg_id)
        .first()
    )
    if not reg:
        raise HTTPException(404, "Registrasi tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(reg, k, v)
    db.commit()
    db.refresh(reg)
    return reg


def get_registrasi_by_id(db, reg_id: int):
    reg = (
        db.query(RegistrasiWajah)
        .filter(RegistrasiWajah.id_registrasi == reg_id)
        .first()
    )
    if not reg:
        raise HTTPException(404, "Registrasi tidak ditemukan")
    return reg


def delete_registrasi(db, reg_id: int):
    reg = (
        db.query(RegistrasiWajah)
        .filter(RegistrasiWajah.id_registrasi == reg_id)
        .first()
    )
    if not reg:
        raise HTTPException(404, "Registrasi tidak ditemukan")
    db.delete(reg)
    db.commit()


# ─── DATASET WAJAH ────────────────────────────────────────────────────────────


def get_dataset_by_id(db, dataset_id: int):
    d = db.query(DatasetWajah).filter(DatasetWajah.id_dataset == dataset_id).first()
    if not d:
        raise HTTPException(404, "Dataset wajah tidak ditemukan")
    return d


def update_dataset_wajah(db, dataset_id: int, payload: DatasetWajahUpdate):
    d = get_dataset_by_id(db, dataset_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


# ─── LOG DETEKSI (tambahan) ───────────────────────────────────────────────────


def get_log_by_id(db, log_id: int):
    log = db.query(LogDeteksi).filter(LogDeteksi.id_log == log_id).first()
    if not log:
        raise HTTPException(404, "Log deteksi tidak ditemukan")
    return log


def update_log_deteksi(db, log_id: int, payload: LogDeteksiUpdate):
    log = get_log_by_id(db, log_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(log, k, v)
    db.commit()
    db.refresh(log)
    return log


def delete_log_deteksi(db, log_id: int):
    log = db.query(LogDeteksi).filter(LogDeteksi.id_log == log_id).first()
    if not log:
        raise HTTPException(404, "Log deteksi tidak ditemukan")
    db.delete(log)
    db.commit()
