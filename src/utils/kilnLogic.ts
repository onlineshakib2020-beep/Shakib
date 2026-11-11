import type {
  AdvanceBrickBooking,
  BrickGrade,
  BusinessAnalysisReport,
  CashTransaction,
  ChulliUnloadRecord,
  ComplianceInstallmentRecord,
  DadonAdvanceRecord,
  DadonRoleCategory,
  DailyChartPoint,
  DailyKilnGoals,
  DashboardMetrics,
  EstimatedCostOverrides,
  GradeReportRow,
  KilnDatabaseState,
  MemoItemRow,
  MillId,
  MillPotRecord,
  SalesMemo,
  SoilCoalRecord,
  SystemUiAction,
  VehicleDieselRecord,
  WoodFuelRecord,
} from '../types/kiln.ts';

const EN_TO_BN_DIGITS: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

let activeLanguageMode: 'bn' | 'en' = 'bn';
let useEnglishNumerals = false;

export function setActiveLanguageMode(lang: 'bn' | 'en') {
  activeLanguageMode = lang;
}

export function setUseEnglishNumerals(enabled: boolean) {
  useEnglishNumerals = enabled;
}

export function getActiveLanguageMode(): 'bn' | 'en' {
  return activeLanguageMode;
}

/**
 * Formats numbers with Indian/Bangladeshi comma grouping (e.g. 1,25,000 or ১,২৫,০০০)
 */
export function formatBn(value: number | string | undefined | null): string {
  const isEnDigits = activeLanguageMode === 'en' || useEnglishNumerals;
  if (value === undefined || value === null || value === '') return isEnDigits ? '0' : '০';
  const num = typeof value === 'number' ? value : Number(parseBanglaDigits(String(value)));
  if (Number.isNaN(num)) {
    if (isEnDigits) {
      return parseBanglaDigits(String(value));
    }
    return String(value).replace(/[0-9]/g, (d) => EN_TO_BN_DIGITS[d] ?? d);
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(Math.round(num * 100) / 100);
  if (isEnDigits) return formatted;
  return formatted.replace(/[0-9]/g, (d) => EN_TO_BN_DIGITS[d] ?? d);
}

export function formatCurrencyBn(value: number | string | undefined | null): string {
  if (activeLanguageMode === 'en') {
    return `Tk ${formatBn(value)}`;
  }
  return `৳${formatBn(value)}`;
}

/**
 * Converts Bengali digits in a string to standard ASCII digits for numeric parsing
 */
export function parseBanglaDigits(input: string): string {
  return String(input ?? '').replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d);
}

/**
 * Normalizes any numeric input string (converts Bangla digits ০-৯ to 0-9, strips commas/currency symbols,
 * and removes leading zero when followed by another digit like "05000" -> "5000").
 */
export function normalizeNumericInput(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const ascii = parseBanglaDigits(String(raw)).replace(/[,৳\s]/g, '');
  let cleaned = '';
  let hasDot = false;
  for (let i = 0; i < ascii.length; i++) {
    const ch = ascii[i];
    if (ch >= '0' && ch <= '9') {
      cleaned += ch;
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      cleaned += ch;
    }
  }
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') {
    cleaned = cleaned.replace(/^0+(?=\d)/, '');
  }
  return cleaned;
}

/**
 * Safely parses any number or string (including Bangla numerals, commas, spaces) into a finite number.
 */
export function parseNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = normalizeNumericInput(String(value));
  if (!normalized || normalized === '.') return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Strips parenthetical English labels like "(First Class)" from brick grade names
 */
export function cleanBrickGradeName(name: string): string {
  if (!name) return '১ নং ইট';
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Calculate row total for an item in a memo.
 * Business Rule:
 * - Standard per-1,000 brick pricing (dor rate 1000 a hobe): e.g., rate = 11000 -> 1000 bricks = 11000, 500 bricks = 5500.
 * - If a small per-piece rate (< 100, e.g. 13.5) is passed in legacy tests, falls back to qty * rate.
 */
export function calculateRowTotal(
  quantity: number,
  rate: number,
  ratePerThousand = true
): number {
  const qty = Math.max(0, Number(quantity) || 0);
  const r = Math.max(0, Number(rate) || 0);
  if (r >= 100 || (ratePerThousand && r >= 100)) {
    return Math.round((qty / 1000) * r);
  }
  return Math.round(qty * r);
}

/**
 * Generates a guaranteed unique memo number and validates custom memo numbers against duplicates.
 */
export function generateUniqueMemoNo(
  salesMemos: Array<{ memoNo: string }>,
  requestedMemoNo?: string,
  excludeMemoId?: string
): { memoNo: string; duplicateErrorBn?: string } {
  const filteredMemos = excludeMemoId
    ? salesMemos.filter((m) => (m as { id?: string }).id !== excludeMemoId)
    : salesMemos;
  const existingSet = new Set(
    filteredMemos.map((m) =>
      parseBanglaDigits(String(m.memoNo || '').trim()).toLowerCase()
    )
  );

  if (requestedMemoNo && requestedMemoNo.trim()) {
    const cleanReq = parseBanglaDigits(requestedMemoNo.trim());
    if (existingSet.has(cleanReq.toLowerCase())) {
      return {
        memoNo: cleanReq,
        duplicateErrorBn: `মেমো নম্বর "${cleanReq}" ইতিমধ্যে ব্যবহৃত হয়েছে। ডুপ্লিকেট মেমো নম্বর অনুমোদিত নয়।`,
      };
    }
    return { memoNo: cleanReq };
  }

  // If no memos exist yet, start serial at 3001
  if (filteredMemos.length === 0) {
    return { memoNo: '3001' };
  }

  // Follow the serial pattern of the most recent memo (e.g., 3001 -> 3002 -> 3003)
  const latestRaw = parseBanglaDigits(String(filteredMemos[0]?.memoNo || '').trim());
  const latestMatch = latestRaw.match(/^(.*?)(\d+)$/);

  if (latestMatch) {
    const prefix = latestMatch[1];
    let maxNum = parseInt(latestMatch[2], 10);

    for (const m of filteredMemos) {
      const normM = parseBanglaDigits(String(m.memoNo || '').trim());
      const mMatch = normM.match(/^(.*?)(\d+)$/);
      if (mMatch && mMatch[1].toLowerCase() === prefix.toLowerCase()) {
        const n = parseInt(mMatch[2], 10);
        if (Number.isFinite(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }

    let candidate = `${prefix}${maxNum + 1}`;
    while (existingSet.has(candidate.toLowerCase())) {
      maxNum += 1;
      candidate = `${prefix}${maxNum + 1}`;
    }
    return { memoNo: candidate };
  }

  let fallbackNum = 3000 + filteredMemos.length + 1;
  let candidate = String(fallbackNum);
  while (existingSet.has(candidate.toLowerCase())) {
    fallbackNum += 1;
    candidate = String(fallbackNum);
  }
  return { memoNo: candidate };
}

/**
 * Normalizes a memo so rate is stored per 1,000 bricks (e.g., 11000 for 1000 bricks)
 * and gradeName has no English parenthetical suffixes.
 */
export function normalizeLegacyMemo(
  memo: Partial<SalesMemo>,
  _defaultGrades: BrickGrade[] = []
): SalesMemo {
  const rawItems: MemoItemRow[] = Array.isArray(memo.items) && memo.items.length > 0
    ? memo.items
    : [
        {
          id: `item-${memo.id || Date.now()}-1`,
          gradeId: memo.gradeId || 'grade-1',
          gradeName: cleanBrickGradeName(memo.gradeName || '১ নং ইট'),
          quantity: Number(memo.quantity) || 1000,
          rate: Number(memo.rate) || 11000,
          ratePerThousand: true,
          lineTotal: Number(memo.totalAmount) || calculateRowTotal(
            Number(memo.quantity) || 1000,
            Number(memo.rate) || 11000,
            true
          ),
        },
      ];

  const items: MemoItemRow[] = rawItems.map((it) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    let rate = Math.max(0, Number(it.rate) || 0);
    if (rate > 0 && rate < 100) {
      rate = Math.round(rate * 1000);
    }
    const lineTotal = calculateRowTotal(qty, rate, true);
    return {
      ...it,
      gradeName: cleanBrickGradeName(it.gradeName || '১ নং ইট'),
      quantity: qty,
      rate,
      ratePerThousand: true,
      lineTotal,
    };
  });

  const subTotal = items.reduce((s, it) => s + (it.lineTotal || 0), 0);
  const discount = Math.max(0, Math.min(subTotal, Number(memo.discount) || 0));
  const totalAmount = Math.max(0, subTotal - discount);
  const paidAmount = Math.max(0, Math.min(totalAmount, Number(memo.paidAmount) || 0));
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  let status: 'PAID' | 'DUE' | 'PARTIAL' = 'DUE';
  if (dueAmount === 0 && totalAmount > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && dueAmount > 0) {
    status = 'PARTIAL';
  }

  const totalOrderedQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const deliveryHistory = Array.isArray(memo.deliveryHistory) ? memo.deliveryHistory : [];
  const deliveredFromHistory = deliveryHistory.reduce(
    (s, d) => s + (Number(d.quantity) || 0),
    0
  );
  const deliveredQuantity =
    deliveryHistory.length > 0
      ? deliveredFromHistory
      : typeof memo.deliveredQuantity === 'number'
      ? Math.max(0, memo.deliveredQuantity)
      : 0;
  const remainingDeliveryQuantity = Math.max(0, totalOrderedQty - deliveredQuantity);

  const resolvedDeliveryStatus: SalesMemo['deliveryStatus'] =
    deliveredQuantity >= totalOrderedQty && totalOrderedQty > 0
      ? 'DELIVERED'
      : deliveredQuantity > 0
      ? 'PARTIAL'
      : memo.deliveryStatus || 'BOOKING';

  return {
    id: memo.id || `memo-${Date.now()}`,
    memoNo: memo.memoNo || `BF-2026-${Date.now().toString().slice(-4)}`,
    date: memo.date || new Date().toISOString().slice(0, 10),
    customerName: memo.customerName || 'নগদ ক্রেতা',
    customerPhone: memo.customerPhone || '—',
    customerAddress: memo.customerAddress || 'গ্রাম: স্থানীয়',
    truckNo: memo.truckNo || '—',
    driverName: memo.driverName || '—',
    vehicleType: memo.vehicleType,
    driverPhone: memo.driverPhone,
    deliveryStatus: resolvedDeliveryStatus,
    deliveredQuantity,
    remainingDeliveryQuantity,
    deliveryHistory,
    duePromiseDate: memo.duePromiseDate,
    items,
    subTotal,
    discount,
    totalAmount,
    paidAmount,
    dueAmount,
    paymentMethod: memo.paymentMethod || 'নগদ ক্যাশ',
    status,
    note: memo.note || '',
    createdAt: memo.createdAt || new Date().toISOString(),
    paymentHistory: Array.isArray(memo.paymentHistory) ? memo.paymentHistory : undefined,
  };
}

/**
 * Computes the complete kiln brick pipeline accounting summary:
 * 1. মূল কাঁচা ইট উৎপাদন (মিল হিসাব)
 * 2. চুল্লিতে লোড / পোড়ানো ইট
 * 3. বর্তমানে কাঁচা ইট আছে কতটা (মাঠে অবশিষ্ট কাঁচা ইট)
 * 4. পাকা ইট উৎপাদন / স্টক (চুল্লি আনলোড ও পাকা স্টক)
 * 5. ইট ডেলিভারি চলে গেছে কতটা (এবং মেমোতে ডেলিভারি বাকি কতটা)
 * 6. বর্তমানে পাকা ইট আছে কতটা (ডেলিভারি বাদে ভাটায় বর্তমান পাকা ইট)
 */
export function computeKilnBrickPipelineSummary(state: Partial<KilnDatabaseState>) {
  const millPots = state.millPots || [];
  const chulliLoads = state.chulliLoads || [];
  const poraiMistriRecords = state.poraiMistriRecords || [];
  const chulliUnloads = state.chulliUnloads || [];
  const brickGrades = state.brickGrades || [];
  const salesMemos = state.salesMemos || [];
  const memoDeliveries = state.memoDeliveries || [];

  // 1. মূল কাঁচা ইট উৎপাদন (মিল হিসাব)
  const rawBricksProduced = millPots.reduce(
    (s, p) => s + (Number(p.rawBricksCut) || 0),
    0
  );

  // 2. চুল্লিতে লোড ও পোড়ানো ইট (কাঁচা ইট বনাম চেম্বার সাজানোর পাকা ইট)
  const rawBricksLoadedIntoKiln = chulliLoads.reduce(
    (s, l) => s + (Number(l.rawBricksLoaded) || 0),
    0
  );
  const pakaBricksLoadedIntoKiln = chulliLoads.reduce(
    (s, l) => s + (Number(l.pakaBricksLoaded) || 0),
    0
  );
  const totalBricksLoadedIntoKiln = chulliLoads.reduce(
    (s, l) =>
      s +
      (l.totalBricksLoaded !== undefined
        ? Number(l.totalBricksLoaded) || 0
        : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
    0
  );

  // কাঁচা ইট যা চুল্লিতে পোড়ানোর জন্য গেছে
  const chulliLoadedBricks = rawBricksLoadedIntoKiln;
  const poraiFiredBricks = poraiMistriRecords.reduce(
    (s, r) => s + (Number(r.bricksFired) || 0),
    0
  );
  const firedOrLoadedBricks = Math.max(chulliLoadedBricks, poraiFiredBricks);

  // 3. বর্তমানে কাঁচা ইট আছে কতটা (মাঠে অবশিষ্ট কাঁচা ইট)
  // লক্ষ্য করুন: মাঠ থেকে কেবল খাঁটি কাঁচা ইটই কমে; পাকা ইট মিলের কাঁচা ইট থেকে কমবে না!
  const rawTakenFromField = chulliLoadedBricks > 0 ? chulliLoadedBricks : poraiFiredBricks;
  const currentRawBricks = Math.max(0, rawBricksProduced - rawTakenFromField);

  // 4. মেমো অর্ডার ও ডেলিভারি হিসাব
  let totalMemoOrderedBricks = 0;
  let totalDeliveredFromMemos = 0;
  const soldByGrade: Record<string, number> = {};
  const deliveredByGrade: Record<string, number> = {};

  for (const m of salesMemos) {
    const mItems =
      Array.isArray(m.items) && m.items.length > 0
        ? m.items
        : [
            {
              gradeId: m.gradeId || 'grade-1',
              quantity: Number(m.quantity) || 0,
            },
          ];
    const mOrdered = mItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    totalMemoOrderedBricks += mOrdered;

    for (const it of mItems) {
      const gId = it.gradeId || 'grade-1';
      soldByGrade[gId] = (soldByGrade[gId] || 0) + (Number(it.quantity) || 0);
    }

    const mHist = Array.isArray(m.deliveryHistory) ? m.deliveryHistory : [];
    const mDeliv =
      mHist.length > 0
        ? mHist.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
        : Number(m.deliveredQuantity) || 0;
    totalDeliveredFromMemos += mDeliv;

    for (const d of mHist) {
      const gId = d.gradeId || 'grade-1';
      deliveredByGrade[gId] = (deliveredByGrade[gId] || 0) + (Number(d.quantity) || 0);
    }
  }

  const totalFromGlobalDeliveries = memoDeliveries.reduce(
    (s, d) => s + (Number(d.quantity) || 0),
    0
  );
  const totalDeliveredBricks = Math.max(
    totalDeliveredFromMemos,
    totalFromGlobalDeliveries
  );
  const totalPendingDeliveryBricks = Math.max(
    0,
    totalMemoOrderedBricks - totalDeliveredBricks
  );

  // 5. পাকা ইট উৎপাদন ও বর্তমান পাকা ইট স্টক (ডেলিভারি চলে যাওয়ার পর বর্তমানে আছে কতটা)
  const unloadedBricks = chulliUnloads.reduce(
    (s, u) => s + (Number(u.totalBricksUnloaded) || 0),
    0
  );

  let totalPakaProducedByGrades = 0;
  const gradeStockBreakdown = brickGrades.map((g) => {
    const sold = soldByGrade[g.id] || 0;
    const delivered = deliveredByGrade[g.id] || 0;
    const unloadedForGrade = chulliUnloads.reduce((sum, u) => {
      const match = (u.unloadedByGrade || []).find((ug) => ug.gradeId === g.id);
      return sum + (match ? Number(match.quantity) || 0 : 0);
    }, 0);
    const totalProduced = Math.max(
      Number(g.seasonProduced) || 0,
      unloadedForGrade,
      (Number(g.currentStock) || 0) + sold
    );
    totalPakaProducedByGrades += totalProduced;
    const currentInKilnAfterDelivery = Math.max(0, totalProduced - delivered);
    return {
      gradeId: g.id,
      gradeName: cleanBrickGradeName(g.nameBn),
      totalProduced,
      orderedOnMemos: sold,
      delivered,
      pendingDelivery: Math.max(0, sold - delivered),
      currentInKilnAfterDelivery,
      unbookedFreeStock: Number(g.currentStock) || 0,
    };
  });

  const totalPakaProduced = Math.max(unloadedBricks, totalPakaProducedByGrades);
  const currentAvailablePakaBricks = Math.max(
    0,
    totalPakaProduced - totalDeliveredBricks
  );

  // চুল্লিতে পোড়াতে অপচয় (কাঁচা ইট বনাম বের হওয়া পাকা ইট)
  const kilnFiringWastageBricks = Math.max(0, firedOrLoadedBricks - totalPakaProduced);

  // নজরুল সর্দার আনলোড করার পর চুল্লির ভেতরে বর্তমান অবশিষ্ট ইট ও এভেইলেবল ফাঁকা লাইন
  const grossBricksInKiln = Math.max(totalBricksLoadedIntoKiln, firedOrLoadedBricks);
  const remainingBricksInKiln = Math.max(0, grossBricksInKiln - unloadedBricks);
  const remainingLinesInKiln = Number((remainingBricksInKiln / 4000).toFixed(2));
  const availableLinesInKiln = Math.max(0, 208 - Math.ceil(remainingBricksInKiln / 4000));

  return {
    rawBricksProduced,
    rawBricksLoadedIntoKiln,
    pakaBricksLoadedIntoKiln,
    totalBricksLoadedIntoKiln,
    chulliLoadedBricks,
    poraiFiredBricks,
    firedOrLoadedBricks,
    currentRawBricks,
    unloadedBricks,
    remainingBricksInKiln,
    remainingLinesInKiln,
    availableLinesInKiln,
    totalPakaProduced,
    totalMemoOrderedBricks,
    totalDeliveredBricks,
    totalPendingDeliveryBricks,
    currentAvailablePakaBricks,
    gradeStockBreakdown,
    kilnFiringWastageBricks,
  };
}

/**
 * Calculates totals for a multi-item sales memo
 */
export function calculateMultiItemMemoTotals(params: {
  items: Array<{ quantity: number; rate: number; ratePerThousand?: boolean }>;
  discount: number;
  paidAmount: number;
}): {
  subTotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'PAID' | 'DUE' | 'PARTIAL';
} {
  const subTotal = params.items.reduce((sum, item) => {
    return (
      sum +
      calculateRowTotal(
        item.quantity,
        item.rate,
        item.ratePerThousand !== false
      )
    );
  }, 0);

  const discount = Math.max(0, Math.min(subTotal, Number(params.discount) || 0));
  const totalAmount = Math.max(0, subTotal - discount);
  const paidAmount = Math.max(
    0,
    Math.min(totalAmount, Math.round(Number(params.paidAmount) || 0))
  );
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  let status: 'PAID' | 'DUE' | 'PARTIAL' = 'DUE';
  if (dueAmount === 0 && totalAmount > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && dueAmount > 0) {
    status = 'PARTIAL';
  }

  return {
    subTotal,
    discount,
    totalAmount,
    paidAmount,
    dueAmount,
    status,
  };
}

/**
 * Legacy single-item calculation helper for backwards compatibility
 */
export function calculateMemoTotals(params: {
  quantity: number;
  rate: number;
  paidAmount: number;
}): {
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'PAID' | 'DUE' | 'PARTIAL';
} {
  const res = calculateMultiItemMemoTotals({
    items: [{ quantity: params.quantity, rate: params.rate, ratePerThousand: true }],
    discount: 0,
    paidAmount: params.paidAmount,
  });
  return {
    totalAmount: res.totalAmount,
    paidAmount: res.paidAmount,
    dueAmount: res.dueAmount,
    status: res.status,
  };
}

/**
 * Validates stock across all items in a memo.
 * When allowZeroOrAnyStock is true ("ইট থাক বা না থাক মেমো করা যাবে"),
 * memos are always allowed and stock is deducted down to a minimum of 0.
 */
export function validateStockForMultiItemMemo(
  brickGrades: BrickGrade[],
  items: Array<{ gradeId: string; quantity: number }>,
  allowZeroOrAnyStock = false
): { valid: boolean; errorBn?: string; updatedStock: Record<string, number> } {
  const reqByGrade: Record<string, number> = {};
  for (const it of items) {
    const q = Number(it.quantity) || 0;
    if (q <= 0) {
      return {
        valid: false,
        errorBn: 'প্রতিটি ইটের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।',
        updatedStock: {},
      };
    }
    reqByGrade[it.gradeId] = (reqByGrade[it.gradeId] || 0) + q;
  }

  const updatedStock: Record<string, number> = {};
  for (const [gradeId, reqQty] of Object.entries(reqByGrade)) {
    const grade = brickGrades.find((g) => g.id === gradeId);
    if (!grade) {
      return {
        valid: false,
        errorBn: 'নির্বাচিত ইটের ধরন খুঁজে পাওয়া যায়নি।',
        updatedStock: {},
      };
    }
    if (!allowZeroOrAnyStock && reqQty > grade.currentStock) {
      return {
        valid: false,
        errorBn: `পর্যাপ্ত স্টক নেই! "${grade.nameBn}"-এর বর্তমান স্টক ${formatBn(
          grade.currentStock
        )}টি, কিন্তু আপনি মেমো করতে চাচ্ছেন ${formatBn(reqQty)}টি।`,
        updatedStock: {},
      };
    }
    updatedStock[gradeId] = Math.max(0, (grade.currentStock || 0) - reqQty);
  }

  return { valid: true, updatedStock };
}

/**
 * Backward-compatible single-grade stock validator
 */
export function validateStockForSale(
  grade: BrickGrade | undefined,
  requestedQty: number,
  allowZeroOrAnyStock = false
): { valid: boolean; errorBn?: string; remainingStock: number } {
  if (!grade) {
    return {
      valid: false,
      errorBn: 'নির্বাচিত ইটের গ্রেডটি খুঁজে পাওয়া যায়নি।',
      remainingStock: 0,
    };
  }
  const qty = Number(requestedQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return {
      valid: false,
      errorBn: 'বিক্রির পরিমাণ অবশ্যই শূন্যের বেশি হতে হবে।',
      remainingStock: grade.currentStock,
    };
  }
  if (!allowZeroOrAnyStock && qty > grade.currentStock) {
    return {
      valid: false,
      errorBn: `পর্যাপ্ত স্টক নেই! ${grade.nameBn}-এর বর্তমান স্টক ${formatBn(
        grade.currentStock
      )}টি, কিন্তু মেমো করতে চাচ্ছেন ${formatBn(qty)}টি।`,
      remainingStock: grade.currentStock,
    };
  }
  return {
    valid: true,
    remainingStock: Math.max(0, (grade.currentStock || 0) - qty),
  };
}

/**
 * Generates actual real-data driven daily chart points for Income vs Expense
 */
export function generateDailyChartData(
  salesMemos: SalesMemo[],
  cashTransactions: CashTransaction[],
  daysCount = 7
): DailyChartPoint[] {
  const points: DailyChartPoint[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dateLabelBn = `${formatBn(day)}/${formatBn(month)}`;

    const dayMemos = salesMemos.filter((m) => m.date === dateStr);
    const dayTx = cashTransactions.filter((t) => t.date === dateStr);

    const salesAmount = dayMemos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
    const cashInAmount = dayTx
      .filter((t) => t.type === 'IN')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const expenseAmount = dayTx
      .filter((t) => t.type === 'OUT')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const bricksSoldQty = dayMemos.reduce((sum, m) => {
      if (Array.isArray(m.items) && m.items.length > 0) {
        return sum + m.items.reduce((s, it) => s + (it.quantity || 0), 0);
      }
      return sum + (m.quantity || 0);
    }, 0);

    points.push({
      date: dateStr,
      dateLabelBn,
      salesAmount,
      cashInAmount,
      expenseAmount,
      bricksSoldQty,
    });
  }

  return points;
}

/**
 * Calculates Dashboard Metrics following strict accounting rules:
 * - Opening Balance + Real Cash In - Real Cash Out = Current Cash Balance
 * - Total Bricks Sold count & amount
 * - Total Collection vs Total Due
 */
export function calculateDashboardMetrics(
  state: Pick<KilnDatabaseState, 'settings' | 'brickGrades' | 'salesMemos' | 'cashTransactions'>,
  todayDate: string,
  yesterdayDate: string
): DashboardMetrics {
  const openingBalance = state.settings?.openingBalance || 0;

  const todayMemos = state.salesMemos.filter((m) => m.date === todayDate);
  const yesterdayMemos = state.salesMemos.filter((m) => m.date === yesterdayDate);

  const getMemoBricksQty = (m: SalesMemo) => {
    if (Array.isArray(m.items) && m.items.length > 0) {
      return m.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    }
    return m.quantity || 0;
  };

  const totalBricksSoldAllTime = state.salesMemos.reduce(
    (sum, m) => sum + getMemoBricksQty(m),
    0
  );
  const totalBrickSalesAmountAllTime = state.salesMemos.reduce(
    (sum, m) => sum + (m.totalAmount || 0),
    0
  );

  const todaySalesAmount = todayMemos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const todayBricksSold = todayMemos.reduce((sum, m) => sum + getMemoBricksQty(m), 0);
  const todaySalesMemoCount = todayMemos.length;

  const yesterdaySalesAmount = yesterdayMemos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const yesterdayBricksSold = yesterdayMemos.reduce((sum, m) => sum + getMemoBricksQty(m), 0);
  const yesterdaySalesMemoCount = yesterdayMemos.length;

  const inTransactions = state.cashTransactions.filter((t) => t.type === 'IN');
  const outTransactions = state.cashTransactions.filter((t) => t.type === 'OUT');

  const totalCashIn = inTransactions.reduce((sum, t) => sum + t.amount, 0);
  const todayCashIn = inTransactions
    .filter((t) => t.date === todayDate)
    .reduce((sum, t) => sum + t.amount, 0);
  const yesterdayCashIn = inTransactions
    .filter((t) => t.date === yesterdayDate)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = outTransactions.reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = outTransactions
    .filter((t) => t.date === todayDate)
    .reduce((sum, t) => sum + t.amount, 0);
  const yesterdayExpense = outTransactions
    .filter((t) => t.date === yesterdayDate)
    .reduce((sum, t) => sum + t.amount, 0);

  const currentCashBalance = openingBalance + totalCashIn - totalExpense;
  const liveLiquidityToday = todayCashIn - todayExpense;
  const liveLiquidityAllTime = totalCashIn - totalExpense;

  const dueMemos = state.salesMemos.filter((m) => (m.dueAmount || 0) > 0);
  const totalCustomerDue = dueMemos.reduce((sum, m) => sum + (m.dueAmount || 0), 0);
  const uniqueDueCustomers = new Set(dueMemos.map((m) => m.customerName.trim())).size;

  const totalBrickStockPieces = (state.brickGrades || []).reduce(
    (sum, g) => sum + (g.currentStock || 0),
    0
  );

  return {
    todayDate,
    yesterdayDate,
    totalBricksSoldAllTime,
    totalBrickSalesAmountAllTime,
    todayBricksSold,
    todaySalesAmount,
    todaySalesMemoCount,
    todayCashIn,
    totalCashIn,
    totalExpense,
    todayExpense,
    openingBalance,
    currentCashBalance,
    liveLiquidityToday,
    liveLiquidityAllTime,
    totalCustomerDue,
    dueCustomerCount: uniqueDueCustomers,
    yesterdaySalesAmount,
    yesterdaySalesMemoCount,
    yesterdayBricksSold,
    yesterdayCashIn,
    yesterdayExpense,
    totalBrickStockPieces,
    sevenDayChart: generateDailyChartData(state.salesMemos, state.cashTransactions, 7),
  };
}

/**
 * Pure helper that calculates real-time Live Liquidity (actual cash-in-hand
 * by subtracting daily/seasonal operational expenses from sales collections).
 */
export function calculateLiveLiquidity(input: {
  todayCashIn: number;
  todayExpense: number;
  totalCashIn: number;
  totalExpense: number;
  openingBalance?: number;
}): {
  dailyNetCashInHand: number;
  seasonalNetCashInHand: number;
  actualCashInHandWithOpening: number;
  collectionCoveragePct: number;
  status: 'POSITIVE' | 'NEUTRAL' | 'DEFICIT';
} {
  const todayIn = Number(input.todayCashIn) || 0;
  const todayOut = Number(input.todayExpense) || 0;
  const totalIn = Number(input.totalCashIn) || 0;
  const totalOut = Number(input.totalExpense) || 0;
  const opening = Number(input.openingBalance) || 0;

  const dailyNetCashInHand = todayIn - todayOut;
  const seasonalNetCashInHand = totalIn - totalOut;
  const actualCashInHandWithOpening = opening + seasonalNetCashInHand;

  const totalFlow = totalIn + totalOut;
  const collectionCoveragePct =
    totalFlow > 0 ? Math.min(100, Math.max(0, Math.round((totalIn / totalFlow) * 100))) : 100;

  const status =
    dailyNetCashInHand > 0 || (dailyNetCashInHand === 0 && actualCashInHandWithOpening > 0)
      ? 'POSITIVE'
      : dailyNetCashInHand < 0 || actualCashInHandWithOpening < 0
      ? 'DEFICIT'
      : 'NEUTRAL';

  return {
    dailyNetCashInHand,
    seasonalNetCashInHand,
    actualCashInHandWithOpening,
    collectionCoveragePct,
    status,
  };
}

/**
 * Generates a formatted, proprietor-ready Daily Closing Summary text
 * for 1-click WhatsApp / SMS sharing on Phone, Tablet, and Web.
 */
export function formatDailyClosingWhatsAppReport(
  metrics: DashboardMetrics,
  bhataName = 'SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)'
): string {
  const liq = calculateLiveLiquidity({
    todayCashIn: metrics.todayCashIn,
    todayExpense: metrics.todayExpense,
    totalCashIn: metrics.totalCashIn,
    totalExpense: metrics.totalExpense,
    openingBalance: metrics.openingBalance,
  });

  const signFmt = (val: number) =>
    val < 0 ? `-${formatCurrencyBn(Math.abs(val))}` : formatCurrencyBn(val);

  return [
    `🧱 *${bhataName}*`,
    `📅 *ডেইলি ক্লোজিং সামারি (${metrics.todayDate})*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔹 আজকের ইট বিক্রি: ${formatBn(metrics.todayBricksSold)} পিস (${formatBn(metrics.todaySalesMemoCount)}টি মেমো)`,
    `🔹 আজকের মেমো বিল: ${formatCurrencyBn(metrics.todaySalesAmount)}`,
    `✅ আজকের নগদ আদায় (Cash In): ${formatCurrencyBn(metrics.todayCashIn)}`,
    `🔻 আজকের ভাটা খরচ (Expense): ${formatCurrencyBn(metrics.todayExpense)}`,
    `💰 *আজকের নিট ক্যাশ (Live Liquidity): ${signFmt(liq.dailyNetCashInHand)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🏦 বর্তমান নগদ হাতে ক্যাশ (ওপেনিং সহ): *${signFmt(liq.actualCashInHandWithOpening)}*`,
    `📌 মোট ক্রেতা বকেয়া পাওনা: ${formatCurrencyBn(metrics.totalCustomerDue)} (${formatBn(metrics.dueCustomerCount)} জন)`,
    `🧱 প্রস্তুত পাকা ইট স্টক: ${formatBn(metrics.totalBrickStockPieces)} পিস`,
  ].join('\n');
}


/**
 * Computes grade-wise report from multi-item memos
 */
export function computeBrickGradeReport(
  brickGrades: BrickGrade[],
  salesMemos: SalesMemo[],
  todayDate: string,
  yesterdayDate: string
): {
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
} {
  const rows: GradeReportRow[] = brickGrades.map((grade) => {
    let todayQty = 0;
    let todayAmount = 0;
    let yesterdayQty = 0;
    let yesterdayAmount = 0;
    let seasonSoldQty = 0;
    let seasonSoldAmount = 0;

    for (const memo of salesMemos) {
      const items = Array.isArray(memo.items) && memo.items.length > 0
        ? memo.items
        : [
            {
              id: '1',
              gradeId: memo.gradeId || '',
              gradeName: memo.gradeName || '',
              quantity: memo.quantity || 0,
              rate: memo.rate || 0,
              ratePerThousand: true,
              lineTotal: memo.totalAmount || 0,
            },
          ];

      for (const it of items) {
        if (it.gradeId === grade.id) {
          seasonSoldQty += it.quantity || 0;
          seasonSoldAmount += it.lineTotal || 0;

          if (memo.date === todayDate) {
            todayQty += it.quantity || 0;
            todayAmount += it.lineTotal || 0;
          } else if (memo.date === yesterdayDate) {
            yesterdayQty += it.quantity || 0;
            yesterdayAmount += it.lineTotal || 0;
          }
        }
      }
    }

    return {
      grade,
      todayQty,
      todayAmount,
      yesterdayQty,
      yesterdayAmount,
      seasonSoldQty,
      seasonSoldAmount,
    };
  });

  const totals = {
    brickStockPieces: rows.reduce((s, r) => s + r.grade.currentStock, 0),
    todayBrickQty: rows.reduce((s, r) => s + r.todayQty, 0),
    todayTotalAmount: rows.reduce((s, r) => s + r.todayAmount, 0),
    yesterdayBrickQty: rows.reduce((s, r) => s + r.yesterdayQty, 0),
    yesterdayTotalAmount: rows.reduce((s, r) => s + r.yesterdayAmount, 0),
    seasonBrickQty: rows.reduce((s, r) => s + r.seasonSoldQty, 0),
    seasonTotalAmount: rows.reduce((s, r) => s + r.seasonSoldAmount, 0),
  };

  return { rows, totals };
}

export const SAFE_CONFIRMATION_THRESHOLD = 0;

export function requiresSafeConfirmation(params: {
  actionType: 'ADD_EXPENSE' | 'DELETE_MEMO' | 'DELETE_CASH_TX';
  amount?: number;
}): boolean {
  if (params.actionType === 'DELETE_MEMO' || params.actionType === 'DELETE_CASH_TX') {
    return true;
  }
  if (params.actionType === 'ADD_EXPENSE' && (params.amount ?? 0) > SAFE_CONFIRMATION_THRESHOLD) {
    return true;
  }
  return false;
}

export function extractBanglaAmount(rawText: string): number | null {
  const normalized = parseBanglaDigits(rawText);

  const wordToNum: Record<string, number> = {
    এক: 1,
    দেড়: 1.5,
    দুই: 2,
    আড়াই: 2.5,
    তিন: 3,
    চার: 4,
    পাঁচ: 5,
    ছয়: 6,
    সাত: 7,
    আট: 8,
    নয়: 9,
    দশ: 10,
    পনেরো: 15,
    বিশ: 20,
    কুড়ি: 20,
    ত্রিশ: 30,
    চল্লিশ: 40,
    পঞ্চাশ: 50,
  };

  // 1. Spoken word + হাজার (e.g. "পাঁচ হাজার", "দশ হাজার")
  const wordHazarMatch = normalized.match(/(এক|দেড়|দুই|আড়াই|তিন|চার|পাঁচ|ছয়|সাত|আট|নয়|দশ|পনেরো|বিশ|কুড়ি|ত্রিশ|চল্লিশ|পঞ্চাশ)\s*(?:হাজার|hazar|thousand)/i);
  if (wordHazarMatch && wordToNum[wordHazarMatch[1]]) {
    return Math.round(wordToNum[wordHazarMatch[1]] * 1000);
  }

  // 2. Spoken word + লাখ/লক্ষ (e.g. "এক লাখ", "দুই লাখ")
  const wordLakhMatch = normalized.match(/(এক|দেড়|দুই|আড়াই|তিন|চার|পাঁচ|ছয়|সাত|আট|নয়|দশ)\s*(?:লাখ|লক্ষ|lakh)/i);
  if (wordLakhMatch && wordToNum[wordLakhMatch[1]]) {
    return Math.round(wordToNum[wordLakhMatch[1]] * 100000);
  }

  // 3. Digit + হাজার (e.g. "50 হাজার" or "5 হাজার")
  const hazarMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:হাজার|hazar|thousand)/i);
  if (hazarMatch) {
    return Math.round(parseFloat(hazarMatch[1]) * 1000);
  }

  // 4. Digit + লাখ (e.g. "2 লাখ" or "1.5 লক্ষ")
  const lakhMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:লাখ|লক্ষ|lakh)/i);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100000);
  }

  // 5. Explicit "5000 টাকা" or "৳5000"
  const takaMatch = normalized.match(/(?:৳\s*)?(\d{2,9})(?:\s*(?:টাকা|taka|tk))?/i);
  if (takaMatch) {
    return parseInt(takaMatch[1], 10);
  }

  return null;
}

