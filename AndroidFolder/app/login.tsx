import { IconSymbol } from "@/components/ui/icon-symbol";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import * as SecureStore from "expo-secure-store";

const { width } = Dimensions.get("window");

// Secure storage keys for remembered credentials
const SECURE_KEYS = {
  EMAIL: "remembered_email",
  PASSWORD: "remembered_password",
  REMEMBER: "remember_remember",
} as const;

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const [savedEmail, savedPassword, savedRemember] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.EMAIL),
          SecureStore.getItemAsync(SECURE_KEYS.PASSWORD),
          SecureStore.getItemAsync(SECURE_KEYS.REMEMBER),
        ]);

        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        if (savedRemember === "true") {
          setRemember(true);
        }
      } catch (e) {
        console.error("Failed to load saved credentials:", e);
      } finally {
        setIsHydrated(true);
      }
    };

    loadSavedCredentials();
  }, []);

  // Save credentials when remember is toggled or on successful login
  const saveCredentials = async () => {
    try {
      if (remember) {
        await Promise.all([
          SecureStore.setItemAsync(SECURE_KEYS.EMAIL, email),
          SecureStore.setItemAsync(SECURE_KEYS.PASSWORD, password),
          SecureStore.setItemAsync(SECURE_KEYS.REMEMBER, "true"),
        ]);
      } else {
        await Promise.all([
          SecureStore.deleteItemAsync(SECURE_KEYS.EMAIL),
          SecureStore.deleteItemAsync(SECURE_KEYS.PASSWORD),
          SecureStore.deleteItemAsync(SECURE_KEYS.REMEMBER),
        ]);
      }
    } catch (e) {
      console.error("Failed to save credentials:", e);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email dan password wajib diisi");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      // Save credentials if "remember me" is checked
      await saveCredentials();
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render form until credentials are loaded from secure storage
  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoCircle}>
            <IconSymbol name="lock.fill" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.welcomeText}>Selamat Datang</Text>
          <Text style={styles.subtitleText}>Masuk untuk melanjutkan</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <View style={styles.inputContainer}>
              <IconSymbol
                name="envelope"
                size={18}
                color="#93C5FD"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="nama@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={styles.inputContainer}>
              <IconSymbol
                name="lock"
                size={18}
                color="#93C5FD"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Masukkan password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <IconSymbol
                  name={showPassword ? "eye.slash" : "eye"}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember me + Forgot password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberContainer}
              onPress={() => setRemember(!remember)}
            >
              <View
                style={[styles.checkbox, remember && styles.checkboxActive]}
              >
                {remember && (
                  <IconSymbol name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.rememberText}>Ingat saya</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.forgotText}>Lupa password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && { opacity: 0.75 }]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Masuk</Text>
            )}
          </TouchableOpacity>

          {/* Register New Button */}
          {/* <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push("/register-foto")}
            activeOpacity={0.8}
          >
            <View style={styles.registerButtonContent}>
              <IconSymbol name="person.badge.plus" size={20} color="#3B82F6" />
              <Text style={styles.registerButtonText}>Register Wajah Baru</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color="#93C5FD" />
          </TouchableOpacity> */}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#EFF6FF", // biru sangat muda
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 30,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1E3A8A",
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: "#60A5FA",
    fontWeight: "400",
  },
  formCard: {
    backgroundColor: "#fff",
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 28,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    color: "#60A5FA",
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    backgroundColor: "#F8FAFF",
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    height: "100%",
  },
  eyeIcon: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  rememberContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#93C5FD",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  rememberText: {
    fontSize: 13,
    color: "#475569",
  },
  forgotText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#3B82F6",
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 16,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  registerButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3B82F6",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DBEAFE",
  },
  dividerText: {
    fontSize: 12,
    color: "#93C5FD",
    marginHorizontal: 12,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F0F6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontSize: 14,
    color: "#64748B",
  },
  signUpLink: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "700",
  },
});
