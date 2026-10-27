// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/dashboard";
import Presensi from "./pages/presensi";
import JadwalKuliah from "./pages/jadwalKuliah";
import UserPage from "./pages/user";
import KelolaDosen from "./pages/kelolaDosen";
import DetailProfilDosen from "./pages/detailProfilDosen";
import ProfilSaya from "./pages/profilSaya";
import KelolaMataKuliah from "./pages/kelolaMataKuliah";
import KelolaKelas from "./pages/kelolaKelas";
import KelolaMasterData from "./pages/kelolaMasterData";
import KelolaPenawaran from "./pages/kelolaPenawaran";
import DetailPresensi from "./pages/detailPresensi";
import KelolaMahasiswa from "./pages/kelolaMahasiswa";
import KelolaGeolokasi from "./pages/kelolaGeolokasi";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const protectedRoutes = [
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/presensi", element: <Presensi /> },
    { path: "/presensi/detail/:id_kelas_mk", element: <DetailPresensi /> },
    { path: "/jadwal-kuliah", element: <JadwalKuliah /> },
    {
      path: "/kelola-mata-kuliah",
      element: <KelolaMataKuliah />,
      roles: ["admin"],
    },
    { path: "/kelola-kelas", element: <KelolaKelas />, roles: ["admin"] },
    {
      path: "/penawaran-matakuliah",
      element: <KelolaPenawaran />,
      roles: ["admin"],
    },
    { path: "/kelola-dosen", element: <KelolaDosen />, roles: ["admin"] },
    {
      path: "/kelola-mahasiswa",
      element: <KelolaMahasiswa />,
      roles: ["admin"],
    },
    {
      path: "/kelola-master-data",
      element: <KelolaMasterData />,
      roles: ["admin"],
    },
    {
      path: "/detail-profil-dosen/:id_dosen",
      element: <DetailProfilDosen />,
      roles: ["admin"],
    },
    {
      path: "/profil-saya",
      element: <ProfilSaya />,
      roles: ["admin", "dosen"],
    },
    {
      path: "/kelola-geolokasi",
      element: <KelolaGeolokasi />,
      roles: ["admin"],
    },
    { path: "/user", element: <UserPage />, roles: ["admin"] },
  ];

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {protectedRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <ProtectedRoute allowedRoles={route.roles}>
              {route.element}
            </ProtectedRoute>
          }
        />
      ))}

      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center px-4">
              <div className="mb-8">
                <h1 className="text-9xl font-bold text-gray-200">404</h1>
                <div className="text-6xl font-bold text-gray-800 -mt-8">
                  Oops!
                </div>
              </div>
              <p className="text-2xl text-gray-600 mb-4 font-semibold">
                Halaman tidak ditemukan
              </p>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Halaman yang Anda cari mungkin telah dihapus, namanya berubah,
                atau sementara tidak tersedia.
              </p>
              <a
                href="/dashboard"
                className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Kembali ke Dashboard
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
