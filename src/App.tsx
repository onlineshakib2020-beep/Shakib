import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BarChart3,
  BellRing,
  BookmarkCheck,
  BookOpen,
  Briefcase,
  Calculator,
  CalendarRange,
  CheckCircle2,
  Clock,
  Cloud,
  CloudRain,
  Compass,
  CreditCard,
  Download,
  Edit3,
  Eye,
  Factory,
  FilePlus2,
  FileSpreadsheet,
  Flame,
  Globe,
  Layers,
  LayoutDashboard,
  MapPin,
  Maximize2,
  Menu,
  MessageCircle,
  Minimize2,
  Moon,
  PackageCheck,
  Phone,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  StickyNote,
  Sun,
  Target,
  Trash2,
  TrendingDown,
  Truck,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AdvanceBrickBooking,
  BusinessAnalysisReport,
  CashTxType,
  ComplianceInstallmentRecord,
  DadonAdvanceRecord,
  DailyKilnGoals,
  DashboardMetrics,
  EstimatedCostOverrides,
  GradeReportRow,
  KilnDatabaseState,
  KpiCardId,
  LanguageMode,
  MillId,
  NavigationTab,
  PaymentMethod,
  SalesMemo,
  SoilCoalRecord,
  UnloadedGradeItem,
  VehicleDieselRecord,
} from './types/kiln';
import {
  calculateDashboardMetrics,
  calculateMultiItemMemoTotals,
  calculateRowTotal,
  cleanBrickGradeName,
  computeBrickGradeReport,
  computeComprehensiveBusinessAnalysis,
  computeDailyGoalProgress,
  computeDueTagadaList,
  formatBn,
  formatCurrencyBn,
  generateUniqueMemoNo,
  parseNum,
  setActiveLanguageMode,
  setUseEnglishNumerals,
} from './utils/kilnLogic';
import { createInitialKilnState, getTodayAndYesterday } from './utils/seedData';
import { KpiCardsStrip } from './components/KpiCardsStrip';
import { KpiReportModal } from './components/KpiReportModal';
import { MemoPrintModal } from './components/MemoPrintModal';
import { BrickGradeReportTab } from './components/BrickGradeReportTab';
import { LabourSectionTab } from './components/LabourSectionTab';
import { SalesLedgerTab } from './components/SalesLedgerTab';
import { CashBookTab } from './components/CashBookTab';
import { NewMemoStudio } from './components/NewMemoStudio';
import { MemoActionModals } from './components/MemoActionModals';
import { BrickDeliveryTab } from './components/BrickDeliveryTab';
import { YearlySeasonalAnalyticsTab } from './components/YearlySeasonalAnalyticsTab';
import { FinancialHealthGaugeCard } from './components/FinancialHealthGaugeCard';
import { DailyProductionGoalCard } from './components/DailyProductionGoalCard';
import { SatkhiraWeatherWidget } from './components/SatkhiraWeatherWidget';
import { Card } from './components/Card';
import { SblBrandLogo } from './components/SblBrandLogo';
import { KilnMapLocationModal } from './components/KilnMapLocationModal';
import { KILN_COORDINATES } from './utils/weatherLogic';
import { JalaniHisabTab } from './components/JalaniHisabTab';
import { DashboardOperationsShortcutsHub } from './components/DashboardOperationsShortcutsHub';
import { FridayHatbarSardarPrintSheetModal } from './components/FridayHatbarSardarPrintSheetModal';
import {
  KilnAdvancedLedgersTab,
  type AdvancedLedgerSection,
} from './components/KilnAdvancedLedgersTab';
import {
  KilnSmartOperationsHubTab,
  type SmartHubSection,
} from './components/KilnSmartOperationsHubTab';
import {
  KilnEnterpriseOperationsTab,
  type EnterpriseSectionId,
} from './components/KilnEnterpriseOperationsTab';
import { LandLeaseLedgerTab } from './components/LandLeaseLedgerTab';
import {
  buildAutoUnloadConfirmation,
  createDefaultFeedKilnLineSystem,
  createEmptyEnterpriseState,
  type AutoUnloadConfirmationRecord,
  type EnterpriseOperationsState,
  type LandLeaseContractRecord,
} from './utils/enterpriseOperationsLogic';
import { applyDomLanguageNormalizer } from './utils/languageNormalizer';
import { ScheduledBackupModal } from './components/ScheduledBackupModal';
import {
  buildDailySnapshotRecord,
  computeDatabaseRecordSummary,
  detectSessionResetWithRecoverableBackup,
  shouldRunScheduledDailyBackup,
  type StoredKilnSnapshot,
} from './utils/scheduledBackupLogic';
import {
  clearAllSnapshotsFromIndexedDb,
  deleteSnapshotFromIndexedDb,
  downloadSnapshotAsJsonArchive,
  getAutoDailyBackupPreference,
  listSnapshotsFromIndexedDb,
  saveSnapshotToIndexedDb,
  setAutoDailyBackupPreference,
} from './utils/indexedDbBackupStore';
import {
  saveStateToFirestore,
  loadStateFromFirestore,
  subscribeToSyncStatus,
  triggerDebouncedCloudSync,
  type FirestoreSyncStatus,
} from './services/firestoreSync';
import {
  QuickWorkspaceSearchModal,
  SmartBrickEstimatorModal,
  ThemeAndSmartToolsBar,
  type DashboardCleanViewMode,
} from './components/SmartBrickEstimatorAndSearchModals';
import {
  computeSmartKilnAlerts,
  type KilnFiringRoundRecord,
  type KilnThemeId,
} from './utils/themeAndEstimatorLogic';
import {
  CoalFiringEfficiencyTab,
  DashboardCoalEfficiencySummaryCard,
} from './components/CoalFiringEfficiencyTab';
import {
  SmartKilnAlertBannerStrip,
  SmartKilnAlertCenterModal,
} from './components/SmartKilnAlertCenterModal';
import { usePWAInstall } from './components/PWAInstallAndRoleBar';

interface EnrichedPayload {
  state: KilnDatabaseState;
  metrics: DashboardMetrics;
  gradeReport: {
    rows: GradeReportRow[];
    totals: {
      brickStockPieces: number;
      todayBrickQty: number;
      todayTotalAmount: number;
      yesterdayBrickQty: number;
      yesterdayTotalAmount: number;
      seasonBrickQty: number;
      seasonTotalAmount: number;
    };
  };
  businessAnalysis?: BusinessAnalysisReport;
}

interface DraftMemoItem {
  gradeId: string;
  quantity: string;
  ratePerThousand: string;
}

const isBenignWebSocketError = (value: unknown): boolean => {
  const msg =
    value instanceof Error
      ? `${value.message} ${value.stack || ''}`
      : typeof value === 'string'
      ? value
      : String(value ?? '');
  return (
    msg.includes('WebSocket closed without opened') ||
    msg.includes('failed to connect to websocket') ||
    msg.includes('@vite/client')
  );
};

