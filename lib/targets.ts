export const DAILY_TARGETS_KEY = '@daily_targets';

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  updated_at: string; // ISO 8601 UTC
}

export const DEFAULT_DAILY_TARGETS: DailyTargets = {
  calories: 2000,
  protein: 100,
  carbs: 250,
  fat: 65,
  updated_at: '2026-10-15T00:00:00.000Z',
};

export interface TargetValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  warning?: string;
}

export interface TargetProgress {
  percentage: number; // e.g. 0, 50, 100, 140
  remaining: number; // target - consumed (can be negative)
  isOver: boolean; // consumed > target
  clampedPercentage: number; // 0 to 100 (for SVG stroke rendering)
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface MifflinStJeorParams {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
}

export interface SuggestedTargets {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

let customStorage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (customStorage) {
    return customStorage;
  }
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    return AsyncStorage.default || AsyncStorage;
  } catch {
    const memory = new Map<string, string>();
    customStorage = {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, val: string) => {
        memory.set(key, val);
      },
      removeItem: async (key: string) => {
        memory.delete(key);
      },
    };
    return customStorage;
  }
}

export function setStorageAdapter(adapter: StorageAdapter | null): void {
  customStorage = adapter;
}

/**
 * Validates targets per rules:
 * - Calories must be between 800 and 6000.
 * - Macros must be non-negative.
 * - Shows a warning (not a block) when calories < 1200 specifying general info, not medical advice.
 */
export function validateTargets(targets: Partial<DailyTargets>): TargetValidationResult {
  const errors: Record<string, string> = {};
  let warning: string | undefined;

  const calories = Number(targets.calories);
  if (isNaN(calories)) {
    errors.calories = 'Calories must be a valid number';
  } else if (calories < 800) {
    errors.calories = 'Daily calorie target must be at least 800 kcal';
  } else if (calories > 6000) {
    errors.calories = 'Daily calorie target cannot exceed 6,000 kcal';
  } else if (calories < 1200) {
    warning =
      'A daily target below 1,200 calories is very low for most individuals. This is general wellness information, not medical advice. Consider consulting a healthcare professional.';
  }

  const protein = Number(targets.protein);
  if (isNaN(protein) || protein < 0) {
    errors.protein = 'Protein must be a non-negative number';
  }

  const carbs = Number(targets.carbs);
  if (isNaN(carbs) || carbs < 0) {
    errors.carbs = 'Carbohydrates must be a non-negative number';
  }

  const fat = Number(targets.fat);
  if (isNaN(fat) || fat < 0) {
    errors.fat = 'Fat must be a non-negative number';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warning,
  };
}

/**
 * Loads daily targets from local storage.
 * Falls back to DEFAULT_DAILY_TARGETS if not yet configured.
 */
