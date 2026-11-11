import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Flame,
  Layers,
  PackageCheck,
  PlusCircle,
  Search,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  BrickGrade,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  DadonAdvanceRecord,
  MemoDeliveryRecord,
  MillId,
  MillPotRecord,
  PaymentMethod,
  PoraiMistriRecord,
  RubbishRecord,
  SalesMemo,
  WoodFuelRecord,
} from '../types/kiln';
import {
  calculateWoodFuelBill,
  computeWoodFuelSupplierSummary,
  computeWorkerBalanceWithDina,
  computeNewWorkWithDinaAdjustment,
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';
import { getKilnRoundLabelBn } from '../utils/enterpriseOperationsLogic';

export type ShortcutHubSectionTab =
  | 'ALL'
  | 'VAN'
  | 'DELIVERY'
  | 'SARDAR'
  | 'WOOD_FUEL';

const DEFAULT_FALLBACK_WOOD_SUPPLIERS = [
  {
    supplierName: 'জলিল ব্যাপারী',
    supplierPhone: '01715-445566',
    latestRate: 210,
    latestUnit: 'মণ',
    latestWoodType: '১. কাঠ — মিক্সড জ্বালানি কাঠ',
    totalQuantity: 0,
    totalBill: 0,
    totalPaid: 0,
    totalDue: 0,
  },
];

const QUICK_FUEL_TYPES = [
  '১. কাঠ — মিক্সড জ্বালানি কাঠ',
  '২. কয়লা — ইন্দোনেশিয়ান / বড়পুকুরিয়া কয়লা',
  '৩. লাকড়ি — চেরা লাকড়ি / ফাড়াই লাকড়ি',
];

export type SardarShortcutCategory =
  | 'MILL_1'
  | 'MILL_2'
  | 'MILL_3'
  | 'VAN_LOAD'
  | 'UNLOAD'
  | 'PORAI_MISTRI'
  | 'RUBBISH_SARDAR'
  | 'DADON_CUSTOM';

interface SardarOptionItem {
  id: SardarShortcutCategory;
  nameBn: string;
  roleLabelBn: string;
  targetTabId: string;
  targetTabLabelBn: string;
  millId?: MillId;
  badgeColor: string;
}

const SARDAR_OPTIONS: SardarOptionItem[] = [
  {
    id: 'MILL_1',
    nameBn: 'ওহাব সর্দার (মিল সর্দার)',
    roleLabelBn: 'কাঁচা ইট মিল (ওহাব সর্দার)',
    targetTabId: 'mill_hisab',
    targetTabLabelBn: 'মিল হিসাব (ওহাব সর্দার)',
    millId: 'ohab',
    badgeColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'MILL_2',
    nameBn: 'মফিজুল সর্দার (মিল সর্দার)',
    roleLabelBn: 'কাঁচা ইট মিল (মফিজুল সর্দার)',
    targetTabId: 'mill_hisab',
    targetTabLabelBn: 'মিল হিসাব (মফিজুল সর্দার)',
    millId: 'mofijul',
    badgeColor: 'from-orange-500 to-rose-600',
  },
  {
    id: 'MILL_3',
    nameBn: 'শফিকুল সর্দার (মিল সর্দার)',
    roleLabelBn: 'কাঁচা ইট মিল (শফিকুল সর্দার)',
    targetTabId: 'mill_hisab',
    targetTabLabelBn: 'মিল হিসাব (শফিকুল সর্দার)',
    millId: 'sofikul',
    badgeColor: 'from-yellow-500 to-amber-600',
  },
  {
    id: 'VAN_LOAD',
    nameBn: 'সেলিম সর্দার (ভ্যান লোড সর্দার)',
    roleLabelBn: 'চুল্লি ভ্যান লোডিং সর্দার',
    targetTabId: 'van_hisab',
    targetTabLabelBn: 'ভ্যান হিসাব',
    badgeColor: 'from-sky-500 to-blue-600',
  },
  {
    id: 'PORAI_MISTRI',
    nameBn: 'আলতাফ সর্দার (পোড়াই মিস্ত্রি সর্দার)',
    roleLabelBn: 'চুল্লি ফায়ারম্যান ও পোড়াই মিস্ত্রি সর্দার',
    targetTabId: 'porai_mistri',
    targetTabLabelBn: 'পোড়াই মিস্ত্রি হিসাব',
    badgeColor: 'from-rose-500 to-red-600',
  },
  {
    id: 'UNLOAD',
    nameBn: 'নজরুল সর্দার (আনলোড সর্দার)',
    roleLabelBn: 'পাকা ইট আনলোড / নিকাশি সর্দার',
    targetTabId: 'unload_hisab',
    targetTabLabelBn: 'আনলোড হিসাব',
    badgeColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'RUBBISH_SARDAR',
    nameBn: 'অবেদ রাবিশ সর্দার',
    roleLabelBn: 'রাবিশ সর্দার (রাউন্ড ও খোরাকি হিসাব)',
    targetTabId: 'rubbish_hisab',
    targetTabLabelBn: 'রাবিশ সর্দার খাতা',
    badgeColor: 'from-purple-500 to-indigo-600',
  },
];

interface DashboardOperationsShortcutsHubProps {
  todayDate: string;
  brickGrades: BrickGrade[];
  salesMemos: SalesMemo[];
  deliveries: MemoDeliveryRecord[];
  millPots: MillPotRecord[];
  chulliLoads: ChulliLoadRecord[];
  chulliUnloads: ChulliUnloadRecord[];
  poraiMistriRecords: PoraiMistriRecord[];
  rubbishRecords?: RubbishRecord[];
  dadonRecords: DadonAdvanceRecord[];
  woodFuelRecords: WoodFuelRecord[];
  fireStartLineNo: number;
  activeRoundNo: number;
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
  onSubmitDelivery: (payload: {
    memoId?: string;
    memoNo: string;
    gradeId: string;
    quantity: number;
    date: string;
    truckNo?: string;
    driverName?: string;
    vehicleType?: string;
    note?: string;
  }) => Promise<boolean>;
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
  onSaveChulliUnload: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    linesUnloaded?: number;
    bricksPerLine?: number;
    ratePerLine?: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onSavePoraiMistri: (payload: {
    id?: string;
    date: string;
    mistriName: string;
    chamberOrRound: string;
    bricksFired: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onSaveRubbish?: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    roundBill: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onSaveWoodFuel: (payload: {
    id?: string;
    date: string;
    supplierName: string;
    supplierPhone?: string;
    woodType: string;
    vehicleOrChallan?: string;
    quantity: number;
    unit: string;
    ratePerUnit: number;
    paidAmount: number;
    paymentMethod?: PaymentMethod;
    note?: string;
  }) => Promise<void>;
  onPayWoodSupplier: (payload: {
    recordId?: string;
    supplierName: string;
    amount: number;
    date: string;
    paymentMethod?: PaymentMethod;
    note?: string;
  }) => Promise<void>;
  onSaveDadon?: (payload: Partial<DadonAdvanceRecord>) => Promise<void>;
  onNavigateTab: (tabId: string) => void;
  onOpenFridayHatbarSheet?: () => void;
}

export const DashboardOperationsShortcutsHub: React.FC<DashboardOperationsShortcutsHubProps> = ({
  todayDate,
  brickGrades,
  salesMemos,
  deliveries,
  millPots,
  chulliLoads,
  chulliUnloads,
  poraiMistriRecords,
  rubbishRecords = [],
  dadonRecords,
  woodFuelRecords,
  fireStartLineNo,
  activeRoundNo,
  onSaveChulliLoad,
  onSubmitDelivery,
  onSaveMillPot,
  onSaveChulliUnload,
  onSavePoraiMistri,
  onSaveRubbish,
  onSaveWoodFuel,
  onPayWoodSupplier,
  onNavigateTab,
  onOpenFridayHatbarSheet,
}) => {
  // Active Shortcut Section Tab ('ALL' shows all 4 shortcuts, or user can select 1..4)
  const [activeShortcutTab, setActiveShortcutTab] =
    useState<ShortcutHubSectionTab>('ALL');
  // ============================================================================
  // 1. VAN LOADING SHORTCUT STATE (সেলিম সর্দার — ভ্যান লোড ⇄ রিয়েল চুল্লি অটো-সিঙ্ক)
  // ============================================================================
  const [vanBricksInput, setVanBricksInput] = useState<string>('');
  const [vanRateInput, setVanRateInput] = useState<string>('350');
  const [vanPaidInput, setVanPaidInput] = useState<string>('');
  const [vanPakaBricksInput, setVanPakaBricksInput] = useState<string>('');
  const [vanSardarName, setVanSardarName] = useState<string>('সেলিম সর্দার');
  const [vanNoteInput, setVanNoteInput] = useState<string>(
    'মেইন ড্যাশবোর্ড শর্টকাট থেকে চুল্লিতে ইট লোড'
  );
  const [isSavingVan, setIsSavingVan] = useState(false);

  const vanLiveSummary = useMemo(() => {
    let rawTotal = 0;
    let pakaTotal = 0;
    let totalBricks = 0;

    for (const r of chulliLoads) {
      const raw = Number(r.rawBricksLoaded) || 0;
      const paka = Number(r.pakaBricksLoaded) || 0;
      const total =
        r.totalBricksLoaded !== undefined
          ? Number(r.totalBricksLoaded) || 0
          : raw + paka;
      rawTotal += raw;
      pakaTotal += paka;
      totalBricks += total;
    }

    const fullLines = Math.floor(totalBricks / 4000);
    const partialBricks = totalBricks % 4000;
    const roundNo = Math.floor(fullLines / 208) + 1;
    const linesInCurrentRound = fullLines > 208 ? ((fullLines - 1) % 208) + 1 : fullLines;
    return {
      totalBricks,
      rawTotal,
      pakaTotal,
      fullLines,
      partialBricks,
      roundNo,
      roundLabelBn: getKilnRoundLabelBn(roundNo),
      linesInCurrentRound,
    };
  }, [chulliLoads]);

  const currentRawInput = Math.max(0, Math.round(parseNum(vanBricksInput, 0)));
  const currentPakaInput = Math.max(0, Math.round(parseNum(vanPakaBricksInput, 0)));
  const currentBatchTotal = currentRawInput + currentPakaInput;
  const currentRateThousand = Math.max(0, parseNum(vanRateInput, 350));
  const currentBatchBill = Math.round((currentBatchTotal / 1000) * currentRateThousand);
  const previewLinesAdded = Math.floor(currentBatchTotal / 4000);
  const previewRemainderBricks = currentBatchTotal % 4000;

  const handleVanLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = Math.max(0, Math.round(parseNum(vanBricksInput, 0)));
    const paka = Math.max(0, Math.round(parseNum(vanPakaBricksInput, 0)));
    const paid = Math.max(0, parseNum(vanPaidInput, 0));
    const total = raw + paka;
    if (total <= 0 && paid <= 0) return;
    setIsSavingVan(true);
    try {
      await onSaveChulliLoad({
        date: todayDate,
        sardarName: vanSardarName.trim() || 'সেলিম সর্দার',
        rawBricksLoaded: raw,
        pakaBricksLoaded: paka,
        ratePerVan: currentRateThousand,
        paidAmount: paid,
        note:
          vanNoteInput.trim() ||
          `ড্যাশবোর্ড শর্টকাট ভ্যান লোড (${formatBn(total)} পিস [কাঁচা: ${formatBn(raw)}, পাকা: ${formatBn(paka)}])`,
      });
      setVanBricksInput('');
      setVanPaidInput('');
      setVanPakaBricksInput('');
    } finally {
      setIsSavingVan(false);
    }
  };

  const handleInstantVanPreset = async (rawBricks: number, pakaBricks: number = 0) => {
    setVanBricksInput(String(rawBricks));
    setVanPakaBricksInput(pakaBricks > 0 ? String(pakaBricks) : '');
    setIsSavingVan(true);
    const total = rawBricks + pakaBricks;
    try {
      await onSaveChulliLoad({
        date: todayDate,
        sardarName: vanSardarName.trim() || 'সেলিম সর্দার',
        rawBricksLoaded: rawBricks,
        pakaBricksLoaded: pakaBricks,
        ratePerVan: currentRateThousand,
        paidAmount: 0,
        note: `ড্যাশবোর্ড ১-ক্লিক ভ্যান লোড (+${formatBn(total)} ইট = ${formatBn(
          Math.floor(total / 4000)
        )} লাইন)`,
      });
      setVanBricksInput('');
      setVanPakaBricksInput('');
    } finally {
      setIsSavingVan(false);
    }
  };

  // ============================================================================
  // 2. MEMO SEARCH & BRICK DELIVERY SHORTCUT STATE (মেমো সার্চ ও দ্রুত ডেলিভারি)
  // ============================================================================
  const [memoSearchQuery, setMemoSearchQuery] = useState<string>('');
  const [selectedMemoId, setSelectedMemoId] = useState<string>('');
  const [deliveryGradeId, setDeliveryGradeId] = useState<string>(
    brickGrades[0]?.id || 'grade-1'
  );
  const [deliveryQtyInput, setDeliveryQtyInput] = useState<string>('');
  const [deliveryTruckInput, setDeliveryTruckInput] = useState<string>('');
  const [deliveryNoteInput, setDeliveryNoteInput] = useState<string>(
    'ড্যাশবোর্ড শর্টকাট থেকে ইট ডেলিভারি'
  );
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);

  // Compute delivery summary per memo
  const memosWithDeliveryStatus = useMemo(() => {
    const deliveredByMemoNo = new Map<string, number>();
    const deliveredByMemoId = new Map<string, number>();

    for (const d of deliveries) {
      const qty = Math.max(0, Number(d.quantity) || 0);
      if (d.memoId) {
        deliveredByMemoId.set(d.memoId, (deliveredByMemoId.get(d.memoId) || 0) + qty);
      }
      if (d.memoNo) {
        const key = String(d.memoNo).trim().toLowerCase();
        deliveredByMemoNo.set(key, (deliveredByMemoNo.get(key) || 0) + qty);
      }
    }

    return salesMemos.map((m) => {
      const orderedBricks =
        Array.isArray(m.items) && m.items.length > 0
          ? m.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
          : Number(m.quantity) || 0;
      const deliveredFromId = deliveredByMemoId.get(m.id) || 0;
      const deliveredFromNo =
        deliveredByMemoNo.get(String(m.memoNo).trim().toLowerCase()) || 0;
      const deliveredBricks = Math.max(deliveredFromId, deliveredFromNo);
      const remainingBricks = Math.max(0, orderedBricks - deliveredBricks);
      const primaryGradeId =
        m.items?.[0]?.gradeId || m.gradeId || brickGrades[0]?.id || 'grade-1';
      return {
        memo: m,
        orderedBricks,
        deliveredBricks,
        remainingBricks,
        primaryGradeId,
      };
    });
  }, [salesMemos, deliveries, brickGrades]);

  const filteredMemos = useMemo(() => {
    const q = memoSearchQuery.trim().toLowerCase();
    if (!q) {
      return memosWithDeliveryStatus.slice(0, 6);
    }
    return memosWithDeliveryStatus
      .filter(
        (item) =>
          item.memo.memoNo.toLowerCase().includes(q) ||
          item.memo.customerName.toLowerCase().includes(q) ||
          (item.memo.customerPhone || '').toLowerCase().includes(q) ||
          (item.memo.customerAddress || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [memosWithDeliveryStatus, memoSearchQuery]);

  const activeMemoItem = useMemo(() => {
    if (selectedMemoId) {
      const found = memosWithDeliveryStatus.find((x) => x.memo.id === selectedMemoId);
      if (found) return found;
    }
    return filteredMemos[0] || null;
  }, [selectedMemoId, memosWithDeliveryStatus, filteredMemos]);

  const handleSelectMemoForDelivery = (item: (typeof memosWithDeliveryStatus)[number]) => {
    setSelectedMemoId(item.memo.id);
    setDeliveryGradeId(item.primaryGradeId);
    if (item.remainingBricks > 0) {
      setDeliveryQtyInput(String(item.remainingBricks));
    } else if (item.orderedBricks > 0) {
      setDeliveryQtyInput(String(Math.min(2000, item.orderedBricks)));
    }
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(0, Math.round(parseNum(deliveryQtyInput, 0)));
    if (qty <= 0) return;

    const targetMemoNo =
      activeMemoItem?.memo.memoNo || memoSearchQuery.trim() || 'SBL-101';
    const targetMemoId = activeMemoItem?.memo.id;
    const targetGrade =
      deliveryGradeId || activeMemoItem?.primaryGradeId || brickGrades[0]?.id || 'grade-1';

    setIsSavingDelivery(true);
    try {
      const ok = await onSubmitDelivery({
        memoId: targetMemoId,
        memoNo: targetMemoNo,
        gradeId: targetGrade,
        quantity: qty,
        date: todayDate,
        truckNo: deliveryTruckInput.trim() || 'ভাটা ট্রলি/ট্রাক',
        driverName: activeMemoItem?.memo.customerName || 'ক্রেতা ডেলিভারি',
        vehicleType: 'ট্রলি / ট্রাক',
        note:
          deliveryNoteInput.trim() ||
          `ড্যাশবোর্ড শর্টকাট ডেলিভারি — মেমো #${targetMemoNo}`,
      });
      if (ok) {
        setDeliveryTruckInput('');
      }
    } finally {
      setIsSavingDelivery(false);
    }
  };

  // ============================================================================
  // 3. SARDAR DAILY PAYMENT / KHORAKI SHORTCUT STATE (সর্দারদের দৈনিক পেমেন্ট শর্টকাট)
  // ============================================================================
  const [selectedSardarId, setSelectedSardarId] =
    useState<SardarShortcutCategory>('MILL_1');
  const [sardarPayAmount, setSardarPayAmount] = useState<string>('');
  const [sardarPayNote, setSardarPayNote] = useState<string>(
    'দৈনিক সর্দার পেমেন্ট / খোরাকি ও হাটবার বাবদ নগদ প্রদান'
  );
  const [isSavingSardarPay, setIsSavingSardarPay] = useState(false);

  const selectedSardarOption = useMemo(
    () => SARDAR_OPTIONS.find((s) => s.id === selectedSardarId) || SARDAR_OPTIONS[0],
    [selectedSardarId]
  );

  // Live financial summary for each Sardar category from main ledgers
  const sardarLedgerStats = useMemo(() => {
    // Mill 1, 2, 3
    const getMillStats = (millId: MillId) => {
      const list = millPots.filter((p) => p.millId === millId);
      const totalBill = list.reduce((s, p) => s + (Number(p.totalPayable) || 0), 0);
      const totalPaid = list.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
      const totalBricks = list.reduce((s, p) => s + (Number(p.rawBricksCut) || 0), 0);
      const balance = computeWorkerBalanceWithDina(totalBill, totalPaid);
      return {
        ...balance,
        workSummaryBn: `${formatBn(totalBricks)} পিস কাঁচা ইট`,
      };
    };

    const vanBill = chulliLoads.reduce((s, r) => s + (Number(r.totalBill) || 0), 0);
    const vanPaid = chulliLoads.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
    const vanBricks = chulliLoads.reduce(
      (s, r) =>
        s +
        (r.totalBricksLoaded !== undefined
          ? Number(r.totalBricksLoaded) || 0
          : (Number(r.rawBricksLoaded) || 0) + (Number(r.pakaBricksLoaded) || 0)),
      0
    );
    const vanBalance = computeWorkerBalanceWithDina(vanBill, vanPaid);

    const unloadBill = chulliUnloads.reduce((s, r) => s + (Number(r.totalBill) || 0), 0);
    const unloadPaid = chulliUnloads.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
    const unloadBricks = chulliUnloads.reduce(
      (s, r) => s + (Number(r.totalBricksUnloaded) || 0),
      0
    );
    const unloadBalance = computeWorkerBalanceWithDina(unloadBill, unloadPaid);

    const poraiBill = poraiMistriRecords.reduce(
      (s, r) => s + (Number(r.totalBill) || 0),
      0
    );
    const poraiPaid = poraiMistriRecords.reduce(
      (s, r) => s + (Number(r.paidAmount) || 0),
      0
    );
    const poraiBricks = poraiMistriRecords.reduce(
      (s, r) => s + (Number(r.bricksFired) || 0),
      0
    );
    const poraiBalance = computeWorkerBalanceWithDina(poraiBill, poraiPaid);

    const rubbishBill = rubbishRecords.reduce(
      (s, r) => s + (Number(r.roundBill) || 0),
      0
    );
    const rubbishPaid = rubbishRecords.reduce(
      (s, r) => s + (Number(r.paidAmount) || 0),
      0
    );
    const rubbishRounds = rubbishRecords.filter((r) => (Number(r.roundBill) || 0) > 0).length;
    const rubbishBalance = computeWorkerBalanceWithDina(rubbishBill, rubbishPaid);

    const dadonTotalBill = dadonRecords.reduce(
      (s, d) => s + (Number(d.manualWorkBill) || 0) + (Number(d.cashReturnedOrSettled) || 0),
      0
    );
    const dadonTotalAdvance = dadonRecords.reduce((s, d) => s + (Number(d.advanceAmount) || 0), 0);
    const dadonBalance = computeWorkerBalanceWithDina(dadonTotalBill, dadonTotalAdvance);

    return {
      MILL_1: getMillStats('ohab'),
      MILL_2: getMillStats('mofijul'),
      MILL_3: getMillStats('sofikul'),
      VAN_LOAD: {
        ...vanBalance,
        workSummaryBn: `${formatBn(vanBricks)} ইট (${formatBn(
          Math.floor(vanBricks / 4000)
        )} লাইন লোড)`,
      },
      UNLOAD: {
        ...unloadBalance,
        workSummaryBn: `${formatBn(unloadBricks)} ইট আনলোড`,
      },
      PORAI_MISTRI: {
        ...poraiBalance,
        workSummaryBn: `${formatBn(poraiBricks)} ইট পোড়ানো`,
      },
      RUBBISH_SARDAR: {
        ...rubbishBalance,
        workSummaryBn: `${formatBn(rubbishRounds)} রাউন্ড রাবিশ কাজ`,
      },
      DADON_CUSTOM: {
        ...dadonBalance,
        workSummaryBn: `${formatBn(dadonRecords.length)} জন দাদন সর্দার`,
      },
    };
  }, [millPots, chulliLoads, chulliUnloads, poraiMistriRecords, rubbishRecords, dadonRecords]);

  const currentSardarStats = sardarLedgerStats[selectedSardarId];

  const handleSardarPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, Math.round(parseNum(sardarPayAmount, 0)));
    if (amount <= 0) return;

    const noteText =
      sardarPayNote.trim() ||
      `ড্যাশবোর্ড শর্টকাট থেকে ${selectedSardarOption.nameBn}-কে দৈনিক নগদ পেমেন্ট প্রদান`;

    setIsSavingSardarPay(true);
    try {
      if (
        selectedSardarId === 'MILL_1' ||
        selectedSardarId === 'MILL_2' ||
        selectedSardarId === 'MILL_3'
      ) {
        await onSaveMillPot({
          millId: selectedSardarOption.millId || 'ohab',
          potNo: `দৈনিক পেমেন্ট (${todayDate})`,
          date: todayDate,
          rawBricksCut: 0,
          takenToChulli: 0,
          ratePerThousand: 1100,
          paidAmount: amount,
          note: noteText,
        });
      } else if (selectedSardarId === 'VAN_LOAD') {
        await onSaveChulliLoad({
          date: todayDate,
          sardarName: 'সেলিম সর্দার',
          rawBricksLoaded: 0,
          ratePerVan: 350,
          paidAmount: amount,
          note: noteText,
        });
      } else if (selectedSardarId === 'UNLOAD') {
        await onSaveChulliUnload({
          date: todayDate,
          sardarName: 'নজরুল সর্দার',
          chamberOrRound: `রাউন্ড-${formatBn(activeRoundNo || 1)}`,
          linesUnloaded: 0,
          bricksPerLine: 4000,
          ratePerLine: 750,
          ratePerThousand: 187.5,
          paidAmount: amount,
          note: noteText,
        });
      } else if (selectedSardarId === 'PORAI_MISTRI') {
        await onSavePoraiMistri({
          date: todayDate,
          mistriName: 'আলতাফ সর্দার',
          chamberOrRound: `রাউন্ড-${formatBn(activeRoundNo || 1)}`,
          bricksFired: 0,
          ratePerThousand: 220,
          paidAmount: amount,
          note: noteText,
        });
      } else if (selectedSardarId === 'RUBBISH_SARDAR' && onSaveRubbish) {
        await onSaveRubbish({
          date: todayDate,
          sardarName: 'অবেদ রাবিশ সর্দার',
          chamberOrRound: `রাউন্ড-${formatBn(activeRoundNo || 1)}`,
          roundBill: 0,
          paidAmount: amount,
          note: noteText,
        });
      }
      setSardarPayAmount('');
    } finally {
      setIsSavingSardarPay(false);
    }
  };

  // ============================================================================
  // 4. WOOD & FUEL SUPPLIER SHORTCUT STATE (কাঠ ও জ্বালানি ব্যাপারী সিলেক্ট, জমা ও পেমেন্ট)
  // ============================================================================
  const woodSummary = useMemo(
    () => computeWoodFuelSupplierSummary(woodFuelRecords || []),
    [woodFuelRecords]
  );

  const woodSupplierList = useMemo(() => {
    if (woodSummary.suppliers.length > 0) {
      return woodSummary.suppliers;
    }
    return DEFAULT_FALLBACK_WOOD_SUPPLIERS;
  }, [woodSummary.suppliers]);

  const [selectedWoodSupplierName, setSelectedWoodSupplierName] = useState<string>(
    () => woodSupplierList[0]?.supplierName || 'জলিল ব্যাপারী'
  );

  const activeWoodSupplier = useMemo(() => {
    return (
      woodSupplierList.find((s) => s.supplierName === selectedWoodSupplierName) ||
      woodSupplierList[0] ||
      DEFAULT_FALLBACK_WOOD_SUPPLIERS[0]
    );
  }, [woodSupplierList, selectedWoodSupplierName]);

  const [woodType, setWoodType] = useState<string>(
    activeWoodSupplier.latestWoodType || QUICK_FUEL_TYPES[0]
  );
  const [woodQuantity, setWoodQuantity] = useState<string>('');
  const [woodUnit, setWoodUnit] = useState<string>(
    activeWoodSupplier.latestUnit || 'মণ'
  );
  const [woodRatePerUnit, setWoodRatePerUnit] = useState<string>(
    () => String(activeWoodSupplier.latestRate || 210)
  );
  const [woodInstantPaid, setWoodInstantPaid] = useState<string>('');
  const [woodEntrySaving, setWoodEntrySaving] = useState<boolean>(false);

  const [woodPayAmount, setWoodPayAmount] = useState<string>('');
  const [woodPayMethod, setWoodPayMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [woodPaySaving, setWoodPaySaving] = useState<boolean>(false);

  const handleSelectWoodSupplier = (name: string) => {
    setSelectedWoodSupplierName(name);
    const found = woodSupplierList.find((s) => s.supplierName === name);
    if (found) {
      if (found.latestRate > 0) setWoodRatePerUnit(String(found.latestRate));
      if (found.latestUnit) setWoodUnit(found.latestUnit);
      if (found.latestWoodType) setWoodType(found.latestWoodType);
    }
  };

  const effectiveWoodRate = useMemo(() => {
    const fallbackRate = activeWoodSupplier.latestRate || 210;
    const parsed = parseNum(woodRatePerUnit, fallbackRate);
    return parsed > 0 ? parsed : fallbackRate;
  }, [woodRatePerUnit, activeWoodSupplier.latestRate]);

  const woodLiveCalc = useMemo(() => {
    return calculateWoodFuelBill(
      parseNum(woodQuantity, 0),
      effectiveWoodRate,
      parseNum(woodInstantPaid, 0)
    );
  }, [woodQuantity, effectiveWoodRate, woodInstantPaid]);

  const handleQuickWoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(0, parseNum(woodQuantity, 0));
    const rate = effectiveWoodRate;
    const paid = Math.max(0, parseNum(woodInstantPaid, 0));
    if (qty <= 0 && paid <= 0) return;

    setWoodEntrySaving(true);
    try {
      await onSaveWoodFuel({
        date: todayDate,
        supplierName: activeWoodSupplier.supplierName,
        supplierPhone: activeWoodSupplier.supplierPhone || '',
        woodType,
        vehicleOrChallan: 'ড্যাশবোর্ড শর্টকাট এন্ট্রি',
        quantity: qty,
        unit: woodUnit,
        ratePerUnit: rate,
        paidAmount: paid,
        paymentMethod: 'নগদ ক্যাশ',
        note: 'মেইন ড্যাশবোর্ড শর্টকাট থেকে দ্রুত কাঠ/জ্বালানি এন্ট্রি',
      });
      setWoodQuantity('');
      setWoodInstantPaid('');
    } finally {
      setWoodEntrySaving(false);
    }
  };

  const handleQuickWoodPayBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Math.round(parseNum(woodPayAmount, 0)));
    if (amt <= 0) return;

    setWoodPaySaving(true);
    try {
      await onPayWoodSupplier({
        supplierName: activeWoodSupplier.supplierName,
        amount: amt,
        date: todayDate,
        paymentMethod: woodPayMethod,
        note: 'মেইন ড্যাশবোর্ড শর্টকাট থেকে জ্বালানি ব্যাপারী বকেয়া পরিশোধ',
      });
      setWoodPayAmount('');
    } finally {
      setWoodPaySaving(false);
    }
  };

  return (
    <section
      data-testid="dashboard-operations-shortcuts-hub"
      className="w-full min-w-0 max-w-full overflow-hidden rounded-xl sm:rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-2 sm:p-6 text-white space-y-2 sm:space-y-5"
    >
      {/* Top Command Banner — Ultra-Slim 1-Row + 4-Button Strip on Phone */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 sm:gap-3 pb-1.5 sm:pb-3.5 border-b border-slate-800/90">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-md shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9px] sm:text-[11px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="sm:hidden">অটো-সিঙ্ক চালু</span>
                <span className="hidden sm:inline">মেইন ফাংশন ও ৩ডি ম্যাপ অটো-সিঙ্ক চালু</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9px] sm:text-[11px] font-black">
                ⚡ ৪টি প্রধান শর্টকাট হাব
              </span>
            </div>
            <h2 className="text-[11px] sm:text-xl font-black text-white mt-0.5 tracking-tight leading-tight truncate sm:whitespace-normal">
              মেইন ড্যাশবোর্ড স্পেশাল অপারেশন শর্টকাট — ভ্যান লোডিং, মেমো ডেলিভারি, সর্দার পেমেন্ট ও কাঠ/জ্বালানি হিসাব
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 hidden sm:block">
              এখানে সংখ্যা বসিয়ে সাবমিট করলেই স্বয়ংক্রিয়ভাবে তাদের মূল খাতা (ভ্যান হিসাব, ৩ডি চিমনি ম্যাপ, ইট ডেলিভারি, সর্দার খাতা এবং জ্বালানি ও কাঠ খাতা) ও ক্যাশ বুকে হিসাব আপডেট হয়ে যাবে।
            </p>
          </div>
        </div>

        {/* Quick Direct Navigation Pills — Single 4-Column Row on Phone */}
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('chulli_chamber')}
            className="sbl-btn-interactive justify-center px-1 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-[10px] sm:text-xs font-black inline-flex items-center gap-1 shadow-xs cursor-pointer truncate"
          >
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="sm:hidden truncate">৩ডি ম্যাপ</span>
            <span className="hidden sm:inline truncate">🧊 ৩ডি চুল্লি ({vanLiveSummary.roundLabelBn})</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('delivery_hisab')}
            className="sbl-btn-interactive justify-center px-1 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-300 text-[10px] sm:text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer truncate"
          >
            <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="sm:hidden truncate">ডেলিভারি</span>
            <span className="hidden sm:inline">ডেলিভারি খাতা</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('mill_hisab')}
            className="sbl-btn-interactive justify-center px-1 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-[10px] sm:text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer truncate"
          >
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="sm:hidden truncate">সর্দার খাতা</span>
            <span className="hidden sm:inline">সর্দার খাতা</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('jalani_hisab')}
            className="sbl-btn-interactive justify-center px-1 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-full bg-slate-800 hover:bg-slate-700 border border-orange-500/60 text-orange-300 text-[10px] sm:text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer truncate"
          >
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 shrink-0" />
            <span className="sm:hidden truncate">জ্বালানি</span>
            <span className="hidden sm:inline">🪵 জ্বালানি খাতা</span>
          </button>
        </div>
      </div>

      {/* Phone-Cover 4-Operation At-A-Glance Mini Summary Matrix (ফোনের এক পর্দায় ৪টি অপারেশনের লাইভ সারাংশ ও ১-ট্যাপ সুইচ) */}
      <div
        data-testid="phone-four-ops-overview-grid"
        className="grid grid-cols-4 gap-1 sm:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveShortcutTab(activeShortcutTab === 'VAN' ? 'ALL' : 'VAN')}
          className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
            activeShortcutTab === 'VAN'
              ? 'bg-sky-950 border-sky-400 ring-1 ring-sky-300'
              : 'bg-slate-900/95 border-sky-500/40'
          }`}
        >
          <div className="text-[9px] font-black text-sky-300 truncate">১. 🚜 ভ্যান লোড</div>
          <div className="text-[10px] font-black text-white font-mono truncate">
            {formatBn(vanLiveSummary.totalBricks)} পিস
          </div>
          <div className="text-[8px] font-bold text-emerald-400 truncate">
            {formatBn(vanLiveSummary.fullLines)}টি লাইন
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveShortcutTab(activeShortcutTab === 'DELIVERY' ? 'ALL' : 'DELIVERY')}
          className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
            activeShortcutTab === 'DELIVERY'
              ? 'bg-emerald-950 border-emerald-400 ring-1 ring-emerald-300'
              : 'bg-slate-900/95 border-emerald-500/40'
          }`}
        >
          <div className="text-[9px] font-black text-emerald-300 truncate">২. 🚚 ডেলিভারি</div>
          <div className="text-[10px] font-black text-white font-mono truncate">
            {formatBn(salesMemos.length)}টি মেমো
          </div>
          <div className="text-[8px] font-bold text-amber-300 truncate">
            {formatBn(deliveries.length)}টি চালান
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveShortcutTab(activeShortcutTab === 'SARDAR' ? 'ALL' : 'SARDAR')}
          className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
            activeShortcutTab === 'SARDAR'
              ? 'bg-amber-950 border-amber-400 ring-1 ring-amber-300'
              : 'bg-slate-900/95 border-amber-500/40'
          }`}
        >
          <div className="text-[9px] font-black text-amber-300 truncate">৩. 💸 সর্দার পে</div>
          <div className="text-[10px] font-black text-white font-mono truncate">
            {selectedSardarOption.nameBn.split(' ')[0]}
          </div>
          <div className="text-[8px] font-bold text-emerald-300 truncate">
            জমা: {formatCurrencyBn(currentSardarStats.totalPaid)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveShortcutTab(activeShortcutTab === 'WOOD_FUEL' ? 'ALL' : 'WOOD_FUEL')}
          className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
            activeShortcutTab === 'WOOD_FUEL'
              ? 'bg-orange-950 border-orange-400 ring-1 ring-orange-300'
              : 'bg-slate-900/95 border-orange-500/40'
          }`}
        >
          <div className="text-[9px] font-black text-orange-300 truncate">৪. 🪵 জ্বালানি</div>
          <div className="text-[10px] font-black text-white font-mono truncate">
            {formatBn(activeWoodSupplier.totalQuantity)} {activeWoodSupplier.latestUnit || 'মণ'}
          </div>
          <div className="text-[8px] font-bold text-rose-300 truncate">
            বাকি: {formatCurrencyBn(activeWoodSupplier.totalDue)}
          </div>
        </button>
      </div>

      {/* Interactive Shortcut Selector Option Bar — Single 5-Column Row on Phone */}
      <div
        data-testid="shortcut-hub-section-selector"
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-1 sm:gap-2 bg-slate-900/95 p-1 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-700/90"
      >
        <div className="grid grid-cols-5 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 w-full xl:w-auto">
          {(
            [
              {
                id: 'ALL' as const,
                labelBn: '⚡ সব শর্টকাট একসাথে (৪টি)',
                shortBn: '⚡ সব (৪)',
                activeClass:
                  'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-slate-950 shadow-sm ring-1 ring-white/40',
              },
              {
                id: 'VAN' as const,
                labelBn: '১. 🚜 ভ্যান লোডিং',
                shortBn: '১. 🚜 ভ্যান',
                activeClass:
                  'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 shadow-sm ring-1 ring-white/40',
              },
              {
                id: 'DELIVERY' as const,
                labelBn: '২. 🚚 মেমো ডেলিভারি',
                shortBn: '২. 🚚 মেমো',
                activeClass:
                  'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 shadow-sm ring-1 ring-white/40',
              },
              {
                id: 'SARDAR' as const,
                labelBn: '৩. 💸 সর্দার পেমেন্ট',
                shortBn: '৩. 💸 সর্দার',
                activeClass:
                  'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-sm ring-1 ring-white/40',
              },
              {
                id: 'WOOD_FUEL' as const,
                labelBn: '৪. 🪵 কাঠ ও জ্বালানি',
                shortBn: '৪. 🪵 কাঠ',
                activeClass:
                  'bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white shadow-sm ring-1 ring-amber-300/60',
              },
            ] as const
          ).map((tab) => {
            const isSelected = activeShortcutTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`shortcut-select-tab-${tab.id}`}
                onClick={() => setActiveShortcutTab(tab.id)}
                className={`sbl-btn-interactive min-h-[28px] sm:min-h-[40px] px-1 sm:px-3 py-0.5 sm:py-2 rounded-md sm:rounded-xl text-[9px] sm:text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center truncate ${
                  isSelected
                    ? tab.activeClass
                    : 'bg-slate-950/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80'
                }`}
              >
                <span className="sm:hidden">{tab.shortBn}</span>
                <span className="hidden sm:inline">{tab.labelBn}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-bold text-amber-300 px-2 hidden xl:inline">
          💡 যেকোনো অপশন সিলেক্ট করে ১-ক্লিকে দ্রুত দৈনিক এন্ট্রি দিন
        </span>
      </div>

      {/* Unified Operational Shortcut Grid for All 4 Cards (Strict Vertical 1-Column View on Mobile, 3-Column + Full-Span on Desktop) */}
      <div
        data-testid="operational-shortcuts-grid"
        className={`grid grid-cols-1 ${
          activeShortcutTab === 'ALL' ? 'xl:grid-cols-3' : 'xl:grid-cols-1 max-w-3xl mx-auto'
        } gap-2.5 sm:gap-5 w-full min-w-0 max-w-full`}
      >
        {/* ====================================================================
            CARD 1: VAN LOADING SHORTCUT (সেলিম সর্দার — ভ্যান লোড ⇄ ৩ডি ম্যাপ)
           ==================================================================== */}
        {(activeShortcutTab === 'ALL' || activeShortcutTab === 'VAN') && (
          <div
            data-testid="shortcut-card-van-loading"
            className="w-full min-w-0 max-w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-900/95 border-2 border-sky-500/50 p-2.5 sm:p-5 flex flex-col justify-between space-y-2 sm:space-y-4 shadow-lg"
          >
          <div className="space-y-2 sm:space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 sm:pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shrink-0">
                  <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-sky-300 block truncate">
                    ১. ভ্যান লোডিং শর্টকাট (৩ডি ম্যাপ সিঙ্ক)
                  </span>
                  <h3 className="text-xs sm:text-base font-black text-white truncate">
                    🚜 সেলিম সর্দার — চুল্লিতে ইট লোড
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('van_hisab')}
                className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-500/50 text-[10px] sm:text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>ভ্যান হিসাব</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {/* Live 3D Chimney Sync Status Box — Compact on Phone */}
            <div className="rounded-xl bg-slate-950/90 border border-sky-500/30 p-2 sm:p-3 space-y-1 text-[11px] sm:text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold">মোট লোড (চুল্লিতে):</span>
                <strong
                  data-testid="shortcut-van-total-bricks"
                  className="text-sky-300 font-black font-mono text-xs sm:text-sm"
                >
                  {formatBn(vanLiveSummary.totalBricks)} পিস ইট
                </strong>
              </div>
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
                <span>মাঠের কাঁচা: <strong className="text-amber-300 font-mono">{formatBn(vanLiveSummary.rawTotal)}</strong></span>
                <span>চেম্বারে পাকা: <strong className="text-cyan-300 font-mono">{formatBn(vanLiveSummary.pakaTotal)}</strong></span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5 border-t border-slate-800">
                <span className="text-slate-300 font-bold">৩ডি চিমনি লাইন:</span>
                <strong
                  data-testid="shortcut-van-full-lines"
                  className="text-emerald-400 font-black font-mono shrink-0"
                >
                  ✅ {formatBn(vanLiveSummary.fullLines)}টি পূর্ণ লাইন ({vanLiveSummary.roundLabelBn})
                </strong>
              </div>
              {vanLiveSummary.partialBricks > 0 && (
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-amber-300 font-bold pt-0.5 border-t border-slate-800">
                  <span>পরের লাইনে জমা আছে:</span>
                  <span>{formatBn(vanLiveSummary.partialBricks)} / ৪,০০০ ইট</span>
                </div>
              )}
              <div className="text-[10px] sm:text-[11px] text-slate-400 pt-0.5 hidden sm:block">
                🔥 শুরুর লাইন #{formatBn(fireStartLineNo)} থেকে ৩ডি নকশায় অটোমেটিক লাইন যোগ হচ্ছে।
              </div>
            </div>

            {/* 1-Click Fast Van Load Presets — Single 4-Column Row on Phone */}
            <div className="space-y-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-300 block">
                ⚡ ১-ক্লিকে সরাসরি চুল্লিতে লোড করুন (৪,০০০ ইট = ১ লাইন):
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-2 gap-1 sm:gap-2">
                <button
                  type="button"
                  disabled={isSavingVan}
                  data-testid="shortcut-van-preset-4000"
                  onClick={() => handleInstantVanPreset(4000, 0)}
                  className="sbl-btn-interactive px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-black text-[10px] sm:text-xs cursor-pointer shadow-xs truncate"
                >
                  <span className="sm:hidden">+৪,০০০ (১লা)</span>
                  <span className="hidden sm:inline">+৪,০০০ কাঁচা ইট (১ লাইন)</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingVan}
                  data-testid="shortcut-van-preset-8000"
                  onClick={() => handleInstantVanPreset(8000, 0)}
                  className="sbl-btn-interactive px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-sky-900/90 hover:bg-sky-800 text-sky-200 border border-sky-400/60 font-extrabold text-[10px] sm:text-xs cursor-pointer truncate"
                >
                  <span className="sm:hidden">+৮,০০০ (২লা)</span>
                  <span className="hidden sm:inline">+৮,০০০ কাঁচা ইট (২ লাইন)</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingVan}
                  data-testid="shortcut-van-preset-3500-500"
                  onClick={() => handleInstantVanPreset(3500, 500)}
                  className="sbl-btn-interactive px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-sky-950 hover:bg-sky-900 text-amber-300 border border-amber-400/50 font-extrabold text-[10px] sm:text-xs cursor-pointer truncate"
                >
                  <span className="sm:hidden">৩.৫+০.৫K</span>
                  <span className="hidden sm:inline">৩,৫০০ কাঁচা + ৫০০ পাকা (১ লাইন)</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingVan}
                  data-testid="shortcut-van-preset-20000"
                  onClick={() => handleInstantVanPreset(20000, 0)}
                  className="sbl-btn-interactive px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-sky-950 hover:bg-sky-900 text-emerald-300 border border-emerald-400/40 font-extrabold text-[10px] sm:text-xs cursor-pointer truncate"
                >
                  <span className="sm:hidden">+২০,০০০ (৫লা)</span>
                  <span className="hidden sm:inline">+২০,০০০ ইট (৫ লাইন)</span>
                </button>
              </div>
            </div>

            {/* Custom Brick Quantity & Cash Form */}
            <form noValidate onSubmit={handleVanLoadSubmit} className="space-y-1.5 sm:space-y-2.5 pt-0.5">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-extrabold text-slate-300 block mb-0.5 sm:mb-1 truncate">
                    কাঁচা ইট (মাঠ থেকে পিস) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="shortcut-van-load-bricks-input"
                    value={vanBricksInput}
                    onChange={(e) => setVanBricksInput(normalizeNumericInput(e.target.value))}
                    className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono text-sm font-black focus:border-amber-400 focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] sm:text-[11px] font-extrabold text-cyan-300 block mb-0.5 sm:mb-1 flex items-center justify-between gap-1">
                    <span className="truncate">চুল্লিতে পাকা ইট (পিস)</span>
                    <span className="text-[8px] sm:text-[9px] px-1 py-0.2 bg-cyan-950 border border-cyan-500/40 text-cyan-200 rounded shrink-0">সহযোগী</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="shortcut-van-paka-bricks-input"
                    value={vanPakaBricksInput}
                    onChange={(e) => setVanPakaBricksInput(normalizeNumericInput(e.target.value))}
                    className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-slate-950 border border-cyan-800/60 text-cyan-300 font-mono text-sm font-black focus:border-cyan-400 focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5 sm:mb-1 truncate">
                    ভ্যান সর্দার
                  </label>
                  <input
                    type="text"
                    value={vanSardarName}
                    onChange={(e) => setVanSardarName(e.target.value)}
                    className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5 sm:mb-1 truncate">
                    ১০০০ রেট (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vanRateInput}
                    onChange={(e) => setVanRateInput(normalizeNumericInput(e.target.value))}
                    className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-400 block mb-0.5 sm:mb-1 truncate">
                    নগদ জমা (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="shortcut-van-load-paid-input"
                    value={vanPaidInput}
                    onChange={(e) => setVanPaidInput(normalizeNumericInput(e.target.value))}
                    className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs font-bold"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Live Transparent Transparency & Accounting Box */}
              <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-0.5 sm:space-y-1 text-[10px] sm:text-[11px]">
                <div className="flex items-center justify-between text-white font-bold">
                  <span className="text-slate-300">মোট লোড (৩ডি লাইন):</span>
                  <strong className="font-mono text-emerald-300">
                    {formatBn(currentBatchTotal)} ইট ({formatBn(previewLinesAdded)}টি লাইন{previewRemainderBricks > 0 ? ` + ${formatBn(previewRemainderBricks)} ইট` : ''})
                  </strong>
                </div>
                <div className="flex items-center justify-between text-sky-200">
                  <span>সেলিম সর্দারের বিল (মোট ইটে):</span>
                  <strong className="font-mono text-amber-300">
                    ৳{formatBn(currentBatchBill)}
                  </strong>
                </div>
                {sardarLedgerStats.VAN_LOAD.isDina && sardarLedgerStats.VAN_LOAD.dinaAmount > 0 && (() => {
                  const vanAdjustment = computeNewWorkWithDinaAdjustment(
                    currentBatchBill,
                    sardarLedgerStats.VAN_LOAD.dinaAmount,
                    parseNum(vanPaidInput, 0)
                  );
                  return (
                    <>
                      <div className="flex items-center justify-between text-amber-300 font-bold bg-amber-950/40 px-2 py-0.5 rounded">
                        <span>পূর্বের দিনা কর্তন:</span>
                        <strong className="font-mono">−৳{formatBn(vanAdjustment.dinaDeductedFromNewWork)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-sky-200 font-semibold">
                        <span>দিনা বাদে নিট প্রাপ্য:</span>
                        <strong className="font-mono text-emerald-300">৳{formatBn(vanAdjustment.netPayableAfterDina)}</strong>
                      </div>
                      {vanAdjustment.finalNewDina > 0 && (
                        <div className="flex items-center justify-between text-amber-400 font-bold">
                          <span>অবশিষ্ট দিনা থাকবে:</span>
                          <strong className="font-mono">৳{formatBn(vanAdjustment.finalNewDina)}</strong>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="flex items-center justify-between text-slate-400 pt-0.5 border-t border-slate-800 text-[9px] sm:text-[10px]">
                  <span>মাঠে কাঁচা ইট কমবে: <strong className="text-amber-200 font-mono">{formatBn(currentRawInput)}</strong></span>
                  <span>ব্যবহৃত পাকা ইট: <strong className="text-cyan-200 font-mono">{formatBn(currentPakaInput)}</strong></span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingVan}
                data-testid="shortcut-van-load-submit-btn"
                className="sbl-btn-interactive w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400 hover:from-sky-300 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSavingVan
                    ? 'লোড সংরক্ষণ হচ্ছে...'
                    : 'ভ্যান লোড ও ৩ডি ম্যাপে সাবমিট করুন'}
                </span>
              </button>
            </form>
          </div>
        </div>
          )}

        {/* ====================================================================
            CARD 2: MEMO SEARCH & BRICK DELIVERY SHORTCUT (মেমো সার্চ ও ইট ডেলিভারি)
           ==================================================================== */}
        {(activeShortcutTab === 'ALL' || activeShortcutTab === 'DELIVERY') && (
        <div
          data-testid="shortcut-card-memo-delivery"
          className="w-full min-w-0 max-w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-900/95 border-2 border-emerald-500/50 p-2.5 sm:p-5 flex flex-col justify-between space-y-2.5 sm:space-y-4 shadow-lg"
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 sm:pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
                  <PackageCheck className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-300 block truncate">
                    ২. ইট ডেলিভারি ও মেমো সার্চ শর্টকাট
                  </span>
                  <h3 className="text-xs sm:text-base font-black text-white truncate">
                    🚚 মেমো খুঁজুন ও ইট ডেলিভারি দিন
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('delivery_hisab')}
                className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 text-[10px] sm:text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>ডেলিভারি খাতা</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {/* Search Input by Memo Number / Customer Name / Phone */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  data-testid="shortcut-delivery-memo-search"
                  value={memoSearchQuery}
                  onChange={(e) => setMemoSearchQuery(e.target.value)}
                  placeholder="মেমো নাম্বার (#101), ক্রেতার নাম বা মোবাইল লিখে সার্চ করুন..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/50 text-white text-xs font-bold placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Quick Memo Selector Pills */}
              {filteredMemos.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto pr-1">
                  {filteredMemos.map((item) => {
                    const isSelected = activeMemoItem?.memo.id === item.memo.id;
                    return (
                      <button
                        key={item.memo.id}
                        type="button"
                        data-testid={`shortcut-memo-pill-${item.memo.memoNo}`}
                        onClick={() => handleSelectMemoForDelivery(item)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-400 text-slate-950 shadow-sm ring-2 ring-amber-300'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="font-mono">#{item.memo.memoNo}</span>
                        <span>· {item.memo.customerName}</span>
                        {item.remainingBricks > 0 && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              isSelected
                                ? 'bg-slate-950 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            বাকি {formatBn(item.remainingBricks)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-amber-300 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  কোনো মেমো পাওয়া যায়নি — আপনি সরাসরি মেমো নং লিখে ডেলিভারি এন্ট্রি দিতে পারবেন।
                </div>
              )}
            </div>

            {/* Selected Memo Live Status Box */}
            {activeMemoItem ? (
              <div
                data-testid="shortcut-selected-memo-info"
                className="rounded-xl bg-slate-950/90 border border-emerald-500/30 p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-300 font-mono">
                    মেমো #{activeMemoItem.memo.memoNo} · {activeMemoItem.memo.customerName}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {activeMemoItem.memo.customerPhone || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-center">
                  <div className="bg-slate-900 rounded-lg p-1.5">
                    <span className="text-[10px] text-slate-400 block">মোট অর্ডার</span>
                    <strong className="text-white font-mono text-xs">
                      {formatBn(activeMemoItem.orderedBricks)} পিস
                    </strong>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-1.5">
                    <span className="text-[10px] text-slate-400 block">ডেলিভারি হয়েছে</span>
                    <strong className="text-emerald-400 font-mono text-xs">
                      {formatBn(activeMemoItem.deliveredBricks)} পিস
                    </strong>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-1.5">
                    <span className="text-[10px] text-slate-400 block">ডেলিভারি বাকি</span>
                    <strong className="text-amber-300 font-mono text-xs">
                      {formatBn(activeMemoItem.remainingBricks)} পিস
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 text-xs text-slate-300">
                মেমো সিলেক্ট করুন অথবা সার্চ বক্সে মেমো নাম্বার লিখুন।
              </div>
            )}

            {/* Quick Delivery Entry Form */}
            <form noValidate onSubmit={handleDeliverySubmit} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-300 block mb-1">
                    কতগুলো ইট নিয়ে গেল (পিস) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="shortcut-delivery-qty-input"
                    value={deliveryQtyInput}
                    onChange={(e) => setDeliveryQtyInput(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-black focus:border-emerald-400 focus:outline-none"
                    placeholder="যেমন: 2000"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-slate-300 block mb-1">
                    ইটের গ্রেড / শ্রেণি
                  </label>
                  <select
                    data-testid="shortcut-delivery-grade-select"
                    value={deliveryGradeId}
                    onChange={(e) => setDeliveryGradeId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-extrabold focus:border-emerald-400 focus:outline-none"
                  >
                    {brickGrades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Quantity Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {activeMemoItem && activeMemoItem.remainingBricks > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeliveryQtyInput(String(activeMemoItem.remainingBricks))
                    }
                    className="px-2.5 py-1 rounded-full bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 text-[11px] font-black cursor-pointer"
                  >
                    সম্পূর্ণ বাকি ({formatBn(activeMemoItem.remainingBricks)})
                  </button>
                )}
                {[500, 1000, 2000, 3000, 5000].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setDeliveryQtyInput(String(q))}
                    className="px-2.5 py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold font-mono cursor-pointer"
                  >
                    {formatBn(q)} পিস
                  </button>
                ))}
              </div>

              <div>
                <input
                  type="text"
                  data-testid="shortcut-delivery-truck-input"
                  value={deliveryTruckInput}
                  onChange={(e) => setDeliveryTruckInput(e.target.value)}
                  placeholder="গাড়ি / ট্রলি নং বা ড্রাইভারের নাম (ঐচ্ছিক)"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingDelivery}
                data-testid="shortcut-delivery-submit-btn"
                className="sbl-btn-interactive w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>
                  {isSavingDelivery
                    ? 'ডেলিভারি সেভ হচ্ছে...'
                    : 'ইট ডেলিভারি সাবমিট করুন (মেইন খাতায় আপডেট)'}
                </span>
              </button>
            </form>
          </div>
        </div>
        )}

        {/* ====================================================================
            CARD 3: SARDAR DAILY PAYMENT SHORTCUT (সর্দারদের দৈনিক পেমেন্ট শর্টকাট)
           ==================================================================== */}
        {(activeShortcutTab === 'ALL' || activeShortcutTab === 'SARDAR') && (
        <div
          data-testid="shortcut-card-sardar-payment"
          className="w-full min-w-0 max-w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-900/95 border-2 border-amber-500/50 p-2.5 sm:p-5 flex flex-col justify-between space-y-2.5 sm:space-y-4 shadow-lg"
        >
          <div className="space-y-2.5 sm:space-y-3 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800 pb-1.5 sm:pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                  <Banknote className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300 block truncate">
                    ৩. সর্দারদের দৈনিক পেমেন্ট শর্টকাট
                  </span>
                  <h3 className="text-xs sm:text-base font-black text-white truncate">
                    💸 সর্দার সিলেক্ট ও টাকা প্রদান
                  </h3>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {onOpenFridayHatbarSheet && (
                  <button
                    type="button"
                    data-testid="shortcut-open-friday-hatbar-sheet-btn"
                    onClick={onOpenFridayHatbarSheet}
                    className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 text-[10px] sm:text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span className="sm:hidden">🖨️ হাটবার শিট</span>
                    <span className="hidden sm:inline">🖨️ শুক্রবারের হাটবার শিট</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTab(selectedSardarOption.targetTabId)}
                  className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-[10px] sm:text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>{selectedSardarOption.targetTabLabelBn}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Sardar Selection Pill Buttons */}
            <div className="space-y-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-300 block">
                কোন সর্দারকে টাকা দিচ্ছেন সিলেক্ট করুন:
              </span>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                {SARDAR_OPTIONS.map((sardar) => {
                  const isSelected = selectedSardarId === sardar.id;
                  return (
                    <button
                      key={sardar.id}
                      type="button"
                      data-testid={`shortcut-sardar-chip-${sardar.id}`}
                      onClick={() => setSelectedSardarId(sardar.id)}
                      className={`px-2 py-1 sm:px-2.5 sm:py-2 rounded-lg sm:rounded-xl text-left text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer border ${
                        isSelected
                          ? `bg-gradient-to-r ${sardar.badgeColor} text-white border-amber-200 shadow-md ring-1 sm:ring-2 ring-amber-300/80`
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                      }`}
                    >
                      <div className="truncate font-black">{sardar.nameBn}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-amber-100' : 'text-slate-400'
                        }`}
                      >
                        {sardarLedgerStats[sardar.id].isDina ? (
                          <span className="text-rose-300 font-bold">
                            দিনা: ৳{formatBn(sardarLedgerStats[sardar.id].dinaAmount)}
                          </span>
                        ) : (
                          <span>জমা: {formatCurrencyBn(sardarLedgerStats[sardar.id].totalPaid)}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Sardar Live Balance Box */}
            <div
              data-testid="shortcut-sardar-live-balance"
              className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                currentSardarStats.isDina
                  ? 'bg-rose-950/40 border-rose-500/50'
                  : 'bg-slate-950/90 border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-black ${currentSardarStats.isDina ? 'text-rose-300' : 'text-amber-300'}`}>
                  {selectedSardarOption.nameBn}
                </span>
                <span className="text-[11px] text-slate-300 font-bold">
                  {currentSardarStats.workSummaryBn}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-center">
                <div className="bg-slate-900 rounded-lg p-1.5">
                  <span className="text-[10px] text-slate-400 block">মোট বিল</span>
                  <strong className="text-white font-mono text-xs">
                    {formatCurrencyBn(currentSardarStats.totalBill)}
                  </strong>
                </div>
                <div className="bg-slate-900 rounded-lg p-1.5">
                  <span className="text-[10px] text-slate-400 block">মোট দেওয়া হয়েছে</span>
                  <strong
                    data-testid="shortcut-sardar-total-paid"
                    className="text-emerald-400 font-mono text-xs"
                  >
                    {formatCurrencyBn(currentSardarStats.totalPaid)}
                  </strong>
                </div>
                <div
                  className={`rounded-lg p-1.5 ${
                    currentSardarStats.isDina
                      ? 'bg-rose-950/80 border border-rose-500/60'
                      : 'bg-slate-900'
                  }`}
                >
                  <span
                    className={`text-[10px] block font-bold ${
                      currentSardarStats.isDina ? 'text-rose-300' : 'text-slate-400'
                    }`}
                  >
                    {currentSardarStats.isDina ? 'দিনায় আছে (দেনা)' : 'পাওনা বাকি'}
                  </span>
                  <strong
                    className={`font-mono text-xs ${
                      currentSardarStats.isDina
                        ? 'text-rose-300 font-black'
                        : 'text-amber-300'
                    }`}
                  >
                    {formatCurrencyBn(
                      currentSardarStats.isDina
                        ? currentSardarStats.dinaAmount
                        : currentSardarStats.balanceDue
                    )}
                  </strong>
                </div>
              </div>
              {currentSardarStats.isDina && (
                <div className="p-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-[11px] text-rose-200 flex items-center justify-between">
                  <span>⚠️ দিনা সতর্কতা:</span>
                  <strong className="font-mono text-rose-300">
                    ৳{formatBn(currentSardarStats.dinaAmount)} বেশি নিয়েছে (পরবর্তী কাজে অটো কর্তন হবে)
                  </strong>
                </div>
              )}
            </div>

            {/* Payment Amount & Note Form */}
            <form noValidate onSubmit={handleSardarPaymentSubmit} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-extrabold text-slate-300 block mb-1">
                  আজ কত টাকা দিচ্ছি (৳) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid="shortcut-sardar-pay-amount-input"
                  value={sardarPayAmount}
                  onChange={(e) => setSardarPayAmount(normalizeNumericInput(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono text-sm font-black focus:border-amber-400 focus:outline-none"
                  placeholder="যেমন: 2000"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[500, 1000, 2000, 3000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSardarPayAmount(String(amt))}
                    className="px-2.5 py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-700 text-[11px] font-bold font-mono cursor-pointer"
                  >
                    ৳{formatBn(amt)}
                  </button>
                ))}
              </div>

              {/* Live Payment Projection with Dina Calculation */}
              {(() => {
                const payAmt = Math.max(0, Math.round(parseNum(sardarPayAmount, 0)));
                if (payAmt <= 0) return null;
                if (currentSardarStats.isDina) {
                  const newDina = currentSardarStats.dinaAmount + payAmt;
                  return (
                    <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/50 text-[11px] text-rose-200 space-y-0.5">
                      <div className="flex justify-between">
                        <span>পূর্বের দিনা ছিল:</span>
                        <strong className="font-mono">৳{formatBn(currentSardarStats.dinaAmount)}</strong>
                      </div>
                      <div className="flex justify-between font-bold text-rose-300">
                        <span>নতুন নগদ দেওয়ায় দিনা বেড়ে হবে:</span>
                        <strong className="font-mono text-xs">৳{formatBn(newDina)} (দিনা)</strong>
                      </div>
                    </div>
                  );
                }
                if (payAmt > currentSardarStats.balanceDue) {
                  const willEnterDina = payAmt - currentSardarStats.balanceDue;
                  return (
                    <div className="p-2 rounded-xl bg-amber-950/70 border border-amber-500/50 text-[11px] text-amber-200 space-y-0.5">
                      <div className="flex justify-between">
                        <span>বকেয়া পাওনা ছিল:</span>
                        <strong className="font-mono">৳{formatBn(currentSardarStats.balanceDue)}</strong>
                      </div>
                      <div className="flex justify-between text-rose-300 font-bold">
                        <span>বকেয়ার চেয়ে বেশি দেওয়ায় দিনায় চলে যাবে:</span>
                        <strong className="font-mono text-xs">৳{formatBn(willEnterDina)} (দিনা)</strong>
                      </div>
                    </div>
                  );
                }
                const remainingDue = currentSardarStats.balanceDue - payAmt;
                return (
                  <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-200 flex justify-between items-center">
                    <span>এখন দেওয়ার পর বকেয়া বাকি থাকবে:</span>
                    <strong className="font-mono text-emerald-300">
                      {remainingDue === 0 ? '৳০ (সম্পূর্ণ পরিশোধিত)' : `৳${formatBn(remainingDue)}`}
                    </strong>
                  </div>
                );
              })()}

              <div>
                <input
                  type="text"
                  data-testid="shortcut-sardar-pay-note-input"
                  value={sardarPayNote}
                  onChange={(e) => setSardarPayNote(e.target.value)}
                  placeholder="খোরাকি / হাটবার / দৈনিক পেমেন্ট নোট"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingSardarPay}
                data-testid="shortcut-sardar-pay-submit-btn"
                className="sbl-btn-interactive w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Banknote className="w-4 h-4" />
                <span>
                  {isSavingSardarPay
                    ? 'পেমেন্ট সেভ হচ্ছে...'
                    : `${selectedSardarOption.nameBn.split(' ')[0]}-এর খাতায় পেমেন্ট সেভ করুন`}
                </span>
              </button>
            </form>
          </div>
        </div>
        )}

        {/* ====================================================================
            CARD 4: WOOD & FUEL SUPPLIER SHORTCUT (৪. কাঠ ও জ্বালানি হিসাব — ব্যাপারী সিলেক্ট, দ্রুত কাঠ/কয়লা/লাকড়ি এন্ট্রি ও ব্যালেন্স পেমেন্ট)
           ==================================================================== */}
        {(activeShortcutTab === 'ALL' || activeShortcutTab === 'WOOD_FUEL') && (
          <div
            data-testid="dashboard-quick-wood-fuel-card"
            className={`w-full min-w-0 max-w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-900/95 border-2 border-orange-500/60 p-2.5 sm:p-5 space-y-2.5 sm:space-y-4 shadow-xl ${
              activeShortcutTab === 'ALL' ? 'xl:col-span-3' : 'col-span-1'
            }`}
          >
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 sm:gap-3 border-b border-slate-800 pb-2 sm:pb-3.5">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-orange-300 block truncate">
                  ৪. কাঠ ও জ্বালানি শর্টকাট (জ্বালানি ও কাঠ হিসাবের সাথে সরাসরি যুক্ত)
                </span>
                <h3 className="text-xs sm:text-lg font-black text-white leading-tight truncate sm:whitespace-normal">
                  🪵 কাঠ/জ্বালানি ব্যাপারী সিলেক্ট, দ্রুত কাঠ/কয়লা/লাকড়ি এন্ট্রি ও ব্যালেন্স পেমেন্ট
                </h3>
              </div>
            </div>

            <button
              type="button"
              data-testid="open-full-jalani-hisab-btn"
              onClick={() => onNavigateTab('jalani_hisab')}
              className="sbl-btn-interactive px-2.5 py-1 sm:px-3.5 sm:py-2 rounded-full bg-orange-950 hover:bg-orange-900 text-amber-300 border border-orange-400/50 text-[10px] sm:text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0 self-start lg:self-auto"
            >
              <span>মূল জ্বালানি ও কাঠ খাতায় যান</span>
              <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>

          {/* Step 1: Select Supplier + Live Balance Strip */}
          <div className="bg-slate-950/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-800 space-y-2.5 sm:space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 items-center">
              <div className="lg:col-span-5 space-y-1">
                <label
                  htmlFor="dashboard-wood-supplier-select"
                  className="block text-[11px] sm:text-xs font-extrabold text-amber-300"
                >
                  ১. তালিকা থেকে জ্বালানি/কাঠ ব্যাপারীর নাম সিলেক্ট করুন:
                </label>
                <select
                  id="dashboard-wood-supplier-select"
                  data-testid="dashboard-wood-supplier-select"
                  value={activeWoodSupplier.supplierName}
                  onChange={(e) => handleSelectWoodSupplier(e.target.value)}
                  className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 border-2 border-amber-400/70 text-white text-xs sm:text-sm font-extrabold focus:outline-none focus:border-amber-300 cursor-pointer"
                >
                  {woodSupplierList.map((sup) => (
                    <option key={sup.supplierName} value={sup.supplierName}>
                      {sup.supplierName} — পাওনা ব্যালেন্স: {formatCurrencyBn(sup.totalDue)} (মোট:{' '}
                      {formatBn(sup.totalQuantity)} {sup.latestUnit || 'মণ'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Supplier Live Balance KPIs — 2x2 Grid on Mobile, 4-Column Row on Tablet/Desktop */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 text-xs w-full min-w-0">
                <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-300 font-bold block text-[9px] sm:text-[11px] truncate">
                    মোট কাঠ/জ্বালানি জমা
                  </span>
                  <strong
                    data-testid="selected-wood-supplier-qty"
                    className="text-[11px] sm:text-sm font-black text-sky-300 font-mono block mt-0.5 truncate"
                  >
                    {formatBn(activeWoodSupplier.totalQuantity)}{' '}
                    {activeWoodSupplier.latestUnit || 'মণ'}
                  </strong>
                  <span className="text-[8px] sm:text-[10px] text-slate-400 truncate block">
                    দর: ৳{formatBn(activeWoodSupplier.latestRate || 210)}/
                    {activeWoodSupplier.latestUnit || 'মণ'}
                  </span>
                </div>

                <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-300 font-bold block text-[9px] sm:text-[11px] truncate">মোট জ্বালানি বিল</span>
                  <strong className="text-[11px] sm:text-sm font-black text-white font-mono block mt-0.5 truncate">
                    {formatCurrencyBn(activeWoodSupplier.totalBill)}
                  </strong>
                  <span className="text-[8px] sm:text-[10px] text-slate-400 truncate block">সকল চালান মিলিয়ে</span>
                </div>

                <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-300 font-bold block text-[9px] sm:text-[11px] truncate">মোট নগদ পরিশোধ</span>
                  <strong className="text-[11px] sm:text-sm font-black text-emerald-400 font-mono block mt-0.5 truncate">
                    {formatCurrencyBn(activeWoodSupplier.totalPaid)}
                  </strong>
                  <span className="text-[8px] sm:text-[10px] text-slate-400 truncate block">পরিশোধিত টাকা</span>
                </div>

                <div
                  className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border sm:border-2 ${
                    activeWoodSupplier.totalDue > 0
                      ? 'bg-rose-950/90 border-rose-500'
                      : 'bg-emerald-950/80 border-emerald-500'
                  }`}
                >
                  <span className="text-amber-200 font-extrabold block text-[9px] sm:text-[11px] truncate">
                    ব্যাপারী পাবে (ব্যালেন্স)
                  </span>
                  <strong
                    data-testid="selected-wood-supplier-due"
                    className={`text-[11px] sm:text-sm font-black font-mono block mt-0.5 truncate ${
                      activeWoodSupplier.totalDue > 0 ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {formatCurrencyBn(activeWoodSupplier.totalDue)}
                  </strong>
                  <span className="text-[8px] sm:text-[10px] text-slate-200 font-bold truncate block">
                    {activeWoodSupplier.totalDue > 0 ? 'বকেয়া পাওনা' : '১০০% পরিশোধিত'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Supplier Switch Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800 text-xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mr-1">
                দ্রুত ব্যাপারী নির্বাচন:
              </span>
              {woodSupplierList.map((sup) => {
                const isSelected = sup.supplierName === activeWoodSupplier.supplierName;
                return (
                  <button
                    key={sup.supplierName}
                    type="button"
                    onClick={() => handleSelectWoodSupplier(sup.supplierName)}
                    className={`sbl-btn-interactive px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>{sup.supplierName}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isSelected
                          ? 'bg-slate-950 text-amber-300'
                          : sup.totalDue > 0
                          ? 'bg-rose-900/80 text-rose-200'
                          : 'bg-emerald-900/80 text-emerald-200'
                      }`}
                    >
                      {formatCurrencyBn(sup.totalDue)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Two Side-by-Side Shortcut Forms (Daily Wood/Coal/Lakri Entry + Quick Supplier Balance Settlement) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4 w-full min-w-0">
            {/* Form A: Quick Wood/Fuel Delivery Entry */}
            <form
              noValidate
              onSubmit={handleQuickWoodSubmit}
              data-testid="dashboard-quick-wood-entry-form"
              className="lg:col-span-7 w-full min-w-0 max-w-full overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950/90 border border-orange-500/40 space-y-2.5 sm:space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" />
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      🪵 শর্টকাট কাঠ ও জ্বালানি জমা ({activeWoodSupplier.supplierName})
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {[50, 100, 150, 200].map((presetQty) => (
                      <button
                        key={presetQty}
                        type="button"
                        onClick={() => setWoodQuantity(String(presetQty))}
                        className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold cursor-pointer border ${
                          parseNum(woodQuantity, 0) === presetQty
                            ? 'bg-orange-500 text-slate-950 border-orange-400'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                        }`}
                      >
                        {formatBn(presetQty)} মণ
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2-Column Mobile Grid so Quantity & Rate sit side-by-side */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-300 mb-1 text-[11px] sm:text-xs">
                      জ্বালানির ধরন (১. কাঠ / ২. কয়লা / ৩. লাকড়ি)
                    </label>
                    <select
                      value={woodType}
                      onChange={(e) => setWoodType(e.target.value)}
                      className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-700 font-bold text-white focus:outline-none focus:border-orange-400"
                    >
                      {QUICK_FUEL_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1 text-[11px] sm:text-xs">
                      পরিমাণ ({woodUnit})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid="dashboard-quick-wood-qty-input"
                      value={woodQuantity}
                      onChange={(e) => setWoodQuantity(normalizeNumericInput(e.target.value))}
                      placeholder="100"
                      className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-700 font-black text-white font-mono focus:outline-none focus:border-orange-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1 text-[11px] sm:text-xs">
                      দর (প্রতি {woodUnit} ৳)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid="dashboard-quick-wood-rate-input"
                      value={woodRatePerUnit}
                      onChange={(e) => setWoodRatePerUnit(normalizeNumericInput(e.target.value))}
                      placeholder="210"
                      className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-700 font-black text-amber-300 font-mono focus:outline-none focus:border-orange-400"
                    />
                  </div>
                </div>

                {/* Compact 3-Column Live Bill Strip on Mobile */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 items-center bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800 text-[11px] sm:text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] sm:text-[11px]">চালান বিল:</span>
                    <strong className="text-xs sm:text-sm font-black text-white font-mono">
                      {formatCurrencyBn(woodLiveCalc.totalBill)}
                    </strong>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 mb-0.5">
                      নগদ জমা (৳):
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={woodInstantPaid}
                      onChange={(e) => setWoodInstantPaid(normalizeNumericInput(e.target.value))}
                      className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 font-extrabold text-emerald-400 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] sm:text-[11px]">ব্যালেন্সে যোগ:</span>
                    <strong className="text-xs sm:text-sm font-black text-rose-400 font-mono">
                      +{formatCurrencyBn(woodLiveCalc.dueAmount)}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={woodEntrySaving}
                data-testid="dashboard-quick-wood-submit-btn"
                className="sbl-btn-interactive w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-md transition-all"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {woodEntrySaving
                    ? 'সংরক্ষণ হচ্ছে...'
                    : `+ ${activeWoodSupplier.supplierName}-এর নামে ${formatBn(
                        parseNum(woodQuantity, 0)
                      )} ${woodUnit} কাঠ/জ্বালানি জমা করুন`}
                </span>
              </button>
            </form>

            {/* Form B: Quick Supplier Balance Settlement */}
            <form
              noValidate
              onSubmit={handleQuickWoodPayBalanceSubmit}
              data-testid="dashboard-quick-wood-pay-form"
              className="lg:col-span-5 w-full min-w-0 max-w-full overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950/90 border border-emerald-500/40 space-y-2.5 sm:space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      💸 ব্যালেন্স / পাওনা পরিশোধ ({activeWoodSupplier.supplierName})
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] sm:text-[11px] font-black font-mono">
                    পাওনা: {formatCurrencyBn(activeWoodSupplier.totalDue)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {[5000, 10000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWoodPayAmount(String(amt))}
                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 text-[10px] sm:text-[11px] font-extrabold cursor-pointer font-mono"
                    >
                      ৳ {formatBn(amt)}
                    </button>
                  ))}
                  {activeWoodSupplier.totalDue > 0 && (
                    <button
                      type="button"
                      data-testid="dashboard-wood-pay-full-due-btn"
                      onClick={() => setWoodPayAmount(String(activeWoodSupplier.totalDue))}
                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] sm:text-[11px] font-extrabold cursor-pointer"
                    >
                      সম্পূর্ণ পাওনা ({formatCurrencyBn(activeWoodSupplier.totalDue)})
                    </button>
                  )}
                </div>

                {/* 2-Column Mobile Grid so Amount & Payment Method sit side-by-side */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 text-[11px] sm:text-xs">
                      পরিশোধের পরিমাণ (৳)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid="dashboard-quick-wood-pay-input"
                      value={woodPayAmount}
                      onChange={(e) => setWoodPayAmount(normalizeNumericInput(e.target.value))}
                      placeholder={
                        activeWoodSupplier.totalDue > 0
                          ? String(activeWoodSupplier.totalDue)
                          : '5000'
                      }
                      className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-700 font-black text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1 text-[11px] sm:text-xs">
                      পেমেন্ট মাধ্যম
                    </label>
                    <select
                      value={woodPayMethod}
                      onChange={(e) => setWoodPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-700 font-bold text-white focus:outline-none focus:border-emerald-400"
                    >
                      <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                      <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                      <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
                    </select>
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] sm:text-xs flex items-center justify-between">
                  <span className="text-slate-300 font-bold">
                    পরিশোধের পর অবশিষ্ট ব্যালেন্স থাকবে:
                  </span>
                  <strong className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                    {formatCurrencyBn(
                      Math.max(0, activeWoodSupplier.totalDue - parseNum(woodPayAmount, 0))
                    )}
                  </strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={woodPaySaving || parseNum(woodPayAmount, 0) <= 0}
                data-testid="dashboard-quick-wood-pay-submit-btn"
                className="sbl-btn-interactive w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-50 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Banknote className="w-4 h-4" />
                <span>
                  {woodPaySaving
                    ? 'পরিশোধ হচ্ছে...'
                    : `💸 ${activeWoodSupplier.supplierName}-কে পেমেন্ট সেট করুন`}
                </span>
              </button>
            </form>
          </div>
        </div>
        )}
      </div>

      {/* Bottom Ergonomic Thumb-Zone Operation Switcher (ফোনের নিচে বুড়ো আঙুলের নাগালে ৪টি শর্টকাট বাটন) */}
      <div
        data-testid="shortcut-hub-thumb-switcher"
        className="sm:hidden pt-1 border-t border-slate-800/90 grid grid-cols-5 gap-1"
      >
        {(
          [
            { id: 'ALL' as const, label: '⚡ সব (৪)' },
            { id: 'VAN' as const, label: '১. 🚜 ভ্যান' },
            { id: 'DELIVERY' as const, label: '২. 🚚 মেমো' },
            { id: 'SARDAR' as const, label: '৩. 💸 সর্দার' },
            { id: 'WOOD_FUEL' as const, label: '৪. 🪵 কাঠ' },
          ] as const
        ).map((item) => {
          const isAct = activeShortcutTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveShortcutTab(item.id)}
              className={`min-h-[32px] px-1 py-1 rounded-lg text-[10px] font-black truncate transition-all cursor-pointer ${
                isAct
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-slate-300 border border-slate-700'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};
