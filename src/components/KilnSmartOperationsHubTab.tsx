import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CalendarCheck2,
  CheckCircle2,
  Copy,
  CreditCard,
  Flame,
  Layers,
  MessageSquare,
  Phone,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type {
  DailyKilnGoals,
  EstimatedCostOverrides,
  KilnDatabaseState,
  NavigationTab,
  SalesMemo,
} from '../types/kiln';
import {
  computeDailyClosingSheet,
  computeDailyGoalProgress,
  computeDueTagadaList,
  computeEstimatedPerThousandBrickCost,
  formatBn,
  formatCurrencyBn,
} from '../utils/kilnLogic';

export type SmartHubSection = 'hazar_khoroch' | 'due_tagada' | 'daily_closing';

interface KilnSmartOperationsHubTabProps {
  activeSection: SmartHubSection;
  onSelectSection: (section: SmartHubSection) => void;
  state: KilnDatabaseState;
  todayDate: string;
  onSaveSettingsPatch: (patch: {
    dailyGoals?: DailyKilnGoals;
    estimatedCostOverrides?: EstimatedCostOverrides;
  }) => Promise<void>;
  onOpenDueModalForMemo: (memo: SalesMemo) => void;
  onViewMemo: (memo: SalesMemo) => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

export const KilnSmartOperationsHubTab: React.FC<KilnSmartOperationsHubTabProps> = ({
  activeSection,
  onSelectSection,
  state,
  todayDate,
  onSaveSettingsPatch,
  onOpenDueModalForMemo,
  onViewMemo,
  onNavigateTab,
}) => {
  // ---------------------------------------------------------------------------
  // 1. State for Estimated Per-1000 Cost Customizer (হাজার প্রতি ইট খরচ ও লাভ)
  // ---------------------------------------------------------------------------
  const initialOverrides = state.settings?.estimatedCostOverrides || {};
  const baseCostReport = computeEstimatedPerThousandBrickCost(state);

  const [millRateInput, setMillRateInput] = useState<string>(
    String(
      initialOverrides.millRatePerThousand ??
        baseCostReport.components.mill.actualRatePerThousand
    )
  );
  const [vanRateInput, setVanRateInput] = useState<string>(
    String(
      initialOverrides.vanLoadRatePerThousand ??
        baseCostReport.components.vanLoad.actualRatePerThousand
    )
  );
  const [poraiRateInput, setPoraiRateInput] = useState<string>(
    String(
      initialOverrides.poraiRatePerThousand ??
        baseCostReport.components.porai.actualRatePerThousand
    )
  );
  const [unloadLineRateInput, setUnloadLineRateInput] = useState<string>(
    String(initialOverrides.unloadRatePerLine ?? 750)
  );
  const [soilCostInput, setSoilCostInput] = useState<string>(
    String(
      initialOverrides.soilCostPerThousand ??
        baseCostReport.components.soil.actualRatePerThousand
    )
  );
  const [coalWoodCostInput, setCoalWoodCostInput] = useState<string>(
    String(
      initialOverrides.coalWoodCostPerThousand ??
        baseCostReport.components.coalWood.actualRatePerThousand
    )
  );
  const [otherOverheadInput, setOtherOverheadInput] = useState<string>(
    String(
      initialOverrides.otherOverheadPerThousand ??
        baseCostReport.components.otherOverhead.actualRatePerThousand
    )
  );
  const [savingCostOverrides, setSavingCostOverrides] = useState(false);

  const liveOverrides: EstimatedCostOverrides = {
    millRatePerThousand: Math.max(0, Number(millRateInput) || 0),
    vanLoadRatePerThousand: Math.max(0, Number(vanRateInput) || 0),
    poraiRatePerThousand: Math.max(0, Number(poraiRateInput) || 0),
    unloadRatePerLine: Math.max(0, Number(unloadLineRateInput) || 750),
    soilCostPerThousand: Math.max(0, Number(soilCostInput) || 0),
    coalWoodCostPerThousand: Math.max(0, Number(coalWoodCostInput) || 0),
    otherOverheadPerThousand: Math.max(0, Number(otherOverheadInput) || 0),
  };

  const costReport = computeEstimatedPerThousandBrickCost(state, liveOverrides);

  const handleSaveEstimatedOverrides = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCostOverrides(true);
    try {
      await onSaveSettingsPatch({ estimatedCostOverrides: liveOverrides });
    } finally {
      setSavingCostOverrides(false);
    }
  };

