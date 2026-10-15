// NutriCal Sync Engine (FEAT-13 Opt-in Cloud Sync)
// Bi-directional sync with last-write-wins & tombstone conflict resolution

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
import { apiFetch } from './apiClient';
import foodLog, {
  dedupeLocalEntries,
  FoodLogEntry,
  loadRawAll,
  mergeRemoteEntry,
  onFoodLogChange,
} from './foodLog';
import {
  DailyTargets,
  loadTargets,
  onTargetsChange,
  saveTargetsFromRemote,
} from './targets';

export const SYNC_ENABLED_KEY = '@sync_enabled';
export const SYNC_QUEUE_KEY = '@sync_queue';
export const SYNC_TARGETS_DIRTY_KEY = '@sync_targets_dirty';
export const SYNC_CURSOR_KEY = '@sync_cursor';
export const SYNC_META_KEY = '@sync_meta';

export interface SyncMeta {
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingCount: number;
  inProgress: boolean;
}

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  error?: string;
  skippedOffline?: boolean;
}

type OnlineChecker = () => Promise<boolean> | boolean;

let customOnlineChecker: OnlineChecker | null = null;

export function setOnlineCheckerForTesting(checker: OnlineChecker | null): void {
  customOnlineChecker = checker;
}

/**
 * Checks whether the device is currently online.
 * Skips gracefully if offline or in airplane mode.
 */
export async function checkIsOnline(): Promise<boolean> {
  if (customOnlineChecker) {
    return await customOnlineChecker();
  }

  try {
    const NetInfo = require('@react-native-community/netinfo');
    const state = await NetInfo.fetch();
    return state.isConnected !== false;
  } catch {
    return true;
  }
}

/**
 * Checks whether cloud sync is currently enabled by the user.
 * Default is FALSE (opt-in).
 */
export async function isSyncEnabled(): Promise<boolean> {
  const storage = foodLog.getStorage();
  const val = await storage.getItem(SYNC_ENABLED_KEY);
  return val === 'true';
}

/**
 * Returns current sync metadata for Settings screen.
 */
export async function getSyncMeta(): Promise<SyncMeta> {
  const storage = foodLog.getStorage();
  const rawMeta = await storage.getItem(SYNC_META_KEY);
  const pending = await getPendingQueue();
  const targetsDirty = (await storage.getItem(SYNC_TARGETS_DIRTY_KEY)) === 'true';

  let parsed: Partial<SyncMeta> = {};
  if (rawMeta) {
    try {
      parsed = JSON.parse(rawMeta);
    } catch {
      // ignore
    }
  }

  return {
    lastSyncedAt: parsed.lastSyncedAt ?? null,
    lastError: parsed.lastError ?? null,
    pendingCount: pending.length + (targetsDirty ? 1 : 0),
    inProgress: isSyncingNow,
  };
}

async function updateSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  const storage = foodLog.getStorage();
  const current = await getSyncMeta();
  const next: SyncMeta = {
    ...current,
    ...patch,
  };
  await storage.setItem(SYNC_META_KEY, JSON.stringify(next));
}

/**
 * Returns the current dirty meal IDs queue.
 */
