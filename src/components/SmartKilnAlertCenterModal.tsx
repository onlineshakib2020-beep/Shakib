import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  BookmarkCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Flame,
  Layers,
  MessageCircle,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import type { NavigationTab, SalesMemo } from '../types/kiln';
import { formatBn } from '../utils/kilnLogic';
import type {
  KilnAlertCategory,
  KilnAlertSeverity,
  SmartKilnAlertItem,
  SmartKilnAlertReport,
} from '../utils/themeAndEstimatorLogic';

export function getUrgencyStatusMeta(
  severity: KilnAlertSeverity,
  isEn: boolean
) {
  if (severity === 'CRITICAL') {
    return {
      urgencyLabel: isEn ? 'CRITICAL' : 'জরুরি · HIGH',
      shortBadge: isEn ? 'CRITICAL' : 'জরুরি',
      statusText: isEn ? 'Immediate Action Required' : 'আজই জরুরি পদক্ষেপ নিন',
      badgeClass:
        'bg-gradient-to-r from-rose-600 to-red-600 text-white border border-rose-500/80 shadow-2xs',
      pillSubClass: 'bg-rose-50 text-rose-950 border border-rose-200',
      dotColor: 'bg-rose-500',
      pingColor: 'bg-rose-400',
      cardBorderClass:
        'border-rose-200/95 hover:border-rose-400 shadow-2xs',
      iconBoxClass:
        'bg-rose-50 border-rose-200 text-rose-700',
    };
  }
  if (severity === 'WARNING') {
    return {
      urgencyLabel: isEn ? 'WARNING' : 'মাঝারি · MEDIUM',
      shortBadge: isEn ? 'WARNING' : 'মাঝারি',
      statusText: isEn ? 'Needs Attention Soon' : 'দ্রুত নজরদারি প্রয়োজন',
      badgeClass:
        'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border border-amber-500 shadow-2xs',
      pillSubClass: 'bg-amber-50 text-amber-950 border border-amber-200',
      dotColor: 'bg-amber-500',
      pingColor: 'bg-amber-400',
      cardBorderClass:
        'border-amber-200/95 hover:border-amber-400 shadow-2xs',
      iconBoxClass:
        'bg-amber-50 border-amber-200 text-amber-700',
    };
  }
  return {
    urgencyLabel: isEn ? 'NORMAL' : 'রুটিন · INFO',
    shortBadge: isEn ? 'NORMAL' : 'রুটিন',
    statusText: isEn ? 'Scheduled Monitoring' : 'নিয়মিত পর্যবেক্ষণ',
    badgeClass:
      'bg-gradient-to-r from-sky-600 to-cyan-600 text-white border border-sky-700 shadow-2xs',
    pillSubClass: 'bg-sky-50 text-sky-950 border border-sky-200',
    dotColor: 'bg-sky-500',
    pingColor: 'bg-sky-400',
    cardBorderClass:
      'border-slate-200/95 hover:border-slate-300 shadow-2xs',
    iconBoxClass: 'bg-sky-50 border-sky-200 text-sky-700',
  };
}

export function getCategoryStatusBadgeMeta(
  category: KilnAlertCategory,
  isEn: boolean
) {
  switch (category) {
    case 'DUE_TAGADA':
      return {
        label: isEn ? 'Due Tagada' : 'বকেয়া তাগাদা',
        className: 'bg-rose-50/90 text-rose-950 border border-rose-200',
      };
    case 'COAL_FIRING':
      return {
        label: isEn ? 'Coal & Firing' : 'কয়লা ও পোড়াই',
        className: 'bg-orange-50/90 text-orange-950 border border-orange-200',
      };
    case 'BOOKING_DELIVERY':
      return {
        label: isEn ? 'Advance Delivery' : 'অগ্রিম ডেলিভারি',
        className: 'bg-amber-50/90 text-amber-950 border border-amber-200',
      };
    case 'LICENSE_KISTI':
      return {
        label: isEn ? 'License & Kisti' : 'লাইসেন্স ও কিস্তি',
        className: 'bg-emerald-50/90 text-emerald-950 border border-emerald-200',
      };
    case 'STOCK_URGENT':
    default:
      return {
        label: isEn ? 'Stock & Urgent' : 'স্টক ও জরুরি নোট',
        className: 'bg-slate-100 text-slate-900 border border-slate-300',
      };
  }
}

interface SmartKilnAlertBannerStripProps {
  alertReport: SmartKilnAlertReport;
  isEn: boolean;
  onOpenAlertCenter: (focusAlertId?: string) => void;
  onQuickActionAlert: (alert: SmartKilnAlertItem) => void;
  onDismissAlert?: (alertId: string) => void;
}

export const SmartKilnAlertBannerStrip: React.FC<
  SmartKilnAlertBannerStripProps
