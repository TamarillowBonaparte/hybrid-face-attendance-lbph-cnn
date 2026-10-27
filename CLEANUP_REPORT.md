# Hasil pembersihan â€” 26 Oktober 2026

## Yang dikerjakan

- 153 target terdaftar (10.546 file, sekitar 1.298 MiB) dipindahkan melalui cadangan sementara di luar proyek, lalu dihapus dari proyek. Termasuk dataset/foto, template identitas, upload, hasil pelatihan lama, arsip, laporan dan generator laporan, kode ML lama, konfigurasi lokal, serta hasil analisis graphify.
- Riwayat Git terpisah Android dicadangkan di luar proyek dan dihapus agar source Android dapat masuk repo root sebagai file biasa. Tidak ada commit/push yang dilakukan.
- Gambar demo SilentFace ikut dicadangkan dan dihapus; bobot umum, source, dan LICENSE tetap dipertahankan. Ikon/logo UI yang diperlukan aplikasi tetap ada.
- .env asli backend/website dihapus; contoh konfigurasi tiga aplikasi ditambahkan. SECRET_KEY wajib diisi sendiri dan placeholder contoh ditolak. Akun admin bawaan diubah menjadi pembuatan interaktif.
- Ditambahkan init_db.py yang membuat tabel tanpa drop; panduan membedakan instalasi baru dengan patch database historis dan skrip reset destruktif.
- Ditambahkan onnxruntime, pin bcrypt kompatibel Passlib, dan hanya opencv-contrib-python untuk menghindari dua paket OpenCV saling menimpa.
- URL database mendukung karakter khusus pada password. URL Android kini memakai EXPO_PUBLIC_API_URL. Kesalahan tipe handler tombol scan Android diperbaiki.
- Paket native Android dipertahankan dan aturan ignore yang sebelumnya membuang seluruh folder android dihapus.

## Verifikasi aktual

- Build produksi website berhasil (1.802 modul). Ada peringatan ukuran bundle dan data Browserslist lama.
- Pemeriksaan TypeScript Android (`tsc --noEmit`) berhasil setelah perbaikan handler.
- Backend berhasil diimpor. Handler health berhasil; skema OpenAPI dengan 102 path berhasil dibentuk.
- Definisi 20 tabel berhasil dikompilasi menjadi DDL MySQL tanpa menjalankan perubahan pada database pengguna.
- Password database dengan karakter khusus lolos pemeriksaan pembentukan URL.
- EnhancedFaceRecognitionSystem berhasil dimuat dengan gallery kosong setelah foto dan metadata identitas dihapus.
- Sintaks source Python lolos. Inventaris source/aset di luar dependensi dan cache tidak menemukan .env asli, foto JPEG, dump SQL, metadata pickle, arsip, atau dokumen laporan. Pemindaian pola token GitHub/AWS/JWT/private key tidak menemukan kecocokan. Pemindaian pola bukan jaminan mendeteksi segala bentuk rahasia.
- Audit Git sementara memeriksa 276 kandidat file; .env.example, model dasar dan source native Android tercakup, sedangkan data sensitif/dependensi dikecualikan.
- MySQL baru, login, enrollment, kamera, geolokasi, build APK dan presensi menyeluruh belum diuji. Tidak ada database pengguna yang dimigrasikan/dihapus.

## Model umum yang dipertahankan

SHA-256:

- face_detection_yunet_2023mar.onnx: `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4`
- mobilefacenet.onnx: `4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43`

Hash mencatat file lokal; bukan bukti asal atau lisensi. Asal/lisensi bobot MobileFaceNet perlu dipastikan sebelum redistribusi publik.

## Catatan lokal

Dependensi Website/Android dan virtual environment backend digunakan untuk verifikasi dan diabaikan Git; tidak perlu diunggah. Aturan agen lokal .agents juga diabaikan. Root .git awal kosong, bukan repositori dengan riwayat valid.

Cadangan sementara berisi data sensitif berada di folder Temp Windows di luar proyek; jangan unggah cadangan tersebut. Lokasinya telah disampaikan dalam hasil proses pembersihan. Folder sementara dapat dibersihkan Windows dan bukan arsip permanen. Panduan instalasi ada di README.md.
