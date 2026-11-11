import React, { useState } from 'react';
import {
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  Edit3,
  Phone,
  Search,
  Sun,
  Sunset,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LanguageMode, WorkerAttendance, WorkerProfile } from '../types/kiln';
import {
  computeNewWorkWithDinaAdjustment,
  computeWorkerBalanceWithDina,
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';
import { Card } from './Card';

interface LabourSectionTabProps {
  lang?: LanguageMode;
  todayDate?: string;
  workerProfiles: WorkerProfile[];
  workerAttendance: WorkerAttendance[];
  onSaveWorkerProfile: (payload: {
    id?: string;
    name: string;
    role: string;
    phone: string;
    morningRate: number;
    afternoonRate: number;
  }) => Promise<void>;
  onToggleWorkerHajira: (payload: {
    workerId: string;
    date: string;
    morningPresent: boolean;
    afternoonPresent: boolean;
    morningRate: number;
    afternoonRate: number;
    note?: string;
  }) => Promise<void>;
  onPayWorker: (payload: {
    workerId: string;
    amount: number;
    paymentType: string;
    date: string;
    note: string;
  }) => Promise<void>;
  onSaveWorkerAttendance?: (payload: {
    workerId: string;
    morningPresent: boolean;
    afternoonPresent: boolean;
    customMorningRate: number;
    customAfternoonRate: number;
    khorakiAmount: number;
    hatbarAmount: number;
    note: string;
  }) => Promise<void>;
}

const ROLE_OPTIONS = [
  'সর্দার (Sardar)',
  'দিনমজুর (Daily Labour)',
  'কাঁচা ইট কাটা (Moulder)',
  'ভাটা লোড ও আনলোড (Loader)',
  'আগুন মিস্ত্রি (Fireman)',
  'ভেকু ও ট্রাক ড্রাইভার',
];

const PAYMENT_TYPE_OPTIONS = [
  'শুক্রবারের চূড়ান্ত বিল পরিশোধ (Friday Final Paid)',
  'খোরাকি পেমেন্ট — বিল কমানো (Khoraki)',
  'নগদ মজুরি জমা (Wage Payment)',
  'সাপ্তাহিক হাটবার পেমেন্ট (Hatbar)',
  'দাদন / অগ্রিম জমা (Advance)',
];

export const LabourSectionTab: React.FC<LabourSectionTabProps> = ({
  lang = 'bn',
  todayDate: propTodayDate,
  workerProfiles,
  workerAttendance,
  onSaveWorkerProfile,
  onToggleWorkerHajira,
  onPayWorker,
}) => {
  const isEn = lang === 'en';
  const defaultToday =
    propTodayDate || new Date().toISOString().split('T')[0];

  // Active sub-view: 'HAJIRA' vs 'PAYMENT'
  const [activeSubView, setActiveSubView] = useState<'HAJIRA' | 'PAYMENT'>('HAJIRA');
  const [selectedDate, setSelectedDate] = useState<string>(defaultToday);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'HAJIRA' | 'PAYMENT'>('ALL');

  // Search & Role Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Per-worker custom shift rate drafts
  const [rateDrafts, setRateDrafts] = useState<
    Record<string, { morningRate: number; afternoonRate: number }>
  >({});

  // Instant 0ms Optimistic Shift State & Pop Animation Key
  const [optimisticShifts, setOptimisticShifts] = useState<
    Record<string, { morningPresent: boolean; afternoonPresent: boolean }>
  >({});
  const [animatingBtnKey, setAnimatingBtnKey] = useState<string | null>(null);

  // Popup Modal for Add / Edit Worker Profile
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [role, setRole] = useState('দিনমজুর (Daily Labour)');
  const [phone, setPhone] = useState('');
  const [morningRate, setMorningRate] = useState('125');
  const [afternoonRate, setAfternoonRate] = useState('125');
  const [savingProfile, setSavingProfile] = useState(false);

  // Separate Popup Modal & Form State for Worker Money Deposit (লেবার টাকা জমা দেওয়ার আলাদা অপশন)
  const [payModalWorker, setPayModalWorker] = useState<WorkerProfile | null>(null);
  const [payWorkerId, setPayWorkerId] = useState<string>(workerProfiles[0]?.id || '');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payType, setPayType] = useState<string>(PAYMENT_TYPE_OPTIONS[0]);
  const [payDate, setPayDate] = useState<string>(defaultToday);
  const [payNote, setPayNote] = useState<string>('');
  const [submittingPay, setSubmittingPay] = useState<boolean>(false);

  const getWorkerRates = (w: WorkerProfile) => {
    return (
      rateDrafts[w.id] || {
        morningRate: w.morningRate,
        afternoonRate: w.afternoonRate,
      }
    );
  };

  // Find existing HAJIRA record for a worker on selectedDate
  const getWorkerHajiraForDate = (workerId: string, dateStr: string) => {
    return workerAttendance.find(
      (a) =>
        a.workerId === workerId &&
        a.date === dateStr &&
        (a.recordType === 'HAJIRA' ||
          (!a.recordType && (a.morningAmount > 0 || a.afternoonAmount > 0 || a.totalPaid === 0)))
    );
  };

  // Resolve instantaneous shift state (optimistic override first, then server record)
  const getEffectiveShiftState = (workerId: string, dateStr: string) => {
    const key = `${workerId}__${dateStr}`;
    if (optimisticShifts[key]) {
      return optimisticShifts[key];
    }
    const existing = getWorkerHajiraForDate(workerId, dateStr);
    return {
      morningPresent: existing ? Boolean(existing.morningPresent) : false,
      afternoonPresent: existing ? Boolean(existing.afternoonPresent) : false,
    };
  };

  const handleToggleShift = (
    worker: WorkerProfile,
    shift: 'MORNING' | 'AFTERNOON'
  ) => {
    const key = `${worker.id}__${selectedDate}`;
    const current = getEffectiveShiftState(worker.id, selectedDate);

    const nextMorning = shift === 'MORNING' ? !current.morningPresent : current.morningPresent;
    const nextAfternoon = shift === 'AFTERNOON' ? !current.afternoonPresent : current.afternoonPresent;
    const rates = getWorkerRates(worker);

    // 1. Instant 0ms UI update + pop animation
    setOptimisticShifts((prev) => ({
      ...prev,
      [key]: {
        morningPresent: nextMorning,
        afternoonPresent: nextAfternoon,
      },
    }));
    const btnId = `${worker.id}-${shift}`;
    setAnimatingBtnKey(btnId);
    setTimeout(() => {
      setAnimatingBtnKey((curr) => (curr === btnId ? null : curr));
    }, 260);

    // 2. Non-blocking background sync with server
    void onToggleWorkerHajira({
      workerId: worker.id,
      date: selectedDate,
      morningPresent: nextMorning,
      afternoonPresent: nextAfternoon,
      morningRate: Number(rates.morningRate) || worker.morningRate,
      afternoonRate: Number(rates.afternoonRate) || worker.afternoonRate,
    });
  };

  const handleOpenPayModal = (
    worker: WorkerProfile,
    mode: 'KHORAKI' | 'FRIDAY_FINAL' = 'FRIDAY_FINAL'
  ) => {
    const earned = worker.totalEarnedSeason ?? 0;
    const due = Math.max(0, earned - (worker.totalPaidSeason || 0));
    setPayModalWorker(worker);
    setPayWorkerId(worker.id);
    if (mode === 'KHORAKI') {
      setPayAmount(due > 0 ? String(Math.min(1000, due)) : '500');
      setPayType('খোরাকি পেমেন্ট — বিল কমানো (Khoraki)');
      setPayNote('সাপ্তাহিক খোরাকি বাবদ প্রদান (শুক্রবারের বিল হতে কর্তন)');
    } else {
      setPayAmount(due > 0 ? String(due) : '');
      setPayType('শুক্রবারের চূড়ান্ত বিল পরিশোধ (Friday Final Paid)');
      setPayNote('শুক্রবারের চূড়ান্ত বিল পরিশোধ (Paid)');
    }
    setPayDate(selectedDate || defaultToday);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = payModalWorker ? payModalWorker.id : payWorkerId;
    const amt = Math.max(0, parseNum(payAmount));
    if (!targetId || amt <= 0) return;

    setSubmittingPay(true);
    try {
      await onPayWorker({
        workerId: targetId,
        amount: amt,
        paymentType: payType,
        date: payDate || defaultToday,
        note: payNote.trim(),
      });
      setPayModalWorker(null);
      setPayAmount('');
      setPayNote('');
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingWorkerId(undefined);
    setName('');
    setRole('দিনমজুর (Daily Labour)');
    setPhone('');
    setMorningRate('125');
    setAfternoonRate('125');
    setIsWorkerModalOpen(true);
  };

  const handleOpenEditModal = (worker: WorkerProfile) => {
    setEditingWorkerId(worker.id);
    setName(worker.name);
    setRole(worker.role);
    setPhone(worker.phone && worker.phone !== '—' ? worker.phone : '');
    setMorningRate(String(worker.morningRate));
    setAfternoonRate(String(worker.afternoonRate));
    setIsWorkerModalOpen(true);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await onSaveWorkerProfile({
        id: editingWorkerId,
        name: name.trim(),
        role,
        phone: phone.trim() || '—',
        morningRate: parseNum(morningRate, 125) || 125,
        afternoonRate: parseNum(afternoonRate, 125) || 125,
      });
      setIsWorkerModalOpen(false);
      setEditingWorkerId(undefined);
      setName('');
      setPhone('');
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredWorkers = workerProfiles.filter((w) => {
    if (roleFilter !== 'ALL' && !w.role.includes(roleFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.role.toLowerCase().includes(q) ||
        (w.phone && w.phone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Totals across all workers
  const totalSeasonEarnedAllWorkers = workerProfiles.reduce(
    (s, w) => s + (w.totalEarnedSeason ?? 0),
    0
  );
  const totalSeasonPaidAllWorkers = workerProfiles.reduce(
    (s, w) => s + (w.totalPaidSeason || 0),
    0
  );
  const totalSeasonDueAllWorkers = Math.max(
    0,
    totalSeasonEarnedAllWorkers - totalSeasonPaidAllWorkers
  );
  const labourOverallBalance = computeWorkerBalanceWithDina(
    totalSeasonEarnedAllWorkers,
    totalSeasonPaidAllWorkers
  );

  // Selected date attendance summary (using instant effective state)
  const selectedDateStats = workerProfiles.reduce(
    (acc, w) => {
      const eff = getEffectiveShiftState(w.id, selectedDate);
      const rates = getWorkerRates(w);
      const mRate = Number(rates.morningRate) || w.morningRate;
      const aRate = Number(rates.afternoonRate) || w.afternoonRate;
      if (eff.morningPresent) acc.morningCount += 1;
      if (eff.afternoonPresent) acc.afternoonCount += 1;
      acc.todayBill +=
        (eff.morningPresent ? mRate : 0) +
        (eff.afternoonPresent ? aRate : 0);
      return acc;
    },
    { morningCount: 0, afternoonCount: 0, todayBill: 0 }
  );

  const filteredAttendanceHistory = workerAttendance.filter((a) => {
    if (historyFilter === 'HAJIRA') {
      return a.recordType === 'HAJIRA' || (!a.recordType && (a.morningPresent || a.afternoonPresent));
    }
    if (historyFilter === 'PAYMENT') {
      return a.recordType === 'PAYMENT' || a.totalPaid > 0;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Modern Dark Navy Command Header & 4 Live Summary Cards (Main Dashboard Standard) */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1222] to-slate-900 border-2 border-amber-500/40 shadow-2xl p-4 sm:p-6 text-white space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/90 pb-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {isEn
                    ? 'Green Shift Hajira & Separate Payment Studio'
                    : 'সবুজ সকাল-বিকাল হাজিরা ও আলাদা লেবার পেমেন্ট খাতা'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                  হাজিরা আলাদা · টাকা জমা আলাদা
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-0.5">
                {isEn
                  ? 'Labour Attendance (Click Morning/Afternoon to Turn Green) & Separate Money Deposit'
                  : 'সর্দার ও লেবার খাতা — সকাল ও বিকাল সিলেক্ট করলে সবুজ (Green) হবে + টাকা জমা দেওয়ার আলাদা অপশন'}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const firstWithDue =
                  workerProfiles.find(
                    (w) =>
                      (w.totalEarnedSeason ?? (w.totalPaidSeason || 0) + 2500) >
                      (w.totalPaidSeason || 0)
                  ) || workerProfiles[0];
                if (firstWithDue) {
                  handleOpenPayModal(firstWithDue);
                }
              }}
              className="sbl-btn-interactive inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/25 whitespace-nowrap"
            >
              <Banknote className="w-4 h-4 text-slate-950" />
              {isEn ? '+ Deposit Labour Money' : '+ লেবার টাকা জমা দিন (আলাদা পেমেন্ট)'}
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="sbl-btn-interactive inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-500/25 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 text-slate-950" />
              {isEn ? '+ New Worker' : '+ নতুন শ্রমিক যোগ'}
            </button>
          </div>
        </div>

        {/* 4 Summary Cards: Workers, Total Earned Hajira Bill, Total Paid, Remaining Due */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">
              {isEn ? 'Today Present Shifts' : `হাজিরা (${selectedDate}): সকাল ও বিকাল`}
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
              সকাল {formatBn(selectedDateStats.morningCount)} জন · বিকাল{' '}
              {formatBn(selectedDateStats.afternoonCount)} জন
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block tabular-nums">
              আজকের হাজিরা বিল: {formatCurrencyBn(selectedDateStats.todayBill)}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">
              {isEn ? 'Total Season Hajira Bill (Earned)' : 'মোট হাজিরা বিল (শ্রমিকরা পাবে)'}
            </span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
              {formatCurrencyBn(totalSeasonEarnedAllWorkers)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              মোট {formatBn(workerProfiles.length)} জন শ্রমিকের কাজের বিল
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block">
              {isEn ? 'Total Money Deposited (Paid)' : 'মোট দেওয়া টাকা (লেবার জমা দিছে)'}
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
              {formatCurrencyBn(totalSeasonPaidAllWorkers)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              নগদ মজুরি, খোরাকি, হাটবার ও দাদনসহ
            </span>
          </div>

          <div className={`${labourOverallBalance.isDina ? 'bg-slate-900/90 border border-amber-500/40' : 'bg-slate-900/90 border border-rose-500/30'} rounded-xl p-4`}>
            <span className={`text-xs block ${labourOverallBalance.isDina ? 'text-amber-300' : 'text-rose-300'}`}>
              {labourOverallBalance.isDina
                ? 'লেবার দিনায় আছে (অতিরিক্ত পরিশোধ)'
                : isEn
                ? 'Remaining Labour Due'
                : 'লেবার আর পাবে কত (মোট বাকি পাওনা)'}
            </span>
            <div className={`text-2xl font-bold font-mono mt-1 tabular-nums ${labourOverallBalance.isDina ? 'text-amber-400' : 'text-rose-400'}`}>
              {labourOverallBalance.isDina ? formatCurrencyBn(labourOverallBalance.dinaAmount) : formatCurrencyBn(totalSeasonDueAllWorkers)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {labourOverallBalance.isDina ? 'পরবর্তী কাজের হাজিরা বিল থেকে কর্তন হবে' : 'হাজিরা বিল থেকে দেওয়া টাকা বাদে বাকি'}
            </span>
          </div>
        </div>

        {/* 2 Big Sub-Section Switcher Buttons: 1. Green Morning/Afternoon Hajira vs 2. Separate Money Payment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setActiveSubView('HAJIRA');
              setHistoryFilter('ALL');
            }}
            className={`sbl-btn-interactive flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubView === 'HAJIRA'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  activeSubView === 'HAJIRA'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black">
                  ১. দৈনিক সকাল-বিকাল হাজিরা শিট (সিলেক্ট করলে সবুজ হবে)
                </div>
                <div
                  className={`text-xs ${
                    activeSubView === 'HAJIRA' ? 'text-emerald-100 font-semibold' : 'text-slate-400'
                  }`}
                >
                  সকাল ও বিকাল বাটনে ক্লিক করলেই সবুজ (Green) হয়ে হাজিরা সেভ হবে
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-black/30 shrink-0">
              হাজিরা খাতা
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubView('PAYMENT');
              setHistoryFilter('PAYMENT');
            }}
            className={`sbl-btn-interactive flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubView === 'PAYMENT'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-400 shadow-lg shadow-orange-600/30 ring-2 ring-orange-400/40'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  activeSubView === 'PAYMENT'
                    ? 'bg-white/20 text-white'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black">
                  ২. লেবার টাকা জমা দেওয়ার আলাদা অপশন (পেমেন্ট খাতা)
                </div>
                <div
                  className={`text-xs ${
                    activeSubView === 'PAYMENT' ? 'text-orange-100 font-semibold' : 'text-slate-400'
                  }`}
                >
                  নগদ মজুরি, খোরাকি, সাপ্তাহিক হাটবার ও দাদন টাকা জমা দেওয়ার আলাদা ফর্ম
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-black/30 shrink-0">
              টাকা জমা
            </span>
          </button>
        </div>
      </section>

      {/* SUB-VIEW 2: Dedicated Separate Labour Money Deposit Form (যখন ট্যাব ২ সিলেক্ট করা বা সরাসরি পেমেন্ট করতে চায়) */}
      {activeSubView === 'PAYMENT' && (
        <Card variant="default" topAccent="emerald" padding="none" className="overflow-hidden animate-slide-up">
          <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  লেবার টাকা জমা দেওয়ার আলাদা বক্স (Separate Labour Payment Studio)
                </h3>
                <p className="text-xs text-emerald-200">
                  হাজিরা ছাড়াই যেকোনো শ্রমিক বা সর্দারকে নগদ মজুরি, খোরাকি, হাটবার বা দাদন টাকা জমা দিন
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubView('HAJIRA')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              ← সকাল-বিকাল হাজিরা শিটে ফিরুন
            </button>
          </div>

          <form noValidate onSubmit={handleSubmitPayment} className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  শ্রমিক / সর্দার নির্বাচন করুন *
                </label>
                <select
                  value={payWorkerId}
                  onChange={(e) => setPayWorkerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                >
                  {workerProfiles.map((w) => {
                    const earned = w.totalEarnedSeason ?? 0;
                    const paid = w.totalPaidSeason || 0;
                    const wBal = computeWorkerBalanceWithDina(earned, paid);
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.role}) — {wBal.isDina ? `দিনায় আছে: ${formatCurrencyBn(wBal.dinaAmount)}` : `আর পাবে: ${formatCurrencyBn(wBal.balanceDue)}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  পেমেন্টের ধরন (খাত)
                </label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                >
                  {PAYMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1.5">
                  জমা দেওয়ার টাকা (৳) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="যেমন: 1000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(normalizeNumericInput(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-base font-bold font-mono bg-emerald-50/60 border-2 border-emerald-400 rounded-xl text-emerald-950 focus:bg-white focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Selected Worker Live Balance Preview + Quick Amount Chips */}
            {(() => {
              const selectedW = workerProfiles.find((w) => w.id === payWorkerId);
              if (!selectedW) return null;
              const earned = selectedW.totalEarnedSeason ?? 0;
              const paid = selectedW.totalPaidSeason || 0;
              const entering = Math.max(0, parseNum(payAmount));
              const curBalance = computeWorkerBalanceWithDina(earned, paid);
              const afterBalance = computeWorkerBalanceWithDina(earned, paid + entering);
              const due = curBalance.balanceDue;

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs flex-1">
                      <div>
                        <span className="text-slate-500 block">নির্বাচিত শ্রমিক</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {selectedW.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">মোট কাজের বিল (পাবে)</span>
                        <span className="font-bold font-mono text-slate-900 text-sm tabular-nums">
                          {formatCurrencyBn(earned)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ইতিমধ্যে দেওয়া হয়েছে</span>
                        <span className="font-bold font-mono text-emerald-700 text-sm tabular-nums">
                          {formatCurrencyBn(paid)}
                        </span>
                      </div>
                      <div>
                        <span className={`block font-semibold ${afterBalance.isDina ? 'text-amber-800' : 'text-slate-500'}`}>
                          {afterBalance.isDina ? 'জমা দেওয়ার পর দিনায় যাবে' : 'জমা দেওয়ার পর বাকি থাকবে'}
                        </span>
                        <span className={`font-bold font-mono text-sm tabular-nums ${afterBalance.isDina ? 'text-amber-700' : 'text-rose-700'}`}>
                          {afterBalance.isDina ? `দিনা ${formatCurrencyBn(afterBalance.dinaAmount)}` : formatCurrencyBn(afterBalance.balanceDue)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-slate-500 mr-1">
                        দ্রুত অংক:
                      </span>
                      {due > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(due))}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 hover:bg-rose-200 cursor-pointer"
                        >
                          পূর্ণ বাকি ({formatCurrencyBn(due)})
                        </button>
                      )}
                    {[250, 500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPayAmount(String(amt))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer tabular-nums"
                      >
                        ৳{formatBn(amt)}
                      </button>
                    ))}
                    </div>
                  </div>
                  {afterBalance.isDina && (
                    <div className="w-full text-[11px] font-semibold text-amber-900 bg-amber-100/80 border border-amber-300 p-2.5 rounded-lg">
                      💡 কাজের চেয়ে বেশি পরিশোধ করায় এই শ্রমিক <strong>দিনা ৳{formatBn(afterBalance.dinaAmount)}</strong> তে চলে যাবেন। পরবর্তীতে তিনি আবার কাজে হাজিরা দিলে এই দিনা স্বয়ংক্রিয়ভাবে তার পরবর্তী বিল থেকে কর্তন হবে।
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                placeholder="মন্তব্য বা বিবরণ লিখুন (যেমন: বৃহস্পতিবারের হাটবার বা সাপ্তাহিক খোরাকি)..."
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={submittingPay}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer transition-all disabled:opacity-50 shrink-0"
              >
                <Banknote className="w-4 h-4" />
                {submittingPay
                  ? 'টাকা জমা হচ্ছে...'
                  : 'লেবার খাতায় টাকা জমা দিন ও ক্যাশ বুকে তুলুন'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* SUB-VIEW 1: Search, Date Picker & Role Filter Bar + Daily Morning/Afternoon Green Toggle Sheet (শুধুমাত্র যখন ট্যাব ১ 'HAJIRA' সিলেক্ট করা থাকবে) */}
      {activeSubView === 'HAJIRA' && (
        <Card variant="default" padding="none" className="overflow-hidden animate-slide-up">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {isEn
                      ? 'Daily Morning & Afternoon Green Hajira Sheet'
                      : 'দৈনিক সকাল ও বিকাল সবুজ হাজিরা শিট (সিলেক্ট করলে সবুজ হবে)'}
                  </span>
                </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                সকাল বা বিকাল বাটনে ক্লিক করলে সাথে সাথে সবুজ (Green) হবে এবং হাজিরা বিল যুক্ত হবে — আর ডানপাশের বাটনে আলাদাভাবে টাকা জমা দিতে পারবেন
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Hajira Date Picker */}
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-slate-600">হাজিরার তারিখ:</span>
              <input
                type="date"
                aria-label="হাজিরার তারিখ"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-0.5 focus:border-emerald-600 focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="শ্রমিক বা সর্দারের নাম খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <select
              aria-label="কাজের ধরন ফিল্টার"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
            >
              <option value="ALL">সকল কাজের ধরন ({formatBn(workerProfiles.length)})</option>
              <option value="সর্দার">সর্দার (Sardar)</option>
              <option value="দিনমজুর">দিনমজুর (Daily Labour)</option>
              <option value="লোড">ভাটা লোড ও আনলোড</option>
              <option value="মিস্ত্রি">আগুন মিস্ত্রি</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">শ্রমিক / সর্দার ও পদবী</th>
                <th className="py-3.5 px-4 font-bold text-center">
                  সকাল ও বিকাল হাজিরা (সিলেক্ট করলে সবুজ হবে)
                </th>
                <th className="py-3.5 px-4 font-bold text-center">শিফট রেট (সকাল / বিকাল)</th>
                <th className="py-3.5 px-4 font-bold text-right">আজকের হাজিরা বিল</th>
                <th className="py-3.5 px-4 font-bold text-right">মোট পাবে / জমা / বাকি</th>
                <th className="py-3.5 px-4 font-bold text-right">আলাদা টাকা জমা অপশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredWorkers.map((w) => {
                const hajiraRec = getWorkerHajiraForDate(w.id, selectedDate);
                const serverMorning = hajiraRec ? Boolean(hajiraRec.morningPresent) : false;
                const serverAfternoon = hajiraRec ? Boolean(hajiraRec.afternoonPresent) : false;

                const eff = getEffectiveShiftState(w.id, selectedDate);
                const morningPresent = eff.morningPresent;
                const afternoonPresent = eff.afternoonPresent;

                const rates = getWorkerRates(w);
                const mRate = Number(rates.morningRate) || w.morningRate;
                const aRate = Number(rates.afternoonRate) || w.afternoonRate;

                const serverTodayEarned =
                  (serverMorning ? hajiraRec?.morningAmount || mRate : 0) +
                  (serverAfternoon ? hajiraRec?.afternoonAmount || aRate : 0);
                const todayEarned =
                  (morningPresent ? mRate : 0) + (afternoonPresent ? aRate : 0);

                const baseTotalEarned = w.totalEarnedSeason ?? 0;
                const totalEarned = Math.max(
                  0,
                  baseTotalEarned + (todayEarned - serverTodayEarned)
                );
                const totalPaid = w.totalPaidSeason || 0;
                const workerBalance = computeWorkerBalanceWithDina(totalEarned, totalPaid);
                const remainingDue = workerBalance.balanceDue;

                const isAnimMorning = animatingBtnKey === `${w.id}-MORNING`;
                const isAnimAfternoon = animatingBtnKey === `${w.id}-AFTERNOON`;

                return (
                  <tr
                    key={w.id}
                    className={`transition-colors duration-150 ${
                      morningPresent || afternoonPresent
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Worker Info + Edit Profile Button */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{w.name}</span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(w)}
                              title="শ্রমিকের তথ্য ও রেট সংশোধন করুন"
                              className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {w.role}
                          </span>
                          {w.phone && w.phone !== '—' && (
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 tabular-nums">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {w.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Morning & Afternoon Direct Instant Green Toggle Buttons with Pop Animation */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2.5">
                        {/* Morning Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleShift(w, 'MORNING')}
                          className={`min-w-[126px] flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border cursor-pointer select-none transform-gpu transition-all duration-150 ease-out active:scale-90 ${
                            isAnimMorning ? 'scale-105' : 'scale-100'
                          } ${
                            morningPresent
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/40'
                              : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-150 ${
                              morningPresent
                                ? 'bg-white/25 text-white scale-110'
                                : 'bg-amber-100 text-amber-600 scale-100'
                            }`}
                          >
                            {morningPresent ? (
                              <Check className="w-3.5 h-3.5 stroke-[3] text-white shrink-0" />
                            ) : (
                              <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </span>
                          <div className="text-left">
                            <div className="leading-tight font-bold">সকাল</div>
                            <div
                              className={`text-[10px] font-mono tabular-nums ${
                                morningPresent ? 'text-emerald-50 font-semibold' : 'text-slate-500'
                              }`}
                            >
                              ৳{formatBn(mRate)}
                            </div>
                          </div>
                        </button>

                        {/* Afternoon Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleShift(w, 'AFTERNOON')}
                          className={`min-w-[126px] flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border cursor-pointer select-none transform-gpu transition-all duration-150 ease-out active:scale-90 ${
                            isAnimAfternoon ? 'scale-105' : 'scale-100'
                          } ${
                            afternoonPresent
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/40'
                              : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-150 ${
                              afternoonPresent
                                ? 'bg-white/25 text-white scale-110'
                                : 'bg-orange-100 text-orange-600 scale-100'
                            }`}
                          >
                            {afternoonPresent ? (
                              <Check className="w-3.5 h-3.5 stroke-[3] text-white shrink-0" />
                            ) : (
                              <Sunset className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            )}
                          </span>
                          <div className="text-left">
                            <div className="leading-tight font-bold">বিকাল</div>
                            <div
                              className={`text-[10px] font-mono tabular-nums ${
                                afternoonPresent ? 'text-emerald-50 font-semibold' : 'text-slate-500'
                              }`}
                            >
                              ৳{formatBn(aRate)}
                            </div>
                          </div>
                        </button>
                      </div>
                    </td>

                    {/* Editable Shift Rates */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-20">
                          <span className="text-[10px] font-semibold text-slate-500 block mb-0.5 text-center">
                            সকাল ৳
                          </span>
                          <input
                            type="number"
                            min={0}
                            aria-label={`${w.name} সকাল রেট`}
                            value={rates.morningRate}
                            onChange={(e) =>
                              setRateDrafts((prev) => ({
                                ...prev,
                                [w.id]: {
                                  ...rates,
                                  morningRate: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg tabular-nums font-semibold text-center"
                          />
                        </div>
                        <div className="w-20">
                          <span className="text-[10px] font-semibold text-slate-500 block mb-0.5 text-center">
                            বিকাল ৳
                          </span>
                          <input
                            type="number"
                            min={0}
                            aria-label={`${w.name} বিকাল রেট`}
                            value={rates.afternoonRate}
                            onChange={(e) =>
                              setRateDrafts((prev) => ({
                                ...prev,
                                [w.id]: {
                                  ...rates,
                                  afternoonRate: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg tabular-nums font-semibold text-center"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Today's Earned Shift Bill */}
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg font-bold font-mono text-sm ${
                          todayEarned > 0
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {formatCurrencyBn(todayEarned)}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {morningPresent && afternoonPresent
                          ? '২ শিফট সবুজ'
                          : morningPresent
                          ? 'সকাল সবুজ'
                          : afternoonPresent
                          ? 'বিকাল সবুজ'
                          : 'সিলেক্ট করা হয়নি'}
                      </div>
                    </td>

                    {/* Season Total Earned / Paid / Remaining Due */}
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <div className="text-xs text-slate-600">
                        মোট বিল:{' '}
                        <strong className="font-mono text-slate-900">
                          {formatCurrencyBn(totalEarned)}
                        </strong>
                      </div>
                      <div className="text-xs text-emerald-700">
                        জমা দিছে:{' '}
                        <strong className="font-mono">
                          {formatCurrencyBn(totalPaid)}
                        </strong>
                      </div>
                      {workerBalance.isDina ? (
                        <div className="text-xs font-bold text-amber-700 mt-0.5">
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-mono">
                            দিনায় আছে: {formatCurrencyBn(workerBalance.dinaAmount)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-rose-700 mt-0.5">
                          আর পাবে: {formatCurrencyBn(remainingDue)}
                        </div>
                      )}
                    </td>

                    {/* Separate Money Deposit Action Buttons: Mid-week Khoraki & Friday Final Pay */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenPayModal(w, 'KHORAKI')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                          + খোরাকি দিন
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPayModal(w, 'FRIDAY_FINAL')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          শুক্রবারের বিল পেমেন্ট
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Attendance & Separate Labour Payment Ledger History */}
      <Card variant="default" padding="none" className="overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-orange-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                লেবার সকাল-বিকাল হাজিরা ও আলাদা টাকা জমার খতিয়ান ({formatBn(filteredAttendanceHistory.length)}টি রেকর্ড)
              </h3>
              <p className="text-xs text-slate-500">
                সবুজ হাজিরা রেকর্ড এবং নগদ মজুরি / খোরাকি / হাটবার টাকা জমার আলাদা হিসাব
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setHistoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                historyFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              সব রেকর্ড ({formatBn(workerAttendance.length)})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('HAJIRA')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                historyFilter === 'HAJIRA'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              ✅ শুধু হাজিরা
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('PAYMENT')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                historyFilter === 'PAYMENT'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              💵 শুধু টাকা জমা
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
                <th className="py-2.5 px-4 font-bold">তারিখ</th>
                <th className="py-2.5 px-4 font-bold">শ্রমিক ও পদবী</th>
                <th className="py-2.5 px-4 font-bold">হিসাবের ধরন</th>
                <th className="py-2.5 px-4 font-bold">সকাল ও বিকাল হাজিরা (বিল)</th>
                <th className="py-2.5 px-4 font-bold text-right">জমা দেওয়া টাকা (Paid)</th>
                <th className="py-2.5 px-4 font-bold">বিবরণ / নোট</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAttendanceHistory.map((a) => {
                const isPayment = a.recordType === 'PAYMENT' || (a.totalPaid > 0 && !a.morningPresent && !a.afternoonPresent);
                const shiftEarned = (a.morningAmount || 0) + (a.afternoonAmount || 0);

                return (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-xs text-slate-600 tabular-nums font-mono">
                      {a.date}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{a.workerName}</div>
                      <div className="text-xs text-slate-500">{a.workerRole}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      {isPayment ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
                          💵 {a.paymentType || 'লেবার টাকা জমা'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✅ দৈনিক সবুজ হাজিরা
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs tabular-nums">
                      {a.morningPresent || a.afternoonPresent ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {a.morningPresent && (
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                              সকাল ৳{formatBn(a.morningAmount)}
                            </span>
                          )}
                          {a.afternoonPresent && (
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                              বিকাল ৳{formatBn(a.afternoonAmount)}
                            </span>
                          )}
                          <span className="text-slate-600 font-semibold ml-1">
                            (বিল: {formatCurrencyBn(shiftEarned)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold font-mono tabular-nums">
                      {a.totalPaid > 0 ? (
                        <span className="text-emerald-700">
                          {formatCurrencyBn(a.totalPaid)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-normal">
                          হাজিরা এন্ট্রি (৳০)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {a.note || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SEPARATE POPUP MODAL FOR WORKER MONEY DEPOSIT (+ টাকা জমা দিন) */}
      {payModalWorker && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setPayModalWorker(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-modal-pop my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    লেবার টাকা জমা দেওয়ার আলাদা পপআপ
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {payModalWorker.name} — টাকা জমা দিন
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayModalWorker(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {(() => {
                const earned = payModalWorker.totalEarnedSeason ?? 0;
                const paid = payModalWorker.totalPaidSeason || 0;
                const entering = Math.max(0, parseNum(payAmount));
                const curBalance = computeWorkerBalanceWithDina(earned, paid);
                const afterBalance = computeWorkerBalanceWithDina(earned, paid + entering);

                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                      <div>
                        <span className="text-[11px] text-slate-500 block">
                          মোট হাজিরা বিল
                        </span>
                        <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                          {formatCurrencyBn(earned)}
                        </span>
                      </div>
                      <div className="border-x border-slate-200">
                        <span className="text-[11px] text-slate-500 block">
                          জমা দেওয়া হয়েছে
                        </span>
                        <span className="text-sm font-bold font-mono text-emerald-700 tabular-nums">
                          {formatCurrencyBn(paid)}
                        </span>
                      </div>
                      <div>
                        <span className={`text-[11px] block font-semibold ${afterBalance.isDina ? 'text-amber-800' : 'text-slate-500'}`}>
                          {afterBalance.isDina ? 'জমার পর দিনায় যাবে' : 'জমার পর বাকি থাকবে'}
                        </span>
                        <span className={`text-sm font-bold font-mono tabular-nums ${afterBalance.isDina ? 'text-amber-700' : 'text-rose-700'}`}>
                          {afterBalance.isDina ? `দিনা ${formatCurrencyBn(afterBalance.dinaAmount)}` : formatCurrencyBn(afterBalance.balanceDue)}
                        </span>
                      </div>
                    </div>
                    {afterBalance.isDina && (
                      <div className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                        💡 কাজের চেয়ে অতিরিক্ত পরিশোধ করায় এই শ্রমিক <strong>দিনা ৳{formatBn(afterBalance.dinaAmount)}</strong> তে চলে যাচ্ছেন। পরবর্তীতে তিনি আবার হাজিরা দিলে এই দিনা স্বয়ংক্রিয়ভাবে তার পরবর্তী বিল থেকে কর্তন হবে।
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পেমেন্টের খাত *
                  </label>
                  <select
                    value={payType}
                    onChange={(e) => setPayType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    {PAYMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  জমা দেওয়ার টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(normalizeNumericInput(e.target.value))}
                  placeholder="যেমন: 1000"
                  className="w-full px-4 py-3 text-lg font-bold font-mono bg-emerald-50/70 border-2 border-emerald-500 rounded-xl text-emerald-950 focus:bg-white focus:outline-hidden tabular-nums"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[250, 500, 1000, 1500, 2500, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPayAmount(String(preset))}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 cursor-pointer tabular-nums"
                    >
                      ৳{formatBn(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিবরণ বা নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="যেমন: নগদ মজুরি প্রদান বা হাটবার খরচ..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayModalWorker(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submittingPay ? 'সেভ হচ্ছে...' : 'টাকা জমা নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL FOR ADD / EDIT WORKER PROFILE */}
      {isWorkerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setIsWorkerModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-modal-pop my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 block">
                    লেবার প্রোফাইল স্টুডিও
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {editingWorkerId
                      ? 'শ্রমিক / সর্দার প্রোফাইল আপডেট করুন'
                      : 'নতুন শ্রমিক বা সর্দার যোগ করুন'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkerModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শ্রমিক বা সর্দারের নাম *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: আব্দুল করিম"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কাজের ধরন / পদবী
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden font-medium"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    placeholder="০১৭..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 focus:outline-hidden tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-orange-50/60 border border-orange-200/80 rounded-2xl p-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    সকাল শিফট রেট (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={morningRate}
                    onChange={(e) => setMorningRate(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl tabular-nums font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    বিকাল শিফট রেট (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={afternoonRate}
                    onChange={(e) => setAfternoonRate(normalizeNumericInput(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl tabular-nums font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsWorkerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingProfile
                    ? 'সেভ হচ্ছে...'
                    : editingWorkerId
                    ? 'আপডেট সেভ করুন'
                    : 'লেবার তালিকায় যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
