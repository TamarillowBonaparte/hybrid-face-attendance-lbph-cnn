import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { API_BASE, IDLE_TIMEOUT_MS } from "@/constants/config";

const STORAGE_KEYS = ["auth_token", "auth_user", "last_activity_at"] as const;
const SECURE_KEYS = {
  EMAIL: "remembered_email",
  PASSWORD: "remembered_password",
  REMEMBER: "remember_remember",
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  // Mahasiswa profile (populated after login via /users/{id})
  id_mahasiswa?: number;
  nim?: string;
  nama_mahasiswa?: string;
  nama_kelas?: string;
  id_prodi?: number;
  id_angkatan?: number;
  id_golongan?: number;
  id_kelas?: number | null;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Panggil setiap ada interaksi pengguna untuk mereset timer idle */
  updateActivity: () => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref untuk waktu aktivitas terakhir — pakai ref agar update cepat tanpa re-render
  const lastActivityRef = useRef<number | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearSession = async () => {
    await AsyncStorage.multiRemove([...STORAGE_KEYS]);
    // Clear remembered credentials from secure storage
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.EMAIL),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSWORD),
      SecureStore.deleteItemAsync(SECURE_KEYS.REMEMBER),
    ]);
    lastActivityRef.current = null;
    setToken(null);
    setUser(null);
  };

  const isExpired = (lastActivity: number | null): boolean => {
    if (!lastActivity) return false; // belum ada data aktivitas, jangan expire
    return Date.now() - lastActivity > IDLE_TIMEOUT_MS;
  };

  // ── updateActivity ────────────────────────────────────────────────────────

  const updateActivity = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    // Fire-and-forget — tidak perlu await agar tidak memblokir UI
    AsyncStorage.setItem("last_activity_at", String(now)).catch(() => {});
  };

  // ── Hydrate dari AsyncStorage saat boot ──────────────────────────────────

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [storedToken, storedUser, storedActivity] = await Promise.all([
          AsyncStorage.getItem("auth_token"),
          AsyncStorage.getItem("auth_user"),
          AsyncStorage.getItem("last_activity_at"),
        ]);

        if (!storedToken || !storedUser) return;

        // Cek apakah session sudah idle timeout
        const lastActivity = storedActivity
          ? parseInt(storedActivity, 10)
          : null;
        if (isExpired(lastActivity)) {
          // Session kadaluarsa — bersihkan tanpa re-login
          await AsyncStorage.multiRemove([...STORAGE_KEYS]);
          return;
        }

        lastActivityRef.current = lastActivity ?? Date.now();
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthUser);
      } catch {
        // Storage gagal — mulai sebagai guest
      } finally {
        setIsLoading(false);
      }
    };
    hydrate();
  }, []);

  // ── Idle timeout checker ─────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    const checkIdle = async () => {
      if (isExpired(lastActivityRef.current)) {
        await clearSession();
      }
    };

    // Cek setiap menit
    const interval = setInterval(checkIdle, 60_000);

    // Cek juga saat app kembali ke foreground (user balik setelah lama di background)
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkIdle();
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [token]);

  // ── login ─────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<void> => {
    // Backend pakai OAuth2PasswordRequestForm — form-urlencoded, field 'username'
    const body = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (res.status === 401 || res.status === 400) {
      throw new Error("Email atau password salah");
    }
    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      token_type: string;
      user?: AuthUser;
      role?: string;
      name?: string;
      email?: string;
      id?: number;
    };

    // Normalise — backend bisa kembalikan user nested atau flat
    let rawUser: AuthUser = data.user ?? {
      id: data.id ?? 0,
      name: data.name ?? "",
      email: data.email ?? email,
      role: data.role ?? "",
    };

    // Hanya mahasiswa yang boleh login di app ini
    if (rawUser.role !== "mahasiswa") {
      throw new Error("Akses ditolak: Login hanya untuk mahasiswa");
    }

    const jwt = data.access_token;

    // Enrich dengan data mahasiswa (NIM, kelas, prodi, dll)
    try {
      const profileRes = await fetch(`${API_BASE}/users/${rawUser.id}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as {
          id_mahasiswa?: number;
          nim?: string;
          nama_mahasiswa?: string;
          nama_kelas?: string;
          id_prodi?: number;
          id_angkatan?: number;
          id_golongan?: number;
        };
        rawUser = {
          ...rawUser,
          id_mahasiswa: profile.id_mahasiswa,
          nim: profile.nim,
          nama_mahasiswa: profile.nama_mahasiswa,
          nama_kelas: profile.nama_kelas,
          id_prodi: profile.id_prodi,
          id_angkatan: profile.id_angkatan,
          id_golongan: profile.id_golongan,
        };
      }
    } catch {
      /* profil gagal diambil — lanjut dengan data minimal */
    }

    // Simpan token, user, dan waktu aktivitas awal
    const now = Date.now();
    await Promise.all([
      AsyncStorage.setItem("auth_token", jwt),
      AsyncStorage.setItem("auth_user", JSON.stringify(rawUser)),
      AsyncStorage.setItem("last_activity_at", String(now)),
    ]);

    lastActivityRef.current = now;
    setToken(jwt);
    setUser(rawUser);
  };

  // ── logout ────────────────────────────────────────────────────────────────

  const logout = async (): Promise<void> => {
    await clearSession();
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{ token, user, isLoading, login, logout, updateActivity }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
