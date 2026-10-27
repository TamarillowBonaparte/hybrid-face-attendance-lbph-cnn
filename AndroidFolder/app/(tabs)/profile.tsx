import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { router } from "expo-router";
import { API_BASE } from "@/constants/config";

// Mock data untuk attendance history
const attendanceData = [
  {
    id: 1,
    course: "Pemrograman Mobile",
    date: "11 Feb 2025",
    status: "present",
    time: "08:00",
  },
  {
    id: 2,
    course: "Basis Data Lanjut",
    date: "10 Feb 2025",
    status: "present",
    time: "10:30",
  },
  {
    id: 3,
    course: "Jaringan Komputer",
    date: "09 Feb 2025",
    status: "late",
    time: "09:15",
  },
  {
    id: 4,
    course: "Sistem Operasi",
    date: "08 Feb 2025",
    status: "absent",
    time: "-",
  },
  {
    id: 5,
    course: "Kecerdasan Buatan",
    date: "07 Feb 2025",
    status: "present",
    time: "13:00",
  },
  {
    id: 6,
    course: "Pemrograman Web",
    date: "06 Feb 2025",
    status: "present",
    time: "07:45",
  },
];

// Statistik kehadiran
const stats = {
  present: 85,
  late: 10,
  absent: 5,
};

// Sun Icon Component
const SunIcon = ({ color }: { color: string }) => (
  <View style={{ width: 24, height: 24 }}>
    <Text style={{ fontSize: 20, textAlign: "center" }}>☀️</Text>
  </View>
);