export function detectExpenseCategory(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('কয়লা') || t.includes('কয়লা') || t.includes('coal') || t.includes('koyla'))
    return 'কয়লা ক্রয়';
  if (
    t.includes('ভেকু') ||
    t.includes('ডিজেল') ||
    t.includes('তেল') ||
    t.includes('diesel') ||
    t.includes('veku') ||
    t.includes('tel')
  )
    return 'ভেকু ও ডিজেল';
  if (t.includes('মাটি') || t.includes('soil') || t.includes('clay') || t.includes('mati'))
    return 'মাটি ক্রয়';
  if (
    t.includes('শ্রমিক') ||
    t.includes('লেবার') ||
    t.includes('সর্দার') ||
    t.includes('হাজিরা') ||
    t.includes('হাটবার') ||
    t.includes('দিনমজুর') ||
    t.includes('labor') ||
    t.includes('labour') ||
    t.includes('worker') ||
    t.includes('sordar')
  )
    return 'শ্রমিক ও সর্দার পেমেন্ট';
  if (
    t.includes('বিদ্যুৎ') ||
    t.includes('কারেন্ট') ||
    t.includes('জ্বালানি') ||
    t.includes('কাঠ') ||
    t.includes('current') ||
    t.includes('electric')
  )
    return 'বিদ্যুৎ ও জ্বালানি';
  if (t.includes('অফিস') || t.includes('নাস্তা') || t.includes('আপ্যায়ন') || t.includes('চা') || t.includes('office'))
    return 'অফিস ও আপ্যায়ন';
  return null;
}

