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
  UnloadedGradeItem,
} from '../types/kiln';
import {
  cleanBrickGradeName,
  formatBn,
  formatCurrencyBn,
} from '../utils/kilnLogic';

export type ProductionSectionView =
  | 'ALL'
  | 'MILLS'
  | 'CHULLI_LOAD'
  | 'PORAI_MISTRI'
  | 'CHULLI_UNLOAD'
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
  millPots: MillPotRecord[];
  chulliLoads: ChulliLoadRecord[];
  poraiMistriRecords?: PoraiMistriRecord[];
  chulliUnloads: ChulliUnloadRecord[];
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
    ratePerThousand: number;
    unloadedByGrade?: UnloadedGradeItem[];
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onDeleteChulliUnload?: (id: string) => Promise<void>;
  onDeleteProductionPayment?: (id: string) => Promise<void>;
}

const MILL_OPTIONS: Array<{ id: MillId; nameBn: string; nameEn: string }> = [
  { id: 'ohab', nameBn: 'ওহাব মিল (Ohab Mill)', nameEn: 'Ohab Mill' },
  { id: 'mofijul', nameBn: 'মফিজুল মিল (Mofijul Mill)', nameEn: 'Mofijul Mill' },
  { id: 'sofikul', nameBn: 'শফিকুল মিল (Sofikul Mill)', nameEn: 'Sofikul Mill' },
];

type DepositTarget =
  | { type: 'MILL_POT'; record: MillPotRecord }
  | { type: 'VAN_LOAD'; record: ChulliLoadRecord }
  | { type: 'PORAI_MISTRI'; record: PoraiMistriRecord }
  | { type: 'CHULLI_UNLOAD'; record: ChulliUnloadRecord };

