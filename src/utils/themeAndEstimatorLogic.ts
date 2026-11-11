import type {
  BrickGrade,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  KilnDatabaseState,
  MillId,
  MillPotRecord,
  NavigationTab,
  PoraiMistriRecord,
  RubbishRecord,
} from '../types/kiln';

export type KilnThemeId = 'terracotta' | 'emerald' | 'sapphire' | 'crimson';

export interface KilnThemeConfig {
  id: KilnThemeId;
  nameBn: string;
  nameEn: string;
  subtitleBn: string;
  subtitleEn: string;
  primaryHex: string;
  secondaryHex: string;
  sidebarBgHex: string;
  canvasBgHex: string;
  swatchGradient: string;
  badgeClass: string;
}

export const KILN_THEMES: Record<KilnThemeId, KilnThemeConfig> = {
  terracotta: {
    id: 'terracotta',
    nameBn: 'টেরাকোটা ব্রিক',
    nameEn: 'Terracotta Brick',
    subtitleBn: 'পোড়ামাটির উজ্জ্বল কমলা ও সোনালী থিম',
    subtitleEn: 'Warm fired clay orange & kiln gold',
    primaryHex: '#EA580C',
    secondaryHex: '#D97706',
    sidebarBgHex: '#0B1120',
    canvasBgHex: '#F4F6FB',
    swatchGradient: 'from-orange-600 to-amber-500',
    badgeClass: 'bg-orange-600 text-white',
  },
  emerald: {
    id: 'emerald',
    nameBn: 'সুন্দরবন এমারেল্ড',
    nameEn: 'Sundarbans Emerald',
    subtitleBn: 'সাতক্ষীরা সবুজ ও প্রশান্ত টিল থিম',
    subtitleEn: 'Rich emerald green & deep forest slate',
    primaryHex: '#059669',
    secondaryHex: '#0D9488',
    sidebarBgHex: '#071712',
    canvasBgHex: '#F2F8F5',
    swatchGradient: 'from-emerald-600 to-teal-500',
    badgeClass: 'bg-emerald-600 text-white',
  },
  sapphire: {
    id: 'sapphire',
    nameBn: 'রয়েল সাতক্ষীরা ব্লু',
    nameEn: 'Royal Sapphire Blue',
    subtitleBn: 'প্রিমিয়াম নীল ও কর্পোরেট স্লেট থিম',
    subtitleEn: 'Executive cobalt blue & midnight slate',
    primaryHex: '#2563EB',
    secondaryHex: '#4F46E5',
    sidebarBgHex: '#081024',
    canvasBgHex: '#F3F6FC',
    swatchGradient: 'from-blue-600 to-indigo-600',
    badgeClass: 'bg-blue-600 text-white',
  },
  crimson: {
    id: 'crimson',
    nameBn: 'রাজকীয় ক্রিমসন',
    nameEn: 'Imperial Crimson',
    subtitleBn: 'গাঢ় লাল ইট ও অ্যাম্বার গোল্ড থিম',
    subtitleEn: 'Deep ruby brick & warm amber gold',
    primaryHex: '#E11D48',
    secondaryHex: '#D97706',
    sidebarBgHex: '#170B12',
    canvasBgHex: '#FAF5F6',
    swatchGradient: 'from-rose-600 to-amber-500',
    badgeClass: 'bg-rose-600 text-white',
  },
};

export type ConstructionCalculationMode =
  | 'WALL'
  | 'HOUSE_AREA'
  | 'SOLING_ROAD'
  | 'TRUCK_MEASURE';
export type WallThicknessType = '5_INCH' | '10_INCH';

export const STANDARD_BRICKS_PER_CUBIC_FOOT = 12;

export interface TruckMeasurementInput {
  lengthFeet: number;
  lengthInches?: number;
  widthFeet: number;
  widthInches?: number;
  heightFeet: number;
  heightInches?: number;
  ratePerFoot: number;
  truckCount?: number;
  bricksPerCubicFoot?: number;
}

export interface TruckMeasurementResult {
  decimalLengthFeet: number;
  decimalWidthFeet: number;
  decimalHeightFeet: number;
  singleTruckCft: number;
  singleTruckCbm: number;
  truckCount: number;
  totalCubicFeet: number;
  totalCubicMetersCbm: number;
  bricksPerCubicFoot: number;
  singleTruckEstimatedBricks: number;
  totalEstimatedBricks: number;
  ratePerFoot: number;
  singleTruckBill: number;
  totalFootBill: number;
}

/**
 * Calculates truck capacity in Cubic Feet (CFT = Length × Width × Height),
 * Cubic Meters (CBM = CFT × 0.0283168), total estimated bricks based on a standard
 * multiplier (default 12 bricks/CFT), and final bill based on per-cubic-foot rate.
 */
export function calculateTruckFootMeasurement(
  input: TruckMeasurementInput
): TruckMeasurementResult {
  const lFt = Math.max(0, Number(input.lengthFeet) || 0);
  const lIn = Math.max(0, Number(input.lengthInches) || 0);
  const wFt = Math.max(0, Number(input.widthFeet) || 0);
  const wIn = Math.max(0, Number(input.widthInches) || 0);
  const hFt = Math.max(0, Number(input.heightFeet) || 0);
  const hIn = Math.max(0, Number(input.heightInches) || 0);

  const decimalLengthFeet = Number((lFt + lIn / 12).toFixed(4));
  const decimalWidthFeet = Number((wFt + wIn / 12).toFixed(4));
  const decimalHeightFeet = Number((hFt + hIn / 12).toFixed(4));

  const singleTruckCft = Number(
    (decimalLengthFeet * decimalWidthFeet * decimalHeightFeet).toFixed(2)
  );
  const singleTruckCbm = Number((singleTruckCft * 0.0283168466).toFixed(2));
  const truckCount = Math.max(1, Math.round(Number(input.truckCount) || 1));
  const totalCubicFeet = Number((singleTruckCft * truckCount).toFixed(2));
  const totalCubicMetersCbm = Number(
    (totalCubicFeet * 0.0283168466).toFixed(2)
  );

  const rawMultiplier = Number(input.bricksPerCubicFoot);
  const bricksPerCubicFoot =
    Number.isFinite(rawMultiplier) && rawMultiplier > 0
      ? rawMultiplier
      : STANDARD_BRICKS_PER_CUBIC_FOOT;

  const singleTruckEstimatedBricks = Math.round(
    singleTruckCft * bricksPerCubicFoot
  );
  const totalEstimatedBricks = Math.round(totalCubicFeet * bricksPerCubicFoot);

  const ratePerFoot = Math.max(0, Number(input.ratePerFoot) || 0);
  const singleTruckBill = Math.round(singleTruckCft * ratePerFoot);
  const totalFootBill = Math.round(totalCubicFeet * ratePerFoot);

  return {
    decimalLengthFeet: Number(decimalLengthFeet.toFixed(2)),
    decimalWidthFeet: Number(decimalWidthFeet.toFixed(2)),
    decimalHeightFeet: Number(decimalHeightFeet.toFixed(2)),
    singleTruckCft,
    singleTruckCbm,
    truckCount,
    totalCubicFeet,
    totalCubicMetersCbm,
    bricksPerCubicFoot,
    singleTruckEstimatedBricks,
    totalEstimatedBricks,
    ratePerFoot,
    singleTruckBill,
    totalFootBill,
  };
}

export interface BrickEstimateInput {
  mode: ConstructionCalculationMode;
  wallLengthFeet: number;
  wallHeightFeet: number;
  wallCount: number;
  wallThickness: WallThicknessType;
  openingDeductionSqFt: number;
  houseAreaSqFt: number;
  floorsCount: number;
  roadLengthFeet: number;
  roadWidthFeet: number;
  solingLayerType: 'FLAT_SINGLE' | 'HERRINGBONE_DOUBLE';
  wastagePct: number;
  ratePerThousand: number;
  transportTrips: number;
  farePerTrip: number;
}

export interface BrickEstimateResult {
  grossAreaSqFt: number;
  netAreaSqFt: number;
  baseBricksNeeded: number;
  wastageBricks: number;
  totalBricksNeeded: number;
  roundedOrderBricks: number;
  estimatedCementBags: number;
  estimatedSandCft: number;
  brickCostAmount: number;
  transportCostAmount: number;
  grandTotalAmount: number;
  recommendedTrips: number;
}

