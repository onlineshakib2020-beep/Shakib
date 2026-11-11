import React from 'react';
import {
  ArrowUpRight,
  Banknote,
  Calculator,
  FileText,
  Layers,
  Receipt,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import type { DashboardMetrics, KpiCardId } from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';

interface KpiCardsStripProps {
  metrics: DashboardMetrics;
  activeKpi: KpiCardId | null;
  onSelectKpi: (id: KpiCardId) => void;
}

export const KpiCardsStrip: React.FC<KpiCardsStripProps> = ({
  metrics,
  activeKpi,
  onSelectKpi,
}) => {
  const cards: Array<{
    id: KpiCardId;
    titleBn: string;
    subtitleBn: string;
    valueBn: string;
    metaLineBn: string;
    icon: React.ReactNode;
    iconBoxClass: string;
    valueColorClass: string;
    borderHoverClass: string;
  }> = [
    {
      id: 'TOTAL_BRICKS_SOLD',
      titleBn: 'মোট ইট বিক্রয় (Total Sales)',
      subtitleBn: 'সিজনের সর্বমোট বিক্রি ও মেমো বিল',
      valueBn: formatCurrencyBn(metrics.totalBrickSalesAmountAllTime),
      metaLineBn: `মোট ইট ${formatBn(metrics.totalBricksSoldAllTime)} · আজ ${formatCurrencyBn(metrics.todaySalesAmount)}`,
      icon: <Layers className="w-5 h-5 text-orange-700" />,
      iconBoxClass: 'bg-orange-50 border border-orange-200/70',
      valueColorClass: 'text-slate-900',
      borderHoverClass: 'hover:border-orange-600/70',
    },
    {
      id: 'TODAY_COLLECTION',
      titleBn: 'আজকের আদায় (জমা)',
      subtitleBn: 'আজকের নগদ ও অনলাইন প্রাপ্তি',
      valueBn: formatCurrencyBn(metrics.todayCashIn),
      metaLineBn: `আজকের মেমো ${formatBn(metrics.todaySalesMemoCount)}টি · ভেরিফায়েড ক্যাশ ইন`,
      icon: <Receipt className="w-5 h-5 text-emerald-700" />,
      iconBoxClass: 'bg-emerald-50 border border-emerald-200/70',
      valueColorClass: 'text-emerald-700',
      borderHoverClass: 'hover:border-emerald-600/70',
    },
    {
      id: 'TOTAL_COLLECTION',
      titleBn: 'মোট আদায় (ক্যাশ ইন)',
      subtitleBn: 'সিজনের সর্বমোট সংগৃহীত জমা',
      valueBn: formatCurrencyBn(metrics.totalCashIn),
      metaLineBn: `মেমো জমা ও বকেয়া আদায় মিলিয়ে মোট প্রাপ্তি`,
      icon: <Banknote className="w-5 h-5 text-emerald-700" />,
      iconBoxClass: 'bg-emerald-50 border border-emerald-200/70',
      valueColorClass: 'text-emerald-800',
      borderHoverClass: 'hover:border-emerald-600/70',
    },
    {
      id: 'TOTAL_EXPENSE',
      titleBn: 'মোট খরচ (ক্যাশ আউট)',
      subtitleBn: 'কয়লা, ডিজেল, মাটি ও লেবার ব্যয়',
      valueBn: formatCurrencyBn(metrics.totalExpense),
      metaLineBn: `আজকের খরচ ${formatCurrencyBn(metrics.todayExpense)} · ভাটা পরিচালনা`,
      icon: <TrendingDown className="w-5 h-5 text-rose-700" />,
      iconBoxClass: 'bg-rose-50 border border-rose-200/70',
      valueColorClass: 'text-rose-700',
      borderHoverClass: 'hover:border-rose-600/70',
    },
    {
      id: 'CASH_BALANCE',
      titleBn: 'বর্তমান ক্যাশ ব্যালেন্স',
      subtitleBn: 'প্রারম্ভিক ক্যাশ + মোট জমা - খরচ',
      valueBn: formatCurrencyBn(metrics.currentCashBalance),
      metaLineBn: `প্রারম্ভিক ৳${formatBn(metrics.openingBalance)} সহ নগদ তহবিল`,
      icon: <Wallet className="w-5 h-5 text-slate-800" />,
      iconBoxClass: 'bg-slate-100 border border-slate-200',
      valueColorClass: 'text-slate-900',
      borderHoverClass: 'hover:border-slate-600/70',
    },
    {
      id: 'TOTAL_DUE',
      titleBn: 'মোট পাওনা (বকেয়া)',
      subtitleBn: 'ক্রেতাদের কাছে বাকি খাতা',
      valueBn: formatCurrencyBn(metrics.totalCustomerDue),
      metaLineBn: `মোট ${formatBn(metrics.dueCustomerCount)} জন ক্রেতার কাছে বকেয়া`,
      icon: <FileText className="w-5 h-5 text-rose-700" />,
      iconBoxClass: 'bg-rose-50 border border-rose-200/70',
      valueColorClass: 'text-rose-700',
      borderHoverClass: 'hover:border-rose-600/70',
    },
  ];

  return (
    <section aria-label="ভাটার প্রধান আর্থিক সূচক" className="space-y-4">
      {/* 6 Clickable KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        {cards.map((card) => {
          const isSelected = activeKpi === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectKpi(card.id)}
              aria-label={`${card.titleBn} বিস্তারিত প্রিন্ট রিপোর্ট দেখুন`}
              className={`group text-left bg-white rounded-xl p-4 border transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-orange-700 ring-2 ring-orange-700/15'
                  : `border-slate-200/90 ${card.borderHoverClass}`
              }`}
            >
              <div className="flex items-start justify-between gap-2.5 mb-2.5">
                <div className="min-w-0">
                  <h2 className="text-xs font-bold text-slate-800 truncate">
                    {card.titleBn}
                  </h2>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {card.subtitleBn}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-lg transition-transform group-hover:scale-105 shrink-0 ${card.iconBoxClass}`}
                >
                  {card.icon}
                </div>
              </div>

              <div
                className={`my-2 text-xl font-bold tracking-tight tabular-nums ${card.valueColorClass}`}
              >
                {card.valueBn}
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] text-slate-600">
                <span className="truncate tabular-nums">{card.metaLineBn}</span>
                <span className="inline-flex items-center font-semibold text-orange-700 group-hover:translate-x-0.5 transition-transform shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Today vs Yesterday Live Comparison Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-5 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200/60 text-orange-700 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              আজ ও গতকালের ইট বিক্রির লাইভ তুলনামূলক হিসাব
            </h3>
            <p className="text-xs text-slate-500">
              উপরের যেকোনো কার্ডে ক্লিক করলে প্রিন্ট-রেডি বিস্তারিত খতিয়ান রিপোর্ট ওপেন হবে
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-8 text-sm">
          <div>
            <span className="block text-xs text-slate-500">আজকের ইট বিক্রি</span>
            <span className="font-bold text-orange-700 tabular-nums">
              {formatBn(metrics.todayBricksSold)} পিস
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">আজকের মেমো বিল</span>
            <span className="font-bold text-emerald-700 tabular-nums">
              {formatCurrencyBn(metrics.todaySalesAmount)} ({formatBn(metrics.todaySalesMemoCount)}টি)
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">গতকালের ইট বিক্রি</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {formatBn(metrics.yesterdayBricksSold)} পিস
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">গতকালের মেমো বিল</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {formatCurrencyBn(metrics.yesterdaySalesAmount)} ({formatBn(metrics.yesterdaySalesMemoCount)}টি)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
