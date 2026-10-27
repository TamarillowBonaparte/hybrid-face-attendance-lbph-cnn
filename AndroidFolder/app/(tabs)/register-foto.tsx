// import React, { useState, useRef, useEffect, useCallback } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   Dimensions,
//   Platform,
//   StatusBar,
//   Animated,
//   Image,
//   ScrollView,
//   ActivityIndicator,
//   Vibration,
//   Modal,
//   PanResponder,
//   GestureResponderEvent,
//   PanResponderGestureState,
// } from "react-native";
// import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
// import { Ionicons } from "@expo/vector-icons";
// import { LinearGradient } from "expo-linear-gradient";
// import * as ImageManipulator from "expo-image-manipulator";
// import * as ImagePicker from "expo-image-picker";
// import { useAuth } from "@/contexts/AuthContext";
// import { API_BASE } from "@/constants/config";

// // ─── Pose Types ─────────────────────────────────────────────────────────────

// type PoseType = 'center' | 'right' | 'left';

// interface PoseConfig {
//   id: PoseType;
//   label: string;
//   icon: string;
//   description: string;
//   color: string;
// }

// const POSES: PoseConfig[] = [
//   { id: 'center', label: 'Hadap Depan', icon: '👤', description: 'Lihat kamera secara langsung', color: '#2563EB' },
//   { id: 'right', label: 'Hadap Kanan', icon: '👉', description: 'Putar kepala ke kanan ~30°', color: '#8B5CF6' },
//   { id: 'left', label: 'Hadap Kiri', icon: '👈', description: 'Putar kepala ke kiri ~30°', color: '#EC4899' },
// ];

// const CAPTURES_PER_POSE = 2; // burst: 2 foto per klik

// // ─── Constants ──────────────────────────────────────────────────────────────

// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// const CAMERA_SIZE = SCREEN_WIDTH * 0.85;
// const OVAL_WIDTH = CAMERA_SIZE * 0.55;
// const OVAL_HEIGHT = CAMERA_SIZE * 0.75;
// const OVAL_TOP = (CAMERA_SIZE - OVAL_HEIGHT) / 2;
// const OVAL_LEFT = (CAMERA_SIZE - OVAL_WIDTH) / 2;

// // Crop Editor constants
// const EDITOR_SIZE = SCREEN_WIDTH * 0.9;
// const EDITOR_OVAL_WIDTH = EDITOR_SIZE * 0.6;
// const EDITOR_OVAL_HEIGHT = EDITOR_SIZE * 0.8;

// // ─── Theme Colors ───────────────────────────────────────────────────────────

// const THEME = {
//   bg: "#FFFFFF",
//   bgSecondary: "#F8FAFC",
//   bgCard: "#FFFFFF",
//   bgInput: "#F1F5F9",
//   border: "#E2E8F0",
//   borderLight: "#F1F5F9",
//   textPrimary: "#1E293B",
//   textSecondary: "#64748B",
//   textMuted: "#94A3B8",
//   primary: "#2563EB",
//   primaryLight: "#3B82F6",
//   primaryDark: "#1D4ED8",
//   primaryBg: "#EFF6FF",
//   primaryBgDark: "#DBEAFE",
//   success: "#10B981",
//   successBg: "#ECFDF5",
//   warning: "#F59E0B",
//   warningBg: "#FFFBEB",
//   danger: "#EF4444",
//   dangerBg: "#FEF2F2",
//   shadow: "rgba(0, 0, 0, 0.06)",
//   shadowDark: "rgba(0, 0, 0, 0.08)",
// };

// // ─── Oval Mask Overlay ──────────────────────────────────────────────────────

// function OvalMaskOverlay() {
//   return <View style={styles.ovalRing} pointerEvents="none" />;
// }

// // ─── Crop Editor Modal Component ───────────────────────────────────────────
// // Approach: fixed oval mask, user drags/zooms the IMAGE behind it.
// // This ensures what-you-see-is-what-you-get when confirming the crop.

// interface CropEditorProps {
//   visible: boolean;
//   imageUri: string;
//   onConfirm: (croppedUri: string) => void;
//   onCancel: () => void;
// }

// function CropEditor({ visible, imageUri, onConfirm, onCancel }: CropEditorProps) {
//   const [isProcessing, setIsProcessing] = useState(false);

//   // Original image pixel dimensions
//   const [originalWidth, setOriginalWidth] = useState(0);
//   const [originalHeight, setOriginalHeight] = useState(0);

//   // Display dimensions (fit image into EDITOR_SIZE, covering the oval)
//   const [displayWidth, setDisplayWidth] = useState(EDITOR_SIZE);
//   const [displayHeight, setDisplayHeight] = useState(EDITOR_SIZE);

//   // Image offset (how much the image is dragged)
//   const [imageOffsetX, setImageOffsetX] = useState(0);
//   const [imageOffsetY, setImageOffsetY] = useState(0);
//   const [scale, setScale] = useState(1);

//   // Refs to track current values in gesture handlers (avoids stale closures)
//   const offsetXRef = useRef(0);
//   const offsetYRef = useRef(0);
//   const scaleRef = useRef(1);
//   const displayWRef = useRef(EDITOR_SIZE);
//   const displayHRef = useRef(EDITOR_SIZE);
//   const gestureStartOffset = useRef({ x: 0, y: 0 });

//   // Load image dimensions
//   useEffect(() => {
//     if (imageUri) {
//       Image.getSize(
//         imageUri,
//         (w, h) => {
//           setOriginalWidth(w);
//           setOriginalHeight(h);

//           // Display size: scale to COVER the oval area (so the image is always at least as large as the oval)
//           const scaleX = EDITOR_SIZE / w;
//           const scaleY = EDITOR_SIZE / h;
//           const fitScale = Math.max(scaleX, scaleY);

//           const dw = w * fitScale;
//           const dh = h * fitScale;
//           setDisplayWidth(dw);
//           setDisplayHeight(dh);
//           displayWRef.current = dw;
//           displayHRef.current = dh;
//         },
//         (error) => console.warn('Failed to get image size:', error)
//       );
//     }
//   }, [imageUri]);

//   // Clamp helper: ensures the oval window always stays within the scaled image
//   const clampOffset = (ox: number, oy: number, currentScale: number) => {
//     const scaledW = displayWRef.current * currentScale;
//     const scaledH = displayHRef.current * currentScale;

//     // How far the image can move from center before the oval sees outside the image
//     const maxOffsetX = Math.max(0, (scaledW - EDITOR_OVAL_WIDTH) / 2);
//     const maxOffsetY = Math.max(0, (scaledH - EDITOR_OVAL_HEIGHT) / 2);

//     return {
//       x: Math.max(-maxOffsetX, Math.min(maxOffsetX, ox)),
//       y: Math.max(-maxOffsetY, Math.min(maxOffsetY, oy)),
//     };
//   };

//   // PanResponder — moves the image behind the fixed oval
//   const panResponder = useRef(
//     PanResponder.create({
//       onStartShouldSetPanResponder: () => true,
//       onMoveShouldSetPanResponder: (_, gs) =>
//         Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,
//       onPanResponderGrant: () => {
//         gestureStartOffset.current = {
//           x: offsetXRef.current,
//           y: offsetYRef.current,
//         };
//       },
//       onPanResponderMove: (_, gestureState) => {
//         const newX = gestureStartOffset.current.x + gestureState.dx;
//         const newY = gestureStartOffset.current.y + gestureState.dy;
//         const clamped = clampOffset(newX, newY, scaleRef.current);

//         offsetXRef.current = clamped.x;
//         offsetYRef.current = clamped.y;
//         setImageOffsetX(clamped.x);
//         setImageOffsetY(clamped.y);
//       },
//       onPanResponderRelease: () => {},
//     })
//   ).current;

//   const applyZoom = (newScale: number) => {
//     const clamped = clampOffset(offsetXRef.current, offsetYRef.current, newScale);
//     offsetXRef.current = clamped.x;
//     offsetYRef.current = clamped.y;
//     scaleRef.current = newScale;
//     setScale(newScale);
//     setImageOffsetX(clamped.x);
//     setImageOffsetY(clamped.y);
//   };

//   const zoomIn = () => applyZoom(Math.min(3, scale + 0.2));
//   const zoomOut = () => applyZoom(Math.max(0.5, scale - 0.2));

//   const resetPosition = () => {
//     offsetXRef.current = 0;
//     offsetYRef.current = 0;
//     scaleRef.current = 1;
//     setImageOffsetX(0);
//     setImageOffsetY(0);
//     setScale(1);
//   };

//   const handleConfirm = async () => {
//     if (originalWidth === 0 || originalHeight === 0) return;
//     setIsProcessing(true);
//     try {
//       // The image is displayed at (displayWidth * scale) x (displayHeight * scale)
//       // centered in the EDITOR_SIZE container, then offset by (imageOffsetX, imageOffsetY).
//       //
//       // The oval is fixed at the center of the container.
//       // We need to find which region of the ORIGINAL image is visible through the oval.

//       const scaledW = displayWidth * scale;
//       const scaledH = displayHeight * scale;

//       // Ratio from scaled-display pixels to original pixels
//       const ratioX = originalWidth / scaledW;
//       const ratioY = originalHeight / scaledH;

//       // The oval's top-left in container coordinates
//       const ovalLeft = (EDITOR_SIZE - EDITOR_OVAL_WIDTH) / 2;
//       const ovalTop = (EDITOR_SIZE - EDITOR_OVAL_HEIGHT) / 2;

//       // The image's top-left in container coordinates
//       // (image is centered, then shifted by offset)
//       const imgLeft = (EDITOR_SIZE - scaledW) / 2 + imageOffsetX;
//       const imgTop = (EDITOR_SIZE - scaledH) / 2 + imageOffsetY;

//       // The oval's position relative to the image's top-left (in scaled-display coords)
//       const ovalInImgX = ovalLeft - imgLeft;
//       const ovalInImgY = ovalTop - imgTop;

//       // Convert to original image pixel coordinates
//       let cropOriginX = Math.round(ovalInImgX * ratioX);
//       let cropOriginY = Math.round(ovalInImgY * ratioY);
//       let cropWidth = Math.round(EDITOR_OVAL_WIDTH * ratioX);
//       let cropHeight = Math.round(EDITOR_OVAL_HEIGHT * ratioY);

//       // Clamp to original image bounds
//       cropOriginX = Math.max(0, Math.min(cropOriginX, originalWidth - 1));
//       cropOriginY = Math.max(0, Math.min(cropOriginY, originalHeight - 1));
//       cropWidth = Math.max(10, Math.min(cropWidth, originalWidth - cropOriginX));
//       cropHeight = Math.max(10, Math.min(cropHeight, originalHeight - cropOriginY));

//       const cropRegion = {
//         originX: cropOriginX,
//         originY: cropOriginY,
//         width: cropWidth,
//         height: cropHeight,
//       };

