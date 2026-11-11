import type { DashboardMetrics, KilnDatabaseState, LanguageMode } from '../types/kiln.ts';
import { formatBn, formatCurrencyBn } from './kilnLogic.ts';

export type ChamberZoneStatus =
  | 'FIRING'
  | 'LOADING'
  | 'PREHEATING'
  | 'COOLING'
  | 'UNLOADING'
  | 'EMPTY';

export interface KilnChamberItem {
  chamberNo: number; // 1 to 24
  status: ChamberZoneStatus;
  bricksCapacity: number;
  coalUsedKg: number;
  temperatureC: number;
  sardarOrMistri: string;
  updatedDate: string;
  note?: string;
}

export interface BrickWastageRecord {
  id: string;
  date: string;
  stage: 'RAW_RAIN_DAMAGE' | 'RAW_FIELD_BREAKAGE' | 'CHULLI_OVERBURNT';
  millOrChamber: string;
  bricksLost: number;
  estimatedLossAmount: number;
  reason: string;
}

export interface StaffSalaryPaymentInstallment {
  id: string;
  date: string;
  amount: number;
  note?: string;
  paymentMethod?: string;
}

export interface MonthlyStaffSalaryRecord {
  id: string;
  staffName: string;
  designation: 'ম্যানেজার' | 'মুন্সি' | 'ক্যাশিয়ার' | 'নাইট গার্ড' | 'বাবুর্চি' | 'ড্রাইভার';
  phone: string;
  monthLabel: string; // e.g. '২০২৬-১১'
  monthlySalary: number;
  advanceDeducted: number;
  paidAmount: number;
  paymentDate: string;
  status: 'PAID' | 'PARTIAL' | 'DUE';
  note?: string;
  payments?: StaffSalaryPaymentInstallment[];
}

export interface LandLeaseContractRecord {
  id: string;
  landownerName: string;
  phone: string;
  mouzaOrLocation: string;
  landAreaBigha: number;
  contractedTrucks: number;
  deliveredTrucks: number;
  totalContractAmount: number;
  paidAmount: number;
  startDate: string;
  endDate: string;
  note?: string;
}

export interface KilnDamperRecord {
  id: string;
  afterLineNo: number; // 1 to 208 (e.g., damper placed after 5 lines, 7 lines, etc.)
  linesInBlock: number; // e.g., 5 or 7 lines covered in this damper block
  hasProtectiveGap: boolean; // gap left before next damper to prevent water/moisture damage
  status: 'ACTIVE_CLOSED' | 'OPENED_PASSED';
  sardarName: string;
  note?: string;
}

export type KilnLineZoneState =
  | 'UNLOADED'
  | 'FIRED_COOLING'
  | 'ACTIVE_FIRING'
  | 'RAW_LOADED_AHEAD'
  | 'EMPTY';

export interface FeedKilnLineSystemState {
  totalLines: number; // 208 lines in fixed chimney kiln
  bricksPerLine: number; // 4000 bricks per line
  fireStartLineNo: number; // যে লাইন থেকে আগুন শুরু হয়েছে (ডিফল্ট: ১৩৪ নং লাইন)
  startDirectionBn: string; // e.g., 'লাইন #১৩৪ থেকে আগুন ও পোড়ানো শুরু (চিমনির সোজাসোজি)'
  firedLinesCompleted: number; // কয় লাইন পোড়ানো শেষ (পিছনে থুয়ে এসেছে)
  unloadedLinesBehind: number; // পিছনে পোড়ানো লাইনের মধ্যে কয় লাইন আনলোড হয়েছে
  activeFiringLinesCount: number; // বর্তমানে কয় লাইনে আগুন চলছে / পোড়াচ্ছে
  rawLinesLoadedAhead: number; // সামনে ভ্যানে কত লাইন কাঁচা ইট লোড দেওয়া আছে
  coalUsedTons: number; // এই পোড়ানোয় কত টন কয়লা লাগলো
  woodUsedMaunds: number; // কত মণ কাঠ লাগলো
  firingDaysElapsed: number; // পোড়ানো শুরুর পর কত দিন হয়েছে
  expectedLinesPerDay: number; // প্রতিদিন আদর্শ কত লাইন পোড়ানোর কথা
  minSafeLoadAheadLines: number; // সামনে ন্যূনতম কত লাইন লোড থাকা নিরাপদ
  firemanMistriName: string;
  loadSardarName: string;
  dampers: KilnDamperRecord[];
  lineOverrides?: Record<number, KilnLineZoneState>; // নির্দিষ্ট লাইনে পপআপ থেকে দেওয়া কাস্টম অবস্থা
  vanBricksBaselineOffset?: number; // প্রথম থেকে (০ থেকে) রিসেট করলে পূর্বের ভ্যান লোড ইট অফসেট
  unloadLinesBaselineOffset?: number; // প্রথম থেকে (০ থেকে) রিসেট করলে পূর্বের আনলোড লাইন অফসেট
  recentlyClearedLines?: number[]; // নজরুল সর্দারের সর্বশেষ আনলোডে ফাঁকা হওয়া লাইন নম্বরসমূহ (ম্যাপ হাইলাইট)
  lastAutoUnloadConfirmation?: AutoUnloadConfirmationRecord | null; // নজরুল সর্দারের অটোমেটিক আনলোড কনফার্মেশন রেকর্ড
}

export interface AutoUnloadConfirmationRecord {
  id: string;
  sardarName: string;
  chamberOrRound: string;
  linesCleared: number;
  bricksDeducted: number;
  clearedStartLine: number;
  clearedEndLine: number;
  clearedLineNumbers: number[];
  activeFiringLinesResetToZero: boolean;
  updatedStockPieces: number;
  confirmedAt: string;
}

export interface SeasonWastageReconciliationConfig {
  seasonStatus: 'RUNNING_SEASON' | 'SEASON_ENDED';
  lastSeasonLabelBn: string;
  lastSeasonMillRawMade: number; // গত সিজনে মিল সর্দারদের মোট বানানো কাঁচা ইট
  lastSeasonBricksFired: number; // গত সিজনে চুল্লিতে মোট পোড়ানো ইট
  lastSeasonBricksSold: number; // গত সিজনে মোট বিক্রি হওয়া ইট (১ নং, পিকেট, ২ নং, আদলা মিলিয়ে)
  customCurrentMillRawOverride: number; // সিজন শেষে মোট বানানো কাঁচা ইট (0 হলে অটো মিল হিসাব থেকে)
  customCurrentFiredOverride: number; // সিজন শেষে মোট পোড়ানো ইট (0 হলে অটো চুল্লি হিসাব থেকে)
  rawBrickRatePerThousand: number; // কাঁচা ইট বানানোর হাজার প্রতি গড় রেট (ক্ষতির হিসাবের জন্য)
}

export interface EnterpriseOperationsState {
  activeRoundNo: number;
  roundStartDate: string;
  chambers: KilnChamberItem[];
  lineSystem?: FeedKilnLineSystemState;
  wastageRecords: BrickWastageRecord[];
  seasonWastageConfig?: SeasonWastageReconciliationConfig;
  staffSalaries: MonthlyStaffSalaryRecord[];
  landLeases: LandLeaseContractRecord[];
  ownerPin: string;
}

export function wrapKilnLineNo(lineNo: number, totalLines = 208): number {
  const safeTotal = Math.max(1, Math.round(totalLines) || 208);
  const n = Math.round(Number(lineNo) || 1);
  return ((((n - 1) % safeTotal) + safeTotal) % safeTotal) + 1;
}

export function getLineOffsetFromStart(
  lineNo: number,
  fireStartLineNo: number,
  totalLines = 208
): number {
  const safeTotal = Math.max(1, Math.round(totalLines) || 208);
  const normLine = wrapKilnLineNo(lineNo, safeTotal);
  const normStart = wrapKilnLineNo(fireStartLineNo, safeTotal);
  return (normLine - normStart + safeTotal) % safeTotal;
}

