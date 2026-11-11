import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Calendar,
  Check,
  Copy,
  FileSpreadsheet,
  Printer,
  Users,
  X,
} from 'lucide-react';
import type {
  ChulliLoadRecord,
  ChulliUnloadRecord,
  MillId,
  MillPotRecord,
  NavigationTab,
  PoraiMistriRecord,
  RubbishRecord,
} from '../types/kiln';
import {
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';
import {
  computeFridayHatbarSardarSummarySheet,
  type FridayHatbarSardarRow,
} from '../utils/themeAndEstimatorLogic';

export interface FridayHatbarSardarPrintSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayDate: string;
  activeRoundNo?: number;
  millPots: MillPotRecord[];
  chulliLoads: ChulliLoadRecord[];
  poraiMistriRecords: PoraiMistriRecord[];
  chulliUnloads: ChulliUnloadRecord[];
  rubbishRecords?: RubbishRecord[];
  onSaveMillPot?: (payload: {
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
  onSaveChulliLoad?: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    rawBricksLoaded: number;
    pakaBricksLoaded?: number;
    ratePerVan: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
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
  onSaveChulliUnload?: (payload: {
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
  onSaveRubbish?: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    roundBill: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onNavigateTab?: (tab: NavigationTab) => void;
}

export const FridayHatbarSardarPrintSheetModal: React.FC<
  FridayHatbarSardarPrintSheetModalProps
> = ({
  isOpen,
  onClose,
  todayDate,
  activeRoundNo = 1,
  millPots,
  chulliLoads,
  poraiMistriRecords,
  chulliUnloads,
  rubbishRecords = [],
  onSaveMillPot,
  onSaveChulliLoad,
  onSavePoraiMistri,
  onSaveChulliUnload,
  onSaveRubbish,
  onNavigateTab,
}) => {
  const [hatbarDate, setHatbarDate] = useState<string>(todayDate);
  const [lookbackDays, setLookbackDays] = useState<number>(7);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Quick inline Hatbar payment state
  const [quickSardarId, setQuickSardarId] =
    useState<FridayHatbarSardarRow['sardarId']>('MILL_OHAB');
  const [quickPayAmount, setQuickPayAmount] = useState<string>('');
  const [quickPayNote, setQuickPayNote] = useState<string>(
    'শুক্রবারের হাটবার খোরাকি ও সাপ্তাহিক বিল পরিশোধ'
  );
  const [isSavingPay, setIsSavingPay] = useState<boolean>(false);

  const summary = useMemo(
    () =>
      computeFridayHatbarSardarSummarySheet({
        millPots,
        chulliLoads,
        poraiMistriRecords,
        chulliUnloads,
        rubbishRecords,
        hatbarDate: hatbarDate || todayDate,
        lookbackDays,
      }),
    [
      millPots,
      chulliLoads,
      poraiMistriRecords,
      chulliUnloads,
      rubbishRecords,
      hatbarDate,
      todayDate,
      lookbackDays,
    ]
  );

  if (!isOpen) return null;

  const handleQuickHatbarPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, Math.round(parseNum(quickPayAmount, 0)));
    if (amount <= 0) return;

    const targetRow =
      summary.rows.find((r) => r.sardarId === quickSardarId) || summary.rows[0];
    const payDate = hatbarDate || todayDate;
    const noteText =
      quickPayNote.trim() ||
      `শুক্রবারের হাটবার পেমেন্ট (${payDate}) — ${targetRow.sardarNameBn}`;

    setIsSavingPay(true);
    try {
      if (
        (targetRow.sardarId === 'MILL_OHAB' ||
          targetRow.sardarId === 'MILL_MOFIJUL' ||
          targetRow.sardarId === 'MILL_SOFIKUL') &&
        onSaveMillPot
      ) {
        await onSaveMillPot({
          millId: targetRow.millId || 'ohab',
          potNo: `হাটবার পেমেন্ট (${payDate})`,
          date: payDate,
          rawBricksCut: 0,
          takenToChulli: 0,
          ratePerThousand: 1100,
          paidAmount: amount,
          note: noteText,
        });
      } else if (targetRow.sardarId === 'VAN_SELIM' && onSaveChulliLoad) {
        await onSaveChulliLoad({
          date: payDate,
          sardarName: 'সেলিম সর্দার',
          rawBricksLoaded: 0,
          ratePerVan: 350,
          paidAmount: amount,
          note: noteText,
        });
      } else if (targetRow.sardarId === 'PORAI_ALTAF' && onSavePoraiMistri) {
        await onSavePoraiMistri({
          date: payDate,
          mistriName: 'আলতাফ সর্দার',
          chamberOrRound: `রাউন্ড-${formatBn(activeRoundNo)}`,
          bricksFired: 0,
          ratePerThousand: 220,
          paidAmount: amount,
          note: noteText,
        });
      } else if (targetRow.sardarId === 'UNLOAD_NAZRUL' && onSaveChulliUnload) {
        await onSaveChulliUnload({
          date: payDate,
          sardarName: 'নজরুল সর্দার',
          chamberOrRound: `রাউন্ড-${formatBn(activeRoundNo)}`,
          linesUnloaded: 0,
          bricksPerLine: 4000,
          ratePerLine: 750,
          ratePerThousand: 187.5,
          paidAmount: amount,
          note: noteText,
        });
      } else if (targetRow.sardarId === 'RUBBISH_OBED' && onSaveRubbish) {
        await onSaveRubbish({
          date: payDate,
          sardarName: 'অবেদ রাবিশ সর্দার',
          chamberOrRound: `রাউন্ড-${formatBn(activeRoundNo)}`,
          roundBill: 0,
          paidAmount: amount,
          note: noteText,
        });
      }
      setQuickPayAmount('');
    } finally {
      setIsSavingPay(false);
    }
  };

  const handleCopyTextSummary = () => {
    const lines = [
      `🧱 SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)`,
      `📅 শুক্রবারের হাটবার সর্দার সামারি শিট (${summary.weekStartDate} থেকে ${summary.hatbarDate})`,
      `--------------------------------------------------`,
      ...summary.rows.map((r) => {
        const statusStr = r.isDina
          ? `দিনা (অতিরিক্ত নিয়েছে): ৳${formatBn(r.dinaAmount)}`
          : `পাওনা বাকি: ৳${formatBn(r.balanceDue)}`;
        return `${formatBn(r.serialNo)}. ${r.sardarNameBn} (${r.roleBn}) — সাপ্তাহিক বিল: ৳${formatBn(
          r.weeklyBill
        )} | সাপ্তাহিক খোরাকি/জমা: ৳${formatBn(
          r.weeklyPaidKhorakiAndBill
        )} | মোট বিল: ৳${formatBn(r.seasonTotalBill)} | মোট পরিশোধ: ৳${formatBn(
          r.seasonTotalPaid
        )} | ${statusStr}`;
      }),
      `--------------------------------------------------`,
      `মোট সাপ্তাহিক বিল: ৳${formatBn(summary.grandWeeklyBill)} | মোট সাপ্তাহিক পরিশোধ: ৳${formatBn(
        summary.grandWeeklyPaid
      )}`,
      `সর্বমোট পাওনা বাকি: ৳${formatBn(summary.grandTotalBalanceDue)} | সর্বমোট দিনা: ৳${formatBn(
        summary.grandTotalDinaAmount
      )}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div
      data-testid="friday-hatbar-sardar-print-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0"
    >
      <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border-2 border-amber-300 overflow-hidden my-auto max-h-[94vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* ================================================================
            TOP CONTROL BAR (HIDDEN IN PRINT)
           ================================================================ */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">
                  🕌 শুক্রবারের হাটবার স্পেশাল শিট
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold">
                  ৭ জন সর্দারের খোরাকি, বিল ও দিনা সামারি (A4 এক পাতায় প্রিন্ট)
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                শুক্রবারের হাটবার সামারি প্রিন্ট শিট (ওহাব, মফিজুল, শফিকুল, সেলিম, আলতাফ, নজরুল ও অবেদ)
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="hatbar-sheet-copy-btn"
              onClick={handleCopyTextSummary}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedText ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>সামারি কপি</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="hatbar-sheet-print-btn"
              onClick={handlePrintSheet}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs sm:text-sm font-black inline-flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>এক পাতায় প্রিন্ট করুন (A4 Print)</span>
            </button>

            <button
              type="button"
              data-testid="hatbar-sheet-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================
            SCROLLABLE MODAL CONTENT
           ================================================================ */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 print:p-2 print:overflow-visible">
          {/* FILTER & INLINE QUICK HATBAR PAYMENT BAR (HIDDEN IN PRINT) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-amber-50/70 border-2 border-amber-200/90 rounded-2xl p-4 print:hidden">
            {/* Date & Period Controls */}
            <div className="lg:col-span-5 space-y-2.5 border-b lg:border-b-0 lg:border-r border-amber-200/80 pb-3 lg:pb-0 lg:pr-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span>১. শুক্রবার / হাটবারের তারিখ ও মেয়াদ সিলেক্ট করুন:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="hatbar-date-picker"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    হাটবারের তারিখ (শুক্রবার)
                  </label>
                  <input
                    id="hatbar-date-picker"
                    data-testid="hatbar-date-picker"
                    type="date"
                    value={hatbarDate}
                    onChange={(e) => setHatbarDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-950 text-xs font-extrabold focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="hatbar-lookback-select"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    হিসাবের মেয়াদ
                  </label>
                  <select
                    id="hatbar-lookback-select"
                    data-testid="hatbar-lookback-select"
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-950 text-xs font-extrabold focus:outline-none focus:border-orange-500"
                  >
                    <option value={7}>সাপ্তাহিক হাটবার (৭ দিন)</option>
                    <option value={14}>পাক্ষিক হিসাব (১৪ দিন)</option>
                    <option value={30}>মাসিক হিসাব (৩০ দিন)</option>
                    <option value={365}>সম্পূর্ণ সিজন (৩৬৫ দিন)</option>
                  </select>
                </div>
              </div>
              <div className="text-[11px] font-bold text-slate-600">
                মেয়াদ: <strong className="text-slate-950">{summary.weekStartDate}</strong> থেকে{' '}
                <strong className="text-slate-950">{summary.hatbarDate}</strong> পর্যন্ত
              </div>
            </div>

            {/* Inline Quick Hatbar Payment Entry */}
            <form
              noValidate
              onSubmit={handleQuickHatbarPay}
              className="lg:col-span-7 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>
                    ২. সরাসরি এই শিটে সর্দারের খোরাকি / হাটবার পেমেন্ট এন্ট্রি করুন:
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  অটো ক্যাশ বুক ও সর্দার খাতায় যোগ হবে
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="hatbar-quick-sardar-select"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    সর্দার নির্বাচন করুন
                  </label>
                  <select
                    id="hatbar-quick-sardar-select"
                    data-testid="hatbar-quick-sardar-select"
                    value={quickSardarId}
                    onChange={(e) =>
                      setQuickSardarId(
                        e.target.value as FridayHatbarSardarRow['sardarId']
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-950 text-xs font-extrabold focus:outline-none focus:border-orange-500"
                  >
                    {summary.rows.map((r) => (
                      <option key={r.sardarId} value={r.sardarId}>
                        {formatBn(r.serialNo)}. {r.sardarNameBn} ({r.roleBn})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="hatbar-quick-pay-amount"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    id="hatbar-quick-pay-amount"
                    data-testid="hatbar-quick-pay-amount"
                    type="text"
                    inputMode="decimal"
                    value={quickPayAmount}
                    onChange={(e) =>
                      setQuickPayAmount(normalizeNumericInput(e.target.value))
                    }
                    placeholder="যেমন: 5000"
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-950 font-mono text-xs font-black focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="hatbar-quick-pay-note"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    বিবরণ (খোরাকি/বিল)
                  </label>
                  <input
                    id="hatbar-quick-pay-note"
                    type="text"
                    value={quickPayNote}
                    onChange={(e) => setQuickPayNote(e.target.value)}
                    placeholder="হাটবার খোরাকি ও বিল"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isSavingPay}
                    data-testid="hatbar-quick-pay-submit-btn"
                    className="w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-colors shadow-xs"
                  >
                    {isSavingPay ? 'সেভ হচ্ছে...' : '+ জমা দিন'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ================================================================
              OFFICIAL A4 PRINTABLE ONE-PAGE SHEET
             ================================================================ */}
          <div
            id="sbl-hatbar-print-sheet"
            data-testid="sbl-hatbar-printable-sheet"
            className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-6 space-y-4 print:border print:border-slate-900 print:rounded-none print:p-3"
          >
            {/* Official Kiln Letterhead */}
            <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 text-xs font-black">
                    SBL ★ NO. 1 BRICKS
                  </span>
                  <span className="text-xs font-extrabold text-slate-700">
                    বাবুলিয়া, সাতক্ষীরা সদর
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 mt-0.5">
                  SBL মিষ্টি মাটির ইট — শুক্রবারের হাটবার সর্দার বিল ও খোরাকি শিট
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  প্রোঃ মোঃ কামরুল ইসলাম (01913-678010) · পরিচালনায়ঃ সাকিব হোসেন (01728-287018)
                </p>
              </div>

              <div className="sm:text-right bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-xs">
                <div className="font-black text-slate-950">
                  হাটবার তারিখ: <span className="font-mono">{summary.hatbarDate}</span>
                </div>
                <div className="font-bold text-slate-700">
                  সাপ্তাহিক মেয়াদ: {summary.weekStartDate} → {summary.hatbarDate}
                </div>
                <div className="text-[11px] font-extrabold text-emerald-800">
                  মোট ৭ জন মূল সর্দার (মিল, ভ্যান, পোড়াই, আনলোড ও রাবিশ)
                </div>
              </div>
            </div>

            {/* 4 Summary KPI Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-300">
                <span className="text-slate-600 font-bold block">
                  ১. এই সপ্তাহের মোট কাজ/বিল
                </span>
                <strong
                  data-testid="hatbar-grand-weekly-bill"
                  className="text-base sm:text-lg font-black text-slate-950 font-mono block mt-0.5"
                >
                  {formatCurrencyBn(summary.grandWeeklyBill)}
                </strong>
                <span className="text-[10px] text-slate-600 font-semibold">
                  ৭ সর্দারের সাপ্তাহিক উৎপাদন বিল
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300">
                <span className="text-emerald-950 font-bold block">
                  ২. এই সপ্তাহে খোরাকি ও বিল প্রদান
                </span>
                <strong
                  data-testid="hatbar-grand-weekly-paid"
                  className="text-base sm:text-lg font-black text-emerald-800 font-mono block mt-0.5"
                >
                  {formatCurrencyBn(summary.grandWeeklyPaid)}
                </strong>
                <span className="text-[10px] text-emerald-800 font-semibold">
                  আজ হাটবারে প্রদান: {formatCurrencyBn(summary.grandTodayHatbarPaid)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300">
                <span className="text-amber-950 font-bold block">
                  ৩. সর্দাররা মোট পাবে (পাওনা বাকি)
                </span>
                <strong
                  data-testid="hatbar-grand-balance-due"
                  className="text-base sm:text-lg font-black text-amber-900 font-mono block mt-0.5"
                >
                  {formatCurrencyBn(summary.grandTotalBalanceDue)}
                </strong>
                <span className="text-[10px] text-amber-900 font-semibold">
                  সিজনের মোট বকেয়া পাওনা
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-300">
                <span className="text-rose-950 font-bold block">
                  ৪. সর্দারদের মোট দিনা (অতিরিক্ত)
                </span>
                <strong
                  data-testid="hatbar-grand-dina-total"
                  className="text-base sm:text-lg font-black text-rose-800 font-mono block mt-0.5"
                >
                  {formatCurrencyBn(summary.grandTotalDinaAmount)}
                </strong>
                <span className="text-[10px] text-rose-800 font-semibold">
                  পরবর্তী কাজের বিল থেকে কর্তনযোগ্য
                </span>
              </div>
            </div>

            {/* 7-Sardar Printable Table */}
            <div className="overflow-x-auto">
              <table
                data-testid="hatbar-sardar-summary-table"
                className="w-full border-collapse border border-slate-900 text-xs"
              >
                <thead>
                  <tr className="bg-slate-900 text-white print:bg-slate-200 print:text-slate-950">
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-center font-black w-10">
                      ক্রঃ
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-3 py-2 text-left font-black">
                      সর্দারের নাম ও বিভাগ
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-left font-black">
                      কাজের হিসাব (সাপ্তাহিক / সিজন)
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-right font-black">
                      এই সপ্তাহের বিল (৳)
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-right font-black">
                      সাপ্তাহিক খোরাকি ও জমা (৳)
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-right font-black">
                      সিজনের মোট বিল (৳)
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-right font-black">
                      সিজনের মোট পরিশোধ (৳)
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-2.5 py-2 text-right font-black">
                      বর্তমান ব্যালেন্স (পাওনা / দিনা)
                    </th>
                    <th className="border border-slate-700 print:border-slate-900 px-3 py-2 text-center font-black w-28">
                      সর্দারের স্বাক্ষর
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr
                      key={row.sardarId}
                      data-testid={`hatbar-row-${row.sardarId}`}
                      className="border-b border-slate-300 hover:bg-amber-50/40"
                    >
                      <td className="border border-slate-400 print:border-slate-900 px-2 py-2.5 text-center font-black text-slate-900">
                        {formatBn(row.serialNo)}
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-3 py-2.5">
                        <div className="font-black text-slate-950 text-xs sm:text-sm">
                          {row.sardarNameBn}
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                          <span>{row.roleBn}</span>
                          {onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onNavigateTab(row.targetTab);
                              }}
                              className="text-orange-700 hover:underline font-extrabold print:hidden cursor-pointer"
                            >
                              [খাতা দেখুন →]
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-2.5 py-2.5">
                        <div className="font-extrabold text-slate-900">
                          সপ্তাহে: {row.weeklyWorkQtyLabelBn}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">
                          সিজনে মোট: {row.seasonWorkQtyLabelBn}
                        </div>
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-2.5 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(row.weeklyBill)}
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-2.5 py-2.5 text-right font-mono tabular-nums">
                        <div className="font-black text-emerald-800">
                          {formatCurrencyBn(row.weeklyPaidKhorakiAndBill)}
                        </div>
                        {row.todayPaidOnHatbar > 0 && (
                          <div className="text-[10px] font-bold text-emerald-700">
                            আজ: {formatCurrencyBn(row.todayPaidOnHatbar)}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-2.5 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(row.seasonTotalBill)}
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-2.5 py-2.5 text-right font-mono font-bold text-emerald-800 tabular-nums">
                        {formatCurrencyBn(row.seasonTotalPaid)}
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-2.5 py-2.5 text-right font-mono tabular-nums">
                        {row.isDina ? (
                          <div className="inline-block px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-900 font-black">
                            দিনা: {formatCurrencyBn(row.dinaAmount)}
                          </div>
                        ) : row.balanceDue > 0 ? (
                          <div className="inline-block px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-black">
                            পাবে: {formatCurrencyBn(row.balanceDue)}
                          </div>
                        ) : (
                          <span className="text-emerald-800 font-extrabold">
                            ৳০ (পরিশোধিত)
                          </span>
                        )}
                      </td>
                      <td className="border border-slate-400 print:border-slate-900 px-3 py-2.5 text-center align-bottom">
                        <div className="h-6 border-b border-dashed border-slate-400 w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-900">
                    <td
                      colSpan={3}
                      className="border border-slate-500 print:border-slate-900 px-3 py-2.5 text-right"
                    >
                      সর্বমোট ৭ জন সর্দারের যোগফল =
                    </td>
                    <td className="border border-slate-500 print:border-slate-900 px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {formatCurrencyBn(summary.grandWeeklyBill)}
                    </td>
                    <td className="border border-slate-500 print:border-slate-900 px-2.5 py-2.5 text-right font-mono text-emerald-800 tabular-nums">
                      {formatCurrencyBn(summary.grandWeeklyPaid)}
                    </td>
                    <td className="border border-slate-500 print:border-slate-900 px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {formatCurrencyBn(summary.grandSeasonTotalBill)}
                    </td>
                    <td className="border border-slate-500 print:border-slate-900 px-2.5 py-2.5 text-right font-mono text-emerald-800 tabular-nums">
                      {formatCurrencyBn(summary.grandSeasonTotalPaid)}
                    </td>
                    <td className="border border-slate-500 print:border-slate-900 px-2.5 py-2.5 text-right font-mono tabular-nums">
                      <div className="text-amber-950">
                        পাওনা: {formatCurrencyBn(summary.grandTotalBalanceDue)}
                      </div>
                      {summary.grandTotalDinaAmount > 0 && (
                        <div className="text-rose-800 text-[11px]">
                          দিনা: {formatCurrencyBn(summary.grandTotalDinaAmount)}
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-500 print:border-slate-900 px-2.5 py-2.5 text-center text-[10px] text-slate-600">
                      চূড়ান্ত মিলন
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Signature Blocks for Printed Sheet */}
            <div className="grid grid-cols-3 gap-6 pt-8 pb-1 text-center text-xs font-extrabold text-slate-800">
              <div>
                <div className="border-t-2 border-slate-800 pt-1.5 inline-block px-6">
                  ক্যাশিয়ার / ব্যবস্থাপক স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t-2 border-slate-800 pt-1.5 inline-block px-6">
                  পরিচালনায়ঃ সাকিব হোসেন
                </div>
              </div>
              <div>
                <div className="border-t-2 border-slate-800 pt-1.5 inline-block px-6">
                  প্রোঃ মোঃ কামরুল ইসলাম
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
