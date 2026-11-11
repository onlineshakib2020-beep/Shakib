import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Plus,
  Phone,
  MapPin,
  Calendar,
  Truck,
  CreditCard,
  Trash2,
  CheckCircle2,
  Search,
  ArrowRight,
  Receipt,
  AlertCircle,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import {
  type LandLeaseContractRecord,
  computeLandLeaseSummary,
} from '../utils/enterpriseOperationsLogic';
import { formatBn, formatCurrencyBn, parseNum } from '../utils/kilnLogic';
import type { NavigationTab, PaymentMethod } from '../types/kiln';

interface LandLeaseLedgerTabProps {
  todayDate: string;
  landLeases: LandLeaseContractRecord[];
  onSaveLandLease: (lease: LandLeaseContractRecord) => Promise<void> | void;
  onAddLandTruckTrip: (lease: LandLeaseContractRecord, addedTrucks: number) => Promise<void> | void;
  onDeleteLandLease: (id: string) => Promise<void> | void;
  onAddLandPayment?: (
    leaseId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note: string
  ) => Promise<void> | void;
  onNavigateTab?: (tab: NavigationTab) => void;
}

export const LandLeaseLedgerTab: React.FC<LandLeaseLedgerTabProps> = ({
  todayDate,
  landLeases = [],
  onSaveLandLease,
  onAddLandTruckTrip,
  onDeleteLandLease,
  onAddLandPayment,
  onNavigateTab,
}) => {
  // New Lease Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [lOwner, setLOwner] = useState('');
  const [lPhone, setLPhone] = useState('');
  const [lMouza, setLMouza] = useState('');
  const [lBigha, setLBigha] = useState('');
  const [lTrucks, setLTrucks] = useState('');
  const [lTotalAmt, setLTotalAmt] = useState('');
  const [lPaidAmt, setLPaidAmt] = useState('');
  const [lContractDate, setLContractDate] = useState(todayDate);
  const [lNote, setLNote] = useState('');

  // Payment Modal State
  const [activePaymentLease, setActivePaymentLease] = useState<LandLeaseContractRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayDate);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [payNote, setPayNote] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState<'ALL' | 'DUE' | 'PAID'>('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const summary = useMemo(() => computeLandLeaseSummary(landLeases), [landLeases]);

  // Landowners due summary list sorted by due amount descending
  const landownersDueList = useMemo(() => {
    return landLeases
      .map((l) => {
        const total = Number(l.totalContractAmount) || 0;
        const paid = Number(l.paidAmount) || 0;
        const due = Math.max(0, total - paid);
        const overpaid = paid > total ? paid - total : 0;
        return {
          lease: l,
          total,
          paid,
          due,
          overpaid,
          isFullyPaid: due === 0 && total > 0,
        };
      })
      .sort((a, b) => b.due - a.due);
  }, [landLeases]);

  // Filtered List for cards
  const filteredLeases = useMemo(() => {
    return landLeases.filter((l) => {
      const total = Number(l.totalContractAmount) || 0;
      const paid = Number(l.paidAmount) || 0;
      const due = Math.max(0, total - paid);

      if (filterDueOnly === 'DUE' && due <= 0) return false;
      if (filterDueOnly === 'PAID' && due > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          l.landownerName.toLowerCase().includes(q) ||
          (l.phone || '').toLowerCase().includes(q) ||
          (l.mouzaOrLocation || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [landLeases, filterDueOnly, searchQuery]);

  const handleCreateLeaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lOwner.trim()) {
      showNotification('জমির মালিকের নাম অবশ্যই দিতে হবে।', true);
      return;
    }
    const tot = parseNum(lTotalAmt);
    if (tot <= 0) {
      showNotification('মোট চুক্তির টাকার পরিমাণ দিন।', true);
      return;
    }
    const pd = parseNum(lPaidAmt);
    const trk = parseNum(lTrucks, 100) || 100;
    const bigha = parseNum(lBigha, 1) || 1;

    setSubmitting(true);
    try {
      const newLease: LandLeaseContractRecord = {
        id: `lease_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        landownerName: lOwner.trim(),
        phone: lPhone.trim(),
        mouzaOrLocation: lMouza.trim() || 'বিল এলাকা',
        landAreaBigha: bigha,
        contractedTrucks: trk,
        deliveredTrucks: 0,
        totalContractAmount: tot,
        paidAmount: pd,
        startDate: lContractDate || todayDate,
        endDate: todayDate,
        note: lNote.trim(),
      };

      await onSaveLandLease(newLease);

      setLOwner('');
      setLPhone('');
      setLMouza('');
      setLBigha('');
      setLTrucks('');
      setLTotalAmt('');
      setLPaidAmt('');
      setLNote('');
      setShowAddForm(false);
      showNotification(`"${newLease.landownerName}" এর জমির লিজ চুক্তি সফলভাবে সংরক্ষিত হয়েছে!`);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে।', true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMakePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentLease) return;
    const amt = parseNum(payAmount);
    if (amt <= 0) {
      showNotification('পরিশোধকৃত টাকার পরিমাণ দিন।', true);
      return;
    }

    setSubmitting(true);
    try {
      if (onAddLandPayment) {
        await onAddLandPayment(activePaymentLease.id, amt, payMethod, payNote);
      } else {
        // Fallback update paidAmount directly
        const updated: LandLeaseContractRecord = {
          ...activePaymentLease,
          paidAmount: (activePaymentLease.paidAmount || 0) + amt,
        };
        await onSaveLandLease(updated);
      }

      showNotification(
        `মালিক "${activePaymentLease.landownerName}"-কে ${formatCurrencyBn(amt)} পরিশোধ সংরক্ষিত হয়েছে!`
      );
      setActivePaymentLease(null);
      setPayAmount('');
      setPayNote('');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে।', true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-md border border-emerald-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-xs">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                  জমির লিস খতিয়ান
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-extrabold">
                  মালিকদের জমির হিসাব ও পাওনা বিবরণী
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 font-medium leading-relaxed">
                যাদের কাছ থেকে জমি নেওয়া হয়েছে তাদের জমির পরিমাণ (বিঘা), মোট চুক্তির টাকা, এ পর্যন্ত কত টাকা দিলাম এবং <strong>কে কত টাকা পাবে</strong> তার স্পষ্ট হিসাব।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{showAddForm ? 'ফর্ম বন্ধ করুন' : '+ নতুন জমির লিজ এন্ট্রি'}</span>
          </button>
        </div>

        {/* 4 Top KPI Cards: জমি, চুক্তি, দেওয়া টাকা, পাবে */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-5">
          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] sm:text-xs text-emerald-200 block font-bold">
              মোট লিজকৃত জমি
            </span>
            <strong className="text-xl sm:text-2xl font-black text-amber-300 tabular-nums mt-0.5 block">
              {formatBn(summary.totalAreaBigha)} বিঘা
            </strong>
            <span className="text-[10px] text-emerald-300/80 mt-0.5 block">
              মোট মালিক: {formatBn(landLeases.length)} জন
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] sm:text-xs text-emerald-200 block font-bold">
              মোট চুক্তির টাকা
            </span>
            <strong className="text-xl sm:text-2xl font-black text-white tabular-nums mt-0.5 block">
              {formatCurrencyBn(summary.totalContractAmount)}
            </strong>
            <span className="text-[10px] text-emerald-300/80 mt-0.5 block">
              মাটির গাড়ি: {formatBn(summary.totalContractedTrucks)} টি
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] sm:text-xs text-emerald-200 block font-bold">
              টাকা দিয়েছি (পরিশোধ)
            </span>
            <strong className="text-xl sm:text-2xl font-black text-emerald-300 tabular-nums mt-0.5 block">
              {formatCurrencyBn(summary.totalPaidAmount)}
            </strong>
            <span className="text-[10px] text-emerald-300/80 mt-0.5 block">
              পরিশোধের হার: {formatBn(summary.completionPct)}%
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-rose-400/40 bg-rose-950/30">
            <span className="text-[11px] sm:text-xs text-rose-200 block font-black">
              মালিকরা পাবে (বকেয়া)
            </span>
            <strong className="text-xl sm:text-2xl font-black text-rose-300 tabular-nums mt-0.5 block">
              {formatCurrencyBn(summary.totalDueAmount)}
            </strong>
            <span className="text-[10px] text-rose-200/80 mt-0.5 block">
              অবশিষ্ট পাওনা নিষ্পত্তি বাকি
            </span>
          </div>
        </div>
      </div>

      {/* "কে কত টাকা পাবে" লাইভ সামারি লিস্ট (Landowners Due Breakdown) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              কে কত টাকা পাবে — সংক্ষিপ্ত সারসংক্ষেপ
            </h2>
            <p className="text-xs text-slate-500">
              যাদের কাছে ভাটার বকেয়া পাওনা রয়েছে তাদের ক্রমানুসারে তালিকা
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black">
              বকেয়া বাকি: {formatBn(landownersDueList.filter((d) => d.due > 0).length)} জন
            </span>
            <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black">
              সম্পূর্ণ পরিশোধিত: {formatBn(landownersDueList.filter((d) => d.isFullyPaid).length)} জন
            </span>
          </div>
        </div>

        {/* Quick Horizontal Cards or Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {landownersDueList.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-400 text-xs">
              এখনো কোনো জমির লিজ চুক্তি যুক্ত করা হয়নি। উপরের <strong>"+ নতুন জমির লিজ এন্ট্রি"</strong> বাটনে চাপ দিন।
            </div>
          ) : (
            landownersDueList.map(({ lease, total, paid, due, overpaid, isFullyPaid }) => (
              <div
                key={lease.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  due > 0
                    ? 'bg-white border-slate-200 border-l-4 border-l-rose-500 hover:border-slate-300 shadow-2xs'
                    : overpaid > 0
                    ? 'bg-white border-slate-200 border-l-4 border-l-sky-500 hover:border-slate-300 shadow-2xs'
                    : 'bg-emerald-50/30 border-emerald-200 border-l-4 border-l-emerald-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {lease.landownerName}
                    </h3>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{lease.mouzaOrLocation || 'বিল এলাকা'} · {formatBn(lease.landAreaBigha)} বিঘা</span>
                    </div>
                  </div>

                  {due > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black shrink-0">
                      পাবে
                    </span>
                  ) : overpaid > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-black shrink-0">
                      দিনা
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black shrink-0">
                      পরিশোধিত
                    </span>
                  )}
                </div>

                {/* Mini Visual Progress Bar (Agreed vs Paid) */}
                {(() => {
                  const summaryPaidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                  return (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/70 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          পরিশোধ: {formatCurrencyBn(paid)} ({formatBn(summaryPaidPct)}%)
                        </span>
                        <span className="text-slate-500">চুক্তি: {formatCurrencyBn(total)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex shadow-inner">
                        <div
                          className="bg-emerald-600 h-full rounded-l-full transition-all duration-300"
                          style={{ width: `${Math.min(100, summaryPaidPct)}%` }}
                        />
                        {due > 0 && (
                          <div
                            className="bg-rose-400 h-full rounded-r-full"
                            style={{ width: `${Math.max(0, 100 - summaryPaidPct)}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">কত টাকা পাবে:</span>
                    <strong
                      className={`text-sm font-black tabular-nums ${
                        due > 0
                          ? 'text-rose-600'
                          : overpaid > 0
                          ? 'text-sky-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {due > 0
                        ? formatCurrencyBn(due)
                        : overpaid > 0
                        ? `দিনা: ${formatCurrencyBn(overpaid)}`
                        : '৳০ (পরিশোধিত)'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActivePaymentLease(lease);
                      setPayAmount(due > 0 ? String(due) : '');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-[11px] font-black transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>টাকা দিন</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Land Lease Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateLeaseSubmit}
          className="bg-white rounded-3xl border border-slate-200 border-t-4 border-t-emerald-600 p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in"
        >
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                নতুন জমি লিজ ও মাটি চুক্তি যুক্ত করুন
              </h2>
              <p className="text-xs text-slate-500">
                জমির মালিকের নাম, জমির পরিমাণ (বিঘা), মোট চুক্তি ও নগদ পরিশোধ লিখে সেভ করুন
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              ✕ বন্ধ
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                জমির মালিকের নাম *
              </label>
              <input
                type="text"
                required
                placeholder="যেমন: হাজী মোজাম্মেল হক"
                value={lOwner}
                onChange={(e) => setLOwner(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                মোবাইল নম্বর
              </label>
              <input
                type="text"
                placeholder="01715-XXXXXX"
                value={lPhone}
                onChange={(e) => setLPhone(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                মৌজা / জমির অবস্থান
              </label>
              <input
                type="text"
                placeholder="যেমন: বাবুলিয়া দক্ষিণ বিল, দাগ নং ৪২০"
                value={lMouza}
                onChange={(e) => setLMouza(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                জমির পরিমাণ (বিঘা) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                placeholder="যেমন: ৩.৫"
                value={lBigha}
                onChange={(e) => setLBigha(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                মোট চুক্তির টাকা (৳) *
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="যেমন: ১,৫০,০০০"
                value={lTotalAmt}
                onChange={(e) => setLTotalAmt(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-emerald-800 mb-1">
                আজ দেওয়া টাকা / অগ্রিম (৳)
              </label>
              <input
                type="number"
                min="0"
                placeholder="যেমন: ৫০,০০০"
                value={lPaidAmt}
                onChange={(e) => setLPaidAmt(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-emerald-50/50 text-slate-900 border border-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                চুক্তিকৃত মাটির গাড়ি সংখ্যা
              </label>
              <input
                type="number"
                min="1"
                placeholder="যেমন: ২০০ গাড়ি"
                value={lTrucks}
                onChange={(e) => setLTrucks(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                চুক্তির তারিখ
              </label>
              <input
                type="date"
                value={lContractDate}
                onChange={(e) => setLContractDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                মন্তব্য বা চুক্তির শর্ত
              </label>
              <input
                type="text"
                placeholder="যেমন: ৩ ফুট গভীর মাটি কাটা হবে"
                value={lNote}
                onChange={(e) => setLNote(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
            >
              + জমির লিজ খতিয়ানে সেভ করুন
            </button>
          </div>
        </form>
      )}

      {/* Main Ledger Section with Filter & Search */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              জমির মালিকওয়ারী পূর্ণাঙ্গ লিজ খতিয়ান
            </h2>
            <p className="text-xs text-slate-500">
              প্রত্যেক মালিকের জমির পরিমাণ, কত টাকা দেওয়া হয়েছে, মাটির গাড়ি ও অবশিষ্ট বকেয়া
            </p>
          </div>

          {/* Filter and Search Controls (Mobile Friendly) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="মালিক বা মৌজা খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 sm:py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterDueOnly('ALL')}
                className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${
                  filterDueOnly === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                সকল ({formatBn(landLeases.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterDueOnly('DUE')}
                className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${
                  filterDueOnly === 'DUE'
                    ? 'bg-rose-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বকেয়া পাবে ({formatBn(landownersDueList.filter((d) => d.due > 0).length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterDueOnly('PAID')}
                className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${
                  filterDueOnly === 'PAID'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                পরিশোধিত ({formatBn(landownersDueList.filter((d) => d.isFullyPaid).length)})
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Cards for Each Landowner */}
        <div className="space-y-3">
          {filteredLeases.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              কোনো জমির লিজ রেকর্ড খুঁজে পাওয়া যায়নি।
            </div>
          ) : (
            filteredLeases.map((lease) => {
              const total = Number(lease.totalContractAmount) || 0;
              const paid = Number(lease.paidAmount) || 0;
              const due = Math.max(0, total - paid);
              const overpaid = paid > total ? paid - total : 0;
              const contractedTrucks = Number(lease.contractedTrucks) || 1;
              const deliveredTrucks = Number(lease.deliveredTrucks) || 0;
              const remainingTrucks = Math.max(0, contractedTrucks - deliveredTrucks);
              const pct = Math.min(100, Math.round((deliveredTrucks / contractedTrucks) * 100));
              const paymentPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
              const pendingPct = Math.max(0, 100 - paymentPct);

              return (
                <div
                  key={lease.id}
                  className={`p-3.5 sm:p-5 rounded-2xl border transition-all space-y-3 shadow-xs ${
                    due > 0
                      ? 'bg-white border-slate-200 border-l-4 border-l-rose-500 hover:border-slate-300'
                      : overpaid > 0
                      ? 'bg-white border-slate-200 border-l-4 border-l-sky-500 hover:border-slate-300'
                      : 'bg-emerald-50/20 border-emerald-200 border-l-4 border-l-emerald-500'
                  }`}
                >
                  {/* Card Header: Responsive & Thumb Friendly */}
                  <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-2.5">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                          {lease.landownerName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px] sm:text-xs shrink-0">
                          {formatBn(lease.landAreaBigha)} বিঘা জমি
                        </span>
                        {lease.startDate && (
                          <span className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {lease.startDate}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] sm:text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px] sm:max-w-none">{lease.mouzaOrLocation || 'বিল এলাকা'}</span>
                        </span>
                        {lease.phone && (
                          <a
                            href={`tel:${lease.phone}`}
                            className="flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0"
                            title="সরাসরি কল করুন"
                          >
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{lease.phone}</span>
                          </a>
                        )}
                        {lease.note && (
                          <span className="text-slate-500 italic text-[11px] truncate max-w-[160px] sm:max-w-none">
                            ({lease.note})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prominent Status Badge (Always Visible on Mobile) */}
                    <div className="shrink-0">
                      {due > 0 ? (
                        <div className="px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0"></span>
                          <span className="whitespace-nowrap">বাকি: {formatCurrencyBn(due)}</span>
                        </div>
                      ) : overpaid > 0 ? (
                        <div className="px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 font-black text-[11px] sm:text-xs whitespace-nowrap shadow-2xs">
                          দিনা: {formatCurrencyBn(overpaid)}
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-[11px] sm:text-xs flex items-center gap-1 whitespace-nowrap shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>পরিশোধিত</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 Key Metrics: High Readability 2x2 on Mobile, 4-col on Desktop */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* 1. Total Agreed */}
                    <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 font-bold">
                        <span>মোট চুক্তি</span>
                        <span className="text-[10px] text-slate-400 font-mono">১০০%</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-1 tabular-nums truncate">
                        {formatCurrencyBn(total)}
                      </div>
                    </div>

                    {/* 2. Paid Amount */}
                    <div className="bg-emerald-50/70 p-2 sm:p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-emerald-800 font-bold">
                        <span>টাকা দিয়েছি</span>
                        <span className="text-[10px] text-emerald-700 font-mono font-black">{formatBn(paymentPct)}%</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-emerald-700 mt-1 tabular-nums truncate">
                        {formatCurrencyBn(paid)}
                      </div>
                    </div>

                    {/* 3. Due / Remaining Amount */}
                    <div
                      className={`p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between ${
                        due > 0
                          ? 'bg-rose-50/70 border-rose-200'
                          : 'bg-slate-50/70 border-slate-200/80'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between text-[10px] sm:text-[11px] font-bold ${
                          due > 0 ? 'text-rose-800' : 'text-slate-500'
                        }`}
                      >
                        <span>কত টাকা পাবে</span>
                        <span className="text-[10px] font-mono font-black">
                          {due > 0 ? `${formatBn(pendingPct)}%` : '০%'}
                        </span>
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-black mt-1 tabular-nums truncate ${
                          due > 0 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {formatCurrencyBn(due)}
                      </div>
                    </div>

                    {/* 4. Clay Trucks */}
                    <div className="bg-amber-50/70 p-2 sm:p-2.5 rounded-xl border border-amber-200 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-amber-900 font-bold">
                        <span>মাটির গাড়ি</span>
                        <span className="text-[10px] text-amber-700 font-mono font-black">{formatBn(pct)}%</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-amber-800 mt-1 tabular-nums leading-tight truncate">
                        {formatBn(deliveredTrucks)} <span className="text-[11px] text-amber-700/80 font-bold">/ {formatBn(contractedTrucks)} গাড়ি</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Bar & Small Comparative Bar Chart (Always Visible) */}
                  <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-linear-to-b from-slate-50 to-slate-100/80 border border-slate-200 space-y-2">
                    {/* Progress Header */}
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <div className="flex items-center gap-1 font-black text-slate-800 text-[11px] sm:text-xs">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>পরিশোধ অগ্রগতি (Agreed vs Paid)</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] sm:text-xs font-black text-emerald-800 tabular-nums">
                          {formatBn(paymentPct)}% পরিশোধ
                        </span>
                        {due > 0 && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md border border-rose-200 hidden xs:inline-block">
                            বাকি: {formatCurrencyBn(due)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stacked Multi-Segment Visual Progress Bar */}
                    <div className="w-full bg-slate-200/90 rounded-full h-3.5 sm:h-4 p-0.5 overflow-hidden flex relative shadow-inner">
                      {/* Paid Segment */}
                      <div
                        className="bg-linear-to-r from-emerald-600 to-emerald-500 h-full rounded-l-full transition-all duration-500 flex items-center justify-end pr-1 text-white"
                        style={{ width: `${Math.min(100, Math.max(paymentPct > 0 ? 8 : 0, paymentPct))}%` }}
                        title={`পরিশোধিত: ${formatCurrencyBn(paid)} (${formatBn(paymentPct)}%)`}
                      >
                        {paymentPct >= 16 && (
                          <span className="text-[9px] font-black leading-none drop-shadow-xs whitespace-nowrap">
                            {formatBn(paymentPct)}%
                          </span>
                        )}
                      </div>

                      {/* Pending Installments Segment */}
                      {due > 0 && (
                        <div
                          className="bg-linear-to-r from-rose-400 to-rose-500 h-full rounded-r-full transition-all duration-500 flex items-center justify-start pl-1 text-white"
                          style={{ width: `${Math.max(0, pendingPct)}%` }}
                          title={`বাকি কিস্তি: ${formatCurrencyBn(due)} (${formatBn(pendingPct)}%)`}
                        >
                          {pendingPct >= 20 && (
                            <span className="text-[9px] font-black leading-none drop-shadow-xs whitespace-nowrap">
                              {formatBn(pendingPct)}% বাকি
                            </span>
                          )}
                        </div>
                      )}

                      {/* Overpaid Segment */}
                      {overpaid > 0 && (
                        <div
                          className="bg-sky-500 h-full rounded-r-full animate-pulse"
                          style={{ width: '8%' }}
                          title={`দিনা / অতিরিক্ত প্রদান: ${formatCurrencyBn(overpaid)}`}
                        />
                      )}
                    </div>

                    {/* 3 Comparative Micro-Bars: Total Agreed vs Paid vs Pending */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5 text-[10px] sm:text-[11px]">
                      {/* 1. Total Agreed */}
                      <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <div className="text-slate-500 font-bold truncate">১. মোট চুক্তি</div>
                        <div className="w-full bg-slate-100 rounded-full h-1 sm:h-1.5 overflow-hidden my-1">
                          <div className="bg-slate-400 h-full w-full rounded-full" />
                        </div>
                        <div className="text-[10px] sm:text-xs font-black text-slate-900 tabular-nums truncate">
                          {formatCurrencyBn(total)}
                        </div>
                      </div>

                      {/* 2. Total Paid */}
                      <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
                        <div className="text-emerald-800 font-bold truncate">২. দিয়েছি ({formatBn(paymentPct)}%)</div>
                        <div className="w-full bg-emerald-100 rounded-full h-1 sm:h-1.5 overflow-hidden my-1">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, paymentPct)}%` }}
                          />
                        </div>
                        <div className="text-[10px] sm:text-xs font-black text-emerald-700 tabular-nums truncate">
                          {formatCurrencyBn(paid)}
                        </div>
                      </div>

                      {/* 3. Pending Installment */}
                      <div
                        className={`p-1.5 sm:p-2 rounded-xl border shadow-2xs flex flex-col justify-between ${
                          due > 0 ? 'bg-white border-rose-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className={`font-bold truncate ${due > 0 ? 'text-rose-800' : 'text-slate-400'}`}>
                          ৩. বাকি ({due > 0 ? `${formatBn(pendingPct)}%` : '০%'})
                        </div>
                        <div className="w-full bg-rose-100/70 rounded-full h-1 sm:h-1.5 overflow-hidden my-1">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${due > 0 ? 'bg-rose-500' : 'bg-transparent'}`}
                            style={{ width: `${due > 0 ? pendingPct : 0}%` }}
                          />
                        </div>
                        <div
                          className={`text-[10px] sm:text-xs font-black tabular-nums truncate ${
                            due > 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        >
                          {due > 0 ? formatCurrencyBn(due) : '৳০'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clay Trucks Progress Bar */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-950">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>মাটি কাটা: {formatBn(deliveredTrucks)} গাড়ি</span>
                      </span>
                      <span className="text-amber-800 font-extrabold text-[10px] sm:text-[11px]">
                        {formatBn(pct)}% সম্পন্ন (বাকি: {formatBn(remainingTrucks)} গাড়ি)
                      </span>
                    </div>
                    <div className="w-full bg-amber-100/80 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Interactive Action Buttons (Touch Friendly & Mobile Optimized) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePaymentLease(lease);
                        setPayAmount(due > 0 ? String(due) : '');
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      <span>টাকা পরিশোধ করুন (+ পেমেন্ট)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAddLandTruckTrip(lease, 1)}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        <span>+১ গাড়ি মাটি</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onAddLandTruckTrip(lease, 5)}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-black text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        <span>+৫ গাড়ি</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteLandLease(lease.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition shrink-0 ml-auto sm:ml-2"
                        title="চুক্তি মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {activePaymentLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  জমি লিজ কিস্তি পরিশোধ
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {activePaymentLease.landownerName}
                </h3>
                <p className="text-xs text-slate-500">
                  {activePaymentLease.mouzaOrLocation} · {formatBn(activePaymentLease.landAreaBigha)} বিঘা
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePaymentLease(null)}
                className="text-slate-400 hover:text-slate-600 font-black p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Financials Preview */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">মোট চুক্তি:</span>
                <strong className="text-xs font-black text-slate-900">
                  {formatCurrencyBn(activePaymentLease.totalContractAmount)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">টাকা দিয়েছি:</span>
                <strong className="text-xs font-black text-emerald-700">
                  {formatCurrencyBn(activePaymentLease.paidAmount)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">বর্তমান পাওনা:</span>
                <strong className="text-xs font-black text-rose-600">
                  {formatCurrencyBn(
                    Math.max(
                      0,
                      (activePaymentLease.totalContractAmount || 0) -
                        (activePaymentLease.paidAmount || 0)
                    )
                  )}
                </strong>
              </div>
            </div>

            <form onSubmit={handleMakePaymentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  আজকে পরিশোধের টাকা (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="যেমন: ২০,০০০"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-black bg-emerald-50/50 text-slate-900 border border-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    পরিশোধের তারিখ
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  >
                    <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                    <option value="ব্যাংক ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
                    <option value="বিকাশ / নগদ">বিকাশ / নগদ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  রসিদ বা ভাউচার নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ২য় কিস্তি পরিশোধ চেক নং..."
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePaymentLease(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
                >
                  পরিশোধ নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
