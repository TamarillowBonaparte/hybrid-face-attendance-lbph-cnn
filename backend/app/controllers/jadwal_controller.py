from datetime import datetime, timedelta, timezone

from app.models.jadwal import HariEnum, Jadwal, StatusJadwalEnum
from app.models.penawaran_matakuliah import PenawaranMatakuliah, Pengajar
from app.models.pertemuan import Pertemuan, StatusPertemuanEnum
from app.schemas.jadwal import (
    JadwalCreate,
    JadwalUpdate,
    PertemuanCreate,
    PertemuanUpdate,
)
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload


def _create_presensi_belum(db, id_pertemuan: int, id_penawaran: int):
    """Create belum-presensi records for every student enrolled in this penawaran."""
    from app.models.mahasiswa import Mahasiswa
    from app.models.penawaran_matakuliah import PenawaranKelas
    from app.models.presensi import Presensi
    from app.models.presensi import StatusPresensiEnum as SP

    seen: set[int] = set()
    for kelas in (
        db.query(PenawaranKelas)
        .filter(PenawaranKelas.id_penawaran == id_penawaran)
        .all()
    ):
        for mhs in (
            db.query(Mahasiswa)
            .filter(
                Mahasiswa.id_prodi == kelas.id_prodi,
                Mahasiswa.id_angkatan == kelas.id_angkatan,
                Mahasiswa.id_golongan == kelas.id_golongan,
            )
            .all()
        ):
            if mhs.id_mahasiswa in seen:
                continue
            seen.add(mhs.id_mahasiswa)
            exists = (
                db.query(Presensi)
                .filter(
                    Presensi.id_pertemuan == id_pertemuan,
                    Presensi.id_mahasiswa == mhs.id_mahasiswa,
                )
                .first()
            )
            if not exists:
                db.add(
                    Presensi(
                        id_pertemuan=id_pertemuan,
                        id_mahasiswa=mhs.id_mahasiswa,
                        status_presensi=SP.belum,
                    )
                )


def get_presensi_per_pertemuan(db, pertemuan_id: int):
    """Return pertemuan info + full student attendance list."""
    from app.models.mahasiswa import Mahasiswa
    from app.models.matakuliah import MataKuliah
    from app.models.penawaran_matakuliah import PenawaranMatakuliah
    from app.models.presensi import Presensi

    pertemuan = (
        db.query(Pertemuan).filter(Pertemuan.id_pertemuan == pertemuan_id).first()
    )
    if not pertemuan:
        raise HTTPException(404, "Pertemuan tidak ditemukan")

    jadwal = db.query(Jadwal).filter(Jadwal.id_jadwal == pertemuan.id_jadwal).first()
    penawaran = (
        db.query(PenawaranMatakuliah)
        .filter(PenawaranMatakuliah.id_penawaran == jadwal.id_penawaran)
        .first()
        if jadwal
        else None
    )
    mk = (
        db.query(MataKuliah)
        .filter(MataKuliah.id_matakuliah == penawaran.id_matakuliah)
        .first()
        if penawaran
        else None
    )

    records = (
        db.query(Presensi, Mahasiswa)
        .join(Mahasiswa, Presensi.id_mahasiswa == Mahasiswa.id_mahasiswa)
        .filter(Presensi.id_pertemuan == pertemuan_id)
        .order_by(Mahasiswa.nama_mahasiswa)
        .all()
    )

    mahasiswa_list = [
        {
            "id_presensi": p.id_presensi,
            "id_mahasiswa": m.id_mahasiswa,
            "nim": m.nim,
            "nama_mahasiswa": m.nama_mahasiswa,
            "status_presensi": p.status_presensi.value,
            "waktu_presensi": p.waktu_presensi,
        }
        for p, m in records
    ]

    total = len(mahasiswa_list)
    sudah_hadir = sum(
        1 for s in mahasiswa_list if s["status_presensi"] in ("hadir", "terlambat")
    )
    belum = sum(1 for s in mahasiswa_list if s["status_presensi"] == "belum")

    return {
        "id_pertemuan": pertemuan.id_pertemuan,
        "id_jadwal": pertemuan.id_jadwal,
        "pertemuan_ke": pertemuan.pertemuan_ke,
        "tanggal": str(pertemuan.tanggal),
        "status_pertemuan": pertemuan.status_pertemuan.value,
        "nama_matakuliah": mk.nama_matakuliah if mk else None,
        "kode_matakuliah": mk.kode_matakuliah if mk else None,
        "total_mahasiswa": total,
        "sudah_hadir": sudah_hadir,
        "belum_presensi": belum,
        "mahasiswa_list": mahasiswa_list,
    }


