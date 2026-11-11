import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import type {
  CashTransaction,
  DashboardMetrics,
  KpiCardId,
  SalesMemo,
} from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';

interface KpiReportModalProps {
  kpiId: KpiCardId | null;
  onClose: () => void;
  metrics: DashboardMetrics;
  salesMemos: SalesMemo[];
  cashTransactions: CashTransaction[];
}

export const KpiReportModal: React.FC<KpiReportModalProps> = ({
  kpiId,
  onClose,
  metrics,
  salesMemos,
  cashTransactions,
}) => {
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY'>('ALL');

  if (!kpiId) return null;

  const titles: Record<KpiCardId, { titleBn: string; descBn: string }> = {
    TOTAL_BRICKS_SOLD: {
      titleBn: 'মোট ইট বিক্রির বিস্তারিত খতিয়ান রিপোর্ট',
      descBn: 'সকল ডিজিটাল ক্যাশ মেমো, ইটের গ্রেড, পরিমাণ, দর এবং মোট বিক্রয় হিসাব',
    },
    TODAY_COLLECTION: {
      titleBn: 'আজকের ক্যাশ আদায় (Today Collection) রিপোর্ট',
      descBn: 'আজকের দিনে ইট বিক্রি ও বাকি আদায় থেকে সংগৃহীত মোট জমার খতিয়ান',
    },
    TOTAL_COLLECTION: {
      titleBn: 'মোট আদায় (Total Cash In) ও সংগ্রহের বিস্তারিত খতিয়ান',
      descBn: 'ইট বিক্রি ও ক্রেতাদের বকেয়া পরিশোধ থেকে ক্যাশ বুকে প্রাপ্ত মোট নগদ জমা',
    },
    TOTAL_EXPENSE: {
      titleBn: 'ভাটার মোট খরচ (Total Cash Out) ও ব্যয়ের বিবরণী',
      descBn: 'কয়লা ক্রয়, ভেকু ডিজেল, মাটি ক্রয়, বিদ্যুৎ এবং দিনমজুর/সর্দার পেমেন্টের সম্পূর্ণ হিসাব',
    },
    CASH_BALANCE: {
      titleBn: 'বর্তমান ক্যাশ ব্যালেন্স ও ক্যাশ বুক বিবরণী',
      descBn: 'প্রারম্ভিক ক্যাশ + মোট প্রাপ্তি - মোট ব্যয়ের সমাপনী ক্যাশ ব্যালেন্স শিট',
    },
    TOTAL_DUE: {
      titleBn: 'বাকি খাতা — ক্রেতাদের কাছে মোট বকেয়া পাওনার বিস্তারিত তালিকা',
      descBn: 'অপরিশোধিত ও আংশিক পরিশোধিত মেমোসমূহের ক্রেতাভিত্তিক বকেয়া হিসাব',
    },
  };

  const matchesDate = (dateStr: string) => {
    if (dateFilter === 'TODAY') return dateStr === metrics.todayDate;
    if (dateFilter === 'YESTERDAY') return dateStr === metrics.yesterdayDate;
    return true;
  };

  const isMemoView = kpiId === 'TOTAL_BRICKS_SOLD' || kpiId === 'TOTAL_DUE';

  const renderTableContent = () => {
    if (isMemoView) {
      const baseMemos =
        kpiId === 'TOTAL_DUE'
          ? salesMemos.filter((m) => m.dueAmount > 0)
          : salesMemos;
      const filteredMemos = baseMemos.filter((m) =>
        dateFilter === 'ALL' ? true : matchesDate(m.date)
      );

      const sumTotal = filteredMemos.reduce((s, m) => s + m.totalAmount, 0);
      const sumPaid = filteredMemos.reduce((s, m) => s + m.paidAmount, 0);
      const sumDue = filteredMemos.reduce((s, m) => s + m.dueAmount, 0);

      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-slate-700">
                <th className="py-2.5 px-3 font-semibold">মেমো নং ও তারিখ</th>
                <th className="py-2.5 px-3 font-semibold">ক্রেতার নাম ও মোবাইল</th>
                <th className="py-2.5 px-3 font-semibold">মালের বিবরণ ও পরিমাণ</th>
                <th className="py-2.5 px-3 font-semibold text-right">মোট বিল</th>
                <th className="py-2.5 px-3 font-semibold text-right">নগদ জমা</th>
                <th className="py-2.5 px-3 font-semibold text-right">বাকি পাওনা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredMemos.map((m) => {
                const itemSummary =
                  m.items && m.items.length > 0
                    ? m.items
                        .map(
                          (it) =>
                            `${it.gradeName} (${formatBn(it.quantity)} × ৳${formatBn(it.rate)} = ${formatCurrencyBn(it.lineTotal)})`
                        )
                        .join(', ')
                    : `${m.gradeName || 'ইট'} (${formatBn(m.quantity || 0)} × ৳${formatBn(m.rate || 0)})`;

                return (
                  <tr key={m.id} className="hover:bg-stone-50/80">
                    <td className="py-2.5 px-3 tabular-nums">
                      <div className="font-semibold text-slate-900">{m.memoNo}</div>
                      <div className="text-xs text-slate-500">{m.date}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{m.customerName}</div>
                      <div className="text-xs text-slate-500">
                        {m.customerPhone} · {m.customerAddress}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-800 max-w-xs">{itemSummary}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                      {formatCurrencyBn(m.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-medium tabular-nums">
                      {formatCurrencyBn(m.paidAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-700 font-semibold tabular-nums">
                      {formatCurrencyBn(m.dueAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-stone-100 font-bold text-slate-900 border-t-2 border-stone-300">
                <td colSpan={3} className="py-3 px-3 text-right">
                  সর্বমোট ({formatBn(filteredMemos.length)}টি মেমো):
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {formatCurrencyBn(sumTotal)}
                </td>
                <td className="py-3 px-3 text-right text-emerald-800 tabular-nums">
                  {formatCurrencyBn(sumPaid)}
                </td>
                <td className="py-3 px-3 text-right text-rose-800 tabular-nums">
                  {formatCurrencyBn(sumDue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      );
    }

    // Cash transaction views: TODAY_COLLECTION, TOTAL_COLLECTION, TOTAL_EXPENSE, CASH_BALANCE
    const filteredTx = cashTransactions.filter((t) => {
      if (kpiId === 'TODAY_COLLECTION') {
        return t.date === metrics.todayDate && t.type === 'IN';
      }
      if (!matchesDate(t.date)) return false;
      if (kpiId === 'TOTAL_COLLECTION') return t.type === 'IN';
      if (kpiId === 'TOTAL_EXPENSE') return t.type === 'OUT';
      return true; // CASH_BALANCE shows both
    });

    const sumIn = filteredTx
      .filter((t) => t.type === 'IN')
      .reduce((s, t) => s + t.amount, 0);
    const sumOut = filteredTx
      .filter((t) => t.type === 'OUT')
      .reduce((s, t) => s + t.amount, 0);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-slate-700">
              <th className="py-2.5 px-3 font-semibold">তারিখ</th>
              <th className="py-2.5 px-3 font-semibold">ধরন</th>
              <th className="py-2.5 px-3 font-semibold">খাত (Category)</th>
              <th className="py-2.5 px-3 font-semibold">বিবরণ</th>
              <th className="py-2.5 px-3 font-semibold">মাধ্যম</th>
              <th className="py-2.5 px-3 font-semibold text-right">টাকার পরিমাণ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {filteredTx.map((t) => (
              <tr key={t.id} className="hover:bg-stone-50/80">
                <td className="py-2.5 px-3 tabular-nums text-slate-700">{t.date}</td>
                <td className="py-2.5 px-3 font-medium">
                  {t.type === 'IN' ? (
                    <span className="text-emerald-700">জমা (Cash In)</span>
                  ) : (
                    <span className="text-rose-700">খরচ (Cash Out)</span>
                  )}
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-900">{t.category}</td>
                <td className="py-2.5 px-3 text-slate-700">{t.description}</td>
                <td className="py-2.5 px-3 text-slate-600">{t.paymentMethod}</td>
                <td
                  className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                    t.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {t.type === 'IN' ? '+' : '-'}
                  {formatCurrencyBn(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-stone-100 font-bold text-slate-900 border-t-2 border-stone-300">
              <td colSpan={5} className="py-3 px-3 text-right">
                {kpiId === 'TODAY_COLLECTION' || kpiId === 'TOTAL_COLLECTION'
                  ? 'মোট ক্যাশ জমা:'
                  : kpiId === 'TOTAL_EXPENSE'
                  ? 'মোট ক্যাশ খরচ:'
                  : `নিট ক্যাশ ব্যালেন্স (জমা ${formatCurrencyBn(sumIn)} - খরচ ${formatCurrencyBn(
                      sumOut
                    )}):`}
              </td>
              <td className="py-3 px-3 text-right tabular-nums">
                {kpiId === 'TODAY_COLLECTION' || kpiId === 'TOTAL_COLLECTION'
                  ? formatCurrencyBn(sumIn)
                  : kpiId === 'TOTAL_EXPENSE'
                  ? formatCurrencyBn(sumOut)
                  : formatCurrencyBn(sumIn - sumOut)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kpi-report-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="printable-area"
        className="bg-white border border-stone-200 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden"
      >
        {/* Top Action Bar (Hidden in Print) */}
        <div className="no-print px-6 py-4 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">তারিখ ফিল্টার:</span>
            <div className="inline-flex rounded-lg bg-stone-200/80 p-1">
              {(['ALL', 'TODAY', 'YESTERDAY'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateFilter(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    dateFilter === mode
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode === 'ALL'
                    ? 'সকল তারিখ'
                    : mode === 'TODAY'
                    ? 'আজকের হিসাব'
                    : 'গতকালের হিসাব'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              প্রিন্ট রিপোর্ট
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="রিপোর্ট মডাল বন্ধ করুন"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-white border border-stone-300 text-slate-700 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              বন্ধ করুন
            </button>
          </div>
        </div>

        {/* Printable Official Letterhead & Report Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="text-center border-b-2 border-stone-800 pb-4">
            <p className="text-xs font-medium text-slate-600">বিসমিল্লাহির রাহমানির রাহিম</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              সৌদিয়া ট্রেডার্স (SBL মিষ্টি মাটির ইট)
            </h1>
            <p className="text-sm text-slate-700">
              বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা · প্রোঃ মোঃ কামরুল ইসলাম সাহেব (০১৯১৩-৬৭৮০১০) · পরিচালনায়ঃ সাকিব হোসেন (০১৭২৮-২৮৭০১৮)
            </p>
            <h2
              id="kpi-report-modal-title"
              className="text-base font-bold text-amber-900 mt-2"
            >
              {titles[kpiId].titleBn}
            </h2>
            <p className="text-xs text-slate-500">{titles[kpiId].descBn}</p>
          </div>

          {renderTableContent()}

          <div className="pt-8 flex items-center justify-between text-xs text-slate-600 border-t border-stone-200">
            <div>রিপোর্ট প্রস্তুতের তারিখ: {metrics.todayDate}</div>
            <div>হিসাবরক্ষক / ম্যানেজার স্বাক্ষর</div>
            <div>প্রোপ্রাইটর (মোঃ কামরুল ইসলাম / সাকিব হোসেন)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