//       const result = await ImageManipulator.manipulateAsync(
//         imageUri,
//         [
//           { crop: cropRegion },
//           { resize: { width: 800 } },
//         ],
//         { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
//       );

//       onConfirm(result.uri);
//     } catch (error) {
//       console.error('Crop error:', error);
//       Alert.alert('Error', 'Gagal memproses foto. Silakan coba lagi.');
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   // Reset state when modal opens
//   useEffect(() => {
//     if (visible) {
//       offsetXRef.current = 0;
//       offsetYRef.current = 0;
//       scaleRef.current = 1;
//       setImageOffsetX(0);
//       setImageOffsetY(0);
//       setScale(1);
//     }
//   }, [visible, imageUri]);

//   return (
//     <Modal visible={visible} animationType="slide" transparent>
//       <View style={cropStyles.modalContainer}>
//         <View style={cropStyles.header}>
//           <TouchableOpacity onPress={onCancel} style={cropStyles.headerButton}>
//             <Ionicons name="close" size={28} color="#fff" />
//           </TouchableOpacity>
//           <Text style={cropStyles.headerTitle}>Atur Posisi Wajah</Text>
//           <TouchableOpacity onPress={handleConfirm} style={cropStyles.headerButton} disabled={isProcessing}>
//             {isProcessing ? (
//               <ActivityIndicator size="small" color="#fff" />
//             ) : (
//               <Ionicons name="checkmark" size={28} color={THEME.success} />
//             )}
//           </TouchableOpacity>
//         </View>

//         <View style={cropStyles.instructionContainer}>
//           <Text style={cropStyles.instructionText}>
//             Geser foto untuk menyesuaikan posisi wajah di dalam oval
//           </Text>
//         </View>

//         <View style={cropStyles.editorContainer}>
//           <View style={cropStyles.imageWrapper} {...panResponder.panHandlers}>
//             {/* Image — draggable & zoomable behind the fixed oval */}
//             <Image
//               source={{ uri: imageUri }}
//               style={[
//                 cropStyles.fullImage,
//                 {
//                   width: displayWidth * scale,
//                   height: displayHeight * scale,
//                   left: (EDITOR_SIZE - displayWidth * scale) / 2 + imageOffsetX,
//                   top: (EDITOR_SIZE - displayHeight * scale) / 2 + imageOffsetY,
//                 },
//               ]}
//               resizeMode="stretch"
//             />

//             {/* Dark overlay with transparent oval cutout */}
//             <View style={cropStyles.overlayContainer} pointerEvents="none">
//               {/* Top dark band */}
//               <View style={cropStyles.darkBandHorizontal} />
//               {/* Middle row: left dark | oval hole | right dark */}
//               <View style={cropStyles.middleRow}>
//                 <View style={cropStyles.darkBandVertical} />
//                 <View style={cropStyles.ovalHole}>
//                   <View style={cropStyles.ovalBorder} />
//                 </View>
//                 <View style={cropStyles.darkBandVertical} />
//               </View>
//               {/* Bottom dark band */}
//               <View style={cropStyles.darkBandHorizontal} />
//             </View>
//           </View>
//         </View>

//         <View style={cropStyles.controlsContainer}>
//           <View style={cropStyles.zoomControls}>
//             <TouchableOpacity style={cropStyles.zoomButton} onPress={zoomOut}>
//               <Ionicons name="remove" size={28} color={THEME.primary} />
//             </TouchableOpacity>
//             <Text style={cropStyles.zoomLabel}>{Math.round(scale * 100)}%</Text>
//             <TouchableOpacity style={cropStyles.zoomButton} onPress={zoomIn}>
//               <Ionicons name="add" size={28} color={THEME.primary} />
//             </TouchableOpacity>
//           </View>

//           <TouchableOpacity style={cropStyles.resetButton} onPress={resetPosition}>
//             <Ionicons name="refresh" size={20} color={THEME.textSecondary} />
//             <Text style={cropStyles.resetText}>Reset</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// const OVAL_TOP_OFFSET = (EDITOR_SIZE - EDITOR_OVAL_HEIGHT) / 2;
// const OVAL_LEFT_OFFSET = (EDITOR_SIZE - EDITOR_OVAL_WIDTH) / 2;

// const cropStyles = StyleSheet.create({
//   modalContainer: {
//     flex: 1,
//     backgroundColor: '#000',
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 50,
//     paddingHorizontal: 16,
//     paddingBottom: 12,
//     backgroundColor: 'rgba(0,0,0,0.9)',
//   },
//   headerButton: {
//     width: 44,
//     height: 44,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#fff',
//   },
//   instructionContainer: {
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     backgroundColor: 'rgba(0,0,0,0.7)',
//   },
//   instructionText: {
//     fontSize: 14,
//     color: 'rgba(255,255,255,0.8)',
//     textAlign: 'center',
//   },
//   editorContainer: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     padding: 10,
//   },
//   imageWrapper: {
//     width: EDITOR_SIZE,
//     height: EDITOR_SIZE,
//     position: 'relative',
//     alignItems: 'center',
//     justifyContent: 'center',
//     overflow: 'hidden',
//     borderRadius: 12,
//   },
//   fullImage: {
//     position: 'absolute',
//   },
//   // Dark overlay pieces around the oval cutout
//   overlayContainer: {
//     ...StyleSheet.absoluteFillObject,
//   },
//   darkBandHorizontal: {
//     width: '100%',
//     height: OVAL_TOP_OFFSET,
//     backgroundColor: 'rgba(0,0,0,0.55)',
//   },
//   middleRow: {
//     flexDirection: 'row',
//     height: EDITOR_OVAL_HEIGHT,
//   },
//   darkBandVertical: {
//     width: OVAL_LEFT_OFFSET,
//     height: '100%',
//     backgroundColor: 'rgba(0,0,0,0.55)',
//   },
//   ovalHole: {
//     width: EDITOR_OVAL_WIDTH,
//     height: EDITOR_OVAL_HEIGHT,
//     borderRadius: EDITOR_OVAL_WIDTH / 2,
//     overflow: 'hidden',
//     // transparent — lets the image show through
//   },
//   ovalBorder: {
//     ...StyleSheet.absoluteFillObject,
//     borderRadius: EDITOR_OVAL_WIDTH / 2,
//     borderWidth: 3,
//     borderColor: '#fff',
//   },
//   controlsContainer: {
//     paddingHorizontal: 20,
//     paddingVertical: 20,
//     backgroundColor: 'rgba(0,0,0,0.9)',
//     borderTopWidth: 1,
//     borderTopColor: 'rgba(255,255,255,0.1)',
//   },
//   zoomControls: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 24,
//     marginBottom: 16,
//   },
//   zoomButton: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: 'rgba(255,255,255,0.15)',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   zoomLabel: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#fff',
//     minWidth: 60,
//     textAlign: 'center',
//   },
//   resetButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     backgroundColor: 'rgba(255,255,255,0.1)',
//     borderRadius: 12,
//   },
//   resetText: {
//     fontSize: 14,
//     color: THEME.textSecondary,
//     fontWeight: '500',
//   },
// });

// // ─── Main Component ────────────────────────────────────────────────────────────

// export default function RegisterFotoScreen() {
//   const { user, token } = useAuth();

//   // ── State ─────────────────────────────────────────────────────────────────
//   const [permission, requestPermission] = useCameraPermissions();
//   const [facing] = useState<CameraType>("front");
//   const [isCapturing, setIsCapturing] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [capturedImages, setCapturedImages] = useState<string[]>([]);
//   const [showPreview, setShowPreview] = useState(false);
//   const [captureAnim] = useState(new Animated.Value(1));
//   const [flashAnim] = useState(new Animated.Value(0));
//   const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
//   const [isCheckingStatus, setIsCheckingStatus] = useState(true);
//   const cameraRef = useRef<CameraView>(null);

//   // ── Crop Editor State ─────────────────────────────────────────────────────
//   const [showCropEditor, setShowCropEditor] = useState(false);
//   const [selectedImageUri, setSelectedImageUri] = useState('');

//   // ── Guided Pose State ─────────────────────────────────────────────────────
//   const [currentPoseIndex, setCurrentPoseIndex] = useState(0);

//   const currentPose = POSES[currentPoseIndex];
//   const totalRequired = POSES.length * CAPTURES_PER_POSE;
//   const allCaptured = capturedImages.length >= totalRequired;

//   // ── Reset ─────────────────────────────────────────────────────────────────
//   const resetCapture = useCallback(() => {
//     setCapturedImages([]);
//     setCurrentPoseIndex(0);
//     setShowPreview(false);
//   }, []);

//   // ── Check registration status ─────────────────────────────────────────────
//   useEffect(() => {
//     const checkRegistrationStatus = async () => {
//       if (!token || !user?.nim) {
//         setIsCheckingStatus(false);
//         return;
//       }

//       try {
//         const response = await fetch(`${API_BASE}/arcface/status/${user.nim}`, {
//           method: "GET",
//           headers: { "Authorization": `Bearer ${token}` },
//         });

//         if (response.ok || response.status === 200) {
//           const result = await response.json();
//           setIsAlreadyRegistered(result.is_registered === true);
//         } else {
//           setIsAlreadyRegistered(false);
//         }
//       } catch (error) {
//         console.warn("Gagal cek status registrasi:", error);
//         setIsAlreadyRegistered(false);
//       } finally {
//         setIsCheckingStatus(false);
//       }
//     };

//     checkRegistrationStatus();
//   }, [token, user?.nim]);

//   // ── Crop to oval region ───────────────────────────────────────────────────
//   const cropToOvalRegion = async (
//     photoUri: string,
//     photoWidth: number,
//     photoHeight: number,
//     isFront: boolean
//   ): Promise<string> => {
//     try {
//       const containerSize = CAMERA_SIZE;
//       const scale = Math.max(containerSize / photoWidth, containerSize / photoHeight);
//       const displayedWidth = photoWidth * scale;
//       const displayedHeight = photoHeight * scale;
//       const offsetX = (displayedWidth - containerSize) / 2;
//       const offsetY = (displayedHeight - containerSize) / 2;

//       let originX = (OVAL_LEFT + offsetX) / scale;
//       let originY = (OVAL_TOP + offsetY) / scale;
//       let width = OVAL_WIDTH / scale;
//       let height = OVAL_HEIGHT / scale;

//       originX = Math.max(0, Math.min(originX, photoWidth - 1));
//       originY = Math.max(0, Math.min(originY, photoHeight - 1));
//       width = Math.max(1, Math.min(width, photoWidth - originX));
//       height = Math.max(1, Math.min(height, photoHeight - originY));

//       const cropRegion = {
//         originX: Math.round(originX),
//         originY: Math.round(originY),
//         width: Math.round(width),
//         height: Math.round(height),
//       };

//       const actions: ImageManipulator.Action[] = [];
//       if (isFront) {
//         actions.push({ flip: ImageManipulator.FlipType.Horizontal });
//       }
//       actions.push({ crop: cropRegion });
//       actions.push({ resize: { width: 800 } });

