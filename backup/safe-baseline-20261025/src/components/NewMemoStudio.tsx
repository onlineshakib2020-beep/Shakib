import React, { useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Factory,
  FilePlus2,
  Flame,
  Layers,
  MapPin,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import type { BrickGrade, LanguageMode, PaymentMethod, SalesMemo } from '../types/kiln';
import { cleanBrickGradeName, formatBn, formatCurrencyBn } from '../utils/kilnLogic';

export interface DraftMemoItem {
  gradeId: string;
  quantity: string;
  ratePerThousand: string;
}

interface ComputedMemoItem {
  gradeId: string;
  gradeName: string;
  quantity: number;
  rate: number;
  ratePerThousand: boolean;
  lineTotal: number;
}

interface NewMemoStudioProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  lang?: LanguageMode;
  memoNo: string;
  nextAutoMemoNo: string;
  onChangeMemoNo: (val: string) => void;
  memoDate: string;
  onChangeMemoDate: (val: string) => void;
  memoCustomer: string;
  onChangeMemoCustomer: (val: string) => void;
  memoPhone: string;
  onChangeMemoPhone: (val: string) => void;
  memoAddress: string;
  onChangeMemoAddress: (val: string) => void;
  memoVehicleType: string;
  onChangeMemoVehicleType: (val: string) => void;
  memoTruck: string;
  onChangeMemoTruck: (val: string) => void;
  memoDriver: string;
  onChangeMemoDriver: (val: string) => void;
  memoDriverPhone: string;
  onChangeMemoDriverPhone: (val: string) => void;
  memoDeliveryStatus: 'DELIVERED' | 'LOADING' | 'BOOKING';
  onChangeMemoDeliveryStatus: (val: 'DELIVERED' | 'LOADING' | 'BOOKING') => void;
  memoDuePromiseDate: string;
  onChangeMemoDuePromiseDate: (val: string) => void;
  memoNote: string;
  onChangeMemoNote: (val: string) => void;
  memoItems: DraftMemoItem[];
  computedItems: ComputedMemoItem[];
  onUpdateMemoItem: (idx: number, patch: Partial<DraftMemoItem>, autoSyncPaid?: boolean) => void;
  onAddMemoRow: () => void;
  onRemoveMemoRow: (idx: number) => void;
  memoDiscount: string;
  onChangeMemoDiscount: (val: string) => void;
  memoPaid: string;
  onChangeMemoPaid: (val: string) => void;
  memoMethod: PaymentMethod;
  onChangeMemoMethod: (val: PaymentMethod) => void;
  liveMemoCalc: {
    subTotal: number;
    discount: number;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    status: 'PAID' | 'PARTIAL' | 'DUE';
  };
  brickGrades: BrickGrade[];
  existingMemos: SalesMemo[];
  creatingMemo: boolean;
  onSubmitMemo: (e: React.FormEvent, printAfterSave?: boolean) => void;
  onResetForm: () => void;
  onOpenMemoSection?: (
    section: 'MILLS' | 'CHULLI_LOAD' | 'PORAI_MISTRI' | 'CHULLI_UNLOAD'
  ) => void;
}

const QUICK_QTY_PRESETS = [500, 1000, 1500, 2000, 3000, 5000, 10000];

const QUICK_ADDRESS_PRESETS = [
  'বাবুলিয়া, সাতক্ষীরা',
  'সুলতানপুর, সাতক্ষীরা সদর',
  'পাটকেলঘাটা, সাতক্ষীরা',
  'কলারোয়া বাজার, সাতক্ষীরা',
  'তালা উপজেলা, সাতক্ষীরা',
];

const VEHICLE_TYPE_PRESETS = [
  'ট্রাক (Truck)',
  'ট্রলি / ট্রাক্টর',
  'পিকআপ (Pickup)',
  'ভ্যান / নছিমন',
];

