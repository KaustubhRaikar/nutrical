import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Button,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function Scanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!permission) {
        // Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>
                    We need your permission to show the camera
                </Text>
                <Button onPress={requestPermission} title="grant permission" />
            </View>
        );
    }

    const handleBarCodeScanned = async ({
        type,
        data,
    }: {
        type: string;
        data: string;
    }) => {
        setScanned(true);
        setLoading(true);

        try {
            const response = await fetch(
                `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(data)}`
            );
            const resultData = await response.json();

            if (resultData.status === 1 && resultData.product) {
                const product = resultData.product;
                const nutriments = product.nutriments || {};

                const foodItem = {
                    name: product.product_name || "Unknown Product",
                    serving_size: "100g",
                    calories: nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 0,
                    protein: nutriments.proteins_100g || nutriments.proteins || 0,
                    carbs: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
                    fat: nutriments.fat_100g || nutriments.fat || 0,
                    fiber: nutriments.fiber_100g || nutriments.fiber || 0,
                    category: "Scanned",
                };

                // Save to database asynchronously
                fetch("https://nutritionapi.aarambhtech.in/?action=add_food", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(foodItem),
                }).catch((error) => console.error("Failed to save scanned food", error));

                // Pop the scanner screen and go to info
                router.replace({
                    pathname: "/barcode_info",
                    params: { query: data, results: JSON.stringify([foodItem]) },
                });
            } else {
                alert("No results found for scanned barcode");
                setScanned(false);
            }
        } catch (error) {
            alert("Error fetching data");
            setScanned(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
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
                }}
            >
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Icon name="arrow-back-outline" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.overlay}>
                    <View style={styles.scanBox} />
                    <Text style={styles.scanText}>Scan a barcode to search</Text>
                </View>

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#4ECDC4" />
                        <Text style={styles.loadingText}>Searching...</Text>
                    </View>
                )}
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
    },
    message: {
        textAlign: "center",
        paddingBottom: 10,
        fontSize: 16,
    },
    camera: {
        flex: 1,
    },
    buttonContainer: {
        position: "absolute",
        top: 50,
        left: 20,
        zIndex: 10,
    },
    backButton: {
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 10,
        borderRadius: 25,
    },
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    scanBox: {
        width: 250,
        height: 150,
        borderWidth: 2,
        borderColor: "#4ECDC4",
        backgroundColor: "transparent",
        borderRadius: 10,
    },
    scanText: {
        color: "#fff",
        fontSize: 16,
        marginTop: 20,
        backgroundColor: "rgba(0,0,0,0.5)",
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: "hidden",
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
    },
    loadingText: {
        color: "#fff",
        marginTop: 10,
        fontSize: 16,
    },
});
