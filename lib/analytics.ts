// NutriCal Analytics Engine (FEAT-14 Weekly Analytics & CSV Export)
// Pure computational functions over lib/foodLog and export service

import { FoodLogEntry, formatDateKey } from './foodLog';

export interface DailySummary {
  dateKey: string;      // "15/10/2026" via en-GB
  displayDate: string;  // e.g. "Thu 15" or "15 Oct"
  dayOfWeek: string;    // "Thu"
  isoDate: string;      // "2026-10-15"
  calories: number;     // Scaled sum
  protein: number;      // Scaled grams
  carbs: number;        // Scaled grams
  fat: number;          // Scaled grams
  fiber: number;        // Scaled grams
  entryCount: number;
  isOverTarget: boolean;
}

export interface MacroSplit {
  proteinPct: number;       // % of calories (4 kcal/g)
  carbsPct: number;         // % of calories (4 kcal/g)
  fatPct: number;           // % of calories (9 kcal/g)
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  proteinCalories: number;
  carbsCalories: number;
  fatCalories: number;
  totalMacroCalories: number;
}

export interface LoggingStreak {
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
}

export interface AverageVsTarget {
  averageCalories: number;
  targetCalories: number;
  diff: number;             // average - target
  pctOfTarget: number;       // percentage of target achieved
  loggedDaysCount: number;
  totalDaysCount: number;
}

/**
 * Generates an array of consecutive DailySummary objects for the last `daysCount` days ending at `referenceDate`.
 * Days with 0 logged entries are preserved so chart geometry remains intact.
 */
export function getDaysWindow(
  entries: FoodLogEntry[],
  daysCount: number,
  targetCalories = 2000,
  referenceDate = new Date()
): DailySummary[] {
  // Filter active (non-tombstone) entries
  const activeEntries = entries.filter((e) => !e.deleted_at);

  // Group entries by en-GB date key
  const grouped = new Map<string, FoodLogEntry[]>();
  for (const item of activeEntries) {
    const key = formatDateKey(item.timestamp);
    const existing = grouped.get(key) || [];
    existing.push(item);
    grouped.set(key, existing);
  }

  const result: DailySummary[] = [];
  const refTime = referenceDate.getTime();

  // Generate sequence from oldest to newest
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    const dayItems = grouped.get(key) || [];

    let cal = 0;
    let prot = 0;
    let carb = 0;
    let fat = 0;
    let fib = 0;

    for (const item of dayItems) {
      const qty = Number(item.quantity) || 1;
      cal += (Number(item.calories) || 0) * qty;
      prot += (Number(item.protein) || 0) * qty;
      carb += (Number(item.carbs) || 0) * qty;
      fat += (Number(item.fat) || 0) * qty;
      fib += (Number(item.fiber) || 0) * qty;
    }

    const roundedCalories = Math.round(cal);
    const dayOfWeek = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const dayOfMonth = d.getDate();
    const monthShort = d.toLocaleDateString('en-GB', { month: 'short' });
    const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    result.push({
      dateKey: key,
      displayDate: daysCount <= 7 ? `${dayOfWeek} ${dayOfMonth}` : `${dayOfMonth} ${monthShort}`,
      dayOfWeek,
      isoDate,
      calories: roundedCalories,
      protein: Math.round(prot * 10) / 10,
      carbs: Math.round(carb * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      fiber: Math.round(fib * 10) / 10,
      entryCount: dayItems.length,
      isOverTarget: targetCalories > 0 ? roundedCalories > targetCalories : false,
    });
  }

  return result;
}

/**
 * Returns daily summaries for the last 7 calendar days up to referenceDate.
 */
export function last7Days(
  entries: FoodLogEntry[],
  targetCalories = 2000,
  referenceDate = new Date()
): DailySummary[] {
  return getDaysWindow(entries, 7, targetCalories, referenceDate);
}

/**
 * Returns daily summaries for the last 30 calendar days up to referenceDate.
 */
export function last30Days(
  entries: FoodLogEntry[],
  targetCalories = 2000,
  referenceDate = new Date()
): DailySummary[] {
  return getDaysWindow(entries, 30, targetCalories, referenceDate);
}

