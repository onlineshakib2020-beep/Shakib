import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialKilnState } from './seedData.ts';
import {
  buildDailySnapshotRecord,
  computeBusinessStateChecksum,
  computeDatabaseRecordSummary,
  detectSessionResetWithRecoverableBackup,
  pruneOldSnapshots,
  shouldRunScheduledDailyBackup,
} from './scheduledBackupLogic.ts';

test('buildDailySnapshotRecord creates a complete daily JSON snapshot with accurate record counts and checksum', () => {
  const state = createInitialKilnState();
  state.salesMemos.push({
    id: 'm-1',
    memoNo: '3001',
    date: '2026-10-31',
    customerName: 'রহিম সাহেব',
    customerPhone: '01711-000000',
    customerAddress: 'সাতক্ষীরা',
    truckNo: '১১-২২',
    driverName: 'করিম',
    items: [
      {
        id: 'i-1',
        gradeId: 'grade-1',
        gradeName: '১ নং ইট',
        quantity: 2000,
        rate: 11000,
        ratePerThousand: true,
        lineTotal: 22000,
      },
    ],
    subTotal: 22000,
    discount: 0,
    totalAmount: 22000,
    paidAmount: 20000,
    dueAmount: 2000,
    paymentMethod: 'নগদ ক্যাশ',
    status: 'PARTIAL',
    createdAt: '2026-10-31T10:00:00.000Z',
  });

  const snap = buildDailySnapshotRecord(
    state,
    '2026-10-31',
    'SCHEDULED_DAILY',
    '2026-10-31T10:05:00.000Z'
  );

  assert.equal(snap.id, 'snapshot-daily-2026-10-31');
  assert.equal(snap.dateKey, '2026-10-31');
  assert.equal(snap.triggerType, 'SCHEDULED_DAILY');
  assert.equal(snap.summary.memoCount, 1);
  assert.equal(snap.summary.totalRecordsCount, 1);
  assert.ok(snap.byteSize > 500);
  assert.equal(snap.checksum.length, 8);
  assert.equal(snap.state.salesMemos.length, 1);
});

test('shouldRunScheduledDailyBackup triggers when today snapshot is missing or data changes, and guards against overwriting with an empty reset state', () => {
  const emptyState = createInitialKilnState();
  const populatedState = createInitialKilnState();
  populatedState.cashTransactions.push({
    id: 'tx-1',
    date: '2026-10-31',
    type: 'IN',
    category: 'ইট বিক্রয় আদায়',
    amount: 50000,
    description: 'মেমো জমা',
    paymentMethod: 'নগদ ক্যাশ',
    verified: true,
    createdAt: '2026-10-31T09:00:00.000Z',
  });

  // Case 1: No snapshots exist yet -> should trigger SCHEDULED_DAILY
  const check1 = shouldRunScheduledDailyBackup([], '2026-10-31', populatedState, true);
  assert.equal(check1.shouldBackup, true);
  assert.equal(check1.reason, 'MISSING_TODAY_SNAPSHOT');
  assert.equal(check1.triggerType, 'SCHEDULED_DAILY');

  const todaySnap = buildDailySnapshotRecord(
    populatedState,
    '2026-10-31',
    'SCHEDULED_DAILY',
    '2026-10-31T09:05:00.000Z'
  );

  // Case 2: Same state on same day -> UP_TO_DATE
  const check2 = shouldRunScheduledDailyBackup([todaySnap], '2026-10-31', populatedState, true);
  assert.equal(check2.shouldBackup, false);
  assert.equal(check2.reason, 'UP_TO_DATE');

  // Case 3: New transaction added on same day -> TODAY_DATA_UPDATED
  const updatedState = structuredClone(populatedState);
  updatedState.settings.openingBalance = 25000;
  assert.notEqual(
    computeBusinessStateChecksum(populatedState),
    computeBusinessStateChecksum(updatedState)
  );
  const check3 = shouldRunScheduledDailyBackup([todaySnap], '2026-10-31', updatedState, true);
  assert.equal(check3.shouldBackup, true);
  assert.equal(check3.reason, 'TODAY_DATA_UPDATED');
  assert.equal(check3.triggerType, 'AUTO_ON_CHANGE');

  // Case 4: Server session resets to emptyState while IndexedDB holds todaySnap -> DO NOT OVERWRITE!
  const checkReset = shouldRunScheduledDailyBackup([todaySnap], '2026-10-31', emptyState, true);
  assert.equal(checkReset.shouldBackup, false);
  assert.equal(checkReset.reason, 'EMPTY_SKIP_OVERWRITE');

  // Case 5: detectSessionResetWithRecoverableBackup returns todaySnap for one-click recovery
  const recoverable = detectSessionResetWithRecoverableBackup(emptyState, [todaySnap]);
  assert.ok(recoverable);
  assert.equal(recoverable.id, todaySnap.id);
  assert.equal(computeDatabaseRecordSummary(recoverable.state).cashTxCount, 1);
});

test('pruneOldSnapshots keeps newest snapshots up to maxKeep', () => {
  const state = createInitialKilnState();
  const s1 = buildDailySnapshotRecord(state, '2026-10-29', 'SCHEDULED_DAILY', '2026-10-29T10:00:00Z');
  const s2 = buildDailySnapshotRecord(state, '2026-10-30', 'SCHEDULED_DAILY', '2026-10-30T10:00:00Z');
  const s3 = buildDailySnapshotRecord(state, '2026-10-31', 'SCHEDULED_DAILY', '2026-10-31T10:00:00Z');

  const pruned = pruneOldSnapshots([s1, s2, s3], 2);
  assert.equal(pruned.kept.length, 2);
  assert.equal(pruned.kept[0]?.dateKey, '2026-10-31');
  assert.equal(pruned.kept[1]?.dateKey, '2026-10-30');
  assert.deepEqual(pruned.removedIds, ['snapshot-daily-2026-10-29']);
});