export function parseBanglaAgentIntent(
  userText: string,
  context: Record<string, unknown>
): {
  intent: string;
  conversationalType?: 'GREETING' | 'THANKS' | 'CAPABILITIES' | 'BRICK_RATES' | 'GENERAL';
  summaryMode?: 'AUTO' | 'TOTAL' | 'LIST';
  category?: string;
  amount?: number;
  quantity?: number;
  rate?: number;
  paidAmount?: number;
  customerName?: string;
  workerName?: string;
  memoNo?: string;
  query?: string;
  gradeId?: string;
  noteText?: string;
  targetTab?: string;
  uiAction?: SystemUiAction;
  dateScope?: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'SEASON';
} {
  const trimmed = userText.trim();
  const normalized = parseBanglaDigits(trimmed);
  const lower = normalized.toLowerCase();
  const cleanWords = lower.replace(/[।?!,.]/g, '').trim();

  // 1. Explicit or contextual Confirmation ("হ্যাঁ", "কনফার্ম করো", "এবার সেটা সেভ করো", "ওটা সেভ করে দাও", "হ্যাঁ করে দাও")
  if (
    /^(হ্যাঁ|হ্যা|হাঁ|জি|জ্বী|কনফার্ম|কনফার্ম করো|অনুমোদন|অনুমোদন করো|নিশ্চিত|নিশ্চিত করো|ঠিক আছে|হ্যাঁ ঠিক আছে|হ্যাঁ করো|হ্যাঁ করে দাও|হ্যাঁ সেভ করো|এবার সেটা সেভ করো|এবার সেভ করো|ওটা সেভ করো|ওটা সেভ করে দাও|সেটা সেভ করো|সেভ করো|সেভ করে দাও|করে দাও|পাকা করো|yes|confirm|ok|okay|save it|ha|haan|ji)$/i.test(
      cleanWords
    ) ||
    cleanWords.includes('এবার সেটা সেভ কর') ||
    cleanWords.includes('ওটা সেভ কর') ||
    cleanWords.includes('সেটা সেভ কর') ||
    cleanWords.includes('হ্যাঁ কনফার্ম') ||
    cleanWords.includes('হ্যাঁ সেভ')
  ) {
    return { intent: 'CONFIRM_ACTION' };
  }

  // 1b. Explicit or contextual Cancellation ("না", "থাক", "বাতিল করো", "বাদ দাও")
  if (
    /^(না|নাহ|থাক|এখন থাক|বাতিল|বাতিল করো|ক্যানসেল|ক্যান্সেল|বাদ দাও|দরকার নেই|লাগবে না|no|cancel|bad dao)$/i.test(
      cleanWords
    ) ||
    cleanWords === 'বাতিল করো' ||
    cleanWords === 'বাতিল' ||
    cleanWords === 'বাদ দাও'
  ) {
    return { intent: 'CANCEL_ACTION' };
  }

  // 2. Multi-turn follow-up check: if pendingExpenseAmount exists
  if (context.pendingExpenseAmount && Number(context.pendingExpenseAmount) > 0) {
    const detectedCat = detectExpenseCategory(normalized);
    if (detectedCat && !normalized.includes('মেমো') && !normalized.includes('বিক্রি')) {
      return {
        intent: 'create_expense',
        category: detectedCat,
        amount: Number(context.pendingExpenseAmount),
      };
    }
  }

  // 2b. Multi-turn follow-up check: if pendingPaymentData exists
  const pendingPayment = context.pendingPaymentData as
    | { customerNameOrMemoNo?: string; amount?: number }
    | undefined;
  if (pendingPayment && (pendingPayment.customerNameOrMemoNo || pendingPayment.amount)) {
    const extractedAmt = extractBanglaAmount(normalized) || pendingPayment.amount;
    if (extractedAmt && pendingPayment.customerNameOrMemoNo) {
      return {
        intent: 'record_payment',
        amount: extractedAmt,
        customerName: pendingPayment.customerNameOrMemoNo,
      };
    }
  }

  // 2c. Multi-turn follow-up check: if pendingMemoData exists
  const pendingMemo = context.pendingMemoData as
    | {
        customerName?: string;
        quantity?: number;
        rate?: number;
        paidAmount?: number;
        gradeId?: string;
      }
    | undefined;

  if (
    pendingMemo &&
    !normalized.includes('খরচ') &&
    !normalized.includes('বিক্রয় কত') &&
    !normalized.includes('বাকি আছে') &&
    !normalized.includes('বাকি কত') &&
    !normalized.includes('খুঁজে বের') &&
    !normalized.includes('নোট')
  ) {
    const qtyMatch = normalized.match(/(\d+)\s*(?:পিস|ইট|টি|piece|brick)/i);
    const hazarQtyMatch = normalized.match(/(\d+)\s*(?:হাজার|hazar|thousand)\s*(?:পিস|ইট)?/i);
    const extractedQty = qtyMatch
      ? parseInt(qtyMatch[1], 10)
      : hazarQtyMatch
      ? parseInt(hazarQtyMatch[1], 10) * 1000
      : extractBanglaAmount(normalized) && !pendingMemo.quantity && pendingMemo.customerName
      ? extractBanglaAmount(normalized) || undefined
      : pendingMemo.quantity;

    const rateMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:দর|রেট|টাকা দরে|rate)/i);
    const paidMatch = normalized.match(/(\d+)\s*(?:জমা|নগদ|paid|joma)/i);

    let extractedCust = pendingMemo.customerName;
    if (!extractedCust) {
      const cleanedName = normalized
        .replace(/(\d+(?:\.\d+)?|পিস|ইট|টি|হাজার|১ নং|২ নং|1 নং|2 নং|দর|রেট|জমা|টাকা|,|-)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanedName.length >= 2) {
        extractedCust = cleanedName;
      }
    }

    if (extractedCust || extractedQty) {
      return {
        intent: 'create_sales_memo',
        customerName: extractedCust,
        quantity: extractedQty,
        rate: rateMatch ? parseFloat(rateMatch[1]) : pendingMemo.rate,
        paidAmount: paidMatch ? parseInt(paidMatch[1], 10) : pendingMemo.paidAmount,
        gradeId: normalized.includes('2 নং') ? 'grade-2' : pendingMemo.gradeId || 'grade-1',
      };
    }
  }

  // 3. Contextual reference to "ওই মেমোটা" / "এই মেমোটা" / "সেই মেমোটা" / "আগের মেমোটা"
  const ctxLastMemo = String(context.lastMemoNo || context.lastReferencedMemoNo || '');
  const ctxLastCustomer = String(context.lastCustomerName || context.lastReferencedCustomer || '');

  if (
    (normalized.includes('ওই মেমো') ||
      normalized.includes('এই মেমো') ||
      normalized.includes('সেই মেমো') ||
      normalized.includes('আগের মেমো') ||
      lower.includes('oi memo')) &&
    !normalized.includes('জমা') &&
    !normalized.includes('আদায়') &&
    !lower.includes('joma')
  ) {
    const refMemo = ctxLastMemo || ctxLastCustomer || '125';
    return {
      intent: 'search_memo',
      query: refMemo,
      memoNo: refMemo,
    };
  }

  // 3b. Search Memo (e.g. "মেমো ১২৫ খুঁজে বের করো", "মেমো ১০২", "১২৫ নম্বর মেমো", "memo 125")
  if (
    !normalized.includes('প্রিন্ট') &&
    !lower.includes('print') &&
    !normalized.includes('ডিলিট') &&
    !normalized.includes('মুছে') &&
    !lower.includes('delete') &&
    (normalized.includes('মেমো খুঁজ') ||
      normalized.includes('মেমো খুঁজে') ||
      normalized.includes('মেমো বের কর') ||
      normalized.includes('মেমো দেখাও') ||
      normalized.includes('মেমো নম্বর') ||
      normalized.includes('মেমো নং') ||
      /(?:মেমো|memo)\s*(?:নং|no|number)?\s*(\d+|[a-zA-Z0-9-]+)/i.test(normalized) ||
      /(?:(\d+|[a-zA-Z0-9-]+)\s*(?:নং|নম্বর)\s*(?:মেমো|memo))/i.test(normalized))
  ) {
    const memoMatch =
      normalized.match(/(?:মেমো|memo)\s*(?:নং|নম্বর|no|number)?\s*[:：-]?\s*(bf-[0-9-]+|\d+)/i) ||
      normalized.match(/(bf-[0-9-]+|\d+)\s*(?:নং|নম্বর)\s*(?:মেমো|টা)?/i);
    let query = memoMatch ? memoMatch[1] : '';
    if (!query) {
      query = normalized
        .replace(/(?:মেমো|memo|খুঁজো?|খুঁজে|বের|করো?|দেখাও|নম্বর|নং|এর|সাহেবের|সাহেব|[।?!,:])/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return {
      intent: 'search_memo',
      query: query || trimmed,
      memoNo: query || trimmed,
    };
  }

  // 4. Customer balance / due query (including contextual "রহিমের কত টাকা বাকি?", "তার বাকি কত?", "rahim er koto baki")
  const isTotalFollowUp =
    (normalized.includes('সব মিলিয়ে') ||
      normalized.includes('সব মিলিয়ে') ||
      normalized.includes('মোট বকেয়া') ||
      normalized.includes('মোট বাকি') ||
      normalized.includes('সবগুলো মিলিয়ে') ||
      lower.includes('sob miliye')) &&
    Boolean(ctxLastCustomer);

  if (
    isTotalFollowUp ||
    ((normalized.includes('বাকি') ||
      normalized.includes('পাওনা') ||
      normalized.includes('বকেয়া') ||
      normalized.includes('বকেয়া') ||
      lower.includes('baki') ||
      lower.includes('due') ||
      lower.includes('paona')) &&
      !normalized.includes('জমা কর') &&
      !normalized.includes('জমা লিখ') &&
      !normalized.includes('জমা দাও') &&
      !normalized.includes('বাকি আদায়') &&
      !normalized.includes('মেমো কর') &&
      !normalized.includes('মেমো তৈরি') &&
      !normalized.includes('ফিল্টার') &&
      !normalized.includes('মেমোগুলো দেখাও') &&
      !normalized.includes('তালিকা') &&
      !normalized.includes('রিপোর্ট খোল') &&
      !lower.includes('filter') &&
      !lower.includes('joma'))
  ) {
    const isGlobalTotalDue =
      (cleanWords === 'মোট পাওনা কত' ||
        cleanWords === 'মোট বকেয়া কত' ||
        cleanWords === 'বাজারে মোট পাওনা কত' ||
        cleanWords === 'মোট কত টাকা পাওনা আছে' ||
        cleanWords === 'mot baki koto' ||
        cleanWords === 'total due koto') &&
      !normalized.includes('তার') &&
      !normalized.includes('ওনার') &&
      !normalized.includes('সব মিলিয়ে');

    if (isGlobalTotalDue) {
      return { intent: 'get_dashboard_metrics' };
    }

    const isPronounCustomer =
      normalized.includes('তার ') ||
      normalized.startsWith('তার') ||
      normalized.includes('ওনার') ||
      normalized.includes('উনার') ||
      normalized.includes('ওই কাস্টমার') ||
      normalized.includes('ওই ক্রেতা') ||
      normalized.includes('এই ক্রেতা') ||
      normalized.includes('আগের ক্রেতা') ||
      lower.includes('tar baki') ||
      lower.includes('onar baki') ||
      isTotalFollowUp;

    let customer = '';
    if (isPronounCustomer && ctxLastCustomer) {
      customer = ctxLastCustomer;
    } else {
      const stopWords = new Set([
        'কত',
        'টাকা',
        'বাকি',
        'পাওনা',
        'বকেয়া',
        'বকেয়া',
        'বকেয়াটাও',
        'বকেয়াটাও',
        'বকেয়াটা',
        'বকেয়াটা',
        'আছে',
        'বলো',
        'বলে',
        'দাও',
        'দিতে',
        'পারো',
        'জানাও',
        'দেখাও',
        'হিসাব',
        'নামে',
        'কাছে',
        'মোট',
        'সব',
        'মিলিয়ে',
        'মিলিয়ে',
        'এখন',
        'বর্তমানে',
        'ওনার',
        'তার',
        'উনার',
        'koto',
        'taka',
        'baki',
        'due',
        'paona',
        'ache',
        'er',
        'bolo',
      ]);
      const rawTokens = trimmed
        .replace(/[।?!,:]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/(?:-এর|ের|এর|দের|টাও|টা)$/i, '').trim())
        .filter((w) => w.length > 0 && !stopWords.has(w.toLowerCase()));

      customer = rawTokens
        .filter((w) => !['সাহেব', 'সাহেবের', 'বাবু', 'বাবুর', 'হাজী', 'মেসার্স'].includes(w))
        .join(' ')
        .trim();
      if (!customer && rawTokens.length > 0) {
        customer = rawTokens[0];
      }
      if (customer.toLowerCase() === 'rahim') customer = 'রহিম';
      if (customer.toLowerCase() === 'karim' || customer.toLowerCase() === 'korim') customer = 'করিম';
      if (customer.toLowerCase() === 'mannan') customer = 'মান্নান';
    }

    return {
      intent: 'get_customer_balance',
      customerName: customer || ctxLastCustomer || 'রহিম',
      summaryMode: isTotalFollowUp ? 'TOTAL' : 'AUTO',
    };
  }

  // 5. Record Payment / Collect Customer Due (e.g. "এই ক্রেতার মেমোতে দশ হাজার টাকা জমা করো", "তার মেমোতে ৫০০০ টাকা জমা দাও")
  if (
    (normalized.includes('জমা কর') ||
      normalized.includes('জমা লিখ') ||
      normalized.includes('জমা দাও') ||
      normalized.includes('জমা লেখ') ||
      normalized.includes('বাকি আদায়') ||
      normalized.includes('পেমেন্ট রেকর্ড') ||
      normalized.includes('টাকা জমা') ||
      lower.includes('joma koro') ||
      lower.includes('joma dao') ||
      lower.includes('payment')) &&
    !normalized.includes('খরচ') &&
    !normalized.includes('নতুন মেমো')
  ) {
    const amount = extractBanglaAmount(normalized) || undefined;
    const custMatch =
      trimmed.match(/(?:ক্রেতা|কাস্টমার|নাম(?!ে))\s+([^\d,]+)/i) ||
      trimmed.match(/([^\s,]+)(?:-এর|ের|এর)\s+(?:মেমোতে|নামে)/i);

    const hasPronounRef =
      normalized.includes('এই ক্রেতা') ||
      normalized.includes('ওই ক্রেতা') ||
      normalized.includes('এই মেমো') ||
      normalized.includes('ওই মেমো') ||
      normalized.includes('তার ') ||
      normalized.includes('ওনার ') ||
      normalized.startsWith('তার') ||
      normalized.startsWith('ওনার') ||
      lower.includes('oi memo') ||
      lower.includes('tar memo');

    let customerName = custMatch ? custMatch[1].trim() : undefined;
    if (
      customerName &&
      ['এই', 'ওই', 'সেই', 'তার', 'ওনার', 'উনার', 'ক্রেতার', 'কাস্টমারের'].includes(customerName)
    ) {
      customerName = undefined;
    }
    if (!customerName && hasPronounRef) {
      customerName = ctxLastCustomer || ctxLastMemo;
    }

    return {
      intent: 'record_payment',
      amount: amount || 10000,
      customerName: customerName || String(context.lastReferencedCustomer || ''),
      memoNo: String(context.lastReferencedMemoNo || ''),
    };
  }

  // 6. Notes — Search vs Create
  if (
    normalized.includes('নোট খুঁজ') ||
    normalized.includes('নোট দেখাও') ||
    normalized.includes('কী কী নোট') ||
    normalized.includes('কি কি নোট') ||
    normalized.includes('রিমাইন্ডার দেখাও') ||
    lower.includes('search note') ||
    lower.includes('show note')
  ) {
    const q = trimmed
      .replace(
        /(?:নোট\s*খুঁজো?|নোট\s*দেখাও|কী\s*কী\s*নোট\s*আছে|কি\s*কি\s*নোট\s*আছে|রিমাইন্ডার\s*দেখাও|search\s*notes?|show\s*notes?)/gi,
        ''
      )
      .trim();
    return {
      intent: 'search_notes',
      query: q || undefined,
    };
  }

  if (
    normalized.includes('নোট') ||
    normalized.includes('রিমাইন্ডার লেখ') ||
    normalized.includes('মনে করিয়ে দিও') ||
    lower.startsWith('note') ||
    lower.includes('note:')
  ) {
    const cleaned = trimmed
      .replace(
        /^(?:একটা\s*নোট\s*লিখ(?:ে\s*রাখো?|ুন)?[:：,-]?\s*|নোট\s*[:：,-]?\s*|নোট\s+লেখো?\s*[:：,-]?\s*|নোট\s+সেভ\s+করো?\s*[:：,-]?\s*|note\s*:\s*)/i,
        ''
      )
      .trim();
    return {
      intent: 'create_note',
      noteText: cleaned || trimmed,
    };
  }

  // 7. Create Sales Memo (e.g. "একটা নতুন মেমো তৈরি করো", "রহিমের নামে ৫ হাজার ইটের মেমো করো", "মেমো করো ৫০০০ ইট ১৩.৫ দর ৩০০০০ জমা")
  if (
    normalized.includes('মেমো কর') ||
    normalized.includes('মেমো লেখ') ||
    normalized.includes('নতুন মেমো') ||
    normalized.includes('মেমো তৈরি') ||
    normalized.includes('মেমো বানাও') ||
    normalized.includes('মেমো কাট') ||
    normalized.includes('মেমো দে') ||
    lower.includes('memo koro') ||
    lower.includes('notun memo') ||
    lower.includes('new memo')
  ) {
    const qtyMatch = normalized.match(/(\d+)\s*(?:পিস|ইট|টি|piece|it)/i);
    const hazarMatch = normalized.match(/(\d+)\s*(?:হাজার|hazar|thousand)\s*(?:পিস|ইট|ইটের)?/i);
    const wordHazarQty = extractBanglaAmount(normalized);
    const rateMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:দর|রেট|টাকা দরে|rate)/i);
    const paidMatch = normalized.match(/(\d+)\s*(?:জমা|নগদ|joma)/i);
    const qty = qtyMatch
      ? parseInt(qtyMatch[1], 10)
      : hazarMatch
      ? parseInt(hazarMatch[1], 10) * 1000
      : wordHazarQty && wordHazarQty >= 500
      ? wordHazarQty
      : undefined;
    const rate = rateMatch ? parseFloat(rateMatch[1]) : undefined;
    const paidAmount = paidMatch ? parseInt(paidMatch[1], 10) : undefined;

    const custMatch =
      trimmed.match(/([^\s,]+(?:\s+সাহেব)?)(?:-এর|ের|এর)?\s+নামে/i) ||
      trimmed.match(/(?:কাস্টমার|ক্রেতা|নাম(?!ে))\s*[:：-]?\s*([^\d,]+)/i) ||
      trimmed.match(/^([^\s,]+(?:\s+সাহেব)?)(?:-এর|ের|এর)\s+(?:একটা\s*)?(?:নতুন\s*)?(?:\d+\s*হাজার\s*)?মেমো/i);
    const cleanedCust = custMatch
      ? custMatch[1]
          .replace(/(?:-এর|ের|এর)$/i, '')
          .trim()
      : undefined;
    return {
      intent: 'create_sales_memo',
      quantity: qty,
      rate,
      paidAmount,
      customerName: cleanedCust,
      gradeId: normalized.includes('2 নং') ? 'grade-2' : 'grade-1',
    };
  }

  // 8. Create Expense (e.g. "আজ পাঁচ হাজার টাকার কয়লার খরচ যোগ করো", "কয়লা বাবদ ৫০০০ টাকা খরচ")
  if (
    normalized.includes('খরচ লেখ') ||
    normalized.includes('খরচ লিখ') ||
    normalized.includes('খরচ যোগ') ||
    normalized.includes('খরচ তুল') ||
    normalized.includes('খরচ তোল') ||
    lower.includes('khoroch') ||
    lower.includes('expense') ||
    (normalized.includes('বাবদ') && (normalized.includes('খরচ') || normalized.includes('টাকা'))) ||
    (detectExpenseCategory(normalized) &&
      extractBanglaAmount(normalized) &&
      (normalized.includes('খরচ') || normalized.includes('দিলাম') || normalized.includes('দাও')))
  ) {
    const amount = extractBanglaAmount(normalized);
    const category = detectExpenseCategory(normalized);
    if (amount && !category && !normalized.includes('কত')) {
      return {
        intent: 'ASK_EXPENSE_CATEGORY',
        amount,
      };
    }
    if (amount && category) {
      return {
        intent: 'create_expense',
        amount,
        category,
      };
    }
  }

  // 9. Brick Rates Query (e.g. "ইটের দর কত?", "কোন ইটের দাম কত?", "১ নং ইটের রেট কত?")
  if (
    (normalized.includes('ইটের দর') ||
      normalized.includes('ইটের রেট') ||
      normalized.includes('ইটের দাম') ||
      normalized.includes('কোন ইটের কত দাম') ||
      normalized.includes('রেট কত') ||
      lower.includes('rate koto') ||
      lower.includes('dam koto')) &&
    !normalized.includes('মেমো কর')
  ) {
    return { intent: 'CONVERSATIONAL', conversationalType: 'BRICK_RATES' };
  }

  // 10. Stock query (e.g. "স্টক কত আছে", "ইট স্টক কত", "কত ইট মজুত আছে")
  if (
    !normalized.includes('যোগ') &&
    !normalized.includes('বাড়াও') &&
    !lower.includes('add') &&
    !lower.includes('jog') &&
    (normalized.includes('স্টক') ||
      normalized.includes('স্টকে') ||
      normalized.includes('মজুত') ||
      lower.includes('stock') ||
      lower.includes('mojut'))
  ) {
    return { intent: 'check_stock' };
  }

  // 11. Recent Transactions query (e.g. "সাম্প্রতিক লেনদেন", "শেষ লেনদেনগুলো বলো")
  if (
    normalized.includes('সাম্প্রতিক লেনদেন') ||
    normalized.includes('শেষ লেনদেন') ||
    normalized.includes('ট্রানজ্যাকশন') ||
    lower.includes('transaction')
  ) {
    return { intent: 'get_recent_transactions' };
  }

  // 12. Expense Summary (e.g. "আজকের খরচ কত?", "মোট খরচ কত", "আর খরচের কী অবস্থা?")
  if (
    normalized.includes('খরচ কত') ||
    normalized.includes('খরচের হিসাব') ||
    normalized.includes('খরচের সারসংক্ষেপ') ||
    normalized.includes('খরচের কী অবস্থা') ||
    normalized.includes('খরচের কি অবস্থা') ||
    normalized.includes('কত খরচ হয়েছে') ||
    normalized.includes('কত খরচ হয়েছে') ||
    lower.includes('khoroch koto')
  ) {
    return {
      intent: 'get_expense_summary',
      category: detectExpenseCategory(normalized) || undefined,
      dateScope: normalized.includes('গতকাল') || lower.includes('kalke')
        ? 'YESTERDAY'
        : normalized.includes('সাত')
        ? 'LAST_7_DAYS'
        : (context.lastDateScope as 'TODAY' | 'YESTERDAY' | undefined) || 'TODAY',
    };
  }

  // 13. Contextual "আগের হিসাবটা" / "আর গতকাল?" / "গতকালেরটা বলো"
  if (
    normalized.includes('আগের হিসাব') ||
    normalized.includes('গতকাল') ||
    lower.includes('yesterday') ||
    lower.includes('kalke')
  ) {
    if (context.lastTopic === 'EXPENSE') {
      return { intent: 'get_expense_summary', dateScope: 'YESTERDAY' };
    }
    return { intent: 'get_sales_summary', dateScope: 'YESTERDAY' };
  }

  // 14. Comprehensive E-Commerce & Business Analysis (Alipro style deep analysis)
  if (
    normalized.includes('অ্যানালাইসিস') ||
    normalized.includes('এনালাইসিস') ||
    normalized.includes('অ্যানালাইজ') ||
    normalized.includes('বিশ্লেষণ') ||
    normalized.includes('লাভ ক্ষতি') ||
    normalized.includes('লাভ-ক্ষতি') ||
    normalized.includes('লাভের রিপোর্ট') ||
    normalized.includes('ব্যবসার অবস্থা') ||
    normalized.includes('ব্যবসার রিপোর্ট') ||
    normalized.includes('পুরো রিপোর্ট') ||
    normalized.includes('সব রিপোর্ট') ||
    normalized.includes('গ্রোথ') ||
    normalized.includes('মার্জিন') ||
    normalized.includes('কোন ইট বেশি') ||
    normalized.includes('সেরা ক্রেতা') ||
    normalized.includes('টপ কাস্টমার') ||
    lower.includes('analysis') ||
    lower.includes('analisess') ||
    lower.includes('analyze') ||
    lower.includes('alipro') ||
    lower.includes('ecommerce') ||
    lower.includes('profit') ||
    lower.includes('growth') ||
    lower.includes('lav') ||
    lower.includes('bebsa')
  ) {
    return { intent: 'analyze_business' };
  }

  // 14b. Date Range Profit / Overall Report / Sales Queries
  if (
    normalized.includes('সাত দিন') ||
    normalized.includes('৭ দিন') ||
    normalized.includes('মাসের রিপোর্ট') ||
    normalized.includes('সিজনের হিসাব')
  ) {
    return {
      intent: 'get_sales_summary',
      dateScope: normalized.includes('সাত') || normalized.includes('৭') ? 'LAST_7_DAYS' : 'SEASON',
    };
  }

  // 15. Full System / PC / UI Voice Control (Print, Scroll, Fullscreen, Backup, Modals, Stock/Rate Updates, Worker Attendance, Delete)
  // 15a. Print Memo or Page ("মেমো ১২৫ প্রিন্ট করো", "গেট পাস প্রিন্ট দাও", "print memo 125", "print koro")
  if (
    normalized.includes('প্রিন্ট') ||
    normalized.includes('গেট পাস') ||
    lower.includes('print') ||
    lower.includes('gate pass')
  ) {
    const memoMatch =
      normalized.match(/(?:মেমো|memo)\s*(?:নং|নম্বর|no|number)?\s*[:：-]?\s*(bf-[0-9-]+|\d+)/i) ||
      normalized.match(/(bf-[0-9-]+|\d+)\s*(?:নং|নম্বর)?\s*(?:মেমো|memo)/i) ||
      normalized.match(/(\d{3,4})/);
    const targetMemoNo = memoMatch
      ? memoMatch[1]
      : String(context.lastReferencedMemoNo || '125');
    return {
      intent: 'control_system_ui',
      memoNo: targetMemoNo,
      uiAction: {
        type: 'PRINT_MEMO',
        memoNo: targetMemoNo,
      },
    };
  }

  // 15b. Scroll / Screen / Fullscreen / Backup / Modal Control
  if (
    normalized.includes('নিচে নামাও') ||
    normalized.includes('নিচে যাও') ||
    normalized.includes('স্ক্রল ডাউন') ||
    lower.includes('scroll down') ||
    lower.includes('niche namo') ||
    lower.includes('niche jao')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: { type: 'SCROLL_DOWN' },
    };
  }

  if (
    normalized.includes('উপরে ওঠাও') ||
    normalized.includes('উপরে যাও') ||
    normalized.includes('স্ক্রল আপ') ||
    lower.includes('scroll up') ||
    lower.includes('scroll top') ||
    lower.includes('upore jao') ||
    lower.includes('upore uthao')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: { type: 'SCROLL_UP' },
    };
  }

  if (
    normalized.includes('ফুলস্ক্রিন') ||
    normalized.includes('ফুল স্ক্রিন') ||
    normalized.includes('বড় পর্দা') ||
    lower.includes('fullscreen') ||
    lower.includes('full screen')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: { type: 'FULLSCREEN_TOGGLE' },
    };
  }

  if (
    normalized.includes('ব্যাকআপ ডাউনলোড') ||
    normalized.includes('ব্যাকআপ নাও') ||
    normalized.includes('ডাটাবেস ব্যাকআপ') ||
    normalized.includes('ডাটাবেস ডাউনলোড') ||
    lower.includes('backup download') ||
    lower.includes('export backup') ||
    lower.includes('backup nao')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: { type: 'EXPORT_BACKUP' },
    };
  }

  if (
    normalized.includes('মোডাল বন্ধ') ||
    normalized.includes('পপআপ বন্ধ') ||
    lower.includes('close modal') ||
    lower.includes('close popup')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: { type: 'CLOSE_MODAL' },
    };
  }

  // 15c. Add Brick Stock or Update Brick Rate by Voice ("১০ হাজার ১ নং ইট স্টকে যোগ করো", "১ নং ইটের রেট ১৪ টাকা করো")
  if (
    normalized.includes('স্টকে যোগ') ||
    normalized.includes('স্টক যোগ') ||
    normalized.includes('স্টক বাড়াও') ||
    normalized.includes('নতুন ইট যোগ') ||
    normalized.includes('রেট পরিবর্তন') ||
    normalized.includes('দর পরিবর্তন') ||
    normalized.includes('রেট সেট কর') ||
    lower.includes('stock add') ||
    lower.includes('add stock') ||
    lower.includes('stock jog') ||
    lower.includes('rate change')
  ) {
    const qty = extractBanglaAmount(normalized) || 10000;
    const rateMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:টাকা|দর|রেট|rate)/i);
    const gradeId = normalized.includes('2 নং') || lower.includes('2 no')
      ? 'grade-2'
      : normalized.includes('3 নং') || lower.includes('3 no')
      ? 'grade-3'
      : normalized.includes('পিকেট') || lower.includes('picket')
      ? 'grade-picket'
      : normalized.includes('গড়িয়া') || lower.includes('goria')
      ? 'grade-goria'
      : 'grade-1';
    return {
      intent: 'update_brick_stock_or_rate',
      gradeId,
      quantity: normalized.includes('রেট') && !normalized.includes('স্টক') ? 0 : qty,
      rate: rateMatch ? parseFloat(rateMatch[1]) : undefined,
    };
  }

  // 15d. Worker Attendance by Voice ("রফিকুল সর্দারের হাজিরা দাও", "হাজিরা দাও")
  if (
    normalized.includes('হাজিরা দাও') ||
    normalized.includes('হাজিরা লেখ') ||
    normalized.includes('হাজিরা কর') ||
    lower.includes('hajira dao') ||
    lower.includes('attendance')
  ) {
    const hatbar = extractBanglaAmount(normalized) || 0;
    let workerName = 'রফিকুল সর্দার';
    if (normalized.includes('জব্বার') || lower.includes('jobbar')) workerName = 'আব্দুল জব্বার';
    else if (normalized.includes('হাসান') || lower.includes('hasan')) workerName = 'হাসান আলী';
    else if (normalized.includes('সোহেল') || lower.includes('sohel')) workerName = 'সোহেল রানা';
    else if (normalized.includes('কবির') || lower.includes('kobir')) workerName = 'কবির হোসেন';
    return {
      intent: 'record_worker_attendance',
      workerName,
      amount: hatbar,
    };
  }

  // 15e. Delete Memo by Voice ("মেমো ১২৫ ডিলিট করো", "শেষ মেমোটা মুছে ফেলো")
  if (
    normalized.includes('মেমো ডিলিট') ||
    normalized.includes('মেমো মুছে') ||
    normalized.includes('শেষ মেমোটা ডিলিট') ||
    lower.includes('delete memo') ||
    lower.includes('memo delete')
  ) {
    const memoMatch = normalized.match(/(bf-[0-9-]+|\d{3,4})/i);
    return {
      intent: 'delete_record',
      memoNo: memoMatch ? memoMatch[1] : String(context.lastReferencedMemoNo || ''),
    };
  }

  // 15f. Live KPI Report Modal Control ("মোট বিক্রির রিপোর্ট খোলো", "বিক্রয় চার্ট রিপোর্ট", "বকেয়া রিপোর্ট খোলো")
  if (
    normalized.includes('বিক্রির রিপোর্ট খোল') ||
    normalized.includes('বিক্রয় রিপোর্ট খোল') ||
    normalized.includes('বিক্রয় চার্ট রিপোর্ট') ||
    normalized.includes('বিক্রির চার্ট খোল') ||
    lower.includes('sales chart report') ||
    lower.includes('open sales report')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: {
        type: 'OPEN_KPI_MODAL',
        kpiId: 'TOTAL_BRICKS_SOLD',
        labelBn: 'মোট ইট বিক্রয় ও চার্ট রিপোর্ট ওপেন করা হয়েছে',
      },
    };
  }

  if (
    normalized.includes('বকেয়া রিপোর্ট খোল') ||
    normalized.includes('পাওনা রিপোর্ট খোল') ||
    lower.includes('open due report')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: {
        type: 'OPEN_KPI_MODAL',
        kpiId: 'TOTAL_DUE',
        labelBn: 'বকেয়া পাওনা বিস্তারিত রিপোর্ট ওপেন করা হয়েছে',
      },
    };
  }

  if (
    normalized.includes('খরচের চার্ট খোল') ||
    normalized.includes('খরচের রিপোর্ট খোল') ||
    lower.includes('open expense report')
  ) {
    return {
      intent: 'control_system_ui',
      uiAction: {
        type: 'OPEN_KPI_MODAL',
        kpiId: 'TOTAL_EXPENSE',
        labelBn: 'মোট খরচের খতিয়ান রিপোর্ট ওপেন করা হয়েছে',
      },
    };
  }

  // 15g. Live Table Filter & Search Control on Web UI ("বকেয়া মেমোগুলো দেখাও", "বকেয়া মেমো ফিল্টার", "খরচের তালিকা দেখাও")
  if (
    normalized.includes('বকেয়া মেমো ফিল্টার') ||
    normalized.includes('বকেয়া মেমোগুলো দেখাও') ||
    normalized.includes('বাকি মেমোগুলো দেখাও') ||
    lower.includes('filter due memo') ||
    lower.includes('baki memo dekhao')
  ) {
    return {
      intent: 'control_system_ui',
      targetTab: 'memos',
      uiAction: {
        type: 'FILTER_MEMOS',
        tab: 'memos',
        memoStatusFilter: 'DUE',
        searchQuery: '',
        labelBn: 'মেমো খতিয়ানে শুধু বকেয়া (DUE) মেমোগুলো ফিল্টার করা হয়েছে',
      },
    };
  }

  if (
    normalized.includes('পরিশোধিত মেমো দেখাও') ||
    normalized.includes('পেইড মেমো ফিল্টার') ||
    lower.includes('paid memo dekhao')
  ) {
    return {
      intent: 'control_system_ui',
      targetTab: 'memos',
      uiAction: {
        type: 'FILTER_MEMOS',
        tab: 'memos',
        memoStatusFilter: 'PAID',
        searchQuery: '',
        labelBn: 'মেমো খতিয়ানে পরিশোধিত (PAID) মেমোগুলো ফিল্টার করা হয়েছে',
      },
    };
  }

  if (
    normalized.includes('খরচের তালিকা দেখাও') ||
    normalized.includes('শুধু খরচ দেখাও') ||
    normalized.includes('ক্যাশ বুকে খরচ ফিল্টার') ||
    lower.includes('expense list dekhao') ||
    lower.includes('khorocher talika')
  ) {
    const cat = detectExpenseCategory(normalized) || 'ALL';
    return {
      intent: 'control_system_ui',
      targetTab: 'cashbook',
      uiAction: {
        type: 'FILTER_CASHBOOK',
        tab: 'cashbook',
        cashTypeFilter: 'OUT',
        cashCategoryFilter: cat,
        labelBn: 'ক্যাশ বুকে খরচের (OUT) লেনদেনগুলো ফিল্টার করা হয়েছে',
      },
    };
  }

  if (
    normalized.includes('জমার তালিকা দেখাও') ||
    normalized.includes('শুধু জমা দেখাও') ||
    lower.includes('cash in list')
  ) {
    return {
      intent: 'control_system_ui',
      targetTab: 'cashbook',
      uiAction: {
        type: 'FILTER_CASHBOOK',
        tab: 'cashbook',
        cashTypeFilter: 'IN',
        cashCategoryFilter: 'ALL',
        labelBn: 'ক্যাশ বুকে নগদ জমার (IN) লেনদেনগুলো ফিল্টার করা হয়েছে',
      },
    };
  }

  if (
    normalized.includes('মেমো ফর্ম ক্লিয়ার') ||
    normalized.includes('ফর্ম ক্লিয়ার') ||
    normalized.includes('ফর্ম পরিষ্কার') ||
    normalized.includes('ফর্ম রিসেট') ||
    lower.includes('clear form') ||
    lower.includes('reset form')
  ) {
    return {
      intent: 'control_system_ui',
      targetTab: 'dashboard',
      uiAction: {
        type: 'CLEAR_MEMO_FORM',
        tab: 'dashboard',
        labelBn: 'ড্যাশবোর্ডের মেমো ফর্ম রিসেট করা হয়েছে',
      },
    };
  }

  // 15h. Opening Balance Update by Voice ("প্রারম্ভিক ক্যাশ ব্যালেন্স ৫ লাখ টাকা করো", "ওপেনিং ব্যালেন্স সেট করো")
  if (
    normalized.includes('প্রারম্ভিক ক্যাশ') ||
    normalized.includes('প্রারম্ভিক ব্যালেন্স') ||
    normalized.includes('ওপেনিং ব্যালেন্স') ||
    lower.includes('opening balance')
  ) {
    const amt = extractBanglaAmount(normalized);
    if (amt && amt > 0) {
      return {
        intent: 'update_opening_balance',
        amount: amt,
      };
    }
  }

  // 15i. Navigation & Tab Switching by Voice
  if (
    normalized.includes('লেবার') ||
    normalized.includes('দিনমজুর') ||
    lower.includes('labour') ||
    lower.includes('labor khata')
  ) {
    return {
      intent: 'navigate_to_tab',
      targetTab: 'labour',
      uiAction: { type: 'NAVIGATE_TAB', tab: 'labour', labelBn: 'লেবার খাতা ওপেন করা হয়েছে' },
    };
  }
  if (
    normalized.includes('ইটের রিপোর্ট') ||
    normalized.includes('স্টক রিপোর্ট') ||
    normalized.includes('ইট ও স্টক') ||
    lower.includes('brick report') ||
    lower.includes('stock report')
  ) {
    return {
      intent: 'navigate_to_tab',
      targetTab: 'bricks',
      uiAction: { type: 'NAVIGATE_TAB', tab: 'bricks', labelBn: 'ইট ও স্টক রিপোর্ট ওপেন করা হয়েছে' },
    };
  }
  if (
    normalized.includes('মেমো খতিয়ান') ||
    normalized.includes('মেমো তালিকা') ||
    normalized.includes('মেমো খাতা') ||
    lower.includes('memo khata') ||
    lower.includes('memo list') ||
    lower.includes('sales ledger')
  ) {
    return {
      intent: 'navigate_to_tab',
      targetTab: 'memos',
      uiAction: { type: 'NAVIGATE_TAB', tab: 'memos', labelBn: 'মেমো খতিয়ান ওপেন করা হয়েছে' },
    };
  }
  if (
    normalized.includes('ক্যাশ বুক') ||
    normalized.includes('ক্যাশ খাতা') ||
    lower.includes('cashbook') ||
    lower.includes('cash book') ||
    lower.includes('cash khata')
  ) {
    return {
      intent: 'navigate_to_tab',
      targetTab: 'cashbook',
      uiAction: { type: 'NAVIGATE_TAB', tab: 'cashbook', labelBn: 'ক্যাশ বুক ওপেন করা হয়েছে' },
    };
  }
  if (
    normalized.includes('ড্যাশবোর্ডে যাও') ||
    normalized.includes('ড্যাশবোর্ড খোলো') ||
    normalized.includes('মেইন পেজ') ||
    normalized.includes('হোম পেজ') ||
    lower.includes('dashboard') ||
    lower.includes('home page')
  ) {
    return {
      intent: 'navigate_to_tab',
      targetTab: 'dashboard',
      uiAction: { type: 'NAVIGATE_TAB', tab: 'dashboard', labelBn: 'ড্যাশবোর্ড ওপেন করা হয়েছে' },
    };
  }

  // 16. Explicit Dashboard Metrics / Cash Balance query ("ক্যাশে কত টাকা আছে?", "হাতে কত টাকা আছে?")
  if (
    normalized.includes('ক্যাশ ব্যালেন্স') ||
    normalized.includes('বর্তমান ক্যাশ') ||
    normalized.includes('ক্যাশে কত') ||
    normalized.includes('হাতে কত টাকা') ||
    normalized.includes('ড্যাশবোর্ড মেট্রিক্স') ||
    normalized.includes('সার্বিক অবস্থা') ||
    lower.includes('cash') ||
    lower.includes('balance') ||
    lower.includes('dashboard metric')
  ) {
    return { intent: 'get_dashboard_metrics' };
  }

  // 17. Explicit Sales / Income-Expense Summary query ("আজকের মোট বিক্রয় কত?", "আজকের আয়-ব্যয়ের হিসাব বলো", "কত বিক্রি হয়েছে?")
  if (
    normalized.includes('বিক্রয়') ||
    normalized.includes('বিক্রি') ||
    normalized.includes('আয়-ব্যয়') ||
    normalized.includes('আয়-ব্যয়') ||
    normalized.includes('আজকের হিসাব') ||
    normalized.includes('হিসাব বলো') ||
    normalized.includes('আদায় কত') ||
    normalized.includes('আদায় কত') ||
    lower.includes('sales') ||
    lower.includes('bikri') ||
    lower.includes('hisab')
  ) {
    return { intent: 'get_sales_summary', dateScope: 'TODAY' };
  }

  // 18. Conversational Greetings, Thanks, Capabilities & General Chat (Think Before Using Tools!)
  if (
    /^(হ্যালো|হাই|সালাম|আসসালামু আলাইকুম|ওয়ালাইকুম আসসালাম|সুপ্রভাত|শুভ সকাল|শুভ সন্ধ্যা|কেমন আছো|কেমন আছেন|কি খবর|কী খবর|হ্যালো ভাই|hello|hi|hey|salam)$/i.test(
      cleanWords
    ) ||
    cleanWords.includes('কেমন আছ') ||
    cleanWords.includes('আসসালামু আলাইকুম') ||
    cleanWords.includes('কি খবর')
  ) {
    return { intent: 'CONVERSATIONAL', conversationalType: 'GREETING' };
  }

  if (
    cleanWords.includes('ধন্যবাদ') ||
    cleanWords.includes('থ্যাংক') ||
    cleanWords.includes('শুক্রিয়া') ||
    cleanWords.includes('বুঝেছি') ||
    cleanWords.includes('বুঝলাম') ||
    cleanWords.includes('অনেক ভালো') ||
    cleanWords.includes('দারুণ') ||
    lower.includes('thank')
  ) {
    return { intent: 'CONVERSATIONAL', conversationalType: 'THANKS' };
  }

  if (
    cleanWords.includes('কী করতে পারো') ||
    cleanWords.includes('কি করতে পারো') ||
    cleanWords.includes('কীভাবে সাহায্য') ||
    cleanWords.includes('কিভাবে সাহায্য') ||
    cleanWords.includes('তুমি কে') ||
    cleanWords.includes('তোমার কাজ কী') ||
    lower.includes('what can you do') ||
    lower.includes('help')
  ) {
    return { intent: 'CONVERSATIONAL', conversationalType: 'CAPABILITIES' };
  }

  // For any other general or conversational input that does NOT ask for sales/memos/expenses/writes,
  // classify as CONVERSATIONAL so we don't blindly dump dashboard metrics!
  return { intent: 'CONVERSATIONAL', conversationalType: 'GENERAL' };
}