export async function getPendingQueue(): Promise<string[]> {
  const storage = foodLog.getStorage();
  const raw = await storage.getItem(SYNC_QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function savePendingQueue(queue: string[]): Promise<void> {
  const storage = foodLog.getStorage();
  await storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(Array.from(new Set(queue))));
}

/**
 * Marks a meal entry dirty for synchronization.
 */
export async function markMealDirty(id: string): Promise<void> {
  const queue = await getPendingQueue();
  if (!queue.includes(id)) {
    queue.push(id);
    await savePendingQueue(queue);
  }
}

/**
 * Marks targets dirty for synchronization.
 */
export async function markTargetsDirty(): Promise<void> {
  const storage = foodLog.getStorage();
  await storage.setItem(SYNC_TARGETS_DIRTY_KEY, 'true');
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoffDelayMs = 5000;
let isSyncingNow = false;

/**
 * Cancels all pending debounce and retry timers.
 */
export function cancelPendingSync(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/**
 * Schedules debounced sync execution (5 seconds).
 */
export function scheduleDebouncedSync(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncNow().catch((err) => {
      console.warn('Debounced sync error:', err);
    });
  }, 5000);
}

/**
 * Enables or disables cloud sync.
 * When enabled, queues all existing local meals if not previously synced, and triggers syncNow().
 */
export async function setSyncEnabled(enabled: boolean): Promise<void> {
  const storage = foodLog.getStorage();
  await storage.setItem(SYNC_ENABLED_KEY, enabled ? 'true' : 'false');

  if (enabled) {
    // If enabling for the first time, queue all local meals and targets
    const cursor = await storage.getItem(SYNC_CURSOR_KEY);
    const queue = await getPendingQueue();

    if (!cursor || cursor === '0' || queue.length === 0) {
      const allMeals = await loadRawAll();
      const allIds = allMeals.map((m) => m.id);
      await savePendingQueue(allIds);
      await markTargetsDirty();
    }

    // Trigger immediate sync
    syncNow().catch((err) => {
      console.warn('Initial sync error:', err);
    });
  } else {
    // Disable active timers
    cancelPendingSync();
  }
}

/**
 * Main bi-directional synchronization cycle.
 * 1. Checks enabled & online status
 * 2. If first sync, dedupes obvious duplicates locally
 * 3. Push: up to 200 dirty meals + targets
 * 4. Pull: changed rows since cursor
 * 5. Applies conflict resolution
 */
export async function syncNow(): Promise<SyncResult> {
  const enabled = await isSyncEnabled();
  if (!enabled) {
    return { success: false, pushedCount: 0, pulledCount: 0, error: 'Sync is disabled' };
  }

  const online = await checkIsOnline();
  if (!online) {
    return { success: false, pushedCount: 0, pulledCount: 0, skippedOffline: true };
  }

  if (isSyncingNow) {
    return { success: false, pushedCount: 0, pulledCount: 0, error: 'Sync already in progress' };
  }

  isSyncingNow = true;
  const storage = foodLog.getStorage();

  try {
    let cursor = (await storage.getItem(SYNC_CURSOR_KEY)) || '0';

    // 1. First-time deduplication check
    if (!cursor || cursor === '0') {
      await dedupeLocalEntries();
    }

    // 2. PUSH STEP
    let dirtyIds = await getPendingQueue();
    const isTargetsDirty = (await storage.getItem(SYNC_TARGETS_DIRTY_KEY)) === 'true';
    let pushedCount = 0;

    if (dirtyIds.length > 0 || isTargetsDirty) {
      const rawAll = await loadRawAll();
      const rawMap = new Map<string, FoodLogEntry>(rawAll.map((m) => [m.id, m]));

      // Take up to 200 items
      const batchIds = dirtyIds.slice(0, 200);
      const batchMeals: FoodLogEntry[] = [];

      for (const id of batchIds) {
        const item = rawMap.get(id);
        if (item) {
          batchMeals.push(item);
        }
      }

      let targetsToPush: DailyTargets | undefined;
      if (isTargetsDirty) {
        targetsToPush = await loadTargets();
      }

      const pushPayload: { meals: FoodLogEntry[]; targets?: DailyTargets } = {
        meals: batchMeals,
      };
      if (targetsToPush) {
        pushPayload.targets = targetsToPush;
      }

      const pushRes = await apiFetch<{ accepted_ids: string[]; synced_at: string }>(
        'sync_push',
        {
          method: 'POST',
          body: pushPayload,
          timeoutMs: 15000,
        }
      );

      if (pushRes && pushRes.accepted_ids) {
        pushedCount = pushRes.accepted_ids.length;
        // Remove accepted IDs from queue
        dirtyIds = dirtyIds.filter((id) => !pushRes.accepted_ids.includes(id));
        await savePendingQueue(dirtyIds);

        if (isTargetsDirty) {
          await storage.setItem(SYNC_TARGETS_DIRTY_KEY, 'false');
        }
      }
    }

    // 3. PULL STEP
    let pulledCount = 0;
    let hasMore = true;

    while (hasMore) {
      cursor = (await storage.getItem(SYNC_CURSOR_KEY)) || '0';

      const pullRes = await apiFetch<{
        meals: FoodLogEntry[];
        targets?: DailyTargets | null;
        next_cursor: string;
        has_more: boolean;
      }>('sync_pull', {
        method: 'GET',
        params: {
          since: cursor,
          limit: '200',
        },
        timeoutMs: 15000,
      });

      if (!pullRes) {
        break;
      }

      const remoteMeals = pullRes.meals || [];
      for (const meal of remoteMeals) {
        await mergeRemoteEntry(meal);
        pulledCount++;
      }

      if (pullRes.targets) {
        await saveTargetsFromRemote(pullRes.targets);
      }

      if (pullRes.next_cursor && pullRes.next_cursor !== cursor) {
        await storage.setItem(SYNC_CURSOR_KEY, pullRes.next_cursor);
      }

      hasMore = Boolean(pullRes.has_more);
    }

    // Sync succeeded: reset backoff and record success
    backoffDelayMs = 5000;
    await updateSyncMeta({
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      inProgress: false,
    });

    return {
      success: true,
      pushedCount,
      pulledCount,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Sync failed';
    console.warn('Sync failed:', errorMsg);

    // Schedule exponential backoff (max 5 minutes)
    backoffDelayMs = Math.min(300000, backoffDelayMs * 2);
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      syncNow().catch(() => {});
    }, backoffDelayMs);
    (retryTimer as any)?.unref?.();

    await updateSyncMeta({
      lastError: errorMsg,
      inProgress: false,
    });

    return {
      success: false,
      pushedCount: 0,
      pulledCount: 0,
      error: errorMsg,
    };
  } finally {
    isSyncingNow = false;
  }
}

