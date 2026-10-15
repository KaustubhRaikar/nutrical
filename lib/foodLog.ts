export const SAVED_FOODS_KEY = '@saved_foods';
export const SAVED_FOODS_SCHEMA_KEY = '@saved_foods_schema';
export const SAVED_FOODS_BACKUP_KEY = '@saved_foods_backup_v1';
export const CURRENT_SCHEMA_VERSION = '1';

export interface FoodLogEntry {
  id: string; // UUID v4
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  timestamp: string; // ISO 8601 UTC
  quantity: number; // default 1
  updated_at: string; // ISO 8601 UTC
  deleted_at?: string | null; // Tombstone for sync conflict resolution
  category?: string;
  barcode?: string;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type FoodLogChangeListener = (id: string, action: 'add' | 'update' | 'remove') => void;
const changeListeners: Set<FoodLogChangeListener> = new Set();

export function onFoodLogChange(listener: FoodLogChangeListener): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

function notifyFoodLogListeners(id: string, action: 'add' | 'update' | 'remove'): void {
  changeListeners.forEach((fn) => {
    try {
      fn(id, action);
    } catch (err) {
      console.error('Error in foodLog listener:', err);
    }
  });
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
      setItem: async (key: string, val: string) => { memory.set(key, val); },
      removeItem: async (key: string) => { memory.delete(key); },
    };
    return customStorage;
  }
}

export function setStorageAdapter(adapter: StorageAdapter | null): void {
  customStorage = adapter;
}

/**
 * Generates an RFC4122 v4 UUID string.
 * Uses expo-crypto on native runtime with Web Crypto / random fallbacks for test environments.
 */
export function generateUuid(): string {
  try {
    const Crypto = require('expo-crypto');
    if (Crypto && typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Continue to fallbacks
  }

  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats a date or timestamp into the standard British DD/MM/YYYY key.
 * Memory quirk 3.5: Grouping uses toLocaleDateString("en-GB").
 */
export function formatDateKey(timestamp: string | Date): string {
  const dateObj = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (isNaN(dateObj.getTime())) {
    return new Date().toLocaleDateString('en-GB');
  }
  return dateObj.toLocaleDateString('en-GB');
}

/**
 * One-time idempotent migration:
 * Checks @saved_foods_schema. If not current, backs up the raw old array to
 * @saved_foods_backup_v1, assigns id, quantity=1, updated_at=timestamp to every entry,
 * preserves order and data, and marks schema version '1'.
 */
export async function migrateIfNeeded(): Promise<void> {
  const storage = getStorage();
  const schemaVersion = await storage.getItem(SAVED_FOODS_SCHEMA_KEY);
  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    return;
  }

  const rawOldData = await storage.getItem(SAVED_FOODS_KEY);
  if (rawOldData) {
    // 1. Back up raw old array before migration
    await storage.setItem(SAVED_FOODS_BACKUP_KEY, rawOldData);

    try {
      const parsed = JSON.parse(rawOldData);
      if (Array.isArray(parsed)) {
        const migrated: FoodLogEntry[] = parsed.map((item: any) => {
          const timestamp = item.timestamp || new Date().toISOString();
          return {
            ...item,
            id: item.id || generateUuid(),
            quantity: item.quantity != null ? Number(item.quantity) : 1,
            updated_at: item.updated_at || timestamp,
            deleted_at: item.deleted_at || null,
            calories: Number(item.calories) || 0,
            protein: Number(item.protein) || 0,
            carbs: Number(item.carbs) || 0,
            fat: Number(item.fat) || 0,
            fiber: Number(item.fiber) || 0,
          };
        });

        await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(migrated));
      }
    } catch (err) {
      console.error('Error migrating @saved_foods data:', err);
    }
  }

  await storage.setItem(SAVED_FOODS_SCHEMA_KEY, CURRENT_SCHEMA_VERSION);
}

/**
 * Loads all raw food log entries from storage, including soft-deleted tombstones.
 * Primarily used by the sync engine.
 */
export async function loadRawAll(): Promise<FoodLogEntry[]> {
  await migrateIfNeeded();
  const storage = getStorage();
  const raw = await storage.getItem(SAVED_FOODS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse @saved_foods:', err);
    return [];
  }
}

/**
 * Loads all active food log entries from storage (filtering out tombstones).
 * Used by UI screens, daily totals, and history views.
 */
export async function loadAll(): Promise<FoodLogEntry[]> {
  const rawList = await loadRawAll();
  return rawList.filter((e) => !e.deleted_at);
}

