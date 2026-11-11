import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  KeyRound,
  Lock,
  MessageCircle,
  Send,
  ShieldAlert,
  Smartphone,
  Unlock,
  X,
} from 'lucide-react';
import type { DashboardMetrics, KilnDatabaseState, LanguageMode } from '../types/kiln';
import { buildDailyWhatsAppClosingSummary } from '../utils/enterpriseOperationsLogic';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

interface PWAInstallAndRoleBarProps {
  lang: LanguageMode;
  roleMode: 'OWNER' | 'MUNSHI';
  ownerPin: string;
  onChangeRoleMode: (nextRole: 'OWNER' | 'MUNSHI') => void;
  onChangeOwnerPin: (newPin: string) => void;
  dbState: KilnDatabaseState;
  metrics: DashboardMetrics;
}

export const PWAInstallAndRoleBar: React.FC<PWAInstallAndRoleBarProps> = ({
  lang,
  roleMode,
  ownerPin,
  onChangeRoleMode,
  onChangeOwnerPin,
  dbState,
  metrics,
}) => {
  const isEn = lang === 'en';
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const summaryText = buildDailyWhatsAppClosingSummary(dbState, metrics, lang);
  const whatsappShareHref = `https://wa.me/8801913678010?text=${encodeURIComponent(summaryText)}`;

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowInstallGuide(true);
    }
  };

  const handleVerifyOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === ownerPin) {
      onChangeRoleMode('OWNER');
      setPinInput('');
      setPinError('');
      setShowPinModal(false);
    } else {
      setPinError(
        isEn
          ? 'Incorrect 4-digit PIN. Default PIN is 1234.'
          : 'ভুল পিন নম্বর! সঠিক ৪-ডিজিট মালিক পিন দিন (ডিফল্ট: 1234)।'
      );
    }
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.trim().length < 4) {
      setPinError(isEn ? 'Enter at least 4 digits.' : 'কমপক্ষে ৪ ডিজিটের নতুন পিন দিন।');
      return;
    }
    onChangeOwnerPin(newPinInput.trim());
    setNewPinInput('');
    setPinError('');
    setShowPinModal(false);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <>
      <div className="space-y-2">
        {/* Owner vs Munshi Role Mode Switcher */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                roleMode === 'OWNER'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
              }`}
            >
              {roleMode === 'OWNER' ? (
                <Unlock className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-white truncate">
                {roleMode === 'OWNER'
                  ? isEn
                    ? 'Owner Mode (Unlocked)'
                    : 'মালিক মোড (সক্রিয়)'
                  : isEn
                  ? 'Munshi Mode (Protected)'
                  : 'মুন্সি মোড (লক করা)'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {roleMode === 'OWNER'
                  ? isEn
                    ? 'Full access to edit & delete'
                    : 'সকল এডিট ও ডিলিট অনুমোদিত'
                  : isEn
                  ? 'Delete locked by Owner PIN'
                  : 'মেমো ও খাতা ডিলিট লক করা'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {roleMode === 'OWNER' ? (
              <>
                <button
                  type="button"
                  onClick={() => onChangeRoleMode('MUNSHI')}
                  data-testid="switch-to-munshi-mode-btn"
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-bold cursor-pointer transition-colors"
                >
                  {isEn ? 'Lock Munshi' : 'মুন্সি লক'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinError('');
                    setShowPinModal(true);
                  }}
                  title={isEn ? 'Change Owner PIN' : 'মালিক পিন পরিবর্তন'}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPinError('');
                  setPinInput('');
                  setShowPinModal(true);
                }}
                data-testid="unlock-owner-mode-btn"
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
              >
                {isEn ? 'Unlock PIN' : 'মালিক পিন'}
              </button>
            )}
          </div>
        </div>

        {/* 1-Click Daily Closing Summary & PWA Install Action Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            data-testid="open-daily-whatsapp-summary-btn"
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-green-950/80 hover:bg-green-900/90 border border-green-700/70 text-green-200 text-[11px] font-bold cursor-pointer transition-colors truncate"
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span className="truncate">
              {isEn ? 'Daily Summary' : 'দৈনিক সামারি মেসেজ'}
            </span>
          </button>

          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              data-testid="pwa-install-app-btn"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-orange-950/80 hover:bg-orange-900/90 border border-orange-700/70 text-orange-200 text-[11px] font-bold cursor-pointer transition-colors truncate"
            >
              <Smartphone className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="truncate">
                {isEn ? 'Install App' : 'অ্যাপ ইনস্টল'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Owner PIN Unlock / Change Modal */}
      {showPinModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 border-t-4 border-t-amber-600 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {roleMode === 'MUNSHI'
                    ? isEn
                      ? 'Unlock Owner Mode (PIN)'
                      : 'মালিক মোড আনলক করুন'
                    : isEn
                    ? 'Update Owner Security PIN'
                    : 'মালিক সিকিউরিটি পিন পরিবর্তন'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {roleMode === 'MUNSHI' ? (
              <form onSubmit={handleVerifyOwnerPin} className="space-y-3">
                <p className="text-xs text-slate-600">
                  {isEn
                    ? 'Enter the 4-digit Owner PIN to enable deleting memos, editing ledgers, and full admin controls (Default: 1234).'
                    : 'মেমো ডিলিট ও সম্পূর্ণ অ্যাডমিন নিয়ন্ত্রণ চালু করতে ৪-ডিজিটের মালিক পিন লিখুন (ডিফল্ট পিন: 1234)।'}
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder={isEn ? 'Enter 4-digit PIN (1234)' : '৪-ডিজিট পিন দিন (1234)'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-center text-base font-extrabold tracking-widest bg-white text-slate-900 border-2 border-slate-300 rounded-xl focus:border-amber-600"
                />
                {pinError && (
                  <div className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'বাতিল'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Unlock Owner Mode' : 'আনলক করুন'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleUpdatePin} className="space-y-3">
                <p className="text-xs text-slate-600">
                  {isEn
                    ? 'Set a new 4-digit PIN for Owner Mode protection.'
                    : 'মালিক মোড সুরক্ষার জন্য নতুন ৪-ডিজিটের পিন নির্ধারণ করুন।'}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={isEn ? 'New 4-digit PIN' : 'নতুন ৪-ডিজিট পিন লিখুন'}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
                {pinError && <div className="text-xs font-bold text-rose-600">{pinError}</div>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'বাতিল'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Save New PIN' : 'নতুন পিন সেভ করুন'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 1-Click Daily Closing Summary Modal */}
      {showWhatsAppModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 border-t-4 border-t-green-600 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isEn
                    ? '1-Click Daily Closing Report'
                    : '১-ক্লিক আজকের ক্লোজিং সামারি মেসেজ'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
              {summaryText}
            </pre>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isEn ? 'Copied!' : 'কপি হয়েছে!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Copy Report' : 'মেসেজ কপি করুন'}</span>
                  </>
                )}
              </button>

              <a
                href={whatsappShareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isEn ? 'Send to Proprietor' : 'মালিকের নম্বরে পাঠান'}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Guide Modal (for iOS Safari or when browser prompt is manual) */}
      {showInstallGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isEn
                    ? 'Install SBL Bricks App'
                    : 'মোবাইল ও কম্পিউটারে অ্যাপ ইনস্টল'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                <p>
                  {isEn
                    ? '1. Tap the Share button in your Safari browser toolbar.'
                    : '১. আপনার সাফারি ব্রাউজারের নিচের শেয়ার বাটনে ট্যাপ করুন।'}
                </p>
                <p>
                  {isEn
                    ? '2. Scroll down and select "Add to Home Screen" to install offline.'
                    : '২. নিচে স্ক্রল করে "হোম স্ক্রিনে যুক্ত করুন" অপশনে ট্যাপ করলে অ্যাপ হিসেবে ইনস্টল হয়ে যাবে।'}
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                <p>
                  {isEn
                    ? '1. Click the Install icon in your browser address bar or browser menu (⋮).'
                    : '1. আপনার ব্রাউজারের অ্যাড্রেস বারের ডান পাশের ইনস্টল আইকন অথবা মেনু (⋮) থেকে "অ্যাপ ইনস্টল করুন" নির্বাচন করুন।'}
                </p>
                <p>
                  {isEn
                    ? '2. Once installed, you can open SBL Sweet Clay Bricks (Babulia, Satkhira) directly from your home screen or desktop even offline.'
                    : '2. ইনস্টল করার পর ইন্টারনেট না থাকলেও সরাসরি হোম স্ক্রিন থেকে SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা) সিস্টেম ব্যবহার করতে পারবেন।'}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              {isEn ? 'Got It' : 'ঠিক আছে'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
