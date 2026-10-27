import Swal from "sweetalert2";
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { ArrowLeft, UserCheck, Users, BookOpen, Calendar, Download, CheckCircle, XCircle, Clock, AlertCircle, Edit2, Save, X, Archive } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getToken, getUser } from "../utils/auth";
import { API_BASE_URL } from "../utils/apiUtils";

export default function DetailPresensiAbsen() {
  const [activeNav, setActiveNav] = useState("presensi");
  const navigate = useNavigate();
  const { id_kelas_mk, tanggal, pertemuan_ke } = useParams(); // Get params from URL

  const [daftarAbsen, setDaftarAbsen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [detailPresensi, setDetailPresensi] = useState({
    kelas: "",
    matkul: "",
    kode_mk: "",
    minggu: 0,
    tanggal: "",
    waktu_mulai: "",
    waktu_selesai: "",
    status_pertemuan: "belum", // default status
    is_aktif: true
  });

  // State untuk edit status
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPresensi, setEditingPresensi] = useState(null);
  const [editForm, setEditForm] = useState({
    status: ""
  });

  // Get current user role
  const currentUser = getUser() || {};
  const isAdminOrSuperAdmin = currentUser.role === 'admin' || currentUser.role === 'dosen';

  // Load data dari backend
  useEffect(() => {
    loadDetailPresensi();
    const intervalId = setInterval(() => {
      loadDetailPresensi(false);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [id_kelas_mk, tanggal, pertemuan_ke]);

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  const loadDetailPresensi = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = getToken();

      // Fetch pertemuan info untuk mendapatkan status
      const pertemuanRes = await fetch(`${API_BASE_URL}/pertemuan/${id_kelas_mk}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const response = await fetch(`${API_BASE_URL}/presensi/?id_pertemuan=${id_kelas_mk}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (showLoading) setLoading(true);\n      if (response.ok) {
        const data = await response.json();

        if (data.length > 0) {
          // Set data absen mahasiswa
          setDaftarAbsen(data);

          // Load info kelas mata kuliah
          loadInfoKelasMK(id_kelas_mk);

          // Ambil waktu_mulai dan waktu_selesai dari data presensi pertama
          // (semua mahasiswa di sesi yang sama memiliki waktu yang sama)
          const firstRecord = data[0];

          // Tentukan apakah presensi aktif atau tidak berdasarkan status_pertemuan
          let statusPertemuan = "belum";
          let isAktif = true;

          if (pertemuanRes.ok) {
            const pertemuanData = await pertemuanRes.json();
            statusPertemuan = pertemuanData.status_pertemuan || "belum";
            // Tidak aktif jika status adalah selesai atau dibatalkan
            isAktif = !["selesai", "dibatalkan"].includes(statusPertemuan);
          }

          setDetailPresensi(prev => ({
            ...prev,
            minggu: parseInt(pertemuan_ke),
            tanggal: tanggal,
            waktu_mulai: firstRecord.waktu_mulai || "00:00",
            waktu_selesai: firstRecord.waktu_selesai || "00:00",
            status_pertemuan: statusPertemuan,
            is_aktif: isAktif
          }));
        }
      } else {
        if (showLoading) showNotification('error', "Data presensi tidak ditemukan");
        if (showLoading) setTimeout(() => navigate("/presensi"), 1500);
      }
    } catch (error) {
      console.error("Error loading detail presensi:", error);
      if (showLoading) showNotification('error', "Gagal memuat data presensi");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadInfoKelasMK = async (id_kelas_mk) => {
    try {
      const token2 = getToken();
      const response = await fetch(`${API_BASE_URL}/kelas-mata-kuliah/${id_kelas_mk}`, {
        headers: { Authorization: `Bearer ${token2}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDetailPresensi(prev => ({
          ...prev,
          kelas: data.nama_kelas,
          matkul: data.nama_mk,
          kode_mk: data.kode_mk
        }));
      }
    } catch (error) {
      console.error("Error loading kelas mata kuliah:", error);
    }
  };

  const handleKembali = () => {
    navigate("/presensi");
  };

  const handleEditStatus = (mahasiswa) => {
    setEditingPresensi(mahasiswa);
    setEditForm({
      status: mahasiswa.status
    });
    setShowEditModal(true);
  };

  const handleSaveEditStatus = async () => {
    try {
      const token = getToken();
      if (!token) {
        showNotification('error', 'Token otentikasi tidak ditemukan. Silakan login ulang.');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/presensi/${editingPresensi.id_presensi}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status_presensi: editForm.status
        })
      });

      if (response.ok) {
        showNotification('success', '✓ Status presensi berhasil diupdate!');
        setShowEditModal(false);
        setEditingPresensi(null);
        setEditForm({ status: "" });

        // Reload data
        loadDetailPresensi();
      } else {
        const errorData = await response.json();
        showNotification('error', `❌ Gagal update status: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating presensi status:', error);
      showNotification('error', '❌ Terjadi kesalahan saat mengupdate status');
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingPresensi(null);
    setEditForm({ status: "" });
  };

  const handleExport = () => {
    // Export data ke CSV
    const csvContent = generateCSV();
    downloadCSV(csvContent, `Presensi_${detailPresensi.kelas}_${detailPresensi.matkul}_Minggu${detailPresensi.minggu}_${detailPresensi.tanggal}.csv`);
  };

  const generateCSV = () => {
    // Header info
    let csv = `DAFTAR PRESENSI MAHASISWA\n`;
    csv += `Kelas,${detailPresensi.kelas}\n`;
    csv += `Mata Kuliah,${detailPresensi.matkul} (${detailPresensi.kode_mk})\n`;
    csv += `Minggu,${detailPresensi.minggu}\n`;
    csv += `Tanggal,${new Date(detailPresensi.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    csv += `Waktu,${detailPresensi.waktu_mulai || '00:00'} - ${detailPresensi.waktu_selesai || '00:00'}\n`;
    csv += `\n`;

    // Statistik
    csv += `Total Mahasiswa,${totalMahasiswa}\n`;
    csv += `Hadir,${hadir}\n`;
    csv += `Alpa,${alpa}\n`;
    csv += `Persentase Kehadiran,${persentaseKehadiran}%\n`;
    csv += `\n`;

    // Header tabel
    csv += `No,NIM,Nama Mahasiswa,Status,Waktu Absen\n`;

    // Data mahasiswa
    daftarAbsen.forEach((mahasiswa, index) => {
      const waktuAbsen = mahasiswa.waktu_input
        ? new Date(mahasiswa.waktu_input).toLocaleTimeString('id-ID')
        : '-';
      csv += `${index + 1},${mahasiswa.nim},"${mahasiswa.nama_mahasiswa}",${mahasiswa.status},${waktuAbsen}\n`;
    });

    return csv;
  };

  const downloadCSV = (content, filename) => {
    // Add BOM for Excel to recognize UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const badges = {
      "Hadir": {
        color: "bg-green-100 text-green-800 border-green-300",
        icon: CheckCircle,
        text: "Hadir"
      },
      "Belum Absen": {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: Clock,
        text: "Belum Absen"
      },
      "Alfa": {
        color: "bg-red-100 text-red-800 border-red-300",
        icon: XCircle,
        text: "Alfa"
      }
    };
    const badge = badges[status] || badges["Belum Absen"];
    const Icon = badge.icon;
    return (
      <span className={`${badge.color} px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 justify-center w-fit`}>
        <Icon className="h-3.5 w-3.5" />
        {badge.text}
      </span>
    );
  };

  // Hitung statistik
  const totalMahasiswa = daftarAbsen.length;
  const hadir = daftarAbsen.filter(m => m.status === 'Hadir').length;
  const belumAbsen = daftarAbsen.filter(m => m.status === 'Belum Absen').length;
  const alpa = daftarAbsen.filter(m => m.status === 'Alfa').length;
  const persentaseKehadiran = totalMahasiswa > 0 ? ((hadir / totalMahasiswa) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white`}>
            {notification.type === 'success' ? '✓' : '✕'} {notification.message}
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* Header dengan Tombol Kembali */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-6">
          <button
            onClick={handleKembali}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-semibold">Kembali ke Daftar Presensi</span>
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {!detailPresensi.is_aktif && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300">
                    <Archive className="h-3.5 w-3.5" /> Tidak Aktif
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                <UserCheck className="text-blue-600" /> Detail Presensi Mahasiswa
              </h1>
              <p className="text-gray-600 text-sm">
                {detailPresensi.is_aktif
                  ? "Daftar kehadiran mahasiswa untuk minggu ini"
                  : "Riwayat presensi - tidak dapat lagi melakukan presensi via mobile"
                }
              </p>
            </div>

            <button
              onClick={handleExport}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-semibold"
            >
              <Download className="h-5 w-5" />
              Export Data
            </button>
          </div>
        </div>

        {/* Info Presensi */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Informasi Presensi</h2>
            {!detailPresensi.is_aktif && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300">
                <Archive className="h-3.5 w-3.5" /> Tidak Aktif
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Kelas</p>
                <p className="font-bold text-gray-900">{detailPresensi.kelas}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-3 rounded-lg">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Mata Kuliah</p>
                <p className="font-bold text-gray-900">{detailPresensi.matkul}</p>
                <p className="text-xs text-gray-500">{detailPresensi.kode_mk}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Minggu & Tanggal</p>
                <p className="font-bold text-gray-900">Minggu {detailPresensi.minggu}</p>
                <p className="text-xs text-gray-500">
                  {new Date(detailPresensi.tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Waktu Presensi:</span> {detailPresensi.waktu_mulai || "00:00"} - {detailPresensi.waktu_selesai || "00:00"}
              </p>
              <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${
                detailPresensi.is_aktif
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {detailPresensi.is_aktif ? '● Aktif' : '○ Tidak Aktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Statistik Ringkasan */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{totalMahasiswa}</p>
            <p className="text-sm text-gray-600 mt-1">Total</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{hadir}</p>
            <p className="text-sm text-gray-600 mt-1">Hadir</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{belumAbsen}</p>
            <p className="text-sm text-gray-600 mt-1">Belum Absen</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{alpa}</p>
            <p className="text-sm text-gray-600 mt-1">Alpa</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-indigo-600">{persentaseKehadiran}%</p>
            <p className="text-sm text-gray-600 mt-1">Kehadiran</p>
          </div>
        </div>

        {/* Tabel Daftar Absen */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">No</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">NIM</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nama Mahasiswa</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Waktu Absen</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Verifikasi Foto</th>
                  {isAdminOrSuperAdmin && (
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {daftarAbsen.map((mahasiswa, index) => (
                  <tr key={mahasiswa.id_presensi} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mahasiswa.nim}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {mahasiswa.nama_mahasiswa}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(mahasiswa.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mahasiswa.waktu_input ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {new Date(mahasiswa.waktu_input).toLocaleTimeString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mahasiswa.status === 'Hadir' ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 w-fit">
                          ✓ Terverifikasi
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 w-fit">
                          ✗ Tidak ada
                        </span>
                      )}
                    </td>
                    {isAdminOrSuperAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleEditStatus(mahasiswa)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 mx-auto"
                          title="Edit Status"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress Bar Kehadiran */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Progress Kehadiran</h3>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div className="flex h-full">
              <div
                className="bg-green-600 flex items-center justify-center text-white text-xs font-bold"
                style={{ width: `${(hadir / totalMahasiswa) * 100}%` }}
              >
                {hadir > 0 && `${hadir}`}
              </div>
              <div
                className="bg-yellow-500 flex items-center justify-center text-white text-xs font-bold"
                style={{ width: `${(belumAbsen / totalMahasiswa) * 100}%` }}
              >
                {belumAbsen > 0 && `${belumAbsen}`}
              </div>
              <div
                className="bg-red-600 flex items-center justify-center text-white text-xs font-bold"
                style={{ width: `${(alpa / totalMahasiswa) * 100}%` }}
              >
                {alpa > 0 && `${alpa}`}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded"></div>
              <span className="text-gray-600">Hadir ({hadir})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span className="text-gray-600">Belum Absen ({belumAbsen})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded"></div>
              <span className="text-gray-600">Alpa ({alpa})</span>
            </div>
          </div>
        </div>

      </div>

      {/* Edit Status Modal */}
      {showEditModal && editingPresensi && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }} className="w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 transform animate-scaleIn shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-600" />
                Edit Status Presensi
              </h2>
              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info Mahasiswa */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">NIM:</span>
                  <span className="font-bold text-gray-900">{editingPresensi.nim}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Nama:</span>
                  <span className="font-bold text-gray-900">{editingPresensi.nama_mahasiswa}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Status Saat Ini:</span>
                  {getStatusBadge(editingPresensi.status)}
                </div>
              </div>
            </div>

            {/* Form Edit */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status Baru <span className="text-red-500">*</span>
              </label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Hadir">Hadir</option>
                <option value="Belum Absen">Belum Absen</option>
                <option value="Alfa">Alfa</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelEdit}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Batal
              </button>
              <button
                onClick={handleSaveEditStatus}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS Animations if not already present */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </DashboardLayout>
  );
}