/**
 * Computes an Alipro E-Commerce style deep business intelligence report
 * across sales velocity, collection efficiency, SKU/grade margin share,
 * customer concentration & due risk, expense drivers, and actionable growth advice.
 */
export function computeComprehensiveBusinessAnalysis(
  state: Pick<
    KilnDatabaseState,
    'settings' | 'brickGrades' | 'salesMemos' | 'cashTransactions'
  >,
  todayDate: string,
  yesterdayDate: string
): BusinessAnalysisReport {
  const metrics = calculateDashboardMetrics(state, todayDate, yesterdayDate);
  const gradeReport = computeBrickGradeReport(
    state.brickGrades || [],
    state.salesMemos || [],
    todayDate,
    yesterdayDate
  );

  const totalSalesRevenue = Math.max(0, metrics.totalBrickSalesAmountAllTime);
  const totalBricksSold = Math.max(0, metrics.totalBricksSoldAllTime);
  const totalMemoCount = (state.salesMemos || []).length;
  const averageOrderValue =
    totalMemoCount > 0 ? Math.round(totalSalesRevenue / totalMemoCount) : 0;

  const totalCashIn = Math.max(0, metrics.totalCashIn);
  const totalExpense = Math.max(0, metrics.totalExpense);
  const netOperatingCashflow = totalCashIn - totalExpense;
  const currentCashBalance = metrics.currentCashBalance;
  const totalCustomerDue = Math.max(0, metrics.totalCustomerDue);

  const collectionEfficiencyPct =
    totalSalesRevenue > 0
      ? Math.min(100, Math.round(((totalSalesRevenue - totalCustomerDue) / totalSalesRevenue) * 100))
      : 100;
  const dueRiskPct = Math.max(0, 100 - collectionEfficiencyPct);
  const expenseToSalesRatioPct =
    totalSalesRevenue > 0 ? Math.round((totalExpense / totalSalesRevenue) * 100) : 0;

  // Grade / SKU performance breakdown
  const gradeBreakdown = gradeReport.rows.map((r) => {
    const revenue = r.seasonSoldAmount;
    const revenueSharePct =
      totalSalesRevenue > 0 ? Math.round((revenue / totalSalesRevenue) * 100) : 0;
    const stockValue = calculateRowTotal(
      r.grade.currentStock,
      r.grade.ratePerUnit,
      true
    );
    return {
      id: r.grade.id,
      nameBn: cleanBrickGradeName(r.grade.nameBn),
      soldQty: r.seasonSoldQty,
      revenue,
      revenueSharePct,
      currentStock: r.grade.currentStock,
      stockValue,
    };
  });

  const sortedGrades = [...gradeBreakdown].sort((a, b) => b.revenue - a.revenue);
  const topGrade = sortedGrades[0] || {
    nameBn: '১ নং ইট',
    soldQty: 0,
    revenue: 0,
    revenueSharePct: 0,
  };

  const totalInventoryPieces = gradeBreakdown.reduce((s, g) => s + g.currentStock, 0);
  const totalInventoryValuation = gradeBreakdown.reduce((s, g) => s + g.stockValue, 0);

  // Customer & Debtor ranking
  const customerMap = new Map<
    string,
    { name: string; totalBilled: number; totalPaid: number; totalDue: number; memoCount: number }
  >();
  for (const m of state.salesMemos || []) {
    const key = m.customerName.trim();
    const prev = customerMap.get(key) || {
      name: key,
      totalBilled: 0,
      totalPaid: 0,
      totalDue: 0,
      memoCount: 0,
    };
    prev.totalBilled += m.totalAmount || 0;
    prev.totalPaid += m.paidAmount || 0;
    prev.totalDue += m.dueAmount || 0;
    prev.memoCount += 1;
    customerMap.set(key, prev);
  }

  const customerList = Array.from(customerMap.values()).sort(
    (a, b) => b.totalBilled - a.totalBilled
  );
  const topCustomer = customerList[0] || {
    name: 'নগদ ক্রেতা',
    totalBilled: 0,
    totalPaid: 0,
    totalDue: 0,
    memoCount: 0,
  };

  const dueMemosSorted = [...(state.salesMemos || [])]
    .filter((m) => (m.dueAmount || 0) > 0)
    .sort((a, b) => b.dueAmount - a.dueAmount);

  const topDebtor =
    dueMemosSorted.length > 0
      ? {
          name: dueMemosSorted[0].customerName,
          dueAmount: dueMemosSorted[0].dueAmount,
          memoNo: dueMemosSorted[0].memoNo,
          shareOfTotalDuePct:
            totalCustomerDue > 0
              ? Math.round((dueMemosSorted[0].dueAmount / totalCustomerDue) * 100)
              : 0,
        }
      : null;

  // Expense category breakdown
  const expMap = new Map<string, number>();
  for (const tx of state.cashTransactions || []) {
    if (tx.type === 'OUT') {
      expMap.set(tx.category, (expMap.get(tx.category) || 0) + tx.amount);
    }
  }
  const expenseBreakdown = Array.from(expMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      sharePct: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topExpenseDriver = expenseBreakdown[0] || {
    category: 'কয়লা ক্রয়',
    amount: 0,
    sharePct: 0,
  };

  // Health score calculation (0 - 100)
  let healthScore = 78;
  if (collectionEfficiencyPct >= 75) healthScore += 10;
  else if (collectionEfficiencyPct < 55) healthScore -= 12;
  if (netOperatingCashflow > 0) healthScore += 8;
  else healthScore -= 10;
  if (currentCashBalance > 300000) healthScore += 4;
  healthScore = Math.max(35, Math.min(98, healthScore));

  const healthLabelBn =
    healthScore >= 85
      ? 'অত্যন্ত শক্তিশালী ও লাভজনক (High Growth)'
      : healthScore >= 70
      ? 'সন্তোষজনক ও স্থিতিশীল (Healthy Margin)'
      : 'বকেয়া আদায়ে বাড়তি নজর প্রয়োজন (Attention Needed)';

  const recommendationsBn: string[] = [];
  if (topDebtor) {
    recommendationsBn.push(
      `বকেয়া রিকভারি অগ্রাধিকার: ${topDebtor.name} (${topDebtor.memoNo})-এর কাছে সর্বোচ্চ ${formatCurrencyBn(
        topDebtor.dueAmount
      )} টাকা বাকি আছে (মোট বকেয়ার ${formatBn(
        topDebtor.shareOfTotalDuePct
      )}%)—আজই ফলো-আপ করলে ক্যাশফ্লো দ্রুত বাড়বে।`
    );
  }
  recommendationsBn.push(
    `সেরা বিক্রিত প্রোডাক্ট (Top SKU): "${topGrade.nameBn}" থেকে সর্বোচ্চ ${formatCurrencyBn(
      topGrade.revenue
    )} (${formatBn(topGrade.revenueSharePct)}% রেভিনিউ) এসেছে—এই গ্রেডের পর্যাপ্ত স্টক ও প্রাইসিং ধরে রাখুন।`
  );
  if (topExpenseDriver.amount > 0) {
    recommendationsBn.push(
      `খরচ অপ্টিমাইজেশন: মোট খরচের ${formatBn(topExpenseDriver.sharePct)}% গেছে "${
        topExpenseDriver.category
      }" খাতে (${formatCurrencyBn(
        topExpenseDriver.amount
      )})। বাল্ক পারচেজ ও জ্বালানি দক্ষতা বাড়ালে নিট মুনাফা আরও বাড়বে।`
    );
  }
  recommendationsBn.push(
    `স্টক ভ্যালুয়েশন ও রানওয়ে: বর্তমানে ভাটায় থাকা ${formatBn(
      totalInventoryPieces
    )} পিস ইটের বাজারমূল্য প্রায় ${formatCurrencyBn(
      totalInventoryValuation
    )} এবং গড় মেমো অর্ডার ভ্যালু (AOV) ${formatCurrencyBn(averageOrderValue)}।`
  );

  const spokenExecutiveSummaryBn = `ভাই, আমাদের ভাটার পুরো ব্যবসার ই-কমার্স স্টাইল অ্যানালাইসিস বলছি শুনুন—এ পর্যন্ত ${formatBn(
    totalMemoCount
  )}টা মেমোতে মোট বিক্রি হয়েছে ${formatCurrencyBn(totalSalesRevenue)} টাকা, আর গড় অর্ডার ভ্যালু ${formatCurrencyBn(
    averageOrderValue
  )}। আমাদের কালেকশন রেট ${formatBn(collectionEfficiencyPct)} শতাংশ, মোট নগদ আদায় ${formatCurrencyBn(
    totalCashIn
  )}, মোট খরচ ${formatCurrencyBn(totalExpense)}, আর হাতে নিট ক্যাশ ব্যালেন্স আছে ${formatCurrencyBn(
    currentCashBalance
  )} টাকা। সবচেয়ে বেশি বিক্রি হয়েছে ${topGrade.nameBn} (${formatCurrencyBn(
    topGrade.revenue
  )}), আর বাজারে থাকা ${formatCurrencyBn(totalCustomerDue)} টাকা বকেয়ার মধ্যে সবচেয়ে বেশি বাকি ${
    topDebtor ? `${topDebtor.name}-এর কাছে (${formatCurrencyBn(topDebtor.dueAmount)})` : 'নেই'
  }। বর্তমানে আমাদের স্টকে থাকা ইটের বাজারমূল্য প্রায় ${formatCurrencyBn(
    totalInventoryValuation
  )} টাকা এবং বিজনেস হেলথ স্কোর ১০০-তে ${formatBn(healthScore)}!`;

  return {
    totalSalesRevenue,
    totalBricksSold,
    totalMemoCount,
    averageOrderValue,
    totalCashIn,
    totalExpense,
    netOperatingCashflow,
    currentCashBalance,
    totalCustomerDue,
    collectionEfficiencyPct,
    dueRiskPct,
    expenseToSalesRatioPct,
    totalInventoryPieces,
    totalInventoryValuation,
    topSellingGrade: {
      nameBn: topGrade.nameBn,
      soldQty: topGrade.soldQty,
      revenue: topGrade.revenue,
      sharePct: topGrade.revenueSharePct,
    },
    topCustomer,
    topDebtor,
    topExpenseDriver,
    gradeBreakdown,
    expenseBreakdown,
    healthScore,
    healthLabelBn,
    spokenExecutiveSummaryBn,
    recommendationsBn,
  };
}

/**
 * Generates a natural, friendly, context-aware Bangla conversational response
 * for non-tool turns (greetings, thanks, capabilities, brick rates, or general questions).
 */
export function generateNaturalConversationalReply(
  userText: string,
  conversationalType: 'GREETING' | 'THANKS' | 'CAPABILITIES' | 'BRICK_RATES' | 'GENERAL' | undefined,
  state: Pick<KilnDatabaseState, 'settings' | 'brickGrades' | 'salesMemos' | 'context'>
): string {
  const ctx = state.context || {};
  if (conversationalType === 'GREETING') {
    if (ctx.lastReferencedCustomer) {
      return `আসসালামু আলাইকুম ভাই! আলহামদুলিল্লাহ ভালো আছি। আমরা একটু আগে ${ctx.lastReferencedCustomer}-এর হিসাব দেখছিলাম—ওনার ব্যাপারে আর কিছু দেখব, নাকি পুরো ব্যবসার লাইভ অ্যানালাইসিস বা নতুন মেমো করব?`;
    }
    return 'আসসালামু আলাইকুম ভাই! ভাটার সব হিসাব একদম আপ-টু-ডেট আছে। আজকের বিক্রি, কাস্টমারের বকেয়া, নতুন মেমো বা পুরো ব্যবসার লাভ-ক্ষতির অ্যানালাইসিস—যেটা জানতে চান সরাসরি বলুন!';
  }

  if (conversationalType === 'THANKS') {
    return 'আপনাকেও অসংখ্য ধন্যবাদ ভাই! ভাটার যেকোনো হিসাব বা বিজনেস অ্যানালাইসিস লাগলে সাথে সাথে ডাকবেন।';
  }

  if (conversationalType === 'CAPABILITIES') {
    return 'ভাই, আমি আপনার ইটভাটার একজন এক্সিকিউটিভ ম্যানেজারের মতো সব কাজ করতে পারি—যেমন কাস্টমারের বকেয়া ও মেমো খোঁজা, নতুন মেমো তৈরি, বকেয়া জমা নেওয়া, খরচ তোলা, স্টকের হিসাব এবং আলিপ্রো ই-কমার্সের মতো পুরো ব্যবসার লাভ-ক্ষতি, মার্জিন ও গ্রোথ অ্যানালাইসিস করা। কী দেখতে চান বলুন?';
  }

  if (conversationalType === 'BRICK_RATES') {
    const ratesList = (state.brickGrades || [])
      .map((g) => `${g.nameBn.split('(')[0].trim()} ${formatCurrencyBn(g.ratePerUnit)}`)
      .join(', ');
    return `ভাই, বর্তমানে আমাদের ইটের প্রতি পিস দর হচ্ছে—${ratesList}। কারও নামে মেমো করতে চাইলে শুধু নাম আর পরিমাণটা বলুন।`;
  }

  if (ctx.pendingMemoData && (!ctx.pendingMemoData.customerName || !ctx.pendingMemoData.quantity)) {
    return !ctx.pendingMemoData.customerName
      ? 'মেমোটা কার নামে করব ভাই বলুন?'
      : `${ctx.pendingMemoData.customerName}-এর জন্য কত পিস ইট ধরব?`;
  }

  if (ctx.pendingExpenseAmount) {
    return `${formatCurrencyBn(ctx.pendingExpenseAmount)} টাকাটা কোন খাতে খরচ হয়েছে বলুন? যেমন কয়লা, ডিজেল, মাটি বা লেবার?`;
  }

  return `হ্যাঁ ভাই, বুঝতে পেরেছি। আপনি চাইলে "পুরো ব্যবসার অ্যানালাইসিস দাও" বলতে পারেন, অথবা কোনো মেমো, কাস্টমারের নাম বা আজকের বিক্রির কথা বললে আমি এক সেকেন্ডে হিসাব বের করে দিচ্ছি।`;
}

/**
 * Calculates Van Load (ভ্যান হিসাব) bill strictly on a per-1,000 bricks rate (১০০০ পিস রেট).
 * Supports both Raw Bricks (কাঁচা ইট) and Chamber Support Paka Bricks (পাকা ইট).
 * Sardar bill is fairly paid on total bricks (কাঁচা + পাকা), while line capacity (@ 4,000/line)
 * and inventory separation are preserved 100%.
 * Automatically normalizes legacy per-100 rates (<= 30, e.g., 11.5 -> 115 per 1,000 bricks).
 */
export function calculateVanLoadBill(
  rawBricksLoaded: number,
  rateInput: number,
  pakaBricksLoaded: number = 0
): {
  rawBricksLoaded: number;
  pakaBricksLoaded: number;
  totalBricksLoaded: number;
  bricksLoaded: number;
  vanCount: number;
  thousandUnits: number;
  ratePerThousand: number;
  totalBill: number;
  fullLines: number;
  partialBricks: number;
} {
  const raw = Math.max(0, Number(rawBricksLoaded) || 0);
  const paka = Math.max(0, Number(pakaBricksLoaded) || 0);
  const total = raw + paka;
  const vanCount = Number((total / 100).toFixed(2));
  const thousandUnits = Number((total / 1000).toFixed(3));
  const rawRate = Number(rateInput) > 0 ? Number(rateInput) : 115;
  const ratePerThousand =
    rawRate <= 30 ? Number((rawRate * 10).toFixed(2)) : rawRate;
  const totalBill = Math.round((total / 1000) * ratePerThousand);
  const fullLines = Math.floor(total / 4000);
  const partialBricks = total % 4000;

  return {
    rawBricksLoaded: raw,
    pakaBricksLoaded: paka,
    totalBricksLoaded: total,
    bricksLoaded: total,
    vanCount,
    thousandUnits,
    ratePerThousand,
    totalBill,
    fullLines,
    partialBricks,
  };
}

export interface SevenDayLiquidityPoint {
  date: string;
  dateLabelBn: string;
  dayShortBn: string;
  collections: number;
  expenses: number;
  netCashMovement: number;
  txCount: number;
}

export interface SevenDayLiquidityHealth {
  anchorDate: string;
  days: SevenDayLiquidityPoint[];
  total7dCollections: number;
  total7dExpenses: number;
  total7dNetCashMovement: number;
  averageDailyNetMovement: number;
  positiveDaysCount: number;
  negativeDaysCount: number;
  currentCashBalance: number;
  gaugeScore: number;
  statusLevel: 'STRONG' | 'STABLE' | 'WATCH' | 'CRITICAL';
  statusLabelBn: string;
  statusLabelEn: string;
  insightBn: string;
}

const BANGLA_WEEKDAYS_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

/**
 * Computes a 7-day trend of Net Cash Movement (Collections minus Expenses)
 * and a 0-100 Financial Health & Liquidity Gauge score.
 */
export function computeSevenDayLiquidityHealth(
  cashTransactions: CashTransaction[],
  openingBalance = 0,
  referenceDate?: string
): SevenDayLiquidityHealth {
  const safeTx = Array.isArray(cashTransactions) ? cashTransactions : [];

  let anchorStr = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : new Date().toISOString().slice(0, 10);

  if (!referenceDate && safeTx.length > 0) {
    const sortedDates = safeTx
      .map((t) => t.date)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (sortedDates.length > 0) {
      anchorStr = sortedDates[sortedDates.length - 1];
    }
  }

  const anchorTime = new Date(`${anchorStr}T00:00:00Z`).getTime();
  const days: SevenDayLiquidityPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchorTime - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayNum = d.getUTCDate();
    const monthNum = d.getUTCMonth() + 1;
    const weekdayIdx = d.getUTCDay();

    const dayTxs = safeTx.filter((t) => t.date === dateStr);
    const collections = dayTxs
      .filter((t) => t.type === 'IN')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const expenses = dayTxs
      .filter((t) => t.type === 'OUT')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netCashMovement = collections - expenses;

    days.push({
      date: dateStr,
      dateLabelBn: `${formatBn(dayNum)}/${formatBn(monthNum)}`,
      dayShortBn: BANGLA_WEEKDAYS_SHORT[weekdayIdx] || 'দিন',
      collections,
      expenses,
      netCashMovement,
      txCount: dayTxs.length,
    });
  }

  const total7dCollections = days.reduce((sum, d) => sum + d.collections, 0);
  const total7dExpenses = days.reduce((sum, d) => sum + d.expenses, 0);
  const total7dNetCashMovement = total7dCollections - total7dExpenses;
  const averageDailyNetMovement = Math.round(total7dNetCashMovement / 7);

  const positiveDaysCount = days.filter((d) => d.netCashMovement > 0).length;
  const negativeDaysCount = days.filter((d) => d.netCashMovement < 0).length;

  const allTimeIn = safeTx
    .filter((t) => t.type === 'IN')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const allTimeOut = safeTx
    .filter((t) => t.type === 'OUT')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const currentCashBalance = (Number(openingBalance) || 0) + allTimeIn - allTimeOut;

  // Compute 0-100 liquidity gauge score
  let score = 55;
  if (total7dCollections === 0 && total7dExpenses === 0) {
    score = currentCashBalance > 0 ? 68 : 50;
  } else {
    // 1. Net movement ratio contribution (-30 to +30)
    const volume = Math.max(1, total7dCollections + total7dExpenses);
    const netRatio = total7dNetCashMovement / volume; // -1 to +1
    score += Math.round(netRatio * 28);

    // 2. Collection-to-expense coverage bonus/penalty (-10 to +12)
    if (total7dExpenses === 0 && total7dCollections > 0) {
      score += 12;
    } else if (total7dCollections >= total7dExpenses) {
      score += Math.min(12, Math.round(((total7dCollections - total7dExpenses) / Math.max(1, total7dExpenses)) * 10));
    } else {
      score -= Math.min(12, Math.round(((total7dExpenses - total7dCollections) / Math.max(1, total7dExpenses)) * 12));
    }

    // 3. Positive days consistency (-5 to +8)
    score += (positiveDaysCount - negativeDaysCount) * 2;
  }

  // 4. Current cash reserve cushion adjustment
  if (currentCashBalance > 0 && currentCashBalance >= total7dExpenses) {
    score += 5;
  } else if (currentCashBalance < 0) {
    score -= 15;
  }

  const gaugeScore = Math.max(5, Math.min(100, Math.round(score)));

  let statusLevel: 'STRONG' | 'STABLE' | 'WATCH' | 'CRITICAL' = 'STABLE';
  let statusLabelBn = 'স্থিতিশীল তারল্য (Stable Liquidity)';
  let statusLabelEn = 'Stable Liquidity';

  if (gaugeScore >= 75) {
    statusLevel = 'STRONG';
    statusLabelBn = 'শক্তিশালী তারল্য (Strong Liquidity)';
    statusLabelEn = 'Strong Liquidity';
  } else if (gaugeScore >= 55) {
    statusLevel = 'STABLE';
    statusLabelBn = 'স্থিতিশীল তারল্য (Balanced Cashflow)';
    statusLabelEn = 'Balanced Cashflow';
  } else if (gaugeScore >= 35) {
    statusLevel = 'WATCH';
    statusLabelBn = 'সতর্ক পর্যবেক্ষণ (Watch Outflow)';
    statusLabelEn = 'Watch Outflow';
  } else {
    statusLevel = 'CRITICAL';
    statusLabelBn = 'তারল্য চাপ (High Cash Outflow)';
    statusLabelEn = 'High Cash Outflow';
  }

  const insightBn =
    total7dNetCashMovement >= 0
      ? `গত ৭ দিনে খরচের চেয়ে নগদ আদায় ${formatCurrencyBn(total7dNetCashMovement)} বেশি রয়েছে — ভাটার ক্যাশ প্রবাহ ইতিবাচক।`
      : `গত ৭ দিনে আদায়ের চেয়ে খরচ ${formatCurrencyBn(Math.abs(total7dNetCashMovement))} বেশি হয়েছে — বকেয়া আদায় জোরদার করুন।`;

  return {
    anchorDate: anchorStr,
    days,
    total7dCollections,
    total7dExpenses,
    total7dNetCashMovement,
    averageDailyNetMovement,
    positiveDaysCount,
    negativeDaysCount,
    currentCashBalance,
    gaugeScore,
    statusLevel,
    statusLabelBn,
    statusLabelEn,
    insightBn,
  };
}

