import type {
  AdvanceBrickBooking,
  BusinessAnalysisReport,
  CashTransaction,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  ComplianceCategory,
  ComplianceInstallmentRecord,
  DadonAdvanceRecord,
  DadonRoleCategory,
  DashboardMetrics,
  ExpenseCategory,
  GradeReportRow,
  KilnDatabaseState,
  KilnNote,
  KilnSeason,
  KilnSettings,
  KilnVehicleType,
  MemoDeliveryRecord,
  MemoItemRow,
  MillId,
  MillPotRecord,
  PaymentMethod,
  PoraiMistriRecord,
  RubbishRecord,
  SalesMemo,
  SoilCoalRecord,
  UnloadedGradeItem,
  VehicleDieselRecord,
  WoodFuelRecord,
  WorkerAttendance,
  WorkerProfile,
} from '../types/kiln.ts';
import {
  calculateAdvanceBookingBill,
  calculateChulliLineUnloadBill,
  calculateComplianceItemBill,
  calculateDashboardMetrics,
  calculateMultiItemMemoTotals,
  calculateRowTotal,
  calculateSoilCoalBill,
  calculateVanLoadBill,
  calculateVehicleDieselExpense,
  calculateWoodFuelBill,
  cleanBrickGradeName,
  computeBrickGradeReport,
  computeComprehensiveBusinessAnalysis,
  formatBn,
  formatCurrencyBn,
  generateUniqueMemoNo,
  normalizeLegacyMemo,
  parseBanglaDigits,
  parseNum,
  validateStockForMultiItemMemo,
} from './kilnLogic.ts';
import { createInitialKilnState, getTodayAndYesterday } from './seedData.ts';
import {
  buildDailySnapshotRecord,
  computeDatabaseRecordSummary,
  type DailyBackupSummaryCounts,
} from './scheduledBackupLogic.ts';
import { saveSnapshotToIndexedDb } from './indexedDbBackupStore.ts';

export const PHONE_MASTER_STORAGE_KEY = 'sbl_live_master_db_backup_v1';
export const PHONE_PERMANENT_MIRROR_KEY = 'sbl_phone_permanent_vault_v2';
export const PHONE_PENDING_SYNC_KEY = 'sbl_pending_offline_sync_v1';
export const PHONE_LAST_SAVED_AT_KEY = 'sbl_phone_last_saved_at_v1';

export interface EnrichedKilnPayload {
  state: KilnDatabaseState;
  metrics: DashboardMetrics;
  gradeReport: {
    rows: GradeReportRow[];
    totals: {
      brickStockPieces: number;
      todayBrickQty: number;
      todayTotalAmount: number;
      yesterdayBrickQty: number;
      yesterdayTotalAmount: number;
      seasonBrickQty: number;
      seasonTotalAmount: number;
    };
  };
  businessAnalysis: BusinessAnalysisReport;
  offlineSaved?: boolean;
  [key: string]: unknown;
}

export interface PhoneVaultStatusInfo {
  hasLocalData: boolean;
  totalRecordsCount: number;
  memoCount: number;
  cashTxCount: number;
  productionRecordsCount: number;
  advancedLedgerRecordsCount: number;
  openingBalance: number;
  lastSavedAt: string | null;
  pendingOfflineSync: boolean;
}

export type NormalizedKilnDatabaseState = KilnDatabaseState &
  Required<
    Pick<
      KilnDatabaseState,
      | 'millPots'
      | 'chulliLoads'
      | 'poraiMistriRecords'
      | 'chulliUnloads'
      | 'rubbishRecords'
      | 'woodFuelRecords'
      | 'soilCoalRecords'
      | 'dadonRecords'
      | 'advanceBookings'
      | 'vehicleDieselRecords'
      | 'complianceRecords'
      | 'productionPayments'
      | 'memoDeliveries'
    >
  >;

/**
 * Normalizes any partial or persisted KilnDatabaseState so all required arrays and defaults exist.
 */
export function normalizeKilnDatabaseState(
  raw: Partial<KilnDatabaseState> | null | undefined
): NormalizedKilnDatabaseState {
  const defaultInitial = createInitialKilnState();
  if (!raw || typeof raw !== 'object') {
    return {
      ...defaultInitial,
      millPots: defaultInitial.millPots || [],
      chulliLoads: defaultInitial.chulliLoads || [],
      poraiMistriRecords: defaultInitial.poraiMistriRecords || [],
      chulliUnloads: defaultInitial.chulliUnloads || [],
      rubbishRecords: defaultInitial.rubbishRecords || [],
      woodFuelRecords: defaultInitial.woodFuelRecords || [],
      soilCoalRecords: defaultInitial.soilCoalRecords || [],
      dadonRecords: defaultInitial.dadonRecords || [],
      advanceBookings: defaultInitial.advanceBookings || [],
      vehicleDieselRecords: defaultInitial.vehicleDieselRecords || [],
      complianceRecords: defaultInitial.complianceRecords || [],
      productionPayments: defaultInitial.productionPayments || [],
      memoDeliveries: defaultInitial.memoDeliveries || [],
    };
  }

  const settings: KilnSettings = {
    ...defaultInitial.settings,
    ...(raw.settings || {}),
    openingBalance: Number(raw.settings?.openingBalance ?? defaultInitial.settings.openingBalance) || 0,
  };

  const rawGrades =
    Array.isArray(raw.brickGrades) && raw.brickGrades.length > 0
      ? raw.brickGrades
      : defaultInitial.brickGrades;

  const brickGrades = rawGrades.map((g) => {
    const defMatch = defaultInitial.brickGrades.find((dg) => dg.id === g.id);
    const rawRate = Number(g.ratePerUnit) || (defMatch ? defMatch.ratePerUnit : 11000);
    const ratePerUnit =
      rawRate < 100
        ? defMatch
          ? defMatch.ratePerUnit
          : Math.round(rawRate * 1000)
        : rawRate;
    return {
      ...g,
      nameBn: defMatch ? defMatch.nameBn : cleanBrickGradeName(g.nameBn),
      nameEn: defMatch ? defMatch.nameEn : g.nameEn,
      ratePerUnit,
      ratePerThousand: true,
      currentStock: Number(g.currentStock) || 0,
      seasonProduced: Number(g.seasonProduced) || 0,
    };
  });

  if (!brickGrades.some((g) => g.id === 'grade-1-5')) {
    const grade15 = defaultInitial.brickGrades.find((dg) => dg.id === 'grade-1-5');
    if (grade15) {
      const idx1 = brickGrades.findIndex((g) => g.id === 'grade-1');
      if (idx1 >= 0) {
        brickGrades.splice(idx1 + 1, 0, { ...grade15 });
      } else {
        brickGrades.push({ ...grade15 });
      }
    }
  }

  const salesMemos: SalesMemo[] = (
    Array.isArray(raw.salesMemos) ? raw.salesMemos : defaultInitial.salesMemos
  ).map((m) => normalizeLegacyMemo(m, brickGrades));

  return {
    settings,
    brickGrades,
    salesMemos,
    cashTransactions: Array.isArray(raw.cashTransactions)
      ? raw.cashTransactions
      : defaultInitial.cashTransactions,
    workerProfiles: Array.isArray(raw.workerProfiles)
      ? raw.workerProfiles
      : defaultInitial.workerProfiles,
    workerAttendance: Array.isArray(raw.workerAttendance)
      ? raw.workerAttendance
      : defaultInitial.workerAttendance,
    kilnNotes: Array.isArray(raw.kilnNotes) ? raw.kilnNotes : defaultInitial.kilnNotes,
    millPots: Array.isArray(raw.millPots) ? raw.millPots : [],
    chulliLoads: Array.isArray(raw.chulliLoads) ? raw.chulliLoads : [],
    poraiMistriRecords: Array.isArray(raw.poraiMistriRecords)
      ? raw.poraiMistriRecords
      : [],
    chulliUnloads: Array.isArray(raw.chulliUnloads) ? raw.chulliUnloads : [],
    rubbishRecords: Array.isArray(raw.rubbishRecords) ? raw.rubbishRecords : [],
    woodFuelRecords: Array.isArray(raw.woodFuelRecords) ? raw.woodFuelRecords : [],
    soilCoalRecords: Array.isArray(raw.soilCoalRecords) ? raw.soilCoalRecords : [],
    dadonRecords: Array.isArray(raw.dadonRecords) ? raw.dadonRecords : [],
    advanceBookings: Array.isArray(raw.advanceBookings) ? raw.advanceBookings : [],
    vehicleDieselRecords: Array.isArray(raw.vehicleDieselRecords)
      ? raw.vehicleDieselRecords
      : [],
    complianceRecords: Array.isArray(raw.complianceRecords)
      ? raw.complianceRecords
      : [],
    productionPayments: Array.isArray(raw.productionPayments)
      ? raw.productionPayments
      : [],
    memoDeliveries: Array.isArray(raw.memoDeliveries) ? raw.memoDeliveries : [],
    kilnUnits:
      Array.isArray(raw.kilnUnits) && raw.kilnUnits.length > 0
        ? raw.kilnUnits
        : defaultInitial.kilnUnits,
    kilnSeasons:
      Array.isArray(raw.kilnSeasons) && raw.kilnSeasons.length > 0
        ? raw.kilnSeasons
        : defaultInitial.kilnSeasons,
    agentTasks: Array.isArray(raw.agentTasks) ? raw.agentTasks : [],
    agentMessages: Array.isArray(raw.agentMessages)
      ? raw.agentMessages
      : defaultInitial.agentMessages,
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : defaultInitial.auditLogs,
    context: raw.context || {},
  };
}

