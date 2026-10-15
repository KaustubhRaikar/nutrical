import { apiFetch } from './apiClient';
import * as foodLog from './foodLog';
import { FoodLogEntry } from './foodLog';

export interface AiDish {
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence?: number;
}

export interface AiVisionScanResponse {
  success: boolean;
  is_food: boolean;
  message?: string;
  dishes?: AiDish[];
}

export interface AnalyzeOptions {
  mimeType?: string;
  devBypass?: boolean;
  mockForTest?: boolean;
}

export class OfflineVisionError extends Error {
  constructor(message = 'AI food scan requires an internet connection. Would you like to switch to Barcode Scanner or manual search?') {
    super(message);
    this.name = 'OfflineVisionError';
  }
}

/**
 * Checks whether device is online via NetInfo.
 */
export async function checkVisionIsOnline(): Promise<boolean> {
  try {
    const NetInfo = require('@react-native-community/netinfo');
    const state = await NetInfo.fetch();
    return state.isConnected !== false;
  } catch {
    return true; // Fallback assuming online if NetInfo fails
  }
}

/**
 * Dispatches image payload to backend proxy for Gemini 1.5 Flash analysis.
 * Verifies network connectivity before upload to honor offline resilience principles.
 */
export async function analyzeFoodImage(
  imageBase64: string,
  options?: AnalyzeOptions
): Promise<AiVisionScanResponse> {
  const isOnline = await checkVisionIsOnline();
  if (!isOnline) {
    throw new OfflineVisionError();
  }

  const payload = {
    image_base64: imageBase64,
    mime_type: options?.mimeType || 'image/jpeg',
    dev_test_bypass: options?.devBypass,
    mock_for_test: options?.mockForTest,
  };

  const response = await apiFetch<AiVisionScanResponse>('ai_vision_scan', {
    method: 'POST',
    body: payload,
    timeoutMs: 30000,
  });

  return response;
}

/**
 * Adds confirmed AI dishes into the local offline diary log (@saved_foods).
 * Strictly preserves calorie arithmetic rules (Number(x) || 0).
 */
export async function logAiDishes(
  items: { dish: AiDish; quantity: number }[]
): Promise<FoodLogEntry[]> {
  const savedEntries: FoodLogEntry[] = [];
  const nowIso = new Date().toISOString();

  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const dish = item.dish;

    const entry = await foodLog.add({
      name: dish.name,
      serving_size: dish.serving_size,
      calories: Number(dish.calories) || 0,
      protein: Number(dish.protein) || 0,
      carbs: Number(dish.carbs) || 0,
      fat: Number(dish.fat) || 0,
      fiber: Number(dish.fiber) || 0,
      quantity: qty,
      category: 'AI Vision',
      timestamp: nowIso,
    });

    savedEntries.push(entry);
  }

  return savedEntries;
}
