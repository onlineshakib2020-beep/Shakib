import {
  pruneOldSnapshots,
  type StoredKilnSnapshot,
} from './scheduledBackupLogic.ts';

const DB_NAME = 'BrickFlowBackupVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'daily_snapshots';
const PREF_KEY = 'brickflow_auto_daily_backup_enabled';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('dateKey', 'dateKey', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Failed to open IndexedDB backup vault.'));
  });
}

export async function listSnapshotsFromIndexedDb(): Promise<StoredKilnSnapshot[]> {
  try {
    const db = await openVaultDb();
    return await new Promise<StoredKilnSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as StoredKilnSnapshot[]) : [];
        rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

export async function saveSnapshotToIndexedDb(
  snapshot: StoredKilnSnapshot,
  maxKeep = 30
): Promise<StoredKilnSnapshot[]> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });

  const all = await listSnapshotsFromIndexedDb();
  const { kept, removedIds } = pruneOldSnapshots(all, maxKeep);

  if (removedIds.length > 0) {
    for (const oldId of removedIds) {
      await deleteSnapshotFromIndexedDb(oldId);
    }
  }

  return kept;
}

export async function deleteSnapshotFromIndexedDb(id: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // ignore deletion failure
  }
}

export async function clearAllSnapshotsFromIndexedDb(): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // ignore clear failure
  }
}

export function downloadSnapshotAsJsonArchive(snapshot: StoredKilnSnapshot): void {
  const archivePayload = {
    archiveMeta: {
      snapshotId: snapshot.id,
      dateKey: snapshot.dateKey,
      createdAt: snapshot.createdAt,
      triggerType: snapshot.triggerType,
      labelBn: snapshot.labelBn,
      checksum: snapshot.checksum,
      summary: snapshot.summary,
      application: 'BrickFlow — SBL Bhata Management System',
    },
    ...snapshot.state,
  };

  const jsonString = JSON.stringify(archivePayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brickflow-daily-snapshot-${snapshot.dateKey}-${snapshot.id.slice(-6)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getAutoDailyBackupPreference(): boolean {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw === null) return true; // Enabled by default so data is always protected
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setAutoDailyBackupPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage quota errors
  }
}
