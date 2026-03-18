import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  serving_size: string;
  timestamp: string;
}

interface GroupedData {
  date: string;
  items: FoodItem[];
  totalCalories: number;
}

export default function History() {
  const [groupedData, setGroupedData] = useState<GroupedData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await AsyncStorage.getItem("@saved_foods");
      if (data) {
        const parsed: FoodItem[] = JSON.parse(data);
        const grouped = groupDataByDate(parsed);
        setGroupedData(grouped);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupDataByDate = (data: FoodItem[]): GroupedData[] => {
    const groups: { [key: string]: FoodItem[] } = {};

    data.forEach((item) => {
      const date = new Date(item.timestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });

    return Object.keys(groups)
      .map((date) => {
        const items = groups[date];
        const totalCalories = items.reduce((sum, item) => sum + Number(item.calories), 0);
        return { date, items, totalCalories };
      })
      .sort((a, b) => new Date(b.items[0].timestamp).getTime() - new Date(a.items[0].timestamp).getTime());
  };

  const renderFoodItem = (item: FoodItem) => (
    <View style={styles.foodRow} key={item.timestamp}>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodDetail}>{item.serving_size} • {item.calories} kcal</Text>
      </View>
      <View style={styles.macroDots}>
        <View style={[styles.dot, { backgroundColor: "#FF6B6B" }]} />
        <Text style={styles.macroText}>{item.protein}g</Text>
        <View style={[styles.dot, { backgroundColor: "#4ECDC4" }]} />
        <Text style={styles.macroText}>{item.carbs}g</Text>
      </View>
    </View>
  );

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
      >
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {groupedData.length > 0 ? (
        <FlatList
          data={groupedData}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{item.date}</Text>
                <Text style={styles.totalCalText}>{item.totalCalories} kcal</Text>
              </View>
              <View style={styles.itemCard}>
                {item.items.map((food) => renderFoodItem(food))}
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="fast-food-outline" size={80} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No food recorded yet</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => router.push("/")}>
            <Text style={styles.startBtnText}>Start Tracking</Text>
          </TouchableOpacity>
        </View>
      )}
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 110,
    paddingBottom: 100,
  },
  dateGroup: {
    marginBottom: 25,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  dateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    opacity: 0.9,
  },
  totalCalText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  itemCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  foodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  foodDetail: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  macroDots: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
    marginRight: 4,
  },
  macroText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 18,
    marginTop: 20,
  },
  startBtn: {
    marginTop: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startBtnText: {
    color: "#0d5ef5",
    fontWeight: "bold",
    fontSize: 16,
  },
});