export const NewMemoStudio: React.FC<NewMemoStudioProps> = ({
  isOpen,
  onOpen,
  onClose,
  lang = 'bn',
  memoNo,
  nextAutoMemoNo,
  onChangeMemoNo,
  memoDate,
  onChangeMemoDate,
  memoCustomer,
  onChangeMemoCustomer,
  memoPhone,
  onChangeMemoPhone,
  memoAddress,
  onChangeMemoAddress,
  memoVehicleType,
  onChangeMemoVehicleType,
  memoTruck,
  onChangeMemoTruck,
  memoDriver,
  onChangeMemoDriver,
  memoDriverPhone,
  onChangeMemoDriverPhone,
  memoDuePromiseDate,
  onChangeMemoDuePromiseDate,
  memoNote,
  onChangeMemoNote,
  memoItems,
  computedItems,
  onUpdateMemoItem,
  onAddMemoRow,
  onRemoveMemoRow,
  memoDiscount,
  onChangeMemoDiscount,
  memoPaid,
  onChangeMemoPaid,
  memoMethod,
  onChangeMemoMethod,
  liveMemoCalc,
  brickGrades,
  existingMemos,
  creatingMemo,
  onSubmitMemo,
  onResetForm,
  onOpenMemoSection,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const totalBricksQty = computedItems.reduce((sum, item) => sum + item.quantity, 0);

  const isDuplicateMemoNo = React.useMemo(() => {
    const clean = memoNo.trim().toLowerCase();
    if (!clean) return false;
    return existingMemos.some((m) => m.memoNo.trim().toLowerCase() === clean);
  }, [memoNo, existingMemos]);

  const ensureDefaultQtyOnOpen = () => {
    if (memoItems.length > 0 && (!Number(memoItems[0].quantity) || Number(memoItems[0].quantity) <= 0)) {
      onUpdateMemoItem(0, {
        quantity: '1000',
        ratePerThousand: memoItems[0].ratePerThousand || '11000',
      });
    }
  };

  const handleSelectQuickGrade = (grade: BrickGrade, openPopup = false) => {
    const targetIdx = Math.max(0, memoItems.length - 1);
    const currentQty = Number(memoItems[targetIdx]?.quantity) || 0;
    onUpdateMemoItem(targetIdx, {
      gradeId: grade.id,
      quantity: currentQty > 0 ? String(currentQty) : '1000',
      ratePerThousand: String(grade.ratePerUnit),
    });
    if (openPopup) {
      onOpen();
      setTimeout(() => {
        document.getElementById('memo-customer-input')?.focus();
      }, 80);
    }
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return (
    <>
      {/* Clean & Fresh Dashboard Quick Memo Launchpad with Combined All-Brick Stock Strip */}
      <section
        id="new-memo-studio"
        aria-label="নতুন মেমো পপআপ স্টুডিও"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs transition-all animate-slide-up"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {lang === 'en'
                    ? 'Digital Cash Memo & Gate Pass Studio'
                    : 'নতুন ডিজিটাল ক্যাশ মেমো ও গেটপাস স্টুডিও'}
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded-md">
                  {lang === 'en' ? `Next Memo: ${nextAutoMemoNo}` : `পরবর্তী মেমো: ${nextAutoMemoNo}`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {lang === 'en'
                  ? 'Click any brick below or + Create New Memo to generate cash memo & gate pass.'
                  : 'নিচের যেকোনো ইটে ক্লিক করে অথবা "+ নতুন মেমো তৈরি করুন" বাটনে চাপ দিয়ে সরাসরি মেমো ও গেটপাস তৈরি করুন।'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenMemoSection && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenMemoSection('MILLS')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <Factory className="w-3.5 h-3.5 text-amber-700" />
                  {lang === 'en' ? 'Mill Hisab' : 'মিল হিসাব'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMemoSection('CHULLI_LOAD')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <Truck className="w-3.5 h-3.5 text-sky-700" />
                  {lang === 'en' ? 'Van Hisab' : 'ভ্যান হিসাব'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMemoSection('PORAI_MISTRI')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-700" />
                  {lang === 'en' ? 'Porai Mistri' : 'পোড়াই মিস্ত্রি'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMemoSection('CHULLI_UNLOAD')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-700" />
                  {lang === 'en' ? 'Unload Hisab' : 'আনলোড হিসাব'}
                </button>
              </>
            )}

            <button
              type="button"
              id="open-new-memo-popup-btn"
              onClick={() => {
                ensureDefaultQtyOnOpen();
                onOpen();
                setTimeout(() => {
                  document.getElementById('memo-customer-input')?.focus();
                }, 80);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              {lang === 'en' ? '+ Create New Memo' : '+ নতুন মেমো তৈরি করুন'}
            </button>
          </div>
        </div>

        {/* Clean Brick Grade Quick Select Buttons (No stock count, no rate) */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {brickGrades.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleSelectQuickGrade(g, true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-orange-50/80 border border-slate-200 hover:border-orange-400 text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 group hover:-translate-y-0.5 active:scale-95"
            >
              <span className="text-xs font-bold text-slate-800 group-hover:text-orange-700 truncate">
                {lang === 'en' ? g.nameEn : cleanBrickGradeName(g.nameBn)}
              </span>
              <Layers className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* Clean & Fresh Animated Cash Memo Popup Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="নতুন ডিজিটাল ক্যাশ মেমো ও গেটপাস তৈরি পপআপ"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto animate-modal-backdrop"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden my-auto animate-modal-pop">
            {/* Top Clean Header Bar */}
            <div className="bg-[#0F172A] text-white px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shrink-0">
                  <FilePlus2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {lang === 'en'
                      ? 'New Cash Memo & Gate Pass'
                      : 'নতুন ডিজিটাল ক্যাশ মেমো ও গেট পাস'}
                  </h2>
                  <p className="text-xs text-slate-300">
                    {lang === 'en'
                      ? 'Saudia Traders (SBL Bricks) · Rate per 1,000 bricks'
                      : 'সৌদিয়া ট্রেডার্স (SBL মিষ্টি মাটির ইট) · বাবুলিয়া, সাতক্ষীরা'}
                  </p>
                </div>
              </div>

              {/* Memo Number, Date, Reset & Close */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 min-w-[175px]">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="memo-number-input"
                      className="text-[11px] font-semibold text-orange-400"
                    >
                      {lang === 'en' ? 'Memo No *' : 'মেমো নম্বর *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => onChangeMemoNo(nextAutoMemoNo)}
                      className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      {nextAutoMemoNo}
                    </button>
                  </div>
                  <input
                    id="memo-number-input"
                    type="text"
                    required
                    value={memoNo}
                    onChange={(e) => onChangeMemoNo(e.target.value)}
                    placeholder={nextAutoMemoNo}
                    className="w-full mt-0.5 bg-transparent text-white font-mono font-bold text-sm focus:outline-none tabular-nums"
                  />
                  {isDuplicateMemoNo && (
                    <span className="block text-[10px] text-rose-400 font-semibold">
                      এই মেমো নম্বরটি ইতিমধ্যে ব্যবহৃত!
                    </span>
                  )}
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="memo-date-input"
                      className="block text-[11px] font-semibold text-slate-300"
                    >
                      {lang === 'en' ? 'Date *' : 'তারিখ *'}
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onChangeMemoDate(todayIso)}
                        className={`text-[10px] px-1.5 py-0.2 rounded cursor-pointer ${
                          memoDate === todayIso
                            ? 'bg-orange-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        আজ
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeMemoDate(yesterdayIso)}
                        className={`text-[10px] px-1.5 py-0.2 rounded cursor-pointer ${
                          memoDate === yesterdayIso
                            ? 'bg-orange-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        গতকাল
                      </button>
                    </div>
                  </div>
                  <input
                    id="memo-date-input"
                    type="date"
                    value={memoDate}
                    onChange={(e) => onChangeMemoDate(e.target.value)}
                    className="mt-0.5 bg-transparent text-white font-mono font-semibold text-sm focus:outline-none tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={onResetForm}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                  {lang === 'en' ? 'Reset' : 'রিসেট'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="নতুন মেমো পপআপ বন্ধ করুন"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Clean Form Body */}
            <form
              onSubmit={(e) => onSubmitMemo(e, false)}
              className="p-4 sm:p-6 bg-slate-50/60 max-h-[82vh] overflow-y-auto space-y-5"
            >
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Left 8 Columns: Customer Info + Brick Grade, Quantity & Per-1000 Rate */}
                <div className="xl:col-span-8 space-y-5">
                  {/* STEP 1: Customer Name, Phone Number, Address & Vehicle */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <span className="w-6 h-6 rounded-md bg-orange-600 text-white text-xs font-bold flex items-center justify-center">
                        ১
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {lang === 'en'
                          ? 'Customer Name, Phone, Address & Transport'
                          : 'ক্রেতার নাম, মোবাইল নম্বর, ঠিকানা ও গাড়ির বিবরণ'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                      <div className="md:col-span-5">
                        <label
                          htmlFor="memo-customer-input"
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1"
                        >
                          <User className="w-3.5 h-3.5 text-orange-600" />
                          {lang === 'en' ? 'Customer Name *' : 'ক্রেতার নাম *'}
                        </label>
                        <input
                          id="memo-customer-input"
                          type="text"
                          required
                          placeholder="যেমন: হাজী মোঃ আব্দুর রহিম"
                          value={memoCustomer}
                          onChange={(e) => onChangeMemoCustomer(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label
                          htmlFor="memo-phone-input"
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1"
                        >
                          <Phone className="w-3.5 h-3.5 text-orange-600" />
                          {lang === 'en' ? 'Phone Number' : 'মোবাইল নম্বর'}
                        </label>
                        <input
                          id="memo-phone-input"
                          type="text"
                          placeholder="০১৭১১-০০০০০০"
                          value={memoPhone}
                          onChange={(e) => onChangeMemoPhone(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600 tabular-nums"
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label
                          htmlFor="memo-address-input"
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1"
                        >
                          <MapPin className="w-3.5 h-3.5 text-orange-600" />
                          {lang === 'en' ? 'Delivery Address' : 'ডেলিভারি ঠিকানা'}
                        </label>
                        <input
                          id="memo-address-input"
                          type="text"
                          placeholder="গ্রাম / বাজার / উপজেলা"
                          value={memoAddress}
                          onChange={(e) => onChangeMemoAddress(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-600"
                        />
                      </div>
                    </div>

                    {/* Quick Address Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500">
                        {lang === 'en' ? 'Quick Address:' : 'ঠিকানা:'}
                      </span>
                      {QUICK_ADDRESS_PRESETS.map((addr) => (
                        <button
                          key={addr}
                          type="button"
                          onClick={() => onChangeMemoAddress(addr)}
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                            memoAddress === addr
                              ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {addr}
                        </button>
                      ))}
                    </div>

                    {/* Transport Info */}
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {lang === 'en' ? 'Vehicle Type' : 'গাড়ির ধরন'}
                        </label>
                        <select
                          value={memoVehicleType}
                          onChange={(e) => onChangeMemoVehicleType(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        >
                          {VEHICLE_TYPE_PRESETS.map((vt) => (
                            <option key={vt} value={vt}>
                              {vt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="memo-truck-input"
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          {lang === 'en' ? 'Vehicle / Truck No' : 'গাড়ি / ট্রাক নং'}
                        </label>
                        <input
                          id="memo-truck-input"
                          type="text"
                          value={memoTruck}
                          onChange={(e) => onChangeMemoTruck(e.target.value)}
                          placeholder="সাতক্ষীরা-ট-১১-..."
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="memo-driver-input"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          {lang === 'en' ? 'Driver Name' : 'ড্রাইভারের নাম'}
                        </label>
                        <input
                          id="memo-driver-input"
                          type="text"
                          value={memoDriver}
                          onChange={(e) => onChangeMemoDriver(e.target.value)}
                          placeholder="ড্রাইভারের নাম"
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="memo-driver-phone-input"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          {lang === 'en' ? 'Driver Phone' : 'ড্রাইভারের মোবাইল'}
                        </label>
                        <input
                          id="memo-driver-phone-input"
                          type="text"
                          value={memoDriverPhone}
                          onChange={(e) => onChangeMemoDriverPhone(e.target.value)}
                          placeholder="০১৭..."
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: Clean Brick Selector, Quantity & Per-1000 Rate */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-orange-600 text-white text-xs font-bold flex items-center justify-center">
                          ২
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {lang === 'en'
                              ? 'Brick Type, Quantity & Rate per 1,000 Bricks'
                              : 'কী ইট নিবে, পরিমাণ ও হাজার প্রতি দর (১০০০ ইটের দর)'}
                          </h3>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={onAddMemoRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {lang === 'en' ? '+ Add Another Brick' : '+ আরও ইট যোগ করুন'}
                      </button>
                    </div>

                    {/* Item Rows */}
                    <div className="space-y-3">
                      {/* Quick Brick Type Buttons inside Step 2 (Only Brick Name, No Stock Count, No Rate) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {brickGrades.map((g) => {
                          const isSelectedInActiveRow =
                            memoItems[memoItems.length - 1]?.gradeId === g.id;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => handleSelectQuickGrade(g, false)}
                              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-1 ${
                                isSelectedInActiveRow
                                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                                  : 'bg-slate-50 hover:bg-orange-50 text-slate-800 border-slate-200 hover:border-orange-300'
                              }`}
                            >
                              <span className="truncate">
                                {lang === 'en' ? g.nameEn : cleanBrickGradeName(g.nameBn)}
                              </span>
                              {isSelectedInActiveRow && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {memoItems.map((row, idx) => {
                        const rowCalc = computedItems[idx];
                        const enteredQty = Number(row.quantity) || 0;
                        const enteredRate = Number(row.ratePerThousand) || 0;

                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                              {/* Brick Type Dropdown */}
                              <div className="sm:col-span-4">
                                <label
                                  htmlFor={idx === 0 ? 'memo-grade-select' : `memo-grade-${idx}`}
                                  className="flex items-center gap-1 text-xs font-bold text-slate-800 mb-1"
                                >
                                  <Layers className="w-3.5 h-3.5 text-orange-600" />
                                  {lang === 'en' ? 'Brick Type *' : 'কী ইট নিবে *'}
                                </label>
                                <select
                                  id={idx === 0 ? 'memo-grade-select' : `memo-grade-${idx}`}
                                  value={row.gradeId}
                                  onChange={(e) =>
                                    onUpdateMemoItem(idx, { gradeId: e.target.value })
                                  }
                                  className="w-full px-3 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:border-orange-600"
                                >
                                  {brickGrades.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {lang === 'en' ? g.nameEn : cleanBrickGradeName(g.nameBn)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Quantity Input */}
                              <div className="sm:col-span-3">
                                <label
                                  htmlFor={idx === 0 ? 'memo-qty-input' : `memo-qty-${idx}`}
                                  className="block text-xs font-bold text-slate-800 mb-1"
                                >
                                  {lang === 'en' ? 'Quantity (Pcs) *' : 'পরিমাণ (কত পিস ইট) *'}
                                </label>
                                <input
                                  id={idx === 0 ? 'memo-qty-input' : `memo-qty-${idx}`}
                                  type="number"
                                  min={1}
                                  required
                                  value={row.quantity}
                                  onChange={(e) =>
                                    onUpdateMemoItem(idx, { quantity: e.target.value })
                                  }
                                  className="w-full px-3 py-2.5 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:border-orange-600 tabular-nums"
                                />
                              </div>

                              {/* Per-1,000 Rate Input */}
                              <div className="sm:col-span-2">
                                <label
                                  htmlFor={idx === 0 ? 'memo-rate-input' : `memo-rate-${idx}`}
                                  className="block text-xs font-bold text-slate-800 mb-1"
                                >
                                  {lang === 'en' ? 'Rate / 1000 (৳) *' : 'হাজারে দর (৳) *'}
                                </label>
                                <input
                                  id={idx === 0 ? 'memo-rate-input' : `memo-rate-${idx}`}
                                  type="number"
                                  min={1}
                                  step="any"
                                  required
                                  placeholder="11000"
                                  value={row.ratePerThousand}
                                  onChange={(e) =>
                                    onUpdateMemoItem(idx, {
                                      ratePerThousand: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2.5 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:border-orange-600 tabular-nums"
                                />
                              </div>

                              {/* Line Total Display */}
                              <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-2">
                                <div className="bg-slate-900 text-white px-3.5 py-2 rounded-xl flex-1 text-right">
                                  <span className="block text-[10px] text-slate-400">
                                    {formatBn(enteredQty)} পিস (@ ৳{formatBn(enteredRate)}/হাজার)
                                  </span>
                                  <span className="text-sm font-bold text-amber-400 font-mono tabular-nums">
                                    {formatCurrencyBn(rowCalc?.lineTotal || 0)}
                                  </span>
                                </div>

                                {memoItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveMemoRow(idx)}
                                    aria-label="ইটের সারি মুছে ফেলুন"
                                    className="p-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Quick Quantity Preset Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {lang === 'en' ? 'Quick Qty:' : 'দ্রুত পরিমাণ:'}
                                </span>
                                {QUICK_QTY_PRESETS.map((presetQty) => (
                                  <button
                                    key={presetQty}
                                    type="button"
                                    onClick={() =>
                                      onUpdateMemoItem(idx, { quantity: String(presetQty) })
                                    }
                                    className={`px-2.5 py-0.5 rounded-md text-xs font-semibold tabular-nums transition-colors cursor-pointer border ${
                                      Number(row.quantity) === presetQty
                                        ? 'bg-orange-600 text-white border-orange-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50'
                                    }`}
                                  >
                                    {formatBn(presetQty)} পিস
                                  </button>
                                ))}
                              </div>

                              <span className="text-[11px] font-medium text-slate-500">
                                হিসাব: ({formatBn(enteredQty)} ÷ ১০০০) × ৳{formatBn(enteredRate)} ={' '}
                                <strong className="text-slate-900">
                                  {formatCurrencyBn(rowCalc?.lineTotal || 0)}
                                </strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right 4 Columns: Step 3 (Total Bill, Joma, Baki & Save/Print) */}
                <div className="xl:col-span-4 bg-slate-900 text-white rounded-2xl p-5 space-y-4 border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-orange-600 text-white text-xs font-bold flex items-center justify-center">
                        ৩
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {lang === 'en' ? 'Total Bill, Paid & Due' : 'মোট বিল, নগদ জমা ও বাকি হিসাব'}
                      </h3>
                    </div>
                    <Wallet className="w-5 h-5 text-orange-400" />
                  </div>

                  {/* Live Bill Breakdown */}
                  <div className="space-y-2.5 bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>{lang === 'en' ? 'Total Bricks:' : 'মোট ইটের পরিমাণ:'}</span>
                      <span className="font-bold text-white tabular-nums">
                        {formatBn(totalBricksQty)} পিস
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>{lang === 'en' ? 'Sub-Total:' : 'সাব-টোটাল (মোট দাম):'}</span>
                      <span className="font-bold text-white tabular-nums">
                        {formatCurrencyBn(liveMemoCalc.subTotal)}
                      </span>
                    </div>

                    {/* Discount Input */}
                    <div className="pt-2 border-t border-slate-800/90 flex items-center justify-between gap-3">
                      <label
                        htmlFor="memo-discount-input"
                        className="text-xs font-semibold text-amber-300"
                      >
                        {lang === 'en' ? 'Discount (৳):' : 'ছাড় / ডিসকাউন্ট (৳):'}
                      </label>
                      <input
                        id="memo-discount-input"
                        type="number"
                        min={0}
                        value={memoDiscount}
                        onChange={(e) => onChangeMemoDiscount(e.target.value)}
                        className="w-32 px-3 py-1.5 text-right text-sm font-bold bg-slate-900 border border-slate-700 rounded-lg text-amber-300 focus:border-amber-400 focus:outline-none tabular-nums"
                      />
                    </div>

                    {/* Net Total Payable */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
                      <span className="text-sm font-bold text-white">
                        {lang === 'en' ? 'Total Memo Bill:' : 'সর্বমোট মেমো বিল:'}
                      </span>
                      <span className="text-xl font-bold text-amber-400 font-mono tabular-nums">
                        {formatCurrencyBn(liveMemoCalc.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* JOMA (নগদ জমা) Input */}
                  <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="memo-paid-input"
                        className="text-xs font-bold text-emerald-300"
                      >
                        {lang === 'en' ? 'Paid Amount (Joma ৳) *' : 'নগদ জমা (Joma ৳) *'}
                      </label>
                      <span className="text-[11px] text-emerald-300/90">
                        ক্যাশ বুকে জমা হবে
                      </span>
                    </div>

                    <input
                      id="memo-paid-input"
                      type="number"
                      min={0}
                      max={liveMemoCalc.totalAmount}
                      value={memoPaid}
                      onChange={(e) => onChangeMemoPaid(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-lg font-bold font-mono bg-slate-950 border-2 border-emerald-500/60 rounded-xl text-emerald-300 focus:border-emerald-400 focus:outline-none tabular-nums"
                    />

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onChangeMemoPaid(String(liveMemoCalc.totalAmount))}
                        className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          liveMemoCalc.dueAmount === 0 && liveMemoCalc.totalAmount > 0
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-emerald-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        পূর্ণ জমা
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeMemoPaid(String(Math.round(liveMemoCalc.totalAmount / 2)))
                        }
                        className="py-1.5 px-1.5 rounded-lg text-[11px] font-bold bg-slate-900 text-amber-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        ৫০% জমা
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeMemoPaid('0')}
                        className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          Number(memoPaid) === 0
                            ? 'bg-rose-700 text-white border-rose-500'
                            : 'bg-slate-900 text-rose-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        পুরো বাকি
                      </button>
                    </div>
                  </div>

                  {/* BAKI (বাকি পাওনা) Live Display Box */}
                  <div
                    className={`rounded-xl p-4 border space-y-2.5 ${
                      liveMemoCalc.dueAmount > 0
                        ? 'bg-rose-950/60 border-rose-500/50'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-bold text-rose-300">
                          {lang === 'en' ? 'Due Balance (Baki)' : 'বাকি পাওনা (Baki / Due)'}
                        </span>
                        <span className="text-[11px] text-slate-300">
                          {liveMemoCalc.dueAmount > 0
                            ? 'ক্রেতার বকেয়া খাতায় যুক্ত হবে'
                            : 'সম্পূর্ণ বিল পরিশোধিত (PAID)'}
                        </span>
                      </div>
                      <span
                        className={`text-xl font-bold font-mono tabular-nums ${
                          liveMemoCalc.dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrencyBn(liveMemoCalc.dueAmount)}
                      </span>
                    </div>

                    {liveMemoCalc.dueAmount > 0 && (
                      <div className="pt-2 border-t border-rose-500/30 flex items-center justify-between gap-2">
                        <label
                          htmlFor="memo-due-promise-date"
                          className="flex items-center gap-1 text-[11px] font-semibold text-rose-200"
                        >
                          <Calendar className="w-3.5 h-3.5 text-rose-300" />
                          বাকি পরিশোধের তারিখ:
                        </label>
                        <input
                          id="memo-due-promise-date"
                          type="date"
                          value={memoDuePromiseDate}
                          onChange={(e) => onChangeMemoDuePromiseDate(e.target.value)}
                          className="px-2.5 py-1 text-xs font-mono bg-slate-950 border border-rose-500/40 rounded-lg text-white focus:outline-none tabular-nums"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Method & Note */}
                  <div className="space-y-3 pt-1">
                    <div>
                      <label
                        htmlFor="memo-method-select"
                        className="block text-xs font-semibold text-slate-300 mb-1.5"
                      >
                        {lang === 'en' ? 'Payment Method' : 'পেমেন্ট মাধ্যম'}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            'নগদ ক্যাশ',
                            'বিকাশ / নগদ অ্যাপ',
                            'ব্যাংক চেক / ট্রান্সফার',
                          ] as PaymentMethod[]
                        ).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => onChangeMemoMethod(method)}
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer truncate ${
                              memoMethod === method
                                ? 'bg-orange-600 text-white border-orange-500'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {method === 'বিকাশ / নগদ অ্যাপ'
                              ? 'বিকাশ / নগদ'
                              : method === 'ব্যাংক চেক / ট্রান্সফার'
                              ? 'ব্যাংক চেক'
                              : method}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="memo-note-input"
                        className="block text-xs font-semibold text-slate-300 mb-1"
                      >
                        {lang === 'en' ? 'Note (Optional)' : 'মেমো নোট বা মন্তব্য (ঐচ্ছিক)'}
                      </label>
                      <input
                        id="memo-note-input"
                        type="text"
                        placeholder="মন্তব্য লিখুন..."
                        value={memoNote}
                        onChange={(e) => onChangeMemoNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Primary Submit & Save+Print Gatepass Buttons */}
                  <div className="space-y-2.5 pt-2">
                    <button
                      type="button"
                      disabled={creatingMemo || isDuplicateMemoNo}
                      onClick={(e) => onSubmitMemo(e as unknown as React.FormEvent, true)}
                      className="w-full py-3 px-4 text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
                    >
                      <Printer className="w-4 h-4" />
                      {creatingMemo
                        ? 'মেমো তৈরি হচ্ছে...'
                        : lang === 'en'
                        ? 'Save Memo & Print Gatepass'
                        : 'মেমো সেভ ও প্রিন্ট গেটপাস'}
                    </button>

                    <button
                      type="submit"
                      disabled={creatingMemo || isDuplicateMemoNo}
                      className="w-full py-2.5 px-4 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.99]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {lang === 'en'
                        ? 'Save Memo Only'
                        : 'শুধু মেমো সেভ ও ক্যাশ বুকে যুক্ত করুন'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
