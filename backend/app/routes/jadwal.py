from typing import List

from app.config.database import get_db
from app.controllers.jadwal_controller import (
    archive_pertemuan_by_date,
    batalkan_pertemuan,
    create_jadwal,
    create_jadwal_from_matakuliah,
    create_pertemuan,
    create_pertemuan_bebas,
    delete_jadwal,
    delete_pertemuan,
    get_all_jadwal,
    get_all_pertemuan,
    get_jadwal_by_id,
    get_pertemuan_by_id,
    get_presensi_per_pertemuan,
    mulai_pertemuan,
    selesai_pertemuan,
    update_jadwal,
    update_pertemuan,
)
from app.schemas.jadwal import (
    JadwalCreate,
    JadwalFromMatakuliahCreate,
    JadwalUpdate,
    PertemuanBebasCreate,
    PertemuanBebasResponse,
    PertemuanCreate,
    PertemuanResponse,
    PertemuanStatusToggle,
    PertemuanUpdate,
)
from app.utils.dependencies import get_current_user, require_admin, require_dosen
from fastapi import APIRouter, Depends

# ─── JADWAL ───────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/jadwal", tags=["Jadwal"])


@router.get("/")
def list_jadwal(
    id_penawaran: int | None = None,
    hari: str | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db=Depends(get_db),
    _=Depends(get_current_user),
):
    return get_all_jadwal(db, id_penawaran, hari, status_filter, skip, limit)


@router.post("/", status_code=201)
def add_jadwal(payload: JadwalCreate, db=Depends(get_db), _=Depends(require_admin)):
    return create_jadwal(db, payload)


@router.post("/from-matakuliah", status_code=201)
def add_jadwal_from_matakuliah(
    payload: JadwalFromMatakuliahCreate, db=Depends(get_db), _=Depends(require_admin)
):
    """Buat jadwal baru dari mata kuliah — otomatis create penawaran jika belum ada."""
    return create_jadwal_from_matakuliah(db, payload)


@router.get("/{jadwal_id}")
def detail_jadwal(jadwal_id: int, db=Depends(get_db), _=Depends(get_current_user)):
    return get_jadwal_by_id(db, jadwal_id)


@router.put("/{jadwal_id}")
def edit_jadwal(
    jadwal_id: int, payload: JadwalUpdate, db=Depends(get_db), _=Depends(require_admin)
):
    return update_jadwal(db, jadwal_id, payload)


@router.delete("/{jadwal_id}", status_code=204)
def hapus_jadwal(jadwal_id: int, db=Depends(get_db), _=Depends(require_admin)):
    delete_jadwal(db, jadwal_id)


# ─── PERTEMUAN ────────────────────────────────────────────────────────────────
pertemuan_router = APIRouter(prefix="/pertemuan", tags=["Pertemuan"])


@pertemuan_router.get("/", response_model=List[PertemuanResponse])
def list_pertemuan(
    id_jadwal: int | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db=Depends(get_db),
    _=Depends(get_current_user),
):
    return get_all_pertemuan(db, id_jadwal, status_filter, skip, limit)


@pertemuan_router.post("/", response_model=PertemuanResponse, status_code=201)
def add_pertemuan(
    payload: PertemuanCreate, db=Depends(get_db), _=Depends(require_dosen)
):
    return create_pertemuan(db, payload)


@pertemuan_router.post("/bebas", status_code=201)
def add_pertemuan_bebas(
    payload: PertemuanBebasCreate,
    db=Depends(get_db),
    current_user=Depends(require_dosen),
):
    return create_pertemuan_bebas(db, payload, current_user=current_user)