/**
 * Builds the full EnrichedKilnPayload (metrics, gradeReport, businessAnalysis) from a state object.
 */
export function buildEnrichedPayloadFromState(
  state: KilnDatabaseState,
  extraFields: Record<string, unknown> = {}
): EnrichedKilnPayload {
  const normalized = normalizeKilnDatabaseState(state);
  const { todayDate, yesterdayDate } = getTodayAndYesterday();
  const metrics = calculateDashboardMetrics(normalized, todayDate, yesterdayDate);
  const gradeReport = computeBrickGradeReport(
    normalized.brickGrades,
    normalized.salesMemos,
    todayDate,
    yesterdayDate
  );
  const businessAnalysis = computeComprehensiveBusinessAnalysis(
    normalized,
    todayDate,
    yesterdayDate
  );

  return {
    ...extraFields,
    state: normalized,
    metrics,
    gradeReport,
    businessAnalysis,
  };
}

/**
 * Synchronously reads the phone's local storage master vault (or permanent mirror)
 * so the app immediately boots with the user's saved data even when 100% offline.
 */
export function loadMasterStateFromPhoneStorage(): {
  state: KilnDatabaseState;
  summary: DailyBackupSummaryCounts;
  savedAt: string | null;
  pendingOfflineSync: boolean;
} {
  const defaultState = createInitialKilnState();
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      state: defaultState,
      summary: computeDatabaseRecordSummary(defaultState),
      savedAt: null,
      pendingOfflineSync: false,
    };
  }

  let bestState: KilnDatabaseState | null = null;
  let bestSummary = computeDatabaseRecordSummary(defaultState);
  let bestSavedAt: string | null = null;

  const keysToCheck = [PHONE_MASTER_STORAGE_KEY, PHONE_PERMANENT_MIRROR_KEY];
  for (const key of keysToCheck) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const candidateRaw = parsed?.state ? parsed.state : parsed;
      const normalized = normalizeKilnDatabaseState(candidateRaw);
      const summary = computeDatabaseRecordSummary(normalized);
      if (
        !bestState ||
        summary.totalRecordsCount > bestSummary.totalRecordsCount ||
        (summary.totalRecordsCount === bestSummary.totalRecordsCount &&
          summary.openingBalance > bestSummary.openingBalance)
      ) {
        bestState = normalized;
        bestSummary = summary;
        bestSavedAt = parsed?.savedAt || window.localStorage.getItem(PHONE_LAST_SAVED_AT_KEY);
      }
    } catch {
      // ignore malformed storage item
    }
  }

  const pendingOfflineSync =
    window.localStorage.getItem(PHONE_PENDING_SYNC_KEY) === 'true';

  if (bestState) {
    return {
      state: bestState,
      summary: bestSummary,
      savedAt: bestSavedAt,
      pendingOfflineSync,
    };
  }

  return {
    state: defaultState,
    summary: bestSummary,
    savedAt: null,
    pendingOfflineSync,
  };
}

/**
 * Saves the state into both primary and permanent mirror localStorage keys + IndexedDB
 * so data is never lost when internet disconnects or the browser reloads.
 */
export function saveMasterStateToPhoneStorage(
  state: KilnDatabaseState,
  options: { markPendingOfflineSync?: boolean; allowEmptyOverwrite?: boolean } = {}
): DailyBackupSummaryCounts {
  const normalized = normalizeKilnDatabaseState(state);
  const summary = computeDatabaseRecordSummary(normalized);
  const nowIso = new Date().toISOString();

  if (typeof window === 'undefined' || !window.localStorage) {
    return summary;
  }

  // Guard: Never overwrite a non-empty local phone vault with an empty 0-record state
  // unless allowEmptyOverwrite is explicitly true (e.g. user clicked Reset All Data)
  if (
    !options.allowEmptyOverwrite &&
    summary.totalRecordsCount === 0 &&
    summary.openingBalance === 0
  ) {
    const existing = loadMasterStateFromPhoneStorage();
    if (existing.summary.totalRecordsCount > 0 || existing.summary.openingBalance > 0) {
      return existing.summary;
    }
  }

  const payloadStr = JSON.stringify({
    savedAt: nowIso,
    summary,
    state: normalized,
  });

  try {
    window.localStorage.setItem(PHONE_MASTER_STORAGE_KEY, payloadStr);
    window.localStorage.setItem(PHONE_PERMANENT_MIRROR_KEY, payloadStr);
    window.localStorage.setItem(PHONE_LAST_SAVED_AT_KEY, nowIso);
    if (options.markPendingOfflineSync !== undefined) {
      window.localStorage.setItem(
        PHONE_PENDING_SYNC_KEY,
        options.markPendingOfflineSync ? 'true' : 'false'
      );
    }
  } catch {
    // ignore quota errors
  }

  // Also persist to IndexedDB asynchronously
  if (summary.totalRecordsCount > 0 || summary.openingBalance > 0) {
    const { todayDate } = getTodayAndYesterday();
    const snapshot = buildDailySnapshotRecord(
      normalized,
      todayDate,
      'AUTO_ON_CHANGE',
      nowIso
    );
    saveSnapshotToIndexedDb(snapshot, 30).catch(() => {});
  }

  try {
    window.dispatchEvent(
      new CustomEvent('sbl-phone-vault-updated', {
        detail: {
          summary,
          savedAt: nowIso,
          pendingOfflineSync:
            window.localStorage.getItem(PHONE_PENDING_SYNC_KEY) === 'true',
        },
      })
    );
  } catch {
    // ignore event error
  }

  return summary;
}

export function getPhoneVaultStatusInfo(
  currentState?: KilnDatabaseState
): PhoneVaultStatusInfo {
  const loaded = loadMasterStateFromPhoneStorage();
  const activeSummary = currentState
    ? computeDatabaseRecordSummary(currentState)
    : loaded.summary;
  const bestSummary =
    activeSummary.totalRecordsCount >= loaded.summary.totalRecordsCount
      ? activeSummary
      : loaded.summary;

  return {
    hasLocalData:
      bestSummary.totalRecordsCount > 0 || bestSummary.openingBalance > 0,
    totalRecordsCount: bestSummary.totalRecordsCount,
    memoCount: bestSummary.memoCount,
    cashTxCount: bestSummary.cashTxCount,
    productionRecordsCount: bestSummary.productionRecordsCount,
    advancedLedgerRecordsCount: bestSummary.advancedLedgerRecordsCount,
    openingBalance: bestSummary.openingBalance,
    lastSavedAt: loaded.savedAt,
    pendingOfflineSync: loaded.pendingOfflineSync,
  };
}

/**
 * Pure, deterministic local API mutation processor that mirrors server.ts routes
 * so the user can enter any memo, Sardar payment, production record, or cash entry
 * even when internet is 100% disconnected!
 */
