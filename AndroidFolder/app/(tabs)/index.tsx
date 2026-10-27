import React, { useCallback, useEffect, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { API_BASE } from "@/constants/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JadwalItem {
  id_jadwal: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  ruangan: string | null;
  status: string;
  kode_matakuliah: string | null;
  nama_matakuliah: string | null;
  pengajar_list: Array<{ nama_dosen: string | null }>;
  kelas_list: Array<{
    id_prodi: number;
    id_angkatan: number;
    id_golongan: number;
  }>;
}

interface HistoryItem {
  id_history: number;
  status_presensi: "hadir" | "terlambat" | "izin" | "sakit" | "alpha" | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HARI_MAP: Record<string, string> = {
  "0": "Minggu",
  "1": "Senin",
  "2": "Selasa",
  "3": "Rabu",
  "4": "Kamis",
  "5": "Jumat",
  "6": "Sabtu",
};

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function getTodayHari(): string {
  return HARI_MAP[String(new Date().getDay())];
}

function formatTodayDate(): string {
  const d = new Date();
  return `${HARI_MAP[String(d.getDay())]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(t: string | null): string {
  if (!t) return "--:--";
  return t.substring(0, 5);
}

function getScheduleStatus(jamMulai: string, jamSelesai: string): string {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const parseMin = (t: string) => {
    const parts = t.split(":").map(Number);
    return parts[0] * 60 + (parts[1] ?? 0);
  };
  const mulaiMin = parseMin(jamMulai);
  const selesaiMin = parseMin(jamSelesai);
  if (nowMin >= mulaiMin && nowMin < selesaiMin) return "Berlangsung";
  if (nowMin < mulaiMin) return "Akan Datang";
  return "Selesai";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, token } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const isDark = isDarkMode;

  // ── State ──────────────────────────────────────────────────────────────────
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Theme Palette (Dominan Putih & Biru Muda di Light Mode) ───────────────
  const colors = {
    bg: isDark ? theme.bg : "#F0F9FF", // Light: Soft sky-blue white background
    card: isDark ? theme.cardBg : "#FFFFFF", // Light: Pure White cards
    cardBorder: isDark ? theme.border : "#E0F2FE", // Light: Subtle light blue border
    textPrimary: isDark ? theme.textPrimary : "#0F172A",
    textSecondary: isDark ? theme.textSecondary : "#475569",
    textMuted: isDark ? theme.textMuted : "#64748B",
    primary: isDark ? "#38BDF8" : "#0EA5E9", // Sky Blue Accent
    primaryDark: isDark ? "#0284C7" : "#0284C7",
    primaryLight: isDark ? "rgba(14, 165, 233, 0.15)" : "#E0F2FE",
    primaryTint: isDark ? "rgba(56, 189, 248, 0.08)" : "#F0F9FF",
    border: isDark ? theme.border : "#E0F2FE",
    divider: isDark ? theme.divider : "#F1F5F9",
    shadow: isDark ? "rgba(0,0,0,0.35)" : "rgba(14, 165, 233, 0.12)",
    gradientCard: isDark ? ["#1E3A5F", "#0284C7"] : ["#0284C7", "#38BDF8"],
    quickActionBg: isDark ? "#1E293B" : "#FFFFFF",
    ornament1: isDark ? "rgba(14,165,233,0.12)" : "#BAE6FD",
    ornament2: isDark ? "rgba(56,189,248,0.06)" : "#E0F2FE",
  };

  // ── Fetch Jadwal Hari Ini ──────────────────────────────────────────────────
  const fetchJadwal = useCallback(async () => {
    if (!token) return;
    setLoadingJadwal(true);
    try {
      const todayHari = getTodayHari();
      const res = await fetch(
        `${API_BASE}/jadwal/?hari=${encodeURIComponent(todayHari)}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as JadwalItem[];

      // Filter sesuai kelas mahasiswa
      let filtered = data;
      if (user?.id_prodi && user?.id_angkatan && user?.id_golongan) {
        filtered = data.filter((j) =>
          j.kelas_list.some(
            (k) =>
              k.id_prodi === user.id_prodi &&
              k.id_angkatan === user.id_angkatan &&
              k.id_golongan === user.id_golongan
          )
        );
      }
      // Urutkan berdasarkan jam_mulai
      filtered.sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
      setJadwalList(filtered);
    } catch (err) {
      console.warn("fetchJadwal error:", err);
      setJadwalList([]);
    } finally {
      setLoadingJadwal(false);
    }
  }, [token, user?.id_prodi, user?.id_angkatan, user?.id_golongan]);

  // ── Fetch Rekap Kehadiran ──────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const idMhs = user?.id_mahasiswa;
      const url = idMhs
        ? `${API_BASE}/history-presensi/?id_mahasiswa=${idMhs}&limit=500`
        : `${API_BASE}/history-presensi/?limit=500`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HistoryItem[];
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("fetchHistory error:", err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [token, user?.id_mahasiswa]);

  useEffect(() => {
    fetchJadwal();
    fetchHistory();
  }, [fetchJadwal, fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchJadwal(), fetchHistory()]);
    setRefreshing(false);
  }, [fetchJadwal, fetchHistory]);

  // ── Computed Stats ─────────────────────────────────────────────────────────
  const totalHadir = historyList.filter(
    (h) => h.status_presensi === "hadir" || h.status_presensi === "terlambat"
  ).length;
  const totalSakit = historyList.filter((h) => h.status_presensi === "sakit").length;
  const totalIzin = historyList.filter((h) => h.status_presensi === "izin").length;
  const totalAlpha = historyList.filter((h) => h.status_presensi === "alpha").length;
  const totalAll = historyList.length;
  const persentaseKehadiran =
    totalAll > 0 ? Math.round((totalHadir / totalAll) * 100) : 0;

  const hadirHariIni = jadwalList.filter((j) => {
    const st = getScheduleStatus(j.jam_mulai, j.jam_selesai);
    return st === "Selesai" || st === "Berlangsung";
  }).length;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Berlangsung":
        return "#10B981";
      case "Akan Datang":
        return "#F59E0B";
      case "Selesai":
        return isDark ? "#94A3B8" : "#64748B";
      default:
        return isDark ? "#94A3B8" : "#64748B";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "Berlangsung":
        return isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5";
      case "Akan Datang":
        return isDark ? "rgba(245,158,11,0.15)" : "#FFFBEB";
      case "Selesai":
        return isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9";
      default:
        return isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9";
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat Pagi ☀️";
    if (h < 15) return "Selamat Siang 🌤️";
    if (h < 18) return "Selamat Sore 🌇";
    return "Selamat Malam 🌙";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Background Decorative Ornaments */}
      <View style={styles.ornamentContainer} pointerEvents="none">
        <LinearGradient
          colors={
            isDark
              ? ["rgba(14,165,233,0.15)", "transparent"]
              : ["#BAE6FD", "transparent"]
          }
          style={styles.ornamentTopRight}
        />
        <View
          style={[
            styles.ornamentMidLeft,
            { borderColor: colors.ornament2 },
          ]}
        />
        <View
          style={[
            styles.ornamentBottomRight,
            { backgroundColor: colors.ornament2 },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText style={[styles.headerGreeting, { color: colors.primary }]}>
              {getGreeting()}
            </ThemedText>
            <ThemedText style={[styles.headerName, { color: colors.textPrimary }]}>
              {user?.nama_mahasiswa ?? user?.name ?? "Mahasiswa"}
            </ThemedText>
            <View style={[styles.classBadge, { backgroundColor: colors.primaryLight }]}>
              <IconSymbol name="graduationcap.fill" size={12} color={colors.primary} />
              <ThemedText style={[styles.classBadgeText, { color: colors.primary }]}>
                {user?.nama_kelas ?? user?.email ?? "Mahasiswa Aktif"}
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.profileContainer,
              { borderColor: colors.primary, shadowColor: colors.shadow },
            ]}
            activeOpacity={0.85}
            onPress={() => router.push("/profile")}
          >
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.profileImage}
              contentFit="cover"
            />
            <View style={styles.profileOnlineDot} />
          </TouchableOpacity>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickActionSection}>
          {/* 
          
          <TouchableOpacity
            style={[
              styles.quickActionMainCard,
              { shadowColor: colors.shadow },
            ]}
            activeOpacity={0.88}
            onPress={() => router.push("/face_recognition")}
          >
            <LinearGradient
              colors={isDark ? ["#0284C7", "#1E3A5F"] : ["#0EA5E9", "#0284C7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickActionGradient}
            >
              <View style={styles.quickActionIconWrapperMain}>
                <IconSymbol name="faceid" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.quickActionTextContainer}>
                <ThemedText style={styles.quickActionTitleMain}>Presensi Wajah</ThemedText>
                <ThemedText style={styles.quickActionSubMain}>Scan & Absen</ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity> */}

          {/* <View style={styles.quickActionSubGroup}>
            <TouchableOpacity
              style={[
                styles.quickActionSubCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  shadowColor: colors.shadow,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => router.push("/jadwal")}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: colors.primaryLight }]}>
                <IconSymbol name="calendar" size={18} color={colors.primary} />
              </View>
              <ThemedText style={[styles.quickActionSubTitle, { color: colors.textPrimary }]}>
                Jadwal
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickActionSubCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  shadowColor: colors.shadow,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => router.push("/presensi")}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: colors.primaryLight }]}>
                <IconSymbol name="clock.arrow.circlepath" size={18} color={colors.primary} />
              </View>
              <ThemedText style={[styles.quickActionSubTitle, { color: colors.textPrimary }]}>
                Riwayat
              </ThemedText>
            </TouchableOpacity>
          </View> */}
        </View>

        {/* Academic Summary Hero Card */}

        {/* <View style={styles.summaryCardWrapper}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <LinearGradient
              colors={colors.gradientCard as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCardHeader}
            >
             
              <View style={styles.cardHeaderCircleOverlay} />

              <View style={styles.summaryHeaderContent}>
                <View>
                  <ThemedText style={styles.summaryTitle}>
                    Kehadiran Semester Ini
                  </ThemedText>
                  <ThemedText style={styles.summarySubTitle}>
                    {user?.nama_kelas ?? "Kelas Anda"}
                  </ThemedText>
                </View>
                <View style={styles.percentBadge}>
                  <ThemedText style={styles.summaryPercent}>
                    {loadingHistory ? "--" : `${persentaseKehadiran}%`}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.summaryProgressBarBg}>
                <View
                  style={[
                    styles.summaryProgressBarFill,
                    { width: `${persentaseKehadiran}%` },
                  ]}
                />
              </View>
            </LinearGradient>

         
            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatItem}>
                <View
                  style={[
                    styles.summaryStatIconBg,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <IconSymbol
                    name="person.fill.checkmark"
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[
                      styles.summaryStatLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Hadir Hari Ini
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.summaryStatValue,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {hadirHariIni} / {jadwalList.length} Sesi
                  </ThemedText>
                </View>
              </View>

              <View
                style={[
                  styles.summaryStatDivider,
                  { backgroundColor: colors.divider },
                ]}
              />

              <View style={styles.summaryStatItem}>
                <View
                  style={[
                    styles.summaryStatIconBg,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <IconSymbol
                    name="book.fill"
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[
                      styles.summaryStatLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Total Pertemuan
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.summaryStatValue,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {loadingHistory ? "--" : `${totalAll} Sesi`}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        </View> */}

        {/* Rekap Kehadiran Breakdown */}
        <View
          style={[
            styles.recapContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.recapTitleRow}>
            <ThemedText
              style={[styles.recapTitle, { color: colors.textPrimary }]}
            >
              Rekap Status Kehadiran
            </ThemedText>
            <TouchableOpacity onPress={() => router.push("/presensi")}>
              <ThemedText style={[styles.seeAllText, { color: colors.primary }]}>
                Lihat Detail →
              </ThemedText>
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : (
            <View style={styles.recapGrid}>
              {/* Hadir */}
              <View
                style={[
                  styles.recapItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.recapIconWrapper,
                    { backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5" },
                  ]}
                >
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={18}
                    color="#10B981"
                  />
                </View>
                <ThemedText style={[styles.recapValue, { color: colors.textPrimary }]}>
                  {totalHadir}
                </ThemedText>
                <ThemedText style={[styles.recapLabel, { color: colors.textSecondary }]}>
                  Hadir
                </ThemedText>
              </View>

              {/* Sakit */}
              <View
                style={[
                  styles.recapItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.recapIconWrapper,
                    { backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#FFFBEB" },
                  ]}
                >
                  <IconSymbol name="cross.case.fill" size={18} color="#F59E0B" />
                </View>
                <ThemedText style={[styles.recapValue, { color: colors.textPrimary }]}>
                  {totalSakit}
                </ThemedText>
                <ThemedText style={[styles.recapLabel, { color: colors.textSecondary }]}>
                  Sakit
                </ThemedText>
              </View>

              {/* Izin */}
              <View
                style={[
                  styles.recapItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.recapIconWrapper,
                    { backgroundColor: isDark ? "rgba(14,165,233,0.15)" : "#E0F2FE" },
                  ]}
                >
                  <IconSymbol name="doc.text.fill" size={18} color="#0EA5E9" />
                </View>
                <ThemedText style={[styles.recapValue, { color: colors.textPrimary }]}>
                  {totalIzin}
                </ThemedText>
                <ThemedText style={[styles.recapLabel, { color: colors.textSecondary }]}>
                  Izin
                </ThemedText>
              </View>

              {/* Alpha */}
              <View
                style={[
                  styles.recapItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.recapIconWrapper,
                    { backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2" },
                  ]}
                >
                  <IconSymbol
                    name="xmark.circle.fill"
                    size={18}
                    color="#EF4444"
                  />
                </View>
                <ThemedText style={[styles.recapValue, { color: colors.textPrimary }]}>
                  {totalAlpha}
                </ThemedText>
                <ThemedText style={[styles.recapLabel, { color: colors.textSecondary }]}>
                  Alpha
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Jadwal Hari Ini Section */}
        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <View>
              <ThemedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Jadwal Hari Ini
              </ThemedText>
              <ThemedText style={[styles.dateText, { color: colors.textMuted }]}>
                {formatTodayDate()}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={() => router.push("/jadwal")}>
              <ThemedText style={[styles.seeAllText, { color: colors.primary }]}>
                Semua Jadwal →
              </ThemedText>
            </TouchableOpacity>
          </View>

          {loadingJadwal ? (
            <View
              style={[
                styles.emptyTabCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText style={[styles.emptyTabDesc, { color: colors.textMuted, marginTop: 12 }]}>
                Memuat jadwal kuliah...
              </ThemedText>
            </View>
          ) : jadwalList.length === 0 ? (
            <View
              style={[
                styles.emptyTabCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <View style={[styles.emptyTabIconBg, { backgroundColor: colors.primaryLight }]}>
                <IconSymbol name="calendar" size={28} color={colors.primary} />
              </View>
              <ThemedText style={[styles.emptyTabTitle, { color: colors.textPrimary }]}>
                Tidak Ada Jadwal Kuliah
              </ThemedText>
              <ThemedText style={[styles.emptyTabDesc, { color: colors.textMuted }]}>
                Tidak ada perkuliahan untuk kelas Anda pada hari {getTodayHari()}. Nikmati waktu luang Anda!
              </ThemedText>
            </View>
          ) : (
            jadwalList.map((item) => {
              const status = getScheduleStatus(item.jam_mulai, item.jam_selesai);
              const dosenName =
                item.pengajar_list.length > 0
                  ? item.pengajar_list.map((p) => p.nama_dosen ?? "-").join(", ")
                  : "-";
              const jamStr = `${fmtTime(item.jam_mulai)} - ${fmtTime(item.jam_selesai)}`;
              const isOngoing = status === "Berlangsung";

              return (
                <View
                  key={item.id_jadwal}
                  style={[
                    styles.scheduleCardSimple,
                    {
                      backgroundColor: colors.card,
                      borderColor: isOngoing ? colors.primary : colors.cardBorder,
                      shadowColor: colors.shadow,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.scheduleLeftStripe,
                      { backgroundColor: getStatusColor(status) },
                    ]}
                  />

                  <View style={styles.scheduleCardBody}>
                    <View style={styles.scheduleRowTop}>
                      <View
                        style={[
                          styles.timeContainerSimple,
                          { backgroundColor: colors.primaryLight },
                        ]}
                      >
                        <IconSymbol name="calendar" size={13} color={colors.primary} />
                        <ThemedText style={[styles.timeTextSimple, { color: colors.primary }]}>
                          {jamStr}
                        </ThemedText>
                      </View>

                      <View style={[styles.statusBadgeSimple, { backgroundColor: getStatusBg(status) }]}>
                        <View style={[styles.statusDotSimple, { backgroundColor: getStatusColor(status) }]} />
                        <ThemedText style={[styles.statusTextSimple, { color: getStatusColor(status) }]}>
                          {status}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.courseHeaderSimple}>
                      <ThemedText style={[styles.courseNameSimple, { color: colors.textPrimary }]}>
                        {item.nama_matakuliah ?? "Mata Kuliah"}
                      </ThemedText>
                      {item.kode_matakuliah && (
                        <View style={[styles.courseCodeBadge, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
                          <ThemedText style={[styles.courseCodeSimple, { color: colors.textSecondary }]}>
                            {item.kode_matakuliah}
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    <View style={[styles.courseDetailsSimple, { borderBottomColor: colors.divider }]}>
                      <View style={styles.detailItemSimple}>
                        <View style={[styles.detailIconBg, { backgroundColor: colors.primaryTint }]}>
                          <IconSymbol name="person.fill" size={12} color={colors.primary} />
                        </View>
                        <ThemedText
                          style={[styles.detailTextSimple, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {dosenName}
                        </ThemedText>
                      </View>
                      <View style={styles.detailItemSimple}>
                        <View style={[styles.detailIconBg, { backgroundColor: colors.primaryTint }]}>
                          <IconSymbol name="mappin.and.ellipse" size={12} color={colors.primary} />
                        </View>
                        <ThemedText style={[styles.detailTextSimple, { color: colors.textSecondary }]}>
                          {item.ruangan ?? "Ruangan belum ditentukan"}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Attendance Action or Status */}
                    {isOngoing ? (
                      <TouchableOpacity
                        style={styles.presensiNowBtn}
                        activeOpacity={0.85}
                        onPress={() => router.push("/face_recognition")}
                      >
                        <LinearGradient
                          colors={["#10B981", "#059669"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.presensiNowGradient}
                        >
                          <IconSymbol name="faceid" size={16} color="#FFFFFF" />
                          <ThemedText style={styles.presensiNowBtnText}>
                            Presensi Sekarang
                          </ThemedText>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.attendanceSectionSimple}>
                        <View style={styles.attendanceLabelRow}>
                          <View style={styles.attendanceLeft}>
                            <IconSymbol name="chart.bar.fill" size={12} color={colors.primary} />
                            <ThemedText style={[styles.attendanceTextSimple, { color: colors.textSecondary }]}>
                              Kehadiran Mahasiswa
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.attendancePercentSimple, { color: colors.primary }]}>
                            {persentaseKehadiran}%
                          </ThemedText>
                        </View>
                        <View style={[styles.miniProgressBarSimple, { backgroundColor: isDark ? "#334155" : "#E0F2FE" }]}>
                          <View
                            style={[
                              styles.miniProgressFillSimple,
                              { width: `${persentaseKehadiran}%`, backgroundColor: colors.primary },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Ornaments
  ornamentContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: "hidden",
  },
  ornamentTopRight: {
    position: "absolute",
    top: -100,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  ornamentMidLeft: {
    position: "absolute",
    top: 340,
    left: -70,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 16,
    opacity: 0.25,
  },
  ornamentBottomRight: {
    position: "absolute",
    bottom: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.35,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  headerGreeting: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  headerName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  classBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  classBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    position: "relative",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  profileOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  // Quick Action Buttons
  quickActionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    zIndex: 1,
    gap: 10,
  },
  quickActionMainCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  quickActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  quickActionIconWrapperMain: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionTextContainer: {
    flex: 1,
  },
  quickActionTitleMain: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  quickActionSubMain: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  quickActionSubGroup: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionSubCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionSubTitle: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Summary Card
  summaryCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
    zIndex: 1,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  summaryCardHeader: {
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  cardHeaderCircleOverlay: {
    position: "absolute",
    right: -30,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  summaryHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summarySubTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  summaryPercent: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  summaryProgressBarBg: {
    height: 7,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 4,
    overflow: "hidden",
  },
  summaryProgressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  summaryStatsRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryStatItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryStatIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  summaryStatValue: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  summaryStatDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 10,
  },

  // Recap
  recapContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    zIndex: 1,
  },
  recapTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  recapTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  recapGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  recapItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  recapIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  recapValue: {
    fontSize: 17,
    fontWeight: "800",
  },
  recapLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  // Schedule Section
  scheduleSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  dateText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },

  scheduleCardSimple: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  scheduleLeftStripe: {
    width: 5,
  },
  scheduleCardBody: {
    flex: 1,
    padding: 16,
  },
  scheduleRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timeContainerSimple: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  timeTextSimple: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeSimple: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statusDotSimple: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTextSimple: {
    fontSize: 10,
    fontWeight: "800",
  },
  courseHeaderSimple: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  courseNameSimple: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  courseCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  courseCodeSimple: {
    fontSize: 11,
    fontWeight: "700",
  },
  courseDetailsSimple: {
    gap: 6,
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  detailItemSimple: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailIconBg: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  detailTextSimple: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },

  // Presensi Now Button
  presensiNowBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  presensiNowGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
  },
  presensiNowBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // Attendance Progress
  attendanceSectionSimple: {
    gap: 6,
  },
  attendanceLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attendanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attendanceTextSimple: {
    fontSize: 11,
    fontWeight: "600",
  },
  attendancePercentSimple: {
    fontSize: 12,
    fontWeight: "800",
  },
  miniProgressBarSimple: {
    height: 5,
    borderRadius: 2.5,
    overflow: "hidden",
  },
  miniProgressFillSimple: {
    height: "100%",
    borderRadius: 2.5,
  },

  // Empty state card
  emptyTabCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 6,
  },
  emptyTabIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTabTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyTabDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  bottomSpace: {
    height: 30,
  },
});
