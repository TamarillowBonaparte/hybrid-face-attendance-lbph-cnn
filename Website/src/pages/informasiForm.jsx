import Swal from "sweetalert2";
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import {
  createInformasi,
  updateInformasi,
  getInformasiByIdAdmin,
  apiUpload,
  API_BASE_URL
} from '../utils/apiUtils';
import { getUser } from '../utils/auth';
import { navigationItems } from '../navigation/navigation';
import DashboardLayout from '../layouts/dashboardlayout';

const InformasiForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [activeNav, setActiveNav] = useState('informasi');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Get current user and check role
  const currentUser = getUser() || {};
  const isSuperAdmin = currentUser.role === 'admin' || currentUser.role === 'dosen';

  // Form data
  const [formData, setFormData] = useState({
    judul: '',
    deskripsi: '',
    gambar_url: '',
    priority: 0,
    tanggal_mulai: '',
    tanggal_selesai: '',
    target_role: 'all',
    is_active: true
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (isEditMode) {
      fetchInformasiDetail();
    }
  }, [id]);

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  const fetchInformasiDetail = async () => {
    try {
      setLoading(true);
      const data = await getInformasiByIdAdmin(id);

      setFormData({
        judul: data.judul || '',
        deskripsi: data.deskripsi || '',
        gambar_url: data.gambar_url || '',
        priority: data.priority || 0,
        tanggal_mulai: data.tanggal_mulai ? formatDateTimeLocal(data.tanggal_mulai) : '',
        tanggal_selesai: data.tanggal_selesai ? formatDateTimeLocal(data.tanggal_selesai) : '',
        target_role: data.target_role || 'all',
        is_active: data.is_active !== undefined ? data.is_active : true
      });

      if (data.gambar_url) {
        setImagePreview(`${API_BASE_URL}${data.gambar_url}`);
      }
    } catch (err) {
      console.error('Error fetching informasi detail:', err);
      setError(err.message || 'Gagal memuat data informasi');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Format: YYYY-MM-DDTHH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showNotification('error', 'Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.');
      return;
    }

    // Validasi file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('error', 'Ukuran file terlalu besar. Maksimal 5MB.');
      return;
    }

    setImageFile(file);

    // Preview image
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    if (!imageFile) {
      showNotification('error', 'Pilih gambar terlebih dahulu');
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', imageFile);
      const result = await apiUpload('/informasi/upload', formData);

      setFormData(prev => ({
        ...prev,
        gambar_url: result.url
      }));

      showNotification('success', 'Gambar berhasil diupload!');
      setImageFile(null);
    } catch (err) {
      console.error('Error uploading image:', err);
      showNotification('error', err.message || 'Gagal mengupload gambar');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      gambar_url: ''
    }));
    setImagePreview('');
    setImageFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validasi
    if (!formData.judul.trim()) {
      showNotification('error', 'Judul harus diisi');
      return;
    }

    if (formData.judul.trim().length < 5) {
      showNotification('error', 'Judul minimal 5 karakter');
      return;
    }

    if (formData.judul.trim().length > 255) {
      showNotification('error', 'Judul maksimal 255 karakter');
      return;
    }

    if (!formData.deskripsi.trim()) {
      showNotification('error', 'Deskripsi harus diisi');
      return;
    }

    if (formData.deskripsi.trim().length < 10) {
      showNotification('error', 'Deskripsi minimal 10 karakter');
      return;
    }

    if (formData.priority < 0 || formData.priority > 100) {
      showNotification('error', 'Priority harus antara 0-100');
      return;
    }

    // Validasi tanggal
    if (formData.tanggal_mulai && formData.tanggal_selesai) {
      const mulai = new Date(formData.tanggal_mulai);
      const selesai = new Date(formData.tanggal_selesai);
      if (selesai <= mulai) {
        showNotification('error', 'Tanggal selesai harus setelah tanggal mulai');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare data
      const submitData = {
        judul: formData.judul.trim(),
        deskripsi: formData.deskripsi.trim(),
        priority: parseInt(formData.priority),
        target_role: formData.target_role,
        gambar_url: formData.gambar_url || null,
        tanggal_mulai: formData.tanggal_mulai || null,
        tanggal_selesai: formData.tanggal_selesai || null
      };

      // Tambahkan is_active hanya untuk edit mode
      if (isEditMode) {
        submitData.is_active = formData.is_active;
      }

      // Call API
      if (isEditMode) {
        await updateInformasi(id, submitData);
        showNotification('success', 'Informasi berhasil diupdate!');
      } else {
        await createInformasi(submitData);
        showNotification('success', 'Informasi berhasil ditambahkan!');
      }

      setTimeout(() => navigate('/informasi'), 1000);
    } catch (err) {
      console.error('Error saving informasi:', err);
      setError(err.message || 'Gagal menyimpan informasi');
    } finally {
      setLoading(false);
    }
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

      <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Informasi' : 'Tambah Informasi'}
          </h1>
          <button
            onClick={() => navigate('/informasi')}
            className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all"
          >
            ← Kembali
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl">
          {/* Judul */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Judul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="judul"
              value={formData.judul}
              onChange={handleInputChange}
              placeholder="Masukkan judul informasi (minimal 5 karakter)"
              required
              minLength={5}
              maxLength={255}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.judul.length}/255 karakter (minimal 5)
            </p>
          </div>

          {/* Deskripsi */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Deskripsi <span className="text-red-500">*</span>
            </label>
            <textarea
              name="deskripsi"
              value={formData.deskripsi}
              onChange={handleInputChange}
              placeholder="Masukkan deskripsi/konten informasi (minimal 10 karakter)"
              required
              minLength={10}
              rows={6}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.deskripsi.length} karakter (minimal 10)
            </p>
          </div>

          {/* Gambar Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gambar (Optional)
            </label>

            {imagePreview && (
              <div className="mb-3">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-sm max-h-48 rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  Hapus Gambar
                </button>
              </div>
            )}

            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-3"
            />

            {imageFile && (
              <button
                type="button"
                onClick={handleUploadImage}
                disabled={uploadingImage}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${uploadingImage
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
              >
                {uploadingImage ? 'Mengupload...' : '📤 Upload Gambar'}
              </button>
            )}

            <p className="mt-2 text-xs text-gray-500">
              Format: JPG, PNG, GIF, WebP. Maksimal 5MB.
            </p>
          </div>

          {/* Priority */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Priority (0-100)
            </label>
            <input
              type="number"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              min={0}
              max={100}
              className="w-40 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              Semakin tinggi priority, semakin atas posisi di list (default: 0)
            </p>
          </div>

          {/* Target Role */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Target Audience
            </label>
            <select
              name="target_role"
              value={formData.target_role}
              onChange={handleInputChange}
              className="w-56 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua User</option>
              <option value="mahasiswa">Mahasiswa</option>
              <option value="dosen">Dosen</option>
            </select>
          </div>

          {/* Tanggal Mulai */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tanggal Mulai (Optional)
            </label>
            <input
              type="datetime-local"
              name="tanggal_mulai"
              value={formData.tanggal_mulai}
              onChange={handleInputChange}
              className="w-64 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              Kosongkan jika ingin langsung ditampilkan
            </p>
          </div>

          {/* Tanggal Selesai */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tanggal Selesai (Optional)
            </label>
            <input
              type="datetime-local"
              name="tanggal_selesai"
              value={formData.tanggal_selesai}
              onChange={handleInputChange}
              className="w-64 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              Kosongkan jika tidak ada batas waktu
            </p>
          </div>

          {/* Status Active (Edit mode only) */}
          {isEditMode && (
            <div className="mb-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-semibold text-gray-700">Aktif</span>
              </label>
              <p className="mt-2 text-xs text-gray-500">
                Informasi yang tidak aktif tidak akan ditampilkan
              </p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className={`px-8 py-3 rounded-xl font-semibold text-white transition-all ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
            >
              {loading ? 'Menyimpan...' : isEditMode ? '💾 Update' : '✓ Simpan'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/informasi')}
              className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default InformasiForm;
