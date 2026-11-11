import React from 'react';
import { Printer, Truck, X } from 'lucide-react';
import type { SalesMemo } from '../types/kiln';
import { cleanBrickGradeName, formatBn, formatCurrencyBn } from '../utils/kilnLogic';
import { SblBrandLogo } from './SblBrandLogo';

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
          {/* Copy 1: Customer Cash Memo with Official SBL Watermark & Digital Verification QR */}
          <div className="relative overflow-hidden border-2 border-stone-800 rounded-xl p-5 space-y-4 bg-white">
            {/* Centered SBL Watermark Behind Table */}
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0 opacity-[0.045]"
            >
              <div className="border-8 border-orange-900 rounded-3xl px-10 py-6 -rotate-12 text-center">
                <div className="text-4xl sm:text-5xl font-black tracking-widest text-orange-950">
                  SBL ★ NO. 1 BRICKS
                </div>
                <div className="text-base sm:text-lg font-extrabold text-orange-900 mt-1">
                  SBL মিষ্টি মাটির ইট · বাবুলিয়া, সাতক্ষীরা
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-stone-800 pb-3 gap-3">
              <div className="flex items-center gap-3.5">
                <SblBrandLogo size="md" />
                <div>
                  <p className="text-xs text-slate-600">বিসমিল্লাহির রাহমানির রাহিম · ক্রেতার কপি (Cash Memo)</p>
                  <h1 className="text-xl font-black text-slate-900">
                    SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
                  </h1>
                  <p className="text-xs text-slate-700">
                    বাবুলিয়া, সাতক্ষীরা সদর, সাতক্ষীরা
                  </p>
                  <p className="text-xs font-medium text-slate-800 tabular-nums">
                    প্রোঃ মোঃ কামরুল ইসলাম সাহেব (01913-678010) · পরিচালনায়ঃ সাকিব হোসেন (01728-287018)
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right tabular-nums">
                <div className="text-sm font-bold text-slate-900">মেমো নং: {memo.memoNo}</div>
                <div className="text-xs text-slate-600">তারিখ: {memo.date}</div>
                <div className="text-xs font-semibold text-amber-900 mt-1">
                  পেমেন্ট: {memo.paymentMethod}
                </div>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-stone-50/95 p-3.5 rounded-lg border border-stone-200">
              <div>
                <span className="text-slate-700 font-semibold text-xs block">ক্রেতার নাম ও মোবাইল:</span>
                <span className="font-bold text-slate-950">{memo.customerName}</span> ·{' '}
                <span className="tabular-nums font-semibold text-slate-900">{memo.customerPhone}</span>
              </div>
              <div>
                <span className="text-slate-700 font-semibold text-xs block">ঠিকানা ও পরিবহন:</span>
                <span className="font-bold text-slate-900">{memo.customerAddress}</span> ·{' '}
                <span className="font-semibold text-slate-900">
                  {memo.vehicleType || 'ট্রাক'}: {memo.truckNo} ({memo.driverName}
                  {memo.driverPhone && memo.driverPhone !== '—' ? ` · ${memo.driverPhone}` : ''})
                </span>
              </div>
            </div>

            <table className="relative z-10 w-full text-sm border-collapse border border-stone-300">
              <thead>
                <tr className="bg-stone-100 text-slate-950 border-b border-stone-300">
                  <th className="py-2 px-3 text-left font-bold">ইটের বিবরণ (Brick Type)</th>
                  <th className="py-2 px-3 text-right font-bold">পরিমাণ (পিস)</th>
                  <th className="py-2 px-3 text-right font-bold">হাজারে দর (৳)</th>
                  <th className="py-2 px-3 text-right font-bold">মোট টাকা</th>
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
                    <td className="py-2 px-3 font-bold text-slate-950">
                      {cleanBrickGradeName(it.gradeName)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-950 tabular-nums">
                      {formatBn(it.quantity)} পিস
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-950 tabular-nums">
                      {formatCurrencyBn(it.rate < 100 ? Math.round(it.rate * 1000) : it.rate)} / হাজার
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-slate-950 tabular-nums">
                      {formatCurrencyBn(it.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {memo.discount > 0 && (
                  <tr className="bg-stone-50 border-t border-stone-200 text-slate-900">
                    <td colSpan={3} className="py-1.5 px-3 text-right text-xs font-semibold">
                      ছাড় (Discount):
                    </td>
                    <td className="py-1.5 px-3 text-right font-bold tabular-nums text-xs">
                      -{formatCurrencyBn(memo.discount)}
                    </td>
                  </tr>
                )}
                <tr className="bg-stone-50 border-t border-stone-300">
                  <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-950">
                    সর্বমোট বিল (Total Bill):
                  </td>
                  <td className="py-2 px-3 text-right font-extrabold text-slate-950 tabular-nums">
                    {formatCurrencyBn(memo.totalAmount)}
                  </td>
                </tr>
                <tr className="bg-stone-50 border-t border-stone-300">
                  <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-900">
                    নগদ জমা (Paid):
                  </td>
                  <td className="py-2 px-3 text-right font-extrabold text-emerald-800 tabular-nums">
                    {formatCurrencyBn(memo.paidAmount)}
                  </td>
                </tr>
                <tr className="bg-stone-100 border-t border-stone-300">
                  <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-950">
                    বাকি পাওনা (Due Balance):
                  </td>
                  <td className="py-2 px-3 text-right font-extrabold text-rose-800 tabular-nums">
                    {formatCurrencyBn(memo.dueAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {memo.note && (
              <div className="relative z-10 text-xs text-slate-900 bg-stone-50 px-3 py-2 rounded border border-stone-200">
                <span className="font-bold">নোট / মন্তব্য:</span> {memo.note}
              </div>
            )}

            {/* Digital Verification QR Code + 3 Official Signature Boxes */}
            <div className="relative z-10 pt-5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 bg-stone-50 border border-stone-300 rounded-xl px-3 py-1.5 shrink-0">
                <svg
                  viewBox="0 0 36 36"
                  className="w-10 h-10 text-slate-900 shrink-0"
                  aria-label="SBL Verified Digital Memo QR"
                >
                  <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <rect x="5" y="5" width="4" height="4" fill="currentColor" />
                  <rect x="24" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <rect x="27" y="5" width="4" height="4" fill="currentColor" />
                  <rect x="2" y="24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <rect x="5" y="27" width="4" height="4" fill="currentColor" />
                  <rect x="15" y="4" width="3" height="3" fill="currentColor" />
                  <rect x="19" y="8" width="3" height="3" fill="currentColor" />
                  <rect x="14" y="14" width="8" height="8" rx="1.5" fill="#EA580C" />
                  <rect x="4" y="15" width="4" height="3" fill="currentColor" />
                  <rect x="25" y="15" width="4" height="4" fill="currentColor" />
                  <rect x="15" y="25" width="4" height="4" fill="currentColor" />
                  <rect x="24" y="24" width="4" height="4" fill="currentColor" />
                  <rect x="30" y="29" width="4" height="5" fill="currentColor" />
                </svg>
                <div className="text-[10px] leading-tight space-y-0.5">
                  <div className="font-black text-slate-900 uppercase tracking-wider">
                    SBL VERIFIED MEMO
                  </div>
                  <div className="font-mono font-bold text-orange-800">
                    #{memo.memoNo} · {memo.date}
                  </div>
                  <div className="text-slate-600">বাবুলিয়া, সাতক্ষীরা সদর</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-800 w-full sm:w-auto sm:flex-1 max-w-lg">
                <div className="border-t-2 border-stone-400 pt-1.5">
                  <div className="font-extrabold text-slate-950">ক্রেতার স্বাক্ষর</div>
                  <div className="text-[10px] text-slate-600">ইট বুঝে পাইলাম</div>
                </div>
                <div className="border-t-2 border-stone-400 pt-1.5">
                  <div className="font-extrabold text-slate-950">পরিচালনায়ঃ সাকিব হোসেন</div>
                  <div className="text-[10px] text-slate-600">গেটপাস ও ম্যানেজার</div>
                </div>
                <div className="border-t-2 border-orange-700 pt-1.5">
                  <div className="font-extrabold text-orange-950">প্রোঃ মোঃ কামরুল ইসলাম সাহেব</div>
                  <div className="text-[10px] text-orange-800 font-semibold">SBL মিষ্টি মাটির ইট</div>
                </div>
              </div>
            </div>
          </div>

          {/* Perforated Divider */}
          <div className="border-t-2 border-dashed border-stone-400 relative my-2">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-3 text-xs font-semibold text-slate-700">
              ✂ ভাটার ডেলিভারি গেটপাস (Gate Pass) ✂
            </span>
          </div>

          {/* Copy 2: Kiln Delivery Gate Pass */}
          <div className="border-2 border-stone-800 rounded-xl p-5 bg-stone-50/50 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-300 pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-800" />
                <div>
                  <h3 className="text-base font-bold text-slate-950">
                    ডেলিভারি গেটপাস — SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
                  </h3>
                  <p className="text-xs font-medium text-slate-700">
                    গেটে দায়িত্বরত প্রহরী ও লোডিং সর্দার মাল মিলিয়ে গাড়ি ছাড়ার অনুমতি দেবেন
                  </p>
                </div>
              </div>
              <div className="text-right tabular-nums text-xs font-bold text-slate-950">
                গেটপাস নং: GP-{memo.memoNo}
                <div className="font-semibold text-slate-700">তারিখ: {memo.date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-700 font-semibold block">ক্রেতার নাম:</span>
                <span className="font-bold text-slate-950">{memo.customerName}</span>
              </div>
              <div>
                <span className="text-slate-700 font-semibold block">গাড়ি / ট্রাক নং:</span>
                <span className="font-bold text-slate-950">{memo.truckNo}</span>
              </div>
              <div>
                <span className="text-slate-700 font-semibold block">ড্রাইভারের নাম:</span>
                <span className="font-bold text-slate-950">{memo.driverName}</span>
              </div>
              <div>
                <span className="text-slate-700 font-semibold block">ডেলিভারির পরিমাণ:</span>
                <span className="font-extrabold text-amber-950 tabular-nums">
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

            <div className="pt-5 flex items-center justify-between text-xs font-semibold text-slate-800">
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