export function buildAutoUnloadConfirmation(params: {
  sardarName?: string;
  chamberOrRound?: string;
  fireStartLineNo: number;
  previousUnloadedLines: number;
  effectiveUnloadedLines: number;
  linesUnloadedInEntry: number;
  bricksPerLine?: number;
  updatedStockPieces?: number;
  totalLines?: number;
}): AutoUnloadConfirmationRecord {
  const safeTotal = Math.max(1, Math.round(params.totalLines || 208));
  const startLine = wrapKilnLineNo(params.fireStartLineNo || 1, safeTotal);
  const prevUnloaded = Math.max(0, Math.floor(params.previousUnloadedLines || 0));
  const nextUnloaded = Math.max(0, Math.floor(params.effectiveUnloadedLines || 0));
  const entryLines = Math.max(
    1,
    Math.floor(params.linesUnloadedInEntry || Math.max(1, nextUnloaded - prevUnloaded))
  );
  const bPerLine = Math.max(1, Math.round(params.bricksPerLine || 4000));
  const startOffset =
    nextUnloaded > prevUnloaded
      ? prevUnloaded
      : Math.max(0, nextUnloaded - entryLines);
  const countToHighlight = Math.min(safeTotal, Math.max(1, entryLines));
  const clearedLineNumbers: number[] = [];
  for (let i = 0; i < countToHighlight; i++) {
    clearedLineNumbers.push(wrapKilnLineNo(startLine + startOffset + i, safeTotal));
  }
  const clearedStartLine = clearedLineNumbers[0] || startLine;
  const clearedEndLine = clearedLineNumbers[clearedLineNumbers.length - 1] || startLine;

  return {
    id: `auto-unload-conf-${Date.now()}`,
    sardarName: (params.sardarName || 'নজরুল সর্দার').trim() || 'নজরুল সর্দার',
    chamberOrRound: (params.chamberOrRound || 'রাউন্ড-০১').trim() || 'রাউন্ড-০১',
    linesCleared: entryLines,
    bricksDeducted: Math.round(entryLines * bPerLine),
    clearedStartLine,
    clearedEndLine,
    clearedLineNumbers,
    activeFiringLinesResetToZero: true,
    updatedStockPieces: Math.max(0, Math.round(params.updatedStockPieces || 0)),
    confirmedAt: new Date().toISOString(),
  };
}

export function createDefaultFeedKilnLineSystem(
  isZeroInit = false
): FeedKilnLineSystemState {
  return {
    totalLines: 208,
    bricksPerLine: 4000,
    fireStartLineNo: 1,
    startDirectionBn: 'লাইন #১ থেকে আগুন ও পোড়ানো শুরু',
    firedLinesCompleted: isZeroInit ? 0 : 0,
    unloadedLinesBehind: isZeroInit ? 0 : 0,
    activeFiringLinesCount: isZeroInit ? 0 : 0,
    rawLinesLoadedAhead: isZeroInit ? 0 : 0,
    coalUsedTons: isZeroInit ? 0 : 0,
    woodUsedMaunds: isZeroInit ? 0 : 0,
    firingDaysElapsed: isZeroInit ? 0 : 0,
    expectedLinesPerDay: 3.5,
    minSafeLoadAheadLines: 12,
    firemanMistriName: 'আলতাফ সর্দার (পোড়াই মিস্ত্রি সর্দার)',
    loadSardarName: 'সেলিম সর্দার (ভ্যান লোড সর্দার)',
    dampers: [
      {
        id: 'dmp-1',
        afterLineNo: 5,
        linesInBlock: 5,
        hasProtectiveGap: true,
        status: 'ACTIVE_CLOSED',
        sardarName: 'সেলিম সর্দার',
        note: 'লাইন #৫ এর পর ১ম ৫ লাইনের ডাম্পার',
      },
      {
        id: 'dmp-2',
        afterLineNo: 12,
        linesInBlock: 7,
        hasProtectiveGap: true,
        status: 'ACTIVE_CLOSED',
        sardarName: 'সেলিম সর্দার',
        note: '৭ লাইনের ডাম্পার ও গ্যাপ',
      },
    ],
  };
}

export function normalizeFeedKilnLineSystem(
  rawState?: Partial<FeedKilnLineSystemState>
): FeedKilnLineSystemState {
  const base = createDefaultFeedKilnLineSystem(false);
  if (!rawState) return base;

  const fireStartLineNo = wrapKilnLineNo(Number(rawState.fireStartLineNo) || 1, 208);
  const dampers = Array.isArray(rawState.dampers) ? rawState.dampers : base.dampers;

  const rawOverrides = rawState.lineOverrides ? { ...rawState.lineOverrides } : {};
  const cleanedOverrides: Record<number, KilnLineZoneState> = {};
  const overrideKeys = Object.keys(rawOverrides);
  if (overrideKeys.length <= 30) {
    for (const k of overrideKeys) {
      const numK = Number(k);
      const val = rawOverrides[numK];
      if (val && val !== 'EMPTY') {
        cleanedOverrides[numK] = val;
      }
    }
  }

  return {
    ...base,
    ...rawState,
    fireStartLineNo,
    startDirectionBn:
      rawState.startDirectionBn || `লাইন #${formatBn(fireStartLineNo)} থেকে আগুন ও পোড়ানো শুরু`,
    dampers,
    lineOverrides: cleanedOverrides,
  };
}

export function createDefaultChambers(todayDate: string): KilnChamberItem[] {
  const list: KilnChamberItem[] = [];
  for (let i = 1; i <= 24; i++) {
    let status: ChamberZoneStatus = 'EMPTY';
    let temp = 35;
    let coal = 0;
    let sardar = 'আলতাফ সর্দার';

    if (i >= 1 && i <= 4) {
      status = 'UNLOADING';
      temp = 55;
      coal = 1400;
      sardar = 'নজরুল সর্দার';
    } else if (i >= 5 && i <= 8) {
      status = 'COOLING';
      temp = 240;
      coal = 1550;
      sardar = 'আলতাফ সর্দার';
    } else if (i >= 9 && i <= 12) {
      status = 'FIRING';
      temp = 980;
      coal = 1850;
      sardar = 'আলতাফ সর্দার';
    } else if (i >= 13 && i <= 16) {
      status = 'PREHEATING';
      temp = 420;
      coal = 600;
      sardar = 'আলতাফ সর্দার';
    } else if (i >= 17 && i <= 20) {
      status = 'LOADING';
      temp = 34;
      coal = 0;
      sardar = 'সেলিম সর্দার';
    } else {
      status = 'EMPTY';
      temp = 31;
      coal = 0;
      sardar = 'প্রস্তুত';
    }

    list.push({
      chamberNo: i,
      status,
      bricksCapacity: status === 'EMPTY' ? 0 : 18000,
      coalUsedKg: coal,
      temperatureC: temp,
      sardarOrMistri: sardar,
      updatedDate: todayDate,
    });
  }
  return list;
}

