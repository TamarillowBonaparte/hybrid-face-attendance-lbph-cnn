import Swal from "sweetalert2";
// src/pages/kelolaDosen.jsx
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { Users, Edit2, X, BookOpen } from "lucide-react";
import { getDosenList, updateDosen, getKelasMKByDosen } from "../utils/apiUtils";
import { getUser } from "../utils/auth";

export default function KelolaDosen() {
  const [activeNav, setActiveNav] = useState("kelola-dosen");
  const [dosenList, setDosenList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showJadwalModal, setShowJadwalModal] = useState(false);
  const [selectedDosen, setSelectedDosen] = useState(null);
  const [jadwalDosen, setJadwalDosen] = useState([]);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // DB Schema Dosen: id_dosen, nidn, nama_dosen, email, no_hp, status
  const [editFormData, setEditFormData] = useState({
    nama_dosen: '',
    email: '',
    no_hp: '',
    nidn: '',
    status: 'aktif',
  });

  const currentUser = getUser() || {};
  const isAdmin = currentUser.role === 'admin';

  const fetchAllDosen = async () => {
    try {
      setLoading(true);
      const data = await getDosenList();
      setDosenList(data || []);
    } catch (error) {
      showNotification('error', 'Gagal memuat data dosen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDosen();
  }, []);

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  const handleOpenEditModal = (dosen) => {
    setSelectedDosen(dosen);
    setEditFormData({
      nama_dosen: dosen.nama_dosen || '',
      email: dosen.email || '',
      no_hp: dosen.no_hp || '',
      nidn: dosen.nidn || '',
      status: dosen.status || 'aktif',
    });
    setShowEditModal(true);
  };

  const handleOpenJadwalModal = async (dosen) => {
    setSelectedDosen(dosen);
    setShowJadwalModal(true);
    setLoadingJadwal(true);
    try {
      const data = await getKelasMKByDosen(dosen.id_dosen);
      setJadwalDosen(data || []);
    } catch {
      setJadwalDosen([]);
    } finally {
      setLoadingJadwal(false);
    }
  };

  const handleUpdateDosen = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nama_dosen: editFormData.nama_dosen,
        email: editFormData.email || undefined,
        no_hp: editFormData.no_hp || undefined,
        nidn: editFormData.nidn,
        status: editFormData.status,
      };
      await updateDosen(selectedDosen.id_dosen, payload);
      showNotification('success', 'Data dosen berhasil diperbarui');
      setShowEditModal(false);
      fetchAllDosen();
    } catch (error) {
      showNotification('error', error.message || 'Gagal memperbarui data dosen');
    }
  };

  if (loading && dosenList.length === 0) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Memuat data dosen...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
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
            <Users className="text-blue-600" /> Kelola Dosen
          </h1>
          <span className="text-sm text-gray-500">{dosenList.length} dosen terdaftar</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">NIP</th>
                <th className="text-left py-3 px-4 font-semibold">Nama Dosen</th>
                <th className="text-left py-3 px-4 font-semibold">Email</th>
                <th className="text-left py-3 px-4 font-semibold">No HP</th>
                <th className="text-center py-3 px-4 font-semibold">Status</th>
                <th className="text-center py-3 px-4 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dosenList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Belum ada data dosen</p>
                  </td>
                </tr>
              ) : (
                dosenList.map((dosen, index) => (
                  <tr key={dosen.id_dosen} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="py-3 px-4 text-sm font-mono">{dosen.nidn}</td>
                    <td className="py-3 px-4 text-sm font-medium">{dosen.nama_dosen}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{dosen.email || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{dosen.no_hp || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dosen.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {dosen.status || 'aktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleOpenJadwalModal(dosen)}
                          className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-sm"
                          title="Lihat Jadwal Mengajar"
                        >
                          <BookOpen className="h-4 w-4" /> Jadwal
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(dosen)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                            title="Edit Data Dosen"
                          >
                            <Edit2 className="h-4 w-4" /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lihat Jadwal Dosen */}
      {showJadwalModal && selectedDosen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Jadwal Mengajar</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedDosen.nama_dosen} · NIP: {selectedDosen.nidn}</p>
              </div>
              <button onClick={() => setShowJadwalModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingJadwal ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : jadwalDosen.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl">
                <BookOpen className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>Dosen ini belum memiliki jadwal mengajar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 text-blue-800">
                      <th className="text-left py-2 px-3">Mata Kuliah</th>
                      <th className="text-left py-2 px-3">Kelas</th>
                      <th className="text-left py-2 px-3">Hari</th>
                      <th className="text-left py-2 px-3">Jam</th>
                      <th className="text-left py-2 px-3">Ruangan</th>
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jadwalDosen.map((j) => (
                      <tr key={j.id_kelas_mk} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{j.nama_mk}</td>
                        <td className="py-2 px-3 text-gray-600">{j.nama_kelas}</td>
                        <td className="py-2 px-3">{j.hari}</td>
                        <td className="py-2 px-3 text-gray-600">
                          {j.jam_mulai ? j.jam_mulai.substring(0, 5) : '-'} – {j.jam_selesai ? j.jam_selesai.substring(0, 5) : '-'}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{j.ruangan || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${j.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {j.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Edit Dosen */}
      {showEditModal && selectedDosen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} className="w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Edit Data Dosen</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedDosen.nidn}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateDosen} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIP <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editFormData.nidn}
                  onChange={(e) => setEditFormData({ ...editFormData, nidn: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dosen <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editFormData.nama_dosen}
                  onChange={(e) => setEditFormData({ ...editFormData, nama_dosen: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No HP</label>
                <input
                  type="text"
                  value={editFormData.no_hp}
                  onChange={(e) => setEditFormData({ ...editFormData, no_hp: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition font-medium">
                  Simpan Perubahan
                </button>
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-3 rounded-lg transition font-medium">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
