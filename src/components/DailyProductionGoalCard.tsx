import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Factory,
  Flame,
  PlusCircle,
  Save,
  Settings2,
  Target,
  TrendingUp,
} from 'lucide-react';
import type {
  DailyKilnGoals,
  MillId,
  MillPotRecord,
} from '../types/kiln';
import {
  computeDailyMillProductionGoal,
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './Card';

interface DailyProductionGoalCardProps {
  millPots: MillPotRecord[];
  todayDate: string;
  dailyGoals?: DailyKilnGoals;
  isEn?: boolean;
  onSaveDailyGoals: (updatedGoals: DailyKilnGoals) => Promise<void>;
  onQuickSaveMillPot?: (payload: {
    millId: MillId;
    potNo: string;
    date: string;
    rawBricksCut: number;
    takenToChulli: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => Promise<void>;
  onOpenMillHisab: () => void;
}

export const DailyProductionGoalCard: React.FC<DailyProductionGoalCardProps> = ({
  millPots,
  todayDate,
  dailyGoals,
  isEn = false,
  onSaveDailyGoals,
  onQuickSaveMillPot,
  onOpenMillHisab,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [savingPot, setSavingPot] = useState(false);

  useEffect(() => {
    setSelectedDate(todayDate);
  }, [todayDate]);

  const report = computeDailyMillProductionGoal(
    millPots,
    selectedDate,
    dailyGoals
  );

  // Target editor state
  const [ohabTargetInput, setOhabTargetInput] = useState<string>(
    String(
      report.millBreakdown.find((m) => m.millId === 'ohab')?.dailyTargetBricks ||
        18000
    )
  );
  const [mofijulTargetInput, setMofijulTargetInput] = useState<string>(
    String(
      report.millBreakdown.find((m) => m.millId === 'mofijul')
        ?.dailyTargetBricks || 17000
    )
  );
  const [sofikulTargetInput, setSofikulTargetInput] = useState<string>(
    String(
      report.millBreakdown.find((m) => m.millId === 'sofikul')
        ?.dailyTargetBricks || 15000
    )
  );

  useEffect(() => {
    const ohab =
      report.millBreakdown.find((m) => m.millId === 'ohab')?.dailyTargetBricks ||
      18000;
    const mofijul =
      report.millBreakdown.find((m) => m.millId === 'mofijul')
        ?.dailyTargetBricks || 17000;
    const sofikul =
      report.millBreakdown.find((m) => m.millId === 'sofikul')
        ?.dailyTargetBricks || 15000;
    setOhabTargetInput(String(ohab));
    setMofijulTargetInput(String(mofijul));
    setSofikulTargetInput(String(sofikul));
  }, [dailyGoals]);

  // Quick Mill Pot entry state
  const [quickMillId, setQuickMillId] = useState<MillId>('ohab');
  const [quickPotNo, setQuickPotNo] = useState('পট-০১');
  const [quickRawBricks, setQuickRawBricks] = useState('');
  const [quickRatePerThousand, setQuickRatePerThousand] = useState('');
  const [quickPaidAmount, setQuickPaidAmount] = useState('');

  const handleSaveTargetsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ohabVal = Math.max(1000, parseNum(ohabTargetInput, 18000));
    const mofijulVal = Math.max(1000, parseNum(mofijulTargetInput, 17000));
    const sofikulVal = Math.max(1000, parseNum(sofikulTargetInput, 15000));
    const totalTarget = ohabVal + mofijulVal + sofikulVal;

    setSavingTargets(true);
    try {
      await onSaveDailyGoals({
        rawBricksCutTarget: totalTarget,
        bricksSoldTarget: dailyGoals?.bricksSoldTarget || 30000,
        cashCollectionTarget: dailyGoals?.cashCollectionTarget || 250000,
        unloadLinesTarget: dailyGoals?.unloadLinesTarget || 8,
        millDailyTargets: {
          ohab: ohabVal,
          mofijul: mofijulVal,
          sofikul: sofikulVal,
        },
      });
      setIsEditingTargets(false);
    } finally {
      setSavingTargets(false);
    }
  };

  const handleQuickPotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onQuickSaveMillPot) return;
    const bricks = Math.max(0, parseNum(quickRawBricks, 0));
    const paid = Math.max(0, parseNum(quickPaidAmount, 0));
    if (bricks <= 0 && paid <= 0) return;

    setSavingPot(true);
    try {
      await onQuickSaveMillPot({
        millId: quickMillId,
        potNo: quickPotNo.trim() || 'পট-০১',
        date: selectedDate,
        rawBricksCut: bricks,
        takenToChulli: 0,
        ratePerThousand: Math.max(1, parseNum(quickRatePerThousand, 1200)),
        paidAmount: paid,
        note: 'ড্যাশবোর্ড ডেইলি প্রোডাকশন গোল থেকে এন্ট্রি',
      });
      setIsQuickAddOpen(false);
    } finally {
      setSavingPot(false);
    }
  };

  const statusBadgeColors =
    report.status === 'ACHIEVED'
      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
      : report.status === 'ON_TRACK'
      ? 'bg-sky-100 text-sky-900 border-sky-300'
      : report.status === 'NEEDS_PACE'
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-slate-100 text-slate-700 border-slate-300';

  const barGradientClass =
    report.status === 'ACHIEVED'
      ? 'from-emerald-600 via-emerald-500 to-teal-400'
      : report.status === 'ON_TRACK'
      ? 'from-orange-600 via-amber-500 to-emerald-500'
      : report.status === 'NEEDS_PACE'
      ? 'from-orange-600 via-amber-500 to-yellow-500'
      : 'from-slate-400 to-slate-500';

  return (
    <Card
      as="section"
      aria-label="দৈনিক কাঁচা ইট উৎপাদন লক্ষ্যমাত্রা প্রগ্রেস বার"
      data-testid="daily-production-goal-card"
      variant="default"
      topAccent="orange"
      padding="lg"
      className="transition-all"
    >
      {/* Top Header Row */}
      <CardHeader
        bordered
        borderVariant="light"
        className="lg:flex-row lg:items-center lg:justify-between gap-3"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200">
                {isEn
                  ? 'Daily Production Goal (Mill Pots)'
                  : 'দৈনিক কাঁচা ইট উৎপাদন লক্ষ্যমাত্রা (Mill Pots Goal)'}
              </span>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${statusBadgeColors}`}
              >
                {isEn ? report.statusLabelEn : report.statusLabelBn}
              </span>
            </div>
            <CardTitle as="h2" className="text-slate-900 mt-1">
              {isEn
                ? 'Daily Mill Brick Production Progress vs Target'
                : 'আজকের মিল কাঁচা ইট উৎপাদন বনাম দৈনিক টার্গেট প্রগ্রেস বার'}
            </CardTitle>
            <CardDescription variant="light">
              {isEn
                ? 'Live progress calculated from millPots daily targets vs current raw bricks cut across all 3 mills'
                : 'ওহাব মিল, মফিজুল মিল ও শফিকুল মিলের প্রতিদিনের কাঁচা ইট কাটার লক্ষ্যমাত্রা ও বর্তমান উৎপাদনের লাইভ তুলনা'}
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <label
              htmlFor="daily-prod-goal-date"
              className="text-[11px] font-bold text-slate-600"
            >
              {isEn ? 'Date:' : 'তারিখ:'}
            </label>
            <input
              id="daily-prod-goal-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-0.5 focus:border-orange-500 focus:outline-hidden cursor-pointer"
            />
          </div>

          {onQuickSaveMillPot && (
            <button
              type="button"
              onClick={() => {
                setIsQuickAddOpen((v) => !v);
                setIsEditingTargets(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold cursor-pointer shadow-2xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              {isEn ? '+ Add Mill Pot' : '+ আজকের মিল পট যোগ'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsEditingTargets((v) => !v);
              setIsQuickAddOpen(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-orange-600" />
            {isEn ? 'Set Target' : 'টার্গেট সেট করুন'}
          </button>

          <button
            type="button"
            onClick={onOpenMillHisab}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer transition-colors"
          >
            {isEn ? 'Mill Ledger →' : 'মিল হিসাব খাতা →'}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

      {/* Collapsible Inline Target Editor */}
      {isEditingTargets && (
        <form
          noValidate
          onSubmit={handleSaveTargetsSubmit}
          className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-orange-950 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-orange-600" />
              মিলভিত্তিক দৈনিক কাঁচা ইট উৎপাদনের লক্ষ্যমাত্রা নির্ধারণ করুন
            </h3>
            <span className="text-xs font-bold text-orange-800">
              মোট দৈনিক টার্গেট:{' '}
              {formatBn(
                parseNum(ohabTargetInput, 0) +
                  parseNum(mofijulTargetInput, 0) +
                  parseNum(sofikulTargetInput, 0)
              )}{' '}
              পিস
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ১. ওহাব মিল — দৈনিক টার্গেট (পিস)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={ohabTargetInput}
                onChange={(e) => setOhabTargetInput(normalizeNumericInput(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 bg-white text-sm font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ২. মফিজুল মিল — দৈনিক টার্গেট (পিস)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={mofijulTargetInput}
                onChange={(e) => setMofijulTargetInput(normalizeNumericInput(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 bg-white text-sm font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ৩. শফিকুল মিল — দৈনিক টার্গেট (পিস)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={sofikulTargetInput}
                onChange={(e) => setSofikulTargetInput(normalizeNumericInput(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 bg-white text-sm font-black text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingTargets(false)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={savingTargets}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-black cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingTargets ? 'সেভ হচ্ছে...' : 'দৈনিক টার্গেট সেভ করুন'}
            </button>
          </div>
        </form>
      )}

      {/* Collapsible Quick Mill Pot Entry Form */}
      {isQuickAddOpen && onQuickSaveMillPot && (
        <form
          noValidate
          onSubmit={handleQuickPotSubmit}
          className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              আজকের মিল পট ও কাঁচা ইট উৎপাদন দ্রুত যোগ করুন ({selectedDate})
            </h3>
            <span className="text-[11px] font-bold text-emerald-800">
              বিল: {formatCurrencyBn(Math.round((parseNum(quickRawBricks, 0) / 1000) * parseNum(quickRatePerThousand, 1200)))}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                মিল নির্বাচন করুন
              </label>
              <select
                aria-label="মিল নির্বাচন করুন"
                value={quickMillId}
                onChange={(e) => setQuickMillId(e.target.value as MillId)}
                className="w-full px-2.5 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-900"
              >
                <option value="ohab">ওহাব মিল</option>
                <option value="mofijul">মফিজুল মিল</option>
                <option value="sofikul">শফিকুল মিল</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                পট নং
              </label>
              <input
                type="text"
                value={quickPotNo}
                onChange={(e) => setQuickPotNo(e.target.value)}
                placeholder="যেমন: পট-০১"
                className="w-full px-2.5 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                কাঁচা ইট সংখ্যা (পিস) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quickRawBricks}
                onChange={(e) => setQuickRawBricks(normalizeNumericInput(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border-2 border-emerald-500 bg-white text-xs font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                হাজার প্রতি রেট (৳)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quickRatePerThousand}
                onChange={(e) => setQuickRatePerThousand(normalizeNumericInput(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                নগদ জমা / দাদন (৳)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quickPaidAmount}
                onChange={(e) => setQuickPaidAmount(normalizeNumericInput(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-900"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600">দ্রুত পিস:</span>
              {[10000, 15000, 18000, 20000, 25000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuickRawBricks(String(preset))}
                  className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100 cursor-pointer"
                >
                  {formatBn(preset)} পিস
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={savingPot}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savingPot ? 'যোগ হচ্ছে...' : 'মিল উৎপাদন যোগ করুন'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Visual Progress Bar Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              আজকের মোট কাঁচা ইট উৎপাদন বনাম দৈনিক লক্ষ্যমাত্রা ({selectedDate})
            </div>
            <div className="flex flex-wrap items-baseline gap-2 mt-1">
              <span
                data-testid="daily-production-current-bricks"
                className="text-2xl sm:text-3xl font-black text-white tabular-nums"
              >
                {formatBn(report.currentProductionBricks)} পিস
              </span>
              <span className="text-sm font-bold text-slate-400 tabular-nums">
                / লক্ষ্যমাত্রা {formatBn(report.dailyTargetBricks)} পিস
              </span>
              <span className="text-xs font-bold text-amber-300">
                ({formatBn(report.todayPotsCount)}টি পট এন্ট্রি)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:text-right">
            <div>
              <div className="text-[11px] font-semibold text-slate-400">
                {report.surplusBricks > 0
                  ? 'লক্ষ্যমাত্রার চেয়ে অতিরিক্ত উৎপাদন'
                  : 'আজকের লক্ষ্যমাত্রা পূরণে বাকি'}
              </div>
              <div
                className={`text-sm sm:text-base font-black tabular-nums ${
                  report.surplusBricks > 0 ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {report.surplusBricks > 0
                  ? `+${formatBn(report.surplusBricks)} পিস বেশি`
                  : `${formatBn(report.remainingBricks)} পিস বাকি`}
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-center shrink-0">
              <span className="block text-[10px] font-bold text-slate-300 uppercase">
                অগ্রগতি
              </span>
              <span
                data-testid="daily-production-goal-pct"
                className="text-xl font-black text-emerald-400 tabular-nums"
              >
                {formatBn(report.exactPct)}%
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar with 25% / 50% / 75% / 100% Milestone Ticks */}
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label="দৈনিক কাঁচা ইট উৎপাদন অগ্রগতি"
            aria-valuenow={report.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative w-full h-5 bg-slate-800 border border-slate-700 rounded-full overflow-hidden p-0.5"
          >
            {/* Milestone Vertical Lines */}
            <div className="absolute inset-y-0 left-1/4 w-px bg-slate-600/60 z-10" />
            <div className="absolute inset-y-0 left-2/4 w-px bg-slate-600/60 z-10" />
            <div className="absolute inset-y-0 left-3/4 w-px bg-slate-600/60 z-10" />

            <div
              style={{ width: `${Math.max(report.currentProductionBricks > 0 ? 4 : 0, report.progressPct)}%` }}
              className={`h-full rounded-full bg-gradient-to-r ${barGradientClass} transition-all duration-500 flex items-center justify-end pr-2`}
            >
              {report.progressPct >= 12 && (
                <span className="text-[10px] font-black text-white drop-shadow-xs tabular-nums">
                  {formatBn(report.exactPct)}%
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 tabular-nums px-1">
            <span>০% (শুরু)</span>
            <span>২৫% ({formatBn(Math.round(report.dailyTargetBricks * 0.25))})</span>
            <span>৫০% ({formatBn(Math.round(report.dailyTargetBricks * 0.5))})</span>
            <span>৭৫% ({formatBn(Math.round(report.dailyTargetBricks * 0.75))})</span>
            <span className="text-emerald-300 font-bold">
              ১০০% লক্ষ্যমাত্রা ({formatBn(report.dailyTargetBricks)} পিস)
            </span>
          </div>
        </div>
      </div>

      {/* Per-Mill Daily Target vs Current Production Breakdown (ওহাব, মফিজুল, শফিকুল) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {report.millBreakdown.map((mill) => {
          const millBarColor =
            mill.status === 'ACHIEVED'
              ? 'bg-emerald-500'
              : mill.status === 'ON_TRACK'
              ? 'bg-orange-500'
              : mill.status === 'NEEDS_PACE'
              ? 'bg-amber-500'
              : 'bg-slate-300';

          const millBadge =
            mill.status === 'ACHIEVED'
              ? { label: 'লক্ষ্যমাত্রা পূর্ণ', cls: 'bg-emerald-100 text-emerald-800' }
              : mill.status === 'ON_TRACK'
              ? { label: 'অন ট্র্যাক', cls: 'bg-sky-100 text-sky-800' }
              : mill.status === 'NEEDS_PACE'
              ? { label: 'চলমান', cls: 'bg-amber-100 text-amber-800' }
              : { label: 'এন্ট্রি বাকি', cls: 'bg-slate-100 text-slate-600' };

          return (
            <div
              key={mill.millId}
              className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-slate-900">
                    {isEn ? mill.millNameEn : mill.millNameBn}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    আজকের পট: {formatBn(mill.potsCountToday)}টি · সিজনে মোট:{' '}
                    <strong className="text-slate-700">
                      {formatBn(mill.seasonTotalBricksCut)} পিস
                    </strong>
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${millBadge.cls}`}
                >
                  {millBadge.label} ({formatBn(mill.exactPct)}%)
                </span>
              </div>

              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="font-extrabold text-slate-900">
                  আজ: {formatBn(mill.currentBricksCut)} পিস
                </span>
                <span className="text-slate-500 font-semibold">
                  টার্গেট: {formatBn(mill.dailyTargetBricks)} পিস
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${Math.max(
                      mill.currentBricksCut > 0 ? 5 : 0,
                      mill.progressPct
                    )}%`,
                  }}
                  className={`h-full rounded-full ${millBarColor} transition-all duration-500`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                <span>
                  {mill.remainingBricks > 0
                    ? `বাকি: ${formatBn(mill.remainingBricks)} পিস`
                    : `অতিরিক্ত: +${formatBn(mill.surplusBricks)} পিস`}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                  <TrendingUp className="w-3 h-3 text-orange-600" />
                  চুল্লিতে গেছে: {formatBn(mill.takenToChulliToday)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      </CardContent>
    </Card>
  );
};