/**
 * Calculates daily firewood/fuel delivery bill (পরিমাণ × দর = মোট বিল) and balance due.
 * Supports fractional quantities (e.g., 125.5 maunds) and per-supplier custom rates.
 */
export function calculateWoodFuelBill(
  rawQuantity: number,
  rawRatePerUnit: number,
  rawPaidAmount = 0
): {
  quantity: number;
  ratePerUnit: number;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  dinaAmount: number;
  status: 'PAID' | 'PARTIAL' | 'DUE' | 'DINA';
} {
  const quantity = Math.max(0, Number(Number(rawQuantity || 0).toFixed(3)));
  const ratePerUnit = Math.max(0, Number(Number(rawRatePerUnit || 0).toFixed(2)));
  const totalBill = Math.round(quantity * ratePerUnit);
  const paidAmount = Math.max(0, Math.round(Number(rawPaidAmount) || 0));
  const dueAmount = Math.max(0, totalBill - paidAmount);
  const dinaAmount = Math.max(0, paidAmount - totalBill);

  let status: 'PAID' | 'PARTIAL' | 'DUE' | 'DINA' = 'DUE';
  if (dinaAmount > 0) {
    status = 'DINA';
  } else if (dueAmount <= 0 && totalBill > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && dueAmount > 0) {
    status = 'PARTIAL';
  }

  return {
    quantity,
    ratePerUnit,
    totalBill,
    paidAmount,
    dueAmount,
    dinaAmount,
    status,
  };
}

export interface WoodFuelSupplierSummaryRow {
  supplierKey: string;
  supplierName: string;
  supplierPhone: string;
  latestRate: number;
  latestUnit: string;
  latestWoodType: string;
  distinctRates: number[];
  deliveryCount: number;
  totalQuantity: number;
  quantitiesByUnit: Record<string, number>;
  unitSummaryBn: string;
  totalBill: number;
  totalPaid: number;
  totalDue: number;
  dinaAmount: number;
  lastDeliveryDate: string;
  records: WoodFuelRecord[];
}

export interface WoodFuelOverallSummary {
  totalDeliveries: number;
  uniqueSuppliersCount: number;
  totalMaundEquivalent: number;
  quantitiesByUnit: Record<string, number>;
  unitBreakdownBn: string;
  totalBillAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
  totalDinaAmount: number;
  suppliers: WoodFuelSupplierSummaryRow[];
}

/**
 * Aggregates daily wood/firewood records by supplier, preserving each supplier's
 * individual rate history, total wood supplied, total bill, paid amount, remaining due,
 * and excess advance overpayment (দিনা / Dina).
 */
export function computeWoodFuelSupplierSummary(
  records: WoodFuelRecord[] = []
): WoodFuelOverallSummary {
  const safeRecords = Array.isArray(records) ? records : [];
  const supplierMap = new Map<string, WoodFuelSupplierSummaryRow>();
  const globalQuantitiesByUnit: Record<string, number> = {};

  let totalBillAmount = 0;
  let totalPaidAmount = 0;
  let totalMaundEquivalent = 0;

  // Sort chronological newest-first so first seen per supplier has latest rate/date
  const sorted = [...safeRecords].sort((a, b) => {
    const cmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (cmp !== 0) return cmp;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  for (const rec of sorted) {
    const name = String(rec.supplierName || 'সাধারণ কাঠ সাপ্লায়ার').trim();
    const key = name.toLowerCase();
    const unit = String(rec.unit || 'মণ').trim();
    const qty = Math.max(0, Number(rec.quantity) || 0);
    const rate = Math.max(0, Number(rec.ratePerUnit) || 0);
    const bill = Math.max(0, Number(rec.totalBill) || Math.round(qty * rate));
    const paid = Math.max(0, Number(rec.paidAmount) || 0);

    totalBillAmount += bill;
    totalPaidAmount += paid;

    globalQuantitiesByUnit[unit] = Number(((globalQuantitiesByUnit[unit] || 0) + qty).toFixed(2));
    if (unit.includes('মণ')) {
      totalMaundEquivalent += qty;
    } else if (unit.includes('টন')) {
      totalMaundEquivalent += qty * 25; // 1 Ton = 1000 KG = 25 Maunds (40 KG)
    } else if (unit.includes('কেজি')) {
      totalMaundEquivalent += qty / 40;
    }

    let existing = supplierMap.get(key);
    if (!existing) {
      existing = {
        supplierKey: key,
        supplierName: name,
        supplierPhone: String(rec.supplierPhone || '').trim(),
        latestRate: rate,
        latestUnit: unit,
        latestWoodType: String(rec.woodType || 'জ্বালানি কাঠ').trim(),
        distinctRates: rate > 0 ? [rate] : [],
        deliveryCount: 0,
        totalQuantity: 0,
        quantitiesByUnit: {},
        unitSummaryBn: '',
        totalBill: 0,
        totalPaid: 0,
        totalDue: 0,
        dinaAmount: 0,
        lastDeliveryDate: rec.date || '',
        records: [],
      };
      supplierMap.set(key, existing);
    }

    if (!existing.supplierPhone && rec.supplierPhone && rec.supplierPhone !== '—') {
      existing.supplierPhone = String(rec.supplierPhone).trim();
    }
    if (rate > 0 && !existing.distinctRates.includes(rate)) {
      existing.distinctRates.push(rate);
    }

    existing.deliveryCount += 1;
    existing.totalQuantity = Number((existing.totalQuantity + qty).toFixed(2));
    existing.quantitiesByUnit[unit] = Number(((existing.quantitiesByUnit[unit] || 0) + qty).toFixed(2));
    existing.totalBill += bill;
    existing.totalPaid += paid;
    existing.records.push(rec);
  }

  const suppliers = Array.from(supplierMap.values()).map((sup) => {
    const unitParts = Object.entries(sup.quantitiesByUnit).map(
      ([u, q]) => `${formatBn(q)} ${u}`
    );
    const totalDue = Math.max(0, sup.totalBill - sup.totalPaid);
    const dinaAmount = Math.max(0, sup.totalPaid - sup.totalBill);
    return {
      ...sup,
      totalDue,
      dinaAmount,
      unitSummaryBn: unitParts.length > 0 ? unitParts.join(' + ') : '০ মণ',
    };
  });

  // Sort suppliers: suppliers with highest due first, then highest dina, then highest bill
  suppliers.sort((a, b) => {
    if (b.totalDue !== a.totalDue) return b.totalDue - a.totalDue;
    if (b.dinaAmount !== a.dinaAmount) return b.dinaAmount - a.dinaAmount;
    return b.totalBill - a.totalBill;
  });

  const totalDueAmount = suppliers.reduce((s, r) => s + r.totalDue, 0);
  const totalDinaAmount = suppliers.reduce((s, r) => s + r.dinaAmount, 0);

  const globalUnitParts = Object.entries(globalQuantitiesByUnit).map(
    ([u, q]) => `${formatBn(q)} ${u}`
  );

  return {
    totalDeliveries: safeRecords.length,
    uniqueSuppliersCount: suppliers.length,
    totalMaundEquivalent: Number(totalMaundEquivalent.toFixed(2)),
    quantitiesByUnit: globalQuantitiesByUnit,
    unitBreakdownBn: globalUnitParts.length > 0 ? globalUnitParts.join(' · ') : '০ মণ',
    totalBillAmount,
    totalPaidAmount,
    totalDueAmount,
    totalDinaAmount,
    suppliers,
  };
}

// ============================================================================
// 1. মাটি ও কয়লা সাপ্লাইয়ার খাতা (Soil & Coal Supplier Party Ledger)
// ============================================================================

export function calculateSoilCoalBill(
  rawQuantity: number,
  rawRatePerUnit: number,
  rawPaidAmount = 0
): {
  quantity: number;
  ratePerUnit: number;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  status: 'PAID' | 'PARTIAL' | 'DUE';
} {
  const quantity = Math.max(0, Number(Number(rawQuantity || 0).toFixed(3)));
  const ratePerUnit = Math.max(0, Number(Number(rawRatePerUnit || 0).toFixed(2)));
  const totalBill = Math.round(quantity * ratePerUnit);
  const paidAmount = Math.max(0, Math.round(Number(rawPaidAmount) || 0));
  const dueAmount = Math.max(0, totalBill - paidAmount);

  let status: 'PAID' | 'PARTIAL' | 'DUE' = 'DUE';
  if (dueAmount <= 0 && totalBill > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && dueAmount > 0) {
    status = 'PARTIAL';
  }

  return {
    quantity,
    ratePerUnit,
    totalBill,
    paidAmount,
    dueAmount,
    status,
  };
}

export interface SoilCoalSupplierPartyRow {
  supplierKey: string;
  supplierName: string;
  supplierPhone: string;
  soilEntries: number;
  coalEntries: number;
  soilBill: number;
  coalBill: number;
  totalBill: number;
  totalPaid: number;
  totalDue: number;
  latestRate: number;
  latestUnit: string;
  lastDate: string;
  records: SoilCoalRecord[];
}

export function computeSoilCoalSummary(records: SoilCoalRecord[] = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  let soilTotalBill = 0;
  let soilTotalPaid = 0;
  let soilTotalDue = 0;
  let soilCount = 0;

  let coalTotalBill = 0;
  let coalTotalPaid = 0;
  let coalTotalDue = 0;
  let coalCount = 0;

  let escoTotalBill = 0;
  let escoTotalPaid = 0;
  let escoTotalDue = 0;
  let escoTotalHours = 0;
  let escoCount = 0;

  const supplierMap = new Map<string, SoilCoalSupplierPartyRow>();

  const sorted = [...safeRecords].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || ''))
  );

  for (const r of sorted) {
    const qty = Math.max(0, Number(r.quantity) || 0);
    const rate = Math.max(0, Number(r.ratePerUnit) || 0);
    const bill = Math.max(0, Number(r.totalBill) || Math.round(qty * rate));
    const paid = Math.max(0, Number(r.paidAmount) || 0);
    const due = Math.max(0, Number(r.dueAmount !== undefined ? r.dueAmount : bill - paid));

    if (r.itemType === 'ESCO') {
      escoCount += 1;
      escoTotalHours += r.hoursWorked !== undefined ? Number(r.hoursWorked) || qty : qty;
      escoTotalBill += bill;
      escoTotalPaid += paid;
      escoTotalDue += due;
    } else if (r.itemType === 'COAL') {
      coalCount += 1;
      coalTotalBill += bill;
      coalTotalPaid += paid;
      coalTotalDue += due;
    } else {
      soilCount += 1;
      soilTotalBill += bill;
      soilTotalPaid += paid;
      soilTotalDue += due;
    }

    const name = String(r.supplierName || 'সাধারণ সাপ্লায়ার').trim();
    const key = name.toLowerCase();
    let party = supplierMap.get(key);
    if (!party) {
      party = {
        supplierKey: key,
        supplierName: name,
        supplierPhone: String(r.supplierPhone || '').trim(),
        soilEntries: 0,
        coalEntries: 0,
        soilBill: 0,
        coalBill: 0,
        totalBill: 0,
        totalPaid: 0,
        totalDue: 0,
        latestRate: rate,
        latestUnit: r.unit || (r.itemType === 'ESCO' ? 'ঘণ্টা' : 'গাড়ি'),
        lastDate: r.date || '',
        records: [],
      };
      supplierMap.set(key, party);
    }

    if (!party.supplierPhone && r.supplierPhone) {
      party.supplierPhone = String(r.supplierPhone).trim();
    }
    if (r.itemType === 'COAL') {
      party.coalEntries += 1;
      party.coalBill += bill;
    } else {
      party.soilEntries += 1;
      party.soilBill += bill;
    }
    party.totalBill += bill;
    party.totalPaid += paid;
    party.totalDue = Math.max(0, party.totalBill - party.totalPaid);
    party.records.push(r);
  }

  const suppliers = Array.from(supplierMap.values()).sort(
    (a, b) => b.totalDue - a.totalDue || b.totalBill - a.totalBill
  );

  const grandTotalBill = soilTotalBill + coalTotalBill + escoTotalBill;
  const grandTotalPaid = soilTotalPaid + coalTotalPaid + escoTotalPaid;

  return {
    totalRecords: safeRecords.length,
    soilCount,
    soilTotalBill,
    soilTotalPaid,
    soilTotalDue: Math.max(0, soilTotalBill - soilTotalPaid),
    coalCount,
    coalTotalBill,
    coalTotalPaid,
    coalTotalDue: Math.max(0, coalTotalBill - coalTotalPaid),
    escoCount,
    escoTotalHours,
    escoTotalBill,
    escoTotalPaid,
    escoTotalDue: Math.max(0, escoTotalBill - escoTotalPaid),
    grandTotalBill,
    grandTotalPaid,
    grandTotalDue: Math.max(0, grandTotalBill - grandTotalPaid),
    suppliers,
  };
}

// ============================================================================
// 2. সর্দার ও মিস্ত্রি দাদন (অগ্রিম) সমন্বয় খাতা (Sardar & Mistri Dadon Reconciliation)
// ============================================================================

export interface SardarDadonReconciliationRow {
  key: string;
  recipientName: string;
  recipientPhone: string;
  roleCategory: DadonRoleCategory;
  totalDadonGiven: number;
  standingDadon: number; // অক্ষত সিজনাল দাদন (সিজন শেষ না হওয়া পর্যন্ত কর্তন হবে না)
  totalBricksHandled: number; // সিজনে মোট কাটা বা লোড/বহনকৃত কাঁচা ইট
  weeklyPaymentsTaken: number; // সপ্তাহে সপ্তাহে নেওয়া খোরাকি/হাজিরা টাকা
  autoWorkBillEarned: number;
  manualWorkBillEarned: number;
  totalWorkBillEarned: number;
  cashReturnedOrSettled: number;
  dadonAdjusted: number;
  unrecoveredDadon: number; // ভাটা এখনও সর্দারের কাছে পাবে
  netPayableToSardar: number; // দাদন কেটে নেওয়ার পর সর্দার ভাটা থেকে পাবে
  records: DadonAdvanceRecord[];
}

