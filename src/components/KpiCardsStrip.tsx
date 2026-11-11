import React, { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Calculator,
  Check,
  FileText,
  Layers,
  MessageCircle,
  Printer,
  Receipt,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import type { DashboardMetrics, KpiCardId } from '../types/kiln';
import {
  calculateLiveLiquidity,
  formatBn,
  formatCurrencyBn,
  formatDailyClosingWhatsAppReport,
} from '../utils/kilnLogic';
import { Card } from './Card';

interface KpiCardsStripProps {
  metrics: DashboardMetrics;
  activeKpi: KpiCardId | null;
  onSelectKpi: (id: KpiCardId) => void;
  isEn?: boolean;
}

export const KpiCardsStrip: React.FC<KpiCardsStripProps> = ({
  metrics,
  activeKpi,
  onSelectKpi,
  isEn = false,
}) => {
  const [copiedClosingWa, setCopiedClosingWa] = useState(false);

  const liquidity = calculateLiveLiquidity({
    todayCashIn: metrics.todayCashIn,
    todayExpense: metrics.todayExpense,
    totalCashIn: metrics.totalCashIn,
    totalExpense: metrics.totalExpense,
    openingBalance: metrics.openingBalance,
  });

  const formatSignedCurrency = (val: number) => {
    if (val < 0) return `-${formatCurrencyBn(Math.abs(val))}`;
    return formatCurrencyBn(val);
  };

  const handleCopyDailyClosingWhatsApp = async () => {
    const text = formatDailyClosingWhatsAppReport(metrics);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback if clipboard API is restricted
    }
    setCopiedClosingWa(true);
    setTimeout(() => setCopiedClosingWa(false), 2200);
  };

  const cards: Array<{
    id: KpiCardId;
    titleBn: string;
    subtitleBn: string;
    valueBn: string;
    metaLineBn: string;
    formulaBadgeBn?: string;
    icon: React.ReactNode;
    iconBoxClass: string;
    valueColorClass: string;
    borderHoverClass: string;
    topAccentClass: string;
    gridSpanClass?: string;
  }> = [
    {
      id: 'LIVE_LIQUIDITY',
      titleBn: isEn ? 'Live Liquidity (Cash-in-Hand)' : 'লাইভ লিকুইডিটি (নগদ হাতে ক্যাশ)',
      subtitleBn: isEn
        ? 'Real-time Sales Collections minus Daily Expenses'
        : 'বিক্রয় আদায় থেকে দৈনিক খরচ বাদে রিয়েল-টাইম হাতে ক্যাশ',
      valueBn: formatSignedCurrency(liquidity.actualCashInHandWithOpening),
      formulaBadgeBn: isEn
        ? `Today Net: ${formatSignedCurrency(liquidity.dailyNetCashInHand)} (In ${formatCurrencyBn(metrics.todayCashIn)} - Out ${formatCurrencyBn(metrics.todayExpense)})`
        : `আজকের নিট: ${formatSignedCurrency(liquidity.dailyNetCashInHand)} (আদায় ${formatCurrencyBn(metrics.todayCashIn)} - খরচ ${formatCurrencyBn(metrics.todayExpense)})`,
      metaLineBn: isEn
        ? `Season In ${formatCurrencyBn(metrics.totalCashIn)} - Out ${formatCurrencyBn(metrics.totalExpense)} · Opening ${formatCurrencyBn(metrics.openingBalance)}`
        : `মোট আদায় ${formatCurrencyBn(metrics.totalCashIn)} - খরচ ${formatCurrencyBn(metrics.totalExpense)} (প্রারম্ভিক ${formatCurrencyBn(metrics.openingBalance)})`,
      icon: <Activity className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-700" />,
      iconBoxClass: 'bg-emerald-50 border border-emerald-300/90 shadow-2xs',
      valueColorClass:
        liquidity.actualCashInHandWithOpening < 0
          ? 'text-rose-700'
          : 'text-emerald-700',
      borderHoverClass: 'hover:border-emerald-500/90',
      topAccentClass:
        'border-t-4 border-t-emerald-600 bg-gradient-to-br from-emerald-50/45 via-white to-teal-50/35',
      gridSpanClass: 'col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2',
    },
    {
      id: 'TOTAL_BRICKS_SOLD',
      titleBn: isEn ? 'Total Brick Sales' : 'মোট ইট বিক্রয়',
      subtitleBn: isEn
        ? 'Total seasonal sales & memo bills'
        : 'সিজনের সর্বমোট বিক্রি ও মেমো বিল',
      valueBn: formatCurrencyBn(metrics.totalBrickSalesAmountAllTime),
      metaLineBn: isEn
        ? `Bricks ${formatBn(metrics.totalBricksSoldAllTime)} · Today ${formatCurrencyBn(metrics.todaySalesAmount)}`
        : `মোট ইট ${formatBn(metrics.totalBricksSoldAllTime)} · আজ ${formatCurrencyBn(metrics.todaySalesAmount)}`,
      icon: <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-orange-700" />,
      iconBoxClass: 'bg-orange-50 border border-orange-200/80 shadow-2xs',
      valueColorClass: 'text-slate-900',
      borderHoverClass: 'hover:border-orange-500/80',
      topAccentClass: 'border-t-4 border-t-orange-500',
    },
    {
      id: 'TODAY_COLLECTION',
      titleBn: isEn ? 'Today Cash Collection' : 'আজকের নগদ আদায়',
      subtitleBn: isEn
        ? 'Today cash & bank receipts'
        : 'আজকের নগদ ও ব্যাংক প্রাপ্তি',
      valueBn: formatCurrencyBn(metrics.todayCashIn),
      metaLineBn: isEn
        ? `Today Memos ${formatBn(metrics.todaySalesMemoCount)} · Verified Cash In`
        : `আজকের মেমো ${formatBn(metrics.todaySalesMemoCount)}টি · নগদ জমা`,
      icon: <Receipt className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-700" />,
      iconBoxClass: 'bg-emerald-50 border border-emerald-200/80 shadow-2xs',
      valueColorClass: 'text-emerald-700',
      borderHoverClass: 'hover:border-emerald-500/80',
      topAccentClass: 'border-t-4 border-t-emerald-500',
    },
    {
      id: 'TOTAL_COLLECTION',
      titleBn: isEn ? 'Total Cash Collection' : 'সর্বমোট নগদ আদায়',
      subtitleBn: isEn
        ? 'Total seasonal collected deposits'
        : 'সিজনের সর্বমোট সংগৃহীত জমা',
      valueBn: formatCurrencyBn(metrics.totalCashIn),
      metaLineBn: isEn
        ? 'Combined memo deposits & due collections'
        : 'মেমো জমা ও বকেয়া আদায় মিলিয়ে প্রাপ্তি',
      icon: <Banknote className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-700" />,
      iconBoxClass: 'bg-emerald-50 border border-emerald-200/80 shadow-2xs',
      valueColorClass: 'text-emerald-800',
      borderHoverClass: 'hover:border-emerald-500/80',
      topAccentClass: 'border-t-4 border-t-teal-600',
    },
    {
      id: 'TOTAL_EXPENSE',
      titleBn: isEn ? 'Total Kiln Expenses' : 'সর্বমোট ভাটা খরচ',
      subtitleBn: isEn
        ? 'Coal, diesel, clay & labor expenses'
        : 'কয়লা, ডিজেল, মাটি ও শ্রমিক ব্যয়',
      valueBn: formatCurrencyBn(metrics.totalExpense),
      metaLineBn: isEn
        ? `Today Expense ${formatCurrencyBn(metrics.todayExpense)}`
        : `আজকের খরচ ${formatCurrencyBn(metrics.todayExpense)} · ভাটা ব্যয়`,
      icon: <TrendingDown className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-rose-700" />,
      iconBoxClass: 'bg-rose-50 border border-rose-200/80 shadow-2xs',
      valueColorClass: 'text-rose-700',
      borderHoverClass: 'hover:border-rose-500/80',
      topAccentClass: 'border-t-4 border-t-rose-500',
    },
    {
      id: 'CASH_BALANCE',
      titleBn: isEn ? 'Current Cash Balance' : 'বর্তমান নগদ তহবিল',
      subtitleBn: isEn
        ? 'Opening Cash + Total In - Total Out'
        : 'প্রারম্ভিক তহবিল + মোট জমা - খরচ',
      valueBn: formatCurrencyBn(metrics.currentCashBalance),
      metaLineBn: isEn
        ? `Opening Tk ${formatBn(metrics.openingBalance)} cash fund`
        : `প্রারম্ভিক ৳${formatBn(metrics.openingBalance)} সহ নগদ তহবিল`,
      icon: <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-sky-800" />,
      iconBoxClass: 'bg-sky-50 border border-sky-200/80 shadow-2xs',
      valueColorClass: 'text-slate-900',
      borderHoverClass: 'hover:border-sky-500/80',
      topAccentClass: 'border-t-4 border-t-sky-600',
    },
    {
      id: 'TOTAL_DUE',
      titleBn: isEn ? 'Total Customer Due' : 'মোট ক্রেতা বকেয়া',
      subtitleBn: isEn
        ? 'Outstanding customer receivables'
        : 'ক্রেতাদের কাছে বাকি খাতা',
      valueBn: formatCurrencyBn(metrics.totalCustomerDue),
      metaLineBn: isEn
        ? `Total ${formatBn(metrics.dueCustomerCount)} customers with due`
        : `মোট ${formatBn(metrics.dueCustomerCount)} জন ক্রেতার কাছে বকেয়া`,
      icon: <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-rose-700" />,
      iconBoxClass: 'bg-rose-50 border border-rose-200/80 shadow-2xs',
      valueColorClass: 'text-rose-700',
      borderHoverClass: 'hover:border-rose-500/80',
      topAccentClass: 'border-t-4 border-t-amber-600',
    },
  ];

  return (
    <section
      aria-label={isEn ? 'Kiln Key Financial Indicators' : 'ভাটার প্রধান আর্থিক সূচক'}
      data-testid="kpi-cards-strip-section"
      className="w-full min-w-0 max-w-full space-y-2.5 sm:space-y-4 overflow-hidden"
    >
      {/* 7 Clickable KPI Summary Cards (Vertical 1-Col on Mobile, 2-Col Small Tablet, 3-Col Tablet, 4-Col Desktop — Zero Overflow) */}
      <div
        data-testid="kpi-cards-grid"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 w-full min-w-0 max-w-full"
      >
        {cards.map((card) => {
          const isSelected = activeKpi === card.id;
          const isLiveLiquidity = card.id === 'LIVE_LIQUIDITY';
          return (
            <button
              key={card.id}
              type="button"
              data-testid={`kpi-card-${card.id}`}
              onClick={() => onSelectKpi(card.id)}
              aria-label={
                isEn
                  ? `${card.titleBn} view detailed print report`
                  : `${card.titleBn} বিস্তারিত প্রিন্ট রিপোর্ট দেখুন`
              }
              className={`group relative w-full min-w-0 max-w-full overflow-hidden text-left bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border shadow-xs hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                card.gridSpanClass || 'col-span-1'
              } ${card.topAccentClass} ${
                isSelected
                  ? 'border-orange-600 ring-2 ring-orange-500/25'
                  : `border-slate-200/95 ${card.borderHoverClass}`
              }`}
            >
              {/* Subtle Corner Watermark Icon */}
              <div
                aria-hidden="true"
                className="hidden sm:block pointer-events-none absolute -right-3 -bottom-3 opacity-[0.05] group-hover:opacity-[0.11] group-hover:scale-110 transition-all duration-300 scale-[2.6]"
              >
                {card.icon}
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-1.5 sm:gap-2.5 mb-1 sm:mb-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-[11px] sm:text-sm font-black text-slate-950 truncate group-hover:text-orange-700 transition-colors">
                        {card.titleBn}
                      </h2>
                      {isLiveLiquidity && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] sm:text-[10px] font-extrabold shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-600 truncate mt-0.5">
                      {card.subtitleBn}
                    </p>
                  </div>
                  <div
                    className={`p-1 sm:p-2 rounded-md sm:rounded-xl transition-transform group-hover:scale-110 shrink-0 btn-tactile ${card.iconBoxClass}`}
                  >
                    {card.icon}
                  </div>
                </div>

                {isLiveLiquidity ? (
                  <div className="my-1 sm:my-1.5 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div
                        className={`text-lg sm:text-2xl font-black tracking-tight tabular-nums ${card.valueColorClass}`}
                      >
                        {card.valueBn}
                      </div>
                      <div
                        data-testid="live-liquidity-formula-badge"
                        className="inline-block px-2 py-0.5 rounded-md bg-emerald-50/95 border border-emerald-200 text-[10px] sm:text-[11px] font-extrabold text-emerald-900 tabular-nums max-w-full truncate"
                      >
                        {card.formulaBadgeBn}
                      </div>
                    </div>

                    {/* 3-Pillar Real-Time Cash-in-Hand Mini Grid + Liquidity Ratio Bar */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px] tabular-nums w-full min-w-0">
                      <div className="min-w-0 px-2 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200/80">
                        <span className="block text-slate-600 font-semibold truncate">
                          {isEn ? 'Today Cash In' : 'আজ আদায় (+)'}
                        </span>
                        <span className="block font-black text-emerald-800 truncate">
                          {formatCurrencyBn(metrics.todayCashIn)}
                        </span>
                      </div>
                      <div className="min-w-0 px-2 py-1 rounded-lg bg-rose-50/80 border border-rose-200/80">
                        <span className="block text-slate-600 font-semibold truncate">
                          {isEn ? 'Today Expense' : 'আজ খরচ (-)'}
                        </span>
                        <span className="block font-black text-rose-700 truncate">
                          {formatCurrencyBn(metrics.todayExpense)}
                        </span>
                      </div>
                      <div className="min-w-0 px-2 py-1 rounded-lg bg-teal-50/90 border border-teal-200/90">
                        <span className="block text-slate-600 font-semibold truncate">
                          {isEn ? 'Season Net' : 'সিজন নিট ক্যাশ'}
                        </span>
                        <span
                          className={`block font-black truncate ${
                            liquidity.seasonalNetCashInHand < 0
                              ? 'text-rose-700'
                              : 'text-teal-900'
                          }`}
                        >
                          {formatSignedCurrency(liquidity.seasonalNetCashInHand)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`my-1 sm:my-2 text-base sm:text-2xl font-black tracking-tight tabular-nums ${card.valueColorClass}`}
                  >
                    {card.valueBn}
                  </div>
                )}
              </div>

              <div className="relative z-10 pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold text-slate-800">
                <span className="truncate tabular-nums">{card.metaLineBn}</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 group-hover:from-orange-600 group-hover:to-amber-600 group-hover:border-orange-500 text-[9px] sm:text-[10px] font-extrabold text-orange-800 group-hover:text-white transition-all shrink-0 shadow-2xs">
                  <span>{isEn ? 'Report' : 'রিপোর্ট'}</span>
                  <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Today vs Yesterday Live Comparison + 1-Click Executive Daily Closing Bar */}
      <Card
        variant="default"
        padding="sm"
        data-testid="executive-daily-closing-bar"
        className="w-full min-w-0 max-w-full overflow-hidden flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 sm:gap-3.5 sm:p-4 bg-gradient-to-r from-white via-slate-50/60 to-orange-50/30 border-slate-200/95"
      >
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between xl:justify-start gap-2 sm:gap-3.5 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 text-white shadow-xs shrink-0">
              <Calculator className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-black text-slate-950 truncate">
                {isEn
                  ? 'Today vs. Yesterday Live Sales & 1-Click Daily Closing'
                  : 'আজ ও গতকালের লাইভ তুলনা এবং ১-ক্লিক ডেইলি ক্লোজিং সামারি'}
              </h3>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-600 truncate">
                {isEn
                  ? 'Send daily closing summary on WhatsApp or print the live cash sheet'
                  : 'মালিকের হোয়াটসঅ্যাপে আজকের ক্লোজিং হিসাব পাঠান অথবা ক্লোজিং শিট প্রিন্ট করুন'}
              </p>
            </div>
          </div>

          {/* 1-Click Daily Closing Action Buttons (WhatsApp Report + Printable Closing Sheet) */}
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              data-testid="copy-daily-closing-whatsapp-btn"
              onClick={handleCopyDailyClosingWhatsApp}
              className="btn-tactile inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-extrabold cursor-pointer shadow-2xs transition-colors truncate"
              title={
                isEn
                  ? 'Copy 1-Click Daily Closing Report for WhatsApp'
                  : '১-ক্লিকে আজকের সম্পূর্ণ ক্লোজিং সামারি হোয়াটসঅ্যাপ মেসেজ হিসেবে কপি করুন'
              }
            >
              {copiedClosingWa ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                  <span className="truncate">{isEn ? 'Closing Copied!' : 'ক্লোজিং কপি হয়েছে!'}</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                  <span className="truncate">{isEn ? 'WhatsApp Closing' : 'হোয়াটসঅ্যাপ ক্লোজিং'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="open-daily-closing-report-btn"
              onClick={() => onSelectKpi('LIVE_LIQUIDITY')}
              className="btn-tactile inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 text-[10px] sm:text-xs font-extrabold cursor-pointer shadow-2xs transition-colors truncate"
              title={
                isEn
                  ? 'Open Printable Live Liquidity & Daily Closing Sheet'
                  : 'প্রিন্ট-রেডি লাইভ লিকুইডিটি ও ডেইলি ক্লোজিং শিট খুলুন'
              }
            >
              <Printer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{isEn ? 'Closing Sheet' : 'ক্লোজিং শিট'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm w-full min-w-0 shrink-0">
          <div className="bg-white border border-orange-200 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs">
            <span className="block text-[10px] sm:text-[11px] font-bold text-slate-700">
              {isEn ? 'Today Bricks Sold' : 'আজকের ইট বিক্রি'}
            </span>
            <span className="font-black text-orange-700 tabular-nums text-xs sm:text-sm">
              {formatBn(metrics.todayBricksSold)} {isEn ? 'pcs' : 'পিস'}
            </span>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs">
            <span className="block text-[10px] sm:text-[11px] font-bold text-slate-700">
              {isEn ? 'Today Memo Bill' : 'আজকের মেমো বিল'}
            </span>
            <span className="font-black text-emerald-700 tabular-nums text-xs sm:text-sm">
              {formatCurrencyBn(metrics.todaySalesAmount)} (
              {isEn
                ? `${formatBn(metrics.todaySalesMemoCount)}`
                : `${formatBn(metrics.todaySalesMemoCount)}টি`}
              )
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs">
            <span className="block text-[10px] sm:text-[11px] font-bold text-slate-700">
              {isEn ? 'Yesterday Bricks Sold' : 'গতকালের ইট বিক্রি'}
            </span>
            <span className="font-black text-slate-950 tabular-nums text-xs sm:text-sm">
              {formatBn(metrics.yesterdayBricksSold)} {isEn ? 'pcs' : 'পিস'}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs">
            <span className="block text-[10px] sm:text-[11px] font-bold text-slate-700">
              {isEn ? 'Yesterday Memo Bill' : 'গতকালের মেমো বিল'}
            </span>
            <span className="font-black text-slate-950 tabular-nums text-xs sm:text-sm">
              {formatCurrencyBn(metrics.yesterdaySalesAmount)} (
              {isEn
                ? `${formatBn(metrics.yesterdaySalesMemoCount)}`
                : `${formatBn(metrics.yesterdaySalesMemoCount)}টি`}
              )
            </span>
          </div>
        </div>
      </Card>
    </section>
  );
};

