import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function BarcodeInfo() {
  const { query, results } = useLocalSearchParams();
  const foods =
    results && typeof results === "string" ? JSON.parse(results) : [];

  const goBack = () => {
    router.back();
  };

  const saveFoodLocally = async (food: any) => {
    try {
      const existingData = await AsyncStorage.getItem("@saved_foods");
      let savedFoods = existingData ? JSON.parse(existingData) : [];

      const newFood = {
        ...food,
        timestamp: new Date().toISOString(),
      };

      savedFoods.push(newFood);
      await AsyncStorage.setItem("@saved_foods", JSON.stringify(savedFoods));
      Alert.alert("Saved!", `${food.name} has been added to your log.`);
    } catch (e) {
      console.error("Failed to save food locally", e);
      Alert.alert("Error", "Could not save food item.");
    }
  };

  return (
    <LinearGradient
      colors={["#4ECDC4", "#0d5ef5"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Barcode Scanned</Text>
      </View>

      <ScrollView style={styles.content}>
        {foods.length > 0 ? (
          foods.map((food: any, index: number) => (
            <View key={index} style={styles.foodCard}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => saveFoodLocally(food)}
              >
                <Icon name="add" size={24} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodServing}>{food.serving_size}</Text>

              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{food.calories}</Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>

                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{food.protein}g</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>

                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{food.carbs}g</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>

                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{food.fat}g</Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              </View>

              {food.fiber > 0 && (
                <Text style={styles.fiberText}>Fiber: {food.fiber}g</Text>
              )}
            </View>
          ))
        ) : (
          <View style={styles.noResults}>
            <Icon name="sad-outline" size={50} color="#fff" />
            <Text style={styles.noResultsText}>No foods found</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 15,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 100,
  },
  foodCard: {
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  foodName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  foodServing: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 15,
    fontStyle: "italic",
  },
  nutritionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  nutritionLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 2,
  },
  fiberText: {
    fontSize: 14,
    color: "#fff",
    marginTop: 5,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    paddingTop: 8,
  },
  noResults: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  noResultsText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 10,
  },
  saveButton: {
    position: "absolute",
    top: 15,
    right: 15,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#32CD32", // Bright Green
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