export type NewFoodLogItem = Omit<FoodLogEntry, 'id' | 'updated_at' | 'quantity'> & {
  id?: string;
  updated_at?: string;
  quantity?: number;
};

/**
 * Adds a new food item to the log.
 * Generates UUID v4 if not provided, defaults quantity to 1 and updated_at to now.
 */
export async function add(item: NewFoodLogItem): Promise<FoodLogEntry> {
  await migrateIfNeeded();
  const rawEntries = await loadRawAll();
  const storage = getStorage();

  const nowIso = new Date().toISOString();
  const newEntry: FoodLogEntry = {
    ...item,
    id: item.id || generateUuid(),
    quantity: item.quantity != null ? Number(item.quantity) : 1,
    updated_at: item.updated_at || nowIso,
    timestamp: item.timestamp || nowIso,
    deleted_at: null,
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    carbs: Number(item.carbs) || 0,
    fat: Number(item.fat) || 0,
    fiber: Number(item.fiber) || 0,
  };

  rawEntries.push(newEntry);
  await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
  notifyFoodLogListeners(newEntry.id, 'add');
  return newEntry;
}

/**
 * Restores an entry at an optional index (useful for 5-second Undo flows).
 */
export async function restore(entry: FoodLogEntry, index?: number): Promise<void> {
  await migrateIfNeeded();
  const rawEntries = await loadRawAll();
  const storage = getStorage();

  const existingIndex = rawEntries.findIndex((e) => e.id === entry.id);
  const nowIso = new Date().toISOString();

  if (existingIndex !== -1) {
    rawEntries[existingIndex] = {
      ...rawEntries[existingIndex],
      ...entry,
      deleted_at: null,
      updated_at: nowIso,
    };
  } else {
    const restoredEntry: FoodLogEntry = {
      ...entry,
      deleted_at: null,
      updated_at: nowIso,
    };
    if (typeof index === 'number' && index >= 0 && index <= rawEntries.length) {
      rawEntries.splice(index, 0, restoredEntry);
    } else {
      rawEntries.push(restoredEntry);
    }
  }

  await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
  notifyFoodLogListeners(entry.id, 'update');
}

/**
 * Updates an existing food log entry by id with the given patch.
 * Sets updated_at to current ISO timestamp.
 */
export async function update(id: string, patch: Partial<FoodLogEntry>): Promise<FoodLogEntry | null> {
  await migrateIfNeeded();
  const rawEntries = await loadRawAll();
  const storage = getStorage();

  const targetIndex = rawEntries.findIndex((e) => e.id === id);
  if (targetIndex === -1) {
    return null;
  }

  const existing = rawEntries[targetIndex];
  const updatedEntry: FoodLogEntry = {
    ...existing,
    ...patch,
    id: existing.id, // Never overwrite id
    updated_at: new Date().toISOString(),
    quantity: patch.quantity != null ? Number(patch.quantity) : existing.quantity,
  };

  rawEntries[targetIndex] = updatedEntry;
  await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
  notifyFoodLogListeners(id, 'update');
  return updatedEntry;
}

/**
 * Removes an entry by id using tombstone soft delete.
 * The item immediately disappears from loadAll() UI while preserving deleted_at for sync.
 */
export async function remove(id: string): Promise<boolean> {
  await migrateIfNeeded();
  const rawEntries = await loadRawAll();
  const storage = getStorage();

  const targetIndex = rawEntries.findIndex((e) => e.id === id);
  if (targetIndex === -1) {
    return false;
  }

  const nowIso = new Date().toISOString();
  rawEntries[targetIndex] = {
    ...rawEntries[targetIndex],
    deleted_at: nowIso,
    updated_at: nowIso,
  };

  await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
  notifyFoodLogListeners(id, 'remove');
  return true;
}

/**
 * Merges a remote meal entry from sync pull using last-write-wins & tombstone rules.
 * Does NOT trigger local foodLog listeners to prevent sync loops.
 */
