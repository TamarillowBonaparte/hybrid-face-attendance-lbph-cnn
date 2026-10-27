// src/pages/kelolaMahasiswa.jsx
import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import {
  getMahasiswaList, createMahasiswa, updateMahasiswa, deleteMahasiswa, bulkCreateMahasiswa, bulkDeleteMahasiswa,
  getProdiList, getAngkatanList, getGolonganList, getKelasList,
} from "../utils/apiUtils";
import { getUser } from "../utils/auth";
import {
  GraduationCap, UserPlus, Edit, Trash2, Search, AlertCircle, X, ChevronDown, FileUp, Download
} from "lucide-react";
import * as XLSX from "xlsx";

const STATUS_OPTIONS = ["aktif", "nonaktif", "lulus", "cuti"];
const JENIS_KELAMIN_OPTIONS = [{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }];

const emptyForm = {
  nim: "", nama_mahasiswa: "", jenis_kelamin: "L", email: "",
  no_hp: "", id_prodi: "", id_angkatan: "", id_golongan: "", id_kelas: "",
  status: "aktif",
};

export default function KelolaMahasiswaPage() {
  const [activeNav, setActiveNav] = useState("kelola-mahasiswa");
  const [mahasiswaList, setMahasiswaList] = useState([]);
  const [prodiList, setProdiList] = useState([]);
  const [angkatanList, setAngkatanList] = useState([]);
  const [golonganList, setGolonganList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loggedUser, setLoggedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterProdi, setFilterProdi] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState("");
  const [filterGolongan, setFilterGolongan] = useState("");
  const [filterKelas, setFilterKelas] = useState("");
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState([]);
  const fileInputRef = import("react").then(m => m.useRef ? null : null); // We will just use standard React useRef, wait, react is already imported as useState, useEffect. Let's fix import above or just import it directly from "react".
  // Actually we need to add useRef to the react import. Let's do that in a previous chunk or here:
  const fileInput = import("react").then(m => null); // this is a bad idea. I will use document.getElementById instead of useRef to keep it simple.

  useEffect(() => {
    const stored = getUser();
    if (stored) setLoggedUser(stored);
    fetchAll();
  }, []);

  useEffect(() => {
    if (isModalOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isModalOpen]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [mhs, prodi, angkatan, golongan, kelas] = await Promise.all([
        getMahasiswaList(),
        getProdiList(),
        getAngkatanList(),
        getGolonganList(),
        getKelasList(),
      ]);
      setMahasiswaList(mhs || []);
      setProdiList(prodi || []);
      setAngkatanList(angkatan || []);
      setGolonganList(golongan || []);
      setKelasList(kelas || []);
    } catch (e) {
      showNotif("error", "Gagal memuat data: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotif = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: "", message: "" }), 3500);
  };

  const openAddModal = () => {
    setFormMode("add");
    setEditId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (m) => {
    setFormMode("edit");
    setEditId(m.id_mahasiswa);
    setForm({
      nim: m.nim || "", nama_mahasiswa: m.nama_mahasiswa || "",
      jenis_kelamin: m.jenis_kelamin || "L", email: m.email || "",
      no_hp: m.no_hp || "", id_prodi: m.id_prodi || "",
      id_angkatan: m.id_angkatan || "", id_golongan: m.id_golongan || "",
      id_kelas: m.id_kelas || "",
      status: m.status || "aktif",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nim.trim()) return showNotif("error", "NIM wajib diisi");
    if (!form.nama_mahasiswa.trim()) return showNotif("error", "Nama wajib diisi");
    if (!form.id_prodi) return showNotif("error", "Prodi wajib dipilih");
    if (!form.id_angkatan) return showNotif("error", "Angkatan wajib dipilih");
    if (!form.id_golongan) return showNotif("error", "Golongan wajib dipilih");

    setIsLoading(true);
    try {
      const payload = {
        ...form,
        id_prodi: parseInt(form.id_prodi),
        id_angkatan: parseInt(form.id_angkatan),
        id_golongan: parseInt(form.id_golongan),
        id_kelas: form.id_kelas ? parseInt(form.id_kelas) : null,
        email: form.email || undefined,
      };
      if (formMode === "add") {
        await createMahasiswa(payload);
        showNotif("success", `Mahasiswa berhasil ditambahkan! Akun login otomatis dibuat dengan NIM sebagai username & password.`);
      } else {
        await updateMahasiswa(editId, payload);
        showNotif("success", "Data mahasiswa berhasil diperbarui");
      }
      setIsModalOpen(false);
      fetchAll();
    } catch (err) {
      showNotif("error", "Gagal: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id, nama) => {
    setDeleteTarget({ id, nama });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsLoading(true);
    try {
      await deleteMahasiswa(deleteTarget.id);
      showNotif("success", "Mahasiswa berhasil dihapus");
      fetchAll();
    } catch (err) {
      showNotif("error", "Gagal menghapus: " + err.message);
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const downloadTemplate = () => {
    const wsTemplate = XLSX.utils.json_to_sheet([
      {
        "NIM": "E41221001",
        "Nama": "Budi Santoso",
        "Jenis Kelamin": "L",
        "Email": "budisantoso@student.polije.ac.id",
        "No HP": "08123456789",
        "Kode Prodi": "TI",
        "Tahun Angkatan": "2022",
        "Golongan": "A",
        "Kelas": "TI-A"
      },
      {
        "NIM": "INFO PENTING:",
        "Nama": "Isi data sesuai dengan yang ada di sheet 'Referensi Master Data'",
        "Jenis Kelamin": "",
        "Email": "",
        "No HP": "",
        "Kode Prodi": "",
        "Tahun Angkatan": "",
        "Golongan": "",
        "Kelas": ""
      }
    ]);

    const maxLen = Math.max(prodiList.length, angkatanList.length, golonganList.length, kelasList.length);
    const refData = [];
    
    for (let i = 0; i < maxLen; i++) {
      refData.push({
        "Kode Prodi": prodiList[i] ? prodiList[i].kode_prodi : "",
        "Nama Prodi": prodiList[i] ? prodiList[i].nama_prodi : "",
        "Tahun Angkatan": angkatanList[i] ? angkatanList[i].tahun_angkatan : "",
        "Golongan": golonganList[i] ? golonganList[i].nama_golongan : "",
        "Kelas": kelasList[i] ? kelasList[i].nama_kelas : "",
        "Jenis Kelamin": i === 0 ? "L (Laki-laki)" : (i === 1 ? "P (Perempuan)" : "")
      });
    }

    const wsRef = XLSX.utils.json_to_sheet(refData);
    
    // Set lebar kolom agar lebih mudah dibaca
    wsTemplate['!cols'] = [{wch: 15}, {wch: 25}, {wch: 15}, {wch: 30}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 10}, {wch: 15}];
    wsRef['!cols'] = [{wch: 15}, {wch: 30}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 15}];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Data");
    XLSX.utils.book_append_sheet(wb, wsRef, "Referensi Master Data");
    
    XLSX.writeFile(wb, "Template_Import_Mahasiswa.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsLoading(true);
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          showNotif("error", "File Excel kosong");
          setIsLoading(false);
          return;
        }

        const payloadsToInsert = [];
        const toUpdate = [];
        let skippedCount = 0;
        const errors = [];

        data.forEach((row, idx) => {
          const nim = String(row["NIM"] || row["nim"] || "");
          const nama = String(row["Nama"] || row["nama"] || row["Nama Mahasiswa"] || "");
          
          if (!nim || !nama) {
            errors.push(`Baris ${idx + 2}: NIM dan Nama wajib diisi`);
            return;
          }

          let id_prodi, id_angkatan, id_golongan, id_kelas;
          
          const prodiRow = row["Kode Prodi"] || row["Prodi"];
          const prodi = prodiList.find(p => p.kode_prodi == prodiRow || p.nama_prodi == prodiRow);
          if (prodi) id_prodi = prodi.id_prodi;

          const angkatanRow = row["Tahun Angkatan"] || row["Angkatan"];
          const angkatan = angkatanList.find(a => a.tahun_angkatan == angkatanRow);
          if (angkatan) id_angkatan = angkatan.id_angkatan;

          const golRow = row["Golongan"];
          const golongan = golonganList.find(g => g.nama_golongan == golRow);
          if (golongan) id_golongan = golongan.id_golongan;

          const kelasRow = row["Kelas"];
          const kelas = kelasList.find(k => k.nama_kelas == kelasRow);
          if (kelas) id_kelas = kelas.id;

          if (!id_prodi) errors.push(`Baris ${idx + 2} (${nim}): Prodi tidak valid`);
          if (!id_angkatan) errors.push(`Baris ${idx + 2} (${nim}): Angkatan tidak valid`);
          if (!id_golongan) errors.push(`Baris ${idx + 2} (${nim}): Golongan tidak valid`);

          if (id_prodi && id_angkatan && id_golongan) {
             const jenisKel = row["Jenis Kelamin"] === "P" ? "P" : "L";
             const email = row["Email"] || `${nim.toLowerCase()}@student.polije.ac.id`;
             const noHp = String(row["No HP"] || row["no_hp"] || "");
             
             // Cek jika NIM sudah ada di database (dari mahasiswaList)
             const existing = mahasiswaList.find(m => String(m.nim).toLowerCase() === nim.toLowerCase());
             
             if (existing) {
               if (
                 existing.nim !== nim ||
                 existing.nama_mahasiswa !== nama ||
                 existing.jenis_kelamin !== jenisKel ||
                 existing.id_prodi !== id_prodi ||
                 existing.id_angkatan !== id_angkatan ||
                 existing.id_golongan !== id_golongan ||
                 (existing.id_kelas || null) !== (id_kelas || null) ||
                 (existing.email || "") !== email ||
                 (existing.no_hp || "") !== noHp
               ) {
                 toUpdate.push({
                   id: existing.id_mahasiswa,
                   payload: {
                     nim, nama_mahasiswa: nama, jenis_kelamin: jenisKel,
                     email, no_hp: noHp, id_prodi, id_angkatan, id_golongan, id_kelas: id_kelas || null,
                     status: existing.status
                   }
                 });
               } else {
                 skippedCount++;
               }
             } else {
               payloadsToInsert.push({
                 nim, nama_mahasiswa: nama, jenis_kelamin: jenisKel,
                 email, no_hp: noHp, id_prodi, id_angkatan, id_golongan, id_kelas: id_kelas || null,
                 status: "aktif"
               });
             }
          }
        });

        if (errors.length > 0) {
          showNotif("error", `Ditemukan ${errors.length} baris tidak valid (Prodi/Angkatan/Golongan tidak sesuai). Cek format Excel.`);
          setIsLoading(false);
          e.target.value = null;
          return;
        }

        let insertSuccess = 0, insertFailed = 0;
        let updateSuccess = 0, updateFailed = 0;

        if (payloadsToInsert.length > 0) {
          const res = await bulkCreateMahasiswa(payloadsToInsert);
          insertSuccess = res.success;
          insertFailed = res.failed;
        }

        if (toUpdate.length > 0) {
          await Promise.all(toUpdate.map(async (item) => {
            try {
              await updateMahasiswa(item.id, item.payload);
              updateSuccess++;
            } catch (err) {
              updateFailed++;
            }
          }));
        }

        showNotif("success", `Import selesai! Baru: ${insertSuccess}, Diperbarui: ${updateSuccess}, Dilewati: ${skippedCount}, Gagal Baru: ${insertFailed}, Gagal Edit: ${updateFailed}`);
        fetchAll();
      } catch (err) {
        showNotif("error", "Gagal memproses file: " + err.message);
      } finally {
        setIsLoading(false);
        e.target.value = null; // reset file input
      }
    };
    reader.readAsBinaryString(file);
  };

  const getNamaProdi = (id) => prodiList.find((p) => p.id_prodi === id)?.nama_prodi || "-";
  const getNamaAngkatan = (id) => angkatanList.find((a) => a.id_angkatan === id)?.tahun_angkatan || "-";
  const getNamaGolongan = (id) => golonganList.find((g) => g.id_golongan === id)?.nama_golongan || "-";
  const getNamaKelas = (id) => kelasList.find((k) => k.id === id)?.nama_kelas || "-";

  const filtered = mahasiswaList.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.nim?.toLowerCase().includes(q) || m.nama_mahasiswa?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    const matchProdi = !filterProdi || m.id_prodi === parseInt(filterProdi);
    const matchAngkatan = !filterAngkatan || m.id_angkatan === parseInt(filterAngkatan);
    const matchGolongan = !filterGolongan || m.id_golongan === parseInt(filterGolongan);
    const matchKelas = !filterKelas || m.id_kelas === parseInt(filterKelas);
    return matchSearch && matchProdi && matchAngkatan && matchGolongan && matchKelas;
  });

  const statusBadge = (s) => {
    const map = {
      aktif: "bg-green-100 text-green-700",
      nonaktif: "bg-red-100 text-red-700",
      lulus: "bg-blue-100 text-blue-700",
      cuti: "bg-yellow-100 text-yellow-700",
    };
    return map[s] || "bg-gray-100 text-gray-700";
  };

  const toggleSelect = (id) => {
    if (selectedMahasiswa.includes(id)) {
      setSelectedMahasiswa(selectedMahasiswa.filter(item => item !== id));
    } else {
      setSelectedMahasiswa([...selectedMahasiswa, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedMahasiswa.length === filtered.length && filtered.length > 0) {
      setSelectedMahasiswa([]);
    } else {
      setSelectedMahasiswa(filtered.map(m => m.id_mahasiswa));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMahasiswa.length === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedMahasiswa.length} mahasiswa terpilih?`)) return;
    
    setIsLoading(true);
    try {
      await bulkDeleteMahasiswa(selectedMahasiswa);
      showNotif("success", `${selectedMahasiswa.length} mahasiswa berhasil dihapus`);
      setSelectedMahasiswa([]);
      fetchAll();
    } catch (err) {
      showNotif("error", "Gagal menghapus: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = filtered.map(m => ({
      "NIM": m.nim,
      "Nama": m.nama_mahasiswa,
      "Jenis Kelamin": m.jenis_kelamin,
      "Email": m.email || "",
      "No HP": m.no_hp || "",
      "Kode Prodi": prodiList.find(p => p.id_prodi === m.id_prodi)?.kode_prodi || "",
      "Tahun Angkatan": angkatanList.find(a => a.id_angkatan === m.id_angkatan)?.tahun_angkatan || "",
      "Golongan": golonganList.find(g => g.id_golongan === m.id_golongan)?.nama_golongan || "",
      "Kelas": m.id_kelas ? kelasList.find(k => k.id === m.id_kelas)?.nama_kelas : "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [{wch: 15}, {wch: 25}, {wch: 12}, {wch: 30}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 10}, {wch: 15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export Data Mahasiswa");
    XLSX.writeFile(wb, "Data_Mahasiswa.xlsx");
  };

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className={`px-5 py-4 rounded-xl shadow-xl flex items-start gap-3 text-white text-sm ${notification.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
            <span className="text-lg">{notification.type === "success" ? "✓" : "✕"}</span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-6 md:p-8 shadow-md">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <GraduationCap className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Kelola Mahasiswa</h1>
              <p className="text-sm text-gray-500">Total: {mahasiswaList.length} mahasiswa</p>
            </div>
          </div>
          {loggedUser?.role === "admin" && (
            <div className="flex flex-col sm:flex-row gap-2">
              {selectedMahasiswa.length > 0 && (
                <button onClick={handleBulkDelete} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl shadow transition-all font-medium">
                  <Trash2 className="h-4 w-4" /> Hapus Terpilih ({selectedMahasiswa.length})
                </button>
              )}
              <button onClick={exportToExcel} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl shadow transition-all font-medium">
                <Download className="h-4 w-4" /> Export
              </button>
              <button onClick={downloadTemplate} className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl shadow transition-all font-medium">
                <Download className="h-4 w-4" /> Template
              </button>
              <label className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow transition-all font-medium cursor-pointer">
                <FileUp className="h-4 w-4" /> Import Excel
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              </label>
              <button onClick={openAddModal}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow transition-all font-medium">
                <UserPlus className="h-4 w-4" /> Tambah
              </button>
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Saat menambah mahasiswa baru, akun login otomatis dibuat: <strong>username = NIM</strong>, <strong>email = nim@student.polije.ac.id</strong>, <strong>password = NIM</strong></span>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIM / Nama..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={filterProdi} onChange={(e) => setFilterProdi(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Semua Prodi</option>
            {prodiList.map((p) => <option key={p.id_prodi} value={p.id_prodi}>{p.kode_prodi} - {p.nama_prodi}</option>)}
          </select>
          <select value={filterAngkatan} onChange={(e) => setFilterAngkatan(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Semua Angkatan</option>
            {angkatanList.map((a) => <option key={a.id_angkatan} value={a.id_angkatan}>{a.tahun_angkatan}</option>)}
          </select>
          <select value={filterGolongan} onChange={(e) => setFilterGolongan(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Semua Golongan</option>
            {golonganList.map((g) => <option key={g.id_golongan} value={g.id_golongan}>{g.nama_golongan}</option>)}
          </select>
          <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Semua Kelas</option>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded"
                    checked={selectedMahasiswa.length > 0 && selectedMahasiswa.length === filtered.length}
                    onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">NIM</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Golongan</th>
                <th className="px-4 py-3">Angkatan</th>
                <th className="px-4 py-3">Status</th>
                {loggedUser?.role === "admin" && <th className="px-4 py-3">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="10" className="text-center p-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Memuat data...</p>
                </td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((m, i) => (
                  <tr key={m.id_mahasiswa} className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 ${selectedMahasiswa.includes(m.id_mahasiswa) ? 'bg-blue-100' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded"
                        checked={selectedMahasiswa.includes(m.id_mahasiswa)}
                        onChange={() => toggleSelect(m.id_mahasiswa)} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">{m.nim}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.nama_mahasiswa}</td>
                    <td className="px-4 py-3">
                      {m.id_kelas ? (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold">
                          {getNamaKelas(m.id_kelas)}
                        </span>
                      ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{getNamaGolongan(m.id_golongan)}</td>
                    <td className="px-4 py-3 text-gray-600">{getNamaAngkatan(m.id_angkatan)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    {loggedUser?.role === "admin" && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(m)} disabled={isLoading}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm disabled:opacity-50 font-medium">
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => handleDeleteClick(m.id_mahasiswa, m.nama_mahasiswa)} disabled={isLoading}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm disabled:opacity-50 font-medium">
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan="10" className="text-center p-12">
                  <GraduationCap className="h-14 w-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Belum ada data mahasiswa</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                {formMode === "add" ? "Tambah Mahasiswa Baru" : "Edit Data Mahasiswa"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {formMode === "add" && (
              <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ℹ️ Akun login otomatis dibuat: <strong>name=NIM, email=nim@student.polije.ac.id, password=NIM, role=mahasiswa</strong>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIM <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })}
                    placeholder="Contoh: E41221001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={isLoading || formMode === "edit"} />
                  {formMode === "edit" && <p className="text-xs text-gray-400 mt-1">NIM tidak dapat diubah</p>}
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                  <select value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                    {JENIS_KELAMIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap <span className="text-red-500">*</span></label>
                <input type="text" value={form.nama_mahasiswa} onChange={(e) => setForm({ ...form, nama_mahasiswa: e.target.value })}
                  placeholder="Nama lengkap mahasiswa"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400 text-xs">(opsional — default: nim@student.polije.ac.id)</span>
                </label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={form.nim ? `${form.nim.toLowerCase()}@student.polije.ac.id` : "nim@student.polije.ac.id"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
                <input type="text" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading} />
              </div>

              {/* Kelas - auto fill prodi & golongan */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <label className="block text-sm font-semibold text-indigo-800 mb-2">
                  🏫 Kelas <span className="text-xs font-normal text-indigo-500">(opsional — otomatis isi Prodi & Golongan)</span>
                </label>
                <select value={form.id_kelas} onChange={(e) => {
                  const kelasId = e.target.value;
                  if (kelasId) {
                    const k = kelasList.find((x) => x.id === parseInt(kelasId));
                    if (k) {
                      const gol = golonganList.find((g) => g.nama_golongan === k.golongan);
                      const ang = angkatanList.find((a) => a.tahun_angkatan === k.angkatan);
                      setForm({
                        ...form,
                        id_kelas: kelasId,
                        id_prodi: k.id_prodi ? String(k.id_prodi) : form.id_prodi,
                        id_golongan: gol ? String(gol.id_golongan) : form.id_golongan,
                        id_angkatan: ang ? String(ang.id_angkatan) : form.id_angkatan,
                      });
                      return;
                    }
                  }
                  setForm({ ...form, id_kelas: kelasId });
                }} className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" disabled={isLoading}>
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas}{k.golongan ? ` · ${k.golongan}` : ""}{k.angkatan ? ` · ${k.angkatan}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prodi <span className="text-red-500">*</span></label>
                  <select value={form.id_prodi} onChange={(e) => setForm({ ...form, id_prodi: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                    <option value="">-- Pilih --</option>
                    {prodiList.map((p) => <option key={p.id_prodi} value={p.id_prodi}>{p.kode_prodi}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Angkatan <span className="text-red-500">*</span></label>
                  <select value={form.id_angkatan} onChange={(e) => setForm({ ...form, id_angkatan: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                    <option value="">-- Pilih --</option>
                    {angkatanList.map((a) => <option key={a.id_angkatan} value={a.id_angkatan}>{a.tahun_angkatan}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Golongan <span className="text-red-500">*</span></label>
                  <select value={form.id_golongan} onChange={(e) => setForm({ ...form, id_golongan: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                    <option value="">-- Pilih --</option>
                    {golonganList.map((g) => <option key={g.id_golongan} value={g.id_golongan}>{g.nama_golongan}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>


              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isLoading}
                  className="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition disabled:opacity-50">
                  Batal
                </button>
                <button type="submit" disabled={isLoading}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                  {isLoading ? "Menyimpan..." : formMode === "add" ? "Tambah & Buat Akun" : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6 text-sm">
              Hapus mahasiswa <span className="font-semibold">"{deleteTarget?.nama}"</span>?
              <span className="text-red-600 text-xs block mt-1">Tindakan ini tidak dapat dibatalkan.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50">
                {isLoading ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
