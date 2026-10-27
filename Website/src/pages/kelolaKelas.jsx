import Swal from "sweetalert2";
// src/pages/kelolaKelas.jsx
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { School, AlertCircle, Trash2, Edit, Plus, X } from "lucide-react";
import {
  getKelasList, createKelas, updateKelas, deleteKelas,
  getProdiList, getAngkatanList, getGolonganList,
} from "../utils/apiUtils";
import { getUser } from "../utils/auth";

export default function KelolaKelas() {
  const [activeNav, setActiveNav] = useState("kelola-kelas");
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Master data for dropdowns
  const [prodiList, setProdiList] = useState([]);
  const [angkatanList, setAngkatanList] = useState([]);
  const [golonganList, setGolonganList] = useState([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [selectedKelas, setSelectedKelas] = useState(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form
  const [formData, setFormData] = useState({
    id_prodi: '',
    nama_kelas: '',
    golongan: '',
    angkatan: '',
    tahun_ajaran: '',
    keterangan: '',
  });

  const currentUser = getUser() || {};
  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [kelas, prodi, angkatan, golongan] = await Promise.all([
        getKelasList(),
        getProdiList(),
        getAngkatanList(),
        getGolonganList(),
      ]);
      setKelasList(kelas || []);
      setProdiList(prodi || []);
      setAngkatanList(angkatan || []);
      setGolonganList(golongan || []);
    } catch (error) {
      showNotification('error', 'Gagal memuat data kelas');
    } finally {
      setLoading(false);
    }
  };

  const fetchKelas = async () => {
    try {
      setLoading(true);
      const data = await getKelasList();
      setKelasList(data || []);
    } catch (error) {
      showNotification('error', 'Gagal memuat data kelas');
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

  // ===== FORM HANDLERS =====
  const resetForm = () => {
    setFormData({
      id_prodi: '',
      nama_kelas: '',
      golongan: '',
      angkatan: '',
      tahun_ajaran: '',
      keterangan: '',
    });
  };

  const openAddModal = () => {
    setFormMode("add");
    setSelectedKelas(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setFormMode("edit");
    setSelectedKelas(item);
    setFormData({
      id_prodi: item.id_prodi || '',
      nama_kelas: item.nama_kelas || '',
      golongan: item.golongan || '',
      angkatan: item.angkatan || '',
      tahun_ajaran: item.tahun_ajaran || '',
      keterangan: item.keterangan || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedKelas(null);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.id_prodi) {
      showNotification('error', 'Program Studi wajib dipilih');
      return;
    }
    if (!formData.nama_kelas.trim()) {
      showNotification('error', 'Nama Kelas wajib diisi');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        id_prodi: parseInt(formData.id_prodi),
        nama_kelas: formData.nama_kelas.trim(),
        golongan: formData.golongan || null,
        angkatan: formData.angkatan ? parseInt(formData.angkatan) : null,
        tahun_ajaran: formData.tahun_ajaran || null,
        keterangan: formData.keterangan || null,
      };

      if (formMode === "add") {
        await createKelas(payload);
        showNotification('success', 'Kelas berhasil ditambahkan');
      } else {
        await updateKelas(selectedKelas.id, payload);
        showNotification('success', 'Kelas berhasil diperbarui');
      }

      handleCloseModal();
      fetchKelas();
    } catch (error) {
      showNotification('error', error.message || 'Gagal menyimpan kelas');
    } finally {
      setLoading(false);
    }
  };

  // ===== DELETE =====
  const handleDeleteClick = (item) => {
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      await deleteKelas(deleteTarget.id);
      showNotification('success', 'Kelas berhasil dihapus');
      fetchKelas();
    } catch (error) {
      showNotification('error', error.message || 'Gagal menghapus kelas');
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setLoading(false);
    }
  };

  // Helper: get prodi name by id
  const getProdiName = (idProdi) => {
    const prodi = prodiList.find(p => p.id_prodi === idProdi);
    return prodi ? `${prodi.kode_prodi} - ${prodi.nama_prodi}` : '-';
  };

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

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-8 mb-8 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-xl">
              <School className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Kelola Kelas</h1>
              <p className="text-blue-100 text-sm">
                Buat dan kelola kelas dari data master (Prodi, Angkatan, Golongan)
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-lg font-medium transition shadow-md"
            >
              <Plus className="h-5 w-5" /> Tambah Kelas
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <School className="text-blue-600 h-5 w-5" /> Daftar Kelas
          </h2>
          <span className="text-sm text-gray-500">{kelasList.length} kelas terdaftar</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">No</th>
                <th className="text-left py-3 px-4 font-semibold">Nama Kelas</th>
                <th className="text-left py-3 px-4 font-semibold">Program Studi</th>
                <th className="text-center py-3 px-4 font-semibold">Golongan</th>
                <th className="text-center py-3 px-4 font-semibold">Angkatan</th>
                <th className="text-center py-3 px-4 font-semibold">Tahun Ajaran</th>
                <th className="text-left py-3 px-4 font-semibold">Keterangan</th>
                {isAdmin && <th className="text-center py-3 px-4 font-semibold">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading && kelasList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? "8" : "7"} className="text-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">Memuat data...</p>
                  </td>
                </tr>
              ) : kelasList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? "8" : "7"} className="text-center py-12 text-gray-500">
                    <School className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>Belum ada data kelas</p>
                    <p className="text-sm text-gray-400 mt-1">Klik "Tambah Kelas" untuk membuat kelas baru</p>
                  </td>
                </tr>
              ) : (
                kelasList.map((kelas, index) => (
                  <tr key={kelas.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="py-3 px-4 text-sm">{index + 1}</td>
                    <td className="py-3 px-4 font-medium">{kelas.nama_kelas || '-'}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                        {getProdiName(kelas.id_prodi)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                        {kelas.golongan || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        {kelas.angkatan || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm">{kelas.tahun_ajaran || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{kelas.keterangan || '-'}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(kelas)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                            title="Edit Kelas"
                          >
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(kelas)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm"
                            title="Hapus Kelas"
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

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <School className="h-5 w-5" />
                {formMode === "add" ? "Tambah Kelas Baru" : "Edit Kelas"}
              </h2>
              <button onClick={handleCloseModal} className="text-white hover:bg-white/20 rounded-lg p-1 transition">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Prodi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program Studi <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.id_prodi}
                  onChange={(e) => setFormData({ ...formData, id_prodi: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Program Studi --</option>
                  {prodiList.map(p => (
                    <option key={p.id_prodi} value={p.id_prodi}>
                      [{p.kode_prodi}] {p.nama_prodi} {p.jenjang ? `(${p.jenjang})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nama Kelas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Kelas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nama_kelas}
                  onChange={(e) => setFormData({ ...formData, nama_kelas: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Contoh: TIF-2024-A"
                  required
                />
              </div>

              {/* Golongan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Golongan</label>
                <select
                  value={formData.golongan}
                  onChange={(e) => setFormData({ ...formData, golongan: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Pilih Golongan (Opsional) --</option>
                  {golonganList.map(g => (
                    <option key={g.id_golongan} value={g.nama_golongan}>
                      {g.nama_golongan}
                    </option>
                  ))}
                </select>
              </div>

              {/* Angkatan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Angkatan (Tahun)</label>
                <select
                  value={formData.angkatan}
                  onChange={(e) => setFormData({ ...formData, angkatan: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Pilih Angkatan (Opsional) --</option>
                  {angkatanList.map(a => (
                    <option key={a.id_angkatan} value={a.tahun_angkatan}>
                      {a.tahun_angkatan}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahun Ajaran */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Ajaran</label>
                <input
                  type="text"
                  value={formData.tahun_ajaran}
                  onChange={(e) => setFormData({ ...formData, tahun_ajaran: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Contoh: 2024/2025"
                />
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  rows="2"
                  placeholder="Catatan tambahan (opsional)"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition"
                >
                  {formMode === "add" ? "Simpan" : "Perbarui"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Hapus kelas <span className="font-semibold text-gray-900">"{deleteTarget.nama_kelas}"</span>?
              <br />
              <span className="text-sm text-red-600 mt-2 block">
                Mahasiswa yang terdaftar di kelas ini mungkin akan terpengaruh. Tindakan ini tidak dapat dibatalkan.
              </span>
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
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {loading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
