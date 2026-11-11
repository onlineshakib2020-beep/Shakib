import React, { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  Eye,
  Factory,
  FilePlus2,
  Flame,
  Globe,
  Layers,
  LayoutDashboard,
  MapPin,
  Phone,
  Printer,
  StickyNote,
  Trash2,
  TrendingDown,
  Truck,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  BusinessAnalysisReport,
  CashTxType,
  DashboardMetrics,
  GradeReportRow,
  KilnDatabaseState,
  KpiCardId,
  LanguageMode,
  MillId,
  NavigationTab,
  PaymentMethod,
  SalesMemo,
  UnloadedGradeItem,
} from './types/kiln';
import {
  calculateDashboardMetrics,
  calculateMultiItemMemoTotals,
  calculateRowTotal,
  cleanBrickGradeName,
  computeBrickGradeReport,
  computeComprehensiveBusinessAnalysis,
  formatBn,
  formatCurrencyBn,
  generateUniqueMemoNo,
} from './utils/kilnLogic';
import { createInitialKilnState, getTodayAndYesterday } from './utils/seedData';
import { KpiCardsStrip } from './components/KpiCardsStrip';
import { KpiReportModal } from './components/KpiReportModal';
import { MemoPrintModal } from './components/MemoPrintModal';
import { BrickGradeReportTab } from './components/BrickGradeReportTab';
import { LabourSectionTab } from './components/LabourSectionTab';
import { SalesLedgerTab } from './components/SalesLedgerTab';
import { CashBookTab } from './components/CashBookTab';
import { NewMemoStudio } from './components/NewMemoStudio';
import { MemoActionModals } from './components/MemoActionModals';

interface EnrichedPayload {
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
  businessAnalysis?: BusinessAnalysisReport;
}

interface DraftMemoItem {
  gradeId: string;
  quantity: string;
  ratePerThousand: string;
}

