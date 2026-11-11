import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Factory,
  Flame,
  Layers,
  PackageCheck,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type {
  BrickGrade,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  LanguageMode,
  MemoDeliveryRecord,
  MillPotRecord,
  PoraiMistriRecord,
  SalesMemo,
} from '../types/kiln';
import {
  cleanBrickGradeName,
  computeKilnBrickPipelineSummary,
  formatBn,
  parseBanglaDigits,
} from '../utils/kilnLogic';
import { Card } from './Card';
import { TruckDimensionBillCalculator } from './TruckDimensionBillCalculator';

interface BrickDeliveryTabProps {
  lang?: LanguageMode;
  todayDate?: string;
  initialMemoNo?: string;
  salesMemos: SalesMemo[];
  brickGrades: BrickGrade[];
  millPots: MillPotRecord[];
  chulliLoads: ChulliLoadRecord[];
  poraiMistriRecords: PoraiMistriRecord[];
  chulliUnloads: ChulliUnloadRecord[];
  memoDeliveries: MemoDeliveryRecord[];
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
  onDeleteDelivery: (deliveryId: string) => Promise<void>;
  onViewMemo: (memo: SalesMemo) => void;
}

const QUICK_DELIVERY_QTYS = [500, 1000, 1500, 2000, 2500, 3000, 5000];

const getMemoOrderedTotal = (memo: SalesMemo): number => {
  if (Array.isArray(memo.items) && memo.items.length > 0) {
    return memo.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  }
  return Number(memo.quantity) || 0;
};

const getMemoDeliveredTotal = (memo: SalesMemo): number => {
  if (Array.isArray(memo.deliveryHistory) && memo.deliveryHistory.length > 0) {
    return memo.deliveryHistory.reduce((s, d) => s + (Number(d.quantity) || 0), 0);
  }
  return Number(memo.deliveredQuantity) || 0;
};

