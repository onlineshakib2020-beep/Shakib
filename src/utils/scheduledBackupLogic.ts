import type { KilnDatabaseState } from '../types/kiln.ts';

export type BackupTriggerType = 'SCHEDULED_DAILY' | 'AUTO_ON_CHANGE' | 'MANUAL';

export interface DailyBackupSummaryCounts {
  memoCount: number;
  cashTxCount: number;
  productionRecordsCount: number;
  advancedLedgerRecordsCount: number;
  totalRecordsCount: number;
  openingBalance: number;
}

export interface DailyBackupSnapshotMeta {
  id: string;
  dateKey: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  triggerType: BackupTriggerType;
  labelBn: string;
  byteSize: number;
  checksum: string;
  summary: DailyBackupSummaryCounts;
}

export interface StoredKilnSnapshot extends DailyBackupSnapshotMeta {
  state: KilnDatabaseState;
}

/**
 * Computes a fast deterministic 32-bit FNV-1a hex checksum for a string payload.
 */
export function computeStateChecksum(serializedJson: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < serializedJson.length; i++) {
    hash ^= serializedJson.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Counts all meaningful business records inside a KilnDatabaseState
 * so we can accurately measure snapshot completeness and detect session resets.
 */
export function computeDatabaseRecordSummary(
  state: Partial<KilnDatabaseState> | null | undefined
): DailyBackupSummaryCounts {
  if (!state) {
    return {
      memoCount: 0,
      cashTxCount: 0,
      productionRecordsCount: 0,
      advancedLedgerRecordsCount: 0,
      totalRecordsCount: 0,
      openingBalance: 0,
    };
  }

  const memoCount = Array.isArray(state.salesMemos) ? state.salesMemos.length : 0;
  const cashTxCount = Array.isArray(state.cashTransactions) ? state.cashTransactions.length : 0;

  const productionRecordsCount =
    (Array.isArray(state.millPots) ? state.millPots.length : 0) +
    (Array.isArray(state.chulliLoads) ? state.chulliLoads.length : 0) +
    (Array.isArray(state.poraiMistriRecords) ? state.poraiMistriRecords.length : 0) +
    (Array.isArray(state.chulliUnloads) ? state.chulliUnloads.length : 0) +
    (Array.isArray(state.rubbishRecords) ? state.rubbishRecords.length : 0) +
    (Array.isArray(state.woodFuelRecords) ? state.woodFuelRecords.length : 0) +
    (Array.isArray(state.productionPayments) ? state.productionPayments.length : 0) +
    (Array.isArray(state.memoDeliveries) ? state.memoDeliveries.length : 0) +
    (Array.isArray(state.workerAttendance) ? state.workerAttendance.length : 0);

  const stockChangedGradesCount = Array.isArray(state.brickGrades)
    ? state.brickGrades.filter(
        (g) => (Number(g.currentStock) || 0) > 0 || (Number(g.seasonProduced) || 0) > 0
      ).length
    : 0;

  const advancedLedgerRecordsCount =
    (Array.isArray(state.soilCoalRecords) ? state.soilCoalRecords.length : 0) +
    (Array.isArray(state.dadonRecords) ? state.dadonRecords.length : 0) +
    (Array.isArray(state.advanceBookings) ? state.advanceBookings.length : 0) +
    (Array.isArray(state.vehicleDieselRecords) ? state.vehicleDieselRecords.length : 0) +
    (Array.isArray(state.complianceRecords) ? state.complianceRecords.length : 0) +
    (Array.isArray(state.kilnNotes) ? state.kilnNotes.length : 0) +
    stockChangedGradesCount;

  const totalRecordsCount =
    memoCount + cashTxCount + productionRecordsCount + advancedLedgerRecordsCount;

  const openingBalance = Number(state.settings?.openingBalance) || 0;

  return {
    memoCount,
    cashTxCount,
    productionRecordsCount,
    advancedLedgerRecordsCount,
    totalRecordsCount,
    openingBalance,
  };
}

/**
 * Strips transient volatile fields (like agentMessages/agentTasks timestamps) when computing
 * the business data checksum so the scheduler only re-triggers on real business state changes.
 */
export function computeBusinessStateChecksum(state: Partial<KilnDatabaseState>): string {
  const corePayload = {
    settings: state.settings,
    brickGrades: state.brickGrades || [],
    salesMemos: state.salesMemos || [],
    cashTransactions: state.cashTransactions || [],
    workerProfiles: state.workerProfiles || [],
    workerAttendance: state.workerAttendance || [],
    kilnNotes: state.kilnNotes || [],
    millPots: state.millPots || [],
    chulliLoads: state.chulliLoads || [],
    poraiMistriRecords: state.poraiMistriRecords || [],
    chulliUnloads: state.chulliUnloads || [],
    rubbishRecords: state.rubbishRecords || [],
    woodFuelRecords: state.woodFuelRecords || [],
    soilCoalRecords: state.soilCoalRecords || [],
    dadonRecords: state.dadonRecords || [],
    advanceBookings: state.advanceBookings || [],
    vehicleDieselRecords: state.vehicleDieselRecords || [],
    complianceRecords: state.complianceRecords || [],
    productionPayments: state.productionPayments || [],
    memoDeliveries: state.memoDeliveries || [],
    kilnUnits: state.kilnUnits || [],
    kilnSeasons: state.kilnSeasons || [],
  };
  return computeStateChecksum(JSON.stringify(corePayload));
}

/**
 * Builds a complete StoredKilnSnapshot object ready for IndexedDB storage or JSON file download.
 */
export function buildDailySnapshotRecord(
  state: KilnDatabaseState,
  dateKey: string,
  triggerType: BackupTriggerType = 'SCHEDULED_DAILY',
  nowIso = new Date().toISOString()
): StoredKilnSnapshot {
  const cleanDate = (dateKey || nowIso.slice(0, 10)).slice(0, 10);
  const serialized = JSON.stringify(state);
  const byteSize =
    typeof Buffer !== 'undefined'
      ? Buffer.byteLength(serialized, 'utf-8')
      : new Blob([serialized]).size;
  const checksum = computeBusinessStateChecksum(state);
  const summary = computeDatabaseRecordSummary(state);

  const id =
    triggerType === 'MANUAL'
      ? `snapshot-manual-${cleanDate}-${nowIso.slice(11, 19).replace(/:/g, '')}`
      : `snapshot-daily-${cleanDate}`;

  const labelBn =
    triggerType === 'MANUAL'
      ? `ম্যানুয়াল স্ন্যাপশট (${cleanDate})`
      : triggerType === 'AUTO_ON_CHANGE'
      ? `রিয়েল-টাইম অটো স্ন্যাপশট (${cleanDate})`
      : `দৈনিক শিডিউলড ব্যাকআপ (${cleanDate})`;

  return {
    id,
    dateKey: cleanDate,
    createdAt: nowIso,
    triggerType,
    labelBn,
    byteSize,
    checksum,
    summary,
    state: JSON.parse(serialized) as KilnDatabaseState,
  };
}

/**
 * Determines whether the background scheduler should create/update today's snapshot in IndexedDB.
 */
export function shouldRunScheduledDailyBackup(
  existingSnapshots: DailyBackupSnapshotMeta[],
  todayDateKey: string,
  currentState: KilnDatabaseState,
  autoDailyEnabled = true
): {
  shouldBackup: boolean;
  reason:
    | 'DISABLED'
    | 'EMPTY_SKIP_OVERWRITE'
    | 'MISSING_TODAY_SNAPSHOT'
    | 'TODAY_DATA_UPDATED'
    | 'UP_TO_DATE';
  triggerType: BackupTriggerType;
} {
  if (!autoDailyEnabled) {
    return {
      shouldBackup: false,
      reason: 'DISABLED',
      triggerType: 'SCHEDULED_DAILY',
    };
  }

  const currentSummary = computeDatabaseRecordSummary(currentState);
  const currentChecksum = computeBusinessStateChecksum(currentState);
  const safeList = Array.isArray(existingSnapshots) ? existingSnapshots : [];

  const hasNonEmptyHistoricalSnapshot = safeList.some(
    (s) => (s.summary?.totalRecordsCount || 0) > 0 || (s.summary?.openingBalance || 0) > 0
  );

  // Guard: If the current server state is completely empty (0 records) AND we already have
  // non-empty backups in IndexedDB, do NOT overwrite today's backup with an empty reset state!
  if (
    currentSummary.totalRecordsCount === 0 &&
    currentSummary.openingBalance === 0 &&
    hasNonEmptyHistoricalSnapshot
  ) {
    return {
      shouldBackup: false,
      reason: 'EMPTY_SKIP_OVERWRITE',
      triggerType: 'SCHEDULED_DAILY',
    };
  }

  const todayDailyId = `snapshot-daily-${todayDateKey}`;
  const todaySnapshot = safeList.find(
    (s) => s.id === todayDailyId || (s.dateKey === todayDateKey && s.triggerType !== 'MANUAL')
  );

  if (!todaySnapshot) {
    return {
      shouldBackup: true,
      reason: 'MISSING_TODAY_SNAPSHOT',
      triggerType: 'SCHEDULED_DAILY',
    };
  }

  if (todaySnapshot.checksum !== currentChecksum) {
    return {
      shouldBackup: true,
      reason: 'TODAY_DATA_UPDATED',
      triggerType: 'AUTO_ON_CHANGE',
    };
  }

  return {
    shouldBackup: false,
    reason: 'UP_TO_DATE',
    triggerType: 'SCHEDULED_DAILY',
  };
}

/**
 * Detects if the server session reset to an empty state while IndexedDB holds a richer snapshot.
 */
export function detectSessionResetWithRecoverableBackup(
  currentServerState: KilnDatabaseState,
  savedSnapshots: StoredKilnSnapshot[]
): StoredKilnSnapshot | null {
  const currentSummary = computeDatabaseRecordSummary(currentServerState);
  if (currentSummary.totalRecordsCount > 0 || currentSummary.openingBalance > 0) {
    return null;
  }

  const sorted = [...(savedSnapshots || [])].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );

  const candidate = sorted.find(
    (s) =>
      s.state &&
      ((s.summary?.totalRecordsCount || 0) > 0 || (s.summary?.openingBalance || 0) > 0)
  );

  return candidate || null;
}

/**
 * Prunes older snapshots beyond maxKeep while always keeping the newest snapshots.
 */
export function pruneOldSnapshots<T extends DailyBackupSnapshotMeta>(
  snapshots: T[],
  maxKeep = 30
): { kept: T[]; removedIds: string[] } {
  const sorted = [...(snapshots || [])].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  const kept = sorted.slice(0, Math.max(1, maxKeep));
  const removedIds = sorted.slice(Math.max(1, maxKeep)).map((s) => s.id);
  return { kept, removedIds };
}