/**
 * Standard Bangladesh PWD / Engineering Brick Estimation Rules:
 * - 5 inch partition wall (125mm): ~5 bricks per sq.ft
 * - 10 inch main wall (250mm): ~10 bricks per sq.ft
 * - Full residential building structure: ~32 bricks per sq.ft of plinth area per floor (walls + khowar/soling)
 * - Brick flat soling (single layer): ~3.1 bricks per sq.ft
 * - Herringbone bond + flat soling (double layer road): ~6.5 bricks per sq.ft
 */
export function calculateSmartBrickEstimate(input: BrickEstimateInput): BrickEstimateResult {
  const wastagePct = Math.max(0, Math.min(25, Number(input.wastagePct) || 0));
  const ratePerThousand = Math.max(0, Number(input.ratePerThousand) || 0);
  const farePerTrip = Math.max(0, Number(input.farePerTrip) || 0);

  let grossAreaSqFt = 0;
  let netAreaSqFt = 0;
  let baseBricksNeeded = 0;
  let estimatedCementBags = 0;
  let estimatedSandCft = 0;

  if (input.mode === 'WALL') {
    const length = Math.max(0, Number(input.wallLengthFeet) || 0);
    const height = Math.max(0, Number(input.wallHeightFeet) || 0);
    const count = Math.max(1, Math.round(Number(input.wallCount) || 1));
    const deduction = Math.max(0, Number(input.openingDeductionSqFt) || 0);

    grossAreaSqFt = Math.round(length * height * count);
    netAreaSqFt = Math.max(0, grossAreaSqFt - deduction);

    const bricksPerSqFt = input.wallThickness === '10_INCH' ? 10 : 5;
    baseBricksNeeded = Math.ceil(netAreaSqFt * bricksPerSqFt);

    // Mortar estimate per 1,000 bricks: ~2.2 bags cement & ~12 cft sand for 5", ~2.6 bags & ~14 cft for 10"
    const thousands = baseBricksNeeded / 1000;
    estimatedCementBags = Math.ceil(
      thousands * (input.wallThickness === '10_INCH' ? 2.6 : 2.2)
    );
    estimatedSandCft = Math.ceil(
      thousands * (input.wallThickness === '10_INCH' ? 14 : 12)
    );
  } else if (input.mode === 'HOUSE_AREA') {
    const area = Math.max(0, Number(input.houseAreaSqFt) || 0);
    const floors = Math.max(1, Math.round(Number(input.floorsCount) || 1));
    grossAreaSqFt = Math.round(area * floors);
    netAreaSqFt = grossAreaSqFt;

    // Standard residential construction in BD uses ~28 bricks/sq.ft for brickwork & khowar
    baseBricksNeeded = Math.ceil(netAreaSqFt * 28);
    const thousands = baseBricksNeeded / 1000;
    estimatedCementBags = Math.ceil(thousands * 2.5);
    estimatedSandCft = Math.ceil(thousands * 13);
  } else {
    // SOLING_ROAD
    const length = Math.max(0, Number(input.roadLengthFeet) || 0);
    const width = Math.max(0, Number(input.roadWidthFeet) || 0);
    grossAreaSqFt = Math.round(length * width);
    netAreaSqFt = grossAreaSqFt;

    const bricksPerSqFt =
      input.solingLayerType === 'HERRINGBONE_DOUBLE' ? 6.5 : 3.2;
    baseBricksNeeded = Math.ceil(netAreaSqFt * bricksPerSqFt);
    estimatedCementBags = 0;
    estimatedSandCft = Math.ceil((netAreaSqFt / 100) * 15);
  }

  const wastageBricks = Math.ceil((baseBricksNeeded * wastagePct) / 100);
  const totalBricksNeeded = baseBricksNeeded + wastageBricks;
  // Round to nearest 100 bricks for practical kiln ordering
  const roundedOrderBricks =
    totalBricksNeeded > 0 ? Math.ceil(totalBricksNeeded / 100) * 100 : 0;

  // Standard trolley/truck carries ~2,500 bricks per trip
  const recommendedTrips =
    roundedOrderBricks > 0 ? Math.max(1, Math.ceil(roundedOrderBricks / 2500)) : 0;
  const activeTrips =
    input.transportTrips >= 0 ? Math.round(input.transportTrips) : recommendedTrips;

  const brickCostAmount = Math.round((roundedOrderBricks / 1000) * ratePerThousand);
  const transportCostAmount = Math.round(activeTrips * farePerTrip);
  const grandTotalAmount = brickCostAmount + transportCostAmount;

  return {
    grossAreaSqFt,
    netAreaSqFt,
    baseBricksNeeded,
    wastageBricks,
    totalBricksNeeded,
    roundedOrderBricks,
    estimatedCementBags,
    estimatedSandCft,
    brickCostAmount,
    transportCostAmount,
    grandTotalAmount,
    recommendedTrips,
  };
}

export interface QuickSearchHit {
  id: string;
  kind: 'MEMO' | 'SECTION' | 'WORKER' | 'GRADE';
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
  badgeBn: string;
  badgeEn: string;
  targetTab?: NavigationTab;
  memoId?: string;
}

export function searchKilnWorkspace(
  query: string,
  state: KilnDatabaseState,
  sections: Array<{
    id: NavigationTab;
    labelBn: string;
    labelEn: string;
    descBn: string;
    descEn: string;
  }>,
  grades: BrickGrade[] = state.brickGrades
): QuickSearchHit[] {
  const q = query.trim().toLowerCase();
  const hits: QuickSearchHit[] = [];

  // 1. Search Sections
  for (const sec of sections) {
    if (
      !q ||
      sec.labelBn.toLowerCase().includes(q) ||
      sec.labelEn.toLowerCase().includes(q) ||
      sec.descBn.toLowerCase().includes(q) ||
      sec.descEn.toLowerCase().includes(q)
    ) {
      hits.push({
        id: `sec-${sec.id}`,
        kind: 'SECTION',
        titleBn: sec.labelBn,
        titleEn: sec.labelEn,
        subtitleBn: sec.descBn,
        subtitleEn: sec.descEn,
        badgeBn: 'মডিউল',
        badgeEn: 'Module',
        targetTab: sec.id,
      });
    }
  }

  // 2. Search Sales Memos
  for (const memo of state.salesMemos || []) {
    if (
      !q ||
      memo.memoNo.toLowerCase().includes(q) ||
      memo.customerName.toLowerCase().includes(q) ||
      memo.customerPhone.toLowerCase().includes(q) ||
      memo.customerAddress.toLowerCase().includes(q)
    ) {
      hits.push({
        id: `memo-${memo.id}`,
        kind: 'MEMO',
        titleBn: `${memo.customerName} (${memo.memoNo})`,
        titleEn: `${memo.customerName} (${memo.memoNo})`,
        subtitleBn: `ঠিকানা: ${memo.customerAddress} · মোবাইল: ${memo.customerPhone}`,
        subtitleEn: `Address: ${memo.customerAddress} · Phone: ${memo.customerPhone}`,
        badgeBn: memo.dueAmount > 0 ? `বাকি ৳${memo.dueAmount}` : 'পরিশোধিত',
        badgeEn: memo.dueAmount > 0 ? `Due Tk ${memo.dueAmount}` : 'Paid',
        memoId: memo.id,
        targetTab: 'memos',
      });
    }
  }

  // 3. Search Workers
  for (const worker of state.workerProfiles || []) {
    if (
      q &&
      (worker.name.toLowerCase().includes(q) ||
        worker.role.toLowerCase().includes(q) ||
        worker.phone.toLowerCase().includes(q))
    ) {
      hits.push({
        id: `worker-${worker.id}`,
        kind: 'WORKER',
        titleBn: worker.name,
        titleEn: worker.name,
        subtitleBn: `${worker.role} · মোবাইল: ${worker.phone}`,
        subtitleEn: `${worker.role} · Phone: ${worker.phone}`,
        badgeBn: 'লেবার খাতা',
        badgeEn: 'Labor Book',
        targetTab: 'labour',
      });
    }
  }

  // 4. Search Brick Grades
  for (const g of grades || []) {
    if (
      q &&
      (g.nameBn.toLowerCase().includes(q) ||
        g.nameEn.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q))
    ) {
      hits.push({
        id: `grade-${g.id}`,
        kind: 'GRADE',
        titleBn: g.nameBn,
        titleEn: g.nameEn || g.code,
        subtitleBn: `বর্তমান স্টক: ${g.currentStock} পিস · দর: ৳${g.ratePerUnit}/হাজার`,
        subtitleEn: `Stock: ${g.currentStock} pcs · Rate: Tk ${g.ratePerUnit}/1,000`,
        badgeBn: 'ইট স্টক',
        badgeEn: 'Brick Stock',
        targetTab: 'bricks',
      });
    }
  }

  return hits.slice(0, 14);
}

