import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { KilnDatabaseState } from '../types/kiln';

export interface FirestoreSyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  totalRecordsInCloud: number;
}

type StatusListener = (status: FirestoreSyncStatus) => void;

let currentStatus: FirestoreSyncStatus = {
  isConnected: false,
  isSyncing: false,
  lastSyncedAt: null,
  errorMessage: null,
  totalRecordsInCloud: 0,
};

const listeners = new Set<StatusListener>();

function notifyListeners() {
  listeners.forEach((l) => l({ ...currentStatus }));
}

export function subscribeToSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): FirestoreSyncStatus {
  return { ...currentStatus };
}

function updateStatus(partial: Partial<FirestoreSyncStatus>) {
  currentStatus = { ...currentStatus, ...partial };
  notifyListeners();
}

/**
 * Cleans state to ensure pure JSON serializability for Firestore
 */
export function sanitizeStateForFirestore(state: KilnDatabaseState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Persists the entire kiln state to Google Cloud Firestore (/kiln_data/main)
 */
export async function saveStateToFirestore(state: KilnDatabaseState): Promise<boolean> {
  updateStatus({ isSyncing: true, errorMessage: null });
  try {
    const clean = sanitizeStateForFirestore(state);
    const docRef = doc(db, 'kiln_data', 'main');
    
    const totalRecords =
      (state.salesMemos?.length || 0) +
      (state.cashTransactions?.length || 0) +
      (state.millPots?.length || 0) +
      (state.chulliLoads?.length || 0) +
      (state.chulliUnloads?.length || 0) +
      (state.woodFuelRecords?.length || 0) +
      (state.soilCoalRecords?.length || 0) +
      (state.dadonRecords?.length || 0);

    await setDoc(
      docRef,
      {
        state: clean,
        updatedAt: serverTimestamp(),
        lastClientSavedAt: new Date().toISOString(),
        totalRecords,
      },
      { merge: true }
    );

    // Also write a snapshot history document tagged by date for extra redundancy
    try {
      const todayTag = new Date().toISOString().slice(0, 10);
      const snapshotRef = doc(db, 'kiln_data', `snapshot_${todayTag}`);
      await setDoc(snapshotRef, {
        state: clean,
        snapshotDate: todayTag,
        updatedAt: serverTimestamp(),
        totalRecords,
      }, { merge: true });
    } catch {
      // Snapshot backup is auxiliary, non-critical
    }

    updateStatus({
      isConnected: true,
      isSyncing: false,
      lastSyncedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      errorMessage: null,
      totalRecordsInCloud: totalRecords,
    });
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to save to Firestore:', err);
    updateStatus({
      isConnected: false,
      isSyncing: false,
      errorMessage: msg,
    });
    return false;
  }
}

/**
 * Loads the latest kiln state from Google Cloud Firestore (/kiln_data/main)
 */
export async function loadStateFromFirestore(): Promise<KilnDatabaseState | null> {
  updateStatus({ isSyncing: true, errorMessage: null });
  try {
    const docRef = doc(db, 'kiln_data', 'main');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      const state = (data?.state || null) as KilnDatabaseState | null;
      if (state) {
        const totalRecords =
          (state.salesMemos?.length || 0) +
          (state.cashTransactions?.length || 0) +
          (state.millPots?.length || 0) +
          (state.chulliLoads?.length || 0) +
          (state.chulliUnloads?.length || 0);

        updateStatus({
          isConnected: true,
          isSyncing: false,
          lastSyncedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
          errorMessage: null,
          totalRecordsInCloud: totalRecords,
        });
        return state;
      }
    }
    updateStatus({ isConnected: true, isSyncing: false });
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Failed to load from Firestore:', err);
    updateStatus({ isConnected: false, isSyncing: false, errorMessage: msg });
    return null;
  }
}

/**
 * Debounced cloud auto-saver helper
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerDebouncedCloudSync(state: KilnDatabaseState, delayMs = 1200): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    saveStateToFirestore(state).catch((err) => {
      console.warn('Cloud sync debounce error:', err);
    });
  }, delayMs);
}