export function createInitialEnterpriseState(todayDate = '2026-11-01'): EnterpriseOperationsState {
  return {
    activeRoundNo: 1,
    roundStartDate: todayDate,
    chambers: createDefaultChambers(todayDate),
    lineSystem: createDefaultFeedKilnLineSystem(false),
    wastageRecords: [
      {
        id: 'wastage-1',
        date: todayDate,
        stage: 'RAW_RAIN_DAMAGE',
        millOrChamber: '১ নং ওহাব মিল মাঠ',
        bricksLost: 1200,
        estimatedLossAmount: 3600,
        reason: 'হঠাৎ বৃষ্টিতে কাঁচা ইটের লাইন গলে ক্ষতিগ্রস্ত',
      },
      {
        id: 'wastage-2',
        date: todayDate,
        stage: 'CHULLI_OVERBURNT',
        millOrChamber: 'চেম্বার নং ০৩ (রাউন্ড-০২)',
        bricksLost: 650,
        estimatedLossAmount: 4550,
        reason: 'চুল্লির নিচের লাইনে অতিরিক্ত তাপে গামা/রাবিশ',
      },
    ],
    staffSalaries: [
      {
        id: 'staff-1',
        staffName: 'মোঃ রফিকুল ইসলাম',
        designation: 'ম্যানেজার',
        phone: '01712-445566',
        monthLabel: todayDate.slice(0, 7),
        monthlySalary: 22000,
        advanceDeducted: 2000,
        paidAmount: 20000,
        paymentDate: todayDate,
        status: 'PAID',
        note: 'মাসিক বেতন পরিশোধিত',
      },
      {
        id: 'staff-2',
        staffName: 'আব্দুল কাদের মুন্সি',
        designation: 'মুন্সি',
        phone: '01914-889900',
        monthLabel: todayDate.slice(0, 7),
        monthlySalary: 16000,
        advanceDeducted: 3000,
        paidAmount: 8000,
        paymentDate: todayDate,
        status: 'PARTIAL',
        note: 'অবশিষ্ট বেতন মাসের শেষে প্রদেয়',
      },
      {
        id: 'staff-3',
        staffName: 'হাসান আলী গার্ড',
        designation: 'নাইট গার্ড',
        phone: '01819-332211',
        monthLabel: todayDate.slice(0, 7),
        monthlySalary: 11000,
        advanceDeducted: 0,
        paidAmount: 0,
        paymentDate: todayDate,
        status: 'DUE',
        note: 'রাতের ডিউটি',
      },
    ],
    landLeases: [
      {
        id: 'lease-1',
        landownerName: 'হাজী মোজাম্মেল হক',
        phone: '01715-667788',
        mouzaOrLocation: 'বাবুলিয়া দক্ষিণ বিল, দাগ নং ৪১২',
        landAreaBigha: 4.5,
        contractedTrucks: 350,
        deliveredTrucks: 215,
        totalContractAmount: 180000,
        paidAmount: 120000,
        startDate: '2026-10-01',
        endDate: '2027-04-30',
        note: 'মিষ্টি এঁটেল মাটি কাটার সিজন চুক্তি',
      },
      {
        id: 'lease-2',
        landownerName: 'আলহাজ্ব শামসুর রহমান',
        phone: '01911-223344',
        mouzaOrLocation: 'দেবনগর মাঠ, সাতক্ষীরা সদর',
        landAreaBigha: 3.0,
        contractedTrucks: 220,
        deliveredTrucks: 220,
        totalContractAmount: 110000,
        paidAmount: 110000,
        startDate: '2026-09-15',
        endDate: '2027-03-30',
        note: 'সম্পূর্ণ মাটি ভাটায় আনা সম্পন্ন',
      },
    ],
    ownerPin: '1234',
  };
}

export function createEmptyEnterpriseState(todayDate = '2026-11-01'): EnterpriseOperationsState {
  const emptyChambers: KilnChamberItem[] = [];
  for (let i = 1; i <= 24; i++) {
    emptyChambers.push({
      chamberNo: i,
      status: 'EMPTY',
      bricksCapacity: 0,
      coalUsedKg: 0,
      temperatureC: 30,
      sardarOrMistri: 'প্রস্তুত',
      updatedDate: todayDate,
    });
  }
  return {
    activeRoundNo: 1,
    roundStartDate: todayDate,
    chambers: emptyChambers,
    lineSystem: createDefaultFeedKilnLineSystem(true),
    wastageRecords: [],
    staffSalaries: [],
    landLeases: [],
    ownerPin: '1234',
  };
}

export function computeKilnChamberSummary(chambers: KilnChamberItem[]) {
  const counts: Record<ChamberZoneStatus, number> = {
    FIRING: 0,
    LOADING: 0,
    PREHEATING: 0,
    COOLING: 0,
    UNLOADING: 0,
    EMPTY: 0,
  };
  let totalBricksInKiln = 0;
  let totalCoalUsedKg = 0;
  let maxFiringTempC = 0;

  for (const ch of chambers) {
    counts[ch.status] = (counts[ch.status] || 0) + 1;
    totalBricksInKiln += Math.max(0, Number(ch.bricksCapacity) || 0);
    totalCoalUsedKg += Math.max(0, Number(ch.coalUsedKg) || 0);
    if (ch.temperatureC > maxFiringTempC) {
      maxFiringTempC = ch.temperatureC;
    }
  }

  return {
    counts,
    totalBricksInKiln,
    totalCoalUsedKg,
    totalCoalTons: Math.round((totalCoalUsedKg / 1000) * 100) / 100,
    maxFiringTempC,
  };
}

export function computeBrickWastageSummary(
  records: BrickWastageRecord[],
  totalRawBricksCut: number
) {
  let rawRainLost = 0;
  let rawBreakageLost = 0;
  let chulliOverburntLost = 0;
  let totalEstimatedLossAmount = 0;

  for (const rec of records) {
    const qty = Math.max(0, Number(rec.bricksLost) || 0);
    const loss = Math.max(0, Number(rec.estimatedLossAmount) || 0);
    totalEstimatedLossAmount += loss;
    if (rec.stage === 'RAW_RAIN_DAMAGE') rawRainLost += qty;
    else if (rec.stage === 'RAW_FIELD_BREAKAGE') rawBreakageLost += qty;
    else chulliOverburntLost += qty;
  }

  const totalBricksLost = rawRainLost + rawBreakageLost + chulliOverburntLost;
  const baseProduced = Math.max(totalRawBricksCut, totalBricksLost, 1);
  const wastagePct =
    totalRawBricksCut > 0 || totalBricksLost > 0
      ? Math.round((totalBricksLost / baseProduced) * 1000) / 10
      : 0;

  return {
    rawRainLost,
    rawBreakageLost,
    chulliOverburntLost,
    totalBricksLost,
    totalEstimatedLossAmount,
    wastagePct,
  };
}

export function createDefaultSeasonWastageConfig(): SeasonWastageReconciliationConfig {
  return {
    seasonStatus: 'RUNNING_SEASON',
    lastSeasonLabelBn: 'গত সিজন (২০২৫–২৬ চূড়ান্ত হিসাব)',
    lastSeasonMillRawMade: 2450000,
    lastSeasonBricksFired: 2340000,
    lastSeasonBricksSold: 2285000,
    customCurrentMillRawOverride: 0,
    customCurrentFiredOverride: 0,
    rawBrickRatePerThousand: 1200,
  };
}

