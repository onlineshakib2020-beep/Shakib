import type {
  BrickGrade,
  CashTransaction,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  KilnDatabaseState,
  KilnSeason,
  KilnUnit,
  MemoDeliveryRecord,
  MillPotRecord,
  PoraiMistriRecord,
  ProductionPaymentRecord,
  SalesMemo,
  WoodFuelRecord,
  WorkerAttendance,
} from '../types/kiln.ts';
import { cleanBrickGradeName, formatBn, parseBanglaDigits } from './kilnLogic.ts';

export function convertWoodRecordToMaund(record: Pick<WoodFuelRecord, 'quantity' | 'unit'>): number {
  const qty = Math.max(0, Number(record.quantity) || 0);
  if (record.unit === 'টন') return Math.round(qty * 25 * 100) / 100;
  if (record.unit === 'গাড়ি') return Math.round(qty * 50 * 100) / 100;
  if (record.unit === 'কেজি') return Math.round((qty / 40) * 100) / 100;
  return Math.round(qty * 100) / 100;
}

export const BENGALI_MONTH_NAMES: Record<string, string> = {
  '01': 'জানুয়ারি',
  '02': 'ফেব্রুয়ারি',
  '03': 'মার্চ',
  '04': 'এপ্রিল',
  '05': 'মে',
  '06': 'জুন',
  '07': 'জুলাই',
  '08': 'আগস্ট',
  '09': 'সেপ্টেম্বর',
  '10': 'অক্টোবর',
  '11': 'নভেম্বর',
  '12': 'ডিসেম্বর',
};

export type ArchiveTransactionType =
  | 'ALL'
  | 'SALES_MEMO'
  | 'COLLECTION'
  | 'EXPENSE'
  | 'SOIL_PURCHASE'
  | 'PRODUCTION'
  | 'DELIVERY'
  | 'LABOR';

export interface YearlySeasonalFilter {
  mode: 'YEAR' | 'SEASON' | 'CUSTOM_RANGE';
  year?: number;
  seasonId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  kilnId?: string;    // 'ALL' or specific kilnId e.g. 'sbl-1'
  customerQuery?: string;
  memoNoQuery?: string;
  txTypeFilter?: ArchiveTransactionType;
}

export interface MonthlyAnalyticsPoint {
  monthKey: string; // YYYY-MM
  monthNumber: number; // 1..12
  monthLabelBn: string; // যেমন: অক্টোবর ২০২৫
  monthShortBn: string; // যেমন: অক্টো '২৫
  inPeriod: boolean;
  memoCount: number;
  salesAmount: number;
  creditSalesAmount: number;
  actualCollectionAmount: number;
  otherIncomeAmount: number;
  expenseAmount: number;
  netCashMovement: number;
  bricksSoldQty: number;
  bricksDeliveredQty: number;
  rawBricksCut: number;
  chulliLoadedBricks: number;
  poraiFiredBricks: number;
  pakaUnloadedBricks: number;
  productionVolumeBricks: number;
  soilExpenseAmount: number;
  laborPaidAmount: number;
  woodFuelMaund: number;
  woodFuelBillAmount: number;
  woodFuelDeliveryCount: number;
  fuelAndCoalExpenseAmount: number;
  cumulativeReceivables: number;
}

export interface GradePeriodSummaryRow {
  gradeId: string;
  gradeNameBn: string;
  ratePerThousand: number;
  unloadedQty: number;
  soldQty: number;
  soldAmount: number;
  deliveredQty: number;
  pendingDeliveryQty: number;
  currentStock: number;
}

export interface ExpenseCategoryBreakdownRow {
  category: string;
  amount: number;
  txCount: number;
  sharePct: number;
}

export interface ArchiveLedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  txType: ArchiveTransactionType;
  txTypeLabelBn: string;
  kilnId: string;
  kilnNameBn: string;
  memoNo?: string;
  partyName: string;
  partyPhone?: string;
  descriptionBn: string;
  quantityPieces?: number;
  billedOrPayableAmount: number;
  cashInAmount: number;
  cashOutAmount: number;
  balanceImpactAmount: number;
  paymentMethod?: string;
  sourceRecordId: string;
}

export interface SeasonReconciliationSummary {
  // 1. Customer Receivables
  openingCustomerReceivables: number;
  periodNewSales: number;
  periodCustomerCollections: number;
  closingCustomerReceivables: number;
  periodUnpaidMemoDue: number;

  // 2. Brick Stock
  openingStockBricks: number;
  periodProducedBricks: number;
  periodSoldBricks: number;
  periodDeliveredBricks: number;
  damageOrAdjustmentBricks: number;
  closingStockBricks: number;

  // 3. Cash & Accounts
  openingCashBalance: number;
  periodCashReceived: number; // Customer collections + Other income
  periodTotalExpenses: number;
  closingCashBalance: number;

  // 4. Supplier, Mill, Sardar & Labor Liabilities
  openingLiabilities: number;
  periodIncurredLiabilities: number;
  periodPaidLiabilities: number;
  closingLiabilities: number;
}

export interface YearlySeasonalReport {
  periodTitleBn: string;
  periodSubtitleBn: string;
  startDate: string;
  endDate: string;
  kilnId: string;
  kilnNameBn: string;
  selectedYear?: number;
  selectedSeason?: KilnSeason;
  hasRecordsInPeriod: boolean;

  // Core KPIs
  totalSalesAmount: number;
  totalMemoCount: number;
  totalDiscountAmount: number;
  totalCreditSalesAmount: number;
  totalActualCollections: number;
  initialMemoCollections: number;
  dueCollections: number;
  totalOutstandingReceivables: number;
  totalExpenses: number;
  otherIncome: number;
  netCashMovement: number;

  // Production & Stock KPIs
  rawBricksCut: number;
  chulliLoadedBricks: number;
  poraiFiredBricks: number;
  pakaUnloadedBricks: number;
  totalBricksSoldQty: number;
  totalBricksDeliveredQty: number;
  totalPendingDeliveryQty: number;

  // Labor, Supplier & Soil KPIs
  laborEarnedAmount: number;
  laborPaidAmount: number;
  laborOutstandingDue: number;
  supplierAndContractorPayable: number;
  supplierAndContractorPaid: number;
  supplierAndContractorDue: number;
  soilAndRawMaterialAmount: number;
  soilTicketCount: number;
  coalPurchaseAmount: number;
  dieselAndVekuAmount: number;

  // Wood & Fuel Consumption KPIs
  totalWoodFuelMaund: number;
  totalWoodFuelDeliveries: number;
  totalWoodFuelBillAmount: number;
  totalWoodFuelPaidAmount: number;
  totalWoodFuelDueAmount: number;
  fuelEnergyExpenseAmount: number;
  totalFuelAndWoodCost: number;
  fuelCostPerThousandBricks: number;

  // Breakdowns
  gradeBreakdown: GradePeriodSummaryRow[];
  expenseBreakdown: ExpenseCategoryBreakdownRow[];
  monthlyBreakdown: MonthlyAnalyticsPoint[];
  reconciliation: SeasonReconciliationSummary;
  archiveEntries: ArchiveLedgerEntry[];
  filteredArchiveTotals: {
    count: number;
    totalBilled: number;
    totalCashIn: number;
    totalCashOut: number;
    totalBricksQty: number;
  };
}

export function getDefaultKilnUnits(): KilnUnit[] {
  return [
    {
      id: 'sbl-1',
      nameBn: 'সৌদিয়া ট্রেডার্স — SBL ভাটা-১ (বাবুলিয়া)',
      nameEn: 'Saudia Traders — SBL Kiln-1 (Babulia)',
      locationBn: 'বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা',
      active: true,
    },
    {
      id: 'sbl-2',
      nameBn: 'সৌদিয়া ট্রেডার্স — SBL ভাটা-২ (সাতক্ষীরা)',
      nameEn: 'Saudia Traders — SBL Kiln-2 (Satkhira)',
      locationBn: 'সাতক্ষীরা সদর, সাতক্ষীরা',
      active: true,
    },
  ];
}

