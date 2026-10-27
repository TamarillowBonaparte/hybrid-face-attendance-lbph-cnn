import Swal from "sweetalert2";
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { Calendar, Plus, Edit, Trash2, X, AlertCircle } from "lucide-react";
import axios from "axios";
import { getUser, getToken } from "../utils/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function MataKuliah() {
  const [activeNav, setActiveNav] = useState("Assignment-Kelas");
  const [kelasMKList, setKelasMKList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedKelasMK, setSelectedKelasMK] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Dropdown options
  const [mataKuliahList, setMataKuliahList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [dosenList, setDosenList] = useState([]);

  const [formData, setFormData] = useState({
    kode_mk: '',
    id_kelas: '',
    id_dosen: '',
    tahun_ajaran: '',
    semester_aktif: '1',
    status: 'Aktif'
  });

  // Get current user
  const currentUser = getUser() || {};
  const isSuperAdmin = currentUser.role === 'admin' || currentUser.role === 'dosen';



  useEffect(() => {
    fetchKelasMK();
    fetchDropdownData();
  }, []);

  // Poll for updates every 5 seconds


  const fetchKelasMK = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/kelas-mata-kuliah`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKelasMKList(response.data);
    } catch (error) {
      console.error("Error fetching kelas mata kuliah:", error);
      showNotification('error', 'Gagal memuat data kelas mata kuliah');
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const token = getToken();

      // Fetch mata kuliah
      const mkResponse = await axios.get(`${API_BASE_URL}/mata-kuliah`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMataKuliahList(mkResponse.data);

      // Fetch kelas
      const kelasResponse = await axios.get(`${API_BASE_URL}/kelas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKelasList(kelasResponse.data);

      // Fetch dosen
      const dosenResponse = await axios.get(`${API_BASE_URL}/dosen`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDosenList(dosenResponse.data);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
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

  const handleOpenModal = (kelasMK = null) => {
    if (kelasMK) {
      setIsEditMode(true);
      setSelectedKelasMK(kelasMK);
      setFormData({
        kode_mk: kelasMK.kode_mk,
        id_kelas: kelasMK.id_kelas,
        id_dosen: kelasMK.id_dosen,
        tahun_ajaran: kelasMK.tahun_ajaran,
        semester_aktif: kelasMK.semester_aktif,
        status: kelasMK.status
      });
    } else {
      setIsEditMode(false);
      setSelectedKelasMK(null);
      setFormData({
        kode_mk: '',
        id_kelas: '',
        id_dosen: '',
        tahun_ajaran: '',
        semester_aktif: '1',
        status: 'Aktif'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setSelectedKelasMK(null);
    setFormData({
      kode_mk: '',
      id_kelas: '',
      id_dosen: '',
      tahun_ajaran: '',
      semester_aktif: '1',
      status: 'Aktif'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.kode_mk || !formData.id_kelas || !formData.id_dosen || !formData.tahun_ajaran) {
      showNotification('error', 'Semua field wajib diisi');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const payload = {
        kode_mk: formData.kode_mk,
        id_kelas: parseInt(formData.id_kelas),
        id_dosen: parseInt(formData.id_dosen),
        tahun_ajaran: formData.tahun_ajaran,
        semester_aktif: formData.semester_aktif,
        status: formData.status
      };

      if (isEditMode) {
        await axios.put(
          `${API_BASE_URL}/kelas-mata-kuliah/${selectedKelasMK.id_kelas_mk}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showNotification('success', 'Kelas mata kuliah berhasil diupdate');
      } else {
        await axios.post(
          `${API_BASE_URL}/kelas-mata-kuliah`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showNotification('success', 'Kelas mata kuliah berhasil ditambahkan');
      }

      handleCloseModal();
      fetchKelasMK();
    } catch (error) {
      console.error("Error saving kelas mata kuliah:", error);
      showNotification('error', error.response?.data?.detail || 'Gagal menyimpan kelas mata kuliah');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id_kelas_mk, nama_mk, nama_kelas) => {
    setDeleteTarget({ id_kelas_mk, info: `${nama_mk} - ${nama_kelas}` });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/kelas-mata-kuliah/${deleteTarget.id_kelas_mk}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('success', 'Kelas mata kuliah berhasil dihapus');
      fetchKelasMK();
    } catch (error) {
      console.error("Error deleting kelas mata kuliah:", error);
      showNotification('error', error.response?.data?.detail || 'Gagal menghapus kelas mata kuliah');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  // Redirect if not super admin
  if (!isSuperAdmin) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Akses Ditolak</h2>
          <p className="text-red-600">Halaman ini hanya dapat diakses oleh Super Admin</p>
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

      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="text-blue-600" /> Kelola Kelas Mata Kuliah
          </h1>
          {isSuperAdmin && (
            <button
              onClick={() => handleOpenModal()}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <Plus className="h-5 w-5" /> Tambah Assignment
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">ID</th>
                <th className="text-left py-3 px-4 font-semibold">Kode MK</th>
                <th className="text-left py-3 px-4 font-semibold">Nama Mata Kuliah</th>
                <th className="text-left py-3 px-4 font-semibold">Kelas</th>
                <th className="text-left py-3 px-4 font-semibold">Dosen</th>
                <th className="text-center py-3 px-4 font-semibold">Tahun Ajaran</th>
                <th className="text-center py-3 px-4 font-semibold">Semester</th>
                <th className="text-center py-3 px-4 font-semibold">Status</th>
                {isSuperAdmin && (
                  <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && kelasMKList.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? "9" : "8"} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                      <p className="text-gray-500 text-sm">Memuat data...</p>
                    </div>
                  </td>
                </tr>
              ) : kelasMKList.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? "9" : "8"} className="text-center py-12 text-gray-500">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>Belum ada data kelas mata kuliah</p>
                  </td>
                </tr>
              ) : (
                kelasMKList.map((kmk, index) => (
                  <tr
                    key={kmk.id_kelas_mk}
                    className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                  >
                    <td className="py-3 px-4 font-mono text-sm">{kmk.id_kelas_mk}</td>
                    <td className="py-3 px-4 font-mono text-sm font-semibold">{kmk.kode_mk}</td>
                    <td className="py-3 px-4 font-medium">{kmk.nama_mk}</td>
                    <td className="py-3 px-4">
                      {kmk.nama_kelas}
                      <span className="ml-2 text-xs text-gray-500">({kmk.prodi})</span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {kmk.nama_dosen}
                      <div className="text-xs text-gray-500">{kmk.nip}</div>
                    </td>
                    <td className="py-3 px-4 text-center">{kmk.tahun_ajaran}</td>
                    <td className="py-3 px-4 text-center">{kmk.semester_aktif}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${kmk.status === 'Aktif'
                        ? 'bg-green-100 text-green-700'
                        : kmk.status === 'Selesai'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                        {kmk.status}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleOpenModal(kmk)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(kmk.id_kelas_mk, kmk.nama_mk, kmk.nama_kelas)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
                            title="Hapus"
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

      {/* Modal Form */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }} className="w-screen h-screen bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                {isEditMode ? 'Edit Kelas Mata Kuliah' : 'Tambah Kelas Mata Kuliah'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mata Kuliah <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.kode_mk}
                  onChange={(e) => setFormData({ ...formData, kode_mk: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={isEditMode}
                >
                  <option value="">-- Pilih Mata Kuliah --</option>
                  {mataKuliahList.map(mk => (
                    <option key={mk.kode_mk} value={mk.kode_mk}>
                      [{mk.kode_mk}] {mk.nama_mk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kelas <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.id_kelas}
                  onChange={(e) => setFormData({ ...formData, id_kelas: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map(kelas => (
                    <option key={kelas.id_kelas} value={kelas.id_kelas}>
                      {kelas.nama_kelas} ({kelas.prodi})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosen Pengampu <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.id_dosen}
                  onChange={(e) => setFormData({ ...formData, id_dosen: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Pilih Dosen --</option>
                  {dosenList.map(dosen => (
                    <option key={dosen.id_dosen} value={dosen.id_dosen}>
                      {dosen.nama_dosen} - {dosen.nip}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tahun Ajaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.tahun_ajaran}
                  onChange={(e) => setFormData({ ...formData, tahun_ajaran: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: 2024/2025"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semester Aktif <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.semester_aktif}
                  onChange={(e) => setFormData({ ...formData, semester_aktif: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Batal">Batal</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition font-medium"
                >
                  {isEditMode ? 'Update' : 'Simpan'}
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
              Apakah Anda yakin ingin menghapus <span className="font-semibold text-gray-900">"{deleteTarget?.info}"</span>?
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