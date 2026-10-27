import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
  Image,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { useTheme } from "@/contexts/ThemeContext";

const CAMERA_SIZE = Dimensions.get("window").width * 0.85;
const OVAL_WIDTH = CAMERA_SIZE * 0.55;
const OVAL_HEIGHT = CAMERA_SIZE * 0.75;
const OVAL_TOP = (CAMERA_SIZE - OVAL_HEIGHT) / 2;
const OVAL_LEFT = (CAMERA_SIZE - OVAL_WIDTH) / 2;

export type ScanStatus = "idle" | "scanning" | "detected" | "success" | "failed";

export interface FaceScanResult {
  success: boolean;
  message: string;
  nama_mahasiswa?: string;
  nim?: string;
  status_presensi?: string;
  confidence?: number;
  lbph_score?: number;
  cnn_score?: number;
  is_known?: boolean;
  waktu_presensi?: string;
  inference_time_ms?: number;
}

export interface FaceRecognitionProps {
  token: string;
  idPertemuan: number;
  namaMatakuliah: string;
  pertemuanKe: number;
  modeLokasi: "bebas" | "wajib";
  userLocation: { latitude: number; longitude: number } | null;
  geolokasiData: { latitude: number; longitude: number; radius_meter: number; nama_lokasi: string; } | null;
  isMockLocation: boolean;
  locationLoading: boolean;
  API_BASE: string;
  onBack: () => void;
  onPresensiSuccess: () => void;
  scanStatus: ScanStatus;
  setScanStatus: React.Dispatch<React.SetStateAction<ScanStatus>>;
  capturedImage: string | null;
  setCapturedImage: React.Dispatch<React.SetStateAction<string | null>>;
  showPreview: boolean;
  setShowPreview: React.Dispatch<React.SetStateAction<boolean>>;
  cameraRef: React.RefObject<CameraView | null>;
  facing: CameraType;
  setFacing: React.Dispatch<React.SetStateAction<CameraType>>;
  isCapturing: boolean;
  setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>;
  faceScanResult: FaceScanResult | null;
  setFaceScanResult: React.Dispatch<React.SetStateAction<FaceScanResult | null>>;
  isGalleryImage: boolean;
  setIsGalleryImage: React.Dispatch<React.SetStateAction<boolean>>;
  galleryBase64: string | null;
  setGalleryBase64: React.Dispatch<React.SetStateAction<string | null>>;
}

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


interface LeafletMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  geolokasiData: {
    latitude: number;
    longitude: number;
    radius_meter: number;
    nama_lokasi: string;
  } | null;
  distanceToCenter: number | null;
}