//       const manipResult = await ImageManipulator.manipulateAsync(
//         photoUri,
//         actions,
//         { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
//       );

//       return manipResult.uri;
//     } catch (error) {
//       console.warn("Gagal melakukan crop oval:", error);
//       return photoUri;
//     }
//   };

//   // ── Burst capture: 1 klik = 2 foto ───────────────────────────────────────
//   const handleBurstCapture = async () => {
//     if (!cameraRef.current || isCapturing || allCaptured) return;

//     // Capture animation
//     Animated.sequence([
//       Animated.timing(captureAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
//       Animated.spring(captureAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
//     ]).start();

//     setIsCapturing(true);

//     try {
//       const newPhotos: string[] = [];

//       for (let i = 0; i < CAPTURES_PER_POSE; i++) {
//         // Flash effect
//         Animated.sequence([
//           Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
//           Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
//         ]).start();

//         const photo = await cameraRef.current.takePictureAsync({
//           quality: 0.85,
//           shutterSound: false,
//         });

//         if (photo?.uri) {
//           const croppedUri = photo.width && photo.height
//             ? await cropToOvalRegion(photo.uri, photo.width, photo.height, facing === "front")
//             : photo.uri;

//           newPhotos.push(croppedUri);
//           Vibration.vibrate(30);
//         }

//         // Jeda singkat antara 2 foto burst
//         if (i < CAPTURES_PER_POSE - 1) {
//           await new Promise(resolve => setTimeout(resolve, 400));
//         }
//       }

//       // Update state
//       setCapturedImages(prev => [...prev, ...newPhotos]);

//       // Pindah ke pose berikutnya atau selesai
//       if (currentPoseIndex < POSES.length - 1) {
//         setCurrentPoseIndex(prev => prev + 1);
//       }
//       // Jika ini pose terakhir, allCaptured akan jadi true di render berikutnya

//     } catch (error) {
//       Alert.alert("Error", "Gagal mengambil foto. Silakan coba lagi.");
//     } finally {
//       setIsCapturing(false);
//     }
//   };

//   const handleRetake = () => {
//     resetCapture();
//   };

//   // ── Handle Delete ─────────────────────────────────────────────────────────
//   const handleDelete = async () => {
//     if (!user?.nim || !token) {
//       Alert.alert("Error", "Silakan login terlebih dahulu.");
//       return;
//     }

//     Alert.alert(
//       "Hapus Registrasi?",
//       `Apakah Anda yakin ingin menghapus data wajah untuk NIM ${user.nim}? Anda perlu registrasi ulang di kemudian hari.`,
//       [
//         { text: "Batal", style: "cancel" },
//         {
//           text: "Hapus",
//           style: "destructive",
//           onPress: async () => {
//             try {
//               const response = await fetch(`${API_BASE}/arcface/delete/${user.nim}`, {
//                 method: "DELETE",
//                 headers: { "Authorization": `Bearer ${token}` },
//               });
//               const result = await response.json();
//               if (result.success) {
//                 setIsAlreadyRegistered(false);
//                 Alert.alert("Berhasil", "Data wajah berhasil dihapus.");
//               } else {
//                 Alert.alert("Gagal", result.message || "Gagal menghapus data wajah.");
//               }
//             } catch (error) {
//               Alert.alert("Error", "Terjadi kesalahan koneksi.");
//             }
//           },
//         },
//       ]
//     );
//   };

//   // ── Handle Confirm / Submit ───────────────────────────────────────────────
//   const handleConfirm = async () => {
//     if (capturedImages.length === 0) {
//       Alert.alert("Error", "Tidak ada foto yang akan dikirim.");
//       return;
//     }

//     if (!user?.nim) {
//       Alert.alert("Error", "Silakan login terlebih dahulu untuk melakukan registrasi wajah.");
//       return;
//     }

//     if (isAlreadyRegistered) {
//       Alert.alert(
//         "Perbarui Foto?",
//         `Wajah Anda sudah terdaftar. Foto lama akan ditimpa dengan foto baru.\n\nApakah ingin melanjutkan?`,
//         [
//           { text: "Batal", style: "cancel" },
//           { text: "Lanjutkan", onPress: () => performEnrollment(true) },
//         ]
//       );
//     } else {
//       performEnrollment(false);
//     }
//   };

//   const performEnrollment = async (forceUpdate: boolean) => {
//     setIsSubmitting(true);

//     try {
//       const photosBase64: string[] = [];
//       for (const photoUri of capturedImages) {
//         const base64Response = await fetch(photoUri);
//         const blob = await base64Response.blob();
//         const reader = new FileReader();
//         const base64 = await new Promise<string>((resolve, reject) => {
//           reader.onloadend = () => resolve(reader.result as string);
//           reader.onerror = () => reject(new Error("Failed to read image"));
//           reader.readAsDataURL(blob);
//         });
//         photosBase64.push(base64);
//       }

//       const response = await fetch(`${API_BASE}/arcface/enroll`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "Authorization": `Bearer ${token}`,
//         },
//         body: JSON.stringify({
//           nim: user!.nim,
//           foto_base64: photosBase64,
//           force_update: forceUpdate,
//         }),
//       });

//       const result = await response.json();

//       if (result.success) {
//         setIsAlreadyRegistered(true);
//         Alert.alert(
//           forceUpdate ? "Berhasil Diperbarui! 🎉" : "Berhasil! 🎉",
//           forceUpdate
//             ? `Wajah ${user!.nama_mahasiswa || user!.name} (${user!.nim}) berhasil diperbarui!\n\nData lama telah ditimpa.`
//             : `Wajah ${user!.nama_mahasiswa || user!.name} (${user!.nim}) berhasil terdaftar!\n\nEmbedding tersimpan di: face_mahasiswa/${user!.nim}/`,
//           [{ text: "OK", onPress: handleRetake }]
//         );
//       } else {
//         if (result.message?.includes("sudah ter-enroll")) {
//           if (forceUpdate) {
//             setIsAlreadyRegistered(true);
//             Alert.alert(
//               "Berhasil Diperbarui! 🎉",
//               `Wajah ${user!.nama_mahasiswa || user!.name} (${user!.nim}) berhasil diperbarui!\n\nData lama telah ditimpa.`,
//               [{ text: "OK", onPress: handleRetake }]
//             );
//           } else {
//             Alert.alert(
//               "Info",
//               "Wajah Anda sudah terdaftar sebelumnya.\n\nJika ingin memperbarui foto, silakan ambil foto baru dan pilih 'Perbarui'.",
//               [{ text: "OK", onPress: handleRetake }]
//             );
//           }
//         } else if (result.message?.includes("ArcFace model")) {
//           Alert.alert(
//             "Model Error",
//             "Sistem Face Recognition belum siap. Hubungi admin untuk mengaktifkan model ArcFace.",
//             [{ text: "OK" }]
//           );
//         } else {
//           Alert.alert("Gagal", result.message || "Gagal menyimpan foto wajah.");
//         }
//       }
//     } catch (error) {
//       console.error("Enrollment error:", error);
//       Alert.alert("Error", "Gagal mengirim foto. Periksa koneksi internet dan coba lagi.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   // ─── Render: Permission Loading ───────────────────────────────────────────

//   if (!permission) {
//     return (
//       <View style={styles.container}>
//         <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
//         <View style={styles.loadingContainer}>
//           <Ionicons name="hourglass-outline" size={32} color={THEME.primary} />
//           <Text style={styles.loadingText}>Memuat kamera...</Text>
//         </View>
//       </View>
//     );
//   }

//   if (!permission.granted) {
//     return (
//       <View style={styles.container}>
//         <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
//         <View style={styles.permissionContainer}>
//           <View style={styles.permissionCard}>
//             <View style={styles.permissionIconBg}>
//               <Ionicons name="camera" size={48} color={THEME.primary} />
//             </View>
//             <Text style={styles.permissionTitle}>Izinkan Akses Kamera</Text>
//             <Text style={styles.permissionDesc}>
//               Kami membutuhkan akses kamera untuk mengambil foto wajah Anda untuk verifikasi kehadiran.
//             </Text>
//             <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
//               <LinearGradient
//                 colors={[THEME.primary, THEME.primaryLight]}
//                 style={styles.permissionButtonGradient}
//               >
//                 <Ionicons name="camera-outline" size={20} color="#fff" />
//                 <Text style={styles.permissionButtonText}>Izinkan Kamera</Text>
//               </LinearGradient>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </View>
//     );
//   }

//   // ─── Render: Main Screen ─────────────────────────────────────────────────

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />

//       {/* Header */}
//       <View style={styles.header}>
//         <View style={styles.headerLeft}>
//           <View style={styles.headerIconContainer}>
//             <Ionicons name="person-add" size={22} color={THEME.primary} />
//           </View>
//           <View>
//             <Text style={styles.headerTitle}>
//               {isAlreadyRegistered ? "Update Wajah" : "Register Wajah"}
//             </Text>
//             <Text style={styles.headerSubtitle}>
//               {isCheckingStatus
//                 ? "Memuat..."
//                 : isAlreadyRegistered
//                   ? "✓ Sudah terdaftar"
//                   : "Ambil foto untuk verifikasi"}
//             </Text>
//           </View>
//         </View>
//         <View style={styles.headerRightButtons}>
//           {/* Gallery Button - Select one by one with crop editor */}
//           <TouchableOpacity
//             style={styles.iconButton}
//             onPress={async () => {
//               if (allCaptured || showPreview) return;

//               const remaining = totalRequired - capturedImages.length;
//               if (remaining <= 0) return;

//               try {
//                 const result = await ImagePicker.launchImageLibraryAsync({
//                   mediaTypes: ["images"],
//                   allowsMultipleSelection: false,
//                   quality: 1,
//                 });

//                 if (!result.canceled && result.assets.length > 0) {
//                   const selectedPhoto = result.assets[0];
//                   setSelectedImageUri(selectedPhoto.uri);
//                   setShowCropEditor(true);
//                 }
//               } catch (err) {
//                 Alert.alert("Error", "Gagal memilih gambar dari galeri");
//               }
//             }}
//           >
//             <Ionicons name="images-outline" size={22} color={THEME.primary} />
//           </TouchableOpacity>
//           {/* Delete Button */}
//           {isAlreadyRegistered && (
//             <TouchableOpacity
//               style={[styles.iconButton, styles.deleteButton]}
//               onPress={handleDelete}
//             >
//               <Ionicons name="trash-outline" size={22} color={THEME.danger} />
//             </TouchableOpacity>
//           )}
//         </View>
//       </View>