  const handleResetToActualCost = async () => {
    const fresh = computeEstimatedPerThousandBrickCost(state, {});
    setMillRateInput(String(fresh.components.mill.actualRatePerThousand));
    setVanRateInput(String(fresh.components.vanLoad.actualRatePerThousand));
    setPoraiRateInput(String(fresh.components.porai.actualRatePerThousand));
    setUnloadLineRateInput('750');
    setSoilCostInput(String(fresh.components.soil.actualRatePerThousand));
    setCoalWoodCostInput(String(fresh.components.coalWood.actualRatePerThousand));
    setOtherOverheadInput(String(fresh.components.otherOverhead.actualRatePerThousand));
    await onSaveSettingsPatch({ estimatedCostOverrides: {} });
  };

  // ---------------------------------------------------------------------------
  // 2. State for Due Tagada & 1-Click WhatsApp Reminder (বকেয়া তাগাদা)
  // ---------------------------------------------------------------------------
  const [tagadaSearch, setTagadaSearch] = useState('');
  const [tagadaFilter, setTagadaFilter] = useState<'ALL' | 'OVERDUE' | 'WITH_PHONE'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tagadaData = computeDueTagadaList(
    state.salesMemos,
    state.advanceBookings || [],
    todayDate,
    state.settings?.bhataName || 'BrickFlow ইটভাটা'
  );

  const filteredTagadaItems = tagadaData.items.filter((item) => {
    if (tagadaFilter === 'OVERDUE' && !item.isOverdue) return false;
    if (tagadaFilter === 'WITH_PHONE' && item.cleanWhatsAppPhone.length < 10) return false;
    if (!tagadaSearch.trim()) return true;
    const q = tagadaSearch.trim().toLowerCase();
    return (
      item.customerName.toLowerCase().includes(q) ||
      item.customerPhone.toLowerCase().includes(q) ||
      item.referenceNo.toLowerCase().includes(q) ||
      item.customerAddress.toLowerCase().includes(q)
    );
  });