# ── PENTING: /me harus didaftarkan SEBELUM /{pertemuan_id} apapun ────────────
@pertemuan_router.get(
    "/me", summary="Pertemuan aktif/tidak aktif untuk mahasiswa yang sedang login"
)
def pertemuan_saya(
    is_aktif: bool = True,
    skip: int = 0,
    limit: int = 100,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Kembalikan pertemuan yang relevan dengan kelas mahasiswa yang login.

    Query params:
    - is_aktif=True (default): pertemuan dengan status_pertemuan BELUM atau SEDANG (untuk mobile)
    - is_aktif=False: pertemuan dengan status_pertemuan SELESAI atau DIBATALKAN (riwayat/web)

    Strategi (multi-fallback):
    1. Cocokkan via PenawaranKelas (id_prodi + id_angkatan + id_golongan)
    2. Fallback: cocokkan via id_kelas -> angkatan & golongan dari tabel Kelas
    3. Admin/dosen: tampilkan semua pertemuan
    """
    import logging
    log = logging.getLogger(__name__)

    log.info(f"[/pertemuan/me] Called by user: role={current_user.role}, email={current_user.email}, is_aktif={is_aktif}")

    from app.models.jadwal import Jadwal
    from app.models.kelas import Kelas
    from app.models.mahasiswa import Mahasiswa
    from app.models.penawaran_matakuliah import PenawaranKelas
    from app.models.user import UserRoleEnum

    # ── Admin / Dosen: tampilkan semua pertemuan, tetap filter by is_aktif ──
    if current_user.role != UserRoleEnum.mahasiswa:
        log.info(f"[/pertemuan/me] User is not mahasiswa, returning meetings (is_aktif={is_aktif})")
        all_result = get_all_pertemuan(
            db, status_filter=None, skip=skip, limit=limit
        )

        from datetime import datetime as dt_cls, timezone as tz_cls

        def _is_expired(p: dict) -> bool:
            try:
                batas = p.get("batas_presensi")
                if not batas:
                    return False
                now = dt_cls.now(tz_cls.utc)
                if isinstance(batas, dt_cls):
                    batas_dt = batas
                else:
                    batas_dt = dt_cls.fromisoformat(str(batas).replace("Z", "+00:00"))
                if batas_dt.tzinfo is None:
                    batas_dt = batas_dt.replace(tzinfo=tz_cls.utc)
                return now > batas_dt
            except Exception:
                return False

        if is_aktif:
            all_result = [
                r for r in all_result
                if r["status_pertemuan"] in ("belum", "sedang") and not _is_expired(r)
            ]
        else:
            all_result = [
                r for r in all_result
                if r["status_pertemuan"] in ("selesai", "dibatalkan") or _is_expired(r)
            ]

        return all_result

    # ── Cari mahasiswa dari email user login ──────────────────────────────────
    mhs = db.query(Mahasiswa).filter(Mahasiswa.email == current_user.email).first()
    if not mhs:
        log.warning(f"[/pertemuan/me] Mahasiswa tidak ditemukan: email={current_user.email}")
        return []

    log.info(
        f"[/pertemuan/me] mhs={mhs.nim} | prodi={mhs.id_prodi} "
        f"angkatan={mhs.id_angkatan} golongan={mhs.id_golongan} kelas={mhs.id_kelas}"
    )

    jadwal_ids: list[int] = []

    # ── Strategi 1: PenawaranKelas (id_prodi + id_angkatan + id_golongan) ─────────────
    pen_ids = [
        pk.id_penawaran
        for pk in db.query(PenawaranKelas)
        .filter(
            PenawaranKelas.id_prodi == mhs.id_prodi,
            PenawaranKelas.id_angkatan == mhs.id_angkatan,
            PenawaranKelas.id_golongan == mhs.id_golongan,
        )
        .all()
    ]
    if pen_ids:
        jadwal_ids = [
            j.id_jadwal
            for j in db.query(Jadwal).filter(Jadwal.id_penawaran.in_(pen_ids)).all()
        ]
        log.info(f"[/pertemuan/me] S1 OK -> penawaran={pen_ids} jadwal={jadwal_ids}")
    else:
        log.warning(f"[/pertemuan/me] S1 FAILED: No PenawaranKelas found for prodi={mhs.id_prodi}, angkatan={mhs.id_angkatan}, golongan={mhs.id_golongan}")

    # ── Strategi 2: Fallback via id_kelas ────────────────────────────────────
    if not jadwal_ids and mhs.id_kelas:
        kelas = db.query(Kelas).filter(Kelas.id == mhs.id_kelas).first()
        if kelas:
            log.info(f"[/pertemuan/me] S2 via kelas={kelas.nama_kelas}")
            from app.models.angkatan import Angkatan
            from app.models.golongan import Golongan

            ang = (
                db.query(Angkatan)
                .filter(Angkatan.tahun_angkatan == kelas.angkatan)
                .first()
            ) if kelas.angkatan else None
            gol = (
                db.query(Golongan)
                .filter(Golongan.nama_golongan == kelas.golongan)
                .first()
            ) if kelas.golongan else None

            q2 = db.query(PenawaranKelas).filter(
                PenawaranKelas.id_prodi == kelas.id_prodi
            )
            if ang:
                q2 = q2.filter(PenawaranKelas.id_angkatan == ang.id_angkatan)
            if gol:
                q2 = q2.filter(PenawaranKelas.id_golongan == gol.id_golongan)

            pen_ids_2 = [pk.id_penawaran for pk in q2.all()]
            if pen_ids_2:
                jadwal_ids = [
                    j.id_jadwal
                    for j in db.query(Jadwal)
                    .filter(Jadwal.id_penawaran.in_(pen_ids_2))
                    .all()
                ]
                log.info(f"[/pertemuan/me] S2 OK -> penawaran={pen_ids_2} jadwal={jadwal_ids}")
            else:
                log.warning(f"[/pertemuan/me] S2 FAILED: No PenawaranKelas found via kelas fallback")
        else:
            log.warning(f"[/pertemuan/me] S2 FAILED: Kelas with id={mhs.id_kelas} not found")

    if not jadwal_ids:
        log.warning(
            f"[/pertemuan/me] Tidak ada jadwal untuk {mhs.nim}. "
            "Pastikan mahasiswa memiliki kelas dengan PenawaranKelas yang cocok."
        )
        return []

    # ── Ambil data pertemuan dari jadwal_ids ─────────────────────────────────
    result = get_all_pertemuan(db, jadwal_ids=jadwal_ids, skip=skip, limit=limit)

    # Debug: log raw result
    log.info(f"[/pertemuan/me] Raw result count: {len(result)}")
    for r in result[:3]:  # Log first 3
        log.info(f"  -> id={r['id_pertemuan']}, status={r['status_pertemuan']}, tanggal={r['tanggal']}")

    # ── Helper: apakah presensi sudah melewati tenggat waktu? ────────────────
    from datetime import datetime, timezone

    def is_presensi_expired(p: dict) -> bool:
        """Return True jika presensi sudah melewati batas_presensi."""
        try:
            batas = p.get("batas_presensi")
            if not batas:
                return False
            import zoneinfo
            wib = zoneinfo.ZoneInfo("Asia/Jakarta")
            now = datetime.now(wib).replace(tzinfo=None)
            # Handle datetime object langsung (dari SQLAlchemy)
            if isinstance(batas, datetime):
                batas_dt = batas
            else:
                # Handle string format
                batas_dt = datetime.fromisoformat(str(batas).replace("Z", "+00:00"))
            # Pastikan naive
            if batas_dt.tzinfo is not None:
                batas_dt = batas_dt.replace(tzinfo=None)
            return now > batas_dt
        except Exception as e:
            log.warning(f"[is_presensi_expired] Error checking batas: {e}")
            return False

    # ── Filter berdasarkan is_aktif + tenggat waktu ──────────────────────────
    if is_aktif:
        # Mobile: tampilkan yang aktif DAN belum melewati tenggat
        result = [
            r for r in result
            if r["status_pertemuan"] in ("belum", "sedang") and not is_presensi_expired(r)
        ]
    else:
        # Web riwayat: tampilkan yang selesai/dibatalkan ATAU sudah lewat tenggat
        result = [
            r for r in result
            if r["status_pertemuan"] in ("selesai", "dibatalkan") or is_presensi_expired(r)
        ]

    log.info(f"[/pertemuan/me] Final result: {len(result)} pertemuan untuk {mhs.nim} (is_aktif={is_aktif})")
    return result


@pertemuan_router.get(
    "/riwayat", summary="Pertemuan tidak aktif (riwayat) untuk mahasiswa yang sedang login"
)
def pertemuan_riwayat(
    skip: int = 0,
    limit: int = 100,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Kembalikan pertemuan TIDAK AKTIF (status_pertemuan = selesai/dibatalkan)
    untuk ditampilkan di section Riwayat Presensi pada web dashboard.
    """
    import logging
    log = logging.getLogger(__name__)

    from app.models.jadwal import Jadwal
    from app.models.kelas import Kelas
    from app.models.mahasiswa import Mahasiswa
    from app.models.penawaran_matakuliah import PenawaranKelas, PenawaranMatakuliah
    from app.models.pertemuan import Pertemuan, StatusPertemuanEnum
    from app.models.presensi import Presensi
    from app.models.matakuliah import MataKuliah
    from app.models.user import UserRoleEnum

    inactive_statuses = [StatusPertemuanEnum.selesai, StatusPertemuanEnum.dibatalkan]

    # ── Admin / Dosen: tampilkan semua pertemuan tidak aktif ──────────────────
    if current_user.role != UserRoleEnum.mahasiswa:
        all_inactive = (
            db.query(Pertemuan)
            .filter(Pertemuan.status_pertemuan.in_(inactive_statuses))
            .order_by(Pertemuan.tanggal.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        result = []
        for p in all_inactive:
            jadwal = db.query(Jadwal).filter(Jadwal.id_jadwal == p.id_jadwal).first()
            penawaran = (
                db.query(PenawaranMatakuliah)
                .filter(PenawaranMatakuliah.id_penawaran == jadwal.id_penawaran)
                .first() if jadwal else None
            )
            mk = (
                db.query(MataKuliah)
                .filter(MataKuliah.id_matakuliah == penawaran.id_matakuliah)
                .first() if penawaran else None
            )
            presensi_list = db.query(Presensi).filter(Presensi.id_pertemuan == p.id_pertemuan).all()
            total = len(presensi_list)
            sudah_hadir = sum(1 for pr in presensi_list if pr.status_presensi.value in ("hadir", "terlambat"))
            belum = sum(1 for pr in presensi_list if pr.status_presensi.value == "belum")
            total_alpa = sum(1 for pr in presensi_list if pr.status_presensi.value in ("alpha", "izin", "sakit"))

            nama_kelas = None
            if penawaran:
                pk_list = db.query(PenawaranKelas).filter(PenawaranKelas.id_penawaran == penawaran.id_penawaran).all()
                if pk_list:
                    pk = pk_list[0]
                    parts = []
                    if pk.prodi: parts.append(pk.prodi.kode_prodi)
                    if pk.angkatan: parts.append(str(pk.angkatan.tahun_angkatan))
                    if pk.golongan: parts.append(pk.golongan.nama_golongan)
                    nama_kelas = "-".join(parts) if parts else None

            result.append({
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
            })
        return result

    # ── Cari mahasiswa dari email user login ──────────────────────────────────
    mhs = db.query(Mahasiswa).filter(Mahasiswa.email == current_user.email).first()
    if not mhs:
        log.warning(f"[/pertemuan/riwayat] Mahasiswa tidak ditemukan: email={current_user.email}")
        return []

    jadwal_ids: list[int] = []

    # ── Strategi 1: PenawaranKelas ────────────────────────────────────────────
    pen_ids = [
        pk.id_penawaran
        for pk in db.query(PenawaranKelas)
        .filter(
            PenawaranKelas.id_prodi == mhs.id_prodi,
            PenawaranKelas.id_angkatan == mhs.id_angkatan,
            PenawaranKelas.id_golongan == mhs.id_golongan,
        )
        .all()
    ]
    if pen_ids:
        jadwal_ids = [
            j.id_jadwal
            for j in db.query(Jadwal).filter(Jadwal.id_penawaran.in_(pen_ids)).all()
        ]

    # ── Strategi 2: Fallback via id_kelas ───────────────────────────────────
    if not jadwal_ids and mhs.id_kelas:
        kelas = db.query(Kelas).filter(Kelas.id == mhs.id_kelas).first()
        if kelas:
            from app.models.angkatan import Angkatan
            from app.models.golongan import Golongan

            ang = (
                db.query(Angkatan)
                .filter(Angkatan.tahun_angkatan == kelas.angkatan)
                .first()
            ) if kelas.angkatan else None
            gol = (
                db.query(Golongan)
                .filter(Golongan.nama_golongan == kelas.golongan)
                .first()
            ) if kelas.golongan else None

            q2 = db.query(PenawaranKelas).filter(
                PenawaranKelas.id_prodi == kelas.id_prodi
            )
            if ang:
                q2 = q2.filter(PenawaranKelas.id_angkatan == ang.id_angkatan)
            if gol:
                q2 = q2.filter(PenawaranKelas.id_golongan == gol.id_golongan)

            pen_ids_2 = [pk.id_penawaran for pk in q2.all()]
            if pen_ids_2:
                jadwal_ids = [
                    j.id_jadwal
                    for j in db.query(Jadwal)
                    .filter(Jadwal.id_penawaran.in_(pen_ids_2))
                    .all()
                ]

    if not jadwal_ids:
        return []

    # ── Helper: apakah batas_presensi sudah lewat? ───────────────────────────
    from datetime import datetime, timezone

    def is_expired(p: Pertemuan) -> bool:
        """Return True jika batas_presensi sudah lewat."""
        try:
            if not p.batas_presensi:
                return False
            batas_dt = p.batas_presensi
            if batas_dt.tzinfo is not None:
                batas_dt = batas_dt.replace(tzinfo=None)
            import zoneinfo
            wib = zoneinfo.ZoneInfo("Asia/Jakarta")
            now = datetime.now(wib).replace(tzinfo=None)
            return now > batas_dt
        except Exception:
            return False

    # Query semua pertemuan terkait jadwal, termasuk yang statusnya masih aktif tapi sudah lewat tenggat
    all_pertemuan = (
        db.query(Pertemuan)
        .filter(Pertemuan.id_jadwal.in_(jadwal_ids))
        .order_by(Pertemuan.tanggal.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Filter: tampilkan jika status sudah selesai/dibatalkan ATAU sudah lewat batas_presensi
    inactive_pertemuan = [
        p for p in all_pertemuan
        if p.status_pertemuan in inactive_statuses or is_expired(p)
    ]

    result = []
    for p in inactive_pertemuan:
        jadwal = db.query(Jadwal).filter(Jadwal.id_jadwal == p.id_jadwal).first()
        penawaran = (
            db.query(PenawaranMatakuliah)
            .filter(PenawaranMatakuliah.id_penawaran == jadwal.id_penawaran)
            .first() if jadwal else None
        )
        mk = (
            db.query(MataKuliah)
            .filter(MataKuliah.id_matakuliah == penawaran.id_matakuliah)
            .first() if penawaran else None
        )
        presensi_list = db.query(Presensi).filter(Presensi.id_pertemuan == p.id_pertemuan).all()
        total = len(presensi_list)
        sudah_hadir = sum(1 for pr in presensi_list if pr.status_presensi.value in ("hadir", "terlambat"))
        belum = sum(1 for pr in presensi_list if pr.status_presensi.value == "belum")
        total_alpa = sum(1 for pr in presensi_list if pr.status_presensi.value in ("alpha", "izin", "sakit"))

        nama_kelas = None
        if penawaran:
            pk_list = db.query(PenawaranKelas).filter(PenawaranKelas.id_penawaran == penawaran.id_penawaran).all()
            if pk_list:
                pk = pk_list[0]
                parts = []
                if pk.prodi: parts.append(pk.prodi.kode_prodi)
                if pk.angkatan: parts.append(str(pk.angkatan.tahun_angkatan))
                if pk.golongan: parts.append(pk.golongan.nama_golongan)
                nama_kelas = "-".join(parts) if parts else None

        result.append({
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
        })

    log.info(f"[/pertemuan/riwayat] {len(result)} pertemuan tidak aktif")
    return result


# ── Routes dengan path parameter ─────────────────────────────────────────────
@pertemuan_router.get(
    "/{pertemuan_id}/presensi",
    summary="Daftar mahasiswa & status presensi per pertemuan",
)
def presensi_per_pertemuan(
    pertemuan_id: int, db=Depends(get_db), _=Depends(get_current_user)
):
    return get_presensi_per_pertemuan(db, pertemuan_id)


@pertemuan_router.get("/{pertemuan_id}", response_model=PertemuanResponse)
def detail_pertemuan(
    pertemuan_id: int, db=Depends(get_db), _=Depends(get_current_user)
):
    return get_pertemuan_by_id(db, pertemuan_id)


@pertemuan_router.put("/{pertemuan_id}", response_model=PertemuanResponse)
def edit_pertemuan(
    pertemuan_id: int,
    payload: PertemuanUpdate,
    db=Depends(get_db),
    _=Depends(require_dosen),
):
    return update_pertemuan(db, pertemuan_id, payload)


@pertemuan_router.post("/{pertemuan_id}/mulai", response_model=PertemuanResponse)
def mulai(
    pertemuan_id: int,
    durasi_menit: int = 15,
    db=Depends(get_db),
    _=Depends(require_dosen),
):
    return mulai_pertemuan(db, pertemuan_id, durasi_menit)


@pertemuan_router.post("/{pertemuan_id}/selesai", response_model=PertemuanResponse)
def selesai(pertemuan_id: int, db=Depends(get_db), _=Depends(require_dosen)):
    return selesai_pertemuan(db, pertemuan_id)


@pertemuan_router.post("/archive-by-date", summary="Archive presensi yang sudah lewat tanggal")
def archive_old_presensi(db=Depends(get_db), _=Depends(require_dosen)):
    """
    Archive semua presensi yang tanggalnya sudah lewat ke history_presensi.
    Digunakan untuk auto-archive presensi yang tidak ditandai selesai secara manual.
    """
    return archive_pertemuan_by_date(db)


@pertemuan_router.post("/{pertemuan_id}/batalkan", response_model=PertemuanResponse)
def batalkan(pertemuan_id: int, db=Depends(get_db), _=Depends(require_dosen)):
    return batalkan_pertemuan(db, pertemuan_id)


@pertemuan_router.delete("/{pertemuan_id}", status_code=204)
def hapus_pertemuan(pertemuan_id: int, db=Depends(get_db), _=Depends(require_dosen)):
    delete_pertemuan(db, pertemuan_id)
