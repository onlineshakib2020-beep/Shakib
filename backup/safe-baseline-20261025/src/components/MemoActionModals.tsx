import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Edit3,
  Eye,
  Layers,
  Plus,
  Printer,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import type {
  BrickGrade,
  CashTransaction,
  LanguageMode,
  MemoItemRow,
  MemoPaymentRecord,
  PaymentMethod,
  SalesMemo,
} from '../types/kiln';
import {
  calculateMultiItemMemoTotals,
  calculateRowTotal,
  cleanBrickGradeName,
  formatBn,
  formatCurrencyBn,
} from '../utils/kilnLogic';

const QUICK_QTY_PRESETS = [500, 1000, 1500, 2000, 3000, 5000, 10000];

const QUICK_ADDRESS_PRESETS = [
  'বাবুলিয়া, সাতক্ষীরা',
  'সুলতানপুর, সাতক্ষীরা সদর',
  'পাটকেলঘাটা, সাতক্ষীরা',
  'কলারোয়া বাজার, সাতক্ষীরা',
  'তালা উপজেলা, সাতক্ষীরা',
  'কালিগঞ্জ রোড, সাতক্ষীরা',
];

const VEHICLE_TYPE_PRESETS = [
  'ট্রাক (Truck)',
  'ট্রলি / ট্রাক্টর',
  'পিকআপ (Pickup)',
  'ভ্যান / নছিমন',
];

interface MemoActionModalsProps {
  lang?: LanguageMode;
  brickGrades: BrickGrade[];
  cashTransactions?: CashTransaction[];
  viewMemo: SalesMemo | null;
  onCloseViewMemo: () => void;
  dueModalMemo: SalesMemo | null;
  onCloseDueModal: () => void;
  editModalMemo: SalesMemo | null;
  onCloseEditModal: () => void;
  deleteTargetMemo: SalesMemo | null;
  onCloseDeleteModal: () => void;
  onOpenDueFromView: (memo: SalesMemo) => void;
  onOpenEditFromView: (memo: SalesMemo) => void;
  onOpenDeleteFromView: (memo: SalesMemo) => void;
  onPrintMemo: (memo: SalesMemo) => void;
  onCollectDue: (
    memoId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => Promise<void>;
  onUpdateMemo: (
    memoId: string,
    payload: Partial<SalesMemo>
  ) => Promise<void>;
  onDeleteMemo: (memoId: string) => Promise<void>;
}

export const MemoActionModals: React.FC<MemoActionModalsProps> = ({
  brickGrades,
  cashTransactions = [],
  viewMemo,
  onCloseViewMemo,
  dueModalMemo,
  onCloseDueModal,
  editModalMemo,
  onCloseEditModal,
  deleteTargetMemo,
  onCloseDeleteModal,
  onOpenDueFromView,
  onOpenEditFromView,
  onOpenDeleteFromView,
  onPrintMemo,
  onCollectDue,
  onUpdateMemo,
  onDeleteMemo,
}) => {
  // Due Collection Modal State
  const [dueCollectAmount, setDueCollectAmount] = useState('');
  const [duePaymentMethod, setDuePaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [dueNote, setDueNote] = useState('');
  const [submittingDue, setSubmittingDue] = useState(false);

  useEffect(() => {
    if (dueModalMemo) {
      setDueCollectAmount(String(dueModalMemo.dueAmount));
      setDuePaymentMethod(dueModalMemo.paymentMethod || 'নগদ ক্যাশ');
      setDueNote('');
    }
  }, [dueModalMemo]);

  // Edit Memo Modal State
  const [editMemoNo, setEditMemoNo] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('ট্রাক (Truck)');
  const [editTruck, setEditTruck] = useState('');
  const [editDriver, setEditDriver] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDuePromiseDate, setEditDuePromiseDate] = useState('');
  const [editItems, setEditItems] = useState<
    Array<{ gradeId: string; quantity: string; rate: string }>
  >([]);
  const [editDiscount, setEditDiscount] = useState('0');
  const [editPaid, setEditPaid] = useState('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [editNote, setEditNote] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  useEffect(() => {
    if (editModalMemo) {
      setEditMemoNo(editModalMemo.memoNo);
      setEditDate(editModalMemo.date);
      setEditCustomer(editModalMemo.customerName);
      setEditPhone(
        editModalMemo.customerPhone && editModalMemo.customerPhone !== '—'
          ? editModalMemo.customerPhone
          : ''
      );
      setEditAddress(editModalMemo.customerAddress || 'বাবুলিয়া, সাতক্ষীরা');
      setEditVehicleType(editModalMemo.vehicleType || 'ট্রাক (Truck)');
      setEditTruck(
        editModalMemo.truckNo && editModalMemo.truckNo !== '—'
          ? editModalMemo.truckNo
          : 'সাতক্ষীরা-ট-১১-'
      );
      setEditDriver(
        editModalMemo.driverName && editModalMemo.driverName !== '—'
          ? editModalMemo.driverName
          : ''
      );
      setEditDriverPhone(
        editModalMemo.driverPhone && editModalMemo.driverPhone !== '—'
          ? editModalMemo.driverPhone
          : ''
      );
      setEditDuePromiseDate(editModalMemo.duePromiseDate || '');
      setEditDiscount(String(editModalMemo.discount || 0));
      setEditPaid(String(editModalMemo.paidAmount));
      setEditMethod(editModalMemo.paymentMethod || 'নগদ ক্যাশ');
      setEditNote(editModalMemo.note || '');
      if (Array.isArray(editModalMemo.items) && editModalMemo.items.length > 0) {
        setEditItems(
          editModalMemo.items.map((it) => ({
            gradeId: it.gradeId,
            quantity: String(it.quantity),
            rate: String(it.rate < 100 ? Math.round(it.rate * 1000) : it.rate),
          }))
        );
      } else {
        const rawRate = editModalMemo.rate || 11000;
        setEditItems([
          {
            gradeId: editModalMemo.gradeId || brickGrades[0]?.id || 'grade-1',
            quantity: String(editModalMemo.quantity || 1000),
            rate: String(rawRate < 100 ? Math.round(rawRate * 1000) : rawRate),
          },
        ]);
      }
    }
  }, [editModalMemo, brickGrades]);