//       {/* Scrollable body */}
//       <ScrollView
//         style={styles.scrollView}
//         contentContainerStyle={styles.scrollContent}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Pose guide — DI ATAS oval, tidak menghalangi wajah */}
//         {!showPreview && !allCaptured && (
//           <View style={styles.poseGuideAbove}>
//             <View style={[styles.poseGuideBox, { borderColor: currentPose.color }]}>
//               <Text style={styles.poseIcon}>{currentPose.icon}</Text>
//               <Text style={styles.poseLabel}>{currentPose.label}</Text>
//               <Text style={styles.poseDesc}>{currentPose.description}</Text>
//             </View>
//           </View>
//         )}

//         {/* Camera wrapper */}
//         <View style={styles.cameraWrapper}>
//           <View style={styles.ovalClip}>
//             {(showPreview || allCaptured) && capturedImages.length > 0 ? (
//               /* Tampilkan foto depan (pertama) sebagai preview utama di oval */
//               <Image
//                 source={{ uri: capturedImages[0] }}
//                 style={styles.previewImage}
//                 resizeMode="cover"
//               />
//             ) : (
//               <>
//                 <CameraView
//                   ref={cameraRef}
//                   style={styles.cameraInner}
//                   facing={facing}
//                   mute={true}
//                 />
//                 {/* Flash overlay */}
//                 <Animated.View
//                   style={[styles.flashOverlay, { opacity: flashAnim }]}
//                   pointerEvents="none"
//                 />
//               </>
//             )}
//           </View>

//           {!showPreview && !allCaptured && <OvalMaskOverlay />}

//           {(showPreview || allCaptured) && (
//             <View style={styles.previewBadge}>
//               <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
//               <Text style={styles.previewBadgeText}>
//                 {allCaptured ? `${capturedImages.length} foto selesai` : "Foto Tertangkap"}
//               </Text>
//             </View>
//           )}
//         </View>

//         {/* Thumbnails — di bawah oval, tampilkan semua foto kecil-kecil */}
//         {capturedImages.length > 0 && (showPreview || allCaptured) && (
//           <View style={styles.thumbnailRow}>
//             {capturedImages.map((uri, idx) => (
//               <View key={idx} style={styles.thumbnailWrapper}>
//                 <Image source={{ uri }} style={styles.thumbnailBelow} />
//                 <Text style={styles.thumbnailLabel}>
//                   {idx < 2 ? 'Depan' : idx < 4 ? 'Kanan' : 'Kiri'} {(idx % 2) + 1}
//                 </Text>
//               </View>
//             ))}
//           </View>
//         )}

//         {/* Pose progress stepper */}
//         <View style={styles.stepperContainer}>
//           {POSES.map((pose, idx) => {
//             const isDone = idx < currentPoseIndex || (idx === currentPoseIndex && allCaptured);
//             const isCurrent = idx === currentPoseIndex && !allCaptured;
//             return (
//               <View key={pose.id} style={styles.stepperItem}>
//                 <View style={[
//                   styles.stepperDot,
//                   isDone && { backgroundColor: THEME.success },
//                   isCurrent && { backgroundColor: pose.color, transform: [{ scale: 1.3 }] },
//                   !isDone && !isCurrent && { backgroundColor: THEME.border },
//                 ]}>
//                   {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
//                 </View>
//                 <Text style={[
//                   styles.stepperLabel,
//                   isCurrent && { color: pose.color, fontWeight: '700' },
//                   isDone && { color: THEME.success },
//                 ]}>{pose.label.replace('Hadap ', '')}</Text>
//                 {idx < POSES.length - 1 && (
//                   <View style={[styles.stepperLine, isDone && { backgroundColor: THEME.success }]} />
//                 )}
//               </View>
//             );
//           })}
//         </View>

//         {/* Status badge */}
//         <View style={styles.statusWrapper}>
//           <View style={[
//             styles.statusBadge,
//             allCaptured || showPreview
//               ? { borderColor: `${THEME.success}40`, backgroundColor: `${THEME.success}12` }
//               : { borderColor: `${currentPose.color}40`, backgroundColor: `${currentPose.color}12` },
//           ]}>
//             <View style={[styles.statusDot, { backgroundColor: allCaptured || showPreview ? THEME.success : currentPose.color }]} />
//             <Text style={[styles.statusText, { color: allCaptured || showPreview ? THEME.success : currentPose.color }]}>
//               {showPreview
//                 ? `${capturedImages.length} foto siap dikirim`
//                 : allCaptured
//                   ? "Semua pose selesai! Ketuk untuk simpan"
//                   : isCapturing
//                     ? "📸 Mengambil 2 foto..."
//                     : `${currentPose.label} — Ketuk tombol untuk ambil foto`}
//             </Text>
//           </View>
//         </View>

//         {/* Instructions */}
//         <View style={styles.infoPanel}>
//           <View style={styles.infoPanelRow}>
//             <Ionicons name="camera-outline" size={16} color={THEME.primary} />
//             <Text style={styles.infoPanelText}>
//               {showPreview || allCaptured
//                 ? "6 foto siap dikirim ke server"
//                 : "Tekan tombol kamera atau galeri untuk ambil foto"}
//             </Text>
//           </View>
//           <View style={styles.infoPanelRow}>
//             <Ionicons name="images-outline" size={16} color={THEME.primary} />
//             <Text style={styles.infoPanelText}>
//               Tombol galeri: pilih foto satu per satu, di-crop otomatis sesuai oval
//             </Text>
//           </View>
//           <View style={styles.infoPanelRow}>
//             <Ionicons name="swap-horizontal-outline" size={16} color={THEME.textMuted} />
//             <Text style={styles.infoPanelText}>
//               {allCaptured ? 'Semua 3 pose sudah diambil' : `Langkah ${currentPoseIndex + 1}/3: ${currentPose.description}`}
//             </Text>
//           </View>
//           <View style={styles.infoPanelRow}>
//             <Ionicons name="close-circle-outline" size={16} color={THEME.textMuted} />
//             <Text style={styles.infoPanelText}>Lepas kacamata, topi, atau masker</Text>
//           </View>
//         </View>
//       </ScrollView>

//       {/* Bottom Action — fixed */}
//       <View style={styles.captureSection}>
//         {showPreview ? (
//           <View style={styles.previewActions}>
//             <TouchableOpacity style={styles.retakeButton} onPress={handleRetake} activeOpacity={0.8}>
//               <Ionicons name="refresh" size={22} color={THEME.primary} />
//               <Text style={styles.retakeButtonText}>Ulangi</Text>
//             </TouchableOpacity>

//             <Animated.View style={{ transform: [{ scale: captureAnim }] }}>
//               <TouchableOpacity
//                 style={styles.confirmButton}
//                 onPress={handleConfirm}
//                 disabled={isSubmitting}
//                 activeOpacity={0.85}
//               >
//                 <LinearGradient
//                   colors={isSubmitting ? [THEME.textMuted, THEME.textSecondary] : [THEME.success, "#059669"]}
//                   style={styles.confirmButtonGradient}
//                 >
//                   {isSubmitting ? (
//                     <>
//                       <ActivityIndicator size="small" color="#fff" />
//                       <Text style={styles.confirmButtonText}>Mengirim...</Text>
//                     </>
//                   ) : (
//                     <>
//                       <Ionicons name="checkmark" size={24} color="#fff" />
//                       <Text style={styles.confirmButtonText}>Simpan {capturedImages.length} Foto</Text>
//                     </>
//                   )}
//                 </LinearGradient>
//               </TouchableOpacity>
//             </Animated.View>
//           </View>
//         ) : (
//           <View style={styles.captureContainer}>
//             <Animated.View style={{ transform: [{ scale: captureAnim }] }}>
//               <TouchableOpacity
//                 style={[styles.captureButtonOuter]}
//                 onPress={allCaptured ? () => setShowPreview(true) : handleBurstCapture}
//                 disabled={isCapturing}
//                 activeOpacity={0.85}
//               >
//                 <LinearGradient
//                   colors={
//                     isCapturing
//                       ? ["#E2E8F0", "#E2E8F0"]
//                       : allCaptured
//                         ? [THEME.success, "#059669"]
//                         : [currentPose.color, currentPose.color + "CC"]
//                   }
//                   style={styles.captureButton}
//                 >
//                   {isCapturing ? (
//                     <ActivityIndicator size="large" color={THEME.textMuted} />
//                   ) : allCaptured ? (
//                     <Ionicons name="checkmark" size={28} color="#fff" />
//                   ) : (
//                     <Ionicons name="camera" size={28} color="#fff" />
//                   )}
//                 </LinearGradient>
//                 <View style={[
//                   styles.captureRing,
//                   { borderColor: allCaptured ? THEME.success : currentPose.color },
//                   allCaptured && { opacity: 1 },
//                 ]} />
//               </TouchableOpacity>
//             </Animated.View>
//             <Text style={styles.captureHintBottom}>
//               {isCapturing
//                 ? "Mengambil 2 foto..."
//                 : allCaptured
//                   ? `${capturedImages.length} foto — Ketuk untuk preview`
//                   : `Ketuk untuk ambil foto ${currentPose.label}`}
//             </Text>
//           </View>
//         )}
//       </View>

//       {/* Crop Editor Modal */}
//       <CropEditor
//         visible={showCropEditor}
//         imageUri={selectedImageUri}
//         onConfirm={(croppedUri) => {
//           setShowCropEditor(false);
//           setCapturedImages(prev => [...prev, croppedUri]);

//           const newCount = capturedImages.length + 1;
//           const nextPose = Math.floor(newCount / CAPTURES_PER_POSE);

//           // Update pose index
//           if (newCount % CAPTURES_PER_POSE === 0 && nextPose < POSES.length) {
//             setCurrentPoseIndex(Math.min(nextPose, POSES.length - 1));
//           }

//           // If all 6 photos, go to preview
//           if (newCount >= totalRequired) {
//             setShowPreview(true);
//             setCurrentPoseIndex(POSES.length - 1);
//           }
//         }}
//         onCancel={() => {
//           setShowCropEditor(false);
//           setSelectedImageUri('');
//         }}
//       />
//     </View>
//   );
// }

// // ─── Styles ─────────────────────────────────────────────────────────────────

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: THEME.bg,
//   },

//   // ─── Header ───────────────────────────────────────────────────────────────

//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 10 : 55,
//     paddingHorizontal: 20,
//     paddingBottom: 14,
//     backgroundColor: THEME.bg,
//     borderBottomWidth: 1,
//     borderBottomColor: THEME.border,
//   },
//   headerLeft: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 12,
//   },
//   headerIconContainer: {
//     width: 42,
//     height: 42,
//     borderRadius: 12,
//     backgroundColor: THEME.primaryBg,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: "800",
//     color: THEME.textPrimary,
//     letterSpacing: 0.2,
//   },
//   headerSubtitle: {
//     fontSize: 12,
//     color: THEME.primary,
//     marginTop: 1,
//   },
//   headerRightButtons: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },
//   iconButton: {
//     width: 42,
//     height: 42,
//     borderRadius: 12,
//     backgroundColor: THEME.bgInput,
//     alignItems: "center",
//     justifyContent: "center",
//     borderWidth: 1,
//     borderColor: THEME.border,
//   },
//   deleteButton: {
//     borderColor: `${THEME.danger}40`,
//     backgroundColor: `${THEME.danger}10`,
//   },

