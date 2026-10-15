import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import Toast from "../components/Toast";
import { AiDish, logAiDishes } from "../lib/aiVision";

interface ReviewItem {
  id: string;
  dish: AiDish;
  quantity: number;
}

export default function AiDishReview() {
  const { dishes: dishesParam } = useLocalSearchParams<{
    dishes?: string;
  }>();

  const initialDishes: AiDish[] = useMemo(() => {
    if (!dishesParam) return [];
    try {
      const parsed = JSON.parse(dishesParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [dishesParam]);

  const [items, setItems] = useState<ReviewItem[]>(() =>
    initialDishes.map((dish, idx) => ({
      id: `${Date.now()}_${idx}`,
      dish,
      quantity: 1,
    }))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextQty = Math.max(0.25, Math.round((item.quantity + delta) * 100) / 100);
          return { ...item, quantity: nextQty };
        }
        return item;
      })
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 1;
        return {
          calories: acc.calories + (Number(item.dish.calories) || 0) * qty,
          protein: acc.protein + (Number(item.dish.protein) || 0) * qty,
          carbs: acc.carbs + (Number(item.dish.carbs) || 0) * qty,
          fat: acc.fat + (Number(item.dish.fat) || 0) * qty,
          fiber: acc.fiber + (Number(item.dish.fiber) || 0) * qty,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [items]);

  const handleSaveAll = async () => {
    if (items.length === 0) {
      Alert.alert("No items", "Please keep at least one food item to log.");
      return;
    }

    setIsSaving(true);
    try {
      await logAiDishes(
        items.map((it) => ({
          dish: it.dish,
          quantity: it.quantity,
        }))
      );

      setToastMessage(`Saved ${items.length} item${items.length > 1 ? "s" : ""} to your diary`);
      setToastVisible(true);

      setTimeout(() => {
        router.replace("/history");
      }, 700);
    } catch (error) {
      console.error("Failed to log AI dishes:", error);
      Alert.alert("Save Failed", "Could not save dishes to food log. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#1B5E20", "#2E7D32"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Review Identified Food</Text>
            <Text style={styles.headerSubtitle}>
              {items.length} dish{items.length !== 1 ? "es" : ""} detected by AI
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.replace("/scanner")}
            activeOpacity={0.7}
          >
            <Icon name="camera-reverse-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Total Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Icon name="sparkles" size={22} color="#FFD700" />
            <Text style={styles.summaryTitle}>Total Nutrition Estimate</Text>
          </View>
          <Text style={styles.summaryCalories}>
            {Math.round(totals.calories)} <Text style={styles.summaryUnit}>kcal</Text>
          </Text>
          <View style={styles.macroRow}>
            <View style={styles.macroCol}>
              <Text style={styles.macroVal}>{Math.round(totals.protein * 10) / 10}g</Text>
              <Text style={styles.macroLbl}>Protein</Text>
            </View>
            <View style={styles.macroCol}>
              <Text style={styles.macroVal}>{Math.round(totals.carbs * 10) / 10}g</Text>
              <Text style={styles.macroLbl}>Carbs</Text>
            </View>
            <View style={styles.macroCol}>
              <Text style={styles.macroVal}>{Math.round(totals.fat * 10) / 10}g</Text>
              <Text style={styles.macroLbl}>Fat</Text>
            </View>
            <View style={styles.macroCol}>
              <Text style={styles.macroVal}>{Math.round(totals.fiber * 10) / 10}g</Text>
              <Text style={styles.macroLbl}>Fiber</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Adjust Portions & Items</Text>

        {items.map((item) => {
          const dish = item.dish;
          const currentKcal = Math.round((Number(dish.calories) || 0) * item.quantity);
          return (
            <View key={item.id} style={styles.dishCard}>
              <View style={styles.dishHeader}>
                <View style={styles.dishTitleCol}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  <Text style={styles.dishServing}>
                    Base: {dish.serving_size} ({Math.round(dish.calories)} kcal)
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => removeItem(item.id)}
                  activeOpacity={0.7}
                >
                  <Icon name="trash-outline" size={20} color="#D32F2F" />
                </TouchableOpacity>
              </View>

              <View style={styles.portionRow}>
                <View style={styles.portionInfo}>
                  <Text style={styles.portionLabel}>Portion Multiplier</Text>
                  <Text style={styles.portionKcal}>{currentKcal} kcal</Text>
                </View>

                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => updateQuantity(item.id, -0.25)}
                    activeOpacity={0.7}
                  >
                    <Icon name="remove" size={18} color="#2E7D32" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity.toFixed(2)}x</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => updateQuantity(item.id, 0.25)}
                    activeOpacity={0.7}
                  >
                    <Icon name="add" size={18} color="#2E7D32" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {items.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="restaurant-outline" size={48} color="#9E9E9E" />
            <Text style={styles.emptyText}>All items removed.</Text>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => router.replace("/scanner")}
              activeOpacity={0.8}
            >
              <Text style={styles.retakeBtnText}>Scan Another Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {items.length > 0 && (
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.saveAllBtn, isSaving && styles.btnDisabled]}
            onPress={handleSaveAll}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#2E7D32", "#1B5E20"]}
              style={styles.saveGradient}
            >
              <Icon name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.saveAllText}>
                {isSaving ? "Saving to Diary..." : `Log All (${items.length} items)`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#424242",
    marginLeft: 6,
  },
  summaryCalories: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1B5E20",
    marginVertical: 4,
  },
  summaryUnit: {
    fontSize: 18,
    fontWeight: "500",
    color: "#757575",
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  macroCol: {
    alignItems: "center",
  },
  macroVal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#212121",
  },
  macroLbl: {
    fontSize: 12,
    color: "#757575",
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  dishCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dishHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dishTitleCol: {
    flex: 1,
    marginRight: 12,
  },
  dishName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
  },
  dishServing: {
    fontSize: 13,
    color: "#757575",
    marginTop: 3,
  },
  deleteBtn: {
    padding: 6,
  },
  portionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  portionInfo: {
    justifyContent: "center",
  },
  portionLabel: {
    fontSize: 12,
    color: "#757575",
  },
  portionKcal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2E7D32",
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 20,
    padding: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B5E20",
    paddingHorizontal: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#757575",
    marginTop: 12,
  },
  retakeBtn: {
    marginTop: 16,
    backgroundColor: "#2E7D32",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  retakeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  saveAllBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  saveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  saveAllText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
