import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Download,
  Factory,
  FileSpreadsheet,
  FileText,
  Flame,
  Filter,
  Layers,
  Lock,
  PackageCheck,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Truck,
  Unlock,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  KilnDatabaseState,
  KilnSeason,
  LanguageMode,
} from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';
import {
  type ArchiveTransactionType,
  computeSeasonVarianceComparison,
  computeYearlyOrSeasonalReport,
  getAvailableHistoricalYears,
  getDefaultKilnSeasons,
  getDefaultKilnUnits,
  type YearlySeasonalFilter,
} from '../utils/yearlySeasonalLogic';

interface YearlySeasonalAnalyticsTabProps {
  lang?: LanguageMode;
  dbState: KilnDatabaseState;
  onSaveSeason: (payload: {
    id?: string;
    nameBn: string;
    nameEn?: string;
    startDate: string;
    endDate: string;
    kilnIds: string[];
    damageOrAdjustmentBricks?: number;
    openingStockOverride?: number | '';
    openingCashOverride?: number | '';
    reasonBn?: string;
  }) => Promise<void>;
  onCloseSeason: (
    seasonId: string,
    payload: { closingNoteBn: string; damageOrAdjustmentBricks?: number }
  ) => Promise<void>;
  onReopenSeason: (
    seasonId: string,
    payload: { reasonBn: string; damageOrAdjustmentBricks?: number }
  ) => Promise<void>;
}

type AnalyticsSubView =
  | 'OVERVIEW_12M'
  | 'SEASON_MANAGER'
  | 'OPENING_CLOSING'
  | 'HISTORICAL_ARCHIVE';

type ChartSeriesMode =
  | 'SALES_COLLECTION_EXPENSE'
  | 'PRODUCTION_BY_MONTH'
  | 'FUEL_AND_WOOD_USAGE'
  | 'COLLECTION_TREND'
  | 'RECEIVABLES_TREND'
  | 'GRADE_AND_EXPENSE';

