"""
Route: /history-presensi
Menyediakan endpoint untuk mengambil data riwayat presensi dari tabel history_presensi.
Data di-enrich dengan informasi pertemuan, jadwal, matakuliah, kelas, dan mahasiswa.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.config.database import get_db
from app.models.history_presensi import HistoryPresensi
from app.models.pertemuan import Pertemuan
from app.models.jadwal import Jadwal
from app.models.penawaran_matakuliah import PenawaranMatakuliah, PenawaranKelas
from app.models.matakuliah import MataKuliah
from app.models.mahasiswa import Mahasiswa
from app.models.prodi import Prodi
from app.models.angkatan import Angkatan
from app.models.golongan import Golongan
from app.utils.dependencies import get_current_user, require_dosen
from sqlalchemy.orm import Session
from sqlalchemy import func

router = APIRouter(prefix="/history-presensi", tags=["History Presensi"])


def _build_kelas_name(db: Session, penawaran_id: int) -> str:
    """Build nama kelas dari penawaran_kelas: Prodi-Angkatan-Golongan"""
    pk_list = (
        db.query(PenawaranKelas, Prodi, Angkatan, Golongan)
        .join(Prodi, PenawaranKelas.id_prodi == Prodi.id_prodi)
        .join(Angkatan, PenawaranKelas.id_angkatan == Angkatan.id_angkatan)
        .join(Golongan, PenawaranKelas.id_golongan == Golongan.id_golongan)
        .filter(PenawaranKelas.id_penawaran == penawaran_id)
        .all()
    )
    names = []
    for pk, prodi, angkatan, golongan in pk_list:
        names.append(f"{prodi.kode_prodi}-{angkatan.tahun_angkatan}-{golongan.nama_golongan}")
    return ", ".join(names) if names else "-"


@router.get("/summary", summary="Ringkasan riwayat per pertemuan")
def history_summary(
    id_jadwal: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Ringkasan riwayat presensi yang di-group per pertemuan.
    Mengembalikan statistik hadir/terlambat/izin/sakit/alpha per pertemuan.
    Digunakan oleh frontend untuk section Riwayat Presensi.
    """
    q = db.query(HistoryPresensi)

    if id_jadwal:
        pertemuan_ids = [
            p.id_pertemuan
            for p in db.query(Pertemuan.id_pertemuan)
            .filter(Pertemuan.id_jadwal == id_jadwal)
            .all()
        ]
        if not pertemuan_ids:
            return []
        q = q.filter(HistoryPresensi.id_pertemuan.in_(pertemuan_ids))

    records = q.all()

    if not records:
        return []

    # Group by pertemuan
    stats = {}
    for r in records:
        pid = r.id_pertemuan
        if pid not in stats:
            stats[pid] = {"total": 0, "hadir": 0, "terlambat": 0, "izin": 0, "sakit": 0, "alpha": 0}
        stats[pid]["total"] += 1
        status_val = r.status_presensi.value if r.status_presensi else "alpha"
        if status_val in stats[pid]:
            stats[pid][status_val] += 1

    # Enrich with pertemuan + jadwal info
    pertemuan_ids_all = list(stats.keys())
    pertemuan_map = {}
    jadwal_map = {}
    penawaran_map = {}
    mk_map = {}
    kelas_name_cache = {}

    if pertemuan_ids_all:
        pertemuan_list = (
            db.query(Pertemuan)
            .filter(Pertemuan.id_pertemuan.in_(pertemuan_ids_all))
            .all()
        )
        for p in pertemuan_list:
            pertemuan_map[p.id_pertemuan] = p

        jadwal_ids = list({p.id_jadwal for p in pertemuan_list})
        jadwal_list = db.query(Jadwal).filter(Jadwal.id_jadwal.in_(jadwal_ids)).all()
        for j in jadwal_list:
            jadwal_map[j.id_jadwal] = j

        penawaran_ids = list({j.id_penawaran for j in jadwal_list})
        if penawaran_ids:
            penawaran_list = (
                db.query(PenawaranMatakuliah)
                .filter(PenawaranMatakuliah.id_penawaran.in_(penawaran_ids))
                .all()
            )
            for pen in penawaran_list:
                penawaran_map[pen.id_penawaran] = pen

            mk_ids = list({pen.id_matakuliah for pen in penawaran_list})
            mk_list = db.query(MataKuliah).filter(MataKuliah.id_matakuliah.in_(mk_ids)).all()
            for mk in mk_list:
                mk_map[mk.id_matakuliah] = mk

            # Build kelas names
            for pid in penawaran_ids:
                kelas_name_cache[pid] = _build_kelas_name(db, pid)

    result = []
    for pid, s in stats.items():
        prt = pertemuan_map.get(pid)
        jdw = jadwal_map.get(prt.id_jadwal) if prt else None
        pen = penawaran_map.get(jdw.id_penawaran) if jdw else None
        mk = mk_map.get(pen.id_matakuliah) if pen else None
        kelas_name = kelas_name_cache.get(pen.id_penawaran, "-") if pen else "-"

        result.append({
            "id_pertemuan": pid,
            "id_jadwal": prt.id_jadwal if prt else None,
            "pertemuan_ke": prt.pertemuan_ke if prt else None,
            "tanggal": str(prt.tanggal) if prt else None,
            "nama_mk": mk.nama_matakuliah if mk else "-",
            "kode_mk": mk.kode_matakuliah if mk else "-",
            "nama_kelas": kelas_name,
            "hari": jdw.hari.value if jdw else "-",
            "jam_mulai": str(jdw.jam_mulai) if jdw else "-",
            "jam_selesai": str(jdw.jam_selesai) if jdw else "-",
            "ruangan": jdw.ruangan if jdw else "-",
            "total": s["total"],
            "hadir": s["hadir"] + s["terlambat"],
            "terlambat": s["terlambat"],
            "izin": s["izin"],
            "sakit": s["sakit"],
            "alpha": s["alpha"],
            "mode_lokasi": prt.mode_lokasi.value if prt and prt.mode_lokasi else "bebas",
        })

    # Sort by tanggal descending
    result.sort(key=lambda x: x.get("tanggal") or "", reverse=True)

    return result


