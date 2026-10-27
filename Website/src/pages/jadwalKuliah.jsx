import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { CalendarDays, Clock, MapPin, Plus, Edit, Trash2, X, AlertCircle, BookOpen, Users, ChevronDown, ChevronUp } from "lucide-react";
import {
  getJadwalKuliahList, createJadwalFromMatakuliah, updateJadwalKuliah, deleteJadwalKuliah,
  getMataKuliahList, getPenawaranMKList, getKelasList, addKelasToPenawaran, removeKelasFromPenawaran, getKelasByPenawaran,
} from "../utils/apiUtils";
import { getUser } from "../utils/auth";

export default function JadwalKuliah() {
  const [activeNav, setActiveNav] = useState("jadwal-kuliah");
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mataKuliahList, setMataKuliahList] = useState([]);
  const [penawaranList, setPenawaranList] = useState([]);
  const [hasExistingPenawaran, setHasExistingPenawaran] = useState(false);
  const [kelasList, setKelasList] = useState([]);
  const [expandedJadwal, setExpandedJadwal] = useState(null);
  const [kelasByJadwal, setKelasByJadwal] = useState({});
  const [loadingKelas, setLoadingKelas] = useState(false);

  // Form state untuk tambah baru (dari MK)
  const [formData, setFormData] = useState({
    id_matakuliah: "",
    semester: "",
    tahun_ajaran: "",
    hari: "Senin",
    jam_mulai: "",
    jam_selesai: "",
    ruangan: "",
    id_kelas: "",
  });

  // Form state untuk edit (dari penawaran yang sudah ada)
  const [editFormData, setEditFormData] = useState({
    hari: "Senin",
    jam_mulai: "",
    jam_selesai: "",
    ruangan: "",
  });

  const currentUser = getUser() || {};
  const isSuperAdmin = currentUser.role === "admin";

  const formatTime = (t) => (t ? t.substring(0, 5) : "-");

  // Hitung tahun ajaran saat ini otomatis
  const getCurrentTA = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month >= 8) return `${year}/${year + 1}`;
    return `${year - 1}/${year}`;
  };

  useEffect(() => {
    fetchJadwal();
    if (isSuperAdmin) {
      getMataKuliahList().then(data => setMataKuliahList(data || [])).catch(() => {});
      getPenawaranMKList().then(data => setPenawaranList(data || [])).catch(() => {});
      getKelasList().then(data => setKelasList(data || [])).catch(() => {});
    }
  }, []);

  const toggleExpandJadwal = async (item) => {
    if (expandedJadwal === item.id_jadwal) {
      setExpandedJadwal(null);
      return;
    }
    setExpandedJadwal(item.id_jadwal);
    if (!kelasByJadwal[item.id_jadwal] && item.id_penawaran) {
      setLoadingKelas(true);
      try {
        const data = await getKelasByPenawaran(item.id_penawaran);
        setKelasByJadwal(prev => ({ ...prev, [item.id_jadwal]: data || [] }));
      } catch { } finally { setLoadingKelas(false); }
    }
  };

  const handleAddKelasToJadwal = async (jadwalItem, id_kelas) => {
    const kelas = kelasList.find(k => k.id === parseInt(id_kelas));
    if (!kelas) return;
    // Perlu lookup prodi/angkatan/golongan lewat kelas
    // Gunakan endpoint addKelasToPenawaran via apiUtils
    try {
      await addKelasToPenawaran({ id_penawaran: jadwalItem.id_penawaran, id_kelas: parseInt(id_kelas) });
      const data = await getKelasByPenawaran(jadwalItem.id_penawaran);
      setKelasByJadwal(prev => ({ ...prev, [jadwalItem.id_jadwal]: data || [] }));
      fetchJadwal();
      notify("success", "Kelas berhasil ditambahkan");
    } catch (err) { notify("error", err.message || "Gagal menambahkan kelas"); }
  };

  const handleRemoveKelas = async (jadwalItem, kelasId) => {
    try {
      await removeKelasFromPenawaran(kelasId);
      setKelasByJadwal(prev => ({
        ...prev,
        [jadwalItem.id_jadwal]: (prev[jadwalItem.id_jadwal] || []).filter(k => k.id !== kelasId)
      }));
      fetchJadwal();
      notify("success", "Kelas berhasil dihapus dari jadwal");
    } catch (err) { notify("error", err.message || "Gagal menghapus kelas"); }
  };

  const fetchJadwal = async () => {
    try {
      setLoading(true);
      const data = await getJadwalKuliahList();
      setJadwal(data || []);
    } catch { notify("error", "Gagal memuat data jadwal"); }
    finally { setLoading(false); }
  };

  const notify = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: "", message: "" }), 4000);
  };

  const emptyForm = {
    id_matakuliah: "",
    semester: "",
    tahun_ajaran: getCurrentTA(),
    hari: "Senin",
    jam_mulai: "",
    jam_selesai: "",
    ruangan: "",
    id_kelas: "",
  };

  const openModal = (item = null) => {
    setIsEditMode(!!item);
    setSelectedJadwal(item);
    if (item) {
      // Mode edit: hanya ubah hari, jam, ruangan
      setEditFormData({
        hari: item.hari || "Senin",
        jam_mulai: item.jam_mulai ? item.jam_mulai.substring(0, 5) : "",
        jam_selesai: item.jam_selesai ? item.jam_selesai.substring(0, 5) : "",
        ruangan: item.ruangan || "",
      });
    } else {
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isEditMode) {
        // Edit mode: hanya update hari/jam/ruangan
        if (!editFormData.jam_mulai || !editFormData.jam_selesai) {
          notify("error", "Jam mulai & selesai harus diisi");
          return;
        }
        const payload = {
          hari: editFormData.hari,
          jam_mulai: editFormData.jam_mulai,
          jam_selesai: editFormData.jam_selesai,
          ruangan: editFormData.ruangan || null,
        };
        await updateJadwalKuliah(selectedJadwal.id_jadwal, payload);
        notify("success", "Jadwal berhasil diperbarui");
      } else {
        // Tambah baru: dari mata kuliah
        if (!formData.id_matakuliah) { notify("error", "Pilih mata kuliah"); return; }
        if (!formData.semester) { notify("error", "Semester harus diisi"); return; }
        if (!formData.tahun_ajaran) { notify("error", "Tahun ajaran harus diisi"); return; }
        if (!formData.jam_mulai || !formData.jam_selesai) { notify("error", "Jam mulai & selesai harus diisi"); return; }

        const payload = {
          id_matakuliah: parseInt(formData.id_matakuliah),
          semester: parseInt(formData.semester),
          tahun_ajaran: formData.tahun_ajaran,
          hari: formData.hari,
          jam_mulai: formData.jam_mulai,
          jam_selesai: formData.jam_selesai,
          ruangan: formData.ruangan || null,
          id_kelas: formData.id_kelas ? parseInt(formData.id_kelas) : null,
        };
        await createJadwalFromMatakuliah(payload);
        notify("success", "Jadwal berhasil ditambahkan");
      }
      setShowModal(false);
      fetchJadwal();
    } catch (err) {
      notify("error", err.message || "Gagal menyimpan jadwal");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      await deleteJadwalKuliah(deleteTarget.id_jadwal);
      notify("success", "Jadwal berhasil dihapus");
      fetchJadwal();
    } catch (err) { notify("error", err.message || "Gagal menghapus jadwal"); }
    finally { setLoading(false); setShowDeleteModal(false); setDeleteTarget(null); }
  };

  const getKelasStr = (item) => {
    if (item.kelas_list && item.kelas_list.length > 0) return item.kelas_list.map(k => k.nama_kelas).filter(Boolean).join(", ");
    return "-";
  };
  const getDosStr = (item) => {
    if (item.pengajar_list && item.pengajar_list.length > 0) return item.pengajar_list.map(g => g.nama_dosen).filter(Boolean).join(", ");
    return "-";
  };

  if (loading && jadwal.length === 0) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Memuat jadwal...</p>
        </div>
      </DashboardLayout>
    );
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${notification.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-8 mb-8 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-xl"><CalendarDays className="h-10 w-10 text-white" /></div>
            <div>
              <h1 className="text-2xl font-semibold">Jadwal Kuliah</h1>
              <p className="text-blue-100 text-sm">{isSuperAdmin ? "Kelola jadwal perkuliahan" : "Jadwal perkuliahan Anda"}</p>
            </div>
          </div>
          {isSuperAdmin && (
            <button onClick={() => openModal()} className="flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-lg font-medium shadow-md transition">
              <Plus className="h-5 w-5" /> Tambah Jadwal
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <CalendarDays className="text-blue-600 h-6 w-6" />
          <h2 className="text-2xl font-semibold text-gray-800">Daftar Jadwal</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">{jadwal.length}</span>
        </div>
        {jadwal.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Tidak ada jadwal kuliah</p>
            {isSuperAdmin && (
              <p className="text-sm text-gray-400 mt-2">Klik "Tambah Jadwal" untuk menambahkan jadwal baru</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="py-3 px-4 text-left rounded-tl-lg">Mata Kuliah</th>
                  <th className="py-3 px-4 text-left">Kelas</th>
                  <th className="py-3 px-4 text-left">Pengajar</th>
                  <th className="py-3 px-4 text-left">Smt / TA</th>
                  <th className="py-3 px-4 text-left">Hari</th>
                  <th className="py-3 px-4 text-left">Jam</th>
                  <th className="py-3 px-4 text-left">Ruangan</th>
                  {isSuperAdmin && <th className="py-3 px-4 text-center rounded-tr-lg">Aksi</th>}
                  <th className="py-3 px-4 text-center">Kelas</th>
                </tr>
              </thead>
              <tbody>
                {jadwal.map((item, idx) => (
                  <>
                    <tr key={item.id_jadwal} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-blue-50/60"} hover:bg-blue-100/40 transition`}>
                    <td className="py-2 px-4">
                      <span className="font-mono text-xs text-gray-500">{item.kode_matakuliah}</span>
                      <p className="font-medium text-gray-800 text-sm">{item.nama_matakuliah}</p>
                    </td>
                    <td className="py-2 px-4 text-gray-600 text-xs">{getKelasStr(item)}</td>
                    <td className="py-2 px-4 text-gray-600 text-xs">{getDosStr(item)}</td>
                    <td className="py-2 px-4 text-gray-600 text-xs">Smt {item.semester} / {item.tahun_ajaran}</td>
                    <td className="py-2 px-4 text-gray-700">{item.hari}</td>
                    <td className="py-2 px-4 text-gray-700 whitespace-nowrap">
                      <Clock className="h-4 w-4 text-blue-500 inline mr-1" />
                      {formatTime(item.jam_mulai)} - {formatTime(item.jam_selesai)}
                    </td>
                    <td className="py-2 px-4 text-gray-700">
                      <MapPin className="h-4 w-4 text-blue-500 inline mr-1" />{item.ruangan || "-"}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-2 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openModal(item)} title="Edit jadwal" className="text-blue-600 hover:text-blue-800 transition p-1 rounded hover:bg-blue-50"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => { setDeleteTarget(item); setShowDeleteModal(true); }} title="Hapus jadwal" className="text-red-600 hover:text-red-800 transition p-1 rounded hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    )}
                    <td className="py-2 px-4 text-center">
                      <button onClick={() => toggleExpandJadwal(item)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mx-auto">
                        <Users className="h-4 w-4" />
                        {item.kelas_list?.length || 0}
                        {expandedJadwal === item.id_jadwal ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </td>
                  </tr>
                  {expandedJadwal === item.id_jadwal && (
                    <tr key={`expand-${item.id_jadwal}`}>
                      <td colSpan={isSuperAdmin ? 9 : 8} className="bg-blue-50/80 px-6 py-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-blue-600" /> Kelola Kelas untuk Jadwal ini</p>
                        {loadingKelas ? <p className="text-xs text-gray-500">Memuat...</p> : (
                          <>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {(kelasByJadwal[item.id_jadwal] || item.kelas_list || []).map(k => (
                                <span key={k.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
                                  {k.nama_kelas}
                                  {isSuperAdmin && (
                                    <button onClick={() => handleRemoveKelas(item, k.id)} className="ml-1 text-red-500 hover:text-red-700"><X className="h-3 w-3" /></button>
                                  )}
                                </span>
                              ))}
                              {(kelasByJadwal[item.id_jadwal] || item.kelas_list || []).length === 0 && (
                                <span className="text-xs text-gray-400 italic">Belum ada kelas</span>
                              )}
                            </div>
                            {isSuperAdmin && (
                              <div className="flex items-center gap-2">
                                <select
                                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                  defaultValue=""
                                  onChange={e => { if (e.target.value) { handleAddKelasToJadwal(item, e.target.value); e.target.value = ""; } }}
                                >
                                  <option value="">+ Tambah Kelas...</option>
                                  {kelasList.filter(k => !(kelasByJadwal[item.id_jadwal] || item.kelas_list || []).some(pk => pk.nama_kelas === k.nama_kelas)).map(k => (
                                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-xl font-semibold">{isEditMode ? "Edit Jadwal" : "Tambah Jadwal"}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {!isEditMode ? (
                <>
                  {/* === FORM TAMBAH BARU === */}
                  {/* Pilih Mata Kuliah */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <BookOpen className="h-4 w-4 inline mr-1 text-blue-600" />
                      Mata Kuliah <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={inputClass}
                      value={formData.id_matakuliah}
                      onChange={e => {
                        const idMK = e.target.value;
                        const existing = penawaranList.find(p => p.id_matakuliah === parseInt(idMK));
                        if (existing) {
                          setFormData({ ...formData, id_matakuliah: idMK, semester: existing.semester, tahun_ajaran: existing.tahun_ajaran });
                          setHasExistingPenawaran(true);
                        } else {
                          setFormData({ ...formData, id_matakuliah: idMK, semester: "", tahun_ajaran: getCurrentTA() });
                          setHasExistingPenawaran(false);
                        }
                      }}
                      required
                    >
                      <option value="">-- Pilih Mata Kuliah --</option>
                      {mataKuliahList.map(mk => (
                        <option key={mk.id_matakuliah} value={mk.id_matakuliah}>
                          {mk.kode_matakuliah} — {mk.nama_matakuliah} ({mk.sks} SKS)
                        </option>
                      ))}
                    </select>
                    {mataKuliahList.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">⚠ Belum ada mata kuliah.</p>
                    )}
                  </div>

                  {/* Semester & Tahun Ajaran */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Semester <span className="text-red-500">*</span></label>
                      <select
                        className={`${inputClass} ${hasExistingPenawaran ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        value={formData.semester}
                        onChange={e => setFormData({ ...formData, semester: e.target.value })}
                        required
                        disabled={hasExistingPenawaran}
                      >
                        <option value="">-- Pilih --</option>
                        {[1,2,3,4,5,6,7,8].map(s => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tahun Ajaran <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className={`${inputClass} ${hasExistingPenawaran ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        value={formData.tahun_ajaran}
                        onChange={e => setFormData({ ...formData, tahun_ajaran: e.target.value })}
                        placeholder="Contoh: 2024/2025"
                        required
                        disabled={hasExistingPenawaran}
                      />
                    </div>
                  </div>

                  {/* Kelas */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Users className="h-4 w-4 inline mr-1 text-blue-600" />
                      Kelas (opsional)
                    </label>
                    <select
                      className={inputClass}
                      value={formData.id_kelas}
                      onChange={e => setFormData({ ...formData, id_kelas: e.target.value })}
                    >
                      <option value="">-- Pilih Kelas (opsional) --</option>
                      {kelasList.map(k => (
                        <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Kelas dapat ditambahkan nanti di tabel jadwal</p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                    {hasExistingPenawaran ? (
                        <p>ℹ️ <b>Semester</b> dan <b>Tahun Ajaran</b> mengikuti data Penawaran Mata Kuliah yang sudah ada.</p>
                    ) : (
                        <p>ℹ️ Sistem akan otomatis membuat <b>Penawaran Mata Kuliah</b> baru karena belum ada penawaran untuk mata kuliah ini.</p>
                    )}
                  </div>
                </>
              ) : (
                /* === FORM EDIT === */
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  <p><span className="font-semibold">MK:</span> {selectedJadwal?.kode_matakuliah} — {selectedJadwal?.nama_matakuliah}</p>
                  <p><span className="font-semibold">Semester {selectedJadwal?.semester}</span> / {selectedJadwal?.tahun_ajaran}</p>
                </div>
              )}

              {/* Hari */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hari <span className="text-red-500">*</span></label>
                <select
                  className={inputClass}
                  value={isEditMode ? editFormData.hari : formData.hari}
                  onChange={e => isEditMode
                    ? setEditFormData({ ...editFormData, hari: e.target.value })
                    : setFormData({ ...formData, hari: e.target.value })
                  }
                >
                  {["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Jam Mulai & Selesai */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Jam Mulai <span className="text-red-500">*</span></label>
                  <input
                    type="time"
                    className={inputClass}
                    value={isEditMode ? editFormData.jam_mulai : formData.jam_mulai}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        const [, m] = val.split(':');
                        if (parseInt(m, 10) > 59) return;
                      }
                      
                      if (isEditMode) {
                        if (editFormData.jam_selesai && val > editFormData.jam_selesai) {
                          notify("error", "Jam mulai tidak boleh melebihi jam selesai");
                          return;
                        }
                        setEditFormData({ ...editFormData, jam_mulai: val });
                      } else {
                        if (formData.jam_selesai && val > formData.jam_selesai) {
                          notify("error", "Jam mulai tidak boleh melebihi jam selesai");
                          return;
                        }
                        setFormData({ ...formData, jam_mulai: val });
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Jam Selesai <span className="text-red-500">*</span></label>
                  <input
                    type="time"
                    className={inputClass}
                    value={isEditMode ? editFormData.jam_selesai : formData.jam_selesai}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        const [, m] = val.split(':');
                        if (parseInt(m, 10) > 59) return;
                      }
                      
                      if (isEditMode) {
                        if (editFormData.jam_mulai && val < editFormData.jam_mulai) {
                          notify("error", "Jam selesai tidak boleh kurang dari jam mulai");
                          return;
                        }
                        setEditFormData({ ...editFormData, jam_selesai: val });
                      } else {
                        if (formData.jam_mulai && val < formData.jam_mulai) {
                          notify("error", "Jam selesai tidak boleh kurang dari jam mulai");
                          return;
                        }
                        setFormData({ ...formData, jam_selesai: val });
                      }
                    }}
                    required
                  />
                </div>
              </div>

              {/* Ruangan */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ruangan</label>
                <input
                  type="text"
                  className={inputClass}
                  value={isEditMode ? editFormData.ruangan : formData.ruangan}
                  onChange={e => isEditMode
                    ? setEditFormData({ ...editFormData, ruangan: e.target.value })
                    : setFormData({ ...formData, ruangan: e.target.value })
                  }
                  placeholder="Contoh: R-201, Lab Komputer 1"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50">
                  {loading ? "Menyimpan..." : isEditMode ? "Perbarui" : "Simpan Jadwal"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full"><AlertCircle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Hapus jadwal <span className="font-semibold">{deleteTarget?.nama_matakuliah} — {deleteTarget?.hari}</span>?
              <br />
              <span className="text-sm text-red-600 mt-2 block">Semua pertemuan dan presensi terkait akan ikut terhapus.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={loading} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50">
                {loading ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