export const YearlySeasonalAnalyticsTab: React.FC<YearlySeasonalAnalyticsTabProps> = ({
  lang = 'bn',
  dbState,
  onSaveSeason,
  onCloseSeason,
  onReopenSeason,
}) => {
  const isEn = lang === 'en';
  const kilnUnits =
    Array.isArray(dbState.kilnUnits) && dbState.kilnUnits.length > 0
      ? dbState.kilnUnits
      : getDefaultKilnUnits();
  const kilnSeasons =
    Array.isArray(dbState.kilnSeasons) && dbState.kilnSeasons.length > 0
      ? dbState.kilnSeasons
      : getDefaultKilnSeasons();
  const availableYears = useMemo(
    () => getAvailableHistoricalYears(dbState),
    [dbState]
  );

  // Primary Filter State
  const [filterMode, setFilterMode] = useState<'YEAR' | 'SEASON' | 'CUSTOM_RANGE'>('YEAR');
  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears.includes(2026) ? 2026 : availableYears[0] || 2026
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    kilnSeasons[0]?.id || 'season-2026-2027'
  );
  const [customStartDate, setCustomStartDate] = useState<string>('2026-01-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-12-31');
  const [selectedKilnId, setSelectedKilnId] = useState<string>('ALL');

  // Sub-navigation & Chart Mode
  const [subView, setSubView] = useState<AnalyticsSubView>('OVERVIEW_12M');
  const [chartMode, setChartMode] = useState<ChartSeriesMode>('SALES_COLLECTION_EXPENSE');

  // Historical Archive Filters
  const [archiveCustomerQuery, setArchiveCustomerQuery] = useState('');
  const [archiveMemoQuery, setArchiveMemoQuery] = useState('');
  const [archiveTxType, setArchiveTxType] = useState<ArchiveTransactionType>('ALL');

  // Season Comparison State
  const [compareSeasonAId, setCompareSeasonAId] = useState<string>(
    kilnSeasons[0]?.id || 'season-2026-2027'
  );
  const [compareSeasonBId, setCompareSeasonBId] = useState<string>(
    kilnSeasons[1]?.id || kilnSeasons[0]?.id || 'season-2025-2026'
  );

  // Create / Edit Season Form State
  const [editingSeasonId, setEditingSeasonId] = useState<string>('');
  const [seasonNameInput, setSeasonNameInput] = useState('');
  const [seasonStartInput, setSeasonStartInput] = useState('2026-10-01');
  const [seasonEndInput, setSeasonEndInput] = useState('2027-06-30');
  const [seasonKilnsInput, setSeasonKilnsInput] = useState<string[]>(['sbl-1', 'sbl-2']);
  const [seasonDamageInput, setSeasonDamageInput] = useState('0');
  const [seasonOpeningStockInput, setSeasonOpeningStockInput] = useState('');
  const [seasonOpeningCashInput, setSeasonOpeningCashInput] = useState('');
  const [seasonReasonInput, setSeasonReasonInput] = useState('');
  const [savingSeason, setSavingSeason] = useState(false);

  // Close / Reopen Season Confirmation Modal State
  const [closeModalSeason, setCloseModalSeason] = useState<KilnSeason | null>(null);
  const [closingNoteInput, setClosingNoteInput] = useState(
    'সকল হিসাব, ক্যাশ, স্টক ও বকেয়া পাওনা যাচাই করে সিজন সমাপনী নিশ্চিত করা হলো।'
  );
  const [closingDamageInput, setClosingDamageInput] = useState('0');

  const [reopenModalSeason, setReopenModalSeason] = useState<KilnSeason | null>(null);
  const [reopenReasonInput, setReopenReasonInput] = useState('');
  const [reopenDamageInput, setReopenDamageInput] = useState('0');

  // Printable Report Modal State
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);

  // Compute Main Report
  const activeFilter: YearlySeasonalFilter = useMemo(
    () => ({
      mode: filterMode,
      year: selectedYear,
      seasonId: selectedSeasonId,
      startDate: customStartDate,
      endDate: customEndDate,
      kilnId: selectedKilnId,
      customerQuery: archiveCustomerQuery,
      memoNoQuery: archiveMemoQuery,
      txTypeFilter: archiveTxType,
    }),
    [
      filterMode,
      selectedYear,
      selectedSeasonId,
      customStartDate,
      customEndDate,
      selectedKilnId,
      archiveCustomerQuery,
      archiveMemoQuery,
      archiveTxType,
    ]
  );

  const report = useMemo(
    () => computeYearlyOrSeasonalReport(dbState, activeFilter),
    [dbState, activeFilter]
  );

  // Compute Season Comparison Reports
  const compareReportA = useMemo(
    () =>
      computeYearlyOrSeasonalReport(dbState, {
        mode: 'SEASON',
        seasonId: compareSeasonAId,
        kilnId: selectedKilnId,
      }),
    [dbState, compareSeasonAId, selectedKilnId]
  );
  const compareReportB = useMemo(
    () =>
      computeYearlyOrSeasonalReport(dbState, {
        mode: 'SEASON',
        seasonId: compareSeasonBId,
        kilnId: selectedKilnId,
      }),
    [dbState, compareSeasonBId, selectedKilnId]
  );

  const seasonComparison = useMemo(
    () => computeSeasonVarianceComparison(compareReportA, compareReportB),
    [compareReportA, compareReportB]
  );

  const handleExportSeasonComparisonCsv = () => {
    const headers = [
      'হিসাবের বিভাগ (Category)',
      'হিসাবের বিবরণ (Metric)',
      `${compareReportA.periodTitleBn} (${compareReportA.startDate} - ${compareReportA.endDate})`,
      `${compareReportB.periodTitleBn} (${compareReportB.startDate} - ${compareReportB.endDate})`,
      'পার্থক্য (১ম - ২য় সিজন)',
      'শতকরা পরিবর্তন (%)',
    ];
    const rows = seasonComparison.rows.map((r) => [
      r.group,
      `"${r.labelBn.replace(/"/g, '""')}"`,
      r.metric.seasonAValue,
      r.metric.seasonBValue,
      r.metric.diffAminusB,
      `${r.metric.variancePct}%`,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brickflow-season-comparison-${compareSeasonAId}-vs-${compareSeasonBId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart Scaling
  const maxFinancialMonthVal = Math.max(
    1000,
    ...report.monthlyBreakdown.map((m) =>
      Math.max(
        m.salesAmount,
        m.actualCollectionAmount,
        m.expenseAmount,
        m.cumulativeReceivables
      )
    )
  );
  const maxProductionMonthVal = Math.max(
    1000,
    ...report.monthlyBreakdown.map((m) =>
      Math.max(
        m.rawBricksCut,
        m.chulliLoadedBricks,
        m.poraiFiredBricks,
        m.pakaUnloadedBricks,
        m.bricksSoldQty
      )
    )
  );
  const maxWoodMaundMonthVal = Math.max(
    10,
    ...report.monthlyBreakdown.map((m) => m.woodFuelMaund)
  );
  const maxFuelCostMonthVal = Math.max(
    1000,
    ...report.monthlyBreakdown.map((m) =>
      Math.max(m.fuelAndCoalExpenseAmount, m.woodFuelBillAmount)
    )
  );

  // Export Monthly & Summary Report as CSV (Excel compatible UTF-8 BOM)
  const handleExportMonthlyCsv = () => {
    const headers = [
      'মাস (Month)',
      'মেমো সংখ্যা (Memos)',
      'মোট বিক্রি বিল (Sales Tk)',
      'প্রকৃত নগদ আদায় (Actual Collection Tk)',
      'অন্যান্য জমা (Other Income Tk)',
      'মোট খরচ (Expense Tk)',
      'নিট ক্যাশ প্রবাহ (Net Cash Tk)',
      'কাঁচা ইট কাটা (Raw Bricks)',
      'ভ্যান লোড (Loaded Bricks)',
      'পোড়াই ইট (Fired Bricks)',
      'পাকা ইট আনলোড (Unloaded Bricks)',
      'ইট বিক্রি পিস (Bricks Sold)',
      'ইট ডেলিভারি পিস (Bricks Delivered)',
      'মাটি ক্রয় খরচ (Soil Expense Tk)',
      'লেবার ও সর্দার পেমেন্ট (Labor Paid Tk)',
      'মাস শেষে বকেয়া পাওনা (Closing Receivables Tk)',
    ];
    const rows = report.monthlyBreakdown.map((m) => [
      `"${m.monthLabelBn}"`,
      m.memoCount,
      m.salesAmount,
      m.actualCollectionAmount,
      m.otherIncomeAmount,
      m.expenseAmount,
      m.netCashMovement,
      m.rawBricksCut,
      m.chulliLoadedBricks,
      m.poraiFiredBricks,
      m.pakaUnloadedBricks,
      m.bricksSoldQty,
      m.bricksDeliveredQty,
      m.soilExpenseAmount,
      m.laborPaidAmount,
      m.cumulativeReceivables,
    ]);
    rows.push([
      '"সর্বমোট (Total)"',
      report.totalMemoCount,
      report.totalSalesAmount,
      report.totalActualCollections,
      report.otherIncome,
      report.totalExpenses,
      report.netCashMovement,
      report.rawBricksCut,
      report.chulliLoadedBricks,
      report.poraiFiredBricks,
      report.pakaUnloadedBricks,
      report.totalBricksSoldQty,
      report.totalBricksDeliveredQty,
      report.soilAndRawMaterialAmount,
      report.laborPaidAmount,
      report.totalOutstandingReceivables,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brickflow-yearly-seasonal-summary-${report.startDate}-to-${report.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Detailed Archive Ledger as CSV
  const handleExportArchiveCsv = () => {
    const headers = [
      'তারিখ (Date)',
      'লেনদেনের ধরন (Type)',
      'ভাটা (Kiln)',
      'মেমো নং (Memo No)',
      'ক্রেতা / খাত (Party/Category)',
      'মোবাইল (Phone)',
      'বিবরণ (Description)',
      'ইট সংখ্যা পিস (Brick Qty)',
      'মোট বিল / প্রদেয় (Billed/Payable Tk)',
      'নগদ জমা (Cash In Tk)',
      'নগদ খরচ / পরিশোধ (Cash Out Tk)',
      'পেমেন্ট মাধ্যম (Method)',
    ];
    const rows = report.archiveEntries.map((e) => [
      e.date,
      `"${e.txTypeLabelBn}"`,
      `"${e.kilnNameBn}"`,
      `"${e.memoNo || '—'}"`,
      `"${(e.partyName || '').replace(/"/g, '""')}"`,
      `"${e.partyPhone || '—'}"`,
      `"${(e.descriptionBn || '').replace(/"/g, '""')}"`,
      e.quantityPieces || 0,
      e.billedOrPayableAmount,
      e.cashInAmount,
      e.cashOutAmount,
      `"${e.paymentMethod || '—'}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brickflow-archive-ledger-${report.startDate}-to-${report.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSeasonFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonNameInput.trim() || !seasonStartInput || !seasonEndInput) return;
    setSavingSeason(true);
    try {
      await onSaveSeason({
        id: editingSeasonId || undefined,
        nameBn: seasonNameInput.trim(),
        startDate: seasonStartInput,
        endDate: seasonEndInput,
        kilnIds: seasonKilnsInput.length > 0 ? seasonKilnsInput : ['sbl-1'],
        damageOrAdjustmentBricks: Math.max(0, Number(seasonDamageInput) || 0),
        openingStockOverride:
          seasonOpeningStockInput.trim() !== ''
            ? Number(seasonOpeningStockInput)
            : '',
        openingCashOverride:
          seasonOpeningCashInput.trim() !== ''
            ? Number(seasonOpeningCashInput)
            : '',
        reasonBn:
          seasonReasonInput.trim() ||
          (editingSeasonId ? 'সিজন তথ্য হালনাগাদ' : 'নতুন সিজন তৈরি'),
      });
      setEditingSeasonId('');
      setSeasonNameInput('');
      setSeasonReasonInput('');
    } finally {
      setSavingSeason(false);
    }
  };

  const handleLoadSeasonForEdit = (s: KilnSeason) => {
    setEditingSeasonId(s.id);
    setSeasonNameInput(s.nameBn);
    setSeasonStartInput(s.startDate);
    setSeasonEndInput(s.endDate);
    setSeasonKilnsInput(s.kilnIds && s.kilnIds.length > 0 ? s.kilnIds : ['sbl-1']);
    setSeasonDamageInput(String(s.damageOrAdjustmentBricks || 0));
    setSeasonOpeningStockInput(
      s.openingStockOverride !== undefined ? String(s.openingStockOverride) : ''
    );
    setSeasonOpeningCashInput(
      s.openingCashOverride !== undefined ? String(s.openingCashOverride) : ''
    );
    setSeasonReasonInput('');
    setSubView('SEASON_MANAGER');
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* 1. TOP EXECUTIVE HEADER & PERIOD / YEAR / SEASON / KILN SELECTOR STUDIO */}
      <section className="bg-gradient-to-r from-[#0B1120] via-[#0F172A] to-[#1E293B] text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/90 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-orange-400">
              <CalendarRange className="w-4 h-4" />
              <span>
                {isEn
                  ? 'COMPLETE YEARLY & SEASONAL BUSINESS ANALYTICS SYSTEM'
                  : 'বার্ষিক ও সিজনভিত্তিক পূর্ণাঙ্গ ভাটা হিসাব, ১২ মাসের চার্ট ও ঐতিহাসিক আর্কাইভ'}
              </span>
            </div>
            <h2
              data-testid="yearly-seasonal-report-title"
              className="text-lg sm:text-2xl font-extrabold text-white tracking-tight"
            >
              {report.periodTitleBn}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {report.periodSubtitleBn} · {report.kilnNameBn}
            </p>
          </div>

          {/* Print / PDF & Excel/CSV Export Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportMonthlyCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              {isEn ? '12-Month Excel/CSV' : '১২ মাসের CSV/Excel'}
            </button>

            <button
              type="button"
              onClick={handleExportArchiveCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              {isEn ? 'Archive Ledger CSV' : 'আর্কাইভ খতিয়ান CSV'}
            </button>

            <button
              type="button"
              onClick={() => setIsPrintReportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {isEn ? 'Print / Save PDF Report' : 'প্রিন্ট / PDF রিপোর্ট'}
            </button>
          </div>
        </div>

        {/* Period Mode Selector + Year / Season / Date Range / Kiln Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Mode Tabs */}
          <div className="lg:col-span-4">
            <span className="block text-xs font-bold text-slate-300 mb-1.5">
              হিসাবের ধরন নির্বাচন করুন (Reporting Mode)
            </span>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFilterMode('YEAR')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'YEAR'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                বার্ষিক হিসাব
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('SEASON')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'SEASON'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                ভাটা সিজন হিসাব
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('CUSTOM_RANGE')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'CUSTOM_RANGE'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                কাস্টম তারিখ
              </button>
            </div>
          </div>

          {/* Dynamic Year / Season / Custom Date Picker */}
          <div className="lg:col-span-5">
            {filterMode === 'YEAR' && (
              <div>
                <label
                  htmlFor="analytics-year-select"
                  className="block text-xs font-bold text-amber-300 mb-1.5"
                >
                  বছর নির্বাচন করুন (যেমন: ২০২৫, ২০২৬, ২০২৭ বা যেকোনো বছর)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="analytics-year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3.5 py-2.5 text-sm font-extrabold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-500 shadow-2xs"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr} className="bg-white text-slate-900">
                        {formatBn(yr).replace(/,/g, '')} সাল ({yr})
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[2025, 2026, 2027].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSelectedYear(yr)}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                          selectedYear === yr
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-orange-400'
                        }`}
                      >
                        {formatBn(yr).replace(/,/g, '')} ({yr})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'SEASON' && (
              <div>
                <label
                  htmlFor="analytics-season-select"
                  className="block text-xs font-bold text-amber-300 mb-1.5"
                >
                  ভাটা সিজন নির্বাচন করুন (কাস্টম শুরুর ও শেষ তারিখসহ)
                </label>
                <select
                  id="analytics-season-select"
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-extrabold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-500 shadow-2xs"
                >
                  {kilnSeasons.map((s) => (
                    <option key={s.id} value={s.id} className="bg-white text-slate-900">
                      {s.nameBn} ({s.startDate} হতে {s.endDate}){' '}
                      {s.status === 'CLOSED' ? '[সমাপ্ত সিজন]' : '[চলমান]'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'CUSTOM_RANGE' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="analytics-custom-start"
                    className="block text-xs font-bold text-amber-300 mb-1"
                  >
                    শুরুর তারিখ (From)
                  </label>
                  <input
                    id="analytics-custom-start"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl shadow-2xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="analytics-custom-end"
                    className="block text-xs font-bold text-amber-300 mb-1"
                  >
                    শেষ তারিখ (To)
                  </label>
                  <input
                    id="analytics-custom-end"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Kiln Selector */}
          <div className="lg:col-span-3">
            <label
              htmlFor="analytics-kiln-select"
              className="block text-xs font-bold text-slate-200 mb-1.5"
            >
              ভাটা / ইউনিট ফিল্টার (Kiln Selector)
            </label>
            <select
              id="analytics-kiln-select"
              value={selectedKilnId}
              onChange={(e) => setSelectedKilnId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-orange-500 shadow-2xs"
            >
              <option value="ALL" className="bg-white text-slate-900">সকল ভাটা ইউনিট (All Kilns)</option>
              {kilnUnits.map((k) => (
                <option key={k.id} value={k.id} className="bg-white text-slate-900">
                  {k.nameBn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-Navigation Bar for the 4 Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setSubView('OVERVIEW_12M')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-left ${
              subView === 'OVERVIEW_12M'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>১. বার্ষিক সামারি ও ১২ মাসের চার্ট</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('SEASON_MANAGER')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-left ${
              subView === 'SEASON_MANAGER'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0" />
            <span>২. সিজন ম্যানেজমেন্ট ও দুই সিজনের তুলনা</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('OPENING_CLOSING')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-left ${
              subView === 'OPENING_CLOSING'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Scale className="w-4 h-4 shrink-0" />
            <span>৩. সিজন প্রারম্ভিক ও সমাপনী রিপোর্ট</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('HISTORICAL_ARCHIVE')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-left ${
              subView === 'HISTORICAL_ARCHIVE'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>
              ৪. পুরাতন রেকর্ড আর্কাইভ ({formatBn(report.archiveEntries.length)}টি)
            </span>
          </button>
        </div>
      </section>

      {/* Zero-Data Honest Limitation Notice if a historical year has no saved records yet */}
      {!report.hasRecordsInPeriod && (
        <div
          data-testid="empty-period-notice"
          className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-950"
        >
          <Calendar className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold">
              নির্বাচিত সময়কালে ({report.startDate} হতে {report.endDate}) কোনো সংরক্ষিত লেনদেন পাওয়া যায়নি।
            </div>
            <div className="text-xs text-amber-800 mt-0.5">
              সিস্টেমে কোনো কাল্পনিক বা অনুমানভিত্তিক হিসাব দেখানো হয়নি। শুধুমাত্র প্রকৃত সংরক্ষিত মেমো, ক্যাশ বুক, উৎপাদন ও লেবার রেকর্ড থেকে হিসাব প্রদর্শিত হয় (পূর্ববর্তী সময়ের প্রারম্ভিক জের নিচে সমন্বিত রয়েছে)।
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 1: YEARLY & SEASONAL SUMMARY + 12-MONTH CHARTS & TABLES
      ===================================================================== */}
      {subView === 'OVERVIEW_12M' && (
        <div className="space-y-6">
          {/* 12 Comprehensive Accounting KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* 1. Total Sales */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>১. মোট ইট বিক্রয় (Total Sales)</span>
                <BookOpen className="w-4 h-4 text-orange-600" />
              </div>
              <div
                data-testid="yearly-total-sales"
                className="text-xl font-extrabold text-slate-900 tabular-nums"
              >
                {formatCurrencyBn(report.totalSalesAmount)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                মোট মেমো: {formatBn(report.totalMemoCount)}টি · ছাড়:{' '}
                {formatCurrencyBn(report.totalDiscountAmount)}
              </div>
            </div>

            {/* 2. Total Actual Collections */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>২. প্রকৃত নগদ আদায় (Collections)</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div
                data-testid="yearly-actual-collections"
                className="text-xl font-extrabold text-emerald-700 tabular-nums"
              >
                {formatCurrencyBn(report.totalActualCollections)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                মেমো নগদ: {formatCurrencyBn(report.initialMemoCollections)} · বকেয়া আদায়:{' '}
                {formatCurrencyBn(report.dueCollections)}
              </div>
            </div>

            {/* 3. Total Outstanding Receivables */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-amber-500 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৩. বকেয়া পাওনা (Receivables)</span>
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <div
                data-testid="yearly-outstanding-receivables"
                className="text-xl font-extrabold text-rose-700 tabular-nums"
              >
                {formatCurrencyBn(report.totalOutstandingReceivables)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                প্রারম্ভিক জের: {formatCurrencyBn(report.reconciliation.openingCustomerReceivables)} · এই মেয়াদে বাকি:{' '}
                {formatCurrencyBn(report.totalCreditSalesAmount)}
              </div>
            </div>

            {/* 4. Total Expenses */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-rose-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৪. মোট ভাটা খরচ (Total Expenses)</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div
                data-testid="yearly-total-expenses"
                className="text-xl font-extrabold text-rose-700 tabular-nums"
              >
                {formatCurrencyBn(report.totalExpenses)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                কয়লা: {formatCurrencyBn(report.coalPurchaseAmount)} · ডিজেল/ভেকু:{' '}
                {formatCurrencyBn(report.dieselAndVekuAmount)}
              </div>
            </div>

            {/* 5. Other Income */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-teal-500 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৫. অন্যান্য জমা / আয় (Other Income)</span>
                <Plus className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-xl font-extrabold text-teal-700 tabular-nums">
                {formatCurrencyBn(report.otherIncome)}
              </div>
              <div className="text-[11px] text-slate-500">
                ইট বিক্রয় ব্যতীত অন্যান্য ক্যাশ ইন
              </div>
            </div>

            {/* 6. Net Cash Movement */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-sky-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৬. নিট ক্যাশ প্রবাহ (Net Cashflow)</span>
                <Scale className="w-4 h-4 text-sky-600" />
              </div>
              <div
                className={`text-xl font-extrabold tabular-nums ${
                  report.netCashMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrencyBn(report.netCashMovement)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                সমাপনী ক্যাশ ব্যালেন্স: {formatCurrencyBn(report.reconciliation.closingCashBalance)}
              </div>
            </div>

            {/* 7. Production Totals */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-amber-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৭. মোট ইট উৎপাদন (Production)</span>
                <Factory className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                কাঁচা: {formatBn(report.rawBricksCut)} পিস
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                ভ্যান লোড: {formatBn(report.chulliLoadedBricks)} · পোড়াই:{' '}
                {formatBn(report.poraiFiredBricks)} · আনলোড:{' '}
                {formatBn(report.pakaUnloadedBricks)}
              </div>
            </div>

            {/* 8. Brick Sales & Delivery Quantities */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৮. বিক্রিত ও ডেলিভারি ইট (Bricks Sold)</span>
                <PackageCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                {formatBn(report.totalBricksSoldQty)} পিস
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                ডেলিভারি গেছে: {formatBn(report.totalBricksDeliveredQty)} পিস · বাকি:{' '}
                {formatBn(report.totalPendingDeliveryQty)} পিস
              </div>
            </div>

            {/* 9. Stock Movement */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-cyan-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>৯. স্টক মুভমেন্ট (Stock Balance)</span>
                <Layers className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-xl font-extrabold text-cyan-800 tabular-nums">
                {formatBn(report.reconciliation.closingStockBricks)} পিস
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                প্রারম্ভিক: {formatBn(report.reconciliation.openingStockBricks)} + উৎপাদন:{' '}
                {formatBn(report.reconciliation.periodProducedBricks)} − বিক্রি:{' '}
                {formatBn(report.reconciliation.periodSoldBricks)}
              </div>
            </div>

            {/* 10. Labor Expenses & Payments */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-500 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>১০. লেবার ও হাজিরা পেমেন্ট (Labor)</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                {formatCurrencyBn(report.laborPaidAmount)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                হাজিরা বিল: {formatCurrencyBn(report.laborEarnedAmount)} · লেবার বকেয়া:{' '}
                {formatCurrencyBn(report.laborOutstandingDue)}
              </div>
            </div>

            {/* 11. Supplier & Sardar Payments & Balances */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-purple-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>১১. মিল ও সর্দার পেমেন্ট ও বকেয়া</span>
                <Truck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                পরিশোধ: {formatCurrencyBn(report.supplierAndContractorPaid)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                মোট বিল: {formatCurrencyBn(report.supplierAndContractorPayable)} · সর্দার পাবে:{' '}
                <strong className="text-rose-700">
                  {formatCurrencyBn(report.supplierAndContractorDue)}
                </strong>
              </div>
            </div>

            {/* 12. Soil & Raw-Material Purchases */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-stone-600 rounded-2xl p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>১২. মাটির ট্রাক ও কাঁচামাল ক্রয়</span>
                <Flame className="w-4 h-4 text-stone-700" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                {formatCurrencyBn(report.soilAndRawMaterialAmount)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                মাটির এন্ট্রি: {formatBn(report.soilTicketCount)}টি · কয়লা ক্রয়:{' '}
                {formatCurrencyBn(report.coalPurchaseAmount)}
              </div>
            </div>
          </div>

          {/* 12-MONTH VISUAL CHARTS STUDIO */}
          <div className="bg-white border border-slate-200/90 border-t-4 border-t-orange-600 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  ১২ মাসের গ্রাফিক্যাল চার্ট ও মাসিক পারফরম্যান্স বিশ্লেষণ (১২ মাসই প্রদর্শিত)
                </h3>
                <p className="text-xs text-slate-500">
                  যে মাসে কোনো লেনদেন হয়নি সেই মাসও শূন্য (০) সহ দেখানো হয়েছে। বকেয়া বিক্রি কখনোই নগদ আদায় হিসেবে গণনা করা হয়নি।
                </p>
              </div>

              {/* Chart Selector Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setChartMode('SALES_COLLECTION_EXPENSE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'SALES_COLLECTION_EXPENSE'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  বিক্রি, আদায় ও খরচ
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('PRODUCTION_BY_MONTH')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'PRODUCTION_BY_MONTH'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  মাসিক উৎপাদন
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('FUEL_AND_WOOD_USAGE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    chartMode === 'FUEL_AND_WOOD_USAGE'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  জ্বালানি ও কাঠ বনাম উৎপাদন
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('COLLECTION_TREND')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'COLLECTION_TREND'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  আদায় ট্রেন্ড
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('RECEIVABLES_TREND')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'RECEIVABLES_TREND'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  বকেয়া পাওনা ধারা
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('GRADE_AND_EXPENSE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartMode === 'GRADE_AND_EXPENSE'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  ইট গ্রেড ও খরচ খাত
                </button>
              </div>
            </div>

            {/* Chart Views */}
            {chartMode !== 'GRADE_AND_EXPENSE' ? (
              <div className="space-y-3">
                {/* Legend */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  {chartMode === 'SALES_COLLECTION_EXPENSE' && (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 text-orange-700">
                        <span className="w-3 h-3 rounded-xs bg-orange-600" />
                        মাসিক বিক্রি (Sales)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="w-3 h-3 rounded-xs bg-emerald-600" />
                        প্রকৃত নগদ আদায় (Actual Cash Collection)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-rose-700">
                        <span className="w-3 h-3 rounded-xs bg-rose-600" />
                        মাসিক খরচ (Expense)
                      </span>
                    </div>
                  )}
                  {chartMode === 'PRODUCTION_BY_MONTH' && (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <span className="w-3 h-3 rounded-xs bg-amber-500" />
                        কাঁচা ইট কাটা (মিল)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-rose-700">
                        <span className="w-3 h-3 rounded-xs bg-rose-500" />
                        চুল্লি পোড়াই / লোড
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-orange-700">
                        <span className="w-3 h-3 rounded-xs bg-orange-600" />
                        পাকা ইট আনলোড
                      </span>
                    </div>
                  )}
                  {chartMode === 'FUEL_AND_WOOD_USAGE' && (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 text-amber-800">
                        <span className="w-3 h-3 rounded-xs bg-amber-600" />
                        জ্বালানি কাঠ সরবরাহ (মণ সমতুল্য)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-rose-700">
                        <span className="w-3 h-3 rounded-xs bg-rose-600" />
                        কাঠ, কয়লা ও জ্বালানি খরচ (৳)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="w-3 h-3 rounded-xs bg-emerald-600" />
                        মাসিক ইট উৎপাদন ভলিউম (পিস)
                      </span>
                    </div>
                  )}
                  {chartMode === 'COLLECTION_TREND' && (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="w-3 h-3 rounded-xs bg-emerald-600" />
                        প্রকৃত নগদ আদায় (Cash Collected)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sky-700">
                        <span className="w-3 h-3 rounded-xs bg-sky-600" />
                        নিট ক্যাশ উদ্বৃত্ত (Net Cashflow)
                      </span>
                    </div>
                  )}
                  {chartMode === 'RECEIVABLES_TREND' && (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 text-rose-700">
                        <span className="w-3 h-3 rounded-xs bg-rose-600" />
                        মাস শেষে ক্রমপুঞ্জিত বকেয়া পাওনা (Cumulative Receivables)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <span className="w-3 h-3 rounded-xs bg-amber-500" />
                        ওই মাসের নতুন বাকি বিক্রি
                      </span>
                    </div>
                  )}
                </div>

                {/* 12-Month Bar Chart Grid */}
                <div
                  data-testid="twelve-month-chart-grid"
                  className="grid grid-cols-12 gap-1.5 sm:gap-3 pt-4 items-end h-56 border-b border-slate-200 pb-3 px-2 bg-slate-50/70 rounded-xl"
                >
                  {report.monthlyBreakdown.map((pt) => {
                    if (chartMode === 'FUEL_AND_WOOD_USAGE') {
                      const woodPct =
                        pt.woodFuelMaund > 0
                          ? Math.max(8, Math.round((pt.woodFuelMaund / maxWoodMaundMonthVal) * 100))
                          : 3;
                      const fuelCostPct =
                        pt.fuelAndCoalExpenseAmount > 0
                          ? Math.max(
                              8,
                              Math.round((pt.fuelAndCoalExpenseAmount / maxFuelCostMonthVal) * 100)
                            )
                          : 3;
                      const prodPct =
                        pt.productionVolumeBricks > 0
                          ? Math.max(
                              8,
                              Math.round((pt.productionVolumeBricks / maxProductionMonthVal) * 100)
                            )
                          : 3;

                      return (
                        <div
                          key={pt.monthKey}
                          className="flex flex-col items-center justify-end h-full gap-1.5 group"
                        >
                          <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-40">
                            <div
                              style={{ height: `${woodPct}%` }}
                              title={`${pt.monthLabelBn} — জ্বালানি কাঠ: ${formatBn(pt.woodFuelMaund)} মণ`}
                              className={`w-2 sm:w-3 rounded-t-xs ${
                                pt.woodFuelMaund > 0 ? 'bg-amber-600' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              style={{ height: `${fuelCostPct}%` }}
                              title={`${pt.monthLabelBn} — কাঠ ও জ্বালানি খরচ: ${formatCurrencyBn(pt.fuelAndCoalExpenseAmount)}`}
                              className={`w-2 sm:w-3 rounded-t-xs ${
                                pt.fuelAndCoalExpenseAmount > 0 ? 'bg-rose-600' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              style={{ height: `${prodPct}%` }}
                              title={`${pt.monthLabelBn} — ইট উৎপাদন ভলিউম: ${formatBn(pt.productionVolumeBricks)} পিস`}
                              className={`w-2 sm:w-3 rounded-t-xs ${
                                pt.productionVolumeBricks > 0 ? 'bg-emerald-600' : 'bg-slate-200'
                              }`}
                            />
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight">
                            {pt.monthShortBn}
                          </span>
                        </div>
                      );
                    }

                    if (chartMode === 'PRODUCTION_BY_MONTH') {
                      const rawPct =
                        pt.rawBricksCut > 0
                          ? Math.max(8, Math.round((pt.rawBricksCut / maxProductionMonthVal) * 100))
                          : 3;
                      const firedVal = Math.max(pt.chulliLoadedBricks, pt.poraiFiredBricks);
                      const firedPct =
                        firedVal > 0
                          ? Math.max(8, Math.round((firedVal / maxProductionMonthVal) * 100))
                          : 3;
                      const unloadPct =
                        pt.pakaUnloadedBricks > 0
                          ? Math.max(
                              8,
                              Math.round((pt.pakaUnloadedBricks / maxProductionMonthVal) * 100)
                            )
                          : 3;

                      return (
                        <div
                          key={pt.monthKey}
                          className="flex flex-col items-center justify-end h-full gap-1.5 group"
                        >
                          <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-40">
                            <div
                              style={{ height: `${rawPct}%` }}
                              title={`${pt.monthLabelBn} — কাঁচা ইট: ${formatBn(pt.rawBricksCut)} পিস`}
                              className={`w-2 sm:w-3 rounded-t-xs ${
                                pt.rawBricksCut > 0 ? 'bg-amber-500' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              style={{ height: `${firedPct}%` }}
                              title={`${pt.monthLabelBn} — পোড়াই/লোড: ${formatBn(firedVal)} পিস`}
                              className={`w-2 sm:w-3 rounded-t-xs ${
                                firedVal > 0 ? 'bg-rose-500' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              style={{ height: `${unloadPct}%` }}
                              title={`${pt.monthLabelBn} — পাকা আনলোড: ${formatBn(pt.pakaUnloadedBricks)} পিস`}
                              className={`w-2 sm:w-3 rounded-t-xs ${
                                pt.pakaUnloadedBricks > 0 ? 'bg-orange-600' : 'bg-slate-200'
                              }`}
                            />
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight">
                            {pt.monthShortBn}
                          </span>
                        </div>
                      );
                    }

                    if (chartMode === 'COLLECTION_TREND') {
                      const colPct =
                        pt.actualCollectionAmount > 0
                          ? Math.max(
                              8,
                              Math.round((pt.actualCollectionAmount / maxFinancialMonthVal) * 100)
                            )
                          : 3;
                      const netVal = Math.max(0, pt.netCashMovement);
                      const netPct =
                        netVal > 0
                          ? Math.max(8, Math.round((netVal / maxFinancialMonthVal) * 100))
                          : 3;

                      return (
                        <div
                          key={pt.monthKey}
                          className="flex flex-col items-center justify-end h-full gap-1.5 group"
                        >
                          <div className="w-full flex items-end justify-center gap-1 h-40">
                            <div
                              style={{ height: `${colPct}%` }}
                              title={`${pt.monthLabelBn} — নগদ আদায়: ${formatCurrencyBn(pt.actualCollectionAmount)}`}
                              className={`w-2.5 sm:w-3.5 rounded-t-xs ${
                                pt.actualCollectionAmount > 0 ? 'bg-emerald-600' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              style={{ height: `${netPct}%` }}
                              title={`${pt.monthLabelBn} — নিট ক্যাশ: ${formatCurrencyBn(pt.netCashMovement)}`}
                              className={`w-2.5 sm:w-3.5 rounded-t-xs ${
                                pt.netCashMovement > 0 ? 'bg-sky-600' : 'bg-slate-200'
                              }`}
                            />
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight">
                            {pt.monthShortBn}
                          </span>
                        </div>
                      );
                    }

                    if (chartMode === 'RECEIVABLES_TREND') {
                      const recPct =
                        pt.cumulativeReceivables > 0
                          ? Math.max(
                              8,
                              Math.round((pt.cumulativeReceivables / maxFinancialMonthVal) * 100)
                            )
                          : 3;
                      const credPct =
                        pt.creditSalesAmount > 0
                          ? Math.max(
                              8,
                              Math.round((pt.creditSalesAmount / maxFinancialMonthVal) * 100)
                            )
                          : 3;

                      return (
                        <div
                          key={pt.monthKey}
                          className="flex flex-col items-center justify-end h-full gap-1.5 group"
                        >
                          <div className="w-full flex items-end justify-center gap-1 h-40">
                            <div
                              style={{ height: `${recPct}%` }}
                              title={`${pt.monthLabelBn} — মোট বকেয়া পাওনা: ${formatCurrencyBn(pt.cumulativeReceivables)}`}
                              className={`w-2.5 sm:w-3.5 rounded-t-xs ${
                                pt.cumulativeReceivables > 0 ? 'bg-rose-600' : 'bg-slate-200'
                              }`}
                            />
                            <div
                              style={{ height: `${credPct}%` }}
                              title={`${pt.monthLabelBn} — নতুন বাকি: ${formatCurrencyBn(pt.creditSalesAmount)}`}
                              className={`w-2.5 sm:w-3.5 rounded-t-xs ${
                                pt.creditSalesAmount > 0 ? 'bg-amber-500' : 'bg-slate-200'
                              }`}
                            />
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight">
                            {pt.monthShortBn}
                          </span>
                        </div>
                      );
                    }

                    // Default: SALES_COLLECTION_EXPENSE
                    const sPct =
                      pt.salesAmount > 0
                        ? Math.max(8, Math.round((pt.salesAmount / maxFinancialMonthVal) * 100))
                        : 3;
                    const cPct =
                      pt.actualCollectionAmount > 0
                        ? Math.max(
                            8,
                            Math.round((pt.actualCollectionAmount / maxFinancialMonthVal) * 100)
                          )
                        : 3;
                    const ePct =
                      pt.expenseAmount > 0
                        ? Math.max(8, Math.round((pt.expenseAmount / maxFinancialMonthVal) * 100))
                        : 3;

                    return (
                      <div
                        key={pt.monthKey}
                        className="flex flex-col items-center justify-end h-full gap-1.5 group"
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-40">
                          <div
                            style={{ height: `${sPct}%` }}
                            title={`${pt.monthLabelBn} — বিক্রি: ${formatCurrencyBn(pt.salesAmount)}`}
                            className={`w-2 sm:w-3 rounded-t-xs transition-all ${
                              pt.salesAmount > 0 ? 'bg-orange-600' : 'bg-slate-200'
                            }`}
                          />
                          <div
                            style={{ height: `${cPct}%` }}
                            title={`${pt.monthLabelBn} — নগদ আদায়: ${formatCurrencyBn(pt.actualCollectionAmount)}`}
                            className={`w-2 sm:w-3 rounded-t-xs transition-all ${
                              pt.actualCollectionAmount > 0 ? 'bg-emerald-600' : 'bg-slate-200'
                            }`}
                          />
                          <div
                            style={{ height: `${ePct}%` }}
                            title={`${pt.monthLabelBn} — খরচ: ${formatCurrencyBn(pt.expenseAmount)}`}
                            className={`w-2 sm:w-3 rounded-t-xs transition-all ${
                              pt.expenseAmount > 0 ? 'bg-rose-600' : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight">
                          {pt.monthShortBn}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Grade Sales & Expense Categories Side-by-Side Visual Bars */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-extrabold text-slate-900">
                    গ্রেডভিত্তিক ইট বিক্রি ও আয় (Brick Sales by Type)
                  </h4>
                  <div className="space-y-2.5">
                    {report.gradeBreakdown.map((g) => {
                      const pct =
                        report.totalBricksSoldQty > 0
                          ? Math.round((g.soldQty / report.totalBricksSoldQty) * 100)
                          : 0;
                      return (
                        <div key={g.gradeId} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>{g.gradeNameBn}</span>
                            <span className="tabular-nums">
                              {formatBn(g.soldQty)} পিস ({formatCurrencyBn(g.soldAmount)}) ·{' '}
                              {formatBn(pct)}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.max(2, pct)}%` }}
                              className="h-full bg-gradient-to-r from-orange-600 to-amber-500 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-extrabold text-slate-900">
                    খাতওয়ারী ভাটা খরচের বিশ্লেষণ (Expense Categories)
                  </h4>
                  {report.expenseBreakdown.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      এই সময়ে কোনো খরচের এন্ট্রি পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {report.expenseBreakdown.map((exp) => (
                        <div key={exp.category} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>
                              {exp.category} ({formatBn(exp.txCount)}টি)
                            </span>
                            <span className="tabular-nums text-rose-700">
                              {formatCurrencyBn(exp.amount)} ({formatBn(exp.sharePct)}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.max(3, exp.sharePct)}%` }}
                              className="h-full bg-gradient-to-r from-rose-600 to-red-500 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 12-Month Complete Breakdown Table Below the Charts */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-sm font-extrabold text-slate-900">
                  পূর্ণ ১২ মাসের মাসিক পারফরম্যান্স ও হিসাব খতিয়ান টেবিল (Monthly Performance Table)
                </h4>
                <span className="text-xs font-semibold text-slate-500">
                  সকল ১২ মাস অন্তর্ভুক্ত (শূন্য লেনদেনের মাসসহ)
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table
                  data-testid="twelve-month-breakdown-table"
                  className="w-full text-xs sm:text-sm text-left border-collapse"
                >
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="py-3 px-3 font-bold">মাস (Month)</th>
                      <th className="py-3 px-3 font-bold text-right">মেমো</th>
                      <th className="py-3 px-3 font-bold text-right">মোট বিক্রি (৳)</th>
                      <th className="py-3 px-3 font-bold text-right text-emerald-300">
                        প্রকৃত নগদ আদায় (৳)
                      </th>
                      <th className="py-3 px-3 font-bold text-right text-rose-300">
                        মোট খরচ (৳)
                      </th>
                      <th className="py-3 px-3 font-bold text-right text-sky-300">
                        নিট ক্যাশ প্রবাহ
                      </th>
                      <th className="py-3 px-3 font-bold text-right">কাঁচা ইট উৎপাদন</th>
                      <th className="py-3 px-3 font-bold text-right">পাকা আনলোড</th>
                      <th className="py-3 px-3 font-bold text-right">বিক্রিত ইট (পিস)</th>
                      <th className="py-3 px-3 font-bold text-right">ডেলিভারি ইট</th>
                      <th className="py-3 px-3 font-bold text-right text-amber-300">
                        মাস শেষে বকেয়া
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.monthlyBreakdown.map((m) => {
                      const hasActivity =
                        m.salesAmount > 0 ||
                        m.actualCollectionAmount > 0 ||
                        m.expenseAmount > 0 ||
                        m.rawBricksCut > 0 ||
                        m.pakaUnloadedBricks > 0;
                      return (
                        <tr
                          key={m.monthKey}
                          className={
                            hasActivity
                              ? 'bg-white hover:bg-orange-50/40'
                              : 'bg-slate-50/60 text-slate-500 hover:bg-slate-100/60'
                          }
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {m.monthLabelBn}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {formatBn(m.memoCount)}টি
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrencyBn(m.salesAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBn(m.actualCollectionAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                            {formatCurrencyBn(m.expenseAmount)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                              m.netCashMovement >= 0
                                ? 'text-sky-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {formatCurrencyBn(m.netCashMovement)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {formatBn(m.rawBricksCut)} পিস
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {formatBn(m.pakaUnloadedBricks)} পিস
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                            {formatBn(m.bricksSoldQty)} পিস
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                            {formatBn(m.bricksDeliveredQty)} পিস
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 tabular-nums">
                            {formatCurrencyBn(m.cumulativeReceivables)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-extrabold text-xs sm:text-sm">
                      <td className="py-3 px-3">সর্বমোট (১২ মাস একত্রে):</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatBn(report.totalMemoCount)}টি
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-orange-300">
                        {formatCurrencyBn(report.totalSalesAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400">
                        {formatCurrencyBn(report.totalActualCollections)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-300">
                        {formatCurrencyBn(report.totalExpenses)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-300">
                        {formatCurrencyBn(report.netCashMovement)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatBn(report.rawBricksCut)} পিস
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatBn(report.pakaUnloadedBricks)} পিস
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-300">
                        {formatBn(report.totalBricksSoldQty)} পিস
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-300">
                        {formatBn(report.totalBricksDeliveredQty)} পিস
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400">
                        {formatCurrencyBn(report.totalOutstandingReceivables)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Dedicated Fuel & Wood Usage vs. Monthly Brick Production Chart Card */}
          <div
            data-testid="fuel-wood-usage-chart-card"
            className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden shadow-xs"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-900 via-orange-800 to-slate-900 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                      জ্বালানি ও কাঠ ব্যবহার বনাম মাসিক ইট উৎপাদন চার্ট (Fuel &amp; Wood Usage Chart)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/25 border border-amber-400/40 text-amber-200">
                      {report.periodTitleBn}
                    </span>
                  </div>
                  <p className="text-xs text-amber-100/80 mt-0.5">
                    প্রতি মাসের জ্বালানি কাঠ সরবরাহ (মণ), কয়লা ও জ্বালানি খরচ (৳) এবং মাসিক ইট উৎপাদন ভলিউমের পাশাপাশি তুলনামূলক বিশ্লেষণ
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3.5 py-2 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    প্রতি ১,০০০ ইটে জ্বালানি খরচ
                  </p>
                  <p className="text-base font-black text-white font-mono tabular-nums">
                    {formatCurrencyBn(report.fuelCostPerThousandBricks)}
                    <span className="text-[11px] font-normal text-amber-200"> /হাজার</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 5 Summary KPI Cards for Fuel & Wood vs Production */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-amber-50/40 border-b border-amber-100">
              <div className="bg-white border border-amber-200/80 rounded-xl p-3">
                <p className="text-[11px] font-bold text-amber-900">
                  মোট কাঠ সরবরাহ (মণ সমতুল্য)
                </p>
                <p className="text-lg font-black text-amber-800 font-mono tabular-nums mt-0.5">
                  {formatBn(report.totalWoodFuelMaund)} মণ
                </p>
                <p className="text-[11px] text-slate-500">
                  মোট {formatBn(report.totalWoodFuelDeliveries)}টি কাঠের চালান
                </p>
              </div>

              <div className="bg-white border border-orange-200/80 rounded-xl p-3">
                <p className="text-[11px] font-bold text-orange-900">
                  জ্বালানি কাঠের মোট বিল
                </p>
                <p className="text-lg font-black text-orange-700 font-mono tabular-nums mt-0.5">
                  {formatCurrencyBn(report.totalWoodFuelBillAmount)}
                </p>
                <p className="text-[11px] text-slate-500">
                  নগদ পরিশোধ: {formatCurrencyBn(report.totalWoodFuelPaidAmount)}
                </p>
              </div>

              <div className="bg-white border border-rose-200/80 rounded-xl p-3">
                <p className="text-[11px] font-bold text-rose-900">
                  কাঠ ব্যাপারীদের বকেয়া পাওনা
                </p>
                <p className="text-lg font-black text-rose-700 font-mono tabular-nums mt-0.5">
                  {formatCurrencyBn(report.totalWoodFuelDueAmount)}
                </p>
                <p className="text-[11px] text-slate-500">
                  জ্বালানি খাতে অপরিশোধিত বাকি
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-[11px] font-bold text-slate-700">
                  মোট জ্বালানি খরচ (কাঠ + কয়লা + ডিজেল)
                </p>
                <p className="text-lg font-black text-slate-900 font-mono tabular-nums mt-0.5">
                  {formatCurrencyBn(report.totalFuelAndWoodCost)}
                </p>
                <p className="text-[11px] text-slate-500">
                  কয়লা: {formatCurrencyBn(report.coalPurchaseAmount)} · ডিজেল: {formatCurrencyBn(report.dieselAndVekuAmount)}
                </p>
              </div>

              <div className="bg-white border border-emerald-200/80 rounded-xl p-3 col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold text-emerald-900">
                  সিজনের সর্বোচ্চ ইট উৎপাদন ভলিউম
                </p>
                <p className="text-lg font-black text-emerald-700 font-mono tabular-nums mt-0.5">
                  {formatBn(
                    Math.max(
                      report.rawBricksCut,
                      report.chulliLoadedBricks,
                      report.poraiFiredBricks,
                      report.pakaUnloadedBricks
                    )
                  )}{' '}
                  পিস
                </p>
                <p className="text-[11px] text-slate-500">
                  কাঁচা: {formatBn(report.rawBricksCut)} · পাকা: {formatBn(report.pakaUnloadedBricks)}
                </p>
              </div>
            </div>

            {/* 12-Month Dual-Axis Visual Bar Chart (Fuel/Wood vs Monthly Production Volume) */}
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-amber-800">
                    <span className="w-3 h-3 rounded-xs bg-amber-600" />
                    মাসিক কাঠ ব্যবহার (মণ সমতুল্য)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-rose-700">
                    <span className="w-3 h-3 rounded-xs bg-rose-600" />
                    কাঠ ও জ্বালানি খরচ (৳)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="w-3 h-3 rounded-xs bg-emerald-600" />
                    মাসিক ইট উৎপাদন ভলিউম (পিস)
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  বারগুলোর ওপর মাউস রাখলে মাসের পূর্ণ হিসাব দেখা যাবে
                </span>
              </div>

              <div
                data-testid="fuel-wood-12m-bars"
                className="grid grid-cols-12 gap-1.5 sm:gap-3 pt-4 items-end h-52 border-b border-amber-200/80 pb-3 px-2 bg-amber-50/30 rounded-xl"
              >
                {report.monthlyBreakdown.map((pt) => {
                  const woodPct =
                    pt.woodFuelMaund > 0
                      ? Math.max(10, Math.round((pt.woodFuelMaund / maxWoodMaundMonthVal) * 100))
                      : 4;
                  const fuelCostPct =
                    pt.fuelAndCoalExpenseAmount > 0
                      ? Math.max(
                          10,
                          Math.round((pt.fuelAndCoalExpenseAmount / maxFuelCostMonthVal) * 100)
                        )
                      : 4;
                  const prodPct =
                    pt.productionVolumeBricks > 0
                      ? Math.max(
                          10,
                          Math.round((pt.productionVolumeBricks / maxProductionMonthVal) * 100)
                        )
                      : 4;

                  return (
                    <div
                      key={`fw-${pt.monthKey}`}
                      className="flex flex-col items-center justify-end h-full gap-1.5 group"
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-36">
                        <div
                          style={{ height: `${woodPct}%` }}
                          title={`${pt.monthLabelBn} — জ্বালানি কাঠ: ${formatBn(pt.woodFuelMaund)} মণ (${formatBn(pt.woodFuelDeliveryCount)} চালান)`}
                          className={`w-2 sm:w-3 rounded-t-xs transition-all ${
                            pt.woodFuelMaund > 0 ? 'bg-amber-600' : 'bg-slate-200'
                          }`}
                        />
                        <div
                          style={{ height: `${fuelCostPct}%` }}
                          title={`${pt.monthLabelBn} — মোট জ্বালানি খরচ: ${formatCurrencyBn(pt.fuelAndCoalExpenseAmount)}`}
                          className={`w-2 sm:w-3 rounded-t-xs transition-all ${
                            pt.fuelAndCoalExpenseAmount > 0 ? 'bg-rose-600' : 'bg-slate-200'
                          }`}
                        />
                        <div
                          style={{ height: `${prodPct}%` }}
                          title={`${pt.monthLabelBn} — ইট উৎপাদন ভলিউম: ${formatBn(pt.productionVolumeBricks)} পিস`}
                          className={`w-2 sm:w-3 rounded-t-xs transition-all ${
                            pt.productionVolumeBricks > 0 ? 'bg-emerald-600' : 'bg-slate-200'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight">
                        {pt.monthShortBn}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Compact Monthly Fuel vs Production Breakdown Table */}
              <div className="overflow-x-auto border border-amber-200/80 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-amber-950 text-white">
                      <th className="py-2.5 px-3 font-bold">মাস (Month)</th>
                      <th className="py-2.5 px-3 font-bold text-right">কাঠের চালান</th>
                      <th className="py-2.5 px-3 font-bold text-right text-amber-300">
                        জ্বালানি কাঠ (মণ)
                      </th>
                      <th className="py-2.5 px-3 font-bold text-right">কাঠের বিল (৳)</th>
                      <th className="py-2.5 px-3 font-bold text-right text-rose-300">
                        মোট জ্বালানি ও কয়লা খরচ (৳)
                      </th>
                      <th className="py-2.5 px-3 font-bold text-right text-emerald-300">
                        কাঁচা ইট কাটা (পিস)
                      </th>
                      <th className="py-2.5 px-3 font-bold text-right text-orange-300">
                        পাকা ইট আনলোড (পিস)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {report.monthlyBreakdown.map((m) => {
                      const activeRow =
                        m.woodFuelMaund > 0 ||
                        m.fuelAndCoalExpenseAmount > 0 ||
                        m.productionVolumeBricks > 0;
                      return (
                        <tr
                          key={`fw-row-${m.monthKey}`}
                          className={
                            activeRow
                              ? 'bg-white hover:bg-amber-50/50 font-semibold text-slate-900'
                              : 'bg-slate-50/50 text-slate-400'
                          }
                        >
                          <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                            {m.monthLabelBn}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatBn(m.woodFuelDeliveryCount)}টি
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-800 tabular-nums">
                            {formatBn(m.woodFuelMaund)} মণ
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatCurrencyBn(m.woodFuelBillAmount)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                            {formatCurrencyBn(m.fuelAndCoalExpenseAmount)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                            {formatBn(m.rawBricksCut)} পিস
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-orange-700 tabular-nums">
                            {formatBn(m.pakaUnloadedBricks)} পিস
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Grade-wise Brick Sales & Stock Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">
                  গ্রেডভিত্তিক ইট উৎপাদন, বিক্রি, ডেলিভারি ও স্টক বিবরণী ({report.periodTitleBn})
                </h3>
                <p className="text-[11px] text-slate-300">
                  প্রতিটি ইটের গ্রেড অনুযায়ী আনলোড, মেমো বিক্রি, ডেলিভারি ও বর্তমান স্টক
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    <th className="py-2.5 px-4 font-bold">ইটের গ্রেড</th>
                    <th className="py-2.5 px-4 font-bold text-right">হাজার প্রতি রেট</th>
                    <th className="py-2.5 px-4 font-bold text-right">পাকা আনলোড</th>
                    <th className="py-2.5 px-4 font-bold text-right">বিক্রিত ইট (পিস)</th>
                    <th className="py-2.5 px-4 font-bold text-right">বিক্রয় মূল্য (৳)</th>
                    <th className="py-2.5 px-4 font-bold text-right text-emerald-800">
                      ডেলিভারি গেছে
                    </th>
                    <th className="py-2.5 px-4 font-bold text-right text-amber-800">
                      ডেলিভারি বাকি
                    </th>
                    <th className="py-2.5 px-4 font-bold text-right text-orange-800">
                      বর্তমান স্টক
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.gradeBreakdown.map((g) => (
                    <tr key={g.gradeId} className="hover:bg-orange-50/30">
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {g.gradeNameBn}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatCurrencyBn(g.ratePerThousand)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatBn(g.unloadedQty)} পিস
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                        {formatBn(g.soldQty)} পিস
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyBn(g.soldAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatBn(g.deliveredQty)} পিস
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-800 tabular-nums">
                        {formatBn(g.pendingDeliveryQty)} পিস
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-extrabold text-orange-700 tabular-nums">
                        {formatBn(g.currentStock)} পিস
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 2: SEASON MANAGEMENT & TWO-SEASON SIDE-BY-SIDE COMPARISON
      ===================================================================== */}
      {subView === 'SEASON_MANAGER' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create / Edit Season Form */}
            <form
              onSubmit={handleSeasonFormSubmit}
              className="lg:col-span-5 bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl p-5 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingSeasonId
                      ? 'ভাটা সিজন সম্পাদনা করুন (Edit Season)'
                      : 'নতুন ভাটা সিজন তৈরি করুন (Create Season)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    যেকোনো শুরুর ও শেষ তারিখ দিয়ে সিজন তৈরি করুন (জানুয়ারি–ডিসেম্বর হওয়া বাধ্যতামূলক নয়)
                  </p>
                </div>
                {editingSeasonId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSeasonId('');
                      setSeasonNameInput('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="season-name-input"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  সিজনের নাম (যেমন: সিজন ২০২৫–২০২৬ বা 2025–2026 Season) *
                </label>
                <input
                  id="season-name-input"
                  type="text"
                  required
                  placeholder="যেমন: সিজন ২০২৭–২০২৮"
                  value={seasonNameInput}
                  onChange={(e) => setSeasonNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="season-start-input"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    সিজন শুরুর তারিখ *
                  </label>
                  <input
                    id="season-start-input"
                    type="date"
                    required
                    value={seasonStartInput}
                    onChange={(e) => setSeasonStartInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="season-end-input"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    সিজন শেষ তারিখ *
                  </label>
                  <input
                    id="season-end-input"
                    type="date"
                    required
                    value={seasonEndInput}
                    onChange={(e) => setSeasonEndInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">
                  সংশ্লিষ্ট ভাটা ইউনিট নির্বাচন করুন
                </span>
                <div className="flex flex-wrap gap-2">
                  {kilnUnits.map((k) => {
                    const checked = seasonKilnsInput.includes(k.id);
                    return (
                      <label
                        key={k.id}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                          checked
                            ? 'bg-orange-50 border-orange-500 text-orange-900'
                            : 'bg-slate-50 border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSeasonKilnsInput((prev) => [...prev, k.id]);
                            } else {
                              setSeasonKilnsInput((prev) =>
                                prev.filter((id) => id !== k.id)
                              );
                            }
                          }}
                          className="accent-orange-600"
                        />
                        <span>{k.nameBn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="season-damage-input"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    ঘাটতি/ড্যামেজ ইট (পিস)
                  </label>
                  <input
                    id="season-damage-input"
                    type="number"
                    min={0}
                    value={seasonDamageInput}
                    onChange={(e) => setSeasonDamageInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="season-open-stock-input"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    প্রারম্ভিক স্টক (ঐচ্ছিক)
                  </label>
                  <input
                    id="season-open-stock-input"
                    type="number"
                    placeholder="অটো হিসাব"
                    value={seasonOpeningStockInput}
                    onChange={(e) => setSeasonOpeningStockInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="season-open-cash-input"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    প্রারম্ভিক ক্যাশ (ঐচ্ছিক)
                  </label>
                  <input
                    id="season-open-cash-input"
                    type="number"
                    placeholder="অটো হিসাব"
                    value={seasonOpeningCashInput}
                    onChange={(e) => setSeasonOpeningCashInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="season-reason-input"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  নোট বা সংশোধনের কারণ (ঐচ্ছিক)
                </label>
                <input
                  id="season-reason-input"
                  type="text"
                  placeholder="যেমন: ২০২৭-২০২৮ নতুন ভাটা সিজন শুরু..."
                  value={seasonReasonInput}
                  onChange={(e) => setSeasonReasonInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={savingSeason}
                className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-sm cursor-pointer transition-all"
              >
                {savingSeason
                  ? 'সংরক্ষণ হচ্ছে...'
                  : editingSeasonId
                  ? 'সিজন আপডেট সংরক্ষণ করুন'
                  : '+ নতুন ভাটা সিজন সংরক্ষণ করুন'}
              </button>
            </form>

            {/* Configured Seasons List */}
            <div className="lg:col-span-7 bg-white border border-slate-200 border-t-4 border-t-slate-900 rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  সংরক্ষিত ভাটা সিজনসমূহ ({formatBn(kilnSeasons.length)}টি সিজন)
                </h3>
                <p className="text-xs text-slate-500">
                  নতুন সিজন শুরু হলেও পুরাতন কোনো লেনদেন মুছে যায় না। যেকোনো পুরাতন সিজন সিলেক্ট করে তার সম্পূর্ণ হিসাব দেখুন বা পুনরায় চালু করুন।
                </p>
              </div>

              <div className="space-y-3">
                {kilnSeasons.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-extrabold text-slate-900">
                          {s.nameBn}
                        </span>
                        <span
                          className={`text-xs font-extrabold ${
                            s.status === 'CLOSED'
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          · {s.status === 'CLOSED' ? 'সমাপ্ত সিজন (Closed)' : 'চলমান সিজন (Active)'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        মেয়াদ: <strong>{s.startDate}</strong> হতে{' '}
                        <strong>{s.endDate}</strong> · ঘাটতি/ড্যামেজ সমন্বয়:{' '}
                        {formatBn(s.damageOrAdjustmentBricks || 0)} পিস
                      </div>
                      {s.closingNoteBn && (
                        <div className="text-[11px] text-slate-500">
                          সমাপনী নোট: {s.closingNoteBn}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterMode('SEASON');
                          setSelectedSeasonId(s.id);
                          setSubView('OVERVIEW_12M');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
                      >
                        রিপোর্ট দেখুন
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSeasonForEdit(s)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 cursor-pointer"
                      >
                        সম্পাদনা
                      </button>

                      {s.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCloseModalSeason(s);
                            setClosingDamageInput(
                              String(s.damageOrAdjustmentBricks || 0)
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          সিজন সমাপ্ত করুন
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReopenModalSeason(s);
                            setReopenDamageInput(
                              String(s.damageOrAdjustmentBricks || 0)
                            );
                            setReopenReasonInput('');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          পুনরায় চালু / সংশোধন
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Two-Season Side-by-Side Comparison Studio */}
          <div
            data-testid="season-comparison-studio"
            className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-5 shadow-xs space-y-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-indigo-700 text-xs font-extrabold tracking-wide mb-1">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>দুই সিজনের আর্থিক ও উৎপাদন পারফরম্যান্স বিশ্লেষণ</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  দুইটি ভিন্ন সিজনের তুলনামূলক রিপোর্ট (Side-by-Side Season Variance Comparison)
                </h3>
                <p className="text-xs text-slate-500">
                  যেকোনো দুইটি সিজন নির্বাচন করে মোট ইট বিক্রয় (Sales), উৎপাদন (Production) এবং খরচের (Expenses) পার্থক্য ও শতকরা হার এক নজরে দেখুন
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2.5">
                <div>
                  <label
                    htmlFor="compare-season-a"
                    className="block text-[11px] font-bold text-orange-800 mb-0.5"
                  >
                    ১ম সিজন নির্বাচন করুন (Season A)
                  </label>
                  <select
                    id="compare-season-a"
                    data-testid="compare-season-a-select"
                    value={compareSeasonAId}
                    onChange={(e) => setCompareSeasonAId(e.target.value)}
                    className="px-3 py-2 text-xs font-bold bg-orange-50/70 border border-orange-300 text-slate-900 rounded-xl focus:outline-hidden focus:border-orange-600"
                  >
                    {kilnSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn} ({s.startDate} – {s.endDate})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  data-testid="swap-compare-seasons-btn"
                  onClick={() => {
                    const prevA = compareSeasonAId;
                    setCompareSeasonAId(compareSeasonBId);
                    setCompareSeasonBId(prevA);
                  }}
                  title="১ম ও ২য় সিজন অদলবদল করুন"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                  <span>অদলবদল</span>
                </button>

                <div>
                  <label
                    htmlFor="compare-season-b"
                    className="block text-[11px] font-bold text-indigo-800 mb-0.5"
                  >
                    ২য় সিজন নির্বাচন করুন (Season B)
                  </label>
                  <select
                    id="compare-season-b"
                    data-testid="compare-season-b-select"
                    value={compareSeasonBId}
                    onChange={(e) => setCompareSeasonBId(e.target.value)}
                    className="px-3 py-2 text-xs font-bold bg-indigo-50/70 border border-indigo-300 text-slate-900 rounded-xl focus:outline-hidden focus:border-indigo-600"
                  >
                    {kilnSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn} ({s.startDate} – {s.endDate})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  data-testid="export-season-comparison-csv"
                  onClick={handleExportSeasonComparisonCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>তুলনা CSV</span>
                </button>
              </div>
            </div>

            {compareSeasonAId === compareSeasonBId && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-900 flex items-center justify-between gap-2">
                <span>
                  আপনি উভয় ঘরে একই সিজন নির্বাচন করেছেন। সঠিক পার্থক্য দেখার জন্য ২য় সিজনে ভিন্ন একটি সিজন নির্বাচন করুন।
                </span>
                {kilnSeasons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const other = kilnSeasons.find((s) => s.id !== compareSeasonAId);
                      if (other) setCompareSeasonBId(other.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-extrabold cursor-pointer shrink-0"
                  >
                    ভিন্ন সিজন নিন
                  </button>
                )}
              </div>
            )}

            {/* 4 Key Side-by-Side Variance Highlight Cards: Total Sales, Production, Total Expenses, Actual Collections */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* 1. Total Sales Variance Card */}
              <div
                data-testid="variance-card-sales"
                className="bg-slate-50/90 border border-slate-200 border-t-4 border-t-orange-600 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800">
                    ১. মোট ইট বিক্রয় পার্থক্য (Sales Variance)
                  </span>
                  <span
                    data-testid="variance-sales-pct"
                    className={`text-xs font-extrabold font-mono tabular-nums ${
                      seasonComparison.sales.diffAminusB >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.sales.diffAminusB >= 0 ? '+' : ''}
                    {formatBn(seasonComparison.sales.variancePct)}%
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span className="truncate">{compareReportA.periodTitleBn}:</span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {formatCurrencyBn(seasonComparison.sales.seasonAValue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.sales.seasonABarPct}%` }}
                        className="h-full bg-orange-600 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span className="truncate">{compareReportB.periodTitleBn}:</span>
                      <span className="font-mono text-slate-800 tabular-nums">
                        {formatCurrencyBn(seasonComparison.sales.seasonBValue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.sales.seasonBBarPct}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">বিক্রয় ব্যবধান (১ম − ২য়):</span>
                  <span
                    data-testid="variance-sales-diff"
                    className={`font-mono font-extrabold tabular-nums ${
                      seasonComparison.sales.diffAminusB >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.sales.diffAminusB >= 0 ? '+' : ''}
                    {formatCurrencyBn(seasonComparison.sales.diffAminusB)}
                  </span>
                </div>
              </div>

              {/* 2. Production Variance Card (Raw & Fired Bricks) */}
              <div
                data-testid="variance-card-production"
                className="bg-slate-50/90 border border-slate-200 border-t-4 border-t-amber-500 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800">
                    ২. ইট উৎপাদন পার্থক্য (Production Variance)
                  </span>
                  <span
                    data-testid="variance-production-pct"
                    className={`text-xs font-extrabold font-mono tabular-nums ${
                      seasonComparison.rawProduction.diffAminusB >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.rawProduction.diffAminusB >= 0 ? '+' : ''}
                    {formatBn(seasonComparison.rawProduction.variancePct)}%
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span className="truncate">১ম সিজন (কাঁচা / পাকা):</span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {formatBn(seasonComparison.rawProduction.seasonAValue)} /{' '}
                        {formatBn(seasonComparison.pakaProduction.seasonAValue)} পিস
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.rawProduction.seasonABarPct}%` }}
                        className="h-full bg-amber-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span className="truncate">২য় সিজন (কাঁচা / পাকা):</span>
                      <span className="font-mono text-slate-800 tabular-nums">
                        {formatBn(seasonComparison.rawProduction.seasonBValue)} /{' '}
                        {formatBn(seasonComparison.pakaProduction.seasonBValue)} পিস
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.rawProduction.seasonBBarPct}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">কাঁচা / পাকা ব্যবধান:</span>
                  <span
                    data-testid="variance-production-diff"
                    className={`font-mono font-extrabold tabular-nums ${
                      seasonComparison.rawProduction.diffAminusB >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.rawProduction.diffAminusB >= 0 ? '+' : ''}
                    {formatBn(seasonComparison.rawProduction.diffAminusB)} /{' '}
                    {seasonComparison.pakaProduction.diffAminusB >= 0 ? '+' : ''}
                    {formatBn(seasonComparison.pakaProduction.diffAminusB)} পিস
                  </span>
                </div>
              </div>

              {/* 3. Total Expenses Variance Card */}
              <div
                data-testid="variance-card-expenses"
                className="bg-slate-50/90 border border-slate-200 border-t-4 border-t-rose-600 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800">
                    ৩. মোট ভাটা খরচ পার্থক্য (Expenses Variance)
                  </span>
                  <span
                    data-testid="variance-expenses-pct"
                    className={`text-xs font-extrabold font-mono tabular-nums ${
                      seasonComparison.expenses.diffAminusB <= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.expenses.diffAminusB >= 0 ? '+' : ''}
                    {formatBn(seasonComparison.expenses.variancePct)}%
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span className="truncate">{compareReportA.periodTitleBn}:</span>
                      <span className="font-mono text-rose-800 tabular-nums">
                        {formatCurrencyBn(seasonComparison.expenses.seasonAValue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.expenses.seasonABarPct}%` }}
                        className="h-full bg-rose-600 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span className="truncate">{compareReportB.periodTitleBn}:</span>
                      <span className="font-mono text-slate-800 tabular-nums">
                        {formatCurrencyBn(seasonComparison.expenses.seasonBValue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.expenses.seasonBBarPct}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">খরচের ব্যবধান (১ম − ২য়):</span>
                  <span
                    data-testid="variance-expenses-diff"
                    className={`font-mono font-extrabold tabular-nums ${
                      seasonComparison.expenses.diffAminusB <= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.expenses.diffAminusB >= 0 ? '+' : ''}
                    {formatCurrencyBn(seasonComparison.expenses.diffAminusB)}
                  </span>
                </div>
              </div>

              {/* 4. Actual Cash Collections & Net Cash Variance Card */}
              <div
                data-testid="variance-card-collections"
                className="bg-slate-50/90 border border-slate-200 border-t-4 border-t-emerald-600 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800">
                    ৪. প্রকৃত নগদ আদায় পার্থক্য (Cash Collection)
                  </span>
                  <span
                    data-testid="variance-collections-pct"
                    className={`text-xs font-extrabold font-mono tabular-nums ${
                      seasonComparison.collections.diffAminusB >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.collections.diffAminusB >= 0 ? '+' : ''}
                    {formatBn(seasonComparison.collections.variancePct)}%
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span className="truncate">{compareReportA.periodTitleBn}:</span>
                      <span className="font-mono text-emerald-800 tabular-nums">
                        {formatCurrencyBn(seasonComparison.collections.seasonAValue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.collections.seasonABarPct}%` }}
                        className="h-full bg-emerald-600 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span className="truncate">{compareReportB.periodTitleBn}:</span>
                      <span className="font-mono text-slate-800 tabular-nums">
                        {formatCurrencyBn(seasonComparison.collections.seasonBValue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${seasonComparison.collections.seasonBBarPct}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">আদায় ব্যবধান (১ম − ২য়):</span>
                  <span
                    data-testid="variance-collections-diff"
                    className={`font-mono font-extrabold tabular-nums ${
                      seasonComparison.collections.diffAminusB >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {seasonComparison.collections.diffAminusB >= 0 ? '+' : ''}
                    {formatCurrencyBn(seasonComparison.collections.diffAminusB)}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Side-by-Side Variance Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table
                data-testid="season-comparison-table"
                className="w-full text-xs sm:text-sm text-left border-collapse"
              >
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-4 font-bold">হিসাবের বিবরণ (Metric)</th>
                    <th className="py-3 px-4 font-bold text-right text-orange-300">
                      ১ম: {compareReportA.periodTitleBn}
                    </th>
                    <th className="py-3 px-4 font-bold text-right text-indigo-300">
                      ২য়: {compareReportB.periodTitleBn}
                    </th>
                    <th className="py-3 px-4 font-bold text-center w-36">
                      তুলনামূলক চিত্র
                    </th>
                    <th className="py-3 px-4 font-bold text-right text-emerald-300">
                      পার্থক্য (১ম − ২য় সিজন)
                    </th>
                    <th className="py-3 px-4 font-bold text-right text-amber-300">
                      শতকরা হার (%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {seasonComparison.rows.map((row) => {
                    const diff = row.metric.diffAminusB;
                    const isFavorable = row.favorableWhenHigher
                      ? diff >= 0
                      : diff <= 0;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {row.labelBn}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {row.isCurrency
                            ? formatCurrencyBn(row.metric.seasonAValue)
                            : `${formatBn(row.metric.seasonAValue)} পিস`}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700 tabular-nums">
                          {row.isCurrency
                            ? formatCurrencyBn(row.metric.seasonBValue)
                            : `${formatBn(row.metric.seasonBValue)} পিস`}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="space-y-1 w-28 mx-auto">
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${row.metric.seasonABarPct}%` }}
                                className="h-full bg-orange-600 rounded-full"
                              />
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${row.metric.seasonBBarPct}%` }}
                                className="h-full bg-indigo-600 rounded-full"
                              />
                            </div>
                          </div>
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-extrabold tabular-nums ${
                            diff === 0
                              ? 'text-slate-600'
                              : isFavorable
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {diff > 0 ? '+' : ''}
                          {row.isCurrency
                            ? formatCurrencyBn(diff)
                            : `${formatBn(diff)} পিস`}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums ${
                            diff === 0
                              ? 'text-slate-500'
                              : isFavorable
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {row.metric.variancePct > 0 ? '+' : ''}
                          {formatBn(row.metric.variancePct)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 3: SEASON OPENING AND CLOSING RECONCILIATION REPORT
      ===================================================================== */}
      {subView === 'OPENING_CLOSING' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  সিজন ও বার্ষিক প্রারম্ভিক এবং সমাপনী হিসাব মিলকরণ বিবরণী (Opening & Closing Reconciliation)
                </h3>
                <p className="text-xs text-slate-600">
                  পুরাতন বকেয়া বা সাপ্লায়ার ব্যালেন্স স্বয়ংক্রিয়ভাবে অন্য সিজনে সরিয়ে ফেলা হয় না — প্রারম্ভিক জের, মেয়াদের লেনদেন এবং সমাপনী জের আলাদাভাবে নিচে দেখানো হলো।
                </p>
              </div>

              {report.selectedSeason && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {report.selectedSeason.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCloseModalSeason(report.selectedSeason!);
                        setClosingDamageInput(
                          String(report.selectedSeason!.damageOrAdjustmentBricks || 0)
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-amber-300 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      পর্যালোচনা ও সিজন সমাপনী নিশ্চিত করুন
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReopenModalSeason(report.selectedSeason!);
                        setReopenDamageInput(
                          String(report.selectedSeason!.damageOrAdjustmentBricks || 0)
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      সমাপ্ত সিজন পুনরায় চালু / অডিট সংশোধন
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 4 Reconciliation Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 1. Customer Receivables Reconciliation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    ১. ক্রেতার বকেয়া পাওনা হিসাব (Customer Receivables)
                  </span>
                  <span className="text-xs font-bold text-orange-700">
                    প্রারম্ভিক + বিক্রি − আদায় = সমাপনী
                  </span>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      প্রারম্ভিক ক্রেতা বকেয়া (Opening Receivables):
                    </span>
                    <span
                      data-testid="recon-opening-receivables"
                      className="font-mono font-bold tabular-nums"
                    >
                      {formatCurrencyBn(report.reconciliation.openingCustomerReceivables)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (+) এই সময়ের নতুন ইট বিক্রি (New Sales):
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      + {formatCurrencyBn(report.reconciliation.periodNewSales)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (−) ক্রেতাদের থেকে প্রকৃত নগদ আদায় (Collections):
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      − {formatCurrencyBn(report.reconciliation.periodCustomerCollections)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-extrabold text-sm">
                    <span className="text-slate-900">
                      সমাপনী ক্রেতা বকেয়া পাওনা (Closing Receivables):
                    </span>
                    <span
                      data-testid="recon-closing-receivables"
                      className="font-mono text-rose-700 tabular-nums"
                    >
                      {formatCurrencyBn(report.reconciliation.closingCustomerReceivables)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Stock Reconciliation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    ২. ইট স্টক ও ইনভেন্টরি সমীকরণ (Stock Movement)
                  </span>
                  <span className="text-xs font-bold text-cyan-700">
                    প্রারম্ভিক + উৎপাদন − বিক্রি − ঘাটতি = সমাপনী
                  </span>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">প্রারম্ভিক ইট স্টক (Opening Stock):</span>
                    <span className="font-mono font-bold tabular-nums">
                      {formatBn(report.reconciliation.openingStockBricks)} পিস
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (+) পাকা ইট উৎপাদন / আনলোড (Production):
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      + {formatBn(report.reconciliation.periodProducedBricks)} পিস
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (−) মেমোতে ইট বিক্রয় পরিমাণ (Sales Quantities):
                    </span>
                    <span className="font-mono font-bold text-orange-700 tabular-nums">
                      − {formatBn(report.reconciliation.periodSoldBricks)} পিস
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (−) ঘাটতি / ভাঙা বা সমন্বয় (Damage / Adjustments):
                    </span>
                    <span className="font-mono font-bold text-rose-700 tabular-nums">
                      − {formatBn(report.reconciliation.damageOrAdjustmentBricks)} পিস
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-extrabold text-sm">
                    <span className="text-slate-900">সমাপনী পাকা ইট স্টক (Closing Stock):</span>
                    <span
                      data-testid="recon-closing-stock"
                      className="font-mono text-cyan-800 tabular-nums"
                    >
                      {formatBn(report.reconciliation.closingStockBricks)} পিস
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Cash & Account Balance Reconciliation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    ৩. ক্যাশ ও তহবিল ব্যালেন্স সমীকরণ (Cash & Account Balance)
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    প্রারম্ভিক + প্রাপ্তি − খরচ = সমাপনী ক্যাশ
                  </span>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      প্রারম্ভিক ক্যাশ ব্যালেন্স (Opening Cash Balance):
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      {formatCurrencyBn(report.reconciliation.openingCashBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (+) মোট নগদ প্রাপ্তি (আদায় + অন্যান্য জমা):
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      + {formatCurrencyBn(report.reconciliation.periodCashReceived)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">(−) মোট ভাটা খরচ (Total Expenses):</span>
                    <span className="font-mono font-bold text-rose-700 tabular-nums">
                      − {formatCurrencyBn(report.reconciliation.periodTotalExpenses)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-extrabold text-sm">
                    <span className="text-slate-900">
                      সমাপনী ক্যাশ ও তহবিল ব্যালেন্স (Closing Cash):
                    </span>
                    <span
                      data-testid="recon-closing-cash"
                      className="font-mono text-emerald-800 tabular-nums"
                    >
                      {formatCurrencyBn(report.reconciliation.closingCashBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Supplier, Mill, Sardar & Labor Liabilities */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    ৪. সাপ্লায়ার, মিল, সর্দার ও লেবার দেনা (Liabilities)
                  </span>
                  <span className="text-xs font-bold text-purple-700">
                    প্রারম্ভিক + মোট বিল − পরিশোধ = সমাপনী দেনা
                  </span>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      প্রারম্ভিক সর্দার ও লেবার বকেয়া (Opening Liabilities):
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      {formatCurrencyBn(report.reconciliation.openingLiabilities)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (+) এই সময়ের মিল, ভ্যান, পোড়াই, আনলোড ও হাজিরা বিল:
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      + {formatCurrencyBn(report.reconciliation.periodIncurredLiabilities)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      (−) সর্দার, মিল ও শ্রমিকদের পরিশোধিত টাকা:
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      − {formatCurrencyBn(report.reconciliation.periodPaidLiabilities)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-extrabold text-sm">
                    <span className="text-slate-900">
                      সমাপনী সাপ্লায়ার ও লেবার দেনা (Closing Liabilities):
                    </span>
                    <span
                      data-testid="recon-closing-liabilities"
                      className="font-mono text-rose-700 tabular-nums"
                    >
                      {formatCurrencyBn(report.reconciliation.closingLiabilities)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Season Revision & Audit History */}
            {report.selectedSeason &&
              Array.isArray(report.selectedSeason.revisionHistory) && (
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      সিজন রিভিশন ও অডিট ইতিহাস ({report.selectedSeason.nameBn})
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {report.selectedSeason.revisionHistory.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-extrabold text-amber-300 mr-2">
                            [{rev.action}]
                          </span>
                          <span className="text-white font-semibold">
                            {rev.reasonBn}
                          </span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          দ্বারা: {rev.actorName} · {rev.timestamp.slice(0, 19).replace('T', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 4: HISTORICAL RECORD ARCHIVE & UNDERLYING LEDGER
      ===================================================================== */}
      {subView === 'HISTORICAL_ARCHIVE' && (
        <div className="space-y-5">
          {/* Opening -> Period -> Closing Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 border-l-4 border-l-slate-700 rounded-xl p-4">
              <span className="text-xs font-bold text-slate-500 block">
                প্রারম্ভিক জের (নির্বাচিত সময়ের পূর্বে — {report.startDate} এর আগে)
              </span>
              <div className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">
                ক্রেতা পাওনা: {formatCurrencyBn(report.reconciliation.openingCustomerReceivables)}
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                প্রারম্ভিক ক্যাশ: {formatCurrencyBn(report.reconciliation.openingCashBalance)} · স্টক:{' '}
                {formatBn(report.reconciliation.openingStockBricks)} পিস
              </div>
            </div>

            <div className="bg-white border border-slate-200 border-l-4 border-l-orange-600 rounded-xl p-4">
              <span className="text-xs font-bold text-orange-700 block">
                নির্বাচিত মেয়াদের লেনদেন ({report.startDate} হতে {report.endDate})
              </span>
              <div className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">
                বিক্রি: {formatCurrencyBn(report.totalSalesAmount)} · নগদ আদায়:{' '}
                {formatCurrencyBn(report.totalActualCollections)}
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                খরচ: {formatCurrencyBn(report.totalExpenses)} · মোট রেকর্ড:{' '}
                {formatBn(report.archiveEntries.length)}টি
              </div>
            </div>

            <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-xl p-4">
              <span className="text-xs font-bold text-emerald-700 block">
                সমাপনী জের ({report.endDate} তারিখে সমাপনী অবস্থা)
              </span>
              <div className="text-sm font-extrabold text-rose-700 mt-1 tabular-nums">
                সমাপনী ক্রেতা পাওনা:{' '}
                {formatCurrencyBn(report.reconciliation.closingCustomerReceivables)}
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                সমাপনী ক্যাশ: {formatCurrencyBn(report.reconciliation.closingCashBalance)} · স্টক:{' '}
                {formatBn(report.reconciliation.closingStockBricks)} পিস
              </div>
            </div>
          </div>

          {/* Archive Search & Multi-Filter Bar */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  পুরাতন ও ঐতিহাসিক লেনদেন অনুসন্ধান ফিল্টার (Historical Archive Filters)
                </h3>
              </div>
              {(archiveCustomerQuery ||
                archiveMemoQuery ||
                archiveTxType !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setArchiveCustomerQuery('');
                    setArchiveMemoQuery('');
                    setArchiveTxType('ALL');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ফিল্টার রিসেট করুন
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="archive-customer-search"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  ক্রেতা, সর্দার বা খাতের নাম দিয়ে খুঁজুন
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="archive-customer-search"
                    type="text"
                    placeholder="ক্রেতার নাম, মোবাইল বা বিবরণ..."
                    value={archiveCustomerQuery}
                    onChange={(e) => setArchiveCustomerQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="archive-memo-search"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  মেমো নম্বর দিয়ে খুঁজুন (Memo Number)
                </label>
                <input
                  id="archive-memo-search"
                  type="text"
                  placeholder="যেমন: 3001, 2501..."
                  value={archiveMemoQuery}
                  onChange={(e) => setArchiveMemoQuery(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="archive-tx-type-select"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  লেনদেনের ধরন (Transaction Type)
                </label>
                <select
                  id="archive-tx-type-select"
                  value={archiveTxType}
                  onChange={(e) =>
                    setArchiveTxType(e.target.value as ArchiveTransactionType)
                  }
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
                >
                  <option value="ALL">সকল ধরনের লেনদেন (All Records)</option>
                  <option value="SALES_MEMO">মেমো বিক্রি (Sales Memos)</option>
                  <option value="COLLECTION">
                    নগদ ও বকেয়া আদায় (Actual Collections)
                  </option>
                  <option value="EXPENSE">ভাটা খরচ (Kiln Expenses)</option>
                  <option value="SOIL_PURCHASE">
                    মাটির ট্রাক ও কাঁচামাল ক্রয় (Soil & Raw Material)
                  </option>
                  <option value="PRODUCTION">
                    ইট উৎপাদন (মিল, ভ্যান, পোড়াই, আনলোড)
                  </option>
                  <option value="DELIVERY">ইট ডেলিভারি ট্রিপ (Brick Deliveries)</option>
                  <option value="LABOR">লেবার হাজিরা ও পেমেন্ট (Labor Records)</option>
                </select>
              </div>
            </div>

            {/* Archive Ledger Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table
                data-testid="historical-archive-table"
                className="w-full text-xs sm:text-sm text-left border-collapse"
              >
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-3 font-bold">তারিখ</th>
                    <th className="py-3 px-3 font-bold">ধরন</th>
                    <th className="py-3 px-3 font-bold">ভাটা ইউনিট</th>
                    <th className="py-3 px-3 font-bold">মেমো নং</th>
                    <th className="py-3 px-3 font-bold">ক্রেতা / সর্দার / খাত</th>
                    <th className="py-3 px-3 font-bold">বিস্তারিত বিবরণ</th>
                    <th className="py-3 px-3 font-bold text-right">ইট (পিস)</th>
                    <th className="py-3 px-3 font-bold text-right">মোট বিল/প্রদেয়</th>
                    <th className="py-3 px-3 font-bold text-right text-emerald-300">
                      নগদ জমা
                    </th>
                    <th className="py-3 px-3 font-bold text-right text-rose-300">
                      নগদ খরচ/পরিশোধ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.archiveEntries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-10 text-center text-xs text-slate-500"
                      >
                        এই ফিল্টারে কোনো সংরক্ষিত ঐতিহাসিক লেনদেন পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    report.archiveEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-orange-50/30">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">
                          {entry.txTypeLabelBn}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">
                          {entry.kilnNameBn}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-orange-700">
                          {entry.memoNo ? `#${entry.memoNo}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div>{entry.partyName}</div>
                          {entry.partyPhone && entry.partyPhone !== '—' && (
                            <div className="text-[11px] font-normal text-slate-500">
                              {entry.partyPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-700">
                          {entry.descriptionBn}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {entry.quantityPieces
                            ? `${formatBn(entry.quantityPieces)} পিস`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                          {entry.billedOrPayableAmount > 0
                            ? formatCurrencyBn(entry.billedOrPayableAmount)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                          {entry.cashInAmount > 0
                            ? formatCurrencyBn(entry.cashInAmount)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                          {entry.cashOutAmount > 0
                            ? formatCurrencyBn(entry.cashOutAmount)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <td colSpan={6} className="py-3 px-3 text-right">
                      ফিল্টারকৃত মোট ({formatBn(report.filteredArchiveTotals.count)}টি রেকর্ড):
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatBn(report.filteredArchiveTotals.totalBricksQty)} পিস
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatCurrencyBn(report.filteredArchiveTotals.totalBilled)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-800 tabular-nums">
                      {formatCurrencyBn(report.filteredArchiveTotals.totalCashIn)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-800 tabular-nums">
                      {formatCurrencyBn(report.filteredArchiveTotals.totalCashOut)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: SEASON CLOSING REVIEW & CONFIRMATION WORKFLOW
      ===================================================================== */}
      {closeModalSeason && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="সিজন সমাপনী পর্যালোচনা ও নিশ্চিতকরণ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 animate-modal-backdrop"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-modal-pop">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    সিজন সমাপনী পর্যালোচনা ও নিশ্চিতকরণ (Season Closing Confirmation)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {closeModalSeason.nameBn} ({closeModalSeason.startDate} –{' '}
                    {closeModalSeason.endDate})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloseModalSeason(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="font-extrabold">নিরাপত্তা গ্যারান্টি:</div>
              <div>
                সিজন সমাপ্ত হিসেবে চিহ্নিত করলেও আপনার কোনো পুরাতন মেমো, ক্যাশ লেনদেন, ক্রেতার বকেয়া বা স্টক ডিলিট বা পরিবর্তন হবে না। ভবিষ্যতে যেকোনো সময় অনুমোদিত কারণ লিখে এটি পুনরায় চালু বা সংশোধন করা যাবে।
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">সমাপনী ক্রেতা বকেয়া পাওনা:</span>
                <strong className="text-rose-700 text-sm tabular-nums">
                  {formatCurrencyBn(report.reconciliation.closingCustomerReceivables)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">সমাপনী ক্যাশ ব্যালেন্স:</span>
                <strong className="text-emerald-700 text-sm tabular-nums">
                  {formatCurrencyBn(report.reconciliation.closingCashBalance)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">সমাপনী পাকা ইট স্টক:</span>
                <strong className="text-slate-900 text-sm tabular-nums">
                  {formatBn(report.reconciliation.closingStockBricks)} পিস
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">সর্দার ও লেবার সমাপনী দেনা:</span>
                <strong className="text-rose-700 text-sm tabular-nums">
                  {formatCurrencyBn(report.reconciliation.closingLiabilities)}
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="close-season-damage"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  সিজন শেষে ভাঙা/ঘাটতি ইট সমন্বয় (পিস)
                </label>
                <input
                  id="close-season-damage"
                  type="number"
                  min={0}
                  value={closingDamageInput}
                  onChange={(e) => setClosingDamageInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label
                  htmlFor="close-season-note"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  সমাপনী পর্যালোচনা নোট *
                </label>
                <input
                  id="close-season-note"
                  type="text"
                  value={closingNoteInput}
                  onChange={(e) => setClosingNoteInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCloseModalSeason(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onCloseSeason(closeModalSeason.id, {
                    closingNoteBn: closingNoteInput,
                    damageOrAdjustmentBricks: Math.max(
                      0,
                      Number(closingDamageInput) || 0
                    ),
                  });
                  setCloseModalSeason(null);
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-amber-300 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                হিসাব যাচাই করে সিজন সমাপ্ত নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: AUTHORIZED SEASON REOPENING / AUDITABLE ADJUSTMENT
      ===================================================================== */}
      {reopenModalSeason && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="সমাপ্ত সিজন পুনরায় চালু ও অডিট সংশোধন"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 animate-modal-backdrop"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-modal-pop">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    সমাপ্ত সিজন পুনরায় চালু ও অডিট সংশোধন (Authorized Reopen)
                  </h3>
                  <p className="text-xs text-slate-500">{reopenModalSeason.nameBn}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReopenModalSeason(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="reopen-season-reason"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  পুনরায় চালু বা সংশোধনের অনুমোদিত কারণ লিখুন (অডিট লগে সংরক্ষিত থাকবে) *
                </label>
                <input
                  id="reopen-season-reason"
                  type="text"
                  required
                  placeholder="যেমন: পুরাতন মেমো বকেয়া সমন্বয় বা স্টক যাচাইয়ের জন্য পুনরায় খোলা হলো..."
                  value={reopenReasonInput}
                  onChange={(e) => setReopenReasonInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="reopen-season-damage"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  ঘাটতি/ড্যামেজ ইট সমন্বয় (পিস)
                </label>
                <input
                  id="reopen-season-damage"
                  type="number"
                  min={0}
                  value={reopenDamageInput}
                  onChange={(e) => setReopenDamageInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReopenModalSeason(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={!reopenReasonInput.trim()}
                onClick={async () => {
                  await onReopenSeason(reopenModalSeason.id, {
                    reasonBn: reopenReasonInput.trim(),
                    damageOrAdjustmentBricks: Math.max(
                      0,
                      Number(reopenDamageInput) || 0
                    ),
                  });
                  setReopenModalSeason(null);
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 text-white cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                অনুমোদন ও পুনরায় চালু করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: OFFICIAL BENGALI PRINT & PDF REPORT PREVIEW
      ===================================================================== */}
      {isPrintReportOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="প্রিন্ট ও পিডিএফ রিপোর্ট প্রিভিউ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto animate-modal-backdrop"
        >
          <div className="bg-white border border-slate-300 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-modal-pop">
            {/* Non-print Action Bar */}
            <div className="no-print px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    অফিসিয়াল প্রিন্ট ও PDF রিপোর্ট প্রিভিউ — {report.periodTitleBn}
                  </h3>
                  <p className="text-xs text-slate-300">
                    প্রিন্ট বাটনে ক্লিক করে সরাসরি প্রিন্ট করুন অথবা &ldquo;Save as PDF&rdquo; সিলেক্ট করে PDF ডাউনলোড করুন
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  এখনই প্রিন্ট / PDF সেভ করুন
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintReportOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>

            {/* Printable Report Body */}
            <div
              id="printable-area"
              className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 bg-white"
            >
              {/* Official Bengali Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 tabular-nums">
                    প্রোঃ মোঃ কামরুল ইসলাম সাহেব (01913-678010) · পরিচালনায়ঃ সাকিব হোসেন (01728-287018)
                  </p>
                  <p className="text-xs text-slate-600">
                    নির্বাচিত ভাটা: {report.kilnNameBn} · ঠিকানা: বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা
                  </p>
                </div>
                <div className="sm:text-right text-xs space-y-0.5">
                  <div className="text-sm font-extrabold text-slate-900">
                    {report.periodTitleBn}
                  </div>
                  <div>
                    সময়কাল: {report.startDate} হতে {report.endDate}
                  </div>
                  <div>
                    রিপোর্ট তৈরির তারিখ: {new Date().toISOString().slice(0, 10)}
                  </div>
                </div>
              </div>

              {/* Summary Totals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-slate-300 rounded-xl p-4">
                <div>
                  <span className="text-slate-500 block">মোট ইট বিক্রি বিল:</span>
                  <strong className="text-sm font-mono">
                    {formatCurrencyBn(report.totalSalesAmount)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">প্রকৃত নগদ আদায়:</span>
                  <strong className="text-sm font-mono text-emerald-800">
                    {formatCurrencyBn(report.totalActualCollections)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">মোট ভাটা খরচ:</span>
                  <strong className="text-sm font-mono text-rose-800">
                    {formatCurrencyBn(report.totalExpenses)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">নিট ক্যাশ প্রবাহ:</span>
                  <strong className="text-sm font-mono">
                    {formatCurrencyBn(report.netCashMovement)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">প্রারম্ভিক ক্রেতা পাওনা:</span>
                  <strong className="text-sm font-mono">
                    {formatCurrencyBn(report.reconciliation.openingCustomerReceivables)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">সমাপনী ক্রেতা পাওনা:</span>
                  <strong className="text-sm font-mono text-rose-800">
                    {formatCurrencyBn(report.reconciliation.closingCustomerReceivables)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">বিক্রিত ও ডেলিভারি ইট:</span>
                  <strong className="text-sm font-mono">
                    {formatBn(report.totalBricksSoldQty)} /{' '}
                    {formatBn(report.totalBricksDeliveredQty)} পিস
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">সমাপনী ইট স্টক:</span>
                  <strong className="text-sm font-mono">
                    {formatBn(report.reconciliation.closingStockBricks)} পিস
                  </strong>
                </div>
              </div>

              {/* 12-Month Breakdown in Print */}
              <div>
                <h4 className="text-sm font-extrabold mb-2">
                  ১. মাসওয়ারী ১২ মাসের হিসাব বিবরণী (Monthly Breakdown)
                </h4>
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="py-1.5 px-2 border border-slate-300 text-left">মাস</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">মেমো</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">বিক্রি (৳)</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">নগদ আদায় (৳)</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">খরচ (৳)</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">ইট বিক্রি (পিস)</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">বকেয়া জের (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyBreakdown.map((m) => (
                      <tr key={m.monthKey}>
                        <td className="py-1 px-2 border border-slate-300 font-semibold">
                          {m.monthLabelBn}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {formatBn(m.memoCount)}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {formatCurrencyBn(m.salesAmount)}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {formatCurrencyBn(m.actualCollectionAmount)}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {formatCurrencyBn(m.expenseAmount)}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {formatBn(m.bricksSoldQty)}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {formatCurrencyBn(m.cumulativeReceivables)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detailed Transactions Table in Print */}
              <div>
                <h4 className="text-sm font-extrabold mb-2">
                  ২. বিস্তারিত লেনদেন খতিয়ান ({formatBn(report.archiveEntries.length)}টি রেকর্ড)
                </h4>
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="py-1.5 px-2 border border-slate-300 text-left">তারিখ</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-left">ধরন</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-left">ক্রেতা / খাত</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-left">বিবরণ</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">বিল (৳)</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">জমা (৳)</th>
                      <th className="py-1.5 px-2 border border-slate-300 text-right">খরচ (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.archiveEntries.slice(0, 100).map((e) => (
                      <tr key={e.id}>
                        <td className="py-1 px-2 border border-slate-300 font-mono">
                          {e.date}
                        </td>
                        <td className="py-1 px-2 border border-slate-300">
                          {e.txTypeLabelBn}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 font-semibold">
                          {e.partyName}
                        </td>
                        <td className="py-1 px-2 border border-slate-300">
                          {e.descriptionBn}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {e.billedOrPayableAmount > 0
                            ? formatCurrencyBn(e.billedOrPayableAmount)
                            : '—'}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {e.cashInAmount > 0 ? formatCurrencyBn(e.cashInAmount) : '—'}
                        </td>
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                          {e.cashOutAmount > 0 ? formatCurrencyBn(e.cashOutAmount) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