> = ({
  alertReport,
  isEn,
  onOpenAlertCenter,
  onQuickActionAlert,
  onDismissAlert,
}) => {
  const [copiedBannerWa, setCopiedBannerWa] = useState(false);
  const [resolvingBannerId, setResolvingBannerId] = useState<string | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoSlidePaused, setIsAutoSlidePaused] = useState(false);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  const activeAlerts = alertReport.activeAlerts;
  const safeIndex =
    activeAlerts.length > 0 ? activeIndex % activeAlerts.length : 0;
  const topAlert = activeAlerts[safeIndex] || null;

  // Automatic carousel sliding: cycles one after another every 3.5 seconds without requiring manual dismissal
  useEffect(() => {
    if (activeAlerts.length <= 1 || isAutoSlidePaused || resolvingBannerId) {
      return;
    }
    const timer = setInterval(() => {
      setSlideDirection(1);
      setActiveIndex((prev) => (prev + 1) % activeAlerts.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [activeAlerts.length, isAutoSlidePaused, resolvingBannerId]);

  if (!topAlert) {
    return null;
  }

  const topUrgencyMeta = getUrgencyStatusMeta(topAlert.severity, isEn);
  const isTopResolving = resolvingBannerId === topAlert.id;

  const handleCopyTopAlertWa = () => {
    if (!topAlert.whatsappText) return;
    navigator.clipboard.writeText(topAlert.whatsappText);
    setCopiedBannerWa(true);
    setTimeout(() => setCopiedBannerWa(false), 1600);
  };

  const handleResolveTopAlert = () => {
    if (!onDismissAlert || isTopResolving) return;
    setResolvingBannerId(topAlert.id);
    setTimeout(() => {
      onDismissAlert(topAlert.id);
      setResolvingBannerId(null);
    }, 140);
  };

  const handlePrevAlert = () => {
    if (activeAlerts.length <= 1) return;
    setSlideDirection(-1);
    setActiveIndex(
      (prev) => (prev - 1 + activeAlerts.length) % activeAlerts.length
    );
  };

  const handleNextAlert = () => {
    if (activeAlerts.length <= 1) return;
    setSlideDirection(1);
    setActiveIndex((prev) => (prev + 1) % activeAlerts.length);
  };

  return (
    <motion.div
      data-testid="smart-kiln-alert-banner-strip"
      onMouseEnter={() => setIsAutoSlidePaused(true)}
      onMouseLeave={() => setIsAutoSlidePaused(false)}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className="relative bg-gradient-to-r from-amber-50/95 via-white to-orange-50/95 md:from-slate-950 md:via-slate-900 md:to-slate-950 text-slate-900 md:text-white border border-orange-200/90 md:border-slate-800 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 shadow-2xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 overflow-hidden"
    >
      {/* Left Zone: Compact Icon + Badges + Complete Readable Alert Title & Description */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={topAlert.id}
          initial={{ opacity: 0, x: slideDirection * 28 }}
          animate={
            isTopResolving
              ? { opacity: 0, x: 32, scale: 0.98 }
              : { opacity: 1, x: 0, scale: 1 }
          }
          exit={{ opacity: 0, x: slideDirection * -28, scale: 0.98 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="flex items-start sm:items-center gap-2 sm:gap-2.5 min-w-0 flex-1"
        >
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs border border-amber-300/40 mt-0.5 sm:mt-0">
            <BellRing className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Top Row: Compact Badges + Auto-Slider Stepper & Dots */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black tracking-wide tabular-nums shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-amber-200" />
                {isEn
                  ? `${formatBn(alertReport.totalActiveCount)} ALERTS`
                  : `${formatBn(alertReport.totalActiveCount)}টি অ্যালার্ট`}
              </span>

              {alertReport.criticalCount > 0 && (
                <span
                  data-testid="banner-strip-critical-badge"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 md:bg-rose-950/90 border border-rose-300 md:border-rose-500/60 text-rose-800 md:text-rose-200 text-[10px] font-extrabold tabular-nums shrink-0"
                >
                  {isEn
                    ? `${formatBn(alertReport.criticalCount)} Urgent`
                    : `${formatBn(alertReport.criticalCount)}টি জরুরি`}
                </span>
              )}

              {alertReport.warningCount > 0 && (
                <span
                  data-testid="banner-strip-warning-badge"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 md:bg-amber-950/90 border border-amber-300 md:border-amber-500/50 text-amber-900 md:text-amber-200 text-[10px] font-extrabold tabular-nums shrink-0"
                >
                  {isEn
                    ? `${formatBn(alertReport.warningCount)} Warning`
                    : `${formatBn(alertReport.warningCount)}টি মাঝারি`}
                </span>
              )}

              <span className="px-1.5 py-0.5 rounded bg-orange-100 md:bg-slate-800 border border-orange-200 md:border-slate-700 text-orange-900 md:text-amber-300 text-[10px] font-black shrink-0">
                {topUrgencyMeta.shortBadge}
              </span>

              <span className="px-1.5 py-0.5 rounded bg-amber-100/90 md:bg-amber-500/20 border border-amber-300 md:border-amber-400/40 text-orange-950 md:text-amber-300 text-[10px] font-black tabular-nums shrink-0">
                {isEn ? topAlert.metricValueEn : topAlert.metricValueBn}
              </span>

              {activeAlerts.length > 1 && (
                <div
                  data-testid="banner-auto-slider-controls"
                  className="inline-flex items-center gap-1 bg-white md:bg-slate-900 border border-orange-200 md:border-slate-700 rounded-md px-1.5 py-0.5 ml-0.5"
                >
                  <button
                    type="button"
                    data-testid="banner-prev-alert-btn"
                    onClick={handlePrevAlert}
                    aria-label={isEn ? 'Previous Alert' : 'পূর্ববর্তী অ্যালার্ট'}
                    className="p-0.5 text-slate-700 md:text-slate-300 hover:text-orange-600 md:hover:text-amber-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-black text-slate-800 md:text-slate-300 tabular-nums px-0.5">
                    {formatBn(safeIndex + 1)}/{formatBn(activeAlerts.length)}
                  </span>
                  <div className="inline-flex items-center gap-1 px-0.5">
                    {activeAlerts.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`banner-alert-dot-${idx}`}
                        onClick={() => {
                          setSlideDirection(idx >= safeIndex ? 1 : -1);
                          setActiveIndex(idx);
                        }}
                        aria-label={
                          isEn
                            ? `Slide to alert ${idx + 1}`
                            : `অ্যালার্ট ${formatBn(idx + 1)}-এ যান`
                        }
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === safeIndex
                            ? 'w-3.5 bg-orange-600 md:bg-amber-400'
                            : 'w-1.5 bg-slate-300 md:bg-slate-700 hover:bg-orange-400'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    data-testid="banner-next-alert-btn"
                    onClick={handleNextAlert}
                    aria-label={isEn ? 'Next Alert' : 'পরবর্তী অ্যালার্ট'}
                    className="p-0.5 text-slate-700 md:text-slate-300 hover:text-orange-600 md:hover:text-amber-300 cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Row: Full Readable Title & Description — Clickable to open full details */}
            <button
              type="button"
              data-testid="banner-alert-text-detail-trigger"
              onClick={() => onOpenAlertCenter(topAlert.id)}
              className="group text-left w-full flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 cursor-pointer hover:opacity-95 transition-opacity"
              title={
                isEn
                  ? 'Click to read full alert details'
                  : 'ক্লিক করে এই সতর্কতার সম্পূর্ণ বিস্তারিত দেখুন'
              }
            >
              <span className="text-[11px] sm:text-xs font-extrabold text-slate-950 md:text-white group-hover:text-orange-700 md:group-hover:text-amber-300 transition-colors leading-snug">
                {isEn ? topAlert.titleEn : topAlert.titleBn}
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-600 md:text-slate-300 leading-snug line-clamp-1 sm:line-clamp-none">
                — {isEn ? topAlert.descriptionEn : topAlert.descriptionBn}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-orange-100 md:bg-slate-800 group-hover:bg-orange-600 text-orange-800 md:text-amber-300 group-hover:text-white border border-orange-200 md:border-slate-700 text-[10px] font-bold transition-colors shrink-0">
                <Eye className="w-2.5 h-2.5" />
                <span>{isEn ? 'Details' : 'বিস্তারিত'}</span>
              </span>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Right Zone: Compact Action Buttons */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
        {topAlert.whatsappText && (
          <button
            type="button"
            onClick={handleCopyTopAlertWa}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 md:bg-emerald-950/90 hover:bg-emerald-100 md:hover:bg-emerald-900 border border-emerald-300 md:border-emerald-500/60 text-emerald-800 md:text-emerald-200 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
            title={
              isEn
                ? 'Copy WhatsApp Reminder Message'
                : '১-ক্লিকে হোয়াটসঅ্যাপ তাগাদা মেসেজ কপি করুন'
            }
          >
            {copiedBannerWa ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 md:text-emerald-400" />
                <span>{isEn ? 'Copied!' : 'কপি হয়েছে!'}</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-3 h-3 text-emerald-600 md:text-emerald-400" />
                <span>{isEn ? 'WhatsApp' : 'তাগাদা'}</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => onQuickActionAlert(topAlert)}
          className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-orange-50 md:bg-slate-800 hover:bg-orange-100 md:hover:bg-slate-700 text-orange-900 md:text-amber-300 border border-orange-200 md:border-slate-700 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          <span>{isEn ? topAlert.actionLabelEn : topAlert.actionLabelBn}</span>
          <ArrowRight className="w-3 h-3" />
        </button>

        {onDismissAlert && (
          <button
            type="button"
            data-testid="banner-strip-resolve-top-btn"
            onClick={handleResolveTopAlert}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 md:bg-slate-900 hover:bg-emerald-600 text-emerald-800 md:text-emerald-300 hover:text-white border border-emerald-300 md:border-emerald-500/50 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
            title={isEn ? 'Mark top alert as resolved' : 'সমাধান সম্পন্ন করুন'}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{isEn ? 'Resolve' : 'সমাধান'}</span>
          </button>
        )}

        <button
          type="button"
          data-testid="open-alert-center-from-strip-btn"
          onClick={() => onOpenAlertCenter(topAlert.id)}
          className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[10px] sm:text-[11px] font-extrabold shadow-2xs transition-colors cursor-pointer tabular-nums whitespace-nowrap"
        >
          <Bell className="w-3 h-3" />
          <span>
            {isEn
              ? `All (${formatBn(alertReport.totalActiveCount)})`
              : `সব দেখুন (${formatBn(alertReport.totalActiveCount)})`}
          </span>
        </button>
      </div>
    </motion.div>
  );
};

interface SmartKilnAlertCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEn: boolean;
  todayDate: string;
  alertReport: SmartKilnAlertReport;
  salesMemos: SalesMemo[];
  dismissedCount: number;
  initialExpandedAlertId?: string | null;
  onDismissAlert: (alertId: string) => void;
  onResetDismissedAlerts: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenDueCollectionForMemo: (memo: SalesMemo) => void;
  onAddCustomUrgentReminder: (payload: {
    title: string;
    text: string;
    date: string;
  }) => void;
}

export const SmartKilnAlertCenterModal: React.FC<
  SmartKilnAlertCenterModalProps
> = ({
  isOpen,
  onClose,
  isEn,
  todayDate,
  alertReport,
  salesMemos,
  dismissedCount,
  initialExpandedAlertId = null,
  onDismissAlert,
  onResetDismissedAlerts,
  onSelectTab,
  onOpenDueCollectionForMemo,
  onAddCustomUrgentReminder,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | KilnAlertCategory
  >('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<
    'ALL' | KilnAlertSeverity
  >('ALL');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(
    initialExpandedAlertId
  );
  const [isNewReminderOpen, setIsNewReminderOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState(todayDate);
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);
  const [resolvingAlertIds, setResolvingAlertIds] = useState<
    Record<string, boolean>
  >({});
  const [recentlyResolvedToast, setRecentlyResolvedToast] = useState<{
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && initialExpandedAlertId) {
      setExpandedAlertId(initialExpandedAlertId);
    }
  }, [isOpen, initialExpandedAlertId]);

  const filteredAlerts = useMemo(() => {
    return alertReport.activeAlerts.filter((a) => {
      const matchesCategory =
        selectedCategory === 'ALL' || a.category === selectedCategory;
      const matchesUrgency =
        selectedUrgency === 'ALL' || a.severity === selectedUrgency;
      return matchesCategory && matchesUrgency;
    });
  }, [alertReport.activeAlerts, selectedCategory, selectedUrgency]);

  if (!isOpen) return null;

  const totalAlertsWithResolved = Math.max(
    1,
    alertReport.totalActiveCount + dismissedCount
  );
  const criticalPct = Math.round(
    (alertReport.criticalCount / totalAlertsWithResolved) * 100
  );
  const warningPct = Math.round(
    (alertReport.warningCount / totalAlertsWithResolved) * 100
  );
  const resolvedPct = Math.max(
    0,
    Math.min(100, 100 - criticalPct - warningPct)
  );

  const handlePrimaryAction = (alert: SmartKilnAlertItem) => {
    if (alert.category === 'DUE_TAGADA' && alert.memoId) {
      const foundMemo = salesMemos.find((m) => m.id === alert.memoId);
      if (foundMemo) {
        onClose();
        onOpenDueCollectionForMemo(foundMemo);
        return;
      }
    }
    onSelectTab(alert.targetTab);
    onClose();
  };

  const handleResolveWithAnimation = (alert: SmartKilnAlertItem) => {
    if (resolvingAlertIds[alert.id]) return;
    setResolvingAlertIds((prev) => ({ ...prev, [alert.id]: true }));
    setRecentlyResolvedToast({
      id: alert.id,
      title: isEn ? alert.titleEn : alert.titleBn,
    });

    setTimeout(() => {
      onDismissAlert(alert.id);
      setResolvingAlertIds((prev) => {
        const next = { ...prev };
        delete next[alert.id];
        return next;
      });
      setExpandedAlertId((prev) => (prev === alert.id ? null : prev));
    }, 140);
  };

  const handleCopyWhatsAppMessage = (alert: SmartKilnAlertItem) => {
    if (!alert.whatsappText) return;
    navigator.clipboard.writeText(alert.whatsappText);
    setCopiedAlertId(alert.id);
    setTimeout(() => {
      setCopiedAlertId((prev) => (prev === alert.id ? null : prev));
    }, 1600);
  };

  const handleCreateCustomReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim() && !reminderText.trim()) return;
    onAddCustomUrgentReminder({
      title: reminderTitle.trim() || 'জরুরি ভাটা রিমাইন্ডার',
      text: reminderText.trim() || reminderTitle.trim(),
      date: reminderDate || todayDate,
    });
    setReminderTitle('');
    setReminderText('');
    setIsNewReminderOpen(false);
  };

  const categoryTabs: Array<{
    id: 'ALL' | KilnAlertCategory;
    labelBn: string;
    labelEn: string;
    count: number;
  }> = [
    {
      id: 'ALL',
      labelBn: 'সব',
      labelEn: 'All',
      count: alertReport.totalActiveCount,
    },
    {
      id: 'DUE_TAGADA',
      labelBn: 'বকেয়া তাগাদা',
      labelEn: 'Customer Due',
      count: alertReport.byCategory.DUE_TAGADA,
    },
    {
      id: 'COAL_FIRING',
      labelBn: 'কয়লা ও পোড়াই',
      labelEn: 'Coal & Firing',
      count: alertReport.byCategory.COAL_FIRING,
    },
    {
      id: 'BOOKING_DELIVERY',
      labelBn: 'অগ্রিম ডেলিভারি',
      labelEn: 'Delivery',
      count: alertReport.byCategory.BOOKING_DELIVERY,
    },
    {
      id: 'LICENSE_KISTI',
      labelBn: 'লাইসেন্স ও কিস্তি',
      labelEn: 'License & Kisti',
      count: alertReport.byCategory.LICENSE_KISTI,
    },
    {
      id: 'STOCK_URGENT',
      labelBn: 'স্টক ও নোট',
      labelEn: 'Stock & Notes',
      count: alertReport.byCategory.STOCK_URGENT,
    },
  ];

  const getCategoryIcon = (cat: KilnAlertCategory) => {
    switch (cat) {
      case 'DUE_TAGADA':
        return <Wallet className="w-3.5 h-3.5 text-rose-600" />;
      case 'COAL_FIRING':
        return <Flame className="w-3.5 h-3.5 text-orange-600" />;
      case 'BOOKING_DELIVERY':
        return <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />;
      case 'LICENSE_KISTI':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case 'STOCK_URGENT':
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-800" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isEn
          ? 'Smart Kiln Alert & Auto-Reminder Center'
          : 'অটো রিমাইন্ডার ও স্মার্ট অ্যালার্ট সেন্টার'
      }
      data-testid="smart-kiln-alert-center-modal"
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl max-w-3xl w-full p-3.5 sm:p-4 shadow-2xl space-y-3 text-slate-950 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Executive Dark Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white flex items-center justify-center shadow-2xs shrink-0 border border-amber-300/30">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black tracking-wide text-amber-300 truncate">
                  SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-black tabular-nums">
                  {formatBn(alertReport.totalActiveCount)}{' '}
                  {isEn ? 'Active' : 'টি সক্রিয়'}
                </span>
                {dismissedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-[10px] font-black tabular-nums">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    {formatBn(dismissedCount)}{' '}
                    {isEn ? 'Resolved' : 'টি সমাধানকৃত'}
                  </span>
                )}
              </div>
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                {isEn
                  ? 'Smart Kiln Alert & Auto-Reminder Center'
                  : 'অটো রিমাইন্ডার ও স্মার্ট অ্যালার্ট সেন্টার'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="toggle-new-custom-reminder-btn"
              onClick={() => setIsNewReminderOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[11px] font-extrabold cursor-pointer transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-white" />
              <span>{isEn ? '+ Reminder' : '+ রিমাইন্ডার'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Alert Center' : 'অ্যালার্ট সেন্টার বন্ধ করুন'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact 4-Column KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="px-2.5 py-2 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-slate-300">
                {isEn ? 'Critical' : 'জরুরি (Critical)'}
              </span>
              <span
                data-testid="alert-center-critical-count"
                className="text-sm sm:text-base font-black text-rose-400 tabular-nums"
              >
                {formatBn(alertReport.criticalCount)}টি
              </span>
            </div>
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-slate-300">
                {isEn ? 'Customer Due' : 'বকেয়া তাগাদা'}
              </span>
              <span className="text-sm sm:text-base font-black text-amber-300 tabular-nums">
                {formatBn(alertReport.byCategory.DUE_TAGADA)}টি
              </span>
            </div>
            <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-slate-300">
                {isEn ? 'Coal & Firing' : 'কয়লা ও পোড়াই'}
              </span>
              <span className="text-sm sm:text-base font-black text-orange-400 tabular-nums">
                {formatBn(alertReport.byCategory.COAL_FIRING)}টি
              </span>
            </div>
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
          </div>

          <div className="px-2.5 py-2 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-slate-300">
                {isEn ? 'Delivery & DoE' : 'ডেলিভারি ও কিস্তি'}
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-400 tabular-nums">
                {formatBn(
                  alertReport.byCategory.BOOKING_DELIVERY +
                    alertReport.byCategory.LICENSE_KISTI +
                    alertReport.byCategory.STOCK_URGENT
                )}
                টি
              </span>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
        </div>

        {/* Sleek Visual Status Indicator & Urgency Filter Bar */}
        <div
          data-testid="alert-urgency-health-bar"
          className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 space-y-1.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-[11px] font-extrabold text-slate-900">
                {isEn ? 'Urgency Filter:' : 'জরুরি মাত্রা ফিল্টার:'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-testid="urgency-filter-ALL"
                onClick={() => setSelectedUrgency('ALL')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer tabular-nums ${
                  selectedUrgency === 'ALL'
                    ? 'bg-slate-950 text-white'
                    : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>{isEn ? 'All' : 'সব মাত্রা'}</span>
                <span className="px-1 rounded bg-slate-200 text-slate-950 text-[9px] font-black">
                  {formatBn(alertReport.totalActiveCount)}
                </span>
              </button>

              <button
                type="button"
                data-testid="urgency-filter-CRITICAL"
                onClick={() =>
                  setSelectedUrgency((prev) =>
                    prev === 'CRITICAL' ? 'ALL' : 'CRITICAL'
                  )
                }
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer tabular-nums ${
                  selectedUrgency === 'CRITICAL'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-950 border border-rose-300 hover:bg-rose-100'
                }`}
              >
                <span>
                  {isEn ? 'Critical' : 'জরুরি'}:{' '}
                  {formatBn(alertReport.criticalCount)}
                </span>
              </button>

              <button
                type="button"
                data-testid="urgency-filter-WARNING"
                onClick={() =>
                  setSelectedUrgency((prev) =>
                    prev === 'WARNING' ? 'ALL' : 'WARNING'
                  )
                }
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer tabular-nums ${
                  selectedUrgency === 'WARNING'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                <span>
                  {isEn ? 'Warning' : 'মাঝারি'}:{' '}
                  {formatBn(alertReport.warningCount)}
                </span>
              </button>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-950 border border-emerald-300 text-[10px] font-extrabold tabular-nums">
                <span>
                  {isEn ? 'Resolved' : 'সমাধানকৃত'}: {formatBn(dismissedCount)}
                </span>
              </span>
            </div>
          </div>

          <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden flex gap-0.5">
            {alertReport.criticalCount > 0 && (
              <div
                style={{ width: `${Math.max(10, criticalPct)}%` }}
                className="h-full rounded-l-full bg-rose-600"
              />
            )}
            {alertReport.warningCount > 0 && (
              <div
                style={{ width: `${Math.max(10, warningPct)}%` }}
                className="h-full bg-amber-500"
              />
            )}
            <div
              style={{ width: `${Math.max(8, resolvedPct)}%` }}
              className="h-full rounded-r-full bg-emerald-500 flex-1"
            />
          </div>
        </div>

        {/* Recently Resolved Interactive Feedback Banner */}
        <AnimatePresence>
          {recentlyResolvedToast && (
            <motion.div
              key={recentlyResolvedToast.id}
              data-testid="alert-resolved-feedback-banner"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.12 }}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-emerald-950 text-white border border-emerald-500/60"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="w-4 h-4 rounded bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span className="text-emerald-300">
                  {isEn ? 'Resolved:' : 'সমাধান হয়েছে:'}
                </span>
                <span className="text-white truncate">
                  {recentlyResolvedToast.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {dismissedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetDismissedAlerts();
                      setRecentlyResolvedToast(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-[10px] font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>{isEn ? 'Undo' : 'ফেরান'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRecentlyResolvedToast(null)}
                  className="text-emerald-300 hover:text-white p-0.5 cursor-pointer"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline Custom Urgent Reminder Creator Form */}
        {isNewReminderOpen && (
          <form
            onSubmit={handleCreateCustomReminder}
            data-testid="custom-reminder-form"
            className="bg-orange-50/70 border border-orange-200 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-950 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-orange-600" />
                {isEn
                  ? 'Create New Custom Urgent Kiln Reminder'
                  : 'নতুন জরুরি রিমাইন্ডার বা অ্যালার্ট যুক্ত করুন'}
              </span>
              <button
                type="button"
                onClick={() => setIsNewReminderOpen(false)}
                className="text-xs font-bold text-slate-700 hover:text-slate-950 cursor-pointer"
              >
                {isEn ? 'Cancel' : 'বাতিল'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <label className="block text-[10px] font-extrabold text-slate-950 mb-0.5">
                  {isEn ? 'Reminder Title' : 'রিমাইন্ডারের শিরোনাম'}
                </label>
                <input
                  type="text"
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder={
                    isEn
                      ? 'e.g. Pay Coal Truck #4 tomorrow'
                      : 'যেমন: আগামীকাল কয়লার গাড়ির পেমেন্ট'
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-[10px] font-extrabold text-slate-950 mb-0.5">
                  {isEn ? 'Details / Action Note' : 'বিস্তারিত বিবরণ বা নোট'}
                </label>
                <input
                  type="text"
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Amount, phone or instruction...'
                      : 'টাকার পরিমাণ বা নির্দেশনা লিখুন...'
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-3 flex items-end gap-1.5">
                <div className="flex-1">
                  <label className="block text-[10px] font-extrabold text-slate-950 mb-0.5">
                    {isEn ? 'Target Date' : 'নির্ধারিত তারিখ'}
                  </label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="save-custom-reminder-btn"
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold cursor-pointer shrink-0"
                >
                  {isEn ? 'Save' : 'সেভ'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Compact Category Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-1">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`alert-filter-tab-${tab.id}`}
                onClick={() => setSelectedCategory(tab.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-slate-950 text-white shadow-2xs'
                    : 'text-slate-800 hover:bg-white'
                }`}
              >
                <span>{isEn ? tab.labelEn : tab.labelBn}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black tabular-nums ${
                    selectedCategory === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-200 text-slate-950'
                  }`}
                >
                  {formatBn(tab.count)}
                </span>
              </button>
            ))}
          </div>

          {dismissedCount > 0 && (
            <button
              type="button"
              data-testid="restore-resolved-alerts-btn"
              onClick={onResetDismissedAlerts}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-900 text-[10px] font-bold cursor-pointer tabular-nums"
            >
              <RotateCcw className="w-3 h-3 text-orange-600" />
              <span>
                {isEn
                  ? `Restore ${formatBn(dismissedCount)}`
                  : `${formatBn(dismissedCount)}টি রিসেট`}
              </span>
            </button>
          )}
        </div>

        {/* Fast, Compact Premium Alert Cards List */}
        <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 overflow-x-hidden">
          <AnimatePresence initial={false}>
            {filteredAlerts.map((alert) => {
              const isCritical = alert.severity === 'CRITICAL';
              const isResolving = Boolean(resolvingAlertIds[alert.id]);
              const isExpanded = expandedAlertId === alert.id;
              const urgencyMeta = getUrgencyStatusMeta(alert.severity, isEn);
              const categoryBadge = getCategoryStatusBadgeMeta(
                alert.category,
                isEn
              );

              return (
                <motion.div
                  key={alert.id}
                  data-testid={`smart-alert-card-${alert.id}`}
                  data-urgency={alert.severity}
                  data-resolving={isResolving ? 'true' : 'false'}
                  data-expanded={isExpanded ? 'true' : 'false'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={
                    isResolving
                      ? { opacity: 0, x: 40, scale: 0.97 }
                      : { opacity: 1, x: 0, y: 0, scale: 1 }
                  }
                  exit={{ opacity: 0, x: 44, scale: 0.96 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    isResolving
                      ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-400/40'
                      : isExpanded
                      ? `bg-slate-50/90 ${urgencyMeta.cardBorderClass} ring-1 ring-orange-500/30`
                      : `bg-white ${urgencyMeta.cardBorderClass}`
                  }`}
                >
                  {/* Main Compact Card Row */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div
                      onClick={() =>
                        setExpandedAlertId((prev) =>
                          prev === alert.id ? null : alert.id
                        )
                      }
                      className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer group"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors mt-0.5 ${
                          isResolving
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : urgencyMeta.iconBoxClass
                        }`}
                      >
                        {isResolving ? (
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        ) : isCritical ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        ) : (
                          getCategoryIcon(alert.category)
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0 flex-1">
                        {/* Compact Badges Row */}
                        <div className="flex flex-wrap items-center gap-1">
                          {isResolving ? (
                            <span
                              data-testid={`alert-resolved-badge-${alert.id}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black tracking-wide shrink-0"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {isEn ? 'RESOLVED' : 'সমাধান সম্পন্ন!'}
                            </span>
                          ) : (
                            <span
                              data-testid={`alert-urgency-badge-${alert.id}`}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 ${urgencyMeta.badgeClass}`}
                            >
                              {urgencyMeta.urgencyLabel}
                            </span>
                          )}

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${categoryBadge.className}`}
                          >
                            {isEn ? alert.badgeEn : alert.badgeBn}
                          </span>

                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 text-[10px] font-black tabular-nums shrink-0">
                            {isEn ? alert.metricValueEn : alert.metricValueBn}
                          </span>

                          <span className="text-[10px] font-bold text-slate-500 tabular-nums shrink-0">
                            · {alert.dateLabel}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h3
                          className={`text-xs font-extrabold leading-snug transition-colors group-hover:text-orange-700 ${
                            isResolving
                              ? 'text-emerald-950 line-through decoration-emerald-600/70'
                              : 'text-slate-950'
                          }`}
                        >
                          {isEn ? alert.titleEn : alert.titleBn}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-600 leading-snug">
                          {isEn ? alert.descriptionEn : alert.descriptionBn}
                        </p>
                      </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1 shrink-0 pt-1 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        type="button"
                        data-testid={`alert-toggle-details-btn-${alert.id}`}
                        onClick={() =>
                          setExpandedAlertId((prev) =>
                            prev === alert.id ? null : alert.id
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          isExpanded
                            ? 'bg-orange-600 text-white border-orange-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>
                          {isExpanded
                            ? isEn
                              ? 'Hide'
                              : 'সংক্ষিপ্ত'
                            : isEn
                            ? 'Details'
                            : 'বিস্তারিত'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {alert.whatsappText && !isResolving && (
                        <button
                          type="button"
                          onClick={() => handleCopyWhatsAppMessage(alert)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                          title={
                            isEn
                              ? 'Copy WhatsApp Reminder Message'
                              : 'হোয়াটসঅ্যাপ তাগাদা মেসেজ কপি করুন'
                          }
                        >
                          {copiedAlertId === alert.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>{isEn ? 'Copied!' : 'কপি হয়েছে!'}</span>
                            </>
                          ) : (
                            <>
                              <MessageCircle className="w-3 h-3 text-emerald-700" />
                              <span>{isEn ? 'WhatsApp' : 'তাগাদা'}</span>
                            </>
                          )}
                        </button>
                      )}

                      {!isResolving && (
                        <button
                          type="button"
                          data-testid={`alert-primary-action-${alert.id}`}
                          onClick={() => handlePrimaryAction(alert)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 hover:bg-orange-600 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>
                            {isEn ? alert.actionLabelEn : alert.actionLabelBn}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid={`alert-dismiss-btn-${alert.id}`}
                        disabled={isResolving}
                        onClick={() => handleResolveWithAnimation(alert)}
                        title={
                          isEn
                            ? 'Mark as Resolved'
                            : 'সমাধান সম্পন্ন হিসেবে চিহ্নিত করুন'
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          isResolving
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-950 hover:text-white border-emerald-300 hover:border-emerald-700'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3 h-3 ${
                            isResolving ? 'text-white' : 'text-emerald-600'
                          }`}
                        />
                        <span>
                          {isResolving
                            ? isEn
                              ? 'Resolved!'
                              : 'সমাধান!'
                            : isEn
                            ? 'Resolve'
                            : 'সমাধান'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Instant Zero-Lag Expandable Full Alert Details Drawer */}
                  {isExpanded && !isResolving && (
                    <div
                      data-testid={`alert-detail-drawer-${alert.id}`}
                      className="mt-2.5 pt-2.5 border-t border-slate-200/90 space-y-2"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <span className="block text-[10px] font-bold text-slate-500">
                            {isEn ? 'Key Metric / Amount' : 'প্রধান হিসাব / সূচক'}
                          </span>
                          <span className="font-black text-slate-950 text-xs tabular-nums mt-0.5 block">
                            {isEn ? alert.metricValueEn : alert.metricValueBn}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <span className="block text-[10px] font-bold text-slate-500">
                            {isEn ? 'Urgency Status' : 'জরুরি মাত্রা ও করণীয়'}
                          </span>
                          <span className="font-black text-rose-700 text-xs mt-0.5 block">
                            {urgencyMeta.statusText}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <span className="block text-[10px] font-bold text-slate-500">
                            {isEn ? 'Alert Category' : 'সংশ্লিষ্ট খাত / সেকশন'}
                          </span>
                          <span className="font-black text-slate-950 text-xs mt-0.5 block">
                            {isEn ? alert.badgeEn : alert.badgeBn}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <span className="block text-[10px] font-bold text-slate-500">
                            {isEn ? 'Reference Date' : 'নির্ধারিত তারিখ'}
                          </span>
                          <span className="font-black text-slate-950 text-xs tabular-nums mt-0.5 block">
                            {alert.dateLabel}
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950 text-white border border-slate-800 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                            {isEn
                              ? 'COMPLETE ALERT DETAILS & ADVISORY'
                              : 'সম্পূর্ণ বিস্তারিত বিবরণ ও পরামর্শ'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                            ID: {alert.id}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-white leading-snug">
                          {isEn ? alert.titleEn : alert.titleBn}
                        </p>
                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                          {isEn ? alert.descriptionEn : alert.descriptionBn}
                        </p>
                      </div>

                      {alert.whatsappText && (
                        <div className="p-2.5 rounded-lg bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                              {isEn
                                ? 'WHATSAPP / SMS REMINDER MESSAGE'
                                : 'হোয়াটসঅ্যাপ / তাগাদা মেসেজ প্রিভিউ'}
                            </span>
                            <p className="text-xs font-bold text-emerald-950 leading-snug break-words">
                              {alert.whatsappText}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyWhatsAppMessage(alert)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold cursor-pointer shrink-0"
                          >
                            {copiedAlertId === alert.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>{isEn ? 'Copied!' : 'কপি হয়েছে!'}</span>
                              </>
                            ) : (
                              <>
                                <MessageCircle className="w-3 h-3" />
                                <span>
                                  {isEn ? 'Copy Message' : 'মেসেজ কপি করুন'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredAlerts.length === 0 && (
            <div className="py-7 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <div className="text-xs sm:text-sm font-extrabold text-slate-950">
                {isEn
                  ? 'All Clear! No pending alerts in this category.'
                  : 'আলহামদুলিল্লাহ! এই ক্যাটাগরিতে কোনো বকেয়া সতর্কতা নেই।'}
              </div>
              <p className="text-[11px] font-medium text-slate-600">
                {isEn
                  ? 'Use "+ Reminder" above to add a new custom reminder.'
                  : 'উপরের "+ রিমাইন্ডার" বাটনে ক্লিক করে নতুন রিমাইন্ডার সেট করতে পারেন।'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
