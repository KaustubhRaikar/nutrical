import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import Toast from "../components/Toast";
import {
  DailyTotals,
  FoodLogEntry,
  dailyTotals,
  formatDateKey,
  loadAll,
  remove,
  update,
} from "../lib/foodLog";

interface GroupedData {
  date: string;
  items: FoodLogEntry[];
  totals: DailyTotals;
}

interface PendingDelete {
  item: FoodLogEntry;
  timeoutId: NodeJS.Timeout;
}

// -------------------------------------------------------------
// Swipeable Food Item Row
// -------------------------------------------------------------
interface SwipeableRowProps {
  item: FoodLogEntry;
  onPress: () => void;
  onDelete: () => void;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({ item, onPress, onDelete }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const qty = Number(item.quantity) || 1;
  const scaledCalories = Math.round((Number(item.calories) || 0) * qty);
  const scaledProtein = Math.round(((Number(item.protein) || 0) * qty) * 10) / 10;
  const scaledCarbs = Math.round(((Number(item.carbs) || 0) * qty) * 10) / 10;
  const scaledFat = Math.round(((Number(item.fat) || 0) * qty) * 10) / 10;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -110));
        } else if (gestureState.dx > 0) {
          // Slight resistance if dragging right
          translateX.setValue(Math.min(gestureState.dx * 0.2, 20));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -75) {
          Animated.timing(translateX, {
            toValue: -100,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
            // Reset position after triggering delete
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {/* Background delete action revealed on swipe */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Icon name="trash-outline" size={24} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground interactive food row */}
      <Animated.View
        style={[
          styles.foodRow,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.foodRowContent}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.foodInfo}>
            <View style={styles.foodTitleRow}>
              <Text style={styles.foodName} numberOfLines={1}>
                {item.name}
              </Text>
              {qty !== 1 && (
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityBadgeText}>{qty}x</Text>
                </View>
              )}
            </View>
            <Text style={styles.foodDetail}>
              {item.serving_size} • {scaledCalories} kcal
            </Text>
          </View>

          <View style={styles.macroDots}>
            <View style={styles.macroPill}>
              <View style={[styles.dot, { backgroundColor: "#FF6B6B" }]} />
              <Text style={styles.macroText}>{scaledProtein}g</Text>
            </View>
            <View style={styles.macroPill}>
              <View style={[styles.dot, { backgroundColor: "#4ECDC4" }]} />
              <Text style={styles.macroText}>{scaledCarbs}g</Text>
            </View>
            <View style={styles.macroPill}>
              <View style={[styles.dot, { backgroundColor: "#F7B731" }]} />
              <Text style={styles.macroText}>{scaledFat}g</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// -------------------------------------------------------------
// History Screen
// -------------------------------------------------------------
export default function History() {
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedData[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Sheet State
  const [editingItem, setEditingItem] = useState<FoodLogEntry | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);

  // 5-second Undo Toast State
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [undoToastMessage, setUndoToastMessage] = useState("");
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  const recalculateGroups = useCallback((items: FoodLogEntry[]) => {
    const groups: { [key: string]: FoodLogEntry[] } = {};

    items.forEach((item) => {
      const dateKey = formatDateKey(item.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    const result: GroupedData[] = Object.keys(groups)
      .map((date) => {
        const groupItems = groups[date];
        const totals = dailyTotals(groupItems);
        return { date, items: groupItems, totals };
      })
      .sort((a, b) => {
        const timeA = new Date(a.items[0]?.timestamp || 0).getTime();
        const timeB = new Date(b.items[0]?.timestamp || 0).getTime();
        return timeB - timeA;
      });

    setGroupedData(result);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const all = await loadAll();
      setEntries(all);
      recalculateGroups(all);
    } catch (error) {
      console.error("Error loading food history:", error);
    } finally {
      setLoading(false);
    }
  }, [recalculateGroups]);

  useEffect(() => {
    loadHistory();

    // Cleanup: commit any pending deletion if unmounting
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timeoutId);
        remove(pendingDeleteRef.current.item.id).catch((err) =>
          console.error("Failed to commit pending delete on unmount:", err)
        );
        pendingDeleteRef.current = null;
      }
    };
  }, [loadHistory]);

  // -----------------------------------------------------------
  // Delete with 5-second Undo Flow
  // -----------------------------------------------------------
  const commitPendingDelete = async () => {
    if (pendingDeleteRef.current) {
      const itemToDelete = pendingDeleteRef.current.item;
      clearTimeout(pendingDeleteRef.current.timeoutId);
      pendingDeleteRef.current = null;
      try {
        await remove(itemToDelete.id);
      } catch (e) {
        console.error("Failed to commit deletion:", e);
      }
    }
  };

  const handleDeleteItem = async (item: FoodLogEntry) => {
    // If there was a previous pending deletion, commit it now
    await commitPendingDelete();

    // 1. Immediately remove from local state & update daily totals
    const updatedEntries = entries.filter((e) => e.id !== item.id);
    setEntries(updatedEntries);
    recalculateGroups(updatedEntries);

    // 2. Schedule deletion commitment after 5 seconds
    const timeoutId = setTimeout(async () => {
      await commitPendingDelete();
      setUndoToastVisible(false);
    }, 5000);

    pendingDeleteRef.current = { item, timeoutId };
    setUndoToastMessage(`${item.name} deleted`);
    setUndoToastVisible(true);
  };

  const handleUndoDelete = () => {
    if (!pendingDeleteRef.current) return;

    clearTimeout(pendingDeleteRef.current.timeoutId);
    const restoredItem = pendingDeleteRef.current.item;
    pendingDeleteRef.current = null;

    // Immediately restore to state & recalculate totals
    const restoredList = [restoredItem, ...entries];
    setEntries(restoredList);
    recalculateGroups(restoredList);
    setUndoToastVisible(false);
  };

  // -----------------------------------------------------------
  // Tap-to-edit Quantity Flow
  // -----------------------------------------------------------
  const handleOpenEdit = (item: FoodLogEntry) => {
    setEditingItem(item);
    setEditQuantity(Number(item.quantity) || 1);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const newQty = editQuantity;
    const targetId = editingItem.id;
    setEditingItem(null);

    // Update in storage
    await update(targetId, { quantity: newQty });

    // Update local state immediately
    const updated = entries.map((e) =>
      e.id === targetId ? { ...e, quantity: newQty, updated_at: new Date().toISOString() } : e
    );
    setEntries(updated);
    recalculateGroups(updated);
  };

  const incrementQty = () => {
    setEditQuantity((prev) => Math.min(10, Math.round((prev + 0.25) * 100) / 100));
  };

  const decrementQty = () => {
    setEditQuantity((prev) => Math.max(0.25, Math.round((prev - 0.25) * 100) / 100));
  };

  if (loading) {
    return (
      <LinearGradient colors={["#0d5ef5", "#4ECDC4"]} style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#0d5ef5", "#4ECDC4"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />

      {/* Floating Back Button */}
      <TouchableOpacity
        style={styles.floatingBackButton}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
      >
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Floating Analytics Button */}
      <TouchableOpacity
        style={styles.floatingAnalyticsButton}
        onPress={() => router.push("/analytics")}
        accessibilityLabel="Open Analytics"
      >
        <Icon name="stats-chart" size={22} color="#fff" />
      </TouchableOpacity>

      {groupedData.length > 0 ? (
        <FlatList
          data={groupedData}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.dateSection}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{group.date}</Text>
                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>
                    {group.totals.calories} kcal
                  </Text>
                </View>
              </View>

              <View style={styles.macroSummaryRow}>
                <Text style={styles.macroSummaryText}>
                  P: {group.totals.protein}g  •  C: {group.totals.carbs}g  •  F: {group.totals.fat}g
                </Text>
              </View>

              <View style={styles.cardContainer}>
                {group.items.map((foodItem) => (
                  <SwipeableRow
                    key={foodItem.id}
                    item={foodItem}
                    onPress={() => handleOpenEdit(foodItem)}
                    onDelete={() => handleDeleteItem(foodItem)}
                  />
                ))}
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="restaurant-outline" size={80} color="rgba(255,255,255,0.4)" />
          <Text style={styles.emptyText}>No saved meals yet</Text>
          <Text style={styles.emptySubtext}>
            Search for foods or scan barcodes to begin logging your daily nutrition.
          </Text>
        </View>
      )}

      {/* Quantity Stepper Edit Modal Sheet */}
      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {editingItem?.name}
              </Text>
              <Text style={styles.modalServing}>
                Base portion: {editingItem?.serving_size}
              </Text>
            </View>

            {/* Stepper Control */}
            <View style={styles.stepperSection}>
              <Text style={styles.stepperLabel}>Portion Quantity</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    editQuantity <= 0.25 && styles.stepperButtonDisabled,
                  ]}
                  onPress={decrementQty}
                  disabled={editQuantity <= 0.25}
                  activeOpacity={0.7}
                >
                  <Icon name="remove" size={22} color="#0d5ef5" />
                </TouchableOpacity>

                <View style={styles.stepperValueContainer}>
                  <Text style={styles.stepperValueText}>{editQuantity}</Text>
                  <Text style={styles.stepperUnitText}>servings</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    editQuantity >= 10 && styles.stepperButtonDisabled,
                  ]}
                  onPress={incrementQty}
                  disabled={editQuantity >= 10}
                  activeOpacity={0.7}
                >
                  <Icon name="add" size={22} color="#0d5ef5" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Recalculated Macros */}
            {editingItem && (
              <View style={styles.recalcGrid}>
                <View style={styles.recalcCard}>
                  <Text style={styles.recalcValue}>
                    {Math.round((Number(editingItem.calories) || 0) * editQuantity)}
                  </Text>
                  <Text style={styles.recalcLabel}>CALORIES</Text>
                </View>

                <View style={styles.recalcCard}>
                  <Text style={[styles.recalcValue, { color: "#FF6B6B" }]}>
                    {(((Number(editingItem.protein) || 0) * editQuantity)).toFixed(1)}g
                  </Text>
                  <Text style={styles.recalcLabel}>PROTEIN</Text>
                </View>

                <View style={styles.recalcCard}>
                  <Text style={[styles.recalcValue, { color: "#4ECDC4" }]}>
                    {(((Number(editingItem.carbs) || 0) * editQuantity)).toFixed(1)}g
                  </Text>
                  <Text style={styles.recalcLabel}>CARBS</Text>
                </View>

                <View style={styles.recalcCard}>
                  <Text style={[styles.recalcValue, { color: "#F7B731" }]}>
                    {(((Number(editingItem.fat) || 0) * editQuantity)).toFixed(1)}g
                  </Text>
                  <Text style={styles.recalcLabel}>FAT</Text>
                </View>
              </View>
            )}

            {/* Modal Actions */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditingItem(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalButton}
                onPress={handleSaveEdit}
                activeOpacity={0.8}
              >
                <Text style={styles.saveModalButtonText}>Update Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5-second Undo Toast */}
      <Toast
        visible={undoToastVisible}
        message={undoToastMessage}
        actionText="Undo"
        duration={5000}
        onAction={handleUndoDelete}
        onDismiss={() => {
          setUndoToastVisible(false);
          commitPendingDelete();
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingBackButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 10,
    borderRadius: 25,
  },
  floatingAnalyticsButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 10,
    borderRadius: 25,
  },
  listContent: {
    paddingTop: 100,
    paddingBottom: 60,
    paddingHorizontal: 16,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  totalBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  totalBadgeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  macroSummaryRow: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  macroSummaryText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
  },
  cardContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  swipeContainer: {
    position: "relative",
    backgroundColor: "#FF5252",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FF5252",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  deleteAction: {
    width: 90,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 2,
  },
  foodRow: {
    backgroundColor: "#fff",
  },
  foodRowContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  foodInfo: {
    flex: 1,
    marginRight: 10,
  },
  foodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  foodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    flexShrink: 1,
  },
  quantityBadge: {
    backgroundColor: "rgba(13, 94, 245, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  quantityBadgeText: {
    color: "#0d5ef5",
    fontSize: 11,
    fontWeight: "700",
  },
  foodDetail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
  },
  macroDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  macroPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  macroText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
  },
  modalServing: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  stepperSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  stepperButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperValueContainer: {
    alignItems: "center",
    minWidth: 80,
  },
  stepperValueText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0F172A",
  },
  stepperUnitText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  recalcGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 8,
  },
  recalcCard: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  recalcValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  recalcLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  saveModalButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#0d5ef5",
    alignItems: "center",
    shadowColor: "#0d5ef5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveModalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
