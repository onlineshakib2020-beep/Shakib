import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Gauge,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { CashTransaction } from '../types/kiln';
import {
  computeSevenDayLiquidityHealth,
  formatBn,
  formatCurrencyBn,
} from '../utils/kilnLogic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CardTopAccent,
} from './Card';

interface FinancialHealthGaugeCardProps {
  cashTransactions: CashTransaction[];
  openingBalance: number;
  todayDate: string;
  isEn?: boolean;
  onOpenCashBook?: () => void;
}

export const FinancialHealthGaugeCard: React.FC<FinancialHealthGaugeCardProps> = ({
  cashTransactions,
  openingBalance,
  todayDate,
  isEn = false,
  onOpenCashBook,
}) => {
  // Check if the 7-day window ending on todayDate has any transactions
  const todayWindowHealth = useMemo(
    () => computeSevenDayLiquidityHealth(cashTransactions, openingBalance, todayDate),
    [cashTransactions, openingBalance, todayDate]
  );

  // Also compute the 7-day window anchored on the latest recorded transaction date
  const latestActivityHealth = useMemo(
    () => computeSevenDayLiquidityHealth(cashTransactions, openingBalance),
    [cashTransactions, openingBalance]
  );

  const hasTodayWindowActivity =
    todayWindowHealth.total7dCollections > 0 || todayWindowHealth.total7dExpenses > 0;

  const [windowMode, setWindowMode] = useState<'AUTO' | 'TODAY'>('AUTO');

  const health = useMemo(() => {
    if (windowMode === 'TODAY' || hasTodayWindowActivity) {
      return todayWindowHealth;
    }
    return latestActivityHealth;
  }, [windowMode, hasTodayWindowActivity, todayWindowHealth, latestActivityHealth]);

  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  const maxAbsDailyValue = useMemo(() => {
    let maxVal = 1;
    for (const d of health.days) {
      maxVal = Math.max(
        maxVal,
        Math.abs(d.netCashMovement),
        d.collections,
        d.expenses
      );
    }
    return maxVal;
  }, [health.days]);

  const activeDay =
    selectedDayIdx !== null && health.days[selectedDayIdx]
      ? health.days[selectedDayIdx]
      : health.days[health.days.length - 1];

  // Semi-circular SVG gauge geometry (r = 72, circumference of half circle = pi * 72 ≈ 226.19)
  const radius = 72;
  const arcLength = Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, health.gaugeScore));
  const strokeDashoffset = arcLength - (clampedScore / 100) * arcLength;

  // Needle angle (-90 deg is 0, +90 deg is 100)
  const needleAngleDeg = -90 + (clampedScore / 100) * 180;

  const statusColors: {
    stroke: string;
    text: string;
    badgeBg: string;
    glow: string;
    topAccent: CardTopAccent;
  } = {
    STRONG: {
      stroke: '#10b981',
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
      glow: 'from-emerald-500/20 to-teal-500/5',
      topAccent: 'emerald' as CardTopAccent,
    },
    STABLE: {
      stroke: '#38bdf8',
      text: 'text-sky-400',
      badgeBg: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
      glow: 'from-sky-500/20 to-cyan-500/5',
      topAccent: 'sky' as CardTopAccent,
    },
    WATCH: {
      stroke: '#f59e0b',
      text: 'text-amber-400',
      badgeBg: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
      glow: 'from-amber-500/20 to-orange-500/5',
      topAccent: 'amber' as CardTopAccent,
    },
    CRITICAL: {
      stroke: '#f43f5e',
      text: 'text-rose-400',
      badgeBg: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
      glow: 'from-rose-500/20 to-red-500/5',
      topAccent: 'rose' as CardTopAccent,
    },
  }[health.statusLevel];

  return (
    <Card
      as="section"
      aria-label={
        isEn
          ? 'Financial Health Gauge — 7-Day Net Cash Movement'
          : 'আর্থিক স্বাস্থ্য ও তারল্য মিটার (Financial Health Gauge)'
      }
      data-testid="financial-health-gauge-card"
      variant="dark"
      topAccent={statusColors.topAccent}
      padding="lg"
      className="transition-all"
    >
      {/* Top Header Strip */}
      <CardHeader
        bordered
        borderVariant="dark"
        className="lg:flex-row lg:items-center lg:justify-between gap-3.5"
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle as="h2" className="text-white">
                {isEn
                  ? 'Financial Health Gauge — 7-Day Net Cash Movement'
                  : 'আর্থিক স্বাস্থ্য ও তারল্য মিটার (Financial Health Gauge)'}
              </CardTitle>
              <span
                data-testid="liquidity-status-badge"
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border ${statusColors.badgeBg}`}
              >
                {isEn ? health.statusLabelEn : health.statusLabelBn}
              </span>
            </div>
            <CardDescription variant="dark">
              {isEn
                ? 'Monitors 7-day liquidity trend of Net Cash Movement (Collections minus Expenses)'
                : `৭ দিনের নিট ক্যাশ প্রবাহ (নগদ আদায় বিয়োগ ভাটা খরচ) · ${health.insightBn}`}
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!hasTodayWindowActivity && latestActivityHealth.anchorDate !== todayDate && (
            <div className="inline-flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setWindowMode('AUTO')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  windowMode === 'AUTO'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                সর্বশেষ সক্রিয় ৭ দিন
              </button>
              <button
                type="button"
                onClick={() => setWindowMode('TODAY')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  windowMode === 'TODAY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                চলতি ৭ দিন
              </button>
            </div>
          )}

          {onOpenCashBook && (
            <button
              type="button"
              onClick={onOpenCashBook}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-all cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              {isEn ? 'Open Cash Book' : 'ক্যাশ বুক দেখুন'}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Main Content Grid: Left Gauge Dial + Right 7-Day Net Cash Movement Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (4 cols): Financial Health Semi-Circular Gauge + Liquidity Summary */}
          <Card
            variant="darkSubtle"
            padding="md"
            className={`lg:col-span-4 bg-gradient-to-b ${statusColors.glow} flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1.5 text-slate-300">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                {isEn ? 'Liquidity Health Score' : 'তারল্য ও ক্যাশ হেলথ স্কোর'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {health.days[0]?.dateLabelBn} – {health.days[6]?.dateLabelBn}
              </span>
            </div>

            {/* SVG Semi-Circular Gauge */}
            <div className="relative flex flex-col items-center justify-center my-1">
              <svg
                viewBox="0 0 200 118"
                className="w-full max-w-[230px] overflow-visible"
                aria-label="Financial Health Gauge"
              >
                <defs>
                  <linearGradient id="liquidityGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="75%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Background Track Arc */}
                <path
                  d="M 28 98 A 72 72 0 0 1 172 98"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="14"
                  strokeLinecap="round"
                />

                {/* Active Value Arc */}
                <path
                  d="M 28 98 A 72 72 0 0 1 172 98"
                  fill="none"
                  stroke="url(#liquidityGaugeGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={arcLength}
                  strokeDashoffset={strokeDashoffset}
                />

                {/* Scale Labels */}
                <text x="18" y="114" className="fill-rose-400 text-[9px] font-bold">
                  ০
                </text>
                <text x="93" y="16" className="fill-amber-300 text-[9px] font-bold">
                  ৫০
                </text>
                <text x="168" y="114" className="fill-emerald-400 text-[9px] font-bold">
                  ১০০
                </text>

                {/* Gauge Needle */}
                <g transform={`translate(100, 98) rotate(${needleAngleDeg})`}>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-56"
                    stroke={statusColors.stroke}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="0" r="6" fill={statusColors.stroke} />
                  <circle cx="0" cy="0" r="2.5" fill="#0f172a" />
                </g>
              </svg>

              <div className="text-center -mt-2">
                <div
                  data-testid="financial-health-gauge-score"
                  className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${statusColors.text}`}
                >
                  {formatBn(health.gaugeScore)}
                  <span className="text-sm font-bold text-slate-400">/১০০</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                  {isEn
                    ? `${health.positiveDaysCount} positive days · ${health.negativeDaysCount} deficit days`
                    : `৭ দিনে ${formatBn(health.positiveDaysCount)} দিন উদ্বৃত্ত · ${formatBn(health.negativeDaysCount)} দিন ঘাটতি`}
                </p>
              </div>
            </div>

            {/* 3 Mini Liquidity Metrics inside Left Gauge Panel */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/90 text-center">
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-200 block">৭ দিনে আদায়</span>
                <span
                  data-testid="gauge-7d-collections"
                  className="text-xs font-extrabold text-emerald-400 tabular-nums mt-0.5 block"
                >
                  {formatCurrencyBn(health.total7dCollections)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-200 block">৭ দিনে খরচ</span>
                <span
                  data-testid="gauge-7d-expenses"
                  className="text-xs font-extrabold text-rose-400 tabular-nums mt-0.5 block"
                >
                  {formatCurrencyBn(health.total7dExpenses)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-200 block">হাতে নিট ক্যাশ</span>
                <span
                  data-testid="gauge-current-cash"
                  className="text-xs font-extrabold text-cyan-300 tabular-nums mt-0.5 block"
                >
                  {formatCurrencyBn(health.currentCashBalance)}
                </span>
              </div>
            </div>
          </Card>

          {/* Right Column (8 cols): 7-Day Net Cash Movement Trend Chart & Breakdown */}
          <Card
            variant="darkSubtle"
            padding="md"
            className="lg:col-span-8 flex flex-col justify-between space-y-4"
          >
            {/* Top Summary Row for 7-Day Net Cash Movement */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-white">
                    {isEn
                      ? '7-Day Net Cash Movement Trend (Collections − Expenses)'
                      : '৭ দিনের নিট ক্যাশ প্রবাহ ট্রেন্ড (নগদ আদায় − ভাটা খরচ)'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-200 mt-0.5">
                  {isEn
                    ? 'Click any day bar to inspect daily Collections, Expenses, and Net Cashflow'
                    : 'যেকোনো দিনের বার-এ ক্লিক করে ওই দিনের আদায়, খরচ ও নিট ক্যাশ প্রবাহ দেখুন'}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-right">
                  <span className="text-[10px] font-semibold text-slate-200 block">
                    {isEn ? '7-Day Net Cash Movement' : '৭ দিনের নিট ক্যাশ প্রবাহ'}
                  </span>
                  <span
                    data-testid="gauge-7d-net-movement"
                    className={`text-sm font-black tabular-nums flex items-center justify-end gap-1 ${
                      health.total7dNetCashMovement >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {health.total7dNetCashMovement >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {health.total7dNetCashMovement >= 0 ? '+' : '-'}
                    {formatCurrencyBn(Math.abs(health.total7dNetCashMovement))}
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-right hidden sm:block">
                  <span className="text-[10px] font-semibold text-slate-200 block">
                    {isEn ? 'Daily Avg Net' : 'দৈনিক গড় নিট প্রবাহ'}
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      health.averageDailyNetMovement >= 0
                        ? 'text-cyan-300'
                        : 'text-amber-300'
                    }`}
                  >
                    {health.averageDailyNetMovement >= 0 ? '+' : '-'}
                    {formatCurrencyBn(Math.abs(health.averageDailyNetMovement))}
                  </span>
                </div>
              </div>
            </div>

            {/* 7-Day Interactive Bar Chart */}
            <div
              data-testid="seven-day-net-cash-chart"
              className="grid grid-cols-7 gap-2 sm:gap-3 pt-2 pb-1 items-end min-h-[168px]"
            >
              {health.days.map((day, idx) => {
                const isSelected =
                  selectedDayIdx === idx ||
                  (selectedDayIdx === null && idx === health.days.length - 1);
                const netVal = day.netCashMovement;
                const isPositive = netVal > 0;
                const isNegative = netVal < 0;

                const collectionHeightPct = Math.max(
                  day.collections > 0 ? 12 : 4,
                  Math.round((day.collections / maxAbsDailyValue) * 100)
                );
                const expenseHeightPct = Math.max(
                  day.expenses > 0 ? 12 : 4,
                  Math.round((day.expenses / maxAbsDailyValue) * 100)
                );
                const netHeightPct = Math.max(
                  netVal !== 0 ? 16 : 6,
                  Math.round((Math.abs(netVal) / maxAbsDailyValue) * 100)
                );

                return (
                  <button
                    key={day.date}
                    type="button"
                    data-testid={`liquidity-day-bar-${idx}`}
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`group flex flex-col items-center justify-between rounded-xl p-2 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-800/95 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Net Value Pill */}
                    <span
                      className={`text-[10px] font-extrabold tabular-nums truncate max-w-full ${
                        isPositive
                          ? 'text-emerald-400'
                          : isNegative
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {netVal > 0
                        ? `+${formatBn(Math.round(netVal / 1000))}k`
                        : netVal < 0
                        ? `-${formatBn(Math.round(Math.abs(netVal) / 1000))}k`
                        : '০'}
                    </span>

                    {/* Bars Container */}
                    <div className="w-full h-24 flex items-end justify-center gap-1 my-1.5 px-0.5 border-b border-slate-800">
                      {/* Collections Bar (IN) */}
                      <div
                        title={`আদায়: ${formatCurrencyBn(day.collections)}`}
                        style={{ height: `${collectionHeightPct}%` }}
                        className={`w-2 sm:w-2.5 rounded-t-sm transition-all ${
                          day.collections > 0
                            ? 'bg-emerald-500/85 group-hover:bg-emerald-400'
                            : 'bg-slate-800'
                        }`}
                      />
                      {/* Expenses Bar (OUT) */}
                      <div
                        title={`খরচ: ${formatCurrencyBn(day.expenses)}`}
                        style={{ height: `${expenseHeightPct}%` }}
                        className={`w-2 sm:w-2.5 rounded-t-sm transition-all ${
                          day.expenses > 0
                            ? 'bg-rose-500/85 group-hover:bg-rose-400'
                            : 'bg-slate-800'
                        }`}
                      />
                      {/* Net Cash Movement Bar */}
                      <div
                        title={`নিট প্রবাহ: ${formatCurrencyBn(day.netCashMovement)}`}
                        style={{ height: `${netHeightPct}%` }}
                        className={`w-2.5 sm:w-3 rounded-t-sm transition-all ${
                          isPositive
                            ? 'bg-cyan-400 shadow-xs'
                            : isNegative
                            ? 'bg-amber-500 shadow-xs'
                            : 'bg-slate-700'
                        }`}
                      />
                    </div>

                    {/* Day & Date Label */}
                    <div className="text-center leading-tight">
                      <span className="block text-[10px] font-bold text-slate-300">
                        {day.dayShortBn}
                      </span>
                      <span className="block text-[10px] text-slate-400 tabular-nums">
                        {day.dateLabelBn}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Detail & Legend Footer */}
            {activeDay && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    {activeDay.dayShortBn} ({activeDay.dateLabelBn}):
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold tabular-nums">
                    <TrendingUp className="w-3.5 h-3.5" />
                    আদায়: {formatCurrencyBn(activeDay.collections)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-400 font-bold tabular-nums">
                    <TrendingDown className="w-3.5 h-3.5" />
                    খরচ: {formatCurrencyBn(activeDay.expenses)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-extrabold tabular-nums px-2 py-0.5 rounded-md ${
                      activeDay.netCashMovement >= 0
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    নিট প্রবাহ: {activeDay.netCashMovement >= 0 ? '+' : '-'}
                    {formatCurrencyBn(Math.abs(activeDay.netCashMovement))}
                  </span>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                    আদায় (IN)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                    খরচ (OUT)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-cyan-400 inline-block" />
                    নিট (Net)
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};
