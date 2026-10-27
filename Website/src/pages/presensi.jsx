import Swal from "sweetalert2";
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect, useCallback, useRef } from "react";
import { navigationItems } from "../navigation/navigation";
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Eye,
  Calendar,
  Users,
  BookOpen,
  Clock,
  Trash,
  XCircle,
  AlertCircle,
  MapPin,
  History,
  Download,
  ChevronDown,
  ChevronUp,
  Archive,
  X,
  Check,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getToken, getUser } from "../utils/auth";
import {
  API_BASE_URL,
  getMataKuliahList,
  getPenawaranMKList,
  getKelasList,
  getGeolokasiList,
} from "../utils/apiUtils";

export default function Presensi() {
  const [activeNav, setActiveNav] = useState("presensi");
  const navigate = useNavigate();
  const location = useLocation();

  // State untuk Generate Presensi Baru
  // Helper function untuk mendapatkan tanggal lokal dalam format YYYY-MM-DD
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const nowYear = new Date().getFullYear();
  const [generateForm, setGenerateForm] = useState({
    id_matakuliah: "",
    id_kelas: "",
    tahun_ajaran: `${nowYear}/${nowYear + 1}`,
    semester: "1",
    minggu: "",
    tanggal: getLocalDateString(), // Gunakan tanggal lokal, bukan UTC
    waktu_mulai: "",
    waktu_selesai: "",
    mode_lokasi: "bebas",
    id_geolokasi: "",
  });

  // Data master untuk form generate
  const [matakuliahList, setMatakuliahList] = useState([]);
  const [penawaranList, setPenawaranList] = useState([]);
  const [hasExistingPenawaran, setHasExistingPenawaran] = useState(false);
  const [kelasList, setKelasList] = useState([]);
  const [geolokasiList, setGeolokasiList] = useState([]);

  // State untuk pencarian mata kuliah di Tambah Presensi
  const [searchMataKuliah, setSearchMataKuliah] = useState("");
  const [isMKDropdownOpen, setIsMKDropdownOpen] = useState(false);
  const mkDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // State untuk Filter Cek Presensi
  const [filterForm, setFilterForm] = useState({
    id_kelas_mk: "",
    minggu: "",
  });

  // State untuk data dari backend
  const [daftarKelasMK, setDaftarKelasMK] = useState([]);
  const daftarKelasMKRef = useRef([]);
  const [daftarPresensi, setDaftarPresensi] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get current user role
  const currentUser = getUser() || {};
  const isAdmin = currentUser.role === "admin";
  const isStaff = isAdmin || currentUser.role === "dosen"; // dapat generate & hapus presensi

  // State untuk modal sukses
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);
  // State untuk delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [deleteSuccessInfo, setDeleteSuccessInfo] = useState(null);
  // State untuk konfirmasi selesaikan presensi
  const [showSelesaiModal, setShowSelesaiModal] = useState(false);
  const [selesaiTarget, setSelesaiTarget] = useState(null);
  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
  });
  // State untuk riwayat presensi (dari tabel history_presensi)
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [filterRiwayat, setFilterRiwayat] = useState({ id_kelas_mk: "", minggu: "" });
  const [riwayatData, setRiwayatData] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  const showNotification = (type, message) => {
    Swal.fire({
      icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
      title: type === 'error' ? 'Oops...' : (type === 'success' ? 'Berhasil' : 'Info'),
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  };

  // Load master data untuk form generate (matakuliah + kelas + geolokasi)
  const loadMasterData = useCallback(async () => {
    try {
      const [mkData, penawaranData, kelasData, geoData] = await Promise.all([
        getMataKuliahList(),
        getPenawaranMKList(),
        getKelasList(),
        getGeolokasiList({ status_filter: "aktif" }),
      ]);
      setMatakuliahList(mkData || []);
      setPenawaranList(penawaranData || []);
      setKelasList(kelasData || []);
      setGeolokasiList(geoData || []);
    } catch (e) {
      console.error("Error loading master data:", e);
    }
  }, []);

  // Load jadwal (untuk filter dropdown & myJadwalIds dosen)
  const loadDataKelasMK = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setDaftarKelasMK([]);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/kelas-mata-kuliah/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()).filter(
          (mk) => mk.status && mk.status.toLowerCase() === "aktif",
        );
        setDaftarKelasMK(data);
        daftarKelasMKRef.current = data;
      } else {
        setDaftarKelasMK([]);
      }
    } catch (e) {
      console.error("Error loading kelas mata kuliah:", e);
      setDaftarKelasMK([]);
    }
  }, []);

  // Load daftar pertemuan + presensi stats + enrichment dari SEMUA jadwal
  const loadDataPresensi = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        setDaftarPresensi([]);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      // Ambil semua data sekaligus termasuk my kelas-mk terbaru
      const [pertemuanRes, presensiRes, allJadwalRes, myKelasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/pertemuan/`, { headers }),
        fetch(`${API_BASE_URL}/presensi/`, { headers }),
        fetch(`${API_BASE_URL}/kelas-mata-kuliah/`, { headers }),
        fetch(`${API_BASE_URL}/kelas-mata-kuliah/me`, { headers }),
      ]);

      const pertemuanList = pertemuanRes.ok ? await pertemuanRes.json() : [];
      const presensiList = presensiRes.ok ? await presensiRes.json() : [];
      const allJadwal = allJadwalRes.ok ? await allJadwalRes.json() : [];
      const myKelas = myKelasRes.ok ? await myKelasRes.json() : [];

      console.log("[DEBUG] loadDataPresensi:");
      console.log("  - pertemuanList count:", pertemuanList.length);
      console.log("  - presensiList count:", presensiList.length);
      console.log("  - allJadwal count:", allJadwal.length);
      console.log("  - myKelas count:", myKelas.length);
      console.log("  - isAdmin:", isAdmin);

      // Log sample dates dari pertemuan
      if (pertemuanList.length > 0) {
        console.log("  - sample pertemuan:", JSON.stringify({
          id_pertemuan: pertemuanList[0].id_pertemuan,
          tanggal: pertemuanList[0].tanggal,
          status_pertemuan: pertemuanList[0].status_pertemuan
        }));
      }
      if (myKelas.length > 0) {
        console.log("  - sample myKelas:", JSON.stringify(myKelas[0], null, 2));
      }

      // Debug: log tanggal hari ini untuk perbandingan
      console.log("  - today (local):", getLocalDateString());
      console.log("  - today (ISO):", new Date().toISOString().split("T")[0]);

      // Update state daftarKelasMK dengan data terbaru
      // Periksa apakah status adalah string "aktif" atau enum value
      const myKelasAktif = myKelas.filter(
        (mk) => {
          // Handle berbagai format status: "aktif", "Aktif", "active", dll
          const status = mk.status;
          if (!status) return false;
          const statusLower = String(status).toLowerCase();
          return statusLower === "aktif" || statusLower === "active";
        }
      );

      console.log("  - myKelasAktif count:", myKelasAktif.length);

      setDaftarKelasMK(myKelasAktif);
      daftarKelasMKRef.current = myKelasAktif;

      // Map jadwal_id → jadwal info (O(1) lookup)
      // Gunakan Set untuk lookup yang lebih cepat dan handle type mismatch
      const jadwalMap = {};
      const jadwalIdSet = new Set();
      for (const j of allJadwal) {
        if (j.id_jadwal != null) {
          jadwalMap[Number(j.id_jadwal)] = j;
          jadwalIdSet.add(Number(j.id_jadwal));
        }
      }

      // Hitung statistik per pertemuan
      const statsMap = {};
      for (const p of presensiList) {
        if (!statsMap[p.id_pertemuan])
          statsMap[p.id_pertemuan] = { total: 0, hadir: 0, alpa: 0 };
        statsMap[p.id_pertemuan].total++;
        if (p.status_presensi === "hadir" || p.status_presensi === "terlambat")
          statsMap[p.id_pertemuan].hadir++;
        else if (p.status_presensi === "alpha") statsMap[p.id_pertemuan].alpa++;
      }

      // Dosen hanya lihat pertemuan dari jadwal mereka; admin lihat semua
      const myJadwalIds = myKelasAktif.map((mk) => Number(mk.id_jadwal)).filter(id => id != null && !isNaN(id));
      const myJadwalIdSet = new Set(myJadwalIds);

      console.log("  - myJadwalIds:", myJadwalIds);

      const enriched = pertemuanList
        .filter((p) => {
          // Admin lihat semua; dosen hanya lihat yang miliknya
          if (isAdmin) return true;

          // Normalisasi id_jadwal ke number untuk comparison yang konsisten
          const pJadwalId = p.id_jadwal != null ? Number(p.id_jadwal) : null;

          if (pJadwalId == null) {
            console.log("[DEBUG] Filter out: p.id_jadwal is null", p.id_pertemuan);
            return false;
          }

          const matches = myJadwalIdSet.has(pJadwalId);
          if (!matches) {
            console.log("[DEBUG] Filter out: id_jadwal", pJadwalId, "not in myJadwalIds", Array.from(myJadwalIdSet));
          }
          return matches;
        })
        .map((p) => {
          const pJadwalId = Number(p.id_jadwal);
          const j = jadwalMap[pJadwalId];
          const stats = statsMap[p.id_pertemuan] || {
            total: 0,
            hadir: 0,
            alpa: 0,
          };
          return {
            id: p.id_pertemuan,
            id_pertemuan: p.id_pertemuan,
            id_jadwal: p.id_jadwal,
            pertemuan_ke: p.pertemuan_ke,
            pertemuan: p.pertemuan_ke,
            tanggal: p.tanggal,
            batas_presensi: p.batas_presensi || null,
            status_pertemuan: p.status_pertemuan,
            kelas: j?.nama_kelas || "-",
            matkul: j?.nama_mk || "-",
            kode_mk: j?.kode_mk || "-",
            waktu_mulai: j?.jam_mulai || "-",
            waktu_selesai: j?.jam_selesai || "-",
            total_mhs: stats.total,
            hadir: stats.hadir,
            alpa: stats.alpa,
            mode_lokasi: p.mode_lokasi || "bebas",
            id_geolokasi: p.id_geolokasi || null,
          };
        });

      console.log("  - enriched count:", enriched.length);
      setDaftarPresensi(enriched);
    } catch (error) {
      console.error("Error loading pertemuan:", error);
      setDaftarPresensi([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Load data riwayat presensi dari tabel history_presensi
  const loadRiwayatPresensi = useCallback(async () => {
    try {
      setLoadingRiwayat(true);
      const token = getToken();
      if (!token) {
        setRiwayatData([]);
        return;
      }

      // NOTE: Archive sudah dipanggil di archiveOldPresensi() saat mount
      // Tidak perlu memanggil archive di sini untuk menghindari race condition
      // di mana presensi baru dengan tanggal kemarin langsung di-archive

      const res = await fetch(`${API_BASE_URL}/history-presensi/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("[DEBUG] history-presensi/summary result count:", data.length);
        setRiwayatData(data);
      } else {
        console.error("[DEBUG] history-presensi/summary failed:", res.status);
        setRiwayatData([]);
      }
    } catch (e) {
      console.error("Error loading riwayat presensi:", e);
      setRiwayatData([]);
    } finally {
      setLoadingRiwayat(false);
    }
  }, []);

  // Archive semua presensi yang sudah lewat saat komponen mount
  const archiveOldPresensi = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const archiveRes = await fetch(`${API_BASE_URL}/pertemuan/archive-by-date`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (archiveRes.ok) {
        const archiveResult = await archiveRes.json();
        console.log("[DEBUG] Initial archive result:", archiveResult);
      } else {
        const errorText = await archiveRes.text();
        console.error("[DEBUG] Initial archive failed:", archiveRes.status, errorText);
      }
    } catch (e) {
      console.error("[DEBUG] Initial archive error:", e);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
    loadDataKelasMK();
    // Langsung load data presensi saat komponen mount
    loadDataPresensi();
    // Archive dan load riwayat dari history_presensi
    archiveOldPresensi();
    loadRiwayatPresensi();
  }, [loadMasterData, loadDataKelasMK, loadDataPresensi, loadRiwayatPresensi, archiveOldPresensi]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (
      searchParams.get("tab") === "riwayat" ||
      location.state?.openRiwayat ||
      location.hash === "#riwayat"
    ) {
      setShowRiwayat(true);
      setTimeout(() => {
        const riwayatElem = document.getElementById("riwayat-section");
        if (riwayatElem) {
          riwayatElem.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    }
  }, [location]);

  // Tutup dropdown pencarian mata kuliah saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mkDropdownRef.current && !mkDropdownRef.current.contains(event.target)) {
        setIsMKDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper untuk memilih mata kuliah pada form tambah presensi
  const handleSelectMataKuliah = (idMK) => {
    const mkIdStr = idMK ? String(idMK) : "";
    if (!mkIdStr) {
      setGenerateForm((prev) => ({
        ...prev,
        id_matakuliah: "",
        id_kelas: "",
      }));
      setHasExistingPenawaran(false);
      setSearchMataKuliah("");
      setIsMKDropdownOpen(false);
      return;
    }

    const existing = penawaranList.find((p) => p.id_matakuliah === parseInt(mkIdStr));
    if (existing) {
      setGenerateForm((prev) => ({
        ...prev,
        id_matakuliah: mkIdStr,
        semester: existing.semester,
        tahun_ajaran: existing.tahun_ajaran,
        id_kelas: "", // reset kelas
      }));
      setHasExistingPenawaran(true);
    } else {
      setGenerateForm((prev) => ({
        ...prev,
        id_matakuliah: mkIdStr,
        semester: "1",
        tahun_ajaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        id_kelas: "", // reset kelas
      }));
      setHasExistingPenawaran(false);
    }
    setSearchMataKuliah("");
    setIsMKDropdownOpen(false);
  };

  const selectedMatakuliah = matakuliahList.find(
    (mk) => mk.id_matakuliah === parseInt(generateForm.id_matakuliah),
  );

  const filteredMataKuliahList = matakuliahList.filter((mk) => {
    if (!searchMataKuliah.trim()) return true;
    const q = searchMataKuliah.toLowerCase().trim();
    const kode = (mk.kode_matakuliah || "").toLowerCase();
    const nama = (mk.nama_matakuliah || "").toLowerCase();
    const sksStr = `${mk.sks || ""} sks`.toLowerCase();
    return kode.includes(q) || nama.includes(q) || sksStr.includes(q);
  });

  const handleGeneratePresensi = async () => {
    if (
      !generateForm.id_matakuliah ||
      !generateForm.id_kelas ||
      !generateForm.tahun_ajaran ||
      !generateForm.semester ||
      !generateForm.minggu ||
      !generateForm.tanggal ||
      !generateForm.waktu_mulai ||
      !generateForm.waktu_selesai
    ) {
      showNotification(
        "error",
        "Mohon lengkapi semua field termasuk Waktu Mulai dan Selesai!",
      );
      return;
    }

    const selectedMK = matakuliahList.find(
      (mk) => mk.id_matakuliah === parseInt(generateForm.id_matakuliah),
    );
    const selectedKelas = kelasList.find(
      (k) => k.id === parseInt(generateForm.id_kelas),
    );

    // Proteksi: Cek apakah presensi dengan matkul, kelas, dan pertemuan_ke yang sama sudah ada di riwayat
    const mingguKeInt = parseInt(generateForm.minggu);
    if (selectedMK && selectedKelas) {
      // Cek di presensi yang sedang aktif
      const isExistAktif = daftarPresensi.some(
        (p) =>
          p.kode_mk === selectedMK.kode_matakuliah &&
          p.kelas === selectedKelas.nama_kelas &&
          parseInt(p.pertemuan_ke) === mingguKeInt
      );

      // Cek di riwayat (history presensi)
      const isExistRiwayat = riwayatData.some(
        (r) =>
          r.kode_mk === selectedMK.kode_matakuliah &&
          r.nama_kelas === selectedKelas.nama_kelas &&
          parseInt(r.pertemuan_ke) === mingguKeInt
      );

      if (isExistAktif || isExistRiwayat) {
        showNotification(
          "error",
          `Presensi untuk pertemuan ke-${mingguKeInt} sudah ada di riwayat!`
        );
        return;
      }
    }

    try {
      const token = getToken();
      if (!token) {
        showNotification(
          "error",
          "Token otentikasi tidak ditemukan. Silakan login ulang.",
        );
        return;
      }

      const payload = {
        id_matakuliah: parseInt(generateForm.id_matakuliah),
        id_kelas: parseInt(generateForm.id_kelas),
        pertemuan_ke: parseInt(generateForm.minggu),
        tanggal: generateForm.tanggal,
        tahun_ajaran: generateForm.tahun_ajaran,
        semester: parseInt(generateForm.semester),
        jam_mulai: generateForm.waktu_mulai || null,
        jam_selesai: generateForm.waktu_selesai || null,
        mode_lokasi: generateForm.mode_lokasi,
        id_geolokasi: generateForm.mode_lokasi === "wajib" && generateForm.id_geolokasi
          ? parseInt(generateForm.id_geolokasi)
          : null,
      };

      console.log("[DEBUG] Generating presensi with payload:", {
        tanggal: payload.tanggal,
        id_matakuliah: payload.id_matakuliah,
        id_kelas: payload.id_kelas,
        pertemuan_ke: payload.pertemuan_ke,
      });

      const response = await fetch(`${API_BASE_URL}/pertemuan/bebas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessData({
          kelas: result.nama_kelas || selectedKelas?.nama_kelas || "-",
          matkul: result.nama_mk || selectedMK?.nama_matakuliah || "-",
          kode_mk: result.kode_mk || selectedMK?.kode_matakuliah || "-",
          minggu: result.pertemuan_ke,
          tanggal: new Date(result.tanggal + "T00:00:00").toLocaleDateString(
            "id-ID",
            {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            },
          ),
          waktu_mulai: generateForm.waktu_mulai || "-",
          waktu_selesai: generateForm.waktu_selesai || "-",
          total_mahasiswa: result.total_mahasiswa,
        });
        setShowSuccessModal(true);

        // Reset field matakuliah, kelas, minggu, tanggal tapi pertahankan tahun ajaran & semester
        setGenerateForm((f) => ({
          ...f,
          id_matakuliah: "",
          id_kelas: "",
          minggu: "",
          tanggal: getLocalDateString(), // Gunakan tanggal lokal
          waktu_mulai: "",
          waktu_selesai: "",
        }));
        setSearchMataKuliah("");
        setIsMKDropdownOpen(false);

        // Refresh semua data untuk memastikan presensi baru muncul
        loadMasterData();
        loadDataPresensi();
        loadRiwayatPresensi();
      } else {
        showNotification(
          "error",
          `❌ ${result.detail || "Gagal generate presensi"}`,
        );
      }
    } catch (error) {
      console.error("Error generate presensi:", error);
      showNotification(
        "error",
        "❌ Terjadi kesalahan saat menghubungi server.",
      );
    }
  };

  const handleLihatDetail = (presensi) => {
    navigate(`/presensi/detail/${presensi.id_pertemuan}`);
  };

  const handleDeletePresensi = (presensi) => {
    setDeleteTarget(presensi);
    setShowDeleteModal(true);
  };

  const confirmDeletePresensi = async () => {
    if (!deleteTarget) return;
    try {
      const token = getToken();
      if (!token) {
        showNotification(
          "error",
          "Token otentikasi tidak ditemukan. Silakan login ulang.",
        );
        return;
      }
      const url = `${API_BASE_URL}/pertemuan/${deleteTarget.id_pertemuan}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok || response.status === 204) {
        setDaftarPresensi((prev) =>
          prev.filter((p) => p.id_pertemuan !== deleteTarget.id_pertemuan),
        );
        setRiwayatData((prev) =>
          prev.filter((r) => r.id_pertemuan !== deleteTarget.id_pertemuan),
        );
        const formatTgl = deleteTarget.tanggal
          ? new Date(deleteTarget.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
          : "-";
        setDeleteSuccessInfo({
          kelas: deleteTarget.kelas || "-",
          matkul: deleteTarget.matkul || "-",
          minggu: deleteTarget.pertemuan_ke || deleteTarget.pertemuan || "-",
          tanggal: formatTgl,
        });
        setShowDeleteModal(false);
        setShowDeleteSuccessModal(true);
        setDeleteTarget(null);
        loadDataPresensi();
        loadRiwayatPresensi();
      } else {
        const result = await response.json().catch(() => ({}));
        showNotification(
          "error",
          `❌ Gagal menghapus presensi: ${result.detail || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error("Error deleting presensi:", error);
      showNotification(
        "error",
        "❌ Terjadi kesalahan saat menghapus presensi. Periksa koneksi ke backend.",
      );
    }
  };

  const cancelDeletePresensi = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  // Helper: apakah presensi sudah selesai/melewati jadwal?
  // Menggunakan status_pertemuan + batas_presensi sebagai sumber kebenaran.
  // Sessions dianggap selesai jika:
  // 1. status_pertemuan = selesai/dibatalkan, ATAU
  // 2. batas_presensi sudah lewat (tenggat waktu habis)
  const isPresensiSelesai = (p) => {
    try {
      const status = p.status_pertemuan;
      // Jika status backend adalah selesai atau dibatalkan → masuk riwayat
      if (status === "selesai" || status === "dibatalkan") {
        return true;
      }
      // Cek apakah batas_presensi (tenggat waktu) sudah lewat
      if (p.batas_presensi) {
        const batasStr = String(p.batas_presensi);
        const batasDt = new Date(batasStr.endsWith("Z") ? batasStr : batasStr + "Z");
        if (!isNaN(batasDt.getTime()) && new Date() > batasDt) {
          return true;
        }
      }
      // Semua status lain (belum, sedang) tanpa tenggat lewat → aktif
      return false;
    } catch {
      return false;
    }
  };

  // Handler untuk mulai pertemuan (ubah status → sedang)
  const handleMulaiPertemuan = async (presensi) => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/pertemuan/${presensi.id_pertemuan}/mulai?durasi_menit=90`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("success", "✅ Presensi berhasil dimulai! Mahasiswa sekarang dapat melakukan absen.");
        loadDataPresensi();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", `❌ Gagal memulai presensi: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error("handleMulaiPertemuan error:", e);
      showNotification("error", "❌ Terjadi kesalahan saat menghubungi server.");
    }
  };

  // Handler untuk membuka modal konfirmasi selesaikan pertemuan
  const handleOpenSelesaiModal = (presensi) => {
    setSelesaiTarget(presensi);
    setShowSelesaiModal(true);
  };

  // Handler untuk selesaikan pertemuan (ubah status → selesai) — dipanggil setelah konfirmasi
  const handleSelesaikanPertemuan = async () => {
    if (!selesaiTarget) return;
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/pertemuan/${selesaiTarget.id_pertemuan}/selesai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowSelesaiModal(false);
      setSelesaiTarget(null);
      if (res.ok) {
        showNotification("success", "✅ Presensi selesai! Data telah diarsipkan ke riwayat.");
        loadDataPresensi();
        loadRiwayatPresensi();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", `❌ Gagal menyelesaikan presensi: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error("handleSelesaikanPertemuan error:", e);
      setShowSelesaiModal(false);
      setSelesaiTarget(null);
      showNotification("error", "❌ Terjadi kesalahan saat menghubungi server.");
    }
  };

  // Export CSV untuk satu presensi (navigasi ke detail atau export minimal)
  const handleExportCSV = (presensi) => {
    const rows = [
      ["Kelas", "Mata Kuliah", "Kode MK", "Minggu", "Tanggal", "Waktu Mulai", "Waktu Selesai", "Total", "Hadir", "Alpa"],
      [
        presensi.kelas,
        presensi.matkul,
        presensi.kode_mk,
        `Minggu ${presensi.pertemuan}`,
        new Date(presensi.tanggal).toLocaleDateString("id-ID"),
        presensi.waktu_mulai,
        presensi.waktu_selesai,
        presensi.total_mhs,
        presensi.hadir,
        presensi.alpa,
      ],
    ];
    const csvContent = rows.map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presensi_${presensi.kelas}_${presensi.matkul}_minggu${presensi.pertemuan}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter presensi (p.id_jadwal == id_kelas_mk in frontend context)
  const allFiltered = daftarPresensi.filter((p) => {
    const kelasMKMatch =
      !filterForm.id_kelas_mk ||
      Number(p.id_jadwal) === Number(filterForm.id_kelas_mk);
    const mingguMatch =
      !filterForm.minggu || p.pertemuan_ke.toString() === filterForm.minggu;
    return kelasMKMatch && mingguMatch;
  });

  // Pisahkan: aktif vs riwayat berdasarkan status_pertemuan
  const filteredPresensi = allFiltered.filter((p) => !isPresensiSelesai(p));

  // Debug logging
  console.log("[DEBUG] Render state:");
  console.log("  - daftarPresensi count:", daftarPresensi.length);
  console.log("  - allFiltered count:", allFiltered.length);
  console.log("  - filteredPresensi count:", filteredPresensi.length);
  console.log("  - filterForm.id_kelas_mk:", filterForm.id_kelas_mk, "filterForm.minggu:", filterForm.minggu);

  if (filteredPresensi.length === 0 && daftarPresensi.length > 0) {
    console.log("  - DEBUG: Checking isPresensiSelesai for each:");
    allFiltered.forEach((p, i) => {
      const isSelesai = isPresensiSelesai(p);
      console.log(`    ${i}: id=${p.id_pertemuan}, status_pertemuan=${p.status_pertemuan}, tanggal=${p.tanggal}, id_jadwal=${p.id_jadwal} => isSelesai=${isSelesai}`);
    });
  }

  // Filter riwayat dari dua sumber dengan deduplikasi:
  // 1. Tabel history_presensi (riwayatData) - sumber utama
  // 2. Presensi dari daftarPresensi yang sudah lewat status - sebagai backup jika belum di-archive
  const riwayatFromDaftar = daftarPresensi
    .filter((p) => isPresensiSelesai(p))
    .map((p) => ({
      id_pertemuan: p.id_pertemuan,
      id_jadwal: p.id_jadwal,
      pertemuan_ke: p.pertemuan_ke,
      tanggal: p.tanggal,
      status_pertemuan: p.status_pertemuan,
      // Field untuk tabel
      nama_mk: p.matkul,
      kode_mk: p.kode_mk,
      nama_kelas: p.kelas,
      total: p.total_mhs,
      hadir: p.hadir,
      alpha: p.alpa,
      jam_mulai: p.waktu_mulai,
      jam_selesai: p.waktu_selesai,
      // Tandai source untuk debugging
      _source: "pertemuan",
    }));

  // Deduplikasi: jika sudah ada di riwayatData (dari history_presensi table),
  // jangan tampilkan duplikat dari riwayatFromDaftar
  const existingPertemuanIds = new Set(riwayatData.map(r => r.id_pertemuan));
  const filteredRiwayatsFromDaftar = riwayatFromDaftar.filter(
    r => !existingPertemuanIds.has(r.id_pertemuan)
  );

  console.log("[DEBUG] Deduplication: riwayatData count:", riwayatData.length,
    "riwayatFromDaftar count:", riwayatFromDaftar.length,
    "duplicates removed:", riwayatFromDaftar.length - filteredRiwayatsFromDaftar.length);

  const filteredRiwayat = riwayatData
    .concat(filteredRiwayatsFromDaftar)
    .filter((r) => {
      const kelasMKMatch =
        !filterRiwayat.id_kelas_mk ||
        Number(r.id_jadwal) === Number(filterRiwayat.id_kelas_mk);
      const mingguMatch =
        !filterRiwayat.minggu || (r.pertemuan_ke && r.pertemuan_ke.toString() === filterRiwayat.minggu);
      return kelasMKMatch && mingguMatch;
    });

  // Debug: log riwayat count
  console.log("[DEBUG] Riwayat: riwayatData=", riwayatData.length, "riwayatFromDaftar=", riwayatFromDaftar.length, "filteredRiwayat=", filteredRiwayat.length);

  if (loading) {
    return (
      <DashboardLayout
        navigationItems={navigationItems}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
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
          <div
            className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${notification.type === "success" ? "bg-green-500" : "bg-red-500"
              } text-white`}
          >
            {notification.type === "success" ? "✓" : "✕"} {notification.message}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Generate Presensi Baru — hanya admin & dosen */}
        {isStaff && (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                <Plus className="text-blue-600" /> Tambah Presensi Baru
              </h1>
              <p className="text-gray-600 text-sm">
                Generate daftar presensi untuk semua mahasiswa. Presensi{" "}
                <span className="font-semibold text-green-700">langsung aktif</span> saat dibuat
                mahasiswa dapat melakukan presensi via mobile.
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {/* Pilih Mata Kuliah / Pelajaran dengan Search Bar */}
                <div className="md:col-span-2 relative" ref={mkDropdownRef}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Mata Kuliah / Pelajaran <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-gray-500 font-medium">
                      {searchMataKuliah.trim() ? (
                        <span className="text-blue-600 font-semibold">
                          Ditemukan {filteredMataKuliahList.length} dari {matakuliahList.length} mata pelajaran
                        </span>
                      ) : (
                        <span>{matakuliahList.length} mata pelajaran tersedia</span>
                      )}
                    </span>
                  </div>

                  {/* Search Bar Input */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchMataKuliah}
                      onChange={(e) => {
                        setSearchMataKuliah(e.target.value);
                        setIsMKDropdownOpen(true);
                      }}
                      onFocus={() => setIsMKDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setIsMKDropdownOpen(false);
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          if (filteredMataKuliahList.length > 0) {
                            handleSelectMataKuliah(filteredMataKuliahList[0].id_matakuliah);
                          }
                        }
                      }}
                      placeholder={
                        selectedMatakuliah
                          ? `Cari mata pelajaran lain (terpilih: ${selectedMatakuliah.nama_matakuliah})...`
                          : "Cari mata pelajaran (ketik nama atau kode, contoh: IF101, Algoritma, Web)..."
                      }
                      className={`w-full pl-10 pr-20 py-2.5 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm ${
                        selectedMatakuliah ? "border-blue-300" : "border-gray-300"
                      }`}
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {searchMataKuliah && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchMataKuliah("");
                            searchInputRef.current?.focus();
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                          title="Hapus teks pencarian"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMKDropdownOpen((prev) => !prev)}
                        className="p-1 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 transition"
                        title={isMKDropdownOpen ? "Tutup daftar" : "Buka daftar"}
                      >
                        {isMKDropdownOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Mata Kuliah Terpilih */}
                  {selectedMatakuliah ? (
                    <div className="mt-2.5 p-2.5 bg-blue-50/90 border border-blue-200 rounded-lg flex items-center justify-between text-sm shadow-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-blue-600 text-white rounded-md flex-shrink-0">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded">
                              {selectedMatakuliah.kode_matakuliah}
                            </span>
                            <span className="font-semibold text-gray-900 truncate">
                              {selectedMatakuliah.nama_matakuliah}
                            </span>
                            <span className="text-xs text-blue-700 font-medium whitespace-nowrap">
                              • {selectedMatakuliah.sks} SKS
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                          <Check className="h-3.5 w-3.5" /> Terpilih
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectMataKuliah("")}
                          className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition flex items-center gap-1"
                          title="Batalkan pilihan mata pelajaran"
                        >
                          <X className="h-3.5 w-3.5" /> Ganti
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Silakan cari atau pilih mata pelajaran di atas
                    </p>
                  )}

                  {/* Dropdown Hasil Pencarian / Pilihan */}
                  {isMKDropdownOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="bg-gray-50/90 px-3.5 py-2 border-b border-gray-200 flex items-center justify-between text-xs text-gray-600">
                        <span className="font-semibold text-gray-700">
                          {searchMataKuliah.trim()
                            ? `Hasil Pencarian: ${filteredMataKuliahList.length} mata pelajaran`
                            : `Semua Mata Pelajaran (${matakuliahList.length})`}
                        </span>
                        {searchMataKuliah && (
                          <button
                            type="button"
                            onClick={() => setSearchMataKuliah("")}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Tampilkan Semua
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {filteredMataKuliahList.length === 0 ? (
                          <div className="p-6 text-center text-gray-500">
                            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-medium text-gray-700">
                              Mata pelajaran tidak ditemukan
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Tidak ada mata pelajaran yang cocok dengan kata kunci &quot;{searchMataKuliah}&quot;
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchMataKuliah("");
                                searchInputRef.current?.focus();
                              }}
                              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
                            >
                              Reset Pencarian
                            </button>
                          </div>
                        ) : (
                          filteredMataKuliahList.map((mk) => {
                            const isSelected =
                              selectedMatakuliah?.id_matakuliah === mk.id_matakuliah;
                            return (
                              <button
                                key={mk.id_matakuliah}
                                type="button"
                                onClick={() => handleSelectMataKuliah(mk.id_matakuliah)}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors group ${
                                  isSelected
                                    ? "bg-blue-50/80 border-l-4 border-blue-600"
                                    : "hover:bg-blue-50/40"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 pr-3">
                                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex-shrink-0">
                                    {mk.kode_matakuliah}
                                  </span>
                                  <div className="truncate">
                                    <span className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                                      {mk.nama_matakuliah}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({mk.sks} SKS)
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  {isSelected ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                      <Check className="h-3 w-3" /> Dipilih
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 group-hover:text-blue-600 font-medium transition-colors">
                                      Pilih →
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="bg-gray-50 px-3.5 py-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
                        <span>💡 Tekan <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">Enter</kbd> untuk memilih hasil teratas</span>
                        <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">Esc</kbd> untuk menutup</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pilih Kelas */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kelas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={generateForm.id_kelas}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        id_kelas: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama_kelas}
                        {k.angkatan ? ` (${k.angkatan})` : ""}
                        {k.golongan ? ` - ${k.golongan}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tahun Ajaran */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tahun Ajaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={generateForm.tahun_ajaran}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        tahun_ajaran: e.target.value,
                      })
                    }
                    placeholder="Contoh: 2024/2025"
                    disabled={hasExistingPenawaran}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasExistingPenawaran ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Semester <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={generateForm.semester}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        semester: e.target.value,
                      })
                    }
                    disabled={hasExistingPenawaran}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasExistingPenawaran ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Minggu Ke */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pertemuan Ke <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={generateForm.minggu}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        minggu: e.target.value,
                      })
                    }
                    min="1"
                    placeholder="Contoh: 1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Tanggal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={generateForm.tanggal}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        tanggal: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Waktu Mulai */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Waktu Mulai
                  </label>
                  <input
                    type="time"
                    value={generateForm.waktu_mulai}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [, m] = val.split(':');
                        if (parseInt(m, 10) > 59) return;
                      }
                      if (generateForm.waktu_selesai && val > generateForm.waktu_selesai) {
                        showNotification("error", "Jam mulai tidak boleh melebihi jam selesai");
                        return;
                      }
                      setGenerateForm({ ...generateForm, waktu_mulai: val });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Waktu Selesai */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Waktu Selesai
                  </label>
                  <input
                    type="time"
                    value={generateForm.waktu_selesai}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [, m] = val.split(':');
                        if (parseInt(m, 10) > 59) return;
                      }
                      if (generateForm.waktu_mulai && val < generateForm.waktu_mulai) {
                        showNotification("error", "Jam selesai tidak boleh kurang dari jam mulai");
                        return;
                      }
                      setGenerateForm({ ...generateForm, waktu_selesai: val });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePresensi}
                disabled={
                  !generateForm.id_matakuliah ||
                  !generateForm.id_kelas ||
                  !generateForm.tahun_ajaran ||
                  !generateForm.semester ||
                  !generateForm.minggu ||
                  !generateForm.tanggal ||
                  (generateForm.mode_lokasi === "wajib" && !generateForm.id_geolokasi)
                }
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Generate Presensi untuk Semua Mahasiswa
              </button>

              {/* Mode Lokasi */}
              <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-800">Mode Presensi Lokasi</span>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode_lokasi" value="bebas"
                      checked={generateForm.mode_lokasi === "bebas"}
                      onChange={() => setGenerateForm({ ...generateForm, mode_lokasi: "bebas", id_geolokasi: "" })}
                      className="accent-indigo-600" />
                    <span className="text-sm font-medium text-gray-700">🌐 Bebas (dari mana saja)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode_lokasi" value="wajib"
                      checked={generateForm.mode_lokasi === "wajib"}
                      onChange={() => setGenerateForm({ ...generateForm, mode_lokasi: "wajib" })}
                      className="accent-indigo-600" />
                    <span className="text-sm font-medium text-gray-700">📍 Wajib Lokasi (GPS mahasiswa divalidasi)</span>
                  </label>
                </div>
                {generateForm.mode_lokasi === "wajib" && (
                  <div>
                    <label className="block text-xs font-semibold text-indigo-700 mb-1">
                      Pilih Lokasi Presensi <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={generateForm.id_geolokasi}
                      onChange={(e) => setGenerateForm({ ...generateForm, id_geolokasi: e.target.value })}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="">-- Pilih Lokasi --</option>
                      {geolokasiList.map((g) => (
                        <option key={g.id_geolokasi} value={g.id_geolokasi}>
                          {g.nama_lokasi} (radius {g.radius_meter} m)
                        </option>
                      ))}
                    </select>
                    {geolokasiList.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        ⚠️ Belum ada lokasi aktif. Tambahkan di menu{" "}
                        <a href="/kelola-geolokasi" className="underline font-semibold">Kelola Geolokasi</a>.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">💡 Info:</span> Presensi langsung aktif saat dibuat.
                  Mahasiswa dapat absen melalui aplikasi mobile{" "}
                  <span className="font-bold">
                    selama 12 jam sejak pertemuan dibuat
                  </span>
                  . Klik <strong>Selesaikan</strong> untuk menutup sesi lebih awal.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Filter & Cek Presensi yang Sudah Dibuat */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
              <UserCheck className="text-green-600" /> Cek Presensi yang Sudah
              Dibuat
            </h1>
            <p className="text-gray-600 text-sm">
              Filter dan lihat detail presensi yang sudah dibuat
            </p>
          </div>

          {/* Filter */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="text-green-600 h-5 w-5" />
              <h2 className="text-lg font-semibold text-gray-900">
                Filter Presensi
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filter Mata Kuliah & Kelas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mata Kuliah & Kelas
                </label>
                <select
                  value={filterForm.id_kelas_mk}
                  onChange={(e) =>
                    setFilterForm({
                      ...filterForm,
                      id_kelas_mk: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Semua Mata Kuliah</option>
                  {daftarKelasMK.map((mk) => (
                    <option key={mk.id_kelas_mk} value={mk.id_kelas_mk}>
                      [{mk.kode_mk}] {mk.nama_mk} - {mk.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Minggu */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Minggu Ke
                </label>
                <input
                  type="number"
                  value={filterForm.minggu}
                  onChange={(e) =>
                    setFilterForm({ ...filterForm, minggu: e.target.value })
                  }
                  min="1"
                  placeholder="Semua Minggu"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Daftar Presensi */}
          <div className="space-y-4">
            {filteredPresensi.length > 0 ? (
              filteredPresensi.map((presensi) => (
                <div
                  key={presensi.id}
                  className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    {/* Info Presensi */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Status Badge */}
                        {presensi.status_pertemuan === "sedang" ? (
                          <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-full animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            <span className="text-xs font-bold">Sedang Berlangsung</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-full">
                            <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                            <span className="text-xs font-bold">Belum Dimulai</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                          <Users className="h-4 w-4" />
                          <span className="text-sm font-semibold">
                            {presensi.kelas}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                          <BookOpen className="h-4 w-4" />
                          <span className="text-sm font-semibold">
                            {presensi.matkul}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm font-semibold">
                            Minggu {presensi.pertemuan}
                          </span>
                        </div>
                        {presensi.mode_lokasi === "wajib" && (
                          <div className="flex items-center gap-2 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm font-semibold">Wajib Lokasi</span>
                          </div>
                        )}
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-semibold">Tanggal:</span>{" "}
                          {new Date(presensi.tanggal).toLocaleDateString(
                            "id-ID",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="font-semibold">
                            Waktu Absen:
                          </span>{" "}
                          {presensi.waktu_mulai} - {presensi.waktu_selesai}
                        </div>
                      </div>

                      {/* Statistik */}
                      <div className="flex flex-wrap gap-4">
                        <div className="text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-bold text-gray-900 ml-1">
                            {presensi.total_mhs}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Hadir:</span>
                          <span className="font-bold text-green-600 ml-1">
                            {presensi.hadir}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Alpa:</span>
                          <span className="font-bold text-red-600 ml-1">
                            {presensi.alpa}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${presensi.total_mhs > 0 ? (presensi.hadir / presensi.total_mhs) * 100 : 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        onClick={() => handleLihatDetail(presensi)}
                        className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-semibold text-sm"
                      >
                        <Eye className="h-4 w-4" />
                        Lihat Detail
                      </button>


                      {isStaff && presensi.status_pertemuan === "sedang" && (
                        <button
                          onClick={() => handleOpenSelesaiModal(presensi)}
                          className="bg-amber-600 text-white px-5 py-2.5 rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2 font-semibold text-sm"
                          title="Selesaikan sesi presensi"
                        >
                          ■ Selesaikan
                        </button>
                      )}
                      {isStaff && (
                        <button
                          onClick={() => handleDeletePresensi(presensi)}
                          className="bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 font-semibold text-sm"
                          title="Hapus Presensi"
                        >
                          <Trash className="h-4 w-4" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <UserCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium text-lg">
                  Belum ada data presensi
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Silakan generate presensi baru di bagian atas
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Riwayat Presensi (Tidak Aktif) */}
        <div id="riwayat-section" className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-8">
          <div className="mb-4">
            <button
              onClick={() => setShowRiwayat((v) => !v)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Archive className="text-slate-500" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    Riwayat Presensi
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                      {filteredRiwayat.length} sesi
                    </span>
                  </h1>
                  <p className="text-gray-500 text-sm text-left">
                    Presensi yang sudah selesai atau melewati jadwal — tetap bisa dilihat & diedit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-700 transition">
                {showRiwayat ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
              </div>
            </button>
          </div>

          {showRiwayat && (
            <div className="space-y-4">
              {/* Filter Riwayat */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-5 mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="text-slate-500 h-4 w-4" />
                  <span className="text-sm font-semibold text-slate-700">Filter Riwayat</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mata Kuliah & Kelas</label>
                    <select
                      value={filterRiwayat.id_kelas_mk}
                      onChange={(e) => setFilterRiwayat({ ...filterRiwayat, id_kelas_mk: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    >
                      <option value="">Semua Mata Kuliah</option>
                      {daftarKelasMK.map((mk) => (
                        <option key={mk.id_kelas_mk} value={mk.id_kelas_mk}>
                          [{mk.kode_mk}] {mk.nama_mk} - {mk.nama_kelas}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Minggu Ke</label>
                    <input
                      type="number"
                      value={filterRiwayat.minggu}
                      onChange={(e) => setFilterRiwayat({ ...filterRiwayat, minggu: e.target.value })}
                      min="1"
                      placeholder="Semua Minggu"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {loadingRiwayat ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto mb-3"></div>
                  <p className="text-gray-500 font-medium">Memuat riwayat presensi...</p>
                </div>
              ) : filteredRiwayat.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">No</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Pertemuan</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Mata Kuliah</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Kelas</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Tanggal</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Hadir</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Alpa</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredRiwayat.map((riwayat, index) => (
                          <tr key={riwayat.id_pertemuan} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <Archive className="h-3 w-3" /> Selesai
                              </span>
                              <div className="text-xs text-gray-500 mt-0.5">Minggu {riwayat.pertemuan_ke}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">{riwayat.nama_mk}</div>
                              <div className="text-xs text-gray-500">{riwayat.kode_mk}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{riwayat.nama_kelas}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {riwayat.tanggal ? new Date(riwayat.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }) : "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{riwayat.total}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700">
                                {riwayat.hadir}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700">
                                {riwayat.alpha}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleLihatDetail({ id_pertemuan: riwayat.id_pertemuan })}
                                  className="bg-slate-600 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition flex items-center gap-1.5 font-semibold text-xs"
                                  title="Lihat & Edit"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Detail
                                </button>
                                <button
                                  onClick={() => handleExportCSV({
                                    kelas: riwayat.nama_kelas,
                                    matkul: riwayat.nama_mk,
                                    kode_mk: riwayat.kode_mk,
                                    pertemuan: riwayat.pertemuan_ke,
                                    tanggal: riwayat.tanggal,
                                    waktu_mulai: riwayat.jam_mulai,
                                    waktu_selesai: riwayat.jam_selesai,
                                    total_mhs: riwayat.total,
                                    hadir: riwayat.hadir,
                                    alpa: riwayat.alpha,
                                  })}
                                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 font-semibold text-xs"
                                  title="Export ke CSV"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                {isStaff && (
                                  <button
                                    onClick={() =>
                                      handleDeletePresensi({
                                        id_pertemuan: riwayat.id_pertemuan,
                                        kelas: riwayat.nama_kelas,
                                        matkul: riwayat.nama_mk,
                                        pertemuan_ke: riwayat.pertemuan_ke,
                                        pertemuan: riwayat.pertemuan_ke,
                                        tanggal: riwayat.tanggal,
                                      })
                                    }
                                    className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition flex items-center gap-1.5 font-semibold text-xs"
                                    title="Hapus Riwayat Presensi"
                                  >
                                    <Trash className="h-3.5 w-3.5" />
                                    Hapus
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Belum ada riwayat presensi</p>
                  <p className="text-gray-400 text-sm mt-1">Data riwayat presensi dari tabel history akan muncul di sini</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Success Modal dengan Animasi Checkmark */}
      {showSuccessModal && successData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
          }}
          className="w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fadeIn"
        >
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 transform animate-scaleIn shadow-2xl">
            {/* Animated Checkmark */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
                  <svg
                    className="w-16 h-16 text-green-600 animate-checkmark"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-green-200 animate-ping opacity-75"></div>
              </div>
            </div>

            {/* Success Message */}
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Presensi Berhasil Digenerate!
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Data presensi telah dibuat untuk semua mahasiswa
            </p>

            {/* Detail Info */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">
                  Kelas:
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {successData.kelas}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">
                  Mata Kuliah:
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {successData.matkul}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">
                  Minggu:
                </span>
                <span className="text-sm font-bold text-gray-900">
                  Ke-{successData.minggu}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">
                  Tanggal:
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {successData.tanggal}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">
                  Waktu:
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {successData.waktu_mulai} - {successData.waktu_selesai}
                </span>
              </div>
              <div className="pt-3 border-t border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 font-medium">
                    Total Mahasiswa:
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {successData.total_mahasiswa} orang
                  </span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            {/* <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-xs text-amber-800">
                  <p className="font-semibold mb-1">Status Awal: Belum Absen</p>
                  <p>• Mahasiswa dapat absen via mobile app pada waktu yang ditentukan</p>
                  <p>• Status otomatis berubah menjadi ALFA jika melewati waktu selesai</p>
                </div>
              </div>
            </div> */}

            {/* Close Button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
          }}
          className="w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fadeIn"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 transform animate-scaleIn shadow-xl">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                  <Trash className="w-10 h-10 text-red-600" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-200 animate-ping opacity-70"></div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
              Konfirmasi Hapus Presensi
            </h2>
            <p className="text-center text-gray-600 text-sm mb-4">
              Tindakan ini akan menghapus semua record presensi untuk pertemuan
              ini.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Kelas:</span>
                <span className="font-semibold text-gray-900">
                  {deleteTarget.kelas}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Mata Kuliah:</span>
                <span className="font-semibold text-gray-900">
                  {deleteTarget.matkul}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Minggu:</span>
                <span className="font-semibold text-gray-900">
                  Ke-{deleteTarget.pertemuan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Tanggal:</span>
                <span className="font-semibold text-gray-900">
                  {new Date(deleteTarget.tanggal).toLocaleDateString("id-ID", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={cancelDeletePresensi}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <XCircle className="h-5 w-5" /> Batal
              </button>
              <button
                onClick={confirmDeletePresensi}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <Trash className="h-5 w-5" /> Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Modal */}
      {showDeleteSuccessModal && deleteSuccessInfo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
          }}
          className="w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fadeIn"
        >
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 transform animate-scaleIn shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center animate-bounce">
                  <Trash className="w-14 h-14 text-red-600" />
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-red-200 animate-ping opacity-75"></div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Presensi Dihapus
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Data presensi untuk pertemuan ini berhasil dihapus.
            </p>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-5 mb-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Kelas:</span>
                <span className="font-bold text-gray-900">
                  {deleteSuccessInfo.kelas}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Mata Kuliah:</span>
                <span className="font-bold text-gray-900">
                  {deleteSuccessInfo.matkul}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Minggu:</span>
                <span className="font-bold text-gray-900">
                  Ke-{deleteSuccessInfo.minggu}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Tanggal:</span>
                <span className="font-bold text-gray-900">
                  {deleteSuccessInfo.tanggal}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowDeleteSuccessModal(false);
                setDeleteSuccessInfo(null);
              }}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-lg font-semibold hover:from-red-700 hover:to-rose-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Selesai Confirmation Modal */}
      {showSelesaiModal && selesaiTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
          }}
          className="w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fadeIn"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 transform animate-scaleIn shadow-xl">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center animate-pulse">
                  <span className="text-4xl">■</span>
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-amber-200 animate-ping opacity-70"></div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
              Akhiri Sesi Presensi?
            </h2>
            <p className="text-center text-gray-600 text-sm mb-4">
              Apakah Anda yakin ingin mengakhiri presensi ini? Mahasiswa tidak akan bisa absen lagi dan data akan masuk ke riwayat.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Kelas:</span>
                <span className="font-semibold text-gray-900">{selesaiTarget.kelas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Mata Kuliah:</span>
                <span className="font-semibold text-gray-900">{selesaiTarget.matkul}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Minggu:</span>
                <span className="font-semibold text-gray-900">Ke-{selesaiTarget.pertemuan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Tanggal:</span>
                <span className="font-semibold text-gray-900">
                  {selesaiTarget.tanggal
                    ? new Date(selesaiTarget.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "-"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setShowSelesaiModal(false); setSelesaiTarget(null); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <XCircle className="h-5 w-5" /> Batal
              </button>
              <button
                onClick={handleSelesaikanPertemuan}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                ■ Ya, Akhiri Presensi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkmark {
          0% {
            stroke-dasharray: 0, 100;
          }
          100% {
            stroke-dasharray: 100, 0;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
        .animate-checkmark {
          stroke-dasharray: 100;
          animation: checkmark 0.6s ease-in-out 0.2s forwards;
        }
      `}</style>
    </DashboardLayout>
  );
}