@router.get("/", summary="Get semua riwayat presensi (detail per mahasiswa)")
def list_history_presensi(
    id_pertemuan: Optional[int] = None,
    id_mahasiswa: Optional[int] = None,
    id_jadwal: Optional[int] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Ambil data detail dari tabel history_presensi, enriched dengan info
    pertemuan, jadwal, matakuliah, dan mahasiswa.
    """
    q = db.query(HistoryPresensi)

    if id_pertemuan:
        q = q.filter(HistoryPresensi.id_pertemuan == id_pertemuan)
    if id_mahasiswa:
        q = q.filter(HistoryPresensi.id_mahasiswa == id_mahasiswa)
    if status_filter:
        q = q.filter(HistoryPresensi.status_presensi == status_filter)

    # Filter by jadwal (via pertemuan)
    if id_jadwal:
        pertemuan_ids = [
            p.id_pertemuan
            for p in db.query(Pertemuan.id_pertemuan)
            .filter(Pertemuan.id_jadwal == id_jadwal)
            .all()
        ]
        if not pertemuan_ids:
            return []
        q = q.filter(HistoryPresensi.id_pertemuan.in_(pertemuan_ids))

    records = q.order_by(HistoryPresensi.created_at.desc()).offset(skip).limit(limit).all()

    if not records:
        return []

    # Build enrichment maps
    pertemuan_ids_set = list({r.id_pertemuan for r in records})
    pertemuan_map = {}
    jadwal_map = {}

    pertemuan_list = (
        db.query(Pertemuan)
        .filter(Pertemuan.id_pertemuan.in_(pertemuan_ids_set))
        .all()
    )
    for p in pertemuan_list:
        pertemuan_map[p.id_pertemuan] = p

    jadwal_ids = list({p.id_jadwal for p in pertemuan_list})
    jadwal_list = db.query(Jadwal).filter(Jadwal.id_jadwal.in_(jadwal_ids)).all()
    for j in jadwal_list:
        jadwal_map[j.id_jadwal] = j

    penawaran_ids = list({j.id_penawaran for j in jadwal_list})
    penawaran_map = {}
    mk_map = {}
    kelas_name_cache = {}

    if penawaran_ids:
        penawaran_list = (
            db.query(PenawaranMatakuliah)
            .filter(PenawaranMatakuliah.id_penawaran.in_(penawaran_ids))
            .all()
        )
        for pen in penawaran_list:
            penawaran_map[pen.id_penawaran] = pen

        mk_ids = list({pen.id_matakuliah for pen in penawaran_list})
        mk_list = db.query(MataKuliah).filter(MataKuliah.id_matakuliah.in_(mk_ids)).all()
        for mk in mk_list:
            mk_map[mk.id_matakuliah] = mk

        for pid in penawaran_ids:
            kelas_name_cache[pid] = _build_kelas_name(db, pid)

    # Build mahasiswa map
    mhs_ids = list({r.id_mahasiswa for r in records})
    mhs_map = {}
    if mhs_ids:
        mhs_list = db.query(Mahasiswa).filter(Mahasiswa.id_mahasiswa.in_(mhs_ids)).all()
        for m in mhs_list:
            mhs_map[m.id_mahasiswa] = m

    # Build result
    result = []
    for r in records:
        prt = pertemuan_map.get(r.id_pertemuan)
        jdw = jadwal_map.get(prt.id_jadwal) if prt else None
        pen = penawaran_map.get(jdw.id_penawaran) if jdw else None
        mk = mk_map.get(pen.id_matakuliah) if pen else None
        mhs = mhs_map.get(r.id_mahasiswa)
        kelas_name = kelas_name_cache.get(pen.id_penawaran, "-") if pen else "-"

        result.append({
            "id_history": r.id_history,
            "id_mahasiswa": r.id_mahasiswa,
            "nim": mhs.nim if mhs else "-",
            "nama_mahasiswa": mhs.nama_mahasiswa if mhs else "-",
            "id_pertemuan": r.id_pertemuan,
            "pertemuan_ke": prt.pertemuan_ke if prt else None,
            "tanggal": str(prt.tanggal) if prt else None,
            "id_jadwal": prt.id_jadwal if prt else None,
            "nama_mk": mk.nama_matakuliah if mk else "-",
            "kode_mk": mk.kode_matakuliah if mk else "-",
            "nama_kelas": kelas_name,
            "hari": jdw.hari.value if jdw else "-",
            "jam_mulai": str(jdw.jam_mulai) if jdw else "-",
            "jam_selesai": str(jdw.jam_selesai) if jdw else "-",
            "ruangan": jdw.ruangan if jdw else "-",
            "waktu_presensi": r.waktu_presensi.isoformat() if r.waktu_presensi else None,
            "status_presensi": r.status_presensi.value if r.status_presensi else None,
            "confidence_score": r.confidence_score,
            "lbph_score": r.lbph_score,
            "cnn_score": r.cnn_score,
            "latitude_presensi": float(r.latitude_presensi) if r.latitude_presensi else None,
            "longitude_presensi": float(r.longitude_presensi) if r.longitude_presensi else None,
            "jarak_meter": r.jarak_meter,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return result


@router.delete("/pertemuan/{id_pertemuan}", status_code=204, summary="Hapus riwayat presensi per pertemuan")
def delete_history_pertemuan(
    id_pertemuan: int,
    db: Session = Depends(get_db),
    _=Depends(require_dosen),
):
    """Hapus riwayat presensi & pertemuan berdasarkan id_pertemuan."""
    from app.controllers.jadwal_controller import delete_pertemuan

    db.query(HistoryPresensi).filter(HistoryPresensi.id_pertemuan == id_pertemuan).delete(
        synchronize_session="fetch"
    )
    db.commit()

    try:
        delete_pertemuan(db, id_pertemuan)
    except Exception:
        pass


@router.delete("/{id_history}", status_code=204, summary="Hapus single record history presensi")
def delete_single_history(
    id_history: int,
    db: Session = Depends(get_db),
    _=Depends(require_dosen),
):
    h = db.query(HistoryPresensi).filter(HistoryPresensi.id_history == id_history).first()
    if not h:
        raise HTTPException(404, "History presensi tidak ditemukan")
    db.delete(h)
    db.commit()

