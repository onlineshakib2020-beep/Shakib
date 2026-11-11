import React, { useMemo, useState } from 'react';
import { Banknote, Flame, PlusCircle, Truck, UserCheck, Wallet } from 'lucide-react';
import type { PaymentMethod, WoodFuelRecord } from '../types/kiln';
import {
  calculateWoodFuelBill,
  computeWoodFuelSupplierSummary,
  formatBn,
  formatCurrencyBn,
} from '../utils/kilnLogic';
import { Card } from './Card';

interface DashboardQuickWoodFuelCardProps {
  todayDate: string;
  woodFuelRecords: WoodFuelRecord[];
  isEn?: boolean;
  onSaveWoodFuel: (payload: {
    id?: string;
    date: string;
    supplierName: string;
    supplierPhone?: string;
    woodType: string;
    vehicleOrChallan?: string;
    quantity: number;
    unit: string;
    ratePerUnit: number;
    paidAmount: number;
    paymentMethod?: PaymentMethod;
    note?: string;
  }) => Promise<void>;
  onPayWoodSupplier: (payload: {
    recordId?: string;
    supplierName: string;
    amount: number;
    date: string;
    paymentMethod?: PaymentMethod;
    note?: string;
  }) => Promise<void>;
  onOpenJalaniHisab: () => void;
}

const DEFAULT_FALLBACK_SUPPLIERS = [
  {
    supplierName: 'জলিল ব্যাপারী',
    supplierPhone: '01715-445566',
    latestRate: 210,
    latestUnit: 'মণ',
    latestWoodType: '১. কাঠ — মিক্সড জ্বালানি কাঠ',
    totalQuantity: 0,
    totalBill: 0,
    totalPaid: 0,
    totalDue: 0,
    dinaAmount: 0,
  },
];

const QUICK_FUEL_TYPES = [
  '১. কাঠ — মিক্সড জ্বালানি কাঠ',
  '২. কয়লা — ইন্দোনেশিয়ান / বড়পুকুরিয়া কয়লা',
  '৩. লাকড়ি — চেরা লাকড়ি / ফাড়াই লাকড়ি',
];

