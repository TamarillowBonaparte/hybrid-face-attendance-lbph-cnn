import math
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.geolokasi import Geolokasi, StatusGeolokasiEnum
from app.schemas.geolokasi import GeolokasiCreate, GeolokasiUpdate


# ─── HAVERSINE ────────────────────────────────────────────────────────────────

def hitung_jarak_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Menghitung jarak antara dua titik koordinat (lat/long) menggunakan
    formula Haversine. Mengembalikan jarak dalam meter.
    """
    R = 6_371_000  # Radius bumi dalam meter
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c  # jarak dalam meter


def validasi_lokasi(
    lat_mahasiswa: float,
    lon_mahasiswa: float,
    geolokasi: Geolokasi,
) -> float:
    """
    Validasi apakah koordinat mahasiswa ada di dalam radius lokasi.
    Mengembalikan jarak (meter) jika valid.
    Raise HTTPException 403 jika di luar radius.
    """
    jarak = hitung_jarak_haversine(
        lat_mahasiswa, lon_mahasiswa,
        float(geolokasi.latitude), float(geolokasi.longitude),
    )
    if jarak > geolokasi.radius_meter:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Lokasi Anda terlalu jauh dari area presensi '{geolokasi.nama_lokasi}'. "
                f"Jarak Anda: {jarak:.0f} m, Radius maksimum: {geolokasi.radius_meter} m."
            ),
        )
    return jarak


# ─── CRUD GEOLOKASI ───────────────────────────────────────────────────────────

def get_all_geolokasi(db: Session, status_filter: str | None = None, skip: int = 0, limit: int = 100):
    q = db.query(Geolokasi)
    if status_filter:
        q = q.filter(Geolokasi.status == status_filter)
    return q.order_by(Geolokasi.nama_lokasi).offset(skip).limit(limit).all()


def get_geolokasi_by_id(db: Session, geolokasi_id: int) -> Geolokasi:
    g = db.query(Geolokasi).filter(Geolokasi.id_geolokasi == geolokasi_id).first()
    if not g:
        raise HTTPException(404, "Geolokasi tidak ditemukan")
    return g


def create_geolokasi(db: Session, payload: GeolokasiCreate) -> Geolokasi:
    g = Geolokasi(**payload.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


def update_geolokasi(db: Session, geolokasi_id: int, payload: GeolokasiUpdate) -> Geolokasi:
    g = get_geolokasi_by_id(db, geolokasi_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return g


def delete_geolokasi(db: Session, geolokasi_id: int):
    g = get_geolokasi_by_id(db, geolokasi_id)
    # Cek apakah masih digunakan oleh pertemuan
    from app.models.pertemuan import Pertemuan
    used = db.query(Pertemuan).filter(Pertemuan.id_geolokasi == geolokasi_id).count()
    if used > 0:
        raise HTTPException(
            400,
            f"Lokasi ini masih digunakan oleh {used} pertemuan. "
            "Ubah pertemuan tersebut ke mode bebas terlebih dahulu."
        )
    db.delete(g)
    db.commit()