/**
 * #2: চুল্লির রাউন্ড ভিত্তিক কয়লা ও জ্বালানি দক্ষতা বিশ্লেষণ
 * (Kiln Firing Round Coal & Fuel Efficiency Tracker)
 */
export interface KilnFiringRoundRecord {
  id: string;
  roundNo: number;
  startDate: string;
  endDate: string;
  mistriName: string;
  chambersFired: number;
  bricksFiredPieces: number;
  coalUsedTons: number;
  coalRatePerTon: number;
  woodUsedMaunds: number;
  woodRatePerMaund: number;
  note?: string;
}

export type FiringEfficiencyStatus = 'OPTIMAL' | 'NORMAL' | 'EXCESS_WARNING';

export interface FiringRoundEvaluatedMetrics {
  record: KilnFiringRoundRecord;
  coalPerLakhBricksTons: number;
  coalKgPerThousandBricks: number;
  woodMaundsPerLakhBricks: number;
  totalCoalCost: number;
  totalWoodCost: number;
  totalFuelCost: number;
  fuelCostPerThousandBricks: number;
  varianceFromBenchmarkTons: number;
  efficiencyStatus: FiringEfficiencyStatus;
  statusLabelBn: string;
  statusLabelEn: string;
}

export interface FiremanFuelEfficiencySummary {
  mistriName: string;
  roundsCount: number;
  totalBricksFired: number;
  totalCoalTons: number;
  totalWoodMaunds: number;
  totalFuelCost: number;
  avgCoalPerLakhTons: number;
  avgWoodPerLakhMaunds: number;
  avgFuelCostPerThousand: number;
  netCoalSavingsOrExcessTons: number;
  netSavingsOrExcessAmount: number;
  efficiencyStatus: FiringEfficiencyStatus;
  verdictLabelBn: string;
  verdictLabelEn: string;
}

export interface OverallCoalEfficiencyReport {
  rounds: FiringRoundEvaluatedMetrics[];
  firemanSummaries: FiremanFuelEfficiencySummary[];
  benchmarkCoalPerLakhTons: number;
  totalBricksFired: number;
  totalCoalTons: number;
  totalWoodMaunds: number;
  totalFuelCost: number;
  avgCoalPerLakhTons: number;
  avgWoodPerLakhMaunds: number;
  avgCoalKgPerThousand: number;
  avgFuelCostPerThousand: number;
  bestRound: FiringRoundEvaluatedMetrics | null;
  excessWarningCount: number;
  netCoalSavingsOrExcessTons: number;
  netSavingsOrExcessAmount: number;
}

export function createInitialFiringRounds(todayDate = '2026-11-01'): KilnFiringRoundRecord[] {
  return [
    {
      id: 'round-1',
      roundNo: 1,
      startDate: '2026-10-01',
      endDate: '2026-10-12',
      mistriName: 'আলী হোসেন পোড়াই মিস্ত্রি',
      chambersFired: 24,
      bricksFiredPieces: 420000,
      coalUsedTons: 68.5,
      coalRatePerTon: 22500,
      woodUsedMaunds: 170,
      woodRatePerMaund: 320,
      note: '1st রাউন্ডে নিখুঁত ড্রাফট ও কয়লা সাশ্রয়ী পোড়াই',
    },
    {
      id: 'round-2',
      roundNo: 2,
      startDate: '2026-10-13',
      endDate: '2026-10-23',
      mistriName: 'করিম ফায়ারম্যান ও দল',
      chambersFired: 24,
      bricksFiredPieces: 400000,
      coalUsedTons: 74.8,
      coalRatePerTon: 22500,
      woodUsedMaunds: 195,
      woodRatePerMaund: 320,
      note: 'বৃষ্টির আর্দ্রতার কারণে ৮-১২ চেম্বারে অতিরিক্ত কয়লা ব্যবহৃত',
    },
    {
      id: 'round-3',
      roundNo: 3,
      startDate: '2026-10-24',
      endDate: todayDate,
      mistriName: 'আলী হোসেন পোড়াই মিস্ত্রি',
      chambersFired: 24,
      bricksFiredPieces: 432000,
      coalUsedTons: 71.2,
      coalRatePerTon: 22500,
      woodUsedMaunds: 165,
      woodRatePerMaund: 320,
      note: 'চলমান সিজন রাউন্ড — ১ নং ইটের হার ৯২%',
    },
  ];
}

export function computeFiringRoundMetrics(
  record: KilnFiringRoundRecord,
  benchmarkCoalPerLakhTons = 17.2
): FiringRoundEvaluatedMetrics {
  const safeBricks = Math.max(1000, Number(record.bricksFiredPieces) || 0);
  const lakhs = safeBricks / 100000;
  const thousands = safeBricks / 1000;

  const coalTons = Math.max(0, Number(record.coalUsedTons) || 0);
  const coalRate = Math.max(0, Number(record.coalRatePerTon) || 0);
  const woodMaunds = Math.max(0, Number(record.woodUsedMaunds) || 0);
  const woodRate = Math.max(0, Number(record.woodRatePerMaund) || 0);

  const coalPerLakhBricksTons = Number((coalTons / lakhs).toFixed(2));
  const coalKgPerThousandBricks = Math.round((coalTons * 1000) / thousands);
  const woodMaundsPerLakhBricks = Number((woodMaunds / lakhs).toFixed(1));

  const totalCoalCost = Math.round(coalTons * coalRate);
  const totalWoodCost = Math.round(woodMaunds * woodRate);
  const totalFuelCost = totalCoalCost + totalWoodCost;
  const fuelCostPerThousandBricks = Math.round(totalFuelCost / thousands);

  const varianceFromBenchmarkTons = Number(
    (coalPerLakhBricksTons - benchmarkCoalPerLakhTons).toFixed(2)
  );

  let efficiencyStatus: FiringEfficiencyStatus = 'NORMAL';
  let statusLabelBn = 'স্বাভাবিক জ্বালানি হার';
  let statusLabelEn = 'Normal Fuel Burn';

  if (coalPerLakhBricksTons <= benchmarkCoalPerLakhTons - 0.4) {
    efficiencyStatus = 'OPTIMAL';
    statusLabelBn = 'সাশ্রয়ী ও আদর্শ পোড়াই';
    statusLabelEn = 'Optimal Fuel Saving';
  } else if (coalPerLakhBricksTons > benchmarkCoalPerLakhTons + 0.7) {
    efficiencyStatus = 'EXCESS_WARNING';
    statusLabelBn = 'অতিরিক্ত কয়লা খরচ সতর্কতা';
    statusLabelEn = 'Excess Coal Burn Alert';
  }

  return {
    record,
    coalPerLakhBricksTons,
    coalKgPerThousandBricks,
    woodMaundsPerLakhBricks,
    totalCoalCost,
    totalWoodCost,
    totalFuelCost,
    fuelCostPerThousandBricks,
    varianceFromBenchmarkTons,
    efficiencyStatus,
    statusLabelBn,
    statusLabelEn,
  };
}

