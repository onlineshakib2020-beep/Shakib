import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Banknote,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  MessageCircle,
  PackageCheck,
  Printer,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type {
  BrickGrade,
  LanguageMode,
  MemoDeliveryRecord,
  SalesMemo,
} from '../types/kiln';
import {
  cleanBrickGradeName,
  formatBn,
  formatCurrencyBn,
  parseBanglaDigits,
} from '../utils/kilnLogic';
import { Card } from './Card';

export type MemoSubSection =
  | 'CUSTOMER_MEMOS'
  | 'MILLS'
  | 'CHULLI_LOAD'
  | 'CHULLI_UNLOAD';

export type MemoDateScope = 'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM';

interface SalesLedgerTabProps {
  lang?: LanguageMode;
  todayDate?: string;
  yesterdayDate?: string;
  salesMemos: SalesMemo[];
  brickGrades: BrickGrade[];
  memoDeliveries?: MemoDeliveryRecord[];
  externalStatusFilter?: 'ALL' | 'PAID' | 'DUE';
  externalSearchQuery?: string;
  onOpenNewMemoModal: () => void;
  onViewMemo: (memo: SalesMemo) => void;
  onOpenDueModal: (memo: SalesMemo) => void;
  onOpenEditModal: (memo: SalesMemo) => void;
  onOpenDeleteModal: (memo: SalesMemo) => void;
  onPrintMemo: (memo: SalesMemo) => void;
  onOpenDeliveryForMemo?: (memo: SalesMemo) => void;
  onSubmitDelivery?: (payload: {
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
}

const getMemoBrickCount = (memo: SalesMemo): number => {
  if (Array.isArray(memo.items) && memo.items.length > 0) {
    return memo.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }
  return Number(memo.quantity) || 0;
};

const getMemoDeliveredCount = (memo: SalesMemo): number => {
  if (Array.isArray(memo.deliveryHistory) && memo.deliveryHistory.length > 0) {
    return memo.deliveryHistory.reduce(
      (sum, d) => sum + (Number(d.quantity) || 0),
      0
    );
  }
  return Number(memo.deliveredQuantity) || 0;
};

const extractMemoNumericOrder = (memoNo: string): number => {
  const normalized = parseBanglaDigits(String(memoNo || ''));
  const match = normalized.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

export const SalesLedgerTab: React.FC<SalesLedgerTabProps> = ({
  lang = 'bn',
  todayDate,
  yesterdayDate,
  salesMemos,
  brickGrades,
  memoDeliveries = [],
  externalStatusFilter,
  externalSearchQuery,
  onOpenNewMemoModal,
  onViewMemo,
  onOpenDueModal,
  onOpenEditModal,
  onOpenDeleteModal,
  onPrintMemo,
  onOpenDeliveryForMemo,
  onSubmitDelivery,
}) => {
  const isEn = lang === 'en';
  const resolvedToday = todayDate || new Date().toISOString().slice(0, 10);
  const resolvedYesterday =
    yesterdayDate ||
    (() => {
      const d = new Date(`${resolvedToday}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

  const [dateScope, setDateScope] = useState<MemoDateScope>('ALL');
  const [customDate, setCustomDate] = useState<string>(resolvedToday);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'SEQUENTIAL_ASC' | 'LATEST_FIRST'>(
    'SEQUENTIAL_ASC'
  );

  // Quick Inline Delivery Modal State
  const [quickDeliveryMemoId, setQuickDeliveryMemoId] = useState<string | null>(
    null
  );
  const [quickGradeId, setQuickGradeId] = useState<string>(
    brickGrades[0]?.id || 'grade-1'
  );
  const [quickQty, setQuickQty] = useState<string>('');
  const [quickDate, setQuickDate] = useState<string>(resolvedToday);
  const [quickTruck, setQuickTruck] = useState<string>('');
  const [quickDriver, setQuickDriver] = useState<string>('');
  const [quickNote, setQuickNote] = useState<string>('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const activeQuickMemo = useMemo(
    () => salesMemos.find((m) => m.id === quickDeliveryMemoId) || null,
    [salesMemos, quickDeliveryMemoId]
  );

  useEffect(() => {
    if (externalStatusFilter) {
      setStatusFilter(externalStatusFilter);
    }
  }, [externalStatusFilter]);

  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  const openQuickDeliveryModal = (memo: SalesMemo) => {
    if (!onSubmitDelivery && onOpenDeliveryForMemo) {
      onOpenDeliveryForMemo(memo);
      return;
    }
    setQuickDeliveryMemoId(memo.id);
    const defaultGrade =
      memo.items?.[0]?.gradeId ||
      memo.gradeId ||
      brickGrades[0]?.id ||
      'grade-1';
    setQuickGradeId(defaultGrade);
    setQuickDate(resolvedToday);
    setQuickTruck(memo.truckNo && memo.truckNo !== '—' ? memo.truckNo : '');
    setQuickDriver(
      memo.driverName && memo.driverName !== '—' ? memo.driverName : ''
    );
    setQuickNote('');
    const ord = getMemoBrickCount(memo);
    const del = getMemoDeliveredCount(memo);
    const rem = Math.max(0, ord - del);
    setQuickQty(rem > 0 ? String(Math.min(1000, rem)) : '');
  };

  const handleQuickDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuickMemo || !onSubmitDelivery) return;
    const qtyNum = Math.round(
      Number(parseBanglaDigits(String(quickQty || '0'))) || 0
    );
    if (qtyNum <= 0) return;

    setQuickSubmitting(true);
    try {
      const ok = await onSubmitDelivery({
        memoId: activeQuickMemo.id,
        memoNo: activeQuickMemo.memoNo,
        gradeId: quickGradeId,
        quantity: qtyNum,
        date: quickDate || resolvedToday,
        truckNo: quickTruck.trim() || undefined,
        driverName: quickDriver.trim() || undefined,
        note: quickNote.trim() || undefined,
      });
      if (ok) {
        const ord = getMemoBrickCount(activeQuickMemo);
        const del = getMemoDeliveredCount(activeQuickMemo) + qtyNum;
        const newRem = Math.max(0, ord - del);
        setQuickNote('');
        setQuickQty(newRem > 0 ? String(Math.min(1000, newRem)) : '');
        if (newRem === 0) {
          setQuickDeliveryMemoId(null);
        }
      }
    } finally {
      setQuickSubmitting(false);
    }
  };

  // Pre-compute Today, Yesterday, and All Memo summaries
  const todayMemos = salesMemos.filter((m) => m.date === resolvedToday);
  const yesterdayMemos = salesMemos.filter((m) => m.date === resolvedYesterday);

  const todayBricks = todayMemos.reduce((s, m) => s + getMemoBrickCount(m), 0);
  const todayAmount = todayMemos.reduce((s, m) => s + m.totalAmount, 0);

  const yesterdayBricks = yesterdayMemos.reduce(
    (s, m) => s + getMemoBrickCount(m),
    0
  );
  const yesterdayAmount = yesterdayMemos.reduce((s, m) => s + m.totalAmount, 0);

  const allBricks = salesMemos.reduce((s, m) => s + getMemoBrickCount(m), 0);
  const allAmount = salesMemos.reduce((s, m) => s + m.totalAmount, 0);
  const allPaid = salesMemos.reduce((s, m) => s + m.paidAmount, 0);
  const allDue = salesMemos.reduce((s, m) => s + m.dueAmount, 0);

  // Filter memos by Date Scope + Payment Status + Search Query, then sort sequentially
  const filteredMemos = useMemo(() => {
    const matches = salesMemos.filter((m) => {
      if (dateScope === 'TODAY' && m.date !== resolvedToday) return false;
      if (dateScope === 'YESTERDAY' && m.date !== resolvedYesterday) return false;
      if (dateScope === 'CUSTOM' && customDate && m.date !== customDate)
        return false;

      if (statusFilter === 'PAID' && m.dueAmount > 0) return false;
      if (statusFilter === 'DUE' && m.dueAmount === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const normQ = parseBanglaDigits(q);
        const normPhone = parseBanglaDigits(m.customerPhone || '').toLowerCase();
        const normMemo = parseBanglaDigits(m.memoNo || '').toLowerCase();
        const normAddress = (m.customerAddress || '').toLowerCase();
        const normTruck = (m.truckNo || '').toLowerCase();
        return (
          m.customerName.toLowerCase().includes(q) ||
          m.memoNo.toLowerCase().includes(q) ||
          normMemo.includes(normQ) ||
          (m.customerPhone && m.customerPhone.toLowerCase().includes(q)) ||
          normPhone.includes(normQ) ||
          normAddress.includes(q) ||
          normTruck.includes(q) ||
          (Boolean(m.gradeName) && m.gradeName!.toLowerCase().includes(q)) ||
          (Array.isArray(m.items) &&
            m.items.some((it) => it.gradeName.toLowerCase().includes(q)))
        );
      }
      return true;
    });

    return [...matches].sort((a, b) => {
      const numA = extractMemoNumericOrder(a.memoNo);
      const numB = extractMemoNumericOrder(b.memoNo);
      if (sortOrder === 'SEQUENTIAL_ASC') {
        if (numA !== numB) return numA - numB;
        return a.date.localeCompare(b.date);
      }
      if (numB !== numA) return numB - numA;
      return b.date.localeCompare(a.date);
    });
  }, [
    salesMemos,
    dateScope,
    resolvedToday,
    resolvedYesterday,
    customDate,
    statusFilter,
    searchQuery,
    sortOrder,
  ]);

  const sumBricks = filteredMemos.reduce((s, m) => s + getMemoBrickCount(m), 0);
  const sumTotal = filteredMemos.reduce((s, m) => s + m.totalAmount, 0);
  const sumPaid = filteredMemos.reduce((s, m) => s + m.paidAmount, 0);
  const sumDue = filteredMemos.reduce((s, m) => s + m.dueAmount, 0);

  const handleExportCsv = () => {
    const headers = [
      'SL',
      'Memo No',
      'Date',
      'Customer Name',
      'Phone',
      'Address',
      'Items',
      'Discount',
      'Total Bill',
      'Paid Amount',
      'Due Amount',
      'Delivered Bricks',
      'Payment Method',
    ];
    const rows = filteredMemos.map((m, idx) => [
      idx + 1,
      m.memoNo,
      m.date,
      `"${(m.customerName || '').replace(/"/g, '""')}"`,
      `"${(m.customerPhone || '').replace(/"/g, '""')}"`,
      `"${(m.customerAddress || '').replace(/"/g, '""')}"`,
      `"${(m.items && m.items.length > 0
        ? m.items
            .map((i) => `${cleanBrickGradeName(i.gradeName)} x ${i.quantity}`)
            .join('; ')
        : `${cleanBrickGradeName(m.gradeName || '')} x ${m.quantity || 0}`
      ).replace(/"/g, '""')}"`,
      m.discount || 0,
      m.totalAmount,
      m.paidAmount,
      m.dueAmount,
      getMemoDeliveredCount(m),
      `"${m.paymentMethod || ''}"`,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sbl-memos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 animate-slide-up">
      {/* Top Hero Command Header for মেমো খতিয়ান — Compact on Phone */}
      <div className="rounded-xl sm:rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-2.5 sm:p-6 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center sm:items-center gap-2 sm:gap-3.5">
          <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-md shrink-0">
            <BookOpen className="w-3.5 h-3.5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9px] sm:text-[11px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {isEn ? 'Live Memo Khotiyan' : 'লাইভ মেমো খতিয়ান ও স্টক সিঙ্ক'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9px] sm:text-[11px] font-black">
                {isEn ? 'Sequential Order' : 'ধারাবাহিক ক্রমিক (১ → শেষ)'}
              </span>
            </div>
            <h2 className="text-xs sm:text-xl font-black text-white tracking-tight mt-0.5 leading-tight truncate sm:whitespace-normal">
              {isEn
                ? 'Customer Sales Memo Ledger — Sequential View, Delivery & Collections'
                : 'ক্রেতার ডিজিটাল ক্যাশ মেমো খতিয়ান — এক লাইনে ধারাবাহিক তালিকা, বিস্তারিত ও ডেলিভারি'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 hidden sm:block">
              {isEn
                ? 'All memos are arranged sequentially. Click "Details" for full breakdown or "Delivery" to dispatch bricks instantly.'
                : 'প্রতিটি মেমো ধারাবাহিক ক্রমিক অনুযায়ী এক লাইনে সাজানো। "বিস্তারিত" বাটনে ক্লিক করলে সম্পূর্ণ তথ্য এবং "ডেলিভারি" বাটনে ক্লিক করলে সাথে সাথে ইট ডেলিভারি দেওয়া যাবে।'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="sbl-btn-interactive inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 text-[10px] sm:text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/90 rounded-lg sm:rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 shrink-0" />
            <span>{isEn ? 'CSV Export' : 'CSV ডাউনলোড'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewMemoModal}
            className="sbl-btn-interactive flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 rounded-lg sm:rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-500/25 whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>{isEn ? '+ Create New Memo' : '+ নতুন ক্যাশ মেমো তৈরি করুন'}</span>
          </button>
        </div>
      </div>

      {/* 4 Compact Summary Cards — 2x2 Compact Grid on Phone */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setDateScope('TODAY')}
          className={`text-left p-2 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
            dateScope === 'TODAY'
              ? 'bg-orange-50/90 border-orange-600 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-orange-800 flex items-center gap-1 truncate">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 shrink-0" />
              <span className="truncate">{isEn ? "Today's Memos" : 'আজকের মেমো'}</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-orange-100 text-orange-900 text-[9px] sm:text-[10px] font-bold tabular-nums shrink-0">
              {formatBn(todayMemos.length)}টি
            </span>
          </div>
          <div className="text-sm sm:text-lg font-extrabold text-slate-900 tabular-nums">
            {formatCurrencyBn(todayAmount)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-600 tabular-nums truncate">
            ইট: {formatBn(todayBricks)} পিস · {resolvedToday}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDateScope('YESTERDAY')}
          className={`text-left p-2 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
            dateScope === 'YESTERDAY'
              ? 'bg-amber-50/90 border-amber-600 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-amber-900 flex items-center gap-1 truncate">
              <CalendarClock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">{isEn ? "Yesterday's Memos" : 'গতকালের মেমো'}</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] sm:text-[10px] font-bold tabular-nums shrink-0">
              {formatBn(yesterdayMemos.length)}টি
            </span>
          </div>
          <div className="text-sm sm:text-lg font-extrabold text-slate-900 tabular-nums">
            {formatCurrencyBn(yesterdayAmount)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-600 tabular-nums truncate">
            ইট: {formatBn(yesterdayBricks)} পিস · {resolvedYesterday}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDateScope('ALL')}
          className={`text-left p-2 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
            dateScope === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-400 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
            <span
              className={`text-[11px] sm:text-xs font-bold flex items-center gap-1 truncate ${
                dateScope === 'ALL' ? 'text-orange-300' : 'text-slate-700'
              }`}
            >
              <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">{isEn ? 'All Memos' : 'সকল মেমো'}</span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold tabular-nums shrink-0 ${
                dateScope === 'ALL'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {formatBn(salesMemos.length)}টি
            </span>
          </div>
          <div className="text-sm sm:text-lg font-extrabold tabular-nums">
            {formatCurrencyBn(allAmount)}
          </div>
          <div
            className={`text-[10px] sm:text-[11px] tabular-nums truncate ${
              dateScope === 'ALL' ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            মোট ইট বিক্রি: {formatBn(allBricks)} পিস
          </div>
        </button>

        <div className="p-2 sm:p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-900 flex items-center gap-1 truncate">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{isEn ? 'Paid & Due' : 'মোট জমা ও বকেয়া'}</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1.5">
            <div>
              <span className="text-[9px] sm:text-[10px] text-emerald-800 block">নগদ জমা:</span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-700 tabular-nums">
                {formatCurrencyBn(allPaid)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] sm:text-[10px] text-rose-800 block">বকেয়া পাওনা:</span>
              <span className="text-xs sm:text-sm font-extrabold text-rose-700 tabular-nums">
                {formatCurrencyBn(allDue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Search & Filter Bar */}
      <Card variant="default" padding="sm" className="space-y-2 sm:space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-1.5 sm:gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="মেমো নং, ক্রেতার নাম, মোবাইল বা ঠিকানা দিয়ে খুঁজুন"
              placeholder={
                isEn
                  ? 'Search by Customer Name, Memo No, Phone, Address, Truck No or Brick Type...'
                  : 'মেমো খুঁজুন: ক্রেতার নাম, মেমো নং, মোবাইল নম্বর, ঠিকানা বা ইটের নাম লিখুন...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-orange-600 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="সার্চ মুছুন"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <label
                htmlFor="memo-custom-date"
                className="text-[11px] sm:text-xs font-bold text-slate-800 whitespace-nowrap"
              >
                {isEn ? 'Date:' : 'তারিখ:'}
              </label>
              <input
                id="memo-custom-date"
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateScope('CUSTOM');
                }}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-bold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:bg-white focus:border-orange-600"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) =>
                  prev === 'SEQUENTIAL_ASC' ? 'LATEST_FIRST' : 'SEQUENTIAL_ASC'
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] sm:text-xs font-bold cursor-pointer whitespace-nowrap transition-colors"
              title="মেমো তালিকার ধারাবাহিক ক্রম পরিবর্তন করুন"
            >
              <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600" />
              <span>
                {sortOrder === 'SEQUENTIAL_ASC'
                  ? isEn
                    ? 'Sequential (1 → N)'
                    : 'ধারাবাহিক (১ → শেষ)'
                  : isEn
                  ? 'Latest First'
                  : 'নতুন মেমো আগে'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <span className="text-[10px] sm:text-xs font-bold text-slate-700">
              {isEn ? 'Timeframe:' : 'সময়কাল:'}
            </span>
            <div className="inline-flex flex-wrap p-0.5 bg-slate-100 rounded-lg sm:rounded-xl gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => setDateScope('ALL')}
                className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  dateScope === 'ALL'
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {isEn
                  ? `All (${formatBn(salesMemos.length)})`
                  : `সকল (${formatBn(salesMemos.length)})`}
              </button>
              <button
                type="button"
                onClick={() => setDateScope('TODAY')}
                className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  dateScope === 'TODAY'
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {isEn
                  ? `Today (${formatBn(todayMemos.length)})`
                  : `আজকের (${formatBn(todayMemos.length)})`}
              </button>
              <button
                type="button"
                onClick={() => setDateScope('YESTERDAY')}
                className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  dateScope === 'YESTERDAY'
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {isEn
                  ? `Yesterday (${formatBn(yesterdayMemos.length)})`
                  : `গতকাল (${formatBn(yesterdayMemos.length)})`}
              </button>
              {dateScope === 'CUSTOM' && (
                <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg bg-slate-900 text-white whitespace-nowrap">
                  তারিখ: {customDate}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <span className="text-[10px] sm:text-xs font-bold text-slate-700">
              {isEn ? 'Status:' : 'স্ট্যাটাস:'}
            </span>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg sm:rounded-xl gap-0.5 sm:gap-1">
              {(
                [
                  {
                    id: 'ALL',
                    label: isEn
                      ? `All (${formatBn(salesMemos.length)})`
                      : `সব (${formatBn(salesMemos.length)})`,
                  },
                  {
                    id: 'PAID',
                    label: isEn
                      ? `Paid (${formatBn(
                          salesMemos.filter((m) => m.dueAmount === 0).length
                        )})`
                      : `পরিশোধিত (${formatBn(
                          salesMemos.filter((m) => m.dueAmount === 0).length
                        )})`,
                  },
                  {
                    id: 'DUE',
                    label: isEn
                      ? `Due (${formatBn(
                          salesMemos.filter((m) => m.dueAmount > 0).length
                        )})`
                      : `বাকি (${formatBn(
                          salesMemos.filter((m) => m.dueAmount > 0).length
                        )})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Customer Memos Table — Strictly Compact Single-Line Sequential Rows */}
      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            <span>
              {dateScope === 'TODAY'
                ? `আজকের মেমো তালিকা (${resolvedToday}) — মোট ${formatBn(filteredMemos.length)}টি`
                : dateScope === 'YESTERDAY'
                ? `গতকালের মেমো তালিকা (${resolvedYesterday}) — মোট ${formatBn(filteredMemos.length)}টি`
                : dateScope === 'CUSTOM'
                ? `${customDate} তারিখের মেমো তালিকা — মোট ${formatBn(filteredMemos.length)}টি`
                : `যাদের মেমো করা হয়েছে — সকল মেমো তালিকা (${formatBn(filteredMemos.length)}টি)`}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-300 tabular-nums">
            মোট ইট: <strong className="text-amber-300">{formatBn(sumBricks)} পিস</strong> · মোট বিল:{' '}
            <strong className="text-emerald-300">{formatCurrencyBn(sumTotal)}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            data-testid="sequential-single-line-memo-table"
            className="w-full text-xs text-left border-collapse"
          >
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-2.5 font-extrabold text-center w-10">
                  {isEn ? 'SL' : 'ক্রঃ'}
                </th>
                <th className="py-2.5 px-2.5 font-extrabold">
                  {isEn ? 'Memo No' : 'মেমো নং'}
                </th>
                <th className="py-2.5 px-2.5 font-extrabold">
                  {isEn ? 'Date' : 'তারিখ'}
                </th>
                <th className="py-2.5 px-3 font-extrabold">
                  {isEn ? 'Customer & Mobile' : 'ক্রেতার নাম ও মোবাইল'}
                </th>
                <th className="py-2.5 px-3 font-extrabold">
                  {isEn ? 'Brick & Qty' : 'ইটের ধরন ও পরিমাণ'}
                </th>
                <th className="py-2.5 px-2.5 font-extrabold text-right">
                  {isEn ? 'Total Bill' : 'মোট বিল'}
                </th>
                <th className="py-2.5 px-2.5 font-extrabold text-right">
                  {isEn ? 'Paid' : 'নগদ জমা'}
                </th>
                <th className="py-2.5 px-2.5 font-extrabold text-right">
                  {isEn ? 'Due' : 'বাকি'}
                </th>
                <th className="py-2.5 px-3 font-extrabold text-center">
                  {isEn ? 'Delivery Status & Action' : 'ডেলিভারি হিসাব'}
                </th>
                <th className="py-2.5 px-3 font-extrabold text-right">
                  {isEn ? 'Options' : 'বিস্তারিত ও অ্যাকশন'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/90">
              {filteredMemos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center space-y-2.5">
                    <div className="text-xs sm:text-sm font-semibold text-slate-600">
                      {isEn
                        ? 'No customer memos found for this filter.'
                        : 'এই ফিল্টারে কোনো ক্রেতার মেমো পাওয়া যায়নি।'}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={onOpenNewMemoModal}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors cursor-pointer"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" />
                        + নতুন ক্যাশ মেমো তৈরি করুন
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMemos.map((memo, index) => {
                  const isToday = memo.date === resolvedToday;
                  const isYesterday = memo.date === resolvedYesterday;
                  const ord = getMemoBrickCount(memo);
                  const del = getMemoDeliveredCount(memo);
                  const rem = Math.max(0, ord - del);
                  const isFullyDelivered = rem === 0 && ord > 0;
                  const gradeSummary =
                    memo.items && memo.items.length > 0
                      ? memo.items
                          .map((it) => cleanBrickGradeName(it.gradeName))
                          .join(', ')
                      : cleanBrickGradeName(memo.gradeName || '১ নং ইট');

                  return (
                    <tr
                      key={memo.id}
                      onClick={() => onViewMemo(memo)}
                      className="hover:bg-orange-50/50 transition-colors cursor-pointer whitespace-nowrap align-middle"
                    >
                      {/* 1. SL No */}
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-500 tabular-nums">
                        {formatBn(index + 1)}
                      </td>

                      {/* 2. Memo No (Single Line) */}
                      <td className="py-2 px-2.5 tabular-nums">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewMemo(memo);
                            }}
                            className="font-extrabold font-mono text-orange-700 hover:text-orange-800 hover:underline cursor-pointer"
                            title="ক্লিক করে মেমোর সম্পূর্ণ বিস্তারিত দেখুন"
                          >
                            #{memo.memoNo}
                          </button>
                          {isToday && (
                            <span className="px-1 py-0.2 text-[9px] font-extrabold bg-orange-100 text-orange-800 rounded">
                              আজ
                            </span>
                          )}
                          {isYesterday && (
                            <span className="px-1 py-0.2 text-[9px] font-extrabold bg-amber-100 text-amber-800 rounded">
                              গতকাল
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Date (Single Line) */}
                      <td className="py-2 px-2.5 font-mono font-semibold text-slate-700 tabular-nums">
                        {memo.date}
                      </td>

                      {/* 4. Customer Name & Phone (Single Line, address in Details modal) */}
                      <td className="py-2 px-3 max-w-[230px] truncate">
                        <span className="font-extrabold text-slate-950">
                          {memo.customerName}
                        </span>
                        {memo.customerPhone && (
                          <span className="text-slate-600 font-medium ml-1.5 tabular-nums">
                            · {memo.customerPhone}
                          </span>
                        )}
                      </td>

                      {/* 5. Brick Grade & Quantity (Single Line) */}
                      <td className="py-2 px-3 tabular-nums">
                        <span className="font-bold text-slate-900">
                          {gradeSummary}
                        </span>
                        <span className="text-slate-600 font-semibold ml-1">
                          · {formatBn(ord)} পিস
                        </span>
                      </td>

                      {/* 6. Total Bill */}
                      <td className="py-2 px-2.5 text-right font-extrabold text-slate-950 tabular-nums">
                        {formatCurrencyBn(memo.totalAmount)}
                      </td>

                      {/* 7. Paid Amount */}
                      <td className="py-2 px-2.5 text-right font-extrabold text-emerald-700 tabular-nums">
                        {formatCurrencyBn(memo.paidAmount)}
                      </td>

                      {/* 8. Due Amount */}
                      <td className="py-2 px-2.5 text-right font-extrabold tabular-nums">
                        {memo.dueAmount > 0 ? (
                          <span className="text-rose-700">
                            {formatCurrencyBn(memo.dueAmount)}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            {isEn ? 'Paid' : 'পরিশোধিত'}
                          </span>
                        )}
                      </td>

                      {/* 9. Delivery Status + 1-Click Delivery Button (Single Line) */}
                      <td
                        className="py-2 px-3 text-center tabular-nums"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              isFullyDelivered
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                : del > 0
                                ? 'bg-amber-100 text-amber-950 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isFullyDelivered
                              ? `সম্পন্ন (${formatBn(del)})`
                              : `${formatBn(del)}/${formatBn(ord)} পিস`}
                          </span>

                          {(onOpenDeliveryForMemo || onSubmitDelivery) && (
                            <button
                              type="button"
                              onClick={() => openQuickDeliveryModal(memo)}
                              className={`btn-tactile inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold rounded-full transition-colors cursor-pointer ${
                                isFullyDelivered
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                                  : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white border border-amber-400/40'
                              }`}
                              title="এই মেমোর ইট ডেলিভারি দিন বা ডেলিভারি হিসাব দেখুন"
                            >
                              <Truck className="w-3 h-3" />
                              <span>{isEn ? 'Delivery' : 'ডেলিভারি'}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 10. Actions (Single Line Compact Tactile Pills + 1-Click WhatsApp Receipt) */}
                      <td
                        className="py-2 px-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewMemo(memo)}
                            aria-label={`${memo.memoNo} বিস্তারিত দেখুন`}
                            title="মেমো বিস্তারিত পপআপ দেখুন"
                            className="btn-tactile inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-slate-900 text-white rounded-full hover:bg-slate-800 border border-amber-400/30 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-amber-300" />
                            <span>{isEn ? 'Details' : 'বিস্তারিত'}</span>
                          </button>

                          {memo.dueAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenDueModal(memo)}
                              className="btn-tactile inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 transition-colors cursor-pointer"
                              title="বকেয়া আদায় পপআপ খুলুন"
                            >
                              <Banknote className="w-3 h-3" />
                              <span>{isEn ? 'Collect' : 'জমা'}</span>
                            </button>
                          )}

                          <a
                            href={`https://wa.me/${
                              memo.customerPhone && memo.customerPhone.replace(/\D/g, '').length >= 10
                                ? `88${memo.customerPhone.replace(/\D/g, '').slice(-11)}`
                                : ''
                            }?text=${encodeURIComponent(
                              `🧱 *SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)*\n📄 *ডিজিটাল ক্যাশ মেমো রসিদ*\nমেমো নং: #${memo.memoNo} | তারিখ: ${memo.date}\nক্রেতা: ${memo.customerName}\nইটের বিবরণ: ${gradeSummary} (${formatBn(ord)} পিস)\nমোট বিল: ${formatCurrencyBn(memo.totalAmount)}\nনগদ জমা: ${formatCurrencyBn(memo.paidAmount)}\nবর্তমান বাকি: ${formatCurrencyBn(memo.dueAmount)}\nপ্রোঃ মোঃ কামরুল ইসলাম সাহেব (01913-678010)`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${memo.memoNo} হোয়াটসঅ্যাপ রসিদ পাঠান`}
                            title="১ ক্লিকে হোয়াটসঅ্যাপে ডিজিটাল ক্যাশ মেমো রসিদ পাঠান"
                            className="btn-tactile inline-flex items-center gap-1 px-2 py-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-full border border-emerald-400/40 transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WA</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => onOpenEditModal(memo)}
                            aria-label={`${memo.memoNo} আপডেট করুন`}
                            title="মেমো আপডেট ও সংশোধন পপআপ"
                            className="p-1 text-orange-700 hover:bg-orange-100 border border-orange-200 bg-orange-50/70 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onPrintMemo(memo)}
                            aria-label={`${memo.memoNo} প্রিন্ট মেমো ও গেটপাস`}
                            title="গেটপাস ও মেমো প্রিন্ট পপআপ"
                            className="p-1 text-slate-700 hover:bg-slate-200 border border-slate-200 bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDeleteModal(memo)}
                            aria-label={`${memo.memoNo} ডিলিট করুন`}
                            title="মেমো ডিলিট পপআপ"
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900 whitespace-nowrap text-xs">
                <td colSpan={5} className="py-2.5 px-3 text-right">
                  {isEn
                    ? `Total (${formatBn(filteredMemos.length)} Memos · ${formatBn(sumBricks)} Bricks):`
                    : `সর্বমোট (${formatBn(filteredMemos.length)}টি মেমো · ${formatBn(sumBricks)} পিস ইট):`}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums">
                  {formatCurrencyBn(sumTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-emerald-800 tabular-nums">
                  {formatCurrencyBn(sumPaid)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-rose-800 tabular-nums">
                  {formatCurrencyBn(sumDue)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Instant Quick Brick Delivery Popup Modal right inside Memo Ledger */}
      {activeQuickMemo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`মেমো #${activeQuickMemo.memoNo} ইট ডেলিভারি পপআপ`}
          data-testid="quick-memo-delivery-modal"
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setQuickDeliveryMemoId(null)}
        >
          <div
            className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl space-y-4 text-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-900 font-mono text-xs font-extrabold">
                      মেমো #{activeQuickMemo.memoNo}
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      তারিখ: {activeQuickMemo.date}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-950 mt-0.5">
                    {activeQuickMemo.customerName} ({activeQuickMemo.customerPhone})
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickDeliveryMemoId(null)}
                aria-label="ডেলিভারি পপআপ বন্ধ করুন"
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Summary Pills */}
            {(() => {
              const ord = getMemoBrickCount(activeQuickMemo);
              const del = getMemoDeliveredCount(activeQuickMemo);
              const rem = Math.max(0, ord - del);
              const historyList: MemoDeliveryRecord[] =
                Array.isArray(activeQuickMemo.deliveryHistory) &&
                activeQuickMemo.deliveryHistory.length > 0
                  ? activeQuickMemo.deliveryHistory
                  : memoDeliveries.filter((d) => d.memoId === activeQuickMemo.id);

              return (
                <>
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                      <span className="block text-[10px] text-slate-300 font-semibold">
                        মেমোতে মোট ইট
                      </span>
                      <span className="text-sm sm:text-base font-black tabular-nums">
                        {formatBn(ord)} পিস
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                      <span className="block text-[10px] text-emerald-700 font-bold">
                        ডেলিভারি গেছে
                      </span>
                      <span className="text-sm sm:text-base font-black text-emerald-700 tabular-nums">
                        {formatBn(del)} পিস
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                      <span className="block text-[10px] text-amber-800 font-bold">
                        ডেলিভারি বাকি
                      </span>
                      <span className="text-sm sm:text-base font-black text-amber-800 tabular-nums">
                        {formatBn(rem)} পিস
                      </span>
                    </div>
                  </div>

                  {/* Quick Delivery Form */}
                  {rem > 0 ? (
                    <form
                      onSubmit={handleQuickDeliverySubmit}
                      className="bg-orange-50/50 border border-orange-200 rounded-xl p-3.5 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-800 mb-1">
                            ইটের গ্রেড *
                          </label>
                          <select
                            value={quickGradeId}
                            onChange={(e) => setQuickGradeId(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                          >
                            {brickGrades.map((g) => (
                              <option key={g.id} value={g.id}>
                                {cleanBrickGradeName(g.nameBn)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-800 mb-1">
                            ডেলিভারির তারিখ *
                          </label>
                          <input
                            type="date"
                            value={quickDate}
                            onChange={(e) => setQuickDate(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-900 mb-1">
                          এই খেপে কত পিস ইট ডেলিভারি যাচ্ছে *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={rem}
                          required
                          value={quickQty}
                          onChange={(e) => setQuickQty(e.target.value)}
                          placeholder="যেমন: 1000"
                          className="w-full px-3 py-2 text-sm font-black font-mono bg-white border-2 border-orange-400 rounded-xl focus:outline-none focus:border-orange-600"
                        />
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {[500, 1000, 1500, 2000, 2500].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() =>
                                setQuickQty(String(Math.min(q, rem)))
                              }
                              className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-orange-100 text-slate-800 rounded border border-slate-300 cursor-pointer"
                            >
                              {formatBn(q)} পিস
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setQuickQty(String(rem))}
                            className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded border border-emerald-300 cursor-pointer"
                          >
                            সম্পূর্ণ বাকি ({formatBn(rem)} পিস)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            গাড়ি / ট্রলি নম্বর (ঐচ্ছিক)
                          </label>
                          <input
                            type="text"
                            value={quickTruck}
                            onChange={(e) => setQuickTruck(e.target.value)}
                            placeholder="যেমন: সাতক্ষীরা-ট-১১-২২৩৩"
                            className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            ড্রাইভার / নোট (ঐচ্ছিক)
                          </label>
                          <input
                            type="text"
                            value={quickNote}
                            onChange={(e) => setQuickNote(e.target.value)}
                            placeholder="যেমন: ১ম ট্রিপ ডেলিভারি..."
                            className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={quickSubmitting}
                        className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-extrabold cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {quickSubmitting
                            ? 'ডেলিভারি সেভ হচ্ছে...'
                            : 'ইট ডেলিভারি সাবমিট করুন'}
                        </span>
                      </button>
                    </form>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-900 flex items-center justify-center gap-2">
                      <PackageCheck className="w-4 h-4 text-emerald-600" />
                      <span>
                        এই মেমোর সম্পূর্ণ ইট ({formatBn(ord)} পিস) ডেলিভারি সম্পন্ন হয়েছে!
                      </span>
                    </div>
                  )}

                  {/* Compact Previous Deliveries List for this Memo */}
                  {historyList.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-800 flex items-center justify-between">
                        <span>পূর্ববর্তী ডেলিভারি ট্রিপসমূহ ({formatBn(historyList.length)}টি)</span>
                        <span>মোট: {formatBn(del)} পিস</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {historyList.map((trip, i) => (
                          <div
                            key={trip.id || i}
                            className="px-3 py-1.5 flex items-center justify-between gap-2 whitespace-nowrap"
                          >
                            <span className="font-mono font-bold text-emerald-800">
                              ট্রিপ #{formatBn(i + 1)} · {trip.date}
                            </span>
                            <span className="text-slate-600 truncate">
                              {cleanBrickGradeName(trip.gradeName)}{' '}
                              {trip.truckNo ? `(${trip.truckNo})` : ''}
                            </span>
                            <span className="font-mono font-extrabold text-slate-950 tabular-nums">
                              {formatBn(trip.quantity)} পিস
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
              {onOpenDeliveryForMemo && (
                <button
                  type="button"
                  onClick={() => {
                    const target = activeQuickMemo;
                    setQuickDeliveryMemoId(null);
                    onOpenDeliveryForMemo(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>সম্পূর্ণ ডেলিভারি খাতা খুলুন →</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuickDeliveryMemoId(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer ml-auto"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