  // Close active modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTargetMemo) onCloseDeleteModal();
        else if (dueModalMemo) onCloseDueModal();
        else if (editModalMemo) onCloseEditModal();
        else if (viewMemo) onCloseViewMemo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMemo,
    dueModalMemo,
    editModalMemo,
    deleteTargetMemo,
    onCloseViewMemo,
    onCloseDueModal,
    onCloseEditModal,
    onCloseDeleteModal,
  ]);

  const editComputedItems: MemoItemRow[] = editItems.map((row, idx) => {
    const g = brickGrades.find((b) => b.id === row.gradeId) || brickGrades[0];
    const qty = Math.max(0, Number(row.quantity) || 0);
    const rate = Math.max(0, Number(row.rate) || 0);
    const lineTotal = calculateRowTotal(qty, rate, true);
    return {
      id: `item-${idx}`,
      gradeId: row.gradeId,
      gradeName: cleanBrickGradeName(g ? g.nameBn : '১ নং ইট'),
      quantity: qty,
      rate,
      ratePerThousand: true,
      lineTotal,
    };
  });

  const editLiveTotals = calculateMultiItemMemoTotals({
    items: editComputedItems,
    discount: Math.max(0, Number(editDiscount) || 0),
    paidAmount: Math.max(0, Number(editPaid) || 0),
  });

  const handleConfirmCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueModalMemo) return;
    const amt = Number(dueCollectAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setSubmittingDue(true);
    try {
      await onCollectDue(
        dueModalMemo.id,
        amt,
        duePaymentMethod,
        dueNote.trim() || undefined
      );
      onCloseDueModal();
    } finally {
      setSubmittingDue(false);
    }
  };

  const handleConfirmEditMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalMemo) return;
    setSubmittingEdit(true);
    try {
      const primary = editComputedItems[0];
      await onUpdateMemo(editModalMemo.id, {
        memoNo: editMemoNo.trim() || editModalMemo.memoNo,
        customerName: editCustomer.trim(),
        customerPhone: editPhone.trim() || '—',
        customerAddress: editAddress.trim() || 'বাবুলিয়া, সাতক্ষীরা',
        vehicleType: editVehicleType,
        truckNo: editTruck.trim() || '—',
        driverName: editDriver.trim() || '—',
        driverPhone: editDriverPhone.trim() || '—',
        duePromiseDate: editDuePromiseDate,
        date: editDate,
        items: editComputedItems,
        gradeId: primary?.gradeId,
        quantity: primary?.quantity,
        rate: primary?.rate,
        discount: editLiveTotals.discount,
        paidAmount: editLiveTotals.paidAmount,
        paymentMethod: editMethod,
        note: editNote.trim(),
      });
      onCloseEditModal();
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetMemo) return;
    setSubmittingDelete(true);
    try {
      await onDeleteMemo(deleteTargetMemo.id);
      onCloseDeleteModal();
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Compute resolved payment history for viewMemo
  const resolvedPaymentHistory: MemoPaymentRecord[] = React.useMemo(() => {
    if (!viewMemo) return [];
    if (Array.isArray(viewMemo.paymentHistory) && viewMemo.paymentHistory.length > 0) {
      return viewMemo.paymentHistory;
    }
    const matchingTxs = cashTransactions
      .filter((tx) => tx.referenceId === viewMemo.id && tx.type === 'IN')
      .slice()
      .reverse();
    if (matchingTxs.length > 0) {
      return matchingTxs.map((tx, idx) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        paymentMethod: tx.paymentMethod || viewMemo.paymentMethod || 'নগদ ক্যাশ',
        type: idx === 0 && tx.category !== 'বাকি আদায়' ? 'INITIAL' : 'DUE_COLLECTION',
        note:
          tx.category === 'বাকি আদায়'
            ? tx.description || `বকেয়া কিস্তি জমা (#${formatBn(idx + 1)})`
            : 'মেমো তৈরির সময় নগদ জমা',
        createdAt: tx.createdAt,
      }));
    }
    if (viewMemo.paidAmount > 0) {
      return [
        {
          id: `fallback-init-${viewMemo.id}`,
          date: viewMemo.date,
          amount: viewMemo.paidAmount,
          paymentMethod: viewMemo.paymentMethod || 'নগদ ক্যাশ',
          type: 'INITIAL',
          note: 'মেমো তৈরির সময় নগদ জমা',
          createdAt: viewMemo.createdAt,
        },
      ];
    }
    return [];
  }, [viewMemo, cashTransactions]);

  return (
    <>
      {/* 1. MEMO DETAILS & ACTION HUB POPUP MODAL */}
      {viewMemo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`মেমো ${viewMemo.memoNo} বিস্তারিত পপআপ`}
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseViewMemo();
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-modal-backdrop"
        >
          <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto animate-modal-pop">
            {/* Dark Header */}
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold font-mono text-white">
                      মেমো নং: {viewMemo.memoNo}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                        viewMemo.dueAmount === 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {viewMemo.dueAmount === 0 ? 'সম্পূর্ণ পরিশোধিত' : 'বাকি আছে'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    তারিখ: {viewMemo.date} · ক্রেতা: {viewMemo.customerName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCloseViewMemo}
                aria-label="বিস্তারিত পপআপ বন্ধ করুন"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-5 bg-slate-50/70">
              {/* Customer & Transport Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-orange-700 uppercase">
                    ক্রেতার তথ্য (Customer)
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {viewMemo.customerName}
                  </div>
                  <div className="text-slate-600">
                    মোবাইল: <strong className="text-slate-800">{viewMemo.customerPhone}</strong>
                  </div>
                  <div className="text-slate-600">
                    ঠিকানা: <strong className="text-slate-800">{viewMemo.customerAddress}</strong>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-orange-700 uppercase">
                    পরিবহন ও পেমেন্ট বিবরণ
                  </div>
                  <div className="text-slate-600">
                    গাড়ির ধরন ও নম্বর:{' '}
                    <strong className="text-slate-900">
                      {viewMemo.vehicleType || 'ট্রাক'} · {viewMemo.truckNo}
                    </strong>
                  </div>
                  <div className="text-slate-600">
                    ড্রাইভার:{' '}
                    <strong className="text-slate-800">
                      {viewMemo.driverName || '—'}
                      {viewMemo.driverPhone && viewMemo.driverPhone !== '—'
                        ? ` (${viewMemo.driverPhone})`
                        : ''}
                    </strong>
                  </div>
                  <div className="text-slate-600">
                    পেমেন্ট মাধ্যম:{' '}
                    <strong className="text-slate-800">{viewMemo.paymentMethod}</strong>
                  </div>
                </div>
              </div>

              {/* Brick Items Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-4 font-bold">কী ইট নিবে (ইটের ধরন)</th>
                      <th className="py-2.5 px-4 font-bold text-right">পরিমাণ (পিস)</th>
                      <th className="py-2.5 px-4 font-bold text-right">হাজার প্রতি দর (৳)</th>
                      <th className="py-2.5 px-4 font-bold text-right">মোট দাম</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewMemo.items && viewMemo.items.length > 0
                      ? viewMemo.items
                      : [
                          {
                            id: 'legacy-1',
                            gradeId: viewMemo.gradeId || 'grade-1',
                            gradeName: viewMemo.gradeName || '১ নং ইট',
                            quantity: viewMemo.quantity || 0,
                            rate: viewMemo.rate || 11000,
                            ratePerThousand: true,
                            lineTotal: viewMemo.totalAmount,
                          },
                        ]
                    ).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {cleanBrickGradeName(item.gradeName)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatBn(item.quantity)} পিস
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          ৳{formatBn(item.rate < 100 ? Math.round(item.rate * 1000) : item.rate)} / হাজার
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrencyBn(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white p-4 rounded-xl">
                <div>
                  <span className="block text-[11px] text-slate-400">সাব-টোটাল ও ছাড়</span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatCurrencyBn(viewMemo.subTotal || viewMemo.totalAmount)}
                    {viewMemo.discount > 0 ? ` (-৳${formatBn(viewMemo.discount)})` : ''}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">সর্বমোট বিল</span>
                  <span className="text-base font-bold text-amber-400 tabular-nums">
                    {formatCurrencyBn(viewMemo.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">নগদ জমা (Paid)</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums">
                    {formatCurrencyBn(viewMemo.paidAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">বাকি পাওনা (Due)</span>
                  <span className="text-base font-bold text-rose-400 tabular-nums">
                    {formatCurrencyBn(viewMemo.dueAmount)}
                  </span>
                </div>
              </div>

              {/* PAYMENT RECORD / DUE COLLECTION HISTORY SECTION */}
              <div
                id="memo-payment-history-section"
                className="bg-white rounded-xl border-2 border-emerald-200 overflow-hidden shadow-2xs"
              >
                <div className="bg-emerald-50/90 border-b border-emerald-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                        টাকা জমা দেওয়ার রেকর্ড / পেমেন্ট হিস্ট্রি ({formatBn(resolvedPaymentHistory.length)}টি জমা)
                      </h4>
                      <p className="text-[11px] text-emerald-800">
                        মেমো তৈরির নগদ জমা এবং পরবর্তীতে বকেয়া কিস্তি জমার সম্পূর্ণ তালিকা
                      </p>
                    </div>
                  </div>

                  {viewMemo.dueAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewMemo;
                        onCloseViewMemo();
                        onOpenDueFromView(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer transition-colors"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      + বকেয়া টাকা জমা দিন ({formatCurrencyBn(viewMemo.dueAmount)})
                    </button>
                  )}
                </div>

                {resolvedPaymentHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <th className="py-2 px-3 font-bold">কিস্তি নং</th>
                          <th className="py-2 px-3 font-bold">তারিখ</th>
                          <th className="py-2 px-3 font-bold">জমার ধরন ও বিবরণ</th>
                          <th className="py-2 px-3 font-bold">পেমেন্ট মাধ্যম</th>
                          <th className="py-2 px-3 font-bold text-right">জমা টাকা (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {resolvedPaymentHistory.map((rec, idx) => (
                          <tr key={rec.id || idx} className="hover:bg-emerald-50/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              #{formatBn(idx + 1)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {rec.date}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mr-1.5 ${
                                  rec.type === 'INITIAL'
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {rec.type === 'INITIAL' ? 'প্রাথমিক জমা' : 'বকেয়া আদায়'}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {rec.note ||
                                  (rec.type === 'INITIAL'
                                    ? 'মেমো তৈরির সময় নগদ জমা'
                                    : 'বকেয়া কিস্তি জমা')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-semibold">
                              {rec.paymentMethod}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                              +{formatCurrencyBn(rec.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/60 border-t border-emerald-200 font-bold text-xs">
                          <td colSpan={4} className="py-2 px-3 text-right text-slate-700">
                            সর্বমোট জমা দেওয়া হয়েছে:
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-800 tabular-nums">
                            {formatCurrencyBn(viewMemo.paidAmount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    এই মেমোতে এখনো কোনো নগদ টাকা জমা দেওয়া হয়নি (সম্পূর্ণ বকেয়া:{' '}
                    <strong className="text-rose-600">
                      {formatCurrencyBn(viewMemo.dueAmount)}
                    </strong>
                    )।
                  </div>
                )}
              </div>

              {viewMemo.note && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <strong>মেমো নোট:</strong> {viewMemo.note}
                </div>
              )}

              {/* Quick Popup Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewMemo;
                    onCloseViewMemo();
                    onOpenDeleteFromView(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  মেমো ডিলিট
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {viewMemo.dueAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewMemo;
                        onCloseViewMemo();
                        onOpenDueFromView(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      <Banknote className="w-4 h-4" />
                      বাকি আদায়
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const target = viewMemo;
                      onCloseViewMemo();
                      onOpenEditFromView(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                    মেমো আপডেট
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = viewMemo;
                      onCloseViewMemo();
                      onPrintMemo(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    প্রিন্ট ও গেটপাস
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DUE COLLECTION (বাকি আদায় / জমা) POPUP MODAL */}
      {dueModalMemo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="due-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseDueModal();
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-modal-backdrop"
        >
          <form
            onSubmit={handleConfirmCollectDue}
            className="bg-white border-2 border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl my-auto animate-modal-pop"
          >
            {/* Header */}
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="due-modal-title" className="text-base font-bold text-white">
                    ক্রেতার বকেয়া পাওনা আদায় ({dueModalMemo.memoNo})
                  </h3>
                  <p className="text-xs text-emerald-300">
                    আদায়কৃত টাকা মেমোর বিস্তারিত রেকর্ডে ও ক্যাশ বুকে জমা হবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseDueModal}
                aria-label="বকেয়া আদায় মডাল বন্ধ করুন"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Customer & Balance Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ক্রেতার নাম:</span>
                  <strong className="text-sm text-slate-900">
                    {dueModalMemo.customerName} ({dueModalMemo.customerPhone})
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">মোট মেমো বিল ও পূর্বের জমা:</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    মোট: {formatCurrencyBn(dueModalMemo.totalAmount)} · জমা:{' '}
                    {formatCurrencyBn(dueModalMemo.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-rose-700">বর্তমান বকেয়া পাওনা:</span>
                  <span className="text-base font-bold text-rose-700 font-mono tabular-nums">
                    {formatCurrencyBn(dueModalMemo.dueAmount)}
                  </span>
                </div>
              </div>

              {/* Quick Collection Amount Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="collect-due-amount"
                    className="text-xs font-bold text-slate-800"
                  >
                    আজকের আদায়কৃত টাকার পরিমাণ (৳) *
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    ১-ক্লিকে পরিমাণ বসান:
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setDueCollectAmount(String(dueModalMemo.dueAmount))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                      Number(dueCollectAmount) === dueModalMemo.dueAmount
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    সম্পূর্ণ বাকি ({formatCurrencyBn(dueModalMemo.dueAmount)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDueCollectAmount(String(Math.round(dueModalMemo.dueAmount / 2)))
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer"
                  >
                    ৫০% ({formatCurrencyBn(Math.round(dueModalMemo.dueAmount / 2))})
                  </button>
                </div>

                <input
                  id="collect-due-amount"
                  type="number"
                  min={1}
                  max={dueModalMemo.dueAmount}
                  required
                  value={dueCollectAmount}
                  onChange={(e) => setDueCollectAmount(e.target.value)}
                  className="w-full px-4 py-2.5 text-base font-bold font-mono bg-emerald-50/50 border-2 border-emerald-500 rounded-xl text-emerald-950 focus:outline-none tabular-nums"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  পেমেন্ট মাধ্যম
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      'নগদ ক্যাশ',
                      'বিকাশ / নগদ অ্যাপ',
                      'ব্যাংক চেক / ট্রান্সফার',
                    ] as PaymentMethod[]
                  ).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDuePaymentMethod(m)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        duePaymentMethod === m
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m === 'বিকাশ / নগদ অ্যাপ'
                        ? 'বিকাশ / নগদ'
                        : m === 'ব্যাংক চেক / ট্রান্সফার'
                        ? 'ব্যাংক চেক'
                        : m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Payment Note */}
              <div>
                <label
                  htmlFor="collect-due-note"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  জমার বিবরণ / মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  id="collect-due-note"
                  type="text"
                  placeholder="যেমন: ১ম কিস্তি নগদ জমা / ম্যানেজারের মাধ্যমে জমা..."
                  value={dueNote}
                  onChange={(e) => setDueNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Live Remaining Due Preview */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs">
                <span>আদায়ের পর অবশিষ্ট বাকি থাকবে:</span>
                <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                  {formatCurrencyBn(
                    Math.max(0, dueModalMemo.dueAmount - (Number(dueCollectAmount) || 0))
                  )}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onCloseDueModal}
                  className="px-4 py-2.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingDue}
                  className="px-5 py-2.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submittingDue ? 'জমা হচ্ছে...' : 'বকেয়া জমা নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 3. FULL MEMO UPDATE / EDIT STUDIO POPUP MODAL */}
      {editModalMemo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-memo-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseEditModal();
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto animate-modal-backdrop"
        >
          <form
            onSubmit={handleConfirmEditMemo}
            className="bg-white border-2 border-slate-200 rounded-2xl max-w-5xl w-full overflow-hidden shadow-2xl my-auto animate-modal-pop"
          >
            {/* Dark Header */}
            <div className="bg-[#0F172A] text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="edit-memo-modal-title" className="text-base sm:text-lg font-bold text-white">
                    মেমো আপডেট ও সংশোধন ({editModalMemo.memoNo})
                  </h3>
                  <p className="text-xs text-slate-300">
                    হাজার প্রতি দর (১০০০ ইটে দাম) অনুযায়ী স্বয়ংক্রিয় হিসাব
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1">
                  <label className="block text-[10px] font-semibold text-orange-400">
                    মেমো নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={editMemoNo}
                    onChange={(e) => setEditMemoNo(e.target.value)}
                    className="w-28 bg-transparent text-white font-mono font-bold text-xs focus:outline-none"
                  />
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1">
                  <label className="block text-[10px] font-semibold text-slate-300">
                    তারিখ *
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="bg-transparent text-white font-mono font-semibold text-xs focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={onCloseEditModal}
                  aria-label="মেমো সংশোধন মডাল বন্ধ করুন"
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 bg-slate-50/70 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 7 Columns: Customer, Transport & Brick Grade Rows */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Customer & Transport Box */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-orange-600" />
                        ক্রেতা ও পরিবহন তথ্য (Customer & Transport)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ক্রেতার নাম *
                        </label>
                        <input
                          type="text"
                          required
                          value={editCustomer}
                          onChange={(e) => setEditCustomer(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ফোন / মোবাইল নম্বর
                        </label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ডেলিভারি ঠিকানা
                        </label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Quick Address Presets */}
                    <div className="flex flex-wrap gap-1">
                      {QUICK_ADDRESS_PRESETS.map((addr) => (
                        <button
                          key={addr}
                          type="button"
                          onClick={() => setEditAddress(addr)}
                          className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                            editAddress === addr
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {addr}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          গাড়ির ধরন
                        </label>
                        <select
                          value={editVehicleType}
                          onChange={(e) => setEditVehicleType(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                        >
                          {VEHICLE_TYPE_PRESETS.map((vt) => (
                            <option key={vt} value={vt}>
                              {vt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          গাড়ি / ট্রাক নং
                        </label>
                        <input
                          type="text"
                          value={editTruck}
                          onChange={(e) => setEditTruck(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ড্রাইভারের নাম
                        </label>
                        <input
                          type="text"
                          value={editDriver}
                          onChange={(e) => setEditDriver(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ড্রাইভারের মোবাইল
                        </label>
                        <input
                          type="text"
                          value={editDriverPhone}
                          onChange={(e) => setEditDriverPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Brick Items Box */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-orange-600" />
                        কী ইট নিবে, পরিমাণ ও হাজারে দর ((পরিমাণ ÷ ১০০০) × দর)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const g = brickGrades[0];
                          setEditItems((prev) => [
                            ...prev,
                            {
                              gradeId: g?.id || 'grade-1',
                              quantity: '1000',
                              rate: '11000',
                            },
                          ]);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        ইটের সারি যোগ
                      </button>
                    </div>

                    {editItems.map((row, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                      >
                        <div className="grid grid-cols-12 gap-2.5 items-end">
                          <div className="col-span-5">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              কী ইট নিবে (ধরন)
                            </label>
                            <select
                              value={row.gradeId}
                              onChange={(e) => {
                                const newGradeId = e.target.value;
                                setEditItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, gradeId: newGradeId } : it
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                            >
                              {brickGrades.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {cleanBrickGradeName(g.nameBn)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-3">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              পরিমাণ (পিস)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, quantity: val } : it
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              হাজার প্রতি দর (৳)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min={1}
                              value={row.rate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, rate: val } : it
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                            />
                          </div>

                          <div className="col-span-1 flex justify-end">
                            {editItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditItems((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap gap-1">
                            {QUICK_QTY_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setEditItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, quantity: String(preset) } : it
                                    )
                                  )
                                }
                                className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                                  Number(row.quantity) === preset
                                    ? 'bg-orange-600 text-white border-orange-600'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                              >
                                {formatBn(preset)}
                              </button>
                            ))}
                          </div>
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            মোট: {formatCurrencyBn(editComputedItems[idx]?.lineTotal || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right 5 Columns: Billing, Paid, Due */}
                <div className="lg:col-span-5">
                  <div className="bg-[#0F172A] text-white rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                        <Wallet className="w-4 h-4" />
                        হিসাব ও পেমেন্ট সমন্বয়
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        মোট ইট: {formatBn(editComputedItems.reduce((s, r) => s + r.quantity, 0))} পিস
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>সাব-টোটাল দাম:</span>
                        <span className="font-mono font-bold text-white">
                          {formatCurrencyBn(editLiveTotals.subTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300">বিশেষ ছাড় (Discount ৳):</span>
                        <input
                          type="number"
                          min={0}
                          value={editDiscount}
                          onChange={(e) => setEditDiscount(e.target.value)}
                          className="w-28 px-2.5 py-1 text-right text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-amber-300"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <span className="text-sm font-bold text-white">সর্বমোট বিল:</span>
                        <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                          {formatCurrencyBn(editLiveTotals.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Paid Amount Input */}
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-emerald-400">
                          মোট নগদ জমা (Paid ৳) *
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditPaid(String(editLiveTotals.totalAmount))}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white cursor-pointer"
                          >
                            ১০০% নগদ
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPaid('0')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white cursor-pointer"
                          >
                            পুরোটা বাকি
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        required
                        value={editPaid}
                        onChange={(e) => setEditPaid(e.target.value)}
                        className="w-full px-3 py-2 text-base font-bold font-mono bg-slate-950 border-2 border-emerald-500/70 rounded-xl text-emerald-300 focus:outline-none tabular-nums"
                      />
                    </div>

                    {/* Due Status */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">অবশিষ্ট বাকি (Due):</span>
                      <span
                        className={`text-base font-bold font-mono tabular-nums ${
                          editLiveTotals.dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrencyBn(editLiveTotals.dueAmount)}
                      </span>
                    </div>

                    {editLiveTotals.dueAmount > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-rose-300 mb-1">
                          বাকি পরিশোধের সম্ভাব্য তারিখ
                        </label>
                        <input
                          type="date"
                          value={editDuePromiseDate}
                          onChange={(e) => setEditDuePromiseDate(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-slate-900 border border-rose-500/40 rounded-lg text-white"
                        />
                      </div>
                    )}

                    {/* Payment Method */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        পেমেন্ট মাধ্যম
                      </label>
                      <select
                        value={editMethod}
                        onChange={(e) => setEditMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white"
                      >
                        <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                        <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                        <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        মেমো নোট বা মন্তব্য
                      </label>
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={onCloseEditModal}
                        className="px-4 py-2.5 text-xs font-semibold bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={submittingEdit}
                        className="px-5 py-2.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-xl cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {submittingEdit ? 'আপডেট হচ্ছে...' : 'মেমো আপডেট সংরক্ষণ করুন'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 4. DELETE CONFIRMATION POPUP MODAL */}
      {deleteTargetMemo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-memo-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseDeleteModal();
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-modal-backdrop"
        >
          <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-modal-pop">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-5 h-5" />
                <h3 id="delete-memo-modal-title" className="text-base font-bold">
                  মেমো মুছে ফেলার নিশ্চিতকরণ ({deleteTargetMemo.memoNo})
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseDeleteModal}
                className="w-8 h-8 rounded-lg bg-rose-700 hover:bg-rose-800 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                আপনি কি নিশ্চিত যে <strong>{deleteTargetMemo.customerName}</strong>-এর মেমো{' '}
                <strong>{deleteTargetMemo.memoNo}</strong> মুছে ফেলতে চান? মেমোটি মুছে ফেললে বিক্রিত ইটের পরিমাণ পুনরায় স্টকে যোগ হবে।
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onCloseDeleteModal}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  না, রাখুন
                </button>
                <button
                  type="button"
                  disabled={submittingDelete}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                >
                  {submittingDelete ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মেমো ডিলিট করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
