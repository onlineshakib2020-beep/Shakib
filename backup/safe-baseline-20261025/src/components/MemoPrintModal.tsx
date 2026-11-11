import React from 'react';
import { Printer, Truck, X } from 'lucide-react';
import type { SalesMemo } from '../types/kiln';
import { cleanBrickGradeName, formatBn, formatCurrencyBn } from '../utils/kilnLogic';

interface MemoPrintModalProps {
  memo: SalesMemo | null;
  onClose: () => void;
}

export const MemoPrintModal: React.FC<MemoPrintModalProps> = ({ memo, onClose }) => {
  if (!memo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-print-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-modal-backdrop"
    >
      <div
        id="printable-area"
        className="bg-white border border-stone-300 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-modal-pop"
      >
        {/* Top Action Controls */}
        <div className="no-print px-6 py-4 bg-[#0F172A] text-white border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="memo-print-modal-title" className="text-sm font-bold text-white">
              ডিজিটাল ক্যাশ মেমো ও ডেলিভারি গেটপাস প্রিন্ট প্রিভিউ ({memo.memoNo})
            </h2>
            <p className="text-xs text-slate-300">
              ক্রেতার কপি এবং ভাটার গেটপাস এক পাতায় প্রিন্ট করার জন্য প্রস্তুত
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-orange-600 text-white rounded-xl hover:bg-orange-500 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              প্রিন্ট মেমো ও গেটপাস
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="প্রিন্ট মডাল বন্ধ করুন"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 rounded-xl hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              বন্ধ করুন
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Copy 1: Customer Cash Memo */}
          <div className="border-2 border-stone-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div>
                <p className="text-xs text-slate-600">বিসমিল্লাহির রাহমানির রাহিম · ক্রেতার কপি (Cash Memo)</p>
                <h1 className="text-xl font-bold text-slate-900">
                  সৌদিয়া ট্রেডার্স — SBL মিষ্টি মাটির ইট
                </h1>
                <p className="text-xs text-slate-700">
                  বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা
                </p>
                <p className="text-xs font-medium text-slate-800">
                  প্রোঃ মোঃ কামরুল ইসলাম সাহেব (০১৯১৩-৬৭৮০১০) · পরিচালনায়ঃ সাকিব হোসেন (০১৭২৮-২৮৭০১৮)
                </p>
              </div>
              <div className="text-left sm:text-right tabular-nums">
                <div className="text-sm font-bold text-slate-900">মেমো নং: {memo.memoNo}</div>
                <div className="text-xs text-slate-600">তারিখ: {memo.date}</div>
                <div className="text-xs font-semibold text-amber-900 mt-1">
                  পেমেন্ট: {memo.paymentMethod}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-stone-50 p-3.5 rounded-lg border border-stone-200">
              <div>
                <span className="text-slate-500 text-xs block">ক্রেতার নাম ও মোবাইল:</span>
                <span className="font-semibold text-slate-900">{memo.customerName}</span> ·{' '}
                <span className="tabular-nums text-slate-700">{memo.customerPhone}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">ঠিকানা ও পরিবহন:</span>
                <span className="font-medium text-slate-800">{memo.customerAddress}</span> ·{' '}
                <span className="text-slate-700">
                  {memo.vehicleType || 'ট্রাক'}: {memo.truckNo} ({memo.driverName}
                  {memo.driverPhone && memo.driverPhone !== '—' ? ` · ${memo.driverPhone}` : ''})
                </span>
              </div>
            </div>

            <table className="w-full text-sm border-collapse border border-stone-300">
              <thead>
                <tr className="bg-stone-100 text-slate-800 border-b border-stone-300">
                  <th className="py-2 px-3 text-left font-semibold">ইটের বিবরণ (Brick Type)</th>
                  <th className="py-2 px-3 text-right font-semibold">পরিমাণ (পিস)</th>
                  <th className="py-2 px-3 text-right font-semibold">হাজারে দর (৳)</th>
                  <th className="py-2 px-3 text-right font-semibold">মোট টাকা</th>
                </tr>
              </thead>
              <tbody>
                {(memo.items && memo.items.length > 0
                  ? memo.items
                  : [
                      {
                        id: '1',
                        gradeId: memo.gradeId || '',
                        gradeName: memo.gradeName || '১ নং ইট',
                        quantity: memo.quantity || 0,
                        rate: memo.rate || 11000,
                        ratePerThousand: true,
                        lineTotal: memo.totalAmount || 0,
                      },
                    ]
                ).map((it) => (
                  <tr key={it.id} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {cleanBrickGradeName(it.gradeName)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {formatBn(it.quantity)} পিস
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {formatCurrencyBn(it.rate < 100 ? Math.round(it.rate * 1000) : it.rate)} / হাজার
                    </td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums">
                      {formatCurrencyBn(it.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {memo.discount > 0 && (
                  <tr className="bg-stone-50 border-t border-stone-200 text-slate-700">
                    <td colSpan={3} className="py-1.5 px-3 text-right text-xs">
                      ছাড় (Discount):
                    </td>
                    <td className="py-1.5 px-3 text-right font-medium tabular-nums text-xs">
                      -{formatCurrencyBn(memo.discount)}
                    </td>
                  </tr>
                )}
                <tr className="bg-stone-50 border-t border-stone-300">
                  <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-900">
                    সর্বমোট বিল (Total Bill):
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                    {formatCurrencyBn(memo.totalAmount)}
                  </td>
                </tr>
                <tr className="bg-stone-50 border-t border-stone-300">
                  <td colSpan={3} className="py-2 px-3 text-right font-semibold">
                    নগদ জমা (Paid):
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                    {formatCurrencyBn(memo.paidAmount)}
                  </td>
                </tr>
                <tr className="bg-stone-100 border-t border-stone-300">
                  <td colSpan={3} className="py-2 px-3 text-right font-bold">
                    বাকি পাওনা (Due Balance):
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-rose-700 tabular-nums">
                    {formatCurrencyBn(memo.dueAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {memo.note && (
              <div className="text-xs text-slate-700 bg-stone-50 px-3 py-2 rounded border border-stone-200">
                <span className="font-semibold">নোট / মন্তব্য:</span> {memo.note}
              </div>
            )}

            <div className="pt-6 flex items-center justify-between text-xs text-slate-600">
              <span>ক্রেতার স্বাক্ষর</span>
              <span>লোডিং সর্দারের স্বাক্ষর</span>
              <span>পক্ষে: সৌদিয়া ট্রেডার্স (SBL ইট)</span>
            </div>
          </div>

          {/* Perforated Divider */}
          <div className="border-t-2 border-dashed border-stone-400 relative my-2">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-3 text-xs text-slate-500">
              ✂ ভাটার ডেলিভারি গেটপাস (Gate Pass) ✂
            </span>
          </div>

          {/* Copy 2: Kiln Delivery Gate Pass */}
          <div className="border-2 border-stone-800 rounded-xl p-5 bg-stone-50/50 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-300 pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-800" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    ডেলিভারি গেটপাস — সৌদিয়া ট্রেডার্স (SBL মিষ্টি মাটির ইট, বাবুলিয়া, সাতক্ষীরা)
                  </h3>
                  <p className="text-xs text-slate-600">
                    গেটে দায়িত্বরত প্রহরী ও লোডিং সর্দার মাল মিলিয়ে গাড়ি ছাড়ার অনুমতি দেবেন
                  </p>
                </div>
              </div>
              <div className="text-right tabular-nums text-xs font-bold text-slate-900">
                গেটপাস নং: GP-{memo.memoNo}
                <div className="font-normal text-slate-600">তারিখ: {memo.date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">ক্রেতার নাম:</span>
                <span className="font-semibold text-slate-900">{memo.customerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">গাড়ি / ট্রাক নং:</span>
                <span className="font-semibold text-slate-900">{memo.truckNo}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ড্রাইভারের নাম:</span>
                <span className="font-semibold text-slate-900">{memo.driverName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ডেলিভারির পরিমাণ:</span>
                <span className="font-bold text-amber-900 tabular-nums">
                  {formatBn(
                    memo.items && memo.items.length > 0
                      ? memo.items.reduce((s, it) => s + (it.quantity || 0), 0)
                      : memo.quantity || 0
                  )}{' '}
                  (
                  {memo.items && memo.items.length > 0
                    ? memo.items.map((it) => cleanBrickGradeName(it.gradeName)).join(', ')
                    : cleanBrickGradeName(memo.gradeName || 'ইট')}
                  )
                </span>
              </div>
            </div>

            <div className="pt-5 flex items-center justify-between text-xs text-slate-600">
              <span>ড্রাইভারের স্বাক্ষর</span>
              <span>গেটম্যান / চেকার স্বাক্ষর</span>
              <span>ম্যানেজার অনুমোদন (SBL)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