// Silence benign Vite HMR WebSocket closed-without-opened console errors & unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      if (isBenignWebSocketError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (
        isBenignWebSocketError(event.error) ||
        isBenignWebSocketError(event.message)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  const origConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (args.some((arg) => isBenignWebSocketError(arg))) {
      return;
    }
    origConsoleError(...args);
  };
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    if (isBenignWebSocketError(error)) {
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isBenignWebSocketError(error)) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md space-y-3 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              পেইজটি পুনরায় লোড হচ্ছে
            </h2>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 text-xs font-bold bg-orange-600 text-white rounded-xl cursor-pointer"
            >
              পুনরায় চেষ্টা করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LiveDigitalClock = React.memo(function LiveDigitalClock() {
  const [timeStr, setTimeStr] = useState<string>(() =>
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTimeStr(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <span
      data-testid="live-digital-clock"
      data-skip-lang-norm="true"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/90 md:bg-slate-900/80 md:bg-gradient-to-r md:from-amber-500/20 md:to-orange-500/20 border border-amber-300 md:border-amber-400/50 text-orange-950 md:text-amber-300 font-mono font-black text-[10px] sm:text-[11px]"
    >
      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-600 md:text-amber-400" />
      <span>{timeStr}</span>
    </span>
  );
});

function BrickFlowApp() {
  const initialSeed = useMemo(() => createInitialKilnState(), []);
  const { todayDate, yesterdayDate } = useMemo(() => getTodayAndYesterday(), []);

  const [lang, setLang] = useState<LanguageMode>('bn');
  const isEn = lang === 'en';
  setActiveLanguageMode(lang);
  setUseEnglishNumerals(true);

  const appRootRef = useRef<HTMLDivElement | null>(null);

  const roleMode = 'OWNER' as const;
  const [isDataResetModalOpen, setIsDataResetModalOpen] = useState(false);
  const [enterpriseState, setEnterpriseState] = useState<EnterpriseOperationsState>(() => {
    try {
      const saved = localStorage.getItem('sbl_enterprise_ops_state_v2_zero');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.chambers)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return createEmptyEnterpriseState(todayDate);
  });

  const handleUpdateEnterpriseState = useCallback((next: EnterpriseOperationsState) => {
    setEnterpriseState(next);
    try {
      localStorage.setItem('sbl_enterprise_ops_state_v2_zero', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const [autoUnloadConfirmation, setAutoUnloadConfirmation] =
    useState<AutoUnloadConfirmationRecord | null>(
      () => enterpriseState.lineSystem?.lastAutoUnloadConfirmation || null
    );

  const [dbState, setDbState] = useState<KilnDatabaseState>(initialSeed);
  const [metrics, setMetrics] = useState<DashboardMetrics>(() =>
    calculateDashboardMetrics(initialSeed, todayDate, yesterdayDate)
  );
  const [gradeReport, setGradeReport] = useState(() =>
    computeBrickGradeReport(
      initialSeed.brickGrades,
      initialSeed.salesMemos,
      todayDate,
      yesterdayDate
    )
  );
  const [businessAnalysis, setBusinessAnalysis] = useState<BusinessAnalysisReport>(() =>
    computeComprehensiveBusinessAnalysis(initialSeed, todayDate, yesterdayDate)
  );

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [activeKpiModal, setActiveKpiModal] = useState<KpiCardId | null>(null);
  const [printMemoTarget, setPrintMemoTarget] = useState<SalesMemo | null>(null);

  // Unified Memo Popup Modals State
  const [isNewMemoModalOpen, setIsNewMemoModalOpen] = useState(false);
  const [viewMemoTarget, setViewMemoTarget] = useState<SalesMemo | null>(null);
  const [dueModalMemoTarget, setDueModalMemoTarget] = useState<SalesMemo | null>(null);
  const [editModalMemoTarget, setEditModalMemoTarget] = useState<SalesMemo | null>(null);
  const [deleteMemoTarget, setDeleteMemoTarget] = useState<SalesMemo | null>(null);
  const [deliveryTargetMemoNo, setDeliveryTargetMemoNo] = useState<string>('');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isEstimatorModalOpen, setIsEstimatorModalOpen] = useState(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);
  const [isAlertCenterModalOpen, setIsAlertCenterModalOpen] = useState(false);
  const [alertCenterFocusId, setAlertCenterFocusId] = useState<string | null>(
    null
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sbl_dismissed_alerts_v2_zero');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [dashboardViewMode, setDashboardViewMode] =
    useState<DashboardCleanViewMode>('ESSENTIAL');
  const [firingRounds, setFiringRounds] = useState<KilnFiringRoundRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sbl_firing_rounds_v2_zero');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [benchmarkCoalPerLakhTons, setBenchmarkCoalPerLakhTons] = useState<number>(
    () => {
      try {
        const saved = Number(localStorage.getItem('sbl_coal_benchmark_v1'));
        if (saved >= 10 && saved <= 30) return saved;
      } catch {
        // ignore
      }
      return 17.2;
    }
  );
  const [activeTheme, setActiveTheme] = useState<KilnThemeId>(() => {
    try {
      const saved = localStorage.getItem('sbl_kiln_theme') as KilnThemeId | null;
      if (
        saved === 'terracotta' ||
        saved === 'emerald' ||
        saved === 'sapphire' ||
        saved === 'crimson'
      ) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'terracotta';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-kiln-theme', activeTheme);
    try {
      localStorage.setItem('sbl_kiln_theme', activeTheme);
    } catch {
      // ignore
    }
  }, [activeTheme]);

  // 1-Click Royal Dark / Day Light Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sbl_color_mode') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mode = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-color-mode', mode);
    try {
      localStorage.setItem('sbl_color_mode', mode);
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Toast Notification State (No window.alert!)
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    []
  );

  const requireOwnerPermission = useCallback((): boolean => {
    return true;
  }, []);

  const applyEnrichedState = useCallback((data: EnrichedPayload) => {
    if (data && data.state) {
      setDbState(data.state);
      if (data.metrics) setMetrics(data.metrics);
      if (data.gradeReport) setGradeReport(data.gradeReport);
      if (data.businessAnalysis) {
        setBusinessAnalysis(data.businessAnalysis);
      } else {
        const { todayDate: td, yesterdayDate: yd } = getTodayAndYesterday();
        setBusinessAnalysis(computeComprehensiveBusinessAnalysis(data.state, td, yd));
      }
      // Keep any open memo modal target instantaneously synced with updated salesMemos
      setViewMemoTarget((prev) =>
        prev ? data.state.salesMemos.find((m) => m.id === prev.id) || prev : null
      );
      setDueModalMemoTarget((prev) =>
        prev ? data.state.salesMemos.find((m) => m.id === prev.id) || prev : null
      );
      setEditModalMemoTarget((prev) =>
        prev ? data.state.salesMemos.find((m) => m.id === prev.id) || prev : null
      );

      // 100% Automatic Real-Time Browser Vault Persistence (localStorage + IndexedDB)
      const summary = computeDatabaseRecordSummary(data.state);
      if (summary.totalRecordsCount > 0 || summary.openingBalance > 0) {
        try {
          localStorage.setItem(
            'sbl_live_master_db_backup_v1',
            JSON.stringify({
              savedAt: new Date().toISOString(),
              summary,
              state: data.state,
            })
          );
        } catch {
          // ignore localStorage quota error
        }
        const { todayDate: currentDayKey } = getTodayAndYesterday();
        const instantSnapshot = buildDailySnapshotRecord(
          data.state,
          currentDayKey,
          'AUTO_ON_CHANGE'
        );
        saveSnapshotToIndexedDb(instantSnapshot, 30)
          .then((updatedList) => {
            setSavedSnapshots(updatedList);
            setLastBackupStatusBn(
              `অটো-সেভ সুরক্ষিত: ${currentDayKey} (${formatBn(
                summary.totalRecordsCount
              )}টি হিসাব অটোমেটিক সংরক্ষিত)`
            );
          })
          .catch(() => {});
      }

      // Continuous Real-Time Dual Sync to Google Firebase Cloud Firestore
      if (summary.totalRecordsCount > 0 || summary.openingBalance > 0) {
        triggerDebouncedCloudSync(data.state);
      }
    }
  }, []);

  // Scheduled Daily Backup & IndexedDB Vault State + Persistent Phone Storage Lock
  const [hasLoadedServerState, setHasLoadedServerState] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<FirestoreSyncStatus>({
    isConnected: true,
    isSyncing: false,
    lastSyncedAt: null,
    errorMessage: null,
    totalRecordsInCloud: 0,
  });

  useEffect(() => {
    const unsub = subscribeToSyncStatus((st) => setCloudSyncStatus(st));
    return unsub;
  }, []);

  const handleSyncToCloud = async () => {
    showToast('গুগল ক্লাউডে ডাটা সেভ হচ্ছে...');
    const ok = await saveStateToFirestore(dbState);
    if (ok) {
      showToast('✅ ক্লাউডে সম্পূর্ণ ডাটা সফলভাবে সেভ হয়েছে!');
    } else {
      showToast('❌ ক্লাউড সেভে ত্রুটি হয়েছে, সংযোগ পরীক্ষা করুন।');
    }
  };

  const handleRestoreFromCloud = async () => {
    showToast('গুগল ক্লাউড থেকে ডাটা আনা হচ্ছে...');
    const cloudState = await loadStateFromFirestore();
    if (cloudState) {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudState),
      });
      if (res.ok) {
        const data = await res.json();
        applyEnrichedState(data);
        showToast('🛡️ ক্লাউড থেকে সম্পূর্ণ হিসাব সফলভাবে রিস্টোর হয়েছে!');
      }
    } else {
      showToast('ক্লাউডে কোনো পূর্ববর্তী ডাটা পাওয়া যায়নি।');
    }
  };

  const [isBackupVaultOpen, setIsBackupVaultOpen] = useState(false);
  const [isFridayHatbarSheetOpen, setIsFridayHatbarSheetOpen] = useState(false);
  const [isPhoneInstallGuideOpen, setIsPhoneInstallGuideOpen] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  });
  const [isStoragePersisted, setIsStoragePersisted] = useState(true);
  const { isInstallable: isPWAInstallable, isInstalled: isPWAInstalled, install: triggerPWAInstall } =
    usePWAInstall();
  const [savedSnapshots, setSavedSnapshots] = useState<StoredKilnSnapshot[]>([]);
  const [autoDailyBackupEnabled, setAutoDailyBackupEnabled] = useState<boolean>(() =>
    getAutoDailyBackupPreference()
  );
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [lastBackupStatusBn, setLastBackupStatusBn] = useState<string>(
    'IndexedDB অটো ডেইলি স্ন্যাপশট প্রস্তুত'
  );

  // Sync browser Fullscreen API changes
  useEffect(() => {
    const onFsChange = () => {
      if (document.fullscreenElement) {
        setIsFullScreenMode(true);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullScreen = useCallback(async () => {
    const nextState = !isFullScreenMode;
    setIsFullScreenMode(nextState);
    try {
      if (nextState && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!nextState && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback gracefully to CSS full-screen cockpit mode if browser blocks native requestFullscreen
    }
    showToast(
      nextState
        ? '📱 ফুল-স্ক্রিন ও বুড়ো আঙুলের থাম্ব-জোন মোড চালু হয়েছে!'
        : 'সাধারণ পর্দা মোডে ফিরে এসেছে।'
    );
  }, [isFullScreenMode, showToast]);

  // Request Persistent Browser Storage Lock on Phone/Chrome so OS never auto-evicts local IndexedDB/localStorage
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (typeof navigator.storage.persist === 'function') {
        navigator.storage
          .persist()
          .then((granted) => {
            if (granted) setIsStoragePersisted(true);
          })
          .catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (lang !== 'en') return;
    const root = appRootRef.current;
    if (!root) return;
    const rafId = window.requestAnimationFrame(() => {
      applyDomLanguageNormalizer(root, lang);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [
    lang,
    activeTab,
    dashboardViewMode,
    isNewMemoModalOpen,
    isMapModalOpen,
    isBackupVaultOpen,
    isEstimatorModalOpen,
    isQuickSearchModalOpen,
  ]);

  // Initial Fetch & Resilient Real-Time SSE / WebSocket Reconnection Handling
  useEffect(() => {
    let isDisposed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isBenignWebSocketError(event.reason)) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    fetch('/api/state')
      .then((r) => r.json())
      .then(async (data: EnrichedPayload) => {
        if (isDisposed) return;
        const serverSummary = computeDatabaseRecordSummary(data?.state);
        const isServerEmpty =
          serverSummary.totalRecordsCount === 0 && serverSummary.openingBalance === 0;

        if (isServerEmpty) {
          // 1. First priority: Check Google Firebase Cloud Firestore
          try {
            const cloudState = await loadStateFromFirestore();
            if (cloudState && !isDisposed) {
              const cloudSum = computeDatabaseRecordSummary(cloudState);
              if (cloudSum.totalRecordsCount > 0 || cloudSum.openingBalance > 0) {
                const restoreRes = await fetch('/api/backup/restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cloudState),
                });
                if (restoreRes.ok) {
                  const restoredPayload = (await restoreRes.json()) as EnrichedPayload;
                  if (!isDisposed) {
                    applyEnrichedState(restoredPayload);
                    setHasLoadedServerState(true);
                    showToast(
                      `☁️ ফায়ারবেস ক্লাউড থেকে ${formatBn(
                        cloudSum.totalRecordsCount
                      )}টি হিসাব স্বয়ংক্রিয়ভাবে লোড করা হয়েছে!`
                    );
                    return;
                  }
                }
              }
            }
          } catch (cloudErr) {
            console.warn('Initial cloud state fetch notice:', cloudErr);
          }

          // 2. Secondary fallback: Check browser automatic saved data in localStorage or IndexedDB
          let candidateState: KilnDatabaseState | null = null;
          let candidateRecordsCount = 0;

          try {
            const rawLocal = localStorage.getItem('sbl_live_master_db_backup_v1');
            if (rawLocal) {
              const parsedLocal = JSON.parse(rawLocal);
              const st = parsedLocal?.state as KilnDatabaseState | undefined;
              const sum = computeDatabaseRecordSummary(st);
              if (st && (sum.totalRecordsCount > 0 || sum.openingBalance > 0)) {
                candidateState = st;
                candidateRecordsCount = sum.totalRecordsCount;
              }
            }
          } catch {
            // ignore parse errors
          }

          if (!candidateState) {
            try {
              const idbList = await listSnapshotsFromIndexedDb();
              const bestSnap = idbList.find(
                (s) =>
                  (s.summary?.totalRecordsCount || 0) > 0 ||
                  (s.summary?.openingBalance || 0) > 0
              );
              if (bestSnap?.state) {
                candidateState = bestSnap.state;
                candidateRecordsCount = bestSnap.summary.totalRecordsCount;
              }
            } catch {
              // ignore IndexedDB errors
            }
          }

          if (candidateState && !isDisposed) {
            try {
              const restoreRes = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(candidateState),
              });
              if (restoreRes.ok) {
                const restoredPayload = (await restoreRes.json()) as EnrichedPayload;
                if (!isDisposed) {
                  applyEnrichedState(restoredPayload);
                  setHasLoadedServerState(true);
                  showToast(
                    `🛡️ অটো-রিকভারি সম্পন্ন: আপনার সংরক্ষিত ${formatBn(
                      candidateRecordsCount
                    )}টি হিসাব স্বয়ংক্রিয়ভাবে পুনরুদ্ধার করা হয়েছে!`
                  );
                  return;
                }
              }
            } catch {
              // fallback to normal state apply if restore call fails
            }
          }
        }

        if (!isDisposed) {
          applyEnrichedState(data);
          setHasLoadedServerState(true);
        }
      })
      .catch(() => {});

    const connectEventStream = () => {
      if (isDisposed) return;
      try {
        es = new EventSource('/api/events');
        es.addEventListener('STATE_UPDATED', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as EnrichedPayload;
            if (!isDisposed) {
              applyEnrichedState(parsed);
              setHasLoadedServerState(true);
            }
          } catch {
            // ignore malformed event payload
          }
        });
        es.onerror = () => {
          try {
            es?.close();
          } catch {
            // ignore close error
          }
          es = null;
          if (!isDisposed && !reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              connectEventStream();
            }, 3000);
          }
        };
      } catch {
        // ignore connection initialization error
      }
    };

    connectEventStream();

    return () => {
      isDisposed = true;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, [applyEnrichedState]);

  // Load existing IndexedDB snapshots on mount
  useEffect(() => {
    listSnapshotsFromIndexedDb()
      .then((rows) => {
        setSavedSnapshots(rows);
      })
      .catch(() => {});
  }, []);

  // Background Scheduled Daily Backup Task (runs when state loads/changes + every 60s heartbeat)
  useEffect(() => {
    if (!hasLoadedServerState) return;
    let cancelled = false;

    const executeScheduledBackupCheck = async () => {
      const currentSnapshots = await listSnapshotsFromIndexedDb();
      if (cancelled) return;
      setSavedSnapshots(currentSnapshots);

      const { todayDate: currentDayKey } = getTodayAndYesterday();
      const decision = shouldRunScheduledDailyBackup(
        currentSnapshots,
        currentDayKey,
        dbState,
        autoDailyBackupEnabled
      );

      if (decision.shouldBackup) {
        const snapshot = buildDailySnapshotRecord(
          dbState,
          currentDayKey,
          decision.triggerType
        );
        try {
          const updatedList = await saveSnapshotToIndexedDb(snapshot, 30);
          if (!cancelled) {
            setSavedSnapshots(updatedList);
            setLastBackupStatusBn(
              `সর্বশেষ অটো ব্যাকআপ: ${currentDayKey} (${formatBn(
                snapshot.summary.totalRecordsCount
              )} রেকর্ড)`
            );
          }
          // Also trigger server-side daily snapshot archive file
          fetch('/api/backup/daily-snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dateKey: currentDayKey }),
          }).catch(() => {});
        } catch {
          // ignore IndexedDB quota error
        }
      }
    };

    void executeScheduledBackupCheck();
    const intervalId = setInterval(() => {
      void executeScheduledBackupCheck();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [hasLoadedServerState, dbState, autoDailyBackupEnabled]);

  const recoverableSnapshot = hasLoadedServerState
    ? detectSessionResetWithRecoverableBackup(dbState, savedSnapshots)
    : null;

  const handleToggleAutoDailyBackup = (enabled: boolean) => {
    setAutoDailyBackupEnabled(enabled);
    setAutoDailyBackupPreference(enabled);
    showToast(
      enabled
        ? 'স্বয়ংক্রিয় ডেইলি ব্যাকআপ (IndexedDB) চালু করা হয়েছে!'
        : 'স্বয়ংক্রিয় ডেইলি ব্যাকআপ সাময়িকভাবে বন্ধ করা হয়েছে।'
    );
  };

  const handleTriggerManualSnapshot = async (alsoDownloadArchive = false) => {
    setIsSavingSnapshot(true);
    try {
      const { todayDate: currentDayKey } = getTodayAndYesterday();
      const snapshot = buildDailySnapshotRecord(dbState, currentDayKey, 'MANUAL');
      const updated = await saveSnapshotToIndexedDb(snapshot, 30);
      setSavedSnapshots(updated);
      setLastBackupStatusBn(
        `ম্যানুয়াল স্ন্যাপশট সংরক্ষিত: ${currentDayKey} (${formatBn(
          snapshot.summary.totalRecordsCount
        )} রেকর্ড)`
      );
      fetch('/api/backup/daily-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateKey: currentDayKey }),
      }).catch(() => {});

      if (alsoDownloadArchive) {
        downloadSnapshotAsJsonArchive(snapshot);
        showToast('IndexedDB-তে স্ন্যাপশট সেভ হয়েছে এবং JSON আর্কাইভ ডাউনলোড হয়েছে!');
      } else {
        showToast('ব্রাউজার IndexedDB ভল্টে নতুন স্ন্যাপশট সংরক্ষিত হয়েছে!');
      }
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const handleRestoreFromIndexedDbSnapshot = async (snapshot: StoredKilnSnapshot) => {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot.state),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'স্ন্যাপশট রিস্টোর করতে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(`স্ন্যাপশট (${snapshot.dateKey}) থেকে সম্পূর্ণ ডাটাবেস সফলভাবে রিস্টোর হয়েছে!`);
  };

  const handleDeleteIndexedDbSnapshot = async (id: string) => {
    await deleteSnapshotFromIndexedDb(id);
    const updated = await listSnapshotsFromIndexedDb();
    setSavedSnapshots(updated);
    showToast('স্ন্যাপশট মুছে ফেলা হয়েছে।');
  };

  // New Sales Memo Form State (Per-1,000 Brick Rate: e.g. 1000 bricks @ 11000 = 11000 Tk, 500 bricks = 5500 Tk)
  const nextAutoMemoNo = generateUniqueMemoNo(dbState.salesMemos).memoNo;
  const [memoNo, setMemoNo] = useState(() => generateUniqueMemoNo(initialSeed.salesMemos).memoNo);
  const [memoCustomer, setMemoCustomer] = useState('');
  const [memoPhone, setMemoPhone] = useState('');
  const [memoAddress, setMemoAddress] = useState('বাবুলিয়া, সাতক্ষীরা');
  const [memoDate, setMemoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memoVehicleType, setMemoVehicleType] = useState('ট্রাক (Truck)');
  const [memoTruck, setMemoTruck] = useState('সাতক্ষীরা-ট-১১-');
  const [memoDriver, setMemoDriver] = useState('');
  const [memoDriverPhone, setMemoDriverPhone] = useState('');
  const [memoDeliveryStatus, setMemoDeliveryStatus] = useState<
    'DELIVERED' | 'LOADING' | 'BOOKING'
  >('DELIVERED');
  const [memoDuePromiseDate, setMemoDuePromiseDate] = useState('');
  const [memoNote, setMemoNote] = useState('');
  const [memoItems, setMemoItems] = useState<DraftMemoItem[]>([
    { gradeId: 'grade-1', quantity: '', ratePerThousand: '11000' },
  ]);
  const [memoDiscount, setMemoDiscount] = useState('');
  const [memoPaid, setMemoPaid] = useState('');
  const [memoMethod, setMemoMethod] = useState<PaymentMethod>('নগদ ক্যাশ');
  const [creatingMemo, setCreatingMemo] = useState(false);

  // Sync memoNo with nextAutoMemoNo whenever salesMemos updates
  useEffect(() => {
    const autoNo = generateUniqueMemoNo(dbState.salesMemos).memoNo;
    setMemoNo(autoNo);
  }, [dbState.salesMemos]);

  // Scroll to top smoothly whenever activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Global Ctrl+K / Cmd+K Quick Workspace Search Shortcut for Tablet & Web keyboards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dashboard Quick Expense Form State
  const [quickExpCategory, setQuickExpCategory] = useState('কয়লা ক্রয়');
  const [quickExpAmount, setQuickExpAmount] = useState('');
  const [quickExpDesc, setQuickExpDesc] = useState('');

  // Dashboard Urgent Note Form State
  const [noteInput, setNoteInput] = useState('');
  const [notePriority, setNotePriority] = useState<'URGENT' | 'NORMAL'>('URGENT');

  // Compute live multi-item memo totals (Per-1,000 Brick Rate: (quantity / 1000) * rate)
  const computedItems = memoItems.map((row) => {
    const g =
      dbState.brickGrades.find((item) => item.id === row.gradeId) ||
      dbState.brickGrades[0];
    const defaultGradeRate = g?.ratePerUnit && g.ratePerUnit > 0 ? g.ratePerUnit : 11000;
    const qty = Math.max(0, parseNum(row.quantity));
    const parsedRate = parseNum(row.ratePerThousand, defaultGradeRate);
    const rate = row.ratePerThousand.trim() === '' ? defaultGradeRate : Math.max(0, parsedRate);
    const lineTotal = calculateRowTotal(qty, rate, true);
    return {
      gradeId: row.gradeId,
      gradeName: cleanBrickGradeName(g ? g.nameBn : '১ নং ইট'),
      quantity: qty,
      rate,
      ratePerThousand: true,
      lineTotal,
    };
  });

  const liveMemoCalc = calculateMultiItemMemoTotals({
    items: computedItems,
    discount: parseNum(memoDiscount),
    paidAmount: parseNum(memoPaid),
  });

  const handleUpdateMemoItem = (
    idx: number,
    patch: Partial<DraftMemoItem>,
    autoSyncPaid = true
  ) => {
    const next = memoItems.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, ...patch };
    });
    setMemoItems(next);
    if (autoSyncPaid) {
      const nextComputed = next.map((r) => {
        const g =
          dbState.brickGrades.find((item) => item.id === r.gradeId) ||
          dbState.brickGrades[0];
        const fallbackRate = g?.ratePerUnit && g.ratePerUnit > 0 ? g.ratePerUnit : 11000;
        const q = Math.max(0, parseNum(r.quantity));
        const rt =
          r.ratePerThousand.trim() === ''
            ? fallbackRate
            : Math.max(0, parseNum(r.ratePerThousand, fallbackRate));
        return calculateRowTotal(q, rt, true);
      });
      const nextSub = Math.round(nextComputed.reduce((a, b) => a + b, 0));
      const disc = Math.max(0, parseNum(memoDiscount));
      setMemoPaid(String(Math.max(0, nextSub - disc)));
    }
  };

  const handleAddMemoRow = () => {
    const fallbackGrade =
      dbState.brickGrades.find(
        (g) => !memoItems.some((row) => row.gradeId === g.id)
      ) || dbState.brickGrades[0];
    const newRow: DraftMemoItem = {
      gradeId: fallbackGrade.id,
      quantity: '1000',
      ratePerThousand: String(fallbackGrade.ratePerUnit || 11000),
    };
    const next = [...memoItems, newRow];
    setMemoItems(next);
    const nextComputed = next.map((r) => {
      const g =
        dbState.brickGrades.find((item) => item.id === r.gradeId) ||
        dbState.brickGrades[0];
      const fallbackRate = g?.ratePerUnit && g.ratePerUnit > 0 ? g.ratePerUnit : 11000;
      const q = Math.max(0, parseNum(r.quantity));
      const rt =
        r.ratePerThousand.trim() === ''
          ? fallbackRate
          : Math.max(0, parseNum(r.ratePerThousand, fallbackRate));
      return calculateRowTotal(q, rt, true);
    });
    const nextSub = Math.round(nextComputed.reduce((a, b) => a + b, 0));
    const disc = Math.max(0, parseNum(memoDiscount));
    setMemoPaid(String(Math.max(0, nextSub - disc)));
  };

  const handleRemoveMemoRow = (idx: number) => {
    if (memoItems.length <= 1) return;
    const next = memoItems.filter((_, i) => i !== idx);
    setMemoItems(next);
    const nextComputed = next.map((r) => {
      const g =
        dbState.brickGrades.find((item) => item.id === r.gradeId) ||
        dbState.brickGrades[0];
      const fallbackRate = g?.ratePerUnit && g.ratePerUnit > 0 ? g.ratePerUnit : 11000;
      const q = Math.max(0, parseNum(r.quantity));
      const rt =
        r.ratePerThousand.trim() === ''
          ? fallbackRate
          : Math.max(0, parseNum(r.ratePerThousand, fallbackRate));
      return calculateRowTotal(q, rt, true);
    });
    const nextSub = Math.round(nextComputed.reduce((a, b) => a + b, 0));
    const disc = Math.max(0, parseNum(memoDiscount));
    setMemoPaid(String(Math.max(0, nextSub - disc)));
  };

  const handleResetMemoForm = () => {
    const defaultGrade = dbState.brickGrades[0] || { id: 'grade-1', ratePerUnit: 11000 };
    setMemoNo(generateUniqueMemoNo(dbState.salesMemos).memoNo);
    setMemoCustomer('');
    setMemoPhone('');
    setMemoAddress('বাবুলিয়া, সাতক্ষীরা');
    setMemoDate(new Date().toISOString().slice(0, 10));
    setMemoVehicleType('ট্রাক (Truck)');
    setMemoTruck('সাতক্ষীরা-ট-১১-');
    setMemoDriver('');
    setMemoDriverPhone('');
    setMemoDeliveryStatus('DELIVERED');
    setMemoDuePromiseDate('');
    setMemoNote('');
    setMemoItems([
      {
        gradeId: defaultGrade.id,
        quantity: '',
        ratePerThousand: String(defaultGrade.ratePerUnit || 11000),
      },
    ]);
    setMemoDiscount('');
    setMemoPaid('');
    setMemoMethod('নগদ ক্যাশ');
  };

  const handleCreateMemoSubmit = async (
    e: React.FormEvent,
    printAfterSave = false
  ) => {
    e.preventDefault();
    if (!memoCustomer.trim()) {
      showToast('ক্রেতার নাম লিখুন।', 'error');
      const el = document.getElementById('memo-customer-input');
      el?.focus();
      return;
    }
    setCreatingMemo(true);
    try {
      const primaryItem = computedItems[0];
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoNo: memoNo.trim() || nextAutoMemoNo,
          customerName: memoCustomer.trim(),
          customerPhone: memoPhone.trim() || '—',
          customerAddress: memoAddress.trim() || 'বাবুলিয়া, সাতক্ষীরা',
          date: memoDate,
          vehicleType: memoVehicleType,
          truckNo: memoTruck.trim() || '—',
          driverName: memoDriver.trim() || '—',
          driverPhone: memoDriverPhone.trim() || '—',
          deliveryStatus: memoDeliveryStatus,
          duePromiseDate: memoDuePromiseDate,
          note: memoNote.trim(),
          items: computedItems,
          gradeId: primaryItem?.gradeId || 'grade-1',
          quantity: primaryItem?.quantity || 1000,
          rate: primaryItem?.rate || 11000,
          discount: parseNum(memoDiscount),
          paidAmount: parseNum(memoPaid),
          paymentMethod: memoMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'মেমো তৈরিতে ত্রুটি হয়েছে।', 'error');
        return;
      }
      applyEnrichedState(data);
      const nextMemo = data?.state?.salesMemos
        ? generateUniqueMemoNo(data.state.salesMemos).memoNo
        : nextAutoMemoNo;
      setMemoNo(nextMemo);
      setMemoCustomer('');
      setMemoPhone('');
      setMemoDriver('');
      setMemoDriverPhone('');
      setMemoDuePromiseDate('');
      setMemoNote('');
      setMemoDiscount('0');
      setIsNewMemoModalOpen(false);
      if (printAfterSave && data.memo) {
        setPrintMemoTarget(data.memo);
      }
      showToast(
        `নতুন ক্যাশ মেমো (${data.memo.memoNo}) সফলভাবে তৈরি ও স্টকে সমন্বয় হয়েছে!`
      );
    } finally {
      setCreatingMemo(false);
    }
  };

  const handleQuickExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNum(quickExpAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('খরচের সঠিক পরিমাণ লিখুন।', 'error');
      return;
    }
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'OUT',
        category: quickExpCategory,
        amount: amt,
        description: quickExpDesc.trim() || `${quickExpCategory} বাবদ তাৎক্ষণিক খরচ`,
        paymentMethod: 'নগদ ক্যাশ',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      setQuickExpAmount('');
      setQuickExpDesc('');
      showToast(
        `${quickExpCategory} খাতে ${formatCurrencyBn(amt)} খরচ ক্যাশ বুকে যোগ হয়েছে।`
      );
    }
  };

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: noteInput.trim(),
        priority: notePriority,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      setNoteInput('');
      showToast('জরুরি নোট সেভ করা হয়েছে।');
    }
  };

  const handleToggleNote = async (id: string, completed: boolean) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) applyEnrichedState(await res.json());
  };

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.ok) applyEnrichedState(await res.json());
  };

  const handleCollectDue = async (
    memoId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => {
    const res = await fetch(`/api/memos/${memoId}/collect-due`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paymentMethod, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'বকেয়া আদায়ে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(
      `বকেয়া ${formatCurrencyBn(amount)} সফলভাবে আদায় ও মেমোর বিস্তারিত রেকর্ডে যোগ হয়েছে!`
    );
  };

  const handleUpdateMemo = async (memoId: string, payload: Partial<SalesMemo>) => {
    const res = await fetch(`/api/memos/${memoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'মেমো আপডেট ব্যর্থ হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast('মেমো সফলভাবে সংশোধন করা হয়েছে।');
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!requireOwnerPermission()) return;
    const res = await fetch(`/api/memos/${memoId}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('মেমো ডিলিট ও ইট স্টক সমন্বয় করা হয়েছে।');
    }
  };

  const handleAddStock = async (
    gradeId: string,
    quantity: number,
    newRate?: number
  ) => {
    const res = await fetch('/api/inventory/add-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeId, quantity, newRate }),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      if (quantity > 0) {
        showToast(`ইট স্টকে +${formatBn(quantity)} পিস যোগ করা হয়েছে।`);
      } else if (newRate && newRate > 0) {
        showToast(`ইটের হাজার প্রতি দর ৳${formatBn(newRate)} সফলভাবে আপডেট করা হয়েছে।`);
      }
    }
  };

  // Production Handlers (3 Mills Pot, Chulli Van Load, Chulli Unload)
  const handleSaveMillPot = async (payload: {
    id?: string;
    millId: MillId;
    potNo: string;
    date: string;
    rawBricksCut: number;
    takenToChulli: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/mill-pot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(`মিল পট (${payload.potNo}) ও কাঁচা ইটের হিসাব সংরক্ষিত হয়েছে!`);
    } else {
      showToast(data.error || 'পট হিসাব সংরক্ষণে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteMillPot = async (id: string) => {
    const res = await fetch(`/api/production/mill-pot/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('মিল পট এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveChulliLoad = async (payload: {
    id?: string;
    date: string;
    sardarName: string;
    rawBricksLoaded: number;
    pakaBricksLoaded?: number;
    ratePerVan: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/chulli-load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      const loadsList = data?.state?.chulliLoads || data?.chulliLoads || [];
      const totalLoaded = loadsList.reduce(
        (s: number, l: { totalBricksLoaded?: number; rawBricksLoaded?: number; pakaBricksLoaded?: number }) =>
          s +
          (l.totalBricksLoaded !== undefined
            ? Number(l.totalBricksLoaded) || 0
            : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
        0
      );
      const fullLines = Math.floor(totalLoaded / 4000);
      const partialBricks = totalLoaded % 4000;
      setEnterpriseState((prev) => {
        const currentSys = prev.lineSystem || createDefaultFeedKilnLineSystem();
        const effectiveTotal = Math.max(
          0,
          totalLoaded - (currentSys.vanBricksBaselineOffset || 0)
        );
        const effectiveFullLines = Math.floor(effectiveTotal / 4000);
        const alreadyFiredOrUnloaded = Math.max(
          currentSys.firedLinesCompleted || 0,
          currentSys.unloadedLinesBehind || 0
        );
        const nextRawAhead = Math.max(
          0,
          effectiveFullLines - alreadyFiredOrUnloaded - (currentSys.activeFiringLinesCount || 0)
        );
        const nextEnt: EnterpriseOperationsState = {
          ...prev,
          lineSystem: {
            ...currentSys,
            rawLinesLoadedAhead: nextRawAhead,
            lineOverrides: {},
          },
        };
        try {
          localStorage.setItem('sbl_enterprise_ops_state_v2_zero', JSON.stringify(nextEnt));
        } catch {
          // ignore
        }
        return nextEnt;
      });
      const totalBatchBricks = payload.rawBricksLoaded + (payload.pakaBricksLoaded || 0);
      const brickDetailStr =
        payload.pakaBricksLoaded && payload.pakaBricksLoaded > 0
          ? `${formatBn(totalBatchBricks)} পিস (কাঁচা ${formatBn(payload.rawBricksLoaded)} + চেম্বার পাকা ${formatBn(payload.pakaBricksLoaded)})`
          : `${formatBn(totalBatchBricks)} পিস কাঁচা ইট`;
      showToast(
        `${payload.sardarName}-এর ভ্যান লোড (${brickDetailStr}) সংরক্ষিত — চিমনিতে লোড সাকসেসফুল: মোট ${formatBn(fullLines)}টি লাইন${
          partialBricks > 0 ? ` + পরের লাইনে ${formatBn(partialBricks)} ইট` : ''
        }!`
      );
    } else {
      showToast(data.error || 'চুল্লি লোড এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteChulliLoad = async (id: string) => {
    const res = await fetch(`/api/production/chulli-load/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      applyEnrichedState(data);
      const loadsList = data?.state?.chulliLoads || data?.chulliLoads || [];
      const totalLoaded = loadsList.reduce(
        (s: number, l: { totalBricksLoaded?: number; rawBricksLoaded?: number; pakaBricksLoaded?: number }) =>
          s +
          (l.totalBricksLoaded !== undefined
            ? Number(l.totalBricksLoaded) || 0
            : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
        0
      );
      setEnterpriseState((prev) => {
        const currentSys = prev.lineSystem || createDefaultFeedKilnLineSystem();
        const effectiveTotal = Math.max(
          0,
          totalLoaded - (currentSys.vanBricksBaselineOffset || 0)
        );
        const effectiveFullLines = Math.floor(effectiveTotal / 4000);
        const alreadyFiredOrUnloaded = Math.max(
          currentSys.firedLinesCompleted || 0,
          currentSys.unloadedLinesBehind || 0
        );
        const nextRawAhead = Math.max(
          0,
          effectiveFullLines - alreadyFiredOrUnloaded - (currentSys.activeFiringLinesCount || 0)
        );
        const nextEnt: EnterpriseOperationsState = {
          ...prev,
          lineSystem: {
            ...currentSys,
            rawLinesLoadedAhead: nextRawAhead,
            lineOverrides: {},
          },
        };
        try {
          localStorage.setItem('sbl_enterprise_ops_state_v2_zero', JSON.stringify(nextEnt));
        } catch {
          // ignore
        }
        return nextEnt;
      });
      showToast('ভ্যান লোড এন্ট্রি মুছে ফেলা হয়েছে ও চিমনি লাইন আপডেট হয়েছে।');
    }
  };

  const handleSaveChulliUnload = async (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    linesUnloaded?: number;
    bricksPerLine?: number;
    ratePerLine?: number;
    ratePerThousand: number;
    unloadedByGrade?: UnloadedGradeItem[];
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/chulli-unload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      const loadsList = data?.state?.chulliLoads || data?.chulliLoads || [];
      const totalLoadedBricksNow = loadsList.reduce(
        (s: number, l: { totalBricksLoaded?: number; rawBricksLoaded?: number; pakaBricksLoaded?: number }) =>
          s +
          (l.totalBricksLoaded !== undefined
            ? Number(l.totalBricksLoaded) || 0
            : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
        0
      );
      const unloadsList = data?.state?.chulliUnloads || data?.chulliUnloads || [];
      const totalUnloadedLinesNow = unloadsList.reduce(
        (s: number, u: { linesUnloaded?: number; totalBricksUnloaded?: number }) =>
          s +
          (Number(u.linesUnloaded) > 0
            ? Number(u.linesUnloaded)
            : Math.round((Number(u.totalBricksUnloaded) || 0) / 4000)),
        0
      );
      const updatedStockTotal =
        data?.metrics?.totalBrickStockPieces ??
        (data?.state?.brickGrades || []).reduce(
          (s: number, g: { currentStock?: number }) => s + (Number(g.currentStock) || 0),
          0
        );
      const entryLinesCount =
        payload.linesUnloaded && payload.linesUnloaded > 0
          ? payload.linesUnloaded
          : payload.unloadedByGrade && payload.unloadedByGrade.length > 0
          ? Math.max(
              1,
              Math.round(
                payload.unloadedByGrade.reduce((s, i) => s + i.quantity, 0) /
                  (payload.bricksPerLine || 4000)
              )
            )
          : 0;

      let generatedConfirmation: AutoUnloadConfirmationRecord | null = null;
      setEnterpriseState((prev) => {
        const currentSys = prev.lineSystem || createDefaultFeedKilnLineSystem();
        const effectiveUnloaded = Math.max(
          0,
          totalUnloadedLinesNow - (currentSys.unloadLinesBaselineOffset || 0)
        );
        const effectiveLoadedBricks = Math.max(
          0,
          totalLoadedBricksNow - (currentSys.vanBricksBaselineOffset || 0)
        );
        const effectiveLoadedFullLines = Math.floor(effectiveLoadedBricks / 4000);
        const prevUnloaded = currentSys.unloadedLinesBehind || 0;
        const deltaUnloaded = Math.max(0, effectiveUnloaded - prevUnloaded);
        const nextFired = Math.max(currentSys.firedLinesCompleted || 0, effectiveUnloaded);
        // Automatic confirmation step: reset activeFiringLinesCount to 0 and highlight cleared lines on the 208-line map
        const nextActiveFiringLinesCount = 0;
        const nextRawAhead =
          effectiveLoadedFullLines > 0
            ? Math.max(0, effectiveLoadedFullLines - nextFired - nextActiveFiringLinesCount)
            : Math.max(0, (currentSys.rawLinesLoadedAhead || 0) - deltaUnloaded);

        if (entryLinesCount > 0 || deltaUnloaded > 0) {
          generatedConfirmation = buildAutoUnloadConfirmation({
            sardarName: payload.sardarName || 'নজরুল সর্দার',
            chamberOrRound: payload.chamberOrRound || 'রাউন্ড-০১',
            fireStartLineNo: currentSys.fireStartLineNo || 1,
            previousUnloadedLines: prevUnloaded,
            effectiveUnloadedLines: effectiveUnloaded,
            linesUnloadedInEntry: entryLinesCount > 0 ? entryLinesCount : deltaUnloaded,
            bricksPerLine: payload.bricksPerLine || 4000,
            updatedStockPieces: updatedStockTotal,
            totalLines: 208,
          });
        }

        const nextEnt: EnterpriseOperationsState = {
          ...prev,
          lineSystem: {
            ...currentSys,
            unloadedLinesBehind: effectiveUnloaded,
            firedLinesCompleted: nextFired,
            activeFiringLinesCount: nextActiveFiringLinesCount,
            rawLinesLoadedAhead: nextRawAhead,
            recentlyClearedLines: generatedConfirmation
              ? generatedConfirmation.clearedLineNumbers
              : currentSys.recentlyClearedLines || [],
            lastAutoUnloadConfirmation:
              generatedConfirmation || currentSys.lastAutoUnloadConfirmation || null,
            lineOverrides: {},
          },
        };
        try {
          localStorage.setItem('sbl_enterprise_ops_state_v2_zero', JSON.stringify(nextEnt));
        } catch {
          // ignore
        }
        return nextEnt;
      });
      if (generatedConfirmation) {
        setAutoUnloadConfirmation(generatedConfirmation);
      }
      if (payload.linesUnloaded && payload.linesUnloaded > 0) {
        const totalBricks = Math.round(
          payload.linesUnloaded * (payload.bricksPerLine || 4000)
        );
        showToast(
          `✅ অটো কনফার্মেশন (${payload.sardarName || 'নজরুল সর্দার'}): ${formatBn(payload.linesUnloaded)} লাইন (${formatBn(totalBricks)} পিস) আনলোড — ২০৮-লাইন ম্যাপে ক্লিয়ার লাইন হাইলাইট ও Active Firing রিসেট হয়েছে (স্টক: ${formatBn(updatedStockTotal)} পিস)!`
        );
      } else if (payload.unloadedByGrade && payload.unloadedByGrade.length > 0) {
        const totalAdded = payload.unloadedByGrade.reduce(
          (s, i) => s + i.quantity,
          0
        );
        showToast(
          `✅ চুল্লি থেকে ${formatBn(totalAdded)} পিস পোড়ানো ইট আনলোড হয়ে স্টকে যোগ হয়েছে (বর্তমান স্টক: ${formatBn(updatedStockTotal)} পিস)!`
        );
      } else {
        showToast('আনলোড বাবদ জমা টাকা খতিয়ান ও ক্যাশ বুকে সংরক্ষিত হয়েছে!');
      }
    } else {
      showToast(data.error || 'চুল্লি আনলোড এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteChulliUnload = async (id: string) => {
    const res = await fetch(`/api/production/chulli-unload/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      applyEnrichedState(data);
      const loadsList = data?.state?.chulliLoads || data?.chulliLoads || [];
      const totalLoadedBricksNow = loadsList.reduce(
        (s: number, l: { totalBricksLoaded?: number; rawBricksLoaded?: number; pakaBricksLoaded?: number }) =>
          s +
          (l.totalBricksLoaded !== undefined
            ? Number(l.totalBricksLoaded) || 0
            : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
        0
      );
      const unloadsList = data?.state?.chulliUnloads || data?.chulliUnloads || [];
      const totalUnloadedLinesNow = unloadsList.reduce(
        (s: number, u: { linesUnloaded?: number; totalBricksUnloaded?: number }) =>
          s +
          (Number(u.linesUnloaded) > 0
            ? Number(u.linesUnloaded)
            : Math.round((Number(u.totalBricksUnloaded) || 0) / 4000)),
        0
      );
      setEnterpriseState((prev) => {
        const currentSys = prev.lineSystem || createDefaultFeedKilnLineSystem();
        const effectiveUnloaded = Math.max(
          0,
          totalUnloadedLinesNow - (currentSys.unloadLinesBaselineOffset || 0)
        );
        const effectiveLoadedBricks = Math.max(
          0,
          totalLoadedBricksNow - (currentSys.vanBricksBaselineOffset || 0)
        );
        const effectiveLoadedFullLines = Math.floor(effectiveLoadedBricks / 4000);
        const nextRawAhead =
          effectiveLoadedFullLines > 0
            ? Math.max(0, effectiveLoadedFullLines - effectiveUnloaded)
            : currentSys.rawLinesLoadedAhead || 0;
        const nextEnt: EnterpriseOperationsState = {
          ...prev,
          lineSystem: {
            ...currentSys,
            unloadedLinesBehind: effectiveUnloaded,
            firedLinesCompleted: effectiveUnloaded,
            activeFiringLinesCount: 0,
            rawLinesLoadedAhead: nextRawAhead,
            recentlyClearedLines: [],
            lastAutoUnloadConfirmation: null,
            lineOverrides: {},
          },
        };
        try {
          localStorage.setItem('sbl_enterprise_ops_state_v2_zero', JSON.stringify(nextEnt));
        } catch {
          // ignore
        }
        return nextEnt;
      });
      setAutoUnloadConfirmation(null);
      showToast('আনলোড এন্ট্রি মুছে ফেলা হয়েছে — চুল্লির লাইন ও পাকা ইট স্টক সমন্বয় হয়েছে।');
    }
  };

  const handleSavePoraiMistri = async (payload: {
    id?: string;
    date: string;
    mistriName: string;
    chamberOrRound: string;
    mistriCount?: number;
    monthsCount?: number;
    monthlyRatePerMistri?: number;
    contractTotalBill?: number;
    bricksFired: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/porai-mistri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `পোড়াই মিস্ত্রি (${payload.mistriName})-এর মোট বিল ও সাপ্তাহিক টাকা সংরক্ষিত হয়েছে!`
      );
    } else {
      showToast(data.error || 'পোড়াই মিস্ত্রি এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeletePoraiMistri = async (id: string) => {
    const res = await fetch(`/api/production/porai-mistri/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('পোড়াই মিস্ত্রি এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveRubbish = async (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    roundBill: number;
    paidAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/production/rubbish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `রাবিশ সর্দার (${payload.sardarName})-এর রাউন্ড ও খোরাকি হিসাব সংরক্ষিত হয়েছে!`
      );
    } else {
      showToast(data.error || 'রাবিশ সর্দার এন্ট্রিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleDeleteRubbish = async (id: string) => {
    const res = await fetch(`/api/production/rubbish/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('রাবিশ সর্দার এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleDeleteProductionPayment = async (id: string) => {
    const res = await fetch(`/api/production/payment-record/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('টাকা জমা দেওয়ার রেকর্ড মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveWorkerProfile = async (payload: {
    id?: string;
    name: string;
    role: string;
    phone: string;
    morningRate: number;
    afternoonRate: number;
  }) => {
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast(`${payload.name}-এর প্রোফাইল ও শিফট রেট সংরক্ষিত হয়েছে।`);
    }
  };

  const handleToggleWorkerHajira = async (payload: {
    workerId: string;
    date: string;
    morningPresent: boolean;
    afternoonPresent: boolean;
    morningRate: number;
    afternoonRate: number;
    note?: string;
  }) => {
    const res = await fetch('/api/workers/hajira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      const earned =
        (data.attendance.morningAmount || 0) + (data.attendance.afternoonAmount || 0);
      showToast(
        `${data.attendance.workerName}-এর সবুজ হাজিরা আপডেট হয়েছে (আজকের বিল: ${formatCurrencyBn(earned)})`
      );
    } else {
      showToast(data.error || 'হাজিরা আপডেট করতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handlePayWorker = async (payload: {
    workerId: string;
    amount: number;
    paymentType: string;
    date: string;
    note: string;
  }) => {
    const res = await fetch('/api/workers/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `${data.attendance.workerName}-কে ${formatCurrencyBn(
          data.attendance.totalPaid
        )} জমা দেওয়া হয়েছে ও ক্যাশ খরচে যুক্ত হয়েছে!`
      );
    } else {
      showToast(data.error || 'লেবার টাকা জমা দিতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleSaveWorkerAttendance = async (payload: {
    workerId: string;
    morningPresent: boolean;
    afternoonPresent: boolean;
    customMorningRate: number;
    customAfternoonRate: number;
    khorakiAmount: number;
    hatbarAmount: number;
    note: string;
  }) => {
    const res = await fetch('/api/workers/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyEnrichedState(data);
      showToast(
        `${data.attendance.workerName}-এর হাজিরা ও পেমেন্ট (${formatCurrencyBn(
          data.attendance.totalPaid
        )}) ক্যাশ খরচে যুক্ত হয়েছে!`
      );
    }
  };

  const handleAddCashTx = async (payload: {
    type: CashTxType;
    category: string;
    amount: number;
    description: string;
    paymentMethod: PaymentMethod;
  }) => {
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast(
        `ক্যাশ বুকে ${payload.category} (${formatCurrencyBn(payload.amount)}) সংরক্ষিত হয়েছে।`
      );
    }
  };

  const handleUpdateCashTx = async (
    id: string,
    payload: {
      type?: CashTxType;
      category?: string;
      amount?: number;
      description?: string;
      paymentMethod?: PaymentMethod;
      date?: string;
    }
  ) => {
    const res = await fetch(`/api/cash/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ক্যাশ লেনদেন আপডেট করতে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(`ক্যাশ লেনদেন (${payload.category || ''} - ${formatCurrencyBn(payload.amount || 0)}) আপডেট হয়েছে।`);
  };

  const handleDeleteCashTx = async (id: string) => {
    if (!requireOwnerPermission()) return;
    const res = await fetch(`/api/cash/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('ক্যাশ বুক লেনদেন মুছে ফেলা হয়েছে।');
    }
  };

  const handleExportDatabase = () => {
    try {
      const fullBackupBundle = {
        ...dbState,
        __sblFullBackupVersion: 2,
        __exportedAt: new Date().toISOString(),
        enterpriseState,
        firingRounds,
        dismissedAlertIds,
      };
      const blob = new Blob([JSON.stringify(fullBackupBundle, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SBL-Bhatar-Backup-${todayDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('সম্পূর্ণ ভাটার সব হিসাব ও ২০৮-লাইন ম্যাপের ব্যাকআপ ডাউনলোড হয়েছে!');
    } catch {
      window.location.href = '/api/backup/export';
      showToast('ডাটাবেস ব্যাকআপ JSON ডাউনলোড শুরু হয়েছে।');
    }
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const dbPayload = parsed?.dbState
        ? parsed.dbState
        : parsed?.state
        ? parsed.state
        : parsed;
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে।', 'error');
        return;
      }
      applyEnrichedState(data);

      // Immediately sync the restored state to Google Firebase Firestore
      if (data?.state) {
        saveStateToFirestore(data.state).catch((fbErr) => {
          console.warn('Firestore cloud sync after file import warning:', fbErr);
        });
      }

      // Also restore 208-line & damper map, land lease, wastage, staff salaries, and firing rounds if present
      if (parsed?.enterpriseState && typeof parsed.enterpriseState === 'object') {
        setEnterpriseState(parsed.enterpriseState);
        try {
          localStorage.setItem(
            'sbl_enterprise_ops_state_v2_zero',
            JSON.stringify(parsed.enterpriseState)
          );
        } catch {
          // ignore
        }
      }
      if (Array.isArray(parsed?.firingRounds)) {
        setFiringRounds(parsed.firingRounds);
        try {
          localStorage.setItem(
            'sbl_firing_rounds_v2_zero',
            JSON.stringify(parsed.firingRounds)
          );
        } catch {
          // ignore
        }
      }
      if (Array.isArray(parsed?.dismissedAlertIds)) {
        setDismissedAlertIds(parsed.dismissedAlertIds);
      }

      showToast('ব্যাকআপ ফাইল থেকে সম্পূর্ণ ডাটাবেস ও ২০৮-লাইন ম্যাপ সফলভাবে রিস্টোর হয়েছে!');
    } catch {
      showToast('সঠিক JSON ব্যাকআপ ফাইল নির্বাচন করুন।', 'error');
    } finally {
      e.target.value = '';
      setEdittargetToClear();
    }
  };

  function setEdittargetToClear() {
    // helper no-op
  }

  const handleResetAllData = async () => {
    if (!requireOwnerPermission()) return;
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        applyEnrichedState(data);
      }
    } catch {
      // ignore network error
    }
    const emptyEnt = createEmptyEnterpriseState(todayDate);
    setEnterpriseState(emptyEnt);
    setFiringRounds([]);
    setDismissedAlertIds([]);
    try {
      localStorage.removeItem('kb_memos');
      localStorage.removeItem('sbl_live_master_db_backup_v1');
      localStorage.removeItem('sbl_enterprise_ops_state_v1');
      localStorage.removeItem('sbl_firing_rounds_v1');
      localStorage.removeItem('sbl_dismissed_alerts_v1');
      localStorage.removeItem('sbl_enterprise_ops_state_v2_zero');
      localStorage.removeItem('sbl_firing_rounds_v2_zero');
      localStorage.removeItem('sbl_dismissed_alerts_v2_zero');
    } catch {
      // ignore
    }
    await clearAllSnapshotsFromIndexedDb();
    setSavedSnapshots([]);
    setIsDataResetModalOpen(false);
    showToast(
      isEn
        ? 'All kiln data has been reset to 0!'
        : 'সম্পূর্ণ ভাটা ডাটাবেস রিসেট করে সকল হিসাব 0 (শূন্য) করা হয়েছে!'
    );
  };

  const handleSubmitDelivery = async (payload: {
    memoId?: string;
    memoNo: string;
    gradeId: string;
    quantity: number;
    date: string;
    truckNo?: string;
    driverName?: string;
    vehicleType?: string;
    note?: string;
  }): Promise<boolean> => {
    const res = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ডেলিভারি এন্ট্রি করতে সমস্যা হয়েছে।', 'error');
      return false;
    }
    applyEnrichedState(data);
    showToast(
      `মেমো #${data.delivery?.memoNo || payload.memoNo}-এ ${formatBn(
        payload.quantity
      )} পিস ইট ডেলিভারি সফলভাবে সাবমিট হয়েছে!`
    );
    return true;
  };

  const handleDeleteDelivery = async (deliveryId: string) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('ইট ডেলিভারি রেকর্ড মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveSeason = async (payload: {
    id?: string;
    nameBn: string;
    nameEn?: string;
    startDate: string;
    endDate: string;
    kilnIds: string[];
    damageOrAdjustmentBricks?: number;
    openingStockOverride?: number | '';
    openingCashOverride?: number | '';
    reasonBn?: string;
  }) => {
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('ভাটা সিজন সফলভাবে সংরক্ষণ করা হয়েছে।');
    } else {
      const err = await res.json().catch(() => ({ error: 'সিজন সংরক্ষণে ত্রুটি।' }));
      showToast(err.error || 'সিজন সংরক্ষণে ত্রুটি।', 'error');
    }
  };

  const handleCloseSeason = async (
    seasonId: string,
    payload: { closingNoteBn: string; damageOrAdjustmentBricks?: number }
  ) => {
    const res = await fetch(`/api/seasons/${seasonId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('সিজন ক্লোজিং সম্পন্ন হয়েছে (মূল লেনদেন অক্ষুণ্ণ রয়েছে)।');
    } else {
      const err = await res.json().catch(() => ({ error: 'সিজন ক্লোজিংয়ে ত্রুটি।' }));
      showToast(err.error || 'সিজন ক্লোজিংয়ে ত্রুটি।', 'error');
    }
  };

  const handleReopenSeason = async (
    seasonId: string,
    payload: { reasonBn: string; damageOrAdjustmentBricks?: number }
  ) => {
    const res = await fetch(`/api/seasons/${seasonId}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('সিজন পুনরায় চালু (Reopened) করা হয়েছে।');
    } else {
      const err = await res.json().catch(() => ({ error: 'সিজন পুনরায় চালু করতে ত্রুটি।' }));
      showToast(err.error || 'সিজন পুনরায় চালু করতে ত্রুটি।', 'error');
    }
  };

  const handleSaveWoodFuel = async (payload: {
    id?: string;
    date: string;
    supplierName: string;
    supplierPhone?: string;
    woodType: string;
    vehicleOrChallan?: string;
    quantity: number;
    unit: string;
    ratePerUnit: number;
    paidAmount: number;
    paymentMethod?: PaymentMethod;
    note?: string;
  }) => {
    const res = await fetch('/api/production/wood-fuel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'জ্বালানি কাঠের হিসাব সেভ করতে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(
      `${payload.supplierName}-এর ${formatBn(payload.quantity)} ${payload.unit} কাঠের হিসাব (@ ৳${formatBn(payload.ratePerUnit)}) সেভ করা হয়েছে!`
    );
  };

  const handlePayWoodSupplier = async (payload: {
    recordId?: string;
    supplierName: string;
    amount: number;
    date: string;
    paymentMethod?: PaymentMethod;
    note?: string;
  }) => {
    const res = await fetch('/api/production/wood-fuel/pay-supplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'জ্বালানি পেমেন্ট দিতে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast(
      `${payload.supplierName}-কে ${formatCurrencyBn(payload.amount)} জ্বালানি পেমেন্ট প্রদান ও ক্যাশ বুকে যুক্ত হয়েছে!`
    );
  };

  const handleDeleteWoodFuel = async (id: string) => {
    const res = await fetch(`/api/production/wood-fuel/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('জ্বালানি কাঠের রেকর্ড মুছে ফেলা হয়েছে।');
    }
  };

  // Handlers for the 5 Advanced Kiln Ledgers
  const handleSaveSoilCoal = async (payload: Partial<SoilCoalRecord>) => {
    const res = await fetch('/api/ledgers/soil-coal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'মাটি/কয়লা হিসাব সংরক্ষণে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('মাটি ও কয়লা সাপ্লায়ার খাতায় এন্ট্রি সংরক্ষিত হয়েছে!');
  };

  const handleDeleteSoilCoal = async (id: string) => {
    const res = await fetch(`/api/ledgers/soil-coal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('মাটি/কয়লা এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveDadon = async (payload: Partial<DadonAdvanceRecord>) => {
    const res = await fetch('/api/ledgers/dadon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'দাদন হিসাব সংরক্ষণে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('সর্দার ও মিস্ত্রি দাদন খাতায় এন্ট্রি সংরক্ষিত হয়েছে!');
  };

  const handleDeleteDadon = async (id: string) => {
    const res = await fetch(`/api/ledgers/dadon/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('দাদন এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveAdvanceBooking = async (payload: Partial<AdvanceBrickBooking>) => {
    const res = await fetch('/api/ledgers/advance-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'অগ্রিম ইট বুকিং সংরক্ষণে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('নতুন অগ্রিম ইট বুকিং সংরক্ষিত হয়েছে!');
  };

  const handleUpdateAdvanceBooking = async (
    id: string,
    payload: { addedDeliveredQuantity?: number; addedPaymentAmount?: number }
  ) => {
    const res = await fetch(`/api/ledgers/advance-booking/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'বুকিং আপডেটে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('বুকিং ডেলিভারি ও জমার হিসাব আপডেট হয়েছে!');
  };

  const handleDeleteAdvanceBooking = async (id: string) => {
    const res = await fetch(`/api/ledgers/advance-booking/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('অগ্রিম ইট বুকিং মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveVehicleDiesel = async (payload: Partial<VehicleDieselRecord>) => {
    const res = await fetch('/api/ledgers/vehicle-diesel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'গাড়ি/ভেকু হিসাব সংরক্ষণে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('ট্রাক, ট্রলি ও ভেকু ডিজেল হিসাব সংরক্ষিত হয়েছে!');
  };

  const handleDeleteVehicleDiesel = async (id: string) => {
    const res = await fetch(`/api/ledgers/vehicle-diesel/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('গাড়ি/ভেকু ডিজেল এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveCompliance = async (payload: Partial<ComplianceInstallmentRecord>) => {
    const res = await fetch('/api/ledgers/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'লাইসেন্স/কিস্তি সংরক্ষণে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('লাইসেন্স, ভ্যাট ও কিস্তি রেকর্ড সংরক্ষিত হয়েছে!');
  };

  const handleUpdateCompliance = async (id: string, payload: { addedPaymentAmount: number }) => {
    const res = await fetch(`/api/ledgers/compliance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'কিস্তি পরিশোধ আপডেটে সমস্যা হয়েছে।');
    applyEnrichedState(data);
    showToast('কিস্তি / সরকারি ফি পরিশোধ ক্যাশবুকে যুক্ত হয়েছে!');
  };

  const handleDeleteCompliance = async (id: string) => {
    const res = await fetch(`/api/ledgers/compliance/${id}`, { method: 'DELETE' });
    if (res.ok) {
      applyEnrichedState(await res.json());
      showToast('লাইসেন্স/কিস্তি এন্ট্রি মুছে ফেলা হয়েছে।');
    }
  };

  const handleSaveLandLease = useCallback(
    async (lease: LandLeaseContractRecord) => {
      const exists = (enterpriseState.landLeases || []).some((l) => l.id === lease.id);
      const nextLeases = exists
        ? (enterpriseState.landLeases || []).map((l) => (l.id === lease.id ? lease : l))
        : [lease, ...(enterpriseState.landLeases || [])];
      const next: EnterpriseOperationsState = {
        ...enterpriseState,
        landLeases: nextLeases,
      };
      handleUpdateEnterpriseState(next);
      showToast('জমির লিজ চুক্তি সফলভাবে সংরক্ষিত হয়েছে!');
    },
    [enterpriseState, handleUpdateEnterpriseState, showToast]
  );

  const handleAddLandTruckTrip = useCallback(
    async (lease: LandLeaseContractRecord, addedTrucks: number) => {
      const next: EnterpriseOperationsState = {
        ...enterpriseState,
        landLeases: (enterpriseState.landLeases || []).map((l) =>
          l.id === lease.id
            ? {
                ...l,
                deliveredTrucks: Math.max(0, (l.deliveredTrucks || 0) + addedTrucks),
              }
            : l
        ),
      };
      handleUpdateEnterpriseState(next);
      showToast(`জমির গাড়ির ট্রিপ (+${addedTrucks}) সফলভাবে যোগ হয়েছে!`);
    },
    [enterpriseState, handleUpdateEnterpriseState, showToast]
  );

  const handleDeleteLandLease = useCallback(
    async (id: string) => {
      const next: EnterpriseOperationsState = {
        ...enterpriseState,
        landLeases: (enterpriseState.landLeases || []).filter((l) => l.id !== id),
      };
      handleUpdateEnterpriseState(next);
      showToast('জমির লিজ চুক্তি মুছে ফেলা হয়েছে।');
    },
    [enterpriseState, handleUpdateEnterpriseState, showToast]
  );

  const handleLandLeasePayment = useCallback(
    async (
      leaseId: string,
      amount: number,
      paymentMethod: PaymentMethod,
      note: string
    ) => {
      const lease = (enterpriseState.landLeases || []).find((l) => l.id === leaseId);
      if (!lease) return;
      const nextLeases = (enterpriseState.landLeases || []).map((l) =>
        l.id === leaseId
          ? {
              ...l,
              paidAmount: (l.paidAmount || 0) + amount,
            }
          : l
      );
      const next: EnterpriseOperationsState = {
        ...enterpriseState,
        landLeases: nextLeases,
      };
      handleUpdateEnterpriseState(next);

      // Record to Cash Book as Expense
      await handleAddCashTx({
        type: 'OUT',
        category: 'মাটি ও জমি লিজ পরিশোধ',
        amount,
        description: `জমির লিজ কিস্তি পরিশোধ: ${lease.landownerName} (${lease.mouzaOrLocation}) ${note ? `- ${note}` : ''}`,
        paymentMethod,
      });

      showToast(
        `মালিক "${lease.landownerName}"-কে ${formatCurrencyBn(amount)} পরিশোধ সংরক্ষিত হয়েছে এবং ক্যাশ বুকে যুক্ত হয়েছে!`
      );
    },
    [enterpriseState, handleUpdateEnterpriseState, handleAddCashTx, showToast]
  );

  const handleSaveSettingsPatch = async (patch: {
    dailyGoals?: DailyKilnGoals;
    estimatedCostOverrides?: EstimatedCostOverrides;
  }) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...dbState.settings,
        ...patch,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'সেটিংস সেভ করতে সমস্যা হয়েছে।', 'error');
      return;
    }
    applyEnrichedState(data);
    showToast('ভাটা সেটিংস ও টার্গেট সংরক্ষিত হয়েছে!');
  };

  const totalDeliveryTripsCount = useMemo(
    () =>
      (dbState.memoDeliveries || []).length > 0
        ? (dbState.memoDeliveries || []).length
        : dbState.salesMemos.reduce(
            (s, m) => s + (Array.isArray(m.deliveryHistory) ? m.deliveryHistory.length : 0),
            0
          ),
    [dbState.memoDeliveries, dbState.salesMemos]
  );

  const dueTagadaReport = useMemo(
    () =>
      computeDueTagadaList(
        dbState.salesMemos,
        dbState.advanceBookings || [],
        metrics.todayDate,
        dbState.settings.bhataName || 'সোনালী ব্রিকস (SBL)'
      ),
    [dbState.salesMemos, dbState.advanceBookings, metrics.todayDate, dbState.settings.bhataName]
  );
  const dailyGoalStats = useMemo(
    () => computeDailyGoalProgress(dbState, metrics.todayDate),
    [dbState, metrics.todayDate]
  );

  const smartAlertReport = useMemo(
    () =>
      computeSmartKilnAlerts(
        dbState,
        firingRounds,
        benchmarkCoalPerLakhTons,
        metrics.todayDate,
        dismissedAlertIds
      ),
    [
      dbState,
      firingRounds,
      benchmarkCoalPerLakhTons,
      metrics.todayDate,
      dismissedAlertIds,
    ]
  );

  const handleDismissSmartAlert = useCallback((alertId: string) => {
    setDismissedAlertIds((prev) => {
      const next = prev.includes(alertId) ? prev : [...prev, alertId];
      try {
        localStorage.setItem('sbl_dismissed_alerts_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleResetDismissedSmartAlerts = useCallback(() => {
    setDismissedAlertIds([]);
    try {
      localStorage.removeItem('sbl_dismissed_alerts_v1');
    } catch {
      // ignore
    }
  }, []);

  const handleAddCustomUrgentReminder = useCallback(
    async (payload: { title: string; text: string; date: string }) => {
      const combinedText = `${payload.title} — ${payload.text} (নির্ধারিত তারিখ: ${payload.date})`;
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          text: combinedText,
          priority: 'URGENT',
          date: payload.date,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        applyEnrichedState(data);
        showToast('নতুন জরুরি রিমাইন্ডার অ্যালার্ট সেন্টারে যুক্ত হয়েছে!');
      }
    },
    [applyEnrichedState, showToast]
  );

  const navItems: Array<{
    id: NavigationTab;
    labelBn: string;
    labelEn: string;
    descBn: string;
    descEn: string;
    groupBn: string;
    groupEn: string;
    icon: React.ReactNode;
    countBn?: string;
    badgeColor?: string;
  }> = [
    // Group 1: মূল ড্যাশবোর্ড ও বিক্রয়
    {
      id: 'dashboard',
      labelBn: 'ড্যাশবোর্ড ও মেমো',
      labelEn: 'Dashboard & Memo',
      descBn: 'সকল সেকশনের শর্টকাট ও লাইভ সামারি',
      descEn: 'All section shortcuts & live summary',
      groupBn: '১. মূল ড্যাশবোর্ড ও বিক্রয়',
      groupEn: '1. Core Dashboard & Sales',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-orange-400" />,
      badgeColor: 'border-t-orange-600',
    },
    {
      id: 'memos',
      labelBn: 'মেমো খতিয়ান',
      labelEn: 'Memo Ledger',
      descBn: 'ডিজিটাল ক্যাশ মেমো, সার্চ ও বকেয়া আদায়',
      descEn: 'Digital cash memos, search & due collection',
      groupBn: '১. মূল ড্যাশবোর্ড ও বিক্রয়',
      groupEn: '1. Core Dashboard & Sales',
      icon: <BookOpen className="w-4 h-4 shrink-0 text-orange-400" />,
      countBn: formatBn(dbState.salesMemos.length),
      badgeColor: 'border-t-orange-600',
    },
    {
      id: 'delivery_hisab',
      labelBn: 'ইট ডেলিভারি হিসাব',
      labelEn: 'Brick Delivery',
      descBn: 'মেমো ভিত্তিক গাড়ি ও ইট ডেলিভারি খতিয়ান',
      descEn: 'Memo-wise truck & brick delivery register',
      groupBn: '১. মূল ড্যাশবোর্ড ও বিক্রয়',
      groupEn: '1. Core Dashboard & Sales',
      icon: <PackageCheck className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: formatBn(totalDeliveryTripsCount),
      badgeColor: 'border-t-emerald-600',
    },
    {
      id: 'bricks',
      labelBn: 'ইট ও স্টক রিপোর্ট',
      labelEn: 'Bricks & Stock',
      descBn: 'পোড়ানো ইটের গ্রেড স্টক, দর ও আদলা সমন্বয়',
      descEn: 'Fired brick grade stock, rates & bat reconciliation',
      groupBn: '১. মূল ড্যাশবোর্ড ও বিক্রয়',
      groupEn: '1. Core Dashboard & Sales',
      icon: <Layers className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: formatBn(dbState.brickGrades.length),
      badgeColor: 'border-t-emerald-600',
    },

    // Group 2: উৎপাদন ও চুল্লি হিসাব
    {
      id: 'mill_hisab',
      labelBn: 'মিল হিসাব (ওহাব, মফিজুল, শফিকুল)',
      labelEn: 'Mill Pots Ledger',
      descBn: 'ওহাব সর্দার, মফিজুল সর্দার ও শফিকুল সর্দারের পট ও বিল',
      descEn: 'Ohab, Mofijul & Shofikul Sardar mill pots & bills',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Factory className="w-4 h-4 shrink-0 text-amber-400" />,
      countBn: formatBn((dbState.millPots || []).length),
      badgeColor: 'border-t-amber-500',
    },
    {
      id: 'van_hisab',
      labelBn: 'ভ্যান হিসাব (সেলিম সর্দার)',
      labelEn: 'Van Loading (Selim Sardar)',
      descBn: 'সেলিম সর্দারের কাঁচা ও পাকা ইট ভ্যান লোড ও বিল',
      descEn: 'Selim Sardar raw & paka brick loading into kiln',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Truck className="w-4 h-4 shrink-0 text-sky-400" />,
      countBn: formatBn((dbState.chulliLoads || []).length),
      badgeColor: 'border-t-sky-500',
    },
    {
      id: 'porai_mistri',
      labelBn: 'পোড়াই মিস্ত্রি (আলতাফ সর্দার)',
      labelEn: 'Kiln Fireman (Altaf Sardar)',
      descBn: 'আলতাফ সর্দারের ইট পোড়ানো রাউন্ড ও মিস্ত্রি বিল',
      descEn: 'Altaf Sardar kiln firing rounds & fireman bills',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Flame className="w-4 h-4 shrink-0 text-rose-400" />,
      countBn: formatBn((dbState.poraiMistriRecords || []).length),
      badgeColor: 'border-t-rose-500',
    },
    {
      id: 'rubbish_hisab',
      labelBn: 'রাবিশ সর্দার (অবেদ রাবিশ সর্দার)',
      labelEn: 'Rubbish Sardar (Obed Sardar)',
      descBn: 'অবেদ রাবিশ সর্দারের রাউন্ড হিসাবে বিল ও খোরাকি খতিয়ান',
      descEn: 'Obed Rubbish Sardar round-wise bill & khoraki ledger',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Layers className="w-4 h-4 shrink-0 text-purple-400" />,
      countBn: formatBn((dbState.rubbishRecords || []).length),
      badgeColor: 'border-t-purple-500',
    },
    {
      id: 'koyla_dakshta',
      labelBn: 'চুল্লির কয়লা ও পোড়াই দক্ষতা',
      labelEn: 'Coal & Firing Efficiency',
      descBn: 'প্রতি ১ লক্ষ ইটে কয়লা ও কাঠের রাউন্ড ভিত্তিক দক্ষতা হিসাব',
      descEn: 'Round-wise coal & firewood burn efficiency per 1 lakh bricks',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Flame className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: `${formatBn(firingRounds.length)} রাউন্ড`,
      badgeColor: 'border-t-emerald-600',
    },
    {
      id: 'unload_hisab',
      labelBn: 'আনলোড হিসাব (নজরুল সর্দার)',
      labelEn: 'Kiln Unload (Nazrul Sardar)',
      descBn: 'নজরুল সর্দারের পাকা ইট আনলোড ও চুল্লির লাইন ফাঁকা হিসাব',
      descEn: 'Nazrul Sardar fired brick unloading & auto line clearing',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Flame className="w-4 h-4 shrink-0 text-orange-400" />,
      countBn: formatBn((dbState.chulliUnloads || []).length),
      badgeColor: 'border-t-orange-500',
    },
    {
      id: 'chulli_chamber',
      labelBn: 'রিয়েল চুল্লি ২০৮-লাইন ও ডাম্পার ম্যাপ',
      labelEn: 'Realistic Kiln 208-Line Map',
      descBn: 'বাস্তব ইটভাটার চুল্লি নকশা, ভ্যান লোড, আনলোড ফাঁকা লাইন ও ০ থেকে রিসেট',
      descEn: 'Realistic Fixed Chimney 208-line firing, van load, auto unload empty & reset',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <Flame className="w-4 h-4 shrink-0 text-rose-400" />,
      countBn: '২০৮ লাইন',
      badgeColor: 'border-t-rose-600',
    },
    {
      id: 'wastage_register',
      labelBn: 'বৃষ্টির ক্ষতি ও অপচয় খাতা',
      labelEn: 'Brick Wastage Register',
      descBn: 'বৃষ্টিতে নষ্ট কাঁচা ইট ও চুল্লির গামা/আদলা অপচয় হিসাব',
      descEn: 'Rain-damaged raw bricks & kiln overburnt wastage register',
      groupBn: '২. উৎপাদন ও চুল্লি হিসাব',
      groupEn: '2. Production & Kiln',
      icon: <CloudRain className="w-4 h-4 shrink-0 text-sky-400" />,
      countBn: formatBn(enterpriseState.wastageRecords.length),
      badgeColor: 'border-t-sky-600',
    },

    // Group 3: জ্বালানি, মাটি, গাড়ি ও দাদন
    {
      id: 'jalani_hisab',
      labelBn: 'জ্বালানি ও কাঠ হিসাব',
      labelEn: 'Fuel & Firewood',
      descBn: 'জ্বালানি কাঠ ক্রয়, সাপ্লায়ার বিল ও বাকি',
      descEn: 'Firewood purchases, supplier bills & dues',
      groupBn: '৩. জ্বালানি, মাটি, গাড়ি ও দাদন',
      groupEn: '3. Fuel, Soil, Fleet & Dadon',
      icon: <Flame className="w-4 h-4 shrink-0 text-amber-400" />,
      countBn: formatBn((dbState.woodFuelRecords || []).length),
      badgeColor: 'border-t-amber-600',
    },
    {
      id: 'mati_koyla',
      labelBn: 'মাটি ও এসকো বিল',
      labelEn: 'Soil & Esco Bill',
      descBn: 'মাটি ক্রয় ও এসকোভেটর ঘণ্টা বিল',
      descEn: 'Clay purchase & excavator hourly bill',
      groupBn: '৩. জ্বালানি, মাটি, গাড়ি ও দাদন',
      groupEn: '3. Fuel, Soil, Fleet & Dadon',
      icon: <Layers className="w-4 h-4 shrink-0 text-orange-400" />,
      countBn: formatBn((dbState.soilCoalRecords || []).length),
      badgeColor: 'border-t-orange-600',
    },
    {
      id: 'land_lease',
      labelBn: 'জমির লিস খতিয়ান',
      labelEn: 'Land Lease Ledger',
      descBn: 'যাদের জমি নেওয়া হয়েছে তাদের জমির পরিমাণ, কত টাকা দিলাম ও কে কত পাবে',
      descEn: 'Landowner lease ledger, land area, paid amount & who gets how much',
      groupBn: '৩. জ্বালানি, মাটি, গাড়ি ও দাদন',
      groupEn: '3. Fuel, Soil, Fleet & Dadon',
      icon: <Compass className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: formatBn(enterpriseState.landLeases.length),
      badgeColor: 'border-t-emerald-600',
    },
    {
      id: 'dadon_khata',
      labelBn: 'সর্দার ও মিস্ত্রি দাদন খাতা',
      labelEn: 'Sardar Dadon Ledger',
      descBn: 'অগ্রিম দাদন, কাজের বিল কর্তন ও ব্যালেন্স',
      descEn: 'Advance dadon, work bill deductions & balance',
      groupBn: '৩. জ্বালানি, মাটি, গাড়ি ও দাদন',
      groupEn: '3. Fuel, Soil, Fleet & Dadon',
      icon: <Users className="w-4 h-4 shrink-0 text-amber-400" />,
      countBn: formatBn((dbState.dadonRecords || []).length),
      badgeColor: 'border-t-amber-500',
    },
    {
      id: 'booking_party',
      labelBn: 'অগ্রিম বুকিং ও পার্টি খতিয়ান',
      labelEn: 'Advance Booking & Party',
      descBn: 'অগ্রিম ইট বুকিং, আংশিক ডেলিভারি ও জের',
      descEn: 'Advance brick bookings, partial deliveries & balance',
      groupBn: '৩. জ্বালানি, মাটি, গাড়ি ও দাদন',
      groupEn: '3. Fuel, Soil, Fleet & Dadon',
      icon: <BookmarkCheck className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: formatBn((dbState.advanceBookings || []).length),
      badgeColor: 'border-t-emerald-600',
    },
    {
      id: 'veku_truck',
      labelBn: 'ট্রাক, ট্রলি ও ভেকু হিসাব',
      labelEn: 'Truck, Excavator & Diesel',
      descBn: 'গাড়ির ট্রিপ, ভেকু ঘণ্টা, ডিজেল ও ভাড়া',
      descEn: 'Vehicle trips, excavator hours, diesel & rent',
      groupBn: '৩. জ্বালানি, মাটি, গাড়ি ও দাদন',
      groupEn: '3. Fuel, Soil, Fleet & Dadon',
      icon: <Truck className="w-4 h-4 shrink-0 text-sky-400" />,
      countBn: formatBn((dbState.vehicleDieselRecords || []).length),
      badgeColor: 'border-t-sky-600',
    },

    // Group 4: লেবার, ক্যাশ ও স্মার্ট রিপোর্ট
    {
      id: 'labour',
      labelBn: 'লেবার খাতা',
      labelEn: 'Labor Book',
      descBn: 'শ্রমিক প্রোফাইল, দৈনিক হাজিরা ও মজুরি পেমেন্ট',
      descEn: 'Worker profiles, daily attendance & wage payments',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <Users className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: formatBn(dbState.workerProfiles.length),
      badgeColor: 'border-t-emerald-600',
    },
    {
      id: 'staff_salary',
      labelBn: 'কর্মচারী ও ম্যানেজার বেতন খাতা',
      labelEn: 'Staff & Manager Salary',
      descBn: 'ম্যানেজার, মুন্সি, নাইট গার্ড ও ড্রাইভারদের মাসিক বেতন',
      descEn: 'Monthly salary sheet for manager, munshi, guards & drivers',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <Briefcase className="w-4 h-4 shrink-0 text-indigo-400" />,
      countBn: formatBn(enterpriseState.staffSalaries.length),
      badgeColor: 'border-t-indigo-600',
    },
    {
      id: 'cashbook',
      labelBn: 'ক্যাশ বুক',
      labelEn: 'Cash Book',
      descBn: 'ভাটার সকল নগদ জমা ও খরচের খতিয়ান',
      descEn: 'Complete kiln cash in & cash out ledger',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <Wallet className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: formatBn(dbState.cashTransactions.length),
      badgeColor: 'border-t-emerald-600',
    },
    {
      id: 'daily_closing',
      labelBn: 'দৈনিক ক্লোজিং ও গোল ট্র্যাকার',
      labelEn: 'Daily Closing & Goals',
      descBn: 'দিনশেষে ক্যাশ মিলকরণ শিট ও টার্গেট প্রগ্রেস',
      descEn: 'End-of-day cash reconciliation & target progress',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-400" />,
      countBn: `${formatBn(dailyGoalStats.overallCompletionPct)}%`,
      badgeColor: 'border-t-emerald-500',
    },
    {
      id: 'due_tagada',
      labelBn: 'বকেয়া তাগাদা ও মেসেজ',
      labelEn: 'Due Reminder & WhatsApp',
      descBn: 'বকেয়া ক্রেতাদের তালিকা ও ১-ক্লিক তাগাদা মেসেজ',
      descEn: 'Due customer list & 1-click reminder messages',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <MessageCircle className="w-4 h-4 shrink-0 text-green-400" />,
      countBn: formatBn(dueTagadaReport.items.length),
      badgeColor: 'border-t-green-600',
    },
    {
      id: 'hazar_khoroch',
      labelBn: 'হাজার প্রতি ইট খরচ ও লাভ',
      labelEn: 'Cost per 1,000 Bricks',
      descBn: 'প্রতি ১০০০ ইটের উৎপাদন খরচ ও নিট মুনাফা',
      descEn: 'Production cost & net profit per 1,000 bricks',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <Calculator className="w-4 h-4 shrink-0 text-amber-400" />,
      badgeColor: 'border-t-amber-500',
    },
    {
      id: 'license_kisti',
      labelBn: 'লাইসেন্স, ভ্যাট ও কিস্তি',
      labelEn: 'License, VAT & Loan',
      descBn: 'পরিবেশ ছাড়পত্র, ডিসি লাইসেন্স, ভ্যাট ও ব্যাংক কিস্তি',
      descEn: 'Environmental clearance, DC license, VAT & loan installments',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400" />,
      countBn: formatBn((dbState.complianceRecords || []).length),
      badgeColor: 'border-t-indigo-600',
    },
    {
      id: 'yearly_seasonal',
      labelBn: 'বার্ষিক ও সিজন হিসাব',
      labelEn: 'Yearly & Seasonal',
      descBn: '১২ মাসের চার্ট, দুই সিজনের তুলনা ও আর্কাইভ',
      descEn: '12-month charts, season comparison & historical archive',
      groupBn: '৪. লেবার, ক্যাশ ও স্মার্ট রিপোর্ট',
      groupEn: '4. Labor, Cash & Smart Reports',
      icon: <CalendarRange className="w-4 h-4 shrink-0 text-amber-400" />,
      countBn: formatBn((dbState.kilnSeasons || []).length || 2),
      badgeColor: 'border-t-amber-600',
    },
  ];

  const activeNavItem = navItems.find((n) => n.id === activeTab) || navItems[0];
  const navGroups = Array.from(new Set(navItems.map((n) => n.groupBn)));

  const maxChartVal = useMemo(
    () =>
      Math.max(
        1000,
        ...(metrics.sevenDayChart || []).map((d) =>
          Math.max(d.salesAmount, d.cashInAmount, d.expenseAmount)
        )
      ),
    [metrics.sevenDayChart]
  );

  const dueMemos = useMemo(
    () => dbState.salesMemos.filter((m) => m.dueAmount > 0),
    [dbState.salesMemos]
  );

  return (
    <div
      ref={appRootRef}
      data-kiln-theme={activeTheme}
      data-fullscreen-mode={isFullScreenMode ? 'true' : 'false'}
      onMouseDownCapture={(e) => {
        // 1-Click Save Guarantee: When an input/textarea/select is focused (especially with mobile virtual keyboard open),
        // pressing a button normally triggers input.blur() on mousedown BEFORE mouseup/click, shifting the viewport and
        // cancelling the first click. Preventing default on mousedown keeps the button under the finger so click ALWAYS fires on Tap 1.
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const btn = target.closest('button:not(:disabled), [role="button"]');
        if (!btn) return;
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          active !== btn &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT')
        ) {
          e.preventDefault();
        }
      }}
      onClickCapture={(e) => {
        // After the 1st click fires on a submit button, cleanly blur the active input so mobile virtual keyboard closes smoothly
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const submitBtn = target.closest('button[type="submit"]:not(:disabled)');
        if (submitBtn) {
          const active = document.activeElement as HTMLElement | null;
          if (
            active &&
            (active.tagName === 'INPUT' ||
              active.tagName === 'TEXTAREA' ||
              active.tagName === 'SELECT')
          ) {
            setTimeout(() => {
              active.blur();
            }, 0);
          }
        }
      }}
      onFocusCapture={(e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === 'INPUT') {
          const inp = target as HTMLInputElement;
          if (
            (inp.type === 'number' || inp.type === 'text' || inp.inputMode === 'decimal') &&
            (inp.value === '0' || inp.value === '০')
          ) {
            inp.select();
          }
        }
      }}
      className="min-h-screen flex bg-[#F8FAFC] text-slate-950 transition-colors duration-200"
    >
      {/* Custom Toast Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
            toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Dark Navy / Charcoal Left Sidebar */}
      <aside
        aria-label={isEn ? 'Kiln Sidebar Navigation' : 'ভাটা সাইডবার নেভিগেশন'}
        className="hidden xl:flex flex-col w-68 bg-[#0B1120] text-slate-100 border-r border-slate-800/90 shrink-0 sticky top-0 h-screen shadow-xl"
      >
        {/* Sidebar Brand Lockup */}
        <div className="px-4 py-4 border-b border-slate-800/90 flex items-center gap-3.5 bg-gradient-to-r from-slate-950 via-[#150B06] to-slate-950 relative overflow-hidden">
          <SblBrandLogo size="md" />
          <div className="min-w-0 space-y-0.5">
            <div className="inline-flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[10px] font-black tracking-wider text-amber-300 uppercase">
                SBL ★ NO. 1
              </span>
              <span className="text-[10px] font-bold text-orange-300/90">
                সাতক্ষীরা
              </span>
            </div>
            <div className="text-sm sm:text-base font-black tracking-tight text-white truncate">
              {isEn ? 'SBL Sweet Clay Bricks' : 'SBL মিষ্টি মাটির ইট'}
            </div>
            <div className="text-xs text-amber-400 font-extrabold truncate">
              {isEn ? '(Babulia, Satkhira)' : '(বাবুলিয়া, সাতক্ষীরা)'}
            </div>
          </div>
        </div>

        {/* Language Toggle in Sidebar */}
        <div className="px-4 pt-3">
          <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-800 grid grid-cols-2 gap-1">
            <button
              type="button"
              data-skip-lang-norm="true"
              onClick={() => setLang('bn')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                lang === 'bn'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              data-skip-lang-norm="true"
              onClick={() => setLang('en')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                lang === 'en'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Categorized Sidebar Navigation Links */}
        <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {navGroups.map((grpBn) => {
            const groupItems = navItems.filter((item) => item.groupBn === grpBn);
            const grpLabel = isEn ? groupItems[0]?.groupEn : grpBn;
            return (
              <div key={grpBn} className="space-y-1">
                <div className="px-3 py-1 text-[11px] font-extrabold text-amber-400/90 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                  {grpLabel}
                </div>
                {groupItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === 'delivery_hisab') {
                          setDeliveryTargetMemoNo('');
                        }
                        setActiveTab(item.id);
                      }}
                      className={`relative w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'btn-tactile bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white font-bold shadow-md shadow-orange-950/50 translate-x-0.5 ring-1 ring-amber-300/40'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-amber-300 shadow-[0_0_8px_#fcd34d]"
                        />
                      )}
                      <span className="inline-flex items-center gap-2.5 truncate">
                        {item.icon}
                        <span className="truncate">
                          {isEn ? item.labelEn : item.labelBn}
                        </span>
                      </span>
                      {item.countBn && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
                            isActive
                              ? 'bg-black/25 text-white font-bold'
                              : 'bg-slate-800/90 text-slate-400'
                          }`}
                        >
                          {item.countBn}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Financial Quick Summary, Role Lock, PWA Install & Backup Info */}
        <div className="p-4 border-t border-slate-800/90 bg-slate-950/80 space-y-2.5 text-xs">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>{isEn ? 'Cash Balance:' : 'নগদ ক্যাশ তহবিল:'}</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {formatCurrencyBn(metrics.currentCashBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>{isEn ? 'Customer Due:' : 'মোট বকেয়া পাওনা:'}</span>
              <span className="font-bold text-rose-400 tabular-nums">
                {formatCurrencyBn(metrics.totalCustomerDue)}
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="open-scheduled-backup-sidebar-btn"
            onClick={() => setIsBackupVaultOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-200 text-[11px] font-bold cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{isEn ? 'Auto Daily Backup Vault' : 'অটো ডেইলি ব্যাকআপ ভল্ট'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-800/80 text-white text-[10px]">
              {isEn ? `${formatBn(savedSnapshots.length)}` : `${formatBn(savedSnapshots.length)} টি`}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportDatabase}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              {isEn ? 'Backup' : 'ব্যাকআপ এক্সপোর্ট'}
            </button>
            <label className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[11px] font-semibold cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              {isEn ? 'Restore' : 'ডাটা রিস্টোর'}
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreDatabase}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="button"
            data-testid="sidebar-data-reset-btn"
            onClick={() => {
              if (!requireOwnerPermission()) return;
              setIsDataResetModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/80 text-rose-200 text-[11px] font-bold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{isEn ? 'Reset All Data (0)' : 'সম্পূর্ণ ডাটা রিসেট (0)'}</span>
          </button>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
            <div className="font-semibold text-slate-200">
              {isEn ? 'Proprietor: Md. Kamrul Islam' : 'প্রোঃ মোঃ কামরুল ইসলাম'}
            </div>
            <div>{isEn ? 'Managed by: Sakib Hossain' : 'পরিচালনায়ঃ সাকিব হোসেন'}</div>
            <div className="text-slate-500">
              {isEn ? 'Babulia, Satkhira Sadar' : 'বাবুলিয়া, সাতক্ষীরা সদর'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar — Redesigned Premium Button-Button Header System (Compact on Phone) */}
        <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-amber-500/30 px-2 sm:px-6 py-1.5 sm:py-3 flex items-center justify-between gap-1 sm:gap-3 shadow-md text-white">
          {/* Zone 1: Mobile Hamburger Trigger + Brand Wordmark & Top Quick Pill Switcher (ড্যাশবোর্ড, মেমো, ৩ডি চুল্লি) */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label={isEn ? 'Open Kiln Menu' : 'ভাটার সম্পূর্ণ মেনু খুলুন'}
              className="sbl-btn-interactive xl:hidden p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 cursor-pointer shrink-0 transition-colors"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            </button>

            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('dashboard');
              }}
              className="inline-flex items-center gap-1.5 sm:gap-2.5 text-xs sm:text-base font-black tracking-tight text-white min-w-0 group"
            >
              <SblBrandLogo size="sm" />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-[11px] sm:text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                  <span className="sm:hidden">{isEn ? 'SBL Bricks' : 'SBL ইটভাটা'}</span>
                  <span className="hidden sm:inline">
                    {isEn ? 'SBL Sweet Clay Bricks' : 'SBL মিষ্টি মাটির ইট'}
                  </span>
                </span>
                <span className="text-[9px] sm:text-[11px] font-extrabold text-amber-400 tracking-wide truncate">
                  <span className="sm:hidden">{isEn ? 'Satkhira' : 'সাতক্ষীরা'}</span>
                  <span className="hidden sm:inline">
                    {isEn ? '(Babulia, Satkhira)' : '(বাবুলিয়া, সাতক্ষীরা)'}
                  </span>
                </span>
              </div>
            </a>

            {/* Top Header Pill Button Navigation Bar (ড্যাশবোর্ড | মেমো খাতা | ৩ডি চুল্লি ম্যাপ | বর্তমান সেকশন) */}
            <div className="hidden lg:flex items-center gap-1.5 pl-2.5 border-l border-slate-800 shrink-0">
              <button
                type="button"
                data-testid="header-pill-dashboard-btn"
                onClick={() => setActiveTab('dashboard')}
                className={`sbl-btn-interactive inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md ring-2 ring-amber-300/60'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                <span>{isEn ? 'Dashboard' : 'ড্যাশবোর্ড'}</span>
              </button>

              <button
                type="button"
                data-testid="header-pill-memos-btn"
                onClick={() => setActiveTab('memos')}
                className={`sbl-btn-interactive inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'memos'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md ring-2 ring-amber-300/60'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>{isEn ? 'Memos' : 'মেমো খাতা'}</span>
              </button>

              <button
                type="button"
                data-testid="header-pill-3d-kiln-btn"
                onClick={() => setActiveTab('chulli_chamber')}
                className={`sbl-btn-interactive inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'chulli_chamber'
                    ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md ring-2 ring-amber-300/60'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                <Flame className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                <span>{isEn ? '3D Kiln Map' : '🧊 ৩ডি চুল্লি'}</span>
              </button>

              {activeTab !== 'dashboard' &&
                activeTab !== 'memos' &&
                activeTab !== 'chulli_chamber' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-800 border border-amber-400/50 text-amber-300 text-[11px] font-black whitespace-nowrap">
                    {activeNavItem.icon}
                    <span>{isEn ? activeNavItem.labelEn : activeNavItem.labelBn}</span>
                  </span>
                )}
            </div>
          </div>

          {/* Zone 3: Redesigned Pill Button System — Alert Bell, Backup Vault, Dark Mode, EN/বাং, + New Memo */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="open-smart-alert-bell-btn"
              onClick={() => {
                setAlertCenterFocusId(
                  smartAlertReport.activeAlerts[0]?.id || null
                );
                setIsAlertCenterModalOpen(true);
              }}
              title={
                isEn
                  ? 'Smart Kiln Alert & Auto-Reminder Center'
                  : 'অটো রিমাইন্ডার ও স্মার্ট অ্যালার্ট সেন্টার'
              }
              className="sbl-btn-interactive inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-black rounded-full bg-gradient-to-r from-rose-950 via-red-950 to-orange-950 hover:from-rose-900 hover:to-orange-900 text-rose-100 border border-rose-500/60 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <BellRing className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0 animate-pulse" />
              <span className="hidden sm:inline">
                {isEn ? 'Alerts' : 'অ্যালার্ট বেল'}
              </span>
              <span
                data-testid="smart-alert-bell-count"
                className="px-1 sm:px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] sm:text-[10px] font-black tabular-nums shadow-2xs"
              >
                {formatBn(smartAlertReport.totalActiveCount)}
              </span>
            </button>

            <button
              type="button"
              data-testid="open-cloud-sync-header-btn"
              onClick={() => setIsBackupVaultOpen(true)}
              title={isEn ? 'Google Cloud Firebase Live Database' : 'গুগল ফায়ারবেস ক্লাউড ডাটাবেস সক্রিয়'}
              className="sbl-btn-interactive inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-black rounded-full bg-gradient-to-r from-blue-950 to-indigo-950 hover:from-blue-900 hover:to-indigo-900 text-blue-200 border border-blue-500/60 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <Cloud className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-300 shrink-0" />
              <span className="hidden sm:inline">{isEn ? 'Cloud Safe' : 'ক্লাউড সেভ'}</span>
              <span className="sm:hidden">{isEn ? 'Cloud' : 'ক্লাউড'}</span>
            </button>

            <button
              type="button"
              data-testid="open-scheduled-backup-header-btn"
              onClick={() => setIsBackupVaultOpen(true)}
              title={isEn ? 'Auto Daily Backup Vault' : 'স্বয়ংক্রিয় ডেইলি ব্যাকআপ ভল্ট'}
              className="sbl-btn-interactive hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black rounded-full bg-gradient-to-r from-emerald-950 to-teal-950 hover:from-emerald-900 hover:to-teal-900 text-emerald-200 border border-emerald-500/60 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden lg:inline">{isEn ? 'Backup Vault' : 'ডেইলি ব্যাকআপ ভল্ট'}</span>
              <span className="lg:hidden">{isEn ? 'Vault' : 'ব্যাকআপ ভল্ট'}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black tabular-nums">
                {formatBn(savedSnapshots.length)}
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-color-mode-btn"
              onClick={() => {
                setIsDarkMode((prev) => {
                  const next = !prev;
                  showToast(
                    next
                      ? isEn
                        ? 'Royal Dark & Gold Mode activated!'
                        : 'রয়েল ডার্ক ও গোল্ড মোড চালু হয়েছে!'
                      : isEn
                      ? 'Daylight Clean Mode activated!'
                      : 'দিনের আলো (লাইট মোড) চালু হয়েছে!'
                  );
                  return next;
                });
              }}
              title={
                isDarkMode
                  ? isEn
                    ? 'Switch to Daylight Mode'
                    : 'লাইট মোডে ফিরুন'
                  : isEn
                  ? 'Switch to Royal Dark & Gold Mode'
                  : 'রয়েল ডার্ক ও গোল্ড মোড চালু করুন'
              }
              className={`sbl-btn-interactive inline-flex items-center gap-1 px-2 sm:px-3.5 py-1 sm:py-2 text-[10px] sm:text-xs font-black rounded-full border transition-all cursor-pointer shadow-md ${
                isDarkMode
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-400/50'
              }`}
            >
              {isDarkMode ? (
                <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-950 shrink-0" />
              ) : (
                <Moon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              )}
              <span className="hidden lg:inline">
                {isDarkMode
                  ? isEn
                    ? 'Light'
                    : 'লাইট মোড'
                  : isEn
                  ? 'Dark Mode'
                  : 'ডার্ক মোড'}
              </span>
            </button>

            <button
              type="button"
              data-testid="header-fullscreen-toggle-btn"
              onClick={() => void handleToggleFullScreen()}
              title={
                isFullScreenMode
                  ? isEn
                    ? 'Exit Fullscreen Mode'
                    : 'ফুল-স্ক্রিন বন্ধ করুন'
                  : isEn
                  ? 'Enter Fullscreen Mode'
                  : 'ফুল-স্ক্রিন মোড চালু করুন'
              }
              className={`sbl-btn-interactive inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs font-black rounded-full border transition-all cursor-pointer shadow-md ${
                isFullScreenMode
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 border-emerald-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/50'
              }`}
            >
              {isFullScreenMode ? (
                <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              ) : (
                <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              )}
              <span className="hidden md:inline">
                {isFullScreenMode
                  ? isEn
                    ? 'Exit Full'
                    : 'সাধারণ পর্দা'
                  : isEn
                  ? 'Fullscreen'
                  : 'ফুল-স্ক্রিন'}
              </span>
            </button>

            <button
              type="button"
              data-skip-lang-norm="true"
              onClick={() => setLang((prev) => (prev === 'bn' ? 'en' : 'bn'))}
              title={isEn ? 'Switch to Bengali' : 'ইংরেজি ভাষায় পরিবর্তন করুন'}
              className="sbl-btn-interactive inline-flex items-center gap-1 px-1.5 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs font-black rounded-full bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 transition-all cursor-pointer shadow-md"
            >
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
              <span>{lang === 'bn' ? 'EN' : 'বাং'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsNewMemoModalOpen(true);
                setTimeout(() => {
                  const el = document.getElementById('memo-customer-input');
                  el?.focus();
                }, 80);
              }}
              className="sbl-btn-interactive inline-flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs font-black rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 shadow-lg shadow-orange-500/25 ring-2 ring-amber-300/60"
            >
              <FilePlus2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">{isEn ? '+ New Cash Memo' : '+ নতুন মেমো তৈরি'}</span>
              <span className="sm:hidden">{isEn ? '+ Memo' : '+ মেমো'}</span>
            </button>
          </div>
        </header>

        {/* Mobile Slide-over Drawer for Phones & Tablets (< xl) */}
        {isMobileDrawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Kiln Navigation Drawer' : 'ভাটা নেভিগেশন ড্রয়ার'}
            className="fixed inset-0 z-50 xl:hidden flex animate-modal-backdrop"
          >
            {/* Backdrop Overlay */}
            <div
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
            />

            {/* Drawer Content Panel — Bright & Clean Daylight App Menu */}
            <div className="relative w-80 max-w-[85vw] h-full bg-white text-slate-900 shadow-2xl flex flex-col z-10 overflow-hidden border-r border-orange-200">
              {/* Drawer Brand Header */}
              <div className="p-3 border-b border-orange-200/80 flex items-center justify-between gap-2.5 bg-gradient-to-r from-amber-50 via-orange-50/70 to-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <SblBrandLogo size="sm" />
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-orange-700 uppercase tracking-wider">
                      SBL ★ NO. 1 · সাতক্ষীরা
                    </div>
                    <div className="text-xs font-black text-slate-950 truncate">
                      {isEn ? 'SBL Sweet Clay Bricks' : 'SBL মিষ্টি মাটির ইট'}
                    </div>
                    <div className="text-[11px] text-orange-800 font-bold truncate">
                      (বাবুলিয়া, সাতক্ষীরা)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  aria-label="ড্রয়ার বন্ধ করুন"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-orange-100/70 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Language Switch in Drawer */}
              <div className="px-3 pt-2.5">
                <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    data-skip-lang-norm="true"
                    onClick={() => setLang('bn')}
                    className={`py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      lang === 'bn'
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    বাংলা
                  </button>
                  <button
                    type="button"
                    data-skip-lang-norm="true"
                    onClick={() => setLang('en')}
                    className={`py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      lang === 'en'
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Navigation Links Scrollable List — Compact Bright 2-Column Mobile App Grid */}
              <div className="flex-1 px-2.5 py-2.5 space-y-2.5 overflow-y-auto bg-slate-50/50">
                {navGroups.map((grpBn) => {
                  const groupItems = navItems.filter((item) => item.groupBn === grpBn);
                  const grpLabel = isEn ? groupItems[0]?.groupEn : grpBn;
                  return (
                    <div key={grpBn} className="space-y-1">
                      <div className="px-1.5 py-0.5 text-[10px] font-extrabold text-orange-800 uppercase tracking-wider border-b border-orange-200/70">
                        {grpLabel}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {groupItems.map((item) => {
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                if (item.id === 'delivery_hisab') {
                                  setDeliveryTargetMemoNo('');
                                }
                                setActiveTab(item.id);
                                setIsMobileDrawerOpen(false);
                              }}
                              className={`flex flex-col items-start justify-between gap-1 p-2 rounded-xl text-left transition-all cursor-pointer border ${
                                isActive
                                  ? 'btn-tactile bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 font-bold shadow-xs'
                                  : 'bg-white border-slate-200/90 text-slate-900 hover:bg-orange-50/60 hover:border-orange-300 shadow-2xs'
                              }`}
                            >
                              <div className="w-full flex items-center justify-between gap-1">
                                <span
                                  className={`p-1 rounded-lg shrink-0 ${
                                    isActive
                                      ? 'bg-black/20 text-white'
                                      : 'bg-orange-50 text-orange-600 border border-orange-200/70'
                                  }`}
                                >
                                  {item.icon}
                                </span>
                                {item.countBn && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0 font-bold ${
                                      isActive
                                        ? 'bg-black/20 text-white'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {item.countBn}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-extrabold leading-tight truncate w-full mt-0.5">
                                {isEn ? item.labelEn : item.labelBn}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Drawer Controls: App Install, Backup Vault & Data Reset */}
              <div className="p-2.5 border-t border-slate-200 bg-white space-y-2 text-xs">
                <button
                  type="button"
                  data-testid="mobile-drawer-install-app-btn"
                  onClick={async () => {
                    if (isPWAInstallable) {
                      const accepted = await triggerPWAInstall();
                      if (accepted) {
                        setIsMobileDrawerOpen(false);
                        showToast('SBL Bricks অ্যাপ সফলভাবে ফোনে ইনস্টল হয়েছে!');
                        return;
                      }
                    }
                    setIsMobileDrawerOpen(false);
                    setIsPhoneInstallGuideOpen(true);
                  }}
                  className="w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 text-white text-[11px] font-black shadow-xs cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {isPWAInstalled
                        ? '📱 অ্যাপ ইনস্টল করা আছে (স্টোরেজ লক সক্রিয়)'
                        : '📱 ফোনে অ্যাপ ইনস্টল ও আজীবন স্টোরেজ গাইড'}
                    </span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-black/25 text-white text-[9px] font-extrabold shrink-0">
                    {isStoragePersisted ? 'সুরক্ষিত' : 'PWA'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="open-scheduled-backup-mobile-drawer-btn"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      setIsBackupVaultOpen(true);
                    }}
                    className="min-h-[38px] flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-extrabold cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 truncate">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{isEn ? 'Backup' : 'ডেইলি ভল্ট'}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px]">
                      {formatBn(savedSnapshots.length)}
                    </span>
                  </button>

                  <label
                    data-testid="mobile-drawer-restore-file-btn"
                    className="min-h-[38px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 text-[10px] font-extrabold cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">📂 ফাইল ইমপোর্ট</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        setIsMobileDrawerOpen(false);
                        handleRestoreDatabase(e);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportDatabase}
                    className="min-h-[36px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[10px] font-extrabold cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="truncate">এক্সপোর্ট JSON</span>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-drawer-data-reset-btn"
                    onClick={() => {
                      if (!requireOwnerPermission()) return;
                      setIsMobileDrawerOpen(false);
                      setIsDataResetModalOpen(true);
                    }}
                    className="min-h-[36px] flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-extrabold cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">{isEn ? 'Reset (0)' : 'রিসেট (0)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phone Mode Ultra-Slim Active Breadcrumb Strip (Quick-tabs moved to Bottom Ergonomic Thumb-Zone Dock!) */}
        {activeTab !== 'dashboard' && (
          <div
            data-testid="phone-mode-active-bar"
            className="md:hidden bg-gradient-to-r from-amber-50/95 via-orange-50/70 to-white text-slate-900 border-b border-orange-200/80 px-2.5 py-1 flex items-center justify-between gap-1.5 shadow-2xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="p-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200/80 shrink-0 scale-90">
                {activeNavItem.icon}
              </span>
              <span className="text-[11px] font-black text-slate-950 truncate">
                {isEn ? activeNavItem.labelEn : activeNavItem.labelBn}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="px-2 py-0.5 rounded-full bg-white hover:bg-orange-50 text-orange-800 border border-orange-300 text-[10px] font-extrabold cursor-pointer whitespace-nowrap shadow-2xs"
            >
              {isEn ? '← Home' : '← হোম ড্যাশবোর্ডে ফিরুন'}
            </button>
          </div>
        )}

        {/* Tablet & Compact Laptop Dedicated Quick-Access Dock (md:flex xl:hidden) */}
        <nav
          data-testid="tablet-quick-nav-dock"
          aria-label={isEn ? 'Tablet Quick Navigation Dock' : 'ট্যাবলেট কুইক নেভিগেশন ডক'}
          className="hidden md:flex xl:hidden items-center justify-between gap-2 bg-gradient-to-r from-amber-50/70 via-white to-orange-50/60 border-b border-slate-200/90 px-4 py-2 shadow-2xs overflow-x-auto"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'dashboard', bn: 'মূল ড্যাশবোর্ড', en: 'Dashboard' },
                { id: 'memos', bn: 'মেমো ও বাকি খাতা', en: 'Memo & Due' },
                { id: 'delivery_hisab', bn: 'ইট ডেলিভারি', en: 'Delivery' },
                { id: 'bricks', bn: 'কাঁচা ও পোড়ানো ইট', en: 'Brick Stock' },
                { id: 'cashbook', bn: 'নগদ ক্যাশ বুক', en: 'Cash Book' },
                { id: 'labour', bn: 'লেবার খাতা', en: 'Labor Book' },
                { id: 'koyla_dakshta', bn: 'কয়লা দক্ষতা', en: 'Coal Efficiency' },
                { id: 'chulli_chamber', bn: '২৪-চেম্বার ম্যাপ', en: '24-Chamber Map' },
              ] as const
            ).map((tab) => {
              const isAct = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id === 'delivery_hisab') {
                      setDeliveryTargetMemoNo('');
                    }
                    setActiveTab(tab.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                    isAct
                      ? 'btn-tactile bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 shadow-xs'
                      : 'bg-white hover:bg-orange-50/80 text-slate-800 border-slate-200/90 hover:border-orange-300'
                  }`}
                >
                  {isEn ? tab.en : tab.bn}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Menu className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'All 21 Modules' : 'সব ২১টি সেকশন'}</span>
          </button>
        </nav>

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-1.5 sm:px-6 py-1.5 sm:py-6 pb-24 md:pb-16 space-y-1.5 sm:space-y-5 overflow-x-hidden">
          {/* Session Reset Auto-Recovery Banner if server state is empty while IndexedDB holds records */}
          {recoverableSnapshot && (
            <div
              className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              data-testid="main-session-reset-recovery-banner"
            >
              <div className="text-xs sm:text-sm text-amber-950 font-bold">
                সেশন রিসেট শনাক্ত হয়েছে! আপনার ব্রাউজারের IndexedDB ভল্টে{' '}
                <strong>{recoverableSnapshot.dateKey}</strong> তারিখের{' '}
                <strong>{formatBn(recoverableSnapshot.summary.totalRecordsCount)} টি রেকর্ডের</strong>{' '}
                পূর্ণ স্ন্যাপশট সুরক্ষিত আছে।
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRestoreFromIndexedDbSnapshot(recoverableSnapshot)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                >
                  ১ ক্লিকে ডাটা রিস্টোর করুন
                </button>
                <button
                  type="button"
                  onClick={() => setIsBackupVaultOpen(true)}
                  className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  ভল্ট দেখুন
                </button>
              </div>
            </div>
          )}
          {autoUnloadConfirmation && (
            <div
              data-testid="nazrul-unload-auto-confirmation-banner"
              className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-400/80 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-slide-up"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[11px] font-black">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    অটোমেটিক আনলোড কনফার্মেশন সম্পন্ন ({autoUnloadConfirmation.sardarName})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/60 text-amber-300 text-[11px] font-extrabold">
                    🔥 Active Firing Lines রিসেট: ০ (স্বয়ংক্রিয়)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 border border-sky-400/60 text-sky-300 text-[11px] font-extrabold">
                    📦 পাকা ইট স্টক: {formatBn(autoUnloadConfirmation.updatedStockPieces)} পিস
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-emerald-100">
                  নজরুল সর্দারের {formatBn(autoUnloadConfirmation.linesCleared)} লাইন ({formatBn(autoUnloadConfirmation.bricksDeducted)} পিস ইট) আনলোড অটো-কনফার্ম হয়েছে — ২০৮-লাইন ম্যাপে ক্লিয়ার হওয়া লাইন{' '}
                  <strong className="text-emerald-300 font-mono">
                    #{formatBn(autoUnloadConfirmation.clearedStartLine)} থেকে #{formatBn(autoUnloadConfirmation.clearedEndLine)}
                  </strong>{' '}
                  হাইলাইট করা হয়েছে!
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] font-bold text-slate-300">
                    ২০৮-লাইন ম্যাপে হাইলাইটকৃত ফাঁকা লাইন:
                  </span>
                  {autoUnloadConfirmation.clearedLineNumbers.slice(0, 14).map((ln) => (
                    <span
                      key={ln}
                      className="px-2 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-[11px] font-mono font-black"
                    >
                      #{formatBn(ln)} ✓
                    </span>
                  ))}
                  {autoUnloadConfirmation.clearedLineNumbers.length > 14 && (
                    <span className="text-[11px] text-emerald-300 font-bold">
                      +{formatBn(autoUnloadConfirmation.clearedLineNumbers.length - 14)}টি লাইন
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {activeTab !== 'chulli_chamber' && (
                  <button
                    type="button"
                    data-testid="btn-jump-to-highlighted-208-map"
                    onClick={() => setActiveTab('chulli_chamber')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black cursor-pointer shadow-sm transition-all active:scale-95"
                  >
                    🧱 ২০৮-লাইন ম্যাপে হাইলাইট দেখুন →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAutoUnloadConfirmation(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold cursor-pointer"
                >
                  ঠিক আছে
                </button>
              </div>
            </div>
          )}

          {/* Official Kiln Proprietor Banner & KPI Cards Strip — Only on Dashboard */}
          {activeTab === 'dashboard' && (
            <>
              {/* Desktop Rich Hero Banner + Ultra-Compact 2-Line Phone Hero Ribbon (< sm) */}
              <section className="sbl-brick-hero-pattern sbl-gold-frame text-slate-950 md:text-white border-t-2 sm:border-t-4 border-t-orange-500 md:border-t-amber-500 rounded-xl sm:rounded-2xl px-2 py-1.5 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="hidden sm:block">
                    <SblBrandLogo size="lg" />
                  </div>
                  <div className="sm:hidden shrink-0 scale-90 -ml-0.5">
                    <SblBrandLogo size="sm" />
                  </div>
                  <div className="space-y-0.5 sm:space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center justify-between sm:justify-start flex-wrap gap-1 sm:gap-2.5">
                      <h1 className="text-[11px] sm:text-2xl font-black text-slate-950 md:text-white tracking-tight leading-tight truncate">
                        {isEn
                          ? 'SBL Sweet Clay Bricks (Babulia, Satkhira)'
                          : 'SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)'}
                      </h1>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-amber-100 md:bg-slate-900/80 md:bg-gradient-to-r md:from-amber-500/30 md:to-orange-600/30 border border-amber-300 md:border-amber-400/60 text-orange-900 md:text-amber-300 text-[8px] sm:text-xs font-black tracking-wide">
                          ★ No. 1
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsMapModalOpen(true)}
                          className="sm:hidden inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-800 border border-orange-300 font-extrabold text-[8px] cursor-pointer"
                        >
                          <MapPin className="w-2.5 h-2.5 text-orange-600 shrink-0" />
                          <span>ম্যাপ</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-3.5 gap-y-0 text-[9px] sm:text-sm text-slate-700 md:text-slate-300 tabular-nums leading-tight">
                      <span className="inline-flex items-center gap-0.5 font-bold text-slate-900 md:text-slate-100">
                        <Phone className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-orange-600 md:text-orange-400 shrink-0" />
                        <span>প্রোঃ মোঃ কামরুল ইসলাম (01913-678010)</span>
                      </span>
                      <span aria-hidden="true" className="text-slate-400 md:text-slate-600">·</span>
                      <span className="inline-flex items-center gap-0.5 font-bold text-slate-900 md:text-slate-100">
                        <Phone className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-600 md:text-amber-400 shrink-0" />
                        <span>পরিচালনায়ঃ সাকিব হোসেন (01728-287018)</span>
                      </span>
                      <span aria-hidden="true" className="hidden sm:inline text-slate-400 md:text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() => setIsMapModalOpen(true)}
                        className="hidden sm:inline-flex items-center gap-1 text-orange-700 md:text-amber-300 hover:underline font-extrabold cursor-pointer tabular-nums text-[10px] sm:text-xs"
                        title="ভাটার গুগল ম্যাপ ও স্যাটেলাইট ভিউ খুলুন"
                      >
                        <MapPin className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-orange-600 md:text-orange-400 shrink-0" />
                        <span>SBL ইটভাটা · ম্যাপ দেখুন</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 md:bg-slate-950/90 text-slate-900 md:text-white border border-orange-200/90 md:border-amber-500/30 rounded-lg sm:rounded-xl px-2 py-0.5 sm:px-4 sm:py-2.5 text-[9px] sm:text-xs flex sm:block items-center justify-between gap-1.5 lg:text-right sm:space-y-1.5 shrink-0 tabular-nums shadow-2xs">
                  <div className="flex flex-wrap items-center lg:justify-end gap-1 sm:gap-2">
                    <span className="font-extrabold text-emerald-700 md:text-emerald-400 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 md:bg-emerald-400 inline-block animate-pulse" />
                      <span className="hidden sm:inline">
                        {isEn
                          ? 'Kiln Season 2026-27 · Live Sync'
                          : 'ভাটা সিজন 2026-27 · অটো-সিঙ্ক সক্রিয়'}
                      </span>
                      <span className="sm:hidden">সিজন 2026-27</span>
                    </span>
                    <LiveDigitalClock />
                  </div>
                  <div className="tabular-nums text-slate-700 md:text-slate-300 font-semibold text-[9px] sm:text-xs">
                    <span className="hidden sm:inline">{isEn ? 'Date:' : 'আজকের তারিখ:'} </span>
                    {metrics.todayDate} ·{' '}
                    {isEn ? 'Memos:' : 'মেমো:'}{' '}
                    <strong className="text-orange-700 md:text-amber-300">{formatBn(dbState.salesMemos.length)}টি</strong>
                  </div>
                </div>
              </section>

              {/* Interactive Theme & Color Profile Studio + Smart Brick Calculator + Quick Search */}
              <ThemeAndSmartToolsBar
                activeTheme={activeTheme}
                onSelectTheme={(t) => {
                  setActiveTheme(t);
                  showToast(
                    isEn
                      ? `Theme switched to ${t} profile!`
                      : 'নতুন প্রিমিয়াম কালার থিম চালু হয়েছে!'
                  );
                }}
                onOpenEstimator={() => setIsEstimatorModalOpen(true)}
                onOpenQuickSearch={() => setIsQuickSearchModalOpen(true)}
                onOpenCoalEfficiency={() => setActiveTab('koyla_dakshta')}
                onOpenFridayHatbarSheet={() => setIsFridayHatbarSheetOpen(true)}
                dashboardViewMode={dashboardViewMode}
                onChangeDashboardViewMode={(nextMode) => setDashboardViewMode(nextMode)}
                isEn={isEn}
              />
            </>
          )}

          {/* Active Tab View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-3 sm:space-y-6 animate-slide-up">
              {/* 1. INFORMATION & REPORT DASHBOARD KPI STRIP: Shown in 'ইনফরমেশন ও রিপোর্ট ড্যাশবোর্ড' (ANALYTICS) & 'সম্পূর্ণ ভিউ' (ALL) */}
              {(dashboardViewMode === 'ANALYTICS' || dashboardViewMode === 'ALL') && (
                <KpiCardsStrip
                  metrics={metrics}
                  activeKpi={activeKpiModal}
                  onSelectKpi={(id) => setActiveKpiModal(id)}
                  isEn={isEn}
                />
              )}

              {/* 1.05 SMART KILN ALERT & AUTO-REMINDER LIVE STRIP */}
              <SmartKilnAlertBannerStrip
                alertReport={smartAlertReport}
                isEn={isEn}
                onOpenAlertCenter={(focusAlertId) => {
                  setAlertCenterFocusId(
                    focusAlertId ||
                      smartAlertReport.activeAlerts[0]?.id ||
                      null
                  );
                  setIsAlertCenterModalOpen(true);
                }}
                onQuickActionAlert={(alertItem) => {
                  if (alertItem.category === 'DUE_TAGADA' && alertItem.memoId) {
                    const foundMemo = dbState.salesMemos.find(
                      (m) => m.id === alertItem.memoId
                    );
                    if (foundMemo) {
                      setDueModalMemoTarget(foundMemo);
                      return;
                    }
                  }
                  setActiveTab(alertItem.targetTab);
                }}
                onDismissAlert={(alertId) => {
                  handleDismissSmartAlert(alertId);
                  showToast(
                    isEn
                      ? 'Alert marked as resolved!'
                      : 'সতর্কতাটি সমাধান হিসেবে চিহ্নিত হয়েছে!'
                  );
                }}
              />

              {/* 1.08 MASTER LIVE-SYNCED SHORTCUT COMMAND HUB ON MAIN DASHBOARD (ভ্যান লোডিং ⇄ ৩ডি ম্যাপ, মেমো ডেলিভারি, সর্দার পেমেন্ট ও কাঠ/জ্বালানি হিসাব) */}
              {(dashboardViewMode === 'ESSENTIAL' ||
                dashboardViewMode === 'ALL') && (
                <DashboardOperationsShortcutsHub
                  todayDate={metrics.todayDate}
                  brickGrades={dbState.brickGrades}
                  salesMemos={dbState.salesMemos}
                  deliveries={dbState.memoDeliveries || []}
                  millPots={dbState.millPots || []}
                  chulliLoads={dbState.chulliLoads || []}
                  chulliUnloads={dbState.chulliUnloads || []}
                  poraiMistriRecords={dbState.poraiMistriRecords || []}
                  rubbishRecords={dbState.rubbishRecords || []}
                  dadonRecords={dbState.dadonRecords || []}
                  woodFuelRecords={dbState.woodFuelRecords || []}
                  fireStartLineNo={enterpriseState.lineSystem?.fireStartLineNo || 1}
                  activeRoundNo={enterpriseState.activeRoundNo || 1}
                  onSaveChulliLoad={handleSaveChulliLoad}
                  onSubmitDelivery={handleSubmitDelivery}
                  onSaveMillPot={handleSaveMillPot}
                  onSaveChulliUnload={handleSaveChulliUnload}
                  onSavePoraiMistri={handleSavePoraiMistri}
                  onSaveRubbish={handleSaveRubbish}
                  onSaveWoodFuel={handleSaveWoodFuel}
                  onPayWoodSupplier={handlePayWoodSupplier}
                  onSaveDadon={handleSaveDadon}
                  onNavigateTab={(tabId) => setActiveTab(tabId as NavigationTab)}
                  onOpenFridayHatbarSheet={() => setIsFridayHatbarSheetOpen(true)}
                />
              )}

              {/* 1.1 FEATURED KILN SMART MODULES: Vertical 1-Column on Mobile, 2x2 on Tablet, 4-Column on Desktop */}
              <div
                data-testid="featured-kiln-smart-modules-strip"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 w-full min-w-0 max-w-full"
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('koyla_dakshta')}
                  className="sbl-btn-interactive text-left p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/95 border-t-3 sm:border-t-4 border-t-emerald-600 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between gap-1 sm:gap-2.5"
                >
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                        <span className="p-1 sm:p-2 rounded-md sm:rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                          <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
                        </span>
                        <span className="text-[11px] sm:text-sm font-black text-slate-950 group-hover:text-emerald-800 transition-colors truncate">
                          {isEn ? 'Coal Efficiency' : 'চুল্লির কয়লা দক্ষতা'}
                        </span>
                      </div>
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold tabular-nums shrink-0">
                        {formatBn(firingRounds.length)} রাউন্ড
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-xs text-slate-600 font-medium leading-snug sm:leading-relaxed line-clamp-1 sm:line-clamp-2">
                      {isEn
                        ? 'Per 1-lakh brick coal & wood burn efficiency vs 17.2T benchmark'
                        : 'প্রতি ১ লক্ষ ইটে কয়লা ও কাঠের রাউন্ড ভিত্তিক দক্ষতা ও সাশ্রয় যাচাই'}
                    </p>
                  </div>
                  <div className="pt-1 sm:pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] font-extrabold text-emerald-700">
                    <span className="truncate">{isEn ? '17.2T / Lakh' : '17.2 টন / লক্ষ'}</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                      {isEn ? 'Open →' : 'খুলুন →'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('chulli_chamber')}
                  className="sbl-btn-interactive text-left p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/95 border-t-3 sm:border-t-4 border-t-orange-600 shadow-xs hover:shadow-md hover:border-orange-400 transition-all cursor-pointer group flex flex-col justify-between gap-1 sm:gap-2.5"
                >
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                        <span className="p-1 sm:p-2 rounded-md sm:rounded-xl bg-orange-50 text-orange-700 border border-orange-200 group-hover:bg-orange-600 group-hover:text-white transition-colors shrink-0">
                          <Factory className="w-3 h-3 sm:w-4 sm:h-4" />
                        </span>
                        <span className="text-[11px] sm:text-sm font-black text-slate-950 group-hover:text-orange-800 transition-colors truncate">
                          {isEn ? '3D 208-Line & Damper Map' : '🧊 ৩ডি চিমনি ২০৮-লাইন ও ডাম্পার ম্যাপ'}
                        </span>
                      </div>
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 text-[11px] font-extrabold tabular-nums shrink-0">
                        ২০৮ লাইন (3D)
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-xs text-slate-600 font-medium leading-snug sm:leading-relaxed line-clamp-1 sm:line-clamp-2">
                      {isEn
                        ? '3D Fixed Chimney 208-line firing, empty chamber unload, van load & damper tracker'
                        : '৩ডি ফিক্সড চিমনি ২০৮ লাইন পোড়ানো, ভ্যান লোড, আনলোড খালি ঘর ও ডাম্পার যাচাই'}
                    </p>
                  </div>
                  <div className="pt-1 sm:pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] font-extrabold text-orange-700">
                    <span className="truncate">{isEn ? '3D · 208 Lines' : '৩ডি · ২০৮ লাইন ম্যাপ'}</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-orange-50 group-hover:bg-orange-600 group-hover:text-white transition-colors shrink-0">
                      {isEn ? 'Open →' : 'খুলুন →'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('land_lease')}
                  className="sbl-btn-interactive text-left p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/95 border-t-3 sm:border-t-4 border-t-amber-500 shadow-xs hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between gap-1 sm:gap-2.5"
                >
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                        <span className="p-1 sm:p-2 rounded-md sm:rounded-xl bg-amber-50 text-amber-700 border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                          <Compass className="w-3 h-3 sm:w-4 sm:h-4" />
                        </span>
                        <span className="text-[11px] sm:text-sm font-black text-slate-950 group-hover:text-amber-800 transition-colors truncate">
                          {isEn ? 'Land Lease Ledger' : 'জমির লিস খতিয়ান'}
                        </span>
                      </div>
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-extrabold tabular-nums shrink-0">
                        {formatBn(enterpriseState.landLeases.length)}টি চুক্তি
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-xs text-slate-600 font-medium leading-snug sm:leading-relaxed line-clamp-1 sm:line-clamp-2">
                      {isEn
                        ? 'Landowner lease ledger, land area, paid amount & who gets how much'
                        : 'যাদের জমি নেওয়া হয়েছে তাদের জমির পরিমাণ, কত টাকা দিলাম ও কে কত পাবে'}
                    </p>
                  </div>
                  <div className="pt-1 sm:pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] font-extrabold text-amber-800">
                    <span className="truncate">{isEn ? 'Land Ledger' : 'জমির খতিয়ান'}</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-amber-50 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                      {isEn ? 'Open →' : 'খুলুন →'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('wastage_register')}
                  className="sbl-btn-interactive text-left p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/95 border-t-3 sm:border-t-4 border-t-rose-600 shadow-xs hover:shadow-md hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between gap-1 sm:gap-2.5"
                >
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                        <span className="p-1 sm:p-2 rounded-md sm:rounded-xl bg-rose-50 text-rose-700 border border-rose-200 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                          <CloudRain className="w-3 h-3 sm:w-4 sm:h-4" />
                        </span>
                        <span className="text-[11px] sm:text-sm font-black text-slate-950 group-hover:text-rose-800 transition-colors truncate">
                          {isEn ? 'Rain & Wastage' : 'বৃষ্টির ক্ষতি ও অপচয়'}
                        </span>
                      </div>
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-extrabold tabular-nums shrink-0">
                        {formatBn(enterpriseState.wastageRecords.length)}টি এন্ট্রি
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-xs text-slate-600 font-medium leading-snug sm:leading-relaxed line-clamp-1 sm:line-clamp-2">
                      {isEn
                        ? 'Rain-damaged raw bricks & kiln overburnt wastage register'
                        : 'বৃষ্টিতে নষ্ট কাঁচা ইট, চুল্লির গামা ও আনলোড ভাঙা ইটের হিসাব'}
                    </p>
                  </div>
                  <div className="pt-1 sm:pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] font-extrabold text-rose-700">
                    <span className="truncate">{isEn ? 'Wastage Log' : 'ক্ষতি ও অপচয়'}</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-rose-50 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                      {isEn ? 'Open →' : 'খুলুন →'}
                    </span>
                  </div>
                </button>
              </div>

              {/* 1.2 COAL & FIRING EFFICIENCY TRACKER LIVE SUMMARY CARD ON DASHBOARD */}
              {(dashboardViewMode === 'ESSENTIAL' ||
                dashboardViewMode === 'ALL' ||
                dashboardViewMode === 'ANALYTICS') && (
                <DashboardCoalEfficiencySummaryCard
                  rounds={firingRounds}
                  benchmarkCoalPerLakhTons={benchmarkCoalPerLakhTons}
                  isEn={isEn}
                  onOpenFullTracker={() => setActiveTab('koyla_dakshta')}
                />
              )}

              {(dashboardViewMode === 'ALL' || dashboardViewMode === 'ANALYTICS') && (
                <>
                  {/* 1A. LIVE SATKHIRA WEATHER MONITORING & RAIN RISK ADVISORY */}
                  <SatkhiraWeatherWidget
                    isEn={isEn}
                    onOpenMapModal={() => setIsMapModalOpen(true)}
                  />

                  {/* 1B. DAILY PRODUCTION GOAL: Mill Pots Daily Targets vs Current Production Visual Progress Bar */}
                  <DailyProductionGoalCard
                    millPots={dbState.millPots || []}
                    todayDate={metrics.todayDate}
                    dailyGoals={dbState.settings?.dailyGoals}
                    isEn={isEn}
                    onSaveDailyGoals={async (updatedGoals) => {
                      await handleSaveSettingsPatch({ dailyGoals: updatedGoals });
                    }}
                    onQuickSaveMillPot={handleSaveMillPot}
                    onOpenMillHisab={() => setActiveTab('mill_hisab')}
                  />

                  {/* 1B. FINANCIAL HEALTH GAUGE: 7-Day Net Cash Movement (Collections minus Expenses) Liquidity Monitor */}
                  <FinancialHealthGaugeCard
                    cashTransactions={dbState.cashTransactions}
                    openingBalance={dbState.settings?.openingBalance || 0}
                    todayDate={metrics.todayDate}
                    isEn={isEn}
                    onOpenCashBook={() => setActiveTab('cashbook')}
                  />
                  {/* 2. Executive Business Overview Strip at the Top */}
                  <Card
                    as="section"
                    variant="dark"
                    topAccent="orange"
                    padding="lg"
                    className="space-y-4"
                  >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 sm:gap-4 border-b border-slate-800/90 pb-2.5 sm:pb-4">
                  <div className="flex items-start sm:items-center gap-2 sm:gap-3.5">
                    <div className="w-6 h-6 sm:w-11 sm:h-11 rounded-md sm:rounded-xl bg-gradient-to-br from-orange-500/25 to-amber-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
                      <BarChart3 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                        <h2 className="text-xs sm:text-lg font-extrabold text-white tracking-tight">
                          {isEn
                            ? 'Kiln Business Analytics & Financial Summary'
                            : 'ভাটা বিজনেস অ্যানালাইটিক্স ও আর্থিক সামারি'}
                        </h2>
                        <span className="text-[10px] sm:text-xs font-extrabold text-emerald-400 tabular-nums">
                          · হেলথ স্কোর: {formatBn(businessAnalysis.healthScore)}/১০০
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
                        {businessAnalysis.healthLabelBn} · সেরা বিক্রিত ইট:{' '}
                        {cleanBrickGradeName(businessAnalysis.topSellingGrade.nameBn)} (
                        {formatBn(businessAnalysis.topSellingGrade.sharePct)}% মার্কেট শেয়ার)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('yearly_seasonal')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white transition-all cursor-pointer shadow-sm"
                    >
                      <CalendarRange className="w-4 h-4" />
                      {isEn ? 'Yearly & Seasonal Report' : 'বার্ষিক ও সিজন হিসাব'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('memos')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-orange-400" />
                      {isEn ? 'View Memo Ledger' : 'মেমো খতিয়ান দেখুন'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('bricks')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-amber-400" />
                      {isEn ? 'Raw & Fired Brick Stock' : 'কাঁচা ও পোড়ানো ইট রিপোর্ট'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 text-xs w-full min-w-0">
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-emerald-500">
                    <span className="text-slate-400 font-medium block">কালেকশন দক্ষতা (Collection Rate)</span>
                    <span className="text-lg font-extrabold text-emerald-400 tabular-nums mt-0.5 block">
                      {formatBn(businessAnalysis.collectionEfficiencyPct)}%
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      নগদ আদায়: {formatCurrencyBn(businessAnalysis.totalCashIn)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-amber-500">
                    <span className="text-slate-400 font-medium block">গড় অর্ডার ভ্যালু (AOV / Memo)</span>
                    <span className="text-lg font-extrabold text-amber-300 tabular-nums mt-0.5 block">
                      {formatCurrencyBn(businessAnalysis.averageOrderValue)}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      মোট মেমো: {formatBn(businessAnalysis.totalMemoCount)}টি
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-cyan-500">
                    <span className="text-slate-400 font-medium block">স্টকের বাজারমূল্য (Inventory Value)</span>
                    <span className="text-lg font-extrabold text-cyan-300 tabular-nums mt-0.5 block">
                      {formatCurrencyBn(businessAnalysis.totalInventoryValuation)}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      মজুত: {formatBn(businessAnalysis.totalInventoryPieces)} পিস ইট
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 border-t-2 border-t-rose-500">
                    <span className="text-slate-400 font-medium block">সর্বোচ্চ বকেয়া ঝুঁকি (Top Debtor)</span>
                    <span className="text-sm font-extrabold text-rose-400 truncate mt-0.5 block">
                      {businessAnalysis.topDebtor ? businessAnalysis.topDebtor.name : 'কোনো বকেয়া নেই'}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {businessAnalysis.topDebtor
                        ? `${formatCurrencyBn(businessAnalysis.topDebtor.dueAmount)} (${formatBn(businessAnalysis.topDebtor.shareOfTotalDuePct)}% শেয়ার)`
                        : '১০০% পরিশোধিত'}
                      </span>
                    </div>
                  </div>
                </Card>
                </>
              )}

              {(dashboardViewMode === 'ALL' || dashboardViewMode === 'ESSENTIAL') && (
                <>
                  {/* 3. FAST-ACTION ROW: Quick Expense Box & Urgent Kiln Notepad Side-by-Side */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-5 items-stretch animate-slide-up">
                {/* Quick Expense Entry Box (তাৎক্ষণিক ভাটা খরচ এন্ট্রি বক্স) */}
                <Card
                  as="form"
                  onSubmit={handleQuickExpenseSubmit}
                  variant="default"
                  topAccent="rose"
                  padding="lg"
                  className="lg:col-span-6 hover:shadow-md transition-all flex flex-col justify-between space-y-2.5 sm:space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-slate-100 pb-2 sm:pb-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-md sm:rounded-xl bg-gradient-to-br from-rose-600 to-red-600 text-white shadow-xs flex items-center justify-center shrink-0">
                        <TrendingDown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[9px] sm:text-[11px] font-bold text-rose-700 tracking-wide">
                          দ্রুত ক্যাশ খরচ এন্ট্রি
                        </span>
                        <h2 className="text-xs sm:text-base font-extrabold text-slate-900 truncate">
                          তাৎক্ষণিক ভাটা খরচ এন্ট্রি বক্স (Quick Expense)
                        </h2>
                        <p className="hidden sm:block text-xs text-slate-500">
                          কয়লা, ভেকু ডিজেল, মাটি বা শ্রমিক খরচ ১-ক্লিকে সরাসরি ক্যাশ বুকে যোগ করুন
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label
                        htmlFor="quick-exp-cat"
                        className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 truncate"
                      >
                        খরচের খাত নির্বাচন
                      </label>
                      <select
                        id="quick-exp-cat"
                        value={quickExpCategory}
                        onChange={(e) => setQuickExpCategory(e.target.value)}
                        className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-rose-500 focus:outline-hidden"
                      >
                        <option value="কয়লা ক্রয়">কয়লা ক্রয়</option>
                        <option value="ভেকু ও ডিজেল">ভেকু ও ডিজেল</option>
                        <option value="মাটি ক্রয়">মাটি ক্রয়</option>
                        <option value="শ্রমিক ও সর্দার পেমেন্ট">
                          শ্রমিক ও সর্দার পেমেন্ট
                        </option>
                        <option value="বিদ্যুৎ ও জ্বালানি">বিদ্যুৎ ও জ্বালানি</option>
                        <option value="অন্যান্য খরচ">অন্যান্য খরচ</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="quick-exp-amt"
                        className="block text-[11px] sm:text-xs font-bold text-rose-800 mb-1 truncate"
                      >
                        টাকার পরিমাণ (৳) *
                      </label>
                      <input
                        id="quick-exp-amt"
                        type="number"
                        min={1}
                        required
                        placeholder="যেমন: 1500"
                        value={quickExpAmount}
                        onChange={(e) => setQuickExpAmount(e.target.value)}
                        className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm bg-rose-50/50 border-2 border-rose-300 rounded-xl tabular-nums font-bold font-mono text-rose-950 focus:bg-white focus:border-rose-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Quick Expense Preset Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      দ্রুত অংক:
                    </span>
                    {[500, 1000, 2000, 5000, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuickExpAmount(String(preset))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 cursor-pointer tabular-nums transition-colors"
                      >
                        ৳{formatBn(preset)}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      aria-label="তাৎক্ষণিক খরচের বিবরণ"
                      placeholder="বিবরণ লিখুন (যেমন: ভেকু ডিজেল ৩০ লিটার বা মাটির ট্রাক)..."
                      value={quickExpDesc}
                      onChange={(e) => setQuickExpDesc(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-rose-500 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl hover:from-rose-500 hover:to-red-500 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-95"
                    >
                      + খরচ যোগ করুন
                    </button>
                  </div>
                </Card>

                {/* Urgent Kiln Notepad Box (জরুরি নোট ও রিমাইন্ডার বক্স) */}
                <Card
                  variant="default"
                  topAccent="amber"
                  padding="lg"
                  className="lg:col-span-6 hover:shadow-md transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-slate-100 pb-2 sm:pb-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-md sm:rounded-xl bg-gradient-to-br from-orange-600 to-amber-500 text-white shadow-xs flex items-center justify-center shrink-0">
                        <StickyNote className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[9px] sm:text-[11px] font-bold text-amber-800 tracking-wide">
                          ভাটা ডায়েরি ও রিমাইন্ডার
                        </span>
                        <h2 className="text-xs sm:text-base font-extrabold text-slate-900 truncate">
                          জরুরি নোট ও রিমাইন্ডার বক্স (Kiln Notepad)
                        </h2>
                        <p className="hidden sm:block text-xs text-slate-500">
                          সর্দারের দাদন, কয়লার গাড়ি বা ডেলিভারির জরুরি কথা উপরেই লিখে রাখুন
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-extrabold text-amber-900 tabular-nums shrink-0">
                      মোট {formatBn(dbState.kilnNotes.length)}টি নোট
                    </span>
                  </div>

                  <form
                    onSubmit={handleAddNoteSubmit}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2"
                  >
                    <select
                      aria-label="নোটের গুরুত্ব"
                      value={notePriority}
                      onChange={(e) =>
                        setNotePriority(e.target.value as 'URGENT' | 'NORMAL')
                      }
                      className="px-3 py-2.5 text-xs font-bold bg-amber-50/70 border border-amber-300 rounded-xl text-amber-950 focus:outline-hidden"
                    >
                      <option value="URGENT">🔥 জরুরি</option>
                      <option value="NORMAL">📌 সাধারণ</option>
                    </select>
                    <input
                      type="text"
                      aria-label="নতুন জরুরি নোট লিখুন"
                      placeholder="যেমন: শনিবার রহিম সর্দারকে ২০ হাজার টাকা দিতে হবে..."
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 text-xs sm:text-sm font-bold bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-500 hover:to-amber-500 whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      + নোট সেভ
                    </button>
                  </form>

                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {dbState.kilnNotes.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 text-xs transition-colors ${
                          n.completed
                            ? 'bg-slate-50 border-slate-200 opacity-75'
                            : n.priority === 'URGENT'
                            ? 'bg-orange-50/50 border-orange-200/80'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={n.completed}
                            onChange={(e) =>
                              handleToggleNote(n.id, e.target.checked)
                            }
                            className="mt-0.5 w-4 h-4 accent-orange-600 rounded cursor-pointer"
                          />
                          <span
                            className={
                              n.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-800 font-medium'
                            }
                          >
                            {n.priority === 'URGENT' && (
                              <strong className="text-orange-700 mr-1">
                                [জরুরি]
                              </strong>
                            )}
                            {n.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          aria-label="নোট মুছে ফেলুন"
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
                </>
              )}

              {/* Recent Memos, 7-Day Chart, Daily Goal Tracker & Customer Due List: Shown in 'ইনফরমেশন ও রিপোর্ট ড্যাশবোর্ড' (ANALYTICS) & 'সম্পূর্ণ ভিউ' (ALL) */}
              {(dashboardViewMode === 'ANALYTICS' || dashboardViewMode === 'ALL') && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left 7 Columns: Recent Memos & 7-Day Chart */}
                  <div className="lg:col-span-7 space-y-6">
                  {/* Recent Memos Quick List with Popup Action Buttons */}
                  <Card
                    variant="default"
                    topAccent="orange"
                    padding="none"
                  >
                    <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-white to-orange-50/40 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        {isEn
                          ? `Recent Cash Memos (${formatBn(dbState.salesMemos.length)})`
                          : `সাম্প্রতিক ডিজিটাল ক্যাশ মেমোসমূহ (${formatBn(dbState.salesMemos.length)}টি)`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('memos')}
                        className="text-xs font-bold text-orange-700 hover:text-orange-800 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {isEn ? 'View All Memos →' : 'সকল মেমো ও বাকি খাতা দেখুন →'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 whitespace-nowrap">
                            <th className="py-2 px-2.5 font-extrabold text-center w-8">ক্রঃ</th>
                            <th className="py-2 px-2.5 font-extrabold">মেমো নং</th>
                            <th className="py-2 px-2.5 font-extrabold">ক্রেতা ও তারিখ</th>
                            <th className="py-2 px-2.5 font-extrabold">ইট ও পরিমাণ</th>
                            <th className="py-2 px-2.5 font-extrabold text-right">মোট বিল</th>
                            <th className="py-2 px-2.5 font-extrabold text-right">বাকি</th>
                            <th className="py-2 px-2.5 font-extrabold text-right">বিস্তারিত ও ডেলিভারি</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {dbState.salesMemos.slice(0, 6).map((m, idx) => (
                            <tr
                              key={m.id}
                              onClick={() => setViewMemoTarget(m)}
                              className="hover:bg-orange-50/40 transition-colors cursor-pointer whitespace-nowrap align-middle"
                            >
                              <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-500 tabular-nums">
                                {formatBn(idx + 1)}
                              </td>
                              <td className="py-2 px-2.5 tabular-nums">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewMemoTarget(m);
                                  }}
                                  className="font-extrabold font-mono text-orange-700 hover:underline cursor-pointer"
                                  title="মেমো বিস্তারিত পপআপ খুলুন"
                                >
                                  #{m.memoNo}
                                </button>
                              </td>
                              <td className="py-2 px-2.5 max-w-[180px] truncate">
                                <span className="font-bold text-slate-900">
                                  {m.customerName}
                                </span>
                                <span className="text-[11px] text-slate-500 ml-1 tabular-nums">
                                  · {m.date}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-slate-800 font-semibold tabular-nums">
                                {m.items && m.items.length > 0
                                  ? m.items
                                      .map(
                                        (it) =>
                                          `${cleanBrickGradeName(it.gradeName)} (${formatBn(it.quantity)})`
                                      )
                                      .join(', ')
                                  : `${cleanBrickGradeName(m.gradeName || '১ নং ইট')} (${formatBn(
                                      m.quantity || 0
                                    )})`}
                              </td>
                              <td className="py-2 px-2.5 text-right font-extrabold text-slate-950 tabular-nums">
                                {formatCurrencyBn(m.totalAmount)}
                              </td>
                              <td className="py-2 px-2.5 text-right font-extrabold tabular-nums">
                                {m.dueAmount > 0 ? (
                                  <span className="text-rose-700">
                                    {formatCurrencyBn(m.dueAmount)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 text-[11px] font-bold">
                                    পরিশোধিত
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-2 px-2.5 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeliveryTargetMemoNo(m.memoNo);
                                      setActiveTab('delivery_hisab');
                                    }}
                                    title="এই মেমোতে ইট ডেলিভারি দিন"
                                    className="btn-tactile inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-full hover:from-orange-500 hover:to-amber-500 cursor-pointer transition-colors"
                                  >
                                    <Truck className="w-3 h-3" />
                                    ডেলিভারি
                                  </button>
                                  {m.dueAmount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setDueModalMemoTarget(m)}
                                      title="বকেয়া আদায় পপআপ"
                                      className="btn-tactile inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded-full hover:bg-emerald-500 cursor-pointer transition-colors"
                                    >
                                      <Banknote className="w-3 h-3" />
                                      জমা
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setViewMemoTarget(m)}
                                    title="বিস্তারিত পপআপ"
                                    className="btn-tactile inline-flex items-center gap-0.5 px-2.5 py-1 text-[10px] font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-full cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 text-amber-300" />
                                    বিস্তারিত
                                  </button>
                                  <a
                                    href={`https://wa.me/${
                                      m.customerPhone && m.customerPhone.replace(/\D/g, '').length >= 10
                                        ? `88${m.customerPhone.replace(/\D/g, '').slice(-11)}`
                                        : ''
                                    }?text=${encodeURIComponent(
                                      `🧱 *SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)*\n📄 *ডিজিটাল ক্যাশ মেমো রসিদ*\nমেমো নং: #${m.memoNo} | তারিখ: ${m.date}\nক্রেতা: ${m.customerName}\nমোট বিল: ${formatCurrencyBn(m.totalAmount)}\nনগদ জমা: ${formatCurrencyBn(m.paidAmount)}\nবর্তমান বাকি: ${formatCurrencyBn(m.dueAmount)}\nপ্রোঃ মোঃ কামরুল ইসলাম সাহেব (01913-678010)`
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="১ ক্লিকে হোয়াটসঅ্যাপ রসিদ পাঠান"
                                    className="btn-tactile inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-full cursor-pointer"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>WA</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setPrintMemoTarget(m)}
                                    title="প্রিন্ট ও গেটপাস পপআপ"
                                    className="p-1 text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-md cursor-pointer transition-colors"
                                  >
                                    <Printer className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {dbState.salesMemos.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="py-7 px-4 text-center bg-slate-50/60"
                              >
                                <div className="space-y-2">
                                  <p className="text-xs font-bold text-slate-700">
                                    {isEn
                                      ? 'No digital cash memos recorded in this session yet.'
                                      : 'এই সেশনে এখনো কোনো ডিজিটাল ক্যাশ মেমো তৈরি করা হয়নি।'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setIsNewMemoModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                                  >
                                    <FilePlus2 className="w-3.5 h-3.5" />
                                    <span>
                                      {isEn
                                        ? '+ Create First Cash Memo'
                                        : '+ প্রথম ডিজিটাল ক্যাশ মেমো তৈরি করুন'}
                                    </span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* 7-Day Sales, Collection & Expense Visual Chart */}
                  {metrics.sevenDayChart && metrics.sevenDayChart.length > 0 && (
                    <Card
                      variant="default"
                      topAccent="orange"
                      padding="lg"
                      className="space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">
                              গত ৭ দিনের ইট বিক্রি, নগদ আদায় ও খরচের তুলনামূলক চিত্র
                            </h3>
                            <p className="text-xs text-slate-500">
                              ইটভাটার দৈনিক আয় (সবুজ), বিক্রি (ইট-কমলা) এবং খরচ (লাল) বিশ্লেষণ
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                          <span className="inline-flex items-center gap-1.5 text-orange-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-orange-600" />
                            বিক্রি
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                            নগদ জমা
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-rose-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                            খরচ
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2 pt-2 items-end h-40 border-b border-slate-200 pb-2">
                        {metrics.sevenDayChart.map((pt) => {
                          const sPct = Math.max(
                            6,
                            Math.round((pt.salesAmount / maxChartVal) * 100)
                          );
                          const cPct = Math.max(
                            6,
                            Math.round((pt.cashInAmount / maxChartVal) * 100)
                          );
                          const ePct = Math.max(
                            6,
                            Math.round((pt.expenseAmount / maxChartVal) * 100)
                          );
                          return (
                            <div
                              key={pt.date}
                              className="flex flex-col items-center justify-end h-full gap-1.5 group"
                            >
                              <div className="w-full flex items-end justify-center gap-1 h-28 px-1">
                                <div
                                  style={{ height: `${sPct}%` }}
                                  title={`বিক্রি: ${formatCurrencyBn(pt.salesAmount)}`}
                                  className="w-2.5 sm:w-3 bg-orange-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                                />
                                <div
                                  style={{ height: `${cPct}%` }}
                                  title={`নগদ জমা: ${formatCurrencyBn(pt.cashInAmount)}`}
                                  className="w-2.5 sm:w-3 bg-emerald-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                                />
                                <div
                                  style={{ height: `${ePct}%` }}
                                  title={`খরচ: ${formatCurrencyBn(pt.expenseAmount)}`}
                                  className="w-2.5 sm:w-3 bg-rose-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                                {pt.dateLabelBn}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </div>

                {/* Right 5 Columns: Daily Goal Tracker + Customer Due Box */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Daily Goal Tracker Card on Dashboard */}
                  <Card
                    variant="default"
                    topAccent="emerald"
                    padding="lg"
                    className="space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-slate-900">
                            ডেইলি গোল ট্র্যাকার ({formatBn(dailyGoalStats.overallCompletionPct)}%)
                          </h2>
                          <p className="text-xs text-slate-600 font-medium">
                            আজকের কাঁচা ইট, লোড, ডেলিভারি ও ক্যাশ আদায়ের লক্ষ্যমাত্রা
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('daily_closing')}
                        className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        দৈনিক ক্লোজিং শিট →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {dailyGoalStats.items.slice(0, 4).map((goalItem) => (
                        <div
                          key={goalItem.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                            <span className="truncate">{goalItem.labelBn}</span>
                            <span className="text-emerald-700">
                              {formatBn(goalItem.progressPct)}%
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-900 mt-0.5 tabular-nums truncate">
                            {goalItem.unitBn === 'টাকা'
                              ? formatCurrencyBn(goalItem.actual)
                              : `${formatBn(goalItem.actual)} / ${formatBn(goalItem.target)}`}
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${goalItem.progressPct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Outstanding Customer Due Quick Action List */}
                  <Card
                    variant="default"
                    topAccent="amber"
                    padding="lg"
                    className="space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-slate-900">
                            বকেয়া পাওনা খাতা ({formatBn(dueMemos.length)}টি মেমো)
                          </h2>
                          <p className="text-xs text-slate-600 font-medium">
                            মোট পাওনা: <strong className="text-rose-700">{formatCurrencyBn(metrics.totalCustomerDue)}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('due_tagada')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp তাগাদা
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('memos')}
                          className="text-xs font-bold text-orange-700 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          খতিয়ান →
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {dueMemos.slice(0, 7).map((m) => (
                        <div
                          key={m.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-amber-50/30 px-1.5 rounded-lg transition-colors"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setViewMemoTarget(m)}
                              className="font-bold text-slate-900 hover:text-orange-700 hover:underline truncate cursor-pointer text-left"
                            >
                              {m.customerName} ({m.memoNo})
                            </button>
                            <div className="text-slate-500 truncate">
                              মোবাইল: {m.customerPhone} · তারিখ: {m.date}
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <div className="font-extrabold text-rose-700 tabular-nums">
                                {formatCurrencyBn(m.dueAmount)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDueModalMemoTarget(m)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 rounded-lg cursor-pointer transition-all shadow-2xs"
                            >
                              জমা নিন
                            </button>
                          </div>
                        </div>
                      ))}
                      {dueMemos.length === 0 && (
                        <div className="py-4 text-center text-xs text-slate-500">
                          বর্তমানে কোনো ক্রেতার কাছে বকেয়া পাওনা নেই।
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
              )}

              {/* 4. ALL-SECTIONS DASHBOARD SHORTCUT HUB (শুধুমাত্র 'সম্পূর্ণ ভিউ' ড্যাশবোর্ডে দৃশ্যমান) */}
              {dashboardViewMode === 'ALL' && (
                <Card
                  as="section"
                  data-testid="dashboard-all-sections-shortcuts"
                  variant="default"
                  topAccent="orange"
                  padding="lg"
                  className="space-y-4"
                >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-bold mb-1">
                      <LayoutDashboard className="w-3.5 h-3.5 text-orange-600" />
                      <span>ড্যাশবোর্ড মাস্টার শর্টকাট হাব</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      {isEn
                        ? `One-Click Quick Access to All ${formatBn(navItems.length - 1)} Kiln Sections`
                        : `ভাটার সকল ${formatBn(navItems.length - 1)}টি সেকশনের এক-ক্লিক শর্টকাট`}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {isEn
                        ? 'Jump directly to any module from the dashboard — each section contains only its own dedicated records.'
                        : 'ড্যাশবোর্ড থেকে যেকোনো সেকশনে সরাসরি প্রবেশ করুন — প্রতিটি সেকশনের ভেতরে শুধুমাত্র সেই নির্দিষ্ট সেকশনের নিজস্ব হিসাব রয়েছে।'}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-300 text-xs font-extrabold self-start sm:self-auto shrink-0">
                    {isEn
                      ? `Total ${formatBn(navItems.length - 1)} Active Modules`
                      : `মোট ${formatBn(navItems.length - 1)}টি মডিউল সক্রিয়`}
                  </span>
                </div>

                {/* Kiln GPS Google Maps Featured Strip */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600/30 border border-orange-500/50 flex items-center justify-center text-orange-400 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-orange-400 uppercase tracking-wider">
                          {isEn
                            ? 'Kiln Main Google Maps Location & Satellite View'
                            : 'ভাটার মূল গুগল ম্যাপ লোকেশন ও স্যাটেলাইট ভিউ'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800">
                          {KILN_COORDINATES.coordinatesRaw}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {isEn
                          ? 'SBL Sweet Clay Bricks (Babulia, Satkhira)'
                          : 'SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)'}
                      </div>
                      <p className="text-xs text-slate-300">
                        {isEn
                          ? 'Live GPS map & satellite directions for kiln chimney, mill pots 1-2-3, drying yard, office & truck gate.'
                          : 'চুল্লি, 1-2-3 মিল পট, কাঁচা ইট মাঠ, অফিস ও ট্রাক ডেলিভারি ডিপোর লাইভ জিপিএস ম্যাপ ও স্যাটেলাইট ডিরেকশন।'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsMapModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-black cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      {isEn ? 'Open Google Maps & Satellite View' : 'গুগল ম্যাপ ও স্যাটেলাইট খুলুন'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {navGroups.map((grpBn) => {
                    const groupShortcuts = navItems.filter(
                      (item) => item.groupBn === grpBn && item.id !== 'dashboard'
                    );
                    if (groupShortcuts.length === 0) return null;
                    return (
                      <div key={grpBn} className="space-y-2">
                        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider px-1">
                          {isEn ? groupShortcuts[0]?.groupEn : grpBn}
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                          {groupShortcuts.map((sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => {
                                if (sc.id === 'delivery_hisab') {
                                  setDeliveryTargetMemoNo('');
                                }
                                setActiveTab(sc.id);
                              }}
                              className={`text-left p-2.5 sm:p-3.5 rounded-xl bg-slate-50/90 hover:bg-orange-50/60 border border-slate-200/90 hover:border-orange-400 border-t-4 ${
                                sc.badgeColor || 'border-t-orange-600'
                              } transition-all cursor-pointer group shadow-2xs hover:shadow-md flex flex-col justify-between gap-1.5 sm:gap-2`}
                            >
                              <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                  <span className="p-1.5 sm:p-2 rounded-lg bg-slate-900 text-white shrink-0 group-hover:bg-orange-600 transition-colors">
                                    {sc.icon}
                                  </span>
                                  <span className="text-[11px] sm:text-sm font-extrabold text-slate-900 group-hover:text-orange-800 truncate">
                                    {isEn ? sc.labelEn : sc.labelBn}
                                  </span>
                                </div>
                                {sc.countBn && (
                                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-[10px] sm:text-[11px] font-extrabold font-mono tabular-nums shrink-0">
                                    {sc.countBn}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-[11px] text-slate-600 line-clamp-1">
                                {isEn ? sc.descEn : sc.descBn}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              )}
            </div>
          )}

          {activeTab === 'memos' && (
            <SalesLedgerTab
              lang={lang}
              todayDate={metrics.todayDate}
              yesterdayDate={metrics.yesterdayDate}
              salesMemos={dbState.salesMemos}
              brickGrades={dbState.brickGrades}
              memoDeliveries={dbState.memoDeliveries || []}
              onOpenNewMemoModal={() => {
                setIsNewMemoModalOpen(true);
                setTimeout(() => {
                  document.getElementById('memo-customer-input')?.focus();
                }, 80);
              }}
              onViewMemo={(memo) => setViewMemoTarget(memo)}
              onOpenDueModal={(memo) => setDueModalMemoTarget(memo)}
              onOpenEditModal={(memo) => setEditModalMemoTarget(memo)}
              onOpenDeleteModal={(memo) => setDeleteMemoTarget(memo)}
              onPrintMemo={(memo) => setPrintMemoTarget(memo)}
              onOpenDeliveryForMemo={(memo) => {
                setDeliveryTargetMemoNo(memo.memoNo);
                setActiveTab('delivery_hisab');
              }}
              onSubmitDelivery={handleSubmitDelivery}
            />
          )}

          {activeTab === 'delivery_hisab' && (
            <BrickDeliveryTab
              lang={lang}
              todayDate={metrics.todayDate}
              initialMemoNo={deliveryTargetMemoNo}
              salesMemos={dbState.salesMemos}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              memoDeliveries={dbState.memoDeliveries || []}
              onSubmitDelivery={handleSubmitDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              onViewMemo={(memo) => setViewMemoTarget(memo)}
            />
          )}

          {activeTab === 'mill_hisab' && (
            <BrickGradeReportTab
              key="mill_hisab"
              lang={lang}
              initialSectionView="MILLS"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              rubbishRecords={dbState.rubbishRecords || []}
              productionPayments={dbState.productionPayments || []}
              salesMemos={dbState.salesMemos}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onSaveRubbish={handleSaveRubbish}
              onDeleteRubbish={handleDeleteRubbish}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'van_hisab' && (
            <BrickGradeReportTab
              key="van_hisab"
              lang={lang}
              initialSectionView="CHULLI_LOAD"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              rubbishRecords={dbState.rubbishRecords || []}
              productionPayments={dbState.productionPayments || []}
              salesMemos={dbState.salesMemos}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onSaveRubbish={handleSaveRubbish}
              onDeleteRubbish={handleDeleteRubbish}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'porai_mistri' && (
            <BrickGradeReportTab
              key="porai_mistri"
              lang={lang}
              initialSectionView="PORAI_MISTRI"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              rubbishRecords={dbState.rubbishRecords || []}
              productionPayments={dbState.productionPayments || []}
              salesMemos={dbState.salesMemos}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onSaveRubbish={handleSaveRubbish}
              onDeleteRubbish={handleDeleteRubbish}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'rubbish_hisab' && (
            <BrickGradeReportTab
              key="rubbish_hisab"
              lang={lang}
              initialSectionView="RUBBISH_MISTRI"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              rubbishRecords={dbState.rubbishRecords || []}
              productionPayments={dbState.productionPayments || []}
              salesMemos={dbState.salesMemos}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onSaveRubbish={handleSaveRubbish}
              onDeleteRubbish={handleDeleteRubbish}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'unload_hisab' && (
            <BrickGradeReportTab
              key="unload_hisab"
              lang={lang}
              initialSectionView="CHULLI_UNLOAD"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              rubbishRecords={dbState.rubbishRecords || []}
              productionPayments={dbState.productionPayments || []}
              salesMemos={dbState.salesMemos}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onSaveRubbish={handleSaveRubbish}
              onDeleteRubbish={handleDeleteRubbish}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'bricks' && (
            <BrickGradeReportTab
              key="bricks"
              lang={lang}
              initialSectionView="FIRED_STOCK"
              hideOverviewBanner={true}
              rows={gradeReport.rows}
              totals={gradeReport.totals}
              brickGrades={dbState.brickGrades}
              millPots={dbState.millPots || []}
              chulliLoads={dbState.chulliLoads || []}
              poraiMistriRecords={dbState.poraiMistriRecords || []}
              chulliUnloads={dbState.chulliUnloads || []}
              rubbishRecords={dbState.rubbishRecords || []}
              productionPayments={dbState.productionPayments || []}
              salesMemos={dbState.salesMemos}
              onAddStock={handleAddStock}
              onSaveMillPot={handleSaveMillPot}
              onDeleteMillPot={handleDeleteMillPot}
              onSaveChulliLoad={handleSaveChulliLoad}
              onDeleteChulliLoad={handleDeleteChulliLoad}
              onSavePoraiMistri={handleSavePoraiMistri}
              onDeletePoraiMistri={handleDeletePoraiMistri}
              onSaveChulliUnload={handleSaveChulliUnload}
              onDeleteChulliUnload={handleDeleteChulliUnload}
              onSaveRubbish={handleSaveRubbish}
              onDeleteRubbish={handleDeleteRubbish}
              onDeleteProductionPayment={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'jalani_hisab' && (
            <JalaniHisabTab
              lang={lang}
              todayDate={metrics.todayDate}
              woodFuelRecords={dbState.woodFuelRecords || []}
              productionPayments={dbState.productionPayments || []}
              onSaveWoodFuel={handleSaveWoodFuel}
              onPayWoodSupplier={handlePayWoodSupplier}
              onDeleteWoodFuel={handleDeleteWoodFuel}
              onDeletePaymentRecord={handleDeleteProductionPayment}
            />
          )}

          {activeTab === 'labour' && (
            <LabourSectionTab
              lang={lang}
              todayDate={metrics.todayDate}
              workerProfiles={dbState.workerProfiles}
              workerAttendance={dbState.workerAttendance}
              onSaveWorkerProfile={handleSaveWorkerProfile}
              onToggleWorkerHajira={handleToggleWorkerHajira}
              onPayWorker={handlePayWorker}
              onSaveWorkerAttendance={handleSaveWorkerAttendance}
            />
          )}

          {activeTab === 'cashbook' && (
            <CashBookTab
              cashTransactions={dbState.cashTransactions}
              onAddCashTx={handleAddCashTx}
              onUpdateCashTx={handleUpdateCashTx}
              onDeleteCashTx={handleDeleteCashTx}
            />
          )}

          {(activeTab === 'mati_koyla' ||
            activeTab === 'dadon_khata' ||
            activeTab === 'booking_party' ||
            activeTab === 'veku_truck' ||
            activeTab === 'license_kisti') && (
            <KilnAdvancedLedgersTab
              activeSection={activeTab as AdvancedLedgerSection}
              onSelectSection={(sec) => setActiveTab(sec)}
              state={dbState}
              todayDate={metrics.todayDate}
              onSaveSoilCoal={handleSaveSoilCoal}
              onDeleteSoilCoal={handleDeleteSoilCoal}
              onSaveDadon={handleSaveDadon}
              onDeleteDadon={handleDeleteDadon}
              onSaveAdvanceBooking={handleSaveAdvanceBooking}
              onUpdateAdvanceBooking={handleUpdateAdvanceBooking}
              onDeleteAdvanceBooking={handleDeleteAdvanceBooking}
              onSaveVehicleDiesel={handleSaveVehicleDiesel}
              onDeleteVehicleDiesel={handleDeleteVehicleDiesel}
              onSaveCompliance={handleSaveCompliance}
              onUpdateCompliance={handleUpdateCompliance}
              onDeleteCompliance={handleDeleteCompliance}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'yearly_seasonal' && (
            <YearlySeasonalAnalyticsTab
              lang={lang}
              dbState={dbState}
              onSaveSeason={handleSaveSeason}
              onCloseSeason={handleCloseSeason}
              onReopenSeason={handleReopenSeason}
            />
          )}

          {(activeTab === 'hazar_khoroch' ||
            activeTab === 'due_tagada' ||
            activeTab === 'daily_closing') && (
            <KilnSmartOperationsHubTab
              activeSection={activeTab as SmartHubSection}
              onSelectSection={(sec) => setActiveTab(sec)}
              state={dbState}
              todayDate={metrics.todayDate}
              onSaveSettingsPatch={handleSaveSettingsPatch}
              onOpenDueModalForMemo={(memo) => setDueModalMemoTarget(memo)}
              onViewMemo={(memo) => setViewMemoTarget(memo)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'land_lease' && (
            <LandLeaseLedgerTab
              todayDate={metrics.todayDate}
              landLeases={enterpriseState.landLeases || []}
              onSaveLandLease={handleSaveLandLease}
              onAddLandTruckTrip={handleAddLandTruckTrip}
              onDeleteLandLease={handleDeleteLandLease}
              onAddLandPayment={handleLandLeasePayment}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeTab === 'chulli_chamber' ||
            activeTab === 'wastage_register' ||
            activeTab === 'staff_salary') && (
            <KilnEnterpriseOperationsTab
              activeSection={activeTab as EnterpriseSectionId}
              lang={lang}
              todayDate={metrics.todayDate}
              totalRawBricksCut={(dbState.millPots || []).reduce((s, p) => s + p.rawBricksCut, 0)}
              totalBricksFiredInChulli={Math.max(
                (dbState.poraiMistriRecords || []).reduce((s, r) => s + r.bricksFired, 0),
                (dbState.chulliUnloads || []).reduce((s, u) => s + (u.totalBricksUnloaded || 0), 0),
                (dbState.chulliLoads || []).reduce((s, l) => s + l.rawBricksLoaded, 0)
              )}
              totalBricksSoldAllGrades={(dbState.salesMemos || []).reduce(
                (s, m) =>
                  s +
                  (Array.isArray(m.items) && m.items.length > 0
                    ? m.items.reduce((isum, it) => isum + (Number(it.quantity) || 0), 0)
                    : Number(m.quantity) || 0),
                0
              )}
              totalVanLoadedBricks={(dbState.chulliLoads || []).reduce(
                (s, l) =>
                  s +
                  (l.totalBricksLoaded !== undefined
                    ? Number(l.totalBricksLoaded) || 0
                    : (Number(l.rawBricksLoaded) || 0) + (Number(l.pakaBricksLoaded) || 0)),
                0
              )}
              totalUnloadedLines={(dbState.chulliUnloads || []).reduce(
                (s, u) =>
                  s +
                  (Number(u.linesUnloaded) > 0
                    ? Number(u.linesUnloaded)
                    : Math.round((Number(u.totalBricksUnloaded) || 0) / 4000)),
                0
              )}
              totalUnloadedBricks={(dbState.chulliUnloads || []).reduce(
                (s, u) => s + (Number(u.totalBricksUnloaded) || 0),
                0
              )}
              totalBrickStockPieces={metrics.totalBrickStockPieces}
              millBreakdown={[
                {
                  millNameBn: '১. ওহাব মিল (Ohab Mill)',
                  rawBricksCut: (dbState.millPots || [])
                    .filter((p) => p.millId === 'ohab')
                    .reduce((s, p) => s + p.rawBricksCut, 0),
                },
                {
                  millNameBn: '২. মফিজুল মিল (Mofijul Mill)',
                  rawBricksCut: (dbState.millPots || [])
                    .filter((p) => p.millId === 'mofijul')
                    .reduce((s, p) => s + p.rawBricksCut, 0),
                },
                {
                  millNameBn: '৩. শফিকুল মিল (Sofikul Mill)',
                  rawBricksCut: (dbState.millPots || [])
                    .filter((p) => p.millId === 'sofikul')
                    .reduce((s, p) => s + p.rawBricksCut, 0),
                },
              ]}
              enterpriseState={enterpriseState}
              roleMode={roleMode}
              onUpdateEnterpriseState={handleUpdateEnterpriseState}
              onAddCashTx={handleAddCashTx}
              onShowToast={showToast}
              onSaveChulliLoad={handleSaveChulliLoad}
              onSaveChulliUnload={handleSaveChulliUnload}
            />
          )}

          {activeTab === 'koyla_dakshta' && (
            <CoalFiringEfficiencyTab
              lang={lang}
              todayDate={metrics.todayDate}
              rounds={firingRounds}
              benchmarkCoalPerLakhTons={benchmarkCoalPerLakhTons}
              onChangeBenchmark={(nextVal) => {
                setBenchmarkCoalPerLakhTons(nextVal);
                try {
                  localStorage.setItem('sbl_coal_benchmark_v1', String(nextVal));
                } catch {
                  // ignore
                }
              }}
              onAddRound={(newRound) => {
                const created: KilnFiringRoundRecord = {
                  ...newRound,
                  id: `round-${Date.now()}`,
                };
                const updated = [...firingRounds, created];
                setFiringRounds(updated);
                try {
                  localStorage.setItem('sbl_firing_rounds_v2_zero', JSON.stringify(updated));
                } catch {
                  // ignore
                }
                showToast(
                  isEn
                    ? `Firing Round #${created.roundNo} saved and analyzed!`
                    : `পোড়াই রাউন্ড #${formatBn(created.roundNo)}-এর কয়লা ও জ্বালানি দক্ষতা হিসাব সংরক্ষিত হয়েছে!`
                );
              }}
              onDeleteRound={(id) => {
                if (!requireOwnerPermission()) return;
                const updated = firingRounds.filter((r) => r.id !== id);
                setFiringRounds(updated);
                try {
                  localStorage.setItem('sbl_firing_rounds_v2_zero', JSON.stringify(updated));
                } catch {
                  // ignore
                }
                showToast(
                  isEn ? 'Firing round deleted.' : 'পোড়াই রাউন্ড মুছে ফেলা হয়েছে।'
                );
              }}
            />
          )}
        </main>

        {/* Phone Mode Fixed Bottom 2-Tier Ergonomic Thumb-Zone Command Dock (md:hidden) — All Quick Tabs, Fullscreen & Primary Actions within One-Handed Thumb Reach */}
        <nav
          aria-label={isEn ? 'Phone App Bottom Navigation' : 'ফোন অ্যাপ নিচের থাম্ব-জোন শর্টকাট বার'}
          data-testid="phone-bottom-app-nav"
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/98 backdrop-blur-md border-t-2 border-orange-300/90 text-slate-800 shadow-[0_-6px_24px_rgba(15,23,42,0.14)] sbl-thumb-zone-safe"
        >
          {/* Thumb Tier 1: Ergonomic Thumb-Zone Quick-Tab & Action Scroller (বুড়ো আঙুলের নাগালে সব খাতা ও ফুল-স্ক্রিন বাটন) */}
          <div
            data-testid="phone-quick-tab-scroller"
            className="px-1.5 py-1 border-b border-orange-200/70 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/90 flex items-center gap-1 overflow-x-auto no-scrollbar"
          >
            <button
              type="button"
              data-testid="thumb-zone-fullscreen-btn"
              onClick={() => void handleToggleFullScreen()}
              className={`px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap shrink-0 transition-all cursor-pointer border inline-flex items-center gap-1 ${
                isFullScreenMode
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                  : 'bg-slate-900 text-amber-300 border-slate-700'
              }`}
            >
              {isFullScreenMode ? (
                <Minimize2 className="w-2.5 h-2.5 shrink-0" />
              ) : (
                <Maximize2 className="w-2.5 h-2.5 shrink-0" />
              )}
              <span>{isFullScreenMode ? 'সাধারণ পর্দা' : 'ফুল-স্ক্রিন'}</span>
            </button>

            {(
              [
                { id: 'dashboard', bn: '🏠 হোম', en: 'Home' },
                { id: 'memos', bn: '🧾 মেমো', en: 'Memos' },
                { id: 'mill_hisab', bn: '🧱 মিল', en: 'Mills' },
                { id: 'van_hisab', bn: '🚜 ভ্যান', en: 'Van' },
                { id: 'unload_hisab', bn: '📦 আনলোড', en: 'Unload' },
                { id: 'delivery_hisab', bn: '🚚 ডেলিভারি', en: 'Delivery' },
                { id: 'jalani_hisab', bn: '🪵 জ্বালানি', en: 'Fuel' },
                { id: 'cashbook', bn: '💰 ক্যাশবই', en: 'Cash' },
                { id: 'labour', bn: '👷 লেবার', en: 'Labor' },
                { id: 'chulli_chamber', bn: '🧊 ৩ডি ম্যাপ', en: '3D Map' },
              ] as const
            ).map((pill) => {
              const isAct = activeTab === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    if (pill.id === 'delivery_hisab') {
                      setDeliveryTargetMemoNo('');
                    }
                    setActiveTab(pill.id);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                    isAct
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 shadow-2xs'
                      : 'bg-white hover:bg-orange-50 text-slate-800 border-slate-200/90'
                  }`}
                >
                  {isEn ? pill.en : pill.bn}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsFridayHatbarSheetOpen(true)}
              className="px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap shrink-0 bg-amber-100 text-amber-950 border border-amber-300 cursor-pointer"
            >
              {isEn ? '🖨️ Hatbar' : '🖨️ হাটবার'}
            </button>

            <button
              type="button"
              data-testid="phone-active-bar-install-guide-btn"
              onClick={async () => {
                if (isPWAInstallable) {
                  const accepted = await triggerPWAInstall();
                  if (accepted) {
                    showToast('SBL Bricks অ্যাপ সফলভাবে ফোনে ইনস্টল হয়েছে!');
                    return;
                  }
                }
                setIsPhoneInstallGuideOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span>{isEn ? 'App' : '📱 অ্যাপ ও সেভ'}</span>
            </button>
          </div>

          {/* Thumb Tier 2: Primary 5-Button Ergonomic Action Bar */}
          <div className="px-1.5 py-0.5 grid grid-cols-5 items-center">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`min-h-[42px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-orange-600 font-black bg-orange-50/90'
                  : 'text-slate-600 hover:text-slate-950 font-bold'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 leading-tight">
                {isEn ? 'Home' : 'হোম'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('memos')}
              className={`min-h-[42px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'memos'
                  ? 'text-orange-600 font-black bg-orange-50/90'
                  : 'text-slate-600 hover:text-slate-950 font-bold'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 leading-tight">
                {isEn ? 'Memos' : 'মেমো'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsNewMemoModalOpen(true);
                setTimeout(() => {
                  document.getElementById('memo-customer-input')?.focus();
                }, 80);
              }}
              className="btn-tactile -mt-2.5 min-h-[44px] flex flex-col items-center justify-center py-1 mx-1 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 text-white font-extrabold ring-2 ring-white border border-amber-300/80 shadow-md transition-transform cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 leading-tight">
                {isEn ? '+ Memo' : '+ মেমো'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeliveryTargetMemoNo('');
                setActiveTab('delivery_hisab');
              }}
              className={`min-h-[42px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'delivery_hisab'
                  ? 'text-orange-600 font-black bg-orange-50/90'
                  : 'text-slate-600 hover:text-slate-950 font-bold'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 leading-tight">
                {isEn ? 'Delivery' : 'ডেলিভারি'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className={`min-h-[42px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-colors cursor-pointer ${
                isMobileDrawerOpen
                  ? 'text-orange-600 font-black bg-orange-50/90'
                  : 'text-slate-600 hover:text-slate-950 font-bold'
              }`}
            >
              <Menu className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 leading-tight">
                {isEn ? 'Menu' : 'সব মেনু'}
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* Phone Chrome 3-Dot Install App & Permanent Storage Protection Guide Modal */}
      {isPhoneInstallGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="phone-install-storage-guide-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs"
        >
          <div className="bg-white border-2 border-orange-300 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    স্থায়ী স্টোরেজ ও PWA অ্যাপ সক্রিয়
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-950 mt-0.5">
                    ফোনে Chrome থ্রি-ডট (⋮) থেকে অ্যাপ ইনস্টল ও আজীবন ডাটা সুরক্ষা
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhoneInstallGuideOpen(false)}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="font-black text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>১. Chrome-এর থ্রি-ডট (⋮) থেকে "Install App" করলে কী হবে?</span>
                </div>
                <p className="text-emerald-900">
                  হ্যাঁ! আপনি ফোনের Chrome ব্রাউজারের উপরে ডানপাশের <strong>থ্রি-ডট (⋮)</strong> মেনুতে ট্যাপ করে{' '}
                  <strong>"Install app" (অ্যাপ ইনস্টল করুন)</strong> বা <strong>"Add to Home screen"</strong> দিলে এটি আপনার ফোনে একটি আসল অ্যাপ (PWA) হিসেবে ইনস্টল হয়ে যাবে এবং সারাজীবন অ্যাপ হিসেবেই ব্যবহার করতে পারবেন।
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="font-black text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>২. ডাটা কোথায় সেভ থাকে? ফোনের মেমোরিতে নাকি সার্ভারে?</span>
                </div>
                <p className="text-amber-950">
                  আপনার প্রতিটি হিসাব <strong>একসাথে ৩ জায়গায় অটোমেটিক সেভ</strong> হয়:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-amber-900 font-semibold">
                  <li>
                    <strong>সার্ভার ডাটাবেস:</strong> প্রতিবার সেভ করার সাথে সাথে সার্ভারে জমা হয়।
                  </li>
                  <li>
                    <strong>ফোনের স্থায়ী মেমোরি (IndexedDB Vault):</strong> আপনার ফোনের ভেতরেই স্বয়ংক্রিয়ভাবে ৩০টি পর্যন্ত পূর্ণাঙ্গ ব্যাকআপ স্ন্যাপশট জমা থাকে। সার্ভার কখনো রিস্টার্ট বা রিফ্রেশ হলেও অ্যাপটি আপনার ফোনের মেমোরি থেকে <strong>অটোমেটিক ডাটা রিকভার</strong> করে নেয়!
                  </li>
                  <li>
                    <strong>Persistent Storage Lock:</strong> ফোনের ব্রাউজার যেন নিজে থেকে কখনো স্টোরেজ মুছে না ফেলে সেজন্য স্টোরেজ লক সক্রিয় করা হয়েছে।
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 space-y-1.5">
                <div className="font-black text-slate-900">
                  ⚠️ ডাটা কি কখনো মুছে যাওয়ার কোনো ঝুঁকি আছে? (১০০% নিরাপদ থাকার উপায়)
                </div>
                <p className="text-slate-700">
                  স্বাভাবিক ব্যবহারে বা পেজ রিফ্রেশে ডাটা কখনোই মুছবে না। তবে শুধুমাত্র যদি আপনার <strong>ফোনটি হারিয়ে যায়, নষ্ট হয়ে যায়, অথবা আপনি ফোনের Settings থেকে Chrome-এর "Clear All Site Data" ম্যানুয়ালি ডিলিট করেন</strong>—তখন ফোনের লোকাল স্টোরেজ মুছে যেতে পারে। তাই সপ্তাহে ১ দিন নিচের বাটনে ক্লিক করে <strong>JSON ব্যাকআপ ফাইলটি ফোনের ডাউনলোড ফোল্ডার বা Google Drive/WhatsApp-এ</strong> রেখে দিলে আপনার ডাটা আজীবন ১০০% অমর থাকবে!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                {isPWAInstallable && !isPWAInstalled && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await triggerPWAInstall();
                      if (ok) {
                        setIsPhoneInstallGuideOpen(false);
                        showToast('SBL Bricks অ্যাপ সফলভাবে ফোনে ইনস্টল হয়েছে!');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-black shadow-md cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>এখনই ১-ক্লিকে অ্যাপ ইনস্টল করুন</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsPhoneInstallGuideOpen(false);
                    handleExportDatabase();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ফোনে ব্যাকআপ ফাইল ডাউনলোড করুন</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPhoneInstallGuideOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
              >
                বুঝেছি, বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global New Memo Studio Popup across all tabs */}
      {isNewMemoModalOpen && (
        <NewMemoStudio
          lang={lang}
          isOpen={isNewMemoModalOpen}
          onOpen={() => setIsNewMemoModalOpen(true)}
          onClose={() => setIsNewMemoModalOpen(false)}
          brickGrades={dbState.brickGrades}
          existingMemos={dbState.salesMemos}
          nextAutoMemoNo={nextAutoMemoNo}
          memoNo={memoNo}
          onChangeMemoNo={setMemoNo}
          memoDate={memoDate}
          onChangeMemoDate={setMemoDate}
          memoCustomer={memoCustomer}
          onChangeMemoCustomer={setMemoCustomer}
          memoPhone={memoPhone}
          onChangeMemoPhone={setMemoPhone}
          memoAddress={memoAddress}
          onChangeMemoAddress={setMemoAddress}
          memoVehicleType={memoVehicleType}
          onChangeMemoVehicleType={setMemoVehicleType}
          memoTruck={memoTruck}
          onChangeMemoTruck={setMemoTruck}
          memoDriver={memoDriver}
          onChangeMemoDriver={setMemoDriver}
          memoDriverPhone={memoDriverPhone}
          onChangeMemoDriverPhone={setMemoDriverPhone}
          memoDeliveryStatus={memoDeliveryStatus}
          onChangeMemoDeliveryStatus={setMemoDeliveryStatus}
          memoDuePromiseDate={memoDuePromiseDate}
          onChangeMemoDuePromiseDate={setMemoDuePromiseDate}
          memoNote={memoNote}
          onChangeMemoNote={setMemoNote}
          memoItems={memoItems}
          computedItems={computedItems}
          memoDiscount={memoDiscount}
          onChangeMemoDiscount={(val) => {
            setMemoDiscount(val);
            const disc = Math.max(0, Number(val) || 0);
            setMemoPaid(String(Math.max(0, liveMemoCalc.subTotal - disc)));
          }}
          memoPaid={memoPaid}
          onChangeMemoPaid={setMemoPaid}
          memoMethod={memoMethod}
          onChangeMemoMethod={setMemoMethod}
          liveMemoCalc={liveMemoCalc}
          creatingMemo={creatingMemo}
          onUpdateMemoItem={handleUpdateMemoItem}
          onAddMemoRow={handleAddMemoRow}
          onRemoveMemoRow={handleRemoveMemoRow}
          onSubmitMemo={handleCreateMemoSubmit}
          onResetForm={handleResetMemoForm}
        />
      )}

      {/* Unified Animated Popup Modals for All Memo Options (View, Collect Due, Edit, Delete) */}
      <MemoActionModals
        lang={lang}
        brickGrades={dbState.brickGrades}
        cashTransactions={dbState.cashTransactions}
        viewMemo={viewMemoTarget}
        onCloseViewMemo={() => setViewMemoTarget(null)}
        dueModalMemo={dueModalMemoTarget}
        onCloseDueModal={() => setDueModalMemoTarget(null)}
        editModalMemo={editModalMemoTarget}
        onCloseEditModal={() => setEditModalMemoTarget(null)}
        deleteTargetMemo={deleteMemoTarget}
        onCloseDeleteModal={() => setDeleteMemoTarget(null)}
        onOpenDueFromView={(memo) => setDueModalMemoTarget(memo)}
        onOpenEditFromView={(memo) => setEditModalMemoTarget(memo)}
        onOpenDeleteFromView={(memo) => setDeleteMemoTarget(memo)}
        onOpenDeliveryFromView={(memo) => {
          setDeliveryTargetMemoNo(memo.memoNo);
          setActiveTab('delivery_hisab');
        }}
        onPrintMemo={(memo) => setPrintMemoTarget(memo)}
        onCollectDue={handleCollectDue}
        onUpdateMemo={handleUpdateMemo}
        onDeleteMemo={handleDeleteMemo}
      />

      {/* Detailed Printable KPI Report Modal */}
      <KpiReportModal
        kpiId={activeKpiModal}
        onClose={() => setActiveKpiModal(null)}
        metrics={metrics}
        salesMemos={dbState.salesMemos}
        cashTransactions={dbState.cashTransactions}
      />

      {/* Official SBL Cash Memo & Gate Pass Print Modal */}
      <MemoPrintModal
        memo={printMemoTarget}
        onClose={() => setPrintMemoTarget(null)}
      />

      {/* Scheduled Daily Backup & Browser IndexedDB Vault Modal */}
      <ScheduledBackupModal
        isOpen={isBackupVaultOpen}
        onClose={() => setIsBackupVaultOpen(false)}
        snapshots={savedSnapshots}
        autoDailyEnabled={autoDailyBackupEnabled}
        onToggleAutoDaily={handleToggleAutoDailyBackup}
        onTriggerManualSnapshot={handleTriggerManualSnapshot}
        onDownloadSnapshot={downloadSnapshotAsJsonArchive}
        onRestoreFromSnapshot={handleRestoreFromIndexedDbSnapshot}
        onDeleteSnapshot={handleDeleteIndexedDbSnapshot}
        todayDate={metrics.todayDate}
        lastBackupStatusBn={lastBackupStatusBn}
        isSavingSnapshot={isSavingSnapshot}
        recoverableSnapshot={recoverableSnapshot}
        cloudStatus={cloudSyncStatus}
        onSyncToCloud={handleSyncToCloud}
        onRestoreFromCloud={handleRestoreFromCloud}
        onRestoreFromFile={handleRestoreDatabase}
      />

      {/* Kiln GPS & Live Google Maps Location Modal */}
      <KilnMapLocationModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        isEn={isEn}
      />

      {/* Smart Brick & Construction Quotation Estimator Modal */}
      <SmartBrickEstimatorModal
        isOpen={isEstimatorModalOpen}
        onClose={() => setIsEstimatorModalOpen(false)}
        lang={lang}
        brickGrades={dbState.brickGrades}
        onConvertToMemo={({
          customerName,
          gradeId,
          quantity,
          ratePerThousand,
          note,
        }) => {
          setIsEstimatorModalOpen(false);
          if (customerName) setMemoCustomer(customerName);
          setMemoItems([
            {
              gradeId,
              quantity: String(quantity),
              ratePerThousand: String(ratePerThousand),
            },
          ]);
          const calcTotal = Math.round((quantity / 1000) * ratePerThousand);
          setMemoDiscount('0');
          setMemoPaid(String(calcTotal));
          setMemoNote(note);
          setIsNewMemoModalOpen(true);
          showToast(
            isEn
              ? 'Quotation loaded into New Cash Memo!'
              : 'কোটেশনের হিসাব নতুন ক্যাশ মেমোতে যুক্ত হয়েছে!'
          );
        }}
      />

      {/* Global Quick Workspace Search Modal */}
      <QuickWorkspaceSearchModal
        isOpen={isQuickSearchModalOpen}
        onClose={() => setIsQuickSearchModalOpen(false)}
        lang={lang}
        dbState={dbState}
        navItems={navItems}
        onSelectTab={(tab) => setActiveTab(tab)}
        onSelectMemo={(memo) => setViewMemoTarget(memo)}
      />

      {/* #6: Smart Kiln Alert Bell & Auto-Reminder Center Modal */}
      <SmartKilnAlertCenterModal
        isOpen={isAlertCenterModalOpen}
        onClose={() => setIsAlertCenterModalOpen(false)}
        isEn={isEn}
        todayDate={metrics.todayDate}
        alertReport={smartAlertReport}
        salesMemos={dbState.salesMemos}
        dismissedCount={dismissedAlertIds.length}
        initialExpandedAlertId={alertCenterFocusId}
        onDismissAlert={(alertId) => {
          handleDismissSmartAlert(alertId);
          showToast(
            isEn
              ? 'Alert marked as resolved!'
              : 'সতর্কতাটি সমাধান হিসেবে চিহ্নিত হয়েছে!'
          );
        }}
        onResetDismissedAlerts={() => {
          handleResetDismissedSmartAlerts();
          showToast(
            isEn
              ? 'All dismissed alerts restored!'
              : 'সকল মিউট করা সতর্কতা পুনরায় সক্রিয় হয়েছে!'
          );
        }}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenDueCollectionForMemo={(memo) => setDueModalMemoTarget(memo)}
        onAddCustomUrgentReminder={handleAddCustomUrgentReminder}
      />

      {/* Friday Hatbar All-Sardar Summary & A4 Print Sheet Modal */}
      <FridayHatbarSardarPrintSheetModal
        isOpen={isFridayHatbarSheetOpen}
        onClose={() => setIsFridayHatbarSheetOpen(false)}
        todayDate={metrics.todayDate}
        activeRoundNo={enterpriseState.activeRoundNo || 1}
        millPots={dbState.millPots || []}
        chulliLoads={dbState.chulliLoads || []}
        poraiMistriRecords={dbState.poraiMistriRecords || []}
        chulliUnloads={dbState.chulliUnloads || []}
        rubbishRecords={dbState.rubbishRecords || []}
        onSaveMillPot={handleSaveMillPot}
        onSaveChulliLoad={handleSaveChulliLoad}
        onSavePoraiMistri={handleSavePoraiMistri}
        onSaveChulliUnload={handleSaveChulliUnload}
        onSaveRubbish={handleSaveRubbish}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Full Data Reset Confirmation Modal */}
      {isDataResetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="data-reset-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
        >
          <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isEn ? 'Reset All Kiln Data?' : 'সম্পূর্ণ ডাটা রিসেট করবেন?'}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {isEn
                      ? 'All memos, cash book, stock, production & alerts will be reset to 0.'
                      : 'সকল মেমো, ক্যাশ বুক, ইট স্টক, মিল-চুল্লি ও অ্যালার্ট 0 (শূন্য) হয়ে যাবে।'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDataResetModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDataResetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Cancel' : 'বাতিল করুন'}
              </button>
              <button
                type="button"
                data-testid="confirm-data-reset-btn"
                onClick={() => {
                  void handleResetAllData();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isEn ? 'Yes, Reset Everything to 0' : 'হ্যাঁ, সব ডাটা 0 (রিসেট) করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrickFlowApp />
    </AppErrorBoundary>
  );
}
