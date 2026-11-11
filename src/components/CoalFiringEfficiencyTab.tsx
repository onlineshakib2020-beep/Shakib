import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Flame,
  Gauge,
  PlusCircle,
  Printer,
  Scale,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import type { LanguageMode } from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';
import {
  computeFiringRoundMetrics,
  computeOverallCoalEfficiencyReport,
  type KilnFiringRoundRecord,
} from '../utils/themeAndEstimatorLogic';
import { Card } from './Card';

interface CoalFiringEfficiencyTabProps {
  lang: LanguageMode;
  todayDate: string;
  rounds: KilnFiringRoundRecord[];
  benchmarkCoalPerLakhTons: number;
  onChangeBenchmark: (nextBenchmark: number) => void;
  onAddRound: (round: Omit<KilnFiringRoundRecord, 'id'>) => void;
  onDeleteRound: (id: string) => void;
}

export const CoalFiringEfficiencyTab: React.FC<CoalFiringEfficiencyTabProps> = ({
  lang,
  todayDate,
  rounds,
  benchmarkCoalPerLakhTons,
  onChangeBenchmark,
  onAddRound,
  onDeleteRound,
}) => {
  const isEn = lang === 'en';

  const report = useMemo(
    () => computeOverallCoalEfficiencyReport(rounds, benchmarkCoalPerLakhTons),
    [rounds, benchmarkCoalPerLakhTons]
  );

  const nextRoundNo =
    rounds.length > 0 ? Math.max(...rounds.map((r) => r.roundNo)) + 1 : 1;

  const [roundNo, setRoundNo] = useState(String(nextRoundNo));
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [mistriName, setMistriName] = useState('আলী হোসেন পোড়াই মিস্ত্রি');
  const [chambersFired, setChambersFired] = useState('24');
  const [bricksFiredPieces, setBricksFiredPieces] = useState('420000');
  const [coalUsedTons, setCoalUsedTons] = useState('69');
  const [coalRatePerTon, setCoalRatePerTon] = useState('22500');
  const [woodUsedMaunds, setWoodUsedMaunds] = useState('160');
  const [woodRatePerMaund, setWoodRatePerMaund] = useState('320');
  const [note, setNote] = useState('');

  // Live preview of the draft form
  const draftPreview = useMemo(
    () =>
      computeFiringRoundMetrics(
        {
          id: 'draft',
          roundNo: Number(roundNo) || nextRoundNo,
          startDate,
          endDate,
          mistriName,
          chambersFired: Number(chambersFired) || 24,
          bricksFiredPieces: Number(bricksFiredPieces) || 100000,
          coalUsedTons: Number(coalUsedTons) || 0,
          coalRatePerTon: Number(coalRatePerTon) || 22500,
          woodUsedMaunds: Number(woodUsedMaunds) || 0,
          woodRatePerMaund: Number(woodRatePerMaund) || 320,
          note,
        },
        benchmarkCoalPerLakhTons
      ),
    [
      roundNo,
      nextRoundNo,
      startDate,
      endDate,
      mistriName,
      chambersFired,
      bricksFiredPieces,
      coalUsedTons,
      coalRatePerTon,
      woodUsedMaunds,
      woodRatePerMaund,
      note,
      benchmarkCoalPerLakhTons,
    ]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bricks = Math.max(1000, Number(bricksFiredPieces) || 0);
    const coal = Math.max(0.1, Number(coalUsedTons) || 0);
    onAddRound({
      roundNo: Math.max(1, Number(roundNo) || nextRoundNo),
      startDate,
      endDate,
      mistriName: mistriName.trim() || 'পোড়াই মিস্ত্রি',
      chambersFired: Math.max(1, Number(chambersFired) || 24),
      bricksFiredPieces: bricks,
      coalUsedTons: coal,
      coalRatePerTon: Math.max(0, Number(coalRatePerTon) || 22500),
      woodUsedMaunds: Math.max(0, Number(woodUsedMaunds) || 0),
      woodRatePerMaund: Math.max(0, Number(woodRatePerMaund) || 320),
      note: note.trim(),
    });
    setRoundNo(String(nextRoundNo + 1));
    setNote('');
  };

  return (
    <div
      data-testid="coal-firing-efficiency-tab"
      className="space-y-6 animate-slide-up"
    >
      {/* Top Dark Navy Command Header Banner (Main Dashboard Standard) */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-4 sm:p-6 text-white space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/20 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  লাইভ কয়লা ও জ্বালানি দক্ষতা সিঙ্ক
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                  {isEn
                    ? `Benchmark: ${benchmarkCoalPerLakhTons} Tons / 1 Lakh Bricks`
                    : `Benchmark: ${formatBn(benchmarkCoalPerLakhTons)} টন কয়লা / ১ লক্ষ ইট`}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-1">
                {isEn
                  ? 'Kiln Round-Wise Coal & Firing Efficiency Tracker'
                  : 'চুল্লির রাউন্ড ভিত্তিক কয়লা ও জ্বালানি দক্ষতা বিশ্লেষণ (Coal & Firing Efficiency Tracker)'}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                {isEn
                  ? 'Monitor coal & firewood burned per 1,00,000 bricks across each firing round to verify fireman efficiency and prevent fuel wastage.'
                  : 'চুল্লির প্রতি রাউন্ডে বা প্রতি ১ লক্ষ ইট পোড়াতে কত টন কয়লা ও কত মণ কাঠ পুড়ছে—তার তুলনামূলক হিসাব, যাতে বোঝা যায় পোড়াই মিস্ত্রি জ্বালানি বেশি খরচ করছে কি না।'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2 flex items-center gap-2">
              <label
                htmlFor="benchmark-coal-input"
                className="text-xs font-bold text-slate-200 whitespace-nowrap"
              >
                {isEn
                  ? 'Target Tons / 1 Lakh:'
                  : '১ লাখে আদর্শ কয়লা (টন):'}
              </label>
              <input
                id="benchmark-coal-input"
                type="number"
                step="0.1"
                min={10}
                max={30}
                value={benchmarkCoalPerLakhTons}
                onChange={(e) =>
                  onChangeBenchmark(
                    Math.max(10, Math.min(30, Number(e.target.value) || 17.2))
                  )
                }
                className="w-18 px-2 py-1 text-xs font-black text-center tabular-nums rounded-lg bg-white text-slate-950 border border-slate-300"
              />
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="sbl-btn-interactive inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-orange-500/25 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>{isEn ? 'Print Report' : 'রিপোর্ট প্রিন্ট / PDF'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 High-Contrast KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="default" topAccent="orange" padding="md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-950 block">
                {isEn
                  ? 'Avg Coal / 1 Lakh Bricks'
                  : 'প্রতি ১ লক্ষ ইটে গড় কয়লা'}
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                {isEn
                  ? `Target Benchmark: ${benchmarkCoalPerLakhTons} Tons`
                  : `ভাটার আদর্শ লক্ষ্যমাত্রা: ${formatBn(benchmarkCoalPerLakhTons)} টন`}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-700">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div
            data-testid="avg-coal-per-lakh-val"
            className="text-2xl font-black text-slate-950 tabular-nums my-2"
          >
            {formatBn(report.avgCoalPerLakhTons)} {isEn ? 'Tons' : 'টন'}
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-800">
            {isEn
              ? `Per 1,000 Bricks: ${formatBn(report.avgCoalKgPerThousand)} kg coal`
              : `প্রতি হাজার ইটে: ${formatBn(report.avgCoalKgPerThousand)} কেজি কয়লা`}
          </div>
        </Card>

        <Card variant="default" topAccent="emerald" padding="md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-950 block">
                {isEn
                  ? 'Fuel Cost / 1,000 Bricks'
                  : 'প্রতি হাজার ইটে জ্বালানি খরচ'}
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                {isEn
                  ? 'Combined coal & firewood cost'
                  : 'কয়লা ও জ্বালানি কাঠ মিলিয়ে গড় ব্যয়'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 tabular-nums my-2">
            {formatCurrencyBn(report.avgFuelCostPerThousand)}
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-800">
            {isEn
              ? `Total Fuel Spend: ${formatCurrencyBn(report.totalFuelCost)}`
              : `সর্বমোট জ্বালানি ব্যয়: ${formatCurrencyBn(report.totalFuelCost)}`}
          </div>
        </Card>

        <Card variant="default" topAccent="sky" padding="md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-950 block">
                {isEn
                  ? 'Total Bricks Fired & Fuel'
                  : 'মোট পোড়ানো ইট ও জ্বালানি'}
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                {isEn
                  ? `Across ${formatBn(report.rounds.length)} firing rounds`
                  : `মোট ${formatBn(report.rounds.length)}টি পোড়াই রাউন্ডে`}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-700">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-950 tabular-nums my-2">
            {formatBn(report.totalBricksFired)} {isEn ? 'pcs' : 'পিস'}
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-800">
            {isEn
              ? `Coal: ${formatBn(report.totalCoalTons)} Tons · Wood: ${formatBn(
                  report.totalWoodMaunds
                )} Maunds`
              : `মোট কয়লা: ${formatBn(report.totalCoalTons)} টন · কাঠ: ${formatBn(
                  report.totalWoodMaunds
                )} মণ`}
          </div>
        </Card>

        <Card
          variant="default"
          topAccent={report.netCoalSavingsOrExcessTons >= 0 ? 'emerald' : 'rose'}
          padding="md"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-950 block">
                {report.netCoalSavingsOrExcessTons >= 0
                  ? isEn
                    ? 'Net Coal Saved vs Benchmark'
                    : 'লক্ষ্যমাত্রার চেয়ে কয়লা সাশ্রয়'
                  : isEn
                  ? 'Excess Coal Burned'
                  : 'লক্ষ্যমাত্রার চেয়ে অতিরিক্ত কয়লা'}
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                {report.bestRound
                  ? isEn
                    ? `Best: Round #${report.bestRound.record.roundNo} (${report.bestRound.coalPerLakhBricksTons} T/Lakh)`
                    : `সেরা সাশ্রয়ী: রাউন্ড #${formatBn(
                        report.bestRound.record.roundNo
                      )} (${formatBn(
                        report.bestRound.coalPerLakhBricksTons
                      )} টন/লক্ষ)`
                  : ''}
              </span>
            </div>
            <div
              className={`p-2 rounded-xl border ${
                report.netCoalSavingsOrExcessTons >= 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {report.netCoalSavingsOrExcessTons >= 0 ? (
                <Award className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
          </div>
          <div
            className={`text-2xl font-black tabular-nums my-2 ${
              report.netCoalSavingsOrExcessTons >= 0
                ? 'text-emerald-800'
                : 'text-rose-800'
            }`}
          >
            {report.netCoalSavingsOrExcessTons >= 0 ? '+' : ''}
            {formatBn(report.netCoalSavingsOrExcessTons)} {isEn ? 'Tons' : 'টন'}
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-800">
            {report.netSavingsOrExcessAmount >= 0
              ? isEn
                ? `Saved approx. ${formatCurrencyBn(report.netSavingsOrExcessAmount)}`
                : `আর্থিক সাশ্রয়: প্রায় ${formatCurrencyBn(
                    report.netSavingsOrExcessAmount
                  )}`
              : isEn
              ? `Extra cost: ${formatCurrencyBn(
                  Math.abs(report.netSavingsOrExcessAmount)
                )}`
              : `অতিরিক্ত খরচ: ${formatCurrencyBn(
                  Math.abs(report.netSavingsOrExcessAmount)
                )}`}
          </div>
        </Card>
      </div>

      {/* Porai Mistri (Fireman) Comparative Fuel Efficiency Scorecard */}
      {report.firemanSummaries.length > 0 && (
        <Card variant="default" topAccent="emerald" padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-950">
                {isEn
                  ? 'Porai Mistri (Fireman) Fuel Efficiency Comparison Scorecard'
                  : 'পোড়াই মিস্ত্রি ভিত্তিক কয়লা ও কাঠ খরচের তুলনামূলক রিপোর্ট (Fireman Efficiency Comparison)'}
              </h2>
              <p className="text-xs font-medium text-slate-700">
                {isEn
                  ? 'Compare average coal tons & firewood maunds burned per 1,00,000 bricks by each fireman team'
                  : 'কোন পোড়াই মিস্ত্রি প্রতি ১ লক্ষ ইটে কত টন কয়লা ও কত মণ কাঠ পোড়াচ্ছেন এবং জ্বালানি বেশি খরচ করছেন কি না তার তুলনামূলক যাচাই'}
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-slate-900 text-amber-300 text-xs font-extrabold self-start sm:self-auto">
              {isEn
                ? `Ideal Benchmark: ${benchmarkCoalPerLakhTons} Tons / 1 Lakh`
                : `আদর্শ মান (Benchmark): ${formatBn(benchmarkCoalPerLakhTons)} টন / ১ লক্ষ ইট`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.firemanSummaries.map((fm) => {
              const isExcess = fm.efficiencyStatus === 'EXCESS_WARNING';
              const isOptimal = fm.efficiencyStatus === 'OPTIMAL';
              return (
                <div
                  key={fm.mistriName}
                  className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                    isExcess
                      ? 'bg-rose-50/40 border-rose-300'
                      : isOptimal
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-950">
                        {fm.mistriName}
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        {isEn
                          ? `${fm.roundsCount} Firing Rounds · Total ${formatBn(fm.totalBricksFired)} Bricks`
                          : `মোট ${formatBn(fm.roundsCount)}টি রাউন্ড · পোড়ানো ইট: ${formatBn(fm.totalBricksFired)} পিস`}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                        isExcess
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : isOptimal
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-amber-100 text-amber-950 border-amber-300'
                      }`}
                    >
                      {isOptimal ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      ) : isExcess ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                      ) : null}
                      <span>{isEn ? fm.verdictLabelEn : fm.verdictLabelBn}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-slate-600 font-bold block">
                        কয়লা / ১ লক্ষ ইট
                      </span>
                      <span
                        className={`text-base font-black tabular-nums mt-0.5 block ${
                          isExcess ? 'text-rose-700' : 'text-slate-950'
                        }`}
                      >
                        {formatBn(fm.avgCoalPerLakhTons)} টন
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-slate-600 font-bold block">
                        কাঠ / ১ লক্ষ ইট
                      </span>
                      <span className="text-base font-black text-slate-950 tabular-nums mt-0.5 block">
                        {formatBn(fm.avgWoodPerLakhMaunds)} মণ
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-slate-600 font-bold block">
                        জ্বালানি খরচ / হাজার
                      </span>
                      <span className="text-base font-black text-emerald-800 tabular-nums mt-0.5 block">
                        {formatCurrencyBn(fm.avgFuelCostPerThousand)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-extrabold pt-1 border-t border-slate-200/80">
                    <span className="text-slate-800">
                      মোট জ্বালানি: {formatBn(fm.totalCoalTons)} টন কয়লা ·{' '}
                      {formatBn(fm.totalWoodMaunds)} মণ কাঠ
                    </span>
                    <span
                      className={
                        fm.netCoalSavingsOrExcessTons >= 0
                          ? 'text-emerald-800'
                          : 'text-rose-800'
                      }
                    >
                      {fm.netCoalSavingsOrExcessTons >= 0
                        ? `সাশ্রয়: +${formatBn(fm.netCoalSavingsOrExcessTons)} টন (${formatCurrencyBn(fm.netSavingsOrExcessAmount)})`
                        : `অতিরিক্ত খরচ: ${formatBn(Math.abs(fm.netCoalSavingsOrExcessTons))} টন (${formatCurrencyBn(Math.abs(fm.netSavingsOrExcessAmount))})`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Main 2-Column Layout: Left Entry Form + Visual Chart | Right Detailed Round Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Add New Firing Round Form */}
        <Card
          as="form"
          onSubmit={handleSubmit}
          variant="default"
          topAccent="orange"
          padding="lg"
          className="lg:col-span-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-600 text-white">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-950">
                  {isEn
                    ? 'Record Firing Round Fuel Usage'
                    : 'নতুন পোড়াই রাউন্ড ও জ্বালানি এন্ট্রি'}
                </h2>
                <p className="text-xs font-medium text-slate-700">
                  {isEn
                    ? 'Enter bricks fired, coal tons & wood maunds to evaluate efficiency'
                    : 'রাউন্ডের পোড়ানো ইট, কয়লা (টন) ও কাঠ (মণ) লিখে দক্ষতা যাচাই করুন'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Round No. *' : 'রাউন্ড নং *'}
              </label>
              <input
                type="number"
                min={1}
                required
                value={roundNo}
                onChange={(e) => setRoundNo(e.target.value)}
                className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Chambers Fired' : 'চেম্বার সংখ্যা'}
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={chambersFired}
                onChange={(e) => setChambersFired(e.target.value)}
                className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Completion Date' : 'সমাপ্তির তারিখ'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Porai Mistri (Fireman) Name *' : 'পোড়াই মিস্ত্রির নাম *'}
              </label>
              <input
                type="text"
                required
                value={mistriName}
                onChange={(e) => setMistriName(e.target.value)}
                placeholder="যেমন: আলী হোসেন পোড়াই মিস্ত্রি"
                className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Total Bricks Fired (Pcs) *' : 'মোট পোড়ানো ইট (পিস) *'}
              </label>
              <input
                type="number"
                min={1000}
                step={1000}
                required
                value={bricksFiredPieces}
                onChange={(e) => setBricksFiredPieces(e.target.value)}
                className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-orange-900 mb-1">
                {isEn ? 'Coal Used (Tons) *' : 'ব্যবহৃত কয়লা (টন) *'}
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                required
                value={coalUsedTons}
                onChange={(e) => setCoalUsedTons(e.target.value)}
                className="w-full px-3 py-2 text-sm font-black tabular-nums bg-orange-50/60 text-slate-950 border-2 border-orange-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Coal Rate / Ton (Tk)' : 'কয়লার দর / টন (৳)'}
              </label>
              <input
                type="number"
                min={1000}
                value={coalRatePerTon}
                onChange={(e) => setCoalRatePerTon(e.target.value)}
                className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Firewood Used (Maunds)' : 'জ্বালানি কাঠ (মণ)'}
              </label>
              <input
                type="number"
                min={0}
                value={woodUsedMaunds}
                onChange={(e) => setWoodUsedMaunds(e.target.value)}
                className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-950 mb-1">
                {isEn ? 'Wood Rate / Maund (Tk)' : 'কাঠের দর / মণ (৳)'}
              </label>
              <input
                type="number"
                min={0}
                value={woodRatePerMaund}
                onChange={(e) => setWoodRatePerMaund(e.target.value)}
                className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-950 mb-1">
              {isEn ? 'Remarks / Firing Note' : 'মন্তব্য বা পোড়াই নোট'}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isEn
                  ? 'e.g. Good draft, 92% Grade-1 bricks'
                  : 'যেমন: চুল্লির ড্রাফট ভালো ছিল, ৯২% ১ নং ইট বের হয়েছে...'
              }
              className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
            />
          </div>

          {/* Live Calculation Preview Box */}
          <div className="bg-slate-950 text-white rounded-xl p-3.5 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold">
                {isEn ? 'Live Coal Rate per 1 Lakh:' : 'হিসাবকৃত কয়লা (প্রতি ১ লক্ষ ইটে):'}
              </span>
              <span className="text-sm font-black text-amber-300 tabular-nums">
                {formatBn(draftPreview.coalPerLakhBricksTons)} {isEn ? 'Tons' : 'টন'} (
                {formatBn(draftPreview.coalKgPerThousandBricks)} কেজি/হাজার)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold">
                {isEn ? 'Fuel Cost per 1,000 Bricks:' : 'প্রতি হাজার ইটে জ্বালানি খরচ:'}
              </span>
              <span className="text-sm font-black text-emerald-300 tabular-nums">
                {formatCurrencyBn(draftPreview.fuelCostPerThousandBricks)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-200 font-bold">
                {isEn ? 'Efficiency Status:' : 'দক্ষতা মূল্যায়ন:'}
              </span>
              <span
                className={`font-extrabold ${
                  draftPreview.efficiencyStatus === 'OPTIMAL'
                    ? 'text-emerald-300'
                    : draftPreview.efficiencyStatus === 'EXCESS_WARNING'
                    ? 'text-rose-400'
                    : 'text-amber-300'
                }`}
              >
                {isEn ? draftPreview.statusLabelEn : draftPreview.statusLabelBn}
              </span>
            </div>
          </div>

          <button
            type="submit"
            data-testid="submit-firing-round-btn"
            className="sbl-btn-interactive w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-xs sm:text-sm font-black cursor-pointer shadow-lg shadow-orange-500/25 transition-all"
          >
            {isEn
              ? '+ Save Firing Round & Analyze Efficiency'
              : '+ পোড়াই রাউন্ডের হিসাব সংরক্ষণ করুন'}
          </button>
        </Card>

        {/* Right 7 Columns: Visual Bar Comparison & Round Ledger Table */}
        <div className="lg:col-span-7 space-y-6">
          {/* Round-by-Round Visual Efficiency Bar Chart */}
          <Card variant="default" topAccent="emerald" padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-950">
                    {isEn
                      ? 'Round-by-Round Coal Burn per 1 Lakh Bricks'
                      : 'রাউন্ড ভিত্তিক কয়লা খরচের তুলনামূলক চিত্র (প্রতি ১ লক্ষ ইটে)'}
                  </h3>
                  <p className="text-xs font-medium text-slate-700">
                    {isEn
                      ? `Green = Optimal saving · Amber = Normal · Red = Excess coal (> ${benchmarkCoalPerLakhTons} Tons)`
                      : `সবুজ = সাশ্রয়ী পোড়াই · হলুদ = স্বাভাবিক · লাল = অতিরিক্ত কয়লা খরচ (আদর্শ ${formatBn(
                          benchmarkCoalPerLakhTons
                        )} টনের বেশি)`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {report.rounds.map((r) => {
                const widthPct = Math.min(
                  100,
                  Math.max(20, Math.round((r.coalPerLakhBricksTons / 24) * 100))
                );
                const barColor =
                  r.efficiencyStatus === 'OPTIMAL'
                    ? 'bg-emerald-600'
                    : r.efficiencyStatus === 'EXCESS_WARNING'
                    ? 'bg-rose-600'
                    : 'bg-amber-500';

                return (
                  <div
                    key={r.record.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="font-extrabold text-slate-950">
                        {isEn
                          ? `Round #${r.record.roundNo} — ${r.record.mistriName}`
                          : `রাউন্ড #${formatBn(r.record.roundNo)} — ${
                              r.record.mistriName
                            }`}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-950 tabular-nums">
                          {formatBn(r.coalPerLakhBricksTons)}{' '}
                          {isEn ? 'Tons / Lakh' : 'টন / ১ লক্ষ ইট'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            r.efficiencyStatus === 'OPTIMAL'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : r.efficiencyStatus === 'EXCESS_WARNING'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-amber-100 text-amber-950 border border-amber-300'
                          }`}
                        >
                          {isEn ? r.statusLabelEn : r.statusLabelBn}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-700 tabular-nums">
                      <span>
                        {isEn
                          ? `Bricks Fired: ${formatBn(
                              r.record.bricksFiredPieces
                            )} pcs (${formatBn(r.record.chambersFired)} chambers)`
                          : `পোড়ানো ইট: ${formatBn(
                              r.record.bricksFiredPieces
                            )} পিস (${formatBn(r.record.chambersFired)} চেম্বার)`}
                      </span>
                      <span>
                        {isEn
                          ? `Coal: ${formatBn(r.record.coalUsedTons)} T · Wood: ${formatBn(
                              r.record.woodUsedMaunds
                            )} M · Cost/1000: ${formatCurrencyBn(
                              r.fuelCostPerThousandBricks
                            )}`
                          : `কয়লা: ${formatBn(r.record.coalUsedTons)} টন · কাঠ: ${formatBn(
                              r.record.woodUsedMaunds
                            )} মণ · হাজারে খরচ: ${formatCurrencyBn(
                              r.fuelCostPerThousandBricks
                            )}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Detailed Round Table */}
          <Card variant="default" topAccent="orange" padding="none">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-950">
                {isEn
                  ? `Firing Round Efficiency Ledger (${formatBn(
                      report.rounds.length
                    )})`
                  : `পোড়াই রাউন্ড ও জ্বালানি দক্ষতা খতিয়ান (${formatBn(
                      report.rounds.length
                    )}টি রাউন্ড)`}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-950 text-xs">
                    <th className="py-2.5 px-3.5 font-extrabold">
                      {isEn ? 'Round & Mistri' : 'রাউন্ড ও মিস্ত্রি'}
                    </th>
                    <th className="py-2.5 px-3.5 font-extrabold text-right">
                      {isEn ? 'Fired Bricks' : 'পোড়ানো ইট'}
                    </th>
                    <th className="py-2.5 px-3.5 font-extrabold text-right">
                      {isEn ? 'Coal & Wood' : 'কয়লা ও কাঠ'}
                    </th>
                    <th className="py-2.5 px-3.5 font-extrabold text-right">
                      {isEn ? 'Coal / 1 Lakh' : '১ লাখে কয়লা'}
                    </th>
                    <th className="py-2.5 px-3.5 font-extrabold text-right">
                      {isEn ? 'Fuel Cost / 1000' : 'হাজারে জ্বালানি'}
                    </th>
                    <th className="py-2.5 px-3.5 font-extrabold text-center">
                      {isEn ? 'Status' : 'দক্ষতা'}
                    </th>
                    <th className="py-2.5 px-3.5 font-extrabold text-right">
                      {isEn ? 'Action' : 'অপশন'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.rounds.map((r) => (
                    <tr
                      key={r.record.id}
                      className="hover:bg-orange-50/40 transition-colors"
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="font-extrabold text-slate-950">
                          {isEn
                            ? `Round #${r.record.roundNo}`
                            : `রাউন্ড #${formatBn(r.record.roundNo)}`}{' '}
                          · {r.record.mistriName}
                        </div>
                        <div className="text-[11px] font-medium text-slate-700">
                          {r.record.endDate}
                          {r.record.note ? ` · ${r.record.note}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-extrabold text-slate-950 tabular-nums">
                        {formatBn(r.record.bricksFiredPieces)} {isEn ? 'pcs' : 'পিস'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums">
                        <div className="font-extrabold text-slate-950">
                          {formatBn(r.record.coalUsedTons)} {isEn ? 'Tons' : 'টন কয়লা'}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700">
                          {formatBn(r.record.woodUsedMaunds)} {isEn ? 'Maunds' : 'মণ কাঠ'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums">
                        <div className="font-black text-slate-950">
                          {formatBn(r.coalPerLakhBricksTons)} {isEn ? 'T' : 'টন'}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700">
                          {formatBn(r.coalKgPerThousandBricks)} কেজি/হাজার
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums">
                        <div className="font-extrabold text-emerald-800">
                          {formatCurrencyBn(r.fuelCostPerThousandBricks)}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700">
                          মোট: {formatCurrencyBn(r.totalFuelCost)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            r.efficiencyStatus === 'OPTIMAL'
                              ? 'bg-emerald-100 text-emerald-900'
                              : r.efficiencyStatus === 'EXCESS_WARNING'
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {r.efficiencyStatus === 'OPTIMAL' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          ) : r.efficiencyStatus === 'EXCESS_WARNING' ? (
                            <AlertTriangle className="w-3 h-3 text-rose-700" />
                          ) : null}
                          <span>
                            {isEn ? r.statusLabelEn : r.statusLabelBn}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteRound(r.record.id)}
                          aria-label={isEn ? 'Delete round' : 'রাউন্ড মুছে ফেলুন'}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface DashboardCoalEfficiencySummaryCardProps {
  rounds: KilnFiringRoundRecord[];
  benchmarkCoalPerLakhTons: number;
  isEn?: boolean;
  onOpenFullTracker: () => void;
}

export const DashboardCoalEfficiencySummaryCard: React.FC<
  DashboardCoalEfficiencySummaryCardProps
> = ({ rounds, benchmarkCoalPerLakhTons, isEn = false, onOpenFullTracker }) => {
  const report = useMemo(
    () => computeOverallCoalEfficiencyReport(rounds, benchmarkCoalPerLakhTons),
    [rounds, benchmarkCoalPerLakhTons]
  );

  return (
    <Card
      as="section"
      data-testid="dashboard-coal-efficiency-summary-card"
      variant="default"
      topAccent="orange"
      padding="lg"
      className="space-y-2.5 sm:space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 sm:gap-3 border-b border-slate-200 pb-2 sm:pb-3.5">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-11 sm:h-11 rounded-md sm:rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-lg font-extrabold text-slate-950 tracking-tight leading-snug">
                {isEn
                  ? '🔥 Coal & Firing Efficiency Tracker'
                  : '🔥 চুল্লির রাউন্ড ভিত্তিক কয়লা ও জ্বালানি দক্ষতা বিশ্লেষণ'}
              </h2>
              <span className="px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-xs font-extrabold tabular-nums">
                Benchmark: {formatBn(benchmarkCoalPerLakhTons)} Ton / 1 Lakh
              </span>
            </div>
            <p className="hidden sm:block text-xs font-medium text-slate-700 mt-0.5">
              {isEn
                ? 'Comparative coal (Tons) & firewood (Maunds) burned per 1,00,000 bricks across each round to verify Porai Mistri fuel efficiency.'
                : 'চুল্লির প্রতি রাউন্ডে বা প্রতি ১ লক্ষ ইট পোড়াতে কত টন কয়লা ও কত মণ কাঠ পুড়ছে—তার তুলনামূলক হিসাব, যাতে বোঝা যায় পোড়াই মিস্ত্রি জ্বালানি বেশি খরচ করছে কি না।'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenFullTracker}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[11px] sm:text-xs font-extrabold shadow-xs cursor-pointer transition-all shrink-0 self-start lg:self-auto active:scale-95"
        >
          <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>
            {isEn
              ? 'Open Full Tracker & Add Round →'
              : 'নতুন রাউন্ড এন্ট্রি ও পূর্ণ খতিয়ান খুলুন →'}
          </span>
        </button>
      </div>

      {/* Top 4 Quick Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs w-full min-w-0">
        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-orange-50/50 border border-orange-200/90">
          <span className="text-slate-700 font-bold text-[10px] sm:text-xs block truncate">
            প্রতি ১ লক্ষ ইটে গড় কয়লা
          </span>
          <span className="text-sm sm:text-lg font-black text-slate-950 tabular-nums mt-0.5 block">
            {formatBn(report.avgCoalPerLakhTons)} টন
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 block truncate">
            প্রতি হাজারে: {formatBn(report.avgCoalKgPerThousand)} কেজি কয়লা
          </span>
        </div>

        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-amber-50/50 border border-amber-200/90">
          <span className="text-slate-700 font-bold text-[10px] sm:text-xs block truncate">
            প্রতি ১ লক্ষ ইটে গড় কাঠ
          </span>
          <span className="text-sm sm:text-lg font-black text-slate-950 tabular-nums mt-0.5 block">
            {formatBn(report.avgWoodPerLakhMaunds)} মণ কাঠ
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 block truncate">
            মোট কাঠ: {formatBn(report.totalWoodMaunds)} মণ ({formatBn(report.rounds.length)} রাউন্ডে)
          </span>
        </div>

        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-emerald-50/50 border border-emerald-200/90">
          <span className="text-slate-700 font-bold text-[10px] sm:text-xs block truncate">
            হাজার প্রতি জ্বালানি ব্যয়
          </span>
          <span className="text-sm sm:text-lg font-black text-emerald-800 tabular-nums mt-0.5 block">
            {formatCurrencyBn(report.avgFuelCostPerThousand)}
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">
            মোট পোড়ানো ইট: {formatBn(report.totalBricksFired)} পিস
          </span>
        </div>

        <div
          className={`p-3 rounded-xl border ${
            report.netCoalSavingsOrExcessTons >= 0
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-rose-50/60 border-rose-300'
          }`}
        >
          <span className="text-slate-700 font-bold block">
            পোড়াই মিস্ত্রির জ্বালানি সাশ্রয় / অতিরিক্ত
          </span>
          <span
            className={`text-lg font-black tabular-nums mt-0.5 block ${
              report.netCoalSavingsOrExcessTons >= 0
                ? 'text-emerald-800'
                : 'text-rose-800'
            }`}
          >
            {report.netCoalSavingsOrExcessTons >= 0 ? '+' : ''}
            {formatBn(report.netCoalSavingsOrExcessTons)} টন কয়লা
          </span>
          <span className="text-[11px] font-bold text-slate-800">
            {report.netSavingsOrExcessAmount >= 0
              ? `সাশ্রয়: ${formatCurrencyBn(report.netSavingsOrExcessAmount)}`
              : `অতিরিক্ত খরচ: ${formatCurrencyBn(Math.abs(report.netSavingsOrExcessAmount))}`}
          </span>
        </div>
      </div>

      {/* Round-by-Round Compact Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {report.rounds.slice(0, 3).map((r) => {
          const isExcess = r.efficiencyStatus === 'EXCESS_WARNING';
          const isOptimal = r.efficiencyStatus === 'OPTIMAL';
          return (
            <div
              key={r.record.id}
              onClick={onOpenFullTracker}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                isExcess
                  ? 'bg-rose-50/35 border-rose-200 hover:border-rose-400'
                  : isOptimal
                  ? 'bg-emerald-50/35 border-emerald-200 hover:border-emerald-400'
                  : 'bg-slate-50 border-slate-200 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-black text-slate-950">
                  রাউন্ড #{formatBn(r.record.roundNo)} · {r.record.mistriName}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                    isExcess
                      ? 'bg-rose-100 text-rose-900'
                      : isOptimal
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-amber-100 text-amber-950'
                  }`}
                >
                  {isOptimal
                    ? 'সাশ্রয়ী পোড়াই'
                    : isExcess
                    ? 'অতিরিক্ত কয়লা খরচ!'
                    : 'স্বাভাবিক'}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-800 flex items-center justify-between tabular-nums">
                <span>
                  কয়লা: <strong>{formatBn(r.coalPerLakhBricksTons)} টন/লক্ষ</strong>
                </span>
                <span>
                  কাঠ: <strong>{formatBn(r.woodMaundsPerLakhBricks)} মণ/লক্ষ</strong>
                </span>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-semibold text-slate-700 tabular-nums">
                <span>ইট: {formatBn(r.record.bricksFiredPieces)} পিস</span>
                <span className="font-extrabold text-emerald-800">
                  হাজারে খরচ: {formatCurrencyBn(r.fuelCostPerThousandBricks)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

