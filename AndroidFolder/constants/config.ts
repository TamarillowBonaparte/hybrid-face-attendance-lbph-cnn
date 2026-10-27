// Emulator Android: 10.0.2.2; perangkat fisik: IP LAN komputer backend.
// EXPO_PUBLIC_* terlihat di aplikasi; jangan isi dengan rahasia.
export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000").replace(/\/$/, "");
export const API_BASE = `${BASE_URL}/api/v1`;
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