export function computeSeasonWastageReconciliation(params: {
  config?: Partial<SeasonWastageReconciliationConfig>;
  liveMillRawCut: number;
  liveChulliFiredOrLoaded: number;
  liveBricksSoldAllGrades: number;
  manualWastageRecords?: BrickWastageRecord[];
}) {
  const cfg = {
    ...createDefaultSeasonWastageConfig(),
    ...(params.config || {}),
  };

  // 1. Last Season Benchmark (এটা নির্ভর করবে লাস্ট সিজনের ওপর)
  const lastMade = Math.max(0, Math.round(Number(cfg.lastSeasonMillRawMade) || 0));
  const lastFired = Math.max(0, Math.round(Number(cfg.lastSeasonBricksFired) || 0));
  const lastSold = Math.max(0, Math.round(Number(cfg.lastSeasonBricksSold) || 0));

  // কতটা ইট মিল সর্দারেরা বানালো এবং কতটা ইট আমরা পোড়ালাম, এর মাঝে কতটা নষ্ট হলো
  const lastRawLostInFieldOrRain = Math.max(0, lastMade - lastFired);
  const lastRawWastagePct =
    lastMade > 0 ? Math.round((lastRawLostInFieldOrRain / lastMade) * 1000) / 10 : 0;

  const lastChulliOverburntOrUnsold = Math.max(0, lastFired - lastSold);
  const lastChulliWastagePct =
    lastFired > 0 ? Math.round((lastChulliOverburntOrUnsold / lastFired) * 1000) / 10 : 0;

  const lastTotalLost = lastRawLostInFieldOrRain + lastChulliOverburntOrUnsold;
  const lastTotalWastagePct =
    lastMade > 0 ? Math.round((lastTotalLost / lastMade) * 1000) / 10 : 0;
  const lastEstimatedLossTk = Math.round(
    (lastRawLostInFieldOrRain / 1000) * (cfg.rawBrickRatePerThousand || 1200)
  );

  // 2. Current Season Live / Season-End Reconciliation
  // (সিজন শেষে যখন তারা বানানো শেষ করবে এবং পোড়ানো শেষ হবে তখন বোঝা যাবে)
  const currentMillRawMade =
    cfg.customCurrentMillRawOverride > 0
      ? Math.round(cfg.customCurrentMillRawOverride)
      : Math.max(0, Math.round(Number(params.liveMillRawCut) || 0));

  const currentBricksFired =
    cfg.customCurrentFiredOverride > 0
      ? Math.round(cfg.customCurrentFiredOverride)
      : Math.max(0, Math.round(Number(params.liveChulliFiredOrLoaded) || 0));

  const currentBricksSold = Math.max(
    0,
    Math.round(Number(params.liveBricksSoldAllGrades) || 0)
  );

  const manualSummary = computeBrickWastageSummary(
    params.manualWastageRecords || [],
    currentMillRawMade
  );

  // মাঝখানে পার্থক্য (মিল বানানো - চুল্লিতে পোড়ানো)
  const currentRawGapBricks = Math.max(0, currentMillRawMade - currentBricksFired);
  const currentRawGapPct =
    currentMillRawMade > 0
      ? Math.round((currentRawGapBricks / currentMillRawMade) * 1000) / 10
      : 0;

  const currentChulliGapBricks = Math.max(0, currentBricksFired - currentBricksSold);
  const currentEstimatedLossTk = Math.round(
    (currentRawGapBricks / 1000) * (cfg.rawBrickRatePerThousand || 1200)
  );

  const isSeasonEnded = cfg.seasonStatus === 'SEASON_ENDED';

  return {
    config: cfg,
    isSeasonEnded,
    // Last Season Final Numbers
    lastSeason: {
      labelBn: cfg.lastSeasonLabelBn,
      millRawMade: lastMade,
      bricksFired: lastFired,
      bricksSold: lastSold,
      rawLostInFieldOrRain: lastRawLostInFieldOrRain,
      rawWastagePct: lastRawWastagePct,
      chulliOverburntLost: lastChulliOverburntOrUnsold,
      chulliWastagePct: lastChulliWastagePct,
      totalLost: lastTotalLost,
      totalWastagePct: lastTotalWastagePct,
      estimatedLossTk: lastEstimatedLossTk,
    },
    // Current Season Numbers
    currentSeason: {
      millRawMade: currentMillRawMade,
      bricksFired: currentBricksFired,
      bricksSold: currentBricksSold,
      rawGapOrLostBricks: currentRawGapBricks,
      rawGapOrLostPct: currentRawGapPct,
      chulliGapOrRemainingBricks: currentChulliGapBricks,
      estimatedLossTk: currentEstimatedLossTk,
      manualLoggedLostBricks: manualSummary.totalBricksLost,
      manualLoggedLossTk: manualSummary.totalEstimatedLossAmount,
    },
  };
}

export function calculateStaffSalaryPayable(
  monthlySalary: number,
  advanceDeducted: number,
  paidAmount: number
) {
  const sal = Math.max(0, Math.round(Number(monthlySalary) || 0));
  const adv = Math.max(0, Math.round(Number(advanceDeducted) || 0));
  const paid = Math.max(0, Math.round(Number(paidAmount) || 0));
  const netPayableAfterAdvance = Math.max(0, sal - adv);
  const remainingDue = Math.max(0, netPayableAfterAdvance - paid);
  const status: 'PAID' | 'PARTIAL' | 'DUE' =
    remainingDue === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE';

  return {
    monthlySalary: sal,
    advanceDeducted: adv,
    netPayableAfterAdvance,
    paidAmount: paid,
    remainingDue,
    status,
  };
}

export function computeLandLeaseSummary(records: LandLeaseContractRecord[]) {
  let totalAreaBigha = 0;
  let totalContractedTrucks = 0;
  let totalDeliveredTrucks = 0;
  let totalContractAmount = 0;
  let totalPaidAmount = 0;

  for (const r of records) {
    totalAreaBigha += Math.max(0, Number(r.landAreaBigha) || 0);
    totalContractedTrucks += Math.max(0, Number(r.contractedTrucks) || 0);
    totalDeliveredTrucks += Math.max(0, Number(r.deliveredTrucks) || 0);
    totalContractAmount += Math.max(0, Number(r.totalContractAmount) || 0);
    totalPaidAmount += Math.max(0, Number(r.paidAmount) || 0);
  }

  const totalDueAmount = Math.max(0, totalContractAmount - totalPaidAmount);
  const remainingTrucks = Math.max(0, totalContractedTrucks - totalDeliveredTrucks);
  const completionPct =
    totalContractedTrucks > 0
      ? Math.min(100, Math.round((totalDeliveredTrucks / totalContractedTrucks) * 100))
      : 0;

  return {
    totalAreaBigha: Math.round(totalAreaBigha * 100) / 100,
    totalContractedTrucks,
    totalDeliveredTrucks,
    remainingTrucks,
    totalContractAmount,
    totalPaidAmount,
    totalDueAmount,
    completionPct,
  };
}

export function buildDailyWhatsAppClosingSummary(
  dbState: KilnDatabaseState,
  metrics: DashboardMetrics,
  lang: LanguageMode = 'bn'
): string {
  const todayRawCut = (dbState.millPots || [])
    .filter((p) => p.date === metrics.todayDate)
    .reduce((s, p) => s + (Number(p.rawBricksCut) || 0), 0);

  if (lang === 'en') {
    const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(Math.round(n));
    return [
      `📊 *SBL Sweet Clay Bricks (Babulia, Satkhira) — Daily Closing Report*`,
      `📅 Date: ${metrics.todayDate}`,
      `────────────────────`,
      `🧱 Today Bricks Sold: ${fmt(metrics.todayBricksSold)} pcs (${metrics.todaySalesMemoCount} memos)`,
      `💰 Today Sales Bill: Tk ${fmt(metrics.todaySalesAmount)}`,
      `💵 Today Cash Collection: Tk ${fmt(metrics.todayCashIn)}`,
      `📉 Today Expenses: Tk ${fmt(metrics.todayExpense)}`,
      `🏦 Current Cash in Hand: Tk ${fmt(metrics.currentCashBalance)}`,
      `📌 Total Customer Due: Tk ${fmt(metrics.totalCustomerDue)}`,
      `🏭 Today Raw Bricks Produced: ${fmt(todayRawCut)} pcs`,
      `📦 Fired Brick Stock: ${fmt(metrics.totalBrickStockPieces)} pcs`,
      `────────────────────`,
      `✅ Babulia, Satkhira Sadar`,
    ].join('\n');
  }

  return [
    `📊 *SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা) — দৈনিক ক্লোজিং সামারি*`,
    `📅 তারিখ: ${metrics.todayDate}`,
    `────────────────────`,
    `🧱 আজকের ইট বিক্রি: ${formatBn(metrics.todayBricksSold)} পিস (${formatBn(metrics.todaySalesMemoCount)}টি মেমো)`,
    `💰 আজকের বিক্রয় বিল: ${formatCurrencyBn(metrics.todaySalesAmount)}`,
    `💵 আজকের নগদ আদায়: ${formatCurrencyBn(metrics.todayCashIn)}`,
    `📉 আজকের মোট খরচ: ${formatCurrencyBn(metrics.todayExpense)}`,
    `🏦 বর্তমান নগদ তহবিল: ${formatCurrencyBn(metrics.currentCashBalance)}`,
    `📌 মোট ক্রেতা বকেয়া: ${formatCurrencyBn(metrics.totalCustomerDue)}`,
    `🏭 আজকের কাঁচা ইট উৎপাদন: ${formatBn(todayRawCut)} পিস`,
    `📦 বর্তমান পাকা ইট স্টক: ${formatBn(metrics.totalBrickStockPieces)} পিস`,
    `────────────────────`,
    `✅ বাবুলিয়া, সাতক্ষীরা সদর`,
  ].join('\n');
}

