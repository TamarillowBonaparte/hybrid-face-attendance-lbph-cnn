import Swal from "sweetalert2";
// src/pages/kelolaMasterData.jsx
import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import {
    School, GraduationCap, Layers, Plus, Edit, Trash2, X, AlertCircle, Users, BookOpen
} from "lucide-react";
import {
    getProdiList, createProdi, updateProdi, deleteProdi,
    getAngkatanList, createAngkatan, updateAngkatan, deleteAngkatan,
    getGolonganList, createGolongan, updateGolongan, deleteGolongan,
} from "../utils/apiUtils";
import { getUser } from "../utils/auth";

export default function KelolaMasterData() {
    const [activeNav, setActiveNav] = useState("kelola-master-data");
    const [activeTab, setActiveTab] = useState("prodi");
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    // Prodi state
    const [prodiList, setProdiList] = useState([]);
    const [showProdiModal, setShowProdiModal] = useState(false);
    const [prodiFormMode, setProdiFormMode] = useState("add");
    const [selectedProdi, setSelectedProdi] = useState(null);
    const [prodiForm, setProdiForm] = useState({ kode_prodi: '', nama_prodi: '', jenjang: 'S1' });

    // Angkatan state
    const [angkatanList, setAngkatanList] = useState([]);
    const [showAngkatanModal, setShowAngkatanModal] = useState(false);
    const [angkatanFormMode, setAngkatanFormMode] = useState("add");
    const [selectedAngkatan, setSelectedAngkatan] = useState(null);
    const [angkatanForm, setAngkatanForm] = useState({ tahun_angkatan: new Date().getFullYear() });

    // Golongan state
    const [golonganList, setGolonganList] = useState([]);
    const [showGolonganModal, setShowGolonganModal] = useState(false);
    const [golonganFormMode, setGolonganFormMode] = useState("add");
    const [selectedGolongan, setSelectedGolongan] = useState(null);
    const [golonganForm, setGolonganForm] = useState({ nama_golongan: '' });

    // Delete modals
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [loading, setLoading] = useState(false);

    const currentUser = getUser() || {};
    const isAdmin = currentUser.role === 'admin';

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [prodi, angkatan, golongan] = await Promise.all([
                getProdiList(), getAngkatanList(), getGolonganList()
            ]);
            setProdiList(prodi || []);
            setAngkatanList(angkatan || []);
            setGolonganList(golongan || []);
        } catch (error) {
            showNotification('error', 'Gagal memuat data master');
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

    // ===== PRODI CRUD =====
    const openAddProdi = () => {
        setProdiFormMode("add");
        setSelectedProdi(null);
        setProdiForm({ kode_prodi: '', nama_prodi: '', jenjang: 'S1' });
        setShowProdiModal(true);
    };

    const openEditProdi = (item) => {
        setProdiFormMode("edit");
        setSelectedProdi(item);
        setProdiForm({
            kode_prodi: item.kode_prodi || '',
            nama_prodi: item.nama_prodi || '',
            jenjang: item.jenjang || 'S1',
        });
        setShowProdiModal(true);
    };

    const handleSaveProdi = async (e) => {
        e.preventDefault();
        if (!prodiForm.kode_prodi.trim() || !prodiForm.nama_prodi.trim()) {
            showNotification('error', 'Kode dan Nama Prodi wajib diisi');
            return;
        }
        try {
            setLoading(true);
            if (prodiFormMode === "add") {
                await createProdi(prodiForm);
                showNotification('success', 'Prodi berhasil ditambahkan');
            } else {
                await updateProdi(selectedProdi.id_prodi, prodiForm);
                showNotification('success', 'Prodi berhasil diperbarui');
            }
            setShowProdiModal(false);
            const data = await getProdiList();
            setProdiList(data || []);
        } catch (error) {
            showNotification('error', error.message || 'Gagal menyimpan prodi');
        } finally {
            setLoading(false);
        }
    };

    // ===== ANGKATAN CRUD =====
    const openAddAngkatan = () => {
        setAngkatanFormMode("add");
        setSelectedAngkatan(null);
        setAngkatanForm({ tahun_angkatan: new Date().getFullYear() });
        setShowAngkatanModal(true);
    };

    const openEditAngkatan = (item) => {
        setAngkatanFormMode("edit");
        setSelectedAngkatan(item);
        setAngkatanForm({ tahun_angkatan: item.tahun_angkatan });
        setShowAngkatanModal(true);
    };

    const handleSaveAngkatan = async (e) => {
        e.preventDefault();
        if (!angkatanForm.tahun_angkatan) {
            showNotification('error', 'Tahun Angkatan wajib diisi');
            return;
        }
        try {
            setLoading(true);
            if (angkatanFormMode === "add") {
                await createAngkatan({ tahun_angkatan: parseInt(angkatanForm.tahun_angkatan) });
                showNotification('success', 'Angkatan berhasil ditambahkan');
            } else {
                await updateAngkatan(selectedAngkatan.id_angkatan, { tahun_angkatan: parseInt(angkatanForm.tahun_angkatan) });
                showNotification('success', 'Angkatan berhasil diperbarui');
            }
            setShowAngkatanModal(false);
            const data = await getAngkatanList();
            setAngkatanList(data || []);
        } catch (error) {
            showNotification('error', error.message || 'Gagal menyimpan angkatan');
        } finally {
            setLoading(false);
        }
    };

    // ===== GOLONGAN CRUD =====
    const openAddGolongan = () => {
        setGolonganFormMode("add");
        setSelectedGolongan(null);
        setGolonganForm({ nama_golongan: '' });
        setShowGolonganModal(true);
    };

    const openEditGolongan = (item) => {
        setGolonganFormMode("edit");
        setSelectedGolongan(item);
        setGolonganForm({ nama_golongan: item.nama_golongan || '' });
        setShowGolonganModal(true);
    };

    const handleSaveGolongan = async (e) => {
        e.preventDefault();
        if (!golonganForm.nama_golongan.trim()) {
            showNotification('error', 'Nama Golongan wajib diisi');
            return;
        }
        try {
            setLoading(true);
            if (golonganFormMode === "add") {
                await createGolongan(golonganForm);
                showNotification('success', 'Golongan berhasil ditambahkan');
            } else {
                await updateGolongan(selectedGolongan.id_golongan, golonganForm);
                showNotification('success', 'Golongan berhasil diperbarui');
            }
            setShowGolonganModal(false);
            const data = await getGolonganList();
            setGolonganList(data || []);
        } catch (error) {
            showNotification('error', error.message || 'Gagal menyimpan golongan');
        } finally {
            setLoading(false);
        }
    };

    // ===== DELETE =====
    const openDeleteModal = (type, item) => {
        setDeleteTarget({ type, item });
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            setLoading(true);
            const { type, item } = deleteTarget;
            if (type === 'prodi') {
                await deleteProdi(item.id_prodi);
                const data = await getProdiList();
                setProdiList(data || []);
            } else if (type === 'angkatan') {
                await deleteAngkatan(item.id_angkatan);
                const data = await getAngkatanList();
                setAngkatanList(data || []);
            } else if (type === 'golongan') {
                await deleteGolongan(item.id_golongan);
                const data = await getGolonganList();
                setGolonganList(data || []);
            }
            showNotification('success', 'Data berhasil dihapus');
            setShowDeleteModal(false);
            setDeleteTarget(null);
        } catch (error) {
            showNotification('error', error.message || 'Gagal menghapus data');
        } finally {
            setLoading(false);
        }
    };

    const getDeleteLabel = () => {
        if (!deleteTarget) return '';
        const { type, item } = deleteTarget;
        if (type === 'prodi') return `${item.kode_prodi} - ${item.nama_prodi}`;
        if (type === 'angkatan') return `Tahun ${item.tahun_angkatan}`;
        if (type === 'golongan') return item.nama_golongan;
        return '';
    };

    const tabs = [
        { id: "prodi", label: "Program Studi", icon: School, count: prodiList.length },
        { id: "angkatan", label: "Angkatan", icon: GraduationCap, count: angkatanList.length },
        { id: "golongan", label: "Golongan", icon: Layers, count: golonganList.length },
    ];

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
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-xl">
                        <Layers className="h-10 w-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold">Kelola Master Data</h1>
                        <p className="text-blue-100 text-sm">
                            Kelola data Program Studi, Angkatan, dan Golongan
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
                <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? "text-blue-600 border-b-2 border-blue-600"
                                        : "text-gray-600 hover:text-blue-600"
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* ===== PRODI TAB ===== */}
                {activeTab === "prodi" && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <School className="text-blue-600 h-5 w-5" /> Program Studi
                            </h2>
                            {isAdmin && (
                                <button onClick={openAddProdi} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm">
                                    <Plus className="h-4 w-4" /> Tambah Prodi
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-blue-600 text-white">
                                        <th className="py-3 px-4 text-left font-semibold">Kode Prodi</th>
                                        <th className="py-3 px-4 text-left font-semibold">Nama Program Studi</th>
                                        <th className="py-3 px-4 text-center font-semibold">Jenjang</th>
                                        {isAdmin && <th className="py-3 px-4 text-center font-semibold">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {prodiList.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 4 : 3} className="text-center py-12 text-gray-500">
                                                <School className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                <p>Belum ada data Program Studi</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        prodiList.map((p, i) => (
                                            <tr key={p.id_prodi} className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                <td className="py-3 px-4 font-mono text-sm font-semibold">{p.kode_prodi}</td>
                                                <td className="py-3 px-4 text-sm font-medium">{p.nama_prodi}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                                        {p.jenjang || '-'}
                                                    </span>
                                                </td>
                                                {isAdmin && (
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => openEditProdi(p)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
                                                                <Edit className="h-4 w-4" /> Edit
                                                            </button>
                                                            <button onClick={() => openDeleteModal('prodi', p)} className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm">
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
                )}

                {/* ===== ANGKATAN TAB ===== */}
                {activeTab === "angkatan" && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <GraduationCap className="text-green-600 h-5 w-5" /> Angkatan
                            </h2>
                            {isAdmin && (
                                <button onClick={openAddAngkatan} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm">
                                    <Plus className="h-4 w-4" /> Tambah Angkatan
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-green-600 text-white">
                                        <th className="py-3 px-4 text-left font-semibold">No</th>
                                        <th className="py-3 px-4 text-center font-semibold">Tahun Angkatan</th>
                                        {isAdmin && <th className="py-3 px-4 text-center font-semibold">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {angkatanList.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 3 : 2} className="text-center py-12 text-gray-500">
                                                <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                <p>Belum ada data Angkatan</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        angkatanList.map((a, i) => (
                                            <tr key={a.id_angkatan} className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                <td className="py-3 px-4 text-sm">{i + 1}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                                                        {a.tahun_angkatan}
                                                    </span>
                                                </td>
                                                {isAdmin && (
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => openEditAngkatan(a)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
                                                                <Edit className="h-4 w-4" /> Edit
                                                            </button>
                                                            <button onClick={() => openDeleteModal('angkatan', a)} className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm">
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
                )}

                {/* ===== GOLONGAN TAB ===== */}
                {activeTab === "golongan" && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Layers className="text-purple-600 h-5 w-5" /> Golongan
                            </h2>
                            {isAdmin && (
                                <button onClick={openAddGolongan} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm">
                                    <Plus className="h-4 w-4" /> Tambah Golongan
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-purple-600 text-white">
                                        <th className="py-3 px-4 text-left font-semibold">No</th>
                                        <th className="py-3 px-4 text-left font-semibold">Nama Golongan</th>
                                        {isAdmin && <th className="py-3 px-4 text-center font-semibold">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {golonganList.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 3 : 2} className="text-center py-12 text-gray-500">
                                                <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                <p>Belum ada data Golongan</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        golonganList.map((g, i) => (
                                            <tr key={g.id_golongan} className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                <td className="py-3 px-4 text-sm">{i + 1}</td>
                                                <td className="py-3 px-4 text-sm font-medium">{g.nama_golongan}</td>
                                                {isAdmin && (
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => openEditGolongan(g)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
                                                                <Edit className="h-4 w-4" /> Edit
                                                            </button>
                                                            <button onClick={() => openDeleteModal('golongan', g)} className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm">
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
                )}
            </div>

            {/* ===== MODAL PRODI ===== */}
            {showProdiModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">
                                {prodiFormMode === "add" ? "Tambah Program Studi" : "Edit Program Studi"}
                            </h3>
                            <button onClick={() => setShowProdiModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveProdi} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Prodi <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={prodiForm.kode_prodi}
                                    onChange={(e) => setProdiForm({ ...prodiForm, kode_prodi: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Contoh: TIF"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Program Studi <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={prodiForm.nama_prodi}
                                    onChange={(e) => setProdiForm({ ...prodiForm, nama_prodi: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Contoh: Teknik Informatika"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang</label>
                                <select
                                    value={prodiForm.jenjang}
                                    onChange={(e) => setProdiForm({ ...prodiForm, jenjang: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="D3">D3</option>
                                    <option value="D4">D4</option>
                                    <option value="S1">S1</option>
                                    <option value="S2">S2</option>
                                    <option value="S3">S3</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition">
                                    {prodiFormMode === "add" ? "Simpan" : "Perbarui"}
                                </button>
                                <button type="button" onClick={() => setShowProdiModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition">
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== MODAL ANGKATAN ===== */}
            {showAngkatanModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">
                                {angkatanFormMode === "add" ? "Tambah Angkatan" : "Edit Angkatan"}
                            </h3>
                            <button onClick={() => setShowAngkatanModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveAngkatan} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Angkatan <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    value={angkatanForm.tahun_angkatan}
                                    onChange={(e) => setAngkatanForm({ ...angkatanForm, tahun_angkatan: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                                    placeholder="Contoh: 2024"
                                    min="2000"
                                    max="2099"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium transition">
                                    {angkatanFormMode === "add" ? "Simpan" : "Perbarui"}
                                </button>
                                <button type="button" onClick={() => setShowAngkatanModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition">
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== MODAL GOLONGAN ===== */}
            {showGolonganModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">
                                {golonganFormMode === "add" ? "Tambah Golongan" : "Edit Golongan"}
                            </h3>
                            <button onClick={() => setShowGolonganModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveGolongan} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Golongan <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={golonganForm.nama_golongan}
                                    onChange={(e) => setGolonganForm({ ...golonganForm, nama_golongan: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    placeholder="Contoh: A, B, C, Pagi, Siang"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-medium transition">
                                    {golonganFormMode === "add" ? "Simpan" : "Perbarui"}
                                </button>
                                <button type="button" onClick={() => setShowGolonganModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition">
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
                            Apakah Anda yakin ingin menghapus <span className="font-semibold text-gray-900">"{getDeleteLabel()}"</span>?
                            <br />
                            <span className="text-sm text-red-600 mt-2 block">
                                Data yang terkait dengan master data ini mungkin akan terpengaruh. Tindakan ini tidak dapat dibatalkan.
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
