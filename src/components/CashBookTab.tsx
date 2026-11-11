import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CreditCard,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Flame,
  PlusCircle,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import type { CashTransaction, CashTxType, PaymentMethod } from '../types/kiln';
import {
  buildQuickCashTransactionPayload,
  formatBn,
  formatCurrencyBn,
  inferQuickCashTxType,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';
import { Card } from './Card';

interface CashBookTabProps {
  cashTransactions: CashTransaction[];
  externalTypeFilter?: 'ALL' | 'IN' | 'OUT';
  externalCategoryFilter?: string;
  onAddCashTx: (payload: {
    type: CashTxType;
    category: string;
    amount: number;
    description: string;
    paymentMethod: PaymentMethod;
  }) => Promise<void>;
  onUpdateCashTx?: (
    id: string,
    payload: {
      type?: CashTxType;
      category?: string;
      amount?: number;
      description?: string;
      paymentMethod?: PaymentMethod;
      date?: string;
    }
  ) => Promise<void>;
  onDeleteCashTx: (id: string) => Promise<void>;
}

const EXPENSE_CATEGORIES = [
  'কয়লা ক্রয়',
  'ভেকু ও ডিজেল',
  'মাটি ক্রয়',
  'শ্রমিক ও সর্দার পেমেন্ট',
  'বিদ্যুৎ ও জ্বালানি',
  'অফিস ও আপ্যায়ন',
  'অন্যান্য খরচ',
];

const INCOME_CATEGORIES = [
  'ইট বিক্রয় আদায়',
  'বাকি আদায়',
  'অন্যান্য জমা',
];

const QUICK_AMOUNT_PRESETS = [500, 1000, 2000, 5000, 10000, 20000];

export const CashBookTab: React.FC<CashBookTabProps> = ({
  cashTransactions,
  externalTypeFilter,
  externalCategoryFilter,
  onAddCashTx,
  onUpdateCashTx,
  onDeleteCashTx,
}) => {
  const [cashTypeFilter, setCashTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (externalTypeFilter) {
      setCashTypeFilter(externalTypeFilter);
    }
  }, [externalTypeFilter]);

  useEffect(() => {
    if (externalCategoryFilter) {
      setCategoryFilter(externalCategoryFilter);
    }
  }, [externalCategoryFilter]);

  // Form State
  const [txType, setTxType] = useState<CashTxType>('OUT');
  const [category, setCategory] = useState<string>('কয়লা ক্রয়');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [submitting, setSubmitting] = useState(false);

  // Edit Transaction Modal State
  const [editTarget, setEditTarget] = useState<CashTransaction | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [editDate, setEditDate] = useState<string>('');

  // Safe Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<CashTransaction | null>(null);

  // Simplified 'Quick Entry' Modal State (triggered by bottom-right FAB)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickCategory, setQuickCategory] = useState<string>('অফিস ও আপ্যায়ন');
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickNote, setQuickNote] = useState<string>('');
  const [quickSubmitting, setQuickSubmitting] = useState<boolean>(false);
  const [quickError, setQuickError] = useState<string>('');
  const [quickSavedFeedback, setQuickSavedFeedback] = useState<string>('');
  const inferredQuickType: CashTxType = inferQuickCashTxType(quickCategory);

  const filteredTx = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cashTransactions.filter((t) => {
      if (cashTypeFilter !== 'ALL' && t.type !== cashTypeFilter) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (methodFilter !== 'ALL' && t.paymentMethod !== methodFilter) return false;
      if (dateFilter && t.date !== dateFilter) return false;
      if (q) {
        const matchCat = (t.category || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchMethod = (t.paymentMethod || '').toLowerCase().includes(q);
        const matchDate = (t.date || '').toLowerCase().includes(q);
        if (!matchCat && !matchDesc && !matchMethod && !matchDate) return false;
      }
      return true;
    });
  }, [cashTransactions, cashTypeFilter, categoryFilter, methodFilter, dateFilter, searchQuery]);

  const sumIn = useMemo(
    () =>
      filteredTx
        .filter((t) => t.type === 'IN')
        .reduce((s, t) => s + t.amount, 0),
    [filteredTx]
  );
  const sumOut = useMemo(
    () =>
      filteredTx
        .filter((t) => t.type === 'OUT')
        .reduce((s, t) => s + t.amount, 0),
    [filteredTx]
  );
  const countIn = useMemo(
    () => filteredTx.filter((t) => t.type === 'IN').length,
    [filteredTx]
  );
  const countOut = useMemo(
    () => filteredTx.filter((t) => t.type === 'OUT').length,
    [filteredTx]
  );

  // Payment Method Breakdown on filtered transactions
  const methodSummary = useMemo(() => {
    let cashNet = 0;
    let bkashNet = 0;
    let bankNet = 0;
    for (const t of filteredTx) {
      const signed = t.type === 'IN' ? t.amount : -t.amount;
      if (t.paymentMethod === 'বিকাশ / নগদ অ্যাপ') {
        bkashNet += signed;
      } else if (t.paymentMethod === 'ব্যাংক চেক / ট্রান্সফার') {
        bankNet += signed;
      } else {
        cashNet += signed;
      }
    }
    return { cashNet, bkashNet, bankNet };
  }, [filteredTx]);

  // Category Breakdown for visual progress bars
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; count: number; type: CashTxType }>();
    for (const t of filteredTx) {
      const key = `${t.type}:${t.category}`;
      const existing = map.get(key) || { amount: 0, count: 0, type: t.type };
      existing.amount += t.amount;
      existing.count += 1;
      map.set(key, existing);
    }
    const totalBase = Math.max(1, sumIn + sumOut);
    return Array.from(map.entries())
      .map(([key, info]) => ({
        category: key.split(':')[1] || 'অন্যান্য',
        type: info.type,
        amount: info.amount,
        count: info.count,
        pct: Math.max(6, Math.round((info.amount / totalBase) * 100)),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTx, sumIn, sumOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNum(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setSubmitting(true);
    try {
      await onAddCashTx({
        type: txType,
        category,
        amount: amt,
        description: description.trim() || `${category} বাবদ এন্ট্রি`,
        paymentMethod,
      });
      setAmount('');
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAddSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setQuickError('');
    const built = buildQuickCashTransactionPayload({
      category: quickCategory,
      amountInput: quickAmount,
      noteInput: quickNote,
    });
    if (!built.valid || !built.payload) {
      setQuickError(built.errorBn || 'সঠিক টাকার পরিমাণ লিখুন');
      return;
    }
    setQuickSubmitting(true);
    try {
      await onAddCashTx(built.payload);
      setQuickAmount('');
      setQuickNote('');
      setIsQuickAddOpen(false);
      setQuickSavedFeedback(
        `${built.payload.type === 'OUT' ? 'খরচ' : 'জমা'} ${formatCurrencyBn(
          built.payload.amount
        )} (${built.payload.category}) যুক্ত হয়েছে!`
      );
      setTimeout(() => {
        setQuickSavedFeedback('');
      }, 2600);
    } finally {
      setQuickSubmitting(false);
    }
  };

  const openEditModal = (tx: CashTransaction) => {
    setEditTarget(tx);
    setEditCategory(tx.category);
    setEditAmount(String(tx.amount));
    setEditDescription(tx.description);
    setEditPaymentMethod(tx.paymentMethod || 'নগদ ক্যাশ');
    setEditDate(tx.date);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !onUpdateCashTx) return;
    const amt = parseNum(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await onUpdateCashTx(editTarget.id, {
      category: editCategory.trim() || editTarget.category,
      amount: amt,
      description: editDescription.trim(),
      paymentMethod: editPaymentMethod,
      date: editDate,
    });
    setEditTarget(null);
  };

  const handleExportCsv = () => {
    const headers = ['Date,Type,Category,Amount,PaymentMethod,Description'];
    const rows = filteredTx.map(
      (t) =>
        `${t.date},${t.type},"${t.category}",${t.amount},"${t.paymentMethod}","${t.description.replace(
          /"/g,
          '""'
        )}"`
    );
    const csv = '\uFEFF' + [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brickflow-cashbook-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setCashTypeFilter('ALL');
    setCategoryFilter('ALL');
    setMethodFilter('ALL');
    setDateFilter('');
    setSearchQuery('');
  };

  const uniqueCategories = Array.from(
    new Set([
      ...EXPENSE_CATEGORIES,
      ...INCOME_CATEGORIES,
      ...cashTransactions.map((t) => t.category),
    ])
  );

  const hasActiveFilter =
    cashTypeFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    Boolean(dateFilter) ||
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-6">
      {/* 1. Executive Dark Navy Cash Book Header & Live Financial Strip (Main Dashboard Standard) */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-4 sm:p-6 text-white space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/90 pb-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/20 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  লাইভ ক্যাশ তহবিল সিঙ্ক
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                  SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white mt-1">
                ডিজিটাল ক্যাশ বুক ও ভাউচার খতিয়ান (Kiln Cash Book)
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                ইট বিক্রির নগদ আদায়, কয়লা-মাটি-ডিজেল ক্রয় এবং লেবার পেমেন্টের প্রতিদিনের ভেরিফায়েড জমা-খরচ হিসাব
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="sbl-btn-interactive inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-slate-700/90 transition-all cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Download CSV / Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="sbl-btn-interactive inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>ক্যাশ বুক প্রিন্ট / PDF</span>
            </button>
          </div>
        </div>

        {/* 4 Executive Summary Cards inside Dark Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Cash In */}
          <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-emerald-500 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-200 font-bold">
              <span>মোট নগদ জমা (Cash In)</span>
              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div
              data-testid="cashbook-total-in"
              className="text-xl font-extrabold text-emerald-400 font-mono tabular-nums"
            >
              {formatCurrencyBn(sumIn)}
            </div>
            <div className="text-[11px] text-slate-200 font-medium tabular-nums">
              মোট জমার ভাউচার: {formatBn(countIn)}টি
            </div>
          </div>

          {/* Total Cash Out */}
          <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-rose-500 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-200 font-bold">
              <span>মোট ভাটা খরচ (Cash Out)</span>
              <ArrowUpRight className="w-4 h-4 text-rose-400" />
            </div>
            <div
              data-testid="cashbook-total-out"
              className="text-xl font-extrabold text-rose-400 font-mono tabular-nums"
            >
              {formatCurrencyBn(sumOut)}
            </div>
            <div className="text-[11px] text-slate-200 font-medium tabular-nums">
              মোট খরচের ভাউচার: {formatBn(countOut)}টি
            </div>
          </div>

          {/* Net Cash Flow */}
          <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-amber-500 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-200 font-bold">
              <span>নিট ক্যাশ প্রবাহ (Net Flow)</span>
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div
              data-testid="cashbook-net-flow"
              className={`text-xl font-extrabold font-mono tabular-nums ${
                sumIn - sumOut >= 0 ? 'text-amber-300' : 'text-rose-400'
              }`}
            >
              {formatCurrencyBn(sumIn - sumOut)}
            </div>
            <div className="text-[11px] text-slate-200 font-medium tabular-nums">
              ফিল্টারকৃত মোট লেনদেন: {formatBn(filteredTx.length)}টি
            </div>
          </div>

          {/* Payment Method Split */}
          <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-cyan-500 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-200 font-bold">
              <span>মাধ্যম অনুযায়ী নিট স্থিতি</span>
              <CreditCard className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="space-y-1 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-200 font-sans font-medium">নগদ ক্যাশ:</span>
                <span className="font-bold text-white">
                  {formatCurrencyBn(methodSummary.cashNet)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-200 font-sans font-medium">বিকাশ/নগদ ও ব্যাংক:</span>
                <span className="font-bold text-cyan-300">
                  {formatCurrencyBn(methodSummary.bkashNet + methodSummary.bankNet)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Two-Column Workspace: Left Voucher Entry Studio + Right Filter & Category Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Add Cash Book Entry Form */}
        <Card
          as="form"
          onSubmit={handleSubmit}
          variant="default"
          topAccent={txType === 'OUT' ? 'rose' : 'emerald'}
          padding="lg"
          className="lg:col-span-5 space-y-4 transition-all"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2.5 rounded-xl text-white shadow-xs shrink-0 ${
                  txType === 'OUT'
                    ? 'bg-gradient-to-br from-rose-600 to-red-600'
                    : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span
                  className={`block text-[11px] font-extrabold tracking-wide ${
                    txType === 'OUT' ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {txType === 'OUT'
                    ? 'ভাটা খরচ ভাউচার এন্ট্রি (CASH OUT)'
                    : 'নগদ জমা ভাউচার এন্ট্রি (CASH IN)'}
                </span>
                <h2 className="text-base font-extrabold text-slate-900">
                  ক্যাশ বুকে নতুন জমা বা খরচ এন্ট্রি
                </h2>
              </div>
            </div>
          </div>

          {/* Visual Mode Switcher + Accessible Select (#cb-type-select) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTxType('OUT');
                  setCategory('কয়লা ক্রয়');
                }}
                className={`sbl-btn-interactive flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  txType === 'OUT'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/40'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>খরচ ভাউচার (Cash Out)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxType('IN');
                  setCategory('অন্যান্য জমা');
                }}
                className={`sbl-btn-interactive flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  txType === 'IN'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>জমা ভাউচার (Cash In)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="cb-type-select"
                  className="block text-xs font-bold text-slate-900 mb-1"
                >
                  লেনদেনের ধরন
                </label>
                <select
                  id="cb-type-select"
                  value={txType}
                  onChange={(e) => {
                    const val = e.target.value as CashTxType;
                    setTxType(val);
                    setCategory(val === 'IN' ? 'অন্যান্য জমা' : 'কয়লা ক্রয়');
                  }}
                  className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
                >
                  <option value="OUT">খরচ (Cash Out)</option>
                  <option value="IN">জমা (Cash In)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cb-category-select"
                  className="block text-xs font-bold text-slate-900 mb-1"
                >
                  খাত (Category)
                </label>
                <select
                  id="cb-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
                >
                  {txType === 'OUT' ? (
                    <>
                      <option value="কয়লা ক্রয়">কয়লা ক্রয়</option>
                      <option value="ভেকু ও ডিজেল">ভেকু ও ডিজেল</option>
                      <option value="মাটি ক্রয়">মাটি ক্রয়</option>
                      <option value="শ্রমিক ও সর্দার পেমেন্ট">শ্রমিক ও সর্দার পেমেন্ট</option>
                      <option value="বিদ্যুৎ ও জ্বালানি">বিদ্যুৎ ও জ্বালানি</option>
                      <option value="অফিস ও আপ্যায়ন">অফিস ও আপ্যায়ন</option>
                      <option value="অন্যান্য খরচ">অন্যান্য খরচ</option>
                    </>
                  ) : (
                    <>
                      <option value="ইট বিক্রয় আদায়">ইট বিক্রয় আদায়</option>
                      <option value="বাকি আদায়">বাকি আদায়</option>
                      <option value="অন্যান্য জমা">অন্যান্য জমা</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Category Chips */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-800">
              দ্রুত খাত নির্বাচন:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(txType === 'OUT' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    category === cat
                      ? txType === 'OUT'
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : 'bg-emerald-50 border-emerald-500 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cb-amount-input"
                className={`block text-xs font-extrabold mb-1 ${
                  txType === 'OUT' ? 'text-rose-800' : 'text-emerald-800'
                }`}
              >
                টাকার পরিমাণ (৳) *
              </label>
              <input
                id="cb-amount-input"
                type="text"
                inputMode="decimal"
                placeholder="যেমন: 5000"
                value={amount}
                onChange={(e) => setAmount(normalizeNumericInput(e.target.value))}
                className={`w-full px-3.5 py-2.5 text-sm font-extrabold font-mono tabular-nums rounded-xl border-2 focus:bg-white focus:outline-hidden ${
                  txType === 'OUT'
                    ? 'bg-rose-50/50 border-rose-300 text-rose-950 focus:border-rose-600'
                    : 'bg-emerald-50/50 border-emerald-300 text-emerald-950 focus:border-emerald-600'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="cb-method-select"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                পেমেন্ট মাধ্যম
              </label>
              <select
                id="cb-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 text-sm font-bold bg-white text-slate-950 border border-slate-300 rounded-xl focus:border-orange-600 focus:outline-hidden"
              >
                <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
              </select>
            </div>
          </div>

          {/* Quick Amount Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-slate-800 mr-1">
              ⚡ দ্রুত অংক:
            </span>
            {QUICK_AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`sbl-btn-interactive sbl-chip-preset px-2.5 py-1 rounded-xl text-xs font-black border cursor-pointer font-mono tabular-nums transition-all ${
                  Number(amount) === preset
                    ? 'bg-slate-950 text-amber-300 border-amber-400/60 shadow-sm ring-2 ring-amber-400/40'
                    : 'bg-white hover:bg-slate-100 hover:border-slate-400 text-slate-900 border-slate-300'
                }`}
              >
                ৳{formatBn(preset)}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="cb-desc-input"
              className="block text-xs font-bold text-slate-900 mb-1"
            >
              বিবরণ / ভাউচার নোট
            </label>
            <input
              id="cb-desc-input"
              type="text"
              placeholder="খরচ বা জমার সংক্ষিপ্ত বিবরণ লিখুন (যেমন: কয়লা ১ ট্রাক বা ভেকু ডিজেল)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white text-slate-950 border border-slate-300 rounded-xl focus:border-orange-600 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`sbl-btn-interactive w-full py-3.5 px-5 text-sm font-black text-white rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              txType === 'OUT'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
            }`}
          >
            {submitting
              ? 'যুক্ত হচ্ছে...'
              : txType === 'OUT'
              ? '+ খরচ ভাউচার ক্যাশ বুকে সংরক্ষণ করুন'
              : '+ জমা ভাউচার ক্যাশ বুকে সংরক্ষণ করুন'}
          </button>
        </Card>

        {/* Right 7 Columns: Cash Book Filter, Search & Category Breakdown Panel */}
        <Card
          variant="default"
          topAccent="orange"
          padding="lg"
          className="lg:col-span-7 flex flex-col justify-between space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-700 border border-orange-200/80">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-950">
                  ক্যাশ বুক খতিয়ান ও স্মার্ট ফিল্টার
                </h2>
                <p className="text-xs text-slate-700 font-medium">
                  ধরন, খাত, পেমেন্ট মাধ্যম, তারিখ বা বিবরণ দিয়ে যেকোনো লেনদেন তাৎক্ষণিক খুঁজুন
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ফিল্টার রিসেট</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-100 text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-orange-600" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>

          {/* Filter Controls Grid */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                id="cashTypeFilter"
                className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl"
              >
                {(
                  [
                    { id: 'ALL', label: 'সকল লেনদেন' },
                    { id: 'IN', label: 'শুধু জমা (Cash In)' },
                    { id: 'OUT', label: 'শুধু খরচ (Cash Out)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCashTypeFilter(tab.id)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      cashTypeFilter === tab.id
                        ? tab.id === 'IN'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : tab.id === 'OUT'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-800 hover:text-slate-950'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[210px]">
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="ক্যাশ বুক লেনদেন খুঁজুন"
                  placeholder="বিবরণ, মেমো নং বা খাতের নাম দিয়ে খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  খাত অনুযায়ী ফিল্টার (Category)
                </label>
                <select
                  aria-label="খাত অনুযায়ী ক্যাশ বুক ফিল্টার"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
                >
                  <option value="ALL">সকল খাত (All Categories)</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  পেমেন্ট মাধ্যম (Method)
                </label>
                <select
                  aria-label="পেমেন্ট মাধ্যম ফিল্টার"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
                >
                  <option value="ALL">সকল মাধ্যম (All Methods)</option>
                  <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                  <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                  <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  নির্দিষ্ট তারিখ (Date)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    aria-label="তারিখ অনুযায়ী ক্যাশ বুক ফিল্টার"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filtered Summary Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-0.5">
              <span className="text-xs font-bold text-emerald-900 block">
                ফিল্টারকৃত মোট জমা (In)
              </span>
              <span className="text-lg font-extrabold text-emerald-800 font-mono tabular-nums block">
                {formatCurrencyBn(sumIn)}
              </span>
              <span className="text-[11px] text-emerald-800 font-semibold">
                {formatBn(countIn)}টি জমা এন্ট্রি
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-0.5">
              <span className="text-xs font-bold text-rose-900 block">
                ফিল্টারকৃত মোট খরচ (Out)
              </span>
              <span className="text-lg font-extrabold text-rose-800 font-mono tabular-nums block">
                {formatCurrencyBn(sumOut)}
              </span>
              <span className="text-[11px] text-rose-800 font-semibold">
                {formatBn(countOut)}টি খরচ এন্ট্রি
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-0.5">
              <span className="text-xs font-bold text-slate-200 block">
                নিট ক্যাশ প্রবাহ (Net Balance)
              </span>
              <span
                className={`text-lg font-extrabold font-mono tabular-nums block ${
                  sumIn - sumOut >= 0 ? 'text-amber-300' : 'text-rose-400'
                }`}
              >
                {formatCurrencyBn(sumIn - sumOut)}
              </span>
              <span className="text-[11px] text-slate-200 font-semibold">
                মোট {formatBn(filteredTx.length)}টি লেনদেন প্রদর্শিত
              </span>
            </div>
          </div>

          {/* Top Category Visual Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
                <span>খাতওয়ারী লেনদেন বিশ্লেষণ (Top Categories)</span>
                <span className="text-[11px] text-slate-700 font-semibold">
                  খাতে ক্লিক করে ফিল্টার করুন
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categoryBreakdown.map((item) => (
                  <button
                    key={`${item.type}-${item.category}`}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((prev) =>
                        prev === item.category ? 'ALL' : item.category
                      )
                    }
                    className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                      categoryFilter === item.category
                        ? 'bg-white border-orange-500 shadow-2xs'
                        : 'bg-white/80 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-slate-950 truncate">
                        {item.category}{' '}
                        <span className="text-[11px] text-slate-700 font-semibold">
                          ({formatBn(item.count)}টি)
                        </span>
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          item.type === 'IN' ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        {formatCurrencyBn(item.amount)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.pct}%` }}
                        className={`h-full rounded-full ${
                          item.type === 'IN' ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 3. High-Craft Cash Transactions Ledger Table */}
      <Card
        variant="default"
        padding="none"
        className="overflow-hidden shadow-xs"
      >
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-white to-orange-50/30 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-950">
              ক্যাশ বুক লেনদেন তালিকা ({formatBn(filteredTx.length)}টি ভাউচার)
            </h3>
            <p className="text-xs text-slate-700 font-medium">
              সকল জমা ও খরচের বিস্তারিত খতিয়ান — যেকোনো এন্ট্রি সংশোধন বা ডিলিট করার অপশনসহ
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-emerald-800">
              জমা: {formatCurrencyBn(sumIn)}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-rose-800">
              খরচ: {formatCurrencyBn(sumOut)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs">
                <th className="py-3 px-4 font-bold">তারিখ</th>
                <th className="py-3 px-4 font-bold">ধরন (In/Out)</th>
                <th className="py-3 px-4 font-bold">খাত (Category)</th>
                <th className="py-3 px-4 font-bold">বিবরণ / ভাউচার নোট</th>
                <th className="py-3 px-4 font-bold">পেমেন্ট মাধ্যম</th>
                <th className="py-3 px-4 font-bold text-right">টাকার পরিমাণ</th>
                <th className="py-3 px-4 font-bold text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTx.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-orange-50/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs font-bold tabular-nums text-slate-900 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      {tx.date}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold whitespace-nowrap">
                    {tx.type === 'IN' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        জমা (IN)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        খরচ (OUT)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-slate-950 whitespace-nowrap">
                    {tx.category}
                  </td>
                  <td className="py-3 px-4 text-slate-900 font-medium text-xs sm:text-sm">
                    {tx.description}
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-900 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-orange-600" />
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-extrabold tabular-nums whitespace-nowrap ${
                      tx.type === 'IN' ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {tx.type === 'IN' ? '+' : '-'}
                    {formatCurrencyBn(tx.amount)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1">
                      {onUpdateCashTx && (
                        <button
                          type="button"
                          onClick={() => openEditModal(tx)}
                          aria-label={`${tx.category} লেনদেন এডিট করুন`}
                          title="ভাউচার সংশোধন করুন"
                          className="p-1.5 text-slate-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        aria-label={`${tx.category} ${tx.amount} লেনদেন ডিলিট করুন`}
                        title="ভাউচার মুছে ফেলুন"
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTx.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 px-4 text-center text-xs sm:text-sm text-slate-500 font-semibold"
                  >
                    নির্বাচিত ফিল্টারে কোনো ক্যাশ লেনদেন পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                <td colSpan={5} className="py-3.5 px-4 text-right">
                  সর্বমোট নিট ক্যাশ প্রবাহ ({formatBn(filteredTx.length)}টি লেনদেন · জমা{' '}
                  {formatCurrencyBn(sumIn)} − খরচ {formatCurrencyBn(sumOut)}):
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-mono tabular-nums ${
                    sumIn - sumOut >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatCurrencyBn(sumIn - sumOut)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Edit Cash Transaction Modal */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-cash-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            noValidate
            onSubmit={handleConfirmEdit}
            className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="edit-cash-modal-title" className="text-base font-extrabold text-slate-900">
                ক্যাশ বুক এন্ট্রি সংশোধন ({editTarget.type === 'OUT' ? 'খরচ' : 'জমা'})
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="সংশোধন মডাল বন্ধ করুন"
                className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  খাত (Category) *
                </label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(e) => setEditAmount(normalizeNumericInput(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-white text-slate-900 border border-slate-300 rounded-xl tabular-nums focus:border-orange-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পেমেন্ট মাধ্যম
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-600 focus:outline-hidden"
                >
                  <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                  <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                  <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                বিবরণ / ভাউচার নোট
              </label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-500 hover:to-amber-500 cursor-pointer"
              >
                আপডেট সেভ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 border-t-4 border-t-rose-600 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-rose-800">
              ক্যাশ বুক এন্ট্রি ডিলিট কনফার্মেশন
            </h3>
            <p className="text-sm text-slate-700">
              আপনি কি নিশ্চিতভাবে <strong>{deleteTarget.category}</strong> খাতের{' '}
              <strong>{formatCurrencyBn(deleteTarget.amount)}</strong> লেনদেনটি মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteCashTx(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-extrabold bg-rose-700 text-white rounded-xl hover:bg-rose-800 cursor-pointer"
              >
                হ্যাঁ, ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Official Bengali Cash Book Report Modal */}
      {isPrintModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-300 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  অফিসিয়াল ক্যাশ বুক প্রিন্ট ও PDF প্রিভিউ
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  প্রিন্ট / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div id="printable-area" className="space-y-5 text-slate-900">
              <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
                <h2 className="text-xl font-extrabold">
                  SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
                </h2>
                <p className="text-xs font-bold text-slate-700">
                  প্রোঃ মোঃ কামরুল ইসলাম সাহেব · পরিচালনায়ঃ সাকিব হোসেন · বাবুলিয়া, সাতক্ষীরা সদর
                </p>
                <div className="text-sm font-extrabold text-orange-800 pt-1">
                  অফিসিয়াল ক্যাশ বুক ও ভাউচার খতিয়ান রিপোর্ট
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs border border-slate-300 rounded-xl p-3 bg-slate-50">
                <div>
                  <span className="text-slate-600 block">মোট নগদ জমা (Cash In):</span>
                  <strong className="text-sm text-emerald-800 font-mono">
                    {formatCurrencyBn(sumIn)} ({formatBn(countIn)}টি)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-600 block">মোট ভাটা খরচ (Cash Out):</span>
                  <strong className="text-sm text-rose-800 font-mono">
                    {formatCurrencyBn(sumOut)} ({formatBn(countOut)}টি)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-600 block">নিট ক্যাশ প্রবাহ:</span>
                  <strong className="text-sm text-slate-900 font-mono">
                    {formatCurrencyBn(sumIn - sumOut)}
                  </strong>
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-2 px-2.5 border border-slate-300 text-left">তারিখ</th>
                    <th className="py-2 px-2.5 border border-slate-300 text-left">ধরন</th>
                    <th className="py-2 px-2.5 border border-slate-300 text-left">খাত</th>
                    <th className="py-2 px-2.5 border border-slate-300 text-left">বিবরণ</th>
                    <th className="py-2 px-2.5 border border-slate-300 text-left">মাধ্যম</th>
                    <th className="py-2 px-2.5 border border-slate-300 text-right">পরিমাণ (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-200">
                      <td className="py-1.5 px-2.5 border border-slate-300 font-mono">
                        {tx.date}
                      </td>
                      <td className="py-1.5 px-2.5 border border-slate-300 font-bold">
                        {tx.type === 'IN' ? 'জমা (IN)' : 'খরচ (OUT)'}
                      </td>
                      <td className="py-1.5 px-2.5 border border-slate-300 font-bold">
                        {tx.category}
                      </td>
                      <td className="py-1.5 px-2.5 border border-slate-300">
                        {tx.description}
                      </td>
                      <td className="py-1.5 px-2.5 border border-slate-300">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-1.5 px-2.5 border border-slate-300 text-right font-mono font-bold">
                        {tx.type === 'IN' ? '+' : '-'}
                        {formatCurrencyBn(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
