import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider as AppThemeProvider } from "@/contexts/ThemeContext";

export const unstable_settings = {
  initialRouteName: "login",
};

// ── Redirect ke /login jika tidak punya token ──────────────────────────────
function AuthGuard() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Jangan redirect saat masih loading (hydrate dari AsyncStorage)
    if (isLoading) return;

    const inTabs = segments[0] === "(tabs)";
    const inLogin = segments[0] === "login";

    if (!token && inTabs) {
      router.replace("/login");
    } else if (token && inLogin) {
      router.replace("/(tabs)");
    }
  }, [token, isLoading, segments, router]);

  return null;
}

// ── Setiap sentuhan di mana saja akan mereset timer idle ───────────────────
function ActivityWrapper({ children }: { children: React.ReactNode }) {
  const { updateActivity } = useAuth();
  return (
    <View style={{ flex: 1 }} onTouchStart={updateActivity}>
      {children}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppThemeProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <AuthGuard />
          <ActivityWrapper>
            <Stack>
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
              <Stack.Screen
                name="ganti_password"
                options={{ title: "Ganti Password" }}
              />
            </Stack>
          </ActivityWrapper>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
