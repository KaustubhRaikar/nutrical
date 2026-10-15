export interface NormalizedFoodProduct {
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  category: string;
  barcode: string;
}

const DEFAULT_APP_VERSION = '4.1.0';
const CONTACT_EMAIL = 'support@aarambhtech.in';

export function getUserAgent(): string {
  let version = DEFAULT_APP_VERSION;
  try {
    // Dynamically require expo-constants to support Node test execution without Flow syntax errors
    const Constants = require('expo-constants');
    const cfg = Constants.default?.expoConfig || Constants.expoConfig;
    if (cfg?.version) {
      version = cfg.version;
    }
  } catch {
    // Fallback for non-Expo / Node test environments
  }
  return `NutriCal/${version} (${CONTACT_EMAIL})`;
}

/**
 * Extracts and normalizes nutriment values from an OpenFoodFacts product payload.
 * Handles kcal and kJ fallbacks per memory.md 3.4 and PRD specifications.
 * Normalizes portion to per-100g with serving_size labeled "100g".
 */
export function extractNutriments(product: any, barcode = ''): NormalizedFoodProduct {
  const nutriments = product?.nutriments || {};

  // Calorie extraction with prioritized fallbacks:
  // 1. energy-kcal_100g
  // 2. energy-kcal
  // 3. energy-kj_100g / 4.184
  // 4. energy_100g / 4.184 (when energy_100g is in kJ)
  // 5. energy / 4.184
  let calories = 0;
  if (nutriments['energy-kcal_100g'] != null && nutriments['energy-kcal_100g'] !== '') {
    calories = Number(nutriments['energy-kcal_100g']);
  } else if (nutriments['energy-kcal'] != null && nutriments['energy-kcal'] !== '') {
    calories = Number(nutriments['energy-kcal']);
  } else if (nutriments['energy-kj_100g'] != null && nutriments['energy-kj_100g'] !== '') {
    calories = Math.round(Number(nutriments['energy-kj_100g']) / 4.184);
  } else if (nutriments['energy_100g'] != null && nutriments['energy_100g'] !== '') {
    calories = Math.round(Number(nutriments['energy_100g']) / 4.184);
  } else if (nutriments.energy != null && nutriments.energy !== '') {
    calories = Math.round(Number(nutriments.energy) / 4.184);
  }

  const protein = Number(nutriments.proteins_100g ?? nutriments.proteins ?? 0) || 0;
  const carbs = Number(nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0) || 0;
  const fat = Number(nutriments.fat_100g ?? nutriments.fat ?? 0) || 0;
  const fiber = Number(nutriments.fiber_100g ?? nutriments.fiber ?? 0) || 0;

  const productName = product.product_name || product.product_name_en || 'Unknown Product';
  const effectiveBarcode = barcode || product.code || '';

  return {
    name: productName,
    serving_size: '100g',
    calories: Math.round(calories) || 0,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    category: 'Scanned',
    barcode: effectiveBarcode,
  };
}

/**
 * Queries OpenFoodFacts v2 product API with an 8-second timeout and required User-Agent.
 * Returns normalized product or null if not found or status !== 1.
 */
export async function fetchOpenFoodFactsProduct(
  barcode: string,
  timeoutMs = 8000
): Promise<NormalizedFoodProduct | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': getUserAgent(),
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status === 1 && data.product) {
      return extractNutriments(data.product, barcode);
    }

    return null;
  } finally {
    clearTimeout(timer);
  }
}