def _jadwal_to_dict(j: Jadwal) -> dict:
    p = j.penawaran
    return {
        "id_jadwal": j.id_jadwal,
        "id_penawaran": j.id_penawaran,
        "hari": j.hari.value if j.hari else None,
        "jam_mulai": str(j.jam_mulai) if j.jam_mulai else None,
        "jam_selesai": str(j.jam_selesai) if j.jam_selesai else None,
        "ruangan": j.ruangan,
        "status": j.status.value if j.status else "aktif",
        # Derived from penawaran
        "id_matakuliah": p.id_matakuliah if p else None,
        "kode_matakuliah": p.matakuliah.kode_matakuliah if p and p.matakuliah else None,
        "nama_matakuliah": p.matakuliah.nama_matakuliah if p and p.matakuliah else None,
        "semester": p.semester if p else None,
        "tahun_ajaran": p.tahun_ajaran if p else None,
        # Kelas & Pengajar from penawaran
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
                    if k.prodi and k.angkatan and k.golongan
                    else None
                ),
            }
            for k in (p.penawaran_kelas_list if p else [])
        ],
        "pengajar_list": [
            {
                "id_pengajar": g.id_pengajar,
                "id_dosen": g.id_dosen,
                "role": g.role.value if g.role else "anggota",
                "nama_dosen": g.dosen.nama_dosen if g.dosen else None,
                "nidn": g.dosen.nidn if g.dosen else None,
            }
            for g in (p.pengajar_list if p else [])
        ],
    }


def _load_jadwal(db: Session, jadwal_id: int) -> Jadwal:
    from app.models.angkatan import Angkatan
    from app.models.dosen import Dosen
    from app.models.golongan import Golongan
    from app.models.matakuliah import MataKuliah
    from app.models.penawaran_matakuliah import PenawaranKelas, Pengajar
    from app.models.prodi import Prodi

    j = (
        db.query(Jadwal)
        .options(
            joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.matakuliah),
            joinedload(Jadwal.penawaran)
            .joinedload(PenawaranMatakuliah.penawaran_kelas_list)
            .joinedload(PenawaranKelas.prodi),
            joinedload(Jadwal.penawaran)
            .joinedload(PenawaranMatakuliah.penawaran_kelas_list)
            .joinedload(PenawaranKelas.angkatan),
            joinedload(Jadwal.penawaran)
            .joinedload(PenawaranMatakuliah.penawaran_kelas_list)
            .joinedload(PenawaranKelas.golongan),
            joinedload(Jadwal.penawaran)
            .joinedload(PenawaranMatakuliah.pengajar_list)
            .joinedload(Pengajar.dosen),
        )
        .filter(Jadwal.id_jadwal == jadwal_id)
        .first()
    )
    if not j:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    return j


def get_all_jadwal(
    db, id_penawaran=None, hari=None, status_filter=None, skip=0, limit=100
):
    from app.models.penawaran_matakuliah import PenawaranKelas, Pengajar

    q = db.query(Jadwal).options(
        joinedload(Jadwal.penawaran).joinedload(PenawaranMatakuliah.matakuliah),
        joinedload(Jadwal.penawaran)
        .joinedload(PenawaranMatakuliah.penawaran_kelas_list)
        .joinedload(PenawaranKelas.prodi),
        joinedload(Jadwal.penawaran)
        .joinedload(PenawaranMatakuliah.penawaran_kelas_list)
        .joinedload(PenawaranKelas.angkatan),
        joinedload(Jadwal.penawaran)
        .joinedload(PenawaranMatakuliah.penawaran_kelas_list)
        .joinedload(PenawaranKelas.golongan),
        joinedload(Jadwal.penawaran)
        .joinedload(PenawaranMatakuliah.pengajar_list)
        .joinedload(Pengajar.dosen),
    )
    if id_penawaran:
        q = q.filter(Jadwal.id_penawaran == id_penawaran)
    if hari:
        q = q.filter(Jadwal.hari == hari)
    if status_filter:
        q = q.filter(Jadwal.status == status_filter)
    return [_jadwal_to_dict(j) for j in q.offset(skip).limit(limit).all()]


def get_jadwal_by_id(db, jadwal_id: int):
    return _jadwal_to_dict(_load_jadwal(db, jadwal_id))


def create_jadwal(db, payload: JadwalCreate):
    if (
        not db.query(PenawaranMatakuliah)
        .filter(PenawaranMatakuliah.id_penawaran == payload.id_penawaran)
        .first()
    ):
        raise HTTPException(404, "Penawaran mata kuliah tidak ditemukan")
    j = Jadwal(**payload.model_dump())
    db.add(j)
    db.commit()
    db.refresh(j)
    return _jadwal_to_dict(_load_jadwal(db, j.id_jadwal))


def update_jadwal(db, jadwal_id: int, payload: JadwalUpdate):
    j = db.query(Jadwal).filter(Jadwal.id_jadwal == jadwal_id).first()
    if not j:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(j, k, v)
    db.commit()
    return _jadwal_to_dict(_load_jadwal(db, jadwal_id))


