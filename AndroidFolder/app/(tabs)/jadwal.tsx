import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { API_BASE } from "@/constants/config";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const { width } = Dimensions.get("window");

interface Kelas {
  id: number;
  nama_kelas: string;
}

interface Pengajar {
  nama_dosen: string;
  role: string;
}

interface JadwalItem {
  id_jadwal: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  ruangan: string;
  nama_matakuliah: string;
  kode_matakuliah: string;
  semester: number;
  kelas_list: Kelas[];
  pengajar_list: Pengajar[];
}

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const INDO_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

// Mock data when offline/demo
const MOCK_SCHEDULES: Record<string, JadwalItem[]> = {
  senin: [
    {
      id_jadwal: 1,
      hari: "senin",
      jam_mulai: "08:00:00",
      jam_selesai: "10:30:00",
      ruangan: "Lab Komputer 3",
      nama_matakuliah: "Pemrograman Mobile",
      kode_matakuliah: "TI-401",
      semester: 6,
      kelas_list: [{ id: 1, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Dr. Ahmad Santoso, M.Kom", role: "koordinator" },
      ],
    },
    {
      id_jadwal: 2,
      hari: "senin",
      jam_mulai: "13:00:00",
      jam_selesai: "15:30:00",
      ruangan: "Ruang 202",
      nama_matakuliah: "Etika Profesi",
      kode_matakuliah: "TI-405",
      semester: 6,
      kelas_list: [{ id: 2, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Prof. Budi Wijaya, Ph.D", role: "koordinator" },
      ],
    },
  ],
  selasa: [
    {
      id_jadwal: 3,
      hari: "selasa",
      jam_mulai: "08:00:00",
      jam_selesai: "10:30:00",
      ruangan: "Lab Komputer 1",
      nama_matakuliah: "Basis Data Lanjut",
      kode_matakuliah: "TI-402",
      semester: 6,
      kelas_list: [{ id: 3, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Ir. Rina Lestari, M.T.", role: "koordinator" },
      ],
    },
    {
      id_jadwal: 4,
      hari: "selasa",
      jam_mulai: "10:45:00",
      jam_selesai: "13:15:00",
      ruangan: "Ruang 301",
      nama_matakuliah: "Kecerdasan Buatan",
      kode_matakuliah: "TI-403",
      semester: 6,
      kelas_list: [{ id: 4, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Prof. Budi Wijaya, Ph.D", role: "koordinator" },
      ],
    },
  ],
  rabu: [
    {
      id_jadwal: 5,
      hari: "rabu",
      jam_mulai: "08:00:00",
      jam_selesai: "10:30:00",
      ruangan: "Lab Jaringan 2",
      nama_matakuliah: "Jaringan Komputer",
      kode_matakuliah: "TI-404",
      semester: 6,
      kelas_list: [{ id: 5, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Dr. Citra Dewi, M.T", role: "koordinator" },
      ],
    },
    {
      id_jadwal: 6,
      hari: "rabu",
      jam_mulai: "13:30:00",
      jam_selesai: "16:00:00",
      ruangan: "Lab Desain",
      nama_matakuliah: "Interaksi Manusia & Komputer",
      kode_matakuliah: "TI-406",
      semester: 6,
      kelas_list: [{ id: 6, nama_kelas: "TI-4A" }],
      pengajar_list: [{ nama_dosen: "Haryono, M.Cs.", role: "koordinator" }],
    },
  ],
  kamis: [
    {
      id_jadwal: 7,
      hari: "kamis",
      jam_mulai: "08:00:00",
      jam_selesai: "10:30:00",
      ruangan: "Ruang 103",
      nama_matakuliah: "Rekayasa Perangkat Lunak",
      kode_matakuliah: "TI-407",
      semester: 6,
      kelas_list: [{ id: 7, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Dr. Ahmad Santoso, M.Kom", role: "koordinator" },
      ],
    },
  ],
  jumat: [
    {
      id_jadwal: 8,
      hari: "jumat",
      jam_mulai: "09:00:00",
      jam_selesai: "11:30:00",
      ruangan: "Lab Jaringan 1",
      nama_matakuliah: "Keamanan Informasi",
      kode_matakuliah: "TI-408",
      semester: 6,
      kelas_list: [{ id: 8, nama_kelas: "TI-4A" }],
      pengajar_list: [
        { nama_dosen: "Dr. Citra Dewi, M.T", role: "koordinator" },
      ],
    },
  ],
  sabtu: [],
};

export default function JadwalScreen() {
  const { isDarkMode, theme } = useTheme();
  const { token } = useAuth();

  // Get current day of week in Indonesian
  const currentDayIndex = new Date().getDay();
  const todayIndoName = INDO_DAYS[currentDayIndex];
  const defaultDay = DAYS.includes(todayIndoName) ? todayIndoName : "Senin";

  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const [allRawSchedules, setAllRawSchedules] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const fetchJadwal = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    if (!token) {
      const mockFlat = Object.values(MOCK_SCHEDULES).flat();
      setAllRawSchedules(mockFlat);
      setIsDemo(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/kelas-mata-kuliah/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as any[];
      const normalized = data.map((item) => ({
        ...item,
        nama_matakuliah: item.nama_mk ?? item.nama_matakuliah ?? "",
        kode_matakuliah: item.kode_mk ?? item.kode_matakuliah ?? "",
      })) as JadwalItem[];
      setAllRawSchedules(normalized);
      setIsDemo(false);
    } catch {
      const mockFlat = Object.values(MOCK_SCHEDULES).flat();
      setAllRawSchedules(mockFlat);
      setIsDemo(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJadwal(true);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJadwal(false);
  };

  // Filter schedules for the selected day
  const schedulesForSelectedDay = useMemo(() => {
    return allRawSchedules.filter(
      (item) => item.hari?.toLowerCase() === selectedDay.toLowerCase()
    );
  }, [allRawSchedules, selectedDay]);

  // Helper to detect if a class is currently active (today and within hours)
  const isClassActive = (item: JadwalItem) => {
    if (todayIndoName.toLowerCase() !== item.hari?.toLowerCase()) return false;

    const now = new Date();
    const [startH, startM] = item.jam_mulai.split(":").map(Number);
    const [endH, endM] = item.jam_selesai.split(":").map(Number);

    const startTime = new Date();
    startTime.setHours(startH, startM, 0, 0);

    const endTime = new Date();
    endTime.setHours(endH, endM, 0, 0);

    return now >= startTime && now <= endTime;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      {/* Modern Curved Top Header */}
      <View style={[styles.headerCard, { backgroundColor: theme.headerBg }]}>
        {/* Decorative background shapes */}
        <View style={[styles.circleOverlay1, { backgroundColor: theme.circle1 }]} />
        <View style={[styles.circleOverlay2, { backgroundColor: theme.circle2 }]} />

        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Jadwal Perkuliahan</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtitleText }]}>
              {selectedDay === todayIndoName
                ? `Hari Ini • ${schedulesForSelectedDay.length} Mata Kuliah`
                : `Hari ${selectedDay} • ${schedulesForSelectedDay.length} Mata Kuliah`}
            </Text>
          </View>

          {isDemo && (
            <View style={styles.demoBadge}>
              <IconSymbol name="info.circle" size={12} color="#F59E0B" />
              <Text style={styles.demoBadgeText}>Demo</Text>
            </View>
          )}
        </View>
      </View>

      {/* Redesigned Day Selector Bar */}
      <View style={styles.daySelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySelectorScroll}
        >
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            const isToday = day === todayIndoName;
            const dayClassCount = allRawSchedules.filter(
              (item) => item.hari?.toLowerCase() === day.toLowerCase()
            ).length;

            return (
              <TouchableOpacity
                key={day}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: isSelected
                      ? theme.accent
                      : theme.cardBg,
                    borderColor: isSelected
                      ? theme.accent
                      : isToday
                      ? theme.accent
                      : theme.border,
                    shadowColor: theme.shadowColor,
                  },
                ]}
                activeOpacity={0.75}
              >
                {/* Header row inside day card (Day Name + Today Dot) */}
                <View style={styles.dayCardHeader}>
                  <Text
                    style={[
                      styles.dayCardName,
                      {
                        color: isSelected
                          ? "#FFFFFF"
                          : isToday
                          ? theme.accent
                          : theme.textPrimary,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                  {isToday && (
                    <View
                      style={[
                        styles.todayBadge,
                        {
                          backgroundColor: isSelected
                            ? "#FFFFFF"
                            : theme.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.todayBadgeText,
                          {
                            color: isSelected
                              ? theme.accent
                              : "#FFFFFF",
                          },
                        ]}
                      >
                        Hari ini
                      </Text>
                    </View>
                  )}
                </View>

                {/* Subtitle inside day card (Class count badge) */}
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: isSelected
                        ? "rgba(255, 255, 255, 0.2)"
                        : isDarkMode
                        ? "rgba(255, 255, 255, 0.06)"
                        : "#F1F5F9",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      {
                        color: isSelected
                          ? "#FFFFFF"
                          : dayClassCount > 0
                          ? theme.textSecondary
                          : theme.textMuted,
                      },
                    ]}
                  >
                    {dayClassCount > 0 ? `${dayClassCount} Kelas` : "Libur"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Schedule List Section */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Memuat jadwal...
          </Text>
        </View>
      ) : (
        <FlatList
          data={schedulesForSelectedDay}
          keyExtractor={(item) => String(item.id_jadwal)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyContainer,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: theme.settingsIconBg },
                ]}
              >
                <IconSymbol
                  name="calendar"
                  size={42}
                  color={theme.settingsIconColor}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                Tidak Ada Perkuliahan
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: theme.textSecondary }]}
              >
                Hari {selectedDay} ini Anda bebas dari jadwal perkuliahan.
                Nikmati waktu luang atau manfaatkan untuk belajar mandiri!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const active = isClassActive(item);
            const lecturer =
              item.pengajar_list && item.pengajar_list.length > 0
                ? item.pengajar_list[0].nama_dosen
                : "Dosen Pengampu";
            const className =
              item.kelas_list && item.kelas_list.length > 0
                ? item.kelas_list[0].nama_kelas
                : "Semua Kelas";

            return (
              <View
                style={[
                  styles.scheduleCard,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: active ? theme.accent : theme.border,
                    shadowColor: theme.shadowColor,
                  },
                ]}
              >
                {/* Active Indicator Accent Bar on the Left */}
                {active && (
                  <View
                    style={[
                      styles.activeAccentBar,
                      { backgroundColor: theme.accent },
                    ]}
                  />
                )}

                {/* Left Column: Timeline & Time Badges */}
                <View style={styles.timelineColumn}>
                  <Text
                    style={[styles.timeText, { color: theme.textPrimary }]}
                  >
                    {item.jam_mulai.substring(0, 5)}
                  </Text>

                  {/* Vertical Connecting Line */}
                  <View
                    style={[
                      styles.timeLine,
                      {
                        backgroundColor: active
                          ? theme.accent
                          : theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: active
                            ? theme.accent
                            : theme.textMuted,
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.timeTextMuted,
                      { color: theme.textMuted },
                    ]}
                  >
                    {item.jam_selesai.substring(0, 5)}
                  </Text>
                </View>

                {/* Right Column: Class Details Card */}
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.classBadge,
                        { backgroundColor: theme.badgeBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.classBadgeText,
                          { color: theme.badgeText },
                        ]}
                      >
                        {className}
                      </Text>
                    </View>

                    {active ? (
                      <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>Berlangsung</Text>
                      </View>
                    ) : (
                      <Text style={[styles.semesterText, { color: theme.textMuted }]}>
                        Semester {item.semester}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[styles.courseName, { color: theme.textPrimary }]}
                  >
                    {item.nama_matakuliah}
                  </Text>
                  <Text
                    style={[styles.courseCode, { color: theme.textMuted }]}
                  >
                    Kode: {item.kode_matakuliah}
                  </Text>

                  <View
                    style={[
                      styles.cardDivider,
                      { backgroundColor: theme.divider },
                    ]}
                  />

                  {/* Lecturer Row */}
                  <View style={styles.detailRow}>
                    <View
                      style={[
                        styles.detailIconBox,
                        { backgroundColor: theme.settingsIconBg },
                      ]}
                    >
                      <IconSymbol
                        name="person.fill"
                        size={13}
                        color={theme.settingsIconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.detailText,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {lecturer}
                    </Text>
                  </View>

                  {/* Room Location Row */}
                  <View style={styles.detailRow}>
                    <View
                      style={[
                        styles.detailIconBox,
                        { backgroundColor: theme.settingsIconBg },
                      ]}
                    >
                      <IconSymbol
                        name="mappin.and.ellipse"
                        size={13}
                        color={theme.settingsIconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.detailText,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      Ruangan: {item.ruangan}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Top Header Card
  headerCard: {
    height: 170,
    paddingTop: 56,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  circleOverlay1: {
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.18,
    position: "absolute",
    top: -40,
    right: -30,
  },
  circleOverlay2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.12,
    position: "absolute",
    bottom: -20,
    left: -20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 10,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13.5,
    marginTop: 4,
    fontWeight: "500",
  },
  demoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  demoBadgeText: {
    color: "#D97706",
    fontSize: 11.5,
    fontWeight: "700",
  },
  // Redesigned Day Selector
  daySelectorWrapper: {
    marginTop: -32,
    marginBottom: 12,
    zIndex: 20,
  },
  daySelectorScroll: {
    paddingHorizontal: 20,
    gap: 10,
    paddingVertical: 6,
  },
  dayCard: {
    width: 110,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dayCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayCardName: {
    fontSize: 14,
    fontWeight: "800",
  },
  todayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  todayBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  countPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // List Content
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
  },
  // Empty State Container
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    padding: 30,
    borderRadius: 24,
    borderWidth: 1,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
  },
  // Schedule Cards
  scheduleCard: {
    flexDirection: "row",
    borderRadius: 22,
    borderWidth: 1.5,
    marginBottom: 16,
    padding: 16,
    position: "relative",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  activeAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  timelineColumn: {
    width: 54,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  timeTextMuted: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  timeLine: {
    width: 2,
    flex: 1,
    marginVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    position: "absolute",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  classBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
  },
  classBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  semesterText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeBadgeText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "800",
  },
  courseName: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 2,
  },
  courseCode: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  detailIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  detailText: {
    fontSize: 12.5,
    fontWeight: "600",
    flex: 1,
  },
});