export function getDefaultKilnSeasons(): KilnSeason[] {
  return [
    {
      id: 'season-2026-2027',
      nameBn: 'সিজন ২০২৬–২০২৭ (চলমান ভাটা সিজন)',
      nameEn: '2026–2027 Season',
      startDate: '2026-10-01',
      endDate: '2027-06-30',
      kilnIds: ['sbl-1', 'sbl-2'],
      status: 'ACTIVE',
      damageOrAdjustmentBricks: 0,
      revisionHistory: [
        {
          id: 'rev-init-2026',
          timestamp: '2026-10-01T08:00:00.000Z',
          action: 'CREATED',
          actorName: 'মোঃ কামরুল ইসলাম সাহেব',
          reasonBn: '২০২৬–২০২৭ ভাটা সিজন প্রারম্ভিক কনফিগারেশন।',
        },
      ],
      createdAt: '2026-10-01T08:00:00.000Z',
    },
    {
      id: 'season-2025-2026',
      nameBn: 'সিজন ২০২৫–২০২৬ (পূর্ববর্তী ভাটা সিজন)',
      nameEn: '2025–2026 Season',
      startDate: '2025-10-01',
      endDate: '2026-06-30',
      kilnIds: ['sbl-1'],
      status: 'ACTIVE',
      damageOrAdjustmentBricks: 0,
      revisionHistory: [
        {
          id: 'rev-init-2025',
          timestamp: '2025-10-01T08:00:00.000Z',
          action: 'CREATED',
          actorName: 'মোঃ কামরুল ইসলাম সাহেব',
          reasonBn: '২০২৫–২০২৬ ভাটা সিজন রেকর্ড সংরক্ষণ।',
        },
      ],
      createdAt: '2025-10-01T08:00:00.000Z',
    },
  ];
}

export function resolveRecordKilnId(record: { kilnId?: string } | undefined | null): string {
  const raw = record?.kilnId?.trim();
  return raw ? raw : 'sbl-1';
}

export function matchesKilnFilter(
  record: { kilnId?: string } | undefined | null,
  kilnFilter?: string,
  allowedSeasonKilnIds?: string[]
): boolean {
  const recKiln = resolveRecordKilnId(record);
  if (kilnFilter && kilnFilter !== 'ALL') {
    return recKiln === kilnFilter;
  }
  if (allowedSeasonKilnIds && allowedSeasonKilnIds.length > 0 && !allowedSeasonKilnIds.includes('ALL')) {
    return allowedSeasonKilnIds.includes(recKiln);
  }
  return true;
}

export function getAvailableHistoricalYears(state: Partial<KilnDatabaseState>): number[] {
  const yearSet = new Set<number>([2025, 2026, 2027]);
  const addDateYear = (dateStr?: string) => {
    if (!dateStr || typeof dateStr !== 'string') return;
    const yr = parseInt(dateStr.slice(0, 4), 10);
    if (Number.isFinite(yr) && yr >= 2000 && yr <= 2100) {
      yearSet.add(yr);
    }
  };

  for (const m of state.salesMemos || []) {
    addDateYear(m.date);
    for (const p of m.paymentHistory || []) addDateYear(p.date);
    for (const d of m.deliveryHistory || []) addDateYear(d.date);
  }
  for (const tx of state.cashTransactions || []) addDateYear(tx.date);
  for (const mp of state.millPots || []) addDateYear(mp.date);
  for (const cl of state.chulliLoads || []) addDateYear(cl.date);
  for (const pm of state.poraiMistriRecords || []) addDateYear(pm.date);
  for (const cu of state.chulliUnloads || []) addDateYear(cu.date);
  for (const pp of state.productionPayments || []) addDateYear(pp.date);
  for (const md of state.memoDeliveries || []) addDateYear(md.date);
  for (const wa of state.workerAttendance || []) addDateYear(wa.date);
  for (const wf of state.woodFuelRecords || []) addDateYear(wf.date);
  for (const s of state.kilnSeasons || []) {
    addDateYear(s.startDate);
    addDateYear(s.endDate);
  }

  return Array.from(yearSet).sort((a, b) => b - a);
}

interface NormalizedPaymentEvent {
  id: string;
  date: string;
  amount: number;
  memoNo: string;
  customerName: string;
  paymentType: 'INITIAL' | 'DUE_COLLECTION';
  paymentMethod: string;
  kilnId: string;
  descriptionBn: string;
}

/**
 * Extracts all actual cash collections from customers without double-counting
 * and NEVER counting unpaid credit sales as collections.
 */
