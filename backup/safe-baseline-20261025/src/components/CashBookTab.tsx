import React, { useEffect, useState } from 'react';
import { Download, Edit3, PlusCircle, Trash2, X } from 'lucide-react';
import type { CashTransaction, CashTxType, PaymentMethod } from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';

interface CashBookTabProps {
  cashTransactions: CashTransaction[];
  externalTypeFilter?: 'ALL' | 'IN' | 'OUT';
  externalCategoryFilter?: string;
  onAddCashTx: (payload: {
    type: CashTxType;
    category: string;
    amount: number;
    description: string;
    paymentMethod: PaymentMethod;
  }) => Promise<void>;
  onUpdateCashTx?: (
    id: string,
    payload: {
      type?: CashTxType;
      category?: string;
      amount?: number;
      description?: string;
      paymentMethod?: PaymentMethod;
      date?: string;
    }
  ) => Promise<void>;
  onDeleteCashTx: (id: string) => Promise<void>;
}

export const CashBookTab: React.FC<CashBookTabProps> = ({
  cashTransactions,
  externalTypeFilter,
  externalCategoryFilter,
  onAddCashTx,
  onUpdateCashTx,
  onDeleteCashTx,
}) => {
  const [cashTypeFilter, setCashTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    if (externalTypeFilter) {
      setCashTypeFilter(externalTypeFilter);
    }
  }, [externalTypeFilter]);

  useEffect(() => {
    if (externalCategoryFilter) {
      setCategoryFilter(externalCategoryFilter);
    }
  }, [externalCategoryFilter]);

  // Form State
  const [txType, setTxType] = useState<CashTxType>('OUT');
  const [category, setCategory] = useState<string>('কয়লা ক্রয়');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [submitting, setSubmitting] = useState(false);

  // Edit Transaction Modal State
  const [editTarget, setEditTarget] = useState<CashTransaction | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [editDate, setEditDate] = useState<string>('');

  // Safe Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<CashTransaction | null>(null);

  const filteredTx = cashTransactions.filter((t) => {
    if (cashTypeFilter !== 'ALL' && t.type !== cashTypeFilter) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    return true;
  });

  const sumIn = filteredTx
    .filter((t) => t.type === 'IN')
    .reduce((s, t) => s + t.amount, 0);
  const sumOut = filteredTx
    .filter((t) => t.type === 'OUT')
    .reduce((s, t) => s + t.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setSubmitting(true);
    try {
      await onAddCashTx({
        type: txType,
        category,
        amount: amt,
        description: description.trim() || `${category} বাবদ এন্ট্রি`,
        paymentMethod,
      });
      setAmount('');
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (tx: CashTransaction) => {
    setEditTarget(tx);
    setEditCategory(tx.category);
    setEditAmount(String(tx.amount));
    setEditDescription(tx.description);
    setEditPaymentMethod(tx.paymentMethod || 'নগদ ক্যাশ');
    setEditDate(tx.date);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !onUpdateCashTx) return;
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await onUpdateCashTx(editTarget.id, {
      category: editCategory.trim() || editTarget.category,
      amount: amt,
      description: editDescription.trim(),
      paymentMethod: editPaymentMethod,
      date: editDate,
    });
    setEditTarget(null);
  };

  const handleExportCsv = () => {
    const headers = ['Date,Type,Category,Amount,PaymentMethod,Description'];
    const rows = filteredTx.map(
      (t) =>
        `${t.date},${t.type},"${t.category}",${t.amount},"${t.paymentMethod}","${t.description.replace(
          /"/g,
          '""'
        )}"`
    );
    const csv = '\uFEFF' + [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brickflow-cashbook-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueCategories = Array.from(new Set(cashTransactions.map((t) => t.category)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Cash Book Entry Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-stone-200 rounded-xl p-5 space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-amber-700" />
            <h2 className="text-base font-bold text-slate-900">
              ক্যাশ বুকে নতুন জমা বা খরচ এন্ট্রি
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cb-type-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                লেনদেনের ধরন
              </label>
              <select
                id="cb-type-select"
                value={txType}
                onChange={(e) => {
                  const val = e.target.value as CashTxType;
                  setTxType(val);
                  setCategory(val === 'IN' ? 'অন্যান্য জমা' : 'কয়লা ক্রয়');
                }}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="OUT">খরচ (Cash Out)</option>
                <option value="IN">জমা (Cash In)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="cb-category-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                খাত (Category)
              </label>
              <select
                id="cb-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
              >
                {txType === 'OUT' ? (
                  <>
                    <option value="কয়লা ক্রয়">কয়লা ক্রয়</option>
                    <option value="ভেকু ও ডিজেল">ভেকু ও ডিজেল</option>
                    <option value="মাটি ক্রয়">মাটি ক্রয়</option>
                    <option value="শ্রমিক ও সর্দার পেমেন্ট">শ্রমিক ও সর্দার পেমেন্ট</option>
                    <option value="বিদ্যুৎ ও জ্বালানি">বিদ্যুৎ ও জ্বালানি</option>
                    <option value="অফিস ও আপ্যায়ন">অফিস ও আপ্যায়ন</option>
                    <option value="অন্যান্য খরচ">অন্যান্য খরচ</option>
                  </>
                ) : (
                  <>
                    <option value="ইট বিক্রয় আদায়">ইট বিক্রয় আদায়</option>
                    <option value="বাকি আদায়">বাকি আদায়</option>
                    <option value="অন্যান্য জমা">অন্যান্য জমা</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cb-amount-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                টাকার পরিমাণ (৳) *
              </label>
              <input
                id="cb-amount-input"
                type="number"
                min={1}
                required
                placeholder="যেমন: 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="cb-method-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                পেমেন্ট মাধ্যম
              </label>
              <select
                id="cb-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="cb-desc-input"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              বিবরণ / ভাউচার নোট
            </label>
            <input
              id="cb-desc-input"
              type="text"
              placeholder="খরচ বা জমার সংক্ষিপ্ত বিবরণ লিখুন..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors cursor-pointer"
          >
            {submitting ? 'যুক্ত হচ্ছে...' : 'ক্যাশ বুকে সংরক্ষণ করুন'}
          </button>
        </form>

        {/* Cash Book Filter & Summary Panel */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ক্যাশ বুক খতিয়ান ও ফিল্টার
              </h2>
              <p className="text-xs text-slate-500">
                ভাটার প্রতিদিনের জমা (In) ও খরচ (Out)-এর পূর্ণাঙ্গ ও ভেরিফায়েড হিসাব
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-stone-100 text-slate-800 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              id="cashTypeFilter"
              className="inline-flex p-1 bg-stone-100 rounded-lg"
            >
              {(
                [
                  { id: 'ALL', label: 'সকল লেনদেন' },
                  { id: 'IN', label: 'শুধু জমা (Cash In)' },
                  { id: 'OUT', label: 'শুধু খরচ (Cash Out)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCashTypeFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    cashTypeFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="খাত অনুযায়ী ক্যাশ বুক ফিল্টার"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg"
            >
              <option value="ALL">সকল খাত (All Categories)</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-stone-100">
            <div>
              <span className="text-xs text-slate-500 block">ফিল্টারকৃত মোট জমা (In)</span>
              <span className="text-lg font-bold text-emerald-700 tabular-nums">
                {formatCurrencyBn(sumIn)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">ফিল্টারকৃত মোট খরচ (Out)</span>
              <span className="text-lg font-bold text-rose-700 tabular-nums">
                {formatCurrencyBn(sumOut)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">নিট ক্যাশ প্রবাহ</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrencyBn(sumIn - sumOut)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Transactions Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 text-slate-800">
                <th className="py-3 px-4 font-semibold">তারিখ</th>
                <th className="py-3 px-4 font-semibold">ধরন (In/Out)</th>
                <th className="py-3 px-4 font-semibold">খাত (Category)</th>
                <th className="py-3 px-4 font-semibold">বিবরণ</th>
                <th className="py-3 px-4 font-semibold">পেমেন্ট মাধ্যম</th>
                <th className="py-3 px-4 font-semibold text-right">টাকার পরিমাণ</th>
                <th className="py-3 px-4 font-semibold text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredTx.map((tx) => (
                <tr key={tx.id} className="hover:bg-stone-50/80">
                  <td className="py-3 px-4 tabular-nums text-slate-700">{tx.date}</td>
                  <td className="py-3 px-4 font-semibold">
                    {tx.type === 'IN' ? (
                      <span className="text-emerald-700">জমা (IN)</span>
                    ) : (
                      <span className="text-rose-700">খরচ (OUT)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{tx.category}</td>
                  <td className="py-3 px-4 text-slate-700">{tx.description}</td>
                  <td className="py-3 px-4 text-slate-600">{tx.paymentMethod}</td>
                  <td
                    className={`py-3 px-4 text-right font-bold tabular-nums ${
                      tx.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {tx.type === 'IN' ? '+' : '-'}
                    {formatCurrencyBn(tx.amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      {onUpdateCashTx && (
                        <button
                          type="button"
                          onClick={() => openEditModal(tx)}
                          aria-label={`${tx.category} লেনদেন এডিট করুন`}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        aria-label={`${tx.category} ${tx.amount} লেনদেন ডিলিট করুন`}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-100 border-t-2 border-stone-300 font-bold text-slate-900">
                <td colSpan={5} className="py-3 px-4 text-right">
                  সর্বমোট ({formatBn(filteredTx.length)}টি লেনদেন):
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatCurrencyBn(sumIn - sumOut)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Edit Cash Transaction Modal */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-cash-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmEdit}
            className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 id="edit-cash-modal-title" className="text-base font-bold text-slate-900">
                ক্যাশ বুক এন্ট্রি সংশোধন ({editTarget.type === 'OUT' ? 'খরচ' : 'জমা'})
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="সংশোধন মডাল বন্ধ করুন"
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  খাত (Category) *
                </label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  তারিখ
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  পেমেন্ট মাধ্যম
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                >
                  <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                  <option value="বিকাশ / নগদ অ্যাপ">বিকাশ / নগদ অ্যাপ</option>
                  <option value="ব্যাংক চেক / ট্রান্সফার">ব্যাংক চেক / ট্রান্সফার</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                বিবরণ / ভাউচার নোট
              </label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-xs font-medium bg-stone-100 text-slate-700 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800 cursor-pointer"
              >
                আপডেট সেভ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-rose-800">
              ক্যাশ বুক এন্ট্রি ডিলিট কনফার্মেশন
            </h3>
            <p className="text-sm text-slate-700">
              আপনি কি নিশ্চিতভাবে <strong>{deleteTarget.category}</strong> খাতের{' '}
              <strong>{formatCurrencyBn(deleteTarget.amount)}</strong> লেনদেনটি মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium bg-stone-100 text-slate-700 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteCashTx(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-700 text-white rounded-lg hover:bg-rose-800 cursor-pointer"
              >
                হ্যাঁ, ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