export function computeOverallCoalEfficiencyReport(
  records: KilnFiringRoundRecord[],
  benchmarkCoalPerLakhTons = 17.2
): OverallCoalEfficiencyReport {
  const evaluated = (records || []).map((r) =>
    computeFiringRoundMetrics(r, benchmarkCoalPerLakhTons)
  );

  const totalBricksFired = evaluated.reduce(
    (s, r) => s + (Number(r.record.bricksFiredPieces) || 0),
    0
  );
  const totalCoalTons = Number(
    evaluated.reduce((s, r) => s + (Number(r.record.coalUsedTons) || 0), 0).toFixed(2)
  );
  const totalWoodMaunds = Math.round(
    evaluated.reduce((s, r) => s + (Number(r.record.woodUsedMaunds) || 0), 0)
  );
  const totalFuelCost = evaluated.reduce((s, r) => s + r.totalFuelCost, 0);

  const totalLakhs = Math.max(0.01, totalBricksFired / 100000);
  const totalThousands = Math.max(1, totalBricksFired / 1000);

  const avgCoalPerLakhTons =
    evaluated.length > 0 ? Number((totalCoalTons / totalLakhs).toFixed(2)) : 0;
  const avgWoodPerLakhMaunds =
    evaluated.length > 0 ? Number((totalWoodMaunds / totalLakhs).toFixed(1)) : 0;
  const avgCoalKgPerThousand =
    evaluated.length > 0 ? Math.round((totalCoalTons * 1000) / totalThousands) : 0;
  const avgFuelCostPerThousand =
    evaluated.length > 0 ? Math.round(totalFuelCost / totalThousands) : 0;

  const sortedByEfficiency = [...evaluated].sort(
    (a, b) => a.coalPerLakhBricksTons - b.coalPerLakhBricksTons
  );
  const bestRound = sortedByEfficiency[0] || null;
  const excessWarningCount = evaluated.filter(
    (r) => r.efficiencyStatus === 'EXCESS_WARNING'
  ).length;

  const expectedBenchmarkCoalTons = totalLakhs * benchmarkCoalPerLakhTons;
  // Positive = saved coal tons vs benchmark; Negative = excess coal burned
  const netCoalSavingsOrExcessTons =
    evaluated.length > 0
      ? Number((expectedBenchmarkCoalTons - totalCoalTons).toFixed(2))
      : 0;
  const avgCoalRate =
    evaluated.length > 0
      ? evaluated.reduce((s, r) => s + r.record.coalRatePerTon, 0) / evaluated.length
      : 22500;
  const netSavingsOrExcessAmount = Math.round(
    netCoalSavingsOrExcessTons * avgCoalRate
  );

  // Aggregate by Porai Mistri (Fireman) so the owner can compare who is burning more/less fuel
  const mistriMap = new Map<string, FiringRoundEvaluatedMetrics[]>();
  for (const ev of evaluated) {
    const name = ev.record.mistriName.trim() || 'পোড়াই মিস্ত্রি';
    const list = mistriMap.get(name) || [];
    list.push(ev);
    mistriMap.set(name, list);
  }

  const firemanSummaries: FiremanFuelEfficiencySummary[] = Array.from(
    mistriMap.entries()
  )
    .map(([mistriName, items]) => {
      const mBricks = items.reduce(
        (s, it) => s + (Number(it.record.bricksFiredPieces) || 0),
        0
      );
      const mCoal = Number(
        items.reduce((s, it) => s + (Number(it.record.coalUsedTons) || 0), 0).toFixed(2)
      );
      const mWood = Math.round(
        items.reduce((s, it) => s + (Number(it.record.woodUsedMaunds) || 0), 0)
      );
      const mCost = items.reduce((s, it) => s + it.totalFuelCost, 0);
      const mLakhs = Math.max(0.01, mBricks / 100000);
      const mThousands = Math.max(1, mBricks / 1000);

      const mAvgCoalPerLakh = Number((mCoal / mLakhs).toFixed(2));
      const mAvgWoodPerLakh = Number((mWood / mLakhs).toFixed(1));
      const mAvgFuelCostPerThousand = Math.round(mCost / mThousands);

      const mExpectedCoal = mLakhs * benchmarkCoalPerLakhTons;
      const mNetSavedOrExcessTons = Number((mExpectedCoal - mCoal).toFixed(2));
      const mNetSavedOrExcessAmt = Math.round(mNetSavedOrExcessTons * avgCoalRate);

      let efficiencyStatus: FiringEfficiencyStatus = 'NORMAL';
      let verdictLabelBn = 'স্বাভাবিক জ্বালানি খরচ (Standard Efficiency)';
      let verdictLabelEn = 'Standard Fuel Efficiency';

      if (mAvgCoalPerLakh <= benchmarkCoalPerLakhTons - 0.4) {
        efficiencyStatus = 'OPTIMAL';
        verdictLabelBn = 'জ্বালানি সাশ্রয়ী পোড়াই মিস্ত্রি (Best Fuel Saver)';
        verdictLabelEn = 'Optimal Fuel Saver Fireman';
      } else if (mAvgCoalPerLakh > benchmarkCoalPerLakhTons + 0.7) {
        efficiencyStatus = 'EXCESS_WARNING';
        verdictLabelBn = 'অতিরিক্ত জ্বালানি খরচ করছে! (Excess Burn Alert)';
        verdictLabelEn = 'Burning Excess Fuel (Alert)';
      }

      return {
        mistriName,
        roundsCount: items.length,
        totalBricksFired: mBricks,
        totalCoalTons: mCoal,
        totalWoodMaunds: mWood,
        totalFuelCost: mCost,
        avgCoalPerLakhTons: mAvgCoalPerLakh,
        avgWoodPerLakhMaunds: mAvgWoodPerLakh,
        avgFuelCostPerThousand: mAvgFuelCostPerThousand,
        netCoalSavingsOrExcessTons: mNetSavedOrExcessTons,
        netSavingsOrExcessAmount: mNetSavedOrExcessAmt,
        efficiencyStatus,
        verdictLabelBn,
        verdictLabelEn,
      };
    })
    .sort((a, b) => a.avgCoalPerLakhTons - b.avgCoalPerLakhTons);

  return {
    rounds: evaluated,
    firemanSummaries,
    benchmarkCoalPerLakhTons,
    totalBricksFired,
    totalCoalTons,
    totalWoodMaunds,
    totalFuelCost,
    avgCoalPerLakhTons,
    avgWoodPerLakhMaunds,
    avgCoalKgPerThousand,
    avgFuelCostPerThousand,
    bestRound,
    excessWarningCount,
    netCoalSavingsOrExcessTons,
    netSavingsOrExcessAmount,
  };
}

/**
 * #6: 🔔 অটো রিমাইন্ডার ও অ্যালার্ট সেন্টার (Smart Kiln Alert Bell & Notification Center)
 */
export type KilnAlertCategory =
  | 'DUE_TAGADA'
  | 'COAL_FIRING'
  | 'BOOKING_DELIVERY'
  | 'LICENSE_KISTI'
  | 'STOCK_URGENT';

export type KilnAlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SmartKilnAlertItem {
  id: string;
  category: KilnAlertCategory;
  severity: KilnAlertSeverity;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
  badgeBn: string;
  badgeEn: string;
  metricValueBn: string;
  metricValueEn: string;
  dateLabel: string;
  targetTab: NavigationTab;
  actionLabelBn: string;
  actionLabelEn: string;
  memoId?: string;
  noteId?: string;
  customerPhone?: string;
  whatsappText?: string;
}