// Moon Icon Component
const MoonIcon = ({ color }: { color: string }) => (
  <View style={{ width: 24, height: 24 }}>
    <Text style={{ fontSize: 20, textAlign: "center" }}>🌙</Text>
  </View>
);

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState("all");
  const [sliderAnim] = useState(new Animated.Value(isDarkMode ? 1 : 0));

  useEffect(() => {
    Animated.timing(sliderAnim, {
      toValue: isDarkMode ? 1 : 0,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [isDarkMode]);

  // Interpolate colors
  const switchBgColor = sliderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#73C0FC", "#183153"],
  });

  const sliderTranslate = sliderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 32],
  });

  const filteredData =
    activeFilter === "all"
      ? attendanceData
      : attendanceData.filter((item) => item.status === activeFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "#10B981";
      case "late":
        return "#F59E0B";
      case "absent":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "present":
        return "Hadir";
      case "late":
        return "Terlambat";
      case "absent":
        return "Sakit/Alpha";
      default:
        return status;
    }
  };

  const handleProfileImagePress = () => {
    Alert.alert(
      "Register Ulang Wajah",
      "Apakah Anda ingin mengganti wajah dan meregister ulang?",
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Ya",
          onPress: () => router.push("/register-foto"),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Background */}
        <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
          {/* Decorative Circles */}
          <View style={[styles.circle1, { backgroundColor: theme.circle1 }]} />
          <View style={[styles.circle2, { backgroundColor: theme.circle2 }]} />

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Profil Mahasiswa</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtitleText }]}>
              Face Recognition System
            </Text>
          </View>
        </View>

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.cardBg,
              shadowColor: theme.shadowColor,
            },
          ]}
        >
          <View style={styles.profileImageContainer}>
            <TouchableOpacity onPress={handleProfileImagePress} activeOpacity={0.8}>
              <View style={[styles.outerRing, { borderColor: theme.outerRing }]}>
                <View style={[styles.innerRing, { backgroundColor: theme.innerRing }]}>
                  <Image
                    source={{
                      uri: user?.nim 
                        ? `${API_BASE}/mahasiswa/nim/${user.nim}/foto?t=${new Date().getTime()}`
                        : "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=250&auto=format&fit=crop",
                    }}
                    style={styles.profileImage}
                  />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
            </View>
          </View>

          <Text style={[styles.studentName, { color: theme.textPrimary }]}>
            {user?.nama_mahasiswa ?? user?.name ?? "Mahasiswa"}
          </Text>
          <Text style={[styles.studentNim, { color: theme.textSecondary }]}>
            NIM: {user?.nim ?? "-"}
          </Text>

          <View style={[styles.statusPill, { backgroundColor: theme.statusPillBg }]}>
            <Text style={[styles.statusPillText, { color: theme.statusPillText }]}>
              Mahasiswa Aktif
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Student Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>
                Kelas
              </Text>
              <Text style={[styles.detailsValue, { color: theme.textPrimary }]}>
                {user?.nama_kelas ?? "-"}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>
                Email
              </Text>
              <Text
                style={[styles.detailsValue, { color: theme.textPrimary }]}
                numberOfLines={1}
              >
                {user?.email ?? "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* Dark Mode Switch */}
        <View
          style={[
            styles.switchCard,
            {
              backgroundColor: theme.cardBg,
              shadowColor: theme.shadowColor,
            },
          ]}
        >
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View
                style={[
                  styles.settingsIconWrapper,
                  { backgroundColor: theme.settingsIconBg },
                ]}
              >
                <IconSymbol
                  name={isDarkMode ? "moon.fill" : "sun.max.fill"}
                  size={18}
                  color={theme.settingsIconColor}
                />
              </View>
              <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                Mode
              </Text>
            </View>

            {/* Custom Toggle Switch */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleDarkMode}
              style={styles.switchTouchable}
            >
              <Animated.View
                style={[
                  styles.switchTrack,
                  { backgroundColor: switchBgColor },
                ]}
              >
                {/* Sun icon */}
                <View style={[styles.switchIcon, { left: 36 }]}>
                  <Text style={{ fontSize: 14 }}>☀️</Text>
                </View>
                {/* Moon icon */}
                <View style={[styles.switchIcon, { left: 5 }]}>
                  <Text style={{ fontSize: 14 }}>🌙</Text>
                </View>
                <Animated.View
                  style={[
                    styles.switchThumb,
                    { transform: [{ translateX: sliderTranslate }] },
                  ]}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings & System Menu */}
        {/* 
<View style={styles.settingsSection}>
  <Text style={[styles.settingsSectionTitle, { color: theme.sectionTitle }]}>
    Pengaturan & Bantuan
  </Text>

  <View
    style={[
      styles.settingsCard,
      {
        backgroundColor: theme.settingsCardBg,
        shadowColor: theme.shadowColor,
      },
    ]}
  >

    <View style={[styles.settingsDivider, { backgroundColor: theme.border }]} />

    <TouchableOpacity style={styles.settingsItem} activeOpacity={0.6}>
      <View style={styles.settingsItemLeft}>
        <View
          style={[
            styles.settingsIconWrapper,
            { backgroundColor: theme.settingsIconBg },
          ]}
        >
          <IconSymbol
            name="info.circle.fill"
            size={18}
            color={theme.settingsIconColor}
          />
        </View>

        <Text
          style={[
            styles.settingsItemText,
            { color: theme.textPrimary },
          ]}
        >
          Hubungi Admin
        </Text>
      </View>

      <IconSymbol
        name="chevron.right"
        size={16}
        color={theme.chevronColor}
      />
    </TouchableOpacity>

    <View
      style={[
        styles.settingsDivider,
        { backgroundColor: theme.border },
      ]}
    />

    <TouchableOpacity style={styles.settingsItem} activeOpacity={0.6}>
      <View style={styles.settingsItemLeft}>
        <View
          style={[
            styles.settingsIconWrapper,
            { backgroundColor: theme.settingsIconBg },
          ]}
        >
          <IconSymbol
            name="gearshape.fill"
            size={18}
            color={theme.settingsIconColor}
          />
        </View>

        <Text
          style={[
            styles.settingsItemText,
            { color: theme.textPrimary },
          ]}
        >
          Tentang Aplikasi
        </Text>
      </View>

      <IconSymbol
        name="chevron.right"
        size={16}
        color={theme.chevronColor}
      />
    </TouchableOpacity>

  </View>
</View>
*/}

        {/* Logout Button */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: theme.logoutBg,
              borderColor: theme.logoutBorder,
            },
          ]}
          activeOpacity={0.8}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <View style={[styles.logoutIconContainer, { backgroundColor: theme.logoutIconBg }]}>
            <IconSymbol name="arrow.right.square" size={20} color="#EF4444" />
          </View>
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
          <IconSymbol name="chevron.right" size={18} color="#EF4444" />
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: "#2563EB",
    height: 220,
    paddingTop: 60,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },
  circle1: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#3B82F6",
    opacity: 0.2,
    position: "absolute",
    top: -40,
    right: -40,
  },
  circle2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#60A5FA",
    opacity: 0.15,
    position: "absolute",
    bottom: 20,
    left: -30,
  },
  headerTextContainer: {
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#93C5FD",
    marginTop: 4,
    fontWeight: "500",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginTop: -80,
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 6,
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 16,
  },
  outerRing: {
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 2,
    borderColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  innerRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#FFFFFF",
    padding: 3,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 49,
  },
  statusBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
  },
  studentName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
    textAlign: "center",
  },
  studentNim: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 12,
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 20,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    width: "100%",
    marginBottom: 16,
  },
  detailsGrid: {
    width: "100%",
    gap: 12,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailsLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  detailsValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  // Dark Mode Switch Card
  switchCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  switchTouchable: {
    padding: 4,
  },
  switchTrack: {
    width: 64,
    height: 34,
    borderRadius: 30,
    justifyContent: "center",
    position: "relative",
  },
  switchThumb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e8e8e8",
    position: "absolute",
    bottom: 2,
    zIndex: 2,
  },
  switchIcon: {
    position: "absolute",
    top: 5,
    zIndex: 1,
  },
  // Settings
  settingsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  settingsItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  settingsItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingsItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  settingsDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logoutText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  bottomPadding: {
    height: 40,
  },
});