export function computeDadonReconciliationSummary(state: Partial<KilnDatabaseState>) {
  const dadonRecords = Array.isArray(state.dadonRecords) ? state.dadonRecords : [];
  const millPots = Array.isArray(state.millPots) ? state.millPots : [];
  const chulliLoads = Array.isArray(state.chulliLoads) ? state.chulliLoads : [];
  const poraiMistriRecords = Array.isArray(state.poraiMistriRecords) ? state.poraiMistriRecords : [];
  const chulliUnloads = Array.isArray(state.chulliUnloads) ? state.chulliUnloads : [];
  const productionPayments = Array.isArray(state.productionPayments) ? state.productionPayments : [];

  const sardarMap = new Map<string, SardarDadonReconciliationRow>();

  for (const d of dadonRecords) {
    const name = String(d.recipientName || 'সর্দার').trim();
    const key = name.toLowerCase();
    let row = sardarMap.get(key);
    if (!row) {
      row = {
        key,
        recipientName: name,
        recipientPhone: String(d.recipientPhone || '').trim(),
        roleCategory: d.roleCategory || 'মিল সর্দার',
        totalDadonGiven: 0,
        standingDadon: 0,
        totalBricksHandled: 0,
        weeklyPaymentsTaken: 0,
        autoWorkBillEarned: 0,
        manualWorkBillEarned: 0,
        totalWorkBillEarned: 0,
        cashReturnedOrSettled: 0,
        dadonAdjusted: 0,
        unrecoveredDadon: 0,
        netPayableToSardar: 0,
        records: [],
      };
      sardarMap.set(key, row);
    }
    if (!row.recipientPhone && d.recipientPhone) {
      row.recipientPhone = String(d.recipientPhone).trim();
    }
    row.totalDadonGiven += Math.max(0, Number(d.advanceAmount) || 0);
    row.standingDadon = row.totalDadonGiven;
    row.manualWorkBillEarned += Math.max(0, Number(d.manualWorkBill) || 0);
    row.cashReturnedOrSettled += Math.max(0, Number(d.cashReturnedOrSettled) || 0);
    row.records.push(d);
  }

  // Reconcile against actual production work bills and bricks by matching Sardar/Mistri name
  for (const row of sardarMap.values()) {
    const normName = row.recipientName.toLowerCase();
    let autoEarned = 0;
    let bricksCount = 0;

    // 1. Mill Pots (মিল সর্দার: ওহাব / মফিজুল / শফিকুল)
    for (const p of millPots) {
      const mName = String(p.millNameBn || '').toLowerCase();
      if (
        (mName && (normName.includes(mName) || mName.includes(normName))) ||
        (normName.includes('ওহাব') && p.millId === 'ohab') ||
        (normName.includes('মফিজুল') && p.millId === 'mofijul') ||
        (normName.includes('শফিকুল') && p.millId === 'sofikul')
      ) {
        autoEarned += Math.max(0, Number(p.totalPayable) || 0);
        bricksCount += Math.max(0, Number(p.rawBricksCut) || 0);
      }
    }

    // 2. Van / Chulli Loads (ভ্যান সর্দার)
    for (const l of chulliLoads) {
      const sName = String(l.sardarName || '').trim().toLowerCase();
      if (sName && (sName === normName || normName.includes(sName) || sName.includes(normName))) {
        autoEarned += Math.max(0, Number(l.totalBill) || 0);
        bricksCount += Math.max(0, Number(l.rawBricksLoaded) || 0);
      }
    }

    // 3. Porai Mistri (পোড়াই মিস্ত্রি)
    for (const pm of poraiMistriRecords) {
      const mName = String(pm.mistriName || '').trim().toLowerCase();
      if (mName && (mName === normName || normName.includes(mName) || mName.includes(normName))) {
        autoEarned += Math.max(0, Number(pm.totalBill) || 0);
        bricksCount += Math.max(0, Number(pm.bricksFired) || 0);
      }
    }

    // 4. Chulli Unload (আনলোড সর্দার)
    for (const u of chulliUnloads) {
      const sName = String(u.sardarName || '').trim().toLowerCase();
      if (sName && (sName === normName || normName.includes(sName) || sName.includes(normName))) {
        autoEarned += Math.max(0, Number(u.totalBill) || 0);
        bricksCount += Math.max(0, Number(u.totalBricksUnloaded) || 0);
      }
    }

    // 5. Weekly Khoraki payments taken from production payments
    let weeklyKhoraki = 0;
    for (const pay of productionPayments) {
      const payRecip = String(pay.recipientName || '').trim().toLowerCase();
      if (payRecip && (payRecip === normName || normName.includes(payRecip) || payRecip.includes(normName))) {
        weeklyKhoraki += Math.max(0, Number(pay.amount) || 0);
      }
    }

    row.autoWorkBillEarned = autoEarned;
    row.totalBricksHandled = bricksCount;
    row.weeklyPaymentsTaken = weeklyKhoraki;
    row.totalWorkBillEarned = row.autoWorkBillEarned + row.manualWorkBillEarned;

    const totalOffset = row.totalWorkBillEarned + row.cashReturnedOrSettled;
    row.dadonAdjusted = Math.min(row.totalDadonGiven, totalOffset);
    row.unrecoveredDadon = Math.max(0, row.totalDadonGiven - totalOffset);
    row.netPayableToSardar = Math.max(0, totalOffset - row.totalDadonGiven);
  }

  const sardars = Array.from(sardarMap.values()).sort(
    (a, b) => b.unrecoveredDadon - a.unrecoveredDadon || b.totalDadonGiven - a.totalDadonGiven
  );

  const totalDadonGiven = sardars.reduce((s, r) => s + r.totalDadonGiven, 0);
  const totalBricksHandled = sardars.reduce((s, r) => s + r.totalBricksHandled, 0);
  const totalWeeklyPaymentsTaken = sardars.reduce((s, r) => s + r.weeklyPaymentsTaken, 0);
  const totalWorkBillEarned = sardars.reduce((s, r) => s + r.totalWorkBillEarned, 0);
  const totalDadonAdjusted = sardars.reduce((s, r) => s + r.dadonAdjusted, 0);
  const totalUnrecoveredDadon = sardars.reduce((s, r) => s + r.unrecoveredDadon, 0);
  const totalNetPayableToSardars = sardars.reduce((s, r) => s + r.netPayableToSardar, 0);

  return {
    totalRecords: dadonRecords.length,
    sardarsCount: sardars.length,
    totalDadonGiven,
    standingDadonTotal: totalDadonGiven,
    totalBricksHandled,
    totalWeeklyPaymentsTaken,
    totalWorkBillEarned,
    totalDadonAdjusted,
    totalUnrecoveredDadon,
    totalNetPayableToSardars,
    sardars,
  };
}

// ============================================================================
// 3. অগ্রিম ইট বুকিং ও কাস্টমার পার্টি খতিয়ান (Advance Brick Booking & Customer Party Statement)
// ============================================================================

export function calculateAdvanceBookingBill(
  rawBookedQuantity: number,
  rawRatePerThousand: number,
  rawAdvancePaid = 0,
  rawDeliveredQuantity = 0
): {
  bookedQuantity: number;
  ratePerThousand: number;
  totalAmount: number;
  advancePaid: number;
  dueAmount: number;
  deliveredQuantity: number;
  remainingBricks: number;
  status: 'ACTIVE' | 'PARTIAL_DELIVERED' | 'COMPLETED';
} {
  const bookedQuantity = Math.max(0, Math.round(Number(rawBookedQuantity) || 0));
  const ratePerThousand = Math.max(0, Number(rawRatePerThousand) || 0);
  const totalAmount = calculateRowTotal(bookedQuantity, ratePerThousand, true);
  const advancePaid = Math.max(0, Math.round(Number(rawAdvancePaid) || 0));
  const dueAmount = Math.max(0, totalAmount - advancePaid);
  const deliveredQuantity = Math.max(0, Math.min(bookedQuantity, Math.round(Number(rawDeliveredQuantity) || 0)));
  const remainingBricks = Math.max(0, bookedQuantity - deliveredQuantity);

  let status: 'ACTIVE' | 'PARTIAL_DELIVERED' | 'COMPLETED' = 'ACTIVE';
  if (bookedQuantity > 0 && deliveredQuantity >= bookedQuantity) {
    status = 'COMPLETED';
  } else if (deliveredQuantity > 0) {
    status = 'PARTIAL_DELIVERED';
  }

  return {
    bookedQuantity,
    ratePerThousand,
    totalAmount,
    advancePaid,
    dueAmount,
    deliveredQuantity,
    remainingBricks,
    status,
  };
}

export interface CustomerPartyStatementRow {
  customerKey: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  memoCount: number;
  bookingCount: number;
  totalBricksOrdered: number;
  totalBricksDelivered: number;
  pendingBricksToDeliver: number;
  totalBilledAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
  lastTransactionDate: string;
  memos: SalesMemo[];
  bookings: AdvanceBrickBooking[];
}

export function computeCustomerPartyStatements(
  salesMemos: SalesMemo[] = [],
  advanceBookings: AdvanceBrickBooking[] = []
) {
  const safeMemos = Array.isArray(salesMemos) ? salesMemos : [];
  const safeBookings = Array.isArray(advanceBookings) ? advanceBookings : [];
  const partyMap = new Map<string, CustomerPartyStatementRow>();

  const getOrCreateParty = (name: string, phone?: string, address?: string, date?: string) => {
    const cleanName = String(name || 'নগদ ক্রেতা').trim();
    const key = cleanName.toLowerCase();
    let p = partyMap.get(key);
    if (!p) {
      p = {
        customerKey: key,
        customerName: cleanName,
        customerPhone: String(phone || '—').trim(),
        customerAddress: String(address || 'স্থানীয়').trim(),
        memoCount: 0,
        bookingCount: 0,
        totalBricksOrdered: 0,
        totalBricksDelivered: 0,
        pendingBricksToDeliver: 0,
        totalBilledAmount: 0,
        totalPaidAmount: 0,
        totalDueAmount: 0,
        lastTransactionDate: date || '',
        memos: [],
        bookings: [],
      };
      partyMap.set(key, p);
    }
    if ((p.customerPhone === '—' || !p.customerPhone) && phone && phone !== '—') {
      p.customerPhone = String(phone).trim();
    }
    if ((p.customerAddress === 'স্থানীয়' || !p.customerAddress) && address && address !== 'স্থানীয়') {
      p.customerAddress = String(address).trim();
    }
    if (date && (!p.lastTransactionDate || date > p.lastTransactionDate)) {
      p.lastTransactionDate = date;
    }
    return p;
  };

  for (const m of safeMemos) {
    const p = getOrCreateParty(m.customerName, m.customerPhone, m.customerAddress, m.date);
    p.memoCount += 1;
    const mItems =
      Array.isArray(m.items) && m.items.length > 0
        ? m.items
        : [{ quantity: Number(m.quantity) || 0 }];
    const ordered = mItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const delivered =
      Array.isArray(m.deliveryHistory) && m.deliveryHistory.length > 0
        ? m.deliveryHistory.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
        : Number(m.deliveredQuantity) || 0;

    p.totalBricksOrdered += ordered;
    p.totalBricksDelivered += delivered;
    p.totalBilledAmount += Math.max(0, Number(m.totalAmount) || 0);
    p.totalPaidAmount += Math.max(0, Number(m.paidAmount) || 0);
    p.totalDueAmount += Math.max(0, Number(m.dueAmount) || 0);
    p.memos.push(m);
  }

  for (const b of safeBookings) {
    const p = getOrCreateParty(b.customerName, b.customerPhone, b.customerAddress, b.date);
    p.bookingCount += 1;
    const ordered = Math.max(0, Number(b.bookedQuantity) || 0);
    const delivered = Math.max(0, Number(b.deliveredQuantity) || 0);

    p.totalBricksOrdered += ordered;
    p.totalBricksDelivered += delivered;
    p.totalBilledAmount += Math.max(0, Number(b.totalAmount) || 0);
    p.totalPaidAmount += Math.max(0, Number(b.advancePaid) || 0);
    p.totalDueAmount += Math.max(0, Number(b.dueAmount) || 0);
    p.bookings.push(b);
  }

  const parties = Array.from(partyMap.values()).map((p) => ({
    ...p,
    pendingBricksToDeliver: Math.max(0, p.totalBricksOrdered - p.totalBricksDelivered),
  }));

  parties.sort((a, b) => b.totalDueAmount - a.totalDueAmount || b.totalBilledAmount - a.totalBilledAmount);

  const totalBookedBricks = safeBookings.reduce((s, b) => s + (Number(b.bookedQuantity) || 0), 0);
  const totalBookingDeliveredBricks = safeBookings.reduce((s, b) => s + (Number(b.deliveredQuantity) || 0), 0);
  const totalBookingAmount = safeBookings.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const totalBookingAdvance = safeBookings.reduce((s, b) => s + (Number(b.advancePaid) || 0), 0);
  const totalBookingDue = safeBookings.reduce((s, b) => s + (Number(b.dueAmount) || 0), 0);

  return {
    totalBookingsCount: safeBookings.length,
    totalBookedBricks,
    totalBookingDeliveredBricks,
    totalBookingRemainingBricks: Math.max(0, totalBookedBricks - totalBookingDeliveredBricks),
    totalBookingAmount,
    totalBookingAdvance,
    totalBookingDue,
    uniqueCustomersCount: parties.length,
    parties,
  };
}

// ============================================================================
// 4. নিজস্ব ট্রাক, ট্রলি ও ভেকু হিসাব (Vehicle, Veku & Diesel Tracker)
// ============================================================================

export function calculateVehicleDieselExpense(
  rawDieselLiters: number,
  rawDieselRate: number,
  rawDriverAllowance = 0,
  rawMaintenanceCost = 0,
  rawPaidAmount?: number
): {
  dieselLiters: number;
  dieselRate: number;
  dieselCost: number;
  driverAllowance: number;
  maintenanceCost: number;
  totalExpense: number;
  paidAmount: number;
} {
  const dieselLiters = Math.max(0, Number(Number(rawDieselLiters || 0).toFixed(2)));
  const dieselRate = Math.max(0, Number(Number(rawDieselRate || 0).toFixed(2)));
  const dieselCost = Math.round(dieselLiters * dieselRate);
  const driverAllowance = Math.max(0, Math.round(Number(rawDriverAllowance) || 0));
  const maintenanceCost = Math.max(0, Math.round(Number(rawMaintenanceCost) || 0));
  const totalExpense = dieselCost + driverAllowance + maintenanceCost;
  const paidAmount =
    rawPaidAmount !== undefined && rawPaidAmount !== null
      ? Math.max(0, Math.round(Number(rawPaidAmount) || 0))
      : totalExpense;

  return {
    dieselLiters,
    dieselRate,
    dieselCost,
    driverAllowance,
    maintenanceCost,
    totalExpense,
    paidAmount,
  };
}

export function computeVehicleDieselSummary(records: VehicleDieselRecord[] = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  let totalDieselLiters = 0;
  let totalDieselCost = 0;
  let totalDriverAllowance = 0;
  let totalMaintenanceCost = 0;
  let totalExpense = 0;
  let totalPaid = 0;

  const vehicleMap = new Map<
    string,
    {
      vehicleName: string;
      vehicleType: string;
      driverName: string;
      entriesCount: number;
      dieselLiters: number;
      dieselCost: number;
      driverAllowance: number;
      maintenanceCost: number;
      totalExpense: number;
    }
  >();

  for (const r of safeRecords) {
    const liters = Math.max(0, Number(r.dieselLiters) || 0);
    const dCost = Math.max(0, Number(r.dieselCost) || 0);
    const dAllow = Math.max(0, Number(r.driverAllowance) || 0);
    const mCost = Math.max(0, Number(r.maintenanceCost) || 0);
    const exp = Math.max(0, Number(r.totalExpense) || dCost + dAllow + mCost);
    const paid = Math.max(0, Number(r.paidAmount !== undefined ? r.paidAmount : exp));

    totalDieselLiters = Number((totalDieselLiters + liters).toFixed(2));
    totalDieselCost += dCost;
    totalDriverAllowance += dAllow;
    totalMaintenanceCost += mCost;
    totalExpense += exp;
    totalPaid += paid;

    const vName = String(r.vehicleName || 'ভেকু-০১').trim();
    const key = vName.toLowerCase();
    let v = vehicleMap.get(key);
    if (!v) {
      v = {
        vehicleName: vName,
        vehicleType: r.vehicleType || 'ভেকু (Excavator)',
        driverName: r.driverName || '—',
        entriesCount: 0,
        dieselLiters: 0,
        dieselCost: 0,
        driverAllowance: 0,
        maintenanceCost: 0,
        totalExpense: 0,
      };
      vehicleMap.set(key, v);
    }
    v.entriesCount += 1;
    v.dieselLiters = Number((v.dieselLiters + liters).toFixed(2));
    v.dieselCost += dCost;
    v.driverAllowance += dAllow;
    v.maintenanceCost += mCost;
    v.totalExpense += exp;
  }

  const vehicles = Array.from(vehicleMap.values()).sort((a, b) => b.totalExpense - a.totalExpense);

  return {
    totalRecords: safeRecords.length,
    totalDieselLiters,
    totalDieselCost,
    totalDriverAllowance,
    totalMaintenanceCost,
    totalExpense,
    totalPaid,
    vehicles,
  };
}

// ============================================================================
// 5. ভাটার লাইসেন্স, ভ্যাট ও সরকারি কিস্তি ট্র্যাকার (Kiln Compliance & Installment Tracker)
// ============================================================================

export function calculateComplianceItemBill(
  rawTotalPayable: number,
  rawPaidAmount = 0
): {
  totalPayable: number;
  paidAmount: number;
  dueAmount: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING';
} {
  const totalPayable = Math.max(0, Math.round(Number(rawTotalPayable) || 0));
  const paidAmount = Math.max(0, Math.round(Number(rawPaidAmount) || 0));
  const dueAmount = Math.max(0, totalPayable - paidAmount);

  let status: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
  if (dueAmount <= 0 && totalPayable > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && dueAmount > 0) {
    status = 'PARTIAL';
  }

  return {
    totalPayable,
    paidAmount,
    dueAmount,
    status,
  };
}

export function computeComplianceSummary(
  records: ComplianceInstallmentRecord[] = [],
  todayDate = new Date().toISOString().slice(0, 10)
) {
  const safeRecords = Array.isArray(records) ? records : [];
  let totalPayable = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let paidCount = 0;
  let overdueCount = 0;

  for (const r of safeRecords) {
    const payable = Math.max(0, Number(r.totalPayable) || 0);
    const paid = Math.max(0, Number(r.paidAmount) || 0);
    const due = Math.max(0, Number(r.dueAmount !== undefined ? r.dueAmount : payable - paid));

    totalPayable += payable;
    totalPaid += paid;
    totalDue += due;

    if (due <= 0 && payable > 0) {
      paidCount += 1;
    } else if (due > 0 && r.dueDate && r.dueDate < todayDate) {
      overdueCount += 1;
    }
  }

  return {
    totalItems: safeRecords.length,
    totalPayable,
    totalPaid,
    totalDue,
    paidCount,
    overdueCount,
    pendingOrPartialCount: Math.max(0, safeRecords.length - paidCount),
  };
}

// ============================================================================
// 6. চুল্লি লাইন আনলোড (১ লাইন = ৪,০০০ ইট, প্রতি লাইন = ৭৫০ টাকা) ও অটো গ্রেড/আদলা বিক্রয় সমন্বয়
// ============================================================================

export function calculateChulliLineUnloadBill(
  rawLinesUnloaded: number,
  rawRatePerLine = 750,
  rawBricksPerLine = 4000,
  rawPaidAmount = 0
): {
  linesUnloaded: number;
  bricksPerLine: number;
  ratePerLine: number;
  totalBricksUnloaded: number;
  totalBill: number;
  equivalentRatePerThousand: number;
  paidAmount: number;
  dueAmount: number;
} {
  const linesUnloaded = Math.max(0, Number(Number(rawLinesUnloaded || 0).toFixed(2)));
  const bricksPerLine = Math.max(1, Math.round(Number(rawBricksPerLine) || 4000));
  const ratePerLine = Math.max(0, Number(Number(rawRatePerLine ?? 750).toFixed(2)));
  const totalBricksUnloaded = Math.round(linesUnloaded * bricksPerLine);
  const totalBill = Math.round(linesUnloaded * ratePerLine);
  const equivalentRatePerThousand =
    bricksPerLine > 0
      ? Number(((ratePerLine / bricksPerLine) * 1000).toFixed(2))
      : 187.5;
  const paidAmount = Math.max(0, Math.round(Number(rawPaidAmount) || 0));
  const dueAmount = Math.max(0, totalBill - paidAmount);

  return {
    linesUnloaded,
    bricksPerLine,
    ratePerLine,
    totalBricksUnloaded,
    totalBill,
    equivalentRatePerThousand,
    paidAmount,
    dueAmount,
  };
}

export interface UnloadGradeSalesReconciliationRow {
  gradeId: string;
  gradeNameBn: string;
  defaultRatePerThousand: number;
  soldQty: number;
  soldRevenue: number;
  avgSoldRatePerThousand: number;
  shareOfUnloadedPct: number;
  shareOfSoldPct: number;
  isAdlaOrDamage: boolean;
}