export interface SmartKilnAlertReport {
  allAlerts: SmartKilnAlertItem[];
  activeAlerts: SmartKilnAlertItem[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalActiveCount: number;
  byCategory: Record<KilnAlertCategory, number>;
}

export function computeSmartKilnAlerts(
  state: KilnDatabaseState,
  firingRounds: KilnFiringRoundRecord[] = [],
  benchmarkCoalPerLakhTons = 17.2,
  todayDate = '2026-11-02',
  dismissedAlertIds: string[] = []
): SmartKilnAlertReport {
  const alerts: SmartKilnAlertItem[] = [];
  const dismissedSet = new Set(dismissedAlertIds);

  const totalStockPieces = (state.brickGrades || []).reduce(
    (s, g) => s + (Number(g.currentStock) || 0) + (Number(g.seasonProduced) || 0),
    0
  );
  const hasAnyKilnData =
    (state.salesMemos || []).length > 0 ||
    (firingRounds || []).length > 0 ||
    (state.cashTransactions || []).length > 0 ||
    (state.kilnNotes || []).length > 0 ||
    (state.advanceBookings || []).length > 0 ||
    (state.complianceRecords || []).length > 0 ||
    (state.soilCoalRecords || []).length > 0 ||
    (state.millPots || []).length > 0 ||
    (state.chulliLoads || []).length > 0 ||
    (state.chulliUnloads || []).length > 0 ||
    totalStockPieces > 0;

  if (!hasAnyKilnData) {
    return {
      allAlerts: [],
      activeAlerts: [],
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      totalActiveCount: 0,
      byCategory: {
        DUE_TAGADA: 0,
        COAL_FIRING: 0,
        BOOKING_DELIVERY: 0,
        LICENSE_KISTI: 0,
        STOCK_URGENT: 0,
      },
    };
  }

  // 1. Customer Due Promise Date & High Due Alerts (DUE_TAGADA)
  const dueMemos = (state.salesMemos || [])
    .filter((m) => (Number(m.dueAmount) || 0) > 0)
    .sort((a, b) => {
      const aOverdue = a.duePromiseDate && a.duePromiseDate <= todayDate ? 1 : 0;
      const bOverdue = b.duePromiseDate && b.duePromiseDate <= todayDate ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return (Number(b.dueAmount) || 0) - (Number(a.dueAmount) || 0);
    })
    .slice(0, 5);

  for (const memo of dueMemos) {
    const isPromiseDueOrPast = Boolean(
      memo.duePromiseDate && memo.duePromiseDate <= todayDate
    );
    const isHighDue = memo.dueAmount >= 25000;
    const severity: KilnAlertSeverity =
      isPromiseDueOrPast || isHighDue ? 'CRITICAL' : 'WARNING';

    const cleanPhone = (memo.customerPhone || '').replace(/[^0-9]/g, '');
    const waText = `আসসালামু আলাইকুম ${memo.customerName}, SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা) থেকে মেমো নং ${memo.memoNo}-এর বকেয়া ৳${memo.dueAmount.toLocaleString('en-IN')} পরিশোধের জন্য বিনীত অনুরোধ জানানো হচ্ছে। যোগাযোগ: 01913-678010`;

    alerts.push({
      id: `alert-due-${memo.id}`,
      category: 'DUE_TAGADA',
      severity,
      titleBn: `${memo.customerName} — মেমো ${memo.memoNo} বকেয়া তাগাদা`,
      titleEn: `${memo.customerName} — Memo ${memo.memoNo} Due Reminder`,
      descriptionBn: memo.duePromiseDate
        ? `প্রতিশ্রুতির তারিখ: ${memo.duePromiseDate} · ঠিকানা: ${memo.customerAddress || 'সাতক্ষীরা'} · মোবাইল: ${memo.customerPhone}`
        : `মোট বিল: ৳${memo.totalAmount.toLocaleString('en-IN')} · জমা: ৳${memo.paidAmount.toLocaleString('en-IN')} · মোবাইল: ${memo.customerPhone}`,
      descriptionEn: memo.duePromiseDate
        ? `Promise Date: ${memo.duePromiseDate} · Address: ${memo.customerAddress || 'Satkhira'} · Phone: ${memo.customerPhone}`
        : `Total Bill: Tk ${memo.totalAmount.toLocaleString('en-IN')} · Paid: Tk ${memo.paidAmount.toLocaleString('en-IN')} · Phone: ${memo.customerPhone}`,
      badgeBn: isPromiseDueOrPast ? 'তারিখ অতিক্রান্ত (Overdue)' : 'বকেয়া তাগাদা',
      badgeEn: isPromiseDueOrPast ? 'Overdue Promise' : 'Customer Due',
      metricValueBn: `বাকি ৳${memo.dueAmount.toLocaleString('en-IN')}`,
      metricValueEn: `Due Tk ${memo.dueAmount.toLocaleString('en-IN')}`,
      dateLabel: memo.duePromiseDate || memo.date,
      targetTab: 'due_tagada',
      actionLabelBn: 'বকেয়া আদায় / মেমো দেখুন',
      actionLabelEn: 'Collect Due / View Memo',
      memoId: memo.id,
      customerPhone: cleanPhone.length >= 10 ? cleanPhone : undefined,
      whatsappText: waText,
    });
  }

  if (dueMemos.length === 0) {
    alerts.push({
      id: 'alert-due-schedule-check',
      category: 'DUE_TAGADA',
      severity: 'WARNING',
      titleBn: 'সাপ্তাহিক ক্রেতা বকেয়া তাগাদা ও মেমো প্রতিশ্রুতির তারিখ যাচাই',
      titleEn: 'Weekly Customer Due Tagada & Promise Date Review',
      descriptionBn:
        'হাটবার ও সাপ্তাহিক ক্লোজিংয়ের আগে সকল বকেয়া ক্রেতাদের WhatsApp তাগাদা মেসেজ ও কল লিস্ট যাচাই করুন।',
      descriptionEn:
        'Review customer due ledger and send WhatsApp payment reminders before weekly closing.',
      badgeBn: 'বকেয়া তাগাদা রিমাইন্ডার',
      badgeEn: 'Due Tagada Reminder',
      metricValueBn: 'বকেয়া খতিয়ান',
      metricValueEn: 'Due Ledger',
      dateLabel: todayDate,
      targetTab: 'due_tagada',
      actionLabelBn: 'বকেয়া তাগাদা খাতা খুলুন',
      actionLabelEn: 'Open Due Tagada Tab',
    });
  }

  // 2. Coal & Firing Efficiency Excess Burn + Unpaid Coal Supplier Bills (COAL_FIRING)
  const coalReport = computeOverallCoalEfficiencyReport(
    firingRounds,
    benchmarkCoalPerLakhTons
  );
  for (const roundMetrics of coalReport.rounds) {
    if (roundMetrics.efficiencyStatus === 'EXCESS_WARNING') {
      const r = roundMetrics.record;
      alerts.push({
        id: `alert-coal-round-${r.id}`,
        category: 'COAL_FIRING',
        severity: 'CRITICAL',
        titleBn: `চুল্লির রাউন্ড #${r.roundNo} (${r.mistriName}) — অতিরিক্ত কয়লা খরচ সতর্কতা!`,
        titleEn: `Kiln Round #${r.roundNo} (${r.mistriName}) — Excess Coal Burn Alert!`,
        descriptionBn: `1 লক্ষ ইটে ${roundMetrics.coalPerLakhBricksTons} Ton কয়লা ও ${roundMetrics.woodMaundsPerLakhBricks} মণ কাঠ পুড়েছে (Benchmark: ${benchmarkCoalPerLakhTons} Ton/Lakh)।`,
        descriptionEn: `Burned ${roundMetrics.coalPerLakhBricksTons} Ton coal & ${roundMetrics.woodMaundsPerLakhBricks} Maund wood per 1 Lakh bricks (Benchmark: ${benchmarkCoalPerLakhTons}T).`,
        badgeBn: 'অতিরিক্ত কয়লা খরচ (Excess Burn)',
        badgeEn: 'Excess Fuel Alert',
        metricValueBn: `${roundMetrics.coalPerLakhBricksTons} Ton / 1 Lakh`,
        metricValueEn: `${roundMetrics.coalPerLakhBricksTons} Ton / 1 Lakh`,
        dateLabel: r.endDate,
        targetTab: 'koyla_dakshta',
        actionLabelBn: 'কয়লা দক্ষতা রিপোর্ট খুলুন',
        actionLabelEn: 'Open Coal Efficiency Tracker',
      });
    }
  }

  const unpaidCoalSuppliers = (state.soilCoalRecords || []).filter(
    (sc) => sc.itemType === 'COAL' && (Number(sc.dueAmount) || 0) > 0
  );
  for (const coalRec of unpaidCoalSuppliers.slice(0, 2)) {
    alerts.push({
      id: `alert-coal-due-${coalRec.id}`,
      category: 'COAL_FIRING',
      severity: 'WARNING',
      titleBn: `কয়লা সাপ্লায়ার বকেয়া: ${coalRec.supplierName} (${coalRec.specification})`,
      titleEn: `Coal Supplier Payable: ${coalRec.supplierName} (${coalRec.specification})`,
      descriptionBn: `পরিমাণ: ${coalRec.quantity} ${coalRec.unit} · মোট বিল: ৳${coalRec.totalBill.toLocaleString('en-IN')} · চালান: ${coalRec.vehicleOrChallan || 'N/A'}`,
      descriptionEn: `Qty: ${coalRec.quantity} ${coalRec.unit} · Total Bill: Tk ${coalRec.totalBill.toLocaleString('en-IN')} · Challan: ${coalRec.vehicleOrChallan || 'N/A'}`,
      badgeBn: 'কয়লা মহাজন বকেয়া',
      badgeEn: 'Coal Supplier Due',
      metricValueBn: `বকেয়া ৳${coalRec.dueAmount.toLocaleString('en-IN')}`,
      metricValueEn: `Payable Tk ${coalRec.dueAmount.toLocaleString('en-IN')}`,
      dateLabel: coalRec.date,
      targetTab: 'mati_koyla',
      actionLabelBn: 'মাটি ও কয়লা খাতা খুলুন',
      actionLabelEn: 'Open Soil & Coal Ledger',
    });
  }

  // 3. Advance Brick Booking Delivery Reminders (BOOKING_DELIVERY)
  const pendingBookings = (state.advanceBookings || []).filter(
    (b) => b.status !== 'COMPLETED' && b.bookedQuantity > b.deliveredQuantity
  );
  for (const bk of pendingBookings) {
    const remainingBricks = Math.max(0, bk.bookedQuantity - bk.deliveredQuantity);
    const isDueSoonOrPast = Boolean(
      bk.deliveryTargetDate && bk.deliveryTargetDate <= todayDate
    );
    alerts.push({
      id: `alert-booking-${bk.id}`,
      category: 'BOOKING_DELIVERY',
      severity: isDueSoonOrPast ? 'CRITICAL' : 'WARNING',
      titleBn: `অগ্রিম ইট ডেলিভারি রিমাইন্ডার: ${bk.customerName} (${bk.bookingNo})`,
      titleEn: `Advance Brick Delivery Reminder: ${bk.customerName} (${bk.bookingNo})`,
      descriptionBn: `গ্রেড: ${bk.gradeName} · ডেলিভারির সম্ভাব্য তারিখ: ${bk.deliveryTargetDate} · অগ্রিম জমা: ৳${bk.advancePaid.toLocaleString('en-IN')}`,
      descriptionEn: `Grade: ${bk.gradeName} · Target Date: ${bk.deliveryTargetDate} · Advance Paid: Tk ${bk.advancePaid.toLocaleString('en-IN')}`,
      badgeBn: isDueSoonOrPast ? 'ডেলিভারির তারিখ উপস্থিত' : 'অগ্রিম বুকিং ডেলিভারি',
      badgeEn: isDueSoonOrPast ? 'Delivery Due Now' : 'Pending Booking Delivery',
      metricValueBn: `বাকি ${remainingBricks.toLocaleString('en-IN')} পিস ইট`,
      metricValueEn: `${remainingBricks.toLocaleString('en-IN')} pcs left`,
      dateLabel: bk.deliveryTargetDate,
      targetTab: 'booking_party',
      actionLabelBn: 'অগ্রিম বুকিং খাতা খুলুন',
      actionLabelEn: 'Open Advance Booking Ledger',
    });
  }

  if (pendingBookings.length === 0) {
    alerts.push({
      id: 'alert-booking-schedule-check',
      category: 'BOOKING_DELIVERY',
      severity: 'WARNING',
      titleBn: 'অগ্রিম ইট বুকিং ও পার্টি ডেলিভারি শিডিউল তদারকি',
      titleEn: 'Advance Brick Booking & Delivery Schedule Check',
      descriptionBn:
        'চলমান সিজনের অগ্রিম বুকিং পার্টিদের ইট ডেলিভারি ও নতুন বুকিং চুক্তির তালিকা যাচাই করুন।',
      descriptionEn:
        'Check advance brick booking contracts and upcoming customer truck delivery schedules.',
      badgeBn: 'অগ্রিম বুকিং ডেলিভারি',
      badgeEn: 'Advance Booking',
      metricValueBn: 'ডেলিভারি শিডিউল',
      metricValueEn: 'Delivery Schedule',
      dateLabel: todayDate,
      targetTab: 'booking_party',
      actionLabelBn: 'অগ্রিম বুকিং খাতা খুলুন',
      actionLabelEn: 'Open Advance Booking Ledger',
    });
  }

  // 4. License Renewal, DoE Clearance & Bank Installment Alerts (LICENSE_KISTI)
  const pendingCompliance = (state.complianceRecords || []).filter(
    (c) => c.status !== 'PAID' && (Number(c.dueAmount) || 0) > 0
  );
  for (const comp of pendingCompliance) {
    const isOverdue = Boolean(comp.dueDate && comp.dueDate <= todayDate);
    alerts.push({
      id: `alert-license-${comp.id}`,
      category: 'LICENSE_KISTI',
      severity: isOverdue || comp.dueAmount >= 50000 ? 'CRITICAL' : 'WARNING',
      titleBn: `${comp.titleBn} (${comp.authorityOrBankName})`,
      titleEn: `${comp.titleBn} (${comp.authorityOrBankName})`,
      descriptionBn: `ক্যাটাগরি: ${comp.category} · শেষ তারিখ: ${comp.dueDate} · রেফারেন্স: ${comp.referenceNo || 'N/A'}`,
      descriptionEn: `Category: ${comp.category} · Due Date: ${comp.dueDate} · Ref: ${comp.referenceNo || 'N/A'}`,
      badgeBn: isOverdue ? 'মেয়াদ উত্তীর্ণ সতর্কতা' : 'লাইসেন্স ও কিস্তি রিমাইন্ডার',
      badgeEn: isOverdue ? 'Deadline Alert' : 'License & Installment',
      metricValueBn: `বকেয়া ৳${comp.dueAmount.toLocaleString('en-IN')}`,
      metricValueEn: `Due Tk ${comp.dueAmount.toLocaleString('en-IN')}`,
      dateLabel: comp.dueDate,
      targetTab: 'license_kisti',
      actionLabelBn: 'লাইসেন্স ও কিস্তি খাতা খুলুন',
      actionLabelEn: 'Open License & Installment Tab',
    });
  }

  if (pendingCompliance.length === 0) {
    alerts.push({
      id: 'alert-license-doe-check',
      category: 'LICENSE_KISTI',
      severity: 'WARNING',
      titleBn: 'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE), ডিসি লাইসেন্স ও ব্যাংক সিসি কিস্তি যাচাই',
      titleEn: 'DoE Clearance, DC License & Bank CC Loan Installment Check',
      descriptionBn:
        'বার্ষিক পরিবেশ ছাড়পত্র নবায়ন, ভ্যাট চালান এবং ব্যাংকের মাসিক সিসি লোন কিস্তির তারিখ ট্র্যাক করুন।',
      descriptionEn:
        'Monitor annual DoE clearance renewal, VAT challan, and monthly bank CC loan installment deadlines.',
      badgeBn: 'লাইসেন্স ও কিস্তি রিমাইন্ডার',
      badgeEn: 'License & Installment',
      metricValueBn: 'সিজন 2026-27',
      metricValueEn: 'Season 2026-27',
      dateLabel: todayDate,
      targetTab: 'license_kisti',
      actionLabelBn: 'লাইসেন্স ও কিস্তি খাতা খুলুন',
      actionLabelEn: 'Open License & Installment Tab',
    });
  }

  // 5. Consolidated Low Brick Stock & Urgent Kiln Notes (STOCK_URGENT)
  const lowStockGrades = (state.brickGrades || []).filter(
    (g) => g.ratePerThousand && g.currentStock < 20000
  );
  if (lowStockGrades.length > 0 && totalStockPieces > 0) {
    const totalCurrentStock = (state.brickGrades || [])
      .filter((g) => g.ratePerThousand)
      .reduce((sum, g) => sum + (Number(g.currentStock) || 0), 0);
    const primaryGrade = lowStockGrades[0];

    alerts.push({
      id: 'alert-stock-consolidated',
      category: 'STOCK_URGENT',
      severity: totalCurrentStock < 10000 ? 'CRITICAL' : 'WARNING',
      titleBn: `পাকা ইটের স্টক সীমিত সতর্কতা (${lowStockGrades.length}টি গ্রেডে কম মজুত)`,
      titleEn: `Low Fired Brick Stock Alert (${lowStockGrades.length} grades low)`,
      descriptionBn: `${primaryGrade.nameBn}-সহ মাঠে বর্তমানে মোট পাকা ইট মজুত আছে ${totalCurrentStock.toLocaleString('en-IN')} পিস। চুল্লি থেকে নতুন আনলোড এন্ট্রি দিন।`,
      descriptionEn: `Total fired brick stock is ${totalCurrentStock.toLocaleString('en-IN')} pcs across grades. Record new kiln unload lines.`,
      badgeBn: 'স্টক সীমিত (Low Stock)',
      badgeEn: 'Low Stock Alert',
      metricValueBn: `মোট ${totalCurrentStock.toLocaleString('en-IN')} পিস মজুত`,
      metricValueEn: `${totalCurrentStock.toLocaleString('en-IN')} pcs in stock`,
      dateLabel: todayDate,
      targetTab: 'bricks',
      actionLabelBn: 'ইট স্টক ও আনলোড দেখুন',
      actionLabelEn: 'View Brick Stock',
    });
  }

  const urgentNotes = (state.kilnNotes || []).filter(
    (n) => !n.completed && n.priority === 'URGENT'
  );
  for (const note of urgentNotes) {
    alerts.push({
      id: `alert-note-${note.id}`,
      category: 'STOCK_URGENT',
      severity: 'WARNING',
      titleBn: note.title
        ? `জরুরি নোট ও রিমাইন্ডার: ${note.title}`
        : `ভাটার জরুরি রিমাইন্ডার নোট (${note.date})`,
      titleEn: note.title
        ? `Urgent Kiln Reminder: ${note.title}`
        : `Urgent Kiln Reminder Note (${note.date})`,
      descriptionBn: note.text,
      descriptionEn: note.text,
      badgeBn: 'জরুরি নোটপ্যাড',
      badgeEn: 'Urgent Note',
      metricValueBn: 'অসম্পন্ন কাজ',
      metricValueEn: 'Pending Task',
      dateLabel: note.date,
      targetTab: 'notes',
      actionLabelBn: 'নোটপ্যাড ও ডায়েরি খুলুন',
      actionLabelEn: 'Open Kiln Notepad',
      noteId: note.id,
    });
  }

  // Sort alerts: CRITICAL first, then WARNING, then INFO
  const severityRank: Record<KilnAlertSeverity, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
  };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const activeAlerts = alerts.filter((a) => !dismissedSet.has(a.id));