export const BrickDeliveryTab: React.FC<BrickDeliveryTabProps> = ({
  lang = 'bn',
  todayDate,
  initialMemoNo,
  salesMemos,
  brickGrades,
  millPots,
  chulliLoads,
  poraiMistriRecords,
  chulliUnloads,
  memoDeliveries,
  onSubmitDelivery,
  onDeleteDelivery,
  onViewMemo,
}) => {
  const isEn = lang === 'en';
  const resolvedToday = todayDate || new Date().toISOString().slice(0, 10);

  // Full Kiln Brick Pipeline Summary
  const pipeline = useMemo(
    () =>
      computeKilnBrickPipelineSummary({
        millPots,
        chulliLoads,
        poraiMistriRecords,
        chulliUnloads,
        brickGrades,
        salesMemos,
        memoDeliveries,
      }),
    [
      millPots,
      chulliLoads,
      poraiMistriRecords,
      chulliUnloads,
      brickGrades,
      salesMemos,
      memoDeliveries,
    ]
  );

  // Memo Search & Selection State — starts empty unless initialMemoNo is explicitly provided
  const [memoNoInput, setMemoNoInput] = useState<string>(
    initialMemoNo ? initialMemoNo.trim() : ''
  );
  const [deliveryGradeId, setDeliveryGradeId] = useState<string>(
    brickGrades[0]?.id || 'grade-1'
  );
  const [deliveryQty, setDeliveryQty] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(resolvedToday);
  const [deliveryTruckNo, setDeliveryTruckNo] = useState<string>('');
  const [deliveryDriverName, setDeliveryDriverName] = useState<string>('');
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Filter for global delivery history table
  const [historySearch, setHistorySearch] = useState<string>('');

  useEffect(() => {
    if (initialMemoNo !== undefined) {
      setMemoNoInput(initialMemoNo.trim());
    }
  }, [initialMemoNo]);

  // Find matched memo from memoNoInput only when user has typed a search query
  const selectedMemo = useMemo(() => {
    const cleanInput = parseBanglaDigits(memoNoInput.trim()).toLowerCase();
    if (!cleanInput) return null;
    const exact = salesMemos.find(
      (m) =>
        parseBanglaDigits(String(m.memoNo || '').trim()).toLowerCase() === cleanInput
    );
    if (exact) return exact;
    return (
      salesMemos.find(
        (m) =>
          parseBanglaDigits(String(m.memoNo || '').trim())
            .toLowerCase()
            .includes(cleanInput) ||
          m.customerName.toLowerCase().includes(cleanInput) ||
          parseBanglaDigits(String(m.customerPhone || '').trim())
            .toLowerCase()
            .includes(cleanInput)
      ) || null
    );
  }, [memoNoInput, salesMemos]);

  // Sync default grade, truck, driver, and quantity when selectedMemo changes
  useEffect(() => {
    if (selectedMemo) {
      const firstItemGrade =
        selectedMemo.items?.[0]?.gradeId ||
        selectedMemo.gradeId ||
        brickGrades[0]?.id ||
        'grade-1';
      setDeliveryGradeId(firstItemGrade);
      setDeliveryTruckNo(
        selectedMemo.truckNo && selectedMemo.truckNo !== '—'
          ? selectedMemo.truckNo
          : ''
      );
      setDeliveryDriverName(
        selectedMemo.driverName && selectedMemo.driverName !== '—'
          ? selectedMemo.driverName
          : ''
      );
      const ordered = getMemoOrderedTotal(selectedMemo);
      const delivered = getMemoDeliveredTotal(selectedMemo);
      const rem = Math.max(0, ordered - delivered);
      if (rem > 0) {
        setDeliveryQty(String(Math.min(1000, rem)));
      } else {
        setDeliveryQty('');
      }
    } else {
      setDeliveryQty('');
    }
  }, [selectedMemo?.id, brickGrades]);

  const selectedMemoOrdered = selectedMemo ? getMemoOrderedTotal(selectedMemo) : 0;
  const selectedMemoDelivered = selectedMemo
    ? getMemoDeliveredTotal(selectedMemo)
    : 0;
  const selectedMemoRemaining = Math.max(
    0,
    selectedMemoOrdered - selectedMemoDelivered
  );
  const selectedMemoHistory: MemoDeliveryRecord[] = useMemo(() => {
    if (!selectedMemo) return [];
    if (
      Array.isArray(selectedMemo.deliveryHistory) &&
      selectedMemo.deliveryHistory.length > 0
    ) {
      return selectedMemo.deliveryHistory;
    }
    return memoDeliveries.filter((d) => d.memoId === selectedMemo.id);
  }, [selectedMemo, memoDeliveries]);

  // Combined all delivery records across all memos
  const allDeliveryRecords: MemoDeliveryRecord[] = useMemo(() => {
    if (memoDeliveries.length > 0) {
      return memoDeliveries;
    }
    const collected: MemoDeliveryRecord[] = [];
    for (const m of salesMemos) {
      if (Array.isArray(m.deliveryHistory)) {
        collected.push(...m.deliveryHistory);
      }
    }
    return collected.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [memoDeliveries, salesMemos]);

  const filteredAllDeliveries = useMemo(() => {
    if (!historySearch.trim()) return allDeliveryRecords;
    const q = historySearch.trim().toLowerCase();
    const normQ = parseBanglaDigits(q);
    return allDeliveryRecords.filter((d) => {
      const normMemo = parseBanglaDigits(d.memoNo || '').toLowerCase();
      return (
        normMemo.includes(normQ) ||
        d.customerName.toLowerCase().includes(q) ||
        (d.gradeName && d.gradeName.toLowerCase().includes(q)) ||
        (d.truckNo && d.truckNo.toLowerCase().includes(q)) ||
        (d.note && d.note.toLowerCase().includes(q))
      );
    });
  }, [allDeliveryRecords, historySearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Math.round(
      Number(parseBanglaDigits(String(deliveryQty || '0'))) || 0
    );
    if (!selectedMemo) return;
    if (qtyNum <= 0) return;

    setSubmitting(true);
    try {
      const ok = await onSubmitDelivery({
        memoId: selectedMemo.id,
        memoNo: selectedMemo.memoNo,
        gradeId: deliveryGradeId,
        quantity: qtyNum,
        date: deliveryDate || resolvedToday,
        truckNo: deliveryTruckNo.trim() || undefined,
        driverName: deliveryDriverName.trim() || undefined,
        note: deliveryNote.trim() || undefined,
      });
      if (ok) {
        setDeliveryNote('');
        const newRem = Math.max(0, selectedMemoRemaining - qtyNum);
        setDeliveryQty(newRem > 0 ? String(Math.min(1000, newRem)) : '');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hasSearchQuery = memoNoInput.trim().length > 0;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* 1. TOP COMPLETE KILN BRICK PIPELINE COMMAND BANNER (Main Dashboard Standard) */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-4 sm:p-6 text-white space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/90 pb-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/20 shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {isEn ? 'Live Kiln Pipeline' : 'লাইভ ইট পাইপলাইন ও স্টক সিঙ্ক'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                  {isEn ? 'Step-by-Step Delivery' : 'ধাপে ধাপে মেমো ডেলিভারি'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                {isEn
                  ? 'Kiln Brick Production, Raw vs Fired Bricks, Total Delivered & Current Stock'
                  : 'মূল ইট উৎপাদন, পোড়ানো ইট, কাঁচা ইট, মোট ডেলিভারি ও বর্তমানে ভাটায় ইট আছে কতটা'}
              </h2>
              <p className="text-xs text-slate-300">
                {isEn
                  ? 'Search by Memo Number below to view the memo and submit step-by-step brick deliveries.'
                  : 'নিচে মেমো নাম্বার লিখে সার্চ করুন — মেমো চলে আসলে তার নিচে ডেলিভারি অপশন থেকে ইট ডেলিভারি সাবমিট করুন।'}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/90 border border-emerald-500/50 rounded-2xl px-5 py-3.5 text-right shrink-0 shadow-lg shadow-emerald-950/40">
            <span className="block text-[11px] font-extrabold text-emerald-300">
              সর্বমোট ইট ডেলিভারি চলে গেছে (সকল মেমো)
            </span>
            <span
              data-testid="total-delivered-bricks-banner"
              className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums block mt-0.5"
            >
              {formatBn(pipeline.totalDeliveredBricks)} পিস
            </span>
            <span className="block text-[11px] text-slate-300 tabular-nums font-bold">
              মেমোতে ডেলিভারি বাকি: {formatBn(pipeline.totalPendingDeliveryBricks)} পিস
            </span>
          </div>
        </div>

        {/* 6-Card Master Brick Pipeline Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* Card 1: মূল কাঁচা ইট উৎপাদন */}
          <div className="bg-slate-900/90 border border-slate-700/80 border-t-2 border-t-amber-400 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span>১. মূল কাঁচা ইট উৎপাদন</span>
              <Factory className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
            <div
              data-testid="pipeline-raw-produced"
              className="text-lg font-extrabold text-white tabular-nums"
            >
              {formatBn(pipeline.rawBricksProduced)} পিস
            </div>
            <div className="text-[11px] text-slate-400">
              ৩টি মিলের মোট কাঁচা ইট কাটা
            </div>
          </div>

          {/* Card 2: পোড়ানো হলো কতটা (চুল্লিতে কাঁচা ইট লোড / পোড়াই) */}
          <div className="bg-slate-900/90 border border-rose-500/30 border-t-2 border-t-rose-500 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-rose-300">
              <span>২. পোড়ানো হচ্ছে কতটা</span>
              <Flame className="w-4 h-4 text-rose-400 shrink-0" />
            </div>
            <div
              data-testid="pipeline-fired-bricks"
              className="text-lg font-extrabold text-rose-300 tabular-nums"
            >
              {formatBn(pipeline.firedOrLoadedBricks)} পিস
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              কাঁচা লোড: {formatBn(pipeline.rawBricksLoadedIntoKiln || pipeline.chulliLoadedBricks)}
              {pipeline.pakaBricksLoadedIntoKiln > 0 ? ` · চেম্বার পাকা: ${formatBn(pipeline.pakaBricksLoadedIntoKiln)}` : ''}
            </div>
          </div>

          {/* Card 3: কাঁচা ইট আছে কতটা */}
          <div className="bg-slate-900/90 border border-sky-500/30 border-t-2 border-t-sky-400 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-sky-300">
              <span>৩. মাঠে কাঁচা ইট আছে কতটা</span>
              <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            </div>
            <div
              data-testid="pipeline-current-raw"
              className="text-lg font-extrabold text-sky-300 tabular-nums"
            >
              {formatBn(pipeline.currentRawBricks)} পিস
            </div>
            <div className="text-[11px] text-slate-400">
              মাঠে অবশিষ্ট আসল কাঁচা ইট (উৎপাদন - লোড)
            </div>
          </div>

          {/* Card 4: মোট পাকা ইট স্টক / আনলোড */}
          <div className="bg-slate-900/90 border border-orange-500/30 border-t-2 border-t-orange-500 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-orange-300">
              <span>৪. পাকা ইট উৎপাদন/স্টক</span>
              <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            </div>
            <div
              data-testid="pipeline-paka-produced"
              className="text-lg font-extrabold text-orange-300 tabular-nums"
            >
              {formatBn(pipeline.totalPakaProduced)} পিস
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              আনলোড: {formatBn(pipeline.unloadedBricks)} পিস · মেমো অর্ডার:{' '}
              {formatBn(pipeline.totalMemoOrderedBricks)} পিস
            </div>
          </div>

          {/* Card 5: ইট ডেলিভারি চলে গেছে কতটা */}
          <div className="bg-emerald-950/60 border border-emerald-500/50 border-t-2 border-t-emerald-400 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span>৫. ডেলিভারি চলে গেছে</span>
              <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
            <div
              data-testid="pipeline-total-delivered"
              className="text-lg font-extrabold text-emerald-400 tabular-nums"
            >
              {formatBn(pipeline.totalDeliveredBricks)} পিস
            </div>
            <div className="text-[11px] text-emerald-200/80 tabular-nums">
              মেমোতে ডেলিভারি বাকি: {formatBn(pipeline.totalPendingDeliveryBricks)} পিস
            </div>
          </div>

          {/* Card 6: বর্তমানে পাকা ইট আছে কতটা */}
          <div className="bg-amber-950/60 border border-amber-400/60 border-t-2 border-t-amber-400 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span>৬. বর্তমানে ইট আছে কতটা</span>
              <PackageCheck className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
            <div
              data-testid="pipeline-current-available-paka"
              className="text-lg font-extrabold text-amber-300 tabular-nums"
            >
              {formatBn(pipeline.currentAvailablePakaBricks)} পিস
            </div>
            <div className="text-[11px] text-amber-200/80">
              ডেলিভারি বাদে বর্তমানে ভাটায় পাকা ইট
            </div>
          </div>
        </div>
      </section>

      {/* 1B. TRUCK DIMENSION & BILL CALCULATOR WIDGET (দৈর্ঘ্য × প্রস্থ × উচ্চতা, প্রতি ঘনফুট রেট, CBM/CFT, আনুমানিক ইট ও চূড়ান্ত বিল) */}
      <TruckDimensionBillCalculator
        lang={lang}
        onApplyBricksToDelivery={(estimatedBricks, measurementSummaryNote) => {
          setDeliveryQty(String(estimatedBricks));
          setDeliveryNote(measurementSummaryNote);
        }}
      />

      {/* 2. SEARCH-FIRST MEMO LOOKUP -> MATCHED MEMO + DELIVERY SUBMISSION OPTION + MEMO DELIVERY HISTORY */}
      <Card variant="default" topAccent="orange" padding="none" className="overflow-hidden shadow-xs">
        <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/60 to-white border-b border-orange-200/80 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                মেমো নাম্বার লিখে সার্চ করুন
              </h3>
              <p className="text-xs text-slate-600">
                মেমো নাম্বার লিখে সার্চ করলে সেই মেমো এবং তার নিচে ইট ডেলিভারি সাবমিট করার অপশন চলে আসবে
              </p>
            </div>
          </div>
          {hasSearchQuery && (
            <button
              type="button"
              onClick={() => setMemoNoInput('')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              সার্চ মুছুন
            </button>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Search Input Only by Default */}
          <div className="max-w-2xl">
            <label
              htmlFor="delivery-memo-no-input"
              className="block text-xs font-bold text-slate-800 mb-1.5"
            >
              মেমো নাম্বার লিখুন (যেমন: 3001, 3002)
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-orange-600 absolute left-3.5 pointer-events-none" />
              <input
                id="delivery-memo-no-input"
                type="text"
                value={memoNoInput}
                onChange={(e) => setMemoNoInput(e.target.value)}
                placeholder="এখানে মেমো নাম্বার লিখে সার্চ করুন (যেমন: 3001)..."
                autoComplete="off"
                className="w-full pl-10 pr-10 py-3 text-sm sm:text-base font-bold font-mono bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-orange-600 text-slate-900"
              />
              {hasSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMemoNoInput('')}
                  aria-label="মেমো নাম্বার মুছুন"
                  title="মুছে ফেলুন"
                  className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Conditional Result: Only shown when user searches in the input box */}
          {hasSearchQuery && (
            <>
              {selectedMemo ? (
                <div
                  data-testid="searched-memo-delivery-panel"
                  className="space-y-5 pt-2 border-t border-slate-200 animate-slide-up"
                >
                  {/* A. Matched Memo Details Card */}
                  <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/40 text-xs text-orange-300 font-bold font-mono mb-1">
                          মেমো নং: #{selectedMemo.memoNo}
                        </span>
                        <h4 className="text-base sm:text-lg font-extrabold text-white">
                          ক্রেতা: {selectedMemo.customerName} ({selectedMemo.customerPhone})
                        </h4>
                        <p className="text-xs text-slate-300">
                          ঠিকানা: {selectedMemo.customerAddress} · মেমোর তারিখ: {selectedMemo.date}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onViewMemo(selectedMemo)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-orange-300 border border-slate-700 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        মেমো বিস্তারিত দেখুন
                      </button>
                    </div>

                    {/* Ordered vs Delivered vs Remaining Counters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-800/90 rounded-lg p-3">
                        <span className="block text-xs text-slate-400">
                          মেমোতে মোট ইট
                        </span>
                        <span
                          data-testid="selected-memo-ordered"
                          className="text-base sm:text-lg font-extrabold text-white tabular-nums"
                        >
                          {formatBn(selectedMemoOrdered)} পিস
                        </span>
                      </div>
                      <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg p-3">
                        <span className="block text-xs text-emerald-300">
                          ডেলিভারি নিয়ে গেছে
                        </span>
                        <span
                          data-testid="selected-memo-delivered"
                          className="text-base sm:text-lg font-extrabold text-emerald-400 tabular-nums"
                        >
                          {formatBn(selectedMemoDelivered)} পিস
                        </span>
                      </div>
                      <div className="bg-amber-950/80 border border-amber-500/40 rounded-lg p-3">
                        <span className="block text-xs text-amber-300">
                          ডেলিভারি বাকি আছে
                        </span>
                        <span
                          data-testid="selected-memo-remaining"
                          className="text-base sm:text-lg font-extrabold text-amber-300 tabular-nums"
                        >
                          {formatBn(selectedMemoRemaining)} পিস
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* B. Below the Memo: Delivery Submission Form & Memo's Delivery History */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Delivery Submission Option */}
                    <div className="lg:col-span-6 bg-orange-50/40 border-2 border-orange-200 rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b border-orange-200/80 pb-3">
                        <Truck className="w-5 h-5 text-orange-600 shrink-0" />
                        <div>
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                            মেমো #{selectedMemo.memoNo}-এর ডেলিভারি অপশন (সাবমিট করুন)
                          </h4>
                          <p className="text-xs text-slate-600">
                            এই খেপে ক্রেতা কত পিস ইট ডেলিভারি নিয়ে যাচ্ছে তা নিচে লিখে সাবমিট করুন
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="delivery-grade-select"
                              className="block text-xs font-bold text-slate-700 mb-1"
                            >
                              কোন গ্রেডের ইট ডেলিভারি যাচ্ছে *
                            </label>
                            <select
                              id="delivery-grade-select"
                              value={deliveryGradeId}
                              onChange={(e) => setDeliveryGradeId(e.target.value)}
                              className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-xl focus:border-orange-600"
                            >
                              {brickGrades.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {cleanBrickGradeName(g.nameBn)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor="delivery-date-input"
                              className="block text-xs font-bold text-slate-700 mb-1"
                            >
                              ডেলিভারির তারিখ *
                            </label>
                            <input
                              id="delivery-date-input"
                              type="date"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                              className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-xl focus:border-orange-600"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="delivery-qty-input"
                            className="block text-xs font-bold text-slate-800 mb-1"
                          >
                            এই ট্রিপে কতগুলো ইট ডেলিভারি নিয়ে যাচ্ছে (পিস সংখ্যা) *
                          </label>
                          <input
                            id="delivery-qty-input"
                            type="number"
                            min={1}
                            max={
                              selectedMemoRemaining > 0
                                ? selectedMemoRemaining
                                : undefined
                            }
                            value={deliveryQty}
                            onChange={(e) => setDeliveryQty(e.target.value)}
                            placeholder="যেমন: 2000"
                            className="w-full px-3.5 py-2.5 text-base font-extrabold font-mono bg-white border-2 border-orange-400 rounded-xl focus:outline-none focus:border-orange-600 text-slate-900"
                          />

                          {/* Quick Quantity Buttons */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[11px] font-black text-amber-800 mr-1">
                              ⚡ দ্রুত সংখ্যা:
                            </span>
                            {QUICK_DELIVERY_QTYS.map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setDeliveryQty(String(q))}
                                className="sbl-btn-interactive sbl-chip-preset px-2.5 py-1 text-xs font-black bg-white hover:bg-orange-50 hover:border-orange-500 text-slate-800 rounded-xl border border-slate-300 cursor-pointer shadow-xs font-mono tabular-nums"
                              >
                                {formatBn(q)} পিস
                              </button>
                            ))}
                            {selectedMemoRemaining > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeliveryQty(String(selectedMemoRemaining))
                                }
                                className="sbl-btn-interactive sbl-chip-preset px-3 py-1 text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl border-2 border-emerald-500 cursor-pointer shadow-xs font-mono tabular-nums"
                              >
                                ✅ সম্পূর্ণ বাকি ({formatBn(selectedMemoRemaining)} পিস)
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="delivery-truck-input"
                              className="block text-xs font-bold text-slate-700 mb-1"
                            >
                              গাড়ি / ট্রাক / ট্রলি নম্বর (ঐচ্ছিক)
                            </label>
                            <input
                              id="delivery-truck-input"
                              type="text"
                              value={deliveryTruckNo}
                              onChange={(e) => setDeliveryTruckNo(e.target.value)}
                              placeholder="যেমন: সাতক্ষীরা-ট-১১-২২৩৩"
                              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:border-orange-600"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="delivery-driver-input"
                              className="block text-xs font-bold text-slate-700 mb-1"
                            >
                              ড্রাইভার বা গ্রহণকারীর নাম (ঐচ্ছিক)
                            </label>
                            <input
                              id="delivery-driver-input"
                              type="text"
                              value={deliveryDriverName}
                              onChange={(e) => setDeliveryDriverName(e.target.value)}
                              placeholder="ড্রাইভারের নাম..."
                              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:border-orange-600"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="delivery-note-input"
                            className="block text-xs font-bold text-slate-700 mb-1"
                          >
                            ডেলিভারি নোট / কোন খেপ বা ট্রিপ (ঐচ্ছিক)
                          </label>
                          <input
                            id="delivery-note-input"
                            type="text"
                            value={deliveryNote}
                            onChange={(e) => setDeliveryNote(e.target.value)}
                            placeholder="যেমন: ১ম ট্রিপ ডেলিভারি / সকালের গাড়ি..."
                            className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:border-orange-600"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={
                            submitting ||
                            !selectedMemo ||
                            selectedMemoRemaining <= 0 ||
                            (Number(parseBanglaDigits(String(deliveryQty))) || 0) <= 0
                          }
                          className="sbl-btn-interactive w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500 text-slate-950 shadow-lg shadow-orange-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5 text-slate-950" />
                          {submitting
                            ? 'ডেলিভারি সেভ হচ্ছে...'
                            : selectedMemoRemaining <= 0
                            ? 'এই মেমোর সম্পূর্ণ ইট ইতিমধ্যে ডেলিভারি সম্পন্ন হয়েছে'
                            : 'ইট ডেলিভারি সাবমিট করুন (অটো-স্টক আপডেট)'}
                        </button>
                      </form>
                    </div>

                    {/* Selected Memo's Step-by-Step Delivery History */}
                    <div className="lg:col-span-6 bg-white border-2 border-emerald-200 rounded-xl overflow-hidden">
                      <div className="bg-emerald-50/90 border-b border-emerald-200 px-4 py-3.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div>
                            <h4 className="text-sm font-extrabold text-emerald-950">
                              মেমো #{selectedMemo.memoNo}-এর ধাপে ধাপে ডেলিভারি হিস্ট্রি
                            </h4>
                            <p className="text-[11px] text-emerald-800">
                              কবে, কোন গাড়িতে, কতগুলো ইট ডেলিভারি নিয়ে গেছে তার তালিকা
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            selectedMemoRemaining === 0 && selectedMemoOrdered > 0
                              ? 'bg-emerald-600 text-white'
                              : selectedMemoDelivered > 0
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {selectedMemoRemaining === 0 && selectedMemoOrdered > 0
                            ? 'সম্পূর্ণ ডেলিভারি সম্পন্ন'
                            : selectedMemoDelivered > 0
                            ? `আংশিক ডেলিভারি (${formatBn(selectedMemoHistory.length)}টি খেপ)`
                            : 'ডেলিভারি এখনো শুরু হয়নি'}
                        </span>
                      </div>

                      <div className="p-4">
                        {selectedMemoHistory.length > 0 ? (
                          <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-xs sm:text-sm text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                                  <th className="py-2.5 px-3 font-bold">খেপ / ট্রিপ</th>
                                  <th className="py-2.5 px-3 font-bold">তারিখ</th>
                                  <th className="py-2.5 px-3 font-bold">ইটের ধরন</th>
                                  <th className="py-2.5 px-3 font-bold">গাড়ি ও বিবরণ</th>
                                  <th className="py-2.5 px-3 font-bold text-right">
                                    ডেলিভারি ইট (পিস)
                                  </th>
                                  <th className="py-2.5 px-3 font-bold text-right">
                                    অ্যাকশন
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {selectedMemoHistory.map((rec, idx) => (
                                  <tr
                                    key={rec.id || idx}
                                    className="hover:bg-emerald-50/40"
                                  >
                                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                                      ট্রিপ #{formatBn(idx + 1)}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-slate-700">
                                      {rec.date}
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                                      {cleanBrickGradeName(rec.gradeName)}
                                    </td>
                                    <td className="py-2.5 px-3 text-xs text-slate-600">
                                      <div className="font-semibold text-slate-800">
                                        {rec.note ||
                                          `ট্রিপ #${formatBn(idx + 1)} ডেলিভারি`}
                                      </div>
                                      {(rec.truckNo && rec.truckNo !== '—') ||
                                      (rec.driverName && rec.driverName !== '—') ? (
                                        <div className="text-[11px] text-slate-500">
                                          গাড়ি: {rec.truckNo || '—'} · ড্রাইভার:{' '}
                                          {rec.driverName || '—'}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 tabular-nums">
                                      {formatBn(rec.quantity)} পিস
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => onDeleteDelivery(rec.id)}
                                        aria-label={`ট্রিপ ${idx + 1} ডিলিট করুন`}
                                        title="ডেলিভারি রেকর্ড মুছুন"
                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-emerald-50/90 border-t-2 border-emerald-200 font-bold text-xs sm:text-sm">
                                  <td
                                    colSpan={4}
                                    className="py-2.5 px-3 text-right text-slate-800"
                                  >
                                    এই মেমোতে মোট ডেলিভারি হয়েছে:
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-800 tabular-nums">
                                    {formatBn(selectedMemoDelivered)} পিস
                                  </td>
                                  <td />
                                </tr>
                                <tr className="bg-amber-50/90 border-t border-amber-200 font-bold text-xs sm:text-sm">
                                  <td
                                    colSpan={4}
                                    className="py-2 px-3 text-right text-amber-950"
                                  >
                                    এখনো ডেলিভারি বাকি আছে:
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-extrabold text-amber-900 tabular-nums">
                                    {formatBn(selectedMemoRemaining)} পিস
                                  </td>
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-1.5">
                            <div className="text-sm font-bold text-slate-700">
                              মেমো #{selectedMemo.memoNo}-এ এখনো কোনো ইট ডেলিভারি নেওয়া হয়নি।
                            </div>
                            <div className="text-xs text-slate-500">
                              মেমোর মোট ইট: <strong>{formatBn(selectedMemoOrdered)} পিস</strong>। বাম পাশের ডেলিভারি অপশনে সংখ্যা লিখে সাবমিট করলে এখানে ধাপে ধাপে ডেলিভারি হিস্ট্রি জমা হবে।
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm font-semibold text-rose-800">
                  মেমো নম্বর &ldquo;{memoNoInput}&rdquo; দিয়ে কোনো মেমো খুঁজে পাওয়া যায়নি। সঠিক মেমো নাম্বার লিখুন।
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* 3. GRADE-WISE STOCK VS DELIVERY SUMMARY TABLE */}
      <Card variant="default" padding="none" className="overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">
              গ্রেডভিত্তিক পাকা ইট উৎপাদন, মেমো অর্ডার, ডেলিভারি ও বর্তমান স্টক হিসাব
            </h3>
            <p className="text-[11px] text-slate-300">
              কোন গ্রেডের কতগুলো ইট উৎপাদন/স্টক হয়েছে, কতগুলো ডেলিভারি চলে গেছে এবং বর্তমানে কতগুলো ভাটায় আছে
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                <th className="py-3 px-4 font-bold">ইটের গ্রেড</th>
                <th className="py-3 px-4 font-bold text-right">
                  পাকা ইট উৎপাদন / স্টক
                </th>
                <th className="py-3 px-4 font-bold text-right">
                  মেমোতে মোট অর্ডার
                </th>
                <th className="py-3 px-4 font-bold text-right text-emerald-800">
                  ডেলিভারি চলে গেছে
                </th>
                <th className="py-3 px-4 font-bold text-right text-amber-800">
                  মেমোতে ডেলিভারি বাকি
                </th>
                <th className="py-3 px-4 font-bold text-right text-orange-800">
                  বর্তমানে ভাটায় ইট আছে (ডেলিভারি বাদে)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pipeline.gradeStockBreakdown.map((row) => (
                <tr key={row.gradeId} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    {row.gradeName}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                    {formatBn(row.totalProduced)} পিস
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatBn(row.orderedOnMemos)} পিস
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                    {formatBn(row.delivered)} পিস
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-amber-700 tabular-nums">
                    {formatBn(row.pendingDelivery)} পিস
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-extrabold text-orange-700 tabular-nums">
                    {formatBn(row.currentInKilnAfterDelivery)} পিস
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs sm:text-sm">
                <td className="py-3 px-4">সর্বমোট (সকল গ্রেড একত্রে):</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-orange-300">
                  {formatBn(pipeline.totalPakaProduced)} পিস
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">
                  {formatBn(pipeline.totalMemoOrderedBricks)} পিস
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                  {formatBn(pipeline.totalDeliveredBricks)} পিস
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-300">
                  {formatBn(pipeline.totalPendingDeliveryBricks)} পিস
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-400">
                  {formatBn(pipeline.currentAvailablePakaBricks)} পিস
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* 4. ALL MEMOS COMPLETE DELIVERY LEDGER TABLE */}
      <Card variant="default" padding="none" className="overflow-hidden shadow-2xs">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              সকল মেমোর ইট ডেলিভারি হিস্ট্রি ও মোট ডেলিভারি খতিয়ান ({formatBn(filteredAllDeliveries.length)}টি ট্রিপ)
            </h3>
            <p className="text-xs text-slate-600">
              ভাটা থেকে কোন মেমোতে কবে কত পিস ইট বের হয়ে গেছে তার সম্পূর্ণ লগ ও মোট হিসাব
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="মেমো নং বা ক্রেতার নাম দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-extrabold text-center w-10">ক্রঃ</th>
                <th className="py-2.5 px-3 font-extrabold">তারিখ</th>
                <th className="py-2.5 px-3 font-extrabold">মেমো নং</th>
                <th className="py-2.5 px-3 font-extrabold">ক্রেতার নাম ও মোবাইল</th>
                <th className="py-2.5 px-3 font-extrabold">ইটের গ্রেড</th>
                <th className="py-2.5 px-3 font-extrabold">গাড়ি, ড্রাইভার ও নোট</th>
                <th className="py-2.5 px-3 font-extrabold text-right">ডেলিভারি পরিমাণ</th>
                <th className="py-2.5 px-3 font-extrabold text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAllDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    এখনো কোনো ইট ডেলিভারি এন্ট্রি করা হয়নি। উপরে মেমো নাম্বার দিয়ে ডেলিভারি সাবমিট করুন।
                  </td>
                </tr>
              ) : (
                filteredAllDeliveries.map((d, idx) => (
                  <tr
                    key={d.id}
                    className="hover:bg-orange-50/40 whitespace-nowrap align-middle"
                  >
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 tabular-nums">
                      {formatBn(idx + 1)}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700 tabular-nums">
                      {d.date}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => setMemoNoInput(d.memoNo)}
                        className="font-mono font-extrabold text-orange-700 hover:underline cursor-pointer"
                      >
                        #{d.memoNo}
                      </button>
                    </td>
                    <td className="py-2 px-3 max-w-[210px] truncate">
                      <span className="font-bold text-slate-900">{d.customerName}</span>
                      {d.customerPhone && (
                        <span className="text-slate-500 ml-1.5 tabular-nums">
                          · {d.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {cleanBrickGradeName(d.gradeName)}
                    </td>
                    <td className="py-2 px-3 text-slate-600 max-w-[230px] truncate">
                      <span className="font-semibold text-slate-800">{d.note || 'ডেলিভারি'}</span>
                      {(d.truckNo && d.truckNo !== '—') ||
                      (d.driverName && d.driverName !== '—') ? (
                        <span className="text-slate-500 ml-1.5">
                          · গাড়ি: {d.truckNo || '—'}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700 tabular-nums">
                      {formatBn(d.quantity)} পিস
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteDelivery(d.id)}
                        title="ডেলিভারি মুছুন"
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900 whitespace-nowrap text-xs">
                <td colSpan={6} className="py-2.5 px-3 text-right">
                  সর্বমোট ডেলিভারি ইট ({formatBn(filteredAllDeliveries.length)}টি ট্রিপ):
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-800 tabular-nums">
                  {formatBn(
                    filteredAllDeliveries.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
                  )}{' '}
                  পিস
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};
