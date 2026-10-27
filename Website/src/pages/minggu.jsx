import Swal from "sweetalert2";
// src/pages/viewMinggu.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Calendar, ArrowLeft, Plus, FileText, AlertCircle, BookOpen,
  Edit2, Trash2, X, Upload, CheckCircle, ChevronDown, ChevronUp, ExternalLink,
  BarChart3, Users, TrendingUp, Clock, Eye, Award
} from "lucide-react";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import { apiGet, apiUpload, apiDelete } from "../utils/apiUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function ViewMinggu() {
  const [activeNav, setActiveNav] = useState("materi");
  const [mingguList, setMingguList] = useState([]);
  const [mataKuliahInfo, setMataKuliahInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedMinggu, setSelectedMinggu] = useState(null);
  const [selectedMateri, setSelectedMateri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [expandedMinggu, setExpandedMinggu] = useState(new Set());
  const [showSkorModal, setShowSkorModal] = useState(false);
  const [skorData, setSkorData] = useState(null);
  const [loadingSkor, setLoadingSkor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { kodeMk } = useParams();
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    judul: "",
    deskripsi: "",
    file_pdf: null,
  });

  useEffect(() => {
    fetchMateri();
  }, [kodeMk]);

  const fetchMateri = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const materiData = await apiGet(`/materi/${kodeMk}`);
      
      // Buat array minggu 1-16 dengan support multiple materials
      const mingguArray = Array.from({ length: 16 }, (_, i) => {
        const minggu = i + 1;
        const materiList = materiData.filter(m => m.minggu === minggu);
        
        return {
          minggu,
          hasMateri: materiList.length > 0,
          materiCount: materiList.length,
          materiList: materiList
        };
      });
      
      setMingguList(mingguArray);
      
      // Set info mata kuliah
      if (materiData.length > 0) {
        setMataKuliahInfo({
          kode_mk: kodeMk,
          nama_mk: "Loading..."
        });
      } else {
        setMataKuliahInfo({
          kode_mk: kodeMk,
          nama_mk: "Mata Kuliah"
        });
      }
      
    } catch (error) {
      console.error("Error fetching materi:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle expand minggu
  const toggleExpandMinggu = (minggu) => {
    setExpandedMinggu(prev => {
      const newSet = new Set(prev);
      if (newSet.has(minggu)) {
        newSet.delete(minggu);
      } else {
        newSet.add(minggu);
      }
      return newSet;
    });
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

  // Open PDF in new tab
  const handleViewPDF = (materiId) => {
    window.open(`${API_BASE_URL}/materi/view/${materiId}`, '_blank');
  };

  // Open modal
  const handleOpenModal = (mode, mingguNumber, materiData = null) => {
    setModalMode(mode);
    setSelectedMinggu(mingguNumber);
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
    setSelectedMinggu(null);
    setSelectedMateri(null);
    setFormData({ judul: "", deskripsi: "", file_pdf: null });
  };

  // Handle input change
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
      if (file.size > 10 * 1024 * 1024) {
        showNotification('error', 'Ukuran file maksimal 10MB');
        e.target.value = null;
        return;
      }
      setFormData((prev) => ({ ...prev, file_pdf: file }));
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.judul.trim()) {
      showNotification('error', 'Judul materi harus diisi');
      return;
    }

    // Validasi file PDF untuk mode add
    if (modalMode === "add" && !formData.file_pdf) {
      showNotification('error', 'File PDF harus diupload untuk materi baru');
      return;
    }

    try {
      setSaving(true);
      const formDataToSend = new FormData();

      if (modalMode === "add") {
        formDataToSend.append("kode_mk", kodeMk);
        formDataToSend.append("minggu", parseInt(selectedMinggu));
        formDataToSend.append("judul", formData.judul.trim());
        formDataToSend.append("deskripsi", formData.deskripsi?.trim() || "");
        
        if (formData.file_pdf) {
          formDataToSend.append("file_pdf", formData.file_pdf);
        }

        await apiUpload("/materi/", formDataToSend, "POST");
        showNotification('success', 'Materi berhasil ditambahkan!');
        
        // Auto expand minggu yang baru ditambah
        setExpandedMinggu(prev => new Set([...prev, selectedMinggu]));
      } else {
        if (formData.judul) formDataToSend.append("judul", formData.judul.trim());
        if (formData.deskripsi) formDataToSend.append("deskripsi", formData.deskripsi.trim());
        formDataToSend.append("minggu", parseInt(selectedMinggu));
        
        if (formData.file_pdf) {
          formDataToSend.append("file_pdf", formData.file_pdf);
        }

        await apiUpload(`/materi/${selectedMateri.id_materi}`, formDataToSend, "PUT");
        showNotification('success', 'Materi berhasil diupdate!');
      }

      fetchMateri();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving materi:", error);
      showNotification('error', error.message || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  };

  // Delete materi
  const handleDeleteClick = (materiData) => {
    setDeleteTarget(materiData);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await apiDelete(`/materi/${deleteTarget.id_materi}`);
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

  if (loading) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 mb-1">Error Loading Data</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <div className="flex gap-2 mt-3">
              <button 
                onClick={fetchMateri}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition"
              >
                Coba Lagi
              </button>
              <button 
                onClick={() => navigate(-1)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm transition"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalMateri = mingguList.reduce((sum, m) => sum + m.materiCount, 0);
  const mingguWithMateri = mingguList.filter(m => m.hasMateri).length;
  const percentage = Math.round((mingguWithMateri / 16) * 100);

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            notification.type === 'success' 
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Calendar className="text-blue-600" /> Kelola Materi per Minggu
            </h1>
            {mataKuliahInfo && (
              <div className="mt-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gray-500" />
                <p className="text-gray-600 text-sm">
                  <span className="font-semibold">Loading...</span>
                  <span className="text-gray-400 ml-2">({mataKuliahInfo.kode_mk})</span>
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
        </div>

        {/* Status Summary - DIPINDAH KE ATAS */}
        <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-blue-50 rounded-xl border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{totalMateri}</div>
              <p className="text-sm text-gray-600">Total Materi</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{mingguWithMateri}</div>
              <p className="text-sm text-gray-600">Minggu Terisi</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{percentage}%</div>
              <p className="text-sm text-gray-600">Kelengkapan</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${percentage}%` }}
            >
              {percentage > 10 && (
                <span className="text-xs font-bold text-white">{percentage}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Info Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 <span className="font-semibold">Tips:</span> Klik judul materi untuk membuka PDF di tab baru. 
            Setiap minggu dapat memiliki{" "}
            <span className="font-semibold text-purple-700">lebih dari 1 materi</span>.
          </p>
        </div>

        {/* Grid Minggu */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mingguList.map((item) => (
            <div
              key={item.minggu}
              className={`
                border-2 rounded-xl transition-all
                ${item.hasMateri 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-400'
                }
              `}
            >
              {/* Header Minggu */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${
                      item.hasMateri ? 'text-green-700' : 'text-gray-600'
                    }`}>
                      {item.minggu}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Minggu</p>
                      {item.hasMateri && (
                        <p className="text-xs font-semibold text-green-600">
                          {item.materiCount} Materi
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {item.hasMateri ? (
                    <button
                      onClick={() => toggleExpandMinggu(item.minggu)}
                      className="text-green-600 hover:text-green-700 transition"
                    >
                      {expandedMinggu.has(item.minggu) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  ) : (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                      Kosong
                    </span>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="p-4">
                {/* List Materi (when expanded) */}
                {item.hasMateri && expandedMinggu.has(item.minggu) && (
                  <div className="space-y-2 mb-3">
                    {item.materiList.map((materi, idx) => (
                      <div 
                        key={materi.id_materi}
                        className="bg-white border border-green-200 rounded-lg p-3 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-3 w-3 text-green-600 flex-shrink-0" />
                              {/* Clickable title untuk membuka PDF */}
                              <button
                                onClick={() => handleViewPDF(materi.id_materi)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left truncate flex items-center gap-1 group"
                                title={`Klik untuk membuka: ${materi.judul}`}
                              >
                                <span className="truncate">{materi.judul}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </div>
                            {materi.deskripsi && (
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {materi.deskripsi}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-1 mb-2">
                          <button
                            onClick={() => handleOpenModal("edit", item.minggu, materi)}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 transition"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(materi)}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                            Hapus
                          </button>
                        </div>
                        
                        {/* Button Lihat Skor */}
                        <button
                          onClick={() => handleLihatSkor(materi)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 transition"
                        >
                          <BarChart3 className="h-3 w-3" />
                          Lihat Skor Mahasiswa
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Collapsed view - show count */}
                {item.hasMateri && !expandedMinggu.has(item.minggu) && (
                  <div className="text-center py-2">
                    <p className="text-sm text-green-700 font-medium">
                      Klik ↓ untuk melihat {item.materiCount} materi
                    </p>
                  </div>
                )}

                {/* Add Button - Always visible */}
                <button
                  onClick={() => handleOpenModal("add", item.minggu)}
                  className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition font-medium ${
                    item.hasMateri
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  {item.hasMateri ? 'Tambah Materi Lagi' : 'Tambah Materi'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0}} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {modalMode === "add" ? "Tambah Materi" : "Edit Materi"}
                <span className="text-blue-600"> - Minggu {selectedMinggu}</span>
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
                  File PDF {modalMode === "edit" && "(Opsional)"}
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
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0}} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm overflow-y-auto">
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
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${
                                  skor.skor_perhatian >= 80 ? 'bg-green-100 text-green-700' :
                                  skor.skor_perhatian >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {skor.skor_perhatian}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-700">{formatWaktu(skor.waktu_belajar)}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-700">{formatWaktu(skor.waktu_fokus)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                                  skor.jumlah_gangguan === 0 ? 'bg-green-100 text-green-700' :
                                  skor.jumlah_gangguan <= 3 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {skor.jumlah_gangguan}x
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                  skor.tracking_mode === 'camera' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
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
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0}} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm">
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