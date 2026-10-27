// src/components/sidebar.jsx
import "./Sidebar.css";
import { useNavigate } from "react-router-dom";
import { getRole } from "../utils/auth";

export default function Sidebar({
  navigationItems,
  activeNav,
  setActiveNav,
  onCloseMobile,
}) {
  const navigate = useNavigate();

  const routes = {
    Dashboard: "/dashboard",
    "Assignment-Kelas": "/mata-kuliah",
    "jadwal-kuliah": "/jadwal-kuliah",
    presensi: "/presensi",
    materi: "/materi",
    informasi: "/informasi",
    "profil-saya": "/profil-saya",
    "kelola-mata-kuliah": "/kelola-mata-kuliah",
    "kelola-kelas": "/kelola-kelas",
    "kelola-dosen": "/kelola-dosen",
    "kelola-mahasiswa": "/kelola-mahasiswa",
    "kelola-master-data": "/kelola-master-data",
    "kelola-geolokasi": "/kelola-geolokasi",
    "penawaran-matakuliah": "/penawaran-matakuliah",
    User: "/user",
  };

  const handleNavigation = (item) => {
    setActiveNav(item.id);

    // Tutup mobile sidebar saat navigasi
    if (onCloseMobile) {
      onCloseMobile();
    }

    if (routes[item.id]) {
      navigate(routes[item.id]);
    }
  };

  const userRole = getRole();
  // Backend roles: "admin" | "dosen" | "mahasiswa"

  return (
    <div className="sidebar lg:bg-transparent bg-white h-screen lg:h-auto overflow-y-auto">
      <h2 className="sidebar-title pt-4 lg:pt-0">Menu Utama</h2>
      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          // superAdminOnly → hanya admin (bukan dosen)
          if (item.superAdminOnly && userRole !== "admin") {
            return null;
          }

          // adminOnly → admin + dosen (misal: Profil Saya)
          if (item.adminOnly && userRole !== "admin" && userRole !== "dosen") {
            return null;
          }

          // adminAndSuperAdmin → admin + dosen, sembunyikan dari mahasiswa
          if (
            item.adminAndSuperAdmin &&
            userRole !== "admin" &&
            userRole !== "dosen"
          ) {
            return null;
          }

          const Icon = item.icon;
          const isActive = activeNav === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item)}
              className={`sidebar-item ${isActive ? "active" : "inactive"}`}
            >
              <Icon className="sidebar-icon" />
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