export const BrickGradeReportTab: React.FC<BrickGradeReportTabProps> = ({
  lang = 'bn',
  initialSectionView = 'ALL',
  hideOverviewBanner = false,
  rows,
  totals,
  brickGrades,
  millPots = [],
  chulliLoads = [],
  poraiMistriRecords = [],
  chulliUnloads = [],
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

  // Deposit / Payment Popup Modal State (টাকা জমা দেওয়ার পপআপ)
  const [depositTarget, setDepositTarget] = useState<DepositTarget | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositNote, setDepositNote] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // 1. Mill & Pot Form State
  const [editingPotId, setEditingPotId] = useState<string | undefined>(undefined);
  const [potMillId, setPotMillId] = useState<MillId>('ohab');
  const [potNo, setPotNo] = useState('পট-০১');
  const [potDate, setPotDate] = useState(todayIso);
  const [potRawBricks, setPotRawBricks] = useState('50000');
  const [potRatePerThousand, setPotRatePerThousand] = useState('1200');
  const [potPaidAmount, setPotPaidAmount] = useState('0');
  const [potNote, setPotNote] = useState('');
  const [savingPot, setSavingPot] = useState(false);

  // 2. Chulli Van Load Form State (সেলিম সর্দার — 100 pcs per Van @ 11.5 Tk, NO Mill/Pot!)
  const [editingLoadId, setEditingLoadId] = useState<string | undefined>(undefined);
  const [loadDate, setLoadDate] = useState(todayIso);
  const [loadSardarName, setLoadSardarName] = useState('সেলিম সর্দার');
  const [loadBrickQty, setLoadBrickQty] = useState('10000');
  const [loadRatePerVan, setLoadRatePerVan] = useState('11.5');
  const [loadPaidAmount, setLoadPaidAmount] = useState('0');
  const [loadNote, setLoadNote] = useState('');
  const [savingLoad, setSavingLoad] = useState(false);

  // 2b. Porai Mistri / Chulli Firing Master Form State (পোড়াই মিস্ত্রি — চুল্লির হিসাব)
  const [editingPoraiId, setEditingPoraiId] = useState<string | undefined>(undefined);
  const [poraiDate, setPoraiDate] = useState(todayIso);
  const [poraiMistriName, setPoraiMistriName] = useState('আলী হোসেন (পোড়াই মিস্ত্রি)');
  const [poraiChamber, setPoraiChamber] = useState('রাউন্ড-০১');
  const [poraiBricksFired, setPoraiBricksFired] = useState('50000');
  const [poraiRatePerThousand, setPoraiRatePerThousand] = useState('400');
  const [poraiPaidAmount, setPoraiPaidAmount] = useState('0');
  const [poraiNote, setPoraiNote] = useState('');
  const [savingPorai, setSavingPorai] = useState(false);

  // 3. Chulli Unload Form State (1000 pcs @ 750 Tk -> adds to Fired Stock)
  const [unloadDate, setUnloadDate] = useState(todayIso);
  const [unloadSardarName, setUnloadSardarName] = useState('রহিম আনলোড সর্দার ও দল');
  const [unloadChamber, setUnloadChamber] = useState('রাউন্ড-০১');
  const [unloadRatePerThousand, setUnloadRatePerThousand] = useState('750');
  const [unloadGradeQtys, setUnloadGradeQtys] = useState<Record<string, string>>({
    'grade-1': '20000',
    'grade-1-5': '5000',
    'grade-2': '5000',
    'grade-3': '0',
    'grade-picket': '0',
    'grade-goria': '0',
  });
  const [unloadPaidAmount, setUnloadPaidAmount] = useState('0');
  const [unloadNote, setUnloadNote] = useState('');
  const [savingUnload, setSavingUnload] = useState(false);

  // 4. Manual Stock Adjustment State
  const [selectedGradeId, setSelectedGradeId] = useState<string>(
    brickGrades[0]?.id || 'grade-1'
  );
  const [stockQty, setStockQty] = useState<string>('10000');
  const [customRate, setCustomRate] = useState<string>('');
  const [submittingStock, setSubmittingStock] = useState(false);

  // Computed Aggregates for Raw Bricks & Mills
  const totalRawCutAllMills = millPots.reduce((s, p) => s + p.rawBricksCut, 0);
  const totalMillPayable = millPots.reduce((s, p) => s + p.totalPayable, 0);
  const totalMillPaid = millPots.reduce((s, p) => s + p.paidAmount, 0);
  const totalMillDue = millPots.reduce((s, p) => s + p.dueAmount, 0);

  // Computed Aggregates for Chulli Van Loading (সেলিম সর্দার)
  const totalLoadedBricks = chulliLoads.reduce((s, l) => s + l.rawBricksLoaded, 0);
  const totalLoadedVans = chulliLoads.reduce((s, l) => s + l.vanCount, 0);
  const totalLoadBill = chulliLoads.reduce((s, l) => s + l.totalBill, 0);
  const totalLoadPaid = chulliLoads.reduce((s, l) => s + l.paidAmount, 0);
  const totalLoadDue = chulliLoads.reduce((s, l) => s + l.dueAmount, 0);

  // Computed Aggregates for Porai Mistri / Chulli Firing Master (পোড়াই মিস্ত্রি — চুল্লির হিসাব)
  const totalPoraiBricks = poraiMistriRecords.reduce((s, r) => s + r.bricksFired, 0);
  const totalPoraiBill = poraiMistriRecords.reduce((s, r) => s + r.totalBill, 0);
  const totalPoraiPaid = poraiMistriRecords.reduce((s, r) => s + r.paidAmount, 0);
  const totalPoraiDue = poraiMistriRecords.reduce((s, r) => s + r.dueAmount, 0);

  // Computed Aggregates for Chulli Unloading (Fired Bricks)
  const totalUnloadedBricks = chulliUnloads.reduce((s, u) => s + u.totalBricksUnloaded, 0);
  const totalUnloadBill = chulliUnloads.reduce((s, u) => s + u.totalBill, 0);
  const totalUnloadPaid = chulliUnloads.reduce((s, u) => s + u.paidAmount, 0);
  const totalUnloadDue = chulliUnloads.reduce((s, u) => s + u.dueAmount, 0);

  // Unloaded Bricks Breakdown by Grade across all Unload Records
  const unloadedTotalsByGrade = brickGrades.map((g) => {
    const qty = chulliUnloads.reduce((sum, rec) => {
      const found = rec.unloadedByGrade.find((it) => it.gradeId === g.id);
      return sum + (found ? found.quantity : 0);
    }, 0);
    return {
      gradeId: g.id,
      nameBn: cleanBrickGradeName(g.nameBn),
      qty,
    };
  });

  // Live Preview for Mill Pot Form
  const livePotRaw = Math.max(0, Number(potRawBricks) || 0);
  const livePotPayable = Math.round((livePotRaw / 1000) * (Number(potRatePerThousand) || 0));
  const livePotPaid = Math.max(0, Number(potPaidAmount) || 0);
  const livePotDue = Math.max(0, livePotPayable - livePotPaid);

  // Live Preview for Van Load Form (100 pcs per Van @ 11.5 Tk)
  const liveLoadBricks = Math.max(0, Number(loadBrickQty) || 0);
  const liveVanCount = Number((liveLoadBricks / 100).toFixed(2));
  const liveVanRate = Math.max(0, Number(loadRatePerVan) || 11.5);
  const liveLoadTotalBill = Math.round(liveVanCount * liveVanRate);
  const liveLoadPaid = Math.max(0, Number(loadPaidAmount) || 0);
  const liveLoadDue = Math.max(0, liveLoadTotalBill - liveLoadPaid);

  // Live Preview for Porai Mistri Form
  const livePoraiBricks = Math.max(0, Number(poraiBricksFired) || 0);
  const livePoraiRate = Math.max(0, Number(poraiRatePerThousand) || 400);
  const livePoraiTotalBill = Math.round((livePoraiBricks / 1000) * livePoraiRate);
  const livePoraiPaid = Math.max(0, Number(poraiPaidAmount) || 0);
  const livePoraiDue = Math.max(0, livePoraiTotalBill - livePoraiPaid);

  // Live Preview for Chulli Unload Form (1000 pcs @ 750 Tk)
  const liveUnloadItems: UnloadedGradeItem[] = brickGrades
    .map((g) => ({
      gradeId: g.id,
      gradeName: cleanBrickGradeName(g.nameBn),
      quantity: Math.max(0, Number(unloadGradeQtys[g.id] || 0)),
    }))
    .filter((i) => i.quantity > 0);
  const liveTotalUnloadBricks = liveUnloadItems.reduce((s, i) => s + i.quantity, 0);
  const liveUnloadRate = Math.max(0, Number(unloadRatePerThousand) || 750);
  const liveUnloadTotalBill = Math.round((liveTotalUnloadBricks / 1000) * liveUnloadRate);
  const liveUnloadPaid = Math.max(0, Number(unloadPaidAmount) || 0);
  const liveUnloadDue = Math.max(0, liveUnloadTotalBill - liveUnloadPaid);

  const filteredMillPots =
    selectedMillFilter === 'ALL'
      ? millPots
      : millPots.filter((p) => p.millId === selectedMillFilter);

  const filteredMillRawCut = filteredMillPots.reduce((s, p) => s + p.rawBricksCut, 0);
  const filteredMillPayable = filteredMillPots.reduce((s, p) => s + p.totalPayable, 0);
  const filteredMillPaid = filteredMillPots.reduce((s, p) => s + p.paidAmount, 0);
  const filteredMillDue = filteredMillPots.reduce((s, p) => s + p.dueAmount, 0);

  // Helper to get payment records for a given section (including fallback if legacy records had paidAmount > 0)
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
    }
    return [...explicit, ...fallback];
  };

  const millPayments = getSectionPayments('MILL');
  const vanPayments = getSectionPayments('VAN_LOAD');
  const poraiPayments = getSectionPayments('PORAI_MISTRI');
  const unloadPayments = getSectionPayments('UNLOAD');

  const openDepositModal = (target: DepositTarget) => {
    setDepositTarget(target);
    const defaultPay =
      target.record.dueAmount > 0 ? String(target.record.dueAmount) : '1000';
    setDepositAmount(defaultPay);
    setDepositNote('');
  };

  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTarget) return;
    const addAmt = Math.max(0, Number(depositAmount) || 0);
    if (addAmt <= 0) return;

    setSubmittingDeposit(true);
    try {
      if (depositTarget.type === 'MILL_POT') {
        const pot = depositTarget.record;
        const newPaid = pot.paidAmount + addAmt;
        const appendedNote = depositNote.trim()
          ? `${pot.note ? pot.note + ' | ' : ''}${depositNote.trim()}`
          : pot.note || '';
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
        const appendedNote = depositNote.trim()
          ? `${ld.note ? ld.note + ' | ' : ''}${depositNote.trim()}`
          : ld.note || '';
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
        const appendedNote = depositNote.trim()
          ? `${pr.note ? pr.note + ' | ' : ''}${depositNote.trim()}`
          : pr.note || '';
        await onSavePoraiMistri({
          id: pr.id,
          date: pr.date,
          mistriName: pr.mistriName,
          chamberOrRound: pr.chamberOrRound,
          bricksFired: pr.bricksFired,
          ratePerThousand: pr.ratePerThousand,
          paidAmount: newPaid,
          note: appendedNote,
        });
      } else if (depositTarget.type === 'CHULLI_UNLOAD') {
        const un = depositTarget.record;
        const newPaid = un.paidAmount + addAmt;
        const appendedNote = depositNote.trim()
          ? `${un.note ? un.note + ' | ' : ''}${depositNote.trim()}`
          : un.note || '';
        await onSaveChulliUnload({
          id: un.id,
          date: un.date,
          sardarName: un.sardarName,
          chamberOrRound: un.chamberOrRound,
          ratePerThousand: un.ratePerThousand,
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
    if (livePotRaw <= 0) return;
    setSavingPot(true);
    try {
      await onSaveMillPot({
        id: editingPotId,
        millId: potMillId,
        potNo: potNo.trim() || 'পট-০১',
        date: potDate,
        rawBricksCut: livePotRaw,
        takenToChulli: 0,
        ratePerThousand: Number(potRatePerThousand) || 1200,
        paidAmount: livePotPaid,
        note: potNote.trim(),
      });
      setEditingPotId(undefined);
      setPotNo(`পট-০${millPots.length + 2}`);
      setPotPaidAmount('0');
      setPotNote('');
    } finally {
      setSavingPot(false);
    }
  };

  const handleEditPot = (pot: MillPotRecord) => {
    setEditingPotId(pot.id);
    setPotMillId(pot.millId);
    setPotNo(pot.potNo);
    setPotDate(pot.date);
    setPotRawBricks(String(pot.rawBricksCut));
    setPotRatePerThousand(String(pot.ratePerThousand));
    setPotPaidAmount(String(pot.paidAmount));
    setPotNote(pot.note || '');
  };

  const handleVanLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveLoadBricks <= 0) return;
    setSavingLoad(true);
    try {
      await onSaveChulliLoad({
        id: editingLoadId,
        date: loadDate,
        sardarName: loadSardarName.trim() || 'সেলিম সর্দার',
        rawBricksLoaded: liveLoadBricks,
        ratePerVan: liveVanRate,
        paidAmount: liveLoadPaid,
        note: loadNote.trim(),
      });
      setEditingLoadId(undefined);
      setLoadPaidAmount('0');
      setLoadNote('');
    } finally {
      setSavingLoad(false);
    }
  };

  const handleEditVanLoad = (ld: ChulliLoadRecord) => {
    setEditingLoadId(ld.id);
    setLoadDate(ld.date);
    setLoadSardarName(ld.sardarName || 'সেলিম সর্দার');
    setLoadBrickQty(String(ld.rawBricksLoaded));
    setLoadRatePerVan(String(ld.ratePerVan));
    setLoadPaidAmount(String(ld.paidAmount));
    setLoadNote(ld.note || '');
  };

  const handlePoraiMistriSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSavePoraiMistri || livePoraiBricks <= 0) return;
    setSavingPorai(true);
    try {
      await onSavePoraiMistri({
        id: editingPoraiId,
        date: poraiDate,
        mistriName: poraiMistriName.trim() || 'আলী হোসেন (পোড়াই মিস্ত্রি)',
        chamberOrRound: poraiChamber.trim() || 'রাউন্ড-০১',
        bricksFired: livePoraiBricks,
        ratePerThousand: livePoraiRate,
        paidAmount: livePoraiPaid,
        note: poraiNote.trim(),
      });
      setEditingPoraiId(undefined);
      setPoraiChamber(`রাউন্ড-০${poraiMistriRecords.length + 2}`);
      setPoraiPaidAmount('0');
      setPoraiNote('');
    } finally {
      setSavingPorai(false);
    }
  };

  const handleEditPoraiMistri = (pr: PoraiMistriRecord) => {
    setEditingPoraiId(pr.id);
    setPoraiDate(pr.date);
    setPoraiMistriName(pr.mistriName);
    setPoraiChamber(pr.chamberOrRound);
    setPoraiBricksFired(String(pr.bricksFired));
    setPoraiRatePerThousand(String(pr.ratePerThousand));
    setPoraiPaidAmount(String(pr.paidAmount));
    setPoraiNote(pr.note || '');
  };

  const handleChulliUnloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveTotalUnloadBricks <= 0) return;
    setSavingUnload(true);
    try {
      await onSaveChulliUnload({
        date: unloadDate,
        sardarName: unloadSardarName.trim() || 'আনলোড সর্দার',
        chamberOrRound: unloadChamber.trim() || 'রাউন্ড-০১',
        ratePerThousand: liveUnloadRate,
        unloadedByGrade: liveUnloadItems,
        paidAmount: liveUnloadPaid,
        note: unloadNote.trim(),
      });
      setUnloadPaidAmount('0');
      setUnloadNote('');
    } finally {
      setSavingUnload(false);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(stockQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    setSubmittingStock(true);
    try {
      await onAddStock(
        selectedGradeId,
        qty,
        customRate ? Number(customRate) : undefined
      );
      setStockQty('10000');
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
      {/* Top Overview Banner: Raw Brick -> Chulli Load -> Porai Mistri -> Chulli Unload -> Fired Brick Stock */}
      {!hideOverviewBanner && (
        <div className="bg-[#0F172A] text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-lg space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 mb-1.5">
                <Factory className="w-3.5 h-3.5" />
                {isEn
                  ? '3 Mills Pot Ledger · Van Load · Porai Mistri · Chulli Unload & Stock'
                  : 'মিল হিসাব · ভ্যান হিসাব · পোড়াই মিস্ত্রি (চুল্লি) · আনলোড হিসাব ও স্টক'}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {isEn
                  ? 'Complete Mill, Van, Porai Mistri (Chulli), Unload & Stock Ledger'
                  : 'মিল হিসাব, ভ্যান লোড (সেলিম সর্দার), পোড়াই মিস্ত্রি (চুল্লির হিসাব) এবং আনলোড ও স্টক খতিয়ান'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              {isEn ? 'Print Report' : 'রিপোর্ট প্রিন্ট করুন'}
            </button>
          </div>

          {/* 5 Pipeline KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => setSectionView('MILLS')}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-amber-400">
                ১. মিল হিসাব (৩ মিলে বানানো ইট)
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalRawCutAllMills)} <span className="text-xs font-normal text-slate-400">পিস</span>
              </div>
              <div className="text-[11px] text-slate-300">
                মোট পট: <strong>{formatBn(millPots.length)}টি</strong>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                পাবে: {formatCurrencyBn(totalMillPayable)} · দিছে: {formatCurrencyBn(totalMillPaid)} · <strong className="text-rose-400">বাকি: {formatCurrencyBn(totalMillDue)}</strong>
              </div>
            </div>

            <div
              onClick={() => setSectionView('CHULLI_LOAD')}
              className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl p-4 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-sky-400">
                ২. ভ্যান হিসাব — সেলিম সর্দার
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalLoadedBricks)} <span className="text-xs font-normal text-slate-400">পিস ({formatBn(totalLoadedVans)} ভ্যান)</span>
              </div>
              <div className="text-[11px] text-slate-300">
                ১০০ পিস/ভ্যান @ ১১.৫৳
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalLoadBill)} · জমা: {formatCurrencyBn(totalLoadPaid)} · <strong className="text-rose-400">বাকি: {formatCurrencyBn(totalLoadDue)}</strong>
              </div>
            </div>

            <div
              onClick={() => setSectionView('PORAI_MISTRI')}
              className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 rounded-xl p-4 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-rose-400">
                ৩. পোড়াই মিস্ত্রি (চুল্লির হিসাব)
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalPoraiBricks)} <span className="text-xs font-normal text-slate-400">পিস পোড়াই</span>
              </div>
              <div className="text-[11px] text-slate-300">
                মোট রাউন্ড: <strong>{formatBn(poraiMistriRecords.length)}টি</strong>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalPoraiBill)} · জমা: {formatCurrencyBn(totalPoraiPaid)} · <strong className="text-rose-400">বাকি: {formatCurrencyBn(totalPoraiDue)}</strong>
              </div>
            </div>

            <div
              onClick={() => setSectionView('CHULLI_UNLOAD')}
              className="bg-slate-900/90 border border-slate-800 hover:border-orange-500/50 rounded-xl p-4 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-orange-400">
                ৪. আনলোড হিসাব (ইট বাহির @ ৭৫০৳)
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatBn(totalUnloadedBricks)} <span className="text-xs font-normal text-slate-400">পিস বাহির</span>
              </div>
              <div className="text-[11px] text-slate-300">
                ১০০০ ইট আনলোড রেট: ৭৫০ টাকা
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                বিল: {formatCurrencyBn(totalUnloadBill)} · জমা: {formatCurrencyBn(totalUnloadPaid)} · <strong className="text-rose-400">বাকি: {formatCurrencyBn(totalUnloadDue)}</strong>
              </div>
            </div>

            <div
              onClick={() => setSectionView('FIRED_STOCK')}
              className="bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-4 space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="text-xs font-semibold text-emerald-400">
                ৫. পোড়ানো ইটের বর্তমান স্টক
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

          {/* Section Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(
              [
                { id: 'ALL', label: 'সকল হিসাব একসাথে (All)' },
                { id: 'MILLS', label: '১. মিল হিসাব (ওহাব · মফিজুল · শফিকুল)' },
                { id: 'CHULLI_LOAD', label: '২. ভ্যান হিসাব (সেলিম সর্দার)' },
                { id: 'PORAI_MISTRI', label: '৩. পোড়াই মিস্ত্রি (চুল্লির হিসাব)' },
                { id: 'CHULLI_UNLOAD', label: '৪. আনলোড হিসাব (ইট বাহির)' },
                { id: 'FIRED_STOCK', label: '৫. পোড়ানো ইটের স্টক ও বিক্রয়' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSectionView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sectionView === tab.id
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
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
                  সর্বমোট জমা দিছে কত
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalMillPaid)}
                </strong>
              </div>
              <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-3 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-rose-300 font-semibold block">
                  আর পাবে কত (সর্বমোট বাকি)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-rose-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalMillDue)}
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
                    {/* Inner content wrapper that gets blurred when another mill is selected */}
                    <div
                      className={`p-4 space-y-3 transition-all duration-300 ${
                        isBlurredMill
                          ? 'blur-[3px] opacity-50 grayscale-[25%] select-none pointer-events-none'
                          : 'blur-none opacity-100'
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDepositModal({
                                type: 'MILL_POT',
                                record: targetPotForDeposit,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs cursor-pointer shrink-0"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            + টাকা জমা দিন
                          </button>
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
                          <span className="text-[10px] text-rose-700 font-semibold block">
                            আর পাবে কত
                          </span>
                          <strong className="text-rose-700 font-mono">
                            {formatCurrencyBn(due)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Crisp interactive callout pill on top of blurred mill cards so user can click to focus */}
                    {isBlurredMill && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 hover:bg-slate-900/5 transition-colors">
                        <span className="px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-bold shadow-lg border border-white/20 backdrop-blur-xs">
                          {mill.nameBn.split(' (')[0]} দেখতে ক্লিক করুন
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add / Update Mill Pot Form + Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <form
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
                    onChange={(e) => setPotMillId(e.target.value as MillId)}
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
                    required
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
                    type="number"
                    min={1}
                    required
                    value={potRawBricks}
                    onChange={(e) => setPotRawBricks(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ওই মিলের রেট (/হাজার ৳) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={potRatePerThousand}
                    onChange={(e) => setPotRatePerThousand(e.target.value)}
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
                    type="number"
                    min={0}
                    value={potPaidAmount}
                    onChange={(e) => setPotPaidAmount(e.target.value)}
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

              {/* Live Pot Calculation Preview */}
              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">মিল মোট টাকা পাবে (বিল):</span>
                  <strong className="text-amber-300 font-mono">{formatCurrencyBn(livePotPayable)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দেওয়া হচ্ছে:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrencyBn(livePotPaid)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">মিল আর পাবে কত (বাকি):</span>
                  <strong className="text-rose-400 font-mono">{formatCurrencyBn(livePotDue)}</strong>
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
                    <th className="py-3 px-3 font-bold text-right">আর পাবে কত (বাকি)</th>
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
                      <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums">
                        {formatCurrencyBn(pot.dueAmount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openDepositModal({ type: 'MILL_POT', record: pot })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            + টাকা জমা দিন
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
          SECTION 2: CHULLI VAN LOADING — সেলিম সর্দার (NO MILL/POT TRACKING!)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'CHULLI_LOAD') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-600" />
                ২. ভ্যান হিসাব — সেলিম সর্দার (চুল্লিতে কাঁচা ইট লোড · ১০০ পিস প্রতি ভ্যান @ ১১.৫ টাকা)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                সেলিম সর্দারের ভ্যানে কতগুলো কাঁচা ইট চুল্লিতে লোড দিল, মোট কত টাকা বিল হলো, কত টাকা জমা দিলাম এবং আর কত টাকা পাবে তার সম্পূর্ণ হিসাব ও জমা রেকর্ড।
              </p>
            </div>

            {chulliLoads.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const target =
                    chulliLoads.find((l) => l.dueAmount > 0) || chulliLoads[0];
                  if (target) {
                    openDepositModal({ type: 'VAN_LOAD', record: target });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer shrink-0"
              >
                <Banknote className="w-4 h-4" />
                + সেলিম সর্দারকে টাকা জমা দিন
              </button>
            )}
          </div>

          {/* Selim Sardar Master Summary Card */}
          <div className="bg-sky-50/70 border-2 border-sky-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <span className="text-xs text-slate-600 block">ভ্যান সর্দারের নাম</span>
              <strong className="text-base font-bold text-slate-900">সেলিম সর্দার</strong>
              <span className="text-[11px] text-sky-700 block font-medium">
                ১০০ পিস প্রতি ভ্যান @ ১১.৫ টাকা
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-600 block">চুল্লিতে মোট ইট লোড দিল</span>
              <strong className="text-base font-bold font-mono text-slate-900 tabular-nums">
                {formatBn(totalLoadedBricks)} পিস
              </strong>
              <span className="text-[11px] text-slate-600 block">
                মোট ভ্যান: {formatBn(totalLoadedVans)}টি
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-600 block">মোট কত টাকা হলো (বিল)</span>
              <strong className="text-base font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrencyBn(totalLoadBill)}
              </strong>
            </div>
            <div>
              <span className="text-xs text-emerald-800 font-semibold block">
                জমা দিলাম কত টাকা
              </span>
              <strong className="text-base font-bold font-mono text-emerald-700 tabular-nums">
                {formatCurrencyBn(totalLoadPaid)}
              </strong>
            </div>
            <div>
              <span className="text-xs text-rose-800 font-semibold block">
                সেলিম সর্দার আর পাবে (বাকি)
              </span>
              <strong className="text-base font-bold font-mono text-rose-700 tabular-nums">
                {formatCurrencyBn(totalLoadDue)}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Chulli Van Load Form (NO Mill/Pot fields!) */}
            <form
              onSubmit={handleVanLoadSubmit}
              className="lg:col-span-4 bg-sky-50/50 border border-sky-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-sky-600" />
                  {editingLoadId
                    ? 'ভ্যান লোড ও জমা টাকা আপডেট করুন'
                    : 'ভ্যানে চুল্লি লোড ও জমা টাকা এন্ট্রি'}
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
                  ভ্যান সর্দারের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={loadSardarName}
                  onChange={(e) => setLoadSardarName(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কতগুলো ইট লোড দিল (পিস) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={loadBrickQty}
                    onChange={(e) => setLoadBrickQty(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    প্রতি ভ্যান রেট (১০০ পিস) ৳
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={loadRatePerVan}
                    onChange={(e) => setLoadRatePerVan(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Quick Brick Quantity Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[5000, 10000, 15000, 20000, 30000].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setLoadBrickQty(String(q))}
                    className={`px-2 py-1 text-[11px] font-bold rounded border cursor-pointer ${
                      Number(loadBrickQty) === q
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {formatBn(q)} পিস
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    জমা দিলাম কত টাকা (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={loadPaidAmount}
                    onChange={(e) => setLoadPaidAmount(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-emerald-50 border border-emerald-400 rounded-lg tabular-nums"
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
                    className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
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
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Live Van Calculation */}
              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">মোট ভ্যান সংখ্যা (ইট ÷ ১০০):</span>
                  <strong className="text-sky-400 font-mono">{formatBn(liveVanCount)} ভ্যান</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">কত টাকা হলো (@ ৳{formatBn(liveVanRate)}):</span>
                  <strong className="text-amber-300 font-mono">{formatCurrencyBn(liveLoadTotalBill)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দিলাম:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrencyBn(liveLoadPaid)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">আর পাবে কত (বাকি):</span>
                  <strong className="text-rose-400 font-mono">{formatCurrencyBn(liveLoadDue)}</strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLoad}
                className="w-full py-2.5 px-4 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {savingLoad
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingLoadId
                  ? 'ভ্যান হিসাব আপডেট করুন'
                  : '+ সেলিম সর্দারের ভ্যান লোড হিসাব যোগ করুন'}
              </button>
            </form>

            {/* Chulli Van Load Ledger Table (NO Mill/Pot Column!) */}
            <div className="lg:col-span-8 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">তারিখ ও সর্দারের নাম</th>
                    <th className="py-3 px-3 font-bold text-right">চুল্লিতে লোড দিল (ইট)</th>
                    <th className="py-3 px-3 font-bold text-right">মোট ভ্যান</th>
                    <th className="py-3 px-3 font-bold text-right">রেট (/ভ্যান)</th>
                    <th className="py-3 px-3 font-bold text-right">কত টাকা হলো (বিল)</th>
                    <th className="py-3 px-3 font-bold text-right">জমা দিলাম কত টাকা</th>
                    <th className="py-3 px-3 font-bold text-right">আর পাবে কত (বাকি)</th>
                    <th className="py-3 px-3 font-bold text-right">টাকা জমা ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chulliLoads.map((ld) => (
                    <tr key={ld.id} className="hover:bg-sky-50/30">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{ld.sardarName}</div>
                        <div className="text-[11px] text-slate-500">
                          {ld.date} {ld.note ? `· ${ld.note}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono tabular-nums">
                        {formatBn(ld.rawBricksLoaded)} পিস
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sky-700 font-mono tabular-nums">
                        {formatBn(ld.vanCount)} ভ্যান
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        ৳{formatBn(ld.ratePerVan)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(ld.totalBill)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrencyBn(ld.paidAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums">
                        {formatCurrencyBn(ld.dueAmount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openDepositModal({ type: 'VAN_LOAD', record: ld })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            + টাকা জমা দিন
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
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">সেলিম সর্দার সর্বমোট:</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(totalLoadedBricks)} পিস
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sky-800 tabular-nums">
                      {formatBn(totalLoadedVans)} ভ্যান
                    </td>
                    <td className="py-3 px-3 text-right">—</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatCurrencyBn(totalLoadBill)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 tabular-nums">
                      {formatCurrencyBn(totalLoadPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 tabular-nums">
                      {formatCurrencyBn(totalLoadDue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Van Payment Record History Ledger */}
          {renderPaymentRecordsTable(
            'ভ্যান হিসাব (সেলিম সর্দার) — টাকা জমা দেওয়ার রেকর্ড খতিয়ান',
            'সেলিম সর্দারকে চুল্লি লোড বাবদ কবে কত টাকা জমা দেওয়া হয়েছে তার সম্পূর্ণ তালিকা',
            vanPayments,
            'sky'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 2B: PORAI MISTRI — চুল্লির হিসাব (পোড়াই মিস্ত্রির ইট পোড়ানো ও টাকার হিসাব)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'PORAI_MISTRI') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600" />
                পোড়াই মিস্ত্রি (চুল্লির হিসাব) — চুল্লিতে ইট পোড়ানো, রেট, বিল ও জমা টাকার খতিয়ান
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                পোড়াই মিস্ত্রি চুল্লিতে কোন রাউন্ডে/চেম্বারে কত পিস ইট পোড়ালো, হাজার প্রতি রেট কত, মোট কত টাকা পাবে, কত টাকা জমা দেওয়া হলো এবং আর কত টাকা পাবে — তার সম্পূর্ণ হিসাব ও জমা রেকর্ড।
              </p>
            </div>

            {poraiMistriRecords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const target =
                    poraiMistriRecords.find((r) => r.dueAmount > 0) ||
                    poraiMistriRecords[0];
                  if (target) {
                    openDepositModal({ type: 'PORAI_MISTRI', record: target });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer shrink-0"
              >
                <Banknote className="w-4 h-4" />
                + পোড়াই মিস্ত্রিকে টাকা জমা দিন
              </button>
            )}
          </div>

          {/* Porai Mistri Master Summary Strip */}
          <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#1E293B] text-white rounded-2xl p-4 sm:p-5 border-2 border-rose-500/40 shadow-md">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">পোড়াই মিস্ত্রির হিসাব</span>
                <strong className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                  চুল্লি পোড়াই খতিয়ান
                </strong>
                <span className="text-[11px] text-rose-300">
                  মোট এন্ট্রি: {formatBn(poraiMistriRecords.length)}টি রাউন্ড
                </span>
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">চুল্লিতে মোট পোড়ানো ইট</span>
                <strong className="text-base sm:text-lg font-bold font-mono text-white tabular-nums mt-0.5 block">
                  {formatBn(totalPoraiBricks)} পিস
                </strong>
              </div>
              <div className="bg-slate-800/90 border border-amber-500/30 rounded-xl p-3">
                <span className="text-[11px] text-amber-300 font-semibold block">
                  পোড়াই মিস্ত্রি মোট পাবে (বিল)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-amber-300 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalPoraiBill)}
                </strong>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3">
                <span className="text-[11px] text-emerald-300 font-semibold block">
                  জমা দেওয়া টাকা (পরিশোধিত)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalPoraiPaid)}
                </strong>
              </div>
              <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-3 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-rose-300 font-semibold block">
                  পোড়াই মিস্ত্রি আর পাবে (বাকি)
                </span>
                <strong className="text-base sm:text-lg font-bold font-mono text-rose-400 tabular-nums mt-0.5 block">
                  {formatCurrencyBn(totalPoraiDue)}
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Porai Mistri Entry Form */}
            <form
              onSubmit={handlePoraiMistriSubmit}
              className="lg:col-span-4 bg-rose-50/40 border border-rose-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-rose-600" />
                  {editingPoraiId
                    ? 'পোড়াই মিস্ত্রি ও চুল্লির হিসাব আপডেট'
                    : 'পোড়াই মিস্ত্রি (চুল্লির হিসাব) নতুন এন্ট্রি'}
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পোড়াই মিস্ত্রির নাম *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: আলী হোসেন মিস্ত্রি"
                    value={poraiMistriName}
                    onChange={(e) => setPoraiMistriName(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    চুল্লি রাউন্ড / চেম্বার নং *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: রাউন্ড-০১"
                    value={poraiChamber}
                    onChange={(e) => setPoraiChamber(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    চুল্লিতে পোড়ানো ইট (পিস) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={poraiBricksFired}
                    onChange={(e) => setPoraiBricksFired(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    হাজার প্রতি পোড়াই রেট (৳) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={poraiRatePerThousand}
                    onChange={(e) => setPoraiRatePerThousand(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Quick Brick Presets for Chulli */}
              <div className="flex flex-wrap gap-1.5">
                {[20000, 50000, 100000, 150000, 200000].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPoraiBricksFired(String(q))}
                    className={`px-2 py-1 text-[11px] font-bold rounded border cursor-pointer ${
                      Number(poraiBricksFired) === q
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {formatBn(q)} পিস
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    টাকা জমা দেওয়া হলো (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={poraiPaidAmount}
                    onChange={(e) => setPoraiPaidAmount(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-emerald-50 border border-emerald-400 rounded-lg tabular-nums"
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
                    className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ১ম রাউন্ড চুল্লি পোড়াই বিল ও খোরাকি..."
                  value={poraiNote}
                  onChange={(e) => setPoraiNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Live Porai Calculation */}
              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">চুল্লিতে মোট ইট:</span>
                  <strong className="text-rose-300 font-mono">{formatBn(livePoraiBricks)} পিস</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">মিস্ত্রির মোট বিল (@ ৳{formatBn(livePoraiRate)}/হাজার):</span>
                  <strong className="text-amber-300 font-mono">{formatCurrencyBn(livePoraiTotalBill)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দেওয়া হচ্ছে:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrencyBn(livePoraiPaid)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">আর পাবে কত (বাকি):</span>
                  <strong className="text-rose-400 font-mono">{formatCurrencyBn(livePoraiDue)}</strong>
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
                  ? 'পোড়াই মিস্ত্রির হিসাব আপডেট করুন'
                  : '+ পোড়াই মিস্ত্রি (চুল্লির হিসাব) সেভ করুন'}
              </button>
            </form>

            {/* Porai Mistri Ledger Table */}
            <div className="lg:col-span-8 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">পোড়াই মিস্ত্রির নাম ও রাউন্ড</th>
                    <th className="py-3 px-3 font-bold text-right">চুল্লিতে ইট (পিস)</th>
                    <th className="py-3 px-3 font-bold text-right">রেট (/হাজার)</th>
                    <th className="py-3 px-3 font-bold text-right">মোট টাকা পাবে (বিল)</th>
                    <th className="py-3 px-3 font-bold text-right">জমা দেওয়া টাকা</th>
                    <th className="py-3 px-3 font-bold text-right">আর পাবে কত (বাকি)</th>
                    <th className="py-3 px-3 font-bold text-right">টাকা জমা ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {poraiMistriRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-500">
                        এখনো পোড়াই মিস্ত্রির (চুল্লির হিসাব) কোনো এন্ট্রি করা হয়নি। বাম পাশের ফর্ম থেকে নতুন হিসাব যোগ করুন।
                      </td>
                    </tr>
                  ) : (
                    poraiMistriRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-rose-50/30">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">
                            {rec.mistriName} — <span className="text-rose-700">{rec.chamberOrRound}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {rec.date} {rec.note ? `· ${rec.note}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono tabular-nums">
                          {formatBn(rec.bricksFired)} পিস
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          ৳{formatBn(rec.ratePerThousand)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrencyBn(rec.totalBill)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                          {formatCurrencyBn(rec.paidAmount)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums">
                          {formatCurrencyBn(rec.dueAmount)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                openDepositModal({ type: 'PORAI_MISTRI', record: rec })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              + টাকা জমা দিন
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
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="py-3 px-3">সর্বমোট পোড়াই মিস্ত্রি হিসাব:</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(totalPoraiBricks)} পিস
                    </td>
                    <td className="py-3 px-3 text-right">—</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatCurrencyBn(totalPoraiBill)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800 tabular-nums">
                      {formatCurrencyBn(totalPoraiPaid)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-800 tabular-nums">
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
            'পোড়াই মিস্ত্রি (চুল্লির হিসাব) — টাকা জমা দেওয়ার রেকর্ড খতিয়ান',
            'পোড়াই মিস্ত্রিকে কবে কত টাকা জমা দেওয়া হয়েছে তার সম্পূর্ণ তালিকা',
            poraiPayments,
            'orange'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 3: CHULLI UNLOAD / PORANO BRICK BAHIR (হাজার প্রতি ৭৫০ টাকা)
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'CHULLI_UNLOAD') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-600" />
                আনলোড হিসাব — চুল্লি থেকে কয় নং ইট কতগুলো বার করলো, বিল ও জমা দেওয়ার টাকা
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                চুল্লি থেকে তারা মোট কতগুলো ইট বার করলো, কয় নং ইট কতগুলো বার করলো (`১ নং`, `১.৫ নং`, `২ নং`, `৩ নং`, `পিকেট`), তাদের বিল (@ ৭৫০ টাকা/হাজার) এবং জমা দেওয়ার টাকার সম্পূর্ণ হিসাব ও রেকর্ড।
              </p>
            </div>

            {chulliUnloads.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const target =
                    chulliUnloads.find((u) => u.dueAmount > 0) || chulliUnloads[0];
                  if (target) {
                    openDepositModal({ type: 'CHULLI_UNLOAD', record: target });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer shrink-0"
              >
                <Banknote className="w-4 h-4" />
                + আনলোড বাবদ টাকা জমা দিন
              </button>
            )}
          </div>

          {/* Unload Grade Breakdown & Financial Summary Strip */}
          <div className="bg-orange-50/70 border-2 border-orange-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-orange-200/80">
              <div>
                <span className="text-xs text-slate-600 block">মোট বার করা পোড়ানো ইট</span>
                <strong className="text-base font-bold font-mono text-slate-900 tabular-nums">
                  {formatBn(totalUnloadedBricks)} পিস
                </strong>
              </div>
              <div>
                <span className="text-xs text-slate-600 block">তাদের মোট বিল (@ ৭৫০৳/হাজার)</span>
                <strong className="text-base font-bold font-mono text-slate-900 tabular-nums">
                  {formatCurrencyBn(totalUnloadBill)}
                </strong>
              </div>
              <div>
                <span className="text-xs text-emerald-800 font-semibold block">
                  জমা দেওয়া টাকা (পরিশোধিত)
                </span>
                <strong className="text-base font-bold font-mono text-emerald-700 tabular-nums">
                  {formatCurrencyBn(totalUnloadPaid)}
                </strong>
              </div>
              <div>
                <span className="text-xs text-rose-800 font-semibold block">
                  তারা আর পাবে (বাকি বিল)
                </span>
                <strong className="text-base font-bold font-mono text-rose-700 tabular-nums">
                  {formatCurrencyBn(totalUnloadDue)}
                </strong>
              </div>
            </div>

            {/* Grade-wise Total Unloaded Summary */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-800">
                কয় নং ইট মোট কতগুলো বার করলো:
              </span>
              {unloadedTotalsByGrade.map((g) => (
                <span
                  key={g.gradeId}
                  className="px-2.5 py-1 rounded-lg bg-white border border-orange-200 text-slate-900 font-semibold"
                >
                  {g.nameBn}: <strong className="text-orange-700 font-mono">{formatBn(g.qty)} পিস</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Chulli Unload Form */}
            <form
              onSubmit={handleChulliUnloadSubmit}
              className="lg:col-span-5 bg-orange-50/50 border border-orange-200 rounded-xl p-4 space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4 text-orange-600" />
                পোড়ানো ইট আনলোড (বাহির) ও জমা টাকা এন্ট্রি
              </h4>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    আনলোড সর্দার *
                  </label>
                  <input
                    type="text"
                    required
                    value={unloadSardarName}
                    onChange={(e) => setUnloadSardarName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    চেম্বার / রাউন্ড
                  </label>
                  <input
                    type="text"
                    value={unloadChamber}
                    onChange={(e) => setUnloadChamber(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    হাজারে রেট (৳) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={unloadRatePerThousand}
                    onChange={(e) => setUnloadRatePerThousand(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Grade-wise Unloaded Quantities */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  কয় নং ইট কত পিস বার করলো লিখুন (স্টকে যোগ হবে):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {brickGrades.map((g) => (
                    <div key={g.id} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        {cleanBrickGradeName(g.nameBn)}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={unloadGradeQtys[g.id] ?? '0'}
                        onChange={(e) =>
                          setUnloadGradeQtys((prev) => ({
                            ...prev,
                            [g.id]: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-1 text-xs font-bold font-mono bg-white border border-slate-300 rounded tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    জমা দেওয়ার টাকা (Paid ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unloadPaidAmount}
                    onChange={(e) => setUnloadPaidAmount(e.target.value)}
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

              {/* Live Unload Calculation */}
              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">মোট বার করা ইট:</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatBn(liveTotalUnloadBricks)} পিস
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    তাদের মোট বিল (@ ৳{formatBn(liveUnloadRate)}/হাজার):
                  </span>
                  <strong className="text-amber-300 font-mono">
                    {formatCurrencyBn(liveUnloadTotalBill)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">জমা দেওয়া টাকা:</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrencyBn(liveUnloadPaid)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">তারা আর পাবে (বাকি):</span>
                  <strong className="text-rose-400 font-mono">
                    {formatCurrencyBn(liveUnloadDue)}
                  </strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingUnload}
                className="w-full py-2.5 px-4 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {savingUnload
                  ? 'স্টকে যুক্ত হচ্ছে...'
                  : '+ আনলোড হিসাব ও পোড়ানো ইট স্টকে সেভ করুন'}
              </button>
            </form>

            {/* Chulli Unload Ledger Table */}
            <div className="lg:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-3 px-3 font-bold">তারিখ ও আনলোড সর্দার</th>
                    <th className="py-3 px-3 font-bold">কয় নং ইট কতগুলো বার করলো</th>
                    <th className="py-3 px-3 font-bold text-right">মোট বার করা ইট</th>
                    <th className="py-3 px-3 font-bold text-right">তাদের বিল (@৭৫০৳)</th>
                    <th className="py-3 px-3 font-bold text-right">জমা দেওয়া টাকা</th>
                    <th className="py-3 px-3 font-bold text-right">আর পাবে (বাকি)</th>
                    <th className="py-3 px-3 font-bold text-right">টাকা জমা ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chulliUnloads.map((un) => (
                    <tr key={un.id} className="hover:bg-orange-50/30">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{un.sardarName}</div>
                        <div className="text-[11px] text-slate-500">
                          {un.date} · {un.chamberOrRound}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {un.unloadedByGrade.map((it, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-[11px] font-bold rounded bg-orange-50 text-orange-900 border border-orange-200"
                            >
                              {cleanBrickGradeName(it.gradeName)}: {formatBn(it.quantity)} পিস
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono tabular-nums">
                        {formatBn(un.totalBricksUnloaded)} পিস
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(un.totalBill)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrencyBn(un.paidAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums">
                        {formatCurrencyBn(un.dueAmount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openDepositModal({ type: 'CHULLI_UNLOAD', record: un })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            + টাকা জমা দিন
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
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td colSpan={2} className="py-3 px-3">সর্বমোট আনলোড হিসাব:</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(totalUnloadedBricks)} পিস
                    </td>
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
            'আনলোড হিসাব — টাকা জমা দেওয়ার রেকর্ড খতিয়ান',
            'চুল্লি থেকে পোড়ানো ইট আনলোড সর্দার ও দলকে কবে কত টাকা জমা দেওয়া হয়েছে তার সম্পূর্ণ রেকর্ড',
            unloadPayments,
            'emerald'
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 4: FIRED BRICK GRADE STOCK & SALES REPORT TABLE
         ===================================================================== */}
      {(sectionView === 'ALL' || sectionView === 'FIRED_STOCK') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-700" />
                পোড়ানো ইটের বর্তমান স্টক ও বিক্রয় রিপোর্ট (১ নং · ১.৫ নং · ২ নং · ৩ নং · পিকেট)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                চুল্লি আনলোড থেকে প্রাপ্ত পোড়ানো ইটের বর্তমান স্টক এবং মেমো অনুযায়ী দৈনিক ও সিজনের বিক্রির হিসাব।
              </p>
            </div>

            {/* Quick Manual Stock / Rate Adjust Form */}
            <form
              onSubmit={handleStockSubmit}
              className="flex flex-wrap items-end gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  ইটের ধরন
                </label>
                <select
                  value={selectedGradeId}
                  onChange={(e) => setSelectedGradeId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                >
                  {brickGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {cleanBrickGradeName(g.nameBn)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  স্টক যোগ (পিস)
                </label>
                <input
                  type="number"
                  min={1}
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-24 px-2.5 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  হাজারে দর (ঐচ্ছিক ৳)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: 11000"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-28 px-2.5 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={submittingStock}
                className="px-3.5 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg cursor-pointer"
              >
                {submittingStock ? '...' : '+ স্টক আপডেট'}
              </button>
            </form>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                  <th className="py-3 px-4 font-bold">ইটের ধরন (Brick Type)</th>
                  <th className="py-3 px-4 font-bold text-right">হাজার প্রতি দর (৳)</th>
                  <th className="py-3 px-4 font-bold text-right">বর্তমান পোড়ানো স্টক (পিস)</th>
                  <th className="py-3 px-4 font-bold text-right">আজকের বিক্রি (পিস)</th>
                  <th className="py-3 px-4 font-bold text-right">আজকের টাকা</th>
                  <th className="py-3 px-4 font-bold text-right">গতকালের বিক্রি</th>
                  <th className="py-3 px-4 font-bold text-right">সিজনের মোট বিক্রি (পিস)</th>
                  <th className="py-3 px-4 font-bold text-right">সিজনের মোট টাকা</th>
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
                  }) => (
                    <tr key={grade.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {cleanBrickGradeName(grade.nameBn)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">
                        {formatCurrencyBn(
                          grade.ratePerUnit < 100
                            ? Math.round(grade.ratePerUnit * 1000)
                            : grade.ratePerUnit
                        )}{' '}
                        / হাজার
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        {formatBn(grade.currentStock)} পিস
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-800">
                        {formatBn(todayQty)} পিস
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                        {formatCurrencyBn(todayAmount)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                        {formatBn(yesterdayQty)} পিস
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                        {formatBn(seasonSoldQty)} পিস
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-800 tabular-nums">
                        {formatCurrencyBn(seasonSoldAmount)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <td colSpan={2} className="py-3.5 px-4 text-right">
                    সর্বমোট পোড়ানো ইট স্টক ও বিক্রি:
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-800 tabular-nums">
                    {formatBn(totals.brickStockPieces)} পিস
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
                  <td className="py-3.5 px-4 text-right tabular-nums">
                    {formatBn(totals.seasonBrickQty)} পিস
                  </td>
                  <td className="py-3.5 px-4 text-right text-amber-900 tabular-nums">
                    {formatCurrencyBn(totals.seasonTotalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
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

            <form onSubmit={handleConfirmDeposit} className="p-5 space-y-4">
              {/* Current Balance Breakdown */}
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
                    <div className="flex justify-between">
                      <span className="text-slate-600">মোট টাকা পাবে (বিল):</span>
                      <strong className="text-slate-900 font-mono">
                        {formatCurrencyBn(depositTarget.record.totalPayable)}
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
                      <span className="text-slate-600">লোড দেওয়া ইট ও ভ্যান:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatBn(depositTarget.record.rawBricksLoaded)} পিস ({formatBn(depositTarget.record.vanCount)} ভ্যান @ ৳{formatBn(depositTarget.record.ratePerVan)})
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">মোট কত টাকা হলো (বিল):</span>
                      <strong className="text-slate-900 font-mono">
                        {formatCurrencyBn(depositTarget.record.totalBill)}
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
                    <div className="flex justify-between">
                      <span className="text-slate-600">পোড়াই মিস্ত্রির মোট বিল:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatCurrencyBn(depositTarget.record.totalBill)}
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
                        {formatBn(depositTarget.record.totalBricksUnloaded)} পিস (@ ৳{formatBn(depositTarget.record.ratePerThousand)}/হাজার)
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">তাদের মোট বিল:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatCurrencyBn(depositTarget.record.totalBill)}
                      </strong>
                    </div>
                  </>
                )}

                <div className="flex justify-between pt-1.5 border-t border-slate-200">
                  <span className="text-emerald-700 font-semibold">আগে জমা দেওয়া হয়েছে:</span>
                  <strong className="text-emerald-700 font-mono">
                    {formatCurrencyBn(depositTarget.record.paidAmount)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700 font-semibold">বর্তমানে বাকি পাবে:</span>
                  <strong className="text-rose-700 font-mono">
                    {formatCurrencyBn(depositTarget.record.dueAmount)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  এখন কত টাকা জমা দিচ্ছেন (৳) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  autoFocus
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-bold font-mono bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-950 tabular-nums focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[500, 1000, 2000, 5000, 10000].map((amt) => (
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
                      onClick={() =>
                        setDepositAmount(String(depositTarget.record.dueAmount))
                      }
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white cursor-pointer"
                    >
                      সম্পূর্ণ বাকি (৳{formatBn(depositTarget.record.dueAmount)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: নগদ হাটবার / কিস্তি জমা..."
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
                  disabled={submittingDeposit}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submittingDeposit ? 'জমা হচ্ছে...' : 'টাকা জমা কনফার্ম করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