//   // ─── Scroll body ──────────────────────────────────────────────────────────

//   scrollView: {
//     flex: 1,
//   },
//   scrollContent: {
//     alignItems: "center",
//     paddingTop: 16,
//     paddingBottom: 160,
//   },

//   // ─── Camera area ──────────────────────────────────────────────────────────

//   cameraWrapper: {
//     alignSelf: "center",
//     width: CAMERA_SIZE,
//     height: CAMERA_SIZE,
//     position: "relative",
//     borderRadius: 24,
//     backgroundColor: "#FFFFFF",
//   },
//   ovalClip: {
//     position: "absolute",
//     top: OVAL_TOP,
//     left: OVAL_LEFT,
//     width: OVAL_WIDTH,
//     height: OVAL_HEIGHT,
//     borderRadius: OVAL_WIDTH / 2,
//     overflow: "hidden",
//     backgroundColor: THEME.bgSecondary,
//   },
//   cameraInner: {
//     position: "absolute",
//     top: -OVAL_TOP,
//     left: -OVAL_LEFT,
//     width: CAMERA_SIZE,
//     height: CAMERA_SIZE,
//   },
//   previewImage: {
//     width: "100%",
//     height: "100%",
//   },
//   ovalRing: {
//     position: "absolute",
//     top: OVAL_TOP,
//     left: OVAL_LEFT,
//     width: OVAL_WIDTH,
//     height: OVAL_HEIGHT,
//     borderRadius: OVAL_WIDTH / 2,
//     borderWidth: 3,
//     borderColor: "#FFFFFF",
//     zIndex: 10,
//   },
//   flashOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     backgroundColor: "#FFFFFF",
//     zIndex: 12,
//   },

//   // ─── Pose guide (above oval) ────────────────────────────────────────────────

//   poseGuideAbove: {
//     alignItems: "center",
//     marginBottom: 12,
//   },
//   poseGuideBox: {
//     backgroundColor: "rgba(0,0,0,0.82)",
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     borderRadius: 16,
//     alignItems: "center",
//     borderWidth: 2,
//     gap: 3,
//   },
//   poseIcon: {
//     fontSize: 26,
//   },
//   poseLabel: {
//     fontSize: 16,
//     fontWeight: "700",
//     color: "#FFFFFF",
//   },
//   poseDesc: {
//     fontSize: 12,
//     color: "rgba(255,255,255,0.75)",
//   },

//   // ─── Preview badge ────────────────────────────────────────────────────────

//   previewBadge: {
//     position: "absolute",
//     top: 12,
//     right: 12,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     backgroundColor: "rgba(255,255,255,0.95)",
//     paddingHorizontal: 10,
//     paddingVertical: 5,
//     borderRadius: 20,
//     borderWidth: 1,
//     borderColor: THEME.border,
//     zIndex: 20,
//   },
//   previewBadgeText: {
//     fontSize: 11,
//     fontWeight: "600",
//     color: THEME.success,
//   },

//   // ─── Thumbnail row (below oval) ───────────────────────────────────────────

//   thumbnailRow: {
//     flexDirection: "row",
//     justifyContent: "center",
//     flexWrap: "wrap",
//     gap: 10,
//     marginTop: 14,
//     paddingHorizontal: 20,
//   },
//   thumbnailWrapper: {
//     alignItems: "center",
//     gap: 4,
//   },
//   thumbnailBelow: {
//     width: 52,
//     height: 64,
//     borderRadius: 10,
//     borderWidth: 2,
//     borderColor: THEME.border,
//   },
//   thumbnailLabel: {
//     fontSize: 9,
//     fontWeight: "600",
//     color: THEME.textMuted,
//   },

//   // ─── Stepper ──────────────────────────────────────────────────────────────

//   stepperContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     marginTop: 16,
//     paddingHorizontal: 16,
//   },
//   stepperItem: {
//     alignItems: "center",
//     flexDirection: "row",
//     gap: 4,
//   },
//   stepperDot: {
//     width: 22,
//     height: 22,
//     borderRadius: 11,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   stepperLabel: {
//     fontSize: 10,
//     color: THEME.textMuted,
//     fontWeight: "500",
//     marginRight: 2,
//   },
//   stepperLine: {
//     width: 16,
//     height: 2,
//     backgroundColor: THEME.border,
//     marginHorizontal: 2,
//     borderRadius: 1,
//   },

//   // ─── Status badge ─────────────────────────────────────────────────────────

//   statusWrapper: {
//     alignItems: "center",
//     marginTop: 12,
//     paddingHorizontal: 24,
//   },
//   statusBadge: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 18,
//     paddingVertical: 9,
//     borderRadius: 50,
//     borderWidth: 1,
//     gap: 8,
//   },
//   statusDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//   },
//   statusText: {
//     fontSize: 13,
//     fontWeight: "600",
//   },

//   // ─── Info panel ───────────────────────────────────────────────────────────

//   infoPanel: {
//     marginHorizontal: 20,
//     marginTop: 14,
//     width: CAMERA_SIZE,
//     backgroundColor: THEME.bgCard,
//     borderRadius: 16,
//     padding: 14,
//     borderWidth: 1,
//     borderColor: THEME.border,
//     gap: 10,
//   },
//   infoPanelRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },
//   infoPanelText: {
//     fontSize: 13,
//     color: THEME.textSecondary,
//     flex: 1,
//     lineHeight: 18,
//   },

//   // ─── Bottom capture section ───────────────────────────────────────────────