export function processLocalApiMutation(
  urlPath: string,
  method: string,
  body: Record<string, unknown>,
  inputState: KilnDatabaseState
): {
  status: number;
  payload: EnrichedKilnPayload | { error: string };
  updatedState: NormalizedKilnDatabaseState;
} {
  const dbState = normalizeKilnDatabaseState(
    JSON.parse(JSON.stringify(inputState)) as KilnDatabaseState
  );
  const { todayDate } = getTodayAndYesterday();
  const cleanMethod = (method || 'GET').toUpperCase();
  const pathOnly = urlPath.split('?')[0];

  const ok = (extra: Record<string, unknown> = {}) => ({
    status: 200,
    payload: buildEnrichedPayloadFromState(dbState, {
      offlineSaved: true,
      ...extra,
    }),
    updatedState: dbState,
  });

  const badRequest = (error: string, status = 400) => ({
    status,
    payload: { error },
    updatedState: dbState,
  });

  // 1. GET /api/state
  if (cleanMethod === 'GET' && pathOnly === '/api/state') {
    return ok();
  }

  // 2. POST /api/settings
  if (cleanMethod === 'POST' && pathOnly === '/api/settings') {
    dbState.settings = {
      ...dbState.settings,
      ...(body as Partial<KilnSettings>),
      openingBalance: Number(
        body.openingBalance ?? dbState.settings.openingBalance
      ),
    };
    return ok();
  }

  // 3. POST /api/backup/restore or /api/backup/import
  if (
    cleanMethod === 'POST' &&
    (pathOnly === '/api/backup/restore' || pathOnly === '/api/backup/import')
  ) {
    const incoming = (
      body && body.state && Array.isArray((body.state as KilnDatabaseState).salesMemos)
        ? body.state
        : body
    ) as Partial<KilnDatabaseState>;
    const restored = normalizeKilnDatabaseState(incoming);
    return {
      status: 200,
      payload: buildEnrichedPayloadFromState(restored, {
        success: true,
        offlineSaved: true,
      }),
      updatedState: restored,
    };
  }

  // 4. POST /api/reset
  if (cleanMethod === 'POST' && pathOnly === '/api/reset') {
    const empty = normalizeKilnDatabaseState(createInitialKilnState());
    return {
      status: 200,
      payload: buildEnrichedPayloadFromState(empty, {
        success: true,
        offlineSaved: true,
      }),
      updatedState: empty,
    };
  }

  // 5. POST /api/memos
  if (cleanMethod === 'POST' && pathOnly === '/api/memos') {
    const customerName = String(body.customerName || '').trim();
    if (!customerName) {
      return badRequest('ক্রেতার নাম আবশ্যক।');
    }
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return badRequest('অন্তত একটি ইটের ধরন ও পরিমাণ যোগ করতে হবে।');
    }

    const { memoNo, duplicateErrorBn } = generateUniqueMemoNo(
      dbState.salesMemos,
      body.memoNo ? String(body.memoNo) : undefined
    );
    if (duplicateErrorBn) {
      return badRequest(duplicateErrorBn);
    }

    const stockCheck = validateStockForMultiItemMemo(
      dbState.brickGrades,
      items as Array<{ gradeId: string; quantity: number }>,
      true
    );
    if (!stockCheck.valid) {
      return badRequest(stockCheck.errorBn || 'স্টকে পর্যাপ্ত ইট নেই।');
    }

    const memoDate = String(body.date || todayDate);
    const memoRows: MemoItemRow[] = (
      items as Array<{ gradeId: string; quantity: number; rate?: number }>
    ).map((it) => {
      const g = dbState.brickGrades.find((gr) => gr.id === it.gradeId);
      const gradeName = g ? g.nameBn : '১ নং ইট';
      const rate = Number(it.rate ?? g?.ratePerUnit ?? 11000);
      const qty = Number(it.quantity) || 0;
      const lineTotal = calculateRowTotal(qty, rate);
      return {
        id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gradeId: it.gradeId,
        gradeName,
        quantity: qty,
        rate,
        ratePerThousand: false,
        lineTotal,
      };
    });

    const rawDiscount = Math.max(0, Number(body.discount ?? 0) || 0);
    const rawPaid = Math.max(0, Number(body.paidAmount ?? 0) || 0);
    const calc = calculateMultiItemMemoTotals({
      items: memoRows,
      discount: rawDiscount,
      paidAmount: rawPaid,
    });

    const nowIso = new Date().toISOString();
    const totalOrderedBricks = memoRows.reduce((s, r) => s + r.quantity, 0);
    const newMemo: SalesMemo = {
      id: `memo-${Date.now()}`,
      memoNo,
      date: memoDate,
      customerName,
      customerPhone: String(body.customerPhone || '—').trim(),
      customerAddress: String(body.customerAddress || 'বাবুলিয়া, সাতক্ষীরা').trim(),
      truckNo: String(body.truckNo || '—').trim(),
      driverName: String(body.driverName || '—').trim(),
      vehicleType: String(body.vehicleType || 'ট্রাক (Truck)').trim(),
      driverPhone: String(body.driverPhone || '—').trim(),
      deliveryStatus: 'BOOKING',
      deliveredQuantity: 0,
      remainingDeliveryQuantity: totalOrderedBricks,
      deliveryHistory: [],
      duePromiseDate: body.duePromiseDate ? String(body.duePromiseDate).trim() : '',
      items: memoRows,
      subTotal: calc.subTotal,
      discount: calc.discount,
      totalAmount: calc.totalAmount,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      paymentMethod: (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
      status: calc.status,
      note: String(body.note || '').trim(),
      createdAt: nowIso,
      paymentHistory:
        calc.paidAmount > 0
          ? [
              {
                id: `mpay-${Date.now()}-init`,
                date: memoDate,
                amount: calc.paidAmount,
                paymentMethod: (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
                type: 'INITIAL',
                note: 'মেমো তৈরির সময় নগদ জমা',
                createdAt: nowIso,
              },
            ]
          : [],
    };

    for (const [gradeId, remQty] of Object.entries(stockCheck.updatedStock)) {
      const g = dbState.brickGrades.find((gr) => gr.id === gradeId);
      if (g) g.currentStock = remQty;
    }

    dbState.salesMemos.unshift(newMemo);
    if (calc.paidAmount > 0) {
      const summaryItems = memoRows
        .map((r) => `${formatBn(r.quantity)}টি ${r.gradeName}`)
        .join(', ');
      dbState.cashTransactions.unshift({
        id: `tx-${Date.now()}`,
        date: memoDate,
        type: 'IN',
        category: 'ইট বিক্রয় আদায়',
        amount: calc.paidAmount,
        description: `মেমো ${memoNo} (${newMemo.customerName} - ${summaryItems})`,
        referenceId: newMemo.id,
        paymentMethod: newMemo.paymentMethod,
        verified: true,
        createdAt: nowIso,
      });
    }
    return ok({ memo: newMemo });
  }

  // 6. POST /api/memos/:id/collect-due
  const collectDueMatch = pathOnly.match(/^\/api\/memos\/([^/]+)\/collect-due$/);
  if (cleanMethod === 'POST' && collectDueMatch) {
    const memoId = collectDueMatch[1];
    const memo = dbState.salesMemos.find((m) => m.id === memoId);
    if (!memo) return badRequest('মেমোটি খুঁজে পাওয়া যায়নি।', 404);
    const collected = Math.round(Number(body.amount) || 0);
    if (collected <= 0 || collected > memo.dueAmount) {
      return badRequest('আদায়ের পরিমাণ সঠিক নয়।');
    }
    const payDate = String(body.date || todayDate);
    const payMethod: PaymentMethod =
      (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ';
    const customNote = body.note ? String(body.note).trim() : '';

    if (!Array.isArray(memo.paymentHistory)) memo.paymentHistory = [];
    memo.paidAmount += collected;
    memo.dueAmount = Math.max(0, memo.dueAmount - collected);
    memo.status = memo.dueAmount === 0 ? 'PAID' : 'PARTIAL';

    const newPaymentRecord = {
      id: `mpay-${Date.now()}`,
      date: payDate,
      amount: collected,
      paymentMethod: payMethod,
      type: 'DUE_COLLECTION' as const,
      note: customNote || 'বকেয়া কিস্তি জমা',
      createdAt: new Date().toISOString(),
    };
    memo.paymentHistory.push(newPaymentRecord);

    const tx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: payDate,
      type: 'IN',
      category: 'বাকি আদায়',
      amount: collected,
      description: `বাকি আদায়: মেমো ${memo.memoNo} (${memo.customerName})`,
      referenceId: memo.id,
      paymentMethod: payMethod,
      verified: true,
      createdAt: new Date().toISOString(),
    };
    dbState.cashTransactions.unshift(tx);
    return ok({ memo, paymentRecord: newPaymentRecord, transaction: tx });
  }

  // 7. PUT / DELETE /api/memos/:id
  const memoIdMatch = pathOnly.match(/^\/api\/memos\/([^/]+)$/);
  if (memoIdMatch) {
    const memoId = memoIdMatch[1];
    if (cleanMethod === 'DELETE') {
      const idx = dbState.salesMemos.findIndex((m) => m.id === memoId);
      if (idx !== -1) {
        const [removed] = dbState.salesMemos.splice(idx, 1);
        for (const it of removed.items || []) {
          const g = dbState.brickGrades.find((gr) => gr.id === it.gradeId);
          if (g) g.currentStock += it.quantity;
        }
        dbState.cashTransactions = dbState.cashTransactions.filter(
          (t) => t.referenceId !== removed.id
        );
        dbState.memoDeliveries = (dbState.memoDeliveries || []).filter(
          (d) => d.memoId !== removed.id
        );
      }
      return ok();
    }
  }

  // 8. POST / DELETE /api/deliveries
  if (cleanMethod === 'POST' && pathOnly === '/api/deliveries') {
    const cleanMemoNo = parseBanglaDigits(String(body.memoNo || '').trim()).toLowerCase();
    const memo = dbState.salesMemos.find(
      (m) =>
        (body.memoId && m.id === body.memoId) ||
        (cleanMemoNo &&
          parseBanglaDigits(String(m.memoNo || '').trim()).toLowerCase() === cleanMemoNo)
    );
    if (!memo) return badRequest('মেমো নম্বর খুঁজে পাওয়া যায়নি।', 404);
    const delivQty = Math.round(Number(parseBanglaDigits(String(body.quantity ?? 0))) || 0);
    if (delivQty <= 0) return badRequest('ডেলিভারি ইটের পরিমাণ ০-এর বেশি হতে হবে।');
    if (!Array.isArray(memo.deliveryHistory)) memo.deliveryHistory = [];
    const targetGradeId = String(body.gradeId || memo.items[0]?.gradeId || 'grade-1');
    const gradeObj = dbState.brickGrades.find((g) => g.id === targetGradeId);
    const newDelivery: MemoDeliveryRecord = {
      id: `deliv-${Date.now()}`,
      memoId: memo.id,
      memoNo: memo.memoNo,
      customerName: memo.customerName,
      customerPhone: memo.customerPhone || '—',
      date: String(body.date || todayDate),
      gradeId: targetGradeId,
      gradeName: cleanBrickGradeName(gradeObj?.nameBn || '১ নং ইট'),
      quantity: delivQty,
      truckNo: String(body.truckNo || memo.truckNo || '—').trim(),
      driverName: String(body.driverName || memo.driverName || '—').trim(),
      vehicleType: String(body.vehicleType || memo.vehicleType || 'ট্রাক (Truck)').trim(),
      note: String(body.note || 'ইট ডেলিভারি').trim(),
      createdAt: new Date().toISOString(),
    };
    memo.deliveryHistory.push(newDelivery);
    dbState.memoDeliveries.unshift(newDelivery);
    const totalOrdered = (memo.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const updatedDelivered = memo.deliveryHistory.reduce((s, d) => s + (Number(d.quantity) || 0), 0);
    memo.deliveredQuantity = updatedDelivered;
    memo.remainingDeliveryQuantity = Math.max(0, totalOrdered - updatedDelivered);
    memo.deliveryStatus = memo.remainingDeliveryQuantity === 0 ? 'DELIVERED' : 'PARTIAL';
    return ok({ delivery: newDelivery, memo });
  }

  const delivDeleteMatch = pathOnly.match(/^\/api\/deliveries\/([^/]+)$/);
  if (cleanMethod === 'DELETE' && delivDeleteMatch) {
    const delivId = delivDeleteMatch[1];
    dbState.memoDeliveries = (dbState.memoDeliveries || []).filter((d) => d.id !== delivId);
    for (const m of dbState.salesMemos) {
      if (Array.isArray(m.deliveryHistory)) {
        m.deliveryHistory = m.deliveryHistory.filter((d) => d.id !== delivId);
        const totalOrdered = (m.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        const newDeliv = m.deliveryHistory.reduce((s, d) => s + (Number(d.quantity) || 0), 0);
        m.deliveredQuantity = newDeliv;
        m.remainingDeliveryQuantity = Math.max(0, totalOrdered - newDeliv);
      }
    }
    return ok();
  }

  // 9. Cash Transactions (/api/cash)
  if (cleanMethod === 'POST' && pathOnly === '/api/cash') {
    const amt = parseNum(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return badRequest('টাকার পরিমাণ শূন্যের চেয়ে বেশি হতে হবে।');
    }
    const tx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: String(body.date || todayDate),
      type: body.type === 'IN' ? 'IN' : 'OUT',
      category: String(body.category || (body.type === 'IN' ? 'অন্যান্য জমা' : 'অন্যান্য খরচ')).trim(),
      amount: Math.round(amt),
      description: String(body.description || `${body.category} বাবদ লেনদেন`).trim(),
      paymentMethod: (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
      verified: true,
      createdAt: new Date().toISOString(),
    };
    dbState.cashTransactions.unshift(tx);
    return ok({ transaction: tx });
  }

  const cashIdMatch = pathOnly.match(/^\/api\/cash\/([^/]+)$/);
  if (cashIdMatch) {
    const txId = cashIdMatch[1];
    if (cleanMethod === 'PUT') {
      const tx = dbState.cashTransactions.find((t) => t.id === txId);
      if (!tx) return badRequest('লেনদেন খুঁজে পাওয়া যায়নি।', 404);
      if (body.amount !== undefined) tx.amount = Math.round(Number(body.amount) || tx.amount);
      if (body.category !== undefined) tx.category = String(body.category).trim();
      if (body.description !== undefined) tx.description = String(body.description).trim();
      if (body.date !== undefined) tx.date = String(body.date).trim();
      return ok({ transaction: tx });
    }
    if (cleanMethod === 'DELETE') {
      dbState.cashTransactions = dbState.cashTransactions.filter((t) => t.id !== txId);
      return ok();
    }
  }

  // 10. Inventory Add Stock (/api/inventory/add-stock)
  if (cleanMethod === 'POST' && pathOnly === '/api/inventory/add-stock') {
    const grade = dbState.brickGrades.find((g) => g.id === body.gradeId);
    if (!grade) return badRequest('ইটের গ্রেড পাওয়া যায়নি।');
    const qty = parseNum(body.quantity);
    if (qty > 0) {
      grade.currentStock += qty;
      grade.seasonProduced += qty;
    }
    if (body.newRate !== undefined && parseNum(body.newRate) > 0) {
      grade.ratePerUnit = parseNum(body.newRate);
    }
    return ok();
  }

  // 11. Mill Pot (/api/production/mill-pot)
  if (cleanMethod === 'POST' && pathOnly === '/api/production/mill-pot') {
    const validMillId: MillId =
      body.millId === 'mofijul' || body.millId === 'sofikul' ? body.millId : 'ohab';
    const millNames: Record<MillId, { bn: string; en: string }> = {
      ohab: { bn: 'ওহাব মিল', en: 'Ohab Mill' },
      mofijul: { bn: 'মফিজুল মিল', en: 'Mofijul Mill' },
      sofikul: { bn: 'শফিকুল মিল', en: 'Sofikul Mill' },
    };
    const rawCut = Math.max(0, parseNum(body.rawBricksCut));
    const taken = Math.max(0, Math.min(rawCut, parseNum(body.takenToChulli)));
    const remaining = Math.max(0, rawCut - taken);
    const rate = Math.max(0, parseNum(body.ratePerThousand, 1200) || 1200);
    const totalPayable = Math.round((rawCut / 1000) * rate);
    const paid = Math.max(0, parseNum(body.paidAmount));
    const due = Math.max(0, totalPayable - paid);

    if (body.id) {
      const existing = dbState.millPots.find((p) => p.id === body.id);
      if (existing) {
        const diffPaid = paid - existing.paidAmount;
        existing.millId = validMillId;
        existing.millNameBn = millNames[validMillId].bn;
        existing.millNameEn = millNames[validMillId].en;
        existing.potNo = String(body.potNo || existing.potNo).trim();
        existing.date = String(body.date || existing.date);
        existing.rawBricksCut = rawCut;
        existing.takenToChulli = taken;
        existing.remainingRawBricks = remaining;
        existing.ratePerThousand = rate;
        existing.totalPayable = totalPayable;
        existing.paidAmount = paid;
        existing.dueAmount = due;
        if (body.note !== undefined) existing.note = String(body.note).trim();
        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}`,
            section: 'MILL',
            referenceId: existing.id,
            recipientName: `${existing.millNameBn} (${existing.potNo})`,
            subDetail: `${formatBn(rawCut)} পিস ইট`,
            amount: diffPaid,
            date: existing.date,
            note: String(body.note || 'মিলের পট বাবদ টাকা জমা').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `${existing.millNameBn} (${existing.potNo}) কাঁচা ইট কাটা পেমেন্ট`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        return ok();
      }
    }

    const newPot: MillPotRecord = {
      id: `pot-${Date.now()}`,
      millId: validMillId,
      millNameBn: millNames[validMillId].bn,
      millNameEn: millNames[validMillId].en,
      potNo: String(body.potNo || `পট-${formatBn(dbState.millPots.length + 1)}`).trim(),
      date: String(body.date || todayDate),
      rawBricksCut: rawCut,
      takenToChulli: taken,
      remainingRawBricks: remaining,
      ratePerThousand: rate,
      totalPayable,
      paidAmount: paid,
      dueAmount: due,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.millPots.unshift(newPot);
    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}`,
        section: 'MILL',
        referenceId: newPot.id,
        recipientName: `${newPot.millNameBn} (${newPot.potNo})`,
        subDetail: `${formatBn(rawCut)} পিস ইট @ ৳${formatBn(rate)}/হাজার`,
        amount: paid,
        date: newPot.date,
        note: String(body.note || 'পট এন্ট্রির সময় প্রাথমিক জমা').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newPot.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `${newPot.millNameBn} (${newPot.potNo}) কাঁচা ইট কাটা পেমেন্ট`,
        referenceId: newPot.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  const millPotDeleteMatch = pathOnly.match(/^\/api\/production\/mill-pot\/([^/]+)$/);
  if (cleanMethod === 'DELETE' && millPotDeleteMatch) {
    const id = millPotDeleteMatch[1];
    dbState.millPots = dbState.millPots.filter((p) => p.id !== id);
    dbState.productionPayments = dbState.productionPayments.filter(
      (pay) => pay.referenceId !== id
    );
    return ok();
  }

  // 12. Chulli Load (/api/production/chulli-load)
  if (cleanMethod === 'POST' && pathOnly === '/api/production/chulli-load') {
    const rawInput = Math.max(0, parseNum(body.rawBricksLoaded));
    const pakaInput = Math.max(0, parseNum(body.pakaBricksLoaded));
    const rateInput = parseNum(body.ratePerVan) > 0 ? parseNum(body.ratePerVan) : 115;
    const calc = calculateVanLoadBill(rawInput, rateInput, pakaInput);
    const paid = Math.max(0, parseNum(body.paidAmount));
    const due = Math.max(0, calc.totalBill - paid);

    if (body.id) {
      const existing = dbState.chulliLoads.find((l) => l.id === body.id);
      if (existing) {
        const diffPaid = paid - existing.paidAmount;
        existing.sardarName = String(body.sardarName || existing.sardarName || 'সেলিম সর্দার').trim();
        existing.rawBricksLoaded = calc.rawBricksLoaded;
        existing.pakaBricksLoaded = calc.pakaBricksLoaded;
        existing.totalBricksLoaded = calc.totalBricksLoaded;
        existing.vanCount = calc.vanCount;
        existing.ratePerVan = calc.ratePerThousand;
        existing.totalBill = calc.totalBill;
        existing.paidAmount = paid;
        existing.dueAmount = due;
        if (body.date) existing.date = String(body.date);
        if (body.note !== undefined) existing.note = String(body.note).trim();
        if (diffPaid > 0) {
          const txId = `tx-${Date.now()}`;
          dbState.productionPayments.unshift({
            id: `ppay-${Date.now()}`,
            section: 'VAN_LOAD',
            referenceId: existing.id,
            recipientName: existing.sardarName,
            subDetail: `${formatBn(calc.totalBricksLoaded)} পিস ইট`,
            amount: diffPaid,
            date: existing.date,
            note: String(body.note || 'ভ্যান লোড বাবদ টাকা জমা').trim(),
            cashTxId: txId,
            createdAt: new Date().toISOString(),
          });
          dbState.cashTransactions.unshift({
            id: txId,
            date: existing.date,
            type: 'OUT',
            category: 'শ্রমিক ও সর্দার পেমেন্ট',
            amount: diffPaid,
            description: `চুল্লি ভ্যান লোড পেমেন্ট (${existing.sardarName})`,
            referenceId: existing.id,
            paymentMethod: 'নগদ ক্যাশ',
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
        return ok();
      }
    }

    const newLoad: ChulliLoadRecord = {
      id: `load-${Date.now()}`,
      date: String(body.date || todayDate),
      sardarName: String(body.sardarName || 'সেলিম সর্দার').trim(),
      rawBricksLoaded: calc.rawBricksLoaded,
      pakaBricksLoaded: calc.pakaBricksLoaded,
      totalBricksLoaded: calc.totalBricksLoaded,
      vanCount: calc.vanCount,
      ratePerVan: calc.ratePerThousand,
      totalBill: calc.totalBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.chulliLoads.unshift(newLoad);
    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}`,
        section: 'VAN_LOAD',
        referenceId: newLoad.id,
        recipientName: newLoad.sardarName,
        subDetail: `${formatBn(calc.totalBricksLoaded)} পিস ইট`,
        amount: paid,
        date: newLoad.date,
        note: String(body.note || 'ভ্যান লোড এন্ট্রির সময় জমা').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newLoad.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `চুল্লি ভ্যান লোড: ${newLoad.sardarName}`,
        referenceId: newLoad.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  const chulliLoadDeleteMatch = pathOnly.match(/^\/api\/production\/chulli-load\/([^/]+)$/);
  if (cleanMethod === 'DELETE' && chulliLoadDeleteMatch) {
    const id = chulliLoadDeleteMatch[1];
    dbState.chulliLoads = dbState.chulliLoads.filter((l) => l.id !== id);
    dbState.productionPayments = dbState.productionPayments.filter(
      (pay) => pay.referenceId !== id
    );
    return ok();
  }

  // 13. Porai Mistri (/api/production/porai-mistri)
  if (cleanMethod === 'POST' && pathOnly === '/api/production/porai-mistri') {
    const mCount = Math.max(1, Math.round(parseNum(body.mistriCount, 8) || 8));
    const mMonths = Math.max(0.5, parseNum(body.monthsCount, 5) || 5);
    const mMonthlyRate = Math.max(0, parseNum(body.monthlyRatePerMistri));
    const bFired = Math.max(0, parseNum(body.bricksFired));
    const fRate = parseNum(body.ratePerThousand) > 0 ? parseNum(body.ratePerThousand) : 400;

    let totalBill = 0;
    if (body.contractTotalBill !== undefined && parseNum(body.contractTotalBill, -1) >= 0) {
      totalBill = Math.round(parseNum(body.contractTotalBill));
    } else if (mMonthlyRate > 0) {
      totalBill = Math.round(mCount * mMonths * mMonthlyRate);
    } else if (bFired > 0) {
      totalBill = Math.round((bFired / 1000) * fRate);
    }
    const paid = Math.max(0, parseNum(body.paidAmount));
    const due = Math.max(0, totalBill - paid);

    const newRecord: PoraiMistriRecord = {
      id: `porai-${Date.now()}`,
      date: String(body.date || todayDate),
      mistriName: String(body.mistriName || 'আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)').trim(),
      chamberOrRound: String(body.chamberOrRound || 'সিজন চুক্তি').trim(),
      mistriCount: mCount,
      monthsCount: mMonths,
      monthlyRatePerMistri: mMonthlyRate,
      contractTotalBill: totalBill,
      bricksFired: bFired,
      ratePerThousand: fRate,
      totalBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.poraiMistriRecords.unshift(newRecord);
    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}`,
        section: 'PORAI_MISTRI',
        referenceId: newRecord.id,
        recipientName: newRecord.mistriName,
        subDetail: newRecord.chamberOrRound,
        amount: paid,
        date: newRecord.date,
        note: String(body.note || 'পোড়াই মিস্ত্রিকে সাপ্তাহিক টাকা প্রদান').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newRecord.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `পোড়াই মিস্ত্রি সাপ্তাহিক পেমেন্ট: ${newRecord.mistriName}`,
        referenceId: newRecord.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  const poraiDeleteMatch = pathOnly.match(/^\/api\/production\/porai-mistri\/([^/]+)$/);
  if (cleanMethod === 'DELETE' && poraiDeleteMatch) {
    const id = poraiDeleteMatch[1];
    dbState.poraiMistriRecords = dbState.poraiMistriRecords.filter((r) => r.id !== id);
    dbState.productionPayments = dbState.productionPayments.filter(
      (pay) => pay.referenceId !== id
    );
    return ok();
  }

  // 14. Chulli Unload (/api/production/chulli-unload)
  if (cleanMethod === 'POST' && pathOnly === '/api/production/chulli-unload') {
    const parsedLines = Math.max(0, parseNum(body.linesUnloaded));
    const parsedPaidUnload = Math.max(0, parseNum(body.paidAmount));
    const lineCalc = calculateChulliLineUnloadBill(
      parsedLines,
      parseNum(body.ratePerLine) > 0 ? parseNum(body.ratePerLine) : 750,
      parseNum(body.bricksPerLine) > 0 ? parseNum(body.bricksPerLine) : 4000,
      parsedPaidUnload
    );
    const targetGrade =
      dbState.brickGrades.find((g) => g.id === 'grade-1') || dbState.brickGrades[0];
    if (targetGrade && lineCalc.totalBricksUnloaded > 0) {
      targetGrade.currentStock += lineCalc.totalBricksUnloaded;
      targetGrade.seasonProduced += lineCalc.totalBricksUnloaded;
    }
    const newUnload: ChulliUnloadRecord = {
      id: `unload-${Date.now()}`,
      date: String(body.date || todayDate),
      chamberOrRound: String(body.chamberOrRound || 'রাউন্ড-০১').trim(),
      sardarName: String(body.sardarName || 'নজরুল সর্দার').trim(),
      linesUnloaded: lineCalc.linesUnloaded,
      bricksPerLine: lineCalc.bricksPerLine,
      ratePerLine: lineCalc.ratePerLine,
      unloadedByGrade:
        targetGrade && lineCalc.totalBricksUnloaded > 0
          ? [
              {
                gradeId: targetGrade.id,
                gradeName: targetGrade.nameBn,
                quantity: lineCalc.totalBricksUnloaded,
              },
            ]
          : ([] as UnloadedGradeItem[]),
      totalBricksUnloaded: lineCalc.totalBricksUnloaded,
      ratePerThousand: lineCalc.equivalentRatePerThousand,
      totalBill: lineCalc.totalBill,
      paidAmount: lineCalc.paidAmount,
      dueAmount: lineCalc.dueAmount,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.chulliUnloads.unshift(newUnload);
    if (lineCalc.paidAmount > 0) {
      const txId = `tx-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}`,
        section: 'UNLOAD',
        referenceId: newUnload.id,
        recipientName: `${newUnload.sardarName} (${newUnload.chamberOrRound})`,
        subDetail: `${formatBn(lineCalc.linesUnloaded)} লাইন আনলোড`,
        amount: lineCalc.paidAmount,
        date: newUnload.date,
        note: String(body.note || 'লাইন আনলোড এন্ট্রির সময় জমা').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newUnload.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: lineCalc.paidAmount,
        description: `চুল্লি লাইন আনলোড: ${newUnload.sardarName}`,
        referenceId: newUnload.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  const unloadDeleteMatch = pathOnly.match(/^\/api\/production\/chulli-unload\/([^/]+)$/);
  if (cleanMethod === 'DELETE' && unloadDeleteMatch) {
    const id = unloadDeleteMatch[1];
    const removed = dbState.chulliUnloads.find((u) => u.id === id);
    if (removed && (removed.totalBricksUnloaded || 0) > 0) {
      const g = dbState.brickGrades.find((gr) => gr.id === 'grade-1') || dbState.brickGrades[0];
      if (g) {
        g.currentStock = Math.max(0, g.currentStock - (removed.totalBricksUnloaded || 0));
        g.seasonProduced = Math.max(0, g.seasonProduced - (removed.totalBricksUnloaded || 0));
      }
    }
    dbState.chulliUnloads = dbState.chulliUnloads.filter((u) => u.id !== id);
    dbState.productionPayments = dbState.productionPayments.filter(
      (pay) => pay.referenceId !== id
    );
    return ok();
  }

  // 15. Rubbish Sardar (/api/production/rubbish)
  if (cleanMethod === 'POST' && pathOnly === '/api/production/rubbish') {
    const rBill = Math.max(0, Math.round(parseNum(body.roundBill)));
    const paid = Math.max(0, Math.round(parseNum(body.paidAmount)));
    const due = Math.max(0, rBill - paid);
    const newRubbish: RubbishRecord = {
      id: `rubbish-${Date.now()}`,
      date: String(body.date || todayDate),
      sardarName: String(body.sardarName || 'অবেদ রাবিশ সর্দার').trim(),
      chamberOrRound: String(body.chamberOrRound || '১ম রাউন্ড').trim(),
      roundBill: rBill,
      paidAmount: paid,
      dueAmount: due,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.rubbishRecords.unshift(newRubbish);
    if (paid > 0) {
      const txId = `tx-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-${Date.now()}`,
        section: 'RUBBISH',
        referenceId: newRubbish.id,
        recipientName: `${newRubbish.sardarName} (${newRubbish.chamberOrRound})`,
        subDetail: `${newRubbish.chamberOrRound} · রাউন্ড বিল ৳${formatBn(rBill)}`,
        amount: paid,
        date: newRubbish.date,
        note: String(body.note || 'রাবিশ সর্দারকে খোরাকি/জমা প্রদান').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newRubbish.date,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: paid,
        description: `রাবিশ সর্দার পেমেন্ট/খোরাকি: ${newRubbish.sardarName}`,
        referenceId: newRubbish.id,
        paymentMethod: 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  const rubbishDeleteMatch = pathOnly.match(/^\/api\/production\/rubbish\/([^/]+)$/);
  if (cleanMethod === 'DELETE' && rubbishDeleteMatch) {
    const id = rubbishDeleteMatch[1];
    dbState.rubbishRecords = (dbState.rubbishRecords || []).filter((r) => r.id !== id);
    dbState.productionPayments = dbState.productionPayments.filter(
      (pay) => pay.referenceId !== id
    );
    return ok();
  }

  // 16. Wood & Fuel (/api/production/wood-fuel)
  if (cleanMethod === 'POST' && pathOnly === '/api/production/wood-fuel') {
    const cleanSupplier = String(body.supplierName || '').trim();
    if (!cleanSupplier) return badRequest('কাঠ সাপ্লায়ার বা ব্যাপারীর নাম লিখুন।');
    const billCalc = calculateWoodFuelBill(
      parseNum(body.quantity),
      parseNum(body.ratePerUnit),
      parseNum(body.paidAmount)
    );
    const newRecord: WoodFuelRecord = {
      id: `wood-${Date.now()}`,
      date: String(body.date || todayDate),
      supplierName: cleanSupplier,
      supplierPhone: String(body.supplierPhone || '').trim(),
      woodType: String(body.woodType || 'মিক্সড জ্বালানি কাঠ').trim(),
      vehicleOrChallan: String(body.vehicleOrChallan || '').trim(),
      quantity: billCalc.quantity,
      unit: String(body.unit || 'মণ').trim(),
      ratePerUnit: billCalc.ratePerUnit,
      totalBill: billCalc.totalBill,
      paidAmount: billCalc.paidAmount,
      dueAmount: billCalc.dueAmount,
      paymentMethod: (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ',
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.woodFuelRecords.unshift(newRecord);
    if (billCalc.paidAmount > 0) {
      const txId = `tx-wood-${Date.now()}`;
      dbState.productionPayments.unshift({
        id: `ppay-wood-${Date.now()}`,
        section: 'JALANI',
        referenceId: newRecord.id,
        recipientName: `${newRecord.supplierName} (${newRecord.woodType})`,
        subDetail: `${formatBn(newRecord.quantity)} ${newRecord.unit}`,
        amount: billCalc.paidAmount,
        date: newRecord.date,
        note: String(body.note || 'কাঠ সরবরাহের সময় নগদ পেমেন্ট').trim(),
        cashTxId: txId,
        createdAt: new Date().toISOString(),
      });
      dbState.cashTransactions.unshift({
        id: txId,
        date: newRecord.date,
        type: 'OUT',
        category: 'বিদ্যুৎ ও জ্বালানি',
        amount: billCalc.paidAmount,
        description: `জ্বালানি কাঠ ক্রয়: ${newRecord.supplierName}`,
        referenceId: newRecord.id,
        paymentMethod: newRecord.paymentMethod || 'নগদ ক্যাশ',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  // 17. Workers & Hajira (/api/workers, /api/workers/hajira, /api/workers/pay, /api/workers/attendance)
  if (cleanMethod === 'POST' && pathOnly === '/api/workers') {
    const name = String(body.name || '').trim();
    if (!name) return badRequest('শ্রমিক বা সর্দারের নাম আবশ্যক।');
    const mRate = Math.max(0, Number(body.morningRate) || 125);
    const aRate = Math.max(0, Number(body.afternoonRate) || 125);
    const newWorker: WorkerProfile = {
      id: `w-${Date.now()}`,
      name,
      role: String(body.role || 'দিনমজুর (Daily Labour)').trim(),
      phone: String(body.phone || '—').trim(),
      morningRate: mRate,
      afternoonRate: aRate,
      active: true,
      totalEarnedSeason: 0,
      totalPaidSeason: 0,
    };
    dbState.workerProfiles.push(newWorker);
    return ok();
  }

  if (cleanMethod === 'POST' && pathOnly === '/api/workers/hajira') {
    const worker = dbState.workerProfiles.find((w) => w.id === body.workerId);
    if (!worker) return badRequest('শ্রমিক খুঁজে পাওয়া যায়নি।', 404);
    const attDate = String(body.date || todayDate);
    const isMorning = Boolean(body.morningPresent);
    const isAfternoon = Boolean(body.afternoonPresent);
    const mRate = body.morningRate !== undefined ? Number(body.morningRate) : worker.morningRate;
    const aRate = body.afternoonRate !== undefined ? Number(body.afternoonRate) : worker.afternoonRate;
    const newMorningAmt = isMorning ? mRate : 0;
    const newAfternoonAmt = isAfternoon ? aRate : 0;
    const savedRecord: WorkerAttendance = {
      id: `att-hajira-${Date.now()}`,
      date: attDate,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: worker.role,
      recordType: 'HAJIRA',
      morningPresent: isMorning,
      afternoonPresent: isAfternoon,
      morningAmount: newMorningAmt,
      afternoonAmount: newAfternoonAmt,
      khorakiAmount: 0,
      hatbarAmount: 0,
      totalPaid: 0,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    worker.totalEarnedSeason = (worker.totalEarnedSeason || 0) + newMorningAmt + newAfternoonAmt;
    dbState.workerAttendance.unshift(savedRecord);
    return ok({ attendance: savedRecord });
  }

  if (cleanMethod === 'POST' && pathOnly === '/api/workers/pay') {
    const worker = dbState.workerProfiles.find((w) => w.id === body.workerId);
    if (!worker) return badRequest('শ্রমিক খুঁজে পাওয়া যায়নি।', 404);
    const payAmt = Math.max(0, Number(body.amount) || 0);
    if (payAmt <= 0) return badRequest('জমা দেওয়ার টাকার পরিমাণ ০-এর বেশি হতে হবে।');
    const payDate = String(body.date || todayDate);
    const pType = String(body.paymentType || 'নগদ মজুরি জমা').trim();
    const txId = `tx-wpay-${Date.now()}`;
    const payRecord: WorkerAttendance = {
      id: `att-pay-${Date.now()}`,
      date: payDate,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: worker.role,
      recordType: 'PAYMENT',
      paymentType: pType,
      morningPresent: false,
      afternoonPresent: false,
      morningAmount: 0,
      afternoonAmount: 0,
      khorakiAmount: pType.includes('খোরাকি') ? payAmt : 0,
      hatbarAmount: pType.includes('হাটবার') ? payAmt : 0,
      totalPaid: payAmt,
      note: String(body.note || `${pType} প্রদান`).trim(),
      cashTxId: txId,
      createdAt: new Date().toISOString(),
    };
    dbState.workerAttendance.unshift(payRecord);
    worker.totalPaidSeason = (worker.totalPaidSeason || 0) + payAmt;
    dbState.cashTransactions.unshift({
      id: txId,
      date: payDate,
      type: 'OUT',
      category: 'শ্রমিক ও সর্দার পেমেন্ট',
      amount: payAmt,
      description: `লেবার টাকা জমা (${pType}): ${worker.name}`,
      referenceId: payRecord.id,
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: new Date().toISOString(),
    });
    return ok({ attendance: payRecord });
  }

  // 18. Notes (/api/notes)
  if (cleanMethod === 'POST' && pathOnly === '/api/notes') {
    const text = String(body.text || '').trim();
    if (!text) return badRequest('নোটের লেখা আবশ্যক।');
    const note: KilnNote = {
      id: `note-${Date.now()}`,
      date: todayDate,
      title: String(body.title || 'নোট').trim(),
      text,
      priority: body.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
      pinned: Boolean(body.pinned),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    dbState.kilnNotes.unshift(note);
    return ok();
  }

  const noteIdMatch = pathOnly.match(/^\/api\/notes\/([^/]+)$/);
  if (noteIdMatch) {
    const id = noteIdMatch[1];
    if (cleanMethod === 'PATCH') {
      const note = dbState.kilnNotes.find((n) => n.id === id);
      if (note && body.completed !== undefined) {
        note.completed = Boolean(body.completed);
      }
      return ok();
    }
    if (cleanMethod === 'DELETE') {
      dbState.kilnNotes = dbState.kilnNotes.filter((n) => n.id !== id);
      return ok();
    }
  }

  // 19. Advanced Ledgers (/api/ledgers/*)
  if (cleanMethod === 'POST' && pathOnly === '/api/ledgers/soil-coal') {
    const itemType = body.itemType === 'COAL' ? 'COAL' : 'SOIL';
    const supplierName = String(body.supplierName || '').trim();
    if (!supplierName) return badRequest('সাপ্লায়ারের নাম আবশ্যক।');
    const calc = calculateSoilCoalBill(
      Number(body.quantity) || 0,
      Number(body.ratePerUnit) || 0,
      Number(body.paidAmount) || 0
    );
    const recordDate = String(body.date || todayDate).trim();
    const paymentMethod: PaymentMethod =
      (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ';
    const record: SoilCoalRecord = {
      id: `sc-${Date.now()}`,
      date: recordDate,
      itemType,
      supplierName,
      supplierPhone: String(body.supplierPhone || '').trim(),
      specification: String(
        body.specification || (itemType === 'COAL' ? 'ইন্দোনেশিয়ান কয়লা' : 'এঁটেল মাটি')
      ).trim(),
      vehicleOrChallan: String(body.vehicleOrChallan || '').trim(),
      quantity: calc.quantity,
      unit: String(body.unit || (itemType === 'COAL' ? 'টন' : 'গাড়ি')).trim(),
      ratePerUnit: calc.ratePerUnit,
      totalBill: calc.totalBill,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.soilCoalRecords.unshift(record);
    if (calc.paidAmount > 0) {
      const cat: ExpenseCategory = itemType === 'COAL' ? 'কয়লা ক্রয়' : 'মাটি ক্রয়';
      dbState.cashTransactions.unshift({
        id: `tx-sc-${Date.now()}`,
        date: recordDate,
        type: 'OUT',
        category: cat,
        amount: calc.paidAmount,
        description: `${cat} পেমেন্ট — সাপ্লায়ার: ${supplierName}`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  if (cleanMethod === 'POST' && pathOnly === '/api/ledgers/dadon') {
    const recipientName = String(body.recipientName || '').trim();
    if (!recipientName) return badRequest('সর্দার বা মিস্ত্রির নাম আবশ্যক।');
    const advanceAmount = Math.max(0, Math.round(Number(body.advanceAmount) || 0));
    const manualWorkBill = Math.max(0, Math.round(Number(body.manualWorkBill) || 0));
    const cashReturnedOrSettled = Math.max(
      0,
      Math.round(Number(body.cashReturnedOrSettled) || 0)
    );
    const recordDate = String(body.date || todayDate).trim();
    const roleCategory: DadonRoleCategory =
      (body.roleCategory as DadonRoleCategory) || 'মিল সর্দার';
    const paymentMethod: PaymentMethod =
      (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ';
    const record: DadonAdvanceRecord = {
      id: `dadon-${Date.now()}`,
      date: recordDate,
      recipientName,
      recipientPhone: String(body.recipientPhone || '').trim(),
      roleCategory,
      advanceAmount,
      manualWorkBill,
      cashReturnedOrSettled,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.dadonRecords.unshift(record);
    if (advanceAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-dadon-${Date.now()}`,
        date: recordDate,
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: advanceAmount,
        description: `সর্দার/মিস্ত্রি দাদন প্রদান: ${recipientName}`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  if (cleanMethod === 'POST' && pathOnly === '/api/ledgers/advance-booking') {
    const customerName = String(body.customerName || '').trim();
    if (!customerName) return badRequest('ক্রেতার নাম আবশ্যক।');
    const grade =
      dbState.brickGrades.find((g) => g.id === body.gradeId) || dbState.brickGrades[0];
    const calc = calculateAdvanceBookingBill(
      Number(body.bookedQuantity) || 0,
      Number(body.ratePerThousand) || grade.ratePerUnit || 11000,
      Number(body.advancePaid) || 0,
      Number(body.deliveredQuantity) || 0
    );
    const recordDate = String(body.date || todayDate).trim();
    const bookingNo =
      String(body.bookingNo || '').trim() ||
      `BK-${4001 + (dbState.advanceBookings?.length || 0)}`;
    const paymentMethod: PaymentMethod =
      (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ';
    const booking: AdvanceBrickBooking = {
      id: `bk-${Date.now()}`,
      bookingNo,
      date: recordDate,
      deliveryTargetDate: String(body.deliveryTargetDate || recordDate).trim(),
      customerName,
      customerPhone: String(body.customerPhone || '—').trim(),
      customerAddress: String(body.customerAddress || 'স্থানীয়').trim(),
      gradeId: grade.id,
      gradeName: cleanBrickGradeName(grade.nameBn),
      bookedQuantity: calc.bookedQuantity,
      ratePerThousand: calc.ratePerThousand,
      totalAmount: calc.totalAmount,
      advancePaid: calc.advancePaid,
      dueAmount: calc.dueAmount,
      deliveredQuantity: calc.deliveredQuantity,
      status: calc.status,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.advanceBookings.unshift(booking);
    if (calc.advancePaid > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-bk-${Date.now()}`,
        date: recordDate,
        type: 'IN',
        category: 'ইট বিক্রয় আদায়',
        amount: calc.advancePaid,
        description: `অগ্রিম ইট বুকিং জমা (${bookingNo}): ${customerName}`,
        referenceId: booking.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  if (cleanMethod === 'POST' && pathOnly === '/api/ledgers/vehicle-diesel') {
    const vehicleName = String(body.vehicleName || '').trim();
    if (!vehicleName) return badRequest('গাড়ি বা ভেকুর নাম আবশ্যক।');
    const calc = calculateVehicleDieselExpense(
      Number(body.dieselLiters) || 0,
      Number(body.dieselRate) || 110,
      Number(body.driverAllowance) || 0,
      Number(body.maintenanceCost) || 0,
      body.paidAmount !== undefined && body.paidAmount !== ''
        ? Number(body.paidAmount)
        : undefined
    );
    const recordDate = String(body.date || todayDate).trim();
    const vehicleType: KilnVehicleType =
      (body.vehicleType as KilnVehicleType) || 'ভেকু (Excavator)';
    const paymentMethod: PaymentMethod =
      (body.paymentMethod as PaymentMethod) || 'নগদ ক্যাশ';
    const record: VehicleDieselRecord = {
      id: `vd-${Date.now()}`,
      date: recordDate,
      vehicleName,
      vehicleType,
      driverName: String(body.driverName || '—').trim(),
      workOrTripSummary: String(body.workOrTripSummary || 'দৈনিক কাজ ও ট্রিপ').trim(),
      dieselLiters: calc.dieselLiters,
      dieselRate: calc.dieselRate,
      dieselCost: calc.dieselCost,
      driverAllowance: calc.driverAllowance,
      maintenanceCost: calc.maintenanceCost,
      totalExpense: calc.totalExpense,
      paidAmount: calc.paidAmount,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.vehicleDieselRecords.unshift(record);
    if (calc.paidAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-vd-${Date.now()}`,
        date: recordDate,
        type: 'OUT',
        category: 'ভেকু ও ডিজেল',
        amount: calc.paidAmount,
        description: `গাড়ি/ভেকু ও ডিজেল খরচ (${vehicleName})`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  if (cleanMethod === 'POST' && pathOnly === '/api/ledgers/compliance') {
    const titleBn = String(body.titleBn || '').trim();
    if (!titleBn) return badRequest('লাইসেন্স, ভ্যাট বা কিস্তির বিবরণ আবশ্যক।');
    const calc = calculateComplianceItemBill(
      Number(body.totalPayable) || 0,
      Number(body.paidAmount) || 0
    );
    const category: ComplianceCategory =
      (body.category as ComplianceCategory) || 'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)';
    const paymentMethod: PaymentMethod =
      (body.paymentMethod as PaymentMethod) || 'ব্যাংক চেক / ট্রান্সফার';
    const record: ComplianceInstallmentRecord = {
      id: `comp-${Date.now()}`,
      titleBn,
      category,
      authorityOrBankName: String(
        body.authorityOrBankName || 'সংশ্লিষ্ট দপ্তর / ব্যাংক'
      ).trim(),
      referenceNo: String(body.referenceNo || '').trim(),
      dueDate: String(body.dueDate || todayDate).trim(),
      totalPayable: calc.totalPayable,
      paidAmount: calc.paidAmount,
      dueAmount: calc.dueAmount,
      status: calc.status,
      lastPaidDate: calc.paidAmount > 0 ? todayDate : undefined,
      paymentMethod,
      note: String(body.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    dbState.complianceRecords.unshift(record);
    if (calc.paidAmount > 0) {
      dbState.cashTransactions.unshift({
        id: `tx-comp-${Date.now()}`,
        date: todayDate,
        type: 'OUT',
        category: 'ভাটা পরিচালনা ও বিবিধ',
        amount: calc.paidAmount,
        description: `লাইসেন্স/ভ্যাট/ব্যাংক কিস্তি পরিশোধ: ${titleBn}`,
        referenceId: record.id,
        paymentMethod,
        verified: true,
        createdAt: new Date().toISOString(),
      });
    }
    return ok();
  }

  // Fallback for any other endpoint: return current enriched state so UI never crashes offline
  return ok();
}

let fetchInterceptorInstalled = false;

/**
 * Installs a resilient Offline-First fetch interceptor on `window.fetch` for `/api/*`.
 * - When online: syncs with server AND mirrors every state change to Phone Local Storage + IndexedDB.
 * - If server state has fewer records than Phone Local Storage (e.g., server restarted while phone was offline),
 *   automatically protects Phone Local Storage and restores it to the server!
 * - When offline (`!navigator.onLine` or network fetch error): executes `/api/*` mutations directly
 *   against the Phone Local Storage database so 0 data is ever lost!
 */
export function installOfflineResilientFetchInterceptor(): void {
  if (typeof window === 'undefined' || fetchInterceptorInstalled) return;
  fetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  const syncLocalVaultToServer = async (localState: KilnDatabaseState) => {
    try {
      const res = await originalFetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localState),
      });
      if (res.ok) {
        const payload = (await res.json()) as EnrichedKilnPayload;
        if (payload?.state) {
          saveMasterStateToPhoneStorage(payload.state, {
            markPendingOfflineSync: false,
          });
        }
        return payload;
      }
    } catch {
      // still offline or unreachable
    }
    return null;
  };

  // Automatically sync pending offline data as soon as the phone regains internet
  window.addEventListener('online', () => {
    const localLoaded = loadMasterStateFromPhoneStorage();
    if (
      localLoaded.pendingOfflineSync ||
      localLoaded.summary.totalRecordsCount > 0 ||
      localLoaded.summary.openingBalance > 0
    ) {
      void syncLocalVaultToServer(localLoaded.state);
    }
  });

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const isApiCall =
      urlStr.startsWith('/api/') ||
      urlStr.includes(`${window.location.origin}/api/`);

    if (!isApiCall) {
      return originalFetch(input, init);
    }

    const pathOnly = urlStr.replace(window.location.origin, '');
    const method = (
      init?.method ||
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    let parsedBody: Record<string, unknown> = {};
    if (init?.body && typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        parsedBody = {};
      }
    }

    // Explicit Reset handling: allow clearing local phone vault ONLY on /api/reset
    if (method === 'POST' && pathOnly.startsWith('/api/reset')) {
      const empty = createInitialKilnState();
      saveMasterStateToPhoneStorage(empty, {
        markPendingOfflineSync: false,
        allowEmptyOverwrite: true,
      });
      try {
        return await originalFetch(input, init);
      } catch {
        const resPayload = buildEnrichedPayloadFromState(empty, {
          success: true,
          offlineSaved: true,
        });
        return new Response(JSON.stringify(resPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Special protection for GET /api/state:
    // Never let a restarted or empty server overwrite richer phone local data!
    if (method === 'GET' && pathOnly.startsWith('/api/state')) {
      const localVault = loadMasterStateFromPhoneStorage();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const offlinePayload = buildEnrichedPayloadFromState(localVault.state, {
          offlineSaved: true,
        });
        return new Response(JSON.stringify(offlinePayload), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-SBL-Offline-Mode': '1',
          },
        });
      }

      try {
        const res = await originalFetch(input, init);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const serverData = (await res.json()) as EnrichedKilnPayload;
        const serverSummary = computeDatabaseRecordSummary(serverData?.state);

        // If phone has pending offline changes OR phone has more records than server:
        // Phone Local Storage wins and pushes up to server!
        if (
          (localVault.pendingOfflineSync &&
            (localVault.summary.totalRecordsCount > 0 ||
              localVault.summary.openingBalance > 0)) ||
          localVault.summary.totalRecordsCount > serverSummary.totalRecordsCount ||
          (serverSummary.totalRecordsCount === 0 &&
            localVault.summary.openingBalance > serverSummary.openingBalance)
        ) {
          const synced = await syncLocalVaultToServer(localVault.state);
          const winningPayload =
            synced ||
            buildEnrichedPayloadFromState(localVault.state, {
              offlineSaved: true,
            });
          return new Response(JSON.stringify(winningPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Otherwise server is up-to-date; mirror to phone storage
        if (
          serverData?.state &&
          (serverSummary.totalRecordsCount > 0 || serverSummary.openingBalance > 0)
        ) {
          saveMasterStateToPhoneStorage(serverData.state, {
            markPendingOfflineSync: false,
          });
        }
        return new Response(JSON.stringify(serverData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        // Network failed on /api/state -> immediately serve from Phone Local Storage!
        const offlinePayload = buildEnrichedPayloadFromState(localVault.state, {
          offlineSaved: true,
        });
        return new Response(JSON.stringify(offlinePayload), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-SBL-Offline-Mode': '1',
          },
        });
      }
    }

    // For all mutations (POST / PUT / PATCH / DELETE):
    // If online, try server first, but if offline or fetch fails, execute locally on the phone!
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const localBefore = loadMasterStateFromPhoneStorage();
        // If phone had unsynced offline entries before this online mutation, sync them first!
        if (
          localBefore.pendingOfflineSync &&
          !pathOnly.startsWith('/api/backup/')
        ) {
          await syncLocalVaultToServer(localBefore.state);
        }

        const res = await originalFetch(input, init);
        if (res.ok) {
          const cloned = res.clone();
          cloned
            .json()
            .then((data: EnrichedKilnPayload) => {
              if (data?.state) {
                saveMasterStateToPhoneStorage(data.state, {
                  markPendingOfflineSync: false,
                });
              }
            })
            .catch(() => {});
          return res;
        }
        // If server returned 4xx validation error, pass it through
        if (res.status >= 400 && res.status < 500) {
          return res;
        }
      } catch {
        // Network disconnected mid-request -> fall through to Offline Local Engine below!
      }
    }

    // OFFLINE EXECUTION PATH: Execute mutation directly against Phone Local Storage!
    const currentLocal = loadMasterStateFromPhoneStorage();
    const localResult = processLocalApiMutation(
      pathOnly,
      method,
      parsedBody,
      currentLocal.state
    );

    if (localResult.status >= 200 && localResult.status < 300) {
      saveMasterStateToPhoneStorage(localResult.updatedState, {
        markPendingOfflineSync: true,
      });
    }

    return new Response(JSON.stringify(localResult.payload), {
      status: localResult.status,
      headers: {
        'Content-Type': 'application/json',
        'X-SBL-Offline-Saved': '1',
      },
    });
  };
}
