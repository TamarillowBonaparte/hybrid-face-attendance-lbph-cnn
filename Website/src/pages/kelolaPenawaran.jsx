import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { ClipboardList, Plus, Edit, Trash2, X, AlertCircle, Users, School, ChevronDown, ChevronUp } from "lucide-react";
import {
  getPenawaranMKList, createPenawaranMK, updatePenawaranMK, deletePenawaranMK,
  getMataKuliahList, getDosenList, getProdiList, getAngkatanList, getGolonganList,
  addKelasToPenawaran, removeKelasFromPenawaran,
  addPengajar, removePengajar, updatePengajarRole,
} from "../utils/apiUtils";

export default function KelolaPenawaran() {
  const [activeNav, setActiveNav] = useState("penawaran-matakuliah");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });
  const [expanded, setExpanded] = useState({});

  // Dropdown data
  const [mkList, setMkList] = useState([]);
  const [dosenList, setDosenList] = useState([]);
  const [prodiList, setProdiList] = useState([]);
  const [angkatanList, setAngkatanList] = useState([]);
  const [golonganList, setGolonganList] = useState([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Sub-forms
  const [showKelasForm, setShowKelasForm] = useState(null);
  const [showPengajarForm, setShowPengajarForm] = useState(null);
  const [kelasForm, setKelasForm] = useState({ id_prodi: "", id_angkatan: "", id_golongan: "" });
  const [pengajarForm, setPengajarForm] = useState({ id_dosen: "", role: "anggota" });

  const [form, setForm] = useState({ id_matakuliah: "", semester: "", tahun_ajaran: "", status: "aktif" });

  const notify = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: "", message: "" }), 3000);
  };

  useEffect(() => {
    fetchAll();
    Promise.all([getMataKuliahList(), getDosenList(), getProdiList(), getAngkatanList(), getGolonganList()])
      .then(([mk, ds, pr, ak, gl]) => { setMkList(mk || []); setDosenList(ds || []); setProdiList(pr || []); setAngkatanList(ak || []); setGolonganList(gl || []); })
      .catch(() => {});
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const data = await getPenawaranMKList();
      setList(data || []);
    } catch { notify("error", "Gagal memuat data penawaran"); }
    finally { setLoading(false); }
  };

  const openModal = (item = null) => {
    setIsEdit(!!item); setSelected(item);
    setForm(item ? { id_matakuliah: item.id_matakuliah, semester: item.semester, tahun_ajaran: item.tahun_ajaran, status: item.status } : { id_matakuliah: "", semester: "", tahun_ajaran: "", status: "aktif" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.id_matakuliah || !form.semester || !form.tahun_ajaran) { notify("error", "Semua field wajib diisi"); return; }
    try {
      const payload = { id_matakuliah: parseInt(form.id_matakuliah), semester: parseInt(form.semester), tahun_ajaran: form.tahun_ajaran, status: form.status };
      if (isEdit) { await updatePenawaranMK(selected.id_penawaran, payload); notify("success", "Penawaran diperbarui"); }
      else { await createPenawaranMK(payload); notify("success", "Penawaran ditambahkan"); }
      setShowModal(false); fetchAll();
    } catch (err) { notify("error", err.message || "Gagal menyimpan"); }
  };

  const handleDelete = async () => {
    try { await deletePenawaranMK(deleteTarget.id_penawaran); notify("success", "Penawaran dihapus"); fetchAll(); }
    catch (err) { notify("error", err.message || "Gagal menghapus"); }
    finally { setShowDeleteModal(false); setDeleteTarget(null); }
  };

  const handleAddKelas = async (id_penawaran) => {
    if (!kelasForm.id_prodi || !kelasForm.id_angkatan || !kelasForm.id_golongan) { notify("error", "Lengkapi prodi, angkatan, dan golongan"); return; }
    try {
      await addKelasToPenawaran({ id_penawaran, id_prodi: parseInt(kelasForm.id_prodi), id_angkatan: parseInt(kelasForm.id_angkatan), id_golongan: parseInt(kelasForm.id_golongan) });
      notify("success", "Kelas ditambahkan"); setShowKelasForm(null); setKelasForm({ id_prodi: "", id_angkatan: "", id_golongan: "" }); fetchAll();
    } catch (err) { notify("error", err.message || "Gagal menambah kelas"); }
  };

  const handleRemoveKelas = async (kelas_id) => {
    try { await removeKelasFromPenawaran(kelas_id); notify("success", "Kelas dihapus"); fetchAll(); }
    catch (err) { notify("error", err.message || "Gagal menghapus kelas"); }
  };

  const handleAddPengajar = async (id_penawaran) => {
    if (!pengajarForm.id_dosen) { notify("error", "Pilih dosen"); return; }
    try {
      await addPengajar({ id_penawaran, id_dosen: parseInt(pengajarForm.id_dosen), role: pengajarForm.role });
      notify("success", "Pengajar ditambahkan"); setShowPengajarForm(null); setPengajarForm({ id_dosen: "", role: "anggota" }); fetchAll();
    } catch (err) { notify("error", err.message || "Gagal menambah pengajar"); }
  };

  const handleRemovePengajar = async (pengajar_id) => {
    try { await removePengajar(pengajar_id); notify("success", "Pengajar dihapus"); fetchAll(); }
    catch (err) { notify("error", err.message || "Gagal menghapus pengajar"); }
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm";
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white ${notification.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-8 mb-6 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-xl"><ClipboardList className="h-10 w-10" /></div>
            <div>
              <h1 className="text-2xl font-semibold">Penawaran Mata Kuliah</h1>
              <p className="text-purple-100 text-sm">Kelola penawaran MK, kelas, dan pengajar per semester</p>
            </div>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-white text-purple-600 hover:bg-purple-50 px-5 py-2.5 rounded-lg font-medium shadow-md transition">
            <Plus className="h-5 w-5" /> Tambah Penawaran
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div></div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada penawaran mata kuliah</p>
          </div>
        ) : list.map(item => (
          <div key={item.id_penawaran} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Card Header */}
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => toggle(item.id_penawaran)} className="text-purple-600 hover:text-purple-800 transition">
                  {expanded[item.id_penawaran] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{item.kode_matakuliah}</span>
                    <h3 className="font-semibold text-gray-800">{item.nama_matakuliah}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.status === "aktif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{item.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Semester {item.semester} · TA {item.tahun_ajaran} · {item.kelas_list?.length || 0} kelas · {item.pengajar_list?.length || 0} pengajar</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition"><Edit className="h-4 w-4" /></button>
                <button onClick={() => { setDeleteTarget(item); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Expanded Detail */}
            {expanded[item.id_penawaran] && (
              <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50">
                {/* Kelas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2"><School className="h-4 w-4 text-blue-500" /> Kelas</h4>
                    <button onClick={() => setShowKelasForm(item.id_penawaran === showKelasForm ? null : item.id_penawaran)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition">+ Tambah</button>
                  </div>
                  {showKelasForm === item.id_penawaran && (
                    <div className="bg-white rounded-lg p-3 mb-3 border border-blue-200 space-y-2">
                      <select className={selectClass} value={kelasForm.id_prodi} onChange={e => setKelasForm({...kelasForm, id_prodi: e.target.value})}>
                        <option value="">-- Prodi --</option>
                        {prodiList.map(p => <option key={p.id_prodi} value={p.id_prodi}>{p.kode_prodi} - {p.nama_prodi}</option>)}
                      </select>
                      <select className={selectClass} value={kelasForm.id_angkatan} onChange={e => setKelasForm({...kelasForm, id_angkatan: e.target.value})}>
                        <option value="">-- Angkatan --</option>
                        {angkatanList.map(a => <option key={a.id_angkatan} value={a.id_angkatan}>{a.tahun_angkatan}</option>)}
                      </select>
                      <select className={selectClass} value={kelasForm.id_golongan} onChange={e => setKelasForm({...kelasForm, id_golongan: e.target.value})}>
                        <option value="">-- Golongan --</option>
                        {golonganList.map(g => <option key={g.id_golongan} value={g.id_golongan}>{g.nama_golongan}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddKelas(item.id_penawaran)} className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Simpan</button>
                        <button onClick={() => setShowKelasForm(null)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-300 transition">Batal</button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(item.kelas_list || []).length === 0 ? <p className="text-sm text-gray-400 italic">Belum ada kelas</p> : (item.kelas_list || []).map(k => (
                      <div key={k.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm">
                        <span className="font-medium text-gray-700">{k.nama_kelas || `${k.kode_prodi}-${k.tahun_angkatan}-${k.nama_golongan}`}</span>
                        <button onClick={() => handleRemoveKelas(k.id)} className="text-red-400 hover:text-red-600 transition ml-2"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pengajar */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2"><Users className="h-4 w-4 text-green-500" /> Pengajar</h4>
                    <button onClick={() => setShowPengajarForm(item.id_penawaran === showPengajarForm ? null : item.id_penawaran)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition">+ Tambah</button>
                  </div>
                  {showPengajarForm === item.id_penawaran && (
                    <div className="bg-white rounded-lg p-3 mb-3 border border-green-200 space-y-2">
                      <select className={selectClass} value={pengajarForm.id_dosen} onChange={e => setPengajarForm({...pengajarForm, id_dosen: e.target.value})}>
                        <option value="">-- Pilih Dosen --</option>
                        {dosenList.map(d => <option key={d.id_dosen} value={d.id_dosen}>{d.nama_dosen} ({d.nidn})</option>)}
                      </select>
                      <select className={selectClass} value={pengajarForm.role} onChange={e => setPengajarForm({...pengajarForm, role: e.target.value})}>
                        <option value="koordinator">Koordinator</option>
                        <option value="anggota">Anggota</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddPengajar(item.id_penawaran)} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition">Simpan</button>
                        <button onClick={() => setShowPengajarForm(null)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-300 transition">Batal</button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(item.pengajar_list || []).length === 0 ? <p className="text-sm text-gray-400 italic">Belum ada pengajar</p> : (item.pengajar_list || []).map(g => (
                      <div key={g.id_pengajar} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">{g.nama_dosen}</span>
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${g.role === "koordinator" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>{g.role}</span>
                        </div>
                        <button onClick={() => handleRemovePengajar(g.id_pengajar)} className="text-red-400 hover:text-red-600 transition ml-2"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-lg font-semibold">{isEdit ? "Edit Penawaran" : "Tambah Penawaran"}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mata Kuliah *</label>
                <select className={selectClass} value={form.id_matakuliah} onChange={e => setForm({...form, id_matakuliah: e.target.value})} required>
                  <option value="">-- Pilih MK --</option>
                  {mkList.map(mk => <option key={mk.id_matakuliah} value={mk.id_matakuliah}>{mk.kode_matakuliah} - {mk.nama_matakuliah}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
                  <input type="number" min="1" max="8" className={inputClass} value={form.semester} onChange={e => setForm({...form, semester: e.target.value})} placeholder="1-8" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Ajaran *</label>
                  <input type="text" className={inputClass} value={form.tahun_ajaran} onChange={e => setForm({...form, tahun_ajaran: e.target.value})} placeholder="2024/2025" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className={selectClass} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Non-aktif</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-medium transition">
                  {isEdit ? "Perbarui" : "Simpan"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full"><AlertCircle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">Hapus penawaran <span className="font-semibold">{deleteTarget?.nama_matakuliah}</span> (Semester {deleteTarget?.semester})? Semua kelas dan pengajar terkait akan terhapus.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition">Batal</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
