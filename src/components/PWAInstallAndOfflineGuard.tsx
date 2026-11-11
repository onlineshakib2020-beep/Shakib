import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { KilnDatabaseState } from '../types/kiln';
import { formatBn } from '../utils/kilnLogic';
import {
  getPhoneVaultStatusInfo,
  saveMasterStateToPhoneStorage,
  type PhoneVaultStatusInfo,
} from '../utils/offlineLocalDatabaseEngine';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      return true;
    }
    return false;
  };

  return { isInstallable, isInstalled, promptInstall };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface PhoneLocalBackupStatusBarProps {
  dbState: KilnDatabaseState;
  savedSnapshotsCount: number;
  onOpenPhoneAppModal: () => void;
  onOpenBackupVault: () => void;
  onExportDatabase: () => void;
  isEn?: boolean;
}

export const PhoneLocalBackupStatusBar: React.FC<PhoneLocalBackupStatusBarProps> = ({
  dbState,
  savedSnapshotsCount,
  onOpenPhoneAppModal,
  onOpenBackupVault,
  onExportDatabase,
  isEn = false,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [vaultInfo, setVaultInfo] = useState<PhoneVaultStatusInfo>(() =>
    getPhoneVaultStatusInfo(dbState)
  );

  useEffect(() => {
    setVaultInfo(getPhoneVaultStatusInfo(dbState));
  }, [dbState]);

  useEffect(() => {
    const handleUpdate = () => {
      setVaultInfo(getPhoneVaultStatusInfo(dbState));
    };
    window.addEventListener('sbl-phone-vault-updated', handleUpdate);
    return () => {
      window.removeEventListener('sbl-phone-vault-updated', handleUpdate);
    };
  }, [dbState]);

  const formattedLastSaved = vaultInfo.lastSavedAt
    ? new Date(vaultInfo.lastSavedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : null;

  return (
    <div
      data-testid="phone-local-backup-status-bar"
      className={`px-3 sm:px-6 py-1.5 border-b transition-colors flex flex-wrap items-center justify-between gap-2 text-xs ${
        isOnline
          ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-emerald-100 border-emerald-500/40'
          : 'bg-gradient-to-r from-amber-950 via-orange-950 to-rose-950 text-amber-100 border-amber-400/70'
      }`}
    >
      {/* Left: Live Local Storage & Connectivity Indicator */}
      <div className="flex items-center gap-2 min-w-0">
        {isOnline ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-[10px] shrink-0">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>{isEn ? 'AUTO-SAVE ON' : 'ফোনে অটো-সেভ চালু'}</span>
          </span>
        ) : (
          <span
            data-testid="offline-mode-active-badge"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] shrink-0 animate-pulse"
          >
            <WifiOff className="w-3 h-3 text-slate-950" />
            <span>{isEn ? 'OFFLINE LOCAL SAVE' : 'অফলাইন মোড (ফোনের মেমোরিতে সেভ হচ্ছে)'}</span>
          </span>
        )}

        <span
          data-testid="phone-local-saved-records-count"
          className="text-[11px] sm:text-xs font-extrabold text-white truncate"
        >
          {isOnline ? (
            isEn ? (
              `Phone Local Memory Protected: ${formatBn(vaultInfo.totalRecordsCount)} records saved`
            ) : (
              <>
                ফোনের লোকাল মেমোরিতে{' '}
                <strong className="text-amber-300 font-black">
                  {formatBn(vaultInfo.totalRecordsCount)}টি হিসাব
                </strong>{' '}
                অটোমেটিক সংরক্ষিত আছে
                {formattedLastSaved ? (
                  <span className="hidden md:inline text-emerald-300/90 font-semibold ml-1.5">
                    (সর্বশেষ সেভ: {formattedLastSaved})
                  </span>
                ) : null}
              </>
            )
          ) : isEn ? (
            `No Internet — Saving directly to Phone Memory (${formatBn(vaultInfo.totalRecordsCount)} records safe)`
          ) : (
            <>
              ইন্টারনেট নেই — তবুও আপনার সব এন্ট্রি সরাসরি ফোনের মেমোরিতে সেভ হচ্ছে (
              <strong className="text-amber-300 font-black">
                {formatBn(vaultInfo.totalRecordsCount)}টি হিসাব সুরক্ষিত
              </strong>
              )
            </>
          )}
        </span>
      </div>

      {/* Right: Quick Action Buttons for Phone App Install & 1-Click Local File Download */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isInstallable && !isInstalled && (
          <button
            type="button"
            data-testid="direct-pwa-install-banner-btn"
            onClick={() => {
              void promptInstall();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-[11px] shadow-xs cursor-pointer transition-all"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Install App Now' : '📲 ১-ক্লিকে অ্যাপ ইনস্টল'}</span>
          </button>
        )}

        <button
          type="button"
          data-testid="open-phone-app-backup-modal-btn"
          onClick={onOpenPhoneAppModal}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/60 text-amber-200 font-black text-[11px] cursor-pointer transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            {isEn
              ? 'Phone App & Local Backup'
              : '📲 ফোনে অ্যাপ ও লোকাল ডাটা গার্ড'}
          </span>
        </button>

        <button
          type="button"
          data-testid="quick-download-phone-backup-btn"
          onClick={onExportDatabase}
          title={
            isEn
              ? 'Download Backup File to Phone Storage'
              : 'ফোনের ডাউনলোড ফোল্ডারে ব্যাকআপ ফাইল সেভ করুন'
          }
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-100 font-black text-[11px] cursor-pointer transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          <span className="hidden sm:inline">
            {isEn ? 'Save Backup to Phone' : 'ফোনে ব্যাকআপ ডাউনলোড'}
          </span>
          <span className="sm:hidden">{isEn ? 'Save' : 'ব্যাকআপ'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenBackupVault}
          className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[10px] cursor-pointer transition-colors"
        >
          <HardDrive className="w-3 h-3 text-teal-400 shrink-0" />
          <span>
            {isEn
              ? `Snapshots (${formatBn(savedSnapshotsCount)})`
              : `ভল্ট (${formatBn(savedSnapshotsCount)})`}
          </span>
        </button>
      </div>
    </div>
  );
};

interface PWAInstallAndOfflineGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbState: KilnDatabaseState;
  savedSnapshotsCount: number;
  onExportDatabase: () => void;
  onRestoreDatabase: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenScheduledVault: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PWAInstallAndOfflineGuardModal: React.FC<
  PWAInstallAndOfflineGuardModalProps
> = ({
  isOpen,
  onClose,
  dbState,
  savedSnapshotsCount,
  onExportDatabase,
  onRestoreDatabase,
  onOpenScheduledVault,
  onShowToast,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [vaultInfo, setVaultInfo] = useState<PhoneVaultStatusInfo>(() =>
    getPhoneVaultStatusInfo(dbState)
  );

  useEffect(() => {
    if (isOpen) {
      setVaultInfo(getPhoneVaultStatusInfo(dbState));
    }
  }, [isOpen, dbState]);

  if (!isOpen) return null;

  const handleForceLocalSaveNow = () => {
    const summary = saveMasterStateToPhoneStorage(dbState);
    setVaultInfo(getPhoneVaultStatusInfo(dbState));
    onShowToast(
      `ফোনের লোকাল মেমোরিতে সম্পূর্ণ ডাটাবেস (${formatBn(
        summary.totalRecordsCount
      )}টি হিসাব) তাৎক্ষণিক সেভ করা হয়েছে!`
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="phone-app-backup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white border-2 border-emerald-500/60 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 text-white flex items-start justify-between gap-3 border-b border-emerald-500/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>১০০% অফলাইন ও লোকাল মেমোরি সুরক্ষা</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                ফোনে অ্যাপ ইনস্টল ও অটো-সেভ লোকাল ডাটা ভল্ট
              </h2>
              <p className="text-xs text-emerald-200/90 font-medium">
                নেট চলে গেলেও আপনার কোনো হিসাব মুছবে না — ফোনের মেমোরিতে অটোমেটিক সেভ থাকবে
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="close-phone-app-backup-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto text-slate-900">
          {/* Live Status Banner */}
          <div
            className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isOnline
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-400 text-amber-950'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black">
                    <Wifi className="w-3 h-3" />
                    অনলাইন + ফোনে অটো-সেভ সক্রিয়
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[11px] font-black">
                    <WifiOff className="w-3 h-3" />
                    অফলাইন মোড (নেট ছাড়া চলছে)
                  </span>
                )}
                <span className="text-xs font-extrabold text-slate-700">
                  ডেইলি স্ন্যাপশট: {formatBn(savedSnapshotsCount)}টি
                </span>
              </div>
              <div className="text-sm font-black text-slate-900">
                ফোনের লোকাল মেমোরিতে বর্তমানে{' '}
                <span className="text-emerald-700 underline">
                  {formatBn(vaultInfo.totalRecordsCount)}টি হিসাব
                </span>{' '}
                স্থায়ীভাবে সংরক্ষিত আছে
              </div>
              <div className="text-xs text-slate-700 font-semibold">
                মেমো: {formatBn(vaultInfo.memoCount)}টি · ক্যাশ লেনদেন:{' '}
                {formatBn(vaultInfo.cashTxCount)}টি · মিল/চুল্লি/সর্দার:{' '}
                {formatBn(vaultInfo.productionRecordsCount)}টি · জ্বালানি/মাটি/দাদন:{' '}
                {formatBn(vaultInfo.advancedLedgerRecordsCount)}টি
              </div>
            </div>

            <button
              type="button"
              data-testid="force-phone-local-save-btn"
              onClick={handleForceLocalSaveNow}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer shrink-0 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>এখনই ফোনে সেভ নিশ্চিত করুন</span>
            </button>
          </div>

          {/* How Offline & Local Storage Protection Works */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>কেন আপনার ডাটা আর কখনোই মুছে বা জিরো (0) হবে না?</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1">
                <div className="font-black text-emerald-800">
                  ১. নেট চলে গেলেও এন্ট্রি হবে
                </div>
                <p className="text-slate-600 leading-relaxed">
                  কাজ করার সময় হঠাৎ ইন্টারনেট চলে গেলেও মেমো, সর্দার পেমেন্ট, মিল বা ক্যাশ এন্ট্রি বন্ধ হবে না—সরাসরি আপনার ফোনের মেমোরিতে সেভ হবে।
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-amber-200 space-y-1">
                <div className="font-black text-amber-800">
                  ২. রিফ্রেশ করলেও জিরো হবে না
                </div>
                <p className="text-slate-600 leading-relaxed">
                  অ্যাপ ওপেন বা রিফ্রেশ করার সাথে সাথে সার্ভারের জন্য অপেক্ষা না করে সরাসরি আপনার ফোনের লোকাল মেমোরি থেকে সব হিসাব লোড হবে।
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-sky-200 space-y-1">
                <div className="font-black text-sky-800">
                  ৩. ডাবল লোকাল ভল্ট (LocalStorage + IndexedDB)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  প্রতিটি হিসাব ফোনের দুই জায়গায় (Permanent Vault ও 30-Day IndexedDB) অটোমেটিক ব্যাকআপ থাকে।
                </p>
              </div>
            </div>
          </div>

          {/* Install as Mobile App (PWA) Section */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50/70 to-white border-2 border-amber-300 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>ফোনে অ্যাপ (Mobile App) হিসেবে ইনস্টল করার নিয়ম</span>
                </h3>
                <p className="text-xs text-slate-700 font-medium">
                  ফোনের হোম স্ক্রিনে অ্যাপ হিসেবে রাখলে ইন্টারনেট ছাড়াই ১ ক্লিকে সরাসরি ওপেন করতে পারবেন।
                </p>
              </div>

              {isInstalled ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>অ্যাপ ইনস্টল করা আছে</span>
                </span>
              ) : isInstallable ? (
                <button
                  type="button"
                  data-testid="modal-pwa-install-btn"
                  onClick={() => {
                    void promptInstall();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-black shadow-md cursor-pointer shrink-0"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>📲 এখনই ফোনে অ্যাপ ইনস্টল করুন</span>
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-orange-200 space-y-1.5">
                <div className="font-black text-slate-900">
                  🤖 Android ফোনে (Chrome ব্রাউজার):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium">
                  <li>
                    Chrome ব্রাউজারের উপরে ডান কোণায় <strong>৩-ডট (⋮) মেনুতে</strong> ট্যাপ করুন।
                  </li>
                  <li>
                    <strong>&quot;Add to Home screen&quot;</strong> অথবা{' '}
                    <strong>&quot;Install app&quot;</strong> অপশনটি সিলেক্ট করুন।
                  </li>
                  <li>
                    <strong>Install / Add</strong> বাটনে চাপ দিলেই আপনার ফোনের স্ক্রিনে{' '}
                    <strong>SBL ইটভাটা</strong> অ্যাপ আইকন চলে আসবে!
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-white border border-orange-200 space-y-1.5">
                <div className="font-black text-slate-900">
                  🍎 iPhone / iPad (Safari ব্রাউজার):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium">
                  <li>
                    Safari ব্রাউজারের নিচে মাঝখানে <strong>Share (⬆️) বাটনে</strong> ট্যাপ করুন।
                  </li>
                  <li>
                    নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> অপশনে ট্যাপ করুন।
                  </li>
                  <li>
                    উপরে ডান কোণায় <strong>Add</strong> চাপলেই ফোনে অ্যাপ হিসেবে সেভ হয়ে যাবে!
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Direct File Download & Restore to Phone Storage */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  ফোনের ডাউনলোড ফোল্ডারে ব্যাকআপ ফাইল সংরক্ষণ ও রিস্টোর
                </h3>
                <p className="text-xs text-slate-600">
                  অটো-সেভ ছাড়াও যেকোনো সময় ১ ক্লিকে আপনার ফোনের মেমোরি কার্ডে বা ফাইল ম্যানেজারে ব্যাকআপ ফাইল ডাউনলোড করে রাখতে পারেন।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                data-testid="modal-download-phone-backup-btn"
                onClick={onExportDatabase}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>ফোনে ব্যাকআপ ডাউনলোড (.JSON)</span>
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-xs cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                <span>ফাইল থেকে ডাটা রিস্টোর করুন</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={onRestoreDatabase}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenScheduledVault();
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-950 text-xs font-black cursor-pointer transition-colors"
              >
                <HardDrive className="w-4 h-4 text-teal-700 shrink-0" />
                <span>৩০ দিনের অটো স্ন্যাপশট ভল্ট ({formatBn(savedSnapshotsCount)})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-600">
            ✓ SBL অফলাইন লোকাল ইঞ্জিন সক্রিয় (LocalStorage + IndexedDB + Service Worker)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
