import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAuth } from "../context/AuthContext";
import { analyzeFoodImage, OfflineVisionError } from "../lib/aiVision";
import { apiFetch } from "../lib/apiClient";
import { fetchOpenFoodFactsProduct } from "../lib/openFoodFacts";

export default function Scanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const { isPremium, togglePremiumForTesting } = useAuth();

    // Default mode: Premium users get AI camera; free users get barcode scanner
    const [mode, setMode] = useState<"ai_camera" | "barcode">(
        isPremium ? "ai_camera" : "barcode"
    );

    const cameraRef = useRef<CameraView>(null);
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Analyzing...");

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>
                    We need your permission to access the camera
                </Text>
                <Button onPress={requestPermission} title="Grant Permission" />
            </View>
        );
    }

    // --- Barcode Scanner Handler ---
    const handleBarCodeScanned = async ({
        data,
    }: {
        type: string;
        data: string;
    }) => {
        setScanned(true);
        setLoading(true);
        setLoadingMessage("Looking up barcode...");

        try {
            const foodItem = await fetchOpenFoodFactsProduct(data, 8000);

            if (foodItem) {
                apiFetch("add_food", {
                    method: "POST",
                    body: foodItem,
                }).catch((error) =>
                    console.error("Failed to save scanned food asynchronously:", error)
                );

                router.replace({
                    pathname: "/barcode_info",
                    params: { query: data, results: JSON.stringify([foodItem]) },
                });
            } else {
                Alert.alert("Barcode Not Found", "No results found for this barcode.");
                setScanned(false);
            }
        } catch (error) {
            console.error("Barcode scan lookup error:", error);
            Alert.alert(
                "Network Error",
                "Error fetching product data. Please check connection and try again."
            );
            setScanned(false);
        } finally {
            setLoading(false);
        }
    };

    // --- AI Image Processing Handler ---
    const processImageBase64 = async (base64: string, mimeType = "image/jpeg") => {
        setLoading(true);
        setLoadingMessage("Identifying dishes with Gemini AI...");

        try {
            const result = await analyzeFoodImage(base64, {
                mimeType,
                devBypass: isPremium,
            });

            if (!result.is_food) {
                // Sweet friendly error for non-food images
                Alert.alert(
                    "Oops! 🍽️",
                    result.message ||
                        "Oops! That doesn't look like food. Try taking a clearer picture of your meal.",
                    [{ text: "Try Again", onPress: () => setLoading(false) }]
                );
                return;
            }

            if (result.dishes && result.dishes.length > 0) {
                router.push({
                    pathname: "/ai_dish_review",
                    params: { dishes: JSON.stringify(result.dishes) },
                });
            } else {
                Alert.alert(
                    "No Dishes Detected",
                    "We couldn't clearly identify any food items. Please try again with better lighting."
                );
            }
        } catch (err: unknown) {
            if (err instanceof OfflineVisionError) {
                Alert.alert(
                    "Offline Mode",
                    "AI food scan requires an internet connection. Would you like to switch to Barcode Scanner?",
                    [
                        { text: "Switch to Barcode", onPress: () => setMode("barcode") },
                        { text: "Cancel", style: "cancel" },
                    ]
                );
            } else {
                const message = err instanceof Error ? err.message : "Failed to analyze image";
                Alert.alert("Scan Error", message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Take photo with camera
    const handleTakePhoto = async () => {
        if (!cameraRef.current || loading) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.6,
                base64: true,
            });

            if (photo && photo.base64) {
                await processImageBase64(photo.base64, "image/jpeg");
            } else {
                Alert.alert("Camera Error", "Could not capture image. Please try again.");
            }
        } catch (e) {
            console.error("Camera capture error:", e);
            Alert.alert("Capture Failed", "An error occurred while taking photo.");
        }
    };

    // Pick photo from gallery
    const handlePickFromGallery = async () => {
        if (loading) return;

        try {
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                quality: 0.6,
                base64: true,
            });

            if (!res.canceled && res.assets && res.assets.length > 0) {
                const asset = res.assets[0];
                if (asset.base64) {
                    await processImageBase64(asset.base64, asset.mimeType || "image/jpeg");
                }
            }
        } catch (e) {
            console.error("Gallery picker error:", e);
            Alert.alert("Gallery Error", "Could not load image from photo gallery.");
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onBarcodeScanned={
                    mode === "barcode" && !scanned ? handleBarCodeScanned : undefined
                }
                barcodeScannerSettings={
                    mode === "barcode"
                        ? {
                              barcodeTypes: [
                                  "qr",
                                  "ean13",
                                  "ean8",
                                  "upc_e",
                                  "upc_a",
                                  "code128",
                                  "code39",
                                  "code93",
                              ],
                          }
                        : undefined
                }
            >
                {/* Top Header Bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        style={styles.circleBtn}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                    >
                        <Icon name="arrow-back-outline" size={26} color="#fff" />
                    </TouchableOpacity>

                    {/* Mode Indicator & Dev Test Toggle */}
                    <TouchableOpacity
                        style={[
                            styles.badgePill,
                            isPremium ? styles.premiumPill : styles.freePill,
                        ]}
                        onPress={() => {
                            togglePremiumForTesting();
                            Alert.alert(
                                "Testing Mode Toggled",
                                `You are now testing in ${!isPremium ? "PREMIUM" : "FREE"} mode.`
                            );
                        }}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={isPremium ? "sparkles" : "barcode-outline"}
                            size={16}
                            color="#fff"
                        />
                        <Text style={styles.badgeText}>
                            {isPremium ? "Premium AI" : "Free Tier"} (Tap to test)
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Center Content based on Mode */}
                {mode === "barcode" ? (
                    <View style={styles.overlay}>
                        <View style={styles.scanBox} />
                        <Text style={styles.scanText}>Align barcode inside frame</Text>

                        {/* Switch to AI mode toggle button */}
                        <TouchableOpacity
                            style={styles.modeSwitchBtn}
                            onPress={() => {
                                if (isPremium) {
                                    setMode("ai_camera");
                                } else {
                                    Alert.alert(
                                        "Premium Feature",
                                        "AI Food Recognition via camera is exclusive to Premium members. Tap the top 'Free Tier' pill to toggle Premium for testing!",
                                        [{ text: "OK" }]
                                    );
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <Icon name="camera-outline" size={18} color="#FFD700" />
                            <Text style={styles.modeSwitchText}>Switch to AI Food Camera</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.aiOverlay}>
                        <View style={styles.aiFocusFrame}>
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />
                        </View>
                        <Text style={styles.aiInstruction}>
                            Point camera at any food plate or dish
                        </Text>
                    </View>
                )}

                {/* Bottom Controls Bar (Premium AI Camera View) */}
                {mode === "ai_camera" && (
                    <View style={styles.bottomControls}>
                        {/* 1. Upload from Gallery icon */}
                        <TouchableOpacity
                            style={styles.sideControlBtn}
                            onPress={handlePickFromGallery}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconCircle}>
                                <Icon name="images-outline" size={26} color="#fff" />
                            </View>
                            <Text style={styles.controlLabel}>Gallery</Text>
                        </TouchableOpacity>

                        {/* 2. Main Shutter Button */}
                        <TouchableOpacity
                            style={styles.shutterOuter}
                            onPress={handleTakePhoto}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            <View style={styles.shutterInner}>
                                <Icon name="sparkles" size={26} color="#1B5E20" />
                            </View>
                        </TouchableOpacity>

                        {/* 3. Barcode Scanner Icon Toggle */}
                        <TouchableOpacity
                            style={styles.sideControlBtn}
                            onPress={() => setMode("barcode")}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconCircle}>
                                <Icon name="barcode-outline" size={26} color="#fff" />
                            </View>
                            <Text style={styles.controlLabel}>Barcode</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Loading Indicator */}
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#4ECDC4" />
                        <Text style={styles.loadingText}>{loadingMessage}</Text>
                    </View>
                )}
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
    },
    message: {
        textAlign: "center",
        paddingBottom: 10,
        fontSize: 16,
        color: "#fff",
    },
    camera: {
        flex: 1,
    },
    topBar: {
        position: "absolute",
        top: 50,
        left: 20,
        right: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
    },
    circleBtn: {
        backgroundColor: "rgba(0,0,0,0.55)",
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    badgePill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    premiumPill: {
        backgroundColor: "#2E7D32",
    },
    freePill: {
        backgroundColor: "#424242",
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    scanBox: {
        width: 260,
        height: 160,
        borderWidth: 2,
        borderColor: "#4ECDC4",
        backgroundColor: "transparent",
        borderRadius: 14,
    },
    scanText: {
        color: "#fff",
        fontSize: 15,
        marginTop: 20,
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: "hidden",
    },
    modeSwitchBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 30,
        backgroundColor: "rgba(27, 94, 32, 0.9)",
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 25,
    },
    modeSwitchText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    aiOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    aiFocusFrame: {
        width: 280,
        height: 280,
        position: "relative",
    },
    corner: {
        position: "absolute",
        width: 32,
        height: 32,
        borderColor: "#81C784",
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 12,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 12,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 12,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 12,
    },
    aiInstruction: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
        marginTop: 24,
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
    },
    bottomControls: {
        position: "absolute",
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: 30,
    },
    sideControlBtn: {
        alignItems: "center",
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(0,0,0,0.6)",
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.4)",
        alignItems: "center",
        justifyContent: "center",
    },
    controlLabel: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
        marginTop: 6,
    },
    shutterOuter: {
        width: 78,
        height: 78,
        borderRadius: 39,
        borderWidth: 4,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    shutterInner: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.75)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
    },
    loadingText: {
        color: "#fff",
        marginTop: 14,
        fontSize: 16,
        fontWeight: "600",
    },
});