/**
 * Computes macronutrient caloric contributions and percentage distribution:
 * Protein: 4 kcal/g | Carbs: 4 kcal/g | Fat: 9 kcal/g
 * Ensures percentages sum accurately to 100% when calories exist.
 */
export function macroSplit(entries: FoodLogEntry[]): MacroSplit {
  const active = entries.filter((e) => !e.deleted_at);

  let totalProtG = 0;
  let totalCarbG = 0;
  let totalFatG = 0;

  for (const item of active) {
    const qty = Number(item.quantity) || 1;
    totalProtG += (Number(item.protein) || 0) * qty;
    totalCarbG += (Number(item.carbs) || 0) * qty;
    totalFatG += (Number(item.fat) || 0) * qty;
  }

  const pCal = totalProtG * 4;
  const cCal = totalCarbG * 4;
  const fCal = totalFatG * 9;
  const totalMacroCal = pCal + cCal + fCal;

  if (totalMacroCal <= 0) {
    return {
      proteinPct: 0,
      carbsPct: 0,
      fatPct: 0,
      proteinGrams: 0,
      carbsGrams: 0,
      fatGrams: 0,
      proteinCalories: 0,
      carbsCalories: 0,
      fatCalories: 0,
      totalMacroCalories: 0,
    };
  }

  const pPct = Math.round((pCal / totalMacroCal) * 100);
  const cPct = Math.round((cCal / totalMacroCal) * 100);
  // Ensure the three percentages sum exactly to 100
  const fPct = Math.max(0, 100 - pPct - cPct);

  return {
    proteinPct: pPct,
    carbsPct: cPct,
    fatPct: fPct,
    proteinGrams: Math.round(totalProtG * 10) / 10,
    carbsGrams: Math.round(totalCarbG * 10) / 10,
    fatGrams: Math.round(totalFatG * 10) / 10,
    proteinCalories: Math.round(pCal),
    carbsCalories: Math.round(cCal),
    fatCalories: Math.round(fCal),
    totalMacroCalories: Math.round(totalMacroCal),
  };
}

/**
 * Calculates current consecutive day logging streak and all-time longest streak.
 * Uses toLocaleDateString("en-GB") date keys.
 * If user hasn't logged today yet, yesterday's streak is preserved as active.
 */
