import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Check,
  Copy,
  Layers,
  PackageCheck,
  RotateCcw,
  Truck,
} from 'lucide-react';
import type { LanguageMode } from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';
import {
  STANDARD_BRICKS_PER_CUBIC_FOOT,
  calculateTruckFootMeasurement,
} from '../utils/themeAndEstimatorLogic';
import { Card } from './Card';

export interface TruckDimensionBillCalculatorProps {
  lang?: LanguageMode;
  onApplyBricksToDelivery?: (
    estimatedBricks: number,
    measurementSummaryNote: string
  ) => void;
}

export const TruckDimensionBillCalculator: React.FC<
  TruckDimensionBillCalculatorProps
> = ({ lang = 'bn', onApplyBricksToDelivery }) => {
  const isEn = lang === 'en';

  const [lengthFeet, setLengthFeet] = useState<string>('16');
  const [widthFeet, setWidthFeet] = useState<string>('7.5');
  const [heightFeet, setHeightFeet] = useState<string>('4.5');
  const [ratePerCubicFoot, setRatePerCubicFoot] = useState<string>('55');
  const [bricksMultiplier, setBricksMultiplier] = useState<string>(
    String(STANDARD_BRICKS_PER_CUBIC_FOOT)
  );
  const [truckCount, setTruckCount] = useState<string>('1');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [isBillPulsing, setIsBillPulsing] = useState<boolean>(false);

  const calc = useMemo(
    () =>
      calculateTruckFootMeasurement({
        lengthFeet: Number(lengthFeet) || 0,
        widthFeet: Number(widthFeet) || 0,
        heightFeet: Number(heightFeet) || 0,
        ratePerFoot: Number(ratePerCubicFoot) || 0,
        truckCount: Number(truckCount) || 1,
        bricksPerCubicFoot:
          Number(bricksMultiplier) || STANDARD_BRICKS_PER_CUBIC_FOOT,
      }),
    [
      lengthFeet,
      widthFeet,
      heightFeet,
      ratePerCubicFoot,
      truckCount,
      bricksMultiplier,
    ]
  );

  const prevTotalFootBillRef = useRef<number>(calc.totalFootBill);

  useEffect(() => {
    if (prevTotalFootBillRef.current === calc.totalFootBill) {
      return;
    }
    prevTotalFootBillRef.current = calc.totalFootBill;
    setIsBillPulsing(true);
    const timer = window.setTimeout(() => {
      setIsBillPulsing(false);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [calc.totalFootBill]);

  const summaryNoteBn = `ট্রাক পরিমাপ: দৈর্ঘ্য ${formatBn(
    calc.decimalLengthFeet
  )} ফুট × প্রস্থ ${formatBn(calc.decimalWidthFeet)} ফুট × উচ্চতা ${formatBn(
    calc.decimalHeightFeet
  )} ফুট = ${formatBn(calc.totalCubicFeet)} ঘনফুট (${formatBn(
    calc.totalCubicMetersCbm
  )} CBM) | আনুমানিক ইট: ${formatBn(
    calc.totalEstimatedBricks
  )} পিস | প্রতি ঘনফুট রেট: ৳${formatBn(
    calc.ratePerFoot
  )} | মোট বিল: ${formatCurrencyBn(calc.totalFootBill)}`;

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryNoteBn);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleResetDefaults = () => {
    setLengthFeet('16');
    setWidthFeet('7.5');
    setHeightFeet('4.5');
    setRatePerCubicFoot('55');
    setBricksMultiplier(String(STANDARD_BRICKS_PER_CUBIC_FOOT));
    setTruckCount('1');
  };

  return (
    <Card
      variant="default"
      topAccent="orange"
      padding="none"
      className="overflow-hidden shadow-sm border-2 border-orange-200/90"
      data-testid="truck-dimension-bill-calculator-widget"
    >
      {/* Top Header Strip */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0F172A] to-slate-900 text-white px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-slate-950 flex items-center justify-center shadow-md shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">
                {isEn
                  ? 'Truck Dimension & Bill Calculator'
                  : '🚚 ট্রাক পরিমাপ ও ঘনফুট বিল ক্যালকুলেটর'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-extrabold">
                {isEn
                  ? 'Auto CFT · CBM · Bricks · Final Bill'
                  : 'অটো ঘনফুট (CFT/CBM) · আনুমানিক ইট · চূড়ান্ত বিল'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white mt-1">
              {isEn
                ? 'Truck Dimension & Bill Calculator (Length × Width × Height)'
                : 'ট্রাকের দৈর্ঘ্য, প্রস্থ ও উচ্চতা দিয়ে কত ফুটের ট্রাক, আনুমানিক ইট এবং প্রতি ঘনফুট রেটে চূড়ান্ত বিল'}
            </h3>
          </div>
        </div>

        {/* Quick Truck Size Presets */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="truck-preset-10wheeler"
            onClick={() => {
              setLengthFeet('18');
              setWidthFeet('8');
              setHeightFeet('5');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-extrabold cursor-pointer transition-colors"
          >
            ১০ চাকা (১৮×৮×৫ ফুট)
          </button>
          <button
            type="button"
            data-testid="truck-preset-6wheeler"
            onClick={() => {
              setLengthFeet('16');
              setWidthFeet('7.5');
              setHeightFeet('4.5');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 text-xs font-extrabold cursor-pointer transition-colors"
          >
            ৬ চাকা (১৬×৭.৫×৪.৫ ফুট)
          </button>
          <button
            type="button"
            data-testid="truck-preset-minitruck"
            onClick={() => {
              setLengthFeet('12');
              setWidthFeet('6.5');
              setHeightFeet('3.5');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 text-xs font-extrabold cursor-pointer transition-colors"
          >
            মিনি ট্রাক (১২×৬.৫×৩.৫ ফুট)
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            aria-label={isEn ? 'Reset dimensions' : 'ডিফল্ট মাপে রিসেট করুন'}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title="ডিফল্ট মাপে রিসেট করুন"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Calculator Body: Explicit Two-Column Desktop Grid (Left: Dimension & Rate Inputs | Right: Live Total Bill & Results) */}
      <div
        data-testid="truck-calc-two-col-grid"
        className="p-5 bg-gradient-to-b from-orange-50/40 via-white to-slate-50/70 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
      >
        {/* LEFT COLUMN: Input Fields Panel */}
        <div
          data-testid="truck-calc-inputs-column"
          className="bg-white border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                {isEn
                  ? 'Column 1: Truck Dimensions & Rate Inputs'
                  : 'বাম কলাম: ট্রাকের দৈর্ঘ্য, প্রস্থ, উচ্চতা ও ঘনফুট রেট ইনপুট'}
              </h4>
            </div>
            <span className="px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-950 text-[11px] font-extrabold">
              {isEn
                ? 'Formula: Length × Width × Height'
                : 'সূত্র: দৈর্ঘ্য × প্রস্থ × উচ্চতা = ঘনফুট (CFT)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Length (দৈর্ঘ্য) */}
            <div className="bg-slate-50/70 border-2 border-slate-200 focus-within:border-orange-500 focus-within:bg-white rounded-2xl p-3 space-y-1 transition-colors">
              <label
                htmlFor="truck-calc-length-ft"
                className="block text-xs font-black text-slate-900"
              >
                {isEn ? '1. Length (দৈর্ঘ্য - ft)' : '১. ট্রাকের দৈর্ঘ্য (ফুট)'}
              </label>
              <input
                id="truck-calc-length-ft"
                data-testid="truck-calc-length-ft"
                type="number"
                min={0}
                step="any"
                value={lengthFeet}
                onChange={(e) => setLengthFeet(e.target.value)}
                placeholder="16"
                className="w-full px-3 py-2 text-base font-black font-mono tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-600"
              />
              <span className="block text-[10px] font-bold text-slate-600">
                লম্বা (Feet)
              </span>
            </div>

            {/* 2. Width (প্রস্থ) */}
            <div className="bg-slate-50/70 border-2 border-slate-200 focus-within:border-orange-500 focus-within:bg-white rounded-2xl p-3 space-y-1 transition-colors">
              <label
                htmlFor="truck-calc-width-ft"
                className="block text-xs font-black text-slate-900"
              >
                {isEn ? '2. Width (প্রস্থ - ft)' : '২. ট্রাকের প্রস্থ (ফুট)'}
              </label>
              <input
                id="truck-calc-width-ft"
                data-testid="truck-calc-width-ft"
                type="number"
                min={0}
                step="any"
                value={widthFeet}
                onChange={(e) => setWidthFeet(e.target.value)}
                placeholder="7.5"
                className="w-full px-3 py-2 text-base font-black font-mono tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-600"
              />
              <span className="block text-[10px] font-bold text-slate-600">
                চওড়া (Feet)
              </span>
            </div>

            {/* 3. Height (উচ্চতা) */}
            <div className="bg-slate-50/70 border-2 border-slate-200 focus-within:border-orange-500 focus-within:bg-white rounded-2xl p-3 space-y-1 transition-colors">
              <label
                htmlFor="truck-calc-height-ft"
                className="block text-xs font-black text-slate-900"
              >
                {isEn ? '3. Height (উচ্চতা - ft)' : '৩. ট্রাকের উচ্চতা (ফুট)'}
              </label>
              <input
                id="truck-calc-height-ft"
                data-testid="truck-calc-height-ft"
                type="number"
                min={0}
                step="any"
                value={heightFeet}
                onChange={(e) => setHeightFeet(e.target.value)}
                placeholder="4.5"
                className="w-full px-3 py-2 text-base font-black font-mono tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-600"
              />
              <span className="block text-[10px] font-bold text-slate-600">
                বডি হাইট (Feet)
              </span>
            </div>

            {/* 4. Rate per Cubic Foot (প্রতি ঘনফুট রেট) */}
            <div className="bg-orange-50/80 border-2 border-orange-400 rounded-2xl p-3 space-y-1 shadow-2xs">
              <label
                htmlFor="truck-calc-rate-per-cft"
                className="block text-xs font-black text-orange-950"
              >
                {isEn
                  ? '4. Rate per Cubic Foot (৳)'
                  : '৪. প্রতি ঘনফুট রেট (৳)'}
              </label>
              <input
                id="truck-calc-rate-per-cft"
                data-testid="truck-calc-rate-per-cft"
                type="number"
                min={0}
                step="any"
                value={ratePerCubicFoot}
                onChange={(e) => setRatePerCubicFoot(e.target.value)}
                placeholder="55"
                className="w-full px-3 py-2 text-base font-black font-mono tabular-nums bg-white text-slate-950 border border-orange-400 rounded-xl focus:outline-none focus:border-orange-600"
              />
              <span className="block text-[10px] font-extrabold text-orange-800">
                প্রতি ফুট দর (Rate/CFT)
              </span>
            </div>

            {/* 5. Standard Brick Multiplier per CFT */}
            <div className="bg-slate-50/70 border-2 border-slate-200 focus-within:border-orange-500 focus-within:bg-white rounded-2xl p-3 space-y-1 transition-colors">
              <label
                htmlFor="truck-calc-brick-multiplier"
                className="block text-xs font-black text-slate-900"
              >
                {isEn ? '5. Bricks / CFT' : '৫. প্রতি ঘনফুটে ইট (পিস)'}
              </label>
              <input
                id="truck-calc-brick-multiplier"
                data-testid="truck-calc-brick-multiplier"
                type="number"
                min={1}
                step="any"
                value={bricksMultiplier}
                onChange={(e) => setBricksMultiplier(e.target.value)}
                placeholder="12"
                className="w-full px-3 py-2 text-base font-black font-mono tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-600"
              />
              <span className="block text-[10px] font-bold text-slate-600">
                আদর্শ গুণিতক (Standard: ১২টি/ফুট)
              </span>
            </div>

            {/* 6. Number of Trucks / Trips */}
            <div className="bg-slate-50/70 border-2 border-slate-200 focus-within:border-orange-500 focus-within:bg-white rounded-2xl p-3 space-y-1 transition-colors">
              <label
                htmlFor="truck-calc-truck-count"
                className="block text-xs font-black text-slate-900"
              >
                {isEn ? '6. Truck Trips' : '৬. ট্রাক / গাড়ি সংখ্যা'}
              </label>
              <input
                id="truck-calc-truck-count"
                data-testid="truck-calc-truck-count"
                type="number"
                min={1}
                step={1}
                value={truckCount}
                onChange={(e) => setTruckCount(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 text-base font-black font-mono tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-600"
              />
              <span className="block text-[10px] font-bold text-slate-600">
                মোট ট্রিপ সংখ্যা
              </span>
            </div>
          </div>

          {/* Bottom Live Equation Strip inside Input Column */}
          <div className="rounded-xl bg-slate-100 border border-slate-200/90 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700 tabular-nums">
            <span>
              ১ ট্রাকের মাপ: {formatBn(calc.decimalLengthFeet)}&apos; ×{' '}
              {formatBn(calc.decimalWidthFeet)}&apos; ×{' '}
              {formatBn(calc.decimalHeightFeet)}&apos; ={' '}
              <strong className="text-slate-950 font-black">
                {formatBn(calc.singleTruckCft)} ঘনফুট
              </strong>
            </span>
            <span>
              মোট {formatBn(calc.truckCount)} ট্রাক × ৳
              {formatBn(calc.ratePerFoot)}/ফুট ={' '}
              <strong className="text-emerald-800 font-black">
                {formatCurrencyBn(calc.totalFootBill)}
              </strong>
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Total Bill & Results Panel */}
        <div
          data-testid="truck-calc-results-column"
          className="bg-slate-900/5 border-2 border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                {isEn
                  ? 'Column 2: Live Total Bill & Estimated Bricks'
                  : 'ডান কলাম: লাইভ চূড়ান্ত বিল (Total Bill), ঘনফুট ও আনুমানিক ইট'}
              </h4>
            </div>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 text-[11px] font-extrabold">
              {isEn ? 'Auto-Refreshed' : 'অটো-রিফ্রেশ সক্রিয়'}
            </span>
          </div>
          {/* Featured Live Total Bill Card (with subtle pulse animation on bill update) */}
          <div
            data-testid="truck-calc-bill-card"
            data-pulsing={isBillPulsing ? 'true' : 'false'}
            className={`rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-950 text-white p-4 sm:p-5 border-2 flex flex-col justify-between space-y-3 transition-all duration-300 ${
              isBillPulsing
                ? 'border-emerald-300 ring-4 ring-emerald-400/35 shadow-lg shadow-emerald-500/25 scale-[1.015]'
                : 'border-emerald-400/80 shadow-md scale-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase">
                  {isEn ? 'Live Total Bill' : 'লাইভ ফলাফল'}
                </span>
                <span className="text-xs font-extrabold text-emerald-300">
                  {isEn
                    ? 'Final Foot Bill Amount'
                    : 'সর্বমোট ফুটের চূড়ান্ত বিল'}
                </span>
              </div>
              <PackageCheck
                className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                  isBillPulsing
                    ? 'text-emerald-200 scale-125'
                    : 'text-emerald-400 scale-100'
                }`}
              />
            </div>

            <div>
              <div
                data-testid="truck-calc-output-bill"
                data-pulsing={isBillPulsing ? 'true' : 'false'}
                aria-live="polite"
                className={`inline-block origin-left text-3xl sm:text-4xl font-black font-mono tabular-nums transition-all duration-300 ${
                  isBillPulsing
                    ? 'scale-105 text-emerald-200 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)] animate-pulse'
                    : 'scale-100 text-emerald-400'
                }`}
              >
                {formatCurrencyBn(calc.totalFootBill)}
              </div>
              <div className="text-xs font-extrabold text-emerald-200 tabular-nums mt-1">
                ১ ট্রাকের বিল: {formatCurrencyBn(calc.singleTruckBill)} (দর: ৳
                {formatBn(calc.ratePerFoot)}/ঘনফুট · মোট{' '}
                {formatBn(calc.totalCubicFeet)} CFT)
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-800/70">
              {onApplyBricksToDelivery && (
                <button
                  type="button"
                  data-testid="truck-calc-apply-to-delivery-btn"
                  onClick={() =>
                    onApplyBricksToDelivery(
                      calc.totalEstimatedBricks,
                      summaryNoteBn
                    )
                  }
                  className="flex-1 px-3 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black cursor-pointer transition-all active:scale-95 text-center"
                >
                  ডেলিভারিতে {formatBn(calc.totalEstimatedBricks)} ইট বসান
                </button>
              )}
              <button
                type="button"
                data-testid="truck-calc-copy-summary-btn"
                onClick={handleCopySummary}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>কপি হয়েছে!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>বিল কপি করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Secondary Output Cards Row: Cubic Footage (CFT/CBM) & Estimated Bricks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
            {/* Result Card 1: Cubic Footage (CFT & CBM) */}
            <div className="rounded-2xl bg-slate-950 text-white p-3.5 border-2 border-sky-500/50 flex flex-col justify-between space-y-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-sky-300">
                  {isEn ? 'Cubic Footage (CFT/CBM)' : 'মোট ঘনফুট ও CBM'}
                </span>
                <Truck className="w-4 h-4 text-sky-400 shrink-0" />
              </div>
              <div>
                <div
                  data-testid="truck-calc-output-cft"
                  className="text-xl sm:text-2xl font-black text-amber-300 font-mono tabular-nums"
                >
                  {formatBn(calc.totalCubicFeet)} ঘনফুট (CFT)
                </div>
                <div
                  data-testid="truck-calc-output-cbm"
                  className="text-[11px] font-extrabold text-sky-300 font-mono tabular-nums mt-0.5"
                >
                  সমতুল্য CBM: {formatBn(calc.totalCubicMetersCbm)} m³
                </div>
              </div>
              <div className="text-[10px] text-slate-300 font-semibold border-t border-slate-800 pt-1 tabular-nums">
                ১ ট্রাকে: {formatBn(calc.singleTruckCft)} ঘনফুট
              </div>
            </div>

            {/* Result Card 2: Total Estimated Bricks */}
            <div className="rounded-2xl bg-slate-950 text-white p-3.5 border-2 border-amber-500/50 flex flex-col justify-between space-y-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-amber-300">
                  {isEn ? 'Estimated Bricks' : 'আনুমানিক মোট ইটের সংখ্যা'}
                </span>
                <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div>
                <div
                  data-testid="truck-calc-output-bricks"
                  className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums"
                >
                  {formatBn(calc.totalEstimatedBricks)} পিস ইট
                </div>
                <div className="text-[11px] font-extrabold text-amber-300 tabular-nums mt-0.5">
                  ১ ট্রাকে আনুমানিক: {formatBn(calc.singleTruckEstimatedBricks)}{' '}
                  পিস
                </div>
              </div>
              <div className="text-[10px] text-slate-300 font-semibold border-t border-slate-800 pt-1 tabular-nums">
                হিসাব: {formatBn(calc.totalCubicFeet)} CFT ×{' '}
                {formatBn(calc.bricksPerCubicFoot)} পিস
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