export const DashboardQuickWoodFuelCard: React.FC<DashboardQuickWoodFuelCardProps> = ({
  todayDate,
  woodFuelRecords,
  onSaveWoodFuel,
  onPayWoodSupplier,
  onOpenJalaniHisab,
}) => {
  const summary = useMemo(
    () => computeWoodFuelSupplierSummary(woodFuelRecords || []),
    [woodFuelRecords]
  );

  const supplierList = useMemo(() => {
    if (summary.suppliers.length > 0) {
      return summary.suppliers;
    }
    return DEFAULT_FALLBACK_SUPPLIERS;
  }, [summary.suppliers]);

  const [selectedSupplierName, setSelectedSupplierName] = useState<string>(
    () => supplierList[0]?.supplierName || 'জলিল ব্যাপারী'
  );

  // Ensure selectedSupplierName stays valid if supplierList updates
  const activeSupplier = useMemo(() => {
    return (
      supplierList.find((s) => s.supplierName === selectedSupplierName) ||
      supplierList[0] ||
      DEFAULT_FALLBACK_SUPPLIERS[0]
    );
  }, [supplierList, selectedSupplierName]);

  // Quick Entry State
  const [woodType, setWoodType] = useState<string>(
    activeSupplier.latestWoodType || QUICK_FUEL_TYPES[0]
  );
  const [quantity, setQuantity] = useState<string>('100');
  const [unit, setUnit] = useState<string>(activeSupplier.latestUnit || 'মণ');
  const [ratePerUnit, setRatePerUnit] = useState<string>(
    String(activeSupplier.latestRate || 210)
  );
  const [instantPaid, setInstantPaid] = useState<string>('0');
  const [entrySaving, setEntrySaving] = useState<boolean>(false);

  // Quick Balance Payment State
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [payNote, setPayNote] = useState<string>('');
  const [paySaving, setPaySaving] = useState<boolean>(false);

  const handleSelectSupplier = (name: string) => {
    setSelectedSupplierName(name);
    const found = supplierList.find((s) => s.supplierName === name);
    if (found) {
      if (found.latestRate > 0) setRatePerUnit(String(found.latestRate));
      if (found.latestUnit) setUnit(found.latestUnit);
      if (found.latestWoodType) setWoodType(found.latestWoodType);
    }
  };

  const liveCalc = useMemo(() => {
    return calculateWoodFuelBill(
      Number(quantity) || 0,
      Number(ratePerUnit) || 0,
      Number(instantPaid) || 0
    );
  }, [quantity, ratePerUnit, instantPaid]);

  const handleQuickWoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(0, Number(quantity) || 0);
    const rate = Math.max(0, Number(ratePerUnit) || 0);
    if (qty <= 0 || rate <= 0) return;

    setEntrySaving(true);
    try {
      await onSaveWoodFuel({
        date: todayDate,
        supplierName: activeSupplier.supplierName,
        supplierPhone: activeSupplier.supplierPhone || '',
        woodType,
        vehicleOrChallan: 'ড্যাশবোর্ড শর্টকাট এন্ট্রি',
        quantity: qty,
        unit,
        ratePerUnit: rate,
        paidAmount: Math.max(0, Number(instantPaid) || 0),
        paymentMethod: 'নগদ ক্যাশ',
        note: 'মূল ড্যাশবোর্ড থেকে দ্রুত কাঠ/জ্বালানি এন্ট্রি',
      });
      setInstantPaid('0');
    } finally {
      setEntrySaving(false);
    }
  };

  const handleQuickPayBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Math.round(Number(payAmount) || 0));
    if (amt <= 0) return;

    setPaySaving(true);
    try {
      await onPayWoodSupplier({
        supplierName: activeSupplier.supplierName,
        amount: amt,
        date: todayDate,
        paymentMethod: payMethod,
        note: payNote.trim() || 'মূল ড্যাশবোর্ড শর্টকাট বকেয়া পরিশোধ',
      });
      setPayAmount('');
      setPayNote('');
    } finally {
      setPaySaving(false);
    }
  };

  return (
    <Card
      as="section"
      variant="default"
      topAccent="orange"
      padding="lg"
      className="space-y-4 border-2 border-orange-200/90 shadow-sm"
      data-testid="dashboard-quick-wood-fuel-card"
    >
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-600 via-amber-600 to-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-orange-700">
              <span>দৈনিক কাঠ ও জ্বালানি শর্টকাট বক্স</span>
              <span>·</span>
              <span>জ্বালানি ও কাঠ হিসাবের সাথে সরাসরি যুক্ত</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-950">
              কাঠ/জ্বালানি ব্যাপারী সিলেক্ট, দ্রুত কাঠ এন্ট্রি ও ব্যালেন্স পেমেন্ট (Quick Wood & Supplier Balance)
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              জ্বালানি ও কাঠ খাতায় তৈরি করা ব্যাপারীদের নাম সিলেক্ট করে এখান থেকেই প্রতিদিন কত মণ কাঠ/জ্বালানি আসলো এবং কে কত টাকা পাচ্ছে তা ১-ক্লিকে সেট করুন।
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="open-full-jalani-hisab-btn"
          onClick={onOpenJalaniHisab}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/50 text-xs font-extrabold cursor-pointer shrink-0 self-start lg:self-auto transition-colors"
        >
          মূল জ্বালানি ও কাঠ খাতায় যান (নতুন নাম / এডিট) →
        </button>
      </div>

      {/* Step 1: Select Existing Supplier + Live Balance Strip */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-5 space-y-1.5">
            <label
              htmlFor="dashboard-wood-supplier-select"
              className="block text-xs font-extrabold text-amber-300"
            >
              ১. তালিকা থেকে জ্বালানি/কাঠ ব্যাপারীর নাম সিলেক্ট করুন:
            </label>
            <select
              id="dashboard-wood-supplier-select"
              data-testid="dashboard-wood-supplier-select"
              value={activeSupplier.supplierName}
              onChange={(e) => handleSelectSupplier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border-2 border-amber-400/70 text-white text-sm font-extrabold focus:outline-none focus:border-amber-300 cursor-pointer"
            >
              {supplierList.map((sup) => (
                <option key={sup.supplierName} value={sup.supplierName}>
                  {sup.supplierName} — পাওনা ব্যালেন্স: {formatCurrencyBn(sup.totalDue)} (মোট:{' '}
                  {formatBn(sup.totalQuantity)} {sup.latestUnit || 'মণ'})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Supplier Live Balance KPIs */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
              <span className="text-slate-300 font-bold block text-[11px]">মোট কাঠ/জ্বালানি জমা</span>
              <strong
                data-testid="selected-wood-supplier-qty"
                className="text-sm sm:text-base font-black text-sky-300 font-mono block mt-0.5"
              >
                {formatBn(activeSupplier.totalQuantity)} {activeSupplier.latestUnit || 'মণ'}
              </strong>
              <span className="text-[10px] text-slate-400">
                সর্বশেষ দর: ৳{formatBn(activeSupplier.latestRate || 210)}/{activeSupplier.latestUnit || 'মণ'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
              <span className="text-slate-300 font-bold block text-[11px]">মোট জ্বালানি বিল</span>
              <strong className="text-sm sm:text-base font-black text-white font-mono block mt-0.5">
                {formatCurrencyBn(activeSupplier.totalBill)}
              </strong>
              <span className="text-[10px] text-slate-400">সকল চালান মিলিয়ে</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
              <span className="text-slate-300 font-bold block text-[11px]">মোট নগদ পরিশোধ</span>
              <strong className="text-sm sm:text-base font-black text-emerald-400 font-mono block mt-0.5">
                {formatCurrencyBn(activeSupplier.totalPaid)}
              </strong>
              <span className="text-[10px] text-slate-400">পরিশোধিত টাকা</span>
            </div>

            {(() => {
              const rawDina = Math.max(0, (activeSupplier.totalPaid || 0) - (activeSupplier.totalBill || 0));
              const effectiveDina = Math.max(activeSupplier.dinaAmount || 0, rawDina);
              const isDina = effectiveDina > 0;
              if (isDina) {
                return (
                  <div className="p-2.5 rounded-xl border-2 bg-amber-950/90 border-amber-500">
                    <span className="text-amber-300 font-extrabold block text-[11px] flex items-center justify-between">
                      <span>দিনা (অগ্রিম জমা)</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[9px] font-black">দিনা</span>
                    </span>
                    <strong
                      data-testid="selected-wood-supplier-due"
                      className="text-sm sm:text-base font-black font-mono block mt-0.5 text-amber-300"
                    >
                      দিনা: {formatCurrencyBn(effectiveDina)}
                    </strong>
                    <span className="text-[10px] text-amber-200 font-bold">
                      ভাটার অগ্রিম টাকা (পরের কাঠে কাটা হবে)
                    </span>
                  </div>
                );
              }
              return (
                <div
                  className={`p-2.5 rounded-xl border-2 ${
                    activeSupplier.totalDue > 0
                      ? 'bg-rose-950/90 border-rose-500'
                      : 'bg-emerald-950/80 border-emerald-500'
                  }`}
                >
                  <span className="text-amber-200 font-extrabold block text-[11px]">
                    ব্যাপারী পাবে (ব্যালেন্স)
                  </span>
                  <strong
                    data-testid="selected-wood-supplier-due"
                    className={`text-sm sm:text-base font-black font-mono block mt-0.5 ${
                      activeSupplier.totalDue > 0 ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {formatCurrencyBn(activeSupplier.totalDue)}
                  </strong>
                  <span className="text-[10px] text-slate-200 font-bold">
                    {activeSupplier.totalDue > 0 ? 'বকেয়া পাওনা আছে' : '১০০% পরিশোধিত'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Quick Supplier Switch Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800 text-xs">
          <span className="text-[11px] font-bold text-slate-400 mr-1">দ্রুত নাম নির্বাচন:</span>
          {supplierList.map((sup) => {
            const isSelected = sup.supplierName === activeSupplier.supplierName;
            return (
              <button
                key={sup.supplierName}
                type="button"
                onClick={() => handleSelectSupplier(sup.supplierName)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <UserCheck className="w-3 h-3" />
                <span>{sup.supplierName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    isSelected
                      ? 'bg-slate-950 text-amber-300'
                      : sup.totalDue > 0
                      ? 'bg-rose-900/80 text-rose-200'
                      : 'bg-emerald-900/80 text-emerald-200'
                  }`}
                >
                  {formatCurrencyBn(sup.totalDue)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Two Side-by-Side Shortcut Forms (Daily Wood Entry + Quick Balance Payment) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Form A: Quick Wood/Fuel Delivery Entry */}
        <form
          onSubmit={handleQuickWoodSubmit}
          data-testid="dashboard-quick-wood-entry-form"
          className="lg:col-span-7 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-extrabold text-slate-950">
                  🪵 শর্টকাট কাঠ ও জ্বালানি জমা ({activeSupplier.supplierName})
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {[50, 100, 150, 200].map((presetQty) => (
                  <button
                    key={presetQty}
                    type="button"
                    onClick={() => setQuantity(String(presetQty))}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer border ${
                      Number(quantity) === presetQty
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white hover:bg-orange-50 text-slate-800 border-amber-300'
                    }`}
                  >
                    {formatBn(presetQty)} মণ
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  জ্বালানির ধরন (১. কাঠ / ২. কয়লা / ৩. লাকড়ি)
                </label>
                <select
                  value={woodType}
                  onChange={(e) => setWoodType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                >
                  {QUICK_FUEL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  পরিমাণ ({unit})
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  data-testid="dashboard-quick-wood-qty-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-extrabold text-slate-950 font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  দর (প্রতি {unit} ৳)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  data-testid="dashboard-quick-wood-rate-input"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(e.target.value)}
                  placeholder="210"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-extrabold text-slate-950 font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center bg-white p-2.5 rounded-xl border border-amber-200 text-xs">
              <div>
                <span className="text-slate-500 font-bold block">আজকের চালান বিল:</span>
                <strong className="text-sm font-black text-slate-950 font-mono">
                  {formatCurrencyBn(liveCalc.totalBill)}
                </strong>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  নগদ জমা (যদি এখন দেন ৳):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={instantPaid}
                  onChange={(e) => setInstantPaid(e.target.value)}
                  className="w-full px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 font-extrabold text-emerald-800 font-mono"
                />
              </div>
              <div>
                <span className="text-slate-500 font-bold block">ব্যালেন্সে যুক্ত হবে:</span>
                <strong className="text-sm font-black text-rose-600 font-mono">
                  +{formatCurrencyBn(liveCalc.dueAmount)}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={entrySaving}
            data-testid="dashboard-quick-wood-submit-btn"
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {entrySaving
                ? 'সংরক্ষণ হচ্ছে...'
                : `+ ${activeSupplier.supplierName}-এর নামে ${formatBn(
                    Number(quantity) || 0
                  )} ${unit} কাঠ/জ্বালানি জমা করুন`}
            </span>
          </button>
        </form>

        {/* Form B: Quick Supplier Balance Settlement */}
        <form
          onSubmit={handleQuickPayBalanceSubmit}
          data-testid="dashboard-quick-wood-pay-form"
          className="lg:col-span-5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-extrabold text-slate-950">
                  💸 ব্যালেন্স / পাওনা পরিশোধ ({activeSupplier.supplierName})
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-black font-mono">
                পাওনা: {formatCurrencyBn(activeSupplier.totalDue)}
              </span>
            </div>

            {/* Quick Payment Amount Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[5000, 10000, 20000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPayAmount(String(amt))}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold cursor-pointer font-mono"
                >
                  ৳ {formatBn(amt)}
                </button>
              ))}
              {activeSupplier.totalDue > 0 && (
                <button
                  type="button"
                  data-testid="dashboard-wood-pay-full-due-btn"
                  onClick={() => setPayAmount(String(activeSupplier.totalDue))}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-extrabold cursor-pointer"
                >
                  সম্পূর্ণ পাওনা ({formatCurrencyBn(activeSupplier.totalDue)})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  পরিশোধের পরিমাণ (৳)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  data-testid="dashboard-quick-wood-pay-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={
                    activeSupplier.totalDue > 0 ? String(activeSupplier.totalDue) : '5000'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-extrabold text-slate-950 font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  পেমেন্ট মাধ্যম
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                  <option value="বিকাশ">বিকাশ (bKash)</option>
                  <option value="নগদ (Nagad)">নগদ (Nagad)</option>
                  <option value="ব্যাংক চেক">ব্যাংক চেক</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-xs flex items-center justify-between">
              <span className="text-slate-600 font-bold">পরিশোধের পর অবশিষ্ট ব্যালেন্স থাকবে:</span>
              <strong className="text-sm font-black text-slate-950 font-mono">
                {formatCurrencyBn(
                  Math.max(0, activeSupplier.totalDue - (Number(payAmount) || 0))
                )}
              </strong>
            </div>
          </div>

          <button
            type="submit"
            disabled={paySaving || (Number(payAmount) || 0) <= 0}
            data-testid="dashboard-quick-wood-pay-submit-btn"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            <Banknote className="w-4 h-4" />
            <span>
              {paySaving
                ? 'পরিশোধ হচ্ছে...'
                : `💸 ${activeSupplier.supplierName}-কে পেমেন্ট সেট করুন`}
            </span>
          </button>
        </form>
      </div>
    </Card>
  );
};