def delete_jadwal(db, jadwal_id: int):
    from app.models.presensi import Presensi
    from app.models.history_presensi import HistoryPresensi

    j = db.query(Jadwal).filter(Jadwal.id_jadwal == jadwal_id).first()
    if not j:
        raise HTTPException(404, "Jadwal tidak ditemukan")

    try:
        # Ambil semua pertemuan yang terkait dengan jadwal ini
        pertemuan_list = (
            db.query(Pertemuan).filter(Pertemuan.id_jadwal == jadwal_id).all()
        )
        pertemuan_ids = [p.id_pertemuan for p in pertemuan_list]

        if pertemuan_ids:
            # 1. Hapus history_presensi terlebih dahulu (FK ke pertemuan)
            db.query(HistoryPresensi).filter(
                HistoryPresensi.id_pertemuan.in_(pertemuan_ids)
            ).delete(synchronize_session="fetch")

            # 2. Hapus presensi (FK ke pertemuan)
            db.query(Presensi).filter(
                Presensi.id_pertemuan.in_(pertemuan_ids)
            ).delete(synchronize_session="fetch")

            # 3. Hapus semua pertemuan
            db.query(Pertemuan).filter(
                Pertemuan.id_jadwal == jadwal_id
            ).delete(synchronize_session="fetch")

        # 4. Hapus jadwal
        db.delete(j)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Gagal menghapus jadwal: {str(e)}")



