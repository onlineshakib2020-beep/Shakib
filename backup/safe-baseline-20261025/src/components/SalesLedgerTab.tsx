import React, { useEffect, useState } from 'react';
import {
  Banknote,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BrickGrade,
  LanguageMode,
  SalesMemo,
} from '../types/kiln';
import {
  cleanBrickGradeName,
  formatBn,
  formatCurrencyBn,
  parseBanglaDigits,
} from '../utils/kilnLogic';

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
  externalStatusFilter?: 'ALL' | 'PAID' | 'DUE';
  externalSearchQuery?: string;
  onOpenNewMemoModal: () => void;
  onViewMemo: (memo: SalesMemo) => void;
  onOpenDueModal: (memo: SalesMemo) => void;
  onOpenEditModal: (memo: SalesMemo) => void;
  onOpenDeleteModal: (memo: SalesMemo) => void;
  onPrintMemo: (memo: SalesMemo) => void;
}

const getMemoBrickCount = (memo: SalesMemo): number => {
  if (Array.isArray(memo.items) && memo.items.length > 0) {
    return memo.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }
  return Number(memo.quantity) || 0;
};

export const SalesLedgerTab: React.FC<SalesLedgerTabProps> = ({
  lang = 'bn',
  todayDate,
  yesterdayDate,
  salesMemos,
  brickGrades,
  externalStatusFilter,
  externalSearchQuery,
  onOpenNewMemoModal,
  onViewMemo,
  onOpenDueModal,
  onOpenEditModal,
  onOpenDeleteModal,
  onPrintMemo,
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

  // Filter memos by Date Scope + Payment Status + Search Query
  const filteredMemos = salesMemos.filter((m) => {
    if (dateScope === 'TODAY' && m.date !== resolvedToday) return false;
    if (dateScope === 'YESTERDAY' && m.date !== resolvedYesterday) return false;
    if (dateScope === 'CUSTOM' && customDate && m.date !== customDate) return false;

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

  const sumBricks = filteredMemos.reduce((s, m) => s + getMemoBrickCount(m), 0);
  const sumTotal = filteredMemos.reduce((s, m) => s + m.totalAmount, 0);
  const sumPaid = filteredMemos.reduce((s, m) => s + m.paidAmount, 0);
  const sumDue = filteredMemos.reduce((s, m) => s + m.dueAmount, 0);

  const handleExportCsv = () => {
    const headers = [
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
      'Payment Method',
    ];
    const rows = filteredMemos.map((m) => [
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
      `"${m.paymentMethod || ''}"`,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brickflow-memos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Top Hero Header for মেমো খতিয়ান */}
      <div className="bg-gradient-to-r from-[#0F172A] via-slate-900 to-[#1E293B] text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>
              {isEn
                ? 'Customer Sales Memo Ledger'
                : 'ক্রেতার ডিজিটাল ক্যাশ মেমো খতিয়ান'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {isEn
              ? 'Memo Ledger — Search, Today’s Memos, Yesterday’s Memos & All Customer Memos'
              : 'মেমো খতিয়ান — সার্চ অপশন, আজকের মেমো, গতকালের মেমো ও সকল ক্রেতার মেমো'}
          </h2>
          <p className="text-xs text-slate-300">
            {isEn
              ? 'Create memos anytime regardless of stock. Search customers instantly or filter by Today, Yesterday, and All Memos.'
              : 'ইট স্টক থাক বা না থাক মেমো করা যাবে। যাদের মেমো করা হয়েছে তাদের সবাইকে সার্চ করুন অথবা আজকের, গতকালের ও সকল মেমো এক ক্লিকে দেখুন।'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            {isEn ? 'CSV Export' : 'CSV ডাউনলোড'}
          </button>

          <button
            type="button"
            onClick={onOpenNewMemoModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <FilePlus2 className="w-4 h-4" />
            {isEn ? '+ Create New Memo' : '+ নতুন ক্যাশ মেমো তৈরি করুন'}
          </button>
        </div>
      </div>

      {/* 4 Summary Cards: Today's Memos, Yesterday's Memos, All Memos, Paid & Due */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setDateScope('TODAY')}
          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            dateScope === 'TODAY'
              ? 'bg-orange-50/90 border-orange-600 shadow-sm'
              : 'bg-white border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              {isEn ? "Today's Memos" : 'আজকের মেমো'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 text-[11px] font-bold tabular-nums">
              {formatBn(todayMemos.length)}টি মেমো
            </span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 tabular-nums">
            {formatCurrencyBn(todayAmount)}
          </div>
          <div className="text-[11px] text-slate-600 tabular-nums mt-0.5">
            ইট বিক্রি: {formatBn(todayBricks)} পিস · তারিখ: {resolvedToday}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDateScope('YESTERDAY')}
          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            dateScope === 'YESTERDAY'
              ? 'bg-amber-50/90 border-amber-600 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
              {isEn ? "Yesterday's Memos" : 'গতকালের মেমো'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold tabular-nums">
              {formatBn(yesterdayMemos.length)}টি মেমো
            </span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 tabular-nums">
            {formatCurrencyBn(yesterdayAmount)}
          </div>
          <div className="text-[11px] text-slate-600 tabular-nums mt-0.5">
            ইট বিক্রি: {formatBn(yesterdayBricks)} পিস · তারিখ: {resolvedYesterday}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDateScope('ALL')}
          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            dateScope === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-400 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`text-xs font-bold flex items-center gap-1.5 ${
                dateScope === 'ALL' ? 'text-orange-300' : 'text-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isEn ? 'All Customer Memos' : 'সকল মেমো (All Memos)'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                dateScope === 'ALL'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {formatBn(salesMemos.length)}টি মেমো
            </span>
          </div>
          <div className="text-lg font-extrabold tabular-nums">
            {formatCurrencyBn(allAmount)}
          </div>
          <div
            className={`text-[11px] tabular-nums mt-0.5 ${
              dateScope === 'ALL' ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            মোট ইট বিক্রি: {formatBn(allBricks)} পিস
          </div>
        </button>

        <div className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {isEn ? 'Paid & Due Summary' : 'মোট জমা ও বকেয়া হিসাব'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] text-emerald-800 block">নগদ জমা:</span>
              <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                {formatCurrencyBn(allPaid)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-rose-800 block">বকেয়া পাওনা:</span>
              <span className="text-sm font-extrabold text-rose-700 tabular-nums">
                {formatCurrencyBn(allDue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Search Box & Date/Payment Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
        {/* Top Row: Large Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-orange-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-orange-600 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="সার্চ মুছুন"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="memo-custom-date"
              className="text-xs font-bold text-slate-700 whitespace-nowrap"
            >
              {isEn ? 'By Date:' : 'তারিখ অনুযায়ী:'}
            </label>
            <input
              id="memo-custom-date"
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateScope('CUSTOM');
              }}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
            />
          </div>
        </div>

        {/* Bottom Row: Date Tabs (সকল মেমো | আজকের মেমো | গতকালের মেমো) + Status Tabs (সব | পরিশোধিত | বাকি আছে) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              {isEn ? 'Memo Timeframe:' : 'সময়কাল ফিল্টার:'}
            </span>
            <div className="inline-flex flex-wrap p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setDateScope('ALL')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dateScope === 'ALL'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {isEn
                  ? `All Memos (${formatBn(salesMemos.length)})`
                  : `সকল মেমো (${formatBn(salesMemos.length)})`}
              </button>
              <button
                type="button"
                onClick={() => setDateScope('TODAY')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dateScope === 'TODAY'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {isEn
                  ? `Today's Memos (${formatBn(todayMemos.length)})`
                  : `আজকের মেমো (${formatBn(todayMemos.length)})`}
              </button>
              <button
                type="button"
                onClick={() => setDateScope('YESTERDAY')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dateScope === 'YESTERDAY'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {isEn
                  ? `Yesterday's Memos (${formatBn(yesterdayMemos.length)})`
                  : `গতকালের মেমো (${formatBn(yesterdayMemos.length)})`}
              </button>
              {dateScope === 'CUSTOM' && (
                <span className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white">
                  তারিখ: {customDate}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              {isEn ? 'Payment Status:' : 'পেমেন্ট স্ট্যাটাস:'}
            </span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
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
                      : `বাকি আছে (${formatBn(
                          salesMemos.filter((m) => m.dueAmount > 0).length
                        )})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Memos Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-bold text-slate-900">
            {dateScope === 'TODAY'
              ? `আজকের মেমো তালিকা (${resolvedToday}) — মোট ${formatBn(filteredMemos.length)}টি`
              : dateScope === 'YESTERDAY'
              ? `গতকালের মেমো তালিকা (${resolvedYesterday}) — মোট ${formatBn(filteredMemos.length)}টি`
              : dateScope === 'CUSTOM'
              ? `${customDate} তারিখের মেমো তালিকা — মোট ${formatBn(filteredMemos.length)}টি`
              : `যাদের মেমো করা হয়েছে — সকল মেমো তালিকা (${formatBn(filteredMemos.length)}টি)`}
          </div>
          <div className="text-xs font-semibold text-slate-600 tabular-nums">
            মোট ইট: <strong className="text-slate-900">{formatBn(sumBricks)} পিস</strong> · মোট বিল:{' '}
            <strong className="text-slate-900">{formatCurrencyBn(sumTotal)}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-800">
                <th className="py-3.5 px-4 font-bold">
                  {isEn ? 'Memo No & Date' : 'মেমো নং ও তারিখ'}
                </th>
                <th className="py-3.5 px-4 font-bold">
                  {isEn ? 'Customer, Phone & Address' : 'ক্রেতার নাম, ফোন ও ঠিকানা'}
                </th>
                <th className="py-3.5 px-4 font-bold">
                  {isEn ? 'Brick Type' : 'কী ইট নিয়েছে'}
                </th>
                <th className="py-3.5 px-4 font-bold text-right">
                  {isEn ? 'Qty & Rate (/1000)' : 'ইটের পরিমাণ ও হাজারে দর'}
                </th>
                <th className="py-3.5 px-4 font-bold text-right">
                  {isEn ? 'Total Bill' : 'মোট বিল'}
                </th>
                <th className="py-3.5 px-4 font-bold text-right">
                  {isEn ? 'Paid' : 'নগদ জমা'}
                </th>
                <th className="py-3.5 px-4 font-bold text-right">
                  {isEn ? 'Due' : 'বাকি পাওনা'}
                </th>
                <th className="py-3.5 px-4 font-bold text-right">
                  {isEn ? 'Actions' : 'অ্যাকশন'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMemos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center space-y-3">
                    <div className="text-sm font-semibold text-slate-600">
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
                filteredMemos.map((memo) => {
                  const isToday = memo.date === resolvedToday;
                  const isYesterday = memo.date === resolvedYesterday;
                  return (
                    <tr
                      key={memo.id}
                      onClick={() => onViewMemo(memo)}
                      className="hover:bg-orange-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewMemo(memo);
                            }}
                            className="font-bold font-mono text-orange-700 hover:text-orange-800 hover:underline cursor-pointer text-left"
                            title="মেমোর বিস্তারিত পপআপ দেখুন"
                          >
                            {memo.memoNo}
                          </button>
                          {isToday && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded">
                              আজ
                            </span>
                          )}
                          {isYesterday && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                              গতকাল
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{memo.date}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{memo.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {memo.customerPhone} · {memo.customerAddress}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {memo.items && memo.items.length > 0
                          ? memo.items
                              .map((it) => cleanBrickGradeName(it.gradeName))
                              .join(', ')
                          : cleanBrickGradeName(memo.gradeName || '১ নং ইট')}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-700 text-xs font-medium">
                        {memo.items && memo.items.length > 0
                          ? memo.items
                              .map((it) => {
                                const r =
                                  it.rate < 100
                                    ? Math.round(it.rate * 1000)
                                    : it.rate;
                                return `${formatBn(it.quantity)} পিস (@ ৳${formatBn(r)}/হাজার)`;
                              })
                              .join(', ')
                          : `${formatBn(memo.quantity || 0)} পিস (@ ৳${formatBn(
                              (memo.rate || 11000) < 100
                                ? Math.round((memo.rate || 11) * 1000)
                                : memo.rate || 11000
                            )}/হাজার)`}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(memo.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrencyBn(memo.paidAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold tabular-nums">
                        {memo.dueAmount > 0 ? (
                          <div>
                            <span className="text-rose-700">
                              {formatCurrencyBn(memo.dueAmount)}
                            </span>
                            {memo.duePromiseDate && (
                              <span className="block text-[10px] text-rose-500 font-normal">
                                তারিখ: {memo.duePromiseDate}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-700 text-xs font-semibold">
                            {isEn ? 'Paid' : 'পরিশোধিত'}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {memo.dueAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenDueModal(memo)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                              title="বকেয়া আদায় পপআপ খুলুন"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              {isEn ? 'Collect' : 'জমা নিন'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onViewMemo(memo)}
                            aria-label={`${memo.memoNo} বিস্তারিত দেখুন`}
                            title="মেমো বিস্তারিত পপআপ"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            {isEn ? 'Details' : 'বিস্তারিত'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(memo)}
                            aria-label={`${memo.memoNo} আপডেট করুন`}
                            title="মেমো আপডেট ও সংশোধন পপআপ"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-orange-600" />
                            {isEn ? 'Edit' : 'আপডেট'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintMemo(memo)}
                            aria-label={`${memo.memoNo} প্রিন্ট মেমো ও গেটপাস`}
                            title="গেটপাস ও মেমো প্রিন্ট পপআপ"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-orange-400" />
                            {isEn ? 'Print' : 'প্রিন্ট'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDeleteModal(memo)}
                            aria-label={`${memo.memoNo} ডিলিট করুন`}
                            title="মেমো ডিলিট পপআপ"
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                <td colSpan={4} className="py-3.5 px-4 text-right">
                  {isEn
                    ? `Total (${formatBn(filteredMemos.length)} Memos · ${formatBn(sumBricks)} Bricks):`
                    : `সর্বমোট (${formatBn(filteredMemos.length)}টি মেমো · ${formatBn(sumBricks)} পিস ইট):`}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums">
                  {formatCurrencyBn(sumTotal)}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-800 tabular-nums">
                  {formatCurrencyBn(sumPaid)}
                </td>
                <td className="py-3.5 px-4 text-right text-rose-800 tabular-nums">
                  {formatCurrencyBn(sumDue)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
