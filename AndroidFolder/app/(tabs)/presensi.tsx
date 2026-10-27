import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import * as Location from "expo-location";
import { API_BASE } from "@/constants/config";
import FaceRecognition, { FaceScanResult, ScanStatus } from "./face_recognition";

// ─── Types ─────────────────────────────────────────────────────────────────

type ViewMode = "list" | "scan" | "history";
type MainTab = "presensi" | "riwayat";
type AttendanceStatus = "belum" | "hadir" | "terlambat" | "izin" | "sakit" | "alpha";
type HistoryStatus = "hadir" | "terlambat" | "izin" | "sakit" | "alpha";

interface Session {
  batas_presensi: any;
  id_pertemuan: number;
  pertemuan_ke: number;
  tanggal: string;
  status_pertemuan: string;
  nama_matakuliah: string;
  kode_matakuliah: string;
  total_mahasiswa: number;
  sudah_hadir: number;
  belum_presensi: number;
  mode_lokasi: "bebas" | "wajib";
  id_geolokasi: number | null;
}

interface HistoryItem {
  id_history: number;
  id_mahasiswa: number;
  nim: string;
  nama_mahasiswa: string;
  id_pertemuan: number;
  pertemuan_ke: number | null;
  tanggal: string | null;
  id_jadwal: number | null;
  nama_mk: string;
  kode_mk: string;
  nama_kelas: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  ruangan: string;
  waktu_presensi: string | null;
  status_presensi: HistoryStatus | null;
  confidence_score: number | null;
  lbph_score: number | null;
  cnn_score: number | null;
  metode_deteksi: string | null;
  latitude_presensi: number | null;
  longitude_presensi: number | null;
  jarak_meter: number | null;
  created_at: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(timeStr: string): string {
  // timeStr bisa "08:00:00" atau ISO string
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return timeStr.substring(0, 5);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const STATUS_MAP: Record<AttendanceStatus, { color: string; label: string }> = {
  belum: { color: "#FFB300", label: "Belum Presensi" },
  hadir: { color: "#4CAF50", label: "Hadir" },
  terlambat: { color: "#FF9800", label: "Terlambat" },
  izin: { color: "#2196F3", label: "Izin" },
  sakit: { color: "#9C27B0", label: "Sakit" },
  alpha: { color: "#F44336", label: "Alpha" },
};

const getHistoryStatusMap = (
  isDark: boolean
): Record<
  HistoryStatus,
  { color: string; bg: string; label: string; icon: string }
> => ({
  hadir: {
    color: isDark ? "#34D399" : "#10B981",
    bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
    label: "Hadir",
    icon: "checkmark-circle",
  },
  terlambat: {
    color: isDark ? "#FBBF24" : "#F59E0B",
    bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
    label: "Terlambat",
    icon: "time",
  },
  izin: {
    color: isDark ? "#60A5FA" : "#3B82F6",
    bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
    label: "Izin",
    icon: "document-text",
  },
  sakit: {
    color: isDark ? "#C084FC" : "#8B5CF6",
    bg: isDark ? "rgba(139, 92, 246, 0.15)" : "#F5F3FF",
    label: "Sakit",
    icon: "medical",
  },
  alpha: {
    color: isDark ? "#F87171" : "#EF4444",
    bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
    label: "Alpha",
    icon: "close-circle",
  },
});

function getSessionChip(
  status: string,
  isDark: boolean
): {
  bg: string;
  dot: string;
  label: string;
} {
  switch (status) {
    case "sedang":
      return {
        bg: isDark ? "rgba(33, 150, 243, 0.15)" : "#E8F4FD",
        dot: isDark ? "#60A5FA" : "#2196F3",
        label: "Sedang Berlangsung",
      };
    case "belum":
      return {
        bg: isDark ? "rgba(255, 179, 0, 0.15)" : "#FFF8E1",
        dot: isDark ? "#FBBF24" : "#FFB300",
        label: "Belum Mulai",
      };
    default:
      return {
        bg: isDark ? "#334155" : "#F5F5F5",
        dot: isDark ? "#94A3B8" : "#9E9E9E",
        label: "Selesai",
      };
  }
}

// ─── Theme Colors Fallback ───────────────────────────────────────────────────

const THEME = {
  bg: "#FFFFFF",
  bgSecondary: "#F8FAFC",
  bgCard: "#FFFFFF",
  bgInput: "#F1F5F9",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  primary: "#2563EB",
  primaryLight: "#3B82F6",
  primaryDark: "#1D4ED8",
  primaryBg: "#EFF6FF",
  success: "#10B981",
  successBg: "#ECFDF5",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  shadow: "rgba(0, 0, 0, 0.06)",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PresensiScreen() {
  const { isDarkMode, theme: themeContext } = useTheme();

  const colors = {
    bg: themeContext.bg,
    bgCard: themeContext.cardBg,
    bgInput: isDarkMode ? "#1E293B" : "#F1F5F9",
    border: themeContext.border,
    borderLight: themeContext.divider,
    textPrimary: themeContext.textPrimary,
    textSecondary: themeContext.textSecondary,
    textMuted: themeContext.textMuted,
    primary: themeContext.accent,
    primaryLight: isDarkMode ? "#60A5FA" : "#3B82F6",
    primaryBg: themeContext.accentLight,
    success: isDarkMode ? "#34D399" : "#10B981",
    successBg: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
    warning: isDarkMode ? "#FBBF24" : "#F59E0B",
    warningBg: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
    danger: isDarkMode ? "#F87171" : "#EF4444",
    dangerBg: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
    shadow: themeContext.shadowColor,
  };

  const [mainTab, setMainTab] = useState<MainTab>("presensi");
  const [view, setView] = useState<ViewMode>("list");
  const { token, user } = useAuth();
  const [isDemo, setIsDemo] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [checkingAttendance, setCheckingAttendance] = useState<number | null>(null); // Track session yang sedang di-check

  // History state
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);

  // Face recognition state
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("front");
  const [faceScanResult, setFaceScanResult] = useState<FaceScanResult | null>(null);
  const [isGalleryImage, setIsGalleryImage] = useState(false);
  const [galleryBase64, setGalleryBase64] = useState<string | null>(null);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geolokasiData, setGeolokasiData] = useState<{
    latitude: number;
    longitude: number;
    radius_meter: number;
    nama_lokasi: string;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isMockLocation, setIsMockLocation] = useState(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [token]);

  // Fetch history saat tab riwayat dibuka
  useEffect(() => {
    if (mainTab === "riwayat") {
      fetchHistory();
    }
  }, [mainTab]);

  useEffect(() => {
    return () => {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (view !== "scan" || !selectedSession) {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
      return;
    }
    setUserLocation(null);
    setGeolokasiData(null);
    setIsMockLocation(false);
    loadUserLocation();
    if (selectedSession.mode_lokasi === "wajib" && selectedSession.id_geolokasi) {
      fetchGeolokasiData(selectedSession.id_geolokasi);
    }
  }, [view, selectedSession?.id_pertemuan]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    if (!token) {
      setIsDemo(true);
      setSessions([]);
      setLoadingSessions(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/pertemuan/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.warn("[fetchSessions] Auth error - token might be expired");
        throw new Error("401");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = (await res.json()) as Session[];

      // Debug: log raw response untuk troubleshooting
      console.log("[fetchSessions] Raw response count:", all.length);
      if (all.length > 0) {
        console.log("[fetchSessions] Sample session:", JSON.stringify(all[0], null, 2));
      }

      // Filter sesi yang aktif (belum atau sedang) DAN belum melewati tenggat
      const aktif = all.filter((s) => {
        // Hanya tampilkan status belum/sedang
        if (s.status_pertemuan !== "belum" && s.status_pertemuan !== "sedang") {
          return false;
        }
        // Cek apakah batas_presensi sudah lewat
        if (s.batas_presensi) {
          const batasStr = String(s.batas_presensi);
          const batasDt = new Date(batasStr.endsWith("Z") ? batasStr : batasStr + "Z");
          if (!isNaN(batasDt.getTime()) && new Date() > batasDt) {
            console.log(`[fetchSessions] Session ${s.id_pertemuan} expired (batas: ${batasStr})`);
            return false;
          }
        }
        return true;
      });
      console.log("[fetchSessions] Filtered aktif count:", aktif.length);

      setSessions(aktif);
      setIsDemo(false);
    } catch (err) {
      console.error("[fetchSessions] Error:", err);
      setIsDemo(false);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setHistoryRefreshing(true);
    else setLoadingHistory(true);

    try {
      // Ambil history berdasarkan id_mahasiswa dari user yang login
      const idMhs = user?.id_mahasiswa;
      const url = idMhs
        ? `${API_BASE}/history-presensi/?id_mahasiswa=${idMhs}&limit=100`
        : `${API_BASE}/history-presensi/?limit=100`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HistoryItem[];
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("fetchHistory error:", err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
      setHistoryRefreshing(false);
    }
  }, [token, user?.id_mahasiswa]);



  const fetchGeolokasiData = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/geolokasi/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        latitude: number; longitude: number; radius_meter: number; nama_lokasi: string;
      };
      setGeolokasiData(data);
    } catch { }
  };

  // ─── Cek apakah user sudah presensi untuk sesi ini ────────────────────────
  // Dual-strategy: (1) Cek via /pertemuan/{id}/presensi, (2) fallback via /history-presensi
  const checkIfAlreadyAttended = async (session: Session): Promise<{ attended: boolean; status?: string; waktu?: string }> => {
    if (!token || !user?.id_mahasiswa) {
      console.log("[checkIfAlreadyAttended] No token or user, returning false");
      return { attended: false };
    }

    const mhsId = user.id_mahasiswa;
    console.log(`[checkIfAlreadyAttended] Checking session ${session.id_pertemuan} for mahasiswa ${mhsId}`);

    // ── Strategi 1: Cek via endpoint detail presensi pertemuan ──────────────
    try {
      const detailRes = await fetch(
        `${API_BASE}/pertemuan/${session.id_pertemuan}/presensi`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (detailRes.ok) {
        const detailData = await detailRes.json();

        // Endpoint ini mengembalikan mahasiswa yang ADA record di tabel Presensi.
        // Record bisa berstatus "belum" (pre-populated) atau sudah scan (hadir/terlambat/dll).
        // Hanya status selain "belum" yang berarti sudah benar-benar presensi.
        if (detailData.mahasiswa_list && Array.isArray(detailData.mahasiswa_list)) {
          const myRecord = detailData.mahasiswa_list.find(
            (m: any) => Number(m.id_mahasiswa) === Number(mhsId)
          );

          if (myRecord) {
            const status = myRecord.status_presensi;
            console.log(`[checkIfAlreadyAttended] Strategi-1: Found record status=${status}`);
            // Status "belum" = terdaftar di sesi tapi belum scan → belum presensi
            // Status lain (hadir, terlambat, izin, sakit, alpha) = sudah presensi
            if (status && status !== "belum") {
              return {
                attended: true,
                status,
                waktu: myRecord.waktu_presensi,
              };
            }
            console.log("[checkIfAlreadyAttended] Strategi-1: Status belum → belum presensi");
            return { attended: false };
          }
          console.log("[checkIfAlreadyAttended] Strategi-1: User tidak ada di mahasiswa_list → belum presensi");
          return { attended: false };
        }
      } else {
        console.warn(`[checkIfAlreadyAttended] Strategi-1 API error: ${detailRes.status}, mencoba strategi-2`);
      }
    } catch (err) {
      console.warn("[checkIfAlreadyAttended] Strategi-1 error:", err, "mencoba strategi-2");
    }

    // ── Strategi 2: Fallback via history-presensi ────────────────────────────
    try {
      const histRes = await fetch(
        `${API_BASE}/history-presensi/?id_mahasiswa=${mhsId}&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (histRes.ok) {
        const histData = await histRes.json();
        if (Array.isArray(histData)) {
          const myRecord = histData.find(
            (h: any) => Number(h.id_pertemuan) === Number(session.id_pertemuan)
          );
          // Pastikan status bukan null, undefined, atau "belum"
          if (myRecord && myRecord.status_presensi && myRecord.status_presensi !== "belum") {
            console.log(`[checkIfAlreadyAttended] Strategi-2: Found history status=${myRecord.status_presensi}`);
            return {
              attended: true,
              status: myRecord.status_presensi,
              waktu: myRecord.waktu_presensi,
            };
          }
        }
        console.log("[checkIfAlreadyAttended] Strategi-2: Tidak ada riwayat valid → belum presensi");
        return { attended: false };
      } else {
        console.warn(`[checkIfAlreadyAttended] Strategi-2 API error: ${histRes.status}`);
      }
    } catch (err) {
      console.warn("[checkIfAlreadyAttended] Strategi-2 error:", err);
    }

    // Jika kedua strategi gagal (network error), asumsikan belum presensi
    console.log("[checkIfAlreadyAttended] Semua strategi gagal, return false");
    return { attended: false };
  };

  // ─── Handler untuk tap card presensi ─────────────────────────────────────
  const handleSessionCardPress = async (session: Session) => {
    setCheckingAttendance(session.id_pertemuan);

    try {
      const result = await checkIfAlreadyAttended(session);

      if (result.attended) {
        // User sudah presensi — tampilkan alert, JANGAN buka face recognition
        const statusLabel =
          result.status === "terlambat" ? "Terlambat" :
            result.status === "izin" ? "Izin" :
              result.status === "sakit" ? "Sakit" :
                result.status === "alpha" ? "Alpha" : "Hadir";

        const waktuText = result.waktu
          ? `\nWaktu: ${new Date(result.waktu).toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`
          : "";

        Alert.alert(
          "✅ Presensi Sudah Tercatat",
          `Anda sudah melakukan presensi untuk sesi ini.\n\nStatus: ${statusLabel}${waktuText}`,
          [{ text: "OK" }]
        );
      } else {
        // User belum presensi — arahkan ke face recognition
        setSelectedSession(session);
        setScanStatus("idle");
        setCapturedImage(null);
        setShowPreview(false);
        setFaceScanResult(null);
        setIsGalleryImage(false);
        setGalleryBase64(null);
        setView("scan");
      }
    } catch (err) {
      // Error tak terduga — arahkan ke face recognition sebagai fallback aman
      console.error("[handleSessionCardPress] Unexpected error:", err);
      setSelectedSession(session);
      setScanStatus("idle");
      setCapturedImage(null);
      setShowPreview(false);
      setFaceScanResult(null);
      setIsGalleryImage(false);
      setGalleryBase64(null);
      setView("scan");
    } finally {
      setCheckingAttendance(null);
    }
  };

  const loadUserLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Izin Lokasi Ditolak",
          "Aplikasi membutuhkan akses lokasi untuk presensi. Silahkan aktifkan di pengaturan."
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const isMocked = !!(loc.mocked);
      const accuracy = loc.coords.accuracy ?? 999;
      const altitudeAccuracy = loc.coords.altitudeAccuracy ?? 999;

      const isFakeGPS =
        isMocked ||
        accuracy > 200 ||
        accuracy < 1.5 ||
        altitudeAccuracy > 100;

      setIsMockLocation(isFakeGPS);

      if (!isFakeGPS) {
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }

      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }

      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 2,
        },
        (newLoc) => {
          const isMocked = !!(newLoc.mocked);
          const accuracy = newLoc.coords.accuracy ?? 999;
          const altitudeAccuracy = newLoc.coords.altitudeAccuracy ?? 999;

          const isFakeGPS =
            isMocked ||
            accuracy > 200 ||
            accuracy < 1.5 ||
            altitudeAccuracy > 100;

          setIsMockLocation(isFakeGPS);

          if (!isFakeGPS) {
            setUserLocation({
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
            });
          }
        }
      );
    } catch (err) {
      console.warn("loadUserLocation error:", err);
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePresensiSuccess = () => {
    if (selectedSession) {
      fetchSessions();
    }
    setView("list");
  };

  const DemoBanner = () =>
    isDemo ? (
      <View style={[styles.demoBanner, { backgroundColor: colors.warningBg, borderColor: isDarkMode ? "rgba(245, 158, 11, 0.3)" : "#FDE68A" }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
        <Text style={[styles.demoBannerText, { color: colors.warning }]}>Menggunakan data demo</Text>
      </View>
    ) : null;

  // ─── Tab Header ──────────────────────────────────────────────────────────

  const renderMainHeader = () => (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Presensi</Text>
          <Text style={[styles.headerSubtitle, { color: colors.primary }]}>
            {mainTab === "presensi" ? "Sesi aktif & scan wajah" : "Riwayat kehadiran Anda"}
          </Text>
        </View>

      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: colors.bgInput }]}>
        <TouchableOpacity
          style={[styles.tabItem, mainTab === "presensi" && [styles.tabItemActive, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]]}
          onPress={() => setMainTab("presensi")}
          activeOpacity={0.75}
        >
          <Ionicons
            name="scan-outline"
            size={16}
            color={mainTab === "presensi" ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabLabel, { color: colors.textMuted }, mainTab === "presensi" && { color: colors.primary }]}>
            Presensi Aktif
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, mainTab === "riwayat" && [styles.tabItemActive, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]]}
          onPress={() => setMainTab("riwayat")}
          activeOpacity={0.75}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={mainTab === "riwayat" ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabLabel, { color: colors.textMuted }, mainTab === "riwayat" && { color: colors.primary }]}>
            Riwayat
          </Text>
        </TouchableOpacity>
      </View>

      <DemoBanner />

      {/* Content berdasarkan tab */}
      {mainTab === "presensi" ? renderPresensiTab() : renderRiwayatTab()}
    </View>
  );

  // ─── Tab: Presensi Aktif ─────────────────────────────────────────────────

  const renderPresensiTab = () => {
    if (loadingSessions) {
      return (
        <View style={[styles.centerFill, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Memuat sesi...</Text>
        </View>
      );
    }

    if (sessions.length === 0) {
      return (
        <View style={[styles.centerFill, { backgroundColor: colors.bg }]}>
          <Ionicons name="calendar-outline" size={60} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Tidak ada sesi aktif</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Pastikan akun Anda sudah terdaftar di kelas yang memiliki jadwal pertemuan.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 16,
              paddingHorizontal: 24,
              paddingVertical: 10,
              backgroundColor: colors.primaryBg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
            onPress={fetchSessions}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
              Refresh Sekarang
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingSessions}
            onRefresh={fetchSessions}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {sessions.map((session) => {
          const chip = getSessionChip(session.status_pertemuan, isDarkMode);
          const isChecking = checkingAttendance === session.id_pertemuan;

          return (
            <TouchableOpacity
              key={session.id_pertemuan}
              style={[styles.sessionCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: colors.shadow }]}
              onPress={() => handleSessionCardPress(session)}
              activeOpacity={0.75}
              disabled={isChecking}
            >
              {isChecking && (
                <View style={styles.checkingOverlay}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.checkingText}>Memeriksa status presensi...</Text>
                </View>
              )}
              <View style={[styles.sessionChip, { backgroundColor: chip.bg }]}>
                <View style={[styles.sessionChipDot, { backgroundColor: chip.dot }]} />
                <Text style={[styles.sessionChipText, { color: chip.dot }]}>
                  {chip.label}
                </Text>
              </View>

              <View style={styles.sessionCardBody}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionName, { color: colors.textPrimary }]}>{session.nama_matakuliah}</Text>
                  <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                    {session.kode_matakuliah} · Pertemuan ke-{session.pertemuan_ke}
                  </Text>
                  <View style={styles.sessionDateRow}>
                    <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.sessionDate, { color: colors.textMuted }]}>{formatDate(session.tanggal)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>

              <View style={styles.statsRow}>
                <View style={[styles.statsPill, { backgroundColor: colors.successBg }]}>
                  <Text style={[styles.statsPillText, { color: colors.success }]}>
                    {session.sudah_hadir} Hadir
                  </Text>
                </View>
                <View style={[styles.statsPill, { backgroundColor: colors.warningBg }]}>
                  <Text style={[styles.statsPillText, { color: colors.warning }]}>
                    {session.belum_presensi} Belum
                  </Text>
                </View>
                <View style={[styles.statsPill, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.statsPillText, { color: colors.primary }]}>
                    {session.total_mahasiswa} Total
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Tab: Riwayat Presensi ──────────────────────────────────────────────

  const renderRiwayatTab = () => {
    if (loadingHistory) {
      return (
        <View style={[styles.centerFill, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Memuat riwayat...</Text>
        </View>
      );
    }

    if (historyList.length === 0) {
      return (
        <View style={[styles.centerFill, { backgroundColor: colors.bg }]}>
          <Ionicons name="time-outline" size={60} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Belum ada riwayat</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Riwayat presensi Anda akan muncul di sini setelah melakukan presensi.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 16,
              paddingHorizontal: 24,
              paddingVertical: 10,
              backgroundColor: colors.primaryBg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
            onPress={() => fetchHistory()}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
              Refresh
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Hitung statistik ringkasan
    const totalHadir = historyList.filter(h => h.status_presensi === "hadir").length;
    const totalTerlambat = historyList.filter(h => h.status_presensi === "terlambat").length;
    const totalIzin = historyList.filter(h => h.status_presensi === "izin").length;
    const totalSakit = historyList.filter(h => h.status_presensi === "sakit").length;
    const totalAlpha = historyList.filter(h => h.status_presensi === "alpha").length;
    const totalAll = historyList.length;
    const pctHadir = totalAll > 0 ? Math.round(((totalHadir + totalTerlambat) / totalAll) * 100) : 0;

    return (
      <FlatList
        data={historyList}
        keyExtractor={(item) => String(item.id_history)}
        style={[styles.scrollView, { backgroundColor: colors.bg }]}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={historyRefreshing}
            onRefresh={() => fetchHistory(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={() => (
          <>
            {/* Ringkasan statistik */}
            <View style={[styles.statsSummaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <Text style={[styles.statsSummaryTitle, { color: colors.textPrimary }]}>Ringkasan Kehadiran</Text>
              <View style={styles.statsSummaryRow}>
                <View style={styles.statsSummaryItem}>
                  <Text style={[styles.statsSummaryNum, { color: colors.success }]}>
                    {totalHadir + totalTerlambat}
                  </Text>
                  <Text style={[styles.statsSummaryLabel, { color: colors.textMuted }]}>Hadir</Text>
                </View>
                <View style={[styles.statsSummaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statsSummaryItem}>
                  <Text style={[styles.statsSummaryNum, { color: colors.warning }]}>
                    {totalTerlambat}
                  </Text>
                  <Text style={[styles.statsSummaryLabel, { color: colors.textMuted }]}>Terlambat</Text>
                </View>
                <View style={[styles.statsSummaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statsSummaryItem}>
                  <Text style={[styles.statsSummaryNum, { color: "#3B82F6" }]}>
                    {totalIzin}
                  </Text>
                  <Text style={[styles.statsSummaryLabel, { color: colors.textMuted }]}>Izin</Text>
                </View>
                <View style={[styles.statsSummaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statsSummaryItem}>
                  <Text style={[styles.statsSummaryNum, { color: "#8B5CF6" }]}>
                    {totalSakit}
                  </Text>
                  <Text style={[styles.statsSummaryLabel, { color: colors.textMuted }]}>Sakit</Text>
                </View>
                <View style={[styles.statsSummaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statsSummaryItem}>
                  <Text style={[styles.statsSummaryNum, { color: colors.danger }]}>
                    {totalAlpha}
                  </Text>
                  <Text style={[styles.statsSummaryLabel, { color: colors.textMuted }]}>Alpha</Text>
                </View>
              </View>
              {/* Progress bar kehadiran */}
              <View style={styles.statsSummaryProgressRow}>
                <Text style={[styles.statsSummaryProgressLabel, { color: colors.textSecondary }]}>
                  Tingkat Kehadiran
                </Text>
                <Text style={[styles.statsSummaryProgressPct, {
                  color: pctHadir >= 75 ? colors.success : pctHadir >= 50 ? colors.warning : colors.danger
                }]}>
                  {pctHadir}%
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                <View style={[styles.progressFill, {
                  width: `${pctHadir}%` as `${number}%`,
                  backgroundColor: pctHadir >= 75 ? colors.success : pctHadir >= 50 ? colors.warning : colors.danger
                }]} />
              </View>
              <Text style={[styles.statsSummaryTotal, { color: colors.textMuted }]}>{totalAll} pertemuan tercatat</Text>
            </View>
            <Text style={[styles.historyListHeader, { color: colors.textPrimary }]}>Detail Riwayat</Text>
          </>
        )}
        renderItem={({ item }) => {
          const historyStatusMap = getHistoryStatusMap(isDarkMode);
          const st = item.status_presensi
            ? historyStatusMap[item.status_presensi]
            : { color: colors.textMuted, bg: colors.bgInput, label: "-", icon: "help-circle" };

          return (
            <TouchableOpacity
              style={[styles.historyCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: colors.shadow }]}
              onPress={() => {
                setSelectedHistory(item);
                setShowHistoryDetail(true);
              }}
              activeOpacity={0.75}
            >
              {/* Status badge + waktu */}
              <View style={styles.historyCardTop}>
                <View style={[styles.historyStatusBadge, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icon as any} size={13} color={st.color} />
                  <Text style={[styles.historyStatusText, { color: st.color }]}>
                    {st.label}
                  </Text>
                </View>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                  {item.tanggal ? formatDate(item.tanggal) : "-"}
                </Text>
              </View>

              {/* Info matakuliah */}
              <Text style={[styles.historyMkName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.nama_mk}
              </Text>
              <Text style={[styles.historyMkCode, { color: colors.textSecondary }]}>
                {item.kode_mk} · Pertemuan {item.pertemuan_ke ?? "-"}
              </Text>

              {/* Info tambahan */}
              <View style={styles.historyCardFooter}>
                <View style={styles.historyMetaItem}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={[styles.historyMetaText, { color: colors.textMuted }]}>
                    {item.waktu_presensi ? formatDateTime(item.waktu_presensi) : "Belum tercatat"}
                  </Text>
                </View>
                {item.jarak_meter !== null && item.jarak_meter !== undefined && (
                  <View style={styles.historyMetaItem}>
                    <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.historyMetaText, { color: colors.textMuted }]}>
                      {Math.round(item.jarak_meter)} m
                    </Text>
                  </View>
                )}
                {item.confidence_score !== null && item.confidence_score !== undefined && (
                  <View style={styles.historyMetaItem}>
                    <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.historyMetaText, { color: colors.textMuted }]}>
                      {(item.confidence_score * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  // ─── Modal Detail Riwayat ────────────────────────────────────────────────

  const renderHistoryDetailModal = () => {
    if (!selectedHistory) return null;
    const historyStatusMap = getHistoryStatusMap(isDarkMode);
    const st = selectedHistory.status_presensi
      ? historyStatusMap[selectedHistory.status_presensi]
      : { color: colors.textMuted, bg: colors.bgInput, label: "-", icon: "help-circle" };

    return (
      <Modal
        visible={showHistoryDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistoryDetail(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <StatusBar style={isDarkMode ? "light" : "dark"} />
          {/* Header modal */}
          <View style={[styles.modalHeader, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
              onPress={() => setShowHistoryDetail(false)}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Detail Riwayat</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Status utama */}
            <View style={[styles.modalStatusCard, { backgroundColor: st.bg, borderColor: `${st.color}40` }]}>
              <Ionicons name={st.icon as any} size={36} color={st.color} />
              <Text style={[styles.modalStatusLabel, { color: st.color }]}>{st.label}</Text>
              <Text style={[styles.modalStatusDate, { color: colors.textSecondary }]}>
                {selectedHistory.tanggal ? formatDate(selectedHistory.tanggal) : "-"}
              </Text>
            </View>

            {/* Info Matakuliah */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.textMuted }]}>Informasi Pertemuan</Text>
              <View style={[styles.modalInfoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <InfoRow icon="book-outline" label="Matakuliah" value={selectedHistory.nama_mk} colors={colors} />
                <InfoRow icon="barcode-outline" label="Kode MK" value={selectedHistory.kode_mk} colors={colors} />
                <InfoRow icon="layers-outline" label="Pertemuan ke-" value={String(selectedHistory.pertemuan_ke ?? "-")} colors={colors} />
                <InfoRow icon="people-outline" label="Kelas" value={selectedHistory.nama_kelas} colors={colors} />
                <InfoRow icon="calendar-outline" label="Hari" value={selectedHistory.hari} colors={colors} />
                <InfoRow icon="time-outline" label="Jadwal" value={`${formatTime(selectedHistory.jam_mulai)} - ${formatTime(selectedHistory.jam_selesai)}`} colors={colors} />
                <InfoRow icon="business-outline" label="Ruangan" value={selectedHistory.ruangan || "-"} last colors={colors} />
              </View>
            </View>

            {/* Info Presensi */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.textMuted }]}>Detail Presensi</Text>
              <View style={[styles.modalInfoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <InfoRow
                  icon="checkmark-circle-outline"
                  label="Status"
                  value={st.label}
                  valueColor={st.color}
                  colors={colors}
                />
                <InfoRow
                  icon="time-outline"
                  label="Waktu Presensi"
                  value={selectedHistory.waktu_presensi ? formatDateTime(selectedHistory.waktu_presensi) : "Belum tercatat"}
                  colors={colors}
                />
                {selectedHistory.confidence_score !== null && selectedHistory.confidence_score !== undefined && (
                  <InfoRow
                    icon="analytics-outline"
                    label="Confidence"
                    value={`${(selectedHistory.confidence_score * 100).toFixed(1)}%`}
                    colors={colors}
                  />
                )}
                {selectedHistory.metode_deteksi && (
                  <InfoRow
                    icon="scan-outline"
                    label="Metode"
                    value={selectedHistory.metode_deteksi}
                    colors={colors}
                  />
                )}
                {selectedHistory.jarak_meter !== null && selectedHistory.jarak_meter !== undefined && (
                  <InfoRow
                    icon="location-outline"
                    label="Jarak Lokasi"
                    value={`${Math.round(selectedHistory.jarak_meter)} meter`}
                    colors={colors}
                  />
                )}
                {selectedHistory.latitude_presensi !== null && selectedHistory.latitude_presensi !== undefined && (
                  <InfoRow
                    icon="navigate-outline"
                    label="Koordinat"
                    value={`${selectedHistory.latitude_presensi?.toFixed(6)}, ${selectedHistory.longitude_presensi?.toFixed(6)}`}
                    last
                    colors={colors}
                  />
                )}
              </View>
            </View>

            {/* Score teknis (opsional) */}
            {(selectedHistory.lbph_score !== null || selectedHistory.cnn_score !== null) && (
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: colors.textMuted }]}>Skor Verifikasi Wajah</Text>
                <View style={[styles.modalInfoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  {selectedHistory.lbph_score !== null && selectedHistory.lbph_score !== undefined && (
                    <InfoRow icon="eye-outline" label="LBPH Score" value={selectedHistory.lbph_score.toFixed(4)} colors={colors} />
                  )}
                  {selectedHistory.cnn_score !== null && selectedHistory.cnn_score !== undefined && (
                    <InfoRow icon="hardware-chip-outline" label="CNN Score" value={selectedHistory.cnn_score.toFixed(4)} last colors={colors} />
                  )}
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ─── View: scan ───────────────────────────────────────────────────────────

  const renderScanView = () => {
    if (!selectedSession || !token) return null;

    return (
      <FaceRecognition
        token={token}
        idPertemuan={selectedSession.id_pertemuan}
        namaMatakuliah={selectedSession.nama_matakuliah}
        pertemuanKe={selectedSession.pertemuan_ke}
        modeLokasi={selectedSession.mode_lokasi}
        userLocation={userLocation}
        geolokasiData={geolokasiData}
        isMockLocation={isMockLocation}
        locationLoading={locationLoading}
        API_BASE={API_BASE}
        onBack={() => {
          setScanStatus("idle");
          setCapturedImage(null);
          setShowPreview(false);
          setIsGalleryImage(false);
          setGalleryBase64(null);
          setView("list");
        }}
        onPresensiSuccess={handlePresensiSuccess}
        scanStatus={scanStatus}
        setScanStatus={setScanStatus}
        capturedImage={capturedImage}
        setCapturedImage={setCapturedImage}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        cameraRef={cameraRef}
        facing={facing}
        setFacing={setFacing}
        isCapturing={isCapturing}
        setIsCapturing={setIsCapturing}
        faceScanResult={faceScanResult}
        setFaceScanResult={setFaceScanResult}
        isGalleryImage={isGalleryImage}
        setIsGalleryImage={setIsGalleryImage}
        galleryBase64={galleryBase64}
        setGalleryBase64={setGalleryBase64}
      />
    );
  };

  if (view === "scan") return renderScanView();
  return (
    <>
      {renderMainHeader()}
      {renderHistoryDetailModal()}
    </>
  );
}

// ─── Helper Component ────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, valueColor, last, colors,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
  colors: any;
}) {
  return (
    <View style={[infoRowStyles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
      <View style={infoRowStyles.iconWrap}>
        <Ionicons name={icon as any} size={15} color={colors.textMuted} />
      </View>
      <Text style={[infoRowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[infoRowStyles.value, { color: valueColor ?? colors.textPrimary }, valueColor ? { fontWeight: "700" } : {}]}>
        {value}
      </Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  iconWrap: {
    width: 22,
    alignItems: "center",
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: THEME.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: "500",
    color: THEME.textPrimary,
    maxWidth: "55%",
    textAlign: "right",
  },
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 40) : 55,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: THEME.bg,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.textPrimary,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: THEME.bgInput,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: THEME.bgInput,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },

  // Tab Switcher
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: THEME.bgInput,
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: THEME.bgCard,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textMuted,
  },
  tabLabelActive: {
    color: THEME.primary,
  },

  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.warningBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  demoBannerText: {
    fontSize: 12,
    color: THEME.warning,
    fontWeight: "500",
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 4,
    gap: 14,
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.textSecondary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: "center",
    paddingHorizontal: 32,
  },

  sessionCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  checkingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    gap: 8,
  },
  checkingText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: "500",
  },
  sessionChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  sessionChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sessionChipText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sessionCardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionName: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  sessionMeta: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  sessionDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sessionDate: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statsPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statsPillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  summaryText: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: THEME.borderLight,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: THEME.success,
    borderRadius: 2,
  },
  summaryPct: {
    fontSize: 12,
    color: THEME.success,
    fontWeight: "700",
    minWidth: 34,
    textAlign: "right",
  },
  studentList: {
    flex: 1,
  },
  studentListContent: {
    paddingHorizontal: 20,
    paddingBottom: 96,
    gap: 8,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "700",
  },
  studentInfo: {
    flex: 1,
  },
  studentNim: {
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  attendanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  attendanceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "android" ? 14 : 28,
    backgroundColor: THEME.bg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    gap: 12,
  },
  scanButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  scanButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },

  locationFreeBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.successBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  locationFreeText: {
    fontSize: 13,
    color: THEME.success,
    fontWeight: "500",
    textAlign: "center",
  },

  mockGpsBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: "#DC2626",
    borderRadius: 12,
  },
  mockGpsBannerTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#fff",
  },
  mockGpsBannerDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },

  // ─── History Styles ──────────────────────────────────────────────────────

  statsSummaryCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 16,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  statsSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  statsSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statsSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  statsSummaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: THEME.border,
  },
  statsSummaryNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  statsSummaryLabel: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  statsSummaryProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  statsSummaryProgressLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: "500",
  },
  statsSummaryProgressPct: {
    fontSize: 13,
    fontWeight: "700",
  },
  statsSummaryTotal: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 6,
    textAlign: "right",
  },
  historyListHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  historyCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 6,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyDate: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: "500",
  },
  historyMkName: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  historyMkCode: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  historyCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  historyMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyMetaText: {
    fontSize: 11,
    color: THEME.textMuted,
  },

  // ─── Modal Styles ────────────────────────────────────────────────────────

  modalContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 40) + 8 : 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: THEME.bgInput,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  modalScroll: {
    flex: 1,
  },
  modalStatusCard: {
    alignItems: "center",
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  modalStatusLabel: {
    fontSize: 22,
    fontWeight: "800",
  },
  modalStatusDate: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: "500",
  },
  modalSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  modalInfoCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  sudahPresensiBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  sudahPresensiText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
