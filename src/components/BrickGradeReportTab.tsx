import React, { useEffect, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Edit3,
  Factory,
  Flame,
  Layers,
  PackagePlus,
  PlusCircle,
  Printer,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type {
  BrickGrade,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  GradeReportRow,
  LanguageMode,
  MillId,
  MillPotRecord,
  PoraiMistriRecord,
  ProductionPaymentRecord,
  ProductionPaymentSection,
  RubbishRecord,
  SalesMemo,
  UnloadedGradeItem,
} from '../types/kiln';
import {
  calculateChulliLineUnloadBill,
  calculateSardarFridaySettlement,
  calculateVanLoadBill,
  cleanBrickGradeName,
  computeNewWorkWithDinaAdjustment,
  computeUnloadLineAndSalesReconciliation,
  computeWorkerBalanceWithDina,
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
  type SardarPaymentMode,
} from '../utils/kilnLogic';

export type ProductionSectionView =
  | 'ALL'
  | 'MILLS'
  | 'CHULLI_LOAD'
  | 'PORAI_MISTRI'
  | 'CHULLI_UNLOAD'
  | 'RUBBISH_MISTRI'
  | 'FIRED_STOCK';

interface BrickGradeReportTabProps {
  lang?: LanguageMode;
  initialSectionView?: ProductionSectionView;
  hideOverviewBanner?: boolean;
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
  brickGrades: BrickGrade[];
  salesMemos?: SalesMemo[];
  millPots: MillPotRecord[];
  chulliLoads: ChulliLoadRecord[];
  poraiMistriRecords?: PoraiMistriRecord[];
  chulliUnloads: ChulliUnloadRecord[];
  rubbishRecords?: RubbishRecord[];
  productionPayments?: ProductionPaymentRecord[];
  onAddStock: (gradeId: string, quantity: number, newRate?: number) => Promise<void>;
  onSaveMillPot: (payload: {
    id?: string;
    millId: MillId;
    potNo: string;
    date: string;
    rawBricksCut: number;
    takenToChulli: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onDeleteMillPot: (id: string) => Promise<void>;
  onSaveChulliLoad: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    rawBricksLoaded: number;
    pakaBricksLoaded?: number;
    ratePerVan: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onDeleteChulliLoad?: (id: string) => Promise<void>;
  onSavePoraiMistri?: (payload: {
    id?: string;
    date: string;
    mistriName: string;
    chamberOrRound: string;
    mistriCount?: number;
    monthsCount?: number;
    monthlyRatePerMistri?: number;
    contractTotalBill?: number;
    bricksFired: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onDeletePoraiMistri?: (id: string) => Promise<void>;
  onSaveChulliUnload: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    linesUnloaded?: number;
    bricksPerLine?: number;
    ratePerLine?: number;
    ratePerThousand: number;
    unloadedByGrade?: UnloadedGradeItem[];
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onDeleteChulliUnload?: (id: string) => Promise<void>;
  onSaveRubbish?: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    roundBill: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onDeleteRubbish?: (id: string) => Promise<void>;
  onDeleteProductionPayment?: (id: string) => Promise<void>;
}

const MILL_OPTIONS: Array<{ id: MillId; nameBn: string; nameEn: string }> = [
  { id: 'ohab', nameBn: 'ওহাব সর্দার (ওহাব মিল)', nameEn: 'Ohab Sardar (Ohab Mill)' },
  { id: 'mofijul', nameBn: 'মফিজুল সর্দার (মফিজুল মিল)', nameEn: 'Mofijul Sardar (Mofijul Mill)' },
  { id: 'sofikul', nameBn: 'শফিকুল সর্দার (শফিকুল মিল)', nameEn: 'Sofikul Sardar (Sofikul Mill)' },
];

type DepositTarget =
  | { type: 'MILL_POT'; record: MillPotRecord }
  | { type: 'VAN_LOAD'; record: ChulliLoadRecord }
  | { type: 'PORAI_MISTRI'; record: PoraiMistriRecord }
  | { type: 'CHULLI_UNLOAD'; record: ChulliUnloadRecord }
  | { type: 'RUBBISH_SARDAR'; record: RubbishRecord };

export const BrickGradeReportTab: React.FC<BrickGradeReportTabProps> = ({
  lang = 'bn',
  initialSectionView = 'ALL',
  hideOverviewBanner = false,
  rows,
  totals,
  brickGrades,
  salesMemos = [],
  millPots = [],
  chulliLoads = [],
  poraiMistriRecords = [],
  chulliUnloads = [],
  rubbishRecords = [],
  productionPayments = [],
  onAddStock,
  onSaveMillPot,
  onDeleteMillPot,
  onSaveChulliLoad,
  onDeleteChulliLoad,
  onSavePoraiMistri,
  onDeletePoraiMistri,
  onSaveChulliUnload,
  onDeleteChulliUnload,
  onSaveRubbish,
  onDeleteRubbish,
  onDeleteProductionPayment,
}) => {
  const isEn = lang === 'en';
  const todayIso = new Date().toISOString().slice(0, 10);

  const [sectionView, setSectionView] = useState<ProductionSectionView>(initialSectionView);
  const [selectedMillFilter, setSelectedMillFilter] = useState<'ALL' | MillId>(
    initialSectionView === 'MILLS' ? 'ohab' : 'ohab'
  );

  useEffect(() => {
    setSectionView(initialSectionView);
    if (initialSectionView === 'MILLS') {
      setSelectedMillFilter((prev) => (prev === 'ALL' ? 'ohab' : prev));
    }
  }, [initialSectionView]);

  // Deposit / Payment Popup Modal State (খোরাকি ও শুক্রবারের চূড়ান্ত বিল পরিশোধ পপআপ)
  const [depositTarget, setDepositTarget] = useState<DepositTarget | null>(null);
  const [depositMode, setDepositMode] = useState<SardarPaymentMode>('KHORAKI');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositNote, setDepositNote] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // 1. Mill & Pot Form State (ওহাব সর্দার, মফিজুল সর্দার, শফিকুল সর্দার)
  const [editingPotId, setEditingPotId] = useState<string | undefined>(undefined);
  const [potMillId, setPotMillId] = useState<MillId>('ohab');
  const [potNo, setPotNo] = useState('পট-০১');
  const [potDate, setPotDate] = useState(todayIso);
  const [potRawBricks, setPotRawBricks] = useState('');
  const [potRatePerThousand, setPotRatePerThousand] = useState('');
  const [potPaidAmount, setPotPaidAmount] = useState('');
  const [potNote, setPotNote] = useState('');
  const [savingPot, setSavingPot] = useState(false);

  // 2. Chulli Van Load Form State (সেলিম সর্দার — ১০০০ পিস (হাজার প্রতি) রেট, কাঁচা ও পাকা ইট পৃথক ট্র্যাকিং)
  const [editingLoadId, setEditingLoadId] = useState<string | undefined>(undefined);
  const [loadDate, setLoadDate] = useState(todayIso);
  const [loadSardarName, setLoadSardarName] = useState('সেলিম সর্দার');
  const [loadBrickQty, setLoadBrickQty] = useState('');
  const [loadPakaBrickQty, setLoadPakaBrickQty] = useState('');
  const [loadRatePerVan, setLoadRatePerVan] = useState('');
  const [loadPaidAmount, setLoadPaidAmount] = useState('');
  const [loadNote, setLoadNote] = useState('');
  const [savingLoad, setSavingLoad] = useState(false);

  // 2b. Porai Mistri / Chulli Firing Master Form State (আলতাফ সর্দার — পোড়াই মিস্ত্রি সর্দার)
  const [editingPoraiId, setEditingPoraiId] = useState<string | undefined>(undefined);
  const [poraiDate, setPoraiDate] = useState(todayIso);
  const [poraiMistriName, setPoraiMistriName] = useState('আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)');
  const [poraiChamber, setPoraiChamber] = useState('সিজন চুক্তি (মাসভিত্তিক বিল ও সাপ্তাহিক কিস্তি)');
  const [poraiMistriCount, setPoraiMistriCount] = useState('');
  const [poraiMonthsCount, setPoraiMonthsCount] = useState('');
  const [poraiMonthlyRatePerMistri, setPoraiMonthlyRatePerMistri] = useState('');
  const [poraiContractTotalBill, setPoraiContractTotalBill] = useState('');
  const [poraiBricksFired, setPoraiBricksFired] = useState('');
  const [poraiRatePerThousand, setPoraiRatePerThousand] = useState('');
  const [poraiPaidAmount, setPoraiPaidAmount] = useState('');
  const [poraiNote, setPoraiNote] = useState('');
  const [savingPorai, setSavingPorai] = useState(false);

  // 3. Chulli Line Unload Form State (নজরুল সর্দার — ১ লাইন = ৪,০০০ ইট, প্রতি লাইন = ৭৫০ টাকা)
  const [editingUnloadId, setEditingUnloadId] = useState<string | undefined>(undefined);
  const [unloadDate, setUnloadDate] = useState(todayIso);
  const [unloadSardarName, setUnloadSardarName] = useState('নজরুল সর্দার');
  const [unloadChamber, setUnloadChamber] = useState('রাউন্ড-০১');
  const [unloadLines, setUnloadLines] = useState('');
  const [unloadBricksPerLine, setUnloadBricksPerLine] = useState('');
  const [unloadRatePerLine, setUnloadRatePerLine] = useState('');
  const [unloadPaidAmount, setUnloadPaidAmount] = useState('');
  const [unloadTargetGradeId, setUnloadTargetGradeId] = useState<string>(
    brickGrades[0]?.id || 'grade-1'
  );
  const [unloadNote, setUnloadNote] = useState('');
  const [savingUnload, setSavingUnload] = useState(false);

  // 3b. Rubbish Sardar Form State (অবেদ রাবিশ সর্দার — রাউন্ড হিসেবে টাকা ও খোরাকি)
  const [editingRubbishId, setEditingRubbishId] = useState<string | undefined>(undefined);
  const [rubbishDate, setRubbishDate] = useState(todayIso);
  const [rubbishSardarName, setRubbishSardarName] = useState('অবেদ রাবিশ সর্দার');
  const [rubbishRoundName, setRubbishRoundName] = useState('১ম রাউন্ড');
  const [rubbishRoundBill, setRubbishRoundBill] = useState('');
  const [rubbishPaidAmount, setRubbishPaidAmount] = useState('');
  const [rubbishNote, setRubbishNote] = useState('');
  const [savingRubbish, setSavingRubbish] = useState(false);

  // 4. Manual Stock Adjustment State
  const [selectedGradeId, setSelectedGradeId] = useState<string>(
    brickGrades[0]?.id || 'grade-1'
  );
  const [stockQty, setStockQty] = useState<string>('');
  const [customRate, setCustomRate] = useState<string>('');
  const [submittingStock, setSubmittingStock] = useState(false);

  // Computed Aggregates for Raw Bricks & Mills
  const totalRawCutAllMills = millPots.reduce((s, p) => s + p.rawBricksCut, 0);
  const totalMillPayable = millPots.reduce((s, p) => s + p.totalPayable, 0);
  const totalMillPaid = millPots.reduce((s, p) => s + p.paidAmount, 0);
  const totalMillDue = millPots.reduce((s, p) => s + p.dueAmount, 0);

  // Computed Aggregates for Chulli Van Loading (সেলিম সর্দার) + Auto 208-Line Chimney Sync
  const totalRawLoadedBricks = chulliLoads.reduce((s, l) => s + (Number(l.rawBricksLoaded) || 0), 0);
  const totalPakaLoadedBricks = chulliLoads.reduce((s, l) => s + (Number(l.pakaBricksLoaded) || 0), 0);
  const totalLoadedBricks = chulliLoads.reduce(
    (s, l) =>
      s +
      (l.totalBricksLoaded !== undefined
        ? Number(l.totalBricksLoaded) || 0
        : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
    0
  );
  const totalLoadedVans = chulliLoads.reduce((s, l) => s + l.vanCount, 0);
  const totalLoadedThousands = Number((totalLoadedBricks / 1000).toFixed(2));
  const totalLoadBill = chulliLoads.reduce((s, l) => s + l.totalBill, 0);
  const totalLoadPaid = chulliLoads.reduce((s, l) => s + l.paidAmount, 0);
  const totalLoadDue = chulliLoads.reduce((s, l) => s + l.dueAmount, 0);
  const autoChimneyFullLinesFromVan = Math.floor(totalLoadedBricks / 4000);
  const autoChimneyPartialBricks = totalLoadedBricks % 4000;
  const autoChimneyBricksNeededForNextLine =
    autoChimneyPartialBricks > 0 ? 4000 - autoChimneyPartialBricks : 4000;

  // Computed Aggregates for Porai Mistri / Chulli Firing Master (আলতাফ সর্দার)
  const totalPoraiMistriHeadcount = poraiMistriRecords.reduce(
    (maxCount, r) => Math.max(maxCount, Number(r.mistriCount) || 0),
    poraiMistriRecords.length > 0 ? 8 : 0
  );
  const totalPoraiBricks = poraiMistriRecords.reduce((s, r) => s + r.bricksFired, 0);
  const totalPoraiBill = poraiMistriRecords.reduce(
    (s, r) => s + (Number(r.contractTotalBill) > 0 ? Number(r.contractTotalBill) : r.totalBill),
    0
  );
  const totalPoraiPaid = poraiMistriRecords.reduce((s, r) => s + r.paidAmount, 0);
  const totalPoraiDue = Math.max(0, totalPoraiBill - totalPoraiPaid);

  // Computed Aggregates & Automatic Sales Reconciliation for Chulli Line Unloading (নজরুল সর্দার)
  const unloadReconciliation = computeUnloadLineAndSalesReconciliation(
    chulliUnloads,
    salesMemos,
    brickGrades
  );
  const totalUnloadedLines = unloadReconciliation.totalLinesUnloaded;
  const totalUnloadedBricks = unloadReconciliation.totalBricksFromLines;
  const totalUnloadBill = unloadReconciliation.totalUnloadBill;
  const totalUnloadPaid = unloadReconciliation.totalUnloadPaid;
  const totalUnloadDue = unloadReconciliation.totalUnloadDue;
  const remainingBricksInKiln = Math.max(0, totalLoadedBricks - totalUnloadedBricks);
  const remainingLinesInKiln = Math.max(
    0,
    Math.min(208, autoChimneyFullLinesFromVan - Math.floor(totalUnloadedLines))
  );
  const availableKilnLines = Math.max(0, 208 - remainingLinesInKiln);
  const totalCurrentBrickStock = brickGrades.reduce(
    (s, g) => s + (Number(g.currentStock) || 0),
    0
  );

  // Computed Aggregates for Rubbish Sardar (অবেদ রাবিশ সর্দার)
  const totalRubbishBill = rubbishRecords.reduce((s, r) => s + (Number(r.roundBill) || 0), 0);
  const totalRubbishPaid = rubbishRecords.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const totalRubbishDue = Math.max(0, totalRubbishBill - totalRubbishPaid);

  // Computed Balances with Dina (দিনা/অতিরিক্ত পরিশোধ) for All Sections
  const millOverallBalance = computeWorkerBalanceWithDina(totalMillPayable, totalMillPaid);
  const vanOverallBalance = computeWorkerBalanceWithDina(totalLoadBill, totalLoadPaid);
  const poraiOverallBalance = computeWorkerBalanceWithDina(totalPoraiBill, totalPoraiPaid);
  const unloadOverallBalance = computeWorkerBalanceWithDina(totalUnloadBill, totalUnloadPaid);
  const rubbishOverallBalance = computeWorkerBalanceWithDina(totalRubbishBill, totalRubbishPaid);

  // Live Preview for Mill Pot Form
  const livePotRaw = Math.max(0, parseNum(potRawBricks, 0));
  const livePotRate = Math.max(0, parseNum(potRatePerThousand, 1200));
  const livePotPayable = Math.round((livePotRaw / 1000) * livePotRate);
  const livePotPaid = Math.max(0, parseNum(potPaidAmount, 0));
  const livePotDue = Math.max(0, livePotPayable - livePotPaid);

  const selectedMillPots = millPots.filter((p) => p.millId === potMillId);
  const selectedMillTotalBill = selectedMillPots.reduce((s, p) => s + p.totalPayable, 0);
  const selectedMillTotalPaid = selectedMillPots.reduce((s, p) => s + p.paidAmount, 0);
  const selectedMillPriorBalance = computeWorkerBalanceWithDina(selectedMillTotalBill, selectedMillTotalPaid);
  const selectedMillPriorDina = selectedMillPriorBalance.isDina ? selectedMillPriorBalance.dinaAmount : 0;
  const livePotAdjustment = computeNewWorkWithDinaAdjustment(
    livePotPayable,
    selectedMillPriorDina,
    livePotPaid
  );

  // Live Preview for Van Load Form (Per 1,000 bricks rate — সেলিম সর্দার)
  const {
    rawBricksLoaded: liveLoadRawBricks,
    pakaBricksLoaded: liveLoadPakaBricks,
    totalBricksLoaded: liveLoadTotalBricks,
    bricksLoaded: liveLoadBricks,
    vanCount: liveVanCount,
    thousandUnits: liveLoadThousandUnits,
    ratePerThousand: liveVanRate,
    totalBill: liveLoadTotalBill,
    fullLines: liveEntryFullLines,
    partialBricks: liveEntryPartialBricks,
  } = calculateVanLoadBill(
    Math.max(0, parseNum(loadBrickQty, 0)),
    Math.max(0, parseNum(loadRatePerVan, 115)),
    Math.max(0, parseNum(loadPakaBrickQty, 0))
  );
  const liveLoadPaid = Math.max(0, parseNum(loadPaidAmount, 0));
  const liveLoadDue = Math.max(0, liveLoadTotalBill - liveLoadPaid);
  const liveEntryChimneyLines = Number((liveLoadTotalBricks / 4000).toFixed(2));

  const vanPriorDina = vanOverallBalance.isDina ? vanOverallBalance.dinaAmount : 0;
  const liveVanAdjustment = computeNewWorkWithDinaAdjustment(
    liveLoadTotalBill,
    vanPriorDina,
    liveLoadPaid
  );

  // Live Preview for Porai Mistri Form (আলতাফ সর্দার)
  const livePoraiMistriCount = Math.max(0, Math.round(parseNum(poraiMistriCount, 0)));
  const livePoraiMonths = Math.max(0, parseNum(poraiMonthsCount, 0));
  const livePoraiMonthlyRate = Math.max(0, parseNum(poraiMonthlyRatePerMistri, 0));
  const livePoraiContractBillInput = Math.max(0, Math.round(parseNum(poraiContractTotalBill, 0)));
  const livePoraiBricks = Math.max(0, parseNum(poraiBricksFired, 0));
  const livePoraiRate = Math.max(0, parseNum(poraiRatePerThousand, 220) || 220);
  const effectiveCalcMistriCount = livePoraiMistriCount > 0 ? livePoraiMistriCount : 8;
  const effectiveCalcMonths = livePoraiMonths > 0 ? livePoraiMonths : 5;
  const livePoraiTotalBill =
    livePoraiContractBillInput > 0
      ? livePoraiContractBillInput
      : livePoraiMonthlyRate > 0
      ? Math.round(effectiveCalcMistriCount * effectiveCalcMonths * livePoraiMonthlyRate)
      : Math.round((livePoraiBricks / 1000) * livePoraiRate);
  const livePoraiPaid = Math.max(0, parseNum(poraiPaidAmount, 0));
  const livePoraiDue = Math.max(0, livePoraiTotalBill - livePoraiPaid);
  const livePoraiBalance = computeWorkerBalanceWithDina(livePoraiTotalBill, livePoraiPaid);

  // Live Preview for Chulli Line Unload Form (নজরুল সর্দার — ১ লাইন = ৪০০০ ইট @ ৭৫০ টাকা)
  const liveUnloadCalc = calculateChulliLineUnloadBill(
    Math.max(0, parseNum(unloadLines, 0)),
    Math.max(0, parseNum(unloadRatePerLine, 750) || 750),
    Math.max(1, parseNum(unloadBricksPerLine, 4000) || 4000),
    Math.max(0, parseNum(unloadPaidAmount, 0))
  );
  const liveTotalUnloadBricks = liveUnloadCalc.totalBricksUnloaded;
  const liveUnloadTotalBill = liveUnloadCalc.totalBill;
  const liveUnloadPaid = liveUnloadCalc.paidAmount;
  const liveUnloadDue = liveUnloadCalc.dueAmount;
  const liveUnloadBalance = computeWorkerBalanceWithDina(liveUnloadTotalBill, liveUnloadPaid);

  // Live Preview for Rubbish Sardar Form (অবেদ রাবিশ সর্দার)
  const liveRubbishBill = Math.max(0, Math.round(parseNum(rubbishRoundBill, 0)));
  const liveRubbishPaid = Math.max(0, Math.round(parseNum(rubbishPaidAmount, 0)));
  const rubbishPriorDina = rubbishOverallBalance.isDina ? rubbishOverallBalance.dinaAmount : 0;
  const liveRubbishAdjustment = computeNewWorkWithDinaAdjustment(
    liveRubbishBill,
    rubbishPriorDina,
    liveRubbishPaid
  );

  const filteredMillPots =
    selectedMillFilter === 'ALL'
      ? millPots
      : millPots.filter((p) => p.millId === selectedMillFilter);

  const filteredMillRawCut = filteredMillPots.reduce((s, p) => s + p.rawBricksCut, 0);
  const filteredMillPayable = filteredMillPots.reduce((s, p) => s + p.totalPayable, 0);
  const filteredMillPaid = filteredMillPots.reduce((s, p) => s + p.paidAmount, 0);
  const filteredMillDue = filteredMillPots.reduce((s, p) => s + p.dueAmount, 0);

  // Helper to get payment records for a given section
  const getSectionPayments = (section: ProductionPaymentSection): ProductionPaymentRecord[] => {
    const explicit = productionPayments.filter((p) => p.section === section);
    const recordedRefIds = new Set(explicit.map((p) => p.referenceId));

    const fallback: ProductionPaymentRecord[] = [];
    if (section === 'MILL') {
      for (const pot of millPots) {
        if (pot.paidAmount > 0 && !recordedRefIds.has(pot.id)) {
          fallback.push({
            id: `legacy-pot-${pot.id}`,
            section: 'MILL',
            referenceId: pot.id,
            recipientName: `${pot.millNameBn} (${pot.potNo})`,
            subDetail: `${formatBn(pot.rawBricksCut)} পিস ইট @ ৳${formatBn(pot.ratePerThousand)}/হাজার`,
            amount: pot.paidAmount,
            date: pot.date,
            note: pot.note || 'জমা দেওয়া টাকা',
            createdAt: pot.createdAt,
          });
        }
      }
    } else if (section === 'VAN_LOAD') {
      for (const ld of chulliLoads) {
        if (ld.paidAmount > 0 && !recordedRefIds.has(ld.id)) {
          fallback.push({
            id: `legacy-ld-${ld.id}`,
            section: 'VAN_LOAD',
            referenceId: ld.id,
            recipientName: ld.sardarName,
            subDetail: `${formatBn(ld.rawBricksLoaded)} পিস (${formatBn(ld.vanCount)} ভ্যান)`,
            amount: ld.paidAmount,
            date: ld.date,
            note: ld.note || 'ভ্যান লোড জমা টাকা',
            createdAt: ld.createdAt,
          });
        }
      }
    } else if (section === 'PORAI_MISTRI') {
      for (const pr of poraiMistriRecords) {
        if (pr.paidAmount > 0 && !recordedRefIds.has(pr.id)) {
          fallback.push({
            id: `legacy-porai-${pr.id}`,
            section: 'PORAI_MISTRI',
            referenceId: pr.id,
            recipientName: `${pr.mistriName} (${pr.chamberOrRound})`,
            subDetail: `${formatBn(pr.bricksFired)} পিস চুল্লি পোড়াই`,
            amount: pr.paidAmount,
            date: pr.date,
            note: pr.note || 'পোড়াই মিস্ত্রি জমা টাকা',
            createdAt: pr.createdAt,
          });
        }
      }
    } else if (section === 'UNLOAD') {
      for (const un of chulliUnloads) {
        if (un.paidAmount > 0 && !recordedRefIds.has(un.id)) {
          fallback.push({
            id: `legacy-un-${un.id}`,
            section: 'UNLOAD',
            referenceId: un.id,
            recipientName: `${un.sardarName} (${un.chamberOrRound})`,
            subDetail: `${formatBn(un.totalBricksUnloaded)} পিস আনলোড`,
            amount: un.paidAmount,
            date: un.date,
            note: un.note || 'আনলোড জমা টাকা',
            createdAt: un.createdAt,
          });
        }
      }
    } else if (section === 'RUBBISH') {
      for (const rb of rubbishRecords) {
        if (rb.paidAmount > 0 && !recordedRefIds.has(rb.id)) {
          fallback.push({
            id: `legacy-rb-${rb.id}`,
            section: 'RUBBISH',
            referenceId: rb.id,
            recipientName: `${rb.sardarName} (${rb.chamberOrRound})`,
            subDetail: `${rb.chamberOrRound} · রাউন্ড বিল ৳${formatBn(rb.roundBill)}`,
            amount: rb.paidAmount,
            date: rb.date,
            note: rb.note || 'রাবিশ সর্দার খোরাকি/জমা টাকা',
            createdAt: rb.createdAt,
          });
        }
      }
    }
    return [...explicit, ...fallback];
  };

  const millPayments = getSectionPayments('MILL');
  const vanPayments = getSectionPayments('VAN_LOAD');
  const poraiPayments = getSectionPayments('PORAI_MISTRI');
  const unloadPayments = getSectionPayments('UNLOAD');
  const rubbishPayments = getSectionPayments('RUBBISH');

  const openDepositModal = (
    target: DepositTarget,
    mode: SardarPaymentMode = 'KHORAKI'
  ) => {
    setDepositTarget(target);
    setDepositMode(mode);
    setDepositAmount('');
    if (mode === 'FRIDAY_FINAL') {
      setDepositNote('শুক্রবারের চূড়ান্ত সর্দার বিল পরিশোধ (Paid)');
    } else {
      setDepositNote('সাপ্তাহিক খোরাকি বাবদ প্রদান (বিল হতে কর্তন)');
    }
  };

  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTarget) return;
    const addAmt = Math.max(0, parseNum(depositAmount, 0));
    if (addAmt <= 0) return;

    const fallbackNote =
      depositMode === 'KHORAKI'
        ? 'সাপ্তাহিক খোরাকি বাবদ প্রদান (বিল হতে কর্তন)'
        : 'শুক্রবারের চূড়ান্ত সর্দার বিল পরিশোধ (Paid)';
    const effectiveNote = depositNote.trim() || fallbackNote;

    setSubmittingDeposit(true);
    try {
      if (depositTarget.type === 'MILL_POT') {
        const pot = depositTarget.record;
        const newPaid = pot.paidAmount + addAmt;
        const appendedNote = `${pot.note ? pot.note + ' | ' : ''}${effectiveNote}`;
        await onSaveMillPot({
          id: pot.id,
          millId: pot.millId,
          potNo: pot.potNo,
          date: pot.date,
          rawBricksCut: pot.rawBricksCut,
          takenToChulli: pot.takenToChulli,
          ratePerThousand: pot.ratePerThousand,
          paidAmount: newPaid,
          note: appendedNote,
        });
      } else if (depositTarget.type === 'VAN_LOAD') {
        const ld = depositTarget.record;
        const newPaid = ld.paidAmount + addAmt;
        const appendedNote = `${ld.note ? ld.note + ' | ' : ''}${effectiveNote}`;
        await onSaveChulliLoad({
          id: ld.id,
          date: ld.date,
          sardarName: ld.sardarName,
          rawBricksLoaded: ld.rawBricksLoaded,
          ratePerVan: ld.ratePerVan,
          paidAmount: newPaid,
          note: appendedNote,
        });
      } else if (depositTarget.type === 'PORAI_MISTRI' && onSavePoraiMistri) {
        const pr = depositTarget.record;
        const newPaid = pr.paidAmount + addAmt;
        const appendedNote = `${pr.note ? pr.note + ' | ' : ''}${effectiveNote}`;
        await onSavePoraiMistri({
          id: pr.id,
          date: pr.date,
          mistriName: pr.mistriName,
          chamberOrRound: pr.chamberOrRound,
          mistriCount: pr.mistriCount,
          monthsCount: pr.monthsCount,
          monthlyRatePerMistri: pr.monthlyRatePerMistri,
          contractTotalBill: pr.contractTotalBill || pr.totalBill,
          bricksFired: pr.bricksFired,
          ratePerThousand: pr.ratePerThousand,
          paidAmount: newPaid,
          note: appendedNote,
        });
      } else if (depositTarget.type === 'CHULLI_UNLOAD') {
        const un = depositTarget.record;
        const newPaid = un.paidAmount + addAmt;
        const appendedNote = `${un.note ? un.note + ' | ' : ''}${effectiveNote}`;
        await onSaveChulliUnload({
          id: un.id,
          date: un.date,
          sardarName: un.sardarName,
          chamberOrRound: un.chamberOrRound,
          linesUnloaded: un.linesUnloaded,
          bricksPerLine: un.bricksPerLine,
          ratePerLine: un.ratePerLine,
          ratePerThousand: un.ratePerThousand,
          paidAmount: newPaid,
          note: appendedNote,
          unloadedByGrade: un.unloadedByGrade,
        });
      } else if (depositTarget.type === 'RUBBISH_SARDAR' && onSaveRubbish) {
        const rb = depositTarget.record;
        const newPaid = rb.paidAmount + addAmt;
        const appendedNote = `${rb.note ? rb.note + ' | ' : ''}${effectiveNote}`;
        await onSaveRubbish({
          id: rb.id,
          date: rb.date,
          sardarName: rb.sardarName,
          chamberOrRound: rb.chamberOrRound,
          roundBill: rb.roundBill,
          paidAmount: newPaid,
          note: appendedNote,
        });
      }
      setDepositTarget(null);
      setDepositAmount('');
      setDepositNote('');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handlePotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (livePotRaw <= 0 && livePotPaid <= 0) return;
    setSavingPot(true);
    try {
      await onSaveMillPot({
        id: editingPotId,
        millId: potMillId,
        potNo: potNo.trim() || (livePotRaw <= 0 && livePotPaid > 0 ? 'নগদ জমা / খোরাকি' : `পট-০${millPots.length + 1}`),
        date: potDate,
        rawBricksCut: livePotRaw,
        takenToChulli: 0,
        ratePerThousand: livePotRate || 1200,
        paidAmount: livePotPaid,
        note: potNote.trim(),
      });
      setSelectedMillFilter((prev) => (prev === 'ALL' ? 'ALL' : potMillId));
      setEditingPotId(undefined);
      setPotNo(`পট-০${millPots.length + 2}`);
      setPotRawBricks('');
      setPotPaidAmount('');
      setPotNote('');
    } finally {
      setSavingPot(false);
    }
  };

  const handleEditPot = (pot: MillPotRecord) => {
    setEditingPotId(pot.id);
    setPotMillId(pot.millId);
    setSelectedMillFilter((prev) => (prev === 'ALL' ? 'ALL' : pot.millId));
    setPotNo(pot.potNo);
    setPotDate(pot.date);
    setPotRawBricks(pot.rawBricksCut > 0 ? String(pot.rawBricksCut) : '');
    setPotRatePerThousand(pot.ratePerThousand > 0 ? String(pot.ratePerThousand) : '');
    setPotPaidAmount(pot.paidAmount > 0 ? String(pot.paidAmount) : '');
    setPotNote(pot.note || '');
  };

  const handleVanLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveLoadTotalBricks <= 0 && liveLoadPaid <= 0) return;
    setSavingLoad(true);
    try {
      await onSaveChulliLoad({
        id: editingLoadId,
        date: loadDate,
        sardarName: loadSardarName.trim() || 'সেলিম সর্দার',
        rawBricksLoaded: liveLoadRawBricks,
        pakaBricksLoaded: liveLoadPakaBricks,
        ratePerVan: liveVanRate,
        paidAmount: liveLoadPaid,
        note: loadNote.trim(),
      });
      setEditingLoadId(undefined);
      setLoadBrickQty('');
      setLoadPakaBrickQty('');
      setLoadPaidAmount('');
      setLoadNote('');
    } finally {
      setSavingLoad(false);
    }
  };

  const handleEditVanLoad = (ld: ChulliLoadRecord) => {
    const normalizedRate =
      ld.ratePerVan > 0 && ld.ratePerVan <= 30
        ? Number((ld.ratePerVan * 10).toFixed(2))
        : ld.ratePerVan || 115;
    setEditingLoadId(ld.id);
    setLoadDate(ld.date);
    setLoadSardarName(ld.sardarName || 'সেলিম সর্দার');
    setLoadBrickQty(ld.rawBricksLoaded > 0 ? String(ld.rawBricksLoaded) : '');
    setLoadPakaBrickQty((ld.pakaBricksLoaded || 0) > 0 ? String(ld.pakaBricksLoaded) : '');
    setLoadRatePerVan(normalizedRate > 0 ? String(normalizedRate) : '');
    setLoadPaidAmount(ld.paidAmount > 0 ? String(ld.paidAmount) : '');
    setLoadNote(ld.note || '');
  };

  const handlePoraiMistriSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSavePoraiMistri || (livePoraiTotalBill <= 0 && livePoraiPaid <= 0)) return;
    setSavingPorai(true);
    try {
      const effectiveMistriCount = livePoraiMistriCount > 0 ? livePoraiMistriCount : 8;
      const effectiveMonths = livePoraiMonths > 0 ? livePoraiMonths : 5;
      await onSavePoraiMistri({
        id: editingPoraiId,
        date: poraiDate,
        mistriName: poraiMistriName.trim() || 'আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)',
        chamberOrRound:
          poraiChamber.trim() || `${formatBn(effectiveMistriCount)} জন মিস্ত্রি (${formatBn(effectiveMonths)} মাস চুক্তি)`,
        mistriCount: effectiveMistriCount,
        monthsCount: effectiveMonths,
        monthlyRatePerMistri: livePoraiMonthlyRate,
        contractTotalBill: livePoraiTotalBill,
        bricksFired: livePoraiBricks,
        ratePerThousand: livePoraiRate,
        paidAmount: livePoraiPaid,
        note: poraiNote.trim(),
      });
      setEditingPoraiId(undefined);
      setPoraiContractTotalBill('');
      setPoraiPaidAmount('');
      setPoraiNote('');
    } finally {
      setSavingPorai(false);
    }
  };

  const handleEditPoraiMistri = (pr: PoraiMistriRecord) => {
    setEditingPoraiId(pr.id);
    setPoraiDate(pr.date);
    setPoraiMistriName(pr.mistriName || 'আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)');
    setPoraiChamber(pr.chamberOrRound);
    setPoraiMistriCount(pr.mistriCount && pr.mistriCount > 0 ? String(pr.mistriCount) : '');
    setPoraiMonthsCount(pr.monthsCount && pr.monthsCount > 0 ? String(pr.monthsCount) : '');
    setPoraiMonthlyRatePerMistri(
      pr.monthlyRatePerMistri && pr.monthlyRatePerMistri > 0 ? String(pr.monthlyRatePerMistri) : ''
    );
    const cBill = pr.contractTotalBill && pr.contractTotalBill > 0 ? pr.contractTotalBill : pr.totalBill;
    setPoraiContractTotalBill(cBill > 0 ? String(cBill) : '');
    setPoraiBricksFired(pr.bricksFired > 0 ? String(pr.bricksFired) : '');
    setPoraiRatePerThousand(pr.ratePerThousand > 0 ? String(pr.ratePerThousand) : '');
    setPoraiPaidAmount(pr.paidAmount > 0 ? String(pr.paidAmount) : '');
    setPoraiNote(pr.note || '');
  };

  const handleChulliUnloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUnloadCalc.linesUnloaded <= 0 && liveUnloadPaid <= 0) return;
    setSavingUnload(true);
    try {
      const targetGrade =
        brickGrades.find((g) => g.id === unloadTargetGradeId) || brickGrades[0];
      await onSaveChulliUnload({
        id: editingUnloadId,
        date: unloadDate,
        sardarName: unloadSardarName.trim() || 'নজরুল সর্দার',
        chamberOrRound: unloadChamber.trim() || 'রাউন্ড-০১',
        linesUnloaded: liveUnloadCalc.linesUnloaded,
        bricksPerLine: liveUnloadCalc.bricksPerLine,
        ratePerLine: liveUnloadCalc.ratePerLine,
        ratePerThousand: liveUnloadCalc.equivalentRatePerThousand,
        unloadedByGrade:
          liveUnloadCalc.totalBricksUnloaded > 0 && targetGrade
            ? [
                {
                  gradeId: targetGrade.id,
                  gradeName: cleanBrickGradeName(targetGrade.nameBn),
                  quantity: liveUnloadCalc.totalBricksUnloaded,
                },
              ]
            : [],
        paidAmount: liveUnloadPaid,
        note: unloadNote.trim(),
      });
      setEditingUnloadId(undefined);
      setUnloadLines('');
      setUnloadPaidAmount('');
      setUnloadNote('');
    } finally {
      setSavingUnload(false);
    }
  };

  const handleEditChulliUnload = (un: ChulliUnloadRecord) => {
    const bPerLine = un.bricksPerLine && un.bricksPerLine > 0 ? un.bricksPerLine : 4000;
    const lines =
      un.linesUnloaded && un.linesUnloaded > 0
        ? un.linesUnloaded
        : Number(((un.totalBricksUnloaded || 0) / bPerLine).toFixed(2));
    setEditingUnloadId(un.id);
    setUnloadDate(un.date);
    setUnloadSardarName(un.sardarName || 'নজরুল সর্দার');
    setUnloadChamber(un.chamberOrRound);
    setUnloadLines(lines > 0 ? String(lines) : '');
    setUnloadBricksPerLine(bPerLine > 0 ? String(bPerLine) : '');
    setUnloadRatePerLine(un.ratePerLine && un.ratePerLine > 0 ? String(un.ratePerLine) : '');
    setUnloadPaidAmount(un.paidAmount > 0 ? String(un.paidAmount) : '');
    if (Array.isArray(un.unloadedByGrade) && un.unloadedByGrade[0]?.gradeId) {
      setUnloadTargetGradeId(un.unloadedByGrade[0].gradeId);
    }
    setUnloadNote(un.note || '');
  };

  const handleRubbishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveRubbish || (liveRubbishBill <= 0 && liveRubbishPaid <= 0)) return;
    setSavingRubbish(true);
    try {
      await onSaveRubbish({
        id: editingRubbishId,
        date: rubbishDate,
        sardarName: rubbishSardarName.trim() || 'অবেদ রাবিশ সর্দার',
        chamberOrRound: rubbishRoundName.trim() || '১ম রাউন্ড',
        roundBill: liveRubbishBill,
        paidAmount: liveRubbishPaid,
        note: rubbishNote.trim(),
      });
      setEditingRubbishId(undefined);
      setRubbishRoundBill('');
      setRubbishPaidAmount('');
      setRubbishNote('');
    } finally {
      setSavingRubbish(false);
    }
  };

  const handleEditRubbish = (rb: RubbishRecord) => {
    setEditingRubbishId(rb.id);
    setRubbishDate(rb.date);
    setRubbishSardarName(rb.sardarName || 'অবেদ রাবিশ সর্দার');
    setRubbishRoundName(rb.chamberOrRound || '১ম রাউন্ড');
    setRubbishRoundBill(rb.roundBill > 0 ? String(rb.roundBill) : '');
    setRubbishPaidAmount(rb.paidAmount > 0 ? String(rb.paidAmount) : '');
    setRubbishNote(rb.note || '');
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseNum(customRate, 0);
    const qty = Math.max(0, parseNum(stockQty, 0));
    if (rateNum <= 0 && qty <= 0) return;
    setSubmittingStock(true);
    try {
      await onAddStock(
        selectedGradeId,
        qty,
        rateNum > 0 ? rateNum : undefined
      );
      setStockQty('');
      setCustomRate('');
    } finally {
      setSubmittingStock(false);
    }
  };

  const renderPaymentRecordsTable = (
    titleBn: string,
    subtitleBn: string,
    payments: ProductionPaymentRecord[],
    accentColor: 'orange' | 'sky' | 'amber' | 'emerald' = 'emerald'
  ) => {
    const totalPaidInList = payments.reduce((s, p) => s + p.amount, 0);
    const badgeColor =
      accentColor === 'sky'
        ? 'bg-sky-100 text-sky-900 border-sky-300'
        : accentColor === 'amber'
        ? 'bg-amber-100 text-amber-900 border-amber-300'
        : accentColor === 'orange'
        ? 'bg-orange-100 text-orange-900 border-orange-300'
        : 'bg-emerald-100 text-emerald-900 border-emerald-300';

    return (
      <div className="bg-slate-50/90 border-2 border-emerald-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                  {titleBn}
                </h4>
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border ${badgeColor}`}>
                  মোট রেকর্ড: {formatBn(payments.length)}টি
                </span>
              </div>
              <p className="text-xs text-slate-600">{subtitleBn}</p>
            </div>
          </div>
          <div className="bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-right self-start sm:self-auto">
            <span className="text-[11px] font-semibold text-slate-600 block">
              সর্বমোট জমা দেওয়া টাকা:
            </span>
            <strong className="text-sm sm:text-base font-bold font-mono text-emerald-700 tabular-nums">
              {formatCurrencyBn(totalPaidInList)}
            </strong>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl py-6 px-4 text-center text-xs text-slate-500">
            এখনো কোনো টাকা জমা দেওয়ার রেকর্ড যোগ হয়নি। ফর্ম থেকে অথবা <strong>"+ টাকা জমা দিন"</strong> বাটনে ক্লিক করে টাকা জমা দিলে এখানে তারিখসহ সব রেকর্ড জমা থাকবে।
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="bg-emerald-50/80 border-b border-emerald-200 text-slate-800">
                  <th className="py-2.5 px-3 font-bold">ক্রমিক নং</th>
                  <th className="py-2.5 px-3 font-bold">তারিখ</th>
                  <th className="py-2.5 px-3 font-bold">কাকে জমা দেওয়া হয়েছে (নাম ও বিবরণ)</th>
                  <th className="py-2.5 px-3 font-bold">ইট / কাজের বিবরণ</th>
                  <th className="py-2.5 px-3 font-bold">নোট / মন্তব্য</th>
                  <th className="py-2.5 px-3 font-bold text-right">জমা দেওয়া টাকা (৳)</th>
                  {onDeleteProductionPayment && (
                    <th className="py-2.5 px-3 font-bold text-right">অ্যাকশন</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((pay, idx) => (
                  <tr key={pay.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-600 tabular-nums">
                      #{formatBn(idx + 1)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                      {pay.date}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {pay.recipientName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {pay.subDetail}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {pay.note || 'নগদ জমা'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatCurrencyBn(pay.amount)}
                    </td>
                    {onDeleteProductionPayment && (
                      <td className="py-2.5 px-3 text-right">
                        {!pay.id.startsWith('legacy-') ? (
                          <button
                            type="button"
                            onClick={() => onDeleteProductionPayment(pay.id)}
                            title="জমা রেকর্ড মুছে ফেলুন"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">এন্ট্রি সংযুক্ত</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/90 border-t-2 border-emerald-300 font-bold text-slate-900">
                  <td colSpan={5} className="py-2.5 px-3 text-right">
                    সর্বমোট জমা দেওয়া টাকা ({formatBn(payments.length)}টি কিস্তি/রেকর্ড):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800 tabular-nums">
                    {formatCurrencyBn(totalPaidInList)}
                  </td>
                  {onDeleteProductionPayment && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Overview Command Banner: Raw Brick -> Chulli Load -> Porai Mistri -> Chulli Unload -> Fired Brick Stock */}
      {!hideOverviewBanner && (
        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-4 sm:p-6 text-white space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/90 pb-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/20 shrink-0">
                <Factory className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    লাইভ ভাটা উৎপাদন ও স্টক পাইপলাইন
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                    {isEn
                      ? '3 Mills · Van Load · Porai Mistri · Unload · Rubbish · Stock'
                      : 'মিল সর্দার · সেলিম সর্দার · আলতাফ সর্দার · নজরুল সর্দার · অবেদ রাবিশ সর্দার'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-0.5">
                  {isEn
                    ? 'Complete Mill, Van, Porai Mistri, Unload, Rubbish Sardar & Stock Ledger'
                    : 'মিল হিসাব (ওহাব·মফিজুল·শফিকুল), ভ্যান (সেলিম), পোড়াই (আলতাফ), আনলোড (নজরুল) ও রাবিশ সর্দার (অবেদ)'}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="sbl-btn-interactive inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-500/25 self-start sm:self-auto shrink-0"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              {isEn ? 'Print Report' : 'রিপোর্ট প্রিন্ট / PDF'}
            </button>
          </div>

          {/* 6 Pipeline KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div
              onClick={() => setSectionView('MILLS')}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3.5 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-amber-400">
                ১. মিল সর্দার (ওহাব · মফিজুল · শফিকুল)
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalRawCutAllMills)} <span className="text-xs font-normal text-slate-400">পিস</span>
              </div>
              <div className="text-[11px] text-slate-300">
                মোট পট: <strong>{formatBn(millPots.length)}টি</strong>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                পাবে: {formatCurrencyBn(totalMillPayable)} · দিছে: {formatCurrencyBn(totalMillPaid)} ·{' '}
                {millOverallBalance.isDina ? (
                  <strong className="text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded font-mono">
                    দিনা: {formatCurrencyBn(millOverallBalance.dinaAmount)}
                  </strong>
                ) : (
                  <strong className="text-rose-400 font-mono">বাকি: {formatCurrencyBn(totalMillDue)}</strong>
                )}
              </div>
            </div>

            <div
              onClick={() => setSectionView('CHULLI_LOAD')}
              className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl p-3.5 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-sky-400">
                ২. ভ্যান লোড — সেলিম সর্দার
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalLoadedBricks)} <span className="text-xs font-normal text-slate-400">পিস ({formatBn(totalLoadedThousands)} হাজার)</span>
              </div>
              <div className="text-[11px] text-slate-300">
                হাজার প্রতি রেট (১০০০ পিস হিসাব)
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalLoadBill)} · জমা: {formatCurrencyBn(totalLoadPaid)} ·{' '}
                {vanOverallBalance.isDina ? (
                  <strong className="text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded font-mono">
                    দিনা: {formatCurrencyBn(vanOverallBalance.dinaAmount)}
                  </strong>
                ) : (
                  <strong className="text-rose-400 font-mono">বাকি: {formatCurrencyBn(totalLoadDue)}</strong>
                )}
              </div>
            </div>

            <div
              onClick={() => setSectionView('PORAI_MISTRI')}
              className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 rounded-xl p-3.5 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-rose-400">
                ৩. পোড়াই মিস্ত্রি — আলতাফ সর্দার
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalPoraiBricks)} <span className="text-xs font-normal text-slate-400">পিস পোড়াই</span>
              </div>
              <div className="text-[11px] text-slate-300">
                মোট রাউন্ড: <strong>{formatBn(poraiMistriRecords.length)}টি</strong>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalPoraiBill)} · জমা: {formatCurrencyBn(totalPoraiPaid)} ·{' '}
                {poraiOverallBalance.isDina ? (
                  <strong className="text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded font-mono">
                    দিনা: {formatCurrencyBn(poraiOverallBalance.dinaAmount)}
                  </strong>
                ) : (
                  <strong className="text-rose-400 font-mono">বাকি: {formatCurrencyBn(totalPoraiDue)}</strong>
                )}
              </div>
            </div>

            <div
              onClick={() => setSectionView('CHULLI_UNLOAD')}
              className="bg-slate-900/90 border border-slate-800 hover:border-orange-500/50 rounded-xl p-3.5 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-orange-400">
                ৪. আনলোড সর্দার — নজরুল সর্দার
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalUnloadedBricks)} <span className="text-xs font-normal text-slate-400">পিস বাহির</span>
              </div>
              <div className="text-[11px] text-slate-300">
                ১ লাইন = ৪০০০ ইট (চুল্লি অটো ফাঁকা)
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalUnloadBill)} · জমা: {formatCurrencyBn(totalUnloadPaid)} ·{' '}
                {unloadOverallBalance.isDina ? (
                  <strong className="text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded font-mono">
                    দিনা: {formatCurrencyBn(unloadOverallBalance.dinaAmount)}
                  </strong>
                ) : (
                  <strong className="text-rose-400 font-mono">বাকি: {formatCurrencyBn(totalUnloadDue)}</strong>
                )}
              </div>
            </div>

            <div
              onClick={() => setSectionView('RUBBISH_MISTRI')}
              className="bg-slate-900/90 border border-purple-500/40 hover:border-purple-400/70 rounded-xl p-3.5 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-purple-300">
                ৫. রাবিশ সর্দার — অবেদ রাবিশ সর্দার
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(rubbishRecords.length)} <span className="text-xs font-normal text-slate-400">রাউন্ড হিসাব</span>
              </div>
              <div className="text-[11px] text-slate-300">
                রাউন্ড হিসেবে টাকা ও মাঝে মাঝে খোরাকি
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalRubbishBill)} · জমা: {formatCurrencyBn(totalRubbishPaid)} ·{' '}
                {rubbishOverallBalance.isDina ? (
                  <strong className="text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded font-mono">
                    দিনা: {formatCurrencyBn(rubbishOverallBalance.dinaAmount)}
                  </strong>
                ) : (
                  <strong className="text-rose-400 font-mono">বাকি: {formatCurrencyBn(totalRubbishDue)}</strong>
                )}
              </div>
            </div>

            <div
              onClick={() => setSectionView('FIRED_STOCK')}
              className="bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-3.5 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-emerald-400">
                ৬. পোড়ানো ইটের বর্তমান স্টক
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {formatBn(totals.brickStockPieces)} <span className="text-xs font-normal text-slate-300">পিস</span>
              </div>
              <div className="text-[11px] text-slate-300">
                আজ বিক্রি: <strong>{formatBn(totals.todayBrickQty)} পিস</strong>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                সিজন বিক্রি: <strong className="text-amber-300">{formatCurrencyBn(totals.seasonTotalAmount)}</strong>
              </div>
            </div>
          </div>

          {/* Section Filter Bar (Main Dashboard Standard) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(
              [
                { id: 'ALL', label: '⚡ সকল হিসাব একসাথে (All)' },
                { id: 'MILLS', label: '১. 🚜 মিল সর্দার (ওহাব · মফিজুল · শফিকুল)' },
                { id: 'CHULLI_LOAD', label: '২. 🛒 ভ্যান লোড (সেলিম সর্দার)' },
                { id: 'PORAI_MISTRI', label: '৩. 🔥 পোড়াই মিস্ত্রি (আলতাফ সর্দার)' },
                { id: 'CHULLI_UNLOAD', label: '৪. 🧱 আনলোড সর্দার (নজরুল সর্দার)' },
                { id: 'RUBBISH_MISTRI', label: '৫. 🧹 রাবিশ সর্দার (অবেদ রাবিশ সর্দার)' },
                { id: 'FIRED_STOCK', label: '৬. 📦 পোড়ানো ইটের স্টক ও বিক্রয়' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSectionView(tab.id)}
                className={`sbl-btn-interactive px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  sectionView === tab.id
                    ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20 ring-2 ring-amber-400/50'
                    : 'bg-slate-900/90 text-slate-200 hover:bg-slate-800 hover:text-white border border-slate-700/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: 3 MILLS (ওহাব মিল, মফিজুল মিল, শফিকুল মিল) & POT LEDGER
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'MILLS') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Factory className="w-5 h-5 text-orange-600" />
                ১. মিল হিসাব — ৩ মিলের বানানো ইট, পট নং, রেট ও টাকা জমা দেওয়ার খতিয়ান
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                কার মিলে কয় নং পটে কত ইট আছে, ওই মিলের রেট কত, তারা মোট কত টাকা পাবে, কত টাকা দিছে এবং আর কত টাকা পাবে — সব হিসাব ও টাকা জমা দেওয়ার রেকর্ড।
              </p>
            </div>

            {/* Mill Filter Buttons (Click any mill to make it Clear and Blur the other 2) */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-sm">
              {MILL_OPTIONS.map((m, idx) => {
                const isSelected = selectedMillFilter === m.id;
                const isBlurredBtn =
                  selectedMillFilter !== 'ALL' && selectedMillFilter !== m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMillFilter(m.id);
                      setPotMillId(m.id);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md scale-105 ring-2 ring-orange-400/50 blur-none opacity-100'
                        : isBlurredBtn
                        ? 'bg-slate-800/70 text-slate-300 opacity-65 blur-[0.6px] hover:blur-none hover:opacity-100 hover:bg-slate-800'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black/25 text-[10px] flex items-center justify-center font-mono">
                      {formatBn(idx + 1)}
                    </span>
                    <span>{m.nameBn.split(' (')[0]}</span>
                    {isSelected && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/20 text-white">
                        ক্লিয়ার
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedMillFilter('ALL')}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  selectedMillFilter === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                সব মিল একসাথে ({formatBn(millPots.length)} পট)
              </button>
            </div>
          </div>

          {/* PROMINENT GRAND TOTAL SUMMARY BANNER AT THE VERY TOP OF MILL HISAB */}
          <div
            id="mill-hisab-top-grand-total"
            className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#1E293B] text-white rounded-2xl p-4 sm:p-5 border-2 border-orange-500/40 shadow-md space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold">
                  সর্বমোট ({formatBn(millPots.length)}টি পট):
                </span>
                <span className="text-xs sm:text-sm text-slate-300 font-medium">
                  ৩টি মিলের (ওহাব · মফিজুল · শফিকুল) সম্মিলিত সর্বমোট হিসাব
                  {selectedMillFilter !== 'ALL' && (
                    <strong className="ml-2 text-amber-300">
                      • নির্বাচিত ক্লিয়ার ভিউ:{' '}
                      {MILL_OPTIONS.find((m) => m.id === selectedMillFilter)?.nameBn.split(' (')[0]}
                    </strong>
                  )}
                </span>
              </div>
              <span className="text-xs font-mono text-amber-300 font-semibold">
                গড় রেট: ৳১,২০০ / হাজার
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">
                  সর্বমোট ({formatBn(millPots.length)}টি পট) বানানো ইট
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-white tabular-nums mt-0.5 block">
                  {formatBn(totalRawCutAllMills)} পিস
                </strong>
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">মিলের রেট (/হাজার)</span>
                <strong className="text-base sm:text-lg font-bold font-mono text-slate-300 tabular-nums mt-0.5 block">
                  — (৳১,২০০)
                </strong>
              </div>
              <div className="bg-slate-800/90 border border-amber-500/30 rounded-xl p-3">
                <span className="text-[11px] text-amber-300 font-semibold block">
                  সর্বমোট টাকা পাবে (বিল)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-amber-300 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalMillPayable)}
                </strong>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3">
                <span className="text-[11px] text-emerald-300 font-semibold block">
                  দেওয়া খোরাকি ও জমা (কমানো হয়েছে)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalMillPaid)}
                </strong>
              </div>
              <div className={`${millOverallBalance.isDina ? 'bg-amber-950/60 border-amber-500/40' : 'bg-rose-950/60 border-rose-500/40'} border rounded-xl p-3 col-span-2 sm:col-span-1`}>
                <span className={`text-[11px] font-semibold block ${millOverallBalance.isDina ? 'text-amber-300' : 'text-rose-300'}`}>
                  {millOverallBalance.isDina ? 'দিনায় আছে (অতিরিক্ত দেওয়া)' : 'শুক্রবারের নিট পাওনা (বাকি বিল)'}
                </span>
                <strong className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 block ${millOverallBalance.isDina ? 'text-amber-300' : 'text-rose-400'}`}>
                  {millOverallBalance.isDina ? formatCurrencyBn(millOverallBalance.dinaAmount) : formatCurrencyBn(totalMillDue)}
                </strong>
              </div>
            </div>
          </div>

          {/* 3 Mill Summary Cards: 1 Selected Mill stays Crystal Clear, the Other 2 Blur Out */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-orange-600" />
                ৩টি মিলের কার্ড (যে মিলটি সিলেক্ট করবেন সেটি ক্লিয়ার থাকবে, বাকি ২টি ব্লার হয়ে যাবে — যেকোনো কার্ডে ক্লিক করে পরিবর্তন করুন)
              </span>
              {selectedMillFilter !== 'ALL' && (
                <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-lg">
                  সক্রিয় মিল: {MILL_OPTIONS.find((m) => m.id === selectedMillFilter)?.nameBn}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1">
              {MILL_OPTIONS.map((mill, idx) => {
                const pots = millPots.filter((p) => p.millId === mill.id);
                const rawCut = pots.reduce((s, p) => s + p.rawBricksCut, 0);
                const payable = pots.reduce((s, p) => s + p.totalPayable, 0);
                const paid = pots.reduce((s, p) => s + p.paidAmount, 0);
                const due = pots.reduce((s, p) => s + p.dueAmount, 0);
                const millCardBalance = computeWorkerBalanceWithDina(payable, paid);
                const avgRate = pots[0]?.ratePerThousand || 1200;
                const targetPotForDeposit =
                  pots.find((p) => p.dueAmount > 0) || pots[0];

                const isFocusedMill =
                  selectedMillFilter === 'ALL' || selectedMillFilter === mill.id;
                const isBlurredMill =
                  selectedMillFilter !== 'ALL' && selectedMillFilter !== mill.id;

                return (
                  <div
                    key={mill.id}
                    data-mill-id={mill.id}
                    data-mill-state={isFocusedMill ? 'clear' : 'blurred'}
                    onClick={() => {
                      setSelectedMillFilter(mill.id);
                      setPotMillId(mill.id);
                    }}
                    className={`relative rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                      isFocusedMill
                        ? 'border-orange-500 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/40 shadow-xl ring-4 ring-orange-500/20 scale-[1.02] z-10'
                        : 'border-slate-200/90 bg-slate-100/70 hover:border-orange-300 scale-[0.97]'
                    }`}
                  >
                    {/* Inner content wrapper — always interactive on a single click */}
                    <div
                      className={`p-4 space-y-3 transition-colors duration-200 ${
                        isBlurredMill
                          ? 'opacity-85 hover:opacity-100'
                          : 'opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isFocusedMill
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              মিল #{formatBn(idx + 1)}
                            </span>
                            {isFocusedMill && selectedMillFilter !== 'ALL' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                নির্বাচিত (ক্লিয়ার)
                              </span>
                            )}
                          </div>
                          <span className="text-sm sm:text-base font-extrabold text-slate-900 block mt-1">
                            {mill.nameBn}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            মিলের রেট: <strong>৳{formatBn(avgRate)} / হাজার</strong> · মোট পট: {formatBn(pots.length)}টি
                          </span>
                        </div>
                        {targetPotForDeposit && (
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMillFilter((prev) => (prev === 'ALL' ? 'ALL' : mill.id));
                                setPotMillId(mill.id);
                                openDepositModal(
                                  {
                                    type: 'MILL_POT',
                                    record: targetPotForDeposit,
                                  },
                                  'KHORAKI'
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs cursor-pointer"
                            >
                              + খোরাকি দিন
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMillFilter((prev) => (prev === 'ALL' ? 'ALL' : mill.id));
                                setPotMillId(mill.id);
                                openDepositModal(
                                  {
                                    type: 'MILL_POT',
                                    record: targetPotForDeposit,
                                  },
                                  'FRIDAY_FINAL'
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs cursor-pointer"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              শুক্রবারের বিল পেমেন্ট
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">ইট বানালো</span>
                          <strong className="text-slate-900 font-mono">
                            {formatBn(rawCut)} পিস
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">মোট টাকা পাবে</span>
                          <strong className="text-slate-900 font-mono">
                            {formatCurrencyBn(payable)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-700 font-semibold block">
                            জমা দিছে
                          </span>
                          <strong className="text-emerald-700 font-mono">
                            {formatCurrencyBn(paid)}
                          </strong>
                        </div>
                        <div>
                          <span className={`text-[10px] font-semibold block ${millCardBalance.isDina ? 'text-amber-700' : 'text-rose-700'}`}>
                            {millCardBalance.isDina ? 'দিনায় আছে' : 'আর পাবে কত'}
                          </span>
                          <strong className={`font-mono ${millCardBalance.isDina ? 'text-amber-700' : 'text-rose-700'}`}>
                            {millCardBalance.isDina ? formatCurrencyBn(millCardBalance.dinaAmount) : formatCurrencyBn(due)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add / Update Mill Pot Form + Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <form
              noValidate
              onSubmit={handlePotSubmit}
              className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-orange-600" />
                  {editingPotId
                    ? 'মিলের পট ও টাকা আপডেট করুন'
                    : 'মিলে নতুন পট ও ইটের হিসাব এন্ট্রি'}
                </h4>
                {editingPotId && (
                  <button
                    type="button"
                    onClick={() => setEditingPotId(undefined)}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কার মিল (Mill) *
                  </label>
                  <select
                    value={potMillId}
                    onChange={(e) => {
                      const nextMill = e.target.value as MillId;
                      setPotMillId(nextMill);
                      setSelectedMillFilter((prev) => (prev === 'ALL' ? 'ALL' : nextMill));
                    }}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  >
                    {MILL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কয় নং পট (Pot No) *
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: পট-০১"
                    value={potNo}
                    onChange={(e) => setPotNo(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পটে কত ইট আছে (পিস) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={potRawBricks}
                    onChange={(e) => setPotRawBricks(normalizeNumericInput(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ওই মিলের রেট (/হাজার ৳) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={potRatePerThousand}
                    onChange={(e) => setPotRatePerThousand(normalizeNumericInput(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    টাকা জমা দেওয়া হলো (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={potPaidAmount}
                    onChange={(e) => setPotPaidAmount(normalizeNumericInput(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-emerald-50 border border-emerald-400 rounded-lg text-emerald-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={potDate}
                    onChange={(e) => setPotDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="মন্তব্য লিখুন..."
                  value={potNote}
                  onChange={(e) => setPotNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Live Pot Calculation Preview (পূর্বের দিনা থাকলে স্বয়ংক্রিয় কর্তন) */}
              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">নতুন কাজের বিল:</span>
                  <strong className="text-amber-300 font-mono">{formatCurrencyBn(livePotPayable)}</strong>
                </div>
                {selectedMillPriorDina > 0 && (
                  <div className="flex justify-between text-amber-300 font-bold bg-amber-950/60 px-2 py-1 rounded">
                    <span>পূর্বের দিনা কর্তন:</span>
                    <span className="font-mono">−{formatCurrencyBn(livePotAdjustment.dinaDeductedFromNewWork)}</span>
                  </div>
                )}
                {selectedMillPriorDina > 0 && (
                  <div className="flex justify-between text-sky-200 font-semibold">
                    <span>দিনা বাদে নিট প্রাপ্য:</span>
                    <strong className="text-sky-300 font-mono">{formatCurrencyBn(livePotAdjustment.netPayableAfterDina)}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দেওয়া হচ্ছে:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrencyBn(livePotPaid)}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  {livePotAdjustment.finalNewDina > 0 ? (
                    <>
                      <span className="text-amber-300 font-bold">মিল দিনায় থাকবে (অতিরিক্ত জমা):</span>
                      <strong className="text-amber-400 font-mono">{formatCurrencyBn(livePotAdjustment.finalNewDina)}</strong>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-400">মিল আর পাবে কত (বাকি):</span>
                      <strong className="text-rose-400 font-mono">{formatCurrencyBn(livePotAdjustment.finalDueAmount)}</strong>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPot}
                className="w-full py-2.5 px-4 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {savingPot
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingPotId
                  ? 'পট ও টাকার হিসাব আপডেট করুন'
                  : '+ মিলের পট ও টাকার হিসাব সেভ করুন'}
              </button>
            </form>

            {/* Pot Ledger Table */}
            <div className="lg:col-span-8 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">মিলের নাম ও পট নং</th>
                    <th className="py-3 px-3 font-bold text-right">বানানো ইট (পিস)</th>
                    <th className="py-3 px-3 font-bold text-right">মিলের রেট (/হাজার)</th>
                    <th className="py-3 px-3 font-bold text-right">মোট টাকা পাবে</th>
                    <th className="py-3 px-3 font-bold text-right">জমা দিছে কত</th>
                    <th className="py-3 px-3 font-bold text-right">আর পাবে কত / দিনা</th>
                    <th className="py-3 px-3 font-bold text-right">টাকা জমা ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredMillPots.map((pot) => (
                    <tr key={pot.id} className="hover:bg-orange-50/30">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {pot.millNameBn} — <span className="text-orange-700">{pot.potNo}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {pot.date} {pot.note ? `· ${pot.note}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono tabular-nums">
                        {formatBn(pot.rawBricksCut)} পিস
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold">
                        ৳{formatBn(pot.ratePerThousand)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(pot.totalPayable)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrencyBn(pot.paidAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        {pot.paidAmount > pot.totalPayable ? (
                          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                            দিনা {formatCurrencyBn(pot.paidAmount - pot.totalPayable)}
                          </span>
                        ) : (
                          <span className="text-rose-700">{formatCurrencyBn(pot.dueAmount)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {pot.dueAmount === 0 && pot.totalPayable > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                              ✓ পরিশোধিত (Paid)
                            </span>
                          )}
                          <button
                            type="button"
                            data-testid={`mill-khoraki-btn-${pot.id}`}
                            onClick={() =>
                              openDepositModal({ type: 'MILL_POT', record: pot }, 'KHORAKI')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            + খোরাকি দিন
                          </button>
                          <button
                            type="button"
                            data-testid={`mill-friday-pay-btn-${pot.id}`}
                            onClick={() =>
                              openDepositModal({ type: 'MILL_POT', record: pot }, 'FRIDAY_FINAL')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            শুক্রবারের বিল পেমেন্ট
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditPot(pot)}
                            title="পট এডিট করুন"
                            className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMillPot(pot.id)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">সর্বমোট ({formatBn(filteredMillPots.length)}টি পট):</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(filteredMillRawCut)} পিস
                    </td>
                    <td className="py-3 px-3 text-right">—</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatCurrencyBn(filteredMillPayable)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 tabular-nums">
                      {formatCurrencyBn(filteredMillPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 tabular-nums">
                      {formatCurrencyBn(filteredMillDue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mill Payment Record History Ledger */}
          {renderPaymentRecordsTable(
            'মিলের টাকা জমা দেওয়ার রেকর্ড খতিয়ান (সকল জমা টাকার তালিকা)',
            'ওহাব মিল, মফিজুল মিল ও শফিকুল মিলে কবে কত টাকা জমা দেওয়া হয়েছে তার সম্পূর্ণ রেকর্ড',
            millPayments,
            'amber'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 2: CHULLI VAN LOADING — আসাদ ভ্যান / সেলিম সর্দার (১০০০ পিস প্রতি রেট)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'CHULLI_LOAD') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
                  <Truck className="w-3.5 h-3.5 text-sky-700" />
                  ১০০০ পিস (হাজার প্রতি) ভ্যান রেট সিস্টেম
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ক্যাশ বুক ও স্টক অটো-সিঙ্ক
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-600" />
                ২. ভ্যান হিসাব — সেলিম সর্দার (চুল্লিতে কাঁচা ও পাকা ইট লোড · ১০০০ পিস রেট)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                সেলিম সর্দারের ভ্যানে কতগুলো কাঁচা ইট ও চুল্লির পাকা ইট লোড দিল, প্রতি ১০০০ পিসের (হাজার প্রতি) রেট অনুযায়ী মোট কত টাকা বিল হলো, কত টাকা জমা দিলাম এবং আর কত টাকা পাবে তার সম্পূর্ণ হিসাব ও জমা রেকর্ড।
              </p>
            </div>

            {chulliLoads.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      chulliLoads.find((l) => l.dueAmount > 0) || chulliLoads[0];
                    if (target) {
                      openDepositModal({ type: 'VAN_LOAD', record: target }, 'KHORAKI');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  + সেলিম সর্দারকে খোরাকি দিন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      chulliLoads.find((l) => l.dueAmount > 0) || chulliLoads[0];
                    if (target) {
                      openDepositModal({ type: 'VAN_LOAD', record: target }, 'FRIDAY_FINAL');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  <Banknote className="w-4 h-4" />
                  শুক্রবারের চূড়ান্ত বিল পরিশোধ
                </button>
              </div>
            )}
          </div>

          {/* Executive Dark Summary Banner for Van Hisab (matching Mill Hisab & Porai Mistri) */}
          <div className="bg-[#0F172A] text-white border-2 border-sky-500/40 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300 block">
                    ভ্যান হিসাবের সর্বমোট সারাংশ (১০০০ পিস রেট অনুযায়ী)
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    সেলিম সর্দার (ভ্যান লোড সর্দার) — মোট লোডকৃত ইট, হাজার প্রতি বিল, জমা ও বকেয়া হিসাব
                  </h4>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-sky-300 self-start sm:self-auto">
                মোট এন্ট্রি: {formatBn(chulliLoads.length)}টি ক্ষেপ
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block">ভ্যান লোডের সর্দার ও দর</span>
                <strong className="text-sm sm:text-base font-bold text-white block mt-0.5 truncate">
                  সেলিম সর্দার
                </strong>
                <span className="text-[11px] text-sky-300 font-semibold block mt-0.5">
                  ১০০০ পিস রেট: ৳{formatBn(liveVanRate)} / হাজার
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block">চুল্লিতে মোট ইট লোড</span>
                <strong className="text-base sm:text-lg font-bold font-mono text-sky-300 tabular-nums block mt-0.5">
                  {formatBn(totalLoadedBricks)} পিস
                </strong>
                <span className="text-[11px] text-slate-400 block">
                  মোট: {formatBn(totalLoadedThousands)} হাজার ({formatBn(totalLoadedVans)} ভ্যান)
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block">মোট কত টাকা হলো (বিল)</span>
                <strong className="text-base sm:text-lg font-bold font-mono text-white tabular-nums block mt-0.5">
                  {formatCurrencyBn(totalLoadBill)}
                </strong>
                <span className="text-[11px] text-slate-400 block">১০০০ পিস রেট হিসেবে</span>
              </div>
              <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-xl p-3.5">
                <span className="text-xs text-emerald-300 font-semibold block">
                  জমা দিলাম কত টাকা
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums block mt-0.5">
                  {formatCurrencyBn(totalLoadPaid)}
                </strong>
                <span className="text-[11px] text-emerald-300/80 block">নগদ পরিশোধিত</span>
              </div>
              <div className="bg-rose-950/50 border border-rose-700/50 rounded-xl p-3.5">
                <span className="text-xs text-rose-300 font-semibold block">
                  সর্দার আর পাবে (বাকি)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-rose-400 tabular-nums block mt-0.5">
                  {formatCurrencyBn(totalLoadDue)}
                </strong>
                <span className="text-[11px] text-rose-300/80 block">বর্তমান বকেয়া পাওনা</span>
              </div>
            </div>

            {/* Automatic 208-Line Chimney Load Sync Strip (4,000 bricks = 1 full line) */}
            <div
              data-testid="van-hisab-auto-chimney-sync-banner"
              className="bg-sky-950/70 border border-sky-400/40 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-300">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>অটো চুল্লি ২০৮-লাইন লোড সিস্টেম (৪,০০০ ইট = ১টি পূর্ণ লাইন)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  সেলিম সর্দার ভ্যান হিসাবে যত পিস ইট লোড এন্ট্রি করবেন, তা স্বয়ংক্রিয়ভাবে চুল্লির লাইনে যোগ হবে। প্রতি <strong>৪,০০০ ইট পূর্ণ হলেই চুল্লিতে ১টি লাইন অটো পূর্ণ হয়ে যাবে</strong> এবং ৪,০০০ এর কম হলেও আংশিক লোড হিসেবে চুল্লির পরবর্তী লাইনে দেখা যাবে।
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="bg-slate-900/90 border border-sky-500/40 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] text-sky-300 font-bold block">চুল্লিতে অটো পূর্ণ লাইন</span>
                  <strong className="text-sm sm:text-base font-extrabold font-mono text-white tabular-nums">
                    {formatBn(autoChimneyFullLinesFromVan)}টি লাইন
                  </strong>
                  <span className="text-[10px] text-slate-400 block">@ ৪,০০০ ইট/লাইন</span>
                </div>
                <div className="bg-slate-900/90 border border-amber-500/40 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] text-amber-300 font-bold block">পরবর্তী লাইনে জমা</span>
                  <strong className="text-sm sm:text-base font-extrabold font-mono text-amber-300 tabular-nums">
                    {formatBn(autoChimneyPartialBricks)} পিস
                  </strong>
                  <span className="text-[10px] text-slate-400 block">/ ৪,০০০ পিস</span>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/40 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] text-emerald-300 font-bold block">নতুন লাইন পূর্ণ হতে বাকি</span>
                  <strong className="text-sm sm:text-base font-extrabold font-mono text-emerald-400 tabular-nums">
                    {formatBn(autoChimneyBricksNeededForNextLine)} পিস
                  </strong>
                  <span className="text-[10px] text-slate-400 block">অটো লাইন ফিল</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Chulli Van Load Form (Per 1,000 pcs rate — ১০০০ পিস রেট) */}
            <form
              noValidate
              onSubmit={handleVanLoadSubmit}
              className="lg:col-span-4 bg-sky-50/60 border-2 border-sky-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between border-b border-sky-200 pb-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-sky-600" />
                  {editingLoadId
                    ? 'ভ্যান লোড ও ১০০০ পিস রেট আপডেট করুন'
                    : 'ভ্যানে চুল্লি লোড এন্ট্রি (সেলিম সর্দার)'}
                </h4>
                {editingLoadId && (
                  <button
                    type="button"
                    onClick={() => setEditingLoadId(undefined)}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ভ্যান লোডের সর্দারের নাম *
                </label>
                <input
                  type="text"
                  value={loadSardarName}
                  onChange={(e) => setLoadSardarName(e.target.value)}
                  placeholder="সেলিম সর্দার"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1 whitespace-nowrap">
                    কাঁচা ইট (মাঠ থেকে পিস) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={loadBrickQty}
                    onChange={(e) => setLoadBrickQty(normalizeNumericInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-amber-50/50 border border-amber-300 rounded-xl tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cyan-900 mb-1 whitespace-nowrap flex items-center justify-between">
                    <span>চুল্লিতে পাকা ইট (পিস)</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-cyan-100 text-cyan-800 rounded font-bold">সহযোগী</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={loadPakaBrickQty}
                    onChange={(e) => setLoadPakaBrickQty(normalizeNumericInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-cyan-50/50 border border-cyan-300 rounded-xl tabular-nums focus:border-cyan-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-sky-900 mb-1 whitespace-nowrap">
                    ১০০০ পিস রেট (হাজার ৳) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={loadRatePerVan}
                    onChange={(e) => setLoadRatePerVan(normalizeNumericInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-white border-2 border-sky-400 rounded-xl text-sky-950 tabular-nums focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick 1,000-Piece Rate Presets */}
              <div className="bg-white/90 border border-sky-200 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-sky-900">
                  <span>১০০০ পিসের দ্রুত রেট নির্বাচন (হাজার প্রতি):</span>
                  <span className="font-mono text-sky-700">৳{formatBn(liveVanRate)} / ১০০০ পিস</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[100, 110, 115, 120, 130, 140, 150].map((rPreset) => (
                    <button
                      key={rPreset}
                      type="button"
                      onClick={() => setLoadRatePerVan(String(rPreset))}
                      className={`px-2.5 py-1 text-[11px] font-bold font-mono rounded-lg border cursor-pointer transition-colors ${
                        Number(liveVanRate) === rPreset
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-sky-50/70 text-slate-800 border-slate-300 hover:bg-sky-100'
                      }`}
                    >
                      ৳{formatBn(rPreset)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Brick Quantity Buttons (including 4,000-brick line multiples) */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                  দ্রুত ইটের পরিমাণ (৪,০০০ পিস = চুল্লিতে ১ লাইন):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[4000, 8000, 12000, 16000, 20000, 40000].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setLoadBrickQty(String(q));
                        setLoadPakaBrickQty('');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors ${
                        parseNum(loadBrickQty, 0) === q && parseNum(loadPakaBrickQty, 0) === 0
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {formatBn(q)} পিস ({formatBn(q / 4000)} লাইন)
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setLoadBrickQty('3500');
                      setLoadPakaBrickQty('500');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors ${
                      parseNum(loadBrickQty, 0) === 3500 && parseNum(loadPakaBrickQty, 0) === 500
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    ৩,৫০০ কাঁচা + ৫০০ পাকা (১ লাইন)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    জমা দিলাম কত টাকা (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={loadPaidAmount}
                    onChange={(e) => setLoadPaidAmount(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-emerald-50 border border-emerald-400 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={loadDate}
                    onChange={(e) => setLoadDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সকালের ক্ষেপ চুল্লিতে লোড..."
                  value={loadNote}
                  onChange={(e) => setLoadNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                />
              </div>

              {/* Live Van Calculation (Per 1,000 Bricks Rate + Dual Raw & Chamber Paka Bricks) */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl text-xs space-y-1.5 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">মোট লোডকৃত ইট (হাজার হিসাব):</span>
                  <strong className="text-sky-400 font-mono">
                    {formatBn(liveLoadThousandUnits)} হাজার ({formatBn(liveLoadTotalBricks)} পিস)
                  </strong>
                </div>
                <div className="flex justify-between text-[11px] text-slate-300 border-b border-slate-800 pb-1">
                  <span>কাঁচা ইট: <strong className="text-amber-300 font-mono">{formatBn(liveLoadRawBricks)}</strong></span>
                  <span>চুল্লিতে পাকা ইট: <strong className="text-cyan-300 font-mono">{formatBn(liveLoadPakaBricks)}</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">চিমনিতে অটো লাইন যোগ হবে (@ ৪০০০/লাইন):</span>
                  <strong className="text-cyan-300 font-mono">
                    +{formatBn(liveEntryFullLines)}টি লাইন{liveEntryPartialBricks > 0 ? ` + ${formatBn(liveEntryPartialBricks)} ইট` : ''}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">সেলিম সর্দারের বিল (মোট {formatBn(liveLoadTotalBricks)} ইটে @ ৳{formatBn(liveVanRate)}/হাজার):</span>
                  <strong className="text-amber-300 font-mono text-sm">
                    {formatCurrencyBn(liveLoadTotalBill)}
                  </strong>
                </div>
                {vanPriorDina > 0 && (
                  <div className="flex justify-between text-amber-300 font-bold bg-amber-950/60 px-2 py-1 rounded">
                    <span>সেলিম সর্দারের পূর্বের দিনা কর্তন:</span>
                    <span className="font-mono">−{formatCurrencyBn(liveVanAdjustment.dinaDeductedFromNewWork)}</span>
                  </div>
                )}
                {vanPriorDina > 0 && (
                  <div className="flex justify-between text-sky-200 font-semibold">
                    <span>দিনা বাদে নিট প্রাপ্য:</span>
                    <strong className="text-sky-300 font-mono">{formatCurrencyBn(liveVanAdjustment.netPayableAfterDina)}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দিলাম:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrencyBn(liveLoadPaid)}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  {liveVanAdjustment.finalNewDina > 0 ? (
                    <>
                      <span className="text-amber-300 font-bold">দিনায় থাকবে (অতিরিক্ত জমা):</span>
                      <strong className="text-amber-400 font-mono">{formatCurrencyBn(liveVanAdjustment.finalNewDina)}</strong>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-300 font-semibold">আর পাবে কত (বাকি):</span>
                      <strong className="text-rose-400 font-mono">{formatCurrencyBn(liveVanAdjustment.finalDueAmount)}</strong>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 pt-0.5">
                  💡 মিলের মাঠ থেকে কাঁচা ইট কমবে {formatBn(liveLoadRawBricks)} পিস (সহযোগী পাকা ইট আলাদা সংরক্ষিত থাকবে)।
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLoad}
                className="w-full py-2.5 px-4 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {savingLoad
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingLoadId
                  ? 'ভ্যান হিসাব (১০০০ পিস রেট) আপডেট করুন'
                  : '+ ভ্যান লোড হিসাব (১০০০ পিস রেট) যোগ করুন'}
              </button>
            </form>

            {/* Chulli Van Load Ledger Table (Per 1,000 pcs rate!) */}
            <div className="lg:col-span-8 overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">তারিখ ও সর্দারের নাম</th>
                    <th className="py-3 px-3 font-bold text-right">মোট লোড (ইট)</th>
                    <th className="py-3 px-3 font-bold text-right">কাঁচা / পাকা</th>
                    <th className="py-3 px-3 font-bold text-right">হাজার / ভ্যান</th>
                    <th className="py-3 px-3 font-bold text-right">রেট (/১০০০)</th>
                    <th className="py-3 px-3 font-bold text-right">মোট বিল (৳)</th>
                    <th className="py-3 px-3 font-bold text-right">জমা দিলাম</th>
                    <th className="py-3 px-3 font-bold text-right">আর পাবে / দিনা</th>
                    <th className="py-3 px-3 font-bold text-right">টাকা জমা ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chulliLoads.map((ld) => {
                    const effectiveRatePerThousand =
                      ld.ratePerVan > 0 && ld.ratePerVan <= 30
                        ? Number((ld.ratePerVan * 10).toFixed(2))
                        : ld.ratePerVan || 115;
                    const totalPcs =
                      ld.totalBricksLoaded !== undefined
                        ? ld.totalBricksLoaded
                        : (ld.rawBricksLoaded || 0) + (ld.pakaBricksLoaded || 0);
                    const thousandQty = Number((totalPcs / 1000).toFixed(2));
                    return (
                      <tr key={ld.id} className="hover:bg-sky-50/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{ld.sardarName}</div>
                          <div className="text-[11px] text-slate-500">
                            {ld.date} {ld.note ? `· ${ld.note}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                          {formatBn(totalPcs)} পিস
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                          <span className="text-amber-700 font-bold">{formatBn(ld.rawBricksLoaded)} কাঁচা</span>
                          {(ld.pakaBricksLoaded || 0) > 0 && (
                            <span className="text-cyan-700 block text-[10px]">
                              + {formatBn(ld.pakaBricksLoaded)} পাকা
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-sky-700 font-mono tabular-nums">
                          <div>{formatBn(thousandQty)} হাজার</div>
                          <div className="text-[10px] font-normal text-slate-500">
                            ({formatBn(ld.vanCount)} ভ্যান)
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-sky-900 font-mono tabular-nums">
                          ৳{formatBn(effectiveRatePerThousand)}{' '}
                          <span className="text-[10px] font-normal text-slate-500">/হাজার</span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrencyBn(ld.totalBill)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                          {formatCurrencyBn(ld.paidAmount)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums">
                          {ld.paidAmount > ld.totalBill ? (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                              দিনা {formatCurrencyBn(ld.paidAmount - ld.totalBill)}
                            </span>
                          ) : (
                            <span className="text-rose-700">{formatCurrencyBn(ld.dueAmount)}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {ld.dueAmount === 0 && ld.totalBill > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                                ✓ পরিশোধিত (Paid)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                openDepositModal({ type: 'VAN_LOAD', record: ld }, 'KHORAKI')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              + খোরাকি দিন
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openDepositModal({ type: 'VAN_LOAD', record: ld }, 'FRIDAY_FINAL')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              শুক্রবারের বিল পেমেন্ট
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditVanLoad(ld)}
                              title="এডিট করুন"
                              className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteChulliLoad && (
                              <button
                                type="button"
                                onClick={() => onDeleteChulliLoad(ld.id)}
                                title="মুছে ফেলুন"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">ভ্যান হিসাব সর্বমোট:</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(totalLoadedBricks)} পিস
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-mono tabular-nums">
                      <div className="text-amber-800">{formatBn(totalRawLoadedBricks)} কাঁচা</div>
                      {totalPakaLoadedBricks > 0 && (
                        <div className="text-cyan-800 text-[10px]">{formatBn(totalPakaLoadedBricks)} পাকা</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sky-800 tabular-nums">
                      {formatBn(totalLoadedThousands)} হাজার
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-slate-600">১০০০ রেট</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatCurrencyBn(totalLoadBill)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 tabular-nums">
                      {formatCurrencyBn(totalLoadPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 tabular-nums">
                      {formatCurrencyBn(totalLoadDue)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-slate-600 font-mono">
                      {formatBn(autoChimneyFullLinesFromVan)} লাইন
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Van Payment Record History Ledger */}
          {renderPaymentRecordsTable(
            'ভ্যান হিসাব (সেলিম সর্দার) — টাকা জমা দেওয়ার রেকর্ড খতিয়ান',
            'ভ্যান সর্দার সেলিম সর্দারকে চুল্লি লোড বাবদ কবে কত টাকা জমা দেওয়া হয়েছে তার সম্পূর্ণ তালিকা',
            vanPayments,
            'sky'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 2B: PORAI MISTRI — আলতাফ সর্দার (পোড়াই মিস্ত্রিদের সর্দার)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'PORAI_MISTRI') && (
        <div
          data-testid="porai-mistri-contract-section"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 mb-1">
                পোড়াই মিস্ত্রিদের সর্দার: আলতাফ সর্দার · কয়জন মিস্ত্রি কাজ করছে · নির্ধারিত টোটাল বিল · প্রতি সপ্তাহে টাকা প্রদান
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600" />
                ৩. পোড়াই মিস্ত্রি (আলতাফ সর্দার) — কর্মরত মিস্ত্রি সংখ্যা, টোটাল চুক্তি বিল ও সাপ্তাহিক পেমেন্ট খতিয়ান
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                পোড়াই মিস্ত্রিদের সর্দার <strong>আলতাফ সর্দারের</strong> দলে কয়জন মিস্ত্রি কাজ করছে এবং তাদের <strong>নির্ধারিত টোটাল বিল কত</strong> তা এখানে সেট করে দিন। প্রতি সপ্তাহে তারা যত টাকা নিবে তত টাকা এন্ট্রি করলে <strong>তারা আর কত টাকা পাচ্ছে (বাকি পাওনা বা দিনা)</strong> তা সরাসরি নজরে চলে আসবে।
              </p>
            </div>

            {poraiMistriRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      poraiMistriRecords.find((r) => r.dueAmount > 0) ||
                      poraiMistriRecords[0];
                    if (target) {
                      openDepositModal({ type: 'PORAI_MISTRI', record: target }, 'KHORAKI');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  + আলতাফ সর্দারকে খোরাকি দিন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      poraiMistriRecords.find((r) => r.dueAmount > 0) ||
                      poraiMistriRecords[0];
                    if (target) {
                      openDepositModal({ type: 'PORAI_MISTRI', record: target }, 'FRIDAY_FINAL');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  <Banknote className="w-4 h-4" />
                  সাপ্তাহিক / চূড়ান্ত বিল পরিশোধ
                </button>
              </div>
            )}
          </div>

          {/* Porai Mistri Master Summary Strip (কয়জন মিস্ত্রি + টোটাল বিল + সাপ্তাহিক জমা + আর পাবে কত) */}
          <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#1E293B] text-white rounded-2xl p-4 sm:p-5 border-2 border-rose-500/40 shadow-md">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5">
                <span className="text-[11px] text-slate-400 block">পোড়াই সর্দার ও কর্মরত মিস্ত্রি</span>
                <strong className="text-base sm:text-xl font-extrabold font-mono text-white mt-0.5 block">
                  আলতাফ সর্দার ({formatBn(totalPoraiMistriHeadcount || Number(poraiMistriCount) || 0)} জন)
                </strong>
                <span className="text-[11px] text-rose-300">
                  মোট চুক্তি/এন্ট্রি: {formatBn(poraiMistriRecords.length)}টি
                </span>
              </div>
              <div className="bg-slate-800/90 border border-amber-500/40 rounded-xl p-3.5">
                <span className="text-[11px] text-amber-300 font-semibold block">
                  তাদের নির্ধারিত টোটাল বিল কত
                </span>
                <strong className="text-base sm:text-xl font-extrabold font-mono text-amber-300 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalPoraiBill)}
                </strong>
                <span className="text-[11px] text-slate-400">মাসভিত্তিক / সিজন চুক্তির মোট বিল</span>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3.5">
                <span className="text-[11px] text-emerald-300 font-semibold block">
                  প্রতি সপ্তাহে মোট দেওয়া হয়েছে
                </span>
                <strong className="text-base sm:text-xl font-extrabold font-mono text-emerald-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalPoraiPaid)}
                </strong>
                <span className="text-[11px] text-emerald-300/80">সাপ্তাহিক কিস্তি ও নগদ প্রদান</span>
              </div>
              <div className={`${poraiOverallBalance.isDina ? 'bg-amber-950/60 border-amber-500/40' : 'bg-rose-950/60 border-rose-500/40'} border rounded-xl p-3.5`}>
                <span className={`text-[11px] font-semibold block ${poraiOverallBalance.isDina ? 'text-amber-300' : 'text-rose-300'}`}>
                  {poraiOverallBalance.isDina ? 'দিনায় আছে (অতিরিক্ত পরিশোধ)' : 'তাহলে সে আর পাচ্ছে কত (বাকি পাওনা)'}
                </span>
                <strong className={`text-base sm:text-xl font-extrabold font-mono tabular-nums mt-0.5 block ${poraiOverallBalance.isDina ? 'text-amber-300' : 'text-rose-400'}`}>
                  {poraiOverallBalance.isDina ? formatCurrencyBn(poraiOverallBalance.dinaAmount) : formatCurrencyBn(totalPoraiDue)}
                </strong>
                <span className={`text-[11px] ${poraiOverallBalance.isDina ? 'text-amber-300/80' : 'text-rose-300/80'}`}>
                  {poraiOverallBalance.isDina ? 'পরবর্তী রাউন্ডের বিল থেকে কর্তন হবে' : 'টোটাল বিল − মোট দেওয়া টাকা'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Porai Mistri Contract & Weekly Payment Entry Form */}
            <form
              noValidate
              onSubmit={handlePoraiMistriSubmit}
              className="lg:col-span-5 bg-rose-50/40 border-2 border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-rose-200 pb-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-rose-600" />
                  {editingPoraiId
                    ? 'পোড়াই মিস্ত্রির সংখ্যা, টোটাল বিল ও সাপ্তাহিক টাকা আপডেট'
                    : 'পোড়াই মিস্ত্রি সেটআপ (আলতাফ সর্দার): কয়জন মিস্ত্রি, টোটাল বিল ও সাপ্তাহিক টাকা'}
                </h4>
                {editingPoraiId && (
                  <button
                    type="button"
                    onClick={() => setEditingPoraiId(undefined)}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পোড়াই মিস্ত্রির সর্দারের নাম *
                  </label>
                  <input
                    type="text"
                    placeholder="আলতাফ সর্দার (পোড়াই মিস্ত্রি দল)"
                    value={poraiMistriName}
                    onChange={(e) => setPoraiMistriName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    চুক্তির বিবরণ / মাস / সপ্তাহ *
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: সিজন চুক্তি (৫ মাস)"
                    value={poraiChamber}
                    onChange={(e) => setPoraiChamber(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Mistri Count & Total Contract Bill Setup Box */}
              <div className="bg-white border-2 border-rose-300 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-100 pb-1.5">
                  <span className="text-xs font-extrabold text-rose-900">
                    ১. কয়টা মিস্ত্রি কাজ করতেছে ও তাদের টোটাল বিল সেট করুন:
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    মাসভিত্তিক / সিজন চুক্তি
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-rose-950 mb-1">
                      কয়জন মিস্ত্রি *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={poraiMistriCount}
                      onChange={(e) => {
                        const nextCnt = normalizeNumericInput(e.target.value);
                        setPoraiMistriCount(nextCnt);
                        const m = parseNum(poraiMonthsCount, 0);
                        const r = parseNum(poraiMonthlyRatePerMistri, 0);
                        const cNum = parseNum(nextCnt, 0);
                        if (m > 0 && r > 0 && cNum > 0) {
                          setPoraiContractTotalBill(
                            String(Math.round(cNum * m * r))
                          );
                        }
                      }}
                      className="w-full px-2.5 py-2 text-sm font-extrabold font-mono bg-rose-50/70 border-2 border-rose-400 rounded-lg tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      কত মাস কাজ (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={poraiMonthsCount}
                      onChange={(e) => {
                        const nextM = normalizeNumericInput(e.target.value);
                        setPoraiMonthsCount(nextM);
                        const c = parseNum(poraiMistriCount, 0);
                        const r = parseNum(poraiMonthlyRatePerMistri, 0);
                        const mNum = parseNum(nextM, 0);
                        if (c > 0 && r > 0 && mNum > 0) {
                          setPoraiContractTotalBill(
                            String(Math.round(c * mNum * r))
                          );
                        }
                      }}
                      className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      জনপ্রতি মাসিক দর (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={poraiMonthlyRatePerMistri}
                      onChange={(e) => {
                        const nextR = normalizeNumericInput(e.target.value);
                        setPoraiMonthlyRatePerMistri(nextR);
                        const c = parseNum(poraiMistriCount, 0);
                        const m = parseNum(poraiMonthsCount, 0);
                        const rNum = parseNum(nextR, 0);
                        if (c > 0 && m > 0 && rNum > 0) {
                          setPoraiContractTotalBill(
                            String(Math.round(c * m * rNum))
                          );
                        }
                      }}
                      className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                {/* Quick Mistri Count Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">দ্রুত মিস্ত্রি সংখ্যা:</span>
                  {[4, 6, 8, 10, 12, 14].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setPoraiMistriCount(String(cnt));
                        const m = parseNum(poraiMonthsCount, 0);
                        const r = parseNum(poraiMonthlyRatePerMistri, 0);
                        if (m > 0 && r > 0) {
                          setPoraiContractTotalBill(String(Math.round(cnt * m * r)));
                        }
                      }}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md border cursor-pointer ${
                        parseNum(poraiMistriCount, 0) === cnt
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-rose-50'
                      }`}
                    >
                      {formatBn(cnt)} জন মিস্ত্রি
                    </button>
                  ))}
                </div>

                {/* Direct Total Bill Input */}
                <div>
                  <label className="block text-xs font-extrabold text-amber-900 mb-1">
                    তাদের নির্ধারিত টোটাল বিল কত (সরাসরি সেট করুন ৳) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={poraiContractTotalBill}
                    onChange={(e) => setPoraiContractTotalBill(normalizeNumericInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm font-extrabold font-mono bg-amber-50 border-2 border-amber-400 rounded-xl text-slate-900 tabular-nums"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[300000, 450000, 600000, 720000, 900000].map((billPreset) => (
                      <button
                        key={billPreset}
                        type="button"
                        onClick={() => setPoraiContractTotalBill(String(billPreset))}
                        className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border cursor-pointer ${
                          parseNum(poraiContractTotalBill, 0) === billPreset
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                        }`}
                      >
                        ৳{formatBn(billPreset)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-extrabold text-emerald-800 mb-1">
                    ২. এই সপ্তাহে কত টাকা নিল / দেওয়া হলো (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={poraiPaidAmount}
                    onChange={(e) => setPoraiPaidAmount(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-extrabold font-mono bg-emerald-50 border-2 border-emerald-400 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={poraiDate}
                    onChange={(e) => setPoraiDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / সপ্তাহের নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ১ম সপ্তাহের খোরাকি ও সাপ্তাহিক কিস্তি প্রদান..."
                  value={poraiNote}
                  onChange={(e) => setPoraiNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                />
              </div>

              {/* Live Porai Mistri Contract & Remaining Balance Preview */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">কর্মরত মিস্ত্রি সংখ্যা:</span>
                  <strong className="text-rose-300 font-mono">
                    {formatBn(livePoraiMistriCount)} জন মিস্ত্রি ({formatBn(livePoraiMonths)} মাস)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">তাদের নির্ধারিত টোটাল বিল:</span>
                  <strong className="text-amber-300 font-mono text-sm">
                    {formatCurrencyBn(livePoraiTotalBill)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">প্রতি সপ্তাহে / আজ দেওয়া হচ্ছে:</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrencyBn(livePoraiPaid)}
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  {livePoraiBalance.isDina ? (
                    <>
                      <span className="text-amber-300 font-bold">দিনায় চলে যাচ্ছে (অতিরিক্ত দেওয়া):</span>
                      <strong className="text-amber-400 font-mono text-sm">
                        দিনা {formatCurrencyBn(livePoraiBalance.dinaAmount)}
                      </strong>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-200 font-bold">তাহলে সে আর পাচ্ছে কত (বাকি):</span>
                      <strong className="text-rose-400 font-mono text-sm">
                        {formatCurrencyBn(livePoraiDue)}
                      </strong>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPorai}
                className="w-full py-2.5 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {savingPorai
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingPoraiId
                  ? '✓ পোড়াই মিস্ত্রির টোটাল বিল ও হিসাব আপডেট করুন'
                  : '+ পোড়াই মিস্ত্রির সংখ্যা, টোটাল বিল ও সাপ্তাহিক টাকা সেভ করুন'}
              </button>
            </form>

            {/* Porai Mistri Ledger Table */}
            <div className="lg:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">পোড়াই মিস্ত্রি দল ও বিবরণ</th>
                    <th className="py-3 px-3 font-bold text-right">কয়জন মিস্ত্রি</th>
                    <th className="py-3 px-3 font-bold text-right">তাদের টোটাল বিল</th>
                    <th className="py-3 px-3 font-bold text-right">সাপ্তাহিক দেওয়া টাকা</th>
                    <th className="py-3 px-3 font-bold text-right">সে আর পাচ্ছে কত / দিনা</th>
                    <th className="py-3 px-3 font-bold text-right">সাপ্তাহিক পেমেন্ট ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {poraiMistriRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-500">
                        এখনো পোড়াই মিস্ত্রির (চুল্লির হিসাব) কোনো এন্ট্রি করা হয়নি। বাম পাশের ফর্ম থেকে কয়জন মিস্ত্রি কাজ করছে এবং তাদের টোটাল বিল কত তা সেট করুন।
                      </td>
                    </tr>
                  ) : (
                    poraiMistriRecords.map((rec) => {
                      const effectiveMistriCount =
                        rec.mistriCount && rec.mistriCount > 0 ? rec.mistriCount : 8;
                      const effectiveBill =
                        rec.contractTotalBill && rec.contractTotalBill > 0
                          ? rec.contractTotalBill
                          : rec.totalBill;
                      const effectiveDue = Math.max(0, effectiveBill - rec.paidAmount);
                      return (
                        <tr key={rec.id} className="hover:bg-rose-50/30">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">
                              {rec.mistriName} —{' '}
                              <span className="text-rose-700">{rec.chamberOrRound}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {rec.date} {rec.note ? `· ${rec.note}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-extrabold font-mono tabular-nums">
                              {formatBn(effectiveMistriCount)} জন মিস্ত্রি
                            </span>
                            {rec.monthsCount && rec.monthsCount > 0 ? (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {formatBn(rec.monthsCount)} মাস চুক্তি
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900 font-mono tabular-nums">
                            {formatCurrencyBn(effectiveBill)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono tabular-nums">
                            {formatCurrencyBn(rec.paidAmount)}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold font-mono tabular-nums">
                            {rec.paidAmount > effectiveBill ? (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                                দিনা {formatCurrencyBn(rec.paidAmount - effectiveBill)}
                              </span>
                            ) : (
                              <span className="text-rose-700">{formatCurrencyBn(effectiveDue)}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {effectiveDue === 0 && effectiveBill > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                                  ✓ পরিশোধিত (Paid)
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  openDepositModal({ type: 'PORAI_MISTRI', record: rec }, 'KHORAKI')
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                              >
                                + সাপ্তাহিক টাকা দিন
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openDepositModal(
                                    { type: 'PORAI_MISTRI', record: rec },
                                    'FRIDAY_FINAL'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                চূড়ান্ত বিল পরিশোধ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditPoraiMistri(rec)}
                                title="এডিট করুন"
                                className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {onDeletePoraiMistri && (
                                <button
                                  type="button"
                                  onClick={() => onDeletePoraiMistri(rec.id)}
                                  title="মুছে ফেলুন"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">সর্বমোট পোড়াই মিস্ত্রি হিসাব:</td>
                    <td className="py-3 px-3 text-right font-mono text-rose-800 tabular-nums">
                      {formatBn(totalPoraiMistriHeadcount || Number(poraiMistriCount) || 8)} জন
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatCurrencyBn(totalPoraiBill)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 font-mono tabular-nums">
                      {formatCurrencyBn(totalPoraiPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 font-mono tabular-nums">
                      {formatCurrencyBn(totalPoraiDue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Porai Mistri Payment Record History Ledger */}
          {renderPaymentRecordsTable(
            'পোড়াই মিস্ত্রি (আলতাফ সর্দার) — প্রতি সপ্তাহে টাকা দেওয়ার রেকর্ড খতিয়ান',
            'পোড়াই মিস্ত্রির সর্দার আলতাফ সর্দারকে কবে কত টাকা সাপ্তাহিক কিস্তি বা খোরাকি দেওয়া হয়েছে তার সম্পূর্ণ তালিকা',
            poraiPayments,
            'orange'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 3: CHULLI LINE UNLOAD — নজরুল সর্দার (১ লাইন = ৪,০০০ ইট, প্রতি লাইন = ৭৫০ টাকা)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'CHULLI_UNLOAD') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300 mb-1">
                আনলোড সর্দার: নজরুল সর্দার · ১ লাইন = ৪,০০০ ইট · প্রতি লাইন রেট = ৭৫০ টাকা · চুল্লি অটো ফাঁকা
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-600" />
                ৪. আনলোড হিসাব (নজরুল সর্দার) — চুল্লি থেকে কয় লাইন ইট বের করলো ও অটো চুল্লি লাইন ফাঁকা
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                আনলোড সর্দার <strong>নজরুল সর্দার</strong> ও তার দল যখন চুল্লি থেকে লাইনে ইট আনলোড করে (১ লাইন = ৪,০০০ ইট, প্রতি লাইনে ৭৫০ টাকা), তখন <strong>চুল্লি থেকে স্বয়ংক্রিয়ভাবে ওই লাইনগুলো ফাঁকা হয়ে যায়</strong>।
              </p>
            </div>

            {chulliUnloads.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      chulliUnloads.find((u) => u.dueAmount > 0) || chulliUnloads[0];
                    if (target) {
                      openDepositModal({ type: 'CHULLI_UNLOAD', record: target }, 'KHORAKI');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  + নজরুল সর্দারকে খোরাকি দিন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      chulliUnloads.find((u) => u.dueAmount > 0) || chulliUnloads[0];
                    if (target) {
                      openDepositModal({ type: 'CHULLI_UNLOAD', record: target }, 'FRIDAY_FINAL');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  <Banknote className="w-4 h-4" />
                  শুক্রবারের চূড়ান্ত বিল পরিশোধ
                </button>
              </div>
            )}
          </div>

          {/* Unload Line Summary & Financial Strip + Auto Chimney Unload Successful Sync */}
          <div className="bg-orange-50/70 border-2 border-orange-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white border border-orange-200 rounded-xl p-3">
                <span className="text-xs text-orange-800 font-bold block">
                  মোট বের করা লাইন
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-orange-700 tabular-nums">
                  {formatBn(totalUnloadedLines)} লাইন
                </strong>
                <span className="text-[11px] text-slate-500 block">
                  ১ লাইন = ৪,০০০ পিস ইট
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <span className="text-xs text-slate-600 font-semibold block">
                  লাইনের মোট পোড়ানো ইট
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {formatBn(totalUnloadedBricks)} পিস
                </strong>
                <span className="text-[11px] text-slate-500 block">
                  মোট রেকর্ড: {formatBn(chulliUnloads.length)}টি
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <span className="text-xs text-slate-600 font-semibold block">
                  নজরুল সর্দারের মোট বিল
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {formatCurrencyBn(totalUnloadBill)}
                </strong>
                <span className="text-[11px] text-slate-500 block">
                  সিস্টেম লাইন চুক্তি (@ ৳{formatBn(Number(unloadRatePerLine) || 750)}/লাইন)
                </span>
              </div>
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                <span className="text-xs text-emerald-800 font-semibold block">
                  জমা দেওয়া টাকা (পরিশোধিত)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-emerald-700 tabular-nums">
                  {formatCurrencyBn(totalUnloadPaid)}
                </strong>
                <span className="text-[11px] text-emerald-700 block">
                  নগদ ও কিস্তি পরিশোধ
                </span>
              </div>
              <div className={`${unloadOverallBalance.isDina ? 'bg-amber-50/90 border-amber-300' : 'bg-rose-50/80 border-rose-200'} border rounded-xl p-3 col-span-2 sm:col-span-1`}>
                <span className={`text-xs font-semibold block ${unloadOverallBalance.isDina ? 'text-amber-900' : 'text-rose-800'}`}>
                  {unloadOverallBalance.isDina ? 'দিনায় আছে (অতিরিক্ত পরিশোধ)' : 'তারা আর পাবে (বাকি বিল)'}
                </span>
                <strong className={`text-base sm:text-lg font-bold font-mono tabular-nums ${unloadOverallBalance.isDina ? 'text-amber-800' : 'text-rose-700'}`}>
                  {unloadOverallBalance.isDina ? formatCurrencyBn(unloadOverallBalance.dinaAmount) : formatCurrencyBn(totalUnloadDue)}
                </strong>
                <span className={`text-[11px] block ${unloadOverallBalance.isDina ? 'text-amber-700' : 'text-rose-700'}`}>
                  {unloadOverallBalance.isDina ? 'পরবর্তী লাইনের বিল থেকে কর্তন হবে' : 'বকেয়া পাওনা'}
                </span>
              </div>
            </div>

            {/* Automatic Chimney Unload & Stock Sync Banner */}
            <div
              data-testid="unload-hisab-auto-chimney-sync-banner"
              className="bg-emerald-950 text-white border border-emerald-500/40 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>অটো চুল্লি লাইন কর্তন ও পাকা ইট স্টক আপডেট — নজরুল সর্দার আনলোড করলেই সাথে সাথে আপডেট হবে</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  নজরুল সর্দার এখানে আনলোড করলেই চুল্লি সিস্টেম থেকে সেই লাইন ও ইট স্বয়ংক্রিয়ভাবে কর্তন (Deduct) হয়ে চুল্লির <strong>এভেইলেবল ফাঁকা লাইন</strong> বেড়ে যাবে এবং পাকা ইটের <strong>ইনভেন্টরি স্টকে সাথে সাথে যোগ</strong> হবে।
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="bg-slate-900 border border-orange-500/50 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] text-orange-300 font-bold block">
                    চুল্লি থেকে আনলোড (কর্তন)
                  </span>
                  <strong className="text-xs sm:text-sm font-extrabold font-mono text-orange-400 tabular-nums">
                    -{formatBn(totalUnloadedBricks)} পিস
                  </strong>
                  <span className="text-[10px] text-slate-400 block">
                    {formatBn(Math.floor(totalUnloadedLines))} লাইন আনলোডকৃত
                  </span>
                </div>
                <div className="bg-slate-900 border border-emerald-500/50 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] text-emerald-300 font-bold block">
                    চুল্লিতে এভেইলেবল ফাঁকা লাইন
                  </span>
                  <strong className="text-xs sm:text-sm font-extrabold font-mono text-emerald-400 tabular-nums">
                    {formatBn(availableKilnLines)} / ২০৮ লাইন
                  </strong>
                  <span className="text-[10px] text-slate-400 block">
                    চুল্লিতে আছে: {formatBn(remainingBricksInKiln)} পিস
                  </span>
                </div>
                <div className="bg-slate-900 border border-sky-500/50 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] text-sky-300 font-bold block">
                    বর্তমান পাকা ইট স্টক
                  </span>
                  <strong className="text-xs sm:text-sm font-extrabold font-mono text-sky-400 tabular-nums">
                    {formatBn(totalCurrentBrickStock)} পিস
                  </strong>
                  <span className="text-[10px] text-slate-400 block">
                    তাৎক্ষণিক স্টক সিঙ্ক সক্রিয়
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Chulli Line Unload Form */}
            <form
              noValidate
              onSubmit={handleChulliUnloadSubmit}
              className="lg:col-span-5 bg-orange-50/50 border border-orange-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <PackagePlus className="w-4 h-4 text-orange-600" />
                  {editingUnloadId
                    ? 'লাইন আনলোড হিসাব সংশোধন (Edit)'
                    : 'নতুন লাইন আনলোড এন্ট্রি (নজরুল সর্দার)'}
                </h4>
                {editingUnloadId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUnloadId(undefined);
                      setUnloadLines('');
                      setUnloadRatePerLine('');
                      setUnloadPaidAmount('');
                      setUnloadNote('');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    বাতিল করুন
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    আনলোড সর্দারের নাম *
                  </label>
                  <input
                    type="text"
                    placeholder="নজরুল সর্দার"
                    value={unloadSardarName}
                    onChange={(e) => setUnloadSardarName(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    চেম্বার / রাউন্ড নং
                  </label>
                  <input
                    type="text"
                    value={unloadChamber}
                    onChange={(e) => setUnloadChamber(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Line-based Calculation Inputs */}
              <div className="bg-white p-3.5 rounded-xl border-2 border-orange-300 space-y-3">
                <div className="flex items-center justify-between border-b border-orange-100 pb-2">
                  <span className="text-xs font-extrabold text-orange-900">
                    কয় লাইন ইট বের করলো লিখুন:
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                    ১ লাইন = ৪,০০০ ইট · ৭৫০৳/লাইন
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-orange-900 mb-1">
                      কত লাইন বের করলো *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={unloadLines}
                      onChange={(e) => setUnloadLines(normalizeNumericInput(e.target.value))}
                      className="w-full px-2.5 py-2 text-sm font-extrabold font-mono bg-orange-50/70 border-2 border-orange-400 rounded-lg tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      প্রতি লাইনে ইট (পিস)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={unloadBricksPerLine}
                      onChange={(e) => setUnloadBricksPerLine(normalizeNumericInput(e.target.value))}
                      className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      প্রতি লাইন রেট (৳) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={unloadRatePerLine}
                      onChange={(e) => setUnloadRatePerLine(normalizeNumericInput(e.target.value))}
                      className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                {/* Quick Line Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">দ্রুত লাইন সিলেক্ট:</span>
                  {[2, 4, 5, 8, 10, 12, 15, 20].map((ln) => (
                    <button
                      key={ln}
                      type="button"
                      onClick={() => setUnloadLines(String(ln))}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md border cursor-pointer transition-colors ${
                        parseNum(unloadLines, 0) === ln
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-orange-50'
                      }`}
                    >
                      {formatBn(ln)} লাইন ({formatBn(ln * (parseNum(unloadBricksPerLine, 4000) || 4000))})
                    </button>
                  ))}
                </div>

                {/* Quick Rate Per Line Presets (Default 750 BDT, customizable anytime) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-orange-100">
                  <span className="text-[11px] font-semibold text-slate-600">
                    সিস্টেম লাইন চুক্তি রেট (প্রতি লাইন):
                  </span>
                  {[650, 700, 750, 800, 850, 900, 1000].map((ratePreset) => (
                    <button
                      key={ratePreset}
                      type="button"
                      onClick={() => setUnloadRatePerLine(String(ratePreset))}
                      className={`px-2 py-0.5 text-[11px] font-bold font-mono rounded-md border cursor-pointer transition-colors ${
                        parseNum(unloadRatePerLine, 0) === ratePreset
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                      }`}
                    >
                      ৳{formatBn(ratePreset)}/লাইন
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    জমা দেওয়ার টাকা (Paid ৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={unloadPaidAmount}
                    onChange={(e) => setUnloadPaidAmount(normalizeNumericInput(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-emerald-50 border border-emerald-400 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={unloadDate}
                    onChange={(e) => setUnloadDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  যে গ্রেডের স্টকে সরাসরি পাকা ইট যোগ হবে
                </label>
                <select
                  value={unloadTargetGradeId}
                  onChange={(e) => setUnloadTargetGradeId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                >
                  {brickGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {cleanBrickGradeName(g.nameBn)} — বর্তমান স্টক: {formatBn(g.currentStock)} পিস
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  নোট / মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: উত্তর পাশের চেম্বার, নগদ খোরাকি ও লাইন বিল..."
                  value={unloadNote}
                  onChange={(e) => setUnloadNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Live Line Unload Calculation */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">চুল্লি থেকে কর্তন ও স্টকে যোগ:</span>
                  <strong className="text-orange-300 font-mono">
                    {formatBn(liveUnloadCalc.linesUnloaded)} লাইন = {formatBn(liveTotalUnloadBricks)} পিস ইট
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">আনলোডের পর চুল্লির এভেইলেবল ফাঁকা লাইন:</span>
                  <strong className="text-sky-300 font-mono">
                    {formatBn(
                      Math.min(
                        208,
                        availableKilnLines + Math.floor(liveUnloadCalc.linesUnloaded)
                      )
                    )}{' '}
                    / ২০৮ লাইন ফাঁকা
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    তাদের মোট বিল ({formatBn(liveUnloadCalc.linesUnloaded)} লাইন × ৳{formatBn(liveUnloadCalc.ratePerLine)}):
                  </span>
                  <strong className="text-amber-300 font-mono text-sm">
                    {formatCurrencyBn(liveUnloadTotalBill)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দেওয়া টাকা:</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrencyBn(liveUnloadPaid)}
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  {liveUnloadBalance.isDina ? (
                    <>
                      <span className="text-amber-300 font-bold">দিনায় চলে যাচ্ছে (অতিরিক্ত দেওয়া):</span>
                      <strong className="text-amber-400 font-mono text-sm">
                        দিনা {formatCurrencyBn(liveUnloadBalance.dinaAmount)}
                      </strong>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-300 font-bold">তারা আর পাবে (বাকি):</span>
                      <strong className="text-rose-400 font-mono text-sm">
                        {formatCurrencyBn(liveUnloadDue)}
                      </strong>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingUnload}
                className="w-full py-2.5 px-4 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {savingUnload
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingUnloadId
                  ? '✓ লাইন আনলোড আপডেট করুন'
                  : '+ লাইন আনলোড হিসাব ও পোড়ানো ইট সেভ করুন'}
              </button>
            </form>

            {/* Chulli Line Unload Ledger Table */}
            <div className="lg:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">তারিখ, রাউন্ড ও আনলোড সর্দার</th>
                    <th className="py-3 px-3 font-bold text-right">বের করা লাইন</th>
                    <th className="py-3 px-3 font-bold text-right">মোট ইট (৪০০০/লাইন)</th>
                    <th className="py-3 px-3 font-bold text-right">লাইন রেট</th>
                    <th className="py-3 px-3 font-bold text-right">মোট বিল</th>
                    <th className="py-3 px-3 font-bold text-right">জমা টাকা</th>
                    <th className="py-3 px-3 font-bold text-right">বাকি পাওনা / দিনা</th>
                    <th className="py-3 px-3 font-bold text-right">টাকা জমা ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chulliUnloads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 px-4 text-center text-xs text-slate-500">
                        এখনো কোনো লাইন আনলোড রেকর্ড যোগ করা হয়নি। বাম পাশের ফর্ম থেকে কয় লাইন ইট বের করলো তা লিখুন।
                      </td>
                    </tr>
                  ) : (
                    chulliUnloads.map((un) => {
                      const bPerLine = un.bricksPerLine && un.bricksPerLine > 0 ? un.bricksPerLine : 4000;
                      const lines =
                        un.linesUnloaded && un.linesUnloaded > 0
                          ? un.linesUnloaded
                          : Number(((un.totalBricksUnloaded || 0) / bPerLine).toFixed(2));
                      const rPerLine = un.ratePerLine && un.ratePerLine > 0 ? un.ratePerLine : 750;
                      return (
                        <tr key={un.id} className="hover:bg-orange-50/30">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">
                              {un.sardarName} — <span className="text-orange-700">{un.chamberOrRound}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {un.date} {un.note ? `· ${un.note}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-900 border border-orange-300 font-extrabold font-mono tabular-nums">
                              {formatBn(lines)} লাইন
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                            {formatBn(un.totalBricksUnloaded)} পিস
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            ৳{formatBn(rPerLine)}/লাইন
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                            {formatCurrencyBn(un.totalBill)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBn(un.paidAmount)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums">
                            {un.paidAmount > un.totalBill ? (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                                দিনা {formatCurrencyBn(un.paidAmount - un.totalBill)}
                              </span>
                            ) : (
                              <span className="text-rose-700">{formatCurrencyBn(un.dueAmount)}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {un.dueAmount === 0 && un.totalBill > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                                  ✓ পরিশোধিত (Paid)
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  openDepositModal({ type: 'CHULLI_UNLOAD', record: un }, 'KHORAKI')
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                              >
                                + খোরাকি দিন
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openDepositModal({ type: 'CHULLI_UNLOAD', record: un }, 'FRIDAY_FINAL')
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                শুক্রবারের বিল পেমেন্ট
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditChulliUnload(un)}
                                title="এডিট করুন"
                                className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteChulliUnload && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteChulliUnload(un.id)}
                                  title="মুছে ফেলুন"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">সর্বমোট লাইন আনলোড হিসাব:</td>
                    <td className="py-3 px-3 text-right font-mono text-orange-800 tabular-nums">
                      {formatBn(totalUnloadedLines)} লাইন
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(totalUnloadedBricks)} পিস
                    </td>
                    <td className="py-3 px-3 text-right">—</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatCurrencyBn(totalUnloadBill)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 tabular-nums">
                      {formatCurrencyBn(totalUnloadPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 tabular-nums">
                      {formatCurrencyBn(totalUnloadDue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Unload Payment Record History Ledger */}
          {renderPaymentRecordsTable(
            'আনলোড হিসাব (নজরুল সর্দার) — টাকা জমা দেওয়ার রেকর্ড খতিয়ান',
            'চুল্লি থেকে লাইনে পোড়ানো ইট আনলোড সর্দার নজরুল সর্দারকে কবে কত টাকা জমা দেওয়া হয়েছে তার সম্পূর্ণ রেকর্ড',
            unloadPayments,
            'emerald'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 3B: RUBBISH SARDAR (অবেদ রাবিশ সর্দার — রাউন্ড হিসেবে বিল ও খোরাকি)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'RUBBISH_MISTRI') && (
        <div
          data-testid="rubbish-sardar-section"
          className="bg-white border border-slate-200 border-t-4 border-t-purple-600 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300 mb-1">
                রাবিশ সর্দার: অবেদ রাবিশ সর্দার · রাউন্ড হিসেবে বিল · মাঝে মাঝে খোরাকি ও দিনা সমন্বয়
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                ৫. রাবিশ সর্দার (অবেদ রাবিশ সর্দার) — রাউন্ড হিসাবে বিল ও খোরাকি খতিয়ান
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                <strong>অবেদ রাবিশ সর্দার</strong> ও তার দলকে প্রতি রাউন্ড হিসেবে টাকা দেওয়া হয় এবং তারা মাঝে মাঝে খোরাকি নেয়। অতিরিক্ত টাকা নিলে অটো <strong>দিনা</strong> দেখাবে এবং পরবর্তী রাউন্ডের বিল থেকে স্বয়ংক্রিয়ভাবে কর্তন হবে।
              </p>
            </div>

            {rubbishRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      rubbishRecords.find((r) => r.dueAmount > 0) || rubbishRecords[0];
                    if (target) {
                      openDepositModal({ type: 'RUBBISH_SARDAR', record: target }, 'KHORAKI');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  + অবেদ রাবিশ সর্দারকে খোরাকি দিন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      rubbishRecords.find((r) => r.dueAmount > 0) || rubbishRecords[0];
                    if (target) {
                      openDepositModal({ type: 'RUBBISH_SARDAR', record: target }, 'FRIDAY_FINAL');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  <Banknote className="w-4 h-4" />
                  রাউন্ডের চূড়ান্ত বিল পরিশোধ
                </button>
              </div>
            )}
          </div>

          {/* Rubbish Sardar Summary Banner */}
          <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#1E293B] text-white rounded-2xl p-4 sm:p-5 border-2 border-purple-500/40 shadow-md">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5">
                <span className="text-[11px] text-slate-400 block">রাবিশ সর্দারের নাম</span>
                <strong className="text-base sm:text-xl font-extrabold text-white mt-0.5 block">
                  অবেদ রাবিশ সর্দার
                </strong>
                <span className="text-[11px] text-purple-300">
                  মোট রাউন্ড এন্ট্রি: {formatBn(rubbishRecords.length)}টি
                </span>
              </div>
              <div className="bg-slate-800/90 border border-amber-500/40 rounded-xl p-3.5">
                <span className="text-[11px] text-amber-300 font-semibold block">
                  মোট রাউন্ড বিল (পাবে)
                </span>
                <strong className="text-base sm:text-xl font-extrabold font-mono text-amber-300 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalRubbishBill)}
                </strong>
                <span className="text-[11px] text-slate-400">রাউন্ড চুক্তির মোট বিল</span>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3.5">
                <span className="text-[11px] text-emerald-300 font-semibold block">
                  খোরাকি ও নগদ প্রদান
                </span>
                <strong className="text-base sm:text-xl font-extrabold font-mono text-emerald-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalRubbishPaid)}
                </strong>
                <span className="text-[11px] text-emerald-300/80">মোট দেওয়া টাকা</span>
              </div>
              <div className={`${rubbishOverallBalance.isDina ? 'bg-amber-950/60 border-amber-500/40' : 'bg-rose-950/60 border-rose-500/40'} border rounded-xl p-3.5`}>
                <span className={`text-[11px] font-semibold block ${rubbishOverallBalance.isDina ? 'text-amber-300' : 'text-rose-300'}`}>
                  {rubbishOverallBalance.isDina ? 'দিনায় আছে (অতিরিক্ত দেওয়া)' : 'বর্তমান বাকি পাওনা'}
                </span>
                <strong className={`text-base sm:text-xl font-extrabold font-mono tabular-nums mt-0.5 block ${rubbishOverallBalance.isDina ? 'text-amber-300' : 'text-rose-400'}`}>
                  {rubbishOverallBalance.isDina ? formatCurrencyBn(rubbishOverallBalance.dinaAmount) : formatCurrencyBn(totalRubbishDue)}
                </strong>
                <span className={`text-[11px] ${rubbishOverallBalance.isDina ? 'text-amber-300/80' : 'text-rose-300/80'}`}>
                  {rubbishOverallBalance.isDina ? 'পরবর্তী রাউন্ডের বিল হতে কর্তন হবে' : 'রাউন্ড বিল − দেওয়া টাকা'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Rubbish Sardar Entry Form */}
            <form
              noValidate
              onSubmit={handleRubbishSubmit}
              className="lg:col-span-5 bg-purple-50/40 border-2 border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-purple-200 pb-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-purple-600" />
                  {editingRubbishId
                    ? 'রাবিশ সর্দারের রাউন্ড বিল ও খোরাকি আপডেট'
                    : 'অবেদ রাবিশ সর্দার: রাউন্ড বিল ও খোরাকি এন্ট্রি'}
                </h4>
                {editingRubbishId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRubbishId(undefined);
                      setRubbishRoundBill('');
                      setRubbishPaidAmount('');
                      setRubbishNote('');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    রাবিশ সর্দারের নাম *
                  </label>
                  <input
                    type="text"
                    placeholder="অবেদ রাবিশ সর্দার"
                    value={rubbishSardarName}
                    onChange={(e) => setRubbishSardarName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    রাউন্ড নং / কাজের বিবরণ *
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: ১ম রাউন্ড"
                    value={rubbishRoundName}
                    onChange={(e) => setRubbishRoundName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-extrabold text-purple-900 mb-1">
                    এই রাউন্ডের বিল কত (৳) (শুধু খোরাকি দিলে 0 রাখুন)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={rubbishRoundBill}
                    onChange={(e) => setRubbishRoundBill(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-extrabold font-mono bg-white border-2 border-purple-400 rounded-xl tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-emerald-800 mb-1">
                    জমা / খোরাকি দেওয়া হলো কত টাকা (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={rubbishPaidAmount}
                    onChange={(e) => setRubbishPaidAmount(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-extrabold font-mono bg-emerald-50 border-2 border-emerald-400 rounded-xl tabular-nums text-emerald-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={rubbishDate}
                    onChange={(e) => setRubbishDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মন্তব্য / নোট (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: রাউন্ড চুক্তি বা সাপ্তাহিক খোরাকি..."
                    value={rubbishNote}
                    onChange={(e) => setRubbishNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Live Rubbish Calculation Preview */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">নতুন রাউন্ডের বিল:</span>
                  <strong className="text-amber-300 font-mono">{formatCurrencyBn(liveRubbishBill)}</strong>
                </div>
                {rubbishPriorDina > 0 && (
                  <div className="flex justify-between text-amber-300 font-bold bg-amber-950/60 px-2 py-1 rounded">
                    <span>অবেদ সর্দারের পূর্বের দিনা কর্তন:</span>
                    <span className="font-mono">−{formatCurrencyBn(liveRubbishAdjustment.dinaDeductedFromNewWork)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা / খোরাকি দেওয়া হচ্ছে:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrencyBn(liveRubbishPaid)}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  {liveRubbishAdjustment.finalNewDina > 0 ? (
                    <>
                      <span className="text-amber-300 font-bold">দিনায় থাকবে (অতিরিক্ত জমা):</span>
                      <strong className="text-amber-400 font-mono">{formatCurrencyBn(liveRubbishAdjustment.finalNewDina)}</strong>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-300 font-bold">আর পাবে কত (বাকি):</span>
                      <strong className="text-rose-400 font-mono">{formatCurrencyBn(liveRubbishAdjustment.finalDueAmount)}</strong>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingRubbish}
                className="w-full py-2.5 px-4 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {savingRubbish
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingRubbishId
                  ? '✓ রাবিশ সর্দারের হিসাব আপডেট করুন'
                  : '+ অবেদ রাবিশ সর্দারের রাউন্ড বিল / খোরাকি সেভ করুন'}
              </button>
            </form>

            {/* Rubbish Sardar Ledger Table */}
            <div className="lg:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">তারিখ, সর্দার ও রাউন্ড</th>
                    <th className="py-3 px-3 font-bold text-right">রাউন্ড বিল</th>
                    <th className="py-3 px-3 font-bold text-right">খোরাকি / জমা টাকা</th>
                    <th className="py-3 px-3 font-bold text-right">বাকি পাওনা / দিনা</th>
                    <th className="py-3 px-3 font-bold text-right">খোরাকি ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rubbishRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center text-xs text-slate-500">
                        এখনো অবেদ রাবিশ সর্দারের কোনো রাউন্ড বা খোরাকি হিসাব যোগ করা হয়নি। বাম পাশের ফর্ম থেকে রাউন্ড বিল অথবা খোরাকি টাকা লিখে সেভ করুন।
                      </td>
                    </tr>
                  ) : (
                    rubbishRecords.map((rb) => (
                      <tr key={rb.id} className="hover:bg-purple-50/30">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">
                            {rb.sardarName} — <span className="text-purple-700">{rb.chamberOrRound}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {rb.date} {rb.note ? `· ${rb.note}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono tabular-nums">
                          {formatCurrencyBn(rb.roundBill)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono tabular-nums">
                          {formatCurrencyBn(rb.paidAmount)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono tabular-nums">
                          {rb.paidAmount > rb.roundBill ? (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                              দিনা {formatCurrencyBn(rb.paidAmount - rb.roundBill)}
                            </span>
                          ) : (
                            <span className="text-rose-700">{formatCurrencyBn(rb.dueAmount)}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {rb.dueAmount === 0 && rb.roundBill > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                                ✓ পরিশোধিত (Paid)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                openDepositModal({ type: 'RUBBISH_SARDAR', record: rb }, 'KHORAKI')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              + খোরাকি দিন
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openDepositModal({ type: 'RUBBISH_SARDAR', record: rb }, 'FRIDAY_FINAL')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              রাউন্ড বিল পেমেন্ট
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditRubbish(rb)}
                              title="এডিট করুন"
                              className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteRubbish && (
                              <button
                                type="button"
                                onClick={() => onDeleteRubbish(rb.id)}
                                title="মুছে ফেলুন"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">সর্বমোট রাবিশ সর্দার হিসাব:</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatCurrencyBn(totalRubbishBill)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 font-mono tabular-nums">
                      {formatCurrencyBn(totalRubbishPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 font-mono tabular-nums">
                      {formatCurrencyBn(totalRubbishDue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {renderPaymentRecordsTable(
            'রাবিশ সর্দার (অবেদ রাবিশ সর্দার) — খোরাকি ও রাউন্ড বিল দেওয়ার রেকর্ড খতিয়ান',
            'অবেদ রাবিশ সর্দারকে কবে কত টাকা খোরাকি বা রাউন্ড বিল দেওয়া হয়েছে তার সম্পূর্ণ রেকর্ড',
            rubbishPayments,
            'amber'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 4: FIRED BRICK GRADE SALES & SEASON OUTPUT REPORT TABLE
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'FIRED_STOCK') && (
        <div
          data-testid="fired-brick-sales-grade-report"
          className="bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs"
        >
          {/* Executive Dark Summary Banner for Brick Sales-Driven Grade Report */}
          <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#1E293B] text-white rounded-2xl p-5 border-2 border-emerald-500/40 shadow-md space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>ইট ও বিক্রয় রিপোর্ট · বিক্রির ওপর ভিত্তি করে গ্রেডওয়ারী সিজন উৎপাদন নির্ধারণ</span>
                </div>
                <h3 className="text-base sm:text-xl font-extrabold text-white tracking-tight">
                  পোড়ানো ইটের বর্তমান স্টক ও বিক্রয় রিপোর্ট (১ নং · ১.৫ নং · ২ নং · ৩ নং · পিকেট · আদলা)
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
                  পোড়ানোর পরে কোন গ্রেডের ইট কয় পিস হলো তা আগে বলা অসম্ভব — আমরা টোটাল <strong className="text-emerald-300">১ নং কতগুলো বেচলাম</strong>, <strong className="text-sky-300">পিকেট কতগুলো বেচলাম</strong>, <strong className="text-indigo-300">দেড় নম্বর (১.৫ নং)</strong>, <strong className="text-amber-300">২ নং</strong>, <strong className="text-orange-300">৩ নং</strong> এবং <strong className="text-rose-300">আদলা কতগুলো বিক্রি করলাম</strong> — তার ওপর ডিপেন্ড করেই সিজন শেষে কোন গ্রেডের ইট কত পিস হয়েছিল তা নির্ধারিত হয়।
                </p>
              </div>

              {/* Quick Grade Rate / Adjustment Form */}
              <form
                noValidate
                onSubmit={handleStockSubmit}
                className="flex flex-wrap items-end gap-2.5 bg-slate-800/90 p-3 rounded-xl border border-slate-700 shrink-0"
              >
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 mb-1">
                    ইটের গ্রেড নির্বাচন
                  </label>
                  <select
                    value={selectedGradeId}
                    onChange={(e) => setSelectedGradeId(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-lg"
                  >
                    {brickGrades.map((g) => (
                      <option key={g.id} value={g.id} className="bg-white text-slate-900">
                        {cleanBrickGradeName(g.nameBn)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-300 mb-1">
                    হাজার প্রতি দর সেট (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={customRate}
                    onChange={(e) => setCustomRate(normalizeNumericInput(e.target.value))}
                    className="w-28 px-2.5 py-1.5 text-xs font-bold font-mono bg-white text-slate-900 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingStock}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shadow-xs"
                >
                  {submittingStock ? '...' : 'দর আপডেট করুন'}
                </button>
              </form>
            </div>

            {/* Reality Explanation Notice Box */}
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-emerald-300">
                  ভাটার বাস্তব হিসাব নিয়ম (বিক্রি = গ্রেড উৎপাদন):
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  চুল্লি থেকে ইট বের করার সময় ১ নং, পিকেট, ১.৫ নং, ২ নং, ৩ নং বা আদলা আলাদা করে গোনা যায় না। ক্যাশ মেমোতে যে গ্রেডের যত পিস ইট বিক্রি হবে, এখানে স্বয়ংক্রিয়ভাবে সেই গ্রেডের ততো পিস ইট যোগ হয়ে সিজন শেষে মোট কত পিস হয়েছিল তা দেখাবে।
                </p>
              </div>
              <div className="shrink-0 bg-slate-900/90 border border-emerald-500/30 rounded-lg px-3 py-2 text-right">
                <span className="text-[10px] text-slate-400 block">সূত্র (Season Grade Formula)</span>
                <strong className="text-xs font-extrabold text-emerald-300">
                  গ্রেডওয়ারী মোট বিক্রি = সিজন শেষে ওই গ্রেডের মোট পিস
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/90 border border-orange-500/40 rounded-xl p-3">
                <span className="text-[11px] text-orange-300 block">চুল্লি থেকে মোট পোড়ানো/আনলোড</span>
                <strong className="text-base sm:text-lg font-extrabold font-mono text-orange-300 tabular-nums mt-0.5 block">
                  {formatBn(
                    unloadReconciliation.totalBricksFromLines > 0
                      ? unloadReconciliation.totalBricksFromLines
                      : totalPoraiBricks
                  )}{' '}
                  পিস
                </strong>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  গ্রেড ছাড়া একত্রে পোড়ানো মোট ইট
                </span>
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3">
                <span className="text-[11px] text-slate-300 block">আজকে মোট কতগুলো বেচলাম</span>
                <strong className="text-base sm:text-lg font-extrabold font-mono text-white tabular-nums mt-0.5 block">
                  {formatBn(totals.todayBrickQty)} পিস ({formatCurrencyBn(totals.todayTotalAmount)})
                </strong>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  গতকাল বিক্রি: {formatBn(totals.yesterdayBrickQty)} পিস
                </span>
              </div>
              <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl p-3">
                <span className="text-[11px] text-emerald-300 block">সিজনে সর্বমোট কতগুলো বেচলাম</span>
                <strong className="text-base sm:text-lg font-extrabold font-mono text-emerald-400 tabular-nums mt-0.5 block">
                  {formatBn(totals.seasonBrickQty)} পিস ({formatCurrencyBn(totals.seasonTotalAmount)})
                </strong>
                <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                  ১ নং, পিকেট, ১.৫, ২, ৩ নং ও আদলা সব মিলিয়ে
                </span>
              </div>
              <div className="bg-slate-800/90 border border-amber-500/40 rounded-xl p-3">
                <span className="text-[11px] text-amber-300 block">ভাটায় অবশিষ্ট অবিক্রিত ইট</span>
                <strong className="text-base sm:text-lg font-extrabold font-mono text-amber-300 tabular-nums mt-0.5 block">
                  {formatBn(
                    Math.max(
                      0,
                      (unloadReconciliation.totalBricksFromLines > 0
                        ? unloadReconciliation.totalBricksFromLines
                        : totalPoraiBricks) - totals.seasonBrickQty
                    )
                  )}{' '}
                  পিস
                </strong>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  মোট পোড়ানো − মোট বিক্রি = অবশিষ্ট
                </span>
              </div>
            </div>
          </div>

          {/* 6-Card Per-Grade Sold = Season Output Summary Cards */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                কোন গ্রেডের কতগুলো ইট বেচলাম (সিজন শেষে কোন নম্বর কত পিস হলো তার হিসাব)
              </h4>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                মেমোতে বিক্রি করলেই এখানে অটো যোগ হয়
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {rows.map(({ grade, todayQty, seasonSoldQty, seasonSoldAmount }) => {
                const sharePct =
                  totals.seasonBrickQty > 0
                    ? Number(((seasonSoldQty / totals.seasonBrickQty) * 100).toFixed(1))
                    : 0;
                const isAdla =
                  grade.id.includes('adla') ||
                  grade.nameBn.includes('আদলা') ||
                  grade.nameBn.includes('ড্যামেজ');
                return (
                  <div
                    key={grade.id}
                    className={`rounded-xl p-3.5 border-2 transition-all ${
                      isAdla
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-slate-50 border-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-900">
                        {cleanBrickGradeName(grade.nameBn)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {formatBn(sharePct)}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] font-semibold text-slate-500 block">
                        সিজনে মোট বেচলাম (প্রাপ্ত পিস):
                      </span>
                      <strong className="text-base sm:text-lg font-extrabold font-mono text-emerald-700 tabular-nums block">
                        {formatBn(seasonSoldQty)} পিস
                      </strong>
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">মোট টাকা:</span>
                      <strong className="font-bold text-slate-900 font-mono tabular-nums">
                        {formatCurrencyBn(seasonSoldAmount)}
                      </strong>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                      <span>আজ বিক্রি:</span>
                      <span className="font-bold text-slate-700">{formatBn(todayQty)} পিস</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grade-by-Grade Detailed Sales & Season Production Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                  <th className="py-3 px-4 font-bold">
                    ইটের গ্রেড / ধরন (১ নং · পিকেট · দেড় নম্বর · ২ নং · ৩ নং · আদলা)
                  </th>
                  <th className="py-3 px-4 font-bold text-right">হাজার প্রতি দর (৳)</th>
                  <th className="py-3 px-4 font-bold text-right">আজ কতগুলো বেচলাম (পিস)</th>
                  <th className="py-3 px-4 font-bold text-right">আজকের বিক্রয় টাকা</th>
                  <th className="py-3 px-4 font-bold text-right">গতকাল কতগুলো বেচলাম</th>
                  <th className="py-3 px-4 font-bold text-right bg-emerald-50 text-emerald-900">
                    সিজনে মোট কতগুলো বেচলাম (সিজন শেষে প্রাপ্ত পিস)
                  </th>
                  <th className="py-3 px-4 font-bold text-right">সিজনের মোট বিক্রয় টাকা</th>
                  <th className="py-3 px-4 font-bold text-right">সিজনে কত ভাগ হলো (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(
                  ({
                    grade,
                    todayQty,
                    todayAmount,
                    yesterdayQty,
                    seasonSoldQty,
                    seasonSoldAmount,
                  }) => {
                    const sharePct =
                      totals.seasonBrickQty > 0
                        ? Number(((seasonSoldQty / totals.seasonBrickQty) * 100).toFixed(1))
                        : 0;
                    return (
                      <tr key={grade.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{cleanBrickGradeName(grade.nameBn)}</span>
                            {grade.id === 'grade-1-5' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                দেড় নম্বর
                              </span>
                            )}
                            {grade.id === 'grade-picket' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                পিকেট
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">
                          {formatCurrencyBn(
                            grade.ratePerUnit < 100
                              ? Math.round(grade.ratePerUnit * 1000)
                              : grade.ratePerUnit
                          )}{' '}
                          / হাজার
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-800 font-semibold">
                          {formatBn(todayQty)} পিস
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                          {formatCurrencyBn(todayAmount)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                          {formatBn(yesterdayQty)} পিস
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-800 bg-emerald-50/60 tabular-nums">
                          {formatBn(seasonSoldQty)} পিস
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-800 tabular-nums">
                          {formatCurrencyBn(seasonSoldAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-700 tabular-nums">
                          {formatBn(sharePct)}%
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <td colSpan={2} className="py-3.5 px-4 text-right">
                    সর্বমোট বিক্রিত ইট (সকল গ্রেড ও আদলা মিলিয়ে মোট উৎপাদন):
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    {formatBn(totals.todayBrickQty)} পিস
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-800 tabular-nums">
                    {formatCurrencyBn(totals.todayTotalAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    {formatBn(totals.yesterdayBrickQty)} পিস
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-900 bg-emerald-100/80 font-extrabold tabular-nums">
                    {formatBn(totals.seasonBrickQty)} পিস
                  </td>
                  <td className="py-3.5 px-4 text-right text-amber-900 tabular-nums">
                    {formatCurrencyBn(totals.seasonTotalAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums">১০০%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* AUTOMATIC LINE UNLOAD VS. SOLD GRADES & ADLA RECONCILIATION PANEL */}
          <div className="bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-900 text-white rounded-2xl p-5 border-2 border-orange-500/40 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                  চুল্লি আনলোড বনাম গ্রেডওয়ারী বিক্রয় ও আদলা সমন্বয় (Auto Sales-to-Grade Reconciliation)
                </span>
                <h4 className="text-sm sm:text-base font-extrabold text-white">
                  বের করা লাইনের মোট ইট বনাম আমরা কোন গ্রেড কতগুলো বেচলাম (১ নং, পিকেট, দেড় নম্বর, ২ নং, ৩ নং ও আদলা) তার গড় দর ও অনুপাত
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  মেমোতে বিক্রি করা প্রতিটি গ্রেডের গড় হাজার দর, মোট বিক্রিত পিস এবং মোট পোড়ানো ইট থেকে কত পিস এখনো ভাটায় অবিক্রিত আছে তার স্বয়ংক্রিয় হিসাব।
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">
                <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2">
                  <span className="text-[11px] text-slate-400 block">মোট আনলোড (লাইন থেকে)</span>
                  <strong className="text-sm font-extrabold font-mono text-orange-300 tabular-nums">
                    {formatBn(unloadReconciliation.totalLinesUnloaded)} লাইন ({formatBn(unloadReconciliation.totalBricksFromLines)} পিস)
                  </strong>
                </div>
                <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl px-3.5 py-2">
                  <span className="text-[11px] text-emerald-300 block">মোট মেমোতে বিক্রিত ইট</span>
                  <strong className="text-sm font-extrabold font-mono text-emerald-400 tabular-nums">
                    {formatBn(unloadReconciliation.totalSoldBricksAllGrades)} পিস ({formatCurrencyBn(unloadReconciliation.totalSoldRevenueAllGrades)})
                  </strong>
                </div>
                <div className="bg-slate-800/90 border border-amber-500/40 rounded-xl px-3.5 py-2 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-amber-300 block">বিক্রিত আদলা ও গড়িয়া/ড্যামেজ</span>
                  <strong className="text-sm font-extrabold font-mono text-amber-300 tabular-nums">
                    {formatBn(unloadReconciliation.totalAdlaAndDamageSoldQty)} পিস ({formatCurrencyBn(unloadReconciliation.totalAdlaAndDamageSoldRevenue)})
                  </strong>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto bg-slate-950/60 border border-slate-800 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-300">
                    <th className="py-2.5 px-3 font-bold">ইটের গ্রেড / ধরন (১ নং · পিকেট · ১.৫ নং · ২ নং · ৩ নং · আদলা)</th>
                    <th className="py-2.5 px-3 font-bold text-right">নির্ধারিত হাজার দর (৳)</th>
                    <th className="py-2.5 px-3 font-bold text-right">মোট কতগুলো বেচলাম / সিজন পিস</th>
                    <th className="py-2.5 px-3 font-bold text-right">বিক্রিত গড় হাজার দর (৳)</th>
                    <th className="py-2.5 px-3 font-bold text-right">মোট বিক্রয় মূল্য (৳)</th>
                    <th className="py-2.5 px-3 font-bold text-right">মোট বিক্রির অনুপাত (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {unloadReconciliation.soldByGrade.map((row) => (
                    <tr
                      key={row.gradeId}
                      className={
                        row.isAdlaOrDamage
                          ? 'bg-amber-950/30 hover:bg-amber-950/50 text-amber-200'
                          : 'hover:bg-slate-900/60 text-slate-200'
                      }
                    >
                      <td className="py-2.5 px-3 font-bold">
                        <div className="flex items-center gap-2">
                          <span>{row.gradeNameBn}</span>
                          {row.gradeId === 'grade-picket' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ১ নং সমমান রেট
                            </span>
                          )}
                          {row.isAdlaOrDamage && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              আদলা / ড্যামেজ ও ঝামা
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {formatCurrencyBn(row.defaultRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-white">
                        {formatBn(row.soldQty)} পিস
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-300">
                        {formatCurrencyBn(row.avgSoldRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-emerald-400">
                        {formatCurrencyBn(row.soldRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {formatBn(row.shareOfSoldPct)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white">
                    <td colSpan={2} className="py-2.5 px-3">
                      সর্বমোট বিক্রিত ইট ও অবশিষ্ট আনলোড ইট ব্যালেন্স:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 tabular-nums">
                      {formatBn(unloadReconciliation.totalSoldBricksAllGrades)} পিস বিক্রি
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-orange-300 tabular-nums">
                      অবশিষ্ট: {formatBn(unloadReconciliation.remainingUnreconciledOrStockBricks)} পিস
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 tabular-nums">
                      {formatCurrencyBn(unloadReconciliation.totalSoldRevenueAllGrades)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">১০০%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          POPUP DEPOSIT / PAYMENT MODAL (+ টাকা জমা দিন পপআপ)
         ===================================================================== */}
      {depositTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="টাকা জমা দেওয়ার পপআপ"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
          onClick={() => setDepositTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-modal-pop"
          >
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {depositTarget.type === 'MILL_POT' &&
                      `${depositTarget.record.millNameBn} (${depositTarget.record.potNo}) — টাকা জমা দিন`}
                    {depositTarget.type === 'VAN_LOAD' &&
                      `ভ্যান লোড (${depositTarget.record.sardarName}) — টাকা জমা দিন`}
                    {depositTarget.type === 'PORAI_MISTRI' &&
                      `পোড়াই মিস্ত্রি (${depositTarget.record.mistriName}) — টাকা জমা দিন`}
                    {depositTarget.type === 'CHULLI_UNLOAD' &&
                      `আনলোড হিসাব (${depositTarget.record.sardarName}) — টাকা জমা দিন`}
                    {depositTarget.type === 'RUBBISH_SARDAR' &&
                      `রাবিশ সর্দার (${depositTarget.record.sardarName}) — টাকা জমা দিন`}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    জমা দেওয়া টাকা সরাসরি খতিয়ান, জমা রেকর্ড ও ক্যাশ বুকে যুক্ত হবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDepositTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form noValidate onSubmit={handleConfirmDeposit} className="p-5 space-y-4">
              {/* 2-Mode Switcher: Mid-Week Khoraki vs Friday Final Bill Settlement */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  data-testid="modal-mode-khoraki-btn"
                  onClick={() => {
                    setDepositMode('KHORAKI');
                    setDepositAmount('');
                    setDepositNote('সাপ্তাহিক খোরাকি বাবদ প্রদান (বিল হতে কর্তন)');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    depositMode === 'KHORAKI'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  ১. মাঝে মাঝে খোরাকি (বিল কমানো)
                </button>
                <button
                  type="button"
                  data-testid="modal-mode-friday-final-btn"
                  onClick={() => {
                    setDepositMode('FRIDAY_FINAL');
                    setDepositAmount('');
                    setDepositNote('শুক্রবারের চূড়ান্ত সর্দার বিল পরিশোধ (Paid)');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    depositMode === 'FRIDAY_FINAL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  ২. শুক্রবারের বিল পরিশোধ (Paid)
                </button>
              </div>

              {/* Current Balance & Friday Net Settlement Breakdown */}
              {(() => {
                const recordTotalBill =
                  depositTarget.type === 'MILL_POT'
                    ? depositTarget.record.totalPayable
                    : depositTarget.type === 'RUBBISH_SARDAR'
                    ? depositTarget.record.roundBill
                    : depositTarget.record.totalBill;
                const settlement = calculateSardarFridaySettlement(
                  recordTotalBill,
                  depositTarget.record.paidAmount,
                  parseNum(depositAmount, 0),
                  depositMode
                );

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                    {depositTarget.type === 'MILL_POT' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">মিল ও পট:</span>
                          <strong className="text-slate-900">
                            {depositTarget.record.millNameBn} ({depositTarget.record.potNo})
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">বানানো ইট ও রেট:</span>
                          <strong className="text-slate-900 font-mono">
                            {formatBn(depositTarget.record.rawBricksCut)} পিস (@ ৳{formatBn(depositTarget.record.ratePerThousand)}/হাজার)
                          </strong>
                        </div>
                      </>
                    )}

                    {depositTarget.type === 'VAN_LOAD' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">ভ্যান সর্দার:</span>
                          <strong className="text-slate-900">
                            {depositTarget.record.sardarName}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">লোড দেওয়া ইট ও ১০০০ পিস রেট:</span>
                          <strong className="text-slate-900 font-mono">
                            {formatBn(depositTarget.record.rawBricksLoaded)} পিস (@ ৳{formatBn(
                              depositTarget.record.ratePerVan > 0 && depositTarget.record.ratePerVan <= 30
                                ? Number((depositTarget.record.ratePerVan * 10).toFixed(2))
                                : depositTarget.record.ratePerVan
                            )}/হাজার)
                          </strong>
                        </div>
                      </>
                    )}

                    {depositTarget.type === 'PORAI_MISTRI' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">পোড়াই মিস্ত্রি ও রাউন্ড:</span>
                          <strong className="text-slate-900">
                            {depositTarget.record.mistriName} ({depositTarget.record.chamberOrRound})
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">চুল্লিতে পোড়ানো ইট:</span>
                          <strong className="text-slate-900 font-mono">
                            {formatBn(depositTarget.record.bricksFired)} পিস (@ ৳{formatBn(depositTarget.record.ratePerThousand)}/হাজার)
                          </strong>
                        </div>
                      </>
                    )}

                    {depositTarget.type === 'CHULLI_UNLOAD' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">আনলোড সর্দার ও রাউন্ড:</span>
                          <strong className="text-slate-900">
                            {depositTarget.record.sardarName} ({depositTarget.record.chamberOrRound})
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">বার করা মোট ইট:</span>
                          <strong className="text-slate-900 font-mono">
                            {formatBn(depositTarget.record.totalBricksUnloaded)} পিস
                          </strong>
                        </div>
                      </>
                    )}

                    {depositTarget.type === 'RUBBISH_SARDAR' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">রাবিশ সর্দার ও রাউন্ড:</span>
                          <strong className="text-slate-900">
                            {depositTarget.record.sardarName} ({depositTarget.record.chamberOrRound})
                          </strong>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between pt-1.5 border-t border-slate-200">
                      <span className="text-slate-700 font-semibold">মোট কাজের বিল:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatCurrencyBn(settlement.totalBill)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 font-semibold">
                        আগে দেওয়া খোরাকি / জমা (কমানো হয়েছে):
                      </span>
                      <strong className="text-emerald-700 font-mono">
                        {formatCurrencyBn(settlement.priorKhorakiOrPaid)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-rose-700 font-semibold">
                        শুক্রবারের বর্তমান নিট পাওনা:
                      </span>
                      <strong className="text-rose-700 font-mono">
                        {formatCurrencyBn(settlement.fridayNetPayableBefore)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200">
                      <span className="text-slate-900 font-extrabold">
                        {settlement.isDina ? 'দিনায় চলে যাবে (অতিরিক্ত পরিশোধ):' : 'এখন দেওয়ার পর শুক্রবারের বাকি থাকবে:'}
                      </span>
                      <strong
                        data-testid="modal-remaining-friday-due"
                        className={`font-mono font-extrabold ${
                          settlement.isDina
                            ? 'text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded'
                            : settlement.isFullyPaid
                            ? 'text-emerald-700'
                            : 'text-orange-700'
                        }`}
                      >
                        {settlement.isDina
                          ? `দিনা ${formatCurrencyBn(settlement.dinaAmount)}`
                          : settlement.isFullyPaid
                          ? '৳0 — সম্পূর্ণ পরিশোধিত (Paid)!'
                          : formatCurrencyBn(settlement.remainingFridayDue)}
                      </strong>
                    </div>
                    {settlement.isDina && (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold">
                        💡 বিলের চেয়ে ৳{formatBn(settlement.dinaAmount)} বেশি দেওয়া হচ্ছে। তিনি <strong>দিনা</strong>য় চলে গেলেন। পরবর্তীতে তিনি আবার ইট কাটলে বা কাজ করলে এই দিনা স্বয়ংক্রিয়ভাবে তার নতুন বিল থেকে কর্তন করা হবে।
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  {depositMode === 'KHORAKI'
                    ? 'মাঝে মাঝে খোরাকি দেওয়ার পরিমাণ (৳ — বিল থেকে কমে যাবে) *'
                    : 'শুক্রবারের চূড়ান্ত বিল পরিশোধের পরিমাণ (৳) *'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0"
                  data-testid="sardar-deposit-amount-input"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(normalizeNumericInput(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-base font-bold font-mono bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-950 tabular-nums focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[500, 1000, 2000, 3000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(String(amt))}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-800 border border-slate-300 cursor-pointer"
                    >
                      ৳{formatBn(amt)}
                    </button>
                  ))}
                  {depositTarget.record.dueAmount > 0 && (
                    <button
                      type="button"
                      data-testid="pay-full-friday-due-chip"
                      onClick={() => {
                        setDepositMode('FRIDAY_FINAL');
                        setDepositAmount(String(depositTarget.record.dueAmount));
                        setDepositNote('শুক্রবারের চূড়ান্ত সর্দার বিল পরিশোধ (Paid)');
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white cursor-pointer"
                    >
                      শুক্রবারের সম্পূর্ণ বাকি পেট করুন (৳{formatBn(depositTarget.record.dueAmount)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / নোট
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সাপ্তাহিক খোরাকি অথবা শুক্রবারের চূড়ান্ত বিল পরিশোধ..."
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositTarget(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  data-testid="confirm-sardar-deposit-submit-btn"
                  disabled={submittingDeposit}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm cursor-pointer ${
                    depositMode === 'KHORAKI'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submittingDeposit
                    ? 'জমা হচ্ছে...'
                    : depositMode === 'KHORAKI'
                    ? 'খোরাকি কনফার্ম করুন (বিল কমান)'
                    : 'শুক্রবারের বিল পেট করুন (Paid)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