export function extractActualCustomerCollectionEvents(
  salesMemos: SalesMemo[],
  cashTransactions: CashTransaction[]
): NormalizedPaymentEvent[] {
  const events: NormalizedPaymentEvent[] = [];
  const memoByNo = new Map<string, SalesMemo>();
  for (const m of salesMemos) {
    memoByNo.set(String(m.memoNo).trim().toLowerCase(), m);
  }

  // Track which memo+date+amount or memo cash transactions are already recorded via cashTransactions
  const coveredMemoPaymentKeys = new Set<string>();
  const memosWithCashTx = new Set<string>();

  for (const tx of cashTransactions) {
    if (tx.type !== 'IN') continue;
    const isSalesCollection =
      tx.category === 'ইট বিক্রয় আদায়' || tx.category === 'বাকি আদায়';
    if (!isSalesCollection) continue;

    const amt = Math.max(0, Number(tx.amount) || 0);
    if (amt <= 0) continue;

    const refNo = String(tx.referenceId || '').trim();
    const matchedMemo = refNo ? memoByNo.get(refNo.toLowerCase()) : undefined;
    const kilnId = tx.kilnId || matchedMemo?.kilnId || 'sbl-1';
    const memoNo = refNo || matchedMemo?.memoNo || '—';

    if (memoNo !== '—') {
      memosWithCashTx.add(memoNo.toLowerCase());
      coveredMemoPaymentKeys.add(`${memoNo.toLowerCase()}|${tx.date}|${amt}`);
    }

    events.push({
      id: `col-tx-${tx.id}`,
      date: tx.date,
      amount: amt,
      memoNo,
      customerName: matchedMemo?.customerName || tx.description || 'ক্রেতা জমা',
      paymentType: tx.category === 'বাকি আদায়' ? 'DUE_COLLECTION' : 'INITIAL',
      paymentMethod: tx.paymentMethod || 'নগদ ক্যাশ',
      kilnId,
      descriptionBn: tx.description || `${tx.category} (মেমো #${memoNo})`,
    });
  }

  // Also check memo.paymentHistory for any payments not already represented in cashTransactions
  for (const m of salesMemos) {
    const mKey = String(m.memoNo).trim().toLowerCase();
    const kilnId = m.kilnId || 'sbl-1';

    if (Array.isArray(m.paymentHistory) && m.paymentHistory.length > 0) {
      for (const ph of m.paymentHistory) {
        const amt = Math.max(0, Number(ph.amount) || 0);
        if (amt <= 0) continue;
        const dedupKey = `${mKey}|${ph.date}|${amt}`;
        if (coveredMemoPaymentKeys.has(dedupKey)) {
          continue;
        }
        coveredMemoPaymentKeys.add(dedupKey);
        events.push({
          id: `col-ph-${m.id}-${ph.id}`,
          date: ph.date,
          amount: amt,
          memoNo: m.memoNo,
          customerName: m.customerName,
          paymentType: ph.type === 'DUE_COLLECTION' ? 'DUE_COLLECTION' : 'INITIAL',
          paymentMethod: ph.paymentMethod || m.paymentMethod || 'নগদ ক্যাশ',
          kilnId,
          descriptionBn:
            ph.note ||
            (ph.type === 'DUE_COLLECTION'
              ? `বকেয়া আদায় — মেমো #${m.memoNo} (${m.customerName})`
              : `মেমো নগদ জমা — মেমো #${m.memoNo} (${m.customerName})`),
        });
      }
    } else if (!memosWithCashTx.has(mKey) && (Number(m.paidAmount) || 0) > 0) {
      // Fallback only if a memo has paidAmount > 0 and neither paymentHistory nor cashTransactions exist for it
      const amt = Math.max(0, Number(m.paidAmount) || 0);
      events.push({
        id: `col-memo-${m.id}`,
        date: m.date,
        amount: amt,
        memoNo: m.memoNo,
        customerName: m.customerName,
        paymentType: 'INITIAL',
        paymentMethod: m.paymentMethod || 'নগদ ক্যাশ',
        kilnId,
        descriptionBn: `মেমো নগদ আদায় — মেমো #${m.memoNo} (${m.customerName})`,
      });
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

function getMemoBrickTotal(m: SalesMemo): number {
  if (Array.isArray(m.items) && m.items.length > 0) {
    return m.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  }
  return Number(m.quantity) || 0;
}

function buildTwelveMonthSequence(
  mode: YearlySeasonalFilter['mode'],
  year: number,
  startDate: string,
  endDate: string
): Array<{ monthKey: string; monthNumber: number; monthLabelBn: string; monthShortBn: string; inPeriod: boolean }> {
  const result: Array<{
    monthKey: string;
    monthNumber: number;
    monthLabelBn: string;
    monthShortBn: string;
    inPeriod: boolean;
  }> = [];

  let startYear = year;
  let startMonth = 1; // 1..12

  if (mode === 'SEASON' || mode === 'CUSTOM_RANGE') {
    const parsedY = parseInt(startDate.slice(0, 4), 10);
    const parsedM = parseInt(startDate.slice(5, 7), 10);
    if (Number.isFinite(parsedY) && Number.isFinite(parsedM) && parsedM >= 1 && parsedM <= 12) {
      startYear = parsedY;
      startMonth = parsedM;
    }
  }

  const startMonthKey = startDate.slice(0, 7);
  const endMonthKey = endDate.slice(0, 7);

  for (let i = 0; i < 12; i++) {
    const totalMonths = (startMonth - 1) + i;
    const y = startYear + Math.floor(totalMonths / 12);
    const m = (totalMonths % 12) + 1;
    const mm = String(m).padStart(2, '0');
    const monthKey = `${y}-${mm}`;
    const mNameBn = BENGALI_MONTH_NAMES[mm] || mm;
    const yBn = formatBn(y).replace(/,/g, '');
    const yShortBn = yBn.slice(-2);

    result.push({
      monthKey,
      monthNumber: m,
      monthLabelBn: `${mNameBn} ${yBn}`,
      monthShortBn: `${mNameBn.slice(0, 4)} '${yShortBn}`,
      inPeriod: monthKey >= startMonthKey && monthKey <= endMonthKey,
    });
  }

  return result;
}

export function computeYearlyOrSeasonalReport(
  state: KilnDatabaseState,
  filter: YearlySeasonalFilter
): YearlySeasonalReport {
  const kilnUnits =
    Array.isArray(state.kilnUnits) && state.kilnUnits.length > 0
      ? state.kilnUnits
      : getDefaultKilnUnits();
  const kilnSeasons =
    Array.isArray(state.kilnSeasons) && state.kilnSeasons.length > 0
      ? state.kilnSeasons
      : getDefaultKilnSeasons();

  const selectedKilnId = filter.kilnId || 'ALL';
  const selectedKilnObj = kilnUnits.find((k) => k.id === selectedKilnId);
  const kilnNameBn =
    selectedKilnId === 'ALL'
      ? 'সকল ভাটা ইউনিট (সৌদিয়া ট্রেডার্স — SBL ব্রিকস)'
      : selectedKilnObj?.nameBn || `ভাটা ইউনিট (${selectedKilnId})`;

  let startDate = '2026-01-01';
  let endDate = '2026-12-31';
  let selectedYear = filter.year || 2026;
  let selectedSeason: KilnSeason | undefined;
  let periodTitleBn = '';
  let periodSubtitleBn = '';
  let allowedSeasonKilnIds: string[] | undefined;

  if (filter.mode === 'SEASON') {
    selectedSeason =
      kilnSeasons.find((s) => s.id === filter.seasonId) || kilnSeasons[0];
    if (selectedSeason) {
      startDate = selectedSeason.startDate;
      endDate = selectedSeason.endDate;
      selectedYear = parseInt(selectedSeason.startDate.slice(0, 4), 10) || 2026;
      allowedSeasonKilnIds = selectedSeason.kilnIds;
      periodTitleBn = `${selectedSeason.nameBn}`;
      periodSubtitleBn = `সিজন মেয়াদ: ${selectedSeason.startDate} হতে ${selectedSeason.endDate} পর্যন্ত`;
    }
  } else if (filter.mode === 'CUSTOM_RANGE') {
    startDate = filter.startDate || '2026-01-01';
    endDate = filter.endDate || '2026-12-31';
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    selectedYear = parseInt(startDate.slice(0, 4), 10) || 2026;
    periodTitleBn = `কাস্টম তারিখ সীমা রিপোর্ট (${startDate} – ${endDate})`;
    periodSubtitleBn = `নির্বাচিত তারিখ অনুযায়ী সম্পূর্ণ হিসাব বিবরণী`;
  } else {
    selectedYear = filter.year || 2026;
    startDate = `${selectedYear}-01-01`;
    endDate = `${selectedYear}-12-31`;
    const yrBn = formatBn(selectedYear).replace(/,/g, '');
    periodTitleBn = `বার্ষিক হিসাব ও অ্যানালাইটিক্স — ${yrBn} সাল`;
    periodSubtitleBn = `১ জানুয়ারি ${yrBn} হতে ৩১ ডিসেম্বর ${yrBn} পর্যন্ত পূর্ণ ১২ মাসের হিসাব`;
  }

  const inPeriod = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };
  const isBeforePeriod = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    return dateStr < startDate;
  };

  // Filter all collections by kiln first
  const allMemosForKiln = (state.salesMemos || []).filter((m) =>
    matchesKilnFilter(m, selectedKilnId, allowedSeasonKilnIds)
  );
  const allCashTxForKiln = (state.cashTransactions || []).filter((tx) =>
    matchesKilnFilter(tx, selectedKilnId, allowedSeasonKilnIds)
  );
  const allMillPotsForKiln = (state.millPots || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );
  const allChulliLoadsForKiln = (state.chulliLoads || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );
  const allPoraiForKiln = (state.poraiMistriRecords || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );
  const allUnloadsForKiln = (state.chulliUnloads || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );
  const allProdPaymentsForKiln = (state.productionPayments || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );
  const allWorkerAttForKiln = (state.workerAttendance || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );
  const allWoodFuelForKiln = (state.woodFuelRecords || []).filter((r) =>
    matchesKilnFilter(r, selectedKilnId, allowedSeasonKilnIds)
  );

  // Extract all deduplicated customer collection events for this kiln scope
  const allCollectionEvents = extractActualCustomerCollectionEvents(
    allMemosForKiln,
    allCashTxForKiln
  );

  // Extract all delivery trips (from memoDeliveries + memo.deliveryHistory deduplicated by id)
  const deliveryMap = new Map<string, MemoDeliveryRecord>();
  for (const d of state.memoDeliveries || []) {
    if (matchesKilnFilter(d, selectedKilnId, allowedSeasonKilnIds)) {
      deliveryMap.set(d.id, d);
    }
  }
  for (const m of allMemosForKiln) {
    for (const d of m.deliveryHistory || []) {
      if (!deliveryMap.has(d.id)) {
        deliveryMap.set(d.id, { ...d, kilnId: d.kilnId || m.kilnId || 'sbl-1' });
      }
    }
  }
  const allDeliveriesForKiln = Array.from(deliveryMap.values());

  // --- PERIOD SLICES ---
  const periodMemos = allMemosForKiln.filter((m) => inPeriod(m.date));
  const beforeMemos = allMemosForKiln.filter((m) => isBeforePeriod(m.date));

  const periodCollections = allCollectionEvents.filter((c) => inPeriod(c.date));
  const beforeCollections = allCollectionEvents.filter((c) => isBeforePeriod(c.date));

  const periodCashTx = allCashTxForKiln.filter((tx) => inPeriod(tx.date));
  const beforeCashTx = allCashTxForKiln.filter((tx) => isBeforePeriod(tx.date));

  const periodMillPots = allMillPotsForKiln.filter((r) => inPeriod(r.date));
  const beforeMillPots = allMillPotsForKiln.filter((r) => isBeforePeriod(r.date));

  const periodChulliLoads = allChulliLoadsForKiln.filter((r) => inPeriod(r.date));
  const beforeChulliLoads = allChulliLoadsForKiln.filter((r) => isBeforePeriod(r.date));

  const periodPorai = allPoraiForKiln.filter((r) => inPeriod(r.date));
  const beforePorai = allPoraiForKiln.filter((r) => isBeforePeriod(r.date));

  const periodUnloads = allUnloadsForKiln.filter((r) => inPeriod(r.date));
  const beforeUnloads = allUnloadsForKiln.filter((r) => isBeforePeriod(r.date));

  const periodProdPayments = allProdPaymentsForKiln.filter((r) => inPeriod(r.date));
  const periodWorkerAtt = allWorkerAttForKiln.filter((r) => inPeriod(r.date));
  const beforeWorkerAtt = allWorkerAttForKiln.filter((r) => isBeforePeriod(r.date));

  const periodWoodFuel = allWoodFuelForKiln.filter((r) => inPeriod(r.date));
  const beforeWoodFuel = allWoodFuelForKiln.filter((r) => isBeforePeriod(r.date));

  const periodDeliveries = allDeliveriesForKiln.filter((d) => inPeriod(d.date));

  // --- 1. SALES, ACTUAL COLLECTIONS & RECEIVABLES ---
  const totalSalesAmount = periodMemos.reduce(
    (s, m) => s + (Number(m.totalAmount) || 0),
    0
  );
  const totalDiscountAmount = periodMemos.reduce(
    (s, m) => s + (Number(m.discount) || 0),
    0
  );
  const totalMemoCount = periodMemos.length;

  const initialMemoCollections = periodCollections
    .filter((c) => c.paymentType === 'INITIAL')
    .reduce((s, c) => s + c.amount, 0);
  const dueCollections = periodCollections
    .filter((c) => c.paymentType === 'DUE_COLLECTION')
    .reduce((s, c) => s + c.amount, 0);
  const totalActualCollections = initialMemoCollections + dueCollections;

  // Unpaid due remaining on memos issued in this period
  const periodUnpaidMemoDue = periodMemos.reduce(
    (s, m) => s + (Number(m.dueAmount) || 0),
    0
  );
  const totalCreditSalesAmount = periodUnpaidMemoDue;

  // Opening & Closing Customer Receivables Reconciliation
  const salesBeforeAmount = beforeMemos.reduce(
    (s, m) => s + (Number(m.totalAmount) || 0),
    0
  );
  const collectionsBeforeAmount = beforeCollections.reduce(
    (s, c) => s + c.amount,
    0
  );
  const openingCustomerReceivables = Math.max(
    0,
    salesBeforeAmount - collectionsBeforeAmount
  );
  const closingCustomerReceivables = Math.max(
    0,
    openingCustomerReceivables + totalSalesAmount - totalActualCollections
  );
  const totalOutstandingReceivables = closingCustomerReceivables;

  // --- 2. OTHER INCOME, EXPENSES & NET CASH MOVEMENT ---
  const otherIncome = periodCashTx
    .filter(
      (tx) =>
        tx.type === 'IN' &&
        tx.category !== 'ইট বিক্রয় আদায়' &&
        tx.category !== 'বাকি আদায়'
    )
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  const periodExpenseCashTx = periodCashTx.filter((tx) => tx.type === 'OUT');
  const totalExpenses = periodExpenseCashTx.reduce(
    (s, tx) => s + (Number(tx.amount) || 0),
    0
  );

  const netCashMovement =
    totalActualCollections + otherIncome - totalExpenses;

  // Cash Reconciliation
  const baseOpeningCash =
    selectedSeason?.openingCashOverride !== undefined
      ? Number(selectedSeason.openingCashOverride) || 0
      : Number(state.settings?.openingBalance) || 0;

  const otherIncomeBefore = beforeCashTx
    .filter(
      (tx) =>
        tx.type === 'IN' &&
        tx.category !== 'ইট বিক্রয় আদায়' &&
        tx.category !== 'বাকি আদায়'
    )
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
  const expensesBefore = beforeCashTx
    .filter((tx) => tx.type === 'OUT')
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  const openingCashBalance =
    selectedSeason?.openingCashOverride !== undefined
      ? baseOpeningCash
      : baseOpeningCash + collectionsBeforeAmount + otherIncomeBefore - expensesBefore;
  const periodCashReceived = totalActualCollections + otherIncome;
  const closingCashBalance =
    openingCashBalance + periodCashReceived - totalExpenses;

  // --- 3. PRODUCTION, BRICK SALES BY GRADE & STOCK MOVEMENT ---
  const rawBricksCut = periodMillPots.reduce(
    (s, r) => s + (Number(r.rawBricksCut) || 0),
    0
  );
  const chulliLoadedBricks = periodChulliLoads.reduce(
    (s, r) => s + (Number(r.rawBricksLoaded) || 0),
    0
  );
  const poraiFiredBricks = periodPorai.reduce(
    (s, r) => s + (Number(r.bricksFired) || 0),
    0
  );
  const pakaUnloadedBricks = periodUnloads.reduce(
    (s, r) => s + (Number(r.totalBricksUnloaded) || 0),
    0
  );

  const totalBricksSoldQty = periodMemos.reduce(
    (s, m) => s + getMemoBrickTotal(m),
    0
  );

  const deliveredFromGlobalInPeriod = periodDeliveries.reduce(
    (s, d) => s + (Number(d.quantity) || 0),
    0
  );
  const deliveredFromPeriodMemosFallback = periodMemos.reduce((s, m) => {
    const hasHist = Array.isArray(m.deliveryHistory) && m.deliveryHistory.length > 0;
    if (hasHist) return s;
    return s + (Number(m.deliveredQuantity) || 0);
  }, 0);
  const totalBricksDeliveredQty =
    deliveredFromGlobalInPeriod + deliveredFromPeriodMemosFallback;
  const totalPendingDeliveryQty = Math.max(
    0,
    totalBricksSoldQty - totalBricksDeliveredQty
  );

  // Grade-by-grade breakdown
  const grades: BrickGrade[] =
    Array.isArray(state.brickGrades) && state.brickGrades.length > 0
      ? state.brickGrades
      : [];

  const gradeBreakdown: GradePeriodSummaryRow[] = grades.map((g) => {
    const unloadedQty = periodUnloads.reduce((sum, u) => {
      const match = (u.unloadedByGrade || []).find((ug) => ug.gradeId === g.id);
      return sum + (Number(match?.quantity) || 0);
    }, 0);

    let soldQty = 0;
    let soldAmount = 0;
    let fallbackDelivQty = 0;

    for (const m of periodMemos) {
      const items =
        Array.isArray(m.items) && m.items.length > 0
          ? m.items
          : [
              {
                id: 'legacy',
                gradeId: m.gradeId || 'grade-1',
                gradeName: m.gradeName || '১ নং ইট',
                quantity: Number(m.quantity) || 0,
                rate: Number(m.rate) || 11000,
                ratePerThousand: true,
                lineTotal: Number(m.totalAmount) || 0,
              },
            ];
      for (const it of items) {
        if (it.gradeId === g.id) {
          soldQty += Number(it.quantity) || 0;
          soldAmount += Number(it.lineTotal) || 0;
        }
      }
      if (
        (!m.deliveryHistory || m.deliveryHistory.length === 0) &&
        (m.deliveredQuantity || 0) > 0 &&
        items[0]?.gradeId === g.id
      ) {
        fallbackDelivQty += Number(m.deliveredQuantity) || 0;
      }
    }

    const tripDelivQty = periodDeliveries
      .filter((d) => d.gradeId === g.id)
      .reduce((s, d) => s + (Number(d.quantity) || 0), 0);

    const deliveredQty = tripDelivQty + fallbackDelivQty;
    const pendingDeliveryQty = Math.max(0, soldQty - deliveredQty);

    return {
      gradeId: g.id,
      gradeNameBn: cleanBrickGradeName(g.nameBn),
      ratePerThousand: g.ratePerUnit,
      unloadedQty,
      soldQty,
      soldAmount,
      deliveredQty,
      pendingDeliveryQty,
      currentStock: Number(g.currentStock) || 0,
    };
  });

  // Stock Reconciliation
  const unloadsBeforeBricks = beforeUnloads.reduce(
    (s, u) => s + (Number(u.totalBricksUnloaded) || 0),
    0
  );
  const soldBeforeBricks = beforeMemos.reduce(
    (s, m) => s + getMemoBrickTotal(m),
    0
  );
  const currentTotalStockInDb = grades.reduce(
    (s, g) => s + (Number(g.currentStock) || 0),
    0
  );

  const openingStockBricks =
    selectedSeason?.openingStockOverride !== undefined
      ? Number(selectedSeason.openingStockOverride) || 0
      : unloadsBeforeBricks > 0 || soldBeforeBricks > 0
      ? Math.max(0, unloadsBeforeBricks - soldBeforeBricks)
      : currentTotalStockInDb;

  const periodProducedBricks = pakaUnloadedBricks;
  const damageOrAdjustmentBricks = Math.max(
    0,
    Number(selectedSeason?.damageOrAdjustmentBricks) || 0
  );
  const closingStockBricks = Math.max(
    0,
    openingStockBricks +
      periodProducedBricks -
      totalBricksSoldQty -
      damageOrAdjustmentBricks
  );

  // --- 4. LABOR, SUPPLIERS & SOIL / RAW MATERIALS / WOOD & FUEL ---
  const laborEarnedFromAtt = periodWorkerAtt.reduce(
    (s, w) => s + (Number(w.morningAmount) || 0) + (Number(w.afternoonAmount) || 0),
    0
  );
  const laborPaidFromAtt = periodWorkerAtt.reduce(
    (s, w) => s + (Number(w.totalPaid) || 0),
    0
  );
  const laborCashTxAmount = periodExpenseCashTx
    .filter((tx) => tx.category === 'শ্রমিক ও সর্দার পেমেন্ট')
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  const laborEarnedAmount = laborEarnedFromAtt;
  const laborPaidAmount = Math.max(laborPaidFromAtt, laborCashTxAmount);
  const laborOutstandingDue = Math.max(0, laborEarnedAmount - laborPaidFromAtt);

  // Wood & Fuel Ledger Totals
  const totalWoodFuelDeliveries = periodWoodFuel.length;
  const totalWoodFuelMaund = Math.round(
    periodWoodFuel.reduce((s, r) => s + convertWoodRecordToMaund(r), 0) * 100
  ) / 100;
  const totalWoodFuelBillAmount = periodWoodFuel.reduce(
    (s, r) => s + (Number(r.totalBill) || 0),
    0
  );
  const woodPaidDirectly = periodWoodFuel.reduce(
    (s, r) => s + (Number(r.paidAmount) || 0),
    0
  );
  const woodExtraPayments = periodProdPayments
    .filter((p) => p.section === 'JALANI')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalWoodFuelPaidAmount = woodPaidDirectly + woodExtraPayments;
  const totalWoodFuelDueAmount = Math.max(
    0,
    totalWoodFuelBillAmount - totalWoodFuelPaidAmount
  );

  // Supplier / Contractor (Mill, Van Load, Porai Mistri, Unload Sardar, Wood Suppliers)
  const millPayable = periodMillPots.reduce(
    (s, r) => s + (Number(r.totalPayable) || 0),
    0
  );
  const millPaid = periodMillPots.reduce(
    (s, r) => s + (Number(r.paidAmount) || 0),
    0
  );
  const vanPayable = periodChulliLoads.reduce(
    (s, r) => s + (Number(r.totalBill) || 0),
    0
  );
  const vanPaid = periodChulliLoads.reduce(
    (s, r) => s + (Number(r.paidAmount) || 0),
    0
  );
  const poraiPayable = periodPorai.reduce(
    (s, r) => s + (Number(r.totalBill) || 0),
    0
  );
  const poraiPaid = periodPorai.reduce(
    (s, r) => s + (Number(r.paidAmount) || 0),
    0
  );
  const unloadPayable = periodUnloads.reduce(
    (s, r) => s + (Number(r.totalBill) || 0),
    0
  );
  const unloadPaid = periodUnloads.reduce(
    (s, r) => s + (Number(r.paidAmount) || 0),
    0
  );
  const extraProdPayments = periodProdPayments.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );

  const supplierAndContractorPayable =
    millPayable + vanPayable + poraiPayable + unloadPayable + totalWoodFuelBillAmount;
  const supplierAndContractorPaid =
    millPaid + vanPaid + poraiPaid + unloadPaid + woodPaidDirectly + extraProdPayments;
  const supplierAndContractorDue = Math.max(
    0,
    supplierAndContractorPayable - supplierAndContractorPaid
  );

  // Liabilities Reconciliation (Suppliers + Contractors + Labor)
  const payableBefore =
    beforeMillPots.reduce((s, r) => s + (Number(r.totalPayable) || 0), 0) +
    beforeChulliLoads.reduce((s, r) => s + (Number(r.totalBill) || 0), 0) +
    beforePorai.reduce((s, r) => s + (Number(r.totalBill) || 0), 0) +
    beforeUnloads.reduce((s, r) => s + (Number(r.totalBill) || 0), 0) +
    beforeWoodFuel.reduce((s, r) => s + (Number(r.totalBill) || 0), 0) +
    beforeWorkerAtt.reduce(
      (s, w) => s + (Number(w.morningAmount) || 0) + (Number(w.afternoonAmount) || 0),
      0
    );
  const paidBefore =
    beforeMillPots.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0) +
    beforeChulliLoads.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0) +
    beforePorai.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0) +
    beforeUnloads.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0) +
    beforeWoodFuel.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0) +
    beforeWorkerAtt.reduce((s, w) => s + (Number(w.totalPaid) || 0), 0);

  const openingLiabilities = Math.max(0, payableBefore - paidBefore);
  const periodIncurredLiabilities =
    supplierAndContractorPayable + laborEarnedAmount;
  const periodPaidLiabilities =
    supplierAndContractorPaid + laborPaidFromAtt;
  const closingLiabilities = Math.max(
    0,
    openingLiabilities + periodIncurredLiabilities - periodPaidLiabilities
  );

  // Soil & Raw Materials & Fuel
  const soilTxList = periodExpenseCashTx.filter(
    (tx) =>
      tx.category === 'মাটি ক্রয়' ||
      tx.description.includes('মাটি') ||
      tx.description.toLowerCase().includes('soil')
  );
  const soilAndRawMaterialAmount = soilTxList.reduce(
    (s, tx) => s + (Number(tx.amount) || 0),
    0
  );
  const soilTicketCount = soilTxList.length;

  const coalPurchaseAmount = periodExpenseCashTx
    .filter((tx) => tx.category === 'কয়লা ক্রয়')
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  const dieselAndVekuAmount = periodExpenseCashTx
    .filter((tx) => tx.category === 'ভেকু ও ডিজেল')
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  const fuelEnergyExpenseAmount = periodExpenseCashTx
    .filter((tx) => tx.category === 'বিদ্যুৎ ও জ্বালানি')
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  const totalFuelAndWoodCost =
    Math.max(totalWoodFuelBillAmount, fuelEnergyExpenseAmount) +
    coalPurchaseAmount +
    dieselAndVekuAmount;

  const peakProductionBricks = Math.max(
    rawBricksCut,
    chulliLoadedBricks,
    poraiFiredBricks,
    pakaUnloadedBricks
  );
  const fuelCostPerThousandBricks =
    peakProductionBricks > 0
      ? Math.round(totalFuelAndWoodCost / (peakProductionBricks / 1000))
      : 0;

  // Expense Breakdown by Category
  const expCatMap = new Map<string, { amount: number; count: number }>();
  for (const tx of periodExpenseCashTx) {
    const cat = tx.category || 'অন্যান্য খরচ';
    const prev = expCatMap.get(cat) || { amount: 0, count: 0 };
    prev.amount += Number(tx.amount) || 0;
    prev.count += 1;
    expCatMap.set(cat, prev);
  }
  const expenseBreakdown: ExpenseCategoryBreakdownRow[] = Array.from(
    expCatMap.entries()
  )
    .map(([category, info]) => ({
      category,
      amount: info.amount,
      txCount: info.count,
      sharePct:
        totalExpenses > 0
          ? Math.round((info.amount / totalExpenses) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // --- 5. TWELVE-MONTH BREAKDOWN (ALL 12 MONTHS INCLUDING ZERO-ACTIVITY MONTHS) ---
  const twelveMonthsMeta = buildTwelveMonthSequence(
    filter.mode,
    selectedYear,
    startDate,
    endDate
  );

  let runningReceivables = openingCustomerReceivables;

  const monthlyBreakdown: MonthlyAnalyticsPoint[] = twelveMonthsMeta.map((meta) => {
    const mKey = meta.monthKey;
    const isMonthMatch = (dateStr?: string) =>
      Boolean(dateStr && dateStr.startsWith(mKey) && inPeriod(dateStr));

    const mMemos = periodMemos.filter((m) => isMonthMatch(m.date));
    const mCols = periodCollections.filter((c) => isMonthMatch(c.date));
    const mCashTx = periodCashTx.filter((tx) => isMonthMatch(tx.date));
    const mMills = periodMillPots.filter((r) => isMonthMatch(r.date));
    const mLoads = periodChulliLoads.filter((r) => isMonthMatch(r.date));
    const mPorai = periodPorai.filter((r) => isMonthMatch(r.date));
    const mUnloads = periodUnloads.filter((r) => isMonthMatch(r.date));
    const mDelivs = periodDeliveries.filter((d) => isMonthMatch(d.date));
    const mWorkerAtt = periodWorkerAtt.filter((w) => isMonthMatch(w.date));
    const mWoodFuel = periodWoodFuel.filter((r) => isMonthMatch(r.date));

    const salesAmount = mMemos.reduce(
      (s, m) => s + (Number(m.totalAmount) || 0),
      0
    );
    const creditSalesAmount = mMemos.reduce(
      (s, m) => s + (Number(m.dueAmount) || 0),
      0
    );
    const actualCollectionAmount = mCols.reduce((s, c) => s + c.amount, 0);
    const otherIncomeAmount = mCashTx
      .filter(
        (tx) =>
          tx.type === 'IN' &&
          tx.category !== 'ইট বিক্রয় আদায়' &&
          tx.category !== 'বাকি আদায়'
      )
      .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

    const mExpTx = mCashTx.filter((tx) => tx.type === 'OUT');
    const expenseAmount = mExpTx.reduce(
      (s, tx) => s + (Number(tx.amount) || 0),
      0
    );
    const netCashMovementMonth =
      actualCollectionAmount + otherIncomeAmount - expenseAmount;

    const bricksSoldQty = mMemos.reduce((s, m) => s + getMemoBrickTotal(m), 0);
    const bricksDeliveredQty =
      mDelivs.reduce((s, d) => s + (Number(d.quantity) || 0), 0) +
      mMemos.reduce((s, m) => {
        if (Array.isArray(m.deliveryHistory) && m.deliveryHistory.length > 0) return s;
        return s + (Number(m.deliveredQuantity) || 0);
      }, 0);

    const mRawCut = mMills.reduce(
      (s, r) => s + (Number(r.rawBricksCut) || 0),
      0
    );
    const mLoaded = mLoads.reduce(
      (s, r) => s + (Number(r.rawBricksLoaded) || 0),
      0
    );
    const mFired = mPorai.reduce(
      (s, r) => s + (Number(r.bricksFired) || 0),
      0
    );
    const mUnloaded = mUnloads.reduce(
      (s, r) => s + (Number(r.totalBricksUnloaded) || 0),
      0
    );
    const productionVolumeBricks = Math.max(mRawCut, mLoaded, mFired, mUnloaded);

    const soilExpenseAmount = mExpTx
      .filter(
        (tx) =>
          tx.category === 'মাটি ক্রয়' || tx.description.includes('মাটি')
      )
      .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

    const laborPaidMonth = Math.max(
      mWorkerAtt.reduce((s, w) => s + (Number(w.totalPaid) || 0), 0),
      mExpTx
        .filter((tx) => tx.category === 'শ্রমিক ও সর্দার পেমেন্ট')
        .reduce((s, tx) => s + (Number(tx.amount) || 0), 0)
    );

    const woodFuelDeliveryCount = mWoodFuel.length;
    const woodFuelMaund =
      Math.round(
        mWoodFuel.reduce((s, r) => s + convertWoodRecordToMaund(r), 0) * 100
      ) / 100;
    const woodFuelBillAmount = mWoodFuel.reduce(
      (s, r) => s + (Number(r.totalBill) || 0),
      0
    );

    const monthFuelCashTx = mExpTx
      .filter((tx) => tx.category === 'বিদ্যুৎ ও জ্বালানি')
      .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
    const monthCoalAndDieselTx = mExpTx
      .filter(
        (tx) => tx.category === 'কয়লা ক্রয়' || tx.category === 'ভেকু ও ডিজেল'
      )
      .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

    const fuelAndCoalExpenseAmount =
      Math.max(woodFuelBillAmount, monthFuelCashTx) + monthCoalAndDieselTx;

    runningReceivables = Math.max(
      0,
      runningReceivables + salesAmount - actualCollectionAmount
    );

    return {
      monthKey: mKey,
      monthNumber: meta.monthNumber,
      monthLabelBn: meta.monthLabelBn,
      monthShortBn: meta.monthShortBn,
      inPeriod: meta.inPeriod,
      memoCount: mMemos.length,
      salesAmount,
      creditSalesAmount,
      actualCollectionAmount,
      otherIncomeAmount,
      expenseAmount,
      netCashMovement: netCashMovementMonth,
      bricksSoldQty,
      bricksDeliveredQty,
      rawBricksCut: mRawCut,
      chulliLoadedBricks: mLoaded,
      poraiFiredBricks: mFired,
      pakaUnloadedBricks: mUnloaded,
      productionVolumeBricks,
      soilExpenseAmount,
      laborPaidAmount: laborPaidMonth,
      woodFuelMaund,
      woodFuelBillAmount,
      woodFuelDeliveryCount,
      fuelAndCoalExpenseAmount,
      cumulativeReceivables: runningReceivables,
    };
  });

  // --- 6. HISTORICAL RECORD ARCHIVE LEDGER ---
  const rawArchiveEntries: ArchiveLedgerEntry[] = [];
  const getKilnLabel = (kId?: string) => {
    const id = kId || 'sbl-1';
    return kilnUnits.find((u) => u.id === id)?.nameBn || 'SBL ভাটা-১';
  };

  // A. Sales Memos
  for (const m of periodMemos) {
    const kId = resolveRecordKilnId(m);
    const qty = getMemoBrickTotal(m);
    const itemsText =
      Array.isArray(m.items) && m.items.length > 0
        ? m.items
            .map((it) => `${cleanBrickGradeName(it.gradeName)} (${formatBn(it.quantity)} পিস)`)
            .join(', ')
        : `${cleanBrickGradeName(m.gradeName || '১ নং ইট')} (${formatBn(qty)} পিস)`;

    rawArchiveEntries.push({
      id: `arch-memo-${m.id}`,
      date: m.date,
      txType: 'SALES_MEMO',
      txTypeLabelBn: 'মেমো বিক্রি',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      memoNo: m.memoNo,
      partyName: m.customerName,
      partyPhone: m.customerPhone,
      descriptionBn: `মেমো #${m.memoNo} — ${itemsText} (মোট: ৳${formatBn(m.totalAmount)}, বাকি: ৳${formatBn(m.dueAmount)})`,
      quantityPieces: qty,
      billedOrPayableAmount: m.totalAmount,
      cashInAmount: 0,
      cashOutAmount: 0,
      balanceImpactAmount: m.dueAmount,
      paymentMethod: m.paymentMethod,
      sourceRecordId: m.id,
    });
  }

  // B. Customer Collections
  for (const c of periodCollections) {
    rawArchiveEntries.push({
      id: `arch-col-${c.id}`,
      date: c.date,
      txType: 'COLLECTION',
      txTypeLabelBn:
        c.paymentType === 'DUE_COLLECTION' ? 'বকেয়া আদায়' : 'মেমো নগদ আদায়',
      kilnId: c.kilnId,
      kilnNameBn: getKilnLabel(c.kilnId),
      memoNo: c.memoNo !== '—' ? c.memoNo : undefined,
      partyName: c.customerName,
      descriptionBn: c.descriptionBn,
      billedOrPayableAmount: 0,
      cashInAmount: c.amount,
      cashOutAmount: 0,
      balanceImpactAmount: c.amount,
      paymentMethod: c.paymentMethod,
      sourceRecordId: c.id,
    });
  }

  // C. Expenses & Soil Purchases & Other Income
  for (const tx of periodCashTx) {
    if (
      tx.type === 'IN' &&
      (tx.category === 'ইট বিক্রয় আদায়' || tx.category === 'বাকি আদায়')
    ) {
      // Already represented in Customer Collections
      continue;
    }
    const kId = resolveRecordKilnId(tx);
    const isSoil =
      tx.type === 'OUT' &&
      (tx.category === 'মাটি ক্রয়' || tx.description.includes('মাটি'));
    const isLaborTx =
      tx.type === 'OUT' && tx.category === 'শ্রমিক ও সর্দার পেমেন্ট';

    rawArchiveEntries.push({
      id: `arch-tx-${tx.id}`,
      date: tx.date,
      txType: isSoil
        ? 'SOIL_PURCHASE'
        : isLaborTx
        ? 'LABOR'
        : 'EXPENSE',
      txTypeLabelBn:
        tx.type === 'IN'
          ? 'অন্যান্য জমা'
          : isSoil
          ? 'মাটি ও কাঁচামাল ক্রয়'
          : isLaborTx
          ? 'শ্রমিক ও সর্দার পেমেন্ট'
          : `ভাটা খরচ (${tx.category})`,
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      memoNo: tx.referenceId,
      partyName: tx.category,
      descriptionBn: tx.description || tx.category,
      billedOrPayableAmount: 0,
      cashInAmount: tx.type === 'IN' ? tx.amount : 0,
      cashOutAmount: tx.type === 'OUT' ? tx.amount : 0,
      balanceImpactAmount: tx.type === 'IN' ? tx.amount : -tx.amount,
      paymentMethod: tx.paymentMethod,
      sourceRecordId: tx.id,
    });
  }

  // D. Production Records (Mill Pots, Van Loads, Porai Mistri, Unloads, Wood & Fuel)
  for (const mp of periodMillPots) {
    const kId = resolveRecordKilnId(mp);
    rawArchiveEntries.push({
      id: `arch-mp-${mp.id}`,
      date: mp.date,
      txType: 'PRODUCTION',
      txTypeLabelBn: 'মিল পট (কাঁচা ইট)',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      partyName: mp.millNameBn,
      descriptionBn: `${mp.millNameBn} (${mp.potNo}) — কাঁচা ইট কাটা: ${formatBn(mp.rawBricksCut)} পিস`,
      quantityPieces: mp.rawBricksCut,
      billedOrPayableAmount: mp.totalPayable,
      cashInAmount: 0,
      cashOutAmount: mp.paidAmount,
      balanceImpactAmount: -mp.dueAmount,
      sourceRecordId: mp.id,
    });
  }

  for (const cl of periodChulliLoads) {
    const kId = resolveRecordKilnId(cl);
    rawArchiveEntries.push({
      id: `arch-cl-${cl.id}`,
      date: cl.date,
      txType: 'PRODUCTION',
      txTypeLabelBn: 'ভ্যান লোড (চুল্লি বোঝাই)',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      partyName: cl.sardarName,
      descriptionBn: `${cl.sardarName} — ভ্যান লোড: ${formatBn(cl.rawBricksLoaded)} পিস (রেট: ৳${formatBn(cl.ratePerVan)}/হাজার)`,
      quantityPieces: cl.rawBricksLoaded,
      billedOrPayableAmount: cl.totalBill,
      cashInAmount: 0,
      cashOutAmount: cl.paidAmount,
      balanceImpactAmount: -cl.dueAmount,
      sourceRecordId: cl.id,
    });
  }

  for (const pm of periodPorai) {
    const kId = resolveRecordKilnId(pm);
    rawArchiveEntries.push({
      id: `arch-pm-${pm.id}`,
      date: pm.date,
      txType: 'PRODUCTION',
      txTypeLabelBn: 'পোড়াই মিস্ত্রি হিসাব',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      partyName: pm.mistriName,
      descriptionBn: `${pm.mistriName} (${pm.chamberOrRound}) — পোড়ানো ইট: ${formatBn(pm.bricksFired)} পিস`,
      quantityPieces: pm.bricksFired,
      billedOrPayableAmount: pm.totalBill,
      cashInAmount: 0,
      cashOutAmount: pm.paidAmount,
      balanceImpactAmount: -pm.dueAmount,
      sourceRecordId: pm.id,
    });
  }

  for (const cu of periodUnloads) {
    const kId = resolveRecordKilnId(cu);
    rawArchiveEntries.push({
      id: `arch-cu-${cu.id}`,
      date: cu.date,
      txType: 'PRODUCTION',
      txTypeLabelBn: 'আনলোড (পাকা ইট বাহির)',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      partyName: cu.sardarName,
      descriptionBn: `${cu.sardarName} (${cu.chamberOrRound}) — পাকা ইট আনলোড: ${formatBn(cu.totalBricksUnloaded)} পিস`,
      quantityPieces: cu.totalBricksUnloaded,
      billedOrPayableAmount: cu.totalBill,
      cashInAmount: 0,
      cashOutAmount: cu.paidAmount,
      balanceImpactAmount: -cu.dueAmount,
      sourceRecordId: cu.id,
    });
  }

  for (const wf of periodWoodFuel) {
    const kId = resolveRecordKilnId(wf);
    rawArchiveEntries.push({
      id: `arch-wf-${wf.id}`,
      date: wf.date,
      txType: 'PRODUCTION',
      txTypeLabelBn: 'জ্বালানি ও কাঠ সরবরাহ',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      partyName: wf.supplierName,
      partyPhone: wf.supplierPhone,
      descriptionBn: `${wf.supplierName} — ${wf.woodType}: ${formatBn(wf.quantity)} ${wf.unit} (রেট: ৳${formatBn(wf.ratePerUnit)}/${wf.unit})`,
      billedOrPayableAmount: wf.totalBill,
      cashInAmount: 0,
      cashOutAmount: wf.paidAmount,
      balanceImpactAmount: -wf.dueAmount,
      paymentMethod: wf.paymentMethod,
      sourceRecordId: wf.id,
    });
  }

  // E. Brick Deliveries
  for (const d of periodDeliveries) {
    const kId = resolveRecordKilnId(d);
    rawArchiveEntries.push({
      id: `arch-del-${d.id}`,
      date: d.date,
      txType: 'DELIVERY',
      txTypeLabelBn: 'ইট ডেলিভারি ট্রিপ',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      memoNo: d.memoNo,
      partyName: d.customerName,
      partyPhone: d.customerPhone,
      descriptionBn: `মেমো #${d.memoNo} — ${cleanBrickGradeName(d.gradeName)}: ${formatBn(d.quantity)} পিস ডেলিভারি (${d.truckNo || 'গাড়ি'})`,
      quantityPieces: d.quantity,
      billedOrPayableAmount: 0,
      cashInAmount: 0,
      cashOutAmount: 0,
      balanceImpactAmount: 0,
      sourceRecordId: d.id,
    });
  }

  // F. Worker Attendance / Hajira
  for (const wa of periodWorkerAtt) {
    const kId = resolveRecordKilnId(wa);
    const earned = (Number(wa.morningAmount) || 0) + (Number(wa.afternoonAmount) || 0);
    rawArchiveEntries.push({
      id: `arch-wa-${wa.id}`,
      date: wa.date,
      txType: 'LABOR',
      txTypeLabelBn: wa.recordType === 'PAYMENT' ? 'লেবার পেমেন্ট' : 'লেবার হাজিরা',
      kilnId: kId,
      kilnNameBn: getKilnLabel(kId),
      partyName: wa.workerName,
      descriptionBn: `${wa.workerName} (${wa.workerRole}) — ${wa.note || 'হাজিরা ও খোরাকি'}`,
      billedOrPayableAmount: earned,
      cashInAmount: 0,
      cashOutAmount: wa.totalPaid,
      balanceImpactAmount: -(earned - wa.totalPaid),
      sourceRecordId: wa.id,
    });
  }

  // Apply Archive Secondary Filters (Customer, Memo No, Transaction Type)
  const customerQ = parseBanglaDigits((filter.customerQuery || '').trim().toLowerCase());
  const memoQ = parseBanglaDigits((filter.memoNoQuery || '').trim().toLowerCase());
  const txTypeFilter = filter.txTypeFilter || 'ALL';

  const archiveEntries = rawArchiveEntries
    .filter((entry) => {
      if (txTypeFilter !== 'ALL' && entry.txType !== txTypeFilter) {
        return false;
      }
      if (customerQ) {
        const pName = parseBanglaDigits((entry.partyName || '').toLowerCase());
        const pPhone = parseBanglaDigits((entry.partyPhone || '').toLowerCase());
        const desc = parseBanglaDigits((entry.descriptionBn || '').toLowerCase());
        if (
          !pName.includes(customerQ) &&
          !pPhone.includes(customerQ) &&
          !desc.includes(customerQ)
        ) {
          return false;
        }
      }
      if (memoQ) {
        const mNo = parseBanglaDigits((entry.memoNo || '').toLowerCase());
        const desc = parseBanglaDigits((entry.descriptionBn || '').toLowerCase());
        if (!mNo.includes(memoQ) && !desc.includes(memoQ)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredArchiveTotals = {
    count: archiveEntries.length,
    totalBilled: archiveEntries.reduce((s, e) => s + e.billedOrPayableAmount, 0),
    totalCashIn: archiveEntries.reduce((s, e) => s + e.cashInAmount, 0),
    totalCashOut: archiveEntries.reduce((s, e) => s + e.cashOutAmount, 0),
    totalBricksQty: archiveEntries.reduce(
      (s, e) => s + (Number(e.quantityPieces) || 0),
      0
    ),
  };

  const hasRecordsInPeriod = rawArchiveEntries.length > 0;

  return {
    periodTitleBn,
    periodSubtitleBn,
    startDate,
    endDate,
    kilnId: selectedKilnId,
    kilnNameBn,
    selectedYear,
    selectedSeason,
    hasRecordsInPeriod,
    totalSalesAmount,
    totalMemoCount,
    totalDiscountAmount,
    totalCreditSalesAmount,
    totalActualCollections,
    initialMemoCollections,
    dueCollections,
    totalOutstandingReceivables,
    totalExpenses,
    otherIncome,
    netCashMovement,
    rawBricksCut,
    chulliLoadedBricks,
    poraiFiredBricks,
    pakaUnloadedBricks,
    totalBricksSoldQty,
    totalBricksDeliveredQty,
    totalPendingDeliveryQty,
    laborEarnedAmount,
    laborPaidAmount,
    laborOutstandingDue,
    supplierAndContractorPayable,
    supplierAndContractorPaid,
    supplierAndContractorDue,
    soilAndRawMaterialAmount,
    soilTicketCount,
    coalPurchaseAmount,
    dieselAndVekuAmount,
    totalWoodFuelMaund,
    totalWoodFuelDeliveries,
    totalWoodFuelBillAmount,
    totalWoodFuelPaidAmount,
    totalWoodFuelDueAmount,
    fuelEnergyExpenseAmount,
    totalFuelAndWoodCost,
    fuelCostPerThousandBricks,
    gradeBreakdown,
    expenseBreakdown,
    monthlyBreakdown,
    reconciliation: {
      openingCustomerReceivables,
      periodNewSales: totalSalesAmount,
      periodCustomerCollections: totalActualCollections,
      closingCustomerReceivables,
      periodUnpaidMemoDue,
      openingStockBricks,
      periodProducedBricks,
      periodSoldBricks: totalBricksSoldQty,
      periodDeliveredBricks: totalBricksDeliveredQty,
      damageOrAdjustmentBricks,
      closingStockBricks,
      openingCashBalance,
      periodCashReceived,
      periodTotalExpenses: totalExpenses,
      closingCashBalance,
      openingLiabilities,
      periodIncurredLiabilities,
      periodPaidLiabilities,
      closingLiabilities,
    },
    archiveEntries,
    filteredArchiveTotals,
  };
}

export interface SeasonVarianceMetric {
  seasonAValue: number;
  seasonBValue: number;
  /** Variance (Season A - Season B) */
  diffAminusB: number;
  /** Variance (Season B - Season A) */
  diffBminusA: number;
  /** Percentage variance of Season A relative to Season B (or 100% if B is 0 and A > 0) */
  variancePct: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  seasonABarPct: number;
  seasonBBarPct: number;
}

export interface SeasonComparisonRow {
  id: string;
  group: 'SALES' | 'PRODUCTION' | 'EXPENSE' | 'CASH_AND_DUE';
  labelBn: string;
  isCurrency: boolean;
  favorableWhenHigher: boolean;
  metric: SeasonVarianceMetric;
}

export interface SeasonComparisonSummary {
  seasonATitleBn: string;
  seasonBTitleBn: string;
  seasonAPeriodBn: string;
  seasonBPeriodBn: string;
  sales: SeasonVarianceMetric;
  collections: SeasonVarianceMetric;
  expenses: SeasonVarianceMetric;
  rawProduction: SeasonVarianceMetric;
  pakaProduction: SeasonVarianceMetric;
  soldBricks: SeasonVarianceMetric;
  netCash: SeasonVarianceMetric;
  receivables: SeasonVarianceMetric;
  rows: SeasonComparisonRow[];
}

function buildVarianceMetric(aVal: number, bVal: number): SeasonVarianceMetric {
  const a = Number(aVal) || 0;
  const b = Number(bVal) || 0;
  const diffAminusB = a - b;
  const diffBminusA = b - a;
  let variancePct = 0;
  if (b !== 0) {
    variancePct = Math.round(((a - b) / Math.abs(b)) * 1000) / 10;
  } else if (a !== 0) {
    variancePct = a > 0 ? 100 : -100;
  }
  const direction: 'UP' | 'DOWN' | 'FLAT' =
    diffAminusB > 0 ? 'UP' : diffAminusB < 0 ? 'DOWN' : 'FLAT';
  const maxAbs = Math.max(1, Math.abs(a), Math.abs(b));
  const seasonABarPct = a === 0 ? 4 : Math.max(8, Math.round((Math.abs(a) / maxAbs) * 100));
  const seasonBBarPct = b === 0 ? 4 : Math.max(8, Math.round((Math.abs(b) / maxAbs) * 100));

  return {
    seasonAValue: a,
    seasonBValue: b,
    diffAminusB,
    diffBminusA,
    variancePct,
    direction,
    seasonABarPct,
    seasonBBarPct,
  };
}

export function computeSeasonVarianceComparison(
  reportA: YearlySeasonalReport,
  reportB: YearlySeasonalReport
): SeasonComparisonSummary {
  const sales = buildVarianceMetric(
    reportA.totalSalesAmount,
    reportB.totalSalesAmount
  );
  const collections = buildVarianceMetric(
    reportA.totalActualCollections,
    reportB.totalActualCollections
  );
  const expenses = buildVarianceMetric(
    reportA.totalExpenses,
    reportB.totalExpenses
  );
  const rawProduction = buildVarianceMetric(
    reportA.rawBricksCut,
    reportB.rawBricksCut
  );
  const pakaProduction = buildVarianceMetric(
    reportA.pakaUnloadedBricks,
    reportB.pakaUnloadedBricks
  );
  const soldBricks = buildVarianceMetric(
    reportA.totalBricksSoldQty,
    reportB.totalBricksSoldQty
  );
  const netCash = buildVarianceMetric(
    reportA.netCashMovement,
    reportB.netCashMovement
  );
  const receivables = buildVarianceMetric(
    reportA.totalOutstandingReceivables,
    reportB.totalOutstandingReceivables
  );

  const rows: SeasonComparisonRow[] = [
    {
      id: 'total_sales',
      group: 'SALES',
      labelBn: 'মোট ইট বিক্রয় বিল (Total Sales)',
      isCurrency: true,
      favorableWhenHigher: true,
      metric: sales,
    },
    {
      id: 'actual_collections',
      group: 'SALES',
      labelBn: 'প্রকৃত নগদ আদায় (Actual Cash Collections)',
      isCurrency: true,
      favorableWhenHigher: true,
      metric: collections,
    },
    {
      id: 'sold_bricks_qty',
      group: 'SALES',
      labelBn: 'বিক্রিত ইটের পরিমাণ (Sold Bricks Qty)',
      isCurrency: false,
      favorableWhenHigher: true,
      metric: soldBricks,
    },
    {
      id: 'delivered_bricks_qty',
      group: 'SALES',
      labelBn: 'ডেলিভারিকৃত ইট (Delivered Bricks Qty)',
      isCurrency: false,
      favorableWhenHigher: true,
      metric: buildVarianceMetric(
        reportA.totalBricksDeliveredQty,
        reportB.totalBricksDeliveredQty
      ),
    },
    {
      id: 'raw_bricks_cut',
      group: 'PRODUCTION',
      labelBn: 'কাঁচা ইট কাটা / উৎপাদন (Raw Bricks Produced)',
      isCurrency: false,
      favorableWhenHigher: true,
      metric: rawProduction,
    },
    {
      id: 'chulli_loaded',
      group: 'PRODUCTION',
      labelBn: 'চুল্লিতে ভ্যান লোড ইট (Chulli Van Loaded)',
      isCurrency: false,
      favorableWhenHigher: true,
      metric: buildVarianceMetric(
        reportA.chulliLoadedBricks,
        reportB.chulliLoadedBricks
      ),
    },
    {
      id: 'paka_unloaded',
      group: 'PRODUCTION',
      labelBn: 'পাকা ইট আনলোড / উৎপাদন (Fired Bricks Unloaded)',
      isCurrency: false,
      favorableWhenHigher: true,
      metric: pakaProduction,
    },
    {
      id: 'total_expenses',
      group: 'EXPENSE',
      labelBn: 'মোট ভাটা খরচ (Total Expenses)',
      isCurrency: true,
      favorableWhenHigher: false,
      metric: expenses,
    },
    {
      id: 'coal_purchases',
      group: 'EXPENSE',
      labelBn: 'কয়লা ক্রয় খরচ (Coal Purchases)',
      isCurrency: true,
      favorableWhenHigher: false,
      metric: buildVarianceMetric(
        reportA.coalPurchaseAmount,
        reportB.coalPurchaseAmount
      ),
    },
    {
      id: 'soil_purchases',
      group: 'EXPENSE',
      labelBn: 'মাটি ও কাঁচামাল ক্রয় (Soil & Raw Material)',
      isCurrency: true,
      favorableWhenHigher: false,
      metric: buildVarianceMetric(
        reportA.soilAndRawMaterialAmount,
        reportB.soilAndRawMaterialAmount
      ),
    },
    {
      id: 'labor_sardar_paid',
      group: 'EXPENSE',
      labelBn: 'লেবার ও সর্দার পেমেন্ট (Labor & Sardar Paid)',
      isCurrency: true,
      favorableWhenHigher: false,
      metric: buildVarianceMetric(
        reportA.laborPaidAmount + reportA.supplierAndContractorPaid,
        reportB.laborPaidAmount + reportB.supplierAndContractorPaid
      ),
    },
    {
      id: 'net_cash_movement',
      group: 'CASH_AND_DUE',
      labelBn: 'নিট ক্যাশ প্রবাহ (Net Cash Movement)',
      isCurrency: true,
      favorableWhenHigher: true,
      metric: netCash,
    },
    {
      id: 'closing_receivables',
      group: 'CASH_AND_DUE',
      labelBn: 'সমাপনী ক্রেতা বকেয়া পাওনা (Closing Receivables)',
      isCurrency: true,
      favorableWhenHigher: false,
      metric: receivables,
    },
  ];

  return {
    seasonATitleBn: reportA.periodTitleBn,
    seasonBTitleBn: reportB.periodTitleBn,
    seasonAPeriodBn: `${reportA.startDate} হতে ${reportA.endDate}`,
    seasonBPeriodBn: `${reportB.startDate} হতে ${reportB.endDate}`,
    sales,
    collections,
    expenses,
    rawProduction,
    pakaProduction,
    soldBricks,
    netCash,
    receivables,
    rows,
  };
}

