import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Edit3,
  FileText,
  Flame,
  Phone,
  PlusCircle,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  LanguageMode,
  PaymentMethod,
  ProductionPaymentRecord,
  WoodFuelRecord,
} from '../types/kiln';
import {
  calculateWoodFuelBill,
  computeWoodFuelSupplierSummary,
  computeWorkerBalanceWithDina,
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';
import { calculateFiringEfficiency } from '../utils/aiCommandAndEfficiencyLogic';
import { Card } from './Card';

interface JalaniHisabTabProps {
  lang?: LanguageMode;
  todayDate: string;
  woodFuelRecords: WoodFuelRecord[];
  productionPayments: ProductionPaymentRecord[];
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
  onDeleteWoodFuel: (id: string) => Promise<void>;
  onDeletePaymentRecord: (id: string) => Promise<void>;
}

const WOOD_TYPES = [
  '১. কাঠ — মিক্সড জ্বালানি কাঠ',
  '১. কাঠ — গজারি / সুন্দরী / আম কাঠ',
  '১. কাঠ — গাছের গুঁড়ি / মোটা কাঠ',
  '২. কয়লা — ইন্দোনেশিয়ান / বড়পুকুরিয়া কয়লা',
  '২. কয়লা — চুল্লির গুঁড়া ও ভাঙা কয়লা',
  '৩. লাকড়ি — চেরা লাকড়ি / ফাড়াই লাকড়ি',
  '৩. লাকড়ি — শুকনা চিকন লাকড়ি (আগুন ধরানো)',
  'মিক্সড জ্বালানি কাঠ',
  'গজারি কাঠ',
  'আম কাঠ',
  'কড়ই / রেইনট্রি কাঠ',
  'তেঁতুল ও বাবলা কাঠ',
  'সুন্দরী ও গরান কাঠ',
  'চেরা লাকড়ি / ফাড়াই কাঠ',
  'গাছের গুঁড়ি / মোটা কাঠ',
];

const WOOD_UNITS = ['মণ', 'টন', 'গাড়ি', 'কেজি', 'সিএফটি'];

const QUICK_QUANTITIES = [50, 100, 150, 200, 300, 500];
const QUICK_RATES_MAUND = [180, 200, 220, 240, 250, 280, 300];

export const JalaniHisabTab: React.FC<JalaniHisabTabProps> = ({
  lang = 'bn',
  todayDate,
  woodFuelRecords,
  productionPayments,
  onSaveWoodFuel,
  onPayWoodSupplier,
  onDeleteWoodFuel,
  onDeletePaymentRecord,
}) => {
  const isEn = lang === 'en';

  // Form states for daily wood delivery entry
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayDate);
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [woodType, setWoodType] = useState<string>('মিক্সড জ্বালানি কাঠ');
  const [vehicleOrChallan, setVehicleOrChallan] = useState<string>('');
  const [unit, setUnit] = useState<string>('মণ');
  const [quantity, setQuantity] = useState<string>('');
  const [ratePerUnit, setRatePerUnit] = useState<string>('220');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Filter & Search states
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Supplier / Record Payment Modal state
  const [paymentModalTarget, setPaymentModalTarget] = useState<{
    recordId?: string;
    supplierName: string;
    maxDue: number;
    subLabel: string;
  } | null>(null);
  const [payModalAmount, setPayModalAmount] = useState<string>('');
  const [payModalDate, setPayModalDate] = useState<string>(todayDate);
  const [payModalMethod, setPayModalMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [payModalNote, setPayModalNote] = useState<string>('');
  const [payingSaving, setPayingSaving] = useState<boolean>(false);

  // Print Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Kiln Round Fuel (১. কাঠ, ২. কয়লা, ৩. লাকড়ি) & Efficiency Analyzer state
  const [effRoundNo, setEffRoundNo] = useState<string>('2');
  const [effBricksFired, setEffBricksFired] = useState<string>('380000');
  const [effWoodMaunds, setEffWoodMaunds] = useState<string>('320');
  const [effWoodRate, setEffWoodRate] = useState<string>('200');
  const [effCoalTons, setEffCoalTons] = useState<string>('62');
  const [effCoalRate, setEffCoalRate] = useState<string>('18500');
  const [effLakriMaunds, setEffLakriMaunds] = useState<string>('120');
  const [effLakriRate, setEffLakriRate] = useState<string>('170');
  const [savedRoundEfficiencyList, setSavedRoundEfficiencyList] = useState<
    Array<{
      id: string;
      roundNo: number;
      bricksFired: number;
      woodMaunds: number;
      coalTons: number;
      lakriMaunds: number;
      totalWoodCost: number;
      totalCoalCost: number;
      totalLakriCost: number;
      coalTonsPerLakh: number;
      woodMaundsPerLakh: number;
      lakriMaundsPerLakh: number;
      fuelCostPerThousand: number;
      totalFuelCost: number;
      ratingLabelBn: string;
      rating: 'OPTIMAL' | 'NORMAL' | 'EXCESSIVE';
    }>
  >([
    {
      id: 'rnd-eff-1',
      roundNo: 1,
      bricksFired: 400000,
      woodMaunds: 300,
      coalTons: 64,
      lakriMaunds: 110,
      totalWoodCost: 60000,
      totalCoalCost: 1184000,
      totalLakriCost: 18700,
      coalTonsPerLakh: 16.0,
      woodMaundsPerLakh: 75.0,
      lakriMaundsPerLakh: 27.5,
      fuelCostPerThousand: 3157,
      totalFuelCost: 1262700,
      ratingLabelBn: 'উত্তম সাশ্রয়ী ফায়ারিং (Optimal Efficiency)',
      rating: 'OPTIMAL',
    },
    {
      id: 'rnd-eff-2',
      roundNo: 2,
      bricksFired: 380000,
      woodMaunds: 320,
      coalTons: 62,
      lakriMaunds: 120,
      totalWoodCost: 64000,
      totalCoalCost: 1147000,
      totalLakriCost: 20400,
      coalTonsPerLakh: 16.32,
      woodMaundsPerLakh: 84.2,
      lakriMaundsPerLakh: 31.6,
      fuelCostPerThousand: 3241,
      totalFuelCost: 1231400,
      ratingLabelBn: 'উত্তম সাশ্রয়ী ফায়ারিং (Optimal Efficiency)',
      rating: 'OPTIMAL',
    },
  ]);

  const summary = useMemo(
    () => computeWoodFuelSupplierSummary(woodFuelRecords),
    [woodFuelRecords]
  );

  // Breakdown of recorded fuel challans by 1. কাঠ (Wood), 2. কয়লা (Coal), 3. লাকড়ি (Lakri)
  const threeFuelBreakdown = useMemo(() => {
    let katQty = 0;
    let katBill = 0;
    let koilaQty = 0;
    let koilaBill = 0;
    let lakriQty = 0;
    let lakriBill = 0;

    for (const r of woodFuelRecords || []) {
      const wt = (r.woodType || '').toLowerCase();
      const qty = Number(r.quantity) || 0;
      const bill = Number(r.totalBill) || 0;
      if (wt.includes('কয়লা') || wt.includes('কয়লা') || wt.includes('coal')) {
        koilaQty += qty;
        koilaBill += bill;
      } else if (wt.includes('লাকড়ি') || wt.includes('লাকড়ি') || wt.includes('ফাড়াই') || wt.includes('ফাড়াই')) {
        lakriQty += qty;
        lakriBill += bill;
      } else {
        katQty += qty;
        katBill += bill;
      }
    }
    return {
      katQty,
      katBill,
      koilaQty,
      koilaBill,
      lakriQty,
      lakriBill,
    };
  }, [woodFuelRecords]);

  const jalaniPayments = useMemo(
    () =>
      (productionPayments || []).filter(
        (p) => p.section === 'JALANI'
      ),
    [productionPayments]
  );

  const liveCalc = useMemo(
    () =>
      calculateWoodFuelBill(
        parseNum(quantity, 0),
        parseNum(ratePerUnit, 0),
        parseNum(paidAmount, 0)
      ),
    [quantity, ratePerUnit, paidAmount]
  );

  // Select an existing supplier to auto-fill their individual rate, unit, and phone
  const handleSelectExistingSupplier = (supName: string) => {
    const matched = summary.suppliers.find(
      (s) => s.supplierName.toLowerCase() === supName.trim().toLowerCase()
    );
    setSupplierName(supName);
    if (matched) {
      if (matched.supplierPhone) setSupplierPhone(matched.supplierPhone);
      if (matched.latestRate > 0) setRatePerUnit(String(matched.latestRate));
      if (matched.latestUnit) setUnit(matched.latestUnit);
      if (matched.latestWoodType) setWoodType(matched.latestWoodType);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(todayDate);
    setSupplierName('');
    setSupplierPhone('');
    setWoodType('মিক্সড জ্বালানি কাঠ');
    setVehicleOrChallan('');
    setUnit('মণ');
    setQuantity('');
    setRatePerUnit('220');
    setPaidAmount('');
    setPaymentMethod('নগদ ক্যাশ');
    setNote('');
  };

  const handleStartEdit = (rec: WoodFuelRecord) => {
    setEditingId(rec.id);
    setDate(rec.date || todayDate);
    setSupplierName(rec.supplierName);
    setSupplierPhone(rec.supplierPhone || '');
    setWoodType(rec.woodType || 'মিক্সড জ্বালানি কাঠ');
    setVehicleOrChallan(rec.vehicleOrChallan || '');
    setUnit(rec.unit || 'মণ');
    setQuantity(String(rec.quantity));
    setRatePerUnit(String(rec.ratePerUnit));
    setPaidAmount(String(rec.paidAmount || 0));
    setPaymentMethod(rec.paymentMethod || 'নগদ ক্যাশ');
    setNote(rec.note || '');
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseNum(quantity, 0);
    const rateNum = parseNum(ratePerUnit, 0);
    const paidNum = parseNum(paidAmount, 0);
    const effectiveSupplier =
      supplierName.trim() || summary.suppliers[0]?.supplierName || 'জলিল ব্যাপারী';
    if ((qtyNum <= 0 || rateNum <= 0) && paidNum <= 0) {
      return;
    }
    setSubmitting(true);
    try {
      await onSaveWoodFuel({
        id: editingId || undefined,
        date: date || todayDate,
        supplierName: effectiveSupplier,
        supplierPhone: supplierPhone.trim(),
        woodType: woodType.trim() || 'মিক্সড জ্বালানি কাঠ',
        vehicleOrChallan: vehicleOrChallan.trim(),
        quantity: qtyNum,
        unit: unit || 'মণ',
        ratePerUnit: rateNum,
        paidAmount: paidNum,
        paymentMethod,
        note: note.trim(),
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalTarget) return;
    const amt = Math.round(parseNum(payModalAmount, 0));
    if (amt <= 0) return;
    setPayingSaving(true);
    try {
      await onPayWoodSupplier({
        recordId: paymentModalTarget.recordId,
        supplierName: paymentModalTarget.supplierName,
        amount: amt,
        date: payModalDate || todayDate,
        paymentMethod: payModalMethod,
        note: payModalNote.trim() || 'জ্বালানি কাঠ বকেয়া পরিশোধ',
      });
      setPaymentModalTarget(null);
      setPayModalAmount('');
      setPayModalNote('');
    } finally {
      setPayingSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return (woodFuelRecords || []).filter((r) => {
      if (
        selectedSupplierFilter !== 'ALL' &&
        r.supplierName.trim().toLowerCase() !== selectedSupplierFilter.toLowerCase()
      ) {
        return false;
      }
      if (statusFilter === 'DUE' && (r.dueAmount || 0) <= 0) return false;
      if (statusFilter === 'PAID' && (r.dueAmount || 0) > 0) return false;
      if (dateFilter && r.date !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${r.supplierName} ${r.supplierPhone || ''} ${r.woodType} ${
          r.vehicleOrChallan || ''
        } ${r.note || ''} ${r.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    woodFuelRecords,
    selectedSupplierFilter,
    statusFilter,
    dateFilter,
    searchQuery,
  ]);

  return (
    <div data-testid="jalani-hisab-tab" className="space-y-6 animate-slide-up">
      {/* 1. EXECUTIVE DARK HEADER & 4 SUMMARY CARDS (Main Dashboard Standard) */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-4 sm:p-6 text-white space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/90 pb-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/20 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  লাইভ জ্বালানি ও কাঠ সিঙ্ক
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                  {formatBn(summary.uniqueSuppliersCount)} জন সাপ্লায়ার · {formatBn(summary.totalDeliveries)}টি চালান
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-1">
                {isEn
                  ? 'Firewood & Fuel Ledger (Supplier-wise Wood Rates & Payments)'
                  : 'জ্বালানি ও কাঠ হিসাব (সাপ্লায়ার ভিত্তিক দৈনিক কাঠ, আলাদা রেট ও পেমেন্ট)'}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                ভাটার জ্বালানিতে যারা প্রতিদিন কাঠ দেয়, তাদের প্রত্যেকের আলাদা রেট (মণ/টন/গাড়ি), প্রতিদিনের কাঠের পরিমাণ, মোট বিল ও পেমেন্টের পূর্ণাঙ্গ খতিয়ান
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="sbl-btn-interactive inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              {isEn ? 'Print Fuel Report' : 'জ্বালানি খতিয়ান প্রিন্ট / PDF'}
            </button>
          </div>
        </div>

        {/* Summary KPI Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-amber-500">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block">
              মোট জ্বালানি কাঠ সরবরাহ (Total Wood)
            </span>
            <span
              data-testid="jalani-total-wood"
              className="text-lg sm:text-2xl font-black text-amber-400 tabular-nums mt-1 block"
            >
              {summary.unitBreakdownBn || '০ মণ'}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block truncate">
              মোট চালান: {formatBn(summary.totalDeliveries)}টি · সমতুল্য প্রায় {formatBn(summary.totalMaundEquivalent)} মণ
            </span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-cyan-500">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block">
              মোট কাঠের বিল (Total Fuel Bill)
            </span>
            <span
              data-testid="jalani-total-bill"
              className="text-lg sm:text-2xl font-black text-cyan-300 tabular-nums mt-1 block"
            >
              {formatCurrencyBn(summary.totalBillAmount)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block">
              সাপ্লায়ারদের নিজ নিজ রেট অনুযায়ী মোট দাম
            </span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-emerald-500">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block">
              মোট পরিশোধিত পেমেন্ট (Total Paid)
            </span>
            <span
              data-testid="jalani-total-paid"
              className="text-lg sm:text-2xl font-black text-emerald-400 tabular-nums mt-1 block"
            >
              {formatCurrencyBn(summary.totalPaidAmount)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block">
              ক্যাশ বুকে ‘বিদ্যুৎ ও জ্বালানি’ খাতে যুক্ত
            </span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-rose-500">
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block">
              সাপ্লায়ারদের বকেয়া পাওনা (Total Due)
            </span>
            <span
              data-testid="jalani-total-due"
              className="text-lg sm:text-2xl font-black text-rose-400 tabular-nums mt-1 block"
            >
              {formatCurrencyBn(summary.totalDueAmount)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 block">
              {summary.totalDueAmount > 0
                ? 'কিস্তিতে বা নগদে পরিশোধযোগ্য বকেয়া'
                : 'সকল সাপ্লায়ারের বিল ১০০% পরিশোধিত'}
            </span>
          </div>

          <div
            data-testid="jalani-total-dina-card"
            className={`p-3.5 sm:p-4 rounded-xl border border-t-2 col-span-2 sm:col-span-1 ${
              summary.totalDinaAmount > 0
                ? 'bg-amber-950/50 border-amber-500/60 border-t-amber-400 shadow-sm'
                : 'bg-slate-900/90 border-slate-800 border-t-slate-600'
            }`}
          >
            <span className="text-[11px] sm:text-xs font-bold block flex items-center justify-between text-amber-300">
              <span>দিনা / অগ্রিম জমা (Total Dina)</span>
              {summary.totalDinaAmount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                  দিনা
                </span>
              )}
            </span>
            <span
              data-testid="jalani-total-dina"
              className={`text-lg sm:text-2xl font-black tabular-nums mt-1 block ${
                summary.totalDinaAmount > 0 ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {formatCurrencyBn(summary.totalDinaAmount)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-amber-200/80 mt-0.5 block">
              {summary.totalDinaAmount > 0
                ? 'ভাটার অতিরিক্ত টাকা জমা (পরের কাঠে কাটা হবে)'
                : 'বর্তমানে কোনো অতিরিক্ত দিনা নেই'}
            </span>
          </div>
        </div>

        {/* ৩টি মূল জ্বালানি খাতের খরচ বিশ্লেষণ: ১. কাঠ · ২. কয়লা · ৩. লাকড়ি */}
        <div
          data-testid="three-fuel-category-summary"
          className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-slate-800/80"
        >
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                ১. কাঠ (Wood)
              </span>
              <div className="text-sm font-extrabold text-white mt-1">
                জ্বালানি ও গুঁড়ি কাঠ খরচ
              </div>
              <div className="text-[11px] text-amber-200/90 font-mono">
                মোট পরিমাণ: {formatBn(threeFuelBreakdown.katQty)} মণ/একক
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-amber-300 tabular-nums">
                {formatCurrencyBn(threeFuelBreakdown.katBill)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setWoodType('১. কাঠ — মিক্সড জ্বালানি কাঠ');
                  setUnit('মণ');
                  setRatePerUnit('220');
                  document.getElementById('wood-supplier-input')?.focus();
                }}
                className="mt-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-[10px] font-extrabold border border-amber-400/40 cursor-pointer transition-colors"
              >
                + ১. কাঠ যোগ করুন
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 text-[10px] font-black">
                ২. কয়লা (Coal)
              </span>
              <div className="text-sm font-extrabold text-white mt-1">
                চুল্লির কয়লা বাবদ খরচ
              </div>
              <div className="text-[11px] text-emerald-200/90 font-mono">
                মোট পরিমাণ: {formatBn(threeFuelBreakdown.koilaQty)} টন/একক
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-emerald-300 tabular-nums">
                {formatCurrencyBn(threeFuelBreakdown.koilaBill)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setWoodType('২. কয়লা — ইন্দোনেশিয়ান / বড়পুকুরিয়া কয়লা');
                  setUnit('টন');
                  setRatePerUnit('18500');
                  document.getElementById('wood-supplier-input')?.focus();
                }}
                className="mt-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-400 text-emerald-300 hover:text-slate-950 text-[10px] font-extrabold border border-emerald-400/40 cursor-pointer transition-colors"
              >
                + ২. কয়লা যোগ করুন
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-orange-950/40 border border-orange-500/40 flex items-center justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded bg-orange-400 text-slate-950 text-[10px] font-black">
                ৩. লাকড়ি (Lakri)
              </span>
              <div className="text-sm font-extrabold text-white mt-1">
                চেরা ও ফাড়াই লাকড়ি খরচ
              </div>
              <div className="text-[11px] text-orange-200/90 font-mono">
                মোট পরিমাণ: {formatBn(threeFuelBreakdown.lakriQty)} মণ/একক
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-orange-300 tabular-nums">
                {formatCurrencyBn(threeFuelBreakdown.lakriBill)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setWoodType('৩. লাকড়ি — চেরা লাকড়ি / ফাড়াই লাকড়ি');
                  setUnit('মণ');
                  setRatePerUnit('180');
                  document.getElementById('wood-supplier-input')?.focus();
                }}
                className="mt-1 px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-400 text-orange-300 hover:text-slate-950 text-[10px] font-extrabold border border-orange-400/40 cursor-pointer transition-colors"
              >
                + ৩. লাকড়ি যোগ করুন
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SUPPLIER-WISE RATE & LEDGER CARDS (সাপ্লায়ার ভিত্তিক আলাদা রেট ও খতিয়ান) */}
      <Card as="section" variant="default" topAccent="amber" padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                কাঠ সাপ্লায়ার ও ব্যাপারীদের তালিকা (যার যার নির্ধারিত রেট ও পাওনা হিসাব)
              </h2>
              <p className="text-xs text-slate-500">
                যেকোনো সাপ্লায়ারের কার্ডে ক্লিক করলে তার রেট ফর্মে অটো-বসবে এবং নিচে শুধু তার হিসাব দেখা যাবে
              </p>
            </div>
          </div>

          {selectedSupplierFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedSupplierFilter('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              সকল সাপ্লায়ারের হিসাব দেখুন
            </button>
          )}
        </div>

        {summary.suppliers.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
            এখনো কোনো কাঠ সাপ্লায়ারের চালান যোগ করা হয়নি। নিচের ফর্ম থেকে প্রতিদিনের কাঠ সরবরাহ ও সাপ্লায়ারের রেট লিখে সেভ করুন।
          </div>
        ) : (
          <div
            data-testid="wood-supplier-cards-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {summary.suppliers.map((sup) => {
              const isSelected =
                selectedSupplierFilter.toLowerCase() === sup.supplierKey;
              const rawDina = Math.max(0, (sup.totalPaid || 0) - (sup.totalBill || 0));
              const effectiveDina = Math.max(sup.dinaAmount || 0, rawDina);
              const hasDina = effectiveDina > 0;
              return (
                <div
                  key={sup.supplierKey}
                  data-testid={`wood-supplier-card-${sup.supplierName}`}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                      : hasDina
                      ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 hover:border-amber-300 hover:bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierFilter(
                            isSelected ? 'ALL' : sup.supplierName
                          );
                          handleSelectExistingSupplier(sup.supplierName);
                        }}
                        className="text-left group cursor-pointer"
                      >
                        <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-orange-700 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-orange-600 shrink-0" />
                          {sup.supplierName}
                        </h3>
                        {sup.supplierPhone && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {sup.supplierPhone}
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {hasDina && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs tabular-nums">
                            দিনা: {formatCurrencyBn(effectiveDina)}
                          </span>
                        )}
                        {/* Individual Supplier Rate Badge */}
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-orange-100 text-orange-900 border border-orange-200 tabular-nums">
                          রেট: ৳{formatBn(sup.latestRate)}/{sup.latestUnit}
                        </span>
                      </div>
                    </div>

                    {sup.distinctRates.length > 1 && (
                      <div className="text-[11px] text-slate-500 mt-1">
                        রেটসমূহ: {sup.distinctRates.map((r) => `৳${formatBn(r)}`).join(', ')} / {sup.latestUnit}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">মোট কাঠ</span>
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {sup.unitSummaryBn}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {formatBn(sup.deliveryCount)} বার দিয়েছে
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">মোট বিল / জমা</span>
                        <span className="font-bold text-slate-800 tabular-nums block">
                          {formatCurrencyBn(sup.totalBill)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 tabular-nums block">
                          জমা: {formatCurrencyBn(sup.totalPaid)}
                        </span>
                      </div>
                      <div className="text-right">
                        {hasDina ? (
                          <>
                            <span className="text-[10px] text-amber-700 font-extrabold block">দিনা (অগ্রিম জমা)</span>
                            <span className="text-xs sm:text-sm font-black tabular-nums block text-amber-700 bg-amber-100/90 px-1 py-0.5 rounded border border-amber-300">
                              দিনা: {formatCurrencyBn(effectiveDina)}
                            </span>
                            <span className="text-[9px] text-amber-800 font-bold block mt-0.5">
                              ভাটার কাছে অগ্রিম
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-slate-500 block">বকেয়া পাওনা</span>
                            <span
                              className={`text-sm font-black tabular-nums block ${
                                sup.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {formatCurrencyBn(sup.totalDue)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {sup.totalDue > 0 ? 'পরিশোধ বাকি' : 'পরিশোধিত'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectExistingSupplier(sup.supplierName);
                        const qtyInput = document.getElementById('wood-qty-input');
                        qtyInput?.focus();
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-800 border border-slate-300 transition-colors cursor-pointer"
                    >
                      + আজকের কাঠ তুলুন (৳{formatBn(sup.latestRate)})
                    </button>

                    {hasDina ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-1 rounded-md border border-amber-200">
                        পরের চালানে দিনা কাটা হবে (৳{formatBn(effectiveDina)})
                      </span>
                    ) : sup.totalDue > 0 ? (
                      <button
                        type="button"
                        data-testid={`pay-wood-supplier-btn-${sup.supplierName}`}
                        onClick={() => {
                          setPaymentModalTarget({
                            supplierName: sup.supplierName,
                            maxDue: sup.totalDue,
                            subLabel: `মোট সরবরাহ: ${sup.unitSummaryBn} · বর্তমান বকেয়া: ${formatCurrencyBn(sup.totalDue)}`,
                          });
                          setPayModalAmount(String(sup.totalDue));
                          setPayModalDate(todayDate);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-colors cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        পেমেন্ট দিন
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> পরিশোধিত
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 3. DAILY WOOD DELIVERY & RATE ENTRY FORM + LIVE BILL CALCULATOR */}
      <Card
        as="form"
        onSubmit={handleSubmit}
        data-testid="wood-fuel-entry-form"
        variant="default"
        topAccent="orange"
        padding="lg"
        className="space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 text-white shadow-xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                {editingId
                  ? 'জ্বালানি কাঠের চালান ও পেমেন্ট সংশোধন করুন'
                  : 'প্রতিদিনের জ্বালানি কাঠ জমার এন্ট্রি (কে কতটা কাঠ দিল ও তার রেট)'}
              </h2>
              <p className="text-xs text-slate-500">
                সাপ্লায়ার সিলেক্ট করলে তার আগের রেট অটো-বসবে, অথবা নতুন সাপ্লায়ার ও তার নিজস্ব রেট লিখে সেভ করুন
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              এডিট বাতিল করুন
            </button>
          )}
        </div>

        {/* Quick Supplier Selector Pills (if existing suppliers exist) */}
        {summary.suppliers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-orange-50/60 border border-orange-200/70 rounded-xl p-3">
            <span className="text-xs font-extrabold text-orange-900">
              দ্রুত সাপ্লায়ার নির্বাচন (রেট অটো-বসবে):
            </span>
            {summary.suppliers.map((sup) => (
              <button
                key={sup.supplierKey}
                type="button"
                onClick={() => handleSelectExistingSupplier(sup.supplierName)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  supplierName.trim().toLowerCase() === sup.supplierKey
                    ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                    : 'bg-white text-slate-800 border-slate-300 hover:border-orange-400'
                }`}
              >
                {sup.supplierName} (৳{formatBn(sup.latestRate)}/{sup.latestUnit})
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date */}
          <div>
            <label
              htmlFor="wood-date-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              তারিখ (Date) *
            </label>
            <input
              id="wood-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
              required
            />
          </div>

          {/* Supplier Name */}
          <div>
            <label
              htmlFor="wood-supplier-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              সাপ্লায়ার / ব্যাপারীর নাম *
            </label>
            <input
              id="wood-supplier-input"
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="যেমন: জলিল ব্যাপারী / রফিক কাঠ সাপ্লায়ার"
              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
              required
            />
          </div>

          {/* Supplier Phone */}
          <div>
            <label
              htmlFor="wood-phone-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              মোবাইল নম্বর (ঐচ্ছিক)
            </label>
            <input
              id="wood-phone-input"
              type="text"
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
              placeholder="যেমন: ০১৭১১-XXXXXX"
              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
            />
          </div>

          {/* Wood Type */}
          <div>
            <label
              htmlFor="wood-type-select"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              কাঠের ধরন (Wood Type)
            </label>
            <select
              id="wood-type-select"
              value={woodType}
              onChange={(e) => setWoodType(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
            >
              {WOOD_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Unit */}
          <div>
            <label
              htmlFor="wood-unit-select"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              হিসাবের একক (Unit) *
            </label>
            <select
              id="wood-unit-select"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
            >
              {WOOD_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u} দরে হিসাব
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Delivered Today */}
          <div>
            <label
              htmlFor="wood-qty-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              কতটা কাঠ দিল ({unit}) *
            </label>
            <input
              id="wood-qty-input"
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(normalizeNumericInput(e.target.value))}
              placeholder={`যেমন: 150 ${unit}`}
              className="w-full px-3.5 py-2.5 text-sm font-extrabold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden tabular-nums"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {QUICK_QUANTITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(String(q))}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-800 border border-slate-200 cursor-pointer"
                >
                  {formatBn(q)} {unit}
                </button>
              ))}
            </div>
          </div>

          {/* Per-Supplier Rate */}
          <div>
            <label
              htmlFor="wood-rate-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              এই সাপ্লায়ারের দর (প্রতি {unit} ৳) *
            </label>
            <input
              id="wood-rate-input"
              type="text"
              inputMode="decimal"
              value={ratePerUnit}
              onChange={(e) => setRatePerUnit(normalizeNumericInput(e.target.value))}
              placeholder="যেমন: 220"
              className="w-full px-3.5 py-2.5 text-sm font-extrabold bg-orange-50/70 border border-orange-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden tabular-nums text-orange-950"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {QUICK_RATES_MAUND.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRatePerUnit(String(r))}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 hover:bg-orange-200 text-orange-900 border border-orange-200 cursor-pointer"
                >
                  ৳{formatBn(r)}
                </button>
              ))}
            </div>
          </div>

          {/* Instant Cash Payment */}
          <div>
            <label
              htmlFor="wood-paid-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              নগদ পেমেন্ট / জমা (৳)
            </label>
            <input
              id="wood-paid-input"
              type="text"
              inputMode="decimal"
              value={paidAmount}
              onChange={(e) => setPaidAmount(normalizeNumericInput(e.target.value))}
              placeholder="যেমন: 10000 (বাকি থাকলে 0 বা আংশিক)"
              className="w-full px-3.5 py-2.5 text-sm font-extrabold bg-emerald-50/60 border border-emerald-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-hidden tabular-nums text-emerald-950"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => setPaidAmount(String(liveCalc.totalBill))}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 cursor-pointer"
              >
                পূর্ণ বিল পরিশোধ ({formatCurrencyBn(liveCalc.totalBill)})
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount('0')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-900 cursor-pointer"
              >
                সম্পূর্ণ বাকি (৳০)
              </button>
            </div>
          </div>
        </div>

        {/* Vehicle / Challan, Payment Method & Note */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="wood-vehicle-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              গাড়ি / ট্রাক / ভ্যান বা চালান নং
            </label>
            <input
              id="wood-vehicle-input"
              type="text"
              value={vehicleOrChallan}
              onChange={(e) => setVehicleOrChallan(e.target.value)}
              placeholder="যেমন: ট্রাক-০২ / ভ্যান ৩টি / চালান-১০৫"
              className="w-full px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label
              htmlFor="wood-pay-method"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              পেমেন্ট মাধ্যম
            </label>
            <select
              id="wood-pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
            >
              <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
              <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
              <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="wood-note-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              মন্তব্য / বিবরণ (ঐচ্ছিক)
            </label>
            <input
              id="wood-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: শুকনা গজারি কাঠ, ২য় কিস্তিতে বাকি দেওয়া হবে"
              className="w-full px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Live Calculation Summary Bar & Submit Button */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 text-white rounded-2xl p-4 border border-slate-800">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">
                মোট বিল ({formatBn(liveCalc.quantity)} {unit} × ৳{formatBn(liveCalc.ratePerUnit)})
              </span>
              <span
                data-testid="wood-form-live-bill"
                className="text-lg font-black text-amber-400 tabular-nums"
              >
                {formatCurrencyBn(liveCalc.totalBill)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">নগদ পেমেন্ট (জমা)</span>
              <span className="text-lg font-black text-emerald-400 tabular-nums">
                {formatCurrencyBn(liveCalc.paidAmount)}
              </span>
            </div>
            <div>
              <span className={`block ${liveCalc.paidAmount > liveCalc.totalBill ? 'text-amber-300 font-bold' : 'text-slate-400'}`}>
                {liveCalc.paidAmount > liveCalc.totalBill ? 'দিনায় চলে যাবে (অগ্রিম)' : 'সাপ্লায়ার পাবে (বকেয়া)'}
              </span>
              <span
                className={`text-lg font-black tabular-nums ${
                  liveCalc.paidAmount > liveCalc.totalBill ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {liveCalc.paidAmount > liveCalc.totalBill
                  ? `দিনা ${formatCurrencyBn(liveCalc.paidAmount - liveCalc.totalBill)}`
                  : formatCurrencyBn(liveCalc.dueAmount)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            data-testid="wood-fuel-submit-btn"
            className="sbl-btn-interactive inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 shadow-lg shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            {submitting
              ? 'সেভ হচ্ছে...'
              : editingId
              ? 'কাঠের হিসাব আপডেট করুন'
              : '+ জ্বালানি কাঠের হিসাব সেভ করুন'}
          </button>
        </div>
      </Card>

      {/* 4. DAILY WOOD DELIVERY LEDGER TABLE */}
      <Card as="section" variant="default" padding="lg" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              প্রতিদিনের জ্বালানি কাঠ সরবরাহ ও পেমেন্ট খতিয়ান ({formatBn(filteredRecords.length)}টি রেকর্ড)
            </h2>
            <p className="text-xs text-slate-500">
              প্রতিদিন কে কতটা কাঠ দিল, কার রেট কত ছিল, কত পেমেন্ট হয়েছে এবং কত বাকি আছে তার বিস্তারিত তালিকা
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="সাপ্লায়ার, কাঠ বা গাড়ি খুঁজুন..."
                className="pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-hidden"
            />

            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {(['ALL', 'DUE', 'PAID'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'সব চালান' : st === 'DUE' ? 'বকেয়া আছে' : 'পরিশোধিত'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase">
                <th className="py-3 px-3.5 rounded-tl-xl font-bold">তারিখ</th>
                <th className="py-3 px-3.5 font-bold">সাপ্লায়ার / ব্যাপারী</th>
                <th className="py-3 px-3.5 font-bold">কাঠের ধরন ও গাড়ি/চালান</th>
                <th className="py-3 px-3.5 font-bold text-right">কাঠের পরিমাণ</th>
                <th className="py-3 px-3.5 font-bold text-right">দর (রেট)</th>
                <th className="py-3 px-3.5 font-bold text-right">মোট বিল</th>
                <th className="py-3 px-3.5 font-bold text-right">পরিশোধ (জমা)</th>
                <th className="py-3 px-3.5 font-bold text-right">বকেয়া পাওনা</th>
                <th className="py-3 px-3.5 rounded-tr-xl font-bold text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                    কোনো জ্বালানি কাঠের রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const hasDue = (rec.dueAmount || 0) > 0;
                  return (
                    <tr
                      key={rec.id}
                      data-testid={`wood-record-row-${rec.id}`}
                      className="hover:bg-orange-50/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {rec.date}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-extrabold text-slate-900">{rec.supplierName}</div>
                        {rec.supplierPhone && (
                          <div className="text-[11px] text-slate-500">{rec.supplierPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-800">{rec.woodType}</span>
                        {rec.vehicleOrChallan && (
                          <span className="block text-[11px] text-slate-500">
                            <Truck className="w-3 h-3 inline mr-1" />
                            {rec.vehicleOrChallan}
                          </span>
                        )}
                        {rec.note && (
                          <span className="block text-[11px] text-slate-500 italic">
                            “{rec.note}”
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatBn(rec.quantity)} {rec.unit}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-orange-700 tabular-nums whitespace-nowrap">
                        ৳{formatBn(rec.ratePerUnit)}/{rec.unit}
                      </td>
                      <td className="py-3 px-3.5 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrencyBn(rec.totalBill)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        {formatCurrencyBn(rec.paidAmount)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-extrabold tabular-nums whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md ${
                            rec.paidAmount > rec.totalBill
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                              : hasDue
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {rec.paidAmount > rec.totalBill
                            ? `দিনা ${formatCurrencyBn(rec.paidAmount - rec.totalBill)}`
                            : hasDue
                            ? formatCurrencyBn(rec.dueAmount)
                            : 'পরিশোধিত'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {hasDue && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentModalTarget({
                                  recordId: rec.id,
                                  supplierName: rec.supplierName,
                                  maxDue: rec.dueAmount,
                                  subLabel: `${rec.date} · ${formatBn(rec.quantity)} ${rec.unit} (@ ৳${formatBn(rec.ratePerUnit)}) · বকেয়া: ${formatCurrencyBn(rec.dueAmount)}`,
                                });
                                setPayModalAmount(String(rec.dueAmount));
                                setPayModalDate(todayDate);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              title="বকেয়া টাকা পরিশোধ করুন"
                            >
                              পেমেন্ট
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(rec)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 cursor-pointer"
                            title="সংশোধন করুন"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWoodFuel(rec.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. WOOD / FUEL PAYMENT HISTORY TABLE */}
      {jalaniPayments.length > 0 && (
        <Card as="section" variant="default" topAccent="emerald" padding="lg" className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              জ্বালানি ও কাঠ বাবদ প্রদত্ত পেমেন্ট হিস্ট্রি ({formatBn(jalaniPayments.length)}টি লেনদেন)
            </h3>
            <span className="text-xs font-bold text-emerald-700">
              সর্বমোট পরিশোধ: {formatCurrencyBn(summary.totalPaidAmount)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="py-2.5 px-3 font-bold">তারিখ</th>
                  <th className="py-2.5 px-3 font-bold">সাপ্লায়ার ও কাঠের বিবরণ</th>
                  <th className="py-2.5 px-3 font-bold">চালান তথ্য</th>
                  <th className="py-2.5 px-3 font-bold">মন্তব্য</th>
                  <th className="py-2.5 px-3 font-bold text-right">প্রদত্ত টাকা</th>
                  <th className="py-2.5 px-3 font-bold text-center">মুছুন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jalaniPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 tabular-nums font-semibold">{pay.date}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{pay.recipientName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{pay.subDetail}</td>
                    <td className="py-2.5 px-3 text-slate-500">{pay.note || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 tabular-nums">
                      {formatCurrencyBn(pay.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onDeletePaymentRecord(pay.id)}
                        className="p-1 rounded-lg hover:bg-rose-100 text-slate-500 hover:text-rose-700 cursor-pointer"
                        title="পেমেন্ট রেকর্ড মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 6. SUPPLIER DUE PAYMENT MODAL */}
      {paymentModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold text-emerald-700 uppercase">
                  জ্বালানি কাঠ সাপ্লায়ার পেমেন্ট
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {paymentModalTarget.supplierName}-কে পেমেন্ট দিন
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {paymentModalTarget.subLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalTarget(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form noValidate onSubmit={handlePayModalSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পেমেন্টের পরিমাণ (৳) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payModalAmount}
                  onChange={(e) => setPayModalAmount(normalizeNumericInput(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-base font-black bg-emerald-50/60 border border-emerald-400 rounded-xl focus:bg-white focus:outline-hidden tabular-nums"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPayModalAmount(String(paymentModalTarget.maxDue))}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-900 cursor-pointer"
                  >
                    সম্পূর্ণ বকেয়া ({formatCurrencyBn(paymentModalTarget.maxDue)})
                  </button>
                  {paymentModalTarget.maxDue >= 5000 && (
                    <button
                      type="button"
                      onClick={() => setPayModalAmount('5000')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      ৳৫,০০০
                    </button>
                  )}
                  {paymentModalTarget.maxDue >= 10000 && (
                    <button
                      type="button"
                      onClick={() => setPayModalAmount('10000')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      ৳১০,০০০
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={payModalDate}
                    onChange={(e) => setPayModalDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মাধ্যম
                  </label>
                  <select
                    value={payModalMethod}
                    onChange={(e) => setPayModalMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                    <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                    <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য / রসিদ নোট
                </label>
                <input
                  type="text"
                  value={payModalNote}
                  onChange={(e) => setPayModalNote(e.target.value)}
                  placeholder="যেমন: হাটবারে নগদ পরিশোধ"
                  className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={payingSaving}
                  data-testid="confirm-wood-supplier-pay-btn"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
                >
                  {payingSaving ? 'জমা হচ্ছে...' : 'পেমেন্ট নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. PRINTABLE WOOD & FUEL REPORT MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <h3 className="text-base font-extrabold text-slate-900">
                জ্বালানি ও কাঠ হিসাব খতিয়ান প্রিন্ট প্রিভিউ
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-600 text-white cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  প্রিন্ট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>

            <div className="text-center border-b border-slate-300 pb-4">
              <h2 className="text-xl font-black text-slate-950">
                SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
              </h2>
              <p className="text-xs text-slate-600">
                বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা · জ্বালানি ও কাঠ সরবরাহ খতিয়ান রিপোর্ট
              </p>
              <p className="text-xs font-bold text-slate-800 mt-1">
                মোট সরবরাহ: {summary.unitBreakdownBn} · মোট বিল: {formatCurrencyBn(summary.totalBillAmount)} · পরিশোধ: {formatCurrencyBn(summary.totalPaidAmount)} · বকেয়া: {formatCurrencyBn(summary.totalDueAmount)}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900">
                সাপ্লায়ার ভিত্তিক সামারি (যার যার রেট ও পাওনা):
              </h4>
              <table className="w-full text-left border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2">সাপ্লায়ারের নাম</th>
                    <th className="border border-slate-300 p-2">নির্ধারিত রেট</th>
                    <th className="border border-slate-300 p-2 text-right">মোট কাঠ</th>
                    <th className="border border-slate-300 p-2 text-right">মোট বিল</th>
                    <th className="border border-slate-300 p-2 text-right">পরিশোধ</th>
                    <th className="border border-slate-300 p-2 text-right">বকেয়া পাওনা</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.suppliers.map((s) => (
                    <tr key={s.supplierKey}>
                      <td className="border border-slate-300 p-2 font-bold">{s.supplierName}</td>
                      <td className="border border-slate-300 p-2">৳{formatBn(s.latestRate)}/{s.latestUnit}</td>
                      <td className="border border-slate-300 p-2 text-right">{s.unitSummaryBn}</td>
                      <td className="border border-slate-300 p-2 text-right">{formatCurrencyBn(s.totalBill)}</td>
                      <td className="border border-slate-300 p-2 text-right">{formatCurrencyBn(s.totalPaid)}</td>
                      <td className="border border-slate-300 p-2 text-right font-bold">{formatCurrencyBn(s.totalDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
