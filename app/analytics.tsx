import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient as SvgGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import Icon from "react-native-vector-icons/Ionicons";
import Toast from "../components/Toast";
import {
  averageVsTarget,
  DailySummary,
  exportMealsCsv,
  last30Days,
  last7Days,
  loggingStreak,
  macroSplit,
} from "../lib/analytics";
import { FoodLogEntry, loadAll } from "../lib/foodLog";
import { DailyTargets, DEFAULT_DAILY_TARGETS, loadTargets } from "../lib/targets";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 40; // 20px padding on each side
const CHART_HEIGHT = 190;

export default function AnalyticsScreen() {
  const [range, setRange] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Data states
  const [allEntries, setAllEntries] = useState<FoodLogEntry[]>([]);
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_DAILY_TARGETS);
  const [daysData, setDaysData] = useState<DailySummary[]>([]);

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const loadData = useCallback(async () => {
    try {
      const [entries, userTargets] = await Promise.all([
        loadAll(),
        loadTargets(),
      ]);

      setAllEntries(entries);
      setTargets(userTargets);

      const targetCal = userTargets?.calories || 2000;
      const summaries =
        range === 7
          ? last7Days(entries, targetCal)
          : last30Days(entries, targetCal);

      setDaysData(summaries);
      setSelectedDayIndex(summaries.length - 1); // Select today by default
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRangeChange = (newRange: 7 | 30) => {
    setRange(newRange);
    const targetCal = targets?.calories || 2000;
    const summaries =
      newRange === 7
        ? last7Days(allEntries, targetCal)
        : last30Days(allEntries, targetCal);
    setDaysData(summaries);
    setSelectedDayIndex(summaries.length - 1);
  };

  const handleExportCsv = async () => {
    if (exporting) return;
    if (allEntries.length === 0) {
      Alert.alert(
        "No Data",
        "You have not logged any meals yet. Log meals to export your nutritional history."
      );
      return;
    }

    setExporting(true);
    try {
      const res = await exportMealsCsv(allEntries);
      if (res.success) {
        showToast("Export ready! Sharing sheet opened.");
      } else {
        Alert.alert("Export Failed", res.error || "Could not generate CSV file");
      }
    } catch (err: any) {
      Alert.alert("Export Error", err?.message || "Export encountered an issue");
    } finally {
      setExporting(false);
    }
  };

  // Calculations
  const targetCal = targets?.calories || 2000;
  const streak = loggingStreak(allEntries);
  const split = macroSplit(allEntries);
  const avgData = averageVsTarget(daysData, targetCal);
  const selectedDay =
    selectedDayIndex !== null ? daysData[selectedDayIndex] : null;

  // Chart coordinate geometry
  const maxCaloriesInWindow = Math.max(
    ...daysData.map((d) => d.calories),
    targetCal
  );
  const chartMaxY = Math.max(1000, Math.ceil((maxCaloriesInWindow * 1.15) / 500) * 500);

  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 25;
  const paddingBottom = 30;
  const plotWidth = CHART_WIDTH - paddingLeft - paddingRight;
  const plotHeight = CHART_HEIGHT - paddingTop - paddingBottom;

  const targetY =
    paddingTop + plotHeight - (targetCal / chartMaxY) * plotHeight;

  const barCount = daysData.length;
  const slotWidth = plotWidth / barCount;
  const barWidth = range === 7 ? Math.min(26, slotWidth * 0.65) : Math.max(4, slotWidth * 0.7);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d5ef5" />
      </View>
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

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity
          onPress={handleExportCsv}
          style={styles.exportHeaderButton}
          activeOpacity={0.7}
          accessibilityLabel="Export Meals to CSV"
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="share-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, range === 7 && styles.tabButtonActive]}
            onPress={() => handleRangeChange(7)}
            activeOpacity={0.8}
            accessibilityLabel="View 7 Day Analytics"
          >
            <Text
              style={[styles.tabText, range === 7 && styles.tabTextActive]}
            >
              Last 7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, range === 30 && styles.tabButtonActive]}
            onPress={() => handleRangeChange(30)}
            activeOpacity={0.8}
            accessibilityLabel="View 30 Day Analytics"
          >
            <Text
              style={[styles.tabText, range === 30 && styles.tabTextActive]}
            >
              Last 30 Days
            </Text>
          </TouchableOpacity>
        </View>

        {/* Streak & Consistency Card */}
        <View style={styles.card}>
          <View style={styles.streakHeaderRow}>
            <View style={styles.streakIconCircle}>
              <Icon name="flame" size={26} color="#f97316" />
            </View>
            <View style={styles.streakInfoCol}>
              <Text style={styles.streakTitle}>
                {streak.currentStreak}{" "}
                {streak.currentStreak === 1 ? "Day Streak" : "Days Streak"}
              </Text>
              <Text style={styles.streakSubtitle}>
                {streak.isActiveToday
                  ? "Logged today! Streak is secured 🔥"
                  : "Log a meal today to extend your streak!"}
              </Text>
            </View>
            <View style={styles.longestStreakBadge}>
              <Text style={styles.longestStreakLabel}>BEST</Text>
              <Text style={styles.longestStreakValue}>
                {streak.longestStreak}d
              </Text>
            </View>
          </View>
        </View>

        {/* Caloric Intake Bar Chart Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Daily Calorie Intake</Text>
              <Text style={styles.cardSubtitle}>
                Target: {targetCal} kcal / day
              </Text>
            </View>
            {selectedDay && (
              <View style={styles.selectedDayPill}>
                <Text style={styles.selectedDayPillText}>
                  {selectedDay.displayDate}: {selectedDay.calories} kcal
                </Text>
              </View>
            )}
          </View>

          {/* SVG Bar Chart with Accessible Text Alternative */}
          <View
            style={styles.chartWrapper}
            accessible={true}
            accessibilityRole="image"
            accessibilityLabel={`Calorie bar chart for the last ${range} days. Daily average is ${avgData.averageCalories} kilocalories compared to your target of ${targetCal} kilocalories.`}
          >
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <Defs>
                <SvgGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#4ECDC4" />
                  <Stop offset="100%" stopColor="#0d5ef5" />
                </SvgGradient>
                <SvgGradient id="dangerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FF6B6B" />
                  <Stop offset="100%" stopColor="#ee5253" />
                </SvgGradient>
              </Defs>

              {/* Grid Baseline */}
              <Line
                x1={paddingLeft}
                y1={paddingTop + plotHeight}
                x2={paddingLeft + plotWidth}
                y2={paddingTop + plotHeight}
                stroke="#e2e8f0"
                strokeWidth={1}
              />

              {/* Y-Axis Label: Zero */}
              <SvgText
                x={paddingLeft - 8}
                y={paddingTop + plotHeight + 4}
                fontSize={10}
                fill="#94a3b8"
                textAnchor="end"
              >
                0
              </SvgText>

              {/* Target Line & Label */}
              <Line
                x1={paddingLeft}
                y1={targetY}
                x2={paddingLeft + plotWidth}
                y2={targetY}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4, 4"
              />
              <SvgText
                x={paddingLeft - 8}
                y={targetY + 4}
                fontSize={10}
                fill="#f59e0b"
                fontWeight="bold"
                textAnchor="end"
              >
                {targetCal}
              </SvgText>

              {/* Day Bars */}
              <G>
                {daysData.map((day, idx) => {
                  const slotCenter =
                    paddingLeft + idx * slotWidth + slotWidth / 2;
                  const x = slotCenter - barWidth / 2;
                  const rawHeight = (day.calories / chartMaxY) * plotHeight;
                  const height = Math.max(day.calories > 0 ? 3 : 0, rawHeight);
                  const y = paddingTop + plotHeight - height;
                  const isSelected = selectedDayIndex === idx;

                  return (
                    <G key={day.dateKey}>
                      <Rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={height}
                        rx={barWidth / 2}
                        fill={
                          day.isOverTarget
                            ? "url(#dangerGradient)"
                            : isSelected
                            ? "#0d5ef5"
                            : "url(#barGradient)"
                        }
                        opacity={isSelected ? 1.0 : 0.85}
                        onPress={() => setSelectedDayIndex(idx)}
                      />
                      {/* X-Axis Labels */}
                      {(range === 7 || idx % 5 === 0 || idx === barCount - 1) && (
                        <SvgText
                          x={slotCenter}
                          y={paddingTop + plotHeight + 16}
                          fontSize={9}
                          fill={isSelected ? "#0d5ef5" : "#64748b"}
                          fontWeight={isSelected ? "bold" : "normal"}
                          textAnchor="middle"
                        >
                          {range === 7 ? day.dayOfWeek : day.isoDate.slice(8)}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            </Svg>
          </View>

          {/* Accessible Text Summary */}
          <Text style={styles.accessibleAltText}>
            Average: <Text style={{ fontWeight: "700" }}>{avgData.averageCalories} kcal</Text>
            {"  •  "}
            Target: <Text style={{ fontWeight: "700" }}>{targetCal} kcal</Text>
            {"  •  "}
            {avgData.diff <= 0
              ? `${Math.abs(avgData.diff)} kcal under target`
              : `${avgData.diff} kcal over target`}
          </Text>
        </View>

        {/* Macronutrient Calorie Split Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macronutrient Energy Split</Text>
          <Text style={styles.cardSubtitle}>
            Percentage of calories from Protein, Carbs, and Fat (4/4/9 kcal per gram)
          </Text>

          {/* Horizontal Stacked Macro Bar */}
          <View style={styles.macroSegmentTrack}>
            <View
              style={[
                styles.macroSegment,
                {
                  width: `${split.proteinPct}%`,
                  backgroundColor: "#4D96FF",
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                },
              ]}
            />
            <View
              style={[
                styles.macroSegment,
                { width: `${split.carbsPct}%`, backgroundColor: "#FFD93D" },
              ]}
            />
            <View
              style={[
                styles.macroSegment,
                {
                  width: `${split.fatPct}%`,
                  backgroundColor: "#6BCB77",
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                },
              ]}
            />
          </View>

          {/* Macro Breakdown Chips */}
          <View style={styles.macroChipsRow}>
            {/* Protein */}
            <View style={styles.macroChip}>
              <View style={[styles.macroDot, { backgroundColor: "#4D96FF" }]} />
              <View>
                <Text style={styles.macroChipLabel}>Protein ({split.proteinPct}%)</Text>
                <Text style={styles.macroChipValue}>
                  {split.proteinGrams}g ({split.proteinCalories} kcal)
                </Text>
              </View>
            </View>

            {/* Carbs */}
            <View style={styles.macroChip}>
              <View style={[styles.macroDot, { backgroundColor: "#FFD93D" }]} />
              <View>
                <Text style={styles.macroChipLabel}>Carbs ({split.carbsPct}%)</Text>
                <Text style={styles.macroChipValue}>
                  {split.carbsGrams}g ({split.carbsCalories} kcal)
                </Text>
              </View>
            </View>

            {/* Fat */}
            <View style={styles.macroChip}>
              <View style={[styles.macroDot, { backgroundColor: "#6BCB77" }]} />
              <View>
                <Text style={styles.macroChipLabel}>Fat ({split.fatPct}%)</Text>
                <Text style={styles.macroChipValue}>
                  {split.fatGrams}g ({split.fatCalories} kcal)
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Export Data Card */}
        <View style={styles.card}>
          <View style={styles.exportCardHeader}>
            <Icon
              name="document-text-outline"
              size={24}
              color="#0d5ef5"
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Export Meals Spreadsheet</Text>
              <Text style={styles.cardSubtitle}>
                Download complete history formatted as CSV for Excel or Google Sheets
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.exportActionButton, exporting && styles.disabledButton]}
            onPress={handleExportCsv}
            disabled={exporting}
            activeOpacity={0.8}
            accessibilityLabel="Export all meals to CSV spreadsheet"
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon
                  name="download-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.exportActionText}>
                  Export CSV ({allEntries.length} logged {allEntries.length === 1 ? "meal" : "meals"})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  exportHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
  },
  tabTextActive: {
    color: "#0d5ef5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  selectedDayPill: {
    backgroundColor: "rgba(13, 94, 245, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  selectedDayPillText: {
    fontSize: 12,
    color: "#0d5ef5",
    fontWeight: "700",
  },
  chartWrapper: {
    alignItems: "center",
    marginVertical: 6,
  },
  accessibleAltText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
  },
  streakHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  streakInfoCol: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  streakSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  longestStreakBadge: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  longestStreakLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
  },
  longestStreakValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0d5ef5",
  },
  macroSegmentTrack: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    marginTop: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  macroSegment: {
    height: "100%",
  },
  macroChipsRow: {
    flexDirection: "column",
    gap: 10,
  },
  macroChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 12,
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  macroChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  macroChipValue: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  exportCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  exportActionButton: {
    backgroundColor: "#0d5ef5",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
  },
  exportActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