export function computeUnloadLineAndSalesReconciliation(
  chulliUnloads: ChulliUnloadRecord[] = [],
  salesMemos: SalesMemo[] = [],
  brickGrades: BrickGrade[] = []
) {
  const safeUnloads = Array.isArray(chulliUnloads) ? chulliUnloads : [];
  const safeMemos = Array.isArray(salesMemos) ? salesMemos : [];
  const safeGrades = Array.isArray(brickGrades) ? brickGrades : [];

  let totalLinesUnloaded = 0;
  let totalBricksFromLines = 0;
  let totalUnloadBill = 0;
  let totalUnloadPaid = 0;
  let totalUnloadDue = 0;

  for (const u of safeUnloads) {
    const bPerLine = u.bricksPerLine && u.bricksPerLine > 0 ? u.bricksPerLine : 4000;
    const bricks = Math.max(0, Number(u.totalBricksUnloaded) || 0);
    const lines =
      u.linesUnloaded !== undefined && u.linesUnloaded > 0
        ? Number(u.linesUnloaded)
        : Number((bricks / bPerLine).toFixed(2));
    const bill = Math.max(0, Number(u.totalBill) || 0);
    const paid = Math.max(0, Number(u.paidAmount) || 0);
    const due = Math.max(0, Number(u.dueAmount !== undefined ? u.dueAmount : bill - paid));

    totalLinesUnloaded = Number((totalLinesUnloaded + lines).toFixed(2));
    totalBricksFromLines += bricks;
    totalUnloadBill += bill;
    totalUnloadPaid += paid;
    totalUnloadDue += due;
  }

  // Ensure standard grades + Adla are represented in reconciliation
  const gradeMap = new Map<
    string,
    {
      gradeId: string;
      gradeNameBn: string;
      defaultRatePerThousand: number;
      soldQty: number;
      soldRevenue: number;
    }
  >();

  for (const g of safeGrades) {
    gradeMap.set(g.id, {
      gradeId: g.id,
      gradeNameBn: cleanBrickGradeName(g.nameBn),
      defaultRatePerThousand: Number(g.ratePerUnit) || 10000,
      soldQty: 0,
      soldRevenue: 0,
    });
  }

  if (!gradeMap.has('grade-adla')) {
    gradeMap.set('grade-adla', {
      gradeId: 'grade-adla',
      gradeNameBn: 'আদলা ও ড্যামেজ ইট',
      defaultRatePerThousand: 6000,
      soldQty: 0,
      soldRevenue: 0,
    });
  }

  for (const memo of safeMemos) {
    const items =
      Array.isArray(memo.items) && memo.items.length > 0
        ? memo.items
        : [
            {
              id: '1',
              gradeId: memo.gradeId || 'grade-1',
              gradeName: memo.gradeName || '১ নং ইট',
              quantity: Number(memo.quantity) || 0,
              rate: Number(memo.rate) || 0,
              ratePerThousand: true,
              lineTotal: Number(memo.totalAmount) || 0,
            },
          ];

    for (const it of items) {
      const qty = Math.max(0, Number(it.quantity) || 0);
      const rev = Math.max(0, Number(it.lineTotal) || 0);
      if (qty <= 0 && rev <= 0) continue;

      let entry = gradeMap.get(it.gradeId);
      if (!entry) {
        entry = {
          gradeId: it.gradeId || `custom-${it.gradeName}`,
          gradeNameBn: cleanBrickGradeName(it.gradeName || 'অন্যান্য ইট'),
          defaultRatePerThousand: Number(it.rate) || 8000,
          soldQty: 0,
          soldRevenue: 0,
        };
        gradeMap.set(entry.gradeId, entry);
      }
      entry.soldQty += qty;
      entry.soldRevenue += rev;
    }
  }

  const allEntries = Array.from(gradeMap.values());
  const totalSoldBricksAllGrades = allEntries.reduce((s, e) => s + e.soldQty, 0);
  const totalSoldRevenueAllGrades = allEntries.reduce((s, e) => s + e.soldRevenue, 0);

  const soldByGrade: UnloadGradeSalesReconciliationRow[] = allEntries.map((e) => {
    const avgSoldRatePerThousand =
      e.soldQty > 0
        ? Math.round((e.soldRevenue / e.soldQty) * 1000)
        : e.defaultRatePerThousand;
    const shareOfUnloadedPct =
      totalBricksFromLines > 0
        ? Number(((e.soldQty / totalBricksFromLines) * 100).toFixed(1))
        : 0;
    const shareOfSoldPct =
      totalSoldBricksAllGrades > 0
        ? Number(((e.soldQty / totalSoldBricksAllGrades) * 100).toFixed(1))
        : 0;
    const lowerName = e.gradeNameBn.toLowerCase();
    const isAdlaOrDamage =
      e.gradeId === 'grade-adla' ||
      e.gradeId === 'grade-goria' ||
      lowerName.includes('আদলা') ||
      lowerName.includes('আদল') ||
      lowerName.includes('ড্যামেজ') ||
      lowerName.includes('গড়িয়া') ||
      lowerName.includes('ঝামা');

    return {
      gradeId: e.gradeId,
      gradeNameBn: e.gradeNameBn,
      defaultRatePerThousand: e.defaultRatePerThousand,
      soldQty: e.soldQty,
      soldRevenue: e.soldRevenue,
      avgSoldRatePerThousand,
      shareOfUnloadedPct,
      shareOfSoldPct,
      isAdlaOrDamage,
    };
  });

  const totalAdlaAndDamageSoldQty = soldByGrade
    .filter((r) => r.isAdlaOrDamage)
    .reduce((s, r) => s + r.soldQty, 0);
  const totalAdlaAndDamageSoldRevenue = soldByGrade
    .filter((r) => r.isAdlaOrDamage)
    .reduce((s, r) => s + r.soldRevenue, 0);

  const remainingUnreconciledOrStockBricks = Math.max(
    0,
    totalBricksFromLines - totalSoldBricksAllGrades
  );

  return {
    totalUnloadRecords: safeUnloads.length,
    totalLinesUnloaded,
    totalBricksFromLines,
    totalUnloadBill,
    totalUnloadPaid,
    totalUnloadDue,
    totalSoldBricksAllGrades,
    totalSoldRevenueAllGrades,
    totalAdlaAndDamageSoldQty,
    totalAdlaAndDamageSoldRevenue,
    remainingUnreconciledOrStockBricks,
    soldByGrade,
  };
}

// ============================================================================
// 7. আনুমানিক প্রতি ১,০০০ ইটের উৎপাদন খরচ ও বিক্রয় সমন্বয় ক্যালকুলেটর (Feature #1)
// ============================================================================

export function computeEstimatedPerThousandBrickCost(
  state: Partial<KilnDatabaseState>,
  customOverrides?: EstimatedCostOverrides
) {
  const overrides: EstimatedCostOverrides = {
    ...(state.settings?.estimatedCostOverrides || {}),
    ...(customOverrides || {}),
  };

  const millPots = state.millPots || [];
  const chulliLoads = state.chulliLoads || [];
  const poraiRecords = state.poraiMistriRecords || [];
  const chulliUnloads = state.chulliUnloads || [];
  const woodRecords = state.woodFuelRecords || [];
  const soilCoalRecords = state.soilCoalRecords || [];
  const vehicleRecords = state.vehicleDieselRecords || [];
  const salesMemos = state.salesMemos || [];
  const cashTransactions = state.cashTransactions || [];

  // 1. Mill (মিলওয়ালাদের কাঁচা ইট কাটা)
  const totalMillBricks = millPots.reduce((s, p) => s + (Number(p.rawBricksCut) || 0), 0);
  const totalMillBill = millPots.reduce((s, p) => s + (Number(p.totalPayable) || 0), 0);
  const actualMillRatePerThousand =
    totalMillBricks > 0 ? Math.round((totalMillBill / totalMillBricks) * 1000) : 1200;
  const effectiveMillRatePerThousand =
    overrides.millRatePerThousand !== undefined && overrides.millRatePerThousand > 0
      ? Number(overrides.millRatePerThousand)
      : actualMillRatePerThousand;

  // 2. Van / Load (লোডওয়ালা / ভ্যান হিসাব)
  const totalVanBricks = chulliLoads.reduce((s, l) => s + (Number(l.rawBricksLoaded) || 0), 0);
  const totalVanBill = chulliLoads.reduce((s, l) => s + (Number(l.totalBill) || 0), 0);
  const actualVanRatePerThousand =
    totalVanBricks > 0 ? Math.round((totalVanBill / totalVanBricks) * 1000) : 115;
  const effectiveVanRatePerThousand =
    overrides.vanLoadRatePerThousand !== undefined && overrides.vanLoadRatePerThousand > 0
      ? Number(overrides.vanLoadRatePerThousand)
      : actualVanRatePerThousand;

  // 3. Porai Mistri (পোড়াই মিস্ত্রি)
  const totalPoraiBricks = poraiRecords.reduce((s, r) => s + (Number(r.bricksFired) || 0), 0);
  const totalPoraiBill = poraiRecords.reduce((s, r) => s + (Number(r.totalBill) || 0), 0);
  const actualPoraiRatePerThousand =
    totalPoraiBricks > 0 ? Math.round((totalPoraiBill / totalPoraiBricks) * 1000) : 400;
  const effectivePoraiRatePerThousand =
    overrides.poraiRatePerThousand !== undefined && overrides.poraiRatePerThousand > 0
      ? Number(overrides.poraiRatePerThousand)
      : actualPoraiRatePerThousand;

  // 4. Unload by Line (আনলোড: ১ লাইন = ৪০০০ ইট @ ৭৫০ টাকা => হাজারে ১৮৭.৫০ টাকা)
  const unloadRecon = computeUnloadLineAndSalesReconciliation(
    chulliUnloads,
    salesMemos,
    state.brickGrades || []
  );
  const effectiveUnloadRatePerLine =
    overrides.unloadRatePerLine !== undefined && overrides.unloadRatePerLine > 0
      ? Number(overrides.unloadRatePerLine)
      : 750;
  const effectiveUnloadCostPerThousand = Number((effectiveUnloadRatePerLine / 4).toFixed(2));

  // Reference brick volume for macro costs (soil, coal/wood, overhead)
  const referenceBrickVolume = Math.max(
    totalMillBricks,
    totalPoraiBricks,
    unloadRecon.totalBricksFromLines,
    unloadRecon.totalSoldBricksAllGrades,
    100000 // fallback 1 lakh bricks for initial estimation
  );

  // 5. Soil Purchase (মাটি কেনা)
  const ledgerSoilBill = soilCoalRecords
    .filter((r) => r.itemType === 'SOIL')
    .reduce((s, r) => s + (Number(r.totalBill) || 0), 0);
  const cashSoilOut = cashTransactions
    .filter((tx) => tx.type === 'OUT' && tx.category === 'মাটি ক্রয়' && !tx.referenceId?.startsWith('sc-'))
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
  const totalSoilCost = ledgerSoilBill + cashSoilOut;
  const actualSoilPerThousand =
    totalSoilCost > 0
      ? Math.round((totalSoilCost / referenceBrickVolume) * 1000)
      : 1100;
  const effectiveSoilCostPerThousand =
    overrides.soilCostPerThousand !== undefined && overrides.soilCostPerThousand > 0
      ? Number(overrides.soilCostPerThousand)
      : actualSoilPerThousand;

  // 6. Coal & Firewood (কাঠ ও কয়লা জ্বালানি)
  const ledgerCoalBill = soilCoalRecords
    .filter((r) => r.itemType === 'COAL')
    .reduce((s, r) => s + (Number(r.totalBill) || 0), 0);
  const ledgerWoodBill = woodRecords.reduce((s, w) => s + (Number(w.totalBill) || 0), 0);
  const cashCoalWoodOut = cashTransactions
    .filter(
      (tx) =>
        tx.type === 'OUT' &&
        (tx.category === 'কয়লা ক্রয়' || tx.category === 'বিদ্যুৎ ও জ্বালানি') &&
        !tx.referenceId?.startsWith('sc-') &&
        !tx.referenceId?.startsWith('wood-')
    )
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
  const totalCoalWoodCost = ledgerCoalBill + ledgerWoodBill + cashCoalWoodOut;
  const actualCoalWoodPerThousand =
    totalCoalWoodCost > 0
      ? Math.round((totalCoalWoodCost / referenceBrickVolume) * 1000)
      : 3200;
  const effectiveCoalWoodCostPerThousand =
    overrides.coalWoodCostPerThousand !== undefined && overrides.coalWoodCostPerThousand > 0
      ? Number(overrides.coalWoodCostPerThousand)
      : actualCoalWoodPerThousand;

  // 7. Veku, Diesel, Daily Labour & Overhead (ভেকু, ডিজেল, লেবার ও অন্যান্য খরচ)
  const totalVehicleExpense = vehicleRecords.reduce(
    (s, v) => s + (Number(v.totalExpense) || 0),
    0
  );
  const cashOtherOut = cashTransactions
    .filter(
      (tx) =>
        tx.type === 'OUT' &&
        (tx.category === 'ভেকু ও ডিজেল' ||
          tx.category === 'অফিস ও আপ্যায়ন' ||
          tx.category === 'অন্যান্য খরচ') &&
        !tx.referenceId?.startsWith('vd-')
    )
    .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
  const totalOtherOverheadCost = totalVehicleExpense + cashOtherOut;
  const actualOtherPerThousand =
    totalOtherOverheadCost > 0
      ? Math.round((totalOtherOverheadCost / referenceBrickVolume) * 1000)
      : 600;
  const effectiveOtherOverheadPerThousand =
    overrides.otherOverheadPerThousand !== undefined && overrides.otherOverheadPerThousand >= 0
      ? Number(overrides.otherOverheadPerThousand)
      : actualOtherPerThousand;

  // Total Estimated Cost per 1,000 Bricks
  const estimatedCostPerThousand = Math.round(
    effectiveMillRatePerThousand +
      effectiveVanRatePerThousand +
      effectivePoraiRatePerThousand +
      effectiveUnloadCostPerThousand +
      effectiveSoilCostPerThousand +
      effectiveCoalWoodCostPerThousand +
      effectiveOtherOverheadPerThousand
  );
  const estimatedCostPerPiece = Number((estimatedCostPerThousand / 1000).toFixed(2));

  // Actual Sales Comparison
  const totalBricksSold = unloadRecon.totalSoldBricksAllGrades;
  const totalSalesRevenue = unloadRecon.totalSoldRevenueAllGrades;
  const averageSellingRatePerThousand =
    totalBricksSold > 0
      ? Math.round((totalSalesRevenue / totalBricksSold) * 1000)
      : 10500;
  const averageSellingPricePerPiece = Number((averageSellingRatePerThousand / 1000).toFixed(2));

  const estimatedProfitPerThousand = averageSellingRatePerThousand - estimatedCostPerThousand;
  const estimatedProfitPerPiece = Number((estimatedProfitPerThousand / 1000).toFixed(2));
  const estimatedTotalCostOfSoldBricks = Math.round(
    (totalBricksSold / 1000) * estimatedCostPerThousand
  );
  const estimatedNetProfitOnSoldBricks = totalSalesRevenue - estimatedTotalCostOfSoldBricks;

  return {
    referenceBrickVolume,
    components: {
      mill: {
        labelBn: 'মিলওয়ালা (কাঁচা ইট কাটা)',
        actualTotalBricks: totalMillBricks,
        actualTotalBill: totalMillBill,
        actualRatePerThousand: actualMillRatePerThousand,
        effectiveRatePerThousand: effectiveMillRatePerThousand,
      },
      vanLoad: {
        labelBn: 'লোডওয়ালা / ভ্যান হিসাব',
        actualTotalBricks: totalVanBricks,
        actualTotalBill: totalVanBill,
        actualRatePerThousand: actualVanRatePerThousand,
        effectiveRatePerThousand: effectiveVanRatePerThousand,
      },
      porai: {
        labelBn: 'পোড়াই মিস্ত্রি (চুল্লি পোড়ানো)',
        actualTotalBricks: totalPoraiBricks,
        actualTotalBill: totalPoraiBill,
        actualRatePerThousand: actualPoraiRatePerThousand,
        effectiveRatePerThousand: effectivePoraiRatePerThousand,
      },
      unload: {
        labelBn: 'আনলোড লাইন খরচ (১ লাইন = ৪০০০ ইট)',
        actualTotalLines: unloadRecon.totalLinesUnloaded,
        actualTotalBricks: unloadRecon.totalBricksFromLines,
        actualTotalBill: unloadRecon.totalUnloadBill,
        effectiveRatePerLine: effectiveUnloadRatePerLine,
        effectiveRatePerThousand: effectiveUnloadCostPerThousand,
      },
      soil: {
        labelBn: 'মাটি কেনা খরচ',
        actualTotalBill: totalSoilCost,
        actualRatePerThousand: actualSoilPerThousand,
        effectiveRatePerThousand: effectiveSoilCostPerThousand,
      },
      coalWood: {
        labelBn: 'কাঠ ও কয়লা জ্বালানি খরচ',
        actualTotalBill: totalCoalWoodCost,
        actualRatePerThousand: actualCoalWoodPerThousand,
        effectiveRatePerThousand: effectiveCoalWoodCostPerThousand,
      },
      otherOverhead: {
        labelBn: 'ভেকু, ডিজেল, লেবার ও আনুষঙ্গিক খরচ',
        actualTotalBill: totalOtherOverheadCost,
        actualRatePerThousand: actualOtherPerThousand,
        effectiveRatePerThousand: effectiveOtherOverheadPerThousand,
      },
    },
    estimatedCostPerThousand,
    estimatedCostPerPiece,
    totalBricksSold,
    totalSalesRevenue,
    averageSellingRatePerThousand,
    averageSellingPricePerPiece,
    estimatedProfitPerThousand,
    estimatedProfitPerPiece,
    estimatedTotalCostOfSoldBricks,
    estimatedNetProfitOnSoldBricks,
    unloadReconciliation: unloadRecon,
  };
}

// ============================================================================
// 8. বকেয়া তাগাদা ও ১-ক্লিক হোয়াটসঅ্যাপ মেসেজ রিমাইন্ডার (Feature #2)
// ============================================================================

export interface DueTagadaItem {
  id: string;
  sourceType: 'MEMO' | 'BOOKING';
  referenceNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  cleanWhatsAppPhone: string;
  date: string;
  duePromiseDate?: string;
  totalBilled: number;
  totalPaid: number;
  dueAmount: number;
  bricksSummaryBn: string;
  isOverdue: boolean;
  daysOverdue: number;
  whatsAppMessageBn: string;
  whatsAppUrl: string;
  smsUrl: string;
  memoRef?: SalesMemo;
}

export function normalizeBangladeshWhatsAppPhone(rawPhone: string): string {
  const ascii = parseBanglaDigits(String(rawPhone || '')).replace(/[^0-9+]/g, '');
  if (!ascii) return '';
  if (ascii.startsWith('+880')) return ascii.slice(1);
  if (ascii.startsWith('880')) return ascii;
  if (ascii.startsWith('01') && ascii.length >= 11) return `88${ascii}`;
  if (ascii.startsWith('1') && ascii.length === 10) return `880${ascii}`;
  return ascii;
}

export function computeDueTagadaList(
  salesMemos: SalesMemo[] = [],
  advanceBookings: AdvanceBrickBooking[] = [],
  todayDate = new Date().toISOString().slice(0, 10),
  bhataName = 'BrickFlow ইটভাটা'
): {
  items: DueTagadaItem[];
  totalDueAmount: number;
  overdueCount: number;
  overdueAmount: number;
  withPhoneCount: number;
} {
  const safeMemos = Array.isArray(salesMemos) ? salesMemos : [];
  const safeBookings = Array.isArray(advanceBookings) ? advanceBookings : [];
  const items: DueTagadaItem[] = [];

  const calcOverdueDays = (promiseDate?: string): { isOverdue: boolean; daysOverdue: number } => {
    if (!promiseDate || promiseDate >= todayDate) {
      return { isOverdue: false, daysOverdue: 0 };
    }
    const t1 = new Date(todayDate).getTime();
    const t2 = new Date(promiseDate).getTime();
    if (Number.isNaN(t1) || Number.isNaN(t2)) return { isOverdue: false, daysOverdue: 0 };
    const diffDays = Math.max(1, Math.round((t1 - t2) / 86400000));
    return { isOverdue: true, daysOverdue: diffDays };
  };

  for (const m of safeMemos) {
    const due = Math.max(0, Number(m.dueAmount) || 0);
    if (due <= 0) continue;

    const mItems =
      Array.isArray(m.items) && m.items.length > 0
        ? m.items
        : [
            {
              gradeName: m.gradeName || '১ নং ইট',
              quantity: Number(m.quantity) || 0,
            },
          ];
    const bricksSummaryBn = mItems
      .map((it) => `${cleanBrickGradeName(it.gradeName)}: ${formatBn(it.quantity)} পিস`)
      .join(', ');

    const { isOverdue, daysOverdue } = calcOverdueDays(m.duePromiseDate);
    const cleanPhone = normalizeBangladeshWhatsAppPhone(m.customerPhone);
    const whatsAppMessageBn = `আসসালামু আলাইকুম ${m.customerName},\n${bhataName} থেকে মেমো নং #${m.memoNo} (${bricksSummaryBn}) বাবদ আপনার মোট বিল ${formatCurrencyBn(m.totalAmount)}, জমা ${formatCurrencyBn(m.paidAmount)} এবং বর্তমান বকেয়া পাওনা ${formatCurrencyBn(due)}${m.duePromiseDate ? ` (পরিশোধের তারিখ: ${m.duePromiseDate})` : ''}। অনুগ্রহ করে বকেয়া টাকা পরিশোধ করার জন্য বিনীত অনুরোধ করা হলো। ধন্যবাদ।`;

    const encodedMsg = encodeURIComponent(whatsAppMessageBn);
    const whatsAppUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
    const smsPhone = parseBanglaDigits(String(m.customerPhone || '')).replace(/[^0-9+]/g, '');
    const smsUrl = `sms:${smsPhone}?body=${encodedMsg}`;

    items.push({
      id: m.id,
      sourceType: 'MEMO',
      referenceNo: m.memoNo,
      customerName: m.customerName,
      customerPhone: m.customerPhone || '—',
      customerAddress: m.customerAddress || 'স্থানীয়',
      cleanWhatsAppPhone: cleanPhone,
      date: m.date,
      duePromiseDate: m.duePromiseDate,
      totalBilled: m.totalAmount,
      totalPaid: m.paidAmount,
      dueAmount: due,
      bricksSummaryBn,
      isOverdue,
      daysOverdue,
      whatsAppMessageBn,
      whatsAppUrl,
      smsUrl,
      memoRef: m,
    });
  }

  for (const b of safeBookings) {
    const due = Math.max(0, Number(b.dueAmount) || 0);
    if (due <= 0) continue;

    const bricksSummaryBn = `${cleanBrickGradeName(b.gradeName)}: ${formatBn(b.bookedQuantity)} পিস (বুকিং)`;
    const { isOverdue, daysOverdue } = calcOverdueDays(b.deliveryTargetDate);
    const cleanPhone = normalizeBangladeshWhatsAppPhone(b.customerPhone);
    const whatsAppMessageBn = `আসসালামু আলাইকুম ${b.customerName},\n${bhataName} থেকে বুকিং নং #${b.bookingNo} (${bricksSummaryBn}) বাবদ মোট চুক্তিমূল্য ${formatCurrencyBn(b.totalAmount)}, অগ্রিম জমা ${formatCurrencyBn(b.advancePaid)} এবং বাকি প্রদেয় ${formatCurrencyBn(due)}। ধন্যবাদ।`;

    const encodedMsg = encodeURIComponent(whatsAppMessageBn);
    const whatsAppUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
    const smsPhone = parseBanglaDigits(String(b.customerPhone || '')).replace(/[^0-9+]/g, '');
    const smsUrl = `sms:${smsPhone}?body=${encodedMsg}`;

    items.push({
      id: b.id,
      sourceType: 'BOOKING',
      referenceNo: b.bookingNo,
      customerName: b.customerName,
      customerPhone: b.customerPhone || '—',
      customerAddress: b.customerAddress || 'স্থানীয়',
      cleanWhatsAppPhone: cleanPhone,
      date: b.date,
      duePromiseDate: b.deliveryTargetDate,
      totalBilled: b.totalAmount,
      totalPaid: b.advancePaid,
      dueAmount: due,
      bricksSummaryBn,
      isOverdue,
      daysOverdue,
      whatsAppMessageBn,
      whatsAppUrl,
      smsUrl,
    });
  }

  items.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.dueAmount - a.dueAmount;
  });

  const totalDueAmount = items.reduce((s, i) => s + i.dueAmount, 0);
  const overdueItems = items.filter((i) => i.isOverdue);
  const overdueCount = overdueItems.length;
  const overdueAmount = overdueItems.reduce((s, i) => s + i.dueAmount, 0);
  const withPhoneCount = items.filter((i) => i.cleanWhatsAppPhone.length >= 10).length;

  return {
    items,
    totalDueAmount,
    overdueCount,
    overdueAmount,
    withPhoneCount,
  };
}

// ============================================================================
// 9. দৈনিক ভাটা ক্লোজিং শিট (Feature #5) এবং ডেইলি গোল ট্র্যাকার (Daily Goal Tracker)
// ============================================================================

