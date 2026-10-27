# Sistem Presensi Pengenalan Wajah

Backend FastAPI + MySQL, website React/Vite, dan aplikasi Android Expo. Pipeline aktif adalah `enhanced` (YuNet, MobileFaceNet, LBPH, FAISS) di `ModelBaru/`. Kode dan model dasar dipertahankan; data mahasiswa, foto enrollment, template biometrik, dan konfigurasi lokal tidak boleh dipublikasikan.

## 1. Kebutuhan

- Python **3.10 atau 3.11** (TensorFlow 2.15 tidak mendukung semua versi Python).
- Node.js **20.19+ atau 22.12+**, npm; MySQL 8.
- Android Studio/JDK 17 untuk build Android native; perangkat fisik memerlukan akses LAN ke backend.

## 2. Database dan konfigurasi backend

Buat database kosong dan pengguna khusus melalui MySQL (ganti password contoh):

```sql
CREATE DATABASE skripsi_presensi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'presensi_app'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_DATABASE';
GRANT ALL PRIVILEGES ON skripsi_presensi.* TO 'presensi_app'@'localhost';
```

Dari PowerShell di root proyek:

```powershell
cd backend
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Edit `backend/.env`: isi DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME dan salin hasil generator ke SECRET_KEY. Kunci minimal 32 karakter; buat kunci berbeda untuk setiap deployment. DEBUG=false. Jangan unggah `.env`. Nilai password dengan `#` atau spasi dapat diapit tanda kutip. URL database dibentuk otomatis dan mendukung karakter khusus pada password.

FACE_MODEL_TYPE=enhanced adalah pipeline yang didukung paket ini. PRELOAD_ML_MODEL=false memuat ML saat pertama dipakai; ubah menjadi true bila ingin mencoba memuatnya saat startup. UPLOAD_DIR dan DATASET_DIR bersifat relatif terhadap folder backend: jalankan server dari folder tersebut.

## 3. Membuat tabel dan admin

Untuk **database baru/kosong**:

```powershell
python init_db.py
python seed.py
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`seed.py` meminta nama, email, dan password admin secara interaktif; tidak ada akun/password bawaan. API: http://localhost:8000/api/docs. Health: http://localhost:8000/api/health.

`init_db.py` membuat 20 tabel melalui model SQLAlchemy: users, prodi, dosen, matakuliah, angkatan, golongan, geolokasi, mahasiswa, kelas, penawaran_matakuliah, penawaran_kelas, pengajar, jadwal, pertemuan, pengajar_pertemuan, dataset_wajah, registrasi_wajah, presensi, log_deteksi, history_presensi. Tidak perlu mengimpor dump SQL atau data mahasiswa asli. Startup backend juga membuat tabel yang belum ada.

### Database lama

Cadangkan database dahulu. `create_all` **tidak memperbarui kolom pada tabel lama**. Skrip berikut adalah patch historis, bukan rangkaian migrasi lengkap untuk semua versi:

| Skrip | Kegunaan |
| --- | --- |
| migrate_kelas_mahasiswa.py | Menambah mahasiswa.id_kelas dan relasi kelas jika kolom belum ada |
| migrate_pertemuan.py | Menambah geolokasi dan pertemuan.id_geolokasi/mode_lokasi jika belum ada |
| migrate_fk_cascade.py | Mengubah tiga foreign key akademik menjadi ON DELETE CASCADE |
| migrate.py | **Menghapus semua tabel dan membuat ulang; jangan dipakai untuk instalasi normal** |

Untuk repo bersih, gunakan database baru + init_db.py. Untuk upgrade database lama, cocokkan skema terhadap model sebelum menjalankan patch; patch tersebut tidak menjamin seluruh perubahan ant versi tercakup.

## 4. Website

Buka terminal baru dari root:

```powershell
cd Website
npm ci
Copy-Item .env.example .env
npm run dev
```

`VITE_API_BASE_URL=http://localhost:8000/api/v1`; sesuaikan host jika backend berada di komputer lain. Ikuti alamat yang ditampilkan Vite. Build: `npm run build`. Semua nilai VITE_* terlihat oleh pengguna browser; jangan taruh rahasia di sini.

## 5. Android

```powershell
cd AndroidFolder
npm ci
Copy-Item .env.example .env
npm start
```

Isi EXPO_PUBLIC_API_URL tanpa `/api/v1`: emulator Android memakai `http://10.0.2.2:8000`; perangkat fisik memakai `http://IP_LAN_KOMPUTER:8000`. Restart Expo setelah mengubah `.env`. EXPO_PUBLIC_* bersifat publik. Untuk build native lokal, jalankan `npm run android` setelah Android Studio/JDK siap. Keystore debug hanya untuk pengembangan; build rilis harus memakai signing key pribadi di luar repositori.

## 6. Model wajah dan penggunaan pertama

Model dasar yang diperlukan dipertahankan di:

- ModelBaru/models/face_detection_yunet_2023mar.onnx
- ModelBaru/models/mobilefacenet.onnx
- ModelBaru/resources/anti_spoof_models/*.pth
- SilentFaceAntiSpoofing/resources/ (model anti-spoof dan deteksi beserta kode serta lisensinya)

Jangan menghapus bobot tersebut seperti menghapus foto dataset. Model dasar berbeda dari template/embedding identitas mahasiswa. Sebelum distribusi publik, pastikan hak distribusi bobot pihak ketiga sesuai sumbernya; asal dan lisensi MobileFaceNet lokal belum terverifikasi.

Mulai dengan membuat data master (prodi, angkatan, golongan, kelas), dosen/mahasiswa dan jadwal lewat UI/API. Daftarkan foto wajah baru milik pengguna yang berwenang lewat fitur enrollment. Gallery awal kosong sehingga pengenalan belum dapat mengidentifikasi siapa pun sebelum enrollment. Template `face_metadata.pkl`, foto `face_mahasiswa/`, uploads dan datasets dibuat ulang saat penggunaan dan diabaikan Git. Hasil kalibrasi lama dibuang; kalibrasikan threshold pada data evaluasi sendiri bila diperlukan.

## 7. Sebelum mengunggah ke GitHub

`.gitignore` mengecualikan konfigurasi lokal, dataset, template biometrik, dependensi, dan hasil build. Jangan memakai `git add -f` untuk file-file tersebut. Folder ini belum memiliki repositori Git root yang valid; buat repositori baru setelah pembersihan:

```powershell
git init
git add .
git status --short
git diff --cached --stat
```

Periksa daftar sebelum commit: tidak boleh ada `.env` selain `.env.example`, foto mahasiswa, dump database, token, private key, atau file template identitas. Lalu commit dan tambahkan remote repo GitHub milik Anda. Jangan mendorong riwayat repo lama yang pernah menyimpan rahasia. Jika rahasia pernah dipublikasikan, ganti rahasianya; menghapus file terbaru saja tidak menghapusnya dari riwayat.

## Batas verifikasi

Lihat CLEANUP_REPORT.md untuk hasil pemeriksaan aktual. Backend yang dapat diimpor atau halaman health yang sukses belum membuktikan koneksi MySQL, login, kamera, enrollment dan presensi berhasil. Uji alur lengkap dengan database dan perangkat Anda sebelum penggunaan nyata.