  const byCategory: Record<KilnAlertCategory, number> = {
    DUE_TAGADA: 0,
    COAL_FIRING: 0,
    BOOKING_DELIVERY: 0,
    LICENSE_KISTI: 0,
    STOCK_URGENT: 0,
  };
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const item of activeAlerts) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    if (item.severity === 'CRITICAL') criticalCount += 1;
    else if (item.severity === 'WARNING') warningCount += 1;
    else infoCount += 1;
  }

  return {
    allAlerts: alerts,
    activeAlerts,
    criticalCount,
    warningCount,
    infoCount,
    totalActiveCount: activeAlerts.length,
    byCategory,
  };
}

export interface FridayHatbarSardarRow {
  serialNo: number;
  sardarId:
    | 'MILL_OHAB'
    | 'MILL_MOFIJUL'
    | 'MILL_SOFIKUL'
    | 'VAN_SELIM'
    | 'PORAI_ALTAF'
    | 'UNLOAD_NAZRUL'
    | 'RUBBISH_OBED';
  sardarNameBn: string;
  roleBn: string;
  targetTab: NavigationTab;
  millId?: MillId;
  weeklyWorkQtyLabelBn: string;
  seasonWorkQtyLabelBn: string;
  weeklyBill: number;
  weeklyPaidKhorakiAndBill: number;
  todayPaidOnHatbar: number;
  seasonTotalBill: number;
  seasonTotalPaid: number;
  balanceDue: number;
  dinaAmount: number;
  isDina: boolean;
  weeklyEntriesCount: number;
}

