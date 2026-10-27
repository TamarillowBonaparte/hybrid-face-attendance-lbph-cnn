import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  bg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  headerBg: string;
  shadowColor: string;
  statusPillBg: string;
  statusPillText: string;
  circle1: string;
  circle2: string;
  subtitleText: string;
  outerRing: string;
  innerRing: string;
  sectionTitle: string;
  settingsCardBg: string;
  settingsIconBg: string;
  settingsIconColor: string;
  chevronColor: string;
  logoutBg: string;
  logoutBorder: string;
  logoutIconBg: string;
  switchBorder: string;
  dayCardBg: string;
  dayCardBorder: string;
  dayCardActiveBg: string;
  dayCardActiveText: string;
  timeText: string;
  timeTextMuted: string;
  badgeBg: string;
  badgeText: string;
}

export const lightTheme: ThemeColors = {
  bg: "#F8FAFC",
  cardBg: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  divider: "#F1F5F9",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  accentDark: "#1D4ED8",
  headerBg: "#2563EB",
  shadowColor: "#1E3A8A",
  statusPillBg: "#DCFCE7",
  statusPillText: "#15803D",
  circle1: "#3B82F6",
  circle2: "#60A5FA",
  subtitleText: "#93C5FD",
  outerRing: "#DBEAFE",
  innerRing: "#FFFFFF",
  sectionTitle: "#0F172A",
  settingsCardBg: "#FFFFFF",
  settingsIconBg: "#EFF6FF",
  settingsIconColor: "#2563EB",
  chevronColor: "#94A3B8",
  logoutBg: "#FEF2F2",
  logoutBorder: "#FEE2E2",
  logoutIconBg: "#FEE2E2",
  switchBorder: "#E2E8F0",
  dayCardBg: "#FFFFFF",
  dayCardBorder: "#E2E8F0",
  dayCardActiveBg: "#2563EB",
  dayCardActiveText: "#FFFFFF",
  timeText: "#1E293B",
  timeTextMuted: "#64748B",
  badgeBg: "#EFF6FF",
  badgeText: "#2563EB",
};

export const darkTheme: ThemeColors = {
  bg: "#0F172A",
  cardBg: "#1E293B",
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "#334155",
  divider: "#334155",
  accent: "#3B82F6",
  accentLight: "rgba(59, 130, 246, 0.15)",
  accentDark: "#1E3A8A",
  headerBg: "#1E3A5F",
  shadowColor: "#000000",
  statusPillBg: "#14532D",
  statusPillText: "#86EFAC",
  circle1: "#2D4A6F",
  circle2: "#3D5A7F",
  subtitleText: "#93C5FD",
  outerRing: "#334155",
  innerRing: "#1E293B",
  sectionTitle: "#F1F5F9",
  settingsCardBg: "#1E293B",
  settingsIconBg: "#1E3A5F",
  settingsIconColor: "#60A5FA",
  chevronColor: "#475569",
  logoutBg: "#371B1B",
  logoutBorder: "#5C2A2A",
  logoutIconBg: "#5C2A2A",
  switchBorder: "#334155",
  dayCardBg: "#1E293B",
  dayCardBorder: "#334155",
  dayCardActiveBg: "#3B82F6",
  dayCardActiveText: "#FFFFFF",
  timeText: "#F1F5F9",
  timeTextMuted: "#94A3B8",
  badgeBg: "rgba(59, 130, 246, 0.2)",
  badgeText: "#60A5FA",
};

const THEME_STORAGE_KEY = "@app_theme_mode";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  theme: ThemeColors;
  toggleDarkMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === "dark" || savedMode === "light") {
          setThemeModeState(savedMode);
        }
      } catch (error) {
        console.error("Failed to load theme preference from storage:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSavedTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error("Failed to save theme preference to storage:", error);
    }
  };

  const toggleDarkMode = () => {
    const nextMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
  };

  const isDarkMode = themeMode === "dark";
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDarkMode,
        theme,
        toggleDarkMode,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
