# app/models/__init__.py -- import dalam urutan dependency
# Tier 1 -- no FK
from app.models.user import User                          # noqa: F401
from app.models.prodi import Prodi                        # noqa: F401
from app.models.dosen import Dosen                        # noqa: F401
from app.models.matakuliah import MataKuliah              # noqa: F401
from app.models.angkatan import Angkatan                  # noqa: F401
from app.models.golongan import Golongan                  # noqa: F401
from app.models.geolokasi import Geolokasi                # noqa: F401

# Tier 2 -- depends on Prodi, Angkatan, Golongan
from app.models.mahasiswa import Mahasiswa                # noqa: F401
from app.models.kelas import Kelas                        # noqa: F401

# Tier 3 -- depends on MataKuliah, Dosen, Prodi, Angkatan, Golongan
from app.models.penawaran_matakuliah import (             # noqa: F401
    PenawaranMatakuliah, PenawaranKelas, Pengajar,
)
from app.models.jadwal import Jadwal                      # noqa: F401

# Tier 4 -- depends on Jadwal
from app.models.pertemuan import Pertemuan                # noqa: F401

# Tier 5 -- depends on Pertemuan, Dosen
from app.models.pengajar_pertemuan import PengajarPertemuan  # noqa: F401

# Tier 6 -- depends on Mahasiswa
from app.models.dataset_wajah import DatasetWajah         # noqa: F401
from app.models.registrasi_wajah import RegistrasiWajah   # noqa: F401

# Tier 7 -- depends on Pertemuan + Mahasiswa
from app.models.presensi import Presensi                  # noqa: F401
from app.models.log_deteksi import LogDeteksi             # noqa: F401
from app.models.history_presensi import HistoryPresensi   # noqa: F401

__all__ = [
    "User", "Prodi", "Dosen", "MataKuliah", "Angkatan", "Golongan",
    "Geolokasi",
    "Mahasiswa", "Kelas",
    "PenawaranMatakuliah", "PenawaranKelas", "Pengajar",
    "Jadwal",
    "Pertemuan", "PengajarPertemuan",
    "DatasetWajah", "RegistrasiWajah",
    "Presensi", "LogDeteksi", "HistoryPresensi",
]