export interface FeedKilnLineStatusReport {
  totalLines: number;
  bricksPerLine: number;
  totalKilnCapacityBricks: number;
  fireStartLineNo: number;
  startDirectionBn: string;
  firedLinesCompleted: number;
  firedStartLine: number;
  firedEndLine: number;
  firedBricksCompleted: number;
  unloadedLinesBehind: number;
  unloadedStartLine: number;
  unloadedEndLine: number;
  unloadedBricksBehind: number;
  coolingBehindLines: number;
  coolingBehindBricks: number;
  activeFiringLinesCount: number;
  activeFiringStartLine: number;
  activeFiringEndLine: number;
  activeFiringBricks: number;
  rawLinesLoadedAhead: number;
  rawLoadedAheadStartLine: number;
  rawLoadedAheadEndLine: number;
  rawBricksLoadedAhead: number;
  totalLoadedLines: number;
  totalLoadedBricks: number;
  emptyLinesRemaining: number;
  currentFireSectorBn: string;
  coalUsedTons: number;
  woodUsedMaunds: number;
  coalPerLineKg: number;
  coalPerLakhTons: number;
  woodPerLineMaunds: number;
  firingDaysElapsed: number;
  expectedLinesPerDay: number;
  expectedLinesByNow: number;
  actualLinesPerDay: number;
  linePaceDelta: number;
  paceStatus: 'AHEAD' | 'ON_TIME' | 'SLOW_SHIRKING' | 'NOT_STARTED';
  paceAlertTitleBn: string;
  paceAlertDetailBn: string;
  frontLoadStatus: 'SAFE' | 'WARNING_LOW' | 'CRITICAL_LOW';
  frontLoadTitleBn: string;
  frontLoadDetailBn: string;
  activeDampersCount: number;
  passedDampersCount: number;
  dampersWithGapCount: number;
  lineOverrides?: Record<number, KilnLineZoneState>;
  // Automatic Van Load (4,000 bricks = 1 line) & Unload Line Sync fields
  autoVanLoadedBricks?: number;
  autoVanFullLines?: number;
  partialBricksInNextLine?: number;
  partialLoadLineNo?: number;
  reloadedLinesInNewRound?: number;
  autoLedgerUnloadedLines?: number;
  // Round tracking (১ম রাউন্ড, ২য় রাউন্ড ইত্যাদি)
  loadRoundNo: number;
  loadRoundLabelBn: string;
  fireRoundNo: number;
  fireRoundLabelBn: string;
  unloadRoundNo: number;
  unloadRoundLabelBn: string;
  clearedLineNumbers: number[];
  recentlyClearedLines: number[];
  lastAutoUnloadConfirmation?: AutoUnloadConfirmationRecord | null;
}

export function getKilnRoundLabelBn(roundNo: number): string {
  const r = Math.max(1, Math.round(roundNo) || 1);
  if (r === 1) return '১ম রাউন্ড';
  if (r === 2) return '২য় রাউন্ড';
  if (r === 3) return '৩য় রাউন্ড';
  return `${formatBn(r)}র্থ রাউন্ড`;
}

export function getFeedKilnLineZoneState(
  lineNo: number,
  status: Pick<
    FeedKilnLineStatusReport,
    | 'totalLines'
    | 'fireStartLineNo'
    | 'unloadedLinesBehind'
    | 'firedLinesCompleted'
    | 'activeFiringLinesCount'
    | 'rawLinesLoadedAhead'
    | 'lineOverrides'
    | 'reloadedLinesInNewRound'
  >
): KilnLineZoneState {
  const override = status.lineOverrides?.[lineNo];
  if (override) {
    return override;
  }
  const posIndex =
    getLineOffsetFromStart(lineNo, status.fireStartLineNo, status.totalLines) + 1;
  const reloadedInNewRound = Math.max(0, Number(status.reloadedLinesInNewRound) || 0);
  if (reloadedInNewRound > 0 && posIndex <= reloadedInNewRound) {
    // Round wrapped around: previously unloaded lines starting from fireStartLineNo are now reloaded with raw bricks
    return 'RAW_LOADED_AHEAD';
  }
  if (posIndex <= status.unloadedLinesBehind) return 'UNLOADED';
  if (posIndex <= status.firedLinesCompleted) return 'FIRED_COOLING';
  if (posIndex <= status.firedLinesCompleted + status.activeFiringLinesCount) {
    return 'ACTIVE_FIRING';
  }
  if (
    posIndex <=
    status.firedLinesCompleted +
      status.activeFiringLinesCount +
      status.rawLinesLoadedAhead
  ) {
    return 'RAW_LOADED_AHEAD';
  }
  return 'EMPTY';
}