function LeafletMap({ userLocation, geolokasiData, distanceToCenter }: LeafletMapProps) {
  const mapWebViewRef = useRef<WebView>(null);


  const getMapHTML = useCallback(() => {
    const centerLat = geolokasiData?.latitude ?? userLocation?.latitude ?? -6.2088;
    const centerLng = geolokasiData?.longitude ?? userLocation?.longitude ?? 106.8456;

    let geoMarker = '';
    let circles = '';
    let userMarkerInit = '';

    if (userLocation) {
      userMarkerInit = 
      `var userMarker = L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#2563EB;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).addTo(map).bindPopup('Posisi Anda');
        var userAccuracyCircle = L.circle([${userLocation.latitude}, ${userLocation.longitude}], {
          radius: 8,
          color: '#2563EB',
          fillColor: '#2563EB',
          fillOpacity: 0.15,
          weight: 1
        }).addTo(map);`;
    } else {
      userMarkerInit = `var userMarker = null; var userAccuracyCircle = null;`;
    }

    if (geolokasiData) {
      geoMarker = `L.marker([${geolokasiData.latitude}, ${geolokasiData.longitude}], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background:#EF4444;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(map).bindPopup('${geolokasiData.nama_lokasi}');`;

      circles = `L.circle([${geolokasiData.latitude}, ${geolokasiData.longitude}], {
        radius: ${geolokasiData.radius_meter},
        color: '#EF4444',
        fillColor: '#EF4444',
        fillOpacity: 0.12,
        weight: 2
      }).addTo(map);`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #F8FAFC; }
    #map { height: 100vh; width: 100vw; background: #F8FAFC; }
    .leaflet-container { background: #F8FAFC !important; }
    .leaflet-popup-content-wrapper {
      background: #FFFFFF;
      color: #1E293B;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
    }
    .leaflet-popup-tip { background: #FFFFFF; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\u00a9 OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    ${userMarkerInit}
    ${geoMarker}
    ${circles}

    // Listen for real-time location updates from React Native
    var handleMessage = function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'updateUserLocation') {
          var latlng = L.latLng(data.lat, data.lng);
          if (userMarker) {
            userMarker.setLatLng(latlng);
          } else {
            userMarker = L.marker(latlng, {
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background:#2563EB;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
              })
            }).addTo(map).bindPopup('Posisi Anda');
          }
          if (userAccuracyCircle) {
            userAccuracyCircle.setLatLng(latlng);
          } else {
            userAccuracyCircle = L.circle(latlng, {
              radius: 8,
              color: '#2563EB',
              fillColor: '#2563EB',
              fillOpacity: 0.15,
              weight: 1
            }).addTo(map);
          }
        }
      } catch(e) {}
    };
    // Android uses document.addEventListener, iOS uses window
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`;
  }, [geolokasiData, userLocation]); // FIX: added userLocation to deps

  // Send real-time location updates to WebView without re-rendering HTML
  useEffect(() => {
    if (userLocation && mapWebViewRef.current) {
      mapWebViewRef.current.postMessage(JSON.stringify({
        type: 'updateUserLocation',
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      }));
    }
  }, [userLocation]);

  return (
    <View style={styles.leafletMapContainer}>
      <WebView
        ref={mapWebViewRef}
        originWhitelist={['*']}
        source={{ html: getMapHTML() }}
        style={{ flex: 1, backgroundColor: THEME.bgSecondary }}
        javaScriptEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.locationStatus}>
        {distanceToCenter !== null && geolokasiData ? (
          distanceToCenter <= geolokasiData.radius_meter ? (
            <Text style={[styles.locationStatusText, { color: THEME.success }]}>
              âœ… Dalam Radius ({Math.round(distanceToCenter)}m dari pusat)
            </Text>
          ) : (
            <Text style={[styles.locationStatusText, { color: THEME.danger }]}>
              âš ï¸ Di Luar Radius â€“ Tidak bisa presensi
            </Text>
          )
        ) : (
          <Text style={styles.locationStatusText}>
          Memuat data lokasi...
          </Text>
        )}
      </View>
    </View>
  );
}

// â”€â”€â”€ Oval Mask Overlay Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Oval Mask Overlay Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OvalMaskOverlay() {
  return <View style={styles.ovalRing} pointerEvents="none" />;
}


// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function FaceRecognition(props: FaceRecognitionProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const { isDarkMode, theme: themeContext } = useTheme();

  // ── State tambahan untuk low-light handling ─────────────────────────────
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lowLightWarning, setLowLightWarning] = useState(false);
  const retryCountRef = useRef(0); // Jumlah auto-retry yang sudah dilakukan

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
    warning: isDarkMode ? "#FBBF24" : "#F59E0B",
    danger: isDarkMode ? "#F87171" : "#EF4444",
  };
  
  const {
    token,
    idPertemuan,
    namaMatakuliah,
    pertemuanKe,
    modeLokasi,
    userLocation,
    geolokasiData,
    isMockLocation,
    locationLoading,
    API_BASE,
    onBack,
    onPresensiSuccess,
    scanStatus,
    setScanStatus,
    capturedImage,
    setCapturedImage,
    showPreview,
    setShowPreview,
    cameraRef,
    facing,
    isCapturing,
    setIsCapturing,
    faceScanResult,
    setFaceScanResult,
    isGalleryImage,
    setIsGalleryImage,
    galleryBase64,
    setGalleryBase64,
  } = props;

  const getScanStatusColor = (): string => {
    switch (scanStatus) {
      case "scanning": return colors.primary;
      case "detected": return "#10B981";
      case "success": return colors.success;
      case "failed": return colors.danger;
      default: return colors.primary;
    }
  };

  const getScanStatusText = (): string => {
    switch (scanStatus) {
      case "scanning": return "Memindai wajah...";
      case "detected": return "Wajah terdeteksi!";
      case "success": return "âœ“ Presensi Berhasil!";
      case "failed": return "âœ— Wajah tidak dikenali";
      default: return "Posisikan wajah dalam oval";
    }
  };

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6_371_000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const muteShutterSound = async () => {
    if (Platform.OS === "ios") {
      try {
        const AudioSession = require("expo-av").Audio;
        await AudioSession.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      } catch { }
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const cropToOvalRegion = async (photoUri: string, photoWidth: number, photoHeight: number, isFront: boolean): Promise<string> => {
    try {
      // CameraView uses a cover-style preview: the source image is scaled
      // uniformly until it fills the square camera window, then the excess
      // pixels are clipped from the centre. Mapping with independent scaleX /
      // scaleY made the crop drift away from the oval on portrait/landscape
      // photos, even when the user's face was positioned correctly.
      const coverScale = Math.max(CAMERA_SIZE / photoWidth, CAMERA_SIZE / photoHeight);
      const renderedWidth = photoWidth * coverScale;
      const renderedHeight = photoHeight * coverScale;
      const renderedOffsetX = (CAMERA_SIZE - renderedWidth) / 2;
      const renderedOffsetY = (CAMERA_SIZE - renderedHeight) / 2;
      const ovalLeft = (CAMERA_SIZE - OVAL_WIDTH) / 2;
      const ovalTop = (CAMERA_SIZE - OVAL_HEIGHT) / 2;
      // Keep useful context around the face for YuNet landmark alignment.
      const cropPadding = CAMERA_SIZE * 0.16;
      const previewLeft = Math.max(0, ovalLeft - cropPadding);
      const previewTop = Math.max(0, ovalTop - cropPadding);
      const previewRight = Math.min(CAMERA_SIZE, ovalLeft + OVAL_WIDTH + cropPadding);
      const previewBottom = Math.min(CAMERA_SIZE, ovalTop + OVAL_HEIGHT + cropPadding);

      const toPhotoX = (x: number) => (x - renderedOffsetX) / coverScale;
      const toPhotoY = (y: number) => (y - renderedOffsetY) / coverScale;
      let scaledCropLeft = Math.floor(toPhotoX(previewLeft));
      let scaledCropTop = Math.floor(toPhotoY(previewTop));
      let scaledCropRight = Math.ceil(toPhotoX(previewRight));
      let scaledCropBottom = Math.ceil(toPhotoY(previewBottom));

      // Clamp after mapping because the preview may extend beyond the source
      // image on one axis.
      scaledCropLeft = Math.max(0, Math.min(photoWidth - 1, scaledCropLeft));
      scaledCropTop = Math.max(0, Math.min(photoHeight - 1, scaledCropTop));
      scaledCropRight = Math.max(scaledCropLeft + 1, Math.min(photoWidth, scaledCropRight));
      scaledCropBottom = Math.max(scaledCropTop + 1, Math.min(photoHeight, scaledCropBottom));
      const scaledCropWidth = scaledCropRight - scaledCropLeft;
      const scaledCropHeight = scaledCropBottom - scaledCropTop;
      
      const actions: ImageManipulator.Action[] = [];
      actions.push({ crop: { originX: scaledCropLeft, originY: scaledCropTop, width: scaledCropWidth, height: scaledCropHeight } });
      // Mirror only after cropping. Mirroring first changes the crop origin
      // and can select the opposite side of the source photo.
      if (isFront) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }
      actions.push({ resize: { width: 800 } });

      const manipResult = await ImageManipulator.manipulateAsync(
        photoUri,
        actions,
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (error) {
      console.warn("Crop failed, using original:", error);
      return photoUri;
    }
  };

  const handleCapture = async (isAutoRetry: boolean = false) => {
    if (isCapturing && !isAutoRetry) return;
    if (!token) {
      Alert.alert("Error", "Sesi login tidak valid. Silahkan login ulang.");
      return;
    }

    setIsCapturing(true);
    setScanStatus("scanning");
    if (!isAutoRetry) {
      setFaceScanResult(null);
      retryCountRef.current = 0;
    }

    try {
      let finalBase64: string;

      if (isGalleryImage && galleryBase64) {
        // ── Gambar dari Galeri ──────────────────────────────────────────
        // FIX: Resize gambar galeri agar konsisten dengan gambar kamera.
        // Sebelumnya gambar galeri langsung dikirim tanpa preprocessing,
        // menyebabkan ukuran tidak konsisten dengan foto kamera (resize 800px).
        try {
          const galleryUri = capturedImage;
          if (galleryUri) {
            const resizedGallery = await ImageManipulator.manipulateAsync(
              galleryUri,
              [{ resize: { width: 800 } }],
              { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
            );
            const resizedBlob = await (await fetch(resizedGallery.uri)).blob();
            finalBase64 = await blobToBase64(resizedBlob);
          } else {
            finalBase64 = galleryBase64;
          }
        } catch {
          // Fallback ke base64 galeri asli jika resize gagal
          finalBase64 = galleryBase64;
        }
      } else {
        // ── Foto dari Kamera ────────────────────────────────────────────
        if (!cameraRef.current) {
          throw new Error("Kamera tidak tersedia");
        }
        await muteShutterSound();

        const photo = await cameraRef.current.takePictureAsync({
          quality: 1, base64: true, imageType: "jpg" as any, shutterSound: false,
          ...(Platform.OS === "ios" && { mute: true }),
        });

        if (!photo?.base64) {
          throw new Error("Gagal mengambil foto dari kamera");
        }

        setCapturedImage(photo.uri);
        setShowPreview(true);
        setScanStatus("detected");
        await new Promise((r) => setTimeout(r, 300));

        // Jangan crop di Android. Lakukan resize + re-encode saja untuk
        // menormalkan EXIF orientation. cv2.imdecode di backend membaca
        // piksel JPEG tanpa menerapkan EXIF orientation; mengirim base64 asli
        // dapat membuat foto terlihat tegak di Android tetapi terbaca miring
        // oleh YuNet.
        try {
          const normalized = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
          );
          const normalizedBlob = await (await fetch(normalized.uri)).blob();
          finalBase64 = await blobToBase64(normalizedBlob);
        } catch {
          // Fallback only if the platform cannot re-encode the photo.
          finalBase64 = photo.base64;
        }
      }

      const res = await fetch(`${API_BASE}/presensi/face-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id_pertemuan: idPertemuan, foto_base64: finalBase64, latitude: userLocation?.latitude ?? null, longitude: userLocation?.longitude ?? null }),
      });

      let result: FaceScanResult;
      try {
        result = await res.json();
      } catch {
        throw new Error(`Server error: HTTP ${res.status}`);
      }

      if (res.ok && result.success) {
        setScanStatus("success");
        setFaceScanResult(result);
        setLowLightWarning(false);
        retryCountRef.current = 0;
        const confPct = result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : "";
        const statusLabel = result.status_presensi === "terlambat" ? "Terlambat" : "Hadir";

        Alert.alert(
          `Berhasil ${statusLabel}!`,
          `${result.nama_mahasiswa ?? ""} (${result.nim ?? ""})\n\nPresensi tercatat sebagai ${statusLabel}\nSkor kepercayaan: ${confPct}\nWaktu deteksi: ${result.inference_time_ms?.toFixed(0) ?? 0}ms`,
          [{ text: "OK", onPress: () => { setScanStatus("idle"); setFaceScanResult(null); setCapturedImage(null); setShowPreview(false); setIsGalleryImage(false); setGalleryBase64(null); onPresensiSuccess(); } }],
        );
      } else if (
        res.ok &&
        !result.success &&
        result.is_known === true &&
        result.message?.toLowerCase().includes("sudah melakukan presensi")
      ) {
        // Backend: presensi sudah tercatat sebelumnya.
        // Treat sebagai success — redirect ke students view & disable tombol scan.
        setScanStatus("success");
        setLowLightWarning(false);
        retryCountRef.current = 0;
        Alert.alert(
          "Sudah Tercatat",
          "Presensi Anda untuk sesi ini sudah tercatat sebelumnya.",
          [{ text: "OK", onPress: () => { setScanStatus("idle"); setFaceScanResult(null); setCapturedImage(null); setShowPreview(false); setIsGalleryImage(false); setGalleryBase64(null); onPresensiSuccess(); } }],
        );
      } else {
        // Gagal — tampilkan error normal
        setScanStatus("failed");
        setLowLightWarning(false);
        retryCountRef.current = 0;
        const msg = result.message ?? (res.ok ? "Wajah tidak dikenali" : `HTTP ${res.status}`);
        // Tampilkan skor similarity agar mudah di-debug
        const confPct = result.confidence != null
          ? `\nSkor kesamaan: ${(result.confidence * 100).toFixed(1)}% (threshold ~45%)`
          : "";

        Alert.alert("Gagal", `${msg}${confPct}`, [{ text: "Coba Lagi", onPress: () => { setScanStatus("idle"); setCapturedImage(null); setShowPreview(false); setIsGalleryImage(false); setGalleryBase64(null); } }]);
      }
    } catch (err: unknown) {
      setScanStatus("failed");
      retryCountRef.current = 0;
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan tidak diketahui";
      Alert.alert("Error", errMsg.includes("face-scan") ? "ML service tidak tersedia. Pastikan server ML berjalan di port 8001." : errMsg, [{ text: "Coba Lagi", onPress: () => { setScanStatus("idle"); setCapturedImage(null); setShowPreview(false); setIsGalleryImage(false); setGalleryBase64(null); } }]);
    } finally {
      setIsCapturing(false);
    }
  };

  // ─── Handle Manual Input (NIM-based) ──────────────────────────────────────
  const handleManualInput = async (nim: string) => {
    if (!token) {
      Alert.alert("Error", "Sesi login tidak valid. Silahkan login ulang.");
      return;
    }

    setIsCapturing(true);
    setScanStatus("scanning");

    try {
      const res = await fetch(`${API_BASE}/presensi/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_pertemuan: idPertemuan,
          nim: nim,
          latitude: userLocation?.latitude ?? null,
          longitude: userLocation?.longitude ?? null,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setScanStatus("success");
        const statusLabel = result.status_presensi === "terlambat" ? "Terlambat" : "Hadir";
        Alert.alert(
          `Berhasil ${statusLabel}!`,
          `${result.nama_mahasiswa ?? ""} (${result.nim ?? ""})\n\nPresensi tercatat sebagai ${statusLabel}`,
          [{ text: "OK", onPress: () => { setScanStatus("idle"); onPresensiSuccess(); } }],
        );
      } else {
        setScanStatus("failed");
        Alert.alert("Gagal", result.message ?? "Gagal melakukan presensi manual", [
          { text: "Coba Lagi", onPress: () => { setScanStatus("idle"); } },
        ]);
      }
    } catch (err) {
      setScanStatus("failed");
      Alert.alert("Error", "Terjadi kesalahan koneksi", [
        { text: "OK", onPress: () => { setScanStatus("idle"); } },
      ]);
    } finally {
      setIsCapturing(false);
    }
  };

  // ─── Calculate distance & radius status for scan view ──
  const scanDistanceToCenter =
    userLocation && geolokasiData
      ? haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          geolokasiData.latitude,
          geolokasiData.longitude,
        )
      : null;

  const scanIsInRadius =
    !isMockLocation &&
    (modeLokasi === "bebas" ||
      locationLoading ||
      (userLocation !== null &&
        geolokasiData !== null &&
        scanDistanceToCenter !== null &&
        scanDistanceToCenter <= geolokasiData.radius_meter));

  // Tombol scan aktif jika: ada gambar galeri siap kirim, atau kamera siap & dalam radius
  const captureDisabled = isCapturing || isMockLocation || (!isGalleryImage && (showPreview || !scanIsInRadius));

  // ─── Permission check ──
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={THEME.primary} />
        <Text style={styles.permissionTitle}>Memuat Kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={72} color={THEME.primary} />
          <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
          <Text style={styles.permissionDesc}>
            Aplikasi membutuhkan akses kamera untuk mengenali wajah Anda dalam proses presensi.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Izinkan Kamera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const frameColor = getScanStatusColor();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
          onPress={() => {
            setScanStatus("idle");
            setCapturedImage(null);
            setShowPreview(false);
            onBack();
          }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Scan Wajah</Text>
          <Text style={[styles.headerSubtitle, { color: colors.primary }]}>
            {namaMatakuliah} · ke-{pertemuanKe}
          </Text>
        </View>
        <View style={styles.headerRightButtons}>
          {/* Torch / Flash Button — untuk kondisi low-light indoor */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              isTorchOn && { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }
            ]}
            onPress={() => setIsTorchOn((v) => !v)}
          >
            <Ionicons
              name={isTorchOn ? "flash" : "flash-outline"}
              size={22}
              color={isTorchOn ? "#F59E0B" : THEME.primary}
            />
          </TouchableOpacity>
          {/* Gallery Button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              try {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsEditing: true,
                  aspect: [OVAL_WIDTH, OVAL_HEIGHT],
                  quality: 1,
                  base64: true,
                });

                if (!result.canceled && result.assets[0]) {
                  const asset = result.assets[0];
                  setCapturedImage(asset.uri);
                  setShowPreview(true);
                  setScanStatus("detected");
                  // Tandai bahwa gambar berasal dari galeri & simpan base64-nya
                  setIsGalleryImage(true);
                  setGalleryBase64(asset.base64 ?? null);
                }
              } catch (err) {
                Alert.alert("Error", "Gagal memilih gambar dari galeri");
              }
            }}
          >
            <Ionicons name="images-outline" size={24} color={THEME.primary} />
          </TouchableOpacity>
          {/* Manual Input Button */}
          <TouchableOpacity
            style={[styles.iconButton, styles.manualInputButton]}
            onPress={() => {
              Alert.prompt(
                "Input Manual",
                "Masukkan NIM untuk presensi manual:",
                async (nim) => {
                  if (!nim || nim.trim() === "") {
                    Alert.alert("Error", "NIM tidak boleh kosong");
                    return;
                  }
                  await handleManualInput(nim.trim());
                },
                "plain-text",
                "",
                "number-pad"
              );
            }}
          >
            <Ionicons name="create-outline" size={24} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scanScrollView}
        contentContainerStyle={styles.scanScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera Area clipped to the oval */}
        <View style={styles.cameraWrapper}>
          <View style={styles.ovalClip}>
            {showPreview && capturedImage ? (
              <Image 
                source={{ uri: capturedImage }} 
                style={[
                  styles.cameraInner, 
                  (facing === "front" && !isGalleryImage) && { transform: [{ scaleX: -1 }] }
                ]} 
                resizeMode="cover" 
              />
            ) : (
              <CameraView
                ref={cameraRef}
                style={styles.cameraInner}
                facing={facing}
                mute={true}
                enableTorch={isTorchOn}
              />
            )}
          </View>

          {/* Oval border ring */}
          <OvalMaskOverlay />

          {showPreview && (
            <View style={styles.freezeFrameOverlay}>
              <View style={styles.freezeFrameLabel}>
                <Ionicons name="image" size={14} color={THEME.primary} />
                <Text style={styles.freezeFrameLabelText}>
                  {capturedImage?.startsWith("file://") || capturedImage?.startsWith("/") ? "Dari Galeri" : "Tertangkap"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Status Badge */}
        <View style={styles.statusWrapper}>
          <View style={[styles.statusBadge, { borderColor: `${frameColor}40`, backgroundColor: `${frameColor}12` }]}>
            <View style={[styles.statusDot, { backgroundColor: frameColor }]} />
            <Text style={[styles.statusText, { color: frameColor }]}>{getScanStatusText()}</Text>
          </View>
        </View>

        {/* Mock GPS Warning in Scan View */}
        {isMockLocation && (
          <View style={styles.mockGpsBanner}>
            <Ionicons name="warning" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.mockGpsBannerTitle}>
                ⛔ GPS Palsu Terdeteksi!
              </Text>
              <Text style={styles.mockGpsBannerDesc}>
                Matikan aplikasi fake GPS dan gunakan GPS bawaan HP. Tombol scan dinonaktifkan.
              </Text>
            </View>
          </View>
        )}

        {/* Low-Light Warning Banner */}
        {lowLightWarning && !isTorchOn && (
          <View style={styles.lowLightBanner}>
            <Ionicons name="sunny-outline" size={18} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lowLightBannerTitle}>💡 Pencahayaan Kurang</Text>
              <Text style={styles.lowLightBannerDesc}>
                Nyalakan senter (⚡) di header atau cari area lebih terang
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsTorchOn(true)}
              style={styles.torchQuickBtn}
            >
              <Ionicons name="flash" size={18} color="#92400E" />
              <Text style={styles.torchQuickBtnText}>Nyalakan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Torch Active Banner */}
        {isTorchOn && (
          <View style={styles.torchActiveBanner}>
            <Ionicons name="flash" size={16} color="#92400E" />
            <Text style={styles.torchActiveBannerText}>Senter aktif — mode pencahayaan rendah</Text>
          </View>
        )}

        {/* ── Peta Lokasi ── */}
        <LeafletMap
          userLocation={userLocation}
          geolokasiData={modeLokasi === "wajib" ? geolokasiData : null}
          distanceToCenter={modeLokasi === "wajib" ? scanDistanceToCenter : null}
        />
        {modeLokasi === "bebas" && (
          <View style={styles.locationFreeBanner}>
            <Text style={styles.locationFreeText}>
              🔓 Presensi Bebas – Dapat presensi dari mana saja
            </Text>
          </View>
        )}

        {/* Info Panel */}
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelRow}>
            <Ionicons name="information-circle-outline" size={16} color={THEME.textMuted} />
            <Text style={styles.infoPanelText}>Pastikan wajah terlihat jelas dan pencahayaan cukup</Text>
          </View>
          <View style={styles.infoPanelRow}>
            <Ionicons name="flash-outline" size={16} color="#F59E0B" />
            <Text style={[styles.infoPanelText, { color: "#92400E" }]}>
              Di ruangan gelap? Nyalakan ⚡ senter di kanan atas
            </Text>
          </View>
          <View style={styles.infoPanelRow}>
            <Ionicons name="eye-outline" size={16} color={THEME.textMuted} />
            <Text style={styles.infoPanelText}>Lepas kacamata atau masker jika ada</Text>
          </View>
          <View style={styles.infoPanelRow}>
            <Ionicons name="images-outline" size={16} color={THEME.success} />
            <Text style={[styles.infoPanelText, { color: THEME.success }]}>Pilih dari Galeri atau Input Manual</Text>
          </View>
        </View>
      </ScrollView>

      {/* Capture Button – dinonaktifkan jika di luar radius (mode wajib) */}
      <View style={styles.captureSection}>
        {modeLokasi === "wajib" && !scanIsInRadius && !locationLoading && (
          <Text style={styles.outsideRadiusHint}>
            ⚠️ Anda di luar radius – Tidak dapat presensi
          </Text>
        )}
        <TouchableOpacity
          style={[styles.captureButton, captureDisabled && styles.captureButtonDisabled]}
          onPress={() => handleCapture()}
          disabled={captureDisabled}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              captureDisabled
                ? ["#E2E8F0", "#E2E8F0"]
                : [THEME.primary, THEME.primaryLight]
            }
            style={styles.captureGradient}
          >
            {isCapturing ? (
              <Ionicons name="hourglass-outline" size={28} color={THEME.textMuted} />
            ) : isMockLocation ? (
              <Ionicons name="warning" size={28} color={THEME.danger} />
            ) : isGalleryImage ? (
              <Ionicons name="scan-outline" size={28} color="#fff" />
            ) : showPreview ? (
              <Ionicons name="checkmark-circle" size={28} color={THEME.success} />
            ) : !scanIsInRadius ? (
              <Ionicons name="location-outline" size={28} color={THEME.textMuted} />
            ) : (
              <Ionicons name="scan-outline" size={28} color="#fff" />
            )}
          </LinearGradient>
          <Text style={[styles.captureText, captureDisabled && { color: THEME.textMuted }]}>
            {isCapturing
              ? "Memproses..."
              : isMockLocation
                ? "GPS Palsu"
                : isGalleryImage
                  ? "Scan Gambar Galeri"
                  : showPreview
                    ? "Tercapture"
                    : !scanIsInRadius
                      ? "Di Luar Radius"
                      : "Scan Wajah"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  headerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manualInputButton: {
    marginLeft: 4,
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

  permissionContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionCard: {
    alignItems: "center",
    backgroundColor: THEME.bgCard,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: THEME.border,
    width: "100%",
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginTop: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  permissionDesc: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Camera area â€” clipped to the oval shape
  cameraWrapper: {
    alignSelf: "center",
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    marginTop: 4,
    position: "relative",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  ovalClip: {
    position: "absolute",
    top: OVAL_TOP,
    left: OVAL_LEFT,
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    overflow: "hidden",
    backgroundColor: THEME.bgSecondary,
  },
  cameraInner: {
    position: "absolute",
    top: -OVAL_TOP,
    left: -OVAL_LEFT,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
  },
  ovalRing: {
    position: "absolute",
    top: OVAL_TOP,
    left: OVAL_LEFT,
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    zIndex: 10,
  },

  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(37, 99, 235, 0.8)",
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 20,
  },
  glowOverlay: {
    position: "absolute",
    top: (CAMERA_SIZE - OVAL_HEIGHT) / 2 - 6,
    left: (CAMERA_SIZE - OVAL_WIDTH) / 2 - 6,
    width: OVAL_WIDTH + 12,
    height: OVAL_HEIGHT + 12,
    borderRadius: (OVAL_WIDTH + 12) / 2,
    borderWidth: 3,
    zIndex: 5,
  },

  freezeFrameOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 30,
  },
  freezeFrameLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  freezeFrameLabelText: {
    fontSize: 11,
    color: THEME.primary,
    fontWeight: "600",
  },

  statusWrapper: {
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 24,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },

  infoPanel: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: THEME.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
  },
  infoPanelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoPanelText: {
    fontSize: 13,
    color: THEME.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  scanScrollView: {
    flex: 1,
  },
  scanScrollContent: {
    paddingBottom: 140,
  },
  captureSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: Platform.OS === "android" ? 20 : 32,
    backgroundColor: THEME.bg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  captureButton: {
    alignItems: "center",
    gap: 8,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  captureText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textPrimary,
  },

  leafletMapContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.border,
    height: 200,
    backgroundColor: THEME.bgSecondary,
  },
  locationStatus: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.bgCard,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  locationStatusText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: "500",
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
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  outsideRadiusHint: {
    fontSize: 12,
    color: THEME.danger,
    fontWeight: "600",
    marginBottom: 8,
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

  // ── Low-Light Banner Styles ───────────────────────────────────────────────
  lowLightBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  lowLightBannerTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 2,
  },
  lowLightBannerDesc: {
    fontSize: 12,
    color: "#78350F",
  },
  torchActiveBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  torchActiveBannerText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500" as const,
  },
  torchQuickBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FDE68A",
    borderRadius: 8,
  },
  torchQuickBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#92400E",
  },
});
