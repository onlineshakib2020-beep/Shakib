import React from 'react';
import {
  Database,
  Download,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  HardDriveDownload,
  RefreshCw,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import { formatBn } from '../utils/kilnLogic';
import type { StoredKilnSnapshot } from '../utils/scheduledBackupLogic';

interface ScheduledBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: StoredKilnSnapshot[];
  autoDailyEnabled: boolean;
  onToggleAutoDaily: (enabled: boolean) => void;
  onTriggerManualSnapshot: (alsoDownloadArchive?: boolean) => Promise<void>;
  onDownloadSnapshot: (snapshot: StoredKilnSnapshot) => void;
  onRestoreFromSnapshot: (snapshot: StoredKilnSnapshot) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
  todayDate: string;
  lastBackupStatusBn: string;
  isSavingSnapshot: boolean;
  recoverableSnapshot: StoredKilnSnapshot | null;
  cloudStatus?: {
    isConnected: boolean;
    isSyncing: boolean;
    lastSyncedAt: string | null;
    errorMessage: string | null;
    totalRecordsInCloud: number;
  };
  onSyncToCloud?: () => Promise<void>;
  onRestoreFromCloud?: () => Promise<void>;
  onRestoreFromFile?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const ScheduledBackupModal: React.FC<ScheduledBackupModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  autoDailyEnabled,
  onToggleAutoDaily,
  onTriggerManualSnapshot,
  onDownloadSnapshot,
  onRestoreFromSnapshot,
  onDeleteSnapshot,
  todayDate,
  lastBackupStatusBn,
  isSavingSnapshot,
  recoverableSnapshot,
  cloudStatus,
  onSyncToCloud,
  onRestoreFromCloud,
  onRestoreFromFile,
}) => {
  if (!isOpen) return null;

  const todaySnapshot = snapshots.find((s) => s.dateKey === todayDate);
  const totalVaultBytes = snapshots.reduce((sum, s) => sum + (s.byteSize || 0), 0);
  const totalVaultKb = Math.max(1, Math.round(totalVaultBytes / 1024));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      data-testid="scheduled-backup-modal"
    >
      <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-emerald-600 max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 text-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                IndexedDB লোকাল ভল্ট + সার্ভার ডেইলি আর্কাইভ সচল
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                স্বয়ংক্রিয় দৈনিক ডাটাবেস স্ন্যাপশট ও সুরক্ষা ভল্ট (Scheduled Daily Backup)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                প্রতিদিনের সম্পূর্ণ ইটভাটা ডাটাবেস স্বয়ংক্রিয়ভাবে আপনার ব্রাউজারের <strong>IndexedDB</strong>-তে এবং ডাউনলোডযোগ্য <strong>JSON আর্কাইভ</strong> হিসেবে সংরক্ষিত থাকে — সেশন রিসেট হলেও কোনো হিসাব হারাবে না।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-scheduled-backup-modal"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Cloud Firebase Firestore Permanent Database Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 border-2 border-blue-500/50 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    গুগল ক্লাউড ফায়ারবেস সক্রিয় (Google Cloud Firestore)
                  </span>
                  {cloudStatus?.lastSyncedAt && (
                    <span className="text-[11px] text-blue-200">
                      সর্বশেষ সিঙ্ক: {cloudStatus.lastSyncedAt}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-black text-white mt-1">
                  স্থায়ী ক্লাউড ডাটাবেস অটো-সেভ সিস্টেম (Zero Data Loss Protection)
                </h3>
                <p className="text-xs text-blue-100/80 mt-0.5 leading-relaxed">
                  আপনার প্রতিটি মেমো ও হিসাব সরাসরি গুগল ক্লাউডের ফায়ারবেস ডাটাবেসে চিরতরে সুরক্ষিত থাকে। ফোন রিস্টার্ট হলেও বা অ্যাপ পুনরায় খুললেও ডাটা কখনো শূন্য হবে না।
                </p>
                {cloudStatus?.totalRecordsInCloud !== undefined && cloudStatus.totalRecordsInCloud > 0 && (
                  <div className="text-[11px] font-bold text-emerald-300 mt-1">
                    ☁️ ক্লাউডে বর্তমান হিসাব সংরক্ষিত: {formatBn(cloudStatus.totalRecordsInCloud)} টি রেকর্ড
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
              {onSyncToCloud && (
                <button
                  type="button"
                  onClick={onSyncToCloud}
                  disabled={cloudStatus?.isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black cursor-pointer shadow-md transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudStatus?.isSyncing ? 'animate-spin' : ''}`} />
                  {cloudStatus?.isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই ক্লাউডে সেভ'}
                </button>
              )}
              {onRestoreFromCloud && (
                <button
                  type="button"
                  onClick={onRestoreFromCloud}
                  disabled={cloudStatus?.isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-200 border border-blue-400/40 text-xs font-black cursor-pointer shadow-md transition disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  ক্লাউড থেকে রিস্টোর
                </button>
              )}
              {onRestoreFromFile && (
                <label
                  data-testid="cloud-card-upload-file-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 text-xs font-black cursor-pointer shadow-md transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>📂 ফাইল থেকে রিস্টোর</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={onRestoreFromFile}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Session Reset Recovery Alert if applicable */}
        {recoverableSnapshot && (
          <div
            className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            data-testid="session-reset-recovery-alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-black text-amber-950">
                  সেশন রিসেট শনাক্ত হয়েছে — ব্রাউজার IndexedDB ভল্টে আগের ডাটা পাওয়া গেছে!
                </div>
                <div className="text-xs text-amber-800 mt-0.5">
                  স্ন্যাপশট তারিখ: <strong>{recoverableSnapshot.dateKey}</strong> · মোট রেকর্ড:{' '}
                  <strong>{formatBn(recoverableSnapshot.summary.totalRecordsCount)} টি</strong> (মেমো:{' '}
                  {formatBn(recoverableSnapshot.summary.memoCount)} টি, ক্যাশ লেনদেন:{' '}
                  {formatBn(recoverableSnapshot.summary.cashTxCount)} টি)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestoreFromSnapshot(recoverableSnapshot)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shrink-0 cursor-pointer shadow-sm"
            >
              ১ ক্লিকে সম্পূর্ণ ডাটা রিস্টোর করুন
            </button>
          </div>
        )}

        {/* Status & Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">আজকের স্ন্যাপশট স্ট্যাটাস</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-base font-black text-slate-950 mt-1">
              {todaySnapshot ? 'আজকের ব্যাকআপ সংরক্ষিত' : 'প্রস্তুত হচ্ছে...'}
            </div>
            <div className="text-[11px] text-emerald-800 font-semibold mt-1">
              {lastBackupStatusBn}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">IndexedDB সংরক্ষিত স্ন্যাপশট</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-base font-black text-slate-950 mt-1">
              {formatBn(snapshots.length)} টি স্ন্যাপশট ({formatBn(totalVaultKb)} KB)
            </div>
            <div className="text-[11px] font-medium text-slate-700 mt-1">
              সর্বোচ্চ ৩০ দিনের ইতিহাস ব্রাউজারে সংরক্ষিত থাকে
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">
                স্বয়ংক্রিয় ডেইলি ব্যাকআপ ট্রিগার
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoDailyEnabled}
                data-testid="toggle-auto-daily-backup"
                onClick={() => onToggleAutoDaily(!autoDailyEnabled)}
                className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition ${
                  autoDailyEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-300 text-slate-800'
                }`}
              >
                {autoDailyEnabled ? 'চালু (ON)' : 'বন্ধ (OFF)'}
              </button>
            </div>
            <div className="text-[11px] text-emerald-800 mt-2">
              চালু থাকলে প্রতিদিন এবং প্রতিবার হিসাব আপডেটের সাথে সাথে ব্রাউজারের IndexedDB ভল্টে অটো-সেভ হবে।
            </div>
          </div>
        </div>

        {/* Manual Trigger Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 text-white">
          <div>
            <div className="text-sm font-bold text-white">
              তাৎক্ষণিক স্ন্যাপশট ও ডাউনলোডযোগ্য JSON আর্কাইভ
            </div>
            <div className="text-xs text-slate-200">
              যেকোনো সময় ১ ক্লিকে ব্রাউজারের IndexedDB-তে নতুন স্ন্যাপশট নিন অথবা কম্পিউটার/মোবাইলে JSON ফাইল ডাউনলোড করে রাখুন।
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSavingSnapshot}
              data-testid="trigger-manual-indexeddb-snapshot"
              onClick={() => onTriggerManualSnapshot(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isSavingSnapshot ? 'animate-spin' : ''}`} />
              + এখনই স্ন্যাপশট নিন (IndexedDB)
            </button>
            <button
              type="button"
              disabled={isSavingSnapshot}
              data-testid="trigger-snapshot-and-download"
              onClick={() => onTriggerManualSnapshot(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer transition shadow-sm"
            >
              <HardDriveDownload className="w-4 h-4" />
              স্ন্যাপশট + JSON আর্কাইভ ডাউনলোড
            </button>
            {onRestoreFromFile && (
              <label
                data-testid="trigger-upload-json-backup-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black cursor-pointer transition shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>📂 এক্সপোর্ট ফাইল ইমপোর্ট করুন</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={onRestoreFromFile}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Saved Snapshots Table */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-slate-950">
            ব্রাউজার IndexedDB-তে সংরক্ষিত স্ন্যাপশট তালিকা ({formatBn(snapshots.length)} টি)
          </h3>

          <div className="overflow-x-auto max-h-80 border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-900 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 font-bold">তারিখ ও স্ন্যাপশট বিবরণ</th>
                  <th className="py-2.5 px-3 font-bold">ট্রিগার ধরন</th>
                  <th className="py-2.5 px-3 font-bold">সংরক্ষিত ডাটা সারাংশ</th>
                  <th className="py-2.5 px-3 text-right font-bold">সাইজ ও চেকসাম</th>
                  <th className="py-2.5 px-3 text-center font-bold">ডাউনলোড / রিস্টোর</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center font-medium text-slate-700">
                      IndexedDB ভল্টে এখনো কোনো স্ন্যাপশট নেই। উপরে “+ এখনই স্ন্যাপশট নিন” বাটনে ক্লিক করুন।
                    </td>
                  </tr>
                ) : (
                  snapshots.map((snap) => (
                    <tr
                      key={snap.id}
                      className="hover:bg-slate-50/80"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-black text-slate-950">
                          {snap.labelBn}
                        </div>
                        <div className="text-[11px] font-medium text-slate-700">
                          সময়: {new Date(snap.createdAt).toLocaleString('bn-BD')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            snap.triggerType === 'MANUAL'
                              ? 'bg-amber-100 text-amber-800'
                              : snap.triggerType === 'AUTO_ON_CHANGE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {snap.triggerType === 'MANUAL'
                            ? 'ম্যানুয়াল'
                            : snap.triggerType === 'AUTO_ON_CHANGE'
                            ? 'রিয়েল-টাইম অটো'
                            : 'দৈনিক শিডিউলড'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-950">
                          মোট রেকর্ড: {formatBn(snap.summary?.totalRecordsCount || 0)} টি
                        </div>
                        <div className="text-[11px] font-medium text-slate-700">
                          মেমো: {formatBn(snap.summary?.memoCount || 0)} · ক্যাশ:{' '}
                          {formatBn(snap.summary?.cashTxCount || 0)} · উৎপাদন ও অন্যান্য:{' '}
                          {formatBn(
                            (snap.summary?.productionRecordsCount || 0) +
                              (snap.summary?.advancedLedgerRecordsCount || 0)
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-bold text-slate-950">
                          {formatBn(Math.max(1, Math.round((snap.byteSize || 0) / 1024)))} KB
                        </div>
                        <div className="text-[10px] font-mono font-semibold text-slate-700">
                          #{snap.checksum}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onDownloadSnapshot(snap)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                            title="JSON আর্কাইভ ডাউনলোড"
                          >
                            <Download className="w-3.5 h-3.5 text-orange-600" />
                            JSON ডাউনলোড
                          </button>
                          <button
                            type="button"
                            onClick={() => onRestoreFromSnapshot(snap)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                            title="এই স্ন্যাপশট থেকে ডাটা রিস্টোর করুন"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            রিস্টোর
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSnapshot(snap.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer note */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ব্রাউজার IndexedDB স্ন্যাপশট অফলাইনেও কাজ করে এবং সার্ভার রিস্টার্ট থেকে সম্পূর্ণ স্বাধীন।
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
