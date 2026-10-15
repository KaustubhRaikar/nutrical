import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import Toast from "../components/Toast";
import {
  ActivityLevel,
  Sex,
  SuggestedTargets,
  calculateMifflinStJeor,
  loadTargets,
  saveTargets,
  validateTargets,
} from "../lib/targets";

export default function GoalsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form inputs
  const [calories, setCalories] = useState("2000");
  const [protein, setProtein] = useState("100");
  const [carbs, setCarbs] = useState("250");
  const [fat, setFat] = useState("65");

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | undefined>();

  // Calculator Helper State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcAge, setCalcAge] = useState("28");
  const [calcSex, setCalcSex] = useState<Sex>("male");
  const [calcHeight, setCalcHeight] = useState("175");
  const [calcWeight, setCalcWeight] = useState("70");
  const [calcActivity, setCalcActivity] = useState<ActivityLevel>("moderate");
  const [suggested, setSuggested] = useState<SuggestedTargets | null>(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    loadInitialTargets();
  }, []);

  const loadInitialTargets = async () => {
    try {
      const current = await loadTargets();
      setCalories(current.calories.toString());
      setProtein(current.protein.toString());
      setCarbs(current.carbs.toString());
      setFat(current.fat.toString());
    } catch (e) {
      console.error("Failed to load targets:", e);
    } finally {
      setLoading(false);
    }
  };

  // Re-validate whenever form inputs change
  useEffect(() => {
    const val = validateTargets({
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
    });
    setErrors(val.errors);
    setWarning(val.warning);
  }, [calories, protein, carbs, fat]);

  const handleSave = async () => {
    Keyboard.dismiss();
    const validation = validateTargets({
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      await saveTargets({
        calories: Number(calories),
        protein: Number(protein),
        carbs: Number(carbs),
        fat: Number(fat),
      });

      setToastMessage("Daily targets updated successfully!");
      setToastVisible(true);

      setTimeout(() => {
        router.back();
      }, 1200);
    } catch (err) {
      console.error("Save targets error:", err);
      alert("Failed to save targets. Please check your values.");
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateRecommendation = () => {
    Keyboard.dismiss();
    const age = Number(calcAge) || 25;
    const heightCm = Number(calcHeight) || 170;
    const weightKg = Number(calcWeight) || 70;

    const result = calculateMifflinStJeor({
      age,
      sex: calcSex,
      heightCm,
      weightKg,
      activity: calcActivity,
    });

    setSuggested(result);
  };

  const handleAcceptSuggestion = () => {
    if (!suggested) return;
    // Pre-fill form for user to review and edit; never auto-apply or auto-save
    setCalories(suggested.calories.toString());
    setProtein(suggested.protein.toString());
    setCarbs(suggested.carbs.toString());
    setFat(suggested.fat.toString());
    setShowCalculator(false);
    setToastMessage("Recommendation copied to form. Review and save!");
    setToastVisible(true);
  };

  if (loading) {
    return (
      <LinearGradient colors={["#0d5ef5", "#4ECDC4"]} style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const isFormValid = Object.keys(errors).length === 0;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={["#0d5ef5", "#4ECDC4"]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Targets</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Target Inputs Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nutrition Goals</Text>
              <Text style={styles.cardSubtitle}>
                Customize your daily caloric and macronutrient targets.
              </Text>

              {/* Calories Input */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Daily Calorie Target</Text>
                  <Text style={styles.inputUnit}>kcal</Text>
                </View>
                <TextInput
                  style={[styles.input, errors.calories && styles.inputError]}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  placeholder="2000"
                  placeholderTextColor="#94A3B8"
                />
                {errors.calories ? (
                  <Text style={styles.errorText}>{errors.calories}</Text>
                ) : null}
              </View>

              {/* Warning when < 1200 kcal */}
              {warning ? (
                <View style={styles.warningBox}>
                  <Icon name="alert-circle-outline" size={20} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ) : null}

              {/* Macro Inputs Row */}
              <View style={styles.macrosRow}>
                {/* Protein */}
                <View style={styles.macroCol}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.dot, { backgroundColor: "#FF6B6B" }]} />
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <TextInput
                    style={[styles.macroInput, errors.protein && styles.inputError]}
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.macroUnit}>grams</Text>
                  {errors.protein ? (
                    <Text style={styles.errorTextSmall}>{errors.protein}</Text>
                  ) : null}
                </View>

                {/* Carbs */}
                <View style={styles.macroCol}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.dot, { backgroundColor: "#4ECDC4" }]} />
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <TextInput
                    style={[styles.macroInput, errors.carbs && styles.inputError]}
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="numeric"
                    placeholder="250"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.macroUnit}>grams</Text>
                  {errors.carbs ? (
                    <Text style={styles.errorTextSmall}>{errors.carbs}</Text>
                  ) : null}
                </View>

                {/* Fat */}
                <View style={styles.macroCol}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.dot, { backgroundColor: "#F7B731" }]} />
                    <Text style={styles.macroLabel}>Fat</Text>
                  </View>
                  <TextInput
                    style={[styles.macroInput, errors.fat && styles.inputError]}
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="numeric"
                    placeholder="65"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.macroUnit}>grams</Text>
                  {errors.fat ? (
                    <Text style={styles.errorTextSmall}>{errors.fat}</Text>
                  ) : null}
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!isFormValid || saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Targets</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Mifflin-St Jeor Calculator Card */}
            <View style={styles.calcCard}>
              <TouchableOpacity
                style={styles.calcHeader}
                onPress={() => setShowCalculator(!showCalculator)}
                activeOpacity={0.7}
              >
                <View style={styles.calcTitleRow}>
                  <Icon name="calculator-outline" size={22} color="#0d5ef5" />
                  <Text style={styles.calcTitle}>Mifflin-St Jeor Calculator</Text>
                </View>
                <Icon
                  name={showCalculator ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showCalculator && (
                <View style={styles.calcBody}>
                  <Text style={styles.calcSubtitle}>
                    Estimate your daily energy expenditure and recommended macro split based on your biometric profile.
                  </Text>

                  {/* Sex Selector */}
                  <View style={styles.calcField}>
                    <Text style={styles.calcFieldLabel}>Biological Sex</Text>
                    <View style={styles.segmentedControl}>
                      <TouchableOpacity
                        style={[
                          styles.segmentButton,
                          calcSex === "male" && styles.segmentButtonActive,
                        ]}
                        onPress={() => setCalcSex("male")}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            calcSex === "male" && styles.segmentTextActive,
                          ]}
                        >
                          Male
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentButton,
                          calcSex === "female" && styles.segmentButtonActive,
                        ]}
                        onPress={() => setCalcSex("female")}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            calcSex === "female" && styles.segmentTextActive,
                          ]}
                        >
                          Female
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Age, Height, Weight Row */}
                  <View style={styles.biometricsRow}>
                    <View style={styles.biometricCol}>
                      <Text style={styles.calcFieldLabel}>Age</Text>
                      <TextInput
                        style={styles.calcInput}
                        value={calcAge}
                        onChangeText={setCalcAge}
                        keyboardType="numeric"
                        placeholder="28"
                      />
                    </View>

                    <View style={styles.biometricCol}>
                      <Text style={styles.calcFieldLabel}>Height (cm)</Text>
                      <TextInput
                        style={styles.calcInput}
                        value={calcHeight}
                        onChangeText={setCalcHeight}
                        keyboardType="numeric"
                        placeholder="175"
                      />
                    </View>

                    <View style={styles.biometricCol}>
                      <Text style={styles.calcFieldLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.calcInput}
                        value={calcWeight}
                        onChangeText={setCalcWeight}
                        keyboardType="numeric"
                        placeholder="70"
                      />
                    </View>
                  </View>

                  {/* Activity Level Selector */}
                  <View style={styles.calcField}>
                    <Text style={styles.calcFieldLabel}>Physical Activity</Text>
                    <View style={styles.activityButtons}>
                      {(
                        [
                          { key: "sedentary", label: "Sedentary (office work)" },
                          { key: "light", label: "Light (1-2 days/wk)" },
                          { key: "moderate", label: "Moderate (3-5 days/wk)" },
                          { key: "active", label: "Active (6-7 days/wk)" },
                          { key: "very_active", label: "Very Active (athletes)" },
                        ] as const
                      ).map((act) => (
                        <TouchableOpacity
                          key={act.key}
                          style={[
                            styles.activityBtn,
                            calcActivity === act.key && styles.activityBtnActive,
                          ]}
                          onPress={() => setCalcActivity(act.key)}
                        >
                          <Text
                            style={[
                              styles.activityBtnText,
                              calcActivity === act.key && styles.activityBtnTextActive,
                            ]}
                          >
                            {act.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Calculate Button */}
                  <TouchableOpacity
                    style={styles.calcActionBtn}
                    onPress={handleCalculateRecommendation}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.calcActionBtnText}>
                      Calculate Recommendation
                    </Text>
                  </TouchableOpacity>

                  {/* Suggested Results Card */}
                  {suggested && (
                    <View style={styles.suggestionResultCard}>
                      <Text style={styles.suggestionResultTitle}>
                        Suggested Targets
                      </Text>
                      <View style={styles.suggestedGrid}>
                        <View style={styles.suggestedMetric}>
                          <Text style={styles.suggestedMetricVal}>
                            {suggested.calories}
                          </Text>
                          <Text style={styles.suggestedMetricLabel}>CALORIES</Text>
                        </View>
                        <View style={styles.suggestedMetric}>
                          <Text style={[styles.suggestedMetricVal, { color: "#FF6B6B" }]}>
                            {suggested.protein}g
                          </Text>
                          <Text style={styles.suggestedMetricLabel}>PROTEIN</Text>
                        </View>
                        <View style={styles.suggestedMetric}>
                          <Text style={[styles.suggestedMetricVal, { color: "#4ECDC4" }]}>
                            {suggested.carbs}g
                          </Text>
                          <Text style={styles.suggestedMetricLabel}>CARBS</Text>
                        </View>
                        <View style={styles.suggestedMetric}>
                          <Text style={[styles.suggestedMetricVal, { color: "#F7B731" }]}>
                            {suggested.fat}g
                          </Text>
                          <Text style={styles.suggestedMetricLabel}>FAT</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.applyBtn}
                        onPress={handleAcceptSuggestion}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.applyBtnText}>
                          Copy to Form (Review & Edit)
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.disclaimerText}>
                        Applying copies these values to the form above. You can customize them freely before saving.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Toast
          visible={toastVisible}
          message={toastMessage}
          onDismiss={() => setToastVisible(false)}
        />
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  inputUnit: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  errorTextSmall: {
    color: "#EF4444",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  warningText: {
    color: "#92400E",
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
    fontWeight: "500",
  },
  macrosRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  macroCol: {
    flex: 1,
  },
  macroLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  macroInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  macroUnit: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#0d5ef5",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#0d5ef5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Calculator Card
  calcCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  calcHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  calcTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  calcTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  calcBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  calcSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 18,
  },
  calcField: {
    marginBottom: 14,
  },
  calcFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  segmentTextActive: {
    color: "#0d5ef5",
  },
  biometricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  biometricCol: {
    flex: 1,
  },
  calcInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  activityButtons: {
    gap: 6,
  },
  activityBtn: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  activityBtnActive: {
    backgroundColor: "rgba(13, 94, 245, 0.08)",
    borderColor: "#0d5ef5",
  },
  activityBtnText: {
    fontSize: 12,
    color: "#475569",
  },
  activityBtnTextActive: {
    color: "#0d5ef5",
    fontWeight: "bold",
  },
  calcActionBtn: {
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  calcActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionResultCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  suggestionResultTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 12,
  },
  suggestedGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  suggestedMetric: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  suggestedMetricVal: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
  },
  suggestedMetricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  applyBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  disclaimerText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 14,
  },
});
