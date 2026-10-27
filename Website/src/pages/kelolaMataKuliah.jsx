import Swal from "sweetalert2";
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect, useRef } from "react";
import { navigationItems } from "../navigation/navigation";
import { BookOpen, Plus, Edit, Trash2, X, AlertCircle, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { getMataKuliahList, createMataKuliah, updateMataKuliah, deleteMataKuliah } from "../utils/apiUtils";
import { getUser } from "../utils/auth";

export default function KelolaMataKuliah() {
  const [activeNav, setActiveNav] = useState("kelola-mata-kuliah");
  const [mataKuliahList, setMataKuliahList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMK, setSelectedMK] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // DB Schema: id_matakuliah, kode_matakuliah, nama_matakuliah, sks
  const [formData, setFormData] = useState({
    kode_matakuliah: '',
    nama_matakuliah: '',
    sks: 3,
  });

  const currentUser = getUser() || {};
  const isAdmin = currentUser.role === 'admin';

  const fetchMataKuliah = async () => {
    try {
      setLoading(true);
      const data = await getMataKuliahList();
      setMataKuliahList(data || []);
    } catch (error) {
      console.error("Error fetching mata kuliah:", error);
      showNotification('error', 'Gagal memuat data mata kuliah');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  useEffect(() => {
    fetchMataKuliah();
  }, []);

  const handleOpenModal = (mk = null) => {
    if (mk) {
      setIsEditMode(true);
      setSelectedMK(mk);
      setFormData({
        kode_matakuliah: mk.kode_matakuliah,
        nama_matakuliah: mk.nama_matakuliah,
        sks: mk.sks || 3,
      });
    } else {
      setIsEditMode(false);
      setSelectedMK(null);
      setFormData({ kode_matakuliah: '', nama_matakuliah: '', sks: 3 });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setSelectedMK(null);
    setFormData({ kode_matakuliah: '', nama_matakuliah: '', sks: 3 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.kode_matakuliah.trim() || !formData.nama_matakuliah.trim()) {
      showNotification('error', 'Kode MK dan Nama MK harus diisi');
      return;
    }

    try {
      const payload = {
        kode_matakuliah: formData.kode_matakuliah.trim(),
        nama_matakuliah: formData.nama_matakuliah.trim(),
        sks: parseInt(formData.sks) || 3,
      };

      if (isEditMode) {
        await updateMataKuliah(selectedMK.id_matakuliah, payload);
        showNotification('success', 'Mata kuliah berhasil diperbarui');
      } else {
        await createMataKuliah(payload);
        showNotification('success', 'Mata kuliah berhasil ditambahkan');
      }

      handleCloseModal();
      fetchMataKuliah();
    } catch (error) {
      console.error("Error saving mata kuliah:", error);
      showNotification('error', error.message || 'Gagal menyimpan mata kuliah');
    }
  };

  const handleDeleteClick = (mk) => {
    setDeleteTarget(mk);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMataKuliah(deleteTarget.id_matakuliah);
      showNotification('success', 'Mata kuliah berhasil dihapus');
      fetchMataKuliah();
    } catch (error) {
      console.error("Error deleting mata kuliah:", error);
      showNotification('error', error.message || 'Gagal menghapus mata kuliah');
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const handleDownloadTemplate = () => {
    // Buat data contoh (header + 1 baris contoh)
    const templateData = [
      ["Kode MK", "Nama MK", "SKS"],
      ["TIF001", "Algoritma Pemrograman", 3],
      ["TIF002", "Basis Data", 3]
    ];
    
    // Buat worksheet dan workbook
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Mata Kuliah");
    
    // Download file
    XLSX.writeFile(wb, "Template_Upload_Mata_Kuliah.xlsx");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length <= 1) {
        showNotification('error', 'File tidak berisi data atau format salah');
        return;
      }

      // Skip header (row 0), format: [Kode MK, Nama MK, SKS]
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 2) continue; // Skip empty/invalid rows

        const kode = row[0]?.toString().trim();
        const nama = row[1]?.toString().trim();
        const sks = parseInt(row[2]) || 3;

        if (!kode || !nama) continue;

        try {
          // Add one by one
          await createMataKuliah({
            kode_matakuliah: kode,
            nama_matakuliah: nama,
            sks: sks,
          });
          successCount++;
        } catch (err) {
          console.error(`Gagal upload baris ${i + 1}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        showNotification('success', `Berhasil mengupload ${successCount} mata kuliah. ${errorCount > 0 ? `(Gagal: ${errorCount})` : ''}`);
        fetchMataKuliah();
      } else {
        showNotification('error', 'Gagal mengupload semua data. Pastikan format benar dan kode belum terdaftar.');
      }
    } catch (error) {
      console.error("Upload error:", error);
      showNotification('error', 'Terjadi kesalahan saat memproses file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading && mataKuliahList.length === 0) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Memuat data mata kuliah...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {notification.type === 'success' ? '✓' : '✕'} {notification.message}
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpen className="text-blue-600" /> Kelola Mata Kuliah
          </h1>
          {isAdmin && (
            <div className="flex gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                className="hidden" 
              />
              <button
                onClick={handleDownloadTemplate}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
                title="Download format Excel untuk upload"
              >
                <Download className="h-5 w-5" /> Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
              >
                <Upload className="h-5 w-5" /> {isUploading ? 'Memproses...' : 'Upload'}
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus className="h-5 w-5" /> Tambah Mata Kuliah
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">Kode MK</th>
                <th className="text-left py-3 px-4 font-semibold">Nama Mata Kuliah</th>
                <th className="text-center py-3 px-4 font-semibold">SKS</th>
                {isAdmin && (
                  <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {mataKuliahList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? "4" : "3"} className="text-center py-12 text-gray-500">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>Belum ada data mata kuliah</p>
                  </td>
                </tr>
              ) : (
                mataKuliahList.map((mk, index) => (
                  <tr
                    key={mk.id_matakuliah}
                    className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <td className="py-3 px-4 font-mono text-sm font-semibold">{mk.kode_matakuliah}</td>
                    <td className="py-3 px-4 font-medium">{mk.nama_matakuliah}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {mk.sks} SKS
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleOpenModal(mk)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                            title="Edit Mata Kuliah"
                          >
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(mk)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
                            title="Hapus Mata Kuliah"
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {isEditMode ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Kode MK */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kode Mata Kuliah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.kode_matakuliah}
                    onChange={(e) => setFormData({ ...formData, kode_matakuliah: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Contoh: TIF001"
                    disabled={isEditMode}
                    required
                    maxLength={20}
                  />
                  {isEditMode && (
                    <p className="text-xs text-gray-400 mt-1">Kode MK tidak dapat diubah</p>
                  )}
                </div>

                {/* Nama MK */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Mata Kuliah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nama_matakuliah}
                    onChange={(e) => setFormData({ ...formData, nama_matakuliah: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Contoh: Basis Data"
                    required
                    maxLength={100}
                  />
                </div>

                {/* SKS */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKS <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.sks}
                    onChange={(e) => setFormData({ ...formData, sks: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="1-6"
                    min="1"
                    max="6"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition font-medium"
                >
                  {isEditMode ? 'Perbarui' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-3 rounded-lg transition font-medium"
                >
                  Batal
                </button>
              </div>
            </form>
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
              Apakah Anda yakin ingin menghapus mata kuliah <span className="font-semibold text-gray-900">"{deleteTarget?.nama_matakuliah}"</span>?
              <br />
              <span className="text-sm text-red-600 mt-2 block">Tindakan ini tidak dapat dibatalkan.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
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