export default function App() {
  const initialSeed = createInitialKilnState();
  const { todayDate, yesterdayDate } = getTodayAndYesterday();

  const [lang, setLang] = useState<LanguageMode>('bn');
  const isEn = lang === 'en';

  const [dbState, setDbState] = useState<KilnDatabaseState>(initialSeed);
  const [metrics, setMetrics] = useState<DashboardMetrics>(() =>
    calculateDashboardMetrics(initialSeed, todayDate, yesterdayDate)
  );
  const [gradeReport, setGradeReport] = useState(() =>
    computeBrickGradeReport(
      initialSeed.brickGrades,
      initialSeed.salesMemos,
      todayDate,
      yesterdayDate
    )
  );
  const [businessAnalysis, setBusinessAnalysis] = useState<BusinessAnalysisReport>(() =>
    computeComprehensiveBusinessAnalysis(initialSeed, todayDate, yesterdayDate)
  );

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [activeKpiModal, setActiveKpiModal] = useState<KpiCardId | null>(null);
  const [printMemoTarget, setPrintMemoTarget] = useState<SalesMemo | null>(null);

  // Unified Memo Popup Modals State
  const [isNewMemoModalOpen, setIsNewMemoModalOpen] = useState(false);
  const [viewMemoTarget, setViewMemoTarget] = useState<SalesMemo | null>(null);
  const [dueModalMemoTarget, setDueModalMemoTarget] = useState<SalesMemo | null>(null);
  const [editModalMemoTarget, setEditModalMemoTarget] = useState<SalesMemo | null>(null);
  const [deleteMemoTarget, setDeleteMemoTarget] = useState<SalesMemo | null>(null);

  // Toast Notification State (No window.alert!)
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    []
  );

  const applyEnrichedState = useCallback((data: EnrichedPayload) => {
    if (data && data.state) {
      setDbState(data.state);
      if (data.metrics) setMetrics(data.metrics);
      if (data.gradeReport) setGradeReport(data.gradeReport);
      if (data.businessAnalysis) {
        setBusinessAnalysis(data.businessAnalysis);
      } else {
        const { todayDate: td, yesterdayDate: yd } = getTodayAndYesterday();
        setBusinessAnalysis(computeComprehensiveBusinessAnalysis(data.state, td, yd));
      }
      // Keep any open memo modal target instantaneously synced with updated salesMemos
      setViewMemoTarget((prev) =>
        prev ? data.state.salesMemos.find((m) => m.id === prev.id) || prev : null
      );
      setDueModalMemoTarget((prev) =>
        prev ? data.state.salesMemos.find((m) => m.id === prev.id) || prev : null
      );
      setEditModalMemoTarget((prev) =>
        prev ? data.state.salesMemos.find((m) => m.id === prev.id) || prev : null
      );
    }
  }, []);

  // Initial Fetch & SSE Subscription
  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data: EnrichedPayload) => {
        applyEnrichedState(data);
      })
      .catch(() => {});

    const es = new EventSource('/api/events');
    es.addEventListener('STATE_UPDATED', (evt) => {
      try {
        const parsed = JSON.parse((evt as MessageEvent).data) as EnrichedPayload;
        applyEnrichedState(parsed);
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
  }, [applyEnrichedState]);

  // New Sales Memo Form State (Per-1,000 Brick Rate: e.g. 1000 bricks @ 11000 = 11000 Tk, 500 bricks = 5500 Tk)
  const nextAutoMemoNo = generateUniqueMemoNo(dbState.salesMemos).memoNo;
  const [memoNo, setMemoNo] = useState(() => generateUniqueMemoNo(initialSeed.salesMemos).memoNo);
  const [memoCustomer, setMemoCustomer] = useState('');
  const [memoPhone, setMemoPhone] = useState('');
  const [memoAddress, setMemoAddress] = useState('বাবুলিয়া, সাতক্ষীরা');
  const [memoDate, setMemoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memoVehicleType, setMemoVehicleType] = useState('ট্রাক (Truck)');
  const [memoTruck, setMemoTruck] = useState('সাতক্ষীরা-ট-১১-');
  const [memoDriver, setMemoDriver] = useState('');
  const [memoDriverPhone, setMemoDriverPhone] = useState('');
  const [memoDeliveryStatus, setMemoDeliveryStatus] = useState<
    'DELIVERED' | 'LOADING' | 'BOOKING'
  >('DELIVERED');
  const [memoDuePromiseDate, setMemoDuePromiseDate] = useState('');
  const [memoNote, setMemoNote] = useState('');
  const [memoItems, setMemoItems] = useState<DraftMemoItem[]>([
    { gradeId: 'grade-1', quantity: '1000', ratePerThousand: '11000' },
  ]);
  const [memoDiscount, setMemoDiscount] = useState('0');
  const [memoPaid, setMemoPaid] = useState('11000');
  const [memoMethod, setMemoMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [creatingMemo, setCreatingMemo] = useState(false);

  // Sync memoNo with nextAutoMemoNo whenever salesMemos updates
  useEffect(() => {
    const autoNo = generateUniqueMemoNo(dbState.salesMemos).memoNo;
    setMemoNo(autoNo);
  }, [dbState.salesMemos]);

  // Scroll to top smoothly whenever activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Dashboard Quick Expense Form State
  const [quickExpCategory, setQuickExpCategory] = useState('কয়লা ক্রয়');
  const [quickExpAmount, setQuickExpAmount] = useState('');
  const [quickExpDesc, setQuickExpDesc] = useState('');

  // Dashboard Urgent Note Form State
  const [noteInput, setNoteInput] = useState('');
  const [notePriority, setNotePriority] = useState<'URGENT' | 'NORMAL'>('URGENT');

  // Compute live multi-item memo totals (Per-1,000 Brick Rate: (quantity / 1000) * rate)
  const computedItems = memoItems.map((row) => {
    const g =
      dbState.brickGrades.find((item) => item.id === row.gradeId) ||
      dbState.brickGrades[0];
    const qty = Math.max(0, Number(row.quantity) || 0);
    const rate = Math.max(0, Number(row.ratePerThousand) || 0);
    const lineTotal = calculateRowTotal(qty, rate, true);
    return {
      gradeId: row.gradeId,
      gradeName: cleanBrickGradeName(g ? g.nameBn : '১ নং ইট'),
      quantity: qty,
      rate,
      ratePerThousand: true,
      lineTotal,
    };
  });

  const liveMemoCalc = calculateMultiItemMemoTotals({
    items: computedItems,
    discount: Number(memoDiscount) || 0,
    paidAmount: Number(memoPaid) || 0,
  });

  const handleUpdateMemoItem = (
    idx: number,
    patch: Partial<DraftMemoItem>,
    autoSyncPaid = true
  ) => {
    setMemoItems((prev) => {
      const next = prev.map((item, i) => {
        if (i !== idx) return item;
        return { ...item, ...patch };
      });
      if (autoSyncPaid) {
        const nextComputed = next.map((r) => {
          const q = Math.max(0, Number(r.quantity) || 0);
          const rt = Math.max(0, Number(r.ratePerThousand) || 0);
          return calculateRowTotal(q, rt, true);
        });
        const nextSub = Math.round(nextComputed.reduce((a, b) => a + b, 0));
        const disc = Math.max(0, Number(memoDiscount) || 0);
        setMemoPaid(String(Math.max(0, nextSub - disc)));
      }
      return next;
    });
  };

  const handleAddMemoRow = () => {
    const fallbackGrade =
      dbState.brickGrades.find(
        (g) => !memoItems.some((row) => row.gradeId === g.id)
      ) || dbState.brickGrades[0];
    const newRow: DraftMemoItem = {
      gradeId: fallbackGrade.id,
      quantity: '1000',
      ratePerThousand: '11000',
    };
    setMemoItems((prev) => {
      const next = [...prev, newRow];
      const nextComputed = next.map((r) => {
        const q = Math.max(0, Number(r.quantity) || 0);
        const rt = Math.max(0, Number(r.ratePerThousand) || 0);
        return calculateRowTotal(q, rt, true);
      });
      const nextSub = Math.round(nextComputed.reduce((a, b) => a + b, 0));
      const disc = Math.max(0, Number(memoDiscount) || 0);
      setMemoPaid(String(Math.max(0, nextSub - disc)));
      return next;
    });
  };

  const handleRemoveMemoRow = (idx: number) => {
    if (memoItems.length <= 1) return;
    setMemoItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const nextComputed = next.map((r) => {
        const q = Math.max(0, Number(r.quantity) || 0);
        const rt = Math.max(0, Number(r.ratePerThousand) || 0);
        return calculateRowTotal(q, rt, true);
      });
      const nextSub = Math.round(nextComputed.reduce((a, b) => a + b, 0));
      const disc = Math.max(0, Number(memoDiscount) || 0);
      setMemoPaid(String(Math.max(0, nextSub - disc)));
      return next;
    });
  };

  const handleResetMemoForm = () => {
    const defaultGrade = dbState.brickGrades[0] || { id: 'grade-1', ratePerUnit: 11000 };
    setMemoNo(generateUniqueMemoNo(dbState.salesMemos).memoNo);
    setMemoCustomer('');
    setMemoPhone('');
    setMemoAddress('বাবুলিয়া, সাতক্ষীরা');
    setMemoDate(new Date().toISOString().slice(0, 10));
    setMemoVehicleType('ট্রাক (Truck)');
    setMemoTruck('সাতক্ষীরা-ট-১১-');
    setMemoDriver('');
    setMemoDriverPhone('');
    setMemoDeliveryStatus('DELIVERED');
    setMemoDuePromiseDate('');
    setMemoNote('');
    setMemoItems([
      {
        gradeId: defaultGrade.id,
        quantity: '1000',
        ratePerThousand: '11000',
      },
    ]);
    setMemoDiscount('0');
    setMemoPaid('11000');
    setMemoMethod('নগদ ক্যাশ');
  };

  const handleCreateMemoSubmit = async (
    e: React.FormEvent,
    printAfterSave = false
  ) => {
    e.preventDefault();
    if (!memoCustomer.trim()) {
      showToast('ক্রেতার নাম লিখুন।', 'error');
      const el = document.getElementById('memo-customer-input');
      el?.focus();
      return;
    }
    setCreatingMemo(true);
    try {
      const primaryItem = computedItems[0];
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoNo: memoNo.trim() || nextAutoMemoNo,
          customerName: memoCustomer.trim(),
          customerPhone: memoPhone.trim() || '—',
          customerAddress: memoAddress.trim() || 'বাবুলিয়া, সাতক্ষীরা',
          date: memoDate,
          vehicleType: memoVehicleType,
          truckNo: memoTruck.trim() || '—',
          driverName: memoDriver.trim() || '—',
          driverPhone: memoDriverPhone.trim() || '—',
          deliveryStatus: memoDeliveryStatus,
          duePromiseDate: memoDuePromiseDate,
          note: memoNote.trim(),
          items: computedItems,
          gradeId: primaryItem?.gradeId || 'grade-1',
          quantity: primaryItem?.quantity || 1000,
          rate: primaryItem?.rate || 11000,
          discount: Number(memoDiscount) || 0,
          paidAmount: Number(memoPaid) || 0,
          paymentMethod: memoMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'মেমো তৈরিতে ত্রুটি হয়েছে।', 'error');
        return;
      }
      applyEnrichedState(data);
      const nextMemo = data?.state?.salesMemos
        ? generateUniqueMemoNo(data.state.salesMemos).memoNo
        : nextAutoMemoNo;
      setMemoNo(nextMemo);
      setMemoCustomer('');
      setMemoPhone('');
      setMemoDriver('');
      setMemoDriverPhone('');
      setMemoDuePromiseDate('');
      setMemoNote('');
      setMemoDiscount('0');
      setIsNewMemoModalOpen(false);
      if (printAfterSave && data.memo) {
        setPrintMemoTarget(data.memo);
      }
      showToast(
        `নতুন ক্যাশ মেমো (${data.memo.memoNo}) সফলভাবে তৈরি ও স্টকে সমন্বয় হয়েছে!`
      );
    } finally {
      setCreatingMemo(false);
    }
  };

  const handleQuickExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(quickExpAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('খরচের সঠিক পরিমাণ লিখুন।', 'error');
      return;
    }
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'OUT',
        category: quickExpCategory,
        amount: amt,
        description: quickExpDesc.trim() || `${quickExpCategory} বাবদ তাৎক্ষণিক খরচ`,
        paymentMethod: 'নগদ ক্যাশ',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      setQuickExpAmount('');
      setQuickExpDesc('');
      showToast(
        `${quickExpCategory} খাতে ${formatCurrencyBn(amt)} খরচ ক্যাশ বুকে যোগ হয়েছে।`
      );
    }
  };

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: noteInput.trim(),
        priority: notePriority,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      setNoteInput('');
      showToast('জরুরি নোট সেভ করা হয়েছে।');
    }
  };

  const handleToggleNote = async (id: string, completed: boolean) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) applyEnrichedState(await res.json());
  };

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.ok) applyEnrichedState(await res.json());
  };

  const handleCollectDue = async (
    memoId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => {
    const res = await fetch(`/api/memos/${memoId}/collect-due`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paymentMethod, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'বকেয়া আদায়ে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(
      `বকেয়া ${formatCurrencyBn(amount)} সফলভাবে আদায় ও মেমোর বিস্তারিত রেকর্ডে যোগ হয়েছে!`
    );
  };

  const handleUpdateMemo = async (memoId: string, payload: Partial<SalesMemo>) => {
    const res = await fetch(`/api/memos/${memoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'মেমো আপডেট ব্যর্থ হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast('মেমো সফলভাবে সংশোধন করা হয়েছে।');
  };

  const handleDeleteMemo = async (memoId: string) => {
    const res = await fetch(`/api/memos/${memoId}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('মেমো ডিলিট ও ইট স্টক সমন্বয় করা হয়েছে।');
    }
  };

  const handleAddStock = async (
    gradeId: string,
    quantity: number,
    newRate?: number
  ) => {
    const res = await fetch('/api/inventory/add-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeId, quantity, newRate }),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast(`ইট স্টকে +${formatBn(quantity)} পিস যোগ করা হয়েছে।`);
    }
  };

  // Production Handlers (3 Mills Pot, Chulli Van Load, Chulli Unload)
  const handleSaveMillPot = async (payload: {
    id?: string;
    millId: MillId;
    potNo: string;
    date: string;
    rawBricksCut: number;
    takenToChulli: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/mill-pot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(`মিল পট (${payload.potNo}) ও কাঁচা ইটের হিসাব সংরক্ষিত হয়েছে!`);
    } else {
      showToast(data.error || 'পট হিসাব সংরক্ষণে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteMillPot = async (id: string) => {
    const res = await fetch(`/api/production/mill-pot/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('মিল পট এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveChulliLoad = async (payload: {
    id?: string;
    date: string;
    sardarName: string;
    rawBricksLoaded: number;
    ratePerVan: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/chulli-load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `${payload.sardarName}-এর ভ্যান লোড (${formatBn(payload.rawBricksLoaded)} পিস) ও জমা টাকা সংরক্ষিত হয়েছে!`
      );
    } else {
      showToast(data.error || 'চুল্লি লোড এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteChulliLoad = async (id: string) => {
    const res = await fetch(`/api/production/chulli-load/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('ভ্যান লোড এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveChulliUnload = async (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    ratePerThousand: number;
    unloadedByGrade?: UnloadedGradeItem[];
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/chulli-unload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      if (payload.unloadedByGrade && payload.unloadedByGrade.length > 0) {
        const totalAdded = payload.unloadedByGrade.reduce(
          (s, i) => s + i.quantity,
          0
        );
        showToast(
          `চুল্লি থেকে ${formatBn(totalAdded)} পিস পোড়ানো ইট আনলোড হয়ে স্টকে যোগ হয়েছে!`
        );
      } else {
        showToast('আনলোড বাবদ জমা টাকা খতিয়ান ও ক্যাশ বুকে সংরক্ষিত হয়েছে!');
      }
    } else {
      showToast(data.error || 'চুল্লি আনলোড এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteChulliUnload = async (id: string) => {
    const res = await fetch(`/api/production/chulli-unload/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('আনলোড এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSavePoraiMistri = async (payload: {
    id?: string;
    date: string;
    mistriName: string;
    chamberOrRound: string;
    bricksFired: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/porai-mistri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `পোড়াই মিস্ত্রি (${payload.mistriName} - ${payload.chamberOrRound})-এর চুল্লি হিসাব ও জমা টাকা সংরক্ষিত হয়েছে!`
      );
    } else {
      showToast(data.error || 'পোড়াই মিস্ত্রি এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeletePoraiMistri = async (id: string) => {
    const res = await fetch(`/api/production/porai-mistri/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('পোড়াই মিস্ত্রি এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleDeleteProductionPayment = async (id: string) => {
    const res = await fetch(`/api/production/payment-record/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('টাকা জমা দেওয়ার রেকর্ড মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveWorkerProfile = async (payload: {
    id?: string;
    name: string;
    role: string;
    phone: string;
    morningRate: number;
    afternoonRate: number;
  }) => {
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast(`${payload.name}-এর প্রোফাইল ও শিফট রেট সংরক্ষিত হয়েছে।`);
    }
  };

  const handleToggleWorkerHajira = async (payload: {
    workerId: string;
    date: string;
    morningPresent: boolean;
    afternoonPresent: boolean;
    morningRate: number;
    afternoonRate: number;
    note?: string;
  }) => {
    const res = await fetch('/api/workers/hajira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      const earned =
        (data.attendance.morningAmount || 0) + (data.attendance.afternoonAmount || 0);
      showToast(
        `${data.attendance.workerName}-এর সবুজ হাজিরা আপডেট হয়েছে (আজকের বিল: ${formatCurrencyBn(earned)})`
      );
    } else {
      showToast(data.error || 'হাজিরা আপডেট করতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handlePayWorker = async (payload: {
    workerId: string;
    amount: number;
    paymentType: string;
    date: string;
    note: string;
  }) => {
    const res = await fetch('/api/workers/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `${data.attendance.workerName}-কে ${formatCurrencyBn(
          data.attendance.totalPaid
        )} জমা দেওয়া হয়েছে ও ক্যাশ খরচে যুক্ত হয়েছে!`
      );
    } else {
      showToast(data.error || 'লেবার টাকা জমা দিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleSaveWorkerAttendance = async (payload: {
    workerId: string;
    morningPresent: boolean;
    afternoonPresent: boolean;
    customMorningRate: number;
    customAfternoonRate: number;
    khorakiAmount: number;
    hatbarAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/workers/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `${data.attendance.workerName}-এর হাজিরা ও পেমেন্ট (${formatCurrencyBn(
          data.attendance.totalPaid
        )}) ক্যাশ খরচে যুক্ত হয়েছে!`
      );
    }
  };

  const handleAddCashTx = async (payload: {
    type: CashTxType;
    category: string;
    amount: number;
    description: string;
    paymentMethod: PaymentMethod;
  }) => {
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast(
        `ক্যাশ বুকে ${payload.category} (${formatCurrencyBn(payload.amount)}) সংরক্ষিত হয়েছে।`
      );
    }
  };

  const handleUpdateCashTx = async (
    id: string,
    payload: {
      type?: CashTxType;
      category?: string;
      amount?: number;
      description?: string;
      paymentMethod?: PaymentMethod;
      date?: string;
    }
  ) => {
    const res = await fetch(`/api/cash/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ক্যাশ লেনদেন আপডেট করতে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(`ক্যাশ লেনদেন (${payload.category || ''} - ${formatCurrencyBn(payload.amount || 0)}) আপডেট হয়েছে।`);
  };

  const handleDeleteCashTx = async (id: string) => {
    const res = await fetch(`/api/cash/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('ক্যাশ বুক লেনদেন মুছে ফেলা হয়েছে।');
    }
  };

  const handleExportDatabase = () => {
    window.location.href = '/api/backup/export';
    showToast('ডাটাবেস ব্যাকআপ JSON ডাউনলোড শুরু হয়েছে।');
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে।', 'error');
        return;
      }
      applyEnrichedState(data);
      showToast('ব্যাকআপ ফাইল থেকে সম্পূর্ণ ডাটাবেস সফলভাবে রিস্টোর হয়েছে!');
    } catch {
      showToast('সঠিক JSON ব্যাকআপ ফাইল নির্বাচন করুন।', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const navItems: Array<{
    id: NavigationTab;
    labelBn: string;
    labelEn: string;
    icon: React.ReactNode;
    countBn?: string;
  }> = [
    {
      id: 'dashboard',
      labelBn: 'ড্যাশবোর্ড ও মেমো',
      labelEn: 'Dashboard & Memo',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'memos',
      labelBn: 'মেমো খতিয়ান',
      labelEn: 'Memo Ledger',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
      countBn: formatBn(dbState.salesMemos.length),
    },
    {
      id: 'mill_hisab',
      labelBn: 'মিল হিসাব',
      labelEn: 'Mill Hisab',
      icon: <Factory className="w-4 h-4 shrink-0" />,
      countBn: formatBn((dbState.millPots || []).length),
    },
    {
      id: 'van_hisab',
      labelBn: 'ভ্যান হিসাব',
      labelEn: 'Van Hisab',
      icon: <Truck className="w-4 h-4 shrink-0" />,
      countBn: formatBn((dbState.chulliLoads || []).length),
    },
    {
      id: 'porai_mistri',
      labelBn: 'পোড়াই মিস্ত্রি',
      labelEn: 'Porai Mistri',
      icon: <Flame className="w-4 h-4 shrink-0 text-rose-400" />,
      countBn: formatBn((dbState.poraiMistriRecords || []).length),
    },
    {
      id: 'unload_hisab',
      labelBn: 'আনলোড হিসাব',
      labelEn: 'Unload Hisab',
      icon: <Flame className="w-4 h-4 shrink-0" />,
      countBn: formatBn((dbState.chulliUnloads || []).length),
    },
    {
      id: 'bricks',
      labelBn: 'ইট ও স্টক রিপোর্ট',
      labelEn: 'Bricks & Stock',
      icon: <Layers className="w-4 h-4 shrink-0" />,
      countBn: formatBn(dbState.brickGrades.length),
    },
    {
      id: 'labour',
      labelBn: 'লেবার খাতা',
      labelEn: 'Labour Book',
      icon: <Users className="w-4 h-4 shrink-0" />,
      countBn: formatBn(dbState.workerProfiles.length),
    },
    {
      id: 'cashbook',
      labelBn: 'ক্যাশ বুক',
      labelEn: 'Cash Book',
      icon: <Wallet className="w-4 h-4 shrink-0" />,
      countBn: formatBn(dbState.cashTransactions.length),
    },
  ];

  const maxChartVal = Math.max(
    1000,
    ...(metrics.sevenDayChart || []).map((d) =>
      Math.max(d.salesAmount, d.cashInAmount, d.expenseAmount)
    )
  );

  const dueMemos = dbState.salesMemos.filter((m) => m.dueAmount > 0);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Custom Toast Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
            toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Dark Navy / Charcoal Left Sidebar */}
      <aside
        aria-label="ভাটা সাইডবার নেভিগেশন"
        className="hidden xl:flex flex-col w-64 bg-[#0F172A] text-slate-100 border-r border-slate-800 shrink-0 sticky top-0 h-screen"
      >
        {/* Sidebar Brand Lockup */}
        <div className="px-5 py-5 border-b border-slate-800/90 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-white truncate">
              BrickFlow · সৌদিয়া ট্রেডার্স
            </div>
            <div className="text-xs text-orange-400 font-medium truncate">
              SBL মিষ্টি মাটির ইট · সাতক্ষীরা
            </div>
          </div>
        </div>

        {/* Language Toggle in Sidebar */}
        <div className="px-4 pt-4">
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setLang('bn')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                lang === 'bn'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              বাংলা (BN)
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                lang === 'en'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              English (EN)
            </button>
          </div>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 tracking-wide">
            {isEn ? 'KILN MANAGEMENT MENU' : 'ভাটা পরিচালনা মেনু'}
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-600 text-white font-semibold shadow-sm translate-x-0.5'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">
                    {isEn ? item.labelEn : item.labelBn}
                  </span>
                </span>
                {item.countBn && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md tabular-nums ${
                      isActive
                        ? 'bg-orange-700/80 text-white font-bold'
                        : 'bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {item.countBn}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Financial Quick Summary, Backup/Restore & Proprietor Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>{isEn ? 'Cash Balance:' : 'নগদ ক্যাশ তহবিল:'}</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {formatCurrencyBn(metrics.currentCashBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>{isEn ? 'Customer Due:' : 'মোট বকেয়া পাওনা:'}</span>
              <span className="font-bold text-rose-400 tabular-nums">
                {formatCurrencyBn(metrics.totalCustomerDue)}
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportDatabase}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              {isEn ? 'Backup' : 'ব্যাকআপ এক্সপোর্ট'}
            </button>
            <label className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              {isEn ? 'Restore' : 'ডাটা রিস্টোর'}
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreDatabase}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
            <div className="font-semibold text-slate-200">প্রোঃ মোঃ কামরুল ইসলাম</div>
            <div>পরিচালনায়ঃ সাকিব হোসেন</div>
            <div className="text-slate-500">বাবুলিয়া, সাতক্ষীরা সদর</div>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            BrickFlow · সৌদিয়া ট্রেডার্স
          </a>

          {/* Zone 2: Navigation Links */}
          <nav
            aria-label="প্রধান মেনু"
            className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 overflow-x-auto"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 px-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeTab === item.id
                    ? 'border-orange-600 text-orange-700 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {isEn ? item.labelEn : item.labelBn}
              </button>
            ))}
          </nav>

          {/* Zone 3: Language Switcher + Primary New Memo Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'bn' ? 'en' : 'bn'))}
              title="ভাষা পরিবর্তন করুন / Switch Language"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-orange-600" />
              {lang === 'bn' ? 'বাংলা | EN' : 'EN | বাংলা'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsNewMemoModalOpen(true);
                setTimeout(() => {
                  const el = document.getElementById('memo-customer-input');
                  el?.focus();
                }, 80);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer bg-orange-600 text-white hover:bg-orange-500 shadow-xs active:scale-[0.98]"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              {isEn ? '+ New Cash Memo' : '+ নতুন মেমো তৈরি'}
            </button>
          </div>
        </header>

        {/* Mobile Secondary Navigation Strip */}
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'bg-orange-700 text-white font-semibold'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isEn ? item.labelEn : item.labelBn}
            </button>
          ))}
        </div>

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
          {/* Official Kiln Proprietor Banner & KPI Cards Strip — Only on Dashboard */}
          {activeTab === 'dashboard' && (
            <>
              <section className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {isEn
                      ? 'Saudia Traders — SBL Sweet Clay Bricks (Babulia, Satkhira)'
                      : 'সৌদিয়া ট্রেডার্স — SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                      <Phone className="w-3.5 h-3.5 text-orange-700" />
                      প্রোঃ মোঃ কামরুল ইসলাম সাহেব (০১৯১৩-৬৭৮০১০)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                      <Phone className="w-3.5 h-3.5 text-orange-700" />
                      পরিচালনায়ঃ সাকিব হোসেন (০১৭২৮-২৮৭০১৮)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 lg:text-right space-y-0.5 shrink-0">
                  <div className="font-semibold text-slate-900">
                    {isEn
                      ? 'Kiln Season 2026-27 · Auto-Sync Active'
                      : 'ভাটা সিজন ২০২৬-২৭ · ডাটাবেস ও ক্যাশ বুক অটো-সিঙ্ক সক্রিয়'}
                  </div>
                  <div className="tabular-nums text-slate-500">
                    {isEn ? 'Date:' : 'আজকের তারিখ:'} {metrics.todayDate} ·{' '}
                    {isEn ? 'Total Memos:' : 'মোট মেমো:'}{' '}
                    {formatBn(dbState.salesMemos.length)}টি
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Active Tab View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* 1. DASHBOARD REPORT AT THE VERY TOP: 6 Clickable KPI Summary Cards + Today vs Yesterday Live Strip */}
              <KpiCardsStrip
                metrics={metrics}
                activeKpi={activeKpiModal}
                onSelectKpi={(id) => setActiveKpiModal(id)}
              />

              {/* 2. Executive Business Overview Strip at the Top */}
              <section className="bg-slate-900 text-white border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-white">
                          {isEn
                            ? 'Kiln Business Analytics & Financial Summary'
                            : 'ভাটা বিজনেস অ্যানালাইটিক্স ও আর্থিক সামারি'}
                        </h2>
                        <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-md tabular-nums">
                          হেলথ স্কোর: {formatBn(businessAnalysis.healthScore)}/১০০
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {businessAnalysis.healthLabelBn} · সেরা বিক্রিত ইট:{' '}
                        {cleanBrickGradeName(businessAnalysis.topSellingGrade.nameBn)} (
                        {formatBn(businessAnalysis.topSellingGrade.sharePct)}% মার্কেট শেয়ার)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('memos')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      <BookOpen className="w-4 h-4" />
                      {isEn ? 'View Memo Ledger' : 'মেমো খতিয়ান দেখুন'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('bricks')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-amber-400" />
                      {isEn ? 'Raw & Fired Brick Stock' : 'কাঁচা ও পোড়ানো ইট রিপোর্ট'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block">কালেকশন দক্ষতা (Collection Rate)</span>
                    <span className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
                      {formatBn(businessAnalysis.collectionEfficiencyPct)}%
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      নগদ আদায়: {formatCurrencyBn(businessAnalysis.totalCashIn)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block">গড় অর্ডার ভ্যালু (AOV / Memo)</span>
                    <span className="text-base font-bold text-amber-300 tabular-nums mt-0.5 block">
                      {formatCurrencyBn(businessAnalysis.averageOrderValue)}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      মোট মেমো: {formatBn(businessAnalysis.totalMemoCount)}টি
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block">স্টকের বাজারমূল্য (Inventory Value)</span>
                    <span className="text-base font-bold text-cyan-300 tabular-nums mt-0.5 block">
                      {formatCurrencyBn(businessAnalysis.totalInventoryValuation)}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      মজুত: {formatBn(businessAnalysis.totalInventoryPieces)} পিস ইট
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-400 block">সর্বোচ্চ বকেয়া ঝুঁকি (Top Debtor)</span>
                    <span className="text-sm font-bold text-rose-400 truncate mt-0.5 block">
                      {businessAnalysis.topDebtor ? businessAnalysis.topDebtor.name : 'কোনো বকেয়া নেই'}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {businessAnalysis.topDebtor
                        ? `${formatCurrencyBn(businessAnalysis.topDebtor.dueAmount)} (${formatBn(businessAnalysis.topDebtor.shareOfTotalDuePct)}% শেয়ার)`
                        : '১০০% পরিশোধিত'}
                    </span>
                  </div>
                </div>
              </section>

              {/* 3. FAST-ACTION ROW: Quick Expense Box & Urgent Kiln Notepad Side-by-Side */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch animate-slide-up">
                {/* Quick Expense Entry Box (তাৎক্ষণিক ভাটা খরচ এন্ট্রি বক্স) */}
                <form
                  onSubmit={handleQuickExpenseSubmit}
                  className="lg:col-span-6 bg-white border-2 border-rose-200/90 hover:border-rose-300 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-rose-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-xs shrink-0">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 mb-0.5">
                          দ্রুত ক্যাশ খরচ এন্ট্রি
                        </span>
                        <h2 className="text-base font-bold text-slate-900">
                          তাৎক্ষণিক ভাটা খরচ এন্ট্রি বক্স (Quick Expense)
                        </h2>
                        <p className="text-xs text-slate-500">
                          কয়লা, ভেকু ডিজেল, মাটি বা শ্রমিক খরচ ১-ক্লিকে সরাসরি ক্যাশ বুকে যোগ করুন
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="quick-exp-cat"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        খরচের খাত নির্বাচন করুন
                      </label>
                      <select
                        id="quick-exp-cat"
                        value={quickExpCategory}
                        onChange={(e) => setQuickExpCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-rose-500 focus:outline-hidden"
                      >
                        <option value="কয়লা ক্রয়">কয়লা ক্রয়</option>
                        <option value="ভেকু ও ডিজেল">ভেকু ও ডিজেল</option>
                        <option value="মাটি ক্রয়">মাটি ক্রয়</option>
                        <option value="শ্রমিক ও সর্দার পেমেন্ট">
                          শ্রমিক ও সর্দার পেমেন্ট
                        </option>
                        <option value="বিদ্যুৎ ও জ্বালানি">বিদ্যুৎ ও জ্বালানি</option>
                        <option value="অন্যান্য খরচ">অন্যান্য খরচ</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="quick-exp-amt"
                        className="block text-xs font-bold text-rose-800 mb-1"
                      >
                        টাকার পরিমাণ (৳) *
                      </label>
                      <input
                        id="quick-exp-amt"
                        type="number"
                        min={1}
                        required
                        placeholder="যেমন: 1500"
                        value={quickExpAmount}
                        onChange={(e) => setQuickExpAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-rose-50/50 border-2 border-rose-300 rounded-xl tabular-nums font-bold font-mono text-rose-950 focus:bg-white focus:border-rose-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Quick Expense Preset Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      দ্রুত অংক:
                    </span>
                    {[500, 1000, 2000, 5000, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuickExpAmount(String(preset))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 cursor-pointer tabular-nums transition-colors"
                      >
                        ৳{formatBn(preset)}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      aria-label="তাৎক্ষণিক খরচের বিবরণ"
                      placeholder="বিবরণ লিখুন (যেমন: ভেকু ডিজেল ৩০ লিটার বা মাটির ট্রাক)..."
                      value={quickExpDesc}
                      onChange={(e) => setQuickExpDesc(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-rose-500 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-95"
                    >
                      + খরচ যোগ করুন
                    </button>
                  </div>
                </form>

                {/* Urgent Kiln Notepad Box (জরুরি নোট ও রিমাইন্ডার বক্স) */}
                <div className="lg:col-span-6 bg-white border-2 border-amber-200/90 hover:border-amber-300 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-3.5">
                  <div className="flex items-center justify-between gap-3 border-b border-amber-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-600 text-white shadow-xs shrink-0">
                        <StickyNote className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 mb-0.5">
                          ভাটা ডায়েরি ও রিমাইন্ডার
                        </span>
                        <h2 className="text-base font-bold text-slate-900">
                          জরুরি নোট ও রিমাইন্ডার বক্স (Kiln Notepad)
                        </h2>
                        <p className="text-xs text-slate-500">
                          সর্দারের দাদন, কয়লার গাড়ি বা ডেলিভারির জরুরি কথা উপরেই লিখে রাখুন
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 tabular-nums shrink-0">
                      মোট {formatBn(dbState.kilnNotes.length)}টি নোট
                    </span>
                  </div>

                  <form
                    onSubmit={handleAddNoteSubmit}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2"
                  >
                    <select
                      aria-label="নোটের গুরুত্ব"
                      value={notePriority}
                      onChange={(e) =>
                        setNotePriority(e.target.value as 'URGENT' | 'NORMAL')
                      }
                      className="px-3 py-2.5 text-xs font-bold bg-amber-50/70 border border-amber-300 rounded-xl text-amber-950 focus:outline-hidden"
                    >
                      <option value="URGENT">🔥 জরুরি</option>
                      <option value="NORMAL">📌 সাধারণ</option>
                    </select>
                    <input
                      type="text"
                      aria-label="নতুন জরুরি নোট লিখুন"
                      placeholder="যেমন: শনিবার রহিম সর্দারকে ২০ হাজার টাকা দিতে হবে..."
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 text-xs sm:text-sm font-bold bg-orange-600 text-white rounded-xl hover:bg-orange-700 whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      + নোট সেভ
                    </button>
                  </form>

                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {dbState.kilnNotes.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 text-xs transition-colors ${
                          n.completed
                            ? 'bg-slate-50 border-slate-200 opacity-75'
                            : n.priority === 'URGENT'
                            ? 'bg-orange-50/50 border-orange-200/80'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={n.completed}
                            onChange={(e) =>
                              handleToggleNote(n.id, e.target.checked)
                            }
                            className="mt-0.5 w-4 h-4 accent-orange-600 rounded cursor-pointer"
                          />
                          <span
                            className={
                              n.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-800 font-medium'
                            }
                          >
                            {n.priority === 'URGENT' && (
                              <strong className="text-orange-700 mr-1">
                                [জরুরি]
                              </strong>
                            )}
                            {n.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          aria-label="নোট মুছে ফেলুন"
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. BELOW: Dashboard Quick Memo Popup Launchpad & Animated New Memo Studio Modal */}
              <NewMemoStudio
                lang={lang}
                isOpen={isNewMemoModalOpen}
                onOpen={() => setIsNewMemoModalOpen(true)}
                onClose={() => setIsNewMemoModalOpen(false)}
                brickGrades={dbState.brickGrades}
                existingMemos={dbState.salesMemos}
                nextAutoMemoNo={nextAutoMemoNo}
                memoNo={memoNo}
                onChangeMemoNo={setMemoNo}
                memoDate={memoDate}
                onChangeMemoDate={setMemoDate}
                memoCustomer={memoCustomer}
                onChangeMemoCustomer={setMemoCustomer}
                memoPhone={memoPhone}
                onChangeMemoPhone={setMemoPhone}
                memoAddress={memoAddress}
                onChangeMemoAddress={setMemoAddress}
                memoVehicleType={memoVehicleType}
                onChangeMemoVehicleType={setMemoVehicleType}
                memoTruck={memoTruck}
                onChangeMemoTruck={setMemoTruck}
                memoDriver={memoDriver}
                onChangeMemoDriver={setMemoDriver}
                memoDriverPhone={memoDriverPhone}
                onChangeMemoDriverPhone={setMemoDriverPhone}
                memoDeliveryStatus={memoDeliveryStatus}
                onChangeMemoDeliveryStatus={setMemoDeliveryStatus}
                memoDuePromiseDate={memoDuePromiseDate}
                onChangeMemoDuePromiseDate={setMemoDuePromiseDate}
                memoNote={memoNote}
                onChangeMemoNote={setMemoNote}
                memoItems={memoItems}
                computedItems={computedItems}
                memoDiscount={memoDiscount}
                onChangeMemoDiscount={(val) => {
                  setMemoDiscount(val);
                  const disc = Math.max(0, Number(val) || 0);
                  setMemoPaid(String(Math.max(0, liveMemoCalc.subTotal - disc)));
                }}
                memoPaid={memoPaid}
                onChangeMemoPaid={setMemoPaid}
                memoMethod={memoMethod}
                onChangeMemoMethod={setMemoMethod}
                liveMemoCalc={liveMemoCalc}
                creatingMemo={creatingMemo}
                onUpdateMemoItem={handleUpdateMemoItem}
                onAddMemoRow={handleAddMemoRow}
                onRemoveMemoRow={handleRemoveMemoRow}
                onSubmitMemo={handleCreateMemoSubmit}
                onResetForm={handleResetMemoForm}
                onOpenMemoSection={(sec) => {
                  if (sec === 'MILLS') {
                    setActiveTab('mill_hisab');
                  } else if (sec === 'CHULLI_LOAD') {
                    setActiveTab('van_hisab');
                  } else if (sec === 'PORAI_MISTRI') {
                    setActiveTab('porai_mistri');
                  } else if (sec === 'CHULLI_UNLOAD') {
                    setActiveTab('unload_hisab');
                  } else {
                    setActiveTab('memos');
                  }
                }}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 Columns: Recent Memos & 7-Day Chart */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Recent Memos Quick List with Popup Action Buttons */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        {isEn
                          ? `Recent Cash Memos (${formatBn(dbState.salesMemos.length)})`
                          : `সাম্প্রতিক ডিজিটাল ক্যাশ মেমোসমূহ (${formatBn(dbState.salesMemos.length)}টি)`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('memos')}
                        className="text-xs font-semibold text-orange-700 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {isEn ? 'View All Memos →' : 'সকল মেমো ও বাকি খাতা দেখুন →'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <th className="py-2.5 px-4 font-semibold">মেমো নং</th>
                            <th className="py-2.5 px-4 font-semibold">ক্রেতা ও ঠিকানা</th>
                            <th className="py-2.5 px-4 font-semibold">কী ইট ও পরিমাণ</th>
                            <th className="py-2.5 px-4 font-semibold text-right">মোট বিল</th>
                            <th className="py-2.5 px-4 font-semibold text-right">বাকি</th>
                            <th className="py-2.5 px-4 font-semibold text-right">অপশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {dbState.salesMemos.slice(0, 6).map((m) => (
                            <tr
                              key={m.id}
                              onClick={() => setViewMemoTarget(m)}
                              className="hover:bg-orange-50/30 transition-colors cursor-pointer"
                            >
                              <td className="py-2.5 px-4 tabular-nums">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewMemoTarget(m);
                                  }}
                                  className="font-bold font-mono text-orange-700 hover:underline cursor-pointer"
                                  title="মেমো বিস্তারিত পপআপ খুলুন"
                                >
                                  {m.memoNo}
                                </button>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-slate-900">
                                  {m.customerName}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {m.date} · {m.customerAddress}
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-xs text-slate-700 tabular-nums">
                                {m.items && m.items.length > 0
                                  ? m.items
                                      .map(
                                        (it) =>
                                          `${cleanBrickGradeName(it.gradeName)} (${formatBn(it.quantity)} পিস)`
                                      )
                                      .join(', ')
                                  : `${cleanBrickGradeName(m.gradeName || '১ নং ইট')} (${formatBn(
                                      m.quantity || 0
                                    )} পিস)`}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                                {formatCurrencyBn(m.totalAmount)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                                {m.dueAmount > 0 ? (
                                  <span className="text-rose-700">
                                    {formatCurrencyBn(m.dueAmount)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 text-xs">
                                    পরিশোধিত
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-2.5 px-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center justify-end gap-1">
                                  {m.dueAmount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setDueModalMemoTarget(m)}
                                      title="বকেয়া আদায় পপআপ"
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer transition-colors"
                                    >
                                      <Banknote className="w-3 h-3" />
                                      জমা
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setViewMemoTarget(m)}
                                    title="বিস্তারিত পপআপ"
                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditModalMemoTarget(m)}
                                    title="মেমো আপডেট পপআপ"
                                    className="p-1.5 text-orange-700 hover:bg-orange-50 rounded-md cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPrintMemoTarget(m)}
                                    title="প্রিন্ট ও গেটপাস পপআপ"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Printer className="w-3 h-3 text-orange-400" />
                                    প্রিন্ট
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 7-Day Sales, Collection & Expense Visual Chart */}
                  {metrics.sevenDayChart && metrics.sevenDayChart.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-orange-700" />
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">
                              গত ৭ দিনের ইট বিক্রি, নগদ আদায় ও খরচের তুলনামূলক চিত্র
                            </h3>
                            <p className="text-xs text-slate-500">
                              ইটভাটার দৈনিক আয় (সবুজ), বিক্রি (ইট-কমলা) এবং খরচ (লাল) বিশ্লেষণ
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium">
                          <span className="inline-flex items-center gap-1.5 text-orange-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-orange-600" />
                            বিক্রি
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                            নগদ জমা
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-rose-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                            খরচ
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2 pt-2 items-end h-40 border-b border-slate-200 pb-2">
                        {metrics.sevenDayChart.map((pt) => {
                          const sPct = Math.max(
                            6,
                            Math.round((pt.salesAmount / maxChartVal) * 100)
                          );
                          const cPct = Math.max(
                            6,
                            Math.round((pt.cashInAmount / maxChartVal) * 100)
                          );
                          const ePct = Math.max(
                            6,
                            Math.round((pt.expenseAmount / maxChartVal) * 100)
                          );
                          return (
                            <div
                              key={pt.date}
                              className="flex flex-col items-center justify-end h-full gap-1.5 group"
                            >
                              <div className="w-full flex items-end justify-center gap-1 h-28 px-1">
                                <div
                                  style={{ height: `${sPct}%` }}
                                  title={`বিক্রি: ${formatCurrencyBn(pt.salesAmount)}`}
                                  className="w-2.5 sm:w-3 bg-orange-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                                />
                                <div
                                  style={{ height: `${cPct}%` }}
                                  title={`নগদ জমা: ${formatCurrencyBn(pt.cashInAmount)}`}
                                  className="w-2.5 sm:w-3 bg-emerald-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                                />
                                <div
                                  style={{ height: `${ePct}%` }}
                                  title={`খরচ: ${formatCurrencyBn(pt.expenseAmount)}`}
                                  className="w-2.5 sm:w-3 bg-rose-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                                />
                              </div>
                              <span className="text-[11px] font-medium text-slate-600 tabular-nums">
                                {pt.dateLabelBn}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 5 Columns: Customer Due Box */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Outstanding Customer Due Quick Action List */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-200/60">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-900">
                            বকেয়া পাওনা খাতা ({formatBn(dueMemos.length)}টি মেমো)
                          </h2>
                          <p className="text-xs text-slate-500">
                            মোট পাওনা: {formatCurrencyBn(metrics.totalCustomerDue)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('memos')}
                        className="text-xs font-semibold text-orange-700 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        বাকি আদায় করুন →
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {dueMemos.slice(0, 7).map((m) => (
                        <div
                          key={m.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setViewMemoTarget(m)}
                              className="font-semibold text-slate-900 hover:text-orange-700 hover:underline truncate cursor-pointer text-left"
                            >
                              {m.customerName} ({m.memoNo})
                            </button>
                            <div className="text-slate-500 truncate">
                              মোবাইল: {m.customerPhone} · তারিখ: {m.date}
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <div className="font-bold text-rose-700 tabular-nums">
                                {formatCurrencyBn(m.dueAmount)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDueModalMemoTarget(m)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg cursor-pointer transition-colors"
                            >
                              জমা নিন
                            </button>
                          </div>
                        </div>
                      ))}
                      {dueMemos.length === 0 && (
                        <div className="py-4 text-center text-xs text-slate-500">
                          বর্তমানে কোনো ক্রেতার কাছে বকেয়া পাওনা নেই।
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memos' && (
            <SalesLedgerTab
              lang={lang}
              todayDate={metrics.todayDate}
              yesterdayDate={metrics.yesterdayDate}
              salesMemos={dbState.salesMemos}
              brickGrades={dbState.brickGrades}
              onOpenNewMemoModal={() => {
                setIsNewMemoModalOpen(true);
                setTimeout(() => {
                  document.getElementById('memo-customer-input')?.focus();
                }, 80);
              }}
              onViewMemo={(memo) => setViewMemoTarget(memo)}
              onOpenDueModal={(memo) => setDueModalMemoTarget(memo)}
              onOpenEditModal={(memo) => setEditModalMemoTarget(memo)}
              onOpenDeleteModal={(memo) => setDeleteMemoTarget(memo)}
              onPrintMemo={(memo) => setPrintMemoTarget(memo)}
            />
          )}

          {activeTab === 'mill_hisab' && (
            <BrickGradeReportTab
              key="mill_hisab"
              lang={lang}
              initialSectionView="MILLS"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              productionPayments={dbState.productionPayments || []}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'van_hisab' && (
            <BrickGradeReportTab
              key="van_hisab"
              lang={lang}
              initialSectionView="CHULLI_LOAD"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              productionPayments={dbState.productionPayments || []}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'porai_mistri' && (
            <BrickGradeReportTab
              key="porai_mistri"
              lang={lang}
              initialSectionView="PORAI_MISTRI"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              productionPayments={dbState.productionPayments || []}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'unload_hisab' && (
            <BrickGradeReportTab
              key="unload_hisab"
              lang={lang}
              initialSectionView="CHULLI_UNLOAD"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              productionPayments={dbState.productionPayments || []}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'bricks' && (
            <BrickGradeReportTab
              lang={lang}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              productionPayments={dbState.productionPayments || []}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'labour' && (
            <LabourSectionTab
              lang={lang}
              todayDate={metrics.todayDate}
              workerProfiles={dbState.workerProfiles}
              workerAttendance={dbState.workerAttendance}
              onSaveWorkerProfile={handleSaveWorkerProfile}
              onToggleWorkerHajira={handleToggleWorkerHajira}
              onPayWorker={handlePayWorker}
              onSaveWorkerAttendance={handleSaveWorkerAttendance}
            />
          )}

          {activeTab === 'cashbook' && (
            <CashBookTab
              cashTransactions={dbState.cashTransactions}
              onAddCashTx={handleAddCashTx}
              onUpdateCashTx={handleUpdateCashTx}
              onDeleteCashTx={handleDeleteCashTx}
            />
          )}
        </main>
      </div>

      {/* Global New Memo Studio Popup when opened from non-dashboard tabs */}
      {activeTab !== 'dashboard' && isNewMemoModalOpen && (
        <NewMemoStudio
          lang={lang}
          isOpen={isNewMemoModalOpen}
          onOpen={() => setIsNewMemoModalOpen(true)}
          onClose={() => setIsNewMemoModalOpen(false)}
          brickGrades={dbState.brickGrades}
          existingMemos={dbState.salesMemos}
          nextAutoMemoNo={nextAutoMemoNo}
          memoNo={memoNo}
          onChangeMemoNo={setMemoNo}
          memoDate={memoDate}
          onChangeMemoDate={setMemoDate}
          memoCustomer={memoCustomer}
          onChangeMemoCustomer={setMemoCustomer}
          memoPhone={memoPhone}
          onChangeMemoPhone={setMemoPhone}
          memoAddress={memoAddress}
          onChangeMemoAddress={setMemoAddress}
          memoVehicleType={memoVehicleType}
          onChangeMemoVehicleType={setMemoVehicleType}
          memoTruck={memoTruck}
          onChangeMemoTruck={setMemoTruck}
          memoDriver={memoDriver}
          onChangeMemoDriver={setMemoDriver}
          memoDriverPhone={memoDriverPhone}
          onChangeMemoDriverPhone={setMemoDriverPhone}
          memoDeliveryStatus={memoDeliveryStatus}
          onChangeMemoDeliveryStatus={setMemoDeliveryStatus}
          memoDuePromiseDate={memoDuePromiseDate}
          onChangeMemoDuePromiseDate={setMemoDuePromiseDate}
          memoNote={memoNote}
          onChangeMemoNote={setMemoNote}
          memoItems={memoItems}
          computedItems={computedItems}
          memoDiscount={memoDiscount}
          onChangeMemoDiscount={(val) => {
            setMemoDiscount(val);
            const disc = Math.max(0, Number(val) || 0);
            setMemoPaid(String(Math.max(0, liveMemoCalc.subTotal - disc)));
          }}
          memoPaid={memoPaid}
          onChangeMemoPaid={setMemoPaid}
          memoMethod={memoMethod}
          onChangeMemoMethod={setMemoMethod}
          liveMemoCalc={liveMemoCalc}
          creatingMemo={creatingMemo}
          onUpdateMemoItem={handleUpdateMemoItem}
          onAddMemoRow={handleAddMemoRow}
          onRemoveMemoRow={handleRemoveMemoRow}
          onSubmitMemo={handleCreateMemoSubmit}
          onResetForm={handleResetMemoForm}
        />
      )}

      {/* Unified Animated Popup Modals for All Memo Options (View, Collect Due, Edit, Delete) */}
      <MemoActionModals
        lang={lang}
        brickGrades={dbState.brickGrades}
        cashTransactions={dbState.cashTransactions}
        viewMemo={viewMemoTarget}
        onCloseViewMemo={() => setViewMemoTarget(null)}
        dueModalMemo={dueModalMemoTarget}
        onCloseDueModal={() => setDueModalMemoTarget(null)}
        editModalMemo={editModalMemoTarget}
        onCloseEditModal={() => setEditModalMemoTarget(null)}
        deleteTargetMemo={deleteMemoTarget}
        onCloseDeleteModal={() => setDeleteMemoTarget(null)}
        onOpenDueFromView={(memo) => setDueModalMemoTarget(memo)}
        onOpenEditFromView={(memo) => setEditModalMemoTarget(memo)}
        onOpenDeleteFromView={(memo) => setDeleteMemoTarget(memo)}
        onPrintMemo={(memo) => setPrintMemoTarget(memo)}
        onCollectDue={handleCollectDue}
        onUpdateMemo={handleUpdateMemo}
        onDeleteMemo={handleDeleteMemo}
      />

      {/* Detailed Printable KPI Report Modal */}
      <KpiReportModal
        kpiId={activeKpiModal}
        onClose={() => setActiveKpiModal(null)}
        metrics={metrics}
        salesMemos={dbState.salesMemos}
        cashTransactions={dbState.cashTransactions}
      />

      {/* Official SBL Cash Memo & Gate Pass Print Modal */}
      <MemoPrintModal
        memo={printMemoTarget}
        onClose={() => setPrintMemoTarget(null)}
      />
    </div>
  );
}