def create_jadwal_from_matakuliah(db: Session, payload):
    """
    Buat jadwal langsung dari mata kuliah.
    Otomatis cari/buat penawaran berdasarkan id_matakuliah + semester + tahun_ajaran,
    lalu buat jadwal baru. Jika id_kelas disertakan, langsung tambahkan kelas ke penawaran.
    """
    from app.models.angkatan import Angkatan
    from app.models.golongan import Golongan
    from app.models.kelas import Kelas
    from app.models.matakuliah import MataKuliah
    from app.models.penawaran_matakuliah import PenawaranKelas, PenawaranMatakuliah

    # Validasi mata kuliah
    mk = (
        db.query(MataKuliah)
        .filter(MataKuliah.id_matakuliah == payload.id_matakuliah)
        .first()
    )
    if not mk:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")

    # Cari atau buat penawaran
    penawaran = (
        db.query(PenawaranMatakuliah)
        .filter(
            PenawaranMatakuliah.id_matakuliah == payload.id_matakuliah,
            PenawaranMatakuliah.semester == payload.semester,
            PenawaranMatakuliah.tahun_ajaran == payload.tahun_ajaran,
        )
        .first()
    )
    if not penawaran:
        penawaran = PenawaranMatakuliah(
            id_matakuliah=payload.id_matakuliah,
            semester=payload.semester,
            tahun_ajaran=payload.tahun_ajaran,
            status="aktif",
        )
        db.add(penawaran)
        db.flush()

    # Jika id_kelas diberikan, tambahkan kelas ke penawaran
    if getattr(payload, "id_kelas", None):
        kelas = db.query(Kelas).filter(Kelas.id == payload.id_kelas).first()
        if not kelas:
            raise HTTPException(
                404, f"Kelas dengan id {payload.id_kelas} tidak ditemukan"
            )

        # Cari id_angkatan dari tahun angkatan kelas
        ang_obj = None
        if kelas.angkatan:
            ang_obj = (
                db.query(Angkatan)
                .filter(Angkatan.tahun_angkatan == kelas.angkatan)
                .first()
            )

        # Cari id_golongan dari nama golongan kelas
        gol_obj = None
        if kelas.golongan:
            gol_obj = (
                db.query(Golongan)
                .filter(Golongan.nama_golongan == kelas.golongan)
                .first()
            )

        if ang_obj and gol_obj:
            # Cek apakah kelas sudah ada di penawaran ini
            existing_kelas = (
                db.query(PenawaranKelas)
                .filter(
                    PenawaranKelas.id_penawaran == penawaran.id_penawaran,
                    PenawaranKelas.id_prodi == kelas.id_prodi,
                    PenawaranKelas.id_angkatan == ang_obj.id_angkatan,
                    PenawaranKelas.id_golongan == gol_obj.id_golongan,
                )
                .first()
            )
            if not existing_kelas:
                pk = PenawaranKelas(
                    id_penawaran=penawaran.id_penawaran,
                    id_prodi=kelas.id_prodi,
                    id_angkatan=ang_obj.id_angkatan,
                    id_golongan=gol_obj.id_golongan,
                )
                db.add(pk)
                db.flush()

    # Buat jadwal
    j = Jadwal(
        id_penawaran=penawaran.id_penawaran,
        hari=payload.hari,
        jam_mulai=payload.jam_mulai,
        jam_selesai=payload.jam_selesai,
        ruangan=payload.ruangan,
        status=StatusJadwalEnum.aktif,
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return _jadwal_to_dict(_load_jadwal(db, j.id_jadwal))


# ─── PERTEMUAN ────────────────────────────────────────────────────────────────


def get_all_pertemuan(
    db, id_jadwal=None, status_filter=None, skip=0, limit=100, jadwal_ids=None
):
    import logging
    log = logging.getLogger(__name__)

    from app.models.matakuliah import MataKuliah
    from app.models.presensi import Presensi

    q = db.query(Pertemuan)
    if jadwal_ids is not None:
        q = q.filter(Pertemuan.id_jadwal.in_(jadwal_ids))
        log.info(f"[get_all_pertemuan] Filtering by jadwal_ids={jadwal_ids}")
    elif id_jadwal:
        q = q.filter(Pertemuan.id_jadwal == id_jadwal)
    if status_filter:
        q = q.filter(Pertemuan.status_pertemuan == status_filter)
    pertemuan_list = q.order_by(Pertemuan.pertemuan_ke).offset(skip).limit(limit).all()

    log.info(f"[get_all_pertemuan] Found {len(pertemuan_list)} pertemuan")

    result = []
    for p in pertemuan_list:
        # ponytail: N+1 OK — active sessions are typically 1-5; upgrade path: joinedload
        jadwal = db.query(Jadwal).filter(Jadwal.id_jadwal == p.id_jadwal).first()
        penawaran = (
            db.query(PenawaranMatakuliah)
            .filter(PenawaranMatakuliah.id_penawaran == jadwal.id_penawaran)
            .first()
            if jadwal
            else None
        )
        mk = (
            db.query(MataKuliah)
            .filter(MataKuliah.id_matakuliah == penawaran.id_matakuliah)
            .first()
            if penawaran
            else None
        )
        presensi_list = (
            db.query(Presensi).filter(Presensi.id_pertemuan == p.id_pertemuan).all()
        )
        total = len(presensi_list)
        sudah_hadir = sum(
            1
            for pr in presensi_list
            if pr.status_presensi.value in ("hadir", "terlambat")
        )
        belum = sum(1 for pr in presensi_list if pr.status_presensi.value == "belum")
        total_alpa = sum(
            1
            for pr in presensi_list
            if pr.status_presensi.value in ("alpha", "izin", "sakit")
        )

        # Build nama_kelas from PenawaranKelas
        nama_kelas = None
        if penawaran:
            from app.models.penawaran_matakuliah import PenawaranKelas

            pk_list = (
                db.query(PenawaranKelas)
                .filter(PenawaranKelas.id_penawaran == penawaran.id_penawaran)
                .all()
            )
            if pk_list:
                pk = pk_list[0]
                parts = []
                if pk.prodi:
                    parts.append(pk.prodi.kode_prodi)
                if pk.angkatan:
                    parts.append(str(pk.angkatan.tahun_angkatan))
                if pk.golongan:
                    parts.append(pk.golongan.nama_golongan)
                nama_kelas = "-".join(parts) if parts else None

        result.append(
            {
                "id_pertemuan": p.id_pertemuan,
                "id_jadwal": p.id_jadwal,
                "pertemuan_ke": p.pertemuan_ke,
                "tanggal": p.tanggal,
                "batas_presensi": p.batas_presensi,
                "status_pertemuan": p.status_pertemuan.value,
                "id_geolokasi": p.id_geolokasi,
                "mode_lokasi": p.mode_lokasi.value if p.mode_lokasi else "bebas",
                "nama_matakuliah": mk.nama_matakuliah if mk else None,
                "kode_matakuliah": mk.kode_matakuliah if mk else None,
                "nama_kelas": nama_kelas,
                "total_mahasiswa": total,
                "sudah_hadir": sudah_hadir,
                "belum_presensi": belum,
                "total_hadir": sudah_hadir,
                "total_alpa": total_alpa,
            }
        )
    return result


def get_pertemuan_by_id(db, pertemuan_id: int):
    p = db.query(Pertemuan).filter(Pertemuan.id_pertemuan == pertemuan_id).first()
    if not p:
        raise HTTPException(404, "Pertemuan tidak ditemukan")
    return p


def create_pertemuan(db, payload: PertemuanCreate):
    jadwal = db.query(Jadwal).filter(Jadwal.id_jadwal == payload.id_jadwal).first()
    if not jadwal:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    if (
        db.query(Pertemuan)
        .filter(
            Pertemuan.id_jadwal == payload.id_jadwal,
            Pertemuan.pertemuan_ke == payload.pertemuan_ke,
        )
        .first()
    ):
        raise HTTPException(400, f"Pertemuan ke-{payload.pertemuan_ke} sudah ada")
    p = Pertemuan(**payload.model_dump())
    db.add(p)
    db.flush()
    _create_presensi_belum(db, p.id_pertemuan, jadwal.id_penawaran)
    db.commit()
    db.refresh(p)
    return p


def update_pertemuan(db, pertemuan_id: int, payload: PertemuanUpdate):
    p = get_pertemuan_by_id(db, pertemuan_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


def mulai_pertemuan(db, pertemuan_id: int, durasi_menit: int = 15):
    p = get_pertemuan_by_id(db, pertemuan_id)
    if p.status_pertemuan == StatusPertemuanEnum.sedang:
        raise HTTPException(400, "Pertemuan sudah sedang berlangsung")
    p.status_pertemuan = StatusPertemuanEnum.sedang
    import zoneinfo
    wib = zoneinfo.ZoneInfo("Asia/Jakarta")
    p.batas_presensi = datetime.now(wib).replace(tzinfo=None) + timedelta(minutes=durasi_menit)
    db.commit()
    db.refresh(p)
    return p


def selesai_pertemuan(db, pertemuan_id: int):
    from app.models.presensi import Presensi
    from app.models.presensi import StatusPresensiEnum as SP
    from app.models.history_presensi import HistoryPresensi

    p = get_pertemuan_by_id(db, pertemuan_id)

    # Langkah 1: Ubah status 'belum' → 'alpha' TERLEBIH DAHULU
    # agar saat di-copy ke history_presensi tidak ada nilai 'belum'
    # yang tidak valid di tabel history_presensi.
    db.query(Presensi).filter(
        Presensi.id_pertemuan == pertemuan_id,
        Presensi.status_presensi == SP.belum,
    ).update({"status_presensi": SP.alpha})
    db.flush()  # Terapkan update ke session sebelum query ulang

    # Langkah 2: Ambil semua presensi (sekarang sudah tidak ada status 'belum')
    presensi_list = db.query(Presensi).filter(
        Presensi.id_pertemuan == pertemuan_id
    ).all()

    # Langkah 3: Copy semua presensi ke history_presensi
    for pres in presensi_list:
        history = HistoryPresensi(
            id_mahasiswa=pres.id_mahasiswa,
            id_pertemuan=pres.id_pertemuan,
            waktu_presensi=pres.waktu_presensi,
            status_presensi=pres.status_presensi,
            foto_verifikasi=pres.foto_verifikasi,
            confidence_score=pres.confidence_score,
            lbph_score=pres.lbph_score,
            cnn_score=pres.cnn_score,
            metode_deteksi=pres.metode_deteksi,
            latitude_presensi=pres.latitude_presensi,
            longitude_presensi=pres.longitude_presensi,
            jarak_meter=pres.jarak_meter,
        )
        db.add(history)

    # Langkah 4: Update status pertemuan menjadi selesai
    p.status_pertemuan = StatusPertemuanEnum.selesai

    db.commit()
    db.refresh(p)
    return p



def archive_pertemuan_by_date(db, tanggal_batas: datetime = None):
    """
    Archive semua presensi yang tanggalnya sudah lewat ATAU batas_presensi sudah lewat.
    Fungsi ini digunakan untuk auto-archive presensi yang tidak ditandai selesai secara manual.
    """
    import logging
    log = logging.getLogger(__name__)

    from sqlalchemy import or_, and_
    from app.models.presensi import Presensi, StatusPresensiEnum as SP
    from app.models.history_presensi import HistoryPresensi, StatusHistoryPresensiEnum as HP

    if tanggal_batas is None:
        import zoneinfo
        wib = zoneinfo.ZoneInfo("Asia/Jakarta")
        tanggal_batas = datetime.now(wib).replace(tzinfo=None)

    log.info(f"[ARCHIVE] Starting archive with tanggal_batas={tanggal_batas}")
    log.info(f"[ARCHIVE] Archive condition: tanggal < {tanggal_batas.date()} OR batas_presensi < {tanggal_batas}")

    # Ambil semua pertemuan yang belum selesai dan:
    # 1. tanggalnya sudah lewat, ATAU
    # 2. batas_presensi (tenggat waktu) sudah lewat
    old_pertemuan_list = db.query(Pertemuan).filter(
        Pertemuan.status_pertemuan.in_([StatusPertemuanEnum.belum, StatusPertemuanEnum.sedang]),
        or_(
            Pertemuan.tanggal < tanggal_batas.date(),
            and_(
                Pertemuan.batas_presensi != None,
                Pertemuan.batas_presensi < tanggal_batas,
            ),
        ),
    ).all()

    log.info(f"[ARCHIVE] Found {len(old_pertemuan_list)} old pertemuan to archive")
    for p in old_pertemuan_list:
        log.info(f"[ARCHIVE] OLD MEETING CANDIDATE: id={p.id_pertemuan}, tanggal={p.tanggal}, status={p.status_pertemuan}")

    archived_count = 0
    archived_pertemuan_ids = []
    for p in old_pertemuan_list:
        log.info(f"[ARCHIVE] Processing pertemuan id={p.id_pertemuan}, tanggal={p.tanggal}, status={p.status_pertemuan}")

        # Cek apakah sudah ada di history_presensi
        existing_in_history = db.query(HistoryPresensi).filter(
            HistoryPresensi.id_pertemuan == p.id_pertemuan
        ).first()

        if existing_in_history:
            log.info(f"[ARCHIVE] Pertemuan {p.id_pertemuan} already in history, skipping")
            continue

        # Ambil semua presensi untuk pertemuan ini
        presensi_list = db.query(Presensi).filter(
            Presensi.id_pertemuan == p.id_pertemuan
        ).all()

        log.info(f"[ARCHIVE] Found {len(presensi_list)} presensi records for pertemuan {p.id_pertemuan}")

        # Copy semua presensi ke history_presensi
        for pres in presensi_list:
            try:
                # Konversi status_presensi: "belum" -> "alpha", enum lain tetap
                status_val = pres.status_presensi
                if status_val == SP.belum:
                    history_status = HP.alpha
                elif status_val == SP.hadir:
                    history_status = HP.hadir
                elif status_val == SP.terlambat:
                    history_status = HP.terlambat
                elif status_val == SP.izin:
                    history_status = HP.izin
                elif status_val == SP.sakit:
                    history_status = HP.sakit
                elif status_val == SP.alpha:
                    history_status = HP.alpha
                else:
                    history_status = HP.alpha  # default fallback

                history = HistoryPresensi(
                    id_mahasiswa=pres.id_mahasiswa,
                    id_pertemuan=pres.id_pertemuan,
                    waktu_presensi=pres.waktu_presensi,
                    status_presensi=history_status,
                    foto_verifikasi=pres.foto_verifikasi,
                    confidence_score=pres.confidence_score,
                    lbph_score=pres.lbph_score,
                    cnn_score=pres.cnn_score,
                    metode_deteksi=pres.metode_deteksi,
                    latitude_presensi=pres.latitude_presensi,
                    longitude_presensi=pres.longitude_presensi,
                    jarak_meter=pres.jarak_meter,
                )
                db.add(history)
                log.info(f"[ARCHIVE] Added history for mhs={pres.id_mahasiswa}, status={history_status}")
            except Exception as e:
                log.error(f"[ARCHIVE] Error adding history: {e}")
                import traceback
                traceback.print_exc()

        # Update status pertemuan menjadi selesai
        p.status_pertemuan = StatusPertemuanEnum.selesai

        # Students who never scanned become alpha (absent)
        db.query(Presensi).filter(
            Presensi.id_pertemuan == p.id_pertemuan,
            Presensi.status_presensi == SP.belum,
        ).update({"status_presensi": SP.alpha})

        archived_count += 1
        archived_pertemuan_ids.append(p.id_pertemuan)

    log.info(f"[ARCHIVE] Committing {archived_count} archived records")
    db.commit()
    log.info(f"[ARCHIVE] Done! archived_count={archived_count}")
    return {"archived_count": archived_count, "pertemuan_ids": archived_pertemuan_ids}


def batalkan_pertemuan(db, pertemuan_id: int):
    p = get_pertemuan_by_id(db, pertemuan_id)
    p.status_pertemuan = StatusPertemuanEnum.dibatalkan
    db.commit()
    db.refresh(p)
    return p


def delete_pertemuan(db, pertemuan_id: int):
    from app.models.presensi import Presensi
    from app.models.history_presensi import HistoryPresensi

    p = get_pertemuan_by_id(db, pertemuan_id)
    # Hapus semua history presensi terkait terlebih dahulu
    db.query(HistoryPresensi).filter(HistoryPresensi.id_pertemuan == pertemuan_id).delete(
        synchronize_session="fetch"
    )
    # Hapus semua presensi terkait
    db.query(Presensi).filter(Presensi.id_pertemuan == pertemuan_id).delete(
        synchronize_session="fetch"
    )
    db.delete(p)
    db.commit()


def create_pertemuan_bebas(db: Session, payload, current_user=None):
    """
    Buat sesi presensi bebas: pilih matakuliah + kelas secara langsung.
    Otomatis cari/buat penawaran → jadwal → pertemuan,
    lalu buat record presensi alpha untuk semua mahasiswa di kelas tersebut.
    Jika current_user adalah dosen, otomatis tambahkan sebagai Pengajar agar
    sesi baru muncul di /kelas-mata-kuliah/me.
    """
    from datetime import time as dt_time

    from app.models.angkatan import Angkatan
    from app.models.golongan import Golongan
    from app.models.kelas import Kelas
    from app.models.mahasiswa import Mahasiswa
    from app.models.matakuliah import MataKuliah
    from app.models.penawaran_matakuliah import PenawaranKelas, PenawaranMatakuliah
    from app.models.presensi import Presensi, StatusPresensiEnum

    # --- Validasi input ---
    kelas = db.query(Kelas).filter(Kelas.id == payload.id_kelas).first()
    if not kelas:
        raise HTTPException(404, "Kelas tidak ditemukan")

    mk = (
        db.query(MataKuliah)
        .filter(MataKuliah.id_matakuliah == payload.id_matakuliah)
        .first()
    )
    if not mk:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")

    # --- Cari mahasiswa berdasarkan kelas ---
    # Cari id_angkatan dan id_golongan terlebih dahulu
    ang_obj = None
    gol_obj = None
    if kelas.angkatan:
        ang_obj = (
            db.query(Angkatan).filter(Angkatan.tahun_angkatan == kelas.angkatan).first()
        )
    if kelas.golongan:
        gol_obj = (
            db.query(Golongan).filter(Golongan.nama_golongan == kelas.golongan).first()
        )

    q = db.query(Mahasiswa).filter(Mahasiswa.id_prodi == kelas.id_prodi)
    if ang_obj:
        q = q.filter(Mahasiswa.id_angkatan == ang_obj.id_angkatan)
    if gol_obj:
        q = q.filter(Mahasiswa.id_golongan == gol_obj.id_golongan)
    mahasiswa_list = q.all()

    # --- Cari atau buat PenawaranMatakuliah ---
    penawaran = (
        db.query(PenawaranMatakuliah)
        .filter(
            PenawaranMatakuliah.id_matakuliah == payload.id_matakuliah,
            PenawaranMatakuliah.semester == payload.semester,
            PenawaranMatakuliah.tahun_ajaran == payload.tahun_ajaran,
        )
        .first()
    )
    if not penawaran:
        penawaran = PenawaranMatakuliah(
            id_matakuliah=payload.id_matakuliah,
            semester=payload.semester,
            tahun_ajaran=payload.tahun_ajaran,
            status="aktif",
        )
        db.add(penawaran)
        db.flush()

    # --- Cari atau buat PenawaranKelas ---
    # Gunakan ang_obj / gol_obj yang sudah dicari di atas
    ang_id = ang_obj.id_angkatan if ang_obj else None
    gol_id = gol_obj.id_golongan if gol_obj else None

    if ang_id and gol_id:
        pkel = (
            db.query(PenawaranKelas)
            .filter(
                PenawaranKelas.id_penawaran == penawaran.id_penawaran,
                PenawaranKelas.id_prodi == kelas.id_prodi,
                PenawaranKelas.id_angkatan == ang_id,
                PenawaranKelas.id_golongan == gol_id,
            )
            .first()
        )
        if not pkel:
            pkel = PenawaranKelas(
                id_penawaran=penawaran.id_penawaran,
                id_prodi=kelas.id_prodi,
                id_angkatan=ang_id,
                id_golongan=gol_id,
            )
            db.add(pkel)
            db.flush()

    # --- Cari atau buat Jadwal ---
    jam_mulai = payload.jam_mulai or dt_time(8, 0)
    jam_selesai = payload.jam_selesai or dt_time(10, 0)

    jadwal = (
        db.query(Jadwal)
        .filter(
            Jadwal.id_penawaran == penawaran.id_penawaran,
        )
        .first()
    )
    if not jadwal:
        jadwal = Jadwal(
            id_penawaran=penawaran.id_penawaran,
            hari=HariEnum.senin,
            jam_mulai=jam_mulai,
            jam_selesai=jam_selesai,
            status=StatusJadwalEnum.aktif,
        )
        db.add(jadwal)
        db.flush()
        
        # --- Auto-tambah dosen sebagai Pengajar agar session muncul di /kelas-mata-kuliah/me ---
        if current_user is not None:
            from app.models.dosen import Dosen
            from app.models.user import UserRoleEnum
            if current_user.role == UserRoleEnum.dosen:
                dosen = db.query(Dosen).filter(Dosen.email == current_user.email).first()
                if dosen:
                    # Cek apakah pengajar sudah ada untuk penawaran ini
                    existing_pengajar = (
                        db.query(Pengajar)
                        .filter(
                            Pengajar.id_penawaran == penawaran.id_penawaran,
                            Pengajar.id_dosen == dosen.id_dosen,
                        )
                        .first()
                    )
                    if not existing_pengajar:
                        from app.models.penawaran_matakuliah import RolePengajarEnum
                        new_pengajar = Pengajar(
                            id_penawaran=penawaran.id_penawaran,
                            id_dosen=dosen.id_dosen,
                            role=RolePengajarEnum.koordinator,
                        )
                        db.add(new_pengajar)
                        db.flush()
    else:
        # Update jam jika diberikan
        if payload.jam_mulai:
            jadwal.jam_mulai = payload.jam_mulai
        if payload.jam_selesai:
            jadwal.jam_selesai = payload.jam_selesai
        
        # --- Juga pastikan dosen terdaftar sebagai Pengajar untuk penawaran yang sudah ada ---
        if current_user is not None:
            from app.models.dosen import Dosen
            from app.models.user import UserRoleEnum
            if current_user.role == UserRoleEnum.dosen:
                dosen = db.query(Dosen).filter(Dosen.email == current_user.email).first()
                if dosen:
                    existing_pengajar = (
                        db.query(Pengajar)
                        .filter(
                            Pengajar.id_penawaran == penawaran.id_penawaran,
                            Pengajar.id_dosen == dosen.id_dosen,
                        )
                        .first()
                    )
                    if not existing_pengajar:
                        from app.models.penawaran_matakuliah import RolePengajarEnum
                        new_pengajar = Pengajar(
                            id_penawaran=penawaran.id_penawaran,
                            id_dosen=dosen.id_dosen,
                            role=RolePengajarEnum.koordinator,
                        )
                        db.add(new_pengajar)
                        db.flush()

    # --- Cek duplikasi pertemuan ---
    # Hanya tolak duplikat jika pertemuan yang ada masih aktif (belum/sedang).
    # Pertemuan yang sudah selesai/dibatalkan diabaikan agar dosen bisa membuat
    # ulang pertemuan ke-N yang sebelumnya sudah selesai.
    import logging
    log = logging.getLogger(__name__)

    existing_pertemuan = (
        db.query(Pertemuan)
        .filter(
            Pertemuan.id_jadwal == jadwal.id_jadwal,
            Pertemuan.pertemuan_ke == payload.pertemuan_ke,
        )
        .first()
    )
    if existing_pertemuan:
        log.warning(
            f"[DEBUG] Duplicate check found existing pertemuan: "
            f"id_pertemuan={existing_pertemuan.id_pertemuan}, "
            f"id_jadwal={existing_pertemuan.id_jadwal}, "
            f"pertemuan_ke={existing_pertemuan.pertemuan_ke}, "
            f"status={existing_pertemuan.status_pertemuan}, "
            f"tanggal={existing_pertemuan.tanggal}"
        )
        raise HTTPException(
            400,
            f"Pertemuan ke-{payload.pertemuan_ke} untuk kelas dan mata kuliah ini sudah pernah dibuat "
            f"(Status: {existing_pertemuan.status_pertemuan.value}). "
            f"Anda tidak dapat membuat pertemuan dengan urutan yang sama berulang kali.",
        )

    # --- Hitung batas presensi berdasarkan jam selesai (asumsi WIB / UTC+7) ---
    try:
        from datetime import datetime, timezone, timedelta
        # Jadikan kombinasi tanggal + jam_selesai sebagai local time WIB
        batas_local = datetime.combine(payload.tanggal, jam_selesai)
        batas_utc = batas_local
    except Exception:
        import zoneinfo
        wib = zoneinfo.ZoneInfo("Asia/Jakarta")
        batas_utc = datetime.now(wib).replace(tzinfo=None) + timedelta(hours=12)

    # --- Buat Pertemuan (langsung aktif/sedang agar mahasiswa bisa langsung absen) ---
    pertemuan = Pertemuan(
        id_jadwal=jadwal.id_jadwal,
        pertemuan_ke=payload.pertemuan_ke,
        tanggal=payload.tanggal,
        status_pertemuan=StatusPertemuanEnum.sedang,
        batas_presensi=batas_utc,
        id_geolokasi=getattr(payload, "id_geolokasi", None),
        mode_lokasi=getattr(payload, "mode_lokasi", "bebas"),
    )
    db.add(pertemuan)
    db.flush()

    # --- Buat Presensi belum untuk semua mahasiswa ---
    for mhs in mahasiswa_list:
        db.add(
            Presensi(
                id_pertemuan=pertemuan.id_pertemuan,
                id_mahasiswa=mhs.id_mahasiswa,
                status_presensi=StatusPresensiEnum.belum,
            )
        )

    db.commit()
    db.refresh(pertemuan)

    return {
        "id_pertemuan": pertemuan.id_pertemuan,
        "id_jadwal": pertemuan.id_jadwal,
        "pertemuan_ke": pertemuan.pertemuan_ke,
        "tanggal": str(pertemuan.tanggal),
        "status_pertemuan": pertemuan.status_pertemuan.value,
        "nama_mk": mk.nama_matakuliah,
        "kode_mk": mk.kode_matakuliah,
        "nama_kelas": kelas.nama_kelas,
        "total_mahasiswa": len(mahasiswa_list),
    }