  const handleCopyReminderText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  // ---------------------------------------------------------------------------
  // 3. State for Daily Closing Sheet & Daily Goal Tracker (দৈনিক ক্লোজিং ও গোল)
  // ---------------------------------------------------------------------------
  const [closingDate, setClosingDate] = useState(todayDate);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalRawBricks, setGoalRawBricks] = useState(
    String(state.settings?.dailyGoals?.rawBricksCutTarget ?? 50000)
  );
  const [goalSoldBricks, setGoalSoldBricks] = useState(
    String(state.settings?.dailyGoals?.bricksSoldTarget ?? 30000)
  );
  const [goalCashIn, setGoalCashIn] = useState(
    String(state.settings?.dailyGoals?.cashCollectionTarget ?? 250000)
  );
  const [goalUnloadLines, setGoalUnloadLines] = useState(
    String(state.settings?.dailyGoals?.unloadLinesTarget ?? 8)
  );
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    if (state.settings?.dailyGoals) {
      setGoalRawBricks(String(state.settings.dailyGoals.rawBricksCutTarget));
      setGoalSoldBricks(String(state.settings.dailyGoals.bricksSoldTarget));
      setGoalCashIn(String(state.settings.dailyGoals.cashCollectionTarget));
      setGoalUnloadLines(String(state.settings.dailyGoals.unloadLinesTarget));
    }
  }, [state.settings?.dailyGoals]);

  const closingSheet = computeDailyClosingSheet(state, closingDate);
  const goalProgress = computeDailyGoalProgress(state, closingDate);

  const handleSaveDailyGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoals(true);
    try {
      await onSaveSettingsPatch({
        dailyGoals: {
          rawBricksCutTarget: Math.max(1000, Number(goalRawBricks) || 50000),
          bricksSoldTarget: Math.max(1000, Number(goalSoldBricks) || 30000),
          cashCollectionTarget: Math.max(1000, Number(goalCashIn) || 250000),
          unloadLinesTarget: Math.max(1, Number(goalUnloadLines) || 8),
        },
      });
      setEditingGoals(false);
    } finally {
      setSavingGoals(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Dedicated Module Header per Active Section */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {activeSection === 'hazar_khoroch' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <Calculator className="w-3.5 h-3.5" />
                ১,০০০ ইটের খরচ ও লাভ বিশ্লেষণ · কাস্টম রেট সমন্বয়
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                হাজার প্রতি ইট উৎপাদন খরচ, বিক্রয় দর ও নিট লাভ ক্যালকুলেটর
              </h2>
            </>
          )}

          {activeSection === 'due_tagada' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                বকেয়া তাগাদা তালিকা · ১-ক্লিকে WhatsApp মেসেজ
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                বকেয়া তাগাদা ও সরাসরি WhatsApp রিমাইন্ডার সেন্টার ({formatBn(tagadaData.items.length)} জন ক্রেতা)
              </h2>
            </>
          )}

          {activeSection === 'daily_closing' && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 mb-1">
                <CalendarCheck2 className="w-3.5 h-3.5" />
                তারিখভিত্তিক ক্লোজিং · ডেইলি অপারেশন অগ্রগতি
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                দৈনিক ডাটা ক্লোজিং শিট ও ডেইলি প্রোডাকশন গোল ট্র্যাকার
              </h2>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-orange-400" />
            প্রিন্ট ভিউ
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: আনুমানিক প্রতি ১,০০০ ইটের উৎপাদন খরচ ও বিক্রয় সমন্বয় ক্যালকুলেটর
         ===================================================================== */}
      {activeSection === 'hazar_khoroch' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-2xs">
              <span className="text-xs font-bold text-orange-800 block">
                আনুমানিক প্রতি ১,০০০ ইটের উৎপাদন খরচ
              </span>
              <strong className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums mt-1 block">
                {formatCurrencyBn(costReport.estimatedCostPerThousand)}
              </strong>
              <span className="text-xs text-slate-600 mt-1 block">
                প্রতি পিস ইটের আনুমানিক খরচ:{' '}
                <strong className="text-orange-700 font-mono">
                  ৳{formatBn(costReport.estimatedCostPerPiece)}
                </strong>
              </span>
            </div>

            <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 shadow-2xs">
              <span className="text-xs font-bold text-sky-800 block">
                মেমো অনুযায়ী গড় হাজার বিক্রয় দর (সব গ্রেড ও আদলাসহ)
              </span>
              <strong className="text-2xl font-extrabold font-mono text-sky-900 tabular-nums mt-1 block">
                {formatCurrencyBn(costReport.averageSellingRatePerThousand)}
              </strong>
              <span className="text-xs text-slate-600 mt-1 block">
                প্রতি পিস গড় বিক্রয় মূল্য:{' '}
                <strong className="text-sky-700 font-mono">
                  ৳{formatBn(costReport.averageSellingPricePerPiece)}
                </strong>
              </span>
            </div>

            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-2xs">
              <span className="text-xs font-bold text-emerald-800 block">
                প্রতি ১,০০০ ইটে আনুমানিক নিট লাভ / মার্জিন
              </span>
              <strong
                className={`text-2xl font-extrabold font-mono tabular-nums mt-1 block ${
                  costReport.estimatedProfitPerThousand >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {formatCurrencyBn(costReport.estimatedProfitPerThousand)}
              </strong>
              <span className="text-xs text-slate-600 mt-1 block">
                প্রতি পিস ইটে আনুমানিক লাভ:{' '}
                <strong className="text-emerald-700 font-mono">
                  ৳{formatBn(costReport.estimatedProfitPerPiece)}
                </strong>
              </span>
            </div>

            <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-2xs">
              <span className="text-xs font-bold text-amber-300 block">
                বিক্রিত ইটের ওপর আনুমানিক মোট নিট লাভ
              </span>
              <strong className="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums mt-1 block">
                {formatCurrencyBn(costReport.estimatedNetProfitOnSoldBricks)}
              </strong>
              <span className="text-xs text-slate-300 mt-1 block">
                মোট বিক্রি: {formatBn(costReport.totalBricksSold)} পিস ({formatCurrencyBn(costReport.totalSalesRevenue)})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 5 Cols: Interactive Customizer Form */}
            <form
              onSubmit={handleSaveEstimatedOverrides}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-orange-600" />
                    আনুমানিক হাজার প্রতি খরচ সমন্বয় ফর্ম
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    মিলওয়ালা, লোডওয়ালা, পোড়াই, আনলোড লাইন, মাটি ও কাঠ-কয়লার আনুমানিক হাজার প্রতি খরচ নিজের মতো বসিয়ে হিসাব মিলাতে পারবেন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetToActualCost}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  অটো রেট রিসেট
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ১. মিলওয়ালা (হাজার প্রতি রেট ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={millRateInput}
                    onChange={(e) => setMillRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">
                    খাতার গড়: ৳{formatBn(costReport.components.mill.actualRatePerThousand)}/হাজার
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ২. লোডওয়ালা / ভ্যান (হাজার প্রতি ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={vanRateInput}
                    onChange={(e) => setVanRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">
                    খাতার গড়: ৳{formatBn(costReport.components.vanLoad.actualRatePerThousand)}/হাজার
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ৩. পোড়াই মিস্ত্রি (হাজার প্রতি ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={poraiRateInput}
                    onChange={(e) => setPoraiRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">
                    খাতার গড়: ৳{formatBn(costReport.components.porai.actualRatePerThousand)}/হাজার
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-orange-900 mb-1">
                    ৪. আনলোড প্রতি লাইন রেট (১ লাইন=৪০০০ ইট)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unloadLineRateInput}
                    onChange={(e) => setUnloadLineRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-orange-50 border border-orange-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-orange-700 font-semibold">
                    হাজারে পড়ছে: ৳{formatBn(costReport.components.unload.effectiveRatePerThousand)}/হাজার
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ৫. মাটি কেনা খরচ (হাজার প্রতি আনুমানিক ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={soilCostInput}
                    onChange={(e) => setSoilCostInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">
                    মোট মাটি বিল: {formatCurrencyBn(costReport.components.soil.actualTotalBill)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ৬. কাঠ ও কয়লা জ্বালানি (হাজার প্রতি ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={coalWoodCostInput}
                    onChange={(e) => setCoalWoodCostInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">
                    মোট কাঠ-কয়লা: {formatCurrencyBn(costReport.components.coalWood.actualTotalBill)}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ৭. ভেকু, ডিজেল, লেবার ও আনুষঙ্গিক খরচ (হাজার প্রতি ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={otherOverheadInput}
                    onChange={(e) => setOtherOverheadInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">
                    খাতায় রেকর্ডকৃত আনুষঙ্গিক খরচ: {formatCurrencyBn(costReport.components.otherOverhead.actualTotalBill)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCostOverrides}
                className="w-full py-2.5 px-4 text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                {savingCostOverrides
                  ? 'সংরক্ষণ হচ্ছে...'
                  : 'আনুমানিক হাজার প্রতি খরচের হিসাব সেভ করে রাখুন'}
              </button>
            </form>

            {/* Right 7 Cols: Detailed Breakdown Table */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  খাতওয়ারী প্রতি ১,০০০ ইটের আনুমানিক উৎপাদন খরচ ও বিক্রয় লাভের বিবরণী
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  মিল, ভ্যান লোড, পোড়াই মিস্ত্রি, লাইন আনলোড (১ লাইন = ৪,০০০ ইট @ ৭৫০৳), মাটি ও কাঠ-কয়লা খরচের সমন্বিত বিশ্লেষণ।
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                      <th className="py-3 px-3 font-bold">খরচের খাত (Cost Head)</th>
                      <th className="py-3 px-3 font-bold text-right">খাতায় মোট খরচ/বিল</th>
                      <th className="py-3 px-3 font-bold text-right">প্রতি ১,০০০ ইটে খরচ (৳)</th>
                      <th className="py-3 px-3 font-bold text-right">প্রতি পিস ইটে খরচ (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ১. {costReport.components.mill.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBn(costReport.components.mill.actualTotalBill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyBn(costReport.components.mill.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        ৳{formatBn((costReport.components.mill.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ২. {costReport.components.vanLoad.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBn(costReport.components.vanLoad.actualTotalBill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyBn(costReport.components.vanLoad.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        ৳{formatBn((costReport.components.vanLoad.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ৩. {costReport.components.porai.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBn(costReport.components.porai.actualTotalBill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyBn(costReport.components.porai.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        ৳{formatBn((costReport.components.porai.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                    <tr className="bg-orange-50/50">
                      <td className="py-2.5 px-3 font-bold text-orange-950">
                        ৪. {costReport.components.unload.labelBn} (@ ৳{formatBn(costReport.components.unload.effectiveRatePerLine)}/লাইন)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-orange-900">
                        {formatCurrencyBn(costReport.components.unload.actualTotalBill)} ({formatBn(costReport.components.unload.actualTotalLines)} লাইন)
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-orange-800">
                        {formatCurrencyBn(costReport.components.unload.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-orange-700">
                        ৳{formatBn((costReport.components.unload.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ৫. {costReport.components.soil.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBn(costReport.components.soil.actualTotalBill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyBn(costReport.components.soil.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        ৳{formatBn((costReport.components.soil.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ৬. {costReport.components.coalWood.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBn(costReport.components.coalWood.actualTotalBill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyBn(costReport.components.coalWood.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        ৳{formatBn((costReport.components.coalWood.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ৭. {costReport.components.otherOverhead.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBn(costReport.components.otherOverhead.actualTotalBill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrencyBn(costReport.components.otherOverhead.effectiveRatePerThousand)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        ৳{formatBn((costReport.components.otherOverhead.effectiveRatePerThousand / 1000).toFixed(2))}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-extrabold">
                      <td colSpan={2} className="py-3 px-3">
                        সর্বমোট আনুমানিক উৎপাদন খরচ (প্রতি ১,০০০ ইট):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-300 tabular-nums text-base">
                        {formatCurrencyBn(costReport.estimatedCostPerThousand)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-300 tabular-nums">
                        ৳{formatBn(costReport.estimatedCostPerPiece)}/পিস
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: বকেয়া তাগাদা ও ১-ক্লিক হোয়াটসঅ্যাপ মেসেজ রিমাইন্ডার
         ===================================================================== */}
      {activeSection === 'due_tagada' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 mb-1">
                কাস্টমারের ফোন নম্বরসহ তালিকা · ১-ক্লিকে WhatsApp ও SMS তাগাদা
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                বকেয়া তাগাদা খাতা ও ১-ক্লিক হোয়াটসঅ্যাপ রিমাইন্ডার সিস্টেম
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                যাদের কাছে ইটের টাকা বাকি আছে তাদের ফোন নম্বর, মেমো নম্বর ও বকেয়া টাকার তালিকা। এক ক্লিকেই বাংলায় সাজানো তাগাদা মেসেজ WhatsApp বা SMS-এ পাঠাতে পারবেন।
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 shrink-0">
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-rose-800 font-bold block">সর্বমোট বকেয়া পাওনা</span>
                <strong className="text-sm sm:text-base font-extrabold font-mono text-rose-700 tabular-nums">
                  {formatCurrencyBn(tagadaData.totalDueAmount)}
                </strong>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-amber-800 font-bold block">মেয়াদোত্তীর্ণ তাগাদা</span>
                <strong className="text-sm sm:text-base font-extrabold font-mono text-amber-800 tabular-nums">
                  {formatBn(tagadaData.overdueCount)}টি ({formatCurrencyBn(tagadaData.overdueAmount)})
                </strong>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-emerald-800 font-bold block">মোট বকেয়া পার্টি</span>
                <strong className="text-sm sm:text-base font-extrabold font-mono text-emerald-700 tabular-nums">
                  {formatBn(tagadaData.items.length)} জন
                </strong>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="পার্টির নাম, মোবাইল নম্বর, ঠিকানা বা মেমো নং দিয়ে খুঁজুন..."
                value={tagadaSearch}
                onChange={(e) => setTagadaSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: `সব বকেয়া পার্টি (${formatBn(tagadaData.items.length)})` },
                  { id: 'OVERDUE', label: `মেয়াদোত্তীর্ণ তাগাদা (${formatBn(tagadaData.overdueCount)})` },
                  { id: 'WITH_PHONE', label: `মোবাইল নম্বরসহ (${formatBn(tagadaData.withPhoneCount)})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTagadaFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    tagadaFilter === f.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Tagada Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                  <th className="py-3 px-3 font-bold">ক্রেতা / পার্টির নাম ও ঠিকানা</th>
                  <th className="py-3 px-3 font-bold">মোবাইল নম্বর</th>
                  <th className="py-3 px-3 font-bold">মেমো ও ইটের বিবরণ</th>
                  <th className="py-3 px-3 font-bold text-right">মোট বিল ও জমা</th>
                  <th className="py-3 px-3 font-bold text-right">বর্তমান বকেয়া (৳)</th>
                  <th className="py-3 px-3 font-bold text-right">১-ক্লিক WhatsApp তাগাদা ও জমা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTagadaItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-500">
                      বর্তমানে কোনো বকেয়া তাগাদা রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredTagadaItems.map((item) => (
                    <tr key={`${item.sourceType}-${item.id}`} className="hover:bg-emerald-50/30">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900">{item.customerName}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.customerAddress} · তারিখ: {item.date}
                        </div>
                        {item.duePromiseDate && (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.isOverdue
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              পরিশোধের কথা: {item.duePromiseDate}
                              {item.isOverdue ? ` (${formatBn(item.daysOverdue)} দিন পার হয়েছে)` : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.customerPhone}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-orange-700">
                          {item.sourceType === 'MEMO' ? `মেমো #${item.referenceNo}` : `বুকিং #${item.referenceNo}`}
                        </div>
                        <div className="text-[11px] text-slate-600">{item.bricksSummaryBn}</div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-semibold text-slate-800">
                          বিল: {formatCurrencyBn(item.totalBilled)}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          জমা: {formatCurrencyBn(item.totalPaid)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold font-mono text-rose-700 tabular-nums text-sm">
                        {formatCurrencyBn(item.dueAmount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <a
                            href={item.whatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs whitespace-nowrap"
                          >
                            <Send className="w-3.5 h-3.5" />
                            WhatsApp তাগাদা
                          </a>
                          <a
                            href={item.smsUrl}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-2xs whitespace-nowrap"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            SMS
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyReminderText(item.id, item.whatsAppMessageBn)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedId === item.id ? 'কপি হয়েছে!' : 'মেসেজ কপি'}
                          </button>
                          {item.memoRef && (
                            <button
                              type="button"
                              onClick={() => onOpenDueModalForMemo(item.memoRef!)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              বকেয়া জমা নিন
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: দৈনিক ভাটা ক্লোজিং শিট ও ডেইলি গোল ট্র্যাকার
         ===================================================================== */}
      {activeSection === 'daily_closing' && (
        <div className="space-y-6">
          {/* PART A: DAILY GOAL TRACKER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 mb-1">
                  <Target className="w-3.5 h-3.5" />
                  ডেইলি গোল ট্র্যাকার (Daily Goal Tracker) · সামগ্রিক অগ্রগতি: {formatBn(goalProgress.overallCompletionPct)}%
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  আজকের ভাটার দৈনিক লক্ষ্যমাত্রা ও অর্জন ট্র্যাকার ({closingDate})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGoals((prev) => !prev)}
                  className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
                >
                  {editingGoals ? 'বক্স বন্ধ করুন' : '🎯 দৈনিক লক্ষ্যমাত্রা সেট করুন'}
                </button>
              </div>
            </div>

            {editingGoals && (
              <form
                onSubmit={handleSaveDailyGoals}
                className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    দৈনিক কাঁচা ইট কাটা (পিস)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={goalRawBricks}
                    onChange={(e) => setGoalRawBricks(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    দৈনিক ইট বিক্রি (পিস)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={goalSoldBricks}
                    onChange={(e) => setGoalSoldBricks(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    দৈনিক নগদ আদায় (৳)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={goalCashIn}
                    onChange={(e) => setGoalCashIn(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    দৈনিক আনলোড লাইন (৪০০০/লাইন)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={goalUnloadLines}
                    onChange={(e) => setGoalUnloadLines(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingGoals}
                  className="py-2 px-4 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                >
                  {savingGoals ? 'সেভ হচ্ছে...' : '✓ লক্ষ্যমাত্রা সেভ করুন'}
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {goalProgress.items.map((g) => (
                <div
                  key={g.id}
                  className={`rounded-xl p-4 border-2 space-y-2 ${
                    g.achieved
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{g.labelBn}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono ${
                        g.achieved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {formatBn(g.progressPct)}%
                    </span>
                  </div>
                  <div className="text-base font-extrabold font-mono text-slate-900 tabular-nums">
                    {g.unitBn === '৳'
                      ? `${formatCurrencyBn(g.actual)} / ${formatCurrencyBn(g.target)}`
                      : `${formatBn(g.actual)} / ${formatBn(g.target)} ${g.unitBn}`}
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${g.progressPct}%` }}
                      className={`h-full rounded-full transition-all ${
                        g.achieved ? 'bg-emerald-600' : 'bg-indigo-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PART B: DAILY EVENING CLOSING SHEET (দৈনিক ভাটা ক্লোজিং শিট) */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-200 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300 mb-1">
                  ১-পেইজ প্রিন্টেবল সান্ধ্যকালীন ভাটা ক্লোজিং সামারি শিট
                </span>
                <h3 className="text-base sm:text-xl font-extrabold text-slate-900">
                  {state.settings?.bhataName || 'BrickFlow'} — দৈনিক ভাটা ক্লোজিং শিট ({closingDate})
                </h3>
                <p className="text-xs text-slate-600">
                  প্রারম্ভিক ক্যাশ জের + আজকের মোট আদায় − আজকের মোট খরচ = আজকের সমাপনী ক্যাশ ব্যালেন্স ও সারাদিনের উৎপাদন-বিক্রয় রিপোর্ট।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300">
                  <span className="text-xs font-bold text-slate-700">তারিখ:</span>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="text-xs font-bold font-mono bg-white px-2 py-1 rounded border border-slate-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  দৈনিক ক্লোজিং শিট প্রিন্ট করুন
                </button>
              </div>
            </div>

            {/* Cash Equation Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-bold text-slate-600 block">
                  ১. প্রারম্ভিক ক্যাশ জের (Opening Cash)
                </span>
                <strong className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 tabular-nums mt-1 block">
                  {formatCurrencyBn(closingSheet.openingCashForDay)}
                </strong>
                <span className="text-[11px] text-slate-500">আজকের আগের দিন পর্যন্ত জের</span>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4">
                <span className="text-xs font-bold text-emerald-800 block">
                  ২. আজকের মোট জমা / আদায় (+)
                </span>
                <strong className="text-lg sm:text-xl font-extrabold font-mono text-emerald-700 tabular-nums mt-1 block">
                  +{formatCurrencyBn(closingSheet.todayCashIn)}
                </strong>
                <span className="text-[11px] text-emerald-700">
                  মোট {formatBn(closingSheet.todayCashInList.length)}টি জমা লেনদেন
                </span>
              </div>

              <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4">
                <span className="text-xs font-bold text-rose-800 block">
                  ৩. আজকের মোট খরচ / পেমেন্ট (−)
                </span>
                <strong className="text-lg sm:text-xl font-extrabold font-mono text-rose-700 tabular-nums mt-1 block">
                  −{formatCurrencyBn(closingSheet.todayCashOut)}
                </strong>
                <span className="text-[11px] text-rose-700">
                  মোট {formatBn(closingSheet.todayCashOutList.length)}টি খরচ লেনদেন
                </span>
              </div>

              <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-bold text-amber-300 block">
                  ৪. সমাপনী হাতে নগদ (Closing Cash)
                </span>
                <strong className="text-lg sm:text-xl font-extrabold font-mono text-emerald-400 tabular-nums mt-1 block">
                  {formatCurrencyBn(closingSheet.closingCashForDay)}
                </strong>
                <span className="text-[11px] text-slate-300">আজ দিনশেষে ক্যাশ বাক্সে ব্যালেন্স</span>
              </div>
            </div>

            {/* Today's Operations Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3">
                <span className="text-[11px] font-bold text-orange-900 block">আজকের ইট বিক্রি</span>
                <strong className="text-sm font-extrabold font-mono text-slate-900">
                  {formatBn(closingSheet.todayBricksSold)} পিস
                </strong>
                <span className="text-[11px] text-slate-600 block">
                  {formatBn(closingSheet.todayMemosCount)}টি মেমো ({formatCurrencyBn(closingSheet.todaySalesBilled)})
                </span>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
                <span className="text-[11px] font-bold text-amber-900 block">আজ মিল কাঁচা ইট কাটা</span>
                <strong className="text-sm font-extrabold font-mono text-slate-900">
                  {formatBn(closingSheet.todayRawBricksCut)} পিস
                </strong>
                <span className="text-[11px] text-slate-600 block">
                  বিল: {formatCurrencyBn(closingSheet.todayMillBill)}
                </span>
              </div>

              <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-3">
                <span className="text-[11px] font-bold text-sky-900 block">আজ ভ্যান লোড ইট</span>
                <strong className="text-sm font-extrabold font-mono text-slate-900">
                  {formatBn(closingSheet.todayVanBricksLoaded)} পিস
                </strong>
                <span className="text-[11px] text-slate-600 block">চুল্লিতে বোঝাই</span>
              </div>

              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3">
                <span className="text-[11px] font-bold text-rose-900 block">আজ পোড়াই মিস্ত্রি ইট</span>
                <strong className="text-sm font-extrabold font-mono text-slate-900">
                  {formatBn(closingSheet.todayPoraiBricksFired)} পিস
                </strong>
                <span className="text-[11px] text-slate-600 block">চুল্লি ফায়ারিং</span>
              </div>

              <div className="bg-orange-100/70 border border-orange-300 rounded-xl p-3">
                <span className="text-[11px] font-bold text-orange-950 block">আজকের লাইন আনলোড</span>
                <strong className="text-sm font-extrabold font-mono text-orange-800">
                  {formatBn(closingSheet.todayUnloadLines)} লাইন
                </strong>
                <span className="text-[11px] text-slate-700 block">
                  {formatBn(closingSheet.todayUnloadBricks)} পিস ({formatCurrencyBn(closingSheet.todayUnloadBill)})
                </span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
                <span className="text-[11px] font-bold text-emerald-900 block">আজকের ইট ডেলিভারি</span>
                <strong className="text-sm font-extrabold font-mono text-slate-900">
                  {formatBn(closingSheet.todayDeliveredBricks)} পিস
                </strong>
                <span className="text-[11px] text-slate-600 block">
                  মোট {formatBn(closingSheet.todayDeliveryTripsCount)} ট্রিপ গাড়ি
                </span>
              </div>
            </div>

            {/* Side-by-Side Cash In & Cash Out Tables for Selected Date */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-900">
                    আজকের জমা / ক্যাশ ইন তালিকা ({formatBn(closingSheet.todayCashInList.length)}টি)
                  </span>
                  <strong className="text-xs font-mono font-extrabold text-emerald-800">
                    {formatCurrencyBn(closingSheet.todayCashIn)}
                  </strong>
                </div>
                <table className="w-full text-xs text-left border-collapse">
                  <tbody className="divide-y divide-slate-200">
                    {closingSheet.todayCashInList.length === 0 ? (
                      <tr>
                        <td className="py-5 px-3 text-center text-slate-500">
                          এই তারিখে কোনো নগদ জমা লেনদেন নেই।
                        </td>
                      </tr>
                    ) : (
                      closingSheet.todayCashInList.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{tx.description}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            +{formatCurrencyBn(tx.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border border-rose-200 rounded-xl overflow-hidden">
                <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-rose-900">
                    আজকের খরচ / ক্যাশ আউট তালিকা ({formatBn(closingSheet.todayCashOutList.length)}টি)
                  </span>
                  <strong className="text-xs font-mono font-extrabold text-rose-800">
                    {formatCurrencyBn(closingSheet.todayCashOut)}
                  </strong>
                </div>
                <table className="w-full text-xs text-left border-collapse">
                  <tbody className="divide-y divide-slate-200">
                    {closingSheet.todayCashOutList.length === 0 ? (
                      <tr>
                        <td className="py-5 px-3 text-center text-slate-500">
                          এই তারিখে কোনো খরচের লেনদেন নেই।
                        </td>
                      </tr>
                    ) : (
                      closingSheet.todayCashOutList.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            <span className="text-[10px] font-bold text-rose-700 block">{tx.category}</span>
                            {tx.description}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                            −{formatCurrencyBn(tx.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature Footer for Print */}
            <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs text-slate-600 border-t border-dashed border-slate-300">
              <div>
                <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800 inline-block px-6">
                  ক্যাশিয়ার / হিসাবরক্ষকের স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800 inline-block px-6">
                  ভাটা ম্যানেজারের স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800 inline-block px-6">
                  মালিক / প্রোপ্রাইটরের স্বাক্ষর ({state.settings?.proprietorName || 'কামরুল ইসলাম'})
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