/**
 * Purges all user data in the cloud (meals & targets).
 * Keeps local offline data intact.
 */
export async function deleteCloudData(): Promise<{ success: boolean; message?: string }> {
  const online = await checkIsOnline();
  if (!online) {
    throw new Error('Cannot delete cloud data while offline');
  }

  const res = await apiFetch<{ success: boolean; message?: string }>('sync_delete_all', {
    method: 'POST',
    timeoutMs: 10000,
  });

  const storage = foodLog.getStorage();
  await storage.setItem(SYNC_CURSOR_KEY, '0');
  await updateSyncMeta({
    lastSyncedAt: null,
    lastError: null,
  });

  return res;
}

let isInitialized = false;

/**
 * Initializes automatic background sync triggers:
 * - Subscribes to local food log writes (debounced 5s)
 * - Subscribes to local targets changes (debounced 5s)
 * - Subscribes to AppState foreground changes (sync on active)
 */
export function initSyncService(): () => void {
  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  // 1. Food log write trigger
  const unsubFood = onFoodLogChange((id) => {
    markMealDirty(id).then(() => {
      isSyncEnabled().then((enabled) => {
        if (enabled) {
          scheduleDebouncedSync();
        }
      });
    });
  });

  // 2. Targets change trigger
  const unsubTargets = onTargetsChange(() => {
    markTargetsDirty().then(() => {
      isSyncEnabled().then((enabled) => {
        if (enabled) {
          scheduleDebouncedSync();
        }
      });
    });
  });

  // 3. AppState foreground trigger
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      isSyncEnabled().then((enabled) => {
        if (enabled) {
          syncNow().catch((err) => {
            console.warn('Foreground sync error:', err);
          });
        }
      });
    }
  };

  let appStateSub: { remove: () => void } | null = null;
  try {
    const RN = require('react-native');
    if (RN?.AppState && typeof RN.AppState.addEventListener === 'function') {
      appStateSub = RN.AppState.addEventListener('change', handleAppStateChange);
    }
  } catch {
    // Headless / Node testing environment
  }

  return () => {
    unsubFood();
    unsubTargets();
    appStateSub?.remove();
    isInitialized = false;
  };
}
