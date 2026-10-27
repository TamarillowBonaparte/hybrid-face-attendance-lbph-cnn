# Matikan TF noise log (oneDNN) sebelum import apapun
import os
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401
import logging
from contextlib import asynccontextmanager


from app.config.database import Base, engine
from app.config.settings import settings
from app.routes.auth import router as auth_router
from app.routes.compat_routes import (
    dashboard_router,
    kelas_mk_router,
    users_router,
)
from app.routes.dosen import (
    angkatan_router,
    dosen_router,
    golongan_router,
    mk_router,
    prodi_router,
)
from app.routes.jadwal import pertemuan_router
from app.routes.jadwal import router as jadwal_router
from app.routes.kelas import router as kelas_router
from app.routes.mahasiswa import router as mahasiswa_router
from app.routes.penawaran import (
    penawaran_kelas_router,
    penawaran_router,
    pengajar_pertemuan_router,
    pengajar_router,
)
from app.routes.presensi import (
    dataset_router,
    log_router,
    registrasi_router,
)
from app.routes.presensi import (
    router as presensi_router,
)
from app.routes.geolokasi import router as geolokasi_router
from app.routes.face_recognition import router as face_recognition_router
from app.routes.arcface_enrollment import router as arcface_router
from app.routes.enhanced_recognition import router as enhanced_recognition_router
from app.routes.history_presensi import router as history_presensi_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger(__name__)


def _init_database() -> bool:
    """Create/check tables without preventing the API process from starting."""
    try:
        Base.metadata.create_all(bind=engine)
        log.info("[OK] Database schema checked")
        return True
    except Exception as exc:
        log.warning("[DB] Schema init skipped/failed: %s", exc)
        return False


# ── Lifespan: pre-load ML model saat startup ─────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Jalankan task startup & shutdown.
    ML model di-load di sini agar siap sebelum request pertama masuk.
    Ini menghindari cold-start delay saat /face-scan pertama dipanggil.
    """
    import asyncio

    # STARTUP
    log.info("=" * 60)
    log.info(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    log.info("  Backend + ML (in-process) starting...")
    log.info("=" * 60)

    _init_database()

    if settings.PRELOAD_ML_MODEL:
        from app.services.ml_service import preload_ml_model

        ml_ok = preload_ml_model()
        if ml_ok:
            log.info("[OK] ML Face Recognition model loaded successfully")
        else:
            log.warning(
                "[!] ML model gagal di-load. "
                "Face-scan endpoint akan mencoba load ulang saat digunakan. "
                "Pastikan dependencies ML (tensorflow, faiss-cpu, dll) terinstall."
            )
    else:
        log.info("[ML] Startup preload disabled. Model will load on first face-scan.")

    # ── Auto-archive presensi yang sudah lewat tenggat saat startup ────────
    try:
        from app.config.database import SessionLocal
        from app.controllers.jadwal_controller import archive_pertemuan_by_date

        db = SessionLocal()
        try:
            result = archive_pertemuan_by_date(db)
            archived = result.get("archived_count", 0)
            if archived > 0:
                log.info(f"[OK] Auto-archived {archived} expired presensi on startup")
            else:
                log.info("[OK] No expired presensi to archive on startup")
        finally:
            db.close()
    except Exception as exc:
        log.warning(f"[!] Auto-archive on startup failed: {exc}")

    # ── Background scheduler: archive setiap 5 menit ─────────────────────
    async def _periodic_archive():
        """Background task yang memeriksa dan meng-archive presensi expired setiap 5 menit."""
        while True:
            await asyncio.sleep(300)  # 5 menit
            try:
                db = SessionLocal()
                try:
                    result = archive_pertemuan_by_date(db)
                    archived = result.get("archived_count", 0)
                    if archived > 0:
                        log.info(f"[SCHEDULER] Auto-archived {archived} expired presensi")
                finally:
                    db.close()
            except Exception as exc:
                log.warning(f"[SCHEDULER] Periodic archive failed: {exc}")

    archive_task = asyncio.create_task(_periodic_archive())
    log.info("[OK] Periodic archive scheduler started (every 5 minutes)")

    log.info("[OK] Backend ready - http://0.0.0.0:8000")
    log.info("[OK] API Docs  - http://0.0.0.0:8000/api/docs")

    yield  # ← server berjalan di sini

    # SHUTDOWN
    archive_task.cancel()
    try:
        await archive_task
    except asyncio.CancelledError:
        pass
    log.info("Backend shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers under /api/v1 ───────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(prodi_router, prefix=API_PREFIX)
app.include_router(angkatan_router, prefix=API_PREFIX)
app.include_router(golongan_router, prefix=API_PREFIX)
app.include_router(mk_router, prefix=API_PREFIX)
app.include_router(dosen_router, prefix=API_PREFIX)
app.include_router(mahasiswa_router, prefix=API_PREFIX)
app.include_router(jadwal_router, prefix=API_PREFIX)
app.include_router(pertemuan_router, prefix=API_PREFIX)
app.include_router(penawaran_router, prefix=API_PREFIX)
app.include_router(penawaran_kelas_router, prefix=API_PREFIX)
app.include_router(pengajar_router, prefix=API_PREFIX)
app.include_router(pengajar_pertemuan_router, prefix=API_PREFIX)
app.include_router(presensi_router, prefix=API_PREFIX)
app.include_router(dataset_router, prefix=API_PREFIX)
app.include_router(dataset_router, prefix=f"{API_PREFIX}/presensi")
app.include_router(registrasi_router, prefix=API_PREFIX)
app.include_router(registrasi_router, prefix=f"{API_PREFIX}/presensi")
app.include_router(log_router, prefix=API_PREFIX)

app.include_router(geolokasi_router, prefix=API_PREFIX)
app.include_router(face_recognition_router, prefix=API_PREFIX)
app.include_router(arcface_router, prefix=API_PREFIX)
app.include_router(enhanced_recognition_router, prefix=API_PREFIX)
app.include_router(history_presensi_router, prefix=API_PREFIX)
app.include_router(kelas_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(kelas_mk_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
