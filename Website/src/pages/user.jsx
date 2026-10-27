import Swal from "sweetalert2";
// src/pages/user.jsx
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import {
  getUserList, createUser, updateUser, deleteUser,
  getProdiList, getAngkatanList, getGolonganList,
} from "../utils/apiUtils";
import { getUser } from "../utils/auth";
import {
  UserPlus, Edit, Trash2, Users, GraduationCap, Shield, BookOpen,
  AlertCircle, Upload, Download, FileSpreadsheet, X, CheckCircle2, XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

export default function UserPage() {
  const [activeNav, setActiveNav] = useState("User");
  const [activeTab, setActiveTab] = useState("Semua");
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [isLoading, setIsLoading] = useState(false);
  const [loggedUser, setLoggedUser] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Excel import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importResults, setImportResults] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef(null);

  // Master data dropdowns for mahasiswa
  const [prodiList, setProdiList] = useState([]);
  const [angkatanList, setAngkatanList] = useState([]);
  const [golonganList, setGolonganList] = useState([]);

  const [currentUser, setCurrentUser] = useState({
    id_user: null, nama: "", email: "", role: "mahasiswa",
    nidn: "", nim: "", password: "",
    id_prodi: null, id_angkatan: null, id_golongan: null,
  });

  useEffect(() => {
    const stored = getUser();
    if (stored) setLoggedUser(stored);
    fetchUsers();
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (isModalOpen || showImportModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen, showImportModal]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getUserList();
      setUsers(data || []);
    } catch (error) {
      showNotification('error', "Gagal memuat data pengguna: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [prodi, angkatan, golongan] = await Promise.all([
        getProdiList(), getAngkatanList(), getGolonganList(),
      ]);
      setProdiList(prodi || []);
      setAngkatanList(angkatan || []);
      setGolonganList(golongan || []);
    } catch (e) {
      console.error("Gagal memuat master data:", e);
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

  const roleLabel = (role) => ({ admin: 'Admin', dosen: 'Dosen', mahasiswa: 'Mahasiswa' }[role] || role);

  const filteredUsers = activeTab === "Semua" ? users
    : users.filter((u) => u.role === activeTab.toLowerCase());

  const openAddModal = () => {
    setFormMode("add");
    setCurrentUser({
      id_user: null, nama: "", email: "", role: "mahasiswa",
      nidn: "", nim: "", password: "",
      id_prodi: null, id_angkatan: null, id_golongan: null,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setFormMode("edit");
    setCurrentUser({
      id_user: user.id_user,
      nama: user.nama || "",
      email: user.email || "",
      role: user.role,
      nidn: user.nip || "",
      nim: user.nim || "",
      password: "",
      id_prodi: user.id_prodi || null,
      id_angkatan: user.id_angkatan || null,
      id_golongan: user.id_golongan || null,
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id, nama) => {
    setDeleteTarget({ id, nama });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsLoading(true);
      await deleteUser(deleteTarget.id);
      showNotification('success', "Pengguna berhasil dihapus");
      setSelectedUsers(selectedUsers.filter(id => id !== deleteTarget.id));
      fetchUsers();
    } catch (error) {
      showNotification('error', "Gagal menghapus: " + error.message);
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const toggleSelect = (id) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(item => item !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id_user));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedUsers.length} pengguna terpilih?`)) return;
    
    setIsLoading(true);
    try {
      await Promise.all(selectedUsers.map(id => deleteUser(id)));
      showNotification("success", `${selectedUsers.length} pengguna berhasil dihapus`);
      setSelectedUsers([]);
      fetchUsers();
    } catch (err) {
      showNotification("error", "Gagal menghapus sebagian data: " + err.message);
      fetchUsers();
    } finally {
      setIsLoading(false);
    }
  };

  // ===== DUPLICATE CHECK HELPERS =====
  const isDuplicateEmail = (email, excludeId = null) =>
    users.some(u => u.email?.toLowerCase() === email.toLowerCase() && u.id_user !== excludeId);

  const isDuplicateNim = (nim, excludeId = null) =>
    users.some(u => u.nim && u.nim === nim.trim() && u.id_user !== excludeId);

  const isDuplicateNip = (nip, excludeId = null) =>
    users.some(u => u.nip && u.nip === nip.trim() && u.id_user !== excludeId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!currentUser.nama.trim()) { showNotification('error', "Nama wajib diisi"); setIsLoading(false); return; }
    if (!currentUser.email.trim()) { showNotification('error', "Email wajib diisi"); setIsLoading(false); return; }
    if (formMode === "add" && !currentUser.password.trim()) { showNotification('error', "Password wajib diisi"); setIsLoading(false); return; }

    // --- Duplicate checks (manual add & edit) ---
    const excludeId = formMode === "edit" ? currentUser.id_user : null;
    if (isDuplicateEmail(currentUser.email, excludeId)) {
      showNotification('error', `Email "${currentUser.email}" sudah terdaftar di sistem`);
      setIsLoading(false); return;
    }
    if ((currentUser.role === "dosen" || currentUser.role === "admin") && currentUser.nidn.trim()) {
      if (isDuplicateNip(currentUser.nidn, excludeId)) {
        showNotification('error', `NIP "${currentUser.nidn}" sudah terdaftar di sistem`);
        setIsLoading(false); return;
      }
    }
    if (currentUser.role === "mahasiswa" && currentUser.nim.trim()) {
      if (isDuplicateNim(currentUser.nim, excludeId)) {
        showNotification('error', `NIM "${currentUser.nim}" sudah terdaftar di sistem`);
        setIsLoading(false); return;
      }
    }

    try {
      if (formMode === "add") {
        const payload = {
          name: currentUser.nama,
          email: currentUser.email,
          password: currentUser.password,
          role: currentUser.role,
        };
        if (currentUser.role === "dosen" || currentUser.role === "admin") {
          if (currentUser.role === "dosen" && !currentUser.nidn.trim()) { showNotification('error', "NIP wajib diisi untuk Dosen"); setIsLoading(false); return; }
          if (currentUser.nidn.trim()) payload.nidn = currentUser.nidn;
          payload.nama_dosen = currentUser.nama;
        } else if (currentUser.role === "mahasiswa") {
          if (!currentUser.nim.trim()) { showNotification('error', "NIM wajib diisi"); setIsLoading(false); return; }
          if (!currentUser.id_prodi) { showNotification('error', "Prodi wajib dipilih"); setIsLoading(false); return; }
          if (!currentUser.id_angkatan) { showNotification('error', "Angkatan wajib dipilih"); setIsLoading(false); return; }
          if (!currentUser.id_golongan) { showNotification('error', "Golongan wajib dipilih"); setIsLoading(false); return; }
          payload.nim = currentUser.nim;
          payload.id_prodi = parseInt(currentUser.id_prodi);
          payload.id_angkatan = parseInt(currentUser.id_angkatan);
          payload.id_golongan = parseInt(currentUser.id_golongan);
        }
        await createUser(payload);
        showNotification('success', "Pengguna berhasil ditambahkan");
      } else {
        const payload = { name: currentUser.nama, email: currentUser.email };
        if (currentUser.role === "dosen" || currentUser.role === "admin") {
          if (currentUser.nidn) payload.nidn = currentUser.nidn;
          payload.nama_dosen = currentUser.nama;
        } else if (currentUser.role === "mahasiswa") {
          if (currentUser.nim) payload.nim = currentUser.nim;
          if (currentUser.id_prodi) payload.id_prodi = parseInt(currentUser.id_prodi);
          if (currentUser.id_angkatan) payload.id_angkatan = parseInt(currentUser.id_angkatan);
          if (currentUser.id_golongan) payload.id_golongan = parseInt(currentUser.id_golongan);
        }
        await updateUser(currentUser.id_user, payload);
        showNotification('success', "Pengguna berhasil diperbarui");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      showNotification('error', "Gagal: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== EXCEL IMPORT FUNCTIONS =====

  const downloadTemplate = () => {
    // Sheet 1: Mahasiswa
    const mahasiswaHeaders = [
      ["role", "nama", "email", "password", "nim", "id_prodi", "id_angkatan", "id_golongan"]
    ];
    const mahasiswaExample = [
      ["mahasiswa", "Budi Santoso", "budi@email.com", "password123", "20210001", 1, 1, 1],
      ["mahasiswa", "Siti Rahayu", "siti@email.com", "password123", "20210002", 1, 1, 2],
    ];
    const wsMahasiswa = XLSX.utils.aoa_to_sheet([...mahasiswaHeaders, ...mahasiswaExample]);

    // Sheet 2: Dosen
    const dosenHeaders = [
      ["role", "nama", "email", "password", "nip"]
    ];
    const dosenExample = [
      ["dosen", "Dr. Ahmad Fauzi", "ahmad@email.com", "password123", "19800101200501001"],
      ["dosen", "Prof. Dewi Lestari", "dewi@email.com", "password123", "19750515200012002"],
    ];
    const wsDosen = XLSX.utils.aoa_to_sheet([...dosenHeaders, ...dosenExample]);

    // Sheet 3: Admin
    const adminHeaders = [
      ["role", "nama", "email", "password", "nip"]
    ];
    const adminExample = [
      ["admin", "Admin Sistem", "admin2@email.com", "password123", "19900101201001001"],
    ];
    const wsAdmin = XLSX.utils.aoa_to_sheet([...adminHeaders, ...adminExample]);

    // Sheet 4: Referensi
    const refProdi = [["=== DATA PRODI ==="], ["id_prodi", "kode_prodi", "nama_prodi"]];
    prodiList.forEach(p => refProdi.push([p.id_prodi, p.kode_prodi, p.nama_prodi]));

    const refAngkatan = [[], ["=== DATA ANGKATAN ==="], ["id_angkatan", "tahun_angkatan"]];
    angkatanList.forEach(a => refAngkatan.push([a.id_angkatan, a.tahun_angkatan]));

    const refGolongan = [[], ["=== DATA GOLONGAN ==="], ["id_golongan", "nama_golongan"]];
    golonganList.forEach(g => refGolongan.push([g.id_golongan, g.nama_golongan]));

    const wsRef = XLSX.utils.aoa_to_sheet([...refProdi, ...refAngkatan, ...refGolongan]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMahasiswa, "Mahasiswa");
    XLSX.utils.book_append_sheet(wb, wsDosen, "Dosen");
    XLSX.utils.book_append_sheet(wb, wsAdmin, "Admin");
    XLSX.utils.book_append_sheet(wb, wsRef, "Referensi ID");

    XLSX.writeFile(wb, "template_import_pengguna.xlsx");
  };

  const exportToExcel = () => {
    const toExport = activeTab === "Semua" ? users : filteredUsers;
    
    const mahasiswaData = toExport.filter(u => u.role === 'mahasiswa').map(u => ({
      role: 'mahasiswa', nama: u.nama, email: u.email, password: "", nim: u.nim, 
      id_prodi: u.id_prodi, id_angkatan: u.id_angkatan, id_golongan: u.id_golongan
    }));
    
    const dosenData = toExport.filter(u => u.role === 'dosen').map(u => ({
      role: 'dosen', nama: u.nama, email: u.email, password: "", nip: u.nip
    }));
    
    const adminData = toExport.filter(u => u.role === 'admin').map(u => ({
      role: 'admin', nama: u.nama, email: u.email, password: "", nip: u.nip
    }));

    const wb = XLSX.utils.book_new();

    if (mahasiswaData.length > 0) {
      const wsMahasiswa = XLSX.utils.json_to_sheet(mahasiswaData);
      XLSX.utils.book_append_sheet(wb, wsMahasiswa, "Mahasiswa");
    }
    if (dosenData.length > 0) {
      const wsDosen = XLSX.utils.json_to_sheet(dosenData);
      XLSX.utils.book_append_sheet(wb, wsDosen, "Dosen");
    }
    if (adminData.length > 0) {
      const wsAdmin = XLSX.utils.json_to_sheet(adminData);
      XLSX.utils.book_append_sheet(wb, wsAdmin, "Admin");
    }

    const refProdi = [["=== DATA PRODI ==="], ["id_prodi", "kode_prodi", "nama_prodi"]];
    prodiList.forEach(p => refProdi.push([p.id_prodi, p.kode_prodi, p.nama_prodi]));
    const refAngkatan = [[], ["=== DATA ANGKATAN ==="], ["id_angkatan", "tahun_angkatan"]];
    angkatanList.forEach(a => refAngkatan.push([a.id_angkatan, a.tahun_angkatan]));
    const refGolongan = [[], ["=== DATA GOLONGAN ==="], ["id_golongan", "nama_golongan"]];
    golonganList.forEach(g => refGolongan.push([g.id_golongan, g.nama_golongan]));
    const wsRef = XLSX.utils.aoa_to_sheet([...refProdi, ...refAngkatan, ...refGolongan]);
    XLSX.utils.book_append_sheet(wb, wsRef, "Referensi ID");

    XLSX.writeFile(wb, "Data_Pengguna_Export.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const currentUsers = users; // snapshot of existing users
        const seenEmails = new Set();
        const seenNims = new Set();
        const seenNips = new Set();
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const parsedRows = [];
        const errors = [];

        // Process all sheets (Mahasiswa, Dosen, Admin)
        const validSheets = ["Mahasiswa", "Dosen", "Admin"];
        wb.SheetNames.forEach(sheetName => {
          if (!validSheets.includes(sheetName)) return;

          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

          // Track emails/NIMs/NIPs already seen in THIS file to catch intra-file duplicates
          rows.forEach((row, idx) => {
            const rowNum = idx + 2; // +2 because row 1 is header
            const role = (row.role || "").toString().toLowerCase().trim();

            if (!role) return; // skip empty rows

            if (!["mahasiswa", "dosen", "admin"].includes(role)) {
              errors.push(`Sheet "${sheetName}", Baris ${rowNum}: Role "${role}" tidak valid`);
              return;
            }

            const nama = (row.nama || "").toString().trim();
            const email = (row.email || "").toString().trim();
            const password = (row.password || "").toString().trim();

            if (!nama) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: Nama wajib diisi`); return; }
            if (!email) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: Email wajib diisi`); return; }

            const entry = { role, nama, email, password, _sheet: sheetName, _row: rowNum, _skip: false, _skipReason: '', _action: 'insert' };
            let nim = "", nip = "";

            if (role === "mahasiswa") {
              nim = (row.nim || "").toString().trim();
              const id_prodi = row.id_prodi;
              const id_angkatan = row.id_angkatan;
              const id_golongan = row.id_golongan;

              if (!nim) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: NIM wajib diisi untuk mahasiswa`); return; }
              if (!id_prodi) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: id_prodi wajib diisi`); return; }
              if (!id_angkatan) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: id_angkatan wajib diisi`); return; }
              if (!id_golongan) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: id_golongan wajib diisi`); return; }

              entry.nim = nim;
              entry.id_prodi = parseInt(id_prodi);
              entry.id_angkatan = parseInt(id_angkatan);
              entry.id_golongan = parseInt(id_golongan);
            } else {
              nip = (row.nip || row.nidn || "").toString().trim();
              if (role === "dosen" && !nip) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: NIP wajib diisi untuk dosen`); return; }
              entry.nip = nip;
            }

            // Temukan user yang sudah ada
            let existingUser = null;
            if (role === "mahasiswa") existingUser = currentUsers.find(u => String(u.nim).toLowerCase() === nim.toLowerCase());
            else existingUser = currentUsers.find(u => String(u.nip || "").toLowerCase() === nip.toLowerCase());

            if (!existingUser) existingUser = currentUsers.find(u => String(u.email).toLowerCase() === email.toLowerCase());

            if (existingUser) {
              entry._action = 'update';
              entry._id = existingUser.id_user;

              if (currentUsers.some(u => String(u.email).toLowerCase() === email.toLowerCase() && u.id_user !== existingUser.id_user)) {
                 entry._skip = true;
                 entry._skipReason = `Email "${email}" sudah dipakai user lain`;
              }
              if (existingUser.role !== role) {
                 entry._skip = true;
                 entry._skipReason = `Role tidak bisa diubah dari ${existingUser.role} ke ${role}`;
              }
              
              if (!entry._skip) {
                 const pwChanged = password && password !== "";
                 let changed = false;
                 if (pwChanged || existingUser.nama !== nama || String(existingUser.email) !== email) changed = true;
                 if (role === "mahasiswa") {
                    if (String(existingUser.nim) !== nim || existingUser.id_prodi !== entry.id_prodi || existingUser.id_angkatan !== entry.id_angkatan || existingUser.id_golongan !== entry.id_golongan) changed = true;
                 } else {
                    if (String(existingUser.nip || existingUser.nidn || "") !== nip) changed = true;
                 }

                 if (!changed) {
                    entry._skip = true;
                    entry._skipReason = "Data sama, tidak ada perubahan";
                 }
              }
            } else {
              if (!password) { errors.push(`Sheet "${sheetName}", Baris ${rowNum}: Password wajib diisi untuk data baru`); return; }
              if (role === "mahasiswa" && seenNims.has(nim)) {
                entry._skip = true; entry._skipReason = `NIM "${nim}" duplikat dalam file`;
              }
              if (role !== "mahasiswa" && seenNips.has(nip)) {
                entry._skip = true; entry._skipReason = `NIP "${nip}" duplikat dalam file`;
              }
              if (seenEmails.has(email.toLowerCase())) {
                entry._skip = true; entry._skipReason = `Email "${email}" duplikat dalam file`;
              }
            }

            if (!entry._skip && entry._action === 'insert') {
               if (nim) seenNims.add(nim);
               if (nip) seenNips.add(nip);
               seenEmails.add(email.toLowerCase());
            }

            parsedRows.push(entry);
          });
        });

        setImportData(parsedRows);
        setImportErrors(errors);
        setImportResults([]);
        setImportDone(false);
      } catch (err) {
        setImportErrors([`Gagal membaca file: ${err.message}`]);
        setImportData([]);
      }
    };
    reader.readAsBinaryString(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportSubmit = async () => {
    if (importData.length === 0) return;

    setIsImporting(true);
    const results = [];

    for (const row of importData) {
      // Skip rows that were flagged as duplicates during file parsing
      if (row._skip) {
        results.push({ nama: row.nama, email: row.email, role: row.role, status: 'skipped', message: row._skipReason });
        continue;
      }

      try {
        const payload = {
          name: row.nama,
          email: row.email,
          role: row.role,
        };
        if (row.password) payload.password = row.password;

        if (row.role === "dosen" || row.role === "admin") {
          if (row.nip) payload.nidn = row.nip;
          payload.nama_dosen = row.nama;
        } else if (row.role === "mahasiswa") {
          payload.nim = row.nim;
          payload.id_prodi = row.id_prodi;
          payload.id_angkatan = row.id_angkatan;
          payload.id_golongan = row.id_golongan;
        }

        if (row._action === 'update') {
          await updateUser(row._id, payload);
          results.push({ nama: row.nama, email: row.email, role: row.role, status: 'success', message: 'Berhasil diperbarui' });
        } else {
          await createUser(payload);
          results.push({ nama: row.nama, email: row.email, role: row.role, status: 'success', message: 'Berhasil ditambahkan' });
        }
      } catch (err) {
        results.push({ nama: row.nama, email: row.email, role: row.role, status: 'error', message: err.message });
      }
    }

    setImportResults(results);
    setImportDone(true);
    setIsImporting(false);

    const successCount = results.filter(r => r.status === 'success' && r.message.includes('ditambahkan')).length;
    const updateCount = results.filter(r => r.status === 'success' && r.message.includes('diperbarui')).length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    if (successCount > 0 || updateCount > 0) {
      fetchUsers();
    }
    if (successCount > 0 || updateCount > 0 || skippedCount > 0) {
      showNotification(
        'info',
        `Selesai! Baru: ${successCount}, Diperbarui: ${updateCount}, Dilewati: ${skippedCount}`
      );
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportData([]);
    setImportErrors([]);
    setImportResults([]);
    setImportDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const countByRole = (role) => users.filter((u) => u.role === role).length;
  const tabs = [
    { name: "Semua", icon: Users, count: users.length },
    { name: "Admin", icon: Shield, count: countByRole("admin") },
    { name: "Dosen", icon: BookOpen, count: countByRole("dosen") },
    { name: "Mahasiswa", icon: GraduationCap, count: countByRole("mahasiswa") },
  ];

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {notification.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {notification.type === 'success' ? '✓' : '✕'} {notification.message}
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-8 shadow-md">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Users className="text-blue-600" /> Manajemen Pengguna
          </h1>
          {loggedUser?.role === "admin" && (
            <div className="flex gap-2 flex-wrap">
              {selectedUsers.length > 0 && (
                <button onClick={handleBulkDelete} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow transition text-sm font-medium">
                  <Trash2 className="h-4 w-4" /> Hapus ({selectedUsers.length})
                </button>
              )}
              {/* Export Excel */}
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition text-sm"
                title="Export data pengguna ke Excel"
              >
                <Download className="h-4 w-4" /> Export
              </button>
              {/* Download Template */}
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition text-sm"
                title="Download template Excel"
              >
                <Download className="h-4 w-4" /> Template
              </button>
              {/* Import Excel */}
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow transition text-sm"
                title="Import pengguna dari Excel"
              >
                <FileSpreadsheet className="h-4 w-4" /> Import Excel
              </button>
              {/* Add Single User */}
              <button onClick={openAddModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition text-sm">
                <UserPlus className="h-4 w-4" /> Tambah
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.name} onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all ${activeTab === tab.name ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-blue-600"}`}>
                <Icon className="h-4 w-4" />
                {tab.name}
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.name ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="p-3 w-10">
                  <input type="checkbox" className="rounded"
                    checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                    onChange={toggleSelectAll} />
                </th>
                <th className="p-3">No</th>
                <th className="p-3">Nama</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">NIP/NIM</th>
                <th className="p-3">Kelas</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="7" className="text-center p-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Memuat data...</p>
                </td></tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user, i) => (
                  <tr key={user.id_user} className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 ${selectedUsers.includes(user.id_user) ? 'bg-blue-100' : ''}`}>
                    <td className="p-3">
                      <input type="checkbox" className="rounded"
                        checked={selectedUsers.includes(user.id_user)}
                        onChange={() => toggleSelect(user.id_user)} />
                    </td>
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-semibold text-gray-800">{user.nama}</td>
                    <td className="p-3 text-sm text-gray-600">{user.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === "admin" ? "bg-purple-100 text-purple-700" : user.role === "dosen" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {user.role === "mahasiswa" ? (user.nim || '-') : (user.nip || '-')}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{user.nama_kelas || '-'}</td>
                    <td className="p-3">
                      {loggedUser?.role === "admin" ? (
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(user)} disabled={isLoading}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm disabled:opacity-50">
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => handleDeleteClick(user.id_user, user.nama)} disabled={isLoading}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm disabled:opacity-50">
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">View Only</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="text-center p-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Belum ada data pengguna {activeTab !== "Semua" ? activeTab : ""}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== IMPORT EXCEL MODAL ===== */}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-xl">
                  <FileSpreadsheet className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Import Pengguna dari Excel</h2>
                  <p className="text-sm text-gray-500">Upload banyak pengguna sekaligus</p>
                </div>
              </div>
              <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step 1: Download Template */}
              {!importDone && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                    <span className="bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                    Download Template Excel
                  </p>
                  <p className="text-sm text-emerald-700 mb-3">
                    Unduh template terlebih dahulu. Template berisi sheet untuk Mahasiswa, Dosen, dan Admin.
                    Sheet <strong>Referensi ID</strong> berisi daftar ID Prodi, Angkatan, dan Golongan yang tersedia di sistem.
                  </p>
                  <button onClick={downloadTemplate}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition">
                    <Download className="h-4 w-4" /> Download Template
                  </button>
                </div>
              )}

              {/* Step 2: Upload File */}
              {!importDone && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                    Upload File Excel
                  </p>
                  <p className="text-sm text-blue-700 mb-3">Isi template lalu upload file .xlsx di sini</p>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-xl p-6 cursor-pointer hover:bg-blue-100 transition">
                    <Upload className="h-8 w-8 text-blue-400 mb-2" />
                    <span className="text-sm text-blue-600 font-medium">Klik untuk upload file .xlsx</span>
                    <span className="text-xs text-blue-400 mt-1">Format: .xlsx</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Validation Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Error Validasi ({importErrors.length} masalah)
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                        <span className="mt-0.5">•</span> {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Data */}
              {importData.length > 0 && !importDone && (() => {
                const readyCount = importData.filter(r => !r._skip).length;
                const skipCount  = importData.filter(r => r._skip).length;
                return (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 flex-wrap">
                      <span className="bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                      Preview Data
                      <span className="text-green-600">({readyCount} akan diimport</span>
                      {skipCount > 0 && <span className="text-yellow-600">, {skipCount} dilewati duplikat)</span>}
                      {skipCount === 0 && <span className="text-gray-500">)</span>}
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-52 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="text-left p-2 px-3 text-gray-600 font-semibold">Nama</th>
                            <th className="text-left p-2 px-3 text-gray-600 font-semibold">Email</th>
                            <th className="text-left p-2 px-3 text-gray-600 font-semibold">Role</th>
                            <th className="text-left p-2 px-3 text-gray-600 font-semibold">NIP/NIM</th>
                            <th className="text-left p-2 px-3 text-gray-600 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.map((row, i) => (
                            <tr key={i} className={`border-t border-gray-100 ${row._skip ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <td className={`p-2 px-3 ${row._skip ? 'text-gray-400 line-through' : ''}`}>{row.nama}</td>
                              <td className={`p-2 px-3 ${row._skip ? 'text-gray-400' : 'text-gray-500'}`}>{row.email}</td>
                              <td className="p-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.role === 'admin' ? 'bg-purple-100 text-purple-700' : row.role === 'dosen' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                  {row.role}
                                </span>
                              </td>
                              <td className={`p-2 px-3 font-mono text-xs ${row._skip ? 'text-gray-400' : 'text-gray-500'}`}>{row.nim || row.nip || '-'}</td>
                              <td className="p-2 px-3">
                                {row._skip
                                  ? <span className="flex items-center gap-1 text-yellow-700 text-xs bg-yellow-100 px-2 py-0.5 rounded-full whitespace-nowrap" title={row._skipReason}>
                                      ⚠ Dilewati
                                    </span>
                                  : row._action === 'update'
                                  ? <span className="flex items-center gap-1 text-blue-700 text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                                      ✎ Diperbarui
                                    </span>
                                  : <span className="flex items-center gap-1 text-green-700 text-xs bg-green-100 px-2 py-0.5 rounded-full">
                                      ✓ Baru
                                    </span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importData.some(r => r._skip) && (
                      <p className="text-xs text-yellow-700 mt-2 flex items-center gap-1">
                        ⚠ Baris berwarna kuning sudah ada di sistem dan akan dilewati saat import.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Import Results */}
              {importDone && importResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex gap-4 flex-wrap">
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {importResults.filter(r => r.status === 'success').length} berhasil
                      </span>
                      {importResults.filter(r => r.status === 'skipped').length > 0 && (
                        <span className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                          ⚠ {importResults.filter(r => r.status === 'skipped').length} dilewati (duplikat)
                        </span>
                      )}
                      {importResults.filter(r => r.status === 'error').length > 0 && (
                        <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                          <XCircle className="h-4 w-4" />
                          {importResults.filter(r => r.status === 'error').length} gagal
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-left p-2 px-3 text-gray-600 font-semibold">Nama</th>
                          <th className="text-left p-2 px-3 text-gray-600 font-semibold">Email</th>
                          <th className="text-left p-2 px-3 text-gray-600 font-semibold">Role</th>
                          <th className="text-left p-2 px-3 text-gray-600 font-semibold">Status</th>
                          <th className="text-left p-2 px-3 text-gray-600 font-semibold">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.map((r, i) => (
                          <tr key={i} className={`border-t border-gray-100 ${
                            r.status === 'success' ? 'bg-green-50'
                            : r.status === 'skipped' ? 'bg-yellow-50'
                            : 'bg-red-50'
                          }`}>
                            <td className="p-2 px-3 font-medium">{r.nama}</td>
                            <td className="p-2 px-3 text-gray-500">{r.email}</td>
                            <td className="p-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.role === 'admin' ? 'bg-purple-100 text-purple-700' : r.role === 'dosen' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {r.role}
                              </span>
                            </td>
                            <td className="p-2 px-3">
                              {r.status === 'success'
                                ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="h-3 w-3" /> Berhasil</span>
                                : r.status === 'skipped'
                                ? <span className="flex items-center gap-1 text-yellow-700 text-xs">⚠ Dilewati</span>
                                : <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="h-3 w-3" /> Gagal</span>
                              }
                            </td>
                            <td className="p-2 px-3 text-xs text-gray-500">{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
              <button onClick={closeImportModal} disabled={isImporting}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50">
                {importDone ? 'Tutup' : 'Batal'}
              </button>
              {!importDone && importData.length > 0 && importErrors.length === 0 && (() => {
                const readyCount = importData.filter(r => !r._skip).length;
                return readyCount > 0 ? (
                  <button onClick={handleImportSubmit} disabled={isImporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition font-medium disabled:opacity-50">
                    {isImporting ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Mengimport...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Import {readyCount} Pengguna</>
                    )}
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Single User */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              {formMode === "add" ? "Tambah Pengguna" : "Edit Pengguna"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Lengkap <span className="text-red-500">*</span></label>
                <input type="text" required value={currentUser.nama}
                  onChange={(e) => setCurrentUser({ ...currentUser, nama: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={currentUser.email}
                  onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password {formMode === "add" && <span className="text-red-500">*</span>}
                  {formMode === "edit" && <span className="text-gray-400 text-xs ml-1">(opsional - tidak diubah jika kosong)</span>}
                </label>
                <input type="password" required={formMode === "add"} value={currentUser.password}
                  onChange={(e) => setCurrentUser({ ...currentUser, password: e.target.value })}
                  placeholder={formMode === "edit" ? "Kosongkan jika tidak diubah" : ""}
                  className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select value={currentUser.role} disabled={formMode === "edit" || isLoading}
                  onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100">
                  <option value="admin">Admin</option>
                  <option value="dosen">Dosen</option>
                  <option value="mahasiswa">Mahasiswa</option>
                </select>
              </div>

              {/* Dosen/Admin fields */}
              {(currentUser.role === "dosen" || currentUser.role === "admin") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">NIP <span className="text-red-500">*</span></label>
                  <input type="text" value={currentUser.nidn}
                    onChange={(e) => setCurrentUser({ ...currentUser, nidn: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}
                    placeholder="Nomor Induk Pegawai" />
                </div>
              )}

              {/* Mahasiswa fields */}
              {currentUser.role === "mahasiswa" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">NIM <span className="text-red-500">*</span></label>
                    <input type="text" value={currentUser.nim}
                      onChange={(e) => setCurrentUser({ ...currentUser, nim: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}
                      placeholder="Nomor Induk Mahasiswa" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prodi <span className="text-red-500">*</span></label>
                    <select value={currentUser.id_prodi || ""}
                      onChange={(e) => setCurrentUser({ ...currentUser, id_prodi: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                      <option value="">-- Pilih Prodi --</option>
                      {prodiList.map((p) => (
                        <option key={p.id_prodi} value={p.id_prodi}>{p.kode_prodi} - {p.nama_prodi}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Angkatan <span className="text-red-500">*</span></label>
                    <select value={currentUser.id_angkatan || ""}
                      onChange={(e) => setCurrentUser({ ...currentUser, id_angkatan: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                      <option value="">-- Pilih Angkatan --</option>
                      {angkatanList.map((a) => (
                        <option key={a.id_angkatan} value={a.id_angkatan}>{a.tahun_angkatan}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Golongan <span className="text-red-500">*</span></label>
                    <select value={currentUser.id_golongan || ""}
                      onChange={(e) => setCurrentUser({ ...currentUser, id_golongan: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" disabled={isLoading}>
                      <option value="">-- Pilih Golongan --</option>
                      {golonganList.map((g) => (
                        <option key={g.id_golongan} value={g.id_golongan}>{g.nama_golongan}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isLoading}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-2">
                  {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  {isLoading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full"><AlertCircle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Hapus pengguna <span className="font-semibold">"{deleteTarget?.nama}"</span>?
              <span className="text-sm text-red-600 mt-2 block">Tindakan ini tidak dapat dibatalkan.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50">
                {isLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
