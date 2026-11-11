import React, { useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  FilePlus2,
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
import {
  cleanBrickGradeName,
  formatBn,
  formatCurrencyBn,
  normalizeNumericInput,
  parseNum,
} from '../utils/kilnLogic';

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
    section: 'MILLS' | 'CHULLI_LOAD' | 'PORAI_MISTRI' | 'CHULLI_UNLOAD' | 'DELIVERY'
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
      {/* Clean & Fresh Animated Cash Memo Popup Modal — Ultra-Compact on Phone */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="নতুন ডিজিটাল ক্যাশ মেমো ও গেটপাস তৈরি পপআপ"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-start justify-center p-1.5 sm:p-4 lg:p-6 overflow-y-auto animate-modal-backdrop"
        >
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden my-auto animate-modal-pop">
            {/* Top Clean Header Bar — Compact 2-Row Layout on Phone */}
            <div className="bg-[#0F172A] text-white px-2.5 sm:px-6 py-2 sm:py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 sm:gap-3.5 border-b border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-orange-600 flex items-center justify-center text-white shrink-0">
                    <FilePlus2 className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs sm:text-base font-extrabold text-white truncate">
                      {lang === 'en'
                        ? 'New Cash Memo & Gate Pass'
                        : 'নতুন ডিজিটাল ক্যাশ মেমো ও গেট পাস'}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-300 truncate">
                      {lang === 'en'
                        ? 'SBL Sweet Clay Bricks (Babulia, Satkhira) · Rate per 1,000'
                        : 'SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা) · ১০০০ ইটের দর'}
                    </p>
                  </div>
                </div>

                {/* Mobile Top-Right Reset & Close Buttons */}
                <div className="flex lg:hidden items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onResetForm}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-orange-400" />
                    <span>{lang === 'en' ? 'Reset' : 'রিসেট'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="নতুন মেমো পপআপ বন্ধ করুন"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Memo Number & Date Side-by-Side on Phone (grid-cols-2) + Desktop Reset/Close */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2.5">
                <div className="bg-slate-800/90 border border-slate-700 rounded-lg sm:rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 sm:min-w-[165px]">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <label
                      htmlFor="memo-number-input"
                      className="text-[10px] sm:text-[11px] font-bold text-orange-300 truncate"
                    >
                      {lang === 'en' ? 'Memo No *' : 'মেমো নম্বর *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => onChangeMemoNo(nextAutoMemoNo)}
                      className="text-[9px] sm:text-[10px] font-bold text-sky-300 hover:text-sky-200 cursor-pointer shrink-0"
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
                    className="w-full px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white text-slate-900 border border-slate-300 rounded-md sm:rounded-lg font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-orange-500 tabular-nums"
                  />
                  {isDuplicateMemoNo && (
                    <span className="block text-[9px] sm:text-[10px] text-rose-400 font-semibold mt-0.5 truncate">
                      মেমো নম্বরটি ব্যবহৃত!
                    </span>
                  )}
                </div>

                <div className="bg-slate-800/90 border border-slate-700 rounded-lg sm:rounded-xl px-2 py-1 sm:px-3 sm:py-1.5">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <label
                      htmlFor="memo-date-input"
                      className="block text-[10px] sm:text-[11px] font-bold text-slate-200 truncate"
                    >
                      {lang === 'en' ? 'Date *' : 'তারিখ *'}
                    </label>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onChangeMemoDate(todayIso)}
                        className={`text-[9px] sm:text-[10px] px-1 py-0.2 rounded cursor-pointer ${
                          memoDate === todayIso
                            ? 'bg-orange-600 text-white font-bold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        আজ
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeMemoDate(yesterdayIso)}
                        className={`text-[9px] sm:text-[10px] px-1 py-0.2 rounded cursor-pointer ${
                          memoDate === yesterdayIso
                            ? 'bg-orange-600 text-white font-bold'
                            : 'text-slate-300 hover:text-white'
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
                    className="w-full px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-white text-slate-900 border border-slate-300 rounded-md sm:rounded-lg font-mono font-semibold text-xs sm:text-sm focus:outline-none focus:border-orange-500 tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={onResetForm}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                  {lang === 'en' ? 'Reset' : 'রিসেট'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="নতুন মেমো পপআপ বন্ধ করুন"
                  className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Clean Form Body — Compact Spacing & Multi-Column Grids on Phone */}
            <form
              noValidate
              onSubmit={(e) => onSubmitMemo(e, false)}
              className="p-2 sm:p-5 bg-slate-50/70 max-h-[85vh] overflow-y-auto space-y-2.5 sm:space-y-4"
            >
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-5 items-start">
                {/* Left 8 Columns: Customer Info + Brick Grade, Quantity & Per-1000 Rate */}
                <div className="xl:col-span-8 space-y-2.5 sm:space-y-4">
                  {/* STEP 1: Customer Name, Phone Number, Address & Vehicle */}
                  <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-4 space-y-2 sm:space-y-3.5">
                    <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-100 pb-1.5 sm:pb-2">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-orange-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center shrink-0">
                        ১
                      </span>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {lang === 'en'
                          ? 'Customer Name, Phone, Address & Transport'
                          : 'ক্রেতার নাম, মোবাইল নম্বর, ঠিকানা ও গাড়ির বিবরণ'}
                      </h3>
                    </div>

                    {/* Customer Name & Phone in 2-Col on Phone, Address Full Width on Phone */}
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-1.5 sm:gap-3">
                      <div className="col-span-1 md:col-span-5">
                        <label
                          htmlFor="memo-customer-input"
                          className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-900 mb-0.5 sm:mb-1 truncate"
                        >
                          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 shrink-0" />
                          <span>{lang === 'en' ? 'Customer Name *' : 'ক্রেতার নাম *'}</span>
                        </label>
                        <input
                          id="memo-customer-input"
                          type="text"
                          required
                          placeholder="যেমন: হাজী আব্দুর রহিম"
                          value={memoCustomer}
                          onChange={(e) => onChangeMemoCustomer(e.target.value)}
                          className="w-full px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:bg-white focus:border-orange-600"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-3">
                        <label
                          htmlFor="memo-phone-input"
                          className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-900 mb-0.5 sm:mb-1 truncate"
                        >
                          <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 shrink-0" />
                          <span>{lang === 'en' ? 'Phone Number' : 'মোবাইল নম্বর'}</span>
                        </label>
                        <input
                          id="memo-phone-input"
                          type="text"
                          placeholder="০১৭১১-০০০০০০"
                          value={memoPhone}
                          onChange={(e) => onChangeMemoPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:bg-white focus:border-orange-600 tabular-nums"
                        />
                      </div>

                      <div className="col-span-2 md:col-span-4">
                        <label
                          htmlFor="memo-address-input"
                          className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-900 mb-0.5 sm:mb-1 truncate"
                        >
                          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 shrink-0" />
                          <span>{lang === 'en' ? 'Delivery Address' : 'ডেলিভারি ঠিকানা'}</span>
                        </label>
                        <input
                          id="memo-address-input"
                          type="text"
                          placeholder="গ্রাম / বাজার / উপজেলা"
                          value={memoAddress}
                          onChange={(e) => onChangeMemoAddress(e.target.value)}
                          className="w-full px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:bg-white focus:border-orange-600"
                        />
                      </div>
                    </div>

                    {/* Quick Address Chips */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                        {lang === 'en' ? 'Quick Address:' : 'ঠিকানা:'}
                      </span>
                      {QUICK_ADDRESS_PRESETS.map((addr) => (
                        <button
                          key={addr}
                          type="button"
                          onClick={() => onChangeMemoAddress(addr)}
                          className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border transition-colors cursor-pointer ${
                            memoAddress === addr
                              ? 'bg-slate-900 text-white border-slate-900 font-bold'
                              : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {addr}
                        </button>
                      ))}
                    </div>

                    {/* Transport Info — 2x2 Compact Grid on Phone */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2.5">
                      <div>
                        <label className="block text-[10px] sm:text-[11px] font-bold text-slate-800 mb-0.5 truncate">
                          {lang === 'en' ? 'Vehicle Type' : 'গাড়ির ধরন'}
                        </label>
                        <select
                          value={memoVehicleType}
                          onChange={(e) => onChangeMemoVehicleType(e.target.value)}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
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
                          className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-800 mb-0.5 truncate"
                        >
                          <Truck className="w-3 h-3 text-slate-600 shrink-0" />
                          <span className="truncate">{lang === 'en' ? 'Vehicle / Truck No' : 'গাড়ি / ট্রাক নং'}</span>
                        </label>
                        <input
                          id="memo-truck-input"
                          type="text"
                          value={memoTruck}
                          onChange={(e) => onChangeMemoTruck(e.target.value)}
                          placeholder="সাতক্ষীরা-ট-১১-..."
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="memo-driver-input"
                          className="block text-[10px] sm:text-[11px] font-bold text-slate-800 mb-0.5 truncate"
                        >
                          {lang === 'en' ? 'Driver Name' : 'ড্রাইভারের নাম'}
                        </label>
                        <input
                          id="memo-driver-input"
                          type="text"
                          value={memoDriver}
                          onChange={(e) => onChangeMemoDriver(e.target.value)}
                          placeholder="ড্রাইভারের নাম"
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="memo-driver-phone-input"
                          className="block text-[10px] sm:text-[11px] font-bold text-slate-800 mb-0.5 truncate"
                        >
                          {lang === 'en' ? 'Driver Phone' : 'ড্রাইভারের মোবাইল'}
                        </label>
                        <input
                          id="memo-driver-phone-input"
                          type="text"
                          value={memoDriverPhone}
                          onChange={(e) => onChangeMemoDriverPhone(e.target.value)}
                          placeholder="০১৭..."
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-950 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: Clean Brick Selector, Quantity & Per-1000 Rate */}
                  <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-4 space-y-2 sm:space-y-3.5">
                    <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 sm:pb-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-orange-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center shrink-0">
                          ২
                        </span>
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                          {lang === 'en'
                            ? 'Brick Type, Quantity & Rate per 1,000 Bricks'
                            : 'কী ইট নিবে, পরিমাণ ও হাজার প্রতি দর (১০০০ ইটে)'}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={onAddMemoRow}
                        className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{lang === 'en' ? '+ Add Brick' : '+ আরও ইট'}</span>
                      </button>
                    </div>

                    {/* Item Rows */}
                    <div className="space-y-2 sm:space-y-3">
                      {/* Quick Brick Type Buttons inside Step 2 — 3-Col Compact Grid on Phone */}
                      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-2">
                        {brickGrades.map((g) => {
                          const isSelectedInActiveRow =
                            memoItems[memoItems.length - 1]?.gradeId === g.id;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => handleSelectQuickGrade(g, false)}
                              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-1 ${
                                isSelectedInActiveRow
                                  ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                                  : 'bg-slate-50 hover:bg-orange-50 text-slate-800 border-slate-200 hover:border-orange-300'
                              }`}
                            >
                              <span className="truncate">
                                {lang === 'en' ? g.nameEn : cleanBrickGradeName(g.nameBn)}
                              </span>
                              {isSelectedInActiveRow && (
                                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {memoItems.map((row, idx) => {
                        const rowCalc = computedItems[idx];
                        const enteredQty = parseNum(row.quantity);
                        const enteredRate = parseNum(row.ratePerThousand);

                        return (
                          <div
                            key={idx}
                            className="p-2 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 sm:space-y-3"
                          >
                            {/* Single-Row 12-Col Grid on Phone for Brick Type + Quantity + Rate */}
                            <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end">
                              {/* Brick Type Dropdown */}
                              <div className="col-span-5 sm:col-span-4">
                                <label
                                  htmlFor={idx === 0 ? 'memo-grade-select' : `memo-grade-${idx}`}
                                  className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-800 mb-0.5 sm:mb-1 truncate"
                                >
                                  <Layers className="w-3 h-3 text-orange-600 shrink-0" />
                                  <span className="truncate">{lang === 'en' ? 'Brick Type *' : 'কী ইট নিবে *'}</span>
                                </label>
                                <select
                                  id={idx === 0 ? 'memo-grade-select' : `memo-grade-${idx}`}
                                  value={row.gradeId}
                                  onChange={(e) =>
                                    onUpdateMemoItem(idx, { gradeId: e.target.value })
                                  }
                                  className="w-full px-1.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold text-slate-950 bg-white border border-slate-300 rounded-lg sm:rounded-xl focus:border-orange-600"
                                >
                                  {brickGrades.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {lang === 'en' ? g.nameEn : cleanBrickGradeName(g.nameBn)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Quantity Input */}
                              <div className="col-span-4 sm:col-span-3">
                                <label
                                  htmlFor={idx === 0 ? 'memo-qty-input' : `memo-qty-${idx}`}
                                  className="block text-[10px] sm:text-xs font-bold text-slate-900 mb-0.5 sm:mb-1 truncate"
                                >
                                  {lang === 'en' ? 'Qty (Pcs) *' : 'পরিমাণ (পিস) *'}
                                </label>
                                <input
                                  id={idx === 0 ? 'memo-qty-input' : `memo-qty-${idx}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    onUpdateMemoItem(idx, {
                                      quantity: normalizeNumericInput(e.target.value),
                                    })
                                  }
                                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold text-slate-950 bg-white border border-slate-300 rounded-lg sm:rounded-xl focus:border-orange-600 tabular-nums"
                                />
                              </div>

                              {/* Per-1,000 Rate Input */}
                              <div className="col-span-3 sm:col-span-2">
                                <label
                                  htmlFor={idx === 0 ? 'memo-rate-input' : `memo-rate-${idx}`}
                                  className="block text-[10px] sm:text-xs font-bold text-slate-900 mb-0.5 sm:mb-1 truncate"
                                >
                                  {lang === 'en' ? 'Rate/1K *' : 'হাজারে দর *'}
                                </label>
                                <input
                                  id={idx === 0 ? 'memo-rate-input' : `memo-rate-${idx}`}
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="11000"
                                  value={row.ratePerThousand}
                                  onChange={(e) =>
                                    onUpdateMemoItem(idx, {
                                      ratePerThousand: normalizeNumericInput(e.target.value),
                                    })
                                  }
                                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold text-slate-950 bg-white border border-slate-300 rounded-lg sm:rounded-xl focus:border-orange-600 tabular-nums"
                                />
                              </div>

                              {/* Line Total Display */}
                              <div className="col-span-12 sm:col-span-3 flex items-center justify-between sm:justify-end gap-1.5">
                                <div className="bg-slate-900 text-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl flex-1 flex sm:block items-center justify-between sm:text-right">
                                  <span className="text-[10px] font-semibold text-slate-200">
                                    {formatBn(enteredQty)} পিস (@ ৳{formatBn(enteredRate)}/হাজার)
                                  </span>
                                  <span className="text-xs sm:text-sm font-extrabold text-amber-300 font-mono tabular-nums">
                                    {formatCurrencyBn(rowCalc?.lineTotal || 0)}
                                  </span>
                                </div>

                                {memoItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveMemoRow(idx)}
                                    aria-label="ইটের সারি মুছে ফেলুন"
                                    className="p-1.5 sm:p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg sm:rounded-xl cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Quick Quantity Preset Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/80">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                                  {lang === 'en' ? 'Quick Qty:' : 'দ্রুত পরিমাণ:'}
                                </span>
                                {QUICK_QTY_PRESETS.map((presetQty) => (
                                  <button
                                    key={presetQty}
                                    type="button"
                                    onClick={() =>
                                      onUpdateMemoItem(idx, { quantity: String(presetQty) })
                                    }
                                    className={`px-1.5 py-0.5 sm:px-2.5 rounded-md text-[10px] sm:text-xs font-bold tabular-nums transition-colors cursor-pointer border ${
                                      Number(row.quantity) === presetQty
                                        ? 'bg-orange-600 text-white border-orange-600'
                                        : 'bg-white text-slate-800 border-slate-200 hover:bg-orange-50'
                                    }`}
                                  >
                                    {formatBn(presetQty)}
                                  </button>
                                ))}
                              </div>

                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-800 hidden sm:inline">
                                হিসাব: ({formatBn(enteredQty)} ÷ ১০০০) × ৳{formatBn(enteredRate)} ={' '}
                                <strong className="text-slate-950">
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
                <div className="xl:col-span-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-5 space-y-2.5 sm:space-y-3.5 border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-orange-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center">
                        ৩
                      </span>
                      <h3 className="text-xs sm:text-base font-extrabold text-white">
                        {lang === 'en' ? 'Total Bill, Paid & Due' : 'মোট বিল, নগদ জমা ও বাকি হিসাব'}
                      </h3>
                    </div>
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                  </div>

                  {/* Live Bill Breakdown */}
                  <div className="space-y-1.5 sm:space-y-2 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 text-xs sm:text-sm">
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
                    <div className="pt-1.5 border-t border-slate-800/90 flex items-center justify-between gap-2">
                      <label
                        htmlFor="memo-discount-input"
                        className="text-[11px] sm:text-xs font-semibold text-amber-300"
                      >
                        {lang === 'en' ? 'Discount (৳):' : 'ছাড় / ডিসকাউন্ট (৳):'}
                      </label>
                      <input
                        id="memo-discount-input"
                        type="text"
                        inputMode="decimal"
                        value={memoDiscount}
                        onChange={(e) => onChangeMemoDiscount(normalizeNumericInput(e.target.value))}
                        className="w-24 sm:w-32 px-2.5 py-1 text-right text-xs sm:text-sm font-bold bg-white text-slate-900 border-2 border-amber-400 rounded-lg focus:border-amber-500 focus:outline-none tabular-nums"
                      />
                    </div>

                    {/* Net Total Payable */}
                    <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-800">
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {lang === 'en' ? 'Total Memo Bill:' : 'সর্বমোট মেমো বিল:'}
                      </span>
                      <span className="text-base sm:text-xl font-black text-amber-400 font-mono tabular-nums">
                        {formatCurrencyBn(liveMemoCalc.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* JOMA (নগদ জমা) Input */}
                  <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="memo-paid-input"
                        className="text-[11px] sm:text-xs font-bold text-emerald-300"
                      >
                        {lang === 'en' ? 'Paid Amount (Joma ৳) *' : 'নগদ জমা (Joma ৳) *'}
                      </label>
                      <span className="text-[10px] sm:text-[11px] text-emerald-300/90">
                        ক্যাশ বুকে জমা হবে
                      </span>
                    </div>

                    <input
                      id="memo-paid-input"
                      type="text"
                      inputMode="decimal"
                      value={memoPaid}
                      onChange={(e) => onChangeMemoPaid(normalizeNumericInput(e.target.value))}
                      className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 text-sm sm:text-lg font-bold font-mono bg-white text-slate-900 border-2 border-emerald-500 rounded-lg sm:rounded-xl focus:border-emerald-600 focus:outline-none tabular-nums"
                    />

                    <div className="grid grid-cols-3 gap-1 sm:gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onChangeMemoPaid(String(liveMemoCalc.totalAmount))}
                        className={`py-1 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-colors cursor-pointer ${
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
                        className="py-1 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-slate-900 text-amber-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        ৫০% জমা
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeMemoPaid('0')}
                        className={`py-1 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-colors cursor-pointer ${
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
                    className={`rounded-xl p-2.5 sm:p-3.5 border space-y-1.5 sm:space-y-2 ${
                      liveMemoCalc.dueAmount > 0
                        ? 'bg-rose-950/60 border-rose-500/50'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[11px] sm:text-xs font-bold text-rose-300">
                          {lang === 'en' ? 'Due Balance (Baki)' : 'বাকি পাওনা (Baki / Due)'}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-slate-300">
                          {liveMemoCalc.dueAmount > 0
                            ? 'ক্রেতার বকেয়া খাতায় যুক্ত হবে'
                            : 'সম্পূর্ণ বিল পরিশোধিত (PAID)'}
                        </span>
                      </div>
                      <span
                        className={`text-base sm:text-xl font-black font-mono tabular-nums ${
                          liveMemoCalc.dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrencyBn(liveMemoCalc.dueAmount)}
                      </span>
                    </div>

                    {liveMemoCalc.dueAmount > 0 && (
                      <div className="pt-1.5 border-t border-rose-500/30 flex items-center justify-between gap-2">
                        <label
                          htmlFor="memo-due-promise-date"
                          className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-rose-200"
                        >
                          <Calendar className="w-3 h-3 text-rose-300" />
                          পরিশোধের তারিখ:
                        </label>
                        <input
                          id="memo-due-promise-date"
                          type="date"
                          value={memoDuePromiseDate}
                          onChange={(e) => onChangeMemoDuePromiseDate(e.target.value)}
                          className="px-2 py-0.5 text-xs font-mono font-bold bg-white text-slate-900 border border-rose-300 rounded-lg focus:outline-none tabular-nums"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Method & Note */}
                  <div className="space-y-2 pt-0.5">
                    <div>
                      <label
                        htmlFor="memo-method-select"
                        className="block text-[10px] sm:text-xs font-semibold text-slate-300 mb-1"
                      >
                        {lang === 'en' ? 'Payment Method' : 'পেমেন্ট মাধ্যম'}
                      </label>
                      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
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
                            className={`py-1.5 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-colors cursor-pointer truncate ${
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
                        className="block text-[10px] sm:text-xs font-semibold text-slate-300 mb-0.5"
                      >
                        {lang === 'en' ? 'Note (Optional)' : 'মেমো নোট বা মন্তব্য (ঐচ্ছিক)'}
                      </label>
                      <input
                        id="memo-note-input"
                        type="text"
                        placeholder="মন্তব্য লিখুন..."
                        value={memoNote}
                        onChange={(e) => onChangeMemoNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-medium bg-white text-slate-900 border border-slate-300 rounded-lg sm:rounded-xl placeholder:text-slate-400 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Primary Submit & Save+Print Gatepass Buttons */}
                  <div className="space-y-1.5 sm:space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={creatingMemo || isDuplicateMemoNo}
                      onClick={(e) => onSubmitMemo(e as unknown as React.FormEvent, true)}
                      className="sbl-btn-interactive w-full py-2.5 sm:py-3.5 px-3 sm:px-5 text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 rounded-xl sm:rounded-2xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-orange-500/25"
                    >
                      <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 shrink-0" />
                      {creatingMemo
                        ? 'মেমো তৈরি হচ্ছে...'
                        : lang === 'en'
                        ? 'Save Memo & Print Gatepass'
                        : 'মেমো সেভ ও প্রিন্ট গেটপাস (অটো ক্যাশ বুক)'}
                    </button>

                    <button
                      type="submit"
                      disabled={creatingMemo || isDuplicateMemoNo}
                      className="sbl-btn-interactive w-full py-2 sm:py-3 px-3 sm:px-4 text-[11px] sm:text-xs font-black bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-slate-700/80 rounded-xl sm:rounded-2xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
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
