import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/Ionicons";
import NutritionProgressRing from "../components/ProgressRing";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/apiClient";
import {
  DailyTotals,
  dailyTotals,
  formatDateKey,
  loadAll,
} from "../lib/foodLog";
import {
  DailyTargets,
  DEFAULT_DAILY_TARGETS,
  loadTargets,
} from "../lib/targets";
import CustomSplash from "./splash";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { user, isLoading, logout, recordSearch } = useAuth();

  // Targets and Daily Totals State
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_DAILY_TARGETS);
  const [todayTotals, setTodayTotals] = useState<DailyTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });

  // Handle Auth redirection
  useEffect(() => {
    if (isReady && !isLoading && !user) {
      router.replace("/login");
    }
  }, [isReady, isLoading, user]);

  // Live update targets and today's totals on screen focus
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshDashboardData = async () => {
        try {
          const [loadedTargets, allMeals] = await Promise.all([
            loadTargets(),
            loadAll(),
          ]);

          if (!active) return;

          setTargets(loadedTargets);

          const todayKey = formatDateKey(new Date());
          const todayMeals = allMeals.filter(
            (meal) => formatDateKey(meal.timestamp) === todayKey
          );

          const totals = dailyTotals(todayMeals);
          setTodayTotals(totals);
        } catch (err) {
          console.error("Failed to refresh dashboard data:", err);
        }
      };

      refreshDashboardData();

      return () => {
        active = false;
      };
    }, [])
  );

  // Show splash screen while loading
  if (!isReady || isLoading) {
    return <CustomSplash onFinish={() => setIsReady(true)} />;
  }

  const handleSearch = async (query?: string) => {
    const q = query || searchQuery;
    if (q.trim() !== "") {
      setLoading(true);
      try {
        const data = await apiFetch<{ success: boolean; results: any[] }>("search", {
          params: { q },
        });
        Keyboard.dismiss();
        if (data.success && data.results && data.results.length > 0) {
          recordSearch(q);

          router.push({
            pathname: "/info",
            params: { query: q, results: JSON.stringify(data.results) },
          });
        } else {
          alert("No results found");
        }
      } catch (error) {
        console.error("Search error:", error);
        alert("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const suggestions = [
    "Vada Pav",
    "Pizza",
    "Burger",
    "Biryani",
    "Samosa",
    "Pav Bhaji",
    "Noodles",
    "Ice Cream",
  ];

  const proteinPct = Math.min(
    100,
    Math.round((todayTotals.protein / Math.max(1, targets.protein)) * 100)
  );
  const carbsPct = Math.min(
    100,
    Math.round((todayTotals.carbs / Math.max(1, targets.carbs)) * 100)
  );
  const fatPct = Math.min(
    100,
    Math.round((todayTotals.fat / Math.max(1, targets.fat)) * 100)
  );

  return (
    <LinearGradient
      colors={["#0d5ef5", "#4ECDC4"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />

      {/* Top Bar Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={logout}
          style={styles.topBarButton}
          activeOpacity={0.7}
        >
          <Icon name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.topBarPill}
            onPress={() => router.push("/goals")}
            activeOpacity={0.7}
          >
            <Icon name="flag-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.topBarPillText}>Goals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topBarPill}
            onPress={() => router.push("/history")}
            activeOpacity={0.7}
          >
            <Icon name="time-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.topBarPillText}>Log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => router.push("/analytics")}
            activeOpacity={0.7}
            accessibilityLabel="Open Analytics"
          >
            <Icon name="stats-chart-outline" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => router.push("/settings")}
            activeOpacity={0.7}
            accessibilityLabel="Open Settings"
          >
            <Icon name="settings-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* NutriCal Logo */}
        <Animatable.View
          animation="fadeInDown"
          duration={800}
          style={styles.logoContainer}
        >
          <Animatable.Image
            source={require("../assets/images/nutri_app_logo_white.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animatable.View>

        {/* Daily Progress & Macros Dashboard Card */}
        <Animatable.View
          animation="fadeInUp"
          delay={200}
          style={styles.progressCard}
        >
          <View style={styles.progressCardHeader}>
            <View>
              <Text style={styles.progressCardTitle}>Today&apos;s Nutrition</Text>
              <Text style={styles.progressCardSubtitle}>
                Target: {targets.calories.toLocaleString()} kcal
              </Text>
            </View>

            <TouchableOpacity
              style={styles.editGoalsLink}
              onPress={() => router.push("/goals")}
              activeOpacity={0.7}
            >
              <Text style={styles.editGoalsLinkText}>Edit Goals</Text>
              <Icon name="chevron-forward" size={14} color="#0d5ef5" />
            </TouchableOpacity>
          </View>

          {/* Central Progress Ring */}
          <View style={styles.ringWrapper}>
            <NutritionProgressRing
              consumed={todayTotals.calories}
              target={targets.calories}
              size={180}
              strokeWidth={14}
            />
          </View>

          {/* Three Slim Macro Progress Bars */}
          <View style={styles.macroBarsContainer}>
            {/* Protein Bar */}
            <View style={styles.macroBarItem}>
              <View style={styles.macroBarHeader}>
                <View style={styles.macroBarLabelRow}>
                  <View style={[styles.macroDot, { backgroundColor: "#FF6B6B" }]} />
                  <Text style={styles.macroBarName}>Protein</Text>
                </View>
                <Text style={styles.macroBarValues}>
                  {todayTotals.protein}g / {targets.protein}g
                </Text>
              </View>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.macroFill,
                    {
                      width: `${proteinPct}%`,
                      backgroundColor: "#FF6B6B",
                    },
                  ]}
                />
              </View>
            </View>

            {/* Carbs Bar */}
            <View style={styles.macroBarItem}>
              <View style={styles.macroBarHeader}>
                <View style={styles.macroBarLabelRow}>
                  <View style={[styles.macroDot, { backgroundColor: "#4ECDC4" }]} />
                  <Text style={styles.macroBarName}>Carbs</Text>
                </View>
                <Text style={styles.macroBarValues}>
                  {todayTotals.carbs}g / {targets.carbs}g
                </Text>
              </View>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.macroFill,
                    {
                      width: `${carbsPct}%`,
                      backgroundColor: "#4ECDC4",
                    },
                  ]}
                />
              </View>
            </View>

            {/* Fat Bar */}
            <View style={styles.macroBarItem}>
              <View style={styles.macroBarHeader}>
                <View style={styles.macroBarLabelRow}>
                  <View style={[styles.macroDot, { backgroundColor: "#F7B731" }]} />
                  <Text style={styles.macroBarName}>Fat</Text>
                </View>
                <Text style={styles.macroBarValues}>
                  {todayTotals.fat}g / {targets.fat}g
                </Text>
              </View>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.macroFill,
                    {
                      width: `${fatPct}%`,
                      backgroundColor: "#F7B731",
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Animatable.View>

        {/* Search Bar Container */}
        <Animatable.View
          animation="fadeInUp"
          delay={400}
          style={styles.searchContainer}
        >
          <Icon
            name="search-outline"
            size={22}
            color="#fff"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dish or scan barcode..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            cursorColor="#fff"
            selectionColor="#fff"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
            editable={!loading}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              activeOpacity={0.7}
            >
              <Icon name="camera-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </Animatable.View>

        {/* Popular Dishes Suggestion Chips */}
        <Animatable.View
          animation="fadeInUp"
          delay={600}
          style={styles.suggestionsContainer}
        >
          <Text style={styles.suggestionsTitle}>Popular Searches</Text>
          <View style={styles.suggestionChips}>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.chip}
                onPress={() => handleSearch(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animatable.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  topBarButton: {
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
  },
  topBarActions: {
    flexDirection: "row",
    gap: 10,
  },
  topBarPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  topBarPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 130,
    height: 70,
  },
  // Progress Dashboard Card
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  progressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  progressCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  progressCardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  editGoalsLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13, 94, 245, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editGoalsLinkText: {
    fontSize: 12,
    color: "#0d5ef5",
    fontWeight: "700",
    marginRight: 2,
  },
  ringWrapper: {
    alignItems: "center",
    marginVertical: 12,
  },
  // Slim Macro Progress Bars
  macroBarsContainer: {
    marginTop: 10,
    gap: 12,
  },
  macroBarItem: {
    width: "100%",
  },
  macroBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  macroBarLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  macroBarName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  macroBarValues: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  macroTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  macroFill: {
    height: "100%",
    borderRadius: 3,
  },
  // Search Bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 4,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
    paddingVertical: 12,
    fontWeight: "500",
  },
  // Suggestions
  suggestionsContainer: {
    marginTop: 4,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.85)",
    marginBottom: 12,
    fontWeight: "600",
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  chipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