export async function loadTargets(): Promise<DailyTargets> {
  const storage = getStorage();
  try {
    const raw = await storage.getItem(DAILY_TARGETS_KEY);
    if (!raw) {
      return { ...DEFAULT_DAILY_TARGETS, updated_at: new Date().toISOString() };
    }
    const parsed = JSON.parse(raw);
    return {
      calories: Number(parsed.calories) || DEFAULT_DAILY_TARGETS.calories,
      protein: Number(parsed.protein) || DEFAULT_DAILY_TARGETS.protein,
      carbs: Number(parsed.carbs) || DEFAULT_DAILY_TARGETS.carbs,
      fat: Number(parsed.fat) || DEFAULT_DAILY_TARGETS.fat,
      updated_at: parsed.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error loading daily targets:', err);
    return { ...DEFAULT_DAILY_TARGETS, updated_at: new Date().toISOString() };
  }
}

export type TargetChangeListener = (targets: DailyTargets) => void;
const targetListeners: Set<TargetChangeListener> = new Set();

export function onTargetsChange(listener: TargetChangeListener): () => void {
  targetListeners.add(listener);
  return () => {
    targetListeners.delete(listener);
  };
}

function notifyTargetListeners(targets: DailyTargets): void {
  targetListeners.forEach((fn) => {
    try {
      fn(targets);
    } catch (err) {
      console.error('Error in target listener:', err);
    }
  });
}

/**
 * Saves validated daily targets to local storage.
 */
export async function saveTargets(newTargets: Partial<DailyTargets>): Promise<DailyTargets> {
  const existing = await loadTargets();
  const merged: DailyTargets = {
    calories: Math.round(Number(newTargets.calories ?? existing.calories)),
    protein: Math.round(Number(newTargets.protein ?? existing.protein)),
    carbs: Math.round(Number(newTargets.carbs ?? existing.carbs)),
    fat: Math.round(Number(newTargets.fat ?? existing.fat)),
    updated_at: new Date().toISOString(),
  };

  const validation = validateTargets(merged);
  if (!validation.valid) {
    throw new Error(`Target validation failed: ${JSON.stringify(validation.errors)}`);
  }

  const storage = getStorage();
  await storage.setItem(DAILY_TARGETS_KEY, JSON.stringify(merged));
  notifyTargetListeners(merged);
  return merged;
}

/**
 * Applies targets received from cloud sync if remote is newer or equal.
 * Does not re-trigger dirty listener.
 */
export async function saveTargetsFromRemote(remoteTargets: DailyTargets): Promise<boolean> {
  const storage = getStorage();
  const raw = await storage.getItem(DAILY_TARGETS_KEY);

  // If local targets have never been configured, remote targets always apply
  if (!raw) {
    const merged: DailyTargets = {
      calories: Math.max(800, Math.min(6000, Number(remoteTargets.calories) || DEFAULT_DAILY_TARGETS.calories)),
      protein: Math.max(0, Math.min(1000, Number(remoteTargets.protein) || DEFAULT_DAILY_TARGETS.protein)),
      carbs: Math.max(0, Math.min(1000, Number(remoteTargets.carbs) || DEFAULT_DAILY_TARGETS.carbs)),
      fat: Math.max(0, Math.min(1000, Number(remoteTargets.fat) || DEFAULT_DAILY_TARGETS.fat)),
      updated_at: remoteTargets.updated_at,
    };
    await storage.setItem(DAILY_TARGETS_KEY, JSON.stringify(merged));
    return true;
  }

  const existing = await loadTargets();
  const remoteTime = new Date(remoteTargets.updated_at).getTime();
  const localTime = new Date(existing.updated_at).getTime();

  if (remoteTime >= localTime) {
    const merged: DailyTargets = {
      calories: Math.max(800, Math.min(6000, Number(remoteTargets.calories) || DEFAULT_DAILY_TARGETS.calories)),
      protein: Math.max(0, Math.min(1000, Number(remoteTargets.protein) || DEFAULT_DAILY_TARGETS.protein)),
      carbs: Math.max(0, Math.min(1000, Number(remoteTargets.carbs) || DEFAULT_DAILY_TARGETS.carbs)),
      fat: Math.max(0, Math.min(1000, Number(remoteTargets.fat) || DEFAULT_DAILY_TARGETS.fat)),
      updated_at: remoteTargets.updated_at,
    };
    await storage.setItem(DAILY_TARGETS_KEY, JSON.stringify(merged));
    return true;
  }
  return false;
}

/**
 * Calculates percentage, remaining calories, and danger state.
 * Percentage formula: Math.round((consumed / target) * 100).
 */
export function calculateProgress(consumed: number, target: number): TargetProgress {
  const validConsumed = Math.max(0, Number(consumed) || 0);
  const validTarget = Math.max(1, Number(target) || DEFAULT_DAILY_TARGETS.calories);

  const rawFraction = validConsumed / validTarget;
  const percentage = Math.round(rawFraction * 100);
  const remaining = Math.round(validTarget - validConsumed);
  const isOver = validConsumed > validTarget;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return {
    percentage,
    remaining,
    isOver,
    clampedPercentage,
  };
}

/**
 * Suggests a calorie target and balanced macro split using the Mifflin-St Jeor equation:
 * Men: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + 5
 * Women: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) - 161
 */
export function calculateMifflinStJeor(params: MifflinStJeorParams): SuggestedTargets {
  const { age, sex, heightCm, weightKg, activity } = params;

  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  const activityMultipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  const multiplier = activityMultipliers[activity] || 1.2;
  const tdee = Math.round(bmr * multiplier);
  const calories = Math.max(1200, Math.min(4500, tdee));

  // Balanced macronutrient split: 25% Protein, 50% Carbs, 25% Fat
  // Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g
  const protein = Math.round((calories * 0.25) / 4);
  const carbs = Math.round((calories * 0.50) / 4);
  const fat = Math.round((calories * 0.25) / 9);

  return {
    bmr: Math.round(bmr),
    tdee,
    calories,
    protein,
    carbs,
    fat,
  };
}

const targetsModule = {
  loadTargets,
  saveTargets,
  validateTargets,
  calculateProgress,
  calculateMifflinStJeor,
  DEFAULT_DAILY_TARGETS,
  setStorageAdapter,
  getStorage,
};

export default targetsModule;