export function computeFeedKilnLineSystemStatus(
  rawState?: Partial<FeedKilnLineSystemState>,
  liveLedgerSync?: {
    totalVanLoadedBricks?: number;
    totalUnloadedLines?: number;
    totalUnloadedBricks?: number;
  }
): FeedKilnLineStatusReport {
  const s = normalizeFeedKilnLineSystem(rawState);

  const totalLines = 208;
  const bricksPerLine = 4000;
  const totalKilnCapacityBricks = totalLines * bricksPerLine; // 8,32,000
  const fireStartLineNo = wrapKilnLineNo(Number(s.fireStartLineNo) || 1, totalLines);
  const lineOverrides = s.lineOverrides ? { ...s.lineOverrides } : {};
  const hasOverrides = Object.keys(lineOverrides).length > 0;

  // Auto-sync from Van Load (ভ্যান হিসাব: ৪০০০ পিস ইট পূর্ণ হলে = ১টি লাইন পূর্ণ) & Unload Ledger (আনলোড হিসাব — নজরুল সর্দার)
  const rawVanLoadedBricks = Math.max(0, Math.round(Number(liveLedgerSync?.totalVanLoadedBricks) || 0));
  const vanBaselineOffset = Math.max(0, Math.round(Number(s.vanBricksBaselineOffset) || 0));
  const autoVanLoadedBricks = Math.max(0, rawVanLoadedBricks - vanBaselineOffset);
  const autoVanFullLines = Math.floor(autoVanLoadedBricks / bricksPerLine);
  const partialBricksInNextLine = autoVanLoadedBricks % bricksPerLine;

  const autoUnloadedBricks = Math.max(0, Math.round(Number(liveLedgerSync?.totalUnloadedBricks) || 0));
  const rawLedgerUnloadedLines = Math.floor(Number(liveLedgerSync?.totalUnloadedLines) || 0);
  const normalizedLedgerUnloadedLines =
    rawLedgerUnloadedLines >= 500
      ? Math.floor(rawLedgerUnloadedLines / bricksPerLine)
      : rawLedgerUnloadedLines;
  const unloadBaselineOffset = Math.max(0, Math.round(Number(s.unloadLinesBaselineOffset) || 0));
  const autoLedgerUnloadedLines = Math.max(
    0,
    Math.max(normalizedLedgerUnloadedLines, Math.floor(autoUnloadedBricks / bricksPerLine)) -
      unloadBaselineOffset
  );

  // Unload sync: If live ledger sync (নজরুল সর্দার) has unloaded lines, it authoritatively drives unloaded lines starting from fireStartLineNo
  const cumulativeUnloadedLines = Math.max(
    Math.round(Number(s.unloadedLinesBehind) || 0),
    autoLedgerUnloadedLines
  );

  // Fired lines must be at least as far as unloaded lines
  const cumulativeFiredLines = Math.max(
    cumulativeUnloadedLines,
    Math.round(Number(s.firedLinesCompleted) || 0)
  );

  // Wrap cumulative unloaded and fired lines into the current 208-line round
  let unloadedLinesBehind =
    cumulativeUnloadedLines > totalLines
      ? ((cumulativeUnloadedLines - 1) % totalLines) + 1
      : cumulativeUnloadedLines;

  let firedLinesCompleted =
    cumulativeFiredLines > totalLines
      ? Math.max(unloadedLinesBehind, ((cumulativeFiredLines - 1) % totalLines) + 1)
      : Math.max(unloadedLinesBehind, cumulativeFiredLines);

  let activeFiringLinesCount = Math.min(
    Math.max(0, totalLines - firedLinesCompleted),
    Math.max(0, Math.round(Number(s.activeFiringLinesCount) || 0))
  );

  // Raw lines loaded ahead:
  // Never double-count manual rawLinesLoadedAhead on top of autoVanFullLines!
  // When activeFiringLinesCount is 0 (standard Van Load + Unload mode), unloaded/fired lines are deducted directly from currentRoundVanFullLines.
  const alreadyBurnedOrFiringLines = firedLinesCompleted + activeFiringLinesCount;
  const currentRoundVanFullLines =
    autoVanFullLines > totalLines
      ? ((autoVanFullLines - 1) % totalLines) + 1
      : autoVanFullLines;
  const manualRawLinesAhead = Math.max(0, Math.round(Number(s.rawLinesLoadedAhead) || 0));
  const effectiveVanAheadLines =
    activeFiringLinesCount === 0 && currentRoundVanFullLines > 0
      ? Math.max(0, currentRoundVanFullLines - firedLinesCompleted)
      : currentRoundVanFullLines;
  const manualUnloaded = Math.max(0, Math.round(Number(s.unloadedLinesBehind) || 0));
  const newlyUnloadedFromLedger =
    autoVanFullLines === 0 && autoLedgerUnloadedLines > manualUnloaded
      ? autoLedgerUnloadedLines - manualUnloaded
      : 0;
  const effectiveManualAheadLines = Math.max(0, manualRawLinesAhead - newlyUnloadedFromLedger);
  let rawLinesLoadedAhead = Math.min(
    Math.max(0, totalLines - alreadyBurnedOrFiringLines),
    autoVanFullLines > 0
      ? effectiveVanAheadLines
      : Math.max(effectiveVanAheadLines, effectiveManualAheadLines)
  );

  // Round tracking (প্রতি ২০৮ লাইন = ১ রাউন্ড)
  const effectiveTotalVanLines =
    autoVanFullLines >= totalLines
      ? autoVanFullLines
      : alreadyBurnedOrFiringLines + rawLinesLoadedAhead;
  const loadRoundNo = Math.floor(effectiveTotalVanLines / totalLines) + 1;
  const fireRoundNo = Math.floor(cumulativeFiredLines / totalLines) + 1;
  const unloadRoundNo = Math.floor(cumulativeUnloadedLines / totalLines) + 1;
  const loadRoundLabelBn = getKilnRoundLabelBn(loadRoundNo);
  const fireRoundLabelBn = getKilnRoundLabelBn(fireRoundNo);
  const unloadRoundLabelBn = getKilnRoundLabelBn(unloadRoundNo);

  // If Van Load exceeds 208 lines (round wraps around), excess lines reload over unloaded lines starting at fireStartLineNo
  const reloadedLinesInNewRound =
    effectiveTotalVanLines > totalLines
      ? effectiveTotalVanLines % totalLines
      : 0;

  let firedStartLine = firedLinesCompleted > 0 ? fireStartLineNo : 0;
  let firedEndLine =
    firedLinesCompleted > 0
      ? wrapKilnLineNo(fireStartLineNo + firedLinesCompleted - 1, totalLines)
      : 0;

  let unloadedStartLine =
    unloadedLinesBehind > reloadedLinesInNewRound
      ? wrapKilnLineNo(fireStartLineNo + reloadedLinesInNewRound, totalLines)
      : unloadedLinesBehind > 0
      ? fireStartLineNo
      : 0;
  let unloadedEndLine =
    unloadedLinesBehind > 0
      ? wrapKilnLineNo(fireStartLineNo + unloadedLinesBehind - 1, totalLines)
      : 0;

  let activeFiringStartLine =
    activeFiringLinesCount > 0
      ? wrapKilnLineNo(fireStartLineNo + firedLinesCompleted, totalLines)
      : 0;
  let activeFiringEndLine =
    activeFiringLinesCount > 0
      ? wrapKilnLineNo(
          fireStartLineNo + firedLinesCompleted + activeFiringLinesCount - 1,
          totalLines
        )
      : 0;

  let rawLoadedAheadStartLine =
    rawLinesLoadedAhead > 0
      ? wrapKilnLineNo(
          fireStartLineNo + firedLinesCompleted + activeFiringLinesCount,
          totalLines
        )
      : reloadedLinesInNewRound > 0
      ? fireStartLineNo
      : 0;
  let rawLoadedAheadEndLine =
    reloadedLinesInNewRound > 0
      ? wrapKilnLineNo(fireStartLineNo + reloadedLinesInNewRound - 1, totalLines)
      : rawLinesLoadedAhead > 0
      ? wrapKilnLineNo(
          fireStartLineNo +
            firedLinesCompleted +
            activeFiringLinesCount +
            rawLinesLoadedAhead -
            1,
          totalLines
        )
      : 0;

  if (hasOverrides && autoVanLoadedBricks === 0 && autoLedgerUnloadedLines === 0) {
    const baseLookup = {
      totalLines,
      fireStartLineNo,
      unloadedLinesBehind,
      firedLinesCompleted,
      activeFiringLinesCount,
      rawLinesLoadedAhead,
      lineOverrides,
      reloadedLinesInNewRound,
    };
    const unloadedLinesList: number[] = [];
    const firedCoolingLinesList: number[] = [];
    const activeFiringLinesList: number[] = [];
    const rawLoadedLinesList: number[] = [];

    for (let offset = 0; offset < totalLines; offset++) {
      const lNo = wrapKilnLineNo(fireStartLineNo + offset, totalLines);
      const st = getFeedKilnLineZoneState(lNo, baseLookup);
      if (st === 'UNLOADED') unloadedLinesList.push(lNo);
      else if (st === 'FIRED_COOLING') firedCoolingLinesList.push(lNo);
      else if (st === 'ACTIVE_FIRING') activeFiringLinesList.push(lNo);
      else if (st === 'RAW_LOADED_AHEAD') rawLoadedLinesList.push(lNo);
    }

    const allFiredDone = [...unloadedLinesList, ...firedCoolingLinesList];
    firedLinesCompleted = allFiredDone.length;
    firedStartLine = allFiredDone[0] || 0;
    firedEndLine = allFiredDone[allFiredDone.length - 1] || 0;

    unloadedLinesBehind = unloadedLinesList.length;
    unloadedStartLine = unloadedLinesList[0] || 0;
    unloadedEndLine = unloadedLinesList[unloadedLinesList.length - 1] || 0;

    activeFiringLinesCount = activeFiringLinesList.length;
    activeFiringStartLine = activeFiringLinesList[0] || 0;
    activeFiringEndLine = activeFiringLinesList[activeFiringLinesList.length - 1] || 0;

    rawLinesLoadedAhead = rawLoadedLinesList.length;
    rawLoadedAheadStartLine = rawLoadedLinesList[0] || 0;
    rawLoadedAheadEndLine = rawLoadedLinesList[rawLoadedLinesList.length - 1] || 0;
  }

  const firedBricksCompleted = firedLinesCompleted * bricksPerLine;
  const effectiveUnloadedBricks =
    autoUnloadedBricks > 0
      ? Math.max(0, autoUnloadedBricks - unloadBaselineOffset * bricksPerLine)
      : 0;
  const unloadedBricksBehind = Math.max(
    unloadedLinesBehind * bricksPerLine,
    effectiveUnloadedBricks
  );
  const coolingBehindLines = Math.max(0, firedLinesCompleted - unloadedLinesBehind);
  const coolingBehindBricks = coolingBehindLines * bricksPerLine;
  const activeFiringBricks = activeFiringLinesCount * bricksPerLine;
  const rawBricksLoadedAhead =
    (rawLinesLoadedAhead + reloadedLinesInNewRound) * bricksPerLine;

  // Gross cumulative lines touched in this round vs Active lines remaining in the kiln (after deducting Nazrul Sardar's unloaded lines)
  const grossSpanLines = Math.min(
    totalLines,
    firedLinesCompleted + activeFiringLinesCount + rawLinesLoadedAhead
  );
  const totalLoadedLines = Math.min(
    totalLines,
    coolingBehindLines + activeFiringLinesCount + rawLinesLoadedAhead + reloadedLinesInNewRound
  );
  const grossBricksInCycle =
    (firedLinesCompleted + activeFiringLinesCount + rawLinesLoadedAhead + reloadedLinesInNewRound) *
      bricksPerLine +
    partialBricksInNextLine;
  const totalLoadedBricks = Math.max(0, grossBricksInCycle - unloadedBricksBehind);
  const emptyLinesRemaining = Math.max(0, totalLines - totalLoadedLines);
  const partialLoadLineNo =
    partialBricksInNextLine > 0
      ? wrapKilnLineNo(
          fireStartLineNo +
            (effectiveTotalVanLines < totalLines ? grossSpanLines : reloadedLinesInNewRound),
          totalLines
        )
      : 0;

  // Determine which section of the 208-line elongated oval (stadium) kiln the fire is currently on
  const refLine = activeFiringStartLine || firedEndLine || fireStartLineNo;
  let currentFireSectorBn = 'পূর্ব লম্বা সাইড — চিমনির সোজাসোজি (লাইন ১–৭৪)';
  if (refLine > 178) {
    currentFireSectorBn = 'দক্ষিণ মাথার গোল রাউন্ড বাঁক (লাইন ১৭৯–২০৮)';
  } else if (refLine > 104) {
    currentFireSectorBn = 'পশ্চিম লম্বা সাইড — চিমনির সোজাসোজি অংশ (লাইন ১০৫–১৭৮)';
  } else if (refLine > 74) {
    currentFireSectorBn = 'উত্তর মাথার গোল রাউন্ড বাঁক (লাইন ৭৫–১০৪)';
  }

  // Fuel metrics
  const coalUsedTons = Math.max(0, Number(s.coalUsedTons) || 0);
  const woodUsedMaunds = Math.max(0, Number(s.woodUsedMaunds) || 0);
  const effectiveLinesBurned = Math.max(
    0,
    firedLinesCompleted + activeFiringLinesCount * 0.5
  );
  const coalPerLineKg =
    effectiveLinesBurned > 0
      ? Math.round((coalUsedTons * 1000) / effectiveLinesBurned)
      : 0;
  const effectiveLakhs = (effectiveLinesBurned * bricksPerLine) / 100000;
  const coalPerLakhTons =
    effectiveLakhs > 0
      ? Math.round((coalUsedTons / effectiveLakhs) * 100) / 100
      : 0;
  const woodPerLineMaunds =
    effectiveLinesBurned > 0
      ? Math.round((woodUsedMaunds / effectiveLinesBurned) * 10) / 10
      : 0;

  // Firing pace & Fireman shirking / zone-kamai detector
  const firingDaysElapsed = Math.max(0, Number(s.firingDaysElapsed) || 0);
  const expectedLinesPerDay = Math.max(0.5, Number(s.expectedLinesPerDay) || 3.5);
  const expectedLinesByNow =
    Math.round(firingDaysElapsed * expectedLinesPerDay * 10) / 10;
  const actualLinesPerDay =
    firingDaysElapsed > 0
      ? Math.round((firedLinesCompleted / firingDaysElapsed) * 100) / 100
      : 0;
  const linePaceDelta =
    Math.round((firedLinesCompleted - expectedLinesByNow) * 10) / 10;

  let paceStatus: FeedKilnLineStatusReport['paceStatus'] = 'ON_TIME';
  let paceAlertTitleBn = '✅ পোড়ানো সঠিক গতিতে (On Track) চলছে';
  let paceAlertDetailBn = `লাইন #${formatBn(fireStartLineNo)} থেকে শুরু হয়ে গত ${formatBn(
    firingDaysElapsed
  )} দিনে মোট ${formatBn(firedLinesCompleted)} লাইন (${formatBn(
    firedBricksCompleted
  )} পিস ইট) পোড়ানো শেষ হয়েছে।`;

  if (firedLinesCompleted === 0 && activeFiringLinesCount === 0) {
    paceStatus = 'NOT_STARTED';
    paceAlertTitleBn = 'চুল্লির লাইন পোড়ানো এখনো শুরু হয়নি';
    paceAlertDetailBn = `লাইন #${formatBn(
      fireStartLineNo
    )} থেকে লোড ও পোড়ানো শুরু হলে লাইনের সংখ্যা আপডেট করুন।`;
  } else if (
    firingDaysElapsed > 0 &&
    (linePaceDelta <= -1.5 || actualLinesPerDay < expectedLinesPerDay * 0.85)
  ) {
    paceStatus = 'SLOW_SHIRKING';
    paceAlertTitleBn =
      '⚠️ পোড়ানো স্লো হয়ে গেছে — পোড়াই মিস্ত্রিরা জোন কামাই বা ফাঁকি দিচ্ছে কি না চেক করুন!';
    paceAlertDetailBn = `গত ${formatBn(firingDaysElapsed)} দিনে আদর্শ হিসাবে ${formatBn(
      expectedLinesByNow
    )} লাইন পোড়ানোর কথা থাকলেও হয়েছে মাত্র ${formatBn(
      firedLinesCompleted
    )} লাইন (${formatBn(
      Math.abs(linePaceDelta)
    )} লাইন পিছিয়ে)। স্লো গেলে মিস্ত্রিরা শুধু হাজিরা/জোন কামাই দিচ্ছে বা রাতে ঠিকমতো কয়লা-আগুন টানছে না — তাৎক্ষণিক তদারকি প্রয়োজন!`;
  } else if (firingDaysElapsed > 0 && linePaceDelta >= 1.5) {
    paceStatus = 'AHEAD';
    paceAlertTitleBn = '🔥 পোড়ানো দ্রুত এগিয়ে যাচ্ছে (Ahead of Target)';
    paceAlertDetailBn = `টার্গেটের চেয়ে +${formatBn(
      linePaceDelta
    )} লাইন এগিয়ে আছে (দৈনিক গড় ${formatBn(actualLinesPerDay)} লাইন)।`;
  }

  // Front Raw Brick Load Buffer Alert
  const minSafeLoadAheadLines = Math.max(
    4,
    Number(s.minSafeLoadAheadLines) || 12
  );
  let frontLoadStatus: FeedKilnLineStatusReport['frontLoadStatus'] = 'SAFE';
  let frontLoadTitleBn =
    '✅ সামনে পর্যাপ্ত কাঁচা ইট লোড ও ডাম্পার বাফার প্রস্তুত আছে';
  let frontLoadDetailBn = `আগুনের সামনে ভ্যানে ${formatBn(
    rawLinesLoadedAhead
  )} লাইন (${formatBn(rawBricksLoadedAhead)} পিস কাঁচা ইট) লোড দেওয়া আছে।`;

  if (rawLinesLoadedAhead < 6) {
    frontLoadStatus = 'CRITICAL_LOW';
    frontLoadTitleBn =
      '🚨 সামনে ভ্যান লোড খুবই কম — আগুন আটকে যাওয়ার জরুরি ঝুঁকি!';
    frontLoadDetailBn = `আগুনের সামনে মাত্র ${formatBn(
      rawLinesLoadedAhead
    )} লাইন (${formatBn(
      rawBricksLoadedAhead
    )} ইট) কাঁচা মাল লোড আছে! সামনে লোড কম থাকলে আগুন এগোতে পারবে না এবং ডাম্পার হিট নষ্ট হবে — দ্রুত ভ্যান লোড বাড়ান!`;
  } else if (rawLinesLoadedAhead < minSafeLoadAheadLines) {
    frontLoadStatus = 'WARNING_LOW';
    frontLoadTitleBn =
      '⚠️ সামনে কাঁচা ইটের লোড কম হয়ে আসছে — নতুন ডাম্পার ব্লক লোড দিন';
    frontLoadDetailBn = `বর্তমানে সামনে ${formatBn(
      rawLinesLoadedAhead
    )} লাইন লোড আছে। নিরাপদ পোড়ানোর জন্য অন্তত ${formatBn(
      minSafeLoadAheadLines
    )} লাইন (৫ বা ৭ লাইনের ২টি ডাম্পার ব্লক) লোড এগিয়ে রাখুন।`;
  }

  const activeDampersCount = s.dampers.filter(
    (d) => d.status === 'ACTIVE_CLOSED'
  ).length;
  const passedDampersCount = s.dampers.filter(
    (d) => d.status === 'OPENED_PASSED'
  ).length;
  const dampersWithGapCount = s.dampers.filter((d) => d.hasProtectiveGap).length;

  return {
    totalLines,
    bricksPerLine,
    totalKilnCapacityBricks,
    fireStartLineNo,
    startDirectionBn: s.startDirectionBn,
    firedLinesCompleted,
    firedStartLine,
    firedEndLine,
    firedBricksCompleted,
    unloadedLinesBehind,
    unloadedStartLine,
    unloadedEndLine,
    unloadedBricksBehind,
    coolingBehindLines,
    coolingBehindBricks,
    activeFiringLinesCount,
    activeFiringStartLine,
    activeFiringEndLine,
    activeFiringBricks,
    rawLinesLoadedAhead,
    rawLoadedAheadStartLine,
    rawLoadedAheadEndLine,
    rawBricksLoadedAhead,
    totalLoadedLines,
    totalLoadedBricks,
    emptyLinesRemaining,
    currentFireSectorBn,
    coalUsedTons,
    woodUsedMaunds,
    coalPerLineKg,
    coalPerLakhTons,
    woodPerLineMaunds,
    firingDaysElapsed,
    expectedLinesPerDay,
    expectedLinesByNow,
    actualLinesPerDay,
    linePaceDelta,
    paceStatus,
    paceAlertTitleBn,
    paceAlertDetailBn,
    frontLoadStatus,
    frontLoadTitleBn,
    frontLoadDetailBn,
    activeDampersCount,
    passedDampersCount,
    dampersWithGapCount,
    lineOverrides,
    autoVanLoadedBricks,
    autoVanFullLines,
    partialBricksInNextLine,
    partialLoadLineNo,
    reloadedLinesInNewRound,
    autoLedgerUnloadedLines,
    loadRoundNo,
    loadRoundLabelBn,
    fireRoundNo,
    fireRoundLabelBn,
    unloadRoundNo,
    unloadRoundLabelBn,
    clearedLineNumbers: Array.from(
      { length: Math.min(totalLines, Math.max(0, unloadedLinesBehind - reloadedLinesInNewRound)) },
      (_, idx) => wrapKilnLineNo(fireStartLineNo + reloadedLinesInNewRound + idx, totalLines)
    ),
    recentlyClearedLines: Array.isArray(s.recentlyClearedLines) ? s.recentlyClearedLines : [],
    lastAutoUnloadConfirmation: s.lastAutoUnloadConfirmation || null,
  };
}

