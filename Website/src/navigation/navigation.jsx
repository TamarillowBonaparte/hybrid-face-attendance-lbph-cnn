import {
  LayoutDashboard,
  Calendar,
  CheckCircle,
  BookOpen,
  CalendarDays,
  User,
  Users,
  School,
  Layers,
  ClipboardList,
  GraduationCap,
  MapPin,
} from "lucide-react";

export const navigationItems = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jadwal-kuliah", label: "Jadwal Kuliah", icon: CalendarDays },
  { id: "presensi", label: "Input Presensi", icon: CheckCircle },
  { id: "profil-saya", label: "Profil Saya", icon: User, adminOnly: true },
  {
    id: "kelola-mata-kuliah",
    label: "Kelola Mata Kuliah",
    icon: BookOpen,
    superAdminOnly: true,
  },
  {
    id: "penawaran-matakuliah",
    label: "Penawaran Mata Kuliah",
    icon: ClipboardList,
    superAdminOnly: true,
  },
  {
    id: "kelola-kelas",
    label: "Kelola Kelas",
    icon: School,
    superAdminOnly: true,
  },
  {
    id: "kelola-dosen",
    label: "Kelola Dosen",
    icon: Users,
    superAdminOnly: true,
  },
  {
    id: "kelola-mahasiswa",
    label: "Kelola Mahasiswa",
    icon: GraduationCap,
    superAdminOnly: true,
  },
  {
    id: "kelola-master-data",
    label: "Master Data",
    icon: Layers,
    superAdminOnly: true,
  },
  {
    id: "kelola-geolokasi",
    label: "Kelola Geolokasi",
    icon: MapPin,
    superAdminOnly: true,
  },
  { id: "User", label: "Manajemen User", icon: User, superAdminOnly: true },
];
