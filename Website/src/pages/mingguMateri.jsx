import Swal from "sweetalert2";
// src/pages/mingguMateri.jsx
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Edit2, Trash2, FileText, Calendar,
  X, Upload, CheckCircle, AlertCircle, BarChart3, Users,
  TrendingUp, Clock, Eye, Award
} from "lucide-react";
import axios from "axios";
import { apiGet } from "../utils/apiUtils";
import { getToken } from "../utils/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function MingguMateri() {
  const [activeNav, setActiveNav] = useState("materi");
  const { id_kelas_mk, minggu } = useParams();
  const navigate = useNavigate();

  // State Management
  const [kelasMKInfo, setKelasMKInfo] = useState(null);
  const [materiList, setMateriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
  const [selectedMateri, setSelectedMateri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [showSkorModal, setShowSkorModal] = useState(false);
  const [skorData, setSkorData] = useState(null);
  const [loadingSkor, setLoadingSkor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    judul: "",
    deskripsi: "",
    file_pdf: null,
  });

  useEffect(() => {
    const loadData = async () => {
      await fetchKelasMKInfo();
    };
    loadData();
  }, [id_kelas_mk]);



  useEffect(() => {
    if (kelasMKInfo) {
      fetchMateri();
    }
  }, [kelasMKInfo, minggu]);

  // Fetch kelas mata kuliah info
  const fetchKelasMKInfo = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/kelas-mata-kuliah/${id_kelas_mk}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setKelasMKInfo(response.data);
    } catch (error) {
      console.error("Error fetching kelas MK info:", error);
    }
  };

  // Fetch materi for this week
  const fetchMateri = async () => {
    try {
      setLoading(true);
      const token = getToken();

      // Get kode_mk and id_kelas from kelasMKInfo first
      if (!kelasMKInfo) return;

      const { kode_mk, id_kelas } = kelasMKInfo;
      const response = await axios.get(`${API_BASE_URL}/materi?kode_mk=${kode_mk}&id_kelas=${id_kelas}&minggu=${minggu}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMateriList(response.data);
    } catch (error) {
      console.error("Error fetching materi:", error);
      showNotification('error', 'Gagal memuat data materi');
      setMateriList([]);
    } finally {
      setLoading(false);
    }
  };

  // Show notification
  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  // Open modal for add/edit
  const handleOpenModal = (mode, materiData = null) => {
    setModalMode(mode);
    setSelectedMateri(materiData);

    if (mode === "edit" && materiData) {
      setFormData({
        judul: materiData.judul || "",
        deskripsi: materiData.deskripsi || "",
        file_pdf: null,
      });
    } else {
      setFormData({
        judul: "",
        deskripsi: "",
        file_pdf: null,
      });
    }
    setShowModal(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedMateri(null);
    setFormData({ judul: "", deskripsi: "", file_pdf: null });
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.includes('pdf')) {
        showNotification('error', 'File harus berformat PDF');
        e.target.value = null;
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showNotification('error', 'Ukuran file maksimal 10MB');
        e.target.value = null;
        return;
      }
      setFormData((prev) => ({ ...prev, file_pdf: file }));
    }
  };

  // Submit form (add or edit)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.judul.trim()) {
      showNotification('error', 'Judul materi harus diisi');
      return;
    }

    try {
      setSaving(true);
      const token = getToken();
      const formDataToSend = new FormData();

      if (modalMode === "add") {
        const { kode_mk, id_kelas, id_dosen } = kelasMKInfo;

        formDataToSend.append("kode_mk", kode_mk);
        formDataToSend.append("id_kelas", id_kelas);
        formDataToSend.append("minggu", minggu); // Use minggu from URL params
        formDataToSend.append("judul", formData.judul);
        formDataToSend.append("deskripsi", formData.deskripsi || "");
        formDataToSend.append("uploaded_by", id_dosen); // Track who uploaded

        if (formData.file_pdf) {
          formDataToSend.append("file_pdf", formData.file_pdf);
        }

        await axios.post(`${API_BASE_URL}/materi/`, formDataToSend, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        showNotification('success', 'Materi berhasil ditambahkan!');
      } else {
        // Edit mode
        if (formData.judul) formDataToSend.append("judul", formData.judul);
        if (formData.deskripsi) formDataToSend.append("deskripsi", formData.deskripsi);
        formDataToSend.append("minggu", minggu); // Use minggu from URL params

        if (formData.file_pdf) {
          formDataToSend.append("file_pdf", formData.file_pdf);
        }

        await axios.put(
          `${API_BASE_URL}/materi/${selectedMateri.id_materi}`,
          formDataToSend,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        showNotification('success', 'Materi berhasil diupdate!');
      }

      fetchMateri();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving materi:", error);
      const errorMsg = error.response?.data?.detail || 'Gagal menyimpan materi';
      showNotification('error', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Fetch skor materi
  const handleLihatSkor = async (materiData) => {
    setLoadingSkor(true);
    setShowSkorModal(true);
    setSkorData(null);

    try {
      const data = await apiGet(`/skor-materi/statistik/${materiData.id_materi}`);
      setSkorData(data);
    } catch (error) {
      console.error("Error fetching skor:", error);
      showNotification('error', 'Gagal mengambil data skor');
      setShowSkorModal(false);
    } finally {
      setLoadingSkor(false);
    }
  };

  // Format waktu (detik ke menit:detik)
  const formatWaktu = (detik) => {
    if (!detik) return '0:00';
    const menit = Math.floor(detik / 60);
    const sisaDetik = detik % 60;
    return `${menit}:${sisaDetik.toString().padStart(2, '0')}`;
  };

  // Delete materi
  const handleDeleteClick = (materiData) => {
    setDeleteTarget(materiData);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const token = getToken();
      await axios.delete(`${API_BASE_URL}/materi/${deleteTarget.id_materi}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showNotification('success', 'Materi berhasil dihapus!');
      fetchMateri();
    } catch (error) {
      console.error("Error deleting materi:", error);
      showNotification('error', 'Gagal menghapus materi');
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  if (loading && materiList.length === 0) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${notification.type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
            }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Calendar className="text-blue-600" />
              Materi Minggu {minggu}
            </h1>
            {kelasMKInfo && (
              <p className="text-gray-500 text-sm mt-1">
                {kelasMKInfo.nama_mk} ({kelasMKInfo.kode_mk}) • {kelasMKInfo.nama_kelas}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate(`/materi/kelas-mk/${id_kelas_mk}`)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
        </div>

        {/* Materi List untuk minggu ini */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Daftar Materi</h2>
          <button
            onClick={() => handleOpenModal("add")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-medium"
          >
            <Plus className="h-5 w-5" /> Tambah Materi
          </button>
        </div>

        {materiList.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada materi untuk minggu ini</p>
            <button
              onClick={() => handleOpenModal("add")}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition font-medium"
            >
              <Plus className="h-5 w-5" /> Tambah Materi Pertama
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {materiList.map((materiData) => (
              <div
                key={materiData.id_materi}
                className="border rounded-xl p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-800">
                    {materiData.judul}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {materiData.deskripsi || "Tidak ada deskripsi"}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    {materiData.nama_dosen && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Diupload oleh:</span>
                        <span className="text-blue-600">{materiData.nama_dosen}</span>
                      </div>
                    )}
                    <div>
                      Tanggal: {new Date(materiData.tanggal_upload).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  {materiData.file_pdf && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{materiData.file_pdf}</span>
                    </div>
                  )}
                  <div className="space-y-2 pt-3 border-t border-blue-200">
                    {materiData.file_pdf && (
                      <button
                        onClick={() => window.open(`${API_BASE_URL}/materi/view/${materiData.id_materi}`, '_blank')}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition font-medium"
                      >
                        <FileText className="h-4 w-4" /> Lihat PDF
                      </button>
                    )}
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => handleOpenModal("edit", materiData)}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition font-medium"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(materiData)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition font-medium"
                      >
                        <Trash2 className="h-4 w-4" /> Hapus
                      </button>
                    </div>
                    {/* Button Lihat Skor */}
                    <button
                      onClick={() => handleLihatSkor(materiData)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition font-medium"
                    >
                      <BarChart3 className="h-4 w-4" /> Lihat Skor Mahasiswa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {modalMode === "add" ? "Tambah Materi" : "Edit Materi"}
                <span className="text-blue-600"> - Minggu {minggu}</span>
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Judul Materi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="judul"
                  value={formData.judul}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Contoh: Pengenalan HTML & CSS"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  name="deskripsi"
                  value={formData.deskripsi}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  rows="3"
                  placeholder="Deskripsi singkat tentang materi ini..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  File PDF {modalMode === "edit" && "(Opsional - biarkan kosong jika tidak ingin mengubah)"}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Upload className="h-3 w-3" />
                    Maksimal 10MB, format PDF
                  </p>
                  {formData.file_pdf && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ✓ {formData.file_pdf.name} dipilih
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-semibold transition"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Menyimpan...
                    </>
                  ) : (
                    modalMode === "add" ? "Tambah Materi" : "Update Materi"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Skor Materi */}
      {showSkorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-5xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="text-purple-600" />
                Statistik Skor Materi
              </h3>
              <button
                onClick={() => setShowSkorModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingSkor ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="ml-4 text-gray-600">Memuat data skor...</p>
              </div>
            ) : skorData ? (
              <div>
                {/* Info Materi */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-50 rounded-xl p-6 mb-6 border border-purple-200">
                  <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    {skorData.judul_materi}
                  </h4>
                </div>

                {/* Statistik Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-700">{skorData.total_mahasiswa_kelas}</div>
                    <p className="text-xs text-gray-600">Total Mahasiswa</p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-700">{skorData.total_sudah_baca}</div>
                    <p className="text-xs text-gray-600">Sudah Membaca</p>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-700">{skorData.total_belum_baca}</div>
                    <p className="text-xs text-gray-600">Belum Membaca</p>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center justify-between mb-2">
                      <Award className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-700">
                      {skorData.rata_rata_skor ? skorData.rata_rata_skor.toFixed(1) : '-'}
                    </div>
                    <p className="text-xs text-gray-600">Rata-rata Skor</p>
                  </div>

                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-amber-700">
                      {skorData.rata_rata_waktu_belajar ? formatWaktu(Math.round(skorData.rata_rata_waktu_belajar)) : '-'}
                    </div>
                    <p className="text-xs text-gray-600">Rata-rata Waktu</p>
                  </div>
                </div>

                {/* Tabel Mahasiswa */}
                {skorData.daftar_skor && skorData.daftar_skor.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-600 px-4 py-3">
                      <h5 className="text-white font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Detail Skor Mahasiswa ({skorData.daftar_skor.length})
                      </h5>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">NIM</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Mahasiswa</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Skor</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Waktu Belajar</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Waktu Fokus</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Gangguan</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Mode</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {skorData.daftar_skor.map((skor, index) => (
                            <tr key={skor.id_skor} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-sm text-gray-700">{index + 1}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-mono">{skor.nim}</td>
                              <td className="px-4 py-3 text-sm text-gray-800 font-medium">{skor.nama_mahasiswa}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${skor.skor_perhatian >= 80 ? 'bg-green-100 text-green-700' :
                                  skor.skor_perhatian >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                  {skor.skor_perhatian}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-700">{formatWaktu(skor.waktu_belajar)}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-700">{formatWaktu(skor.waktu_fokus)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${skor.jumlah_gangguan === 0 ? 'bg-green-100 text-green-700' :
                                  skor.jumlah_gangguan <= 3 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                  {skor.jumlah_gangguan}x
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${skor.tracking_mode === 'camera' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                  {skor.tracking_mode === 'camera' ? <Eye className="h-3 w-3" /> : null}
                                  {skor.tracking_mode}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Belum ada mahasiswa yang membaca materi ini</p>
                    <p className="text-sm text-gray-500 mt-1">Data skor akan muncul setelah mahasiswa membaca materi melalui aplikasi mobile</p>
                  </div>
                )}

                {/* Keterangan */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Keterangan:</strong> Skor perhatian dihitung berdasarkan waktu fokus, waktu belajar, dan jumlah gangguan saat mahasiswa membaca materi melalui aplikasi mobile dengan eye-tracking.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Tidak ada data
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus materi <span className="font-semibold text-gray-900">"{deleteTarget?.judul}"</span>?
              <br />
              <span className="text-sm text-red-600 mt-2 block">Tindakan ini tidak dapat dibatalkan.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}