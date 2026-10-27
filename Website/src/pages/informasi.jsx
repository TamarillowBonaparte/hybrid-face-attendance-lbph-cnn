import Swal from "sweetalert2";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, AlertCircle } from 'lucide-react';
import {
  getInformasiListAdmin,
  deleteInformasi
} from '../utils/apiUtils';
import { getUser } from '../utils/auth';
import { navigationItems } from '../navigation/navigation';
import DashboardLayout from '../layouts/dashboardlayout';

const Informasi = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('informasi');
  const [informasiList, setInformasiList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Get current user and check role
  const currentUser = getUser() || {};
  const isSuperAdmin = currentUser.role === 'admin' || currentUser.role === 'dosen';

  useEffect(() => {
    fetchInformasi();
  }, [currentPage, perPage]);

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  const fetchInformasi = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        per_page: perPage,
      };

      const data = await getInformasiListAdmin(params);

      setInformasiList(data.items || []);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      console.error('Error fetching informasi:', err);
      setError(err.message || 'Gagal memuat data informasi');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, judul) => {
    setDeleteTarget({ id, judul });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      const success = await deleteInformasi(deleteTarget.id);

      if (success) {
        showNotification('success', 'Informasi berhasil dihapus');
        fetchInformasi(); // Refresh list
      }
    } catch (err) {
      console.error('Error deleting informasi:', err);
      showNotification('error', err.message || 'Gagal menghapus informasi');
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Redirect if not super admin
  if (!isSuperAdmin) {
    return (
      <DashboardLayout
        navigationItems={navigationItems}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      >
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Akses Ditolak</h2>
          <p className="text-red-600">Halaman ini hanya dapat diakses oleh Super Admin</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      navigationItems={navigationItems}
      activeNav={activeNav}
      setActiveNav={setActiveNav}
    >
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white`}>
            {notification.type === 'success' ? '✓' : '✕'} {notification.message}
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Kelola Informasi</h1>
          <button
            onClick={() => navigate('/informasi/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Tambah Informasi
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Memuat data...</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="p-3 text-left text-sm font-semibold" style={{ width: '50px' }}>ID</th>
                    <th className="p-3 text-left text-sm font-semibold" style={{ width: '200px' }}>Judul</th>
                    <th className="p-3 text-left text-sm font-semibold">Deskripsi</th>
                    <th className="p-3 text-center text-sm font-semibold" style={{ width: '80px' }}>Priority</th>
                    <th className="p-3 text-left text-sm font-semibold" style={{ width: '100px' }}>Target</th>
                    <th className="p-3 text-center text-sm font-semibold" style={{ width: '80px' }}>Status</th>
                    <th className="p-3 text-left text-sm font-semibold" style={{ width: '150px' }}>Tanggal</th>
                    <th className="p-3 text-center text-sm font-semibold" style={{ width: '180px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {informasiList.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-gray-500">
                        Tidak ada data informasi
                      </td>
                    </tr>
                  ) : (
                    informasiList.map((info, index) => (
                      <tr
                        key={info.id}
                        className={`border-b hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                      >
                        <td className="p-3 text-sm">{info.id}</td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">{info.judul}</div>
                          {info.gambar_url && (
                            <span className="inline-block mt-1 text-xs text-gray-500">
                              📷 Ada gambar
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {truncateText(info.deskripsi, 80)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${info.priority >= 80 ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-700'
                            }`}>
                            {info.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs ${info.target_role === 'all' ? 'bg-blue-100 text-blue-700' :
                              info.target_role === 'mahasiswa' ? 'bg-orange-100 text-orange-700' :
                                'bg-purple-100 text-purple-700'
                            }`}>
                            {info.target_role === 'all' ? 'Semua' :
                              info.target_role === 'mahasiswa' ? 'Mahasiswa' : 'Dosen'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${info.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                            {info.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          {formatDate(info.created_at)}
                        </td>
                        <td className="p-3 flex gap-3">
                          <button
                            onClick={() => navigate(`/informasi/edit/${info.id}`)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(info.id, info.judul)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  ← Sebelumnya
                </button>

                <span className="text-sm text-gray-700 font-medium">
                  Halaman {currentPage} dari {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  Selanjutnya →
                </button>
              </div>
            )}

            {/* Per Page Selector */}
            <div className="flex justify-center mt-3">
              <label className="text-sm text-gray-700">
                Tampilkan per halaman:
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="ml-2 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </label>
            </div>
          </>
        )}
      </div>

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
              Apakah Anda yakin ingin menghapus informasi <span className="font-semibold text-gray-900">"{deleteTarget?.judul}"</span>?
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
};

export default Informasi;