export function computeDailyClosingSheet(
  state: Partial<KilnDatabaseState>,
  targetDate = new Date().toISOString().slice(0, 10)
) {
  const openingBalance = Number(state.settings?.openingBalance) || 0;
  const cashTxs = state.cashTransactions || [];
  const salesMemos = state.salesMemos || [];
  const millPots = state.millPots || [];
  const chulliLoads = state.chulliLoads || [];
  const poraiRecords = state.poraiMistriRecords || [];
  const chulliUnloads = state.chulliUnloads || [];
  const deliveries = state.memoDeliveries || [];
  const woodRecords = state.woodFuelRecords || [];
  const soilCoalRecords = state.soilCoalRecords || [];

  // Cash opening before targetDate
  let cashInBefore = 0;
  let cashOutBefore = 0;
  const todayCashInList: CashTransaction[] = [];
  const todayCashOutList: CashTransaction[] = [];

  for (const tx of cashTxs) {
    const amt = Math.max(0, Number(tx.amount) || 0);
    if (tx.date < targetDate) {
      if (tx.type === 'IN') cashInBefore += amt;
      else if (tx.type === 'OUT') cashOutBefore += amt;
    } else if (tx.date === targetDate) {
      if (tx.type === 'IN') todayCashInList.push(tx);
      else if (tx.type === 'OUT') todayCashOutList.push(tx);
    }
  }

  const openingCashForDay = openingBalance + cashInBefore - cashOutBefore;
  const todayCashIn = todayCashInList.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const todayCashOut = todayCashOutList.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const closingCashForDay = openingCashForDay + todayCashIn - todayCashOut;

  // Sales on targetDate
  const todayMemos = salesMemos.filter((m) => m.date === targetDate);
  let todayBricksSold = 0;
  let todaySalesBilled = 0;
  let todaySalesPaid = 0;
  let todaySalesNewDue = 0;

  for (const m of todayMemos) {
    const items =
      Array.isArray(m.items) && m.items.length > 0
        ? m.items
        : [{ quantity: Number(m.quantity) || 0 }];
    todayBricksSold += items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    todaySalesBilled += Math.max(0, Number(m.totalAmount) || 0);
    todaySalesPaid += Math.max(0, Number(m.paidAmount) || 0);
    todaySalesNewDue += Math.max(0, Number(m.dueAmount) || 0);
  }

  // Production on targetDate
  const todayMillPots = millPots.filter((p) => p.date === targetDate);
  const todayRawBricksCut = todayMillPots.reduce((s, p) => s + (Number(p.rawBricksCut) || 0), 0);
  const todayMillBill = todayMillPots.reduce((s, p) => s + (Number(p.totalPayable) || 0), 0);

  const todayVanLoads = chulliLoads.filter((l) => l.date === targetDate);
  const todayVanBricksLoaded = todayVanLoads.reduce(
    (s, l) => s + (Number(l.rawBricksLoaded) || 0),
    0
  );

  const todayPorai = poraiRecords.filter((r) => r.date === targetDate);
  const todayPoraiBricksFired = todayPorai.reduce((s, r) => s + (Number(r.bricksFired) || 0), 0);

  const todayUnloads = chulliUnloads.filter((u) => u.date === targetDate);
  const todayUnloadLines = Number(
    todayUnloads
      .reduce(
        (s, u) =>
          s +
          (u.linesUnloaded !== undefined && u.linesUnloaded > 0
            ? Number(u.linesUnloaded)
            : Number(((u.totalBricksUnloaded || 0) / (u.bricksPerLine || 4000)).toFixed(2))),
        0
      )
      .toFixed(2)
  );
  const todayUnloadBricks = todayUnloads.reduce(
    (s, u) => s + (Number(u.totalBricksUnloaded) || 0),
    0
  );
  const todayUnloadBill = todayUnloads.reduce((s, u) => s + (Number(u.totalBill) || 0), 0);

  const todayDeliveries = deliveries.filter((d) => d.date === targetDate);
  const todayDeliveredBricks = todayDeliveries.reduce((s, d) => s + (Number(d.quantity) || 0), 0);

  const todayWood = woodRecords.filter((w) => w.date === targetDate);
  const todayWoodBill = todayWood.reduce((s, w) => s + (Number(w.totalBill) || 0), 0);

  const todaySoilCoal = soilCoalRecords.filter((r) => r.date === targetDate);
  const todaySoilCoalBill = todaySoilCoal.reduce((s, r) => s + (Number(r.totalBill) || 0), 0);

  return {
    targetDate,
    openingCashForDay,
    todayCashIn,
    todayCashOut,
    closingCashForDay,
    todayCashInList,
    todayCashOutList,
    todayMemosCount: todayMemos.length,
    todayBricksSold,
    todaySalesBilled,
    todaySalesPaid,
    todaySalesNewDue,
    todayRawBricksCut,
    todayMillBill,
    todayVanBricksLoaded,
    todayPoraiBricksFired,
    todayUnloadLines,
    todayUnloadBricks,
    todayUnloadBill,
    todayDeliveryTripsCount: todayDeliveries.length,
    todayDeliveredBricks,
    todayWoodBill,
    todaySoilCoalBill,
  };
}

export interface DailyGoalProgressItem {
  id: 'RAW_BRICKS' | 'BRICKS_SOLD' | 'CASH_COLLECTION' | 'UNLOAD_LINES';
  labelBn: string;
  unitBn: string;
  target: number;
  actual: number;
  progressPct: number;
  achieved: boolean;
}

export function computeDailyGoalProgress(
  state: Partial<KilnDatabaseState>,
  targetDate = new Date().toISOString().slice(0, 10),
  customGoals?: Partial<DailyKilnGoals>
): {
  targetDate: string;
  goals: DailyKilnGoals;
  items: DailyGoalProgressItem[];
  overallCompletionPct: number;
  achievedCount: number;
} {
  const defaultGoals: DailyKilnGoals = {
    rawBricksCutTarget: 50000,
    bricksSoldTarget: 30000,
    cashCollectionTarget: 250000,
    unloadLinesTarget: 8,
  };
  const goals: DailyKilnGoals = {
    ...defaultGoals,
    ...(state.settings?.dailyGoals || {}),
    ...(customGoals || {}),
  };

  const closing = computeDailyClosingSheet(state, targetDate);

  const makeItem = (
    id: DailyGoalProgressItem['id'],
    labelBn: string,
    unitBn: string,
    target: number,
    actual: number
  ): DailyGoalProgressItem => {
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeActual = Math.max(0, Number(actual) || 0);
    const rawPct = Math.round((safeActual / safeTarget) * 100);
    return {
      id,
      labelBn,
      unitBn,
      target: safeTarget,
      actual: safeActual,
      progressPct: Math.min(100, rawPct),
      achieved: safeActual >= safeTarget,
    };
  };

  const items: DailyGoalProgressItem[] = [
    makeItem(
      'RAW_BRICKS',
      'দৈনিক কাঁচা ইট কাটা লক্ষ্যমাত্রা (মিল)',
      'পিস',
      goals.rawBricksCutTarget,
      closing.todayRawBricksCut
    ),
    makeItem(
      'BRICKS_SOLD',
      'দৈনিক ইট বিক্রয় লক্ষ্যমাত্রা (মেমো)',
      'পিস',
      goals.bricksSoldTarget,
      closing.todayBricksSold
    ),
    makeItem(
      'CASH_COLLECTION',
      'দৈনিক নগদ আদায় লক্ষ্যমাত্রা (ক্যাশ ইন)',
      '৳',
      goals.cashCollectionTarget,
      closing.todayCashIn
    ),
    makeItem(
      'UNLOAD_LINES',
      'দৈনিক চুল্লি আনলোড লাইন (১ লাইন = ৪০০০ ইট)',
      'লাইন',
      goals.unloadLinesTarget,
      closing.todayUnloadLines
    ),
  ];

  const overallCompletionPct = Math.round(
    items.reduce((s, it) => s + it.progressPct, 0) / items.length
  );
  const achievedCount = items.filter((it) => it.achieved).length;

  return {
    targetDate,
    goals,
    items,
    overallCompletionPct,
    achievedCount,
  };
}

// ============================================================================
// 10. Daily Mill Production Goal Progress (millPots daily targets vs current production)
// ============================================================================

export interface MillDailyProductionProgressItem {
  millId: MillId;
  millNameBn: string;
  millNameEn: string;
  dailyTargetBricks: number;
  currentBricksCut: number;
  takenToChulliToday: number;
  potsCountToday: number;
  seasonTotalBricksCut: number;
  remainingBricks: number;
  surplusBricks: number;
  progressPct: number; // clamped 0..100 for bar width
  exactPct: number;    // uncapped percentage
  status: 'ACHIEVED' | 'ON_TRACK' | 'NEEDS_PACE' | 'NOT_STARTED';
}

export interface DailyMillProductionGoalReport {
  targetDate: string;
  dailyTargetBricks: number;
  currentProductionBricks: number;
  takenToChulliToday: number;
  todayPotsCount: number;
  todayPayableAmount: number;
  remainingBricks: number;
  surplusBricks: number;
  progressPct: number; // 0..100
  exactPct: number;    // uncapped %
  status: 'ACHIEVED' | 'ON_TRACK' | 'NEEDS_PACE' | 'NOT_STARTED';
  statusLabelBn: string;
  statusLabelEn: string;
  seasonTotalBricksCut: number;
  seasonRemainingRawOnField: number;
  millBreakdown: MillDailyProductionProgressItem[];
}

const DEFAULT_MILL_CATALOG: Array<{
  millId: MillId;
  millNameBn: string;
  millNameEn: string;
  defaultShareRatio: number;
}> = [
  {
    millId: 'ohab',
    millNameBn: 'ওহাব মিল',
    millNameEn: 'Ohab Mill',
    defaultShareRatio: 0.36, // e.g., 18,000 of 50,000
  },
  {
    millId: 'mofijul',
    millNameBn: 'মফিজুল মিল',
    millNameEn: 'Mofijul Mill',
    defaultShareRatio: 0.34, // e.g., 17,000 of 50,000
  },
  {
    millId: 'sofikul',
    millNameBn: 'শফিকুল মিল',
    millNameEn: 'Sofikul Mill',
    defaultShareRatio: 0.30, // e.g., 15,000 of 50,000
  },
];

export function computeDailyMillProductionGoal(
  millPots: MillPotRecord[] = [],
  targetDate = new Date().toISOString().slice(0, 10),
  dailyGoals?: Partial<DailyKilnGoals>
): DailyMillProductionGoalReport {
  const safePots = Array.isArray(millPots) ? millPots : [];
  const configuredOverallTarget = Math.max(
    1000,
    Number(dailyGoals?.rawBricksCutTarget) || 50000
  );
  const customMillTargets = dailyGoals?.millDailyTargets || {};

  const millBreakdown: MillDailyProductionProgressItem[] = DEFAULT_MILL_CATALOG.map(
    (meta) => {
      const customTarget = Number(customMillTargets[meta.millId]);
      const dailyTargetBricks =
        customTarget > 0
          ? Math.round(customTarget)
          : Math.round(configuredOverallTarget * meta.defaultShareRatio);

      const millAllPots = safePots.filter((p) => p.millId === meta.millId);
      const millTodayPots = millAllPots.filter((p) => p.date === targetDate);

      const currentBricksCut = millTodayPots.reduce(
        (sum, p) => sum + (Number(p.rawBricksCut) || 0),
        0
      );
      const takenToChulliToday = millTodayPots.reduce(
        (sum, p) => sum + (Number(p.takenToChulli) || 0),
        0
      );
      const seasonTotalBricksCut = millAllPots.reduce(
        (sum, p) => sum + (Number(p.rawBricksCut) || 0),
        0
      );

      const exactPct =
        dailyTargetBricks > 0
          ? Math.round((currentBricksCut / dailyTargetBricks) * 100)
          : 0;
      const progressPct = Math.min(100, Math.max(0, exactPct));
      const remainingBricks = Math.max(0, dailyTargetBricks - currentBricksCut);
      const surplusBricks = Math.max(0, currentBricksCut - dailyTargetBricks);

      let status: MillDailyProductionProgressItem['status'] = 'NOT_STARTED';
      if (currentBricksCut >= dailyTargetBricks && dailyTargetBricks > 0) {
        status = 'ACHIEVED';
      } else if (exactPct >= 60) {
        status = 'ON_TRACK';
      } else if (currentBricksCut > 0) {
        status = 'NEEDS_PACE';
      }

      return {
        millId: meta.millId,
        millNameBn: meta.millNameBn,
        millNameEn: meta.millNameEn,
        dailyTargetBricks,
        currentBricksCut,
        takenToChulliToday,
        potsCountToday: millTodayPots.length,
        seasonTotalBricksCut,
        remainingBricks,
        surplusBricks,
        progressPct,
        exactPct,
        status,
      };
    }
  );

  // If custom per-mill targets are explicitly configured, sum them when overall isn't overriding
  const sumOfMillTargets = millBreakdown.reduce(
    (s, m) => s + m.dailyTargetBricks,
    0
  );
  const hasExplicitPerMillTargets = Object.values(customMillTargets).some(
    (v) => Number(v) > 0
  );
  const dailyTargetBricks = hasExplicitPerMillTargets
    ? sumOfMillTargets
    : configuredOverallTarget;

  const todayAllPots = safePots.filter((p) => p.date === targetDate);
  const currentProductionBricks = todayAllPots.reduce(
    (sum, p) => sum + (Number(p.rawBricksCut) || 0),
    0
  );
  const takenToChulliToday = todayAllPots.reduce(
    (sum, p) => sum + (Number(p.takenToChulli) || 0),
    0
  );
  const todayPayableAmount = todayAllPots.reduce(
    (sum, p) => sum + (Number(p.totalPayable) || 0),
    0
  );

  const seasonTotalBricksCut = safePots.reduce(
    (sum, p) => sum + (Number(p.rawBricksCut) || 0),
    0
  );
  const seasonTotalTakenToChulli = safePots.reduce(
    (sum, p) => sum + (Number(p.takenToChulli) || 0),
    0
  );
  const seasonRemainingRawOnField = Math.max(
    0,
    seasonTotalBricksCut - seasonTotalTakenToChulli
  );

  const exactPct =
    dailyTargetBricks > 0
      ? Math.round((currentProductionBricks / dailyTargetBricks) * 100)
      : 0;
  const progressPct = Math.min(100, Math.max(0, exactPct));
  const remainingBricks = Math.max(0, dailyTargetBricks - currentProductionBricks);
  const surplusBricks = Math.max(0, currentProductionBricks - dailyTargetBricks);

  let status: DailyMillProductionGoalReport['status'] = 'NOT_STARTED';
  let statusLabelBn = 'আজকের মিল উৎপাদন এন্ট্রি অপেক্ষমাণ';
  let statusLabelEn = 'Awaiting Today Mill Entry';

  if (currentProductionBricks >= dailyTargetBricks && dailyTargetBricks > 0) {
    status = 'ACHIEVED';
    statusLabelBn = 'দৈনিক লক্ষ্যমাত্রা অর্জিত! (On Track & Complete)';
    statusLabelEn = 'Daily Production Goal Achieved!';
  } else if (exactPct >= 60) {
    status = 'ON_TRACK';
    statusLabelBn = 'অন ট্র্যাক — উৎপাদন সঠিক গতিতে চলছে';
    statusLabelEn = 'On Track — Production Pace Healthy';
  } else if (currentProductionBricks > 0) {
    status = 'NEEDS_PACE';
    statusLabelBn = 'গতি বাড়াতে হবে — লক্ষ্যমাত্রা থেকে পিছিয়ে';
    statusLabelEn = 'Needs Pace — Below Daily Target';
  }

  return {
    targetDate,
    dailyTargetBricks,
    currentProductionBricks,
    takenToChulliToday,
    todayPotsCount: todayAllPots.length,
    todayPayableAmount,
    remainingBricks,
    surplusBricks,
    progressPct,
    exactPct,
    status,
    statusLabelBn,
    statusLabelEn,
    seasonTotalBricksCut,
    seasonRemainingRawOnField,
    millBreakdown,
  };
}

export type SardarPaymentMode = 'KHORAKI' | 'FRIDAY_FINAL';

export interface WorkerBalanceWithDina {
  totalBill: number;
  totalPaid: number;
  balanceDue: number; // Positive amount owed by field to worker
  dinaAmount: number; // Positive amount owed by worker to field (দিনা / overpaid)
  isDina: boolean;
  statusBn: string;
}

/**
 * Computes a worker/sardar's overall financial balance.
 * If totalPaid > totalBill, the worker enters 'Dina' (দিনা / দেনা / advance overdrawn).
 */
export function computeWorkerBalanceWithDina(
  totalBillInput: number,
  totalPaidInput: number
): WorkerBalanceWithDina {
  const totalBill = Math.max(0, Math.round(Number(totalBillInput) || 0));
  const totalPaid = Math.max(0, Math.round(Number(totalPaidInput) || 0));

  if (totalPaid > totalBill) {
    const dinaAmount = totalPaid - totalBill;
    return {
      totalBill,
      totalPaid,
      balanceDue: 0,
      dinaAmount,
      isDina: true,
      statusBn: `দিনায় আছে (৳${formatBn(dinaAmount)})`,
    };
  }

  const balanceDue = totalBill - totalPaid;
  return {
    totalBill,
    totalPaid,
    balanceDue,
    dinaAmount: 0,
    isDina: false,
    statusBn:
      balanceDue === 0 && totalBill > 0
        ? 'পরিশোধিত (Paid)'
        : `বকেয়া পাওনা (৳${formatBn(balanceDue)})`,
  };
}

export interface NewWorkWithDinaAdjustment {
  newWorkBill: number;
  priorDina: number;
  dinaDeductedFromNewWork: number;
  netPayableAfterDina: number;
  remainingDina: number;
  appliedPayment: number;
  finalDueAmount: number;
  finalNewDina: number;
  statusBn: string;
}

/**
 * When a worker has previous 'Dina' (দিনা) and cuts new bricks / does new work:
 * The prior Dina is automatically deducted from the new work bill first.
 * Then whatever new cash payment is given is applied.
 */
export function computeNewWorkWithDinaAdjustment(
  newWorkBillInput: number,
  priorDinaInput: number,
  appliedPaymentInput: number = 0
): NewWorkWithDinaAdjustment {
  const newWorkBill = Math.max(0, Math.round(Number(newWorkBillInput) || 0));
  const priorDina = Math.max(0, Math.round(Number(priorDinaInput) || 0));
  const appliedPayment = Math.max(0, Math.round(Number(appliedPaymentInput) || 0));

  const dinaDeductedFromNewWork = Math.min(newWorkBill, priorDina);
  const remainingDina = Math.max(0, priorDina - newWorkBill);
  const netPayableAfterDina = Math.max(0, newWorkBill - priorDina);

  if (appliedPayment > netPayableAfterDina) {
    const finalNewDina = remainingDina + (appliedPayment - netPayableAfterDina);
    return {
      newWorkBill,
      priorDina,
      dinaDeductedFromNewWork,
      netPayableAfterDina,
      remainingDina: 0,
      appliedPayment,
      finalDueAmount: 0,
      finalNewDina,
      statusBn: `দিনায় আছে (৳${formatBn(finalNewDina)})`,
    };
  }

  const finalDueAmount = netPayableAfterDina - appliedPayment;
  return {
    newWorkBill,
    priorDina,
    dinaDeductedFromNewWork,
    netPayableAfterDina,
    remainingDina,
    appliedPayment,
    finalDueAmount,
    finalNewDina: remainingDina,
    statusBn:
      remainingDina > 0
        ? `দিনা অবশিষ্ট আছে (৳${formatBn(remainingDina)})`
        : finalDueAmount === 0 && newWorkBill > 0
        ? 'পরিশোধিত (Paid)'
        : `বকেয়া পাওনা (৳${formatBn(finalDueAmount)})`,
  };
}

export interface SardarFridaySettlementCalc {
  totalBill: number;
  priorKhorakiOrPaid: number;
  fridayNetPayableBefore: number;
  appliedPayment: number;
  newTotalPaid: number;
  remainingFridayDue: number;
  dinaAmount: number; // If newTotalPaid > totalBill, worker enters Dina (দিনা)
  isDina: boolean;
  isFullyPaid: boolean;
  defaultNoteBn: string;
}

export function calculateSardarFridaySettlement(
  totalBillInput: number,
  priorPaidInput: number,
  currentPaymentInput: number,
  mode: SardarPaymentMode
): SardarFridaySettlementCalc {
  const totalBill = Math.max(0, Math.round(Number(totalBillInput) || 0));
  const priorKhorakiOrPaid = Math.max(0, Math.round(Number(priorPaidInput) || 0));
  const appliedPayment = Math.max(0, Math.round(Number(currentPaymentInput) || 0));
  const newTotalPaid = priorKhorakiOrPaid + appliedPayment;

  const fridayNetPayableBefore = Math.max(0, totalBill - priorKhorakiOrPaid);

  let remainingFridayDue = 0;
  let dinaAmount = 0;
  let isDina = false;

  if (newTotalPaid > totalBill) {
    dinaAmount = newTotalPaid - totalBill;
    remainingFridayDue = 0;
    isDina = true;
  } else {
    remainingFridayDue = totalBill - newTotalPaid;
  }

  const isFullyPaid = remainingFridayDue === 0 && !isDina && totalBill > 0;
  const defaultNoteBn =
    mode === 'KHORAKI'
      ? 'সাপ্তাহিক খোরাকি বাবদ প্রদান (শুক্রবারের বিল হতে কর্তন)'
      : isDina
      ? `শুক্রবারে কাজের চেয়ে বেশি পরিশোধ করায় দিনায় রয়েছে (দিনা ৳${formatBn(dinaAmount)})`
      : 'শুক্রবারের চূড়ান্ত সর্দার বিল পরিশোধ (Paid)';

  return {
    totalBill,
    priorKhorakiOrPaid,
    fridayNetPayableBefore,
    appliedPayment,
    newTotalPaid,
    remainingFridayDue,
    dinaAmount,
    isDina,
    isFullyPaid,
    defaultNoteBn,
  };
}

const QUICK_INCOME_CATEGORY_SET = new Set([
  'ইট বিক্রয় আদায়',
  'বাকি আদায়',
  'বকেয়া আদায়',
  'অন্যান্য জমা',
]);

export function inferQuickCashTxType(category?: string): 'IN' | 'OUT' {
  const clean = (category || '').trim();
  return QUICK_INCOME_CATEGORY_SET.has(clean) ? 'IN' : 'OUT';
}

export interface QuickCashTxInput {
  type?: 'IN' | 'OUT';
  category?: string;
  amountInput: number | string;
  noteInput?: string;
  paymentMethod?: 'নগদ ক্যাশ' | 'বিকাশ / নগদ অ্যাপ' | 'ব্যাংক চেক / ট্রান্সফার';
}

export interface QuickCashTxBuildResult {
  valid: boolean;
  errorBn?: string;
  payload?: {
    type: 'IN' | 'OUT';
    category: string;
    amount: number;
    description: string;
    paymentMethod: 'নগদ ক্যাশ' | 'বিকাশ / নগদ অ্যাপ' | 'ব্যাংক চেক / ট্রান্সফার';
  };
}

export function buildQuickCashTransactionPayload(
  input: QuickCashTxInput
): QuickCashTxBuildResult {
  const rawAmtStr = parseBanglaDigits(String(input.amountInput ?? '').trim());
  const parsedAmount = Math.round(Number(rawAmtStr));
  if (!rawAmtStr || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return {
      valid: false,
      errorBn: 'অনুগ্রহ করে সঠিক টাকার পরিমাণ (৳) লিখুন।',
    };
  }

  const trimmedCategory = (input.category || '').trim();
  const resolvedType: 'IN' | 'OUT' =
    input.type === 'IN' || input.type === 'OUT'
      ? input.type
      : inferQuickCashTxType(trimmedCategory);
  const defaultCategory =
    resolvedType === 'OUT' ? 'অফিস ও আপ্যায়ন' : 'অন্যান্য জমা';
  const resolvedCategory = trimmedCategory || defaultCategory;
  const cleanNote = (input.noteInput || '').trim();
  const resolvedDescription =
    cleanNote ||
    (resolvedType === 'OUT'
      ? `${resolvedCategory} — কুইক খরচ এন্ট্রি`
      : `${resolvedCategory} — কুইক জমা এন্ট্রি`);
  const resolvedMethod = input.paymentMethod || 'নগদ ক্যাশ';

  return {
    valid: true,
    payload: {
      type: resolvedType,
      category: resolvedCategory,
      amount: parsedAmount,
      description: resolvedDescription,
      paymentMethod: resolvedMethod,
    },
  };
}