export async function mergeRemoteEntry(remote: FoodLogEntry): Promise<'updated' | 'inserted' | 'skipped'> {
  await migrateIfNeeded();
  const rawEntries = await loadRawAll();
  const storage = getStorage();

  const targetIndex = rawEntries.findIndex((e) => e.id === remote.id);
  const remoteUpdated = new Date(remote.updated_at).getTime();

  if (targetIndex !== -1) {
    const existing = rawEntries[targetIndex];
    const localUpdated = new Date(existing.updated_at).getTime();

    // 1. Remote has tombstone
    if (remote.deleted_at) {
      if (remoteUpdated >= localUpdated || !existing.deleted_at) {
        rawEntries[targetIndex] = {
          ...existing,
          ...remote,
          deleted_at: remote.deleted_at,
          updated_at: remote.updated_at,
        };
        await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
        return 'updated';
      }
      return 'skipped';
    }

    // 2. Remote is active, but local has tombstone
    if (existing.deleted_at) {
      if (localUpdated >= remoteUpdated) {
        // Local delete is newer; tombstone wins
        return 'skipped';
      }
      // Remote edit is newer than local delete; resurrect
      rawEntries[targetIndex] = {
        ...remote,
        deleted_at: null,
      };
      await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
      return 'updated';
    }

    // 3. Both active: Last-write-wins on updated_at
    if (remoteUpdated >= localUpdated) {
      rawEntries[targetIndex] = {
        ...remote,
        deleted_at: null,
      };
      await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
      return 'updated';
    }

    return 'skipped';
  }

  // Not found locally
  rawEntries.push({
    ...remote,
    quantity: remote.quantity != null ? Number(remote.quantity) : 1,
    calories: Number(remote.calories) || 0,
    protein: Number(remote.protein) || 0,
    carbs: Number(remote.carbs) || 0,
    fat: Number(remote.fat) || 0,
    fiber: Number(remote.fiber) || 0,
  });
  await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(rawEntries));
  return 'inserted';
}

/**
 * Dedupes obvious duplicate local meals before first-time push:
 * Same normalized name + timestamps within 1000 ms.
 * Retains the one with the later updated_at timestamp.
 */
export async function dedupeLocalEntries(): Promise<number> {
  await migrateIfNeeded();
  const rawEntries = await loadRawAll();
  const storage = getStorage();

  const toRemove = new Set<string>();

  for (let i = 0; i < rawEntries.length; i++) {
    const a = rawEntries[i];
    if (a.deleted_at || toRemove.has(a.id)) continue;

    const aName = a.name.trim().toLowerCase();
    const aTime = new Date(a.timestamp).getTime();
    const aUpdated = new Date(a.updated_at).getTime();

    for (let j = i + 1; j < rawEntries.length; j++) {
      const b = rawEntries[j];
      if (b.deleted_at || toRemove.has(b.id)) continue;

      const bName = b.name.trim().toLowerCase();
      const bTime = new Date(b.timestamp).getTime();
      const bUpdated = new Date(b.updated_at).getTime();

      if (aName === bName && Math.abs(aTime - bTime) <= 1000) {
        // Obvious duplicate found!
        if (bUpdated > aUpdated) {
          toRemove.add(a.id);
          break; // a is removed, move to next
        } else {
          toRemove.add(b.id);
        }
      }
    }
  }

  if (toRemove.size > 0) {
    const cleaned = rawEntries.filter((e) => !toRemove.has(e.id));
    await storage.setItem(SAVED_FOODS_KEY, JSON.stringify(cleaned));
  }

  return toRemove.size;
}

/**
 * Selects entries grouped by date, or filters by a specific date string.
 * Uses toLocaleDateString("en-GB") per memory.md 3.5.
 */
export async function selectByDate(): Promise<Record<string, FoodLogEntry[]>>;
export async function selectByDate(date: string): Promise<FoodLogEntry[]>;
export async function selectByDate(date?: string): Promise<Record<string, FoodLogEntry[]> | FoodLogEntry[]> {
  const allEntries = await loadAll();

  if (typeof date === 'string' && date.length > 0) {
    return allEntries.filter((entry) => formatDateKey(entry.timestamp) === date);
  }

  const grouped: Record<string, FoodLogEntry[]> = {};
  for (const entry of allEntries) {
    const key = formatDateKey(entry.timestamp);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(entry);
  }

  return grouped;
}

/**
 * Calculates daily totals for a list of entries.
 * Totals = Number(calories) * (Number(quantity) || 1).
 * Handles string numbers and missing quantities safely per memory quirk 3.3.
 */
export function dailyTotals(entries: FoodLogEntry[]): DailyTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;

  for (const item of entries) {
    const qty = Number(item.quantity) || 1;
    calories += (Number(item.calories) || 0) * qty;
    protein += (Number(item.protein) || 0) * qty;
    carbs += (Number(item.carbs) || 0) * qty;
    fat += (Number(item.fat) || 0) * qty;
    fiber += (Number(item.fiber) || 0) * qty;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  };
}

const foodLog = {
  loadAll,
  loadRawAll,
  add,
  restore,
  update,
  remove,
  selectByDate,
  dailyTotals,
  migrateIfNeeded,
  formatDateKey,
  mergeRemoteEntry,
  dedupeLocalEntries,
  onFoodLogChange,
  getStorage,
  setStorageAdapter,
};

export default foodLog;