export type DamperAlertSeverity =
  | 'OVERDUE_OPEN'
  | 'MISSING_GAP_RISK'
  | 'ACTIVE_HEALTHY'
  | 'OPENED_CLEARED';

export interface DamperMaintenanceAlertItem {
  damper: KilnDamperRecord;
  afterLineNo: number;
  offsetFromStart: number;
  severity: DamperAlertSeverity;
  titleBn: string;
  actionHintBn: string;
}

export interface DamperMaintenanceAlertSummary {
  overdueToOpenCount: number;
  missingGapCount: number;
  healthyActiveCount: number;
  openedClearedCount: number;
  unprotectedLoadedLinesAhead: number;
  needsNewDamperAhead: boolean;
  recommendedNextDamperLine: number;
  items: DamperMaintenanceAlertItem[];
}

export function computeDamperMaintenanceAlerts(
  rawState?: Partial<FeedKilnLineSystemState>,
  statusReport?: FeedKilnLineStatusReport
): DamperMaintenanceAlertSummary {
  const s = normalizeFeedKilnLineSystem(rawState);
  const status = statusReport || computeFeedKilnLineSystemStatus(s);
  const totalLines = status.totalLines || 208;
  const startLine = status.fireStartLineNo || 1;

  let overdueToOpenCount = 0;
  let missingGapCount = 0;
  let healthyActiveCount = 0;
  let openedClearedCount = 0;
  let maxDamperOffsetFromStart = status.firedLinesCompleted;

  const items: DamperMaintenanceAlertItem[] = s.dampers.map((d) => {
    const offset = getLineOffsetFromStart(d.afterLineNo, startLine, totalLines) + 1;
    if (offset > maxDamperOffsetFromStart && offset <= status.totalLoadedLines + 10) {
      maxDamperOffsetFromStart = offset;
    }

    if (d.status === 'ACTIVE_CLOSED' && offset <= status.firedLinesCompleted) {
      overdueToOpenCount++;
      return {
        damper: d,
        afterLineNo: d.afterLineNo,
        offsetFromStart: offset,
        severity: 'OVERDUE_OPEN',
        titleBn: `🚨 লাইন #${formatBn(d.afterLineNo)}-এর ডাম্পার দ্রুত খুলুন (আগুন পার হয়ে গেছে)`,
        actionHintBn:
          'এই লাইনের পোড়ানো শেষ হলেও ডাম্পার এখনো বন্ধ (Active) আছে — হাওয়া ও ড্রাফট সচল রাখতে এখনই ডাম্পার তুলে দিন।',
      };
    }

    if (d.status === 'ACTIVE_CLOSED' && !d.hasProtectiveGap) {
      missingGapCount++;
      return {
        damper: d,
        afterLineNo: d.afterLineNo,
        offsetFromStart: offset,
        severity: 'MISSING_GAP_RISK',
        titleBn: `⚠️ লাইন #${formatBn(d.afterLineNo)}-এর ডাম্পারে গ্যাপ নেই (জলীয় বাষ্পে কাঁচা ইট গলার ঝুঁকি)`,
        actionHintBn:
          'ডাম্পারের সাথে পানি/বাতাস রোধী গ্যাপ দেওয়া হয়নি — কাঁচা ইট ভিজে নষ্ট হওয়া ঠেকাতে গ্যাপ যুক্ত করুন।',
      };
    }

    if (d.status === 'ACTIVE_CLOSED') {
      healthyActiveCount++;
      return {
        damper: d,
        afterLineNo: d.afterLineNo,
        offsetFromStart: offset,
        severity: 'ACTIVE_HEALTHY',
        titleBn: `✅ লাইন #${formatBn(d.afterLineNo)}-এ ডাম্পার ও গ্যাপ সক্রিয় (${formatBn(d.linesInBlock)} লাইন ব্লক)`,
        actionHintBn: 'আগুনের সামনে নিরাপদভাবে ড্রাফট ও হিট ধরে রেখেছে।',
      };
    }

    openedClearedCount++;
    return {
      damper: d,
      afterLineNo: d.afterLineNo,
      offsetFromStart: offset,
      severity: 'OPENED_CLEARED',
      titleBn: `✔️ লাইন #${formatBn(d.afterLineNo)}-এর ডাম্পার খোলা হয়েছে (পোড়ানো শেষ)`,
      actionHintBn: 'আগুন পার হয়ে যাওয়ায় ডাম্পার সঠিকভাবে খুলে নেওয়া হয়েছে।',
    };
  });

  const unprotectedLoadedLinesAhead = Math.max(
    0,
    status.totalLoadedLines - maxDamperOffsetFromStart
  );
  const needsNewDamperAhead = unprotectedLoadedLinesAhead >= 5;
  const recommendedNextDamperLine =
    status.totalLoadedLines > 0
      ? wrapKilnLineNo(startLine + status.totalLoadedLines - 1, totalLines)
      : wrapKilnLineNo(startLine + 4, totalLines);

  return {
    overdueToOpenCount,
    missingGapCount,
    healthyActiveCount,
    openedClearedCount,
    unprotectedLoadedLinesAhead,
    needsNewDamperAhead,
    recommendedNextDamperLine,
    items,
  };
}