export interface FridayHatbarSummarySheetInput {
  millPots: MillPotRecord[];
  chulliLoads: ChulliLoadRecord[];
  poraiMistriRecords: PoraiMistriRecord[];
  chulliUnloads: ChulliUnloadRecord[];
  rubbishRecords?: RubbishRecord[];
  hatbarDate: string;
  lookbackDays?: number;
}

export interface FridayHatbarSummarySheetResult {
  weekStartDate: string;
  hatbarDate: string;
  rows: FridayHatbarSardarRow[];
  grandWeeklyBill: number;
  grandWeeklyPaid: number;
  grandTodayHatbarPaid: number;
  grandSeasonTotalBill: number;
  grandSeasonTotalPaid: number;
  grandTotalBalanceDue: number;
  grandTotalDinaAmount: number;
}

function computeDateMinusDays(isoDate: string, daysToSubtract: number): string {
  const parts = String(isoDate || '')
    .trim()
    .split('-')
    .map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate;
  }
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() - Math.max(0, daysToSubtract));
  return dt.toISOString().slice(0, 10);
}

export function computeFridayHatbarSardarSummarySheet(
  input: FridayHatbarSummarySheetInput
): FridayHatbarSummarySheetResult {
  const hatbarDate = String(input.hatbarDate || '').trim() || '2026-11-07';
  const lookbackDays = Math.max(1, Number(input.lookbackDays) || 7);
  const weekStartDate = computeDateMinusDays(hatbarDate, lookbackDays - 1);

  const isWithinWeek = (d: string | undefined): boolean => {
    const clean = String(d || '').trim();
    if (!clean) return false;
    return clean >= weekStartDate && clean <= hatbarDate;
  };

  const isExactHatbarDate = (d: string | undefined): boolean =>
    String(d || '').trim() === hatbarDate;

  const buildBalance = (totalBill: number, totalPaid: number) => {
    const bill = Math.max(0, Math.round(totalBill));
    const paid = Math.max(0, Math.round(totalPaid));
    if (paid > bill) {
      return {
        balanceDue: 0,
        dinaAmount: paid - bill,
        isDina: true,
      };
    }
    return {
      balanceDue: bill - paid,
      dinaAmount: 0,
      isDina: false,
    };
  };

  const buildMillRow = (
    serialNo: number,
    sardarId: 'MILL_OHAB' | 'MILL_MOFIJUL' | 'MILL_SOFIKUL',
    millId: MillId,
    sardarNameBn: string,
    roleBn: string
  ): FridayHatbarSardarRow => {
    const allRecs = (input.millPots || []).filter((p) => p.millId === millId);
    const weekRecs = allRecs.filter((p) => isWithinWeek(p.date));
    const todayRecs = allRecs.filter((p) => isExactHatbarDate(p.date));

    const weeklyBricks = weekRecs.reduce(
      (s, r) => s + (Number(r.rawBricksCut) || 0),
      0
    );
    const seasonBricks = allRecs.reduce(
      (s, r) => s + (Number(r.rawBricksCut) || 0),
      0
    );

    const weeklyBill = Math.round(
      weekRecs.reduce((s, r) => s + (Number(r.totalPayable) || 0), 0)
    );
    const weeklyPaidKhorakiAndBill = Math.round(
      weekRecs.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
    );
    const todayPaidOnHatbar = Math.round(
      todayRecs.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
    );
    const seasonTotalBill = Math.round(
      allRecs.reduce((s, r) => s + (Number(r.totalPayable) || 0), 0)
    );
    const seasonTotalPaid = Math.round(
      allRecs.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
    );
    const bal = buildBalance(seasonTotalBill, seasonTotalPaid);

    return {
      serialNo,
      sardarId,
      sardarNameBn,
      roleBn,
      targetTab: 'mill_hisab',
      millId,
      weeklyWorkQtyLabelBn: `${weeklyBricks.toLocaleString('en-IN')} পিস কাঁচা ইট`,
      seasonWorkQtyLabelBn: `${seasonBricks.toLocaleString('en-IN')} পিস কাঁচা ইট`,
      weeklyBill,
      weeklyPaidKhorakiAndBill,
      todayPaidOnHatbar,
      seasonTotalBill,
      seasonTotalPaid,
      ...bal,
      weeklyEntriesCount: weekRecs.length,
    };
  };

  // 1..3: Mill Sardars (Ohab, Mofijul, Sofikul)
  const ohabRow = buildMillRow(
    1,
    'MILL_OHAB',
    'ohab',
    'ওহাব সর্দার',
    'মিল সর্দার (মিল-১)'
  );
  const mofijulRow = buildMillRow(
    2,
    'MILL_MOFIJUL',
    'mofijul',
    'মফিজুল সর্দার',
    'মিল সর্দার (মিল-২)'
  );
  const sofikulRow = buildMillRow(
    3,
    'MILL_SOFIKUL',
    'sofikul',
    'শফিকুল সর্দার',
    'মিল সর্দার (মিল-৩)'
  );

  // 4: Selim Sardar (Van Load)
  const allVan = input.chulliLoads || [];
  const weekVan = allVan.filter((r) => isWithinWeek(r.date));
  const todayVan = allVan.filter((r) => isExactHatbarDate(r.date));
  const sumVanBricks = (list: ChulliLoadRecord[]) =>
    list.reduce(
      (s, r) =>
        s +
        (r.totalBricksLoaded !== undefined
          ? Number(r.totalBricksLoaded) || 0
          : (Number(r.rawBricksLoaded) || 0) +
            (Number(r.pakaBricksLoaded) || 0)),
      0
    );
  const weekVanBricks = sumVanBricks(weekVan);
  const seasonVanBricks = sumVanBricks(allVan);
  const vanWeeklyBill = Math.round(
    weekVan.reduce((s, r) => s + (Number(r.totalBill) || 0), 0)
  );
  const vanWeeklyPaid = Math.round(
    weekVan.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const vanTodayPaid = Math.round(
    todayVan.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const vanSeasonBill = Math.round(
    allVan.reduce((s, r) => s + (Number(r.totalBill) || 0), 0)
  );
  const vanSeasonPaid = Math.round(
    allVan.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const selimRow: FridayHatbarSardarRow = {
    serialNo: 4,
    sardarId: 'VAN_SELIM',
    sardarNameBn: 'সেলিম সর্দার',
    roleBn: 'ভ্যান লোড সর্দার',
    targetTab: 'van_hisab',
    weeklyWorkQtyLabelBn: `${weekVanBricks.toLocaleString('en-IN')} ইট (${Math.floor(
      weekVanBricks / 4000
    )} লাইন)`,
    seasonWorkQtyLabelBn: `${seasonVanBricks.toLocaleString('en-IN')} ইট (${Math.floor(
      seasonVanBricks / 4000
    )} লাইন)`,
    weeklyBill: vanWeeklyBill,
    weeklyPaidKhorakiAndBill: vanWeeklyPaid,
    todayPaidOnHatbar: vanTodayPaid,
    seasonTotalBill: vanSeasonBill,
    seasonTotalPaid: vanSeasonPaid,
    ...buildBalance(vanSeasonBill, vanSeasonPaid),
    weeklyEntriesCount: weekVan.length,
  };

  // 5: Altaf Sardar (Porai Mistri)
  const allPorai = input.poraiMistriRecords || [];
  const weekPorai = allPorai.filter((r) => isWithinWeek(r.date));
  const todayPorai = allPorai.filter((r) => isExactHatbarDate(r.date));
  const weekPoraiBricks = weekPorai.reduce(
    (s, r) => s + (Number(r.bricksFired) || 0),
    0
  );
  const seasonPoraiBricks = allPorai.reduce(
    (s, r) => s + (Number(r.bricksFired) || 0),
    0
  );
  const poraiWeeklyBill = Math.round(
    weekPorai.reduce((s, r) => s + (Number(r.totalBill) || 0), 0)
  );
  const poraiWeeklyPaid = Math.round(
    weekPorai.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const poraiTodayPaid = Math.round(
    todayPorai.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const poraiSeasonBill = Math.round(
    allPorai.reduce((s, r) => s + (Number(r.totalBill) || 0), 0)
  );
  const poraiSeasonPaid = Math.round(
    allPorai.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const altafRow: FridayHatbarSardarRow = {
    serialNo: 5,
    sardarId: 'PORAI_ALTAF',
    sardarNameBn: 'আলতাফ সর্দার',
    roleBn: 'পোড়াই মিস্ত্রি সর্দার',
    targetTab: 'porai_mistri',
    weeklyWorkQtyLabelBn: `${weekPoraiBricks.toLocaleString('en-IN')} পিস পোড়ানো`,
    seasonWorkQtyLabelBn: `${seasonPoraiBricks.toLocaleString('en-IN')} পিস পোড়ানো`,
    weeklyBill: poraiWeeklyBill,
    weeklyPaidKhorakiAndBill: poraiWeeklyPaid,
    todayPaidOnHatbar: poraiTodayPaid,
    seasonTotalBill: poraiSeasonBill,
    seasonTotalPaid: poraiSeasonPaid,
    ...buildBalance(poraiSeasonBill, poraiSeasonPaid),
    weeklyEntriesCount: weekPorai.length,
  };

  // 6: Nazrul Sardar (Unload)
  const allUnload = input.chulliUnloads || [];
  const weekUnload = allUnload.filter((r) => isWithinWeek(r.date));
  const todayUnload = allUnload.filter((r) => isExactHatbarDate(r.date));
  const weekUnloadBricks = weekUnload.reduce(
    (s, r) => s + (Number(r.totalBricksUnloaded) || 0),
    0
  );
  const seasonUnloadBricks = allUnload.reduce(
    (s, r) => s + (Number(r.totalBricksUnloaded) || 0),
    0
  );
  const unloadWeeklyBill = Math.round(
    weekUnload.reduce((s, r) => s + (Number(r.totalBill) || 0), 0)
  );
  const unloadWeeklyPaid = Math.round(
    weekUnload.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const unloadTodayPaid = Math.round(
    todayUnload.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const unloadSeasonBill = Math.round(
    allUnload.reduce((s, r) => s + (Number(r.totalBill) || 0), 0)
  );
  const unloadSeasonPaid = Math.round(
    allUnload.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const nazrulRow: FridayHatbarSardarRow = {
    serialNo: 6,
    sardarId: 'UNLOAD_NAZRUL',
    sardarNameBn: 'নজরুল সর্দার',
    roleBn: 'আনলোড / নিকাশি সর্দার',
    targetTab: 'unload_hisab',
    weeklyWorkQtyLabelBn: `${weekUnloadBricks.toLocaleString('en-IN')} ইট (${Math.floor(
      weekUnloadBricks / 4000
    )} লাইন)`,
    seasonWorkQtyLabelBn: `${seasonUnloadBricks.toLocaleString('en-IN')} ইট (${Math.floor(
      seasonUnloadBricks / 4000
    )} লাইন)`,
    weeklyBill: unloadWeeklyBill,
    weeklyPaidKhorakiAndBill: unloadWeeklyPaid,
    todayPaidOnHatbar: unloadTodayPaid,
    seasonTotalBill: unloadSeasonBill,
    seasonTotalPaid: unloadSeasonPaid,
    ...buildBalance(unloadSeasonBill, unloadSeasonPaid),
    weeklyEntriesCount: weekUnload.length,
  };

  // 7: Obed Rubbish Sardar
  const allRubbish = input.rubbishRecords || [];
  const weekRubbish = allRubbish.filter((r) => isWithinWeek(r.date));
  const todayRubbish = allRubbish.filter((r) => isExactHatbarDate(r.date));
  const weekRubbishRounds = weekRubbish.filter(
    (r) => (Number(r.roundBill) || 0) > 0
  ).length;
  const seasonRubbishRounds = allRubbish.filter(
    (r) => (Number(r.roundBill) || 0) > 0
  ).length;
  const rubbishWeeklyBill = Math.round(
    weekRubbish.reduce((s, r) => s + (Number(r.roundBill) || 0), 0)
  );
  const rubbishWeeklyPaid = Math.round(
    weekRubbish.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const rubbishTodayPaid = Math.round(
    todayRubbish.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const rubbishSeasonBill = Math.round(
    allRubbish.reduce((s, r) => s + (Number(r.roundBill) || 0), 0)
  );
  const rubbishSeasonPaid = Math.round(
    allRubbish.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
  );
  const obedRow: FridayHatbarSardarRow = {
    serialNo: 7,
    sardarId: 'RUBBISH_OBED',
    sardarNameBn: 'অবেদ রাবিশ সর্দার',
    roleBn: 'রাবিশ সর্দার (রাউন্ড ও খোরাকি)',
    targetTab: 'rubbish_hisab',
    weeklyWorkQtyLabelBn: `${weekRubbishRounds} রাউন্ড রাবিশ কাজ`,
    seasonWorkQtyLabelBn: `${seasonRubbishRounds} রাউন্ড রাবিশ কাজ`,
    weeklyBill: rubbishWeeklyBill,
    weeklyPaidKhorakiAndBill: rubbishWeeklyPaid,
    todayPaidOnHatbar: rubbishTodayPaid,
    seasonTotalBill: rubbishSeasonBill,
    seasonTotalPaid: rubbishSeasonPaid,
    ...buildBalance(rubbishSeasonBill, rubbishSeasonPaid),
    weeklyEntriesCount: weekRubbish.length,
  };

  const rows: FridayHatbarSardarRow[] = [
    ohabRow,
    mofijulRow,
    sofikulRow,
    selimRow,
    altafRow,
    nazrulRow,
    obedRow,
  ];

  const grandWeeklyBill = rows.reduce((s, r) => s + r.weeklyBill, 0);
  const grandWeeklyPaid = rows.reduce(
    (s, r) => s + r.weeklyPaidKhorakiAndBill,
    0
  );
  const grandTodayHatbarPaid = rows.reduce(
    (s, r) => s + r.todayPaidOnHatbar,
    0
  );
  const grandSeasonTotalBill = rows.reduce((s, r) => s + r.seasonTotalBill, 0);
  const grandSeasonTotalPaid = rows.reduce((s, r) => s + r.seasonTotalPaid, 0);
  const grandTotalBalanceDue = rows.reduce((s, r) => s + r.balanceDue, 0);
  const grandTotalDinaAmount = rows.reduce((s, r) => s + r.dinaAmount, 0);

  return {
    weekStartDate,
    hatbarDate,
    rows,
    grandWeeklyBill,
    grandWeeklyPaid,
    grandTodayHatbarPaid,
    grandSeasonTotalBill,
    grandSeasonTotalPaid,
    grandTotalBalanceDue,
    grandTotalDinaAmount,
  };
}