//   captureSection: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     alignItems: "center",
//     paddingTop: 16,
//     paddingBottom: Platform.OS === "android" ? 20 : 32,
//     backgroundColor: THEME.bg,
//     borderTopWidth: 1,
//     borderTopColor: THEME.border,
//   },
//   captureContainer: {
//     alignItems: "center",
//     gap: 10,
//   },
//   captureButtonOuter: {
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   captureButton: {
//     width: 72,
//     height: 72,
//     borderRadius: 36,
//     alignItems: "center",
//     justifyContent: "center",
//     shadowColor: THEME.primary,
//     shadowOffset: { width: 0, height: 6 },
//     shadowOpacity: 0.4,
//     shadowRadius: 16,
//     elevation: 8,
//   },
//   captureRing: {
//     position: "absolute",
//     width: 86,
//     height: 86,
//     borderRadius: 43,
//     borderWidth: 2.5,
//     opacity: 0.25,
//   },
//   captureHintBottom: {
//     fontSize: 13,
//     color: THEME.textSecondary,
//     fontWeight: "500",
//   },

//   // ─── Preview actions ──────────────────────────────────────────────────────

//   previewActions: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 16,
//   },
//   retakeButton: {
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 4,
//     width: 68,
//     height: 68,
//     borderRadius: 34,
//     backgroundColor: THEME.bgInput,
//     borderWidth: 2,
//     borderColor: THEME.border,
//   },
//   retakeButtonText: {
//     fontSize: 11,
//     fontWeight: "600",
//     color: THEME.primary,
//   },
//   confirmButton: {
//     borderRadius: 40,
//     overflow: "hidden",
//     shadowColor: THEME.success,
//     shadowOffset: { width: 0, height: 6 },
//     shadowOpacity: 0.35,
//     shadowRadius: 16,
//     elevation: 8,
//   },
//   confirmButtonGradient: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 8,
//     paddingHorizontal: 28,
//     paddingVertical: 18,
//     borderRadius: 40,
//   },
//   confirmButtonText: {
//     fontSize: 15,
//     fontWeight: "700",
//     color: "#fff",
//   },

//   // ─── Permission screen ────────────────────────────────────────────────────

//   permissionContainer: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     padding: 24,
//   },
//   permissionCard: {
//     alignItems: "center",
//     backgroundColor: THEME.bgCard,
//     borderRadius: 24,
//     padding: 32,
//     borderWidth: 1,
//     borderColor: THEME.border,
//     width: "100%",
//     maxWidth: 340,
//     shadowColor: THEME.shadowDark,
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 1,
//     shadowRadius: 16,
//     elevation: 4,
//   },
//   permissionIconBg: {
//     width: 96,
//     height: 96,
//     borderRadius: 48,
//     backgroundColor: THEME.primaryBg,
//     alignItems: "center",
//     justifyContent: "center",
//     marginBottom: 20,
//   },
//   permissionTitle: {
//     fontSize: 20,
//     fontWeight: "700",
//     color: THEME.textPrimary,
//     marginBottom: 12,
//     textAlign: "center",
//   },
//   permissionDesc: {
//     fontSize: 14,
//     color: THEME.textSecondary,
//     textAlign: "center",
//     lineHeight: 22,
//     marginBottom: 28,
//     paddingHorizontal: 8,
//   },
//   permissionButton: {
//     borderRadius: 14,
//     overflow: "hidden",
//     width: "100%",
//   },
//   permissionButtonGradient: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 10,
//     paddingVertical: 16,
//     borderRadius: 14,
//   },
//   permissionButtonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "700",
//   },

//   // ─── Loading ───────────────────────────────────────────────────────────────

//   loadingContainer: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 16,
//   },
//   loadingText: {
//     fontSize: 14,
//     color: THEME.textSecondary,
//   },
// });


import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  Image,
  ScrollView,
  ActivityIndicator,
  Vibration,
  Modal,
  PanResponder,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/constants/config";

// ─── Pose Types ─────────────────────────────────────────────────────────────

type PoseType = 'center' | 'right' | 'left';

interface PoseConfig {
  id: PoseType;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const POSES: PoseConfig[] = [
  { id: 'center', label: 'Hadap Depan', icon: '👤', description: 'Lihat kamera secara langsung', color: '#2563EB' },
  { id: 'right', label: 'Hadap Kanan', icon: '👉', description: 'Putar kepala ke kanan ~30°', color: '#8B5CF6' },
  { id: 'left', label: 'Hadap Kiri', icon: '👈', description: 'Putar kepala ke kiri ~30°', color: '#EC4899' },
];

const CAPTURES_PER_POSE = 2; // burst: 2 foto per klik

// ─── Constants ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CAMERA_SIZE = SCREEN_WIDTH * 0.85;
const OVAL_WIDTH = CAMERA_SIZE * 0.55;
const OVAL_HEIGHT = CAMERA_SIZE * 0.75;
const OVAL_TOP = (CAMERA_SIZE - OVAL_HEIGHT) / 2;
const OVAL_LEFT = (CAMERA_SIZE - OVAL_WIDTH) / 2;

// Crop Editor constants
const EDITOR_SIZE = SCREEN_WIDTH * 0.9;
const EDITOR_OVAL_WIDTH = EDITOR_SIZE * 0.6;
const EDITOR_OVAL_HEIGHT = EDITOR_SIZE * 0.8;

// ─── Theme Colors ───────────────────────────────────────────────────────────

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
  primaryBgDark: "#DBEAFE",
  success: "#10B981",
  successBg: "#ECFDF5",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  shadow: "rgba(0, 0, 0, 0.06)",
  shadowDark: "rgba(0, 0, 0, 0.08)",
};

// ─── Oval Mask Overlay ──────────────────────────────────────────────────────

function OvalMaskOverlay() {
  return <View style={styles.ovalRing} pointerEvents="none" />;
}

// ─── Crop Editor Modal Component ───────────────────────────────────────────
// Approach: fixed oval mask, user drags/zooms the IMAGE behind it.
// This ensures what-you-see-is-what-you-get when confirming the crop.

interface CropEditorProps {
  visible: boolean;
  imageUri: string;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
}

function CropEditor({ visible, imageUri, onConfirm, onCancel }: CropEditorProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Original image pixel dimensions
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  // Display dimensions. The image uses COVER behavior so the oval is always filled.
  const [displayWidth, setDisplayWidth] = useState(EDITOR_SIZE);
  const [displayHeight, setDisplayHeight] = useState(EDITOR_SIZE);

  // Image offset from the centered position
  const [imageOffsetX, setImageOffsetX] = useState(0);
  const [imageOffsetY, setImageOffsetY] = useState(0);
  const [scale, setScale] = useState(1);

  // IMPORTANT: refs are the single source of truth for gesture/crop values.
  // Using React state directly during handleConfirm can read one render behind
  // when the user presses the check button immediately after dragging.
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const scaleRef = useRef(1);
  const displayWRef = useRef(EDITOR_SIZE);
  const displayHRef = useRef(EDITOR_SIZE);
  const gestureStartOffset = useRef({ x: 0, y: 0 });

  // Load the original image dimensions and calculate the initial COVER size.
  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(
      imageUri,
      (w, h) => {
        setOriginalWidth(w);
        setOriginalHeight(h);

        const fitScale = Math.max(
          EDITOR_SIZE / w,
          EDITOR_SIZE / h
        );

        const dw = w * fitScale;
        const dh = h * fitScale;

        setDisplayWidth(dw);
        setDisplayHeight(dh);
        displayWRef.current = dw;
        displayHRef.current = dh;
      },
      (error) => console.warn("Failed to get image size:", error)
    );
  }, [imageUri]);

  // Keep the oval completely inside the displayed image.
  const clampOffset = useCallback(
    (ox: number, oy: number, currentScale: number) => {
      const scaledW = displayWRef.current * currentScale;
      const scaledH = displayHRef.current * currentScale;

      const maxOffsetX = Math.max(
        0,
        (scaledW - EDITOR_OVAL_WIDTH) / 2
      );
      const maxOffsetY = Math.max(
        0,
        (scaledH - EDITOR_OVAL_HEIGHT) / 2
      );

      return {
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, ox)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, oy)),
      };
    },
    []
  );

  // PanResponder moves the image behind the fixed oval.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,

      onPanResponderGrant: () => {
        gestureStartOffset.current = {
          x: offsetXRef.current,
          y: offsetYRef.current,
        };
      },

      onPanResponderMove: (_, gestureState) => {
        const newX =
          gestureStartOffset.current.x + gestureState.dx;
        const newY =
          gestureStartOffset.current.y + gestureState.dy;

        const clamped = clampOffset(
          newX,
          newY,
          scaleRef.current
        );

        // Update refs FIRST. These values are used by handleConfirm.
        offsetXRef.current = clamped.x;
        offsetYRef.current = clamped.y;

        // State is only for rendering.
        setImageOffsetX(clamped.x);
        setImageOffsetY(clamped.y);
      },

      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  const applyZoom = useCallback(
    (newScale: number) => {
      const safeScale = Math.max(1, Math.min(3, newScale));

      const clamped = clampOffset(
        offsetXRef.current,
        offsetYRef.current,
        safeScale
      );

      offsetXRef.current = clamped.x;
      offsetYRef.current = clamped.y;
      scaleRef.current = safeScale;

      setImageOffsetX(clamped.x);
      setImageOffsetY(clamped.y);
      setScale(safeScale);
    },
    [clampOffset]
  );

  const zoomIn = () => {
    applyZoom(scaleRef.current + 0.2);
  };

  const zoomOut = () => {
    applyZoom(scaleRef.current - 0.2);
  };

  const resetPosition = () => {
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    scaleRef.current = 1;

    setImageOffsetX(0);
    setImageOffsetY(0);
    setScale(1);
  };

  const handleConfirm = async () => {
    if (originalWidth <= 0 || originalHeight <= 0) {
      Alert.alert("Error", "Ukuran foto belum siap. Silakan coba lagi.");
      return;
    }

    setIsProcessing(true);

    try {
      // ================================================================
      // IMPORTANT:
      // Read ALL current gesture values from refs, not React state.
      // This prevents the crop from using an older position when the
      // user presses ✓ immediately after dragging/zooming.
      // ================================================================
      const currentOffsetX = offsetXRef.current;
      const currentOffsetY = offsetYRef.current;
      const currentScale = scaleRef.current;
      const currentDisplayWidth = displayWRef.current;
      const currentDisplayHeight = displayHRef.current;

      const scaledWidth = currentDisplayWidth * currentScale;
      const scaledHeight = currentDisplayHeight * currentScale;

      // Fixed oval position inside the editor.
      const ovalLeft =
        (EDITOR_SIZE - EDITOR_OVAL_WIDTH) / 2;
      const ovalTop =
        (EDITOR_SIZE - EDITOR_OVAL_HEIGHT) / 2;

      // Current image top-left inside the editor.
      const imageLeft =
        (EDITOR_SIZE - scaledWidth) / 2 + currentOffsetX;
      const imageTop =
        (EDITOR_SIZE - scaledHeight) / 2 + currentOffsetY;

      // Oval position relative to the image.
      const cropXOnDisplay = ovalLeft - imageLeft;
      const cropYOnDisplay = ovalTop - imageTop;

      // Convert displayed pixels back to ORIGINAL image pixels.
      const originalPerDisplayX =
        originalWidth / scaledWidth;
      const originalPerDisplayY =
        originalHeight / scaledHeight;

      let cropOriginX = Math.round(
        cropXOnDisplay * originalPerDisplayX
      );
      let cropOriginY = Math.round(
        cropYOnDisplay * originalPerDisplayY
      );

      let cropWidth = Math.round(
        EDITOR_OVAL_WIDTH * originalPerDisplayX
      );
      let cropHeight = Math.round(
        EDITOR_OVAL_HEIGHT * originalPerDisplayY
      );

      // Clamp to the original image bounds.
      cropOriginX = Math.max(
        0,
        Math.min(cropOriginX, originalWidth - 1)
      );
      cropOriginY = Math.max(
        0,
        Math.min(cropOriginY, originalHeight - 1)
      );

      cropWidth = Math.max(
        10,
        Math.min(cropWidth, originalWidth - cropOriginX)
      );
      cropHeight = Math.max(
        10,
        Math.min(cropHeight, originalHeight - cropOriginY)
      );

      const cropRegion = {
        originX: cropOriginX,
        originY: cropOriginY,
        width: cropWidth,
        height: cropHeight,
      };

      console.log("=== CROP DEBUG ===");
      console.log({
        originalWidth,
        originalHeight,
        currentDisplayWidth,
        currentDisplayHeight,
        currentScale,
        currentOffsetX,
        currentOffsetY,
        scaledWidth,
        scaledHeight,
        imageLeft,
        imageTop,
        ovalLeft,
        ovalTop,
        cropXOnDisplay,
        cropYOnDisplay,
        cropRegion,
      });

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { crop: cropRegion },
          { resize: { width: 800 } },
        ],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      onConfirm(result.uri);
    } catch (error) {
      console.error("Crop error:", error);
      Alert.alert(
        "Error",
        "Gagal memproses foto. Silakan coba lagi."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset state whenever a new image/modal is opened.
  useEffect(() => {
    if (!visible) return;

    offsetXRef.current = 0;
    offsetYRef.current = 0;
    scaleRef.current = 1;

    setImageOffsetX(0);
    setImageOffsetY(0);
    setScale(1);
  }, [visible, imageUri]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={cropStyles.modalContainer}>
        <View style={cropStyles.header}>
          <TouchableOpacity
            onPress={onCancel}
            style={cropStyles.headerButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <Text style={cropStyles.headerTitle}>
            Atur Posisi Wajah
          </Text>

          <TouchableOpacity
            onPress={handleConfirm}
            style={cropStyles.headerButton}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="checkmark"
                size={28}
                color={THEME.success}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={cropStyles.instructionContainer}>
          <Text style={cropStyles.instructionText}>
            Geser foto untuk menyesuaikan posisi wajah di dalam oval
          </Text>
        </View>

        <View style={cropStyles.editorContainer}>
          <View
            style={cropStyles.imageWrapper}
            {...panResponder.panHandlers}
          >
            {/*
              Image is rendered with the exact same dimensions used by
              handleConfirm() to calculate the crop coordinates.
              This creates a 1:1 relationship between the visible oval
              and the final cropped image.
            */}
            <Image
              source={{ uri: imageUri }}
              style={[
                cropStyles.fullImage,
                {
                  width: displayWidth * scale,
                  height: displayHeight * scale,
                  left:
                    (EDITOR_SIZE - displayWidth * scale) / 2 +
                    imageOffsetX,
                  top:
                    (EDITOR_SIZE - displayHeight * scale) / 2 +
                    imageOffsetY,
                },
              ]}
              resizeMode="stretch"
            />

            {/* Dark overlay with transparent oval cutout */}
            <View
              style={cropStyles.overlayContainer}
              pointerEvents="none"
            >
              <View style={cropStyles.darkBandHorizontal} />

              <View style={cropStyles.middleRow}>
                <View style={cropStyles.darkBandVertical} />

                <View style={cropStyles.ovalHole}>
                  <View style={cropStyles.ovalBorder} />
                </View>

                <View style={cropStyles.darkBandVertical} />
              </View>

              <View style={cropStyles.darkBandHorizontal} />
            </View>
          </View>
        </View>

        <View style={cropStyles.controlsContainer}>
          <View style={cropStyles.zoomControls}>
            <TouchableOpacity
              style={cropStyles.zoomButton}
              onPress={zoomOut}
              disabled={isProcessing}
            >
              <Ionicons
                name="remove"
                size={28}
                color={THEME.primary}
              />
            </TouchableOpacity>

            <Text style={cropStyles.zoomLabel}>
              {Math.round(scale * 100)}%
            </Text>

            <TouchableOpacity
              style={cropStyles.zoomButton}
              onPress={zoomIn}
              disabled={isProcessing}
            >
              <Ionicons
                name="add"
                size={28}
                color={THEME.primary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={cropStyles.resetButton}
            onPress={resetPosition}
            disabled={isProcessing}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={THEME.textSecondary}
            />
            <Text style={cropStyles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const OVAL_TOP_OFFSET = (EDITOR_SIZE - EDITOR_OVAL_HEIGHT) / 2;
const OVAL_LEFT_OFFSET = (EDITOR_SIZE - EDITOR_OVAL_WIDTH) / 2;

const cropStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  instructionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  editorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  imageWrapper: {
    width: EDITOR_SIZE,
    height: EDITOR_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  fullImage: {
    position: 'absolute',
  },
  // Dark overlay pieces around the oval cutout
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  darkBandHorizontal: {
    width: '100%',
    height: OVAL_TOP_OFFSET,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: EDITOR_OVAL_HEIGHT,
  },
  darkBandVertical: {
    width: OVAL_LEFT_OFFSET,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ovalHole: {
    width: EDITOR_OVAL_WIDTH,
    height: EDITOR_OVAL_HEIGHT,
    borderRadius: EDITOR_OVAL_WIDTH / 2,
    overflow: 'hidden',
    // transparent — lets the image show through
  },
  ovalBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: EDITOR_OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  zoomButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    minWidth: 60,
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  resetText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
});

// ─── Main Component ────────────────────────────────────────────────────────────

export default function RegisterFotoScreen() {
  const { user, token } = useAuth();

  // ── State ─────────────────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>("front");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [captureAnim] = useState(new Animated.Value(1));
  const [flashAnim] = useState(new Animated.Value(0));
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  // ── Crop Editor State ─────────────────────────────────────────────────────
  const [showCropEditor, setShowCropEditor] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState('');

  // ── Guided Pose State ─────────────────────────────────────────────────────
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);

  const currentPose = POSES[currentPoseIndex];
  const totalRequired = POSES.length * CAPTURES_PER_POSE;
  const allCaptured = capturedImages.length >= totalRequired;

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetCapture = useCallback(() => {
    setCapturedImages([]);
    setCurrentPoseIndex(0);
    setShowPreview(false);
  }, []);

  // ── Check registration status ─────────────────────────────────────────────
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!token || !user?.nim) {
        setIsCheckingStatus(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/arcface/status/${user.nim}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (response.ok || response.status === 200) {
          const result = await response.json();
          setIsAlreadyRegistered(result.is_registered === true);
        } else {
          setIsAlreadyRegistered(false);
        }
      } catch (error) {
        console.warn("Gagal cek status registrasi:", error);
        setIsAlreadyRegistered(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkRegistrationStatus();
  }, [token, user?.nim]);

  // ── Crop to oval region ───────────────────────────────────────────────────
  const cropToOvalRegion = async (
    photoUri: string,
    photoWidth: number,
    photoHeight: number,
    isFront: boolean
  ): Promise<string> => {
    try {
      const containerSize = CAMERA_SIZE;
      const scale = Math.max(containerSize / photoWidth, containerSize / photoHeight);
      const displayedWidth = photoWidth * scale;
      const displayedHeight = photoHeight * scale;
      const offsetX = (displayedWidth - containerSize) / 2;
      const offsetY = (displayedHeight - containerSize) / 2;

      let originX = (OVAL_LEFT + offsetX) / scale;
      let originY = (OVAL_TOP + offsetY) / scale;
      let width = OVAL_WIDTH / scale;
      let height = OVAL_HEIGHT / scale;

      originX = Math.max(0, Math.min(originX, photoWidth - 1));
      originY = Math.max(0, Math.min(originY, photoHeight - 1));
      width = Math.max(1, Math.min(width, photoWidth - originX));
      height = Math.max(1, Math.min(height, photoHeight - originY));

      const cropRegion = {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(width),
        height: Math.round(height),
      };

      const actions: ImageManipulator.Action[] = [];
      if (isFront) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }
      actions.push({ crop: cropRegion });
      actions.push({ resize: { width: 800 } });

      const manipResult = await ImageManipulator.manipulateAsync(
        photoUri,
        actions,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      return manipResult.uri;
    } catch (error) {
      console.warn("Gagal melakukan crop oval:", error);
      return photoUri;
    }
  };

  // ── Burst capture: 1 klik = 2 foto ───────────────────────────────────────
  const handleBurstCapture = async () => {
    if (!cameraRef.current || isCapturing || allCaptured) return;

    // Capture animation
    Animated.sequence([
      Animated.timing(captureAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(captureAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    setIsCapturing(true);

    try {
      const newPhotos: string[] = [];

      for (let i = 0; i < CAPTURES_PER_POSE; i++) {
        // Flash effect
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          shutterSound: false,
        });

        if (photo?.uri) {
          const croppedUri = photo.width && photo.height
            ? await cropToOvalRegion(photo.uri, photo.width, photo.height, facing === "front")
            : photo.uri;

          newPhotos.push(croppedUri);
          Vibration.vibrate(30);
        }

        // Jeda singkat antara 2 foto burst
        if (i < CAPTURES_PER_POSE - 1) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      // Update state
      setCapturedImages(prev => [...prev, ...newPhotos]);

      // Pindah ke pose berikutnya atau selesai
      if (currentPoseIndex < POSES.length - 1) {
        setCurrentPoseIndex(prev => prev + 1);
      }
      // Jika ini pose terakhir, allCaptured akan jadi true di render berikutnya

    } catch (error) {
      Alert.alert("Error", "Gagal mengambil foto. Silakan coba lagi.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    resetCapture();
  };

  // ── Handle Delete ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!user?.nim || !token) {
      Alert.alert("Error", "Silakan login terlebih dahulu.");
      return;
    }

    Alert.alert(
      "Hapus Registrasi?",
      `Apakah Anda yakin ingin menghapus data wajah untuk NIM ${user.nim}? Anda perlu registrasi ulang di kemudian hari.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE}/arcface/delete/${user.nim}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` },
              });
              const result = await response.json();
              if (result.success) {
                setIsAlreadyRegistered(false);
                Alert.alert("Berhasil", "Data wajah berhasil dihapus.");
              } else {
                Alert.alert("Gagal", result.message || "Gagal menghapus data wajah.");
              }
            } catch (error) {
              Alert.alert("Error", "Terjadi kesalahan koneksi.");
            }
          },
        },
      ]
    );
  };

  // ── Handle Confirm / Submit ───────────────────────────────────────────────
  const handleConfirm = async () => {
    if (capturedImages.length === 0) {
      Alert.alert("Error", "Tidak ada foto yang akan dikirim.");
      return;
    }

    if (!user?.nim) {
      Alert.alert("Error", "Silakan login terlebih dahulu untuk melakukan registrasi wajah.");
      return;
    }

    if (isAlreadyRegistered) {
      Alert.alert(
        "Perbarui Foto?",
        `Wajah Anda sudah terdaftar. Foto lama akan ditimpa dengan foto baru.\n\nApakah ingin melanjutkan?`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjutkan", onPress: () => performEnrollment(true) },
        ]
      );
    } else {
      performEnrollment(false);
    }
  };

  const performEnrollment = async (forceUpdate: boolean) => {
    setIsSubmitting(true);

    try {
      const photosBase64: string[] = [];
      for (const photoUri of capturedImages) {
        const base64Response = await fetch(photoUri);
        const blob = await base64Response.blob();
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(blob);
        });
        photosBase64.push(base64);
      }

      const response = await fetch(`${API_BASE}/arcface/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          nim: user!.nim,
          foto_base64: photosBase64,
          force_update: forceUpdate,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsAlreadyRegistered(true);
        Alert.alert(
          forceUpdate ? "Berhasil Diperbarui! 🎉" : "Berhasil! 🎉",
          forceUpdate
            ? `Wajah ${user!.nama_mahasiswa || user!.name} (${user!.nim}) berhasil diperbarui!\n\nData lama telah ditimpa.`
            : `Wajah ${user!.nama_mahasiswa || user!.name} (${user!.nim}) berhasil terdaftar!\n\nEmbedding tersimpan di: face_mahasiswa/${user!.nim}/`,
          [{ text: "OK", onPress: handleRetake }]
        );
      } else {
        if (result.message?.includes("sudah ter-enroll")) {
          if (forceUpdate) {
            setIsAlreadyRegistered(true);
            Alert.alert(
              "Berhasil Diperbarui! 🎉",
              `Wajah ${user!.nama_mahasiswa || user!.name} (${user!.nim}) berhasil diperbarui!\n\nData lama telah ditimpa.`,
              [{ text: "OK", onPress: handleRetake }]
            );
          } else {
            Alert.alert(
              "Info",
              "Wajah Anda sudah terdaftar sebelumnya.\n\nJika ingin memperbarui foto, silakan ambil foto baru dan pilih 'Perbarui'.",
              [{ text: "OK", onPress: handleRetake }]
            );
          }
        } else if (result.message?.includes("ArcFace model")) {
          Alert.alert(
            "Model Error",
            "Sistem Face Recognition belum siap. Hubungi admin untuk mengaktifkan model ArcFace.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert("Gagal", result.message || "Gagal menyimpan foto wajah.");
        }
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      Alert.alert("Error", "Gagal mengirim foto. Periksa koneksi internet dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render: Permission Loading ───────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={32} color={THEME.primary} />
          <Text style={styles.loadingText}>Memuat kamera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
        <View style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconBg}>
              <Ionicons name="camera" size={48} color={THEME.primary} />
            </View>
            <Text style={styles.permissionTitle}>Izinkan Akses Kamera</Text>
            <Text style={styles.permissionDesc}>
              Kami membutuhkan akses kamera untuk mengambil foto wajah Anda untuk verifikasi kehadiran.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
              <LinearGradient
                colors={[THEME.primary, THEME.primaryLight]}
                style={styles.permissionButtonGradient}
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.permissionButtonText}>Izinkan Kamera</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── Render: Main Screen ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="person-add" size={22} color={THEME.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              {isAlreadyRegistered ? "Update Wajah" : "Register Wajah"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isCheckingStatus
                ? "Memuat..."
                : isAlreadyRegistered
                  ? "✓ Sudah terdaftar"
                  : "Ambil foto untuk verifikasi"}
            </Text>
          </View>
        </View>
        <View style={styles.headerRightButtons}>
          {/* Gallery Button - Select one by one with crop editor */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              if (allCaptured || showPreview) return;

              const remaining = totalRequired - capturedImages.length;
              if (remaining <= 0) return;

              try {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsMultipleSelection: false,
                  quality: 1,
                });

                if (!result.canceled && result.assets.length > 0) {
                  const selectedPhoto = result.assets[0];
                  setSelectedImageUri(selectedPhoto.uri);
                  setShowCropEditor(true);
                }
              } catch (err) {
                Alert.alert("Error", "Gagal memilih gambar dari galeri");
              }
            }}
          >
            <Ionicons name="images-outline" size={22} color={THEME.primary} />
          </TouchableOpacity>
          {/* Delete Button */}
          {isAlreadyRegistered && (
            <TouchableOpacity
              style={[styles.iconButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={22} color={THEME.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scrollable body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pose guide — DI ATAS oval, tidak menghalangi wajah */}
        {!showPreview && !allCaptured && (
          <View style={styles.poseGuideAbove}>
            <View style={[styles.poseGuideBox, { borderColor: currentPose.color }]}>
              <Text style={styles.poseIcon}>{currentPose.icon}</Text>
              <Text style={styles.poseLabel}>{currentPose.label}</Text>
              <Text style={styles.poseDesc}>{currentPose.description}</Text>
            </View>
          </View>
        )}

        {/* Camera wrapper */}
        <View style={styles.cameraWrapper}>
          <View style={styles.ovalClip}>
            {(showPreview || allCaptured) && capturedImages.length > 0 ? (
              /* Tampilkan foto depan (pertama) sebagai preview utama di oval */
              <Image
                source={{ uri: capturedImages[0] }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <>
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraInner}
                  facing={facing}
                  mute={true}
                />
                {/* Flash overlay */}
                <Animated.View
                  style={[styles.flashOverlay, { opacity: flashAnim }]}
                  pointerEvents="none"
                />
              </>
            )}
          </View>

          {!showPreview && !allCaptured && <OvalMaskOverlay />}

          {(showPreview || allCaptured) && (
            <View style={styles.previewBadge}>
              <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
              <Text style={styles.previewBadgeText}>
                {allCaptured ? `${capturedImages.length} foto selesai` : "Foto Tertangkap"}
              </Text>
            </View>
          )}
        </View>

        {/* Thumbnails — di bawah oval, tampilkan semua foto kecil-kecil */}
        {capturedImages.length > 0 && (showPreview || allCaptured) && (
          <View style={styles.thumbnailRow}>
            {capturedImages.map((uri, idx) => (
              <View key={idx} style={styles.thumbnailWrapper}>
                <Image source={{ uri }} style={styles.thumbnailBelow} />
                <Text style={styles.thumbnailLabel}>
                  {idx < 2 ? 'Depan' : idx < 4 ? 'Kanan' : 'Kiri'} {(idx % 2) + 1}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Pose progress stepper */}
        <View style={styles.stepperContainer}>
          {POSES.map((pose, idx) => {
            const isDone = idx < currentPoseIndex || (idx === currentPoseIndex && allCaptured);
            const isCurrent = idx === currentPoseIndex && !allCaptured;
            return (
              <View key={pose.id} style={styles.stepperItem}>
                <View style={[
                  styles.stepperDot,
                  isDone && { backgroundColor: THEME.success },
                  isCurrent && { backgroundColor: pose.color, transform: [{ scale: 1.3 }] },
                  !isDone && !isCurrent && { backgroundColor: THEME.border },
                ]}>
                  {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[
                  styles.stepperLabel,
                  isCurrent && { color: pose.color, fontWeight: '700' },
                  isDone && { color: THEME.success },
                ]}>{pose.label.replace('Hadap ', '')}</Text>
                {idx < POSES.length - 1 && (
                  <View style={[styles.stepperLine, isDone && { backgroundColor: THEME.success }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Status badge */}
        <View style={styles.statusWrapper}>
          <View style={[
            styles.statusBadge,
            allCaptured || showPreview
              ? { borderColor: `${THEME.success}40`, backgroundColor: `${THEME.success}12` }
              : { borderColor: `${currentPose.color}40`, backgroundColor: `${currentPose.color}12` },
          ]}>
            <View style={[styles.statusDot, { backgroundColor: allCaptured || showPreview ? THEME.success : currentPose.color }]} />
            <Text style={[styles.statusText, { color: allCaptured || showPreview ? THEME.success : currentPose.color }]}>
              {showPreview
                ? `${capturedImages.length} foto siap dikirim`
                : allCaptured
                  ? "Semua pose selesai! Ketuk untuk simpan"
                  : isCapturing
                    ? "📸 Mengambil 2 foto..."
                    : `${currentPose.label} — Ketuk tombol untuk ambil foto`}
            </Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelRow}>
            <Ionicons name="camera-outline" size={16} color={THEME.primary} />
            <Text style={styles.infoPanelText}>
              {showPreview || allCaptured
                ? "6 foto siap dikirim ke server"
                : "Tekan tombol kamera atau galeri untuk ambil foto"}
            </Text>
          </View>
          <View style={styles.infoPanelRow}>
            <Ionicons name="images-outline" size={16} color={THEME.primary} />
            <Text style={styles.infoPanelText}>
              Tombol galeri: pilih foto satu per satu, di-crop otomatis sesuai oval
            </Text>
          </View>
          <View style={styles.infoPanelRow}>
            <Ionicons name="swap-horizontal-outline" size={16} color={THEME.textMuted} />
            <Text style={styles.infoPanelText}>
              {allCaptured ? 'Semua 3 pose sudah diambil' : `Langkah ${currentPoseIndex + 1}/3: ${currentPose.description}`}
            </Text>
          </View>
          <View style={styles.infoPanelRow}>
            <Ionicons name="close-circle-outline" size={16} color={THEME.textMuted} />
            <Text style={styles.infoPanelText}>Lepas kacamata, topi, atau masker</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action — fixed */}
      <View style={styles.captureSection}>
        {showPreview ? (
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake} activeOpacity={0.8}>
              <Ionicons name="refresh" size={22} color={THEME.primary} />
              <Text style={styles.retakeButtonText}>Ulangi</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: captureAnim }] }}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isSubmitting ? [THEME.textMuted, THEME.textSecondary] : [THEME.success, "#059669"]}
                  style={styles.confirmButtonGradient}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.confirmButtonText}>Mengirim...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={24} color="#fff" />
                      <Text style={styles.confirmButtonText}>Simpan {capturedImages.length} Foto</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.captureContainer}>
            <Animated.View style={{ transform: [{ scale: captureAnim }] }}>
              <TouchableOpacity
                style={[styles.captureButtonOuter]}
                onPress={allCaptured ? () => setShowPreview(true) : handleBurstCapture}
                disabled={isCapturing}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    isCapturing
                      ? ["#E2E8F0", "#E2E8F0"]
                      : allCaptured
                        ? [THEME.success, "#059669"]
                        : [currentPose.color, currentPose.color + "CC"]
                  }
                  style={styles.captureButton}
                >
                  {isCapturing ? (
                    <ActivityIndicator size="large" color={THEME.textMuted} />
                  ) : allCaptured ? (
                    <Ionicons name="checkmark" size={28} color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={28} color="#fff" />
                  )}
                </LinearGradient>
                <View style={[
                  styles.captureRing,
                  { borderColor: allCaptured ? THEME.success : currentPose.color },
                  allCaptured && { opacity: 1 },
                ]} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.captureHintBottom}>
              {isCapturing
                ? "Mengambil 2 foto..."
                : allCaptured
                  ? `${capturedImages.length} foto — Ketuk untuk preview`
                  : `Ketuk untuk ambil foto ${currentPose.label}`}
            </Text>
          </View>
        )}
      </View>

      {/* Crop Editor Modal */}
      <CropEditor
        visible={showCropEditor}
        imageUri={selectedImageUri}
        onConfirm={(croppedUri) => {
          setShowCropEditor(false);
          setCapturedImages(prev => [...prev, croppedUri]);

          const newCount = capturedImages.length + 1;
          const nextPose = Math.floor(newCount / CAPTURES_PER_POSE);

          // Update pose index
          if (newCount % CAPTURES_PER_POSE === 0 && nextPose < POSES.length) {
            setCurrentPoseIndex(Math.min(nextPose, POSES.length - 1));
          }

          // If all 6 photos, go to preview
          if (newCount >= totalRequired) {
            setShowPreview(true);
            setCurrentPoseIndex(POSES.length - 1);
          }
        }}
        onCancel={() => {
          setShowCropEditor(false);
          setSelectedImageUri('');
        }}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  // ─── Header ───────────────────────────────────────────────────────────────

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 10 : 55,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: THEME.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.textPrimary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.primary,
    marginTop: 1,
  },
  headerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: THEME.bgInput,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  deleteButton: {
    borderColor: `${THEME.danger}40`,
    backgroundColor: `${THEME.danger}10`,
  },

  // ─── Scroll body ──────────────────────────────────────────────────────────

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 160,
  },

  // ─── Camera area ──────────────────────────────────────────────────────────

  cameraWrapper: {
    alignSelf: "center",
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
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
  previewImage: {
    width: "100%",
    height: "100%",
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
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    zIndex: 12,
  },

  // ─── Pose guide (above oval) ────────────────────────────────────────────────

  poseGuideAbove: {
    alignItems: "center",
    marginBottom: 12,
  },
  poseGuideBox: {
    backgroundColor: "rgba(0,0,0,0.82)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    gap: 3,
  },
  poseIcon: {
    fontSize: 26,
  },
  poseLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  poseDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },

  // ─── Preview badge ────────────────────────────────────────────────────────

  previewBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    zIndex: 20,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.success,
  },

  // ─── Thumbnail row (below oval) ───────────────────────────────────────────

  thumbnailRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 20,
  },
  thumbnailWrapper: {
    alignItems: "center",
    gap: 4,
  },
  thumbnailBelow: {
    width: 52,
    height: 64,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.border,
  },
  thumbnailLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: THEME.textMuted,
  },

  // ─── Stepper ──────────────────────────────────────────────────────────────

  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 16,
  },
  stepperItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  stepperDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperLabel: {
    fontSize: 10,
    color: THEME.textMuted,
    fontWeight: "500",
    marginRight: 2,
  },
  stepperLine: {
    width: 16,
    height: 2,
    backgroundColor: THEME.border,
    marginHorizontal: 2,
    borderRadius: 1,
  },

  // ─── Status badge ─────────────────────────────────────────────────────────

  statusWrapper: {
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 24,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
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
    fontSize: 13,
    fontWeight: "600",
  },

  // ─── Info panel ───────────────────────────────────────────────────────────

  infoPanel: {
    marginHorizontal: 20,
    marginTop: 14,
    width: CAMERA_SIZE,
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

  // ─── Bottom capture section ───────────────────────────────────────────────

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
  captureContainer: {
    alignItems: "center",
    gap: 10,
  },
  captureButtonOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  captureRing: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2.5,
    opacity: 0.25,
  },
  captureHintBottom: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: "500",
  },

  // ─── Preview actions ──────────────────────────────────────────────────────

  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  retakeButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.bgInput,
    borderWidth: 2,
    borderColor: THEME.border,
  },
  retakeButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.primary,
  },
  confirmButton: {
    borderRadius: 40,
    overflow: "hidden",
    shadowColor: THEME.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 40,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // ─── Permission screen ────────────────────────────────────────────────────

  permissionContainer: {
    flex: 1,
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
    maxWidth: 340,
    shadowColor: THEME.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  permissionIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionDesc: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  permissionButton: {
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
  },
  permissionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ─── Loading ───────────────────────────────────────────────────────────────

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
});
