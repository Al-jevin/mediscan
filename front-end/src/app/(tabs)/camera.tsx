import { Ionicons } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scanLabel } from "@/services/scanApi";

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();

  const [isProcessing, setIsProcessing] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [torchOn, setTorchOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Single place where every image ends up (camera or gallery)
  const handleImage = async (uri: string) => {
    try {
      setIsProcessing(true);

      // Step 1: resize + compress
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }], // bigger so small text stays sharp
        { compress: 0.85, format: SaveFormat.JPEG } // light compression
      );

      console.log("Processed:", result.width, "x", result.height);

      // Step 2: send to the OCR endpoint
      const scan = await scanLabel(result.uri);
      console.log("Image scan result:", scan.status);

      // Step 3: open the Scan Result screen, which reads the latest scan
      router.push("/result");
    } catch (e) {
      console.log("Processing failed:", e);
      Alert.alert(
        "Scan failed",
        e instanceof Error ? e.message : "Could not process or send the image. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Flashlight toggle (back camera only)
  const onToggleTorch = () => {
    if (facing === "front" || !cameraReady) return;
    setTorchOn((t) => !t);
  };

  // Flip camera
  const onFlip = () => {
    setFacing((f) => (f === "back" ? "front" : "back"));
    setTorchOn(false);
  };

  // Take a photo with the live camera
  const onCapture = async () => {
    if (!cameraRef.current || !cameraReady || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo?.uri) await handleImage(photo.uri);
    } catch (e) {
      console.log("Capture failed:", e);
      Alert.alert("Error", "Could not take the photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  // Open the system image picker (one photo only)
  const onPickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      await handleImage(result.assets[0].uri);
    } catch (e) {
      console.log("Image picker failed:", e);
      Alert.alert("Error", "Could not open the image picker. Please try again.");
    }
  };

  if (isProcessing) {
    return (
      <SafeAreaView style={styles.processingScreen}>
        <ActivityIndicator size="large" color="#1F5C4D" />
        <Text style={styles.processingTitle}>Scanning your medicine</Text>
        <Text style={styles.processingBody}>
          Analyzing the label. This may take a little while.
        </Text>
      </SafeAreaView>
    );
  }

  // 1) Camera permission status still loading
  if (!permission) return <View style={styles.permWrap} />;

  // 2) Camera permission not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Ionicons name="camera-outline" size={48} color="#444" />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>Allow camera access to scan medicine packaging.</Text>
        <Pressable
          style={styles.permBtn}
          onPress={permission.canAskAgain ? requestPermission : Linking.openSettings}
        >
          <Text style={styles.permBtnText}>
            {permission.canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.permUploadButton}
          onPress={onPickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Upload an image to scan instead"
        >
          <Ionicons name="images-outline" size={20} color="#1F5C4D" />
          <Text style={styles.permUploadText}>Upload image instead</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.permLink}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // 3) Granted -> camera screen
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={torchOn && facing === "back"}
        onCameraReady={() => setCameraReady(true)}
      />

      <SafeAreaView style={styles.overlay}>
        {/* Top bar: back, flashlight */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </Pressable>

          <Pressable
            onPress={onToggleTorch}
            disabled={facing === "front"}
            hitSlop={12}
            style={facing === "front" && { opacity: 0.4 }}
          >
            <Ionicons
              name={torchOn ? "flash" : "flash-outline"}
              size={26}
              color={torchOn ? "#FFE14D" : "#fff"}
            />
          </Pressable>
        </View>

        {/* Scan brackets */}
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>

        {/* Bottom: upload / capture / flip */}
        <View style={styles.bottom}>
          <View style={styles.controls}>
            <Pressable
              style={styles.uploadButton}
              onPress={onPickFromGallery}
              disabled={isCapturing || isProcessing}
              accessibilityRole="button"
              accessibilityLabel="Upload an image to scan"
            >
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.uploadText}>Upload image</Text>
            </Pressable>

            <Pressable
              style={[styles.captureOuter, (isCapturing || isProcessing) && { opacity: 0.6 }]}
              onPress={onCapture}
              disabled={isCapturing || isProcessing}
            >
              <View style={styles.captureInner}>
                <Ionicons name="camera" size={28} color="#fff" />
              </View>
            </Pressable>

            <Pressable onPress={onFlip} hitSlop={12}>
              <Ionicons name="sync-outline" size={30} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CORNER = 36;
const W = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between" },

  // Permission screen
  permWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#fff" },
  processingScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#fff" },
  processingTitle: { fontSize: 20, fontWeight: "700", color: "#1F5C4D", marginTop: 20 },
  processingBody: { fontSize: 14, color: "#555", textAlign: "center", marginTop: 8 },
  permTitle: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  permBody: { fontSize: 14, color: "#555", textAlign: "center", marginTop: 8 },
  permBtn: { backgroundColor: "#1F5C4D", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, marginTop: 20 },
  permBtnText: { color: "#fff", fontWeight: "600" },
  permUploadButton: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, padding: 8 },
  permUploadText: { color: "#1F5C4D", fontWeight: "600" },
  permLink: { color: "#1F5C4D", fontWeight: "500" },

  // Top bar
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 },

  // Scan brackets
  frameWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: { width: "82%", aspectRatio: 1.1 },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "#fff" },
  tl: { top: 0, left: 0, borderTopWidth: W, borderLeftWidth: W, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: W, borderRightWidth: W, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: W, borderLeftWidth: W, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: W, borderRightWidth: W, borderBottomRightRadius: 14 },

  // Bottom
  bottom: { paddingBottom: 24 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28 },
  uploadButton: { width: 84, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 },
  uploadText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  captureOuter: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#E8F1EE", alignItems: "center", justifyContent: "center" },
  captureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#1F5C4D", alignItems: "center", justifyContent: "center" },
});