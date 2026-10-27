import Swal from "sweetalert2";
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  BookOpen,
  Calendar,
  Download,
  Edit2,
  Save,
  X,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { API_BASE_URL } from "../utils/apiUtils";
import { getToken, getUser } from "../utils/auth";

// Mapping status backend → tampilan frontend
const STATUS_MAP = {
  belum:     { label: "Belum Presensi", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  hadir:     { label: "Hadir",          color: "bg-green-100 text-green-800 border-green-300",   icon: CheckCircle },
  terlambat: { label: "Terlambat",      color: "bg-orange-100 text-orange-800 border-orange-300", icon: AlertTriangle },
  izin:      { label: "Izin",           color: "bg-blue-100 text-blue-800 border-blue-300",       icon: AlertCircle },
  sakit:     { label: "Sakit",          color: "bg-purple-100 text-purple-800 border-purple-300", icon: AlertCircle },
  alpha:     { label: "Alpha",          color: "bg-red-100 text-red-800 border-red-300",          icon: XCircle },
};

// Opsi pilihan status untuk form edit
const STATUS_OPTIONS = [
  { value: "belum",     label: "Belum Presensi" },
  { value: "hadir",     label: "Hadir" },
  { value: "terlambat", label: "Terlambat" },
  { value: "izin",      label: "Izin" },
  { value: "sakit",     label: "Sakit" },
  { value: "alpha",     label: "Alpha" },
];

export default function DetailPresensi() {
  const [activeNav, setActiveNav] = useState("presensi");
  const { id_kelas_mk } = useParams(); // ini adalah id_pertemuan
  const navigate = useNavigate();

  const [daftarAbsen, setDaftarAbsen] = useState([]);
  const [pertemuanInfo, setPertemuanInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });

  // State edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPresensi, setEditingPresensi] = useState(null);
  const [editStatus, setEditStatus] = useState("belum");
  const [saving, setSaving] = useState(false);

  const currentUser = getUser() || {};
  const isAdminOrDosen = currentUser.role === "admin" || currentUser.role === "dosen";

  useEffect(() => {
    loadData();
    const intervalId = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [id_kelas_mk]);

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Ambil data presensi (rekap sudah include nim + nama_mahasiswa)
      const rekapRes = await fetch(
        `${API_BASE_URL}/presensi/rekap/pertemuan/${id_kelas_mk}`,
        { headers }
      );

      if (!rekapRes.ok) {
        showNotification("error", "Data presensi tidak ditemukan");
        setTimeout(() => navigate("/presensi"), 1500);
        return;
      }

      const rekapData = await rekapRes.json();
      setDaftarAbsen(rekapData || []);

      // Ambil info pertemuan untuk header
      const pertemuanRes = await fetch(
        `${API_BASE_URL}/pertemuan/${id_kelas_mk}`,
        { headers }
      );
      if (pertemuanRes.ok) {
        const p = await pertemuanRes.json();
        setPertemuanInfo(p);
      }
    } catch (error) {
      console.error("Error loading detail presensi:", error);
      showNotification("error", "Gagal memuat data presensi");
    } finally {
      setLoading(false);
    }
  };

  // Buka modal edit
  const handleEdit = (item) => {
    setEditingPresensi(item);
    setEditStatus(item.status_presensi || "belum");
    setShowEditModal(true);
  };

  // Simpan perubahan status
  const handleSave = async () => {
    if (!editingPresensi) return;
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/presensi/${editingPresensi.id_presensi}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status_presensi: editStatus }),
      });

      if (res.ok) {
        showNotification("success", "✓ Status presensi berhasil diperbarui!");
        setShowEditModal(false);
        setEditingPresensi(null);
        // Update data lokal tanpa reload penuh
        setDaftarAbsen((prev) =>
          prev.map((item) =>
            item.id_presensi === editingPresensi.id_presensi
              ? { ...item, status_presensi: editStatus }
              : item
          )
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", `❌ Gagal update: ${err.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error saving status:", err);
      showNotification("error", "❌ Terjadi kesalahan saat menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    let csv = `DAFTAR PRESENSI MAHASISWA\n`;
    csv += `Pertemuan ke-,${pertemuanInfo?.pertemuan_ke || id_kelas_mk}\n`;
    csv += `Tanggal,${pertemuanInfo?.tanggal || "-"}\n\n`;
    csv += `No,NIM,Nama Mahasiswa,Status Presensi,Waktu Presensi\n`;
    daftarAbsen.forEach((item, i) => {
      const waktu = item.waktu_presensi
        ? new Date(item.waktu_presensi).toLocaleTimeString("id-ID")
        : "-";
      csv += `${i + 1},${item.nim},"${item.nama_mahasiswa}",${STATUS_MAP[item.status_presensi]?.label || item.status_presensi},${waktu}\n`;
    });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Presensi_Pertemuan${pertemuanInfo?.pertemuan_ke || id_kelas_mk}_${pertemuanInfo?.tanggal || ""}.csv`;
    link.click();
  };

  const getStatusBadge = (statusKey) => {
    const s = STATUS_MAP[statusKey] || STATUS_MAP["belum"];
    const Icon = s.icon;
    return (
      <span className={`${s.color} px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 w-fit`}>
        <Icon className="h-3.5 w-3.5" />
        {s.label}
      </span>
    );
  };

  // Statistik
  const total = daftarAbsen.length;
  const countHadir = daftarAbsen.filter((m) => m.status_presensi === "hadir").length;
  const countTerlambat = daftarAbsen.filter((m) => m.status_presensi === "terlambat").length;
  const countIzin = daftarAbsen.filter((m) => m.status_presensi === "izin").length;
  const countSakit = daftarAbsen.filter((m) => m.status_presensi === "sakit").length;
  const countAlpha = daftarAbsen.filter((m) => m.status_presensi === "alpha").length;
  const countBelum = daftarAbsen.filter((m) => m.status_presensi === "belum").length;
  const persentase = total > 0 ? (((countHadir + countTerlambat) / total) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat data presensi...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 text-white ${
            notification.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}>
            {notification.type === "success" ? "✓" : "✕"} {notification.message}
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-6">
          <button
            onClick={() => navigate("/presensi")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-semibold">Kembali ke Daftar Presensi</span>
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-1">
                <UserCheck className="text-blue-600" /> Detail Presensi Mahasiswa
              </h1>
              {pertemuanInfo && (
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Pertemuan ke-{pertemuanInfo.pertemuan_ke} &nbsp;·&nbsp;
                  {new Date(pertemuanInfo.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
            </div>
            <button
              onClick={handleExport}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-semibold text-sm"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Total", value: total, bg: "bg-white border-gray-200", text: "text-gray-900" },
            { label: "Hadir", value: countHadir, bg: "bg-green-50 border-green-200", text: "text-green-700" },
            { label: "Terlambat", value: countTerlambat, bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
            { label: "Izin", value: countIzin, bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
            { label: "Sakit", value: countSakit, bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
            { label: "Alpha", value: countAlpha, bg: "bg-red-50 border-red-200", text: "text-red-700" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${stat.text}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Info belum presensi & persentase */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800 font-medium">Belum Presensi: <strong>{countBelum}</strong></span>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-indigo-600" />
            <span className="text-sm text-indigo-800 font-medium">Kehadiran: <strong>{persentase}%</strong></span>
          </div>
        </div>

        {/* Tabel */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">No</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">NIM</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nama Mahasiswa</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Waktu Presensi</th>
                  {isAdminOrDosen && (
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {daftarAbsen.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminOrDosen ? 6 : 5} className="px-6 py-12 text-center text-gray-400">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Belum ada data mahasiswa untuk pertemuan ini
                    </td>
                  </tr>
                ) : (
                  daftarAbsen.map((item, index) => (
                    <tr key={item.id_presensi} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-mono">{item.nim}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.nama_mahasiswa}</td>
                      <td className="px-6 py-4">{getStatusBadge(item.status_presensi)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.waktu_presensi ? (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {new Date(item.waktu_presensi).toLocaleTimeString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">—</span>
                        )}
                      </td>
                      {isAdminOrDosen && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleEdit(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 mx-auto"
                            title="Edit Status Presensi"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit Status
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress Bar */}
        {total > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Progress Kehadiran</h3>
            <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden flex">
              {countHadir > 0 && (
                <div className="bg-green-500 h-full transition-all" style={{ width: `${(countHadir / total) * 100}%` }} title={`Hadir: ${countHadir}`} />
              )}
              {countTerlambat > 0 && (
                <div className="bg-orange-400 h-full transition-all" style={{ width: `${(countTerlambat / total) * 100}%` }} title={`Terlambat: ${countTerlambat}`} />
              )}
              {countIzin > 0 && (
                <div className="bg-blue-400 h-full transition-all" style={{ width: `${(countIzin / total) * 100}%` }} title={`Izin: ${countIzin}`} />
              )}
              {countSakit > 0 && (
                <div className="bg-purple-400 h-full transition-all" style={{ width: `${(countSakit / total) * 100}%` }} title={`Sakit: ${countSakit}`} />
              )}
              {countAlpha > 0 && (
                <div className="bg-red-500 h-full transition-all" style={{ width: `${(countAlpha / total) * 100}%` }} title={`Alpha: ${countAlpha}`} />
              )}
              {countBelum > 0 && (
                <div className="bg-yellow-300 h-full transition-all" style={{ width: `${(countBelum / total) * 100}%` }} title={`Belum: ${countBelum}`} />
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              {[
                { label: "Hadir", count: countHadir, color: "bg-green-500" },
                { label: "Terlambat", count: countTerlambat, color: "bg-orange-400" },
                { label: "Izin", count: countIzin, color: "bg-blue-400" },
                { label: "Sakit", count: countSakit, color: "bg-purple-400" },
                { label: "Alpha", count: countAlpha, color: "bg-red-500" },
                { label: "Belum Presensi", count: countBelum, color: "bg-yellow-300" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${item.color}`} />
                  <span className="text-gray-600">{item.label} ({item.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Modal Edit Status ── */}
      {showEditModal && editingPresensi && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scaleIn">
            {/* Header modal */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-600" />
                Edit Status Presensi
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info mahasiswa */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">NIM</span>
                <span className="font-bold text-gray-900">{editingPresensi.nim}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Nama</span>
                <span className="font-bold text-gray-900">{editingPresensi.nama_mahasiswa}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Status Saat Ini</span>
                {getStatusBadge(editingPresensi.status_presensi)}
              </div>
            </div>

            {/* Pilih status baru */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Status Baru <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const s = STATUS_MAP[opt.value];
                  const Icon = s.icon;
                  const isSelected = editStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setEditStatus(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
                          : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" /> Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .animate-scaleIn { animation: scaleIn 0.22s ease-out; }
      `}</style>
    </DashboardLayout>
  );
}