export function loggingStreak(
  entries: FoodLogEntry[],
  referenceDate = new Date()
): LoggingStreak {
  const active = entries.filter((e) => !e.deleted_at);
  if (active.length === 0) {
    return { currentStreak: 0, longestStreak: 0, isActiveToday: false };
  }

  // Set of all unique logged date keys
  const loggedDateKeys = new Set<string>();
  const parsedDates: number[] = [];

  for (const item of active) {
    const key = formatDateKey(item.timestamp);
    if (!loggedDateKeys.has(key)) {
      loggedDateKeys.add(key);
      const parsed = typeof item.timestamp === 'string' ? new Date(item.timestamp) : item.timestamp;
      // Normalize to midnight in local time for consistent day-gap calculation
      const dayMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
      parsedDates.push(dayMidnight);
    }
  }

  const todayKey = formatDateKey(referenceDate);
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const hasToday = loggedDateKeys.has(todayKey);
  const hasYesterday = loggedDateKeys.has(yesterdayKey);

  // 1. Current Streak
  let currentStreak = 0;
  if (hasToday || hasYesterday) {
    let dayIndex = hasToday ? 0 : 1;
    while (true) {
      const checkDate = new Date(referenceDate);
      checkDate.setDate(checkDate.getDate() - dayIndex);
      const checkKey = formatDateKey(checkDate);
      if (loggedDateKeys.has(checkKey)) {
        currentStreak++;
        dayIndex++;
      } else {
        break;
      }
    }
  }

  // 2. Longest Historical Streak
  // Sort distinct day timestamps
  parsedDates.sort((a, b) => a - b);
  let longestStreak = currentStreak;
  let tempStreak = 1;

  for (let i = 1; i < parsedDates.length; i++) {
    const diffDays = Math.round((parsedDates[i] - parsedDates[i - 1]) / 86400000);
    if (diffDays === 1) {
      tempStreak++;
    } else if (diffDays > 1) {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    isActiveToday: hasToday,
  };
}

/**
 * Calculates average calories consumed per day versus target over a window.
 */
export function averageVsTarget(
  days: DailySummary[],
  targetCalories = 2000
): AverageVsTarget {
  if (days.length === 0) {
    return {
      averageCalories: 0,
      targetCalories,
      diff: -targetCalories,
      pctOfTarget: 0,
      loggedDaysCount: 0,
      totalDaysCount: 0,
    };
  }

  const totalCalories = days.reduce((sum, d) => sum + d.calories, 0);
  const loggedDays = days.filter((d) => d.calories > 0);
  const averageCalories = Math.round(totalCalories / days.length);
  const diff = averageCalories - targetCalories;
  const pctOfTarget = targetCalories > 0 ? Math.round((averageCalories / targetCalories) * 100) : 0;

  return {
    averageCalories,
    targetCalories,
    diff,
    pctOfTarget,
    loggedDaysCount: loggedDays.length,
    totalDaysCount: days.length,
  };
}

/**
 * RFC 4180 compliant CSV field escaper.
 * Quotes fields containing commas, double-quotes, or newlines, escaping internal quotes as `""`.
 */
export function escapeCsvField(val: string | number | undefined | null): string {
  if (val == null) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 CSV spreadsheet string from all active meal entries.
 * Columns: date, time, name, serving_size, quantity, calories, protein, carbs, fat, fiber
 */
export function generateMealsCsv(entries: FoodLogEntry[]): string {
  const active = entries.filter((e) => !e.deleted_at);

  // Sort descending by timestamp (newest meals at top)
  const sorted = [...active].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const headers = [
    'date',
    'time',
    'name',
    'serving_size',
    'quantity',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
  ];

  const rows: string[] = [headers.join(',')];

  for (const item of sorted) {
    const d = new Date(item.timestamp);
    const dateStr = formatDateKey(d);
    const timeStr = isNaN(d.getTime())
      ? '00:00'
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const qty = Number(item.quantity) || 1;
    const scaledCalories = Math.round((Number(item.calories) || 0) * qty);
    const scaledProtein = Math.round(((Number(item.protein) || 0) * qty) * 10) / 10;
    const scaledCarbs = Math.round(((Number(item.carbs) || 0) * qty) * 10) / 10;
    const scaledFat = Math.round(((Number(item.fat) || 0) * qty) * 10) / 10;
    const scaledFiber = Math.round(((Number(item.fiber) || 0) * qty) * 10) / 10;

    const row = [
      escapeCsvField(dateStr),
      escapeCsvField(timeStr),
      escapeCsvField(item.name),
      escapeCsvField(item.serving_size),
      escapeCsvField(qty),
      escapeCsvField(scaledCalories),
      escapeCsvField(scaledProtein),
      escapeCsvField(scaledCarbs),
      escapeCsvField(scaledFat),
      escapeCsvField(scaledFiber),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Writes the meal entries to a temporary CSV file and opens the OS sharing sheet.
 */
export async function exportMealsCsv(
  entries: FoodLogEntry[]
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const csvContent = generateMealsCsv(entries);
    const fileName = `nutrical_meals_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;

    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');

    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) {
      throw new Error('Storage directory unavailable for file export');
    }

    const filePath = `${cacheDir}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export NutriCal Meals',
        UTI: 'public.comma-separated-values-text',
      });
    }

    return { success: true, filePath };
  } catch (err: any) {
    console.error('CSV export failed:', err);
    return { success: false, error: err?.message || 'Export failed' };
  }
}

const analytics = {
  last7Days,
  last30Days,
  getDaysWindow,
  macroSplit,
  loggingStreak,
  averageVsTarget,
  escapeCsvField,
  generateMealsCsv,
  exportMealsCsv,
};

export default analytics;
