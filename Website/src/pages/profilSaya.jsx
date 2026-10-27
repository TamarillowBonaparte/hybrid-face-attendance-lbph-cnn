import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import {
  User, Mail, Phone, MapPin, Calendar, Award,
  Edit2, Save, X, BookOpen, BarChart3
} from "lucide-react";
import { getDosenList, updateDosen, getKelasMKList, updateUser } from "../utils/apiUtils";
import { getUser, setUser } from "../utils/auth";

export default function ProfilSaya() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("profil-saya");
  const [activeTab, setActiveTab] = useState("profil");
  const [dosen, setDosen] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  const [editFormData, setEditFormData] = useState({
    nama_dosen: '',
    email_dosen: '',
    no_hp: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    agama: '',
    alamat: ''
  });

  // Get current user
  const currentUser = getUser() || {};
  useEffect(() => {
    // Check if user is admin or dosen
    if (currentUser.role !== 'admin' && currentUser.role !== 'dosen') {
      navigate('/dashboard');
      return;
    }

    fetchMyProfile();
  }, []);

  const fetchMyProfile = async () => {
    try {
      setLoading(true);

      // Get dosen list and find current user's dosen data
      const dosenList = await getDosenList();
      const myDosen = (dosenList || []).find(d => d.email === currentUser.email);

      if (myDosen) {
        setDosen(myDosen);
        setEditFormData({
          nama_dosen: myDosen.nama_dosen || '',
          email_dosen: myDosen.email || '',
          no_hp: myDosen.no_hp || '',
          tempat_lahir: myDosen.tempat_lahir || '',
          tanggal_lahir: myDosen.tanggal_lahir || '',
          jenis_kelamin: myDosen.jenis_kelamin || '',
          agama: myDosen.agama || '',
          alamat: myDosen.alamat || ''
        });

        // Fetch assignments after we have id_dosen
        fetchMyAssignments(myDosen.id_dosen);
      } else if (currentUser.role === 'admin') {
        // Fallback for Super Admin without Dosen record
        setDosen({
          id_dosen: null,
          id_user: currentUser.id,
          nama_dosen: currentUser.name || currentUser.nama || currentUser.username || 'Super Admin',
          email: currentUser.email,
          nip: 'SUPER ADMIN',
          role: 'admin',
          jenis_kelamin: '-',
          agama: '-',
          alamat: '-',
          tempat_lahir: '-',
          tanggal_lahir: '',
          no_hp: '-'
        });
        setEditFormData({
          nama_dosen: currentUser.name || currentUser.nama || currentUser.username || '',
          email_dosen: currentUser.email || '',
          no_hp: '',
          tempat_lahir: '',
          tanggal_lahir: '',
          jenis_kelamin: '',
          agama: '',
          alamat: ''
        });
        setAssignments([]);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      showNotification('error', 'Gagal memuat profil');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAssignments = async (idDosen) => {
    try {
      const allKelasMK = await getKelasMKList();

      // Filter assignments for current dosen
      const myAssignments = (allKelasMK || []).filter(a => a.id_dosen === idDosen);
      setAssignments(myAssignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    try {
      if (dosen.role === 'admin' && !dosen.id_dosen) {
        const payload = {
          name: editFormData.nama_dosen,
          email: editFormData.email_dosen || undefined,
        };
        await updateUser(dosen.id_user, payload);
        
        // Update local storage so header reflects changes immediately
        const userObj = getUser();
        if (userObj) {
          userObj.name = payload.name;
          userObj.email = payload.email || userObj.email;
          setUser(userObj, true); 
        }
      } else {
        // Backend Dosen only supports: nidn, nama_dosen, email, no_hp, status
        const payload = {
          nama_dosen: editFormData.nama_dosen,
          email: editFormData.email_dosen || undefined,
          no_hp: editFormData.no_hp || undefined,
        };
        await updateDosen(dosen.id_dosen, payload);
      }

      showNotification('success', 'Profil berhasil diupdate');
      setIsEditing(false);
      fetchMyProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      showNotification('error', error.message || 'Gagal update profil');
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!dosen) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="text-center py-12">
          <p className="text-gray-500">Data profil tidak ditemukan</p>
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
        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{dosen.nama_dosen}</h1>
                <p className="text-blue-100 text-lg">NIP: {dosen.nip}</p>
                <div className="flex gap-4 mt-3">
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                    {dosen.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                    {assignments.length} Mata Kuliah
                  </span>
                </div>
              </div>
            </div>
            {!isEditing && activeTab === "profil" && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Edit2 className="h-4 w-4" /> Edit Profil
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => { setActiveTab("profil"); setIsEditing(false); }}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition ${activeTab === "profil"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
              >
                <User className="h-5 w-5" /> Profil Saya
              </button>
              <button
                onClick={() => { setActiveTab("assignment"); setIsEditing(false); }}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition ${activeTab === "assignment"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
              >
                <BookOpen className="h-5 w-5" /> Mata Kuliah Saya ({assignments.length})
              </button>
              <button
                onClick={() => { setActiveTab("statistik"); setIsEditing(false); }}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition ${activeTab === "statistik"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
              >
                <BarChart3 className="h-5 w-5" /> Statistik
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "profil" && (
              <>
                {!isEditing ? (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Pribadi</h3>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Award className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">NIP</p>
                          <p className="font-semibold text-gray-900">{dosen.nip}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-semibold text-gray-900">{dosen.email_dosen || dosen.email || '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Phone className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">No HP</p>
                          <p className="font-semibold text-gray-900">{dosen.no_hp || '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Tempat, Tanggal Lahir</p>
                          <p className="font-semibold text-gray-900">
                            {dosen.tempat_lahir || '-'}, {formatDate(dosen.tanggal_lahir)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-pink-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Jenis Kelamin</p>
                          <p className="font-semibold text-gray-900">
                            {dosen.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Award className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Agama</p>
                          <p className="font-semibold text-gray-900">{dosen.agama || '-'}</p>
                        </div>
                      </div>

                      <div className="md:col-span-2 flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Alamat</p>
                          <p className="font-semibold text-gray-900">{dosen.alamat || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Edit Profil</h3>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nama <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editFormData.nama_dosen}
                          onChange={(e) => setEditFormData({ ...editFormData, nama_dosen: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={editFormData.email_dosen}
                          onChange={(e) => setEditFormData({ ...editFormData, email_dosen: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      {dosen.id_dosen && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              No HP
                            </label>
                            <input
                              type="text"
                              value={editFormData.no_hp}
                              onChange={(e) => setEditFormData({ ...editFormData, no_hp: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tempat Lahir
                            </label>
                            <input
                              type="text"
                              value={editFormData.tempat_lahir}
                              onChange={(e) => setEditFormData({ ...editFormData, tempat_lahir: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tanggal Lahir
                            </label>
                            <input
                              type="date"
                              value={editFormData.tanggal_lahir}
                              onChange={(e) => setEditFormData({ ...editFormData, tanggal_lahir: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Agama
                            </label>
                            <select
                              value={editFormData.agama}
                              onChange={(e) => setEditFormData({ ...editFormData, agama: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Pilih</option>
                              <option value="Islam">Islam</option>
                              <option value="Kristen">Kristen</option>
                              <option value="Katolik">Katolik</option>
                              <option value="Hindu">Hindu</option>
                              <option value="Buddha">Buddha</option>
                              <option value="Konghucu">Konghucu</option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Alamat
                            </label>
                            <textarea
                              value={editFormData.alamat}
                              onChange={(e) => setEditFormData({ ...editFormData, alamat: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                              rows="3"
                            ></textarea>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition font-medium flex items-center justify-center gap-2"
                      >
                        <Save className="h-5 w-5" /> Simpan Perubahan
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-3 rounded-lg transition font-medium"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {activeTab === "assignment" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Mata Kuliah yang Saya Ampu</h3>

                {assignments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Belum ada mata kuliah yang diampu</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id_kelas_mk}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-lg">
                              {assignment.nama_mk}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Kode MK: {assignment.kode_mk}
                            </p>
                            <div className="flex items-center gap-4 mt-3 flex-wrap">
                              <span className="text-sm text-gray-700">
                                {assignment.nama_kelas}
                              </span>
                              <span className="text-sm text-gray-700">
                                {assignment.prodi}
                              </span>
                              <span className="text-sm text-gray-700">
                                {assignment.tahun_ajaran}
                              </span>
                              <span className="text-sm text-gray-700">
                                Semester {assignment.semester_aktif}
                              </span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${assignment.status === 'Aktif'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                            }`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "statistik" && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistik Mengajar</h3>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-blue-600 font-medium">Total Mata Kuliah</p>
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold text-blue-900">{assignments.length}</p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-green-600 font-medium">Mata Kuliah Aktif</p>
                      <BarChart3 className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-green-900">
                      {assignments.filter(a => a.status === 'Aktif').length}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-purple-600 font-medium">Total Kelas</p>
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-purple-900">
                      {new Set(assignments.map(a => a.id_kelas)).size}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
