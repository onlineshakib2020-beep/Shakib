import React, { useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Flame,
  Landmark,
  Layers,
  Plus,
  Trash2,
  Truck,
  Users,
  Receipt,
  X,
} from 'lucide-react';
import type {
  CashTxType,
  ChulliLoadRecord,
  ChulliUnloadRecord,
  LanguageMode,
  PaymentMethod,
} from '../types/kiln';
import { formatBn, formatCurrencyBn } from '../utils/kilnLogic';
import {
  buildAutoUnloadConfirmation,
  calculateStaffSalaryPayable,
  computeBrickWastageSummary,
  computeDamperMaintenanceAlerts,
  computeFeedKilnLineSystemStatus,
  computeLandLeaseSummary,
  computeSeasonWastageReconciliation,
  createDefaultSeasonWastageConfig,
  getFeedKilnLineZoneState,
  getKilnRoundLabelBn,
  getLineOffsetFromStart,
  normalizeFeedKilnLineSystem,
  wrapKilnLineNo,
  type BrickWastageRecord,
  type EnterpriseOperationsState,
  type FeedKilnLineSystemState,
  type KilnDamperRecord,
  type KilnLineZoneState,
  type LandLeaseContractRecord,
  type MonthlyStaffSalaryRecord,
  type SeasonWastageReconciliationConfig,
  type StaffSalaryPaymentInstallment,
} from '../utils/enterpriseOperationsLogic';
import { Card } from './Card';
import { calculateFiringEfficiency } from '../utils/aiCommandAndEfficiencyLogic';

export type EnterpriseSectionId =
  | 'chulli_chamber'
  | 'wastage_register'
  | 'staff_salary'
  | 'land_lease';

interface KilnEnterpriseOperationsTabProps {
  activeSection: EnterpriseSectionId;
  lang: LanguageMode;
  todayDate: string;
  totalRawBricksCut: number;
  totalBricksFiredInChulli?: number;
  totalBricksSoldAllGrades?: number;
  totalVanLoadedBricks?: number;
  totalUnloadedLines?: number;
  totalUnloadedBricks?: number;
  totalBrickStockPieces?: number;
  millBreakdown?: Array<{ millNameBn: string; rawBricksCut: number }>;
  enterpriseState: EnterpriseOperationsState;
  roleMode: 'OWNER' | 'MUNSHI';
  onUpdateEnterpriseState: (next: EnterpriseOperationsState) => void;
  onAddCashTx: (payload: {
    type: CashTxType;
    category: string;
    amount: number;
    description: string;
    paymentMethod: PaymentMethod;
  }) => Promise<void>;
  onSaveChulliLoad?: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    rawBricksLoaded: number;
    ratePerVan: number;
    paidAmount: number;
    note: string;
  }) => Promise<unknown>;
  onSaveChulliUnload?: (payload: {
    id?: string;
    date: string;
    sardarName: string;
    chamberOrRound: string;
    linesUnloaded?: number;
    bricksPerLine?: number;
    ratePerLine?: number;
    ratePerThousand: number;
    paidAmount: number;
    note: string;
  }) => Promise<unknown>;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const KilnEnterpriseOperationsTab: React.FC<KilnEnterpriseOperationsTabProps> = ({
  activeSection,
  lang,
  todayDate,
  totalRawBricksCut,
  totalBricksFiredInChulli = 0,
  totalBricksSoldAllGrades = 0,
  totalVanLoadedBricks = 0,
  totalUnloadedLines = 0,
  totalUnloadedBricks = 0,
  totalBrickStockPieces = 0,
  millBreakdown = [],
  enterpriseState,
  roleMode,
  onUpdateEnterpriseState,
  onAddCashTx,
  onSaveChulliLoad,
  onSaveChulliUnload,
  onShowToast,
}) => {
  const isEn = lang === 'en';

  // 1. 208-Line & Damper Fixed Chimney System state (Fire starts at Line 1 by default)
  const currentLineSystem: FeedKilnLineSystemState = normalizeFeedKilnLineSystem(
    enterpriseState.lineSystem
  );
  const [selectedLineNo, setSelectedLineNo] = useState<number>(
    currentLineSystem.fireStartLineNo || 1
  );
  const [isLinePopupOpen, setIsLinePopupOpen] = useState<boolean>(true);
  const [formFireStartLine, setFormFireStartLine] = useState<string>(
    String(currentLineSystem.fireStartLineNo || 1)
  );
  const [formFiredLines, setFormFiredLines] = useState<string>(
    String(currentLineSystem.firedLinesCompleted)
  );
  const [formUnloadedLines, setFormUnloadedLines] = useState<string>(
    String(currentLineSystem.unloadedLinesBehind)
  );
  const [formActiveFiringLines, setFormActiveFiringLines] = useState<string>(
    String(currentLineSystem.activeFiringLinesCount)
  );
  const [formRawLoadedAheadLines, setFormRawLoadedAheadLines] = useState<string>(
    String(currentLineSystem.rawLinesLoadedAhead)
  );
  const [formCoalTons, setFormCoalTons] = useState<string>(
    String(currentLineSystem.coalUsedTons)
  );
  const [formWoodMaunds, setFormWoodMaunds] = useState<string>(
    String(currentLineSystem.woodUsedMaunds)
  );
  const [formFiringDays, setFormFiringDays] = useState<string>(
    String(currentLineSystem.firingDaysElapsed)
  );
  const [formExpectedLinesPerDay, setFormExpectedLinesPerDay] = useState<string>(
    String(currentLineSystem.expectedLinesPerDay)
  );
  const [damperAfterLineInput, setDamperAfterLineInput] = useState<string>('176');
  const [damperBlockLinesInput, setDamperBlockLinesInput] = useState<string>('5');
  const [damperHasGapInput, setDamperHasGapInput] = useState<boolean>(true);
  const [damperNoteInput, setDamperNoteInput] = useState<string>('');
  const [activeSectorFilter, setActiveSectorFilter] = useState<
    'ALL_ACTIVE' | 'EAST' | 'SOUTH' | 'WEST' | 'NORTH'
  >('ALL_ACTIVE');
  const [mapOverlayMode, setMapOverlayMode] = useState<'PRODUCTION_STATUS' | 'DAMPER_ALERTS'>(
    'PRODUCTION_STATUS'
  );
  const kilnMapViewDimension = '3D' as const;
  const [quickVanBricksInput, setQuickVanBricksInput] = useState<string>('');
  const [quickUnloadLinesInput, setQuickUnloadLinesInput] = useState<string>('');

  // 2. Wastage form state
  const [wStage, setWStage] = useState<BrickWastageRecord['stage']>('RAW_RAIN_DAMAGE');
  const [wLocation, setWLocation] = useState('১ নং ওহাব মিল মাঠ');
  const [wBricks, setWBricks] = useState('');
  const [wLossTk, setWLossTk] = useState('');
  const [wReason, setWReason] = useState('');

  // 3. Staff Salary form state
  const [sName, setSName] = useState('');
  const [sDesignation, setSDesignation] =
    useState<MonthlyStaffSalaryRecord['designation']>('ম্যানেজার');
  const [sPhone, setSPhone] = useState('');
  const [sSalary, setSSalary] = useState('');
  const [sAdvance, setSAdvance] = useState('');
  const [sPaid, setSPaid] = useState('');
  const [sNote, setSNote] = useState('');
  const [partialPayTarget, setPartialPayTarget] = useState<MonthlyStaffSalaryRecord | null>(null);
  const [partialPayAmount, setPartialPayAmount] = useState<string>('');
  const [partialPayDate, setPartialPayDate] = useState<string>(todayDate);
  const [partialPayNote, setPartialPayNote] = useState<string>('');

  // 4. Land Lease form state
  const [lOwner, setLOwner] = useState('');
  const [lPhone, setLPhone] = useState('');
  const [lMouza, setLMouza] = useState('');
  const [lBigha, setLBigha] = useState('');
  const [lTrucks, setLTrucks] = useState('');
  const [lDeliveredTrucks, setLDeliveredTrucks] = useState('');
  const [lTotalAmt, setLTotalAmt] = useState('');
  const [lPaidAmt, setLPaidAmt] = useState('');

  // 5. Coal & Firing Efficiency Round Tracker state
  const [effRoundNo, setEffRoundNo] = useState<string>(
    String(enterpriseState.activeRoundNo || 2)
  );
  const [effBricksFired, setEffBricksFired] = useState<string>('');
  const [effCoalTons, setEffCoalTons] = useState<string>('');
  const [effCoalRate, setEffCoalRate] = useState<string>('');
  const [effWoodMaunds, setEffWoodMaunds] = useState<string>('');
  const [effWoodRate, setEffWoodRate] = useState<string>('');
  const [savedRoundEfficiencyList, setSavedRoundEfficiencyList] = useState<
    Array<{
      id: string;
      roundNo: number;
      bricksFired: number;
      coalTons: number;
      woodMaunds: number;
      coalTonsPerLakh: number;
      woodMaundsPerLakh: number;
      fuelCostPerThousand: number;
      totalFuelCost: number;
      ratingLabelBn: string;
      rating: 'OPTIMAL' | 'NORMAL' | 'EXCESSIVE';
    }>
  >([
    {
      id: 'rnd-eff-1',
      roundNo: 1,
      bricksFired: 400000,
      coalTons: 64,
      woodMaunds: 400,
      coalTonsPerLakh: 16.0,
      woodMaundsPerLakh: 100.0,
      fuelCostPerThousand: 3140,
      totalFuelCost: 1256000,
      ratingLabelBn: 'উত্তম সাশ্রয়ী ফায়ারিং (Optimal Efficiency)',
      rating: 'OPTIMAL',
    },
    {
      id: 'rnd-eff-2',
      roundNo: 2,
      bricksFired: 380000,
      coalTons: 62,
      woodMaunds: 420,
      coalTonsPerLakh: 16.32,
      woodMaundsPerLakh: 110.5,
      fuelCostPerThousand: 3217,
      totalFuelCost: 1222600,
      ratingLabelBn: 'উত্তম সাশ্রয়ী ফায়ারিং (Optimal Efficiency)',
      rating: 'OPTIMAL',
    },
  ]);

  const syncLineFormWithState = (nextSys: FeedKilnLineSystemState) => {
    setFormFireStartLine(String(nextSys.fireStartLineNo || 134));
    setFormFiredLines(String(nextSys.firedLinesCompleted));
    setFormUnloadedLines(String(nextSys.unloadedLinesBehind));
    setFormActiveFiringLines(String(nextSys.activeFiringLinesCount));
    setFormRawLoadedAheadLines(String(nextSys.rawLinesLoadedAhead));
    setFormCoalTons(String(nextSys.coalUsedTons));
    setFormWoodMaunds(String(nextSys.woodUsedMaunds));
    setFormFiringDays(String(nextSys.firingDaysElapsed));
    setFormExpectedLinesPerDay(String(nextSys.expectedLinesPerDay));
  };

  const handleUpdateLineSystem = (patch: Partial<FeedKilnLineSystemState>, toastMsgBn?: string) => {
    const nextSys: FeedKilnLineSystemState = {
      ...currentLineSystem,
      ...patch,
    };
    syncLineFormWithState(nextSys);
    onUpdateEnterpriseState({
      ...enterpriseState,
      lineSystem: nextSys,
    });
    if (toastMsgBn) {
      onShowToast(toastMsgBn);
    }
  };

  const handleSaveLineSystemForm = (e: React.FormEvent) => {
    e.preventDefault();
    const startLine = wrapKilnLineNo(Number(formFireStartLine) || 134, 208);
    const fired = Math.min(208, Math.max(0, Math.round(Number(formFiredLines) || 0)));
    const unloaded = Math.min(fired, Math.max(0, Math.round(Number(formUnloadedLines) || 0)));
    const activeFire = Math.min(
      208 - fired,
      Math.max(0, Math.round(Number(formActiveFiringLines) || 0))
    );
    const loadedAhead = Math.min(
      208 - fired - activeFire,
      Math.max(0, Math.round(Number(formRawLoadedAheadLines) || 0))
    );
    handleUpdateLineSystem(
      {
        fireStartLineNo: startLine,
        startDirectionBn: `লাইন #${formatBn(startLine)} থেকে আগুন ও পোড়ানো শুরু`,
        firedLinesCompleted: fired,
        unloadedLinesBehind: unloaded,
        activeFiringLinesCount: activeFire,
        rawLinesLoadedAhead: loadedAhead,
        coalUsedTons: Math.max(0, Number(formCoalTons) || 0),
        woodUsedMaunds: Math.max(0, Number(formWoodMaunds) || 0),
        firingDaysElapsed: Math.max(0, Number(formFiringDays) || 0),
        expectedLinesPerDay: Math.max(0.5, Number(formExpectedLinesPerDay) || 3.5),
        lineOverrides: {},
      },
      `চুল্লির লাইন #${formatBn(startLine)} থেকে ফায়ারিং, ভ্যান লোড ও জ্বালানি তথ্য আপডেট হয়েছে!`
    );
  };

  const openLineActionPopup = (lineNo: number) => {
    setSelectedLineNo(lineNo);
    setDamperAfterLineInput(String(lineNo));
    setIsLinePopupOpen(true);
  };

  const handleSetSingleLineZoneFromPopup = (
    lineNo: number,
    targetZone: KilnLineZoneState,
    actionLabelBn: string
  ) => {
    const nextOverrides: Record<number, KilnLineZoneState> = {
      ...(currentLineSystem.lineOverrides || {}),
    };
    if (targetZone === 'EMPTY') {
      delete nextOverrides[lineNo];
    } else {
      nextOverrides[lineNo] = targetZone;
    }

    const recomputed = computeFeedKilnLineSystemStatus(
      {
        ...currentLineSystem,
        lineOverrides: nextOverrides,
      },
      {
        totalVanLoadedBricks,
        totalUnloadedLines,
      }
    );

    handleUpdateLineSystem(
      {
        lineOverrides: nextOverrides,
        firedLinesCompleted: recomputed.firedLinesCompleted,
        unloadedLinesBehind: recomputed.unloadedLinesBehind,
        activeFiringLinesCount: recomputed.activeFiringLinesCount,
        rawLinesLoadedAhead: recomputed.rawLinesLoadedAhead,
      },
      `লাইন #${formatBn(lineNo)} (৪,০০০ ইট): "${actionLabelBn}" হিসেবে নির্ধারণ করা হয়েছে!`
    );
  };

  const handleQuickAddVanLoadBricks = async (bricksToAdd: number) => {
    const validBricks = Math.max(500, Math.round(Number(bricksToAdd) || 4000));
    const linesAdded = Math.floor(validBricks / 4000);
    if (onSaveChulliLoad) {
      await onSaveChulliLoad({
        date: todayDate,
        sardarName: 'সেলিম সর্দার',
        rawBricksLoaded: validBricks,
        ratePerVan: 350,
        paidAmount: 0,
        note: `রিয়েল চুল্লি থেকে সরাসরি +${formatBn(validBricks)} কাঁচা ইট ভ্যান লোড এন্ট্রি (সেলিম সর্দার)`,
      });
      setQuickVanBricksInput('');
    } else {
      const nextRawAhead = Math.min(
        208,
        currentLineSystem.rawLinesLoadedAhead + Math.max(1, linesAdded)
      );
      handleUpdateLineSystem(
        {
          rawLinesLoadedAhead: nextRawAhead,
          lineOverrides: {},
        },
        `✅ লোড সাকসেসফুল (সেলিম সর্দার): +${formatBn(validBricks)} পিস কাঁচা ইট চুল্লির লাইনে যোগ হয়েছে!`
      );
      setQuickVanBricksInput('');
    }
  };

  const handleQuickAddUnloadLines = async (linesToAdd: number) => {
    const validLines = Math.max(1, Math.round(Number(linesToAdd) || 1));
    const bricksUnloaded = validLines * 4000;
    const prevUnloaded = currentLineSystem.unloadedLinesBehind || 0;
    const nextUnloaded = Math.min(208, prevUnloaded + validLines);
    const autoConfirmation = buildAutoUnloadConfirmation({
      sardarName: 'নজরুল সর্দার',
      chamberOrRound: `রাউন্ড-${formatBn(enterpriseState.activeRoundNo || 1)}`,
      fireStartLineNo: currentLineSystem.fireStartLineNo || 1,
      previousUnloadedLines: prevUnloaded,
      effectiveUnloadedLines: nextUnloaded,
      linesUnloadedInEntry: validLines,
      bricksPerLine: 4000,
      updatedStockPieces: totalBrickStockPieces + bricksUnloaded,
      totalLines: 208,
    });
    setSelectedLineNo(autoConfirmation.clearedEndLine);
    if (onSaveChulliUnload) {
      await onSaveChulliUnload({
        date: todayDate,
        sardarName: 'নজরুল সর্দার',
        chamberOrRound: `রাউন্ড-${formatBn(enterpriseState.activeRoundNo || 1)}`,
        linesUnloaded: validLines,
        bricksPerLine: 4000,
        ratePerLine: 750,
        ratePerThousand: 187.5,
        paidAmount: 0,
        note: `রিয়েল চুল্লি থেকে সরাসরি +${formatBn(validLines)} লাইন পাকা ইট আনলোড এন্ট্রি (নজরুল সর্দার)`,
      });
      setQuickUnloadLinesInput('');
    } else {
      const nextFired = Math.max(currentLineSystem.firedLinesCompleted, nextUnloaded);
      const nextRawAhead = Math.max(0, currentLineSystem.rawLinesLoadedAhead - validLines);
      handleUpdateLineSystem(
        {
          unloadedLinesBehind: nextUnloaded,
          firedLinesCompleted: nextFired,
          activeFiringLinesCount: 0,
          rawLinesLoadedAhead: nextRawAhead,
          recentlyClearedLines: autoConfirmation.clearedLineNumbers,
          lastAutoUnloadConfirmation: autoConfirmation,
          lineOverrides: {},
        },
        `✅ অটো কনফার্মেশন (নজরুল সর্দার): +${formatBn(validLines)} লাইন (${formatBn(bricksUnloaded)} পিস) ম্যাপে হাইলাইট ও Active Firing রিসেট হয়েছে!`
      );
      setQuickUnloadLinesInput('');
    }
  };

  const handleResetKilnFromZero = () => {
    const resetSys: FeedKilnLineSystemState = {
      ...currentLineSystem,
      fireStartLineNo: 1,
      startDirectionBn: 'লাইন #১ থেকে আগুন ও লোড শুরু',
      firedLinesCompleted: 0,
      unloadedLinesBehind: 0,
      activeFiringLinesCount: 0,
      rawLinesLoadedAhead: 0,
      coalUsedTons: 0,
      woodUsedMaunds: 0,
      firingDaysElapsed: 0,
      vanBricksBaselineOffset: totalVanLoadedBricks,
      unloadLinesBaselineOffset: totalUnloadedLines,
      recentlyClearedLines: [],
      lastAutoUnloadConfirmation: null,
      lineOverrides: {},
      dampers: [],
    };
    syncLineFormWithState(resetSys);
    setSelectedLineNo(1);
    onUpdateEnterpriseState({
      ...enterpriseState,
      activeRoundNo: 1,
      roundStartDate: todayDate,
      lineSystem: resetSys,
    });
    onShowToast(
      '🔄 চুল্লির সকল লাইন ০ (শূন্য) করে লাইন #১ থেকে নতুনভাবে শুরু করা হয়েছে! এখন নতুন ভ্যান লোড বা আনলোড দিলে ১ নং লাইন থেকে গণনা হবে।'
    );
  };

  const handleAdvanceFireRangeToLineFromPopup = (targetLineNo: number) => {
    const startLine = currentLineSystem.fireStartLineNo || 134;
    const offset = getLineOffsetFromStart(targetLineNo, startLine, 208);
    const nextFired = offset;
    const nextActiveFire = Math.max(1, currentLineSystem.activeFiringLinesCount || 5);
    const prevTotalLoaded = Math.max(
      nextFired + nextActiveFire + 5,
      currentLineSystem.firedLinesCompleted +
        currentLineSystem.activeFiringLinesCount +
        currentLineSystem.rawLinesLoadedAhead
    );
    const nextRawAhead = Math.min(
      208 - nextFired - nextActiveFire,
      Math.max(0, prevTotalLoaded - nextFired - nextActiveFire)
    );
    const nextUnloaded = Math.min(nextFired, currentLineSystem.unloadedLinesBehind);
    const updatedDampers = currentLineSystem.dampers.map((d) => {
      const posIdx = getLineOffsetFromStart(d.afterLineNo, startLine, 208) + 1;
      return posIdx <= nextFired
        ? { ...d, status: 'OPENED_PASSED' as const }
        : { ...d, status: 'ACTIVE_CLOSED' as const };
    });

    handleUpdateLineSystem(
      {
        firedLinesCompleted: nextFired,
        unloadedLinesBehind: nextUnloaded,
        activeFiringLinesCount: nextActiveFire,
        rawLinesLoadedAhead: nextRawAhead,
        dampers: updatedDampers,
        lineOverrides: {},
      },
      `🔥 লাইন #${formatBn(targetLineNo)} থেকে আগুন দেওয়া হয়েছে (আগের ${formatBn(
        nextFired
      )} লাইন আগুন শেষ)!`
    );
  };

  const handleCompleteFiredRangeThroughLineFromPopup = (targetLineNo: number) => {
    const startLine = currentLineSystem.fireStartLineNo || 134;
    const offset = getLineOffsetFromStart(targetLineNo, startLine, 208);
    const nextFired = Math.min(208, offset + 1);
    const nextActiveFire = Math.min(
      208 - nextFired,
      Math.max(1, currentLineSystem.activeFiringLinesCount || 5)
    );
    const prevTotalLoaded = Math.max(
      nextFired + nextActiveFire + 5,
      currentLineSystem.firedLinesCompleted +
        currentLineSystem.activeFiringLinesCount +
        currentLineSystem.rawLinesLoadedAhead
    );
    const nextRawAhead = Math.min(
      208 - nextFired - nextActiveFire,
      Math.max(0, prevTotalLoaded - nextFired - nextActiveFire)
    );
    const nextUnloaded = Math.min(nextFired, currentLineSystem.unloadedLinesBehind);
    const updatedDampers = currentLineSystem.dampers.map((d) => {
      const posIdx = getLineOffsetFromStart(d.afterLineNo, startLine, 208) + 1;
      return posIdx <= nextFired
        ? { ...d, status: 'OPENED_PASSED' as const }
        : { ...d, status: 'ACTIVE_CLOSED' as const };
    });

    handleUpdateLineSystem(
      {
        firedLinesCompleted: nextFired,
        unloadedLinesBehind: nextUnloaded,
        activeFiringLinesCount: nextActiveFire,
        rawLinesLoadedAhead: nextRawAhead,
        dampers: updatedDampers,
        lineOverrides: {},
      },
      `✅ লাইন #${formatBn(startLine)} থেকে লাইন #${formatBn(
        targetLineNo
      )} পর্যন্ত (${formatBn(nextFired)} লাইন) আগুন শেষ হিসেবে নির্ধারণ করা হয়েছে!`
    );
  };

  const handleQuickAdvanceFireOneLine = () => {
    const nextFired = currentLineSystem.firedLinesCompleted + 1;
    const nextLoadedAhead = Math.max(0, currentLineSystem.rawLinesLoadedAhead - 1);
    const startLine = currentLineSystem.fireStartLineNo || 1;
    const wrappedFired = nextFired > 208 ? ((nextFired - 1) % 208) + 1 : nextFired;
    const fireRound = Math.floor((nextFired - 1) / 208) + 1;
    // Mark any damper at or behind wrappedFired as OPENED_PASSED
    const updatedDampers = currentLineSystem.dampers.map((d) => {
      const posIndex = getLineOffsetFromStart(d.afterLineNo, startLine, 208) + 1;
      return posIndex <= wrappedFired ? { ...d, status: 'OPENED_PASSED' as const } : d;
    });
    if (fireRound > enterpriseState.activeRoundNo) {
      onUpdateEnterpriseState({
        ...enterpriseState,
        activeRoundNo: fireRound,
        lineSystem: {
          ...currentLineSystem,
          firedLinesCompleted: nextFired,
          rawLinesLoadedAhead: nextLoadedAhead,
          dampers: updatedDampers,
        },
      });
    } else {
      handleUpdateLineSystem(
        {
          firedLinesCompleted: nextFired,
          rawLinesLoadedAhead: nextLoadedAhead,
          dampers: updatedDampers,
        },
        `🔥 আরও +১ লাইন (৪,০০০ ইট) পোড়ানো সম্পন্ন! মোট পোড়ানো শেষ: ${formatBn(
          wrappedFired
        )} লাইন (রাউন্ড-${formatBn(fireRound)})`
      );
    }
  };

  const handleQuickAddVanLoadWithDamper = (linesToAdd: number, addDamperAfter: boolean) => {
    const startLine = currentLineSystem.fireStartLineNo || 1;
    const effectiveVanBricks = Math.max(
      0,
      totalVanLoadedBricks - (currentLineSystem.vanBricksBaselineOffset || 0)
    );
    const autoVanLinesNow = Math.floor(effectiveVanBricks / 4000) % 208;
    const baseRawLines = Math.max(currentLineSystem.rawLinesLoadedAhead, autoVanLinesNow);
    const nextLoadedAhead = Math.min(
      208 - currentLineSystem.firedLinesCompleted - currentLineSystem.activeFiringLinesCount,
      baseRawLines + linesToAdd
    );
    const totalLoadedNow =
      currentLineSystem.firedLinesCompleted +
      currentLineSystem.activeFiringLinesCount +
      nextLoadedAhead;
    const targetDamperLineNo = wrapKilnLineNo(startLine + totalLoadedNow - 1, 208);
    let updatedDampers = [...currentLineSystem.dampers];
    if (addDamperAfter && totalLoadedNow > 0) {
      const exists = updatedDampers.some((d) => d.afterLineNo === targetDamperLineNo);
      if (!exists) {
        updatedDampers.push({
          id: `dmp-${Date.now()}`,
          afterLineNo: targetDamperLineNo,
          linesInBlock: linesToAdd,
          hasProtectiveGap: true,
          status: 'ACTIVE_CLOSED',
          sardarName: 'সেলিম সর্দার',
          note: `${formatBn(linesToAdd)} লাইন পর ডাম্পার ও গ্যাপ (পানি/বাতাস রোধী)`,
        });
      }
    }
    handleUpdateLineSystem(
      {
        rawLinesLoadedAhead: nextLoadedAhead,
        dampers: updatedDampers,
      },
      addDamperAfter
        ? `🚜 সামনে +${formatBn(linesToAdd)} লাইন (${formatBn(
            linesToAdd * 4000
          )} ইট) ভ্যান লোড এবং লাইন #${formatBn(targetDamperLineNo)}-এর পর নতুন ডাম্পার ও গ্যাপ বসানো হয়েছে!`
        : `🚜 সামনে +${formatBn(linesToAdd)} লাইন (${formatBn(
            linesToAdd * 4000
          )} ইট) ভ্যান লোড যোগ হয়েছে!`
    );
  };

  const handleAddCustomDamper = (e: React.FormEvent) => {
    e.preventDefault();
    const startLine = currentLineSystem.fireStartLineNo || 134;
    const lineNo = wrapKilnLineNo(Number(damperAfterLineInput) || 134, 208);
    const blockLines = Math.max(1, Math.round(Number(damperBlockLinesInput) || 5));
    const filtered = currentLineSystem.dampers.filter((d) => d.afterLineNo !== lineNo);
    const posIndex = getLineOffsetFromStart(lineNo, startLine, 208) + 1;
    const newDamper: KilnDamperRecord = {
      id: `dmp-${Date.now()}`,
      afterLineNo: lineNo,
      linesInBlock: blockLines,
      hasProtectiveGap: damperHasGapInput,
      status:
        posIndex <= currentLineSystem.firedLinesCompleted
          ? 'OPENED_PASSED'
          : 'ACTIVE_CLOSED',
      sardarName: currentLineSystem.loadSardarName || 'সেলিম সর্দার',
      note:
        damperNoteInput.trim() ||
        `${formatBn(blockLines)} লাইনের উপরে ডাম্পার${
          damperHasGapInput ? ' (পানি/বাতাস রোধে গ্যাপসহ)' : ''
        }`,
    };
    const nextDampers = [...filtered, newDamper];
    handleUpdateLineSystem(
      { dampers: nextDampers },
      `🚧 লাইন #${formatBn(lineNo)}-এর পর (${formatBn(blockLines)} লাইন ব্লক) ডাম্পার যুক্ত হয়েছে!`
    );
    setDamperNoteInput('');
    setDamperAfterLineInput(String(wrapKilnLineNo(lineNo + blockLines, 208)));
  };

  const handleToggleDamperStatus = (damperId: string) => {
    const nextDampers = currentLineSystem.dampers.map((d) =>
      d.id === damperId
        ? {
            ...d,
            status:
              d.status === 'ACTIVE_CLOSED'
                ? ('OPENED_PASSED' as const)
                : ('ACTIVE_CLOSED' as const),
          }
        : d
    );
    handleUpdateLineSystem({ dampers: nextDampers }, 'ডাম্পার স্ট্যাটাস আপডেট হয়েছে!');
  };

  const handleDeleteDamper = (damperId: string) => {
    const nextDampers = currentLineSystem.dampers.filter((d) => d.id !== damperId);
    handleUpdateLineSystem({ dampers: nextDampers }, 'ডাম্পার মুছে ফেলা হয়েছে।');
  };

  const handleAdvanceFiringRound = () => {
    const nextRound = enterpriseState.activeRoundNo + 1;
    onUpdateEnterpriseState({
      ...enterpriseState,
      activeRoundNo: nextRound,
      roundStartDate: todayDate,
    });
    onShowToast(
      isEn
        ? `Kiln Firing Round #${nextRound} started!`
        : `চুল্লি ফায়ারিং রাউন্ড-${formatBn(nextRound)} শুরু হয়েছে!`
    );
  };

  const handleAddWastageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(0, Number(wBricks) || 0);
    if (qty <= 0) {
      onShowToast(
        isEn ? 'Enter damaged brick quantity.' : 'ক্ষতিগ্রস্ত ইটের সঠিক সংখ্যা লিখুন।',
        'error'
      );
      return;
    }
    const loss = Math.max(0, Number(wLossTk) || Math.round(qty * 3.5));
    const newRec: BrickWastageRecord = {
      id: `wastage-${Date.now()}`,
      date: todayDate,
      stage: wStage,
      millOrChamber: wLocation.trim() || 'ভাটা মাঠ',
      bricksLost: qty,
      estimatedLossAmount: loss,
      reason: wReason.trim() || 'বৃষ্টি বা পোড়াই অপচয়',
    };
    onUpdateEnterpriseState({
      ...enterpriseState,
      wastageRecords: [newRec, ...enterpriseState.wastageRecords],
    });
    setWBricks('');
    setWLossTk('');
    setWReason('');
    onShowToast(
      isEn
        ? `${qty} damaged bricks recorded in wastage register.`
        : `${formatBn(qty)} পিস ইটের ক্ষতি ও অপচয় খাতায় সংরক্ষিত হয়েছে।`
    );
  };

  const handleDeleteWastage = (id: string) => {
    if (roleMode === 'MUNSHI') {
      onShowToast(
        isEn
          ? 'Deleting records requires Owner PIN mode.'
          : 'মুন্সি মোডে রেকর্ড ডিলিট করা লক করা আছে। বাম পাশ থেকে মালিক পিন দিয়ে আনলক করুন।',
        'error'
      );
      return;
    }
    onUpdateEnterpriseState({
      ...enterpriseState,
      wastageRecords: enterpriseState.wastageRecords.filter((r) => r.id !== id),
    });
    onShowToast(isEn ? 'Wastage record deleted.' : 'অপচয় রেকর্ড মুছে ফেলা হয়েছে।');
  };

  const handleAddStaffSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim()) {
      onShowToast(isEn ? 'Enter staff name.' : 'স্টাফ বা কর্মচারীর নাম লিখুন।', 'error');
      return;
    }
    const sal = Math.max(0, Number(sSalary) || 0);
    const adv = Math.max(0, Number(sAdvance) || 0);
    const paid = Math.max(0, Number(sPaid) || 0);
    const calc = calculateStaffSalaryPayable(sal, adv, paid);

    const newRec: MonthlyStaffSalaryRecord = {
      id: `staff-${Date.now()}`,
      staffName: sName.trim(),
      designation: sDesignation,
      phone: sPhone.trim() || '—',
      monthLabel: todayDate.slice(0, 7),
      monthlySalary: calc.monthlySalary,
      advanceDeducted: calc.advanceDeducted,
      paidAmount: calc.paidAmount,
      paymentDate: todayDate,
      status: calc.status,
      note: sNote.trim() || 'মাসিক বেতন এন্ট্রি',
    };

    onUpdateEnterpriseState({
      ...enterpriseState,
      staffSalaries: [newRec, ...enterpriseState.staffSalaries],
    });

    if (calc.paidAmount > 0) {
      await onAddCashTx({
        type: 'OUT',
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: calc.paidAmount,
        description: `${newRec.staffName} (${newRec.designation}) মাসিক বেতন প্রদান`,
        paymentMethod: 'নগদ ক্যাশ',
      });
    }

    setSName('');
    setSPhone('');
    setSSalary('');
    setSAdvance('');
    setSPaid('');
    setSNote('');
    onShowToast(
      isEn
        ? `Salary record for ${newRec.staffName} saved and synced with Cash Book!`
        : `${newRec.staffName}-এর মাসিক বেতন খাতা ও ক্যাশ বুকে সংরক্ষিত হয়েছে!`
    );
  };

  const handlePayRemainingSalary = async (rec: MonthlyStaffSalaryRecord) => {
    const calc = calculateStaffSalaryPayable(
      rec.monthlySalary,
      rec.advanceDeducted,
      rec.paidAmount
    );
    if (calc.remainingDue <= 0) return;

    const finalInstallment: StaffSalaryPaymentInstallment = {
      id: `pay-${Date.now()}`,
      date: todayDate,
      amount: calc.remainingDue,
      note: 'সম্পূর্ণ বকেয়া বেতন পরিশোধ',
      paymentMethod: 'নগদ ক্যাশ',
    };

    const updated = enterpriseState.staffSalaries.map((s) =>
      s.id === rec.id
        ? {
            ...s,
            paidAmount: s.paidAmount + calc.remainingDue,
            status: 'PAID' as const,
            paymentDate: todayDate,
            payments: [finalInstallment, ...(s.payments || [])],
          }
        : s
    );
    onUpdateEnterpriseState({
      ...enterpriseState,
      staffSalaries: updated,
    });

    await onAddCashTx({
      type: 'OUT',
      category: 'শ্রমিক ও সর্দার পেমেন্ট',
      amount: calc.remainingDue,
      description: `${rec.staffName} (${rec.designation}) বকেয়া মাসিক বেতন পরিশোধ`,
      paymentMethod: 'নগদ ক্যাশ',
    });

    onShowToast(
      isEn
        ? `Paid remaining salary Tk ${calc.remainingDue} to ${rec.staffName}.`
        : `${rec.staffName}-এর অবশিষ্ট বেতন ${formatCurrencyBn(calc.remainingDue)} পরিশোধ ও ক্যাশ বুকে যুক্ত হয়েছে!`
    );
  };

  const handleOpenPartialPayModal = (rec: MonthlyStaffSalaryRecord) => {
    setPartialPayTarget(rec);
    const calc = calculateStaffSalaryPayable(
      rec.monthlySalary,
      rec.advanceDeducted,
      rec.paidAmount
    );
    setPartialPayAmount(String(calc.remainingDue > 0 ? Math.min(calc.remainingDue, 5000) : ''));
    setPartialPayDate(todayDate);
    setPartialPayNote('হাত খরচ / কিস্তি প্রদান');
  };

  const handlePayStaffInstallmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialPayTarget) return;
    const amount = Math.max(0, Number(partialPayAmount) || 0);
    if (amount <= 0) {
      onShowToast(
        isEn ? 'Enter valid installment amount.' : 'সঠিক কিস্তির টাকার পরিমাণ লিখুন।',
        'error'
      );
      return;
    }
    const calc = calculateStaffSalaryPayable(
      partialPayTarget.monthlySalary,
      partialPayTarget.advanceDeducted,
      partialPayTarget.paidAmount
    );
    if (amount > calc.remainingDue) {
      onShowToast(
        isEn
          ? `Amount cannot exceed remaining due ${calc.remainingDue} Tk.`
          : `টাকার পরিমাণ বকেয়া ${formatCurrencyBn(calc.remainingDue)}-এর বেশি হতে পারবে না।`,
        'error'
      );
      return;
    }

    const newInstallment: StaffSalaryPaymentInstallment = {
      id: `pay-${Date.now()}`,
      date: partialPayDate || todayDate,
      amount,
      note: partialPayNote.trim() || 'অল্প কিস্তি/হাত খরচ পরিশোধ',
      paymentMethod: 'নগদ ক্যাশ',
    };

    const nextPaid = partialPayTarget.paidAmount + amount;
    const nextDue = Math.max(0, calc.remainingDue - amount);
    const nextStatus = nextDue === 0 ? ('PAID' as const) : ('PARTIAL' as const);

    const updated = enterpriseState.staffSalaries.map((s) => {
      if (s.id === partialPayTarget.id) {
        const existingPayments = s.payments || [];
        return {
          ...s,
          paidAmount: nextPaid,
          status: nextStatus,
          paymentDate: partialPayDate || todayDate,
          payments: [newInstallment, ...existingPayments],
        };
      }
      return s;
    });

    onUpdateEnterpriseState({
      ...enterpriseState,
      staffSalaries: updated,
    });

    await onAddCashTx({
      type: 'OUT',
      category: 'শ্রমিক ও সর্দার পেমেন্ট',
      amount,
      description: `${partialPayTarget.staffName} (${partialPayTarget.designation}) অল্প কিস্তি/হাত খরচ বেতন পরিশোধ: ${partialPayNote.trim() || ''}`,
      paymentMethod: 'নগদ ক্যাশ',
    });

    onShowToast(
      isEn
        ? `Paid installment Tk ${amount} to ${partialPayTarget.staffName}.`
        : `${partialPayTarget.staffName}-কে ${formatCurrencyBn(amount)} কিস্তি/হাত খরচ পরিশোধ ও ক্যাশ বুকে যুক্ত হয়েছে!`
    );
    setPartialPayTarget(null);
    setPartialPayAmount('');
    setPartialPayNote('');
  };

  const handleAddLandLeaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lOwner.trim()) {
      onShowToast(isEn ? 'Enter landowner name.' : 'জমির মালিকের নাম লিখুন।', 'error');
      return;
    }
    const totalAmt = Math.max(0, Number(lTotalAmt) || 0);
    const paidAmt = Math.max(0, Number(lPaidAmt) || 0);

    const newRec: LandLeaseContractRecord = {
      id: `lease-${Date.now()}`,
      landownerName: lOwner.trim(),
      phone: lPhone.trim() || '—',
      mouzaOrLocation: lMouza.trim() || 'বাবুলিয়া মাঠ',
      landAreaBigha: Math.max(0.5, Number(lBigha) || 1),
      contractedTrucks: Math.max(1, Number(lTrucks) || 100),
      deliveredTrucks: Math.max(0, Number(lDeliveredTrucks) || 0),
      totalContractAmount: totalAmt,
      paidAmount: paidAmt,
      startDate: todayDate,
      endDate: '2027-04-30',
      note: 'মাটি ও জমি লিজ চুক্তি',
    };

    onUpdateEnterpriseState({
      ...enterpriseState,
      landLeases: [newRec, ...enterpriseState.landLeases],
    });

    if (paidAmt > 0) {
      await onAddCashTx({
        type: 'OUT',
        category: 'মাটি ক্রয়',
        amount: paidAmt,
        description: `${newRec.landownerName} (${newRec.mouzaOrLocation}) জমি লিজ ও মাটি চুক্তি বাবদ প্রদান`,
        paymentMethod: 'নগদ ক্যাশ',
      });
    }

    setLOwner('');
    setLPhone('');
    setLMouza('');
    setLBigha('');
    setLTrucks('');
    setLDeliveredTrucks('');
    setLTotalAmt('');
    setLPaidAmt('');
    onShowToast(
      isEn
        ? `Land lease contract with ${newRec.landownerName} saved!`
        : `${newRec.landownerName}-এর জমি লিজ ও মাটি চুক্তি সংরক্ষিত হয়েছে!`
    );
  };

  const handleAddLandTruckTrip = (lease: LandLeaseContractRecord, addedTrucks: number) => {
    const updated = enterpriseState.landLeases.map((l) =>
      l.id === lease.id
        ? {
            ...l,
            deliveredTrucks: l.deliveredTrucks + addedTrucks,
          }
        : l
    );
    onUpdateEnterpriseState({
      ...enterpriseState,
      landLeases: updated,
    });
    onShowToast(
      isEn
        ? `+${addedTrucks} trucks of clay recorded from ${lease.landownerName}'s land.`
        : `${lease.landownerName}-এর জমি থেকে +${formatBn(addedTrucks)} গাড়ি মাটি ভাটায় জমা হয়েছে!`
    );
  };

  // ============================================================================
  // SECTION 1: FIXED CHIMNEY 208-LINE & DAMPER 2D KILN FIRING MAP
  // (ফিড চিমনি ভাটা — ২০৮ লাইন ও ডাম্পার ২ডি ফায়ারিং ও লোড ম্যাপ)
  // ============================================================================
  if (activeSection === 'chulli_chamber') {
    const lineStatus = computeFeedKilnLineSystemStatus(currentLineSystem, {
      totalVanLoadedBricks,
      totalUnloadedLines,
      totalUnloadedBricks,
    });
    const recentlyClearedSet = new Set<number>(lineStatus.recentlyClearedLines || []);
    const allClearedSet = new Set<number>(lineStatus.clearedLineNumbers || []);
    const damperAlerts = computeDamperMaintenanceAlerts(currentLineSystem, lineStatus);
    const damperAlertByLineMap = new Map(
      damperAlerts.items.map((item) => [item.afterLineNo, item])
    );
    const damperByLineMap = new Map<number, KilnDamperRecord>();
    for (const d of currentLineSystem.dampers) {
      damperByLineMap.set(d.afterLineNo, d);
    }

    const getLineState = (
      lineNo: number
    ): 'UNLOADED' | 'FIRED_COOLING' | 'ACTIVE_FIRING' | 'RAW_LOADED_AHEAD' | 'EMPTY' => {
      return getFeedKilnLineZoneState(lineNo, lineStatus);
    };

    const getLineStateMeta = (lineNo: number) => {
      const st = getLineState(lineNo);
      if (st === 'UNLOADED') {
        return {
          labelBn:
            '⬜ আনলোড সম্পন্ন → ফাঁকা লাইন (নজরুল সর্দার ইট বের করেছেন — চুল্লির এই অংশ ফাঁকা ও পরবর্তী লোডের জন্য প্রস্তুত)',
          shortBn: 'আনলোড → ফাঁকা লাইন',
          bgClass: 'bg-slate-800 text-emerald-300 border-emerald-400 border-dashed',
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-400',
        };
      }
      if (st === 'FIRED_COOLING') {
        return {
          labelBn: 'পোড়ানো শেষ — পিছনে থুয়ে এসেছে (ঠান্ডা হচ্ছে)',
          shortBn: 'পোড়ানো শেষ',
          bgClass: 'bg-teal-700 text-white border-teal-500',
          badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
        };
      }
      if (st === 'ACTIVE_FIRING') {
        return {
          labelBn: '🔥 বর্তমানে পোড়াচ্ছে (আলতাফ সর্দারের আগুন চলছে)',
          shortBn: '🔥 পোড়াচ্ছে',
          bgClass:
            'bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white border-amber-300 shadow-md',
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
        };
      }
      if (st === 'RAW_LOADED_AHEAD') {
        return {
          labelBn: '✅ ভ্যান লোড সম্পন্ন (সেলিম সর্দার ৪,০০০ ইট লোড করেছেন)',
          shortBn: 'লোড হয়ে গেছে',
          bgClass: 'bg-sky-600 text-white border-sky-400',
          badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
        };
      }
      return {
        labelBn: 'ফাঁকা লাইন (এখনো ভ্যান লোড হয়নি)',
        shortBn: 'ফাঁকা লাইন',
        bgClass: 'bg-slate-100 text-slate-600 border-slate-300',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    };

    const getSectorNameForLine = (lineNo: number) => {
      if (lineNo <= 74) return '১. পূর্ব লম্বা সাইড (লাইন ১–৭৪ · ৭৪ লাইন)';
      if (lineNo <= 104) return '২. উত্তর মাথার গোল রাউন্ড বাঁক (লাইন ৭৫–১০৪ · ৩০ লাইন)';
      if (lineNo <= 178) return '৩. পশ্চিম লম্বা সাইড — চিমনির সোজাসোজি (লাইন ১০৫–১৭৮ · ৭৪ লাইন)';
      return '৪. দক্ষিণ মাথার গোল রাউন্ড বাঁক (লাইন ১৭৯–২০৮ · ৩০ লাইন)';
    };

    // Filter lines for the detailed interactive grid below the 2D oval track
    const visibleLineNumbers: number[] = [];
    for (let i = 1; i <= 208; i++) {
      if (activeSectorFilter === 'EAST' && (i < 1 || i > 74)) continue;
      if (activeSectorFilter === 'NORTH' && (i < 75 || i > 104)) continue;
      if (activeSectorFilter === 'WEST' && (i < 105 || i > 178)) continue;
      if (activeSectorFilter === 'SOUTH' && (i < 179 || i > 208)) continue;
      if (activeSectorFilter === 'ALL_ACTIVE') {
        const maxShow = Math.min(208, Math.max(74, lineStatus.totalLoadedLines + 14));
        if (i > maxShow) continue;
      }
      visibleLineNumbers.push(i);
    }

    const selectedLineMeta = getLineStateMeta(selectedLineNo);
    const selectedLineDamper = damperByLineMap.get(selectedLineNo);

    // Compute SVG coordinates for fireStartLineNo badge (e.g., Line #134)
    const getSvgMidPointForLine = (lineNo: number) => {
      if (lineNo <= 74) {
        const t = (lineNo - 0.5) / 74;
        return { x: 775 - t * 590, y: 20 };
      }
      if (lineNo <= 104) {
        const idxRound = lineNo - 74;
        const frac = (idxRound - 0.5) / 30;
        const angle = -Math.PI / 2 - frac * Math.PI;
        return { x: 185 + 150 * Math.cos(angle), y: 180 + 150 * Math.sin(angle) };
      }
      if (lineNo <= 178) {
        const idxWest = lineNo - 104;
        const t = (idxWest - 0.5) / 74;
        return { x: 185 + t * 590, y: 242 };
      }
      const idxSouth = lineNo - 178;
      const frac = (idxSouth - 0.5) / 30;
      const angle = Math.PI / 2 - frac * Math.PI;
      return { x: 775 + 150 * Math.cos(angle), y: 180 + 150 * Math.sin(angle) };
    };
    const startBadgePt = getSvgMidPointForLine(lineStatus.fireStartLineNo);

    return (
      <div className="space-y-6" data-testid="section-chulli-chamber">
        {/* 1. Executive Dark Header: Fixed Chimney 208-Line & Damper System */}
        <Card variant="dark" topAccent="orange" padding="lg" className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-600 via-rose-600 to-amber-600 flex items-center justify-center text-white shadow-md shrink-0">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex flex-wrap items-center gap-2 text-amber-300 text-xs font-extrabold">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                    পার্ট ১ · চুল্লির সারসংক্ষেপ ও কুইক অপারেশন
                  </span>
                  <span>মোট ২০৮ লাইন (১ লাইন = ৪,০০০ ইট)</span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white">
                    🔥 শুরুর লাইন: #{formatBn(lineStatus.fireStartLineNo)}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
                  🧱 চুল্লি ২০৮-লাইন কন্ট্রোল সিস্টেম (পার্ট-বাই-পার্ট ড্যাশবোর্ড)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  ভ্যান লোড (সেলিম সর্দার), পোড়ানো (আলতাফ সর্দার) ও আনলোড (নজরুল সর্দার) — প্রতিটি কাজ নিচে আলাদা আলাদা পার্টে সাজানো হয়েছে।
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                <span className="text-slate-400">চলমান ফায়ারিং রাউন্ড:</span>{' '}
                <strong className="text-amber-400 font-mono">
                  রাউন্ড-{formatBn(enterpriseState.activeRoundNo)}
                </strong>
              </div>
              <button
                type="button"
                data-testid="btn-reset-kiln-from-zero"
                onClick={handleResetKilnFromZero}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer transition-colors shadow-sm"
              >
                🔄 প্রথম থেকে শুরু করুন (০ থেকে রিসেট)
              </button>
              <button
                type="button"
                onClick={handleAdvanceFiringRound}
                className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold cursor-pointer transition-colors"
              >
                + নতুন রাউন্ড শুরু
              </button>
            </div>
          </div>

          {/* 6 Live KPI Boxes for 208-Line System */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-teal-500">
              <span className="text-slate-300 font-bold block">
                নজরুল সর্দার আনলোড ও ফাঁকা লাইন
              </span>
              <strong
                data-testid="kiln-fired-lines-count"
                className="text-lg font-black text-teal-300 tabular-nums block mt-0.5"
              >
                {formatBn(lineStatus.unloadedLinesBehind)} লাইন ফাঁকা
              </strong>
              <span className="text-[11px] text-slate-300 tabular-nums block">
                চুল্লি থেকে কর্তন: −{formatBn(lineStatus.unloadedBricksBehind)} ইট · স্টক: {formatBn(totalBrickStockPieces)} পিস
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-rose-500">
              <span className="text-slate-300 font-bold block">
                🔥 বর্তমানে পোড়াচ্ছে (আলতাফ সর্দার)
              </span>
              <strong
                data-testid="kiln-active-firing-lines"
                className="text-lg font-black text-rose-400 tabular-nums block mt-0.5"
              >
                {formatBn(lineStatus.activeFiringLinesCount)} লাইন
              </strong>
              <span className="text-[11px] text-amber-300 font-bold tabular-nums">
                লাইন #{formatBn(lineStatus.activeFiringStartLine)}–#{formatBn(lineStatus.activeFiringEndLine)} ({formatBn(lineStatus.activeFiringBricks)} ইট)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-sky-500">
              <span className="text-slate-300 font-bold block">
                সামনে ভ্যান লোড (সেলিম সর্দার)
              </span>
              <strong
                data-testid="kiln-loaded-ahead-lines"
                className="text-lg font-black text-sky-300 tabular-nums block mt-0.5"
              >
                {formatBn(lineStatus.rawLinesLoadedAhead)} পূর্ণ লাইন
              </strong>
              <span className="text-[11px] text-slate-300 tabular-nums block">
                {(lineStatus.partialBricksInNextLine || 0) > 0 ? (
                  <strong className="text-amber-300">
                    + চলমান লাইন #{formatBn(lineStatus.partialLoadLineNo || 1)}-এ জমা: {formatBn(lineStatus.partialBricksInNextLine || 0)} / ৪,০০০ ইট
                  </strong>
                ) : (
                  `চুল্লিতে কাঁচা লোড: ${formatBn(lineStatus.rawBricksLoadedAhead)} ইট`
                )}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-amber-500">
              <span className="text-slate-300 font-bold block">
                চুল্লিতে বর্তমান ইট ও ফাঁকা লাইন
              </span>
              <strong
                data-testid="kiln-active-loaded-lines"
                className="text-lg font-black text-amber-300 tabular-nums block mt-0.5"
              >
                {formatBn(lineStatus.totalLoadedLines)} / ২০৮ লাইন
              </strong>
              <span
                data-testid="kiln-available-empty-lines"
                className="text-[11px] text-emerald-300 font-bold tabular-nums block"
              >
                চুল্লিতে আছে: {formatBn(lineStatus.totalLoadedBricks)} ইট · এভেইলেবল ফাঁকা: {formatBn(lineStatus.emptyLinesRemaining)} লাইন
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-emerald-500">
              <span className="text-slate-300 font-bold block">
                কয়লা ও কাঠ লাগলো
              </span>
              <strong
                data-testid="kiln-fuel-summary"
                className="text-base font-black text-emerald-400 tabular-nums block mt-0.5"
              >
                {formatBn(lineStatus.coalUsedTons)} টন · {formatBn(lineStatus.woodUsedMaunds)} মণ
              </strong>
              <span className="text-[11px] text-slate-300 tabular-nums">
                লাইন প্রতি: {formatBn(lineStatus.coalPerLineKg)} কেজি কয়লা, {formatBn(lineStatus.woodPerLineMaunds)} মণ কাঠ
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-orange-500">
              <span className="text-slate-300 font-bold block">
                🚧 ডাম্পার ও গ্যাপ সিস্টেম
              </span>
              <strong
                data-testid="kiln-dampers-count"
                className="text-lg font-black text-orange-300 tabular-nums block mt-0.5"
              >
                {formatBn(currentLineSystem.dampers.length)}টি ডাম্পার
              </strong>
              <span className="text-[11px] text-slate-300 tabular-nums">
                সক্রিয় ডাম্পার: {formatBn(lineStatus.activeDampersCount)}টি · গ্যাপসহ: {formatBn(lineStatus.dampersWithGapCount)}টি
              </span>
            </div>
          </div>

          {/* 1-Click Fast Operations Toolbar */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs font-extrabold text-amber-300">
              ⚡ ১-ক্লিক লাইভ অপারেশন (লাইন #{formatBn(lineStatus.fireStartLineNo)} থেকে শুরু করে তাৎক্ষণিক আপডেট):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="btn-advance-fire-line"
                onClick={handleQuickAdvanceFireOneLine}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-extrabold cursor-pointer shadow-xs transition-all active:scale-95"
              >
                🔥 +১ লাইন পোড়ানো এগিয়ে নিন (+4,000 ইট)
              </button>
              <button
                type="button"
                data-testid="btn-add-van-load-line"
                onClick={() => handleQuickAddVanLoadWithDamper(1, false)}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold cursor-pointer shadow-xs transition-all active:scale-95"
              >
                🚜 +১ লাইন ভ্যান লোড (+4,000 ইট)
              </button>
              <button
                type="button"
                data-testid="btn-add-5-lines-damper"
                onClick={() => handleQuickAddVanLoadWithDamper(5, true)}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer shadow-xs transition-all active:scale-95"
              >
                🚧 +৫ লাইন লোড ও ডাম্পার (+20,000 ইট)
              </button>
              <button
                type="button"
                data-testid="btn-add-7-lines-damper"
                onClick={() => handleQuickAddVanLoadWithDamper(7, true)}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer shadow-xs transition-all active:scale-95"
              >
                🚧 +৭ লাইন লোড ও ডাম্পার (+28,000 ইট)
              </button>
              <button
                type="button"
                data-testid="btn-add-unload-line"
                onClick={() => handleQuickAddUnloadLines(1)}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-xs transition-all active:scale-95"
              >
                📦 +১ লাইন আনলোড (নজরুল সর্দার — ফাঁকা করুন)
              </button>
              <button
                type="button"
                onClick={handleResetKilnFromZero}
                className="px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-extrabold cursor-pointer shadow-xs transition-all active:scale-95"
              >
                🔄 ০ থেকে রিসেট (প্রথম থেকে শুরু)
              </button>
            </div>
          </div>
        </Card>

        {/* 2. Smart Firing Speed / Fireman Shirking Detector & Front Load Buffer Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pace & Fireman Shirking Alert */}
          <div
            data-testid="kiln-pace-alert-card"
            className={`p-4 rounded-2xl border-2 space-y-2 ${
              lineStatus.paceStatus === 'SLOW_SHIRKING'
                ? 'bg-rose-50 border-rose-500 text-rose-950'
                : lineStatus.paceStatus === 'AHEAD'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                : 'bg-amber-50/70 border-amber-400 text-slate-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide px-2.5 py-0.5 rounded-md bg-slate-900 text-white">
                পোড়ানোর গতি ও মিস্ত্রি জোন কামাই / ফাঁকি যাচাই
              </span>
              <span className="text-xs font-extrabold font-mono">
                দৈনিক গড়: {formatBn(lineStatus.actualLinesPerDay)} লাইন (টার্গেট: {formatBn(lineStatus.expectedLinesPerDay)} লাইন/দিন)
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold">
              {lineStatus.paceAlertTitleBn}
            </h3>
            <p className="text-xs font-semibold leading-relaxed">
              {lineStatus.paceAlertDetailBn}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <span>🔥 আগুন শুরু: লাইন #{formatBn(lineStatus.fireStartLineNo)}</span>
              <span>·</span>
              <span>চলমান দিন: {formatBn(lineStatus.firingDaysElapsed)} দিন</span>
              <span>·</span>
              <span>হওয়ার কথা ছিল: {formatBn(lineStatus.expectedLinesByNow)} লাইন</span>
              <span>·</span>
              <span>বাস্তবে পুড়েছে: {formatBn(lineStatus.firedLinesCompleted)} লাইন</span>
              <span>·</span>
              <span>মিস্ত্রি: {currentLineSystem.firemanMistriName}</span>
            </div>
          </div>

          {/* Front Raw Brick Load Buffer Alert */}
          <div
            data-testid="kiln-front-load-alert-card"
            className={`p-4 rounded-2xl border-2 space-y-2 ${
              lineStatus.frontLoadStatus === 'CRITICAL_LOW'
                ? 'bg-rose-50 border-rose-500 text-rose-950'
                : lineStatus.frontLoadStatus === 'WARNING_LOW'
                ? 'bg-amber-50 border-amber-500 text-amber-950'
                : 'bg-sky-50/80 border-sky-400 text-slate-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide px-2.5 py-0.5 rounded-md bg-slate-900 text-white">
                সামনের ভ্যান লোড বাফার ও ডাম্পার গ্যাপ নিরাপত্তা
              </span>
              <span className="text-xs font-extrabold font-mono">
                সামনে লোড: {formatBn(lineStatus.rawLinesLoadedAhead)} লাইন ({formatBn(lineStatus.rawBricksLoadedAhead)} ইট)
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold">
              {lineStatus.frontLoadTitleBn}
            </h3>
            <p className="text-xs font-semibold leading-relaxed">
              {lineStatus.frontLoadDetailBn}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <span>নিরাপদ ন্যূনতম বাফার: {formatBn(currentLineSystem.minSafeLoadAheadLines)} লাইন</span>
              <span>·</span>
              <span>লোড সর্দার: {currentLineSystem.loadSardarName}</span>
              <span>·</span>
              <span>সক্রিয় ডাম্পার: {formatBn(lineStatus.activeDampersCount)}টি</span>
            </div>
          </div>
        </div>

        {/* পার্ট ২: দ্রুত ভ্যান লোড ও আনলোড এন্ট্রি (সেলিম সর্দার ও নজরুল সর্দার) */}
        <div
          data-testid="auto-chimney-van-unload-sync-banner"
          className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 border-2 border-sky-500/40 shadow-md space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-400 text-slate-950 text-xs font-black">
                পার্ট ২ · ভ্যান লোড ও আনলোড কুইক এন্ট্রি
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                সেলিম সর্দার (ভ্যান লোড) ও নজরুল সর্দার (চুল্লি আনলোড) — তাৎক্ষণিক লাইন আপডেট
              </h3>
            </div>
            <span className="text-xs font-bold text-amber-300 bg-slate-900 border border-slate-700 px-3 py-1 rounded-xl">
              ১ লাইন = ৪,০০০ ইট · শুরুর লাইন #{formatBn(lineStatus.fireStartLineNo)}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Box A: Selim Sardar Van Load */}
            <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sky-300 font-extrabold text-sm">
                  🚜 ১. সেলিম সর্দার — ভ্যান লোড (৪,০০০ ইট = ১ লাইন)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 font-black">
                  মোট লোড: {formatBn(lineStatus.rawLinesLoadedAhead)} লাইন ({formatBn(lineStatus.rawBricksLoadedAhead)} ইট)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="map-quick-load-4000-btn"
                  onClick={() => handleQuickAddVanLoadBricks(4000)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-black cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  +৪,০০০ ইট লোড (+১ লাইন)
                </button>
                <button
                  type="button"
                  data-testid="map-quick-load-8000-btn"
                  onClick={() => handleQuickAddVanLoadBricks(8000)}
                  className="px-3.5 py-2 rounded-xl bg-sky-900 hover:bg-sky-800 text-sky-200 border border-sky-400/60 font-extrabold cursor-pointer active:scale-95 transition-all"
                >
                  +৮,০০০ ইট লোড (+২ লাইন)
                </button>
                <div className="inline-flex items-center gap-1.5 bg-slate-950 rounded-xl px-2.5 py-1 border border-slate-700">
                  <input
                    type="number"
                    min={500}
                    step={500}
                    data-testid="map-quick-load-custom-input"
                    value={quickVanBricksInput}
                    onChange={(e) => setQuickVanBricksInput(e.target.value)}
                    className="w-20 px-2 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold border border-slate-700"
                    placeholder="4000"
                  />
                  <button
                    type="button"
                    data-testid="map-quick-load-custom-btn"
                    onClick={() => handleQuickAddVanLoadBricks(Number(quickVanBricksInput) || 4000)}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer active:scale-95 transition-all"
                  >
                    লোড করুন
                  </button>
                </div>
              </div>
            </div>

            {/* Box B: Nazrul Sardar Chulli Unload */}
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-emerald-300 font-extrabold text-sm">
                  📦 ২. নজরুল সর্দার — চুল্লি আনলোড (ফাঁকা লাইন)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black">
                  আনলোড ফাঁকা: {formatBn(lineStatus.unloadedLinesBehind)} লাইন ({formatBn(lineStatus.unloadedBricksBehind)} ইট)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="map-quick-unload-1line-btn"
                  onClick={() => handleQuickAddUnloadLines(1)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  +১ লাইন আনলোড (৪,০০০ ইট)
                </button>
                <div className="inline-flex items-center gap-1.5 bg-slate-950 rounded-xl px-2.5 py-1 border border-slate-700">
                  <input
                    type="number"
                    min={1}
                    max={208}
                    data-testid="map-quick-unload-custom-input"
                    value={quickUnloadLinesInput}
                    onChange={(e) => setQuickUnloadLinesInput(e.target.value)}
                    className="w-16 px-2 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold border border-slate-700"
                    placeholder="1"
                  />
                  <button
                    type="button"
                    data-testid="map-quick-unload-custom-btn"
                    onClick={() =>
                      handleQuickAddUnloadLines(Number(quickUnloadLinesInput) || 1)
                    }
                    className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black cursor-pointer active:scale-95 transition-all"
                  >
                    আনলোড করুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* পার্ট ৩: ২০৮-লাইন চুল্লি নকশা এবং পার্ট ৪ ও পার্ট ৫ কন্ট্রোল প্যানেল */}
        <Card
          variant="default"
          topAccent="orange"
          padding="lg"
          className="space-y-5"
          data-testid="kiln-2d-chimney-line-map"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div>
              <div className="inline-flex flex-wrap items-center gap-2 text-orange-700 text-xs font-extrabold">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-600 text-white font-black">
                  পার্ট ৩ · ২০৮-লাইন চুল্লি নকশা (ম্যাপ)
                </span>
                <span>
                  শুরুর লাইন #{formatBn(lineStatus.fireStartLineNo)} · পূর্ব ৭৪ + উত্তর ৩০ + পশ্চিম ৭৪ + দক্ষিণ ৩০ = ২০৮ লাইন
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-950 mt-1">
                বাস্তব ফিক্সড চিমনি ২০৮-লাইন নকশা ({lineStatus.loadRoundLabelBn})
              </h3>
            </div>

            {/* Overlay Mode Toggle ('Production Status' vs 'Damper Maintenance Alerts') + Color Legend */}
            <div className="flex flex-col items-start lg:items-end gap-2.5">
              <div
                data-testid="kiln-map-overlay-toggle"
                role="group"
                aria-label="Kiln 208-Line Map Overlay Toggle"
                className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-700 shadow-xs"
              >
                <button
                  type="button"
                  data-testid="overlay-toggle-production-status"
                  onClick={() => setMapOverlayMode('PRODUCTION_STATUS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mapOverlayMode === 'PRODUCTION_STATUS'
                      ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🔥 প্রোডাকশন স্ট্যাটাস (Production Status)</span>
                </button>
                <button
                  type="button"
                  data-testid="overlay-toggle-damper-alerts"
                  onClick={() => setMapOverlayMode('DAMPER_ALERTS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mapOverlayMode === 'DAMPER_ALERTS'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🚧 ডাম্পার রক্ষণাবেক্ষণ অ্যালার্ট (Damper Maintenance Alerts)</span>
                  {(damperAlerts.overdueToOpenCount +
                    damperAlerts.missingGapCount +
                    (damperAlerts.needsNewDamperAhead ? 1 : 0)) >
                    0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                      {formatBn(
                        damperAlerts.overdueToOpenCount +
                          damperAlerts.missingGapCount +
                          (damperAlerts.needsNewDamperAhead ? 1 : 0)
                      )}
                    </span>
                  )}
                </button>
              </div>

              {mapOverlayMode === 'PRODUCTION_STATUS' ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 text-white border border-amber-300">
                    🔥 আগুন শুরু: #{formatBn(lineStatus.fireStartLineNo)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white">
                    ✅ আনলোড সাকসেসফুল ({formatBn(lineStatus.unloadedLinesBehind)})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-700 text-white">
                    পোড়ানো শেষ / পিছনে ({formatBn(lineStatus.coolingBehindLines)})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white">
                    🔥 বর্তমানে পোড়াচ্ছে ({formatBn(lineStatus.activeFiringLinesCount)})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 text-white">
                    সামনে ভ্যান লোড ({formatBn(lineStatus.rawLinesLoadedAhead)})
                  </span>
                  {(lineStatus.partialBricksInNextLine || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 border border-slate-900">
                      ⏳ আংশিক লোড #{formatBn(lineStatus.partialLoadLineNo || 0)} (
                      {formatBn(lineStatus.partialBricksInNextLine || 0)} ইট)
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 border border-slate-900">
                    🚧 ডাম্পার ও গ্যাপ ({formatBn(currentLineSystem.dampers.length)})
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white">
                    🚨 ডাম্পার খোলা বাকি ({formatBn(damperAlerts.overdueToOpenCount)})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950">
                    ⚠️ গ্যাপ নেই ঝুঁকি ({formatBn(damperAlerts.missingGapCount)})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white">
                    ✅ নিরাপদ সক্রিয় ডাম্পার ({formatBn(damperAlerts.healthyActiveCount)})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950">
                    🎯 পরবর্তী প্রস্তাবিত ডাম্পার: লাইন #{formatBn(damperAlerts.recommendedNextDamperLine)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Damper Maintenance Alerts Overlay Panel when DAMPER_ALERTS mode is active */}
          {mapOverlayMode === 'DAMPER_ALERTS' && (
            <div
              data-testid="damper-maintenance-alerts-panel"
              className="rounded-2xl bg-slate-900 text-white border-2 border-amber-400/80 p-4 space-y-3 shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wide block">
                    ডাম্পার ও গ্যাপ রক্ষণাবেক্ষণ ওভারলে (Damper Maintenance Alerts Overlay)
                  </span>
                  <h4 className="text-sm sm:text-base font-extrabold text-white">
                    আগুন পার হওয়া ডাম্পার খোলা, জলীয় বাষ্প রোধী গ্যাপ ও পরবর্তী ডাম্পার ব্লক তদারকি
                  </h4>
                </div>
                {damperAlerts.needsNewDamperAhead && (
                  <button
                    type="button"
                    data-testid="btn-place-recommended-damper"
                    onClick={() => {
                      const recLine = damperAlerts.recommendedNextDamperLine;
                      const nextDampers = [
                        ...currentLineSystem.dampers.filter((d) => d.afterLineNo !== recLine),
                        {
                          id: `dmp-${Date.now()}`,
                          afterLineNo: recLine,
                          linesInBlock: 5,
                          hasProtectiveGap: true,
                          status: 'ACTIVE_CLOSED' as const,
                          sardarName: currentLineSystem.loadSardarName || 'সেলিম সর্দার',
                          note: `লাইন #${formatBn(recLine)}-এ প্রস্তাবিত গ্যাপসহ ডাম্পার`,
                        },
                      ];
                      handleUpdateLineSystem(
                        { dampers: nextDampers },
                        `🚧 প্রস্তাবিত লাইন #${formatBn(recLine)}-এ গ্যাপসহ নতুন ডাম্পার বসানো হয়েছে!`
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer shrink-0 shadow-xs"
                  >
                    + প্রস্তাবিত লাইন #{formatBn(damperAlerts.recommendedNextDamperLine)}-এ নতুন ডাম্পার বসান
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {damperAlerts.items.map((item) => (
                  <div
                    key={item.damper.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                      item.severity === 'OVERDUE_OPEN'
                        ? 'bg-rose-950/90 border-rose-500 text-rose-100'
                        : item.severity === 'MISSING_GAP_RISK'
                        ? 'bg-amber-950/80 border-amber-400 text-amber-100'
                        : item.severity === 'ACTIVE_HEALTHY'
                        ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-100'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-extrabold text-white">{item.titleBn}</div>
                      <p className="text-[11px] opacity-90">{item.actionHintBn}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.severity === 'OVERDUE_OPEN' && (
                        <button
                          type="button"
                          onClick={() => handleToggleDamperStatus(item.damper.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-black cursor-pointer"
                        >
                          এখনই ডাম্পার খুলুন
                        </button>
                      )}
                      {item.severity === 'MISSING_GAP_RISK' && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextDampers = currentLineSystem.dampers.map((d) =>
                              d.id === item.damper.id ? { ...d, hasProtectiveGap: true } : d
                            );
                            handleUpdateLineSystem(
                              { dampers: nextDampers },
                              `✅ লাইন #${formatBn(item.afterLineNo)}-এর ডাম্পারে পানি/বাতাস রোধী গ্যাপ যুক্ত করা হয়েছে!`
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black cursor-pointer"
                        >
                          + সুরক্ষা গ্যাপ যুক্ত করুন
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openLineActionPopup(item.afterLineNo)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[11px] font-bold cursor-pointer"
                      >
                        লাইন #{formatBn(item.afterLineNo)} দেখুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3D & 2D Elongated Stadium-Oval Fixed Chimney Kiln Track Visualization (Selected Container) */}
          <div className="bg-slate-950 text-white rounded-[44px] p-4 sm:p-6 border-2 border-slate-800 space-y-4 shadow-inner">
            {/* TOP LIVE THICKNESS & STATUS HUD + ROUND SWITCHER (Clean & Compact) */}
            <div
              data-testid="kiln-live-thickness-hud"
              className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid="kiln-active-round-pill"
                    className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black"
                  >
                    🔄 {lineStatus.loadRoundLabelBn}
                  </span>
                  <button
                    type="button"
                    data-testid="live-badge-unload-status"
                    onClick={() => openLineActionPopup(lineStatus.unloadedEndLine || lineStatus.fireStartLineNo)}
                    className="px-3 py-1 rounded-xl bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-xs font-extrabold cursor-pointer"
                  >
                    📦 আনলোড ফাঁকা: {formatBn(lineStatus.unloadedLinesBehind)} লাইন
                  </button>
                  <button
                    type="button"
                    data-testid="live-badge-fire-status"
                    onClick={() => openLineActionPopup(lineStatus.activeFiringStartLine)}
                    className="px-3 py-1 rounded-xl bg-rose-950 border border-rose-500/60 text-rose-300 text-xs font-extrabold cursor-pointer"
                  >
                    🔥 পোড়াচ্ছে: {formatBn(lineStatus.activeFiringLinesCount)} লাইন
                  </button>
                  <button
                    type="button"
                    data-testid="live-badge-load-status"
                    onClick={() => openLineActionPopup(lineStatus.rawLoadedAheadEndLine || lineStatus.fireStartLineNo)}
                    className="px-3 py-1 rounded-xl bg-sky-950 border border-sky-500/60 text-sky-300 text-xs font-extrabold cursor-pointer"
                  >
                    🚜 ভ্যান লোড: {formatBn(lineStatus.rawLinesLoadedAhead)} লাইন{' '}
                    <span data-testid="load-successful-pill" className="sr-only">
                      লোড সাকসেসফুল
                    </span>
                  </button>
                  <div
                    data-testid="live-badge-thickness-status"
                    className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 text-xs font-extrabold"
                  >
                    📊 মোট লোড: {formatBn(lineStatus.totalLoadedLines)}/২০৮ লাইন ({formatBn(Math.round((lineStatus.totalLoadedLines / 208) * 100))}%)
                  </div>
                </div>

                {/* Round Switcher Pills */}
                <div
                  data-testid="kiln-dimension-toggle"
                  className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-950 p-1 border border-slate-700"
                >
                  <span
                    data-testid="btn-view-3d-kiln"
                    className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-400 text-slate-950"
                  >
                    রাউন্ড নির্বাচন:
                  </span>
                  {[1, 2, 3].map((rnd) => {
                    const isCurrentRnd = enterpriseState.activeRoundNo === rnd;
                    return (
                      <button
                        key={rnd}
                        type="button"
                        data-testid={`btn-kiln-round-${rnd}`}
                        onClick={() => {
                          onUpdateEnterpriseState({
                            ...enterpriseState,
                            activeRoundNo: rnd,
                            roundStartDate: todayDate,
                          });
                          onShowToast(`🔄 চুল্লি রাউন্ড-${formatBn(rnd)} (${rnd === 1 ? '১ম রাউন্ড' : rnd === 2 ? '২য় রাউন্ড' : '৩য় রাউন্ড'}) সক্রিয় করা হয়েছে!`);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          isCurrentRnd
                            ? 'bg-emerald-400 text-slate-950 shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {rnd === 1 ? '১ম রাউন্ড' : rnd === 2 ? '২য় রাউন্ড' : '৩য় রাউন্ড'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cleared Lines Highlight & Auto-Confirmation Bar on the 208-Line Map */}
            {(lineStatus.clearedLineNumbers.length > 0 ||
              lineStatus.recentlyClearedLines.length > 0) && (
              <div
                data-testid="kiln-map-cleared-lines-highlight-banner"
                className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-400/80 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[11px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      নজরুল সর্দার অটো-কনফার্মড আনলোড হাইলাইট চালু
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-emerald-400/60 text-emerald-300 text-[11px] font-extrabold">
                      মোট ক্লিয়ার/ফাঁকা লাইন: {formatBn(lineStatus.unloadedLinesBehind)}টি ({formatBn(lineStatus.unloadedBricksBehind)} পিস ইট)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[11px] font-extrabold">
                      🔥 Active Firing Lines: {formatBn(lineStatus.activeFiringLinesCount)} (অটো-রিসেট সক্রিয়)
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-semibold">
                    নিচের ২০৮-লাইন ম্যাপে ক্লিয়ার হওয়া লাইনগুলো <strong className="text-emerald-300">উজ্জ্বল সবুজ গ্লো (Glowing Emerald Highlight)</strong> দিয়ে চিহ্নিত করা হয়েছে — যেকোনো লাইন নম্বরে ক্লিক করে সরাসরি দেখুন:
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(lineStatus.recentlyClearedLines.length > 0
                    ? lineStatus.recentlyClearedLines
                    : lineStatus.clearedLineNumbers
                  )
                    .slice(0, 16)
                    .map((ln) => (
                      <button
                        key={ln}
                        type="button"
                        data-testid={`cleared-line-pill-${ln}`}
                        onClick={() => openLineActionPopup(ln)}
                        className={`px-2.5 py-1 rounded-full text-xs font-mono font-black cursor-pointer transition-all active:scale-95 ${
                          selectedLineNo === ln
                            ? 'bg-emerald-300 text-slate-950 ring-2 ring-yellow-300 shadow-md'
                            : 'bg-emerald-500/30 hover:bg-emerald-400 hover:text-slate-950 text-emerald-200 border border-emerald-400'
                        }`}
                      >
                        ⬜ #{formatBn(ln)} ✓
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* A. 3D Isometric Extruded Model / 2D Oval Racetrack SVG Kiln Blueprint */}
            <div
              className="bg-slate-900/90 border border-slate-800 rounded-[36px] p-3 sm:p-4 overflow-x-auto"
              data-testid="kiln-2d-oval-svg"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2 text-xs">
                <span className="font-extrabold text-amber-300">
                  {mapOverlayMode === 'PRODUCTION_STATUS'
                    ? kilnMapViewDimension === '3D'
                      ? `🧊 ৩ডি (3D) রাউন্ড-লম্বা ইটভাটা মডেল — 🔥 লাইন #${formatBn(
                          lineStatus.fireStartLineNo
                        )} থেকে শুরু · লোড সাকসেসফুল: ${formatBn(
                          lineStatus.rawLinesLoadedAhead
                        )} লাইন · আনলোড হয়েছে: ${formatBn(lineStatus.unloadedLinesBehind)} লাইন`
                      : `🧭 ভাটার ২ডি রাউন্ড-লম্বা ট্রেঞ্চ নকশা (Production Status) — 🔥 লাইন #${formatBn(
                          lineStatus.fireStartLineNo
                        )} থেকে লোড, আগুন ও আনলোড শুরু`
                    : `🚧 ডাম্পার রক্ষণাবেক্ষণ অ্যালার্ট ম্যাপ (Damper Maintenance Alerts) — কোন লাইনে ডাম্পার খোলা বাকি বা গ্যাপ ঝুঁকি আছে`}
                </span>
                <span className="text-[11px] text-slate-300 font-mono">
                  ৭৪ + ৩০ + ৭৪ + ৩০ = ২০৮ লাইন (৮,৩২,০০০ ইট)
                </span>
              </div>

              <svg
                viewBox="0 0 960 390"
                className="w-full min-w-[680px] h-auto select-none"
                role="img"
                aria-label="৩ডি ও ২ডি লম্বা ও দুই মাথায় রাউন্ড ফিক্সড চিমনি ইটভাটার ২০৮ লাইন ম্যাপ"
              >
                <defs>
                  <filter id="clearedLineHighlightGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="kiln3dWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#9a3412" />
                    <stop offset="50%" stopColor="#7c2d12" />
                    <stop offset="100%" stopColor="#431407" />
                  </linearGradient>
                  <linearGradient id="kiln3dTrenchFloor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#090d16" />
                    <stop offset="50%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#020617" />
                  </linearGradient>
                  <linearGradient id="chimney3dTowerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#991b1b" />
                    <stop offset="45%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                  </linearGradient>
                </defs>

                {/* 3D Isometric Extruded Base & Brick Wall Depth Layers */}
                {kilnMapViewDimension === '3D' && (
                  <g data-testid="kiln-3d-extrusion-layers">
                    {/* Deep Ground Drop Shadow */}
                    <rect
                      x="26"
                      y="48"
                      width="912"
                      height="316"
                      rx="158"
                      ry="158"
                      fill="#020617"
                      fillOpacity="0.9"
                    />
                    {/* 3D Outer Brick Wall Vertical Extrusion (Thickness = 18px) */}
                    <rect
                      x="30"
                      y="42"
                      width="900"
                      height="304"
                      rx="152"
                      ry="152"
                      fill="url(#kiln3dWallGrad)"
                      stroke="#c2410c"
                      strokeWidth="4"
                    />
                    {/* 3D Outer Wall Brick Course Rim */}
                    <rect
                      x="30"
                      y="34"
                      width="900"
                      height="304"
                      rx="152"
                      ry="152"
                      fill="#431407"
                      stroke="#fb923c"
                      strokeWidth="2.5"
                    />
                  </g>
                )}

                {/* Outer & Inner Stadium-Oval Kiln Trench Bed */}
                <rect
                  x="30"
                  y="28"
                  width="900"
                  height="304"
                  rx="152"
                  ry="152"
                  fill={kilnMapViewDimension === '3D' ? 'url(#kiln3dTrenchFloor)' : '#0f172a'}
                  stroke="#f97316"
                  strokeWidth={kilnMapViewDimension === '3D' ? '4.5' : '3'}
                  strokeOpacity="0.85"
                />

                {/* 3D Inner Island Brick Wall Extrusion */}
                {kilnMapViewDimension === '3D' && (
                  <rect
                    x="118"
                    y="122"
                    width="724"
                    height="136"
                    rx="68"
                    ry="68"
                    fill="url(#kiln3dWallGrad)"
                    stroke="#b45309"
                    strokeWidth="3"
                  />
                )}

                <rect
                  x="118"
                  y="112"
                  width="724"
                  height="136"
                  rx="68"
                  ry="68"
                  fill="#1e293b"
                  stroke="#fbbf24"
                  strokeWidth={kilnMapViewDimension === '3D' ? '3.5' : '2.5'}
                  strokeOpacity="0.85"
                />

                {/* Central Fixed Chimney Island inside the oval — Chimney in the EXACT MIDDLE (x=480, y=180) */}
                <rect
                  x="215"
                  y="126"
                  width="530"
                  height="108"
                  rx="54"
                  ry="54"
                  fill="#090d16"
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                  strokeDasharray="6 4"
                />

                {/* Left Wing of Center Island: Kiln Title, Fire Start Line & Round */}
                <text
                  x="328"
                  y="156"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12.5"
                  fontWeight="900"
                >
                  🧱 SBL রিয়েলিস্টিক ফিক্সড চিমনি ভাটা
                </text>
                <text
                  x="328"
                  y="175"
                  textAnchor="middle"
                  fill="#fb923c"
                  fontSize="11"
                  fontWeight="900"
                >
                  🔥 আগুন ও লোড শুরু: লাইন #{formatBn(lineStatus.fireStartLineNo)} থেকে
                </text>
                <text
                  x="328"
                  y="193"
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="10.5"
                  fontWeight="900"
                >
                  ✅ লোড হয়ে গেছে: {formatBn(lineStatus.rawLinesLoadedAhead)} লাইন ({formatBn(lineStatus.rawBricksLoadedAhead)} ইট)
                </text>
                <text
                  x="328"
                  y="211"
                  textAnchor="middle"
                  fill="#fde047"
                  fontSize="10"
                  fontWeight="900"
                >
                  {lineStatus.fireRoundLabelBn || '১ম রাউন্ড'} · থিকনেস/ভরাট: {formatBn(lineStatus.totalLoadedLines)}/২০৮ লাইন
                </text>

                {/* EXACT CENTER: 3D Extruded Fixed Chimney Tower at (cx=480) */}
                {kilnMapViewDimension === '3D' ? (
                  <g data-testid="kiln-3d-chimney-tower">
                    {/* Base Pedestal Shadow */}
                    <ellipse
                      cx="480"
                      cy="192"
                      rx="42"
                      ry="20"
                      fill="#020617"
                      fillOpacity="0.85"
                    />
                    {/* Base Pedestal */}
                    <ellipse
                      cx="480"
                      cy="188"
                      rx="36"
                      ry="16"
                      fill="#7c2d12"
                      stroke="#fb923c"
                      strokeWidth="2"
                    />
                    {/* 3D Tapered Brick Chimney Column rising upward */}
                    <polygon
                      points="456,188 504,188 493,108 467,108"
                      fill="url(#chimney3dTowerGrad)"
                      stroke="#fde047"
                      strokeWidth="1.8"
                    />
                    {/* Chimney Structural Rings */}
                    <line x1="459" y1="168" x2="501" y2="168" stroke="#fef08a" strokeWidth="1.5" />
                    <line x1="462" y1="146" x2="498" y2="146" stroke="#fef08a" strokeWidth="1.5" />
                    <line x1="465" y1="126" x2="495" y2="126" stroke="#fef08a" strokeWidth="1.5" />
                    {/* Chimney Top Crown & Smoke Glow */}
                    <ellipse
                      cx="480"
                      cy="108"
                      rx="14"
                      ry="6"
                      fill="#450a0a"
                      stroke="#fde047"
                      strokeWidth="2"
                    />
                    <circle cx="480" cy="96" r="9" fill="#94a3b8" fillOpacity="0.45" />
                    <circle cx="488" cy="85" r="12" fill="#cbd5e1" fillOpacity="0.3" />
                    <rect
                      x="422"
                      y="204"
                      width="116"
                      height="18"
                      rx="9"
                      fill="#f59e0b"
                    />
                    <text
                      x="480"
                      y="216.5"
                      textAnchor="middle"
                      fill="#090d16"
                      fontSize="10"
                      fontWeight="900"
                    >
                      ★ SBL চিমনি (CHIMNEY) ★
                    </text>
                  </g>
                ) : (
                  <g>
                    <circle
                      cx="480"
                      cy="172"
                      r="34"
                      fill="#7c2d12"
                      fillOpacity="0.55"
                      stroke="#f97316"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="480"
                      cy="172"
                      r="26"
                      fill="#dc2626"
                      stroke="#fef08a"
                      strokeWidth="3"
                    />
                    <circle cx="480" cy="172" r="10" fill="#fde047" />
                    <rect
                      x="426"
                      y="204"
                      width="108"
                      height="18"
                      rx="9"
                      fill="#f59e0b"
                    />
                    <text
                      x="480"
                      y="216.5"
                      textAnchor="middle"
                      fill="#090d16"
                      fontSize="10"
                      fontWeight="900"
                    >
                      ★ চিমনি (CHIMNEY) ★
                    </text>
                  </g>
                )}

                {/* Right Wing of Center Island: Live Firing, Unload & Front Load Summary */}
                <text
                  x="632"
                  y="158"
                  textAnchor="middle"
                  fill="#10b981"
                  fontSize="11"
                  fontWeight="900"
                >
                  ✅ আনলোড হয়েছে: #{formatBn(lineStatus.unloadedStartLine)}–#{formatBn(lineStatus.unloadedEndLine)} ({formatBn(lineStatus.unloadedLinesBehind)} লাইন)
                </text>
                <text
                  x="632"
                  y="177"
                  textAnchor="middle"
                  fill="#ef4444"
                  fontSize="11.5"
                  fontWeight="900"
                >
                  🔥 পোড়াচ্ছে: লাইন #{formatBn(lineStatus.activeFiringStartLine)}–#{formatBn(lineStatus.activeFiringEndLine)} ({formatBn(lineStatus.activeFiringLinesCount)} লাইন)
                </text>
                <text
                  x="632"
                  y="195"
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="11"
                  fontWeight="900"
                >
                  🚜 লোড সাকসেসফুল: #{formatBn(lineStatus.rawLoadedAheadStartLine)}–#{formatBn(lineStatus.rawLoadedAheadEndLine)} ({formatBn(lineStatus.rawLinesLoadedAhead)} লাইন)
                </text>
                <text
                  x="632"
                  y="212"
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize="10"
                  fontWeight="800"
                >
                  {(lineStatus.partialBricksInNextLine || 0) > 0
                    ? `⏳ আংশিক লোড: লাইন #${formatBn(lineStatus.partialLoadLineNo || 0)}-এ ${formatBn(
                        lineStatus.partialBricksInNextLine || 0
                      )}/৪,০০০ ইট`
                    : `খালি লাইন বাকি: ${formatBn(lineStatus.emptyLinesRemaining)} টি`}
                </text>

                {/* Render all 208 Brick Lines around the Stadium-Oval Track (with 3D Brick Stack Extrusion in 3D mode) */}
                {Array.from({ length: 208 }, (_, idx) => idx + 1).map((lineNo) => {
                  const st = getLineState(lineNo);
                  const hasDamper = damperByLineMap.has(lineNo);
                  const damperAlert = damperAlertByLineMap.get(lineNo);
                  const isRecommendedNextDamper =
                    damperAlerts.needsNewDamperAhead &&
                    damperAlerts.recommendedNextDamperLine === lineNo;
                  const isPartialLoadLine =
                    (lineStatus.partialBricksInNextLine || 0) > 0 &&
                    lineStatus.partialLoadLineNo === lineNo &&
                    st === 'EMPTY';
                  const isSelected = selectedLineNo === lineNo;
                  const isStartLine = lineNo === lineStatus.fireStartLineNo;

                  // Compute inner (x1,y1) and outer (x2,y2) endpoints for each line in the oval trench
                  let x1 = 0;
                  let y1 = 0;
                  let x2 = 0;
                  let y2 = 0;

                  if (lineNo <= 74) {
                    const t = (lineNo - 0.5) / 74;
                    const x = 775 - t * 590;
                    x1 = x;
                    y1 = 108;
                    x2 = x;
                    y2 = 34;
                  } else if (lineNo <= 104) {
                    const idxRound = lineNo - 74;
                    const frac = (idxRound - 0.5) / 30;
                    const angle = -Math.PI / 2 - frac * Math.PI;
                    const cx = 185;
                    const cy = 180;
                    x1 = cx + 72 * Math.cos(angle);
                    y1 = cy + 72 * Math.sin(angle);
                    x2 = cx + 146 * Math.cos(angle);
                    y2 = cy + 146 * Math.sin(angle);
                  } else if (lineNo <= 178) {
                    const idxWest = lineNo - 104;
                    const t = (idxWest - 0.5) / 74;
                    const x = 185 + t * 590;
                    x1 = x;
                    y1 = 252;
                    x2 = x;
                    y2 = 326;
                  } else {
                    const idxSouth = lineNo - 178;
                    const frac = (idxSouth - 0.5) / 30;
                    const angle = Math.PI / 2 - frac * Math.PI;
                    const cx = 775;
                    const cy = 180;
                    x1 = cx + 72 * Math.cos(angle);
                    y1 = cy + 72 * Math.sin(angle);
                    x2 = cx + 146 * Math.cos(angle);
                    y2 = cy + 146 * Math.sin(angle);
                  }

                  const prodStrokeColor =
                    st === 'UNLOADED'
                      ? '#10b981' // Vivid Green for Unload Successful
                      : st === 'FIRED_COOLING'
                      ? '#0d9488' // Teal for Fired/Cooling
                      : st === 'ACTIVE_FIRING'
                      ? '#ef4444' // Vivid Red for Currently Firing
                      : st === 'RAW_LOADED_AHEAD'
                      ? '#38bdf8' // Sky Blue for Loaded Ahead (লোড সাকসেসফুল / লোড হয়ে গেছে)
                      : isPartialLoadLine
                      ? '#f59e0b' // Amber for Partial Brick Load in Next Line
                      : '#334155';

                  const sideWall3dColor =
                    st === 'UNLOADED'
                      ? '#065f46'
                      : st === 'FIRED_COOLING'
                      ? '#115e59'
                      : st === 'ACTIVE_FIRING'
                      ? '#991b1b'
                      : st === 'RAW_LOADED_AHEAD'
                      ? '#0369a1'
                      : isPartialLoadLine
                      ? '#b45309'
                      : '#1e293b';

                  const damperOverlayColor = damperAlert
                    ? damperAlert.severity === 'OVERDUE_OPEN'
                      ? '#ef4444'
                      : damperAlert.severity === 'MISSING_GAP_RISK'
                      ? '#f97316'
                      : damperAlert.severity === 'ACTIVE_HEALTHY'
                      ? '#10b981'
                      : '#64748b'
                    : isRecommendedNextDamper
                    ? '#22d3ee'
                    : st === 'ACTIVE_FIRING'
                    ? '#7f1d1d'
                    : '#1e293b';

                  const activeStrokeColor =
                    mapOverlayMode === 'DAMPER_ALERTS' ? damperOverlayColor : prodStrokeColor;

                  // 3D Elevation Offset:
                  // Active / Loaded brick stacks stand taller in 3D mode.
                  // UNLOADED lines have had their bricks removed -> they transform into a recessed EMPTY CHAMBER (খালি ঘর)!
                  const isElevated3D =
                    st === 'RAW_LOADED_AHEAD' ||
                    st === 'ACTIVE_FIRING' ||
                    st === 'FIRED_COOLING' ||
                    isPartialLoadLine;
                  const elevY =
                    st === 'ACTIVE_FIRING'
                      ? -6
                      : st === 'RAW_LOADED_AHEAD' || st === 'FIRED_COOLING'
                      ? -5
                      : isPartialLoadLine
                      ? -3
                      : 0;

                  const statusTitleBn =
                    st === 'RAW_LOADED_AHEAD'
                      ? `✅ লোড সাকসেসফুল / লোড হয়ে গেছে (৪,০০০ ইট · ${lineStatus.loadRoundLabelBn})`
                      : st === 'UNLOADED'
                      ? `📦 আনলোড সম্পন্ন → খালি ঘর (ইট বের করা হয়েছে — পরবর্তী রাউন্ডের লোডের জন্য খালি ঘর)`
                      : st === 'ACTIVE_FIRING'
                      ? `🔥 বর্তমানে পোড়াচ্ছে (৪,০০০ ইট · ${lineStatus.fireRoundLabelBn})`
                      : st === 'FIRED_COOLING'
                      ? 'পোড়ানো শেষ — ঠান্ডা হচ্ছে (৪,০০০ ইট)'
                      : isPartialLoadLine
                      ? `⏳ আংশিক ভ্যান লোড: ${lineStatus.partialBricksInNextLine}/৪,০০০ ইট`
                      : 'খালি ঘর / খালি লাইন (৪,০০০ ইট ধারণক্ষমতা)';

                  const isRecentlyCleared = recentlyClearedSet.has(lineNo);
                  const isClearedLine = st === 'UNLOADED' || allClearedSet.has(lineNo) || isRecentlyCleared;

                  return (
                    <g
                      key={lineNo}
                      data-testid={`svg-kiln-line-${lineNo}`}
                      data-line-state={st}
                      data-cleared-highlight={isClearedLine ? 'true' : 'false'}
                      data-recently-cleared={isRecentlyCleared ? 'true' : 'false'}
                      onClick={() => openLineActionPopup(lineNo)}
                      className="cursor-pointer group"
                    >
                      <title>{`লাইন #${lineNo} — ${statusTitleBn} · ক্লিক করে আগুন দেওয়া / আগুন শেষ / লোড নির্ধারণ করুন · ${getSectorNameForLine(
                        lineNo
                      )}${
                        isStartLine ? ' · 🔥 এখান থেকে আগুন ও লোড শুরু (START)' : ''
                      }${hasDamper ? ` · 🚧 ${damperAlert?.titleBn || 'ডাম্পার আছে'}` : ''}`}</title>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="transparent"
                        strokeWidth={12}
                        strokeLinecap="round"
                      />
                      {/* Physical Glowing Highlight Halo for Cleared/Unloaded Lines on the 208-Line Map */}
                      {isClearedLine && mapOverlayMode === 'PRODUCTION_STATUS' && (
                        <line
                          data-testid={`svg-cleared-highlight-${lineNo}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={isRecentlyCleared ? '#34d399' : '#10b981'}
                          strokeOpacity={isRecentlyCleared ? 0.65 : 0.4}
                          strokeWidth={isRecentlyCleared ? 11 : 8.5}
                          strokeLinecap="round"
                          filter="url(#clearedLineHighlightGlow)"
                        />
                      )}
                      {/* Recessed Empty Chamber Trench Slot when UNLOADED (আনলোড করলে খালি ঘর হিসেবে রূপান্তরিত) */}
                      {st === 'UNLOADED' && mapOverlayMode === 'PRODUCTION_STATUS' && (
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#090d16"
                          strokeWidth={6.8}
                          strokeLinecap="round"
                        />
                      )}
                      {/* 3D Side-Wall Depth Layer for stacked bricks (only when bricks are physically in the chamber) */}
                      {isElevated3D && (
                        <line
                          x1={x1 + 1.5}
                          y1={y1 + 2}
                          x2={x2 + 1.5}
                          y2={y2 + 2}
                          stroke={sideWall3dColor}
                          strokeWidth={st === 'ACTIVE_FIRING' ? 7 : 5.8}
                          strokeLinecap="round"
                        />
                      )}
                      {/* Top Face of Brick Line (or Highlighted Empty Slot Outline when UNLOADED) */}
                      <line
                        x1={x1}
                        y1={y1 + elevY}
                        x2={x2}
                        y2={y2 + elevY}
                        stroke={
                          isSelected
                            ? '#ffffff'
                            : isRecentlyCleared && mapOverlayMode === 'PRODUCTION_STATUS'
                            ? '#6ee7b7'
                            : isStartLine && mapOverlayMode === 'PRODUCTION_STATUS'
                            ? '#fbbf24'
                            : st === 'UNLOADED' && mapOverlayMode === 'PRODUCTION_STATUS'
                            ? '#34d399'
                            : activeStrokeColor
                        }
                        strokeWidth={
                          mapOverlayMode === 'DAMPER_ALERTS'
                            ? hasDamper || isRecommendedNextDamper
                              ? 7
                              : 3
                            : isSelected || isStartLine
                            ? 7
                            : isRecentlyCleared
                            ? 5.6
                            : st === 'ACTIVE_FIRING'
                            ? 6.4
                            : st === 'RAW_LOADED_AHEAD'
                            ? 5.2
                            : st === 'UNLOADED'
                            ? 4.6
                            : isPartialLoadLine
                            ? 5.2
                            : 3.6
                        }
                        strokeDasharray={
                          st === 'UNLOADED' && mapOverlayMode === 'PRODUCTION_STATUS'
                            ? '3 3'
                            : isPartialLoadLine || isRecommendedNextDamper
                            ? '5 3'
                            : undefined
                        }
                        strokeLinecap="round"
                      />
                      {hasDamper && (
                        <line
                          x1={(x1 + x2) / 2 - (y2 - y1) * 0.08}
                          y1={(y1 + y2) / 2 + (x2 - x1) * 0.08 + elevY}
                          x2={x2}
                          y2={y2 + elevY}
                          stroke={
                            damperAlert?.severity === 'OVERDUE_OPEN'
                              ? '#ef4444'
                              : damperAlert?.severity === 'MISSING_GAP_RISK'
                              ? '#f97316'
                              : '#facc15'
                          }
                          strokeWidth={mapOverlayMode === 'DAMPER_ALERTS' ? '5' : '3.5'}
                          strokeLinecap="round"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Fire Start Line Badge right at the start line on the track */}
                <g>
                  <rect
                    x={startBadgePt.x - 46}
                    y={startBadgePt.y - 11}
                    width="92"
                    height="22"
                    rx="11"
                    fill="#ea580c"
                    stroke="#fef08a"
                    strokeWidth="1.8"
                  />
                  <text
                    x={startBadgePt.x}
                    y={startBadgePt.y + 3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="900"
                  >
                    🔥 শুরু #{formatBn(lineStatus.fireStartLineNo)} →
                  </text>
                </g>

                {/* FLOATING 3D STATUS CALLOUT PILLS AT THE BOTTOM OF THE 3D KILN MODEL */}
                <g data-testid="svg-live-status-callouts">
                  {/* Callout 1: Unloaded Status (খালি ঘর রূপান্তর) */}
                  <rect
                    x="45"
                    y="354"
                    width="275"
                    height="26"
                    rx="13"
                    fill="#0f172a"
                    stroke="#34d399"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <text
                    x="182"
                    y="371"
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontSize="10.5"
                    fontWeight="900"
                  >
                    📦 আনলোড (খালি ঘর): {formatBn(lineStatus.unloadedLinesBehind)} লাইন ({lineStatus.unloadRoundLabelBn})
                  </text>

                  {/* Callout 2: Active Firing Status */}
                  <rect
                    x="335"
                    y="354"
                    width="270"
                    height="26"
                    rx="13"
                    fill="#7f1d1d"
                    stroke="#f87171"
                    strokeWidth="1.5"
                  />
                  <text
                    x="470"
                    y="371"
                    textAnchor="middle"
                    fill="#fef2f2"
                    fontSize="10.5"
                    fontWeight="900"
                  >
                    🔥 আগুন চলছে: লাইন #{formatBn(lineStatus.activeFiringStartLine)}–#{formatBn(lineStatus.activeFiringEndLine)} ({formatBn(lineStatus.activeFiringLinesCount)} লাইন)
                  </text>

                  {/* Callout 3: Van Load Successful / লোড হয়ে গেছে Status */}
                  <rect
                    x="620"
                    y="354"
                    width="295"
                    height="26"
                    rx="13"
                    fill="#0c4a6e"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                  />
                  <text
                    x="767"
                    y="371"
                    textAnchor="middle"
                    fill="#e0f2fe"
                    fontSize="10.5"
                    fontWeight="900"
                  >
                    ✅ লোড হয়ে গেছে / সাকসেসফুল: {formatBn(lineStatus.rawLinesLoadedAhead)} লাইন ({formatBn(lineStatus.rawBricksLoadedAhead)} ইট)
                  </text>
                </g>
              </svg>

              {/* Helper prompt banner below 3D/2D SVG */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-slate-700/80 text-xs text-slate-200">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  👆 নকশার যেকোনো লাইনে ক্লিক করুন অথবা নিচে <strong className="text-amber-300">পার্ট ৪ (১-ক্লিক স্ট্যাটাস)</strong> ও <strong className="text-sky-300">পার্ট ৫ (ধারাবাহিক অ্যাকশন)</strong> থেকে আলাদাভাবে নিয়ন্ত্রণ করুন:
                </span>
                <button
                  type="button"
                  data-testid="open-selected-line-popup-btn"
                  onClick={() => setIsLinePopupOpen((prev) => !prev)}
                  className="px-3.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  {isLinePopupOpen
                    ? `🎯 লাইন #${formatBn(selectedLineNo)} কন্ট্রোল চালু`
                    : `🎯 লাইন #${formatBn(selectedLineNo)} কন্ট্রোল খুলুন`}
                </button>
              </div>

              {/* SEPARATED PART 4 & PART 5 COMMAND SYSTEM (Clean, Uncluttered, Part-by-Part Layout) */}
              <div
                data-testid="kiln-line-action-popup"
                className="mt-3 space-y-4 text-white"
              >
                {/* পার্ট ৪: নির্বাচিত লাইনের ১-ক্লিক স্ট্যাটাস বাটন (Single Line Status Control) */}
                <div
                  data-testid="chulli-part-4-single-line-status"
                  className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-xl p-4 space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black">
                        পার্ট ৪ · ১-ক্লিক লাইন স্ট্যাটাস বাটন
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800 border border-amber-400/50 text-amber-300 text-xs sm:text-sm font-black font-mono">
                        🎯 লাইন #{formatBn(selectedLineNo)} (৪,০০০ ইট)
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${selectedLineMeta.badgeClass}`}
                      >
                        {selectedLineMeta.labelBn}
                      </span>
                      {selectedLineNo === lineStatus.fireStartLineNo && (
                        <span className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-xs font-extrabold">
                          🚩 শুরুর লাইন (START)
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300">
                        📍 {getSectorNameForLine(selectedLineNo)}
                      </span>
                    </div>

                    {/* Line Stepper Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLineNo(wrapKilnLineNo(selectedLineNo - 5, 208))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-black border border-slate-600 cursor-pointer active:scale-95 transition-all"
                      >
                        ⏮ -৫
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLineNo(wrapKilnLineNo(selectedLineNo - 1, 208))
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold border border-slate-600 cursor-pointer active:scale-95 transition-all"
                      >
                        ← আগের (#{formatBn(wrapKilnLineNo(selectedLineNo - 1, 208))})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLineNo(wrapKilnLineNo(selectedLineNo + 1, 208))
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold border border-slate-600 cursor-pointer active:scale-95 transition-all"
                      >
                        পরের (#{formatBn(wrapKilnLineNo(selectedLineNo + 1, 208))}) →
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLineNo(wrapKilnLineNo(selectedLineNo + 5, 208))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-black border border-slate-600 cursor-pointer active:scale-95 transition-all"
                      >
                        +৫ ⏭
                      </button>
                      {isLinePopupOpen && (
                        <button
                          type="button"
                          data-testid="close-line-popup-btn"
                          onClick={() => setIsLinePopupOpen(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-extrabold border border-slate-700 cursor-pointer active:scale-95 transition-all"
                        >
                          সংক্ষিপ্ত করুন
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 5 Spacious 1-Click Line Status Buttons in a Clean Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    <button
                      type="button"
                      data-testid="popup-btn-fire-active"
                      onClick={() =>
                        handleSetSingleLineZoneFromPopup(
                          selectedLineNo,
                          'ACTIVE_FIRING',
                          '🔥 আগুন দেওয়া (বর্তমানে পোড়াচ্ছে)'
                        )
                      }
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer active:scale-95 transition-all shadow-md ${
                        getLineState(selectedLineNo) === 'ACTIVE_FIRING'
                          ? 'bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 text-white ring-2 ring-yellow-300'
                          : 'bg-rose-950/90 hover:bg-rose-900 text-rose-100 border border-rose-500/70'
                      }`}
                    >
                      <span>🔥 ১. আগুন দেওয়া</span>
                      {getLineState(selectedLineNo) === 'ACTIVE_FIRING' && (
                        <span className="px-2 py-0.5 rounded-md bg-yellow-300 text-slate-950 text-[10px] font-black">
                          চালু
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="popup-btn-fire-done"
                      onClick={() =>
                        handleSetSingleLineZoneFromPopup(
                          selectedLineNo,
                          'FIRED_COOLING',
                          '✅ আগুন শেষ (পোড়ানো শেষ)'
                        )
                      }
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer active:scale-95 transition-all shadow-md ${
                        getLineState(selectedLineNo) === 'FIRED_COOLING'
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 ring-2 ring-yellow-300'
                          : 'bg-teal-950/90 hover:bg-teal-900 text-teal-100 border border-teal-500/70'
                      }`}
                    >
                      <span>✅ ২. আগুন শেষ</span>
                      {getLineState(selectedLineNo) === 'FIRED_COOLING' && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[10px] font-black">
                          চালু
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="popup-btn-van-load"
                      onClick={() =>
                        handleSetSingleLineZoneFromPopup(
                          selectedLineNo,
                          'RAW_LOADED_AHEAD',
                          '✅ লোড সাকসেসফুল / লোড হয়ে গেছে (৪,০০০ কাঁচা ইট)'
                        )
                      }
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer active:scale-95 transition-all shadow-md ${
                        getLineState(selectedLineNo) === 'RAW_LOADED_AHEAD'
                          ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 ring-2 ring-yellow-300'
                          : 'bg-sky-950/90 hover:bg-sky-900 text-sky-100 border border-sky-400/70'
                      }`}
                    >
                      <span>🚜 ৩. ভ্যান লোড</span>
                      {getLineState(selectedLineNo) === 'RAW_LOADED_AHEAD' && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[10px] font-black">
                          লোড সম্পন্ন
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="popup-btn-unloaded"
                      onClick={() =>
                        handleSetSingleLineZoneFromPopup(
                          selectedLineNo,
                          'UNLOADED',
                          '📦 আনলোড সম্পন্ন → খালি ঘর (পরবর্তী রাউন্ডের লোডের জন্য প্রস্তুত)'
                        )
                      }
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer active:scale-95 transition-all shadow-md ${
                        getLineState(selectedLineNo) === 'UNLOADED'
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 ring-2 ring-yellow-300'
                          : 'bg-slate-900 hover:bg-emerald-950 text-emerald-300 border border-dashed border-emerald-400/80'
                      }`}
                    >
                      <span>📦 ৪. আনলোড (খালি)</span>
                      {getLineState(selectedLineNo) === 'UNLOADED' && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[10px] font-black">
                          খালি ঘর
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="popup-btn-empty"
                      onClick={() =>
                        handleSetSingleLineZoneFromPopup(
                          selectedLineNo,
                          'EMPTY',
                          '⬜ খালি লাইন (রিসেট)'
                        )
                      }
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between gap-2 cursor-pointer active:scale-95 transition-all shadow-md ${
                        getLineState(selectedLineNo) === 'EMPTY'
                          ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white ring-2 ring-yellow-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                      }`}
                    >
                      <span>⬜ ৫. খালি লাইন</span>
                      {getLineState(selectedLineNo) === 'EMPTY' && (
                        <span className="px-2 py-0.5 rounded-md bg-yellow-300 text-slate-950 text-[10px] font-black">
                          খালি
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* পার্ট ৫: ধারাবাহিক অ্যাকশন বাটন ও ১-ক্লিক স্টার্ট লাইন নির্ধারণ (Completely Separate Card) */}
                <div
                  data-testid="chulli-part-5-sequential-actions"
                  className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-sky-400/70 shadow-xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-400 text-slate-950 text-xs font-black">
                        পার্ট ৫ · ধারাবাহিক অ্যাকশন ও শুরুর লাইন বাটন
                      </span>
                      <span className="text-xs font-bold text-slate-300">
                        লাইন #{formatBn(lineStatus.fireStartLineNo)} থেকে নির্বাচিত লাইন #{formatBn(selectedLineNo)} পর্যন্ত এক ক্লিকে ধারাবাহিক নিয়ন্ত্রণ:
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      data-testid="popup-btn-set-start-line"
                      onClick={() =>
                        handleUpdateLineSystem(
                          {
                            fireStartLineNo: selectedLineNo,
                            startDirectionBn: `লাইন #${formatBn(selectedLineNo)} থেকে আগুন, লোড ও আনলোড শুরু`,
                            activeFiringLinesCount: Math.max(
                              1,
                              currentLineSystem.activeFiringLinesCount
                            ),
                            lineOverrides: {},
                          },
                          `🚩 লাইন #${formatBn(selectedLineNo)} থেকে আগুন ও লোড শুরু নির্ধারণ করা হয়েছে (ভ্যান লোড ও আনলোড এখন এই লাইন থেকেই অটো অ্যাডজাস্ট হবে)!`
                        )
                      }
                      className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 text-xs font-black cursor-pointer shadow-sm active:scale-95 transition-all text-left flex flex-col justify-between gap-1"
                    >
                      <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-80">
                        ১-ক্লিক স্টার্ট বাটন
                      </span>
                      <span>🚩 লাইন #{formatBn(selectedLineNo)} থেকে শুরু ধরুন</span>
                    </button>

                    <button
                      type="button"
                      data-testid="popup-btn-advance-range-fire"
                      onClick={() => handleAdvanceFireRangeToLineFromPopup(selectedLineNo)}
                      className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-extrabold cursor-pointer shadow-sm active:scale-95 transition-all text-left flex flex-col justify-between gap-1"
                    >
                      <span className="text-[10px] text-amber-200 uppercase tracking-wider font-extrabold">
                        ধারাবাহিক ফায়ারিং
                      </span>
                      <span>
                        🔥 এই লাইনে আগুন এগিয়ে আনুন (#{formatBn(lineStatus.fireStartLineNo)}→#{formatBn(selectedLineNo)})
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="popup-btn-complete-range-fired"
                      onClick={() => handleCompleteFiredRangeThroughLineFromPopup(selectedLineNo)}
                      className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-sm active:scale-95 transition-all text-left flex flex-col justify-between gap-1"
                    >
                      <span className="text-[10px] text-emerald-100 uppercase tracking-wider font-extrabold">
                        ধারাবাহিক পোড়ানো শেষ
                      </span>
                      <span>✅ লাইন #{formatBn(selectedLineNo)} পর্যন্ত সব আগুন শেষ</span>
                    </button>

                    {selectedLineDamper ? (
                      <button
                        type="button"
                        data-testid="popup-btn-toggle-damper"
                        onClick={() => handleDeleteDamper(selectedLineDamper.id)}
                        className="px-3.5 py-2.5 rounded-xl bg-rose-900/90 hover:bg-rose-700 text-amber-200 border border-amber-400/70 text-xs font-extrabold cursor-pointer active:scale-95 transition-all text-left flex flex-col justify-between gap-1"
                      >
                        <span className="text-[10px] text-rose-200 uppercase tracking-wider font-extrabold">
                          ডাম্পার কন্ট্রোল
                        </span>
                        <span>🚧 ডাম্পার সরান ({formatBn(selectedLineDamper.linesInBlock)} লাইন ব্লক)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid="popup-btn-toggle-damper"
                        onClick={() => {
                          const startLine = currentLineSystem.fireStartLineNo || 1;
                          const posIndex =
                            getLineOffsetFromStart(selectedLineNo, startLine, 208) + 1;
                          const nextDampers = [
                            ...currentLineSystem.dampers.filter(
                              (d) => d.afterLineNo !== selectedLineNo
                            ),
                            {
                              id: `dmp-${Date.now()}`,
                              afterLineNo: selectedLineNo,
                              linesInBlock: 5,
                              hasProtectiveGap: true,
                              status:
                                posIndex <= currentLineSystem.firedLinesCompleted
                                  ? ('OPENED_PASSED' as const)
                                  : ('ACTIVE_CLOSED' as const),
                              sardarName:
                                currentLineSystem.loadSardarName || 'সেলিম সর্দার',
                              note: `লাইন #${formatBn(selectedLineNo)}-এর পর গ্যাপসহ ডাম্পার`,
                            },
                          ];
                          handleUpdateLineSystem(
                            { dampers: nextDampers },
                            `🚧 লাইন #${formatBn(selectedLineNo)}-এর পর নতুন ডাম্পার ও গ্যাপ বসানো হয়েছে!`
                          );
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/70 text-xs font-extrabold cursor-pointer active:scale-95 transition-all text-left flex flex-col justify-between gap-1"
                      >
                        <span className="text-[10px] text-slate-300 uppercase tracking-wider font-extrabold">
                          ডাম্পার ও গ্যাপ
                        </span>
                        <span>🚧 এই লাইনে (+গ্যাপসহ) ডাম্পার বসান</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // SECTION 2: BRICK WASTAGE & RAIN DAMAGE REGISTER (সিজন শেষে মিল বানানো বনাম পোড়ানো ও লাস্ট সিজন হিসাব)
  // ============================================================================
  if (activeSection === 'wastage_register') {
    const seasonWastageCfg: SeasonWastageReconciliationConfig = {
      ...createDefaultSeasonWastageConfig(),
      ...(enterpriseState.seasonWastageConfig || {}),
    };

    const recon = computeSeasonWastageReconciliation({
      config: seasonWastageCfg,
      liveMillRawCut: totalRawBricksCut,
      liveChulliFiredOrLoaded: totalBricksFiredInChulli,
      liveBricksSoldAllGrades: totalBricksSoldAllGrades,
      manualWastageRecords: enterpriseState.wastageRecords,
    });

    const handlePatchSeasonWastageCfg = (
      patch: Partial<SeasonWastageReconciliationConfig>,
      toastMsg?: string
    ) => {
      onUpdateEnterpriseState({
        ...enterpriseState,
        seasonWastageConfig: {
          ...seasonWastageCfg,
          ...patch,
        },
      });
      if (toastMsg) {
        onShowToast(toastMsg, 'success');
      }
    };

    return (
      <div className="space-y-6" data-testid="section-wastage-register">
        {/* 1. Executive Dark Header explaining Last Season & Season-End Mill vs Fired Logic */}
        <Card variant="dark" topAccent="rose" padding="lg" className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">
                    কাঁচা ইট বৃষ্টির ক্ষতি ও চুল্লি অপচয় খাতা
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border ${
                      recon.isSeasonEnded
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {recon.isSeasonEnded
                      ? '✅ সিজন শেষ — চূড়ান্ত নষ্ট ইটের হিসাব'
                      : '⏳ সিজন চলমান — লাস্ট সিজন ও সিজন-শেষের হিসাব'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  এটা নির্ভর করবে লাস্ট সিজনের ওপর — সিজন চলাকালীন এখন নষ্ট ইটের সংখ্যা বের করা সম্ভব নয়। সিজনে <strong className="text-amber-300">মিল সর্দারেরা মোট কতটা ইট বানালো</strong> এবং <strong className="text-emerald-300">আমরা চুল্লিতে কতটা ইট পোড়ালাম</strong>, সিজন শেষে যখন তারা বানানো শেষ করবে তখন এর মাঝে কতটা ইট নষ্ট হলো তা স্বয়ংক্রিয়ভাবে বোঝা যাবে।
                </p>
              </div>
            </div>

            {/* Season Mode Toggle: Running Season vs Season Ended */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700 shrink-0">
              <button
                type="button"
                data-testid="wastage-mode-running-btn"
                onClick={() =>
                  handlePatchSeasonWastageCfg(
                    { seasonStatus: 'RUNNING_SEASON' },
                    '⏳ সিজন চলমান মোড চালু হয়েছে — লাস্ট সিজনের রেফারেন্স অনুযায়ী সেট করা হয়েছে।'
                  )
                }
                className={`px-3 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                  !recon.isSeasonEnded
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ⏳ সিজন চলমান (এখন বের করা সম্ভব নয়)
              </button>
              <button
                type="button"
                data-testid="wastage-mode-season-end-btn"
                onClick={() =>
                  handlePatchSeasonWastageCfg(
                    { seasonStatus: 'SEASON_ENDED' },
                    '✅ সিজন শেষের চূড়ান্ত মিল বানানো বনাম পোড়ানো হিসাব চালু হয়েছে!'
                  )
                }
                className={`px-3 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                  recon.isSeasonEnded
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ✅ সিজন শেষ (বানানো শেষে চূড়ান্ত হিসাব)
              </button>
            </div>
          </div>

          {/* 4 Top Summary KPI Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-amber-500">
              <span className="text-slate-400 font-bold block">
                ১. মিল সর্দারদের মোট বানানো ইট
              </span>
              <strong
                data-testid="wastage-mill-raw-made"
                className="text-lg font-black text-amber-300 tabular-nums mt-0.5 block"
              >
                {formatBn(recon.currentSeason.millRawMade)} পিস
              </strong>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                লাস্ট সিজনে বানিয়েছিল: {formatBn(recon.lastSeason.millRawMade)} পিস
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-emerald-500">
              <span className="text-slate-400 font-bold block">
                ২. আমরা চুল্লিতে মোট পোড়ালাম
              </span>
              <strong
                data-testid="wastage-chulli-fired"
                className="text-lg font-black text-emerald-400 tabular-nums mt-0.5 block"
              >
                {formatBn(recon.currentSeason.bricksFired)} পিস
              </strong>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                লাস্ট সিজনে পুড়েছিল: {formatBn(recon.lastSeason.bricksFired)} পিস
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-rose-500">
              <span className="text-slate-400 font-bold block">
                ৩. এর মাঝে নষ্ট ইট (বানানো − পোড়ানো)
              </span>
              {recon.isSeasonEnded ? (
                <>
                  <strong
                    data-testid="wastage-net-lost"
                    className="text-lg font-black text-rose-400 tabular-nums mt-0.5 block"
                  >
                    {formatBn(recon.currentSeason.rawGapOrLostBricks)} পিস ({formatBn(recon.currentSeason.rawGapOrLostPct)}%)
                  </strong>
                  <span className="text-[11px] text-rose-300 font-semibold block mt-0.5">
                    সিজন শেষে চূড়ান্ত নষ্ট · ক্ষতি: {formatCurrencyBn(recon.currentSeason.estimatedLossTk)}
                  </span>
                </>
              ) : (
                <>
                  <strong
                    data-testid="wastage-net-lost"
                    className="text-base font-black text-amber-300 tabular-nums mt-0.5 block"
                  >
                    সিজন শেষে নির্ধারিত হবে
                  </strong>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    চলমান পার্থক্য: {formatBn(recon.currentSeason.rawGapOrLostBricks)} পিস (মাঠে শুকাচ্ছে / পোড়ানোর অপেক্ষায়)
                  </span>
                </>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 border-t-2 border-t-cyan-500">
              <span className="text-slate-400 font-bold block">
                ৪. লাস্ট সিজনের রেফারেন্স অপচয় হার
              </span>
              <strong
                data-testid="wastage-last-season-pct"
                className="text-lg font-black text-cyan-300 tabular-nums mt-0.5 block"
              >
                {formatBn(recon.lastSeason.rawWastagePct)}% ({formatBn(recon.lastSeason.rawLostInFieldOrRain)} পিস)
              </strong>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {recon.lastSeason.labelBn} · আনুমানিক {formatCurrencyBn(recon.lastSeason.estimatedLossTk)}
              </span>
            </div>
          </div>
        </Card>

        {/* 2. Side-by-Side: Current Season End-of-Season Calculator vs Last Season Benchmark */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Columns: Current Season Mill Made vs Fired Reconciliation */}
          <Card
            variant="default"
            topAccent="emerald"
            padding="lg"
            className="lg:col-span-7 space-y-4"
            data-testid="season-end-wastage-reconciliation-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-extrabold mb-1">
                  সিজন শেষে স্বয়ংক্রিয় মিলকরণ (Mill Made vs Chulli Fired)
                </span>
                <h3 className="text-base font-extrabold text-slate-950">
                  মিল সর্দারেরা কতটা ইট বানালো বনাম আমরা কতটা ইট পোড়ালাম — মাঝের নষ্ট ইটের হিসাব
                </h3>
              </div>
            </div>

            {/* Explanation Notice Banner */}
            <div
              className={`p-3.5 rounded-xl border-2 text-xs space-y-1 ${
                recon.isSeasonEnded
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-400 text-slate-900'
              }`}
            >
              <div className="font-black text-sm">
                {recon.isSeasonEnded
                  ? '✅ সিজন সমাপ্ত মোড: মিল সর্দারদের বানানো ইট থেকে পোড়ানো ইট বাদ দিয়ে চূড়ান্ত নষ্ট ইট হিসাব করা হয়েছে'
                  : 'ℹ️ সিজন চলাকালীন এখন নষ্ট ইট বের করা সম্ভব নয় — সিজন শেষে যখন মিল সর্দারেরা বানানো শেষ করবে তখন বোঝা যাবে'}
              </div>
              <p className="font-medium leading-relaxed">
                মিল খাতায় সর্দারদের পট এন্ট্রি এবং চুল্লি লোড/পোড়াই খাতার এন্ট্রি থেকে নিচের সংখ্যাগুলো অটোমেটিক এসেছে। সিজন শেষে চূড়ান্ত সংখ্যা বসিয়ে বা অটো-হিসাব থেকে সরাসরি নষ্ট ইটের সংখ্যা দেখে নিন।
              </p>
            </div>

            {/* Per-Mill Breakdown if available */}
            {millBreakdown.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {millBreakdown.map((mb, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <span className="font-bold text-slate-700">{mb.millNameBn}:</span>
                    <strong className="font-black text-slate-950 tabular-nums">
                      {formatBn(mb.rawBricksCut)} পিস
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {/* Step-by-Step Formula Visual */}
            <div className="bg-slate-950 text-white rounded-2xl p-4 space-y-3 border border-slate-800 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40">
                  <span className="text-amber-300 font-bold block">
                    ১. মিল সর্দারেরা মোট বানালো
                  </span>
                  <strong className="text-lg font-black text-white tabular-nums mt-0.5 block">
                    {formatBn(recon.currentSeason.millRawMade)} পিস
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    {seasonWastageCfg.customCurrentMillRawOverride > 0
                      ? 'সিজন শেষের কাস্টম সংখ্যা'
                      : `অটো মিল খাতা থেকে (${formatBn(totalRawBricksCut)} পিস)`}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/40">
                  <span className="text-emerald-300 font-bold block">
                    ২. আমরা মোট ইট পোড়ালাম
                  </span>
                  <strong className="text-lg font-black text-emerald-400 tabular-nums mt-0.5 block">
                    − {formatBn(recon.currentSeason.bricksFired)} পিস
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    {seasonWastageCfg.customCurrentFiredOverride > 0
                      ? 'সিজন শেষের কাস্টম সংখ্যা'
                      : `অটো চুল্লি খাতা থেকে (${formatBn(totalBricksFiredInChulli)} পিস)`}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-950/70 border-2 border-rose-500">
                  <span className="text-rose-200 font-bold block">
                    = ৩. এর মাঝে নষ্ট হলো
                  </span>
                  <strong className="text-lg font-black text-rose-300 tabular-nums mt-0.5 block">
                    {formatBn(recon.currentSeason.rawGapOrLostBricks)} পিস ({formatBn(recon.currentSeason.rawGapOrLostPct)}%)
                  </strong>
                  <span className="text-[11px] text-rose-200">
                    {recon.isSeasonEnded
                      ? `চূড়ান্ত ক্ষতি: ${formatCurrencyBn(recon.currentSeason.estimatedLossTk)}`
                      : 'সিজন শেষে বানানো থামলে এটিই চূড়ান্ত নষ্ট'}
                  </span>
                </div>
              </div>
            </div>

            {/* Season-End Override / Simulation Inputs */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">
                  সিজন শেষে মোট বানানো ও পোড়ানো ইটের সংখ্যা বসিয়ে হিসাব মেলান (ঐচ্ছিক):
                </span>
                {(seasonWastageCfg.customCurrentMillRawOverride > 0 ||
                  seasonWastageCfg.customCurrentFiredOverride > 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      handlePatchSeasonWastageCfg(
                        {
                          customCurrentMillRawOverride: 0,
                          customCurrentFiredOverride: 0,
                        },
                        'অটো মিল ও চুল্লি খাতার সংখ্যার সাথে পুনরায় যুক্ত করা হয়েছে।'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer"
                  >
                    অটো-হিসাবে ফিরুন
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    সিজনে মিল সর্দারদের মোট বানানো ইট (পিস)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder={String(totalRawBricksCut || 2500000)}
                    value={
                      seasonWastageCfg.customCurrentMillRawOverride > 0
                        ? seasonWastageCfg.customCurrentMillRawOverride
                        : ''
                    }
                    onChange={(e) =>
                      handlePatchSeasonWastageCfg({
                        customCurrentMillRawOverride: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-extrabold bg-white text-slate-950 border border-slate-300 rounded-xl tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    সিজনে আমাদের মোট পোড়ানো ইট (পিস)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder={String(totalBricksFiredInChulli || 2380000)}
                    value={
                      seasonWastageCfg.customCurrentFiredOverride > 0
                        ? seasonWastageCfg.customCurrentFiredOverride
                        : ''
                    }
                    onChange={(e) =>
                      handlePatchSeasonWastageCfg({
                        customCurrentFiredOverride: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-extrabold bg-white text-slate-950 border border-slate-300 rounded-xl tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    কাঁচা ইট হাজার প্রতি গড় রেট (৳)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={seasonWastageCfg.rawBrickRatePerThousand}
                    onChange={(e) =>
                      handlePatchSeasonWastageCfg({
                        rawBrickRatePerThousand: Math.max(100, Number(e.target.value) || 1200),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-extrabold bg-white text-slate-950 border border-slate-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Right 5 Columns: Last Season Final Benchmark Card (এটা নির্ভর করবে লাস্ট সিজনের ওপর) */}
          <Card
            variant="default"
            topAccent="orange"
            padding="lg"
            className="lg:col-span-5 space-y-4"
            data-testid="last-season-wastage-reference-card"
          >
            <div className="border-b border-slate-200 pb-3">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-extrabold mb-1">
                লাস্ট সিজনের রেফারেন্স হিসাব (Last Season Benchmark)
              </span>
              <h3 className="text-base font-extrabold text-slate-950">
                গত সিজনে কত ইট বানানো ও পোড়ানো হয়েছিল এবং মাঝে কত নষ্ট হয়েছিল
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                চলতি সিজন শেষ না হওয়া পর্যন্ত গত সিজনের এই হিসাবটিই রেফারেন্স হিসেবে কাজ করবে।
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  গত সিজনের নাম / শিক্ষাবর্ষ
                </label>
                <input
                  type="text"
                  value={seasonWastageCfg.lastSeasonLabelBn}
                  onChange={(e) =>
                    handlePatchSeasonWastageCfg({ lastSeasonLabelBn: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-extrabold bg-white text-slate-950 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-amber-900 mb-1">
                    গত সিজনে মিল সর্দারেরা বানিয়েছিল (পিস)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={seasonWastageCfg.lastSeasonMillRawMade}
                    onChange={(e) =>
                      handlePatchSeasonWastageCfg({
                        lastSeasonMillRawMade: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-extrabold bg-amber-50/60 text-slate-950 border border-amber-300 rounded-xl tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-emerald-900 mb-1">
                    গত সিজনে আমরা পুড়িয়েছিলাম (পিস)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={seasonWastageCfg.lastSeasonBricksFired}
                    onChange={(e) =>
                      handlePatchSeasonWastageCfg({
                        lastSeasonBricksFired: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-extrabold bg-emerald-50/60 text-slate-950 border border-emerald-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-2 border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">গত সিজনে মাঝে কাঁচা ইট নষ্ট হয়েছিল:</span>
                  <strong className="text-sm font-black text-rose-400 tabular-nums">
                    {formatBn(recon.lastSeason.rawLostInFieldOrRain)} পিস ({formatBn(recon.lastSeason.rawWastagePct)}%)
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">গত সিজনের আনুমানিক ক্ষতির অংক:</span>
                  <strong className="text-sm font-black text-amber-300 tabular-nums">
                    {formatCurrencyBn(recon.lastSeason.estimatedLossTk)}
                  </strong>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SECTION 3: MONTHLY STAFF & MANAGER SALARY SHEET (মাসিক স্টাফ ও ম্যানেজার বেতন)
  // ============================================================================
  if (activeSection === 'staff_salary') {
    const totalMonthlySalary = enterpriseState.staffSalaries.reduce(
      (s, r) => s + r.monthlySalary,
      0
    );
    const totalAdvanceDeducted = enterpriseState.staffSalaries.reduce(
      (s, r) => s + r.advanceDeducted,
      0
    );
    const totalPaid = enterpriseState.staffSalaries.reduce((s, r) => s + r.paidAmount, 0);
    const totalDue = enterpriseState.staffSalaries.reduce(
      (s, r) =>
        s +
        calculateStaffSalaryPayable(r.monthlySalary, r.advanceDeducted, r.paidAmount).remainingDue,
      0
    );

    return (
      <div className="space-y-6" data-testid="section-staff-salary">
        <Card variant="dark" topAccent="emerald" padding="lg" className="space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                {isEn
                  ? 'Monthly Staff & Manager Salary Register'
                  : 'কর্মচারী ও ম্যানেজার মাসিক বেতন খাতা'}
              </h2>
              <p className="text-xs text-slate-300">
                {isEn
                  ? 'Manage monthly salaries, advance deductions, and payments for managers, munshis, guards, and drivers.'
                  : 'ভাটার স্থায়ী স্টাফ (ম্যানেজার, মুন্সি, ক্যাশিয়ার, নাইট গার্ড, বাবুর্চি ও ড্রাইভার)-দের মাসিক বেতন ও অগ্রিম কর্তন হিসাব।'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block">
                {isEn ? 'Total Monthly Payroll' : 'মোট মাসিক বেতন'}
              </span>
              <strong className="text-lg font-black text-white tabular-nums">
                {formatCurrencyBn(totalMonthlySalary)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block">
                {isEn ? 'Advance Deducted' : 'অগ্রিম কর্তন'}
              </span>
              <strong className="text-lg font-black text-amber-300 tabular-nums">
                {formatCurrencyBn(totalAdvanceDeducted)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block">{isEn ? 'Salary Paid' : 'পরিশোধিত বেতন'}</span>
              <strong className="text-lg font-black text-emerald-400 tabular-nums">
                {formatCurrencyBn(totalPaid)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block">{isEn ? 'Remaining Due' : 'বকেয়া বেতন'}</span>
              <strong className="text-lg font-black text-rose-400 tabular-nums">
                {formatCurrencyBn(totalDue)}
              </strong>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Card
            as="form"
            onSubmit={handleAddStaffSalarySubmit}
            variant="default"
            topAccent="emerald"
            padding="lg"
            className="lg:col-span-5 space-y-3.5"
          >
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2.5">
              {isEn ? 'Add Monthly Staff Salary' : 'নতুন মাসিক স্টাফ বেতন যুক্ত করুন'}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? 'Staff Name *' : 'স্টাফের নাম *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isEn ? 'Md. Rafiqul Islam' : 'মোঃ রফিকুল ইসলাম'}
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? 'Designation' : 'পদবি'}
                  </label>
                  <select
                    value={sDesignation}
                    onChange={(e) =>
                      setSDesignation(e.target.value as MonthlyStaffSalaryRecord['designation'])
                    }
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  >
                    <option value="ম্যানেজার">{isEn ? 'Manager' : 'ম্যানেজার'}</option>
                    <option value="মুন্সি">{isEn ? 'Munshi' : 'মুন্সি'}</option>
                    <option value="ক্যাশিয়ার">{isEn ? 'Cashier' : 'ক্যাশিয়ার'}</option>
                    <option value="নাইট গার্ড">{isEn ? 'Night Guard' : 'নাইট গার্ড'}</option>
                    <option value="বাবুর্চি">{isEn ? 'Cook' : 'বাবুর্চি'}</option>
                    <option value="ড্রাইভার">{isEn ? 'Driver' : 'ড্রাইভার'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? 'Monthly Salary' : 'মাসিক বেতন'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="18000"
                    value={sSalary}
                    onChange={(e) => setSSalary(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-amber-800 mb-1">
                    {isEn ? 'Advance Cut' : 'অগ্রিম কর্তন'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sAdvance}
                    onChange={(e) => setSAdvance(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-amber-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 mb-1">
                    {isEn ? 'Paid Now' : 'নগদ প্রদান'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="18000"
                    value={sPaid}
                    onChange={(e) => setSPaid(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-emerald-400 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                {isEn
                  ? 'Save Staff Salary & Sync Cash Book'
                  : 'বেতন সংরক্ষণ ও ক্যাশ বুকে যুক্ত করুন'}
              </button>
            </div>
          </Card>

          <Card variant="default" topAccent="orange" padding="lg" className="lg:col-span-7 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2.5">
              {isEn ? 'Monthly Staff Salary Sheet' : 'মাসিক স্টাফ বেতন তালিকা'}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                    <th className="py-2.5 px-3">{isEn ? 'Staff & Role' : 'স্টাফ ও পদবি'}</th>
                    <th className="py-2.5 px-3 text-right">{isEn ? 'Salary' : 'মাসিক বেতন'}</th>
                    <th className="py-2.5 px-3 text-right">{isEn ? 'Paid' : 'পরিশোধিত'}</th>
                    <th className="py-2.5 px-3 text-right">{isEn ? 'Due' : 'বকেয়া'}</th>
                    <th className="py-2.5 px-3 text-right">{isEn ? 'Action' : 'অ্যাকশন'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enterpriseState.staffSalaries.map((r) => {
                    const calc = calculateStaffSalaryPayable(
                      r.monthlySalary,
                      r.advanceDeducted,
                      r.paidAmount
                    );
                    const paymentsList = r.payments || [];
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{r.staffName}</div>
                            <div className="text-[11px] text-slate-500">
                              {r.designation} · {r.monthLabel}
                              {r.phone && r.phone !== '—' && ` · 📞 ${r.phone}`}
                            </div>
                            {paymentsList.length > 0 && (
                              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                                📋 {formatBn(paymentsList.length)}টি কিস্তিতে প্রদান করা হয়েছে
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                            {formatCurrencyBn(r.monthlySalary)}
                            {r.advanceDeducted > 0 && (
                              <div className="text-[10px] text-amber-700 font-medium">
                                অগ্রিম কর্তন: −{formatCurrencyBn(r.advanceDeducted)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBn(r.paidAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-700 tabular-nums">
                            {formatCurrencyBn(calc.remainingDue)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {calc.remainingDue > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPartialPayModal(r)}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer shadow-xs transition-colors"
                                  >
                                    + অল্প টাকা / কিস্তি
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePayRemainingSalary(r)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition-colors"
                                  >
                                    {isEn ? 'Full Due' : 'বাকি সব দিন'}
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {isEn ? 'Paid' : 'পরিশোধিত'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Chronological installment payment history per staff */}
                        {paymentsList.length > 0 && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={5} className="py-2 px-3 pl-6">
                              <div className="text-[11px] font-extrabold text-slate-700 mb-1 flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                <span>অল্প অল্প টাকা নেওয়ার খতিয়ান (কিস্তি ইতিহাস):</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {paymentsList.map((p, pIdx) => (
                                  <div
                                    key={p.id || pIdx}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] shadow-2xs flex items-center gap-1.5"
                                  >
                                    <span className="text-slate-500">{p.date}:</span>
                                    <strong className="text-emerald-700 font-bold tabular-nums">
                                      {formatCurrencyBn(p.amount)}
                                    </strong>
                                    {p.note && (
                                      <span className="text-slate-600 italic font-medium">({p.note})</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Partial Installment Payment Modal */}
        {partialPayTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-emerald-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base">
                    অল্প টাকা দিন / কিস্তি পরিশোধ
                  </h3>
                  <p className="text-xs text-amber-100">
                    {partialPayTarget.staffName} ({partialPayTarget.designation})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPartialPayTarget(null)}
                  className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePayStaffInstallmentSubmit} className="p-5 space-y-4 text-xs">
                {/* Financial Summary of the target staff */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-slate-500 block text-[10px]">মাসিক চুক্তি</span>
                    <strong className="text-slate-900 font-black tabular-nums">
                      {formatCurrencyBn(partialPayTarget.monthlySalary)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">ইতিমধ্যে প্রাপ্ত</span>
                    <strong className="text-emerald-700 font-black tabular-nums">
                      {formatCurrencyBn(partialPayTarget.paidAmount)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">সর্বোচ্চ বাকি</span>
                    <strong className="text-rose-700 font-black tabular-nums">
                      {formatCurrencyBn(
                        calculateStaffSalaryPayable(
                          partialPayTarget.monthlySalary,
                          partialPayTarget.advanceDeducted,
                          partialPayTarget.paidAmount
                        ).remainingDue
                      )}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    autoFocus
                    placeholder="যেমন: ২০০০ বা ৫০০০"
                    value={partialPayAmount}
                    onChange={(e) => setPartialPayAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-extrabold bg-white text-slate-950 border-2 border-amber-400 rounded-xl tabular-nums focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    {[1000, 2000, 5000, 10000].map((quickAmt) => (
                      <button
                        key={quickAmt}
                        type="button"
                        onClick={() => setPartialPayAmount(String(quickAmt))}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                      >
                        +{quickAmt}৳
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setPartialPayAmount(
                          String(
                            calculateStaffSalaryPayable(
                              partialPayTarget.monthlySalary,
                              partialPayTarget.advanceDeducted,
                              partialPayTarget.paidAmount
                            ).remainingDue
                          )
                        )
                      }
                      className="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold cursor-pointer"
                    >
                      বাকি সব
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">পরিশোধের তারিখ</label>
                  <input
                    type="date"
                    required
                    value={partialPayDate}
                    onChange={(e) => setPartialPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    বিবরণ / নোট (হাত খরচ বা কারণ)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: বাজার খরচ / হাত খরচ / ১লা কিস্তি"
                    value={partialPayNote}
                    onChange={(e) => setPartialPayNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPartialPayTarget(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-sm"
                  >
                    পরিশোধ নিশ্চিত করুন ও ক্যাশ বুকে যুক্ত করুন
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // SECTION 4: LAND LEASE & CLAY CONTRACT TRACKER (জমি লিজ ও মাটি চুক্তি খাতা)
  // ============================================================================
  const leaseSummary = computeLandLeaseSummary(enterpriseState.landLeases);

  return (
    <div className="space-y-6" data-testid="section-land-lease">
      <Card variant="dark" topAccent="amber" padding="lg" className="space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">
              {isEn
                ? 'Land Lease & Clay Cutting Contract Tracker'
                : 'মাটি চুক্তি ও জমির লিজ খতিয়ান'}
            </h2>
            <p className="text-xs text-slate-300">
              {isEn
                ? 'Track landowner clay contracts, total bighas leased, clay trucks delivered to kiln, and lease payments.'
                : 'জমির মালিকের সাথে মাটি কাটার চুক্তি, জমির পরিমাণ (বিঘা), ভাটায় আসা মাটির গাড়ি এবং লিজের টাকা পরিশোধের হিসাব।'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-400 block">
              {isEn ? 'Total Leased Land' : 'মোট চুক্তিবদ্ধ জমি'}
            </span>
            <strong className="text-lg font-black text-amber-300 tabular-nums">
              {formatBn(leaseSummary.totalAreaBigha)} {isEn ? 'Bigha' : 'বিঘা'}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-400 block">
              {isEn ? 'Clay Trucks Received' : 'ভাটায় আসা মাটির গাড়ি'}
            </span>
            <strong className="text-lg font-black text-emerald-400 tabular-nums">
              {formatBn(leaseSummary.totalDeliveredTrucks)} /{' '}
              {formatBn(leaseSummary.totalContractedTrucks)} {isEn ? 'trucks' : 'গাড়ি'}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-400 block">
              {isEn ? 'Total Contract Paid' : 'পরিশোধিত চুক্তির টাকা'}
            </span>
            <strong className="text-lg font-black text-white tabular-nums">
              {formatCurrencyBn(leaseSummary.totalPaidAmount)}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-400 block">
              {isEn ? 'Landowner Due' : 'জমির মালিকের বকেয়া'}
            </span>
            <strong className="text-lg font-black text-rose-400 tabular-nums">
              {formatCurrencyBn(leaseSummary.totalDueAmount)}
            </strong>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card
          as="form"
          onSubmit={handleAddLandLeaseSubmit}
          variant="default"
          topAccent="amber"
          padding="lg"
          className="lg:col-span-5 space-y-3.5"
        >
          <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2.5">
            {isEn ? 'New Land Lease / Clay Contract' : 'নতুন জমি লিজ ও মাটি চুক্তি এন্ট্রি'}
          </h3>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? 'Landowner Name *' : 'জমির মালিকের নাম *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isEn ? 'Haji Mozammel Haque' : 'হাজী মোজাম্মেল হক'}
                  value={lOwner}
                  onChange={(e) => setLOwner(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? 'Phone Number' : 'মোবাইল নম্বর'}
                </label>
                <input
                  type="text"
                  placeholder="01715-667788"
                  value={lPhone}
                  onChange={(e) => setLPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? 'Mouza / Plot Location' : 'মৌজা বা জমির অবস্থান'}
                </label>
                <input
                  type="text"
                  placeholder={isEn ? 'Babulia South Field' : 'বাবুলিয়া দক্ষিণ বিল'}
                  value={lMouza}
                  onChange={(e) => setLMouza(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? 'Land Area (Bigha)' : 'জমির পরিমাণ (বিঘা)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  placeholder="3.5"
                  value={lBigha}
                  onChange={(e) => setLBigha(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? 'Target Trucks' : 'চুক্তিকৃত মাটির গাড়ি'}
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="250"
                  value={lTrucks}
                  onChange={(e) => setLTrucks(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? 'Total Contract (Tk)' : 'মোট চুক্তির টাকা'}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="150000"
                  value={lTotalAmt}
                  onChange={(e) => setLTotalAmt(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-800 mb-1">
                  {isEn ? 'Advance Paid (Tk)' : 'নগদ পরিশোধ'}
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="80000"
                  value={lPaidAmt}
                  onChange={(e) => setLPaidAmt(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-emerald-400 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
            >
              {isEn ? 'Save Land Lease Contract' : 'জমি লিজ ও মাটি চুক্তি সেভ করুন'}
            </button>
          </div>
        </Card>

        <Card variant="default" topAccent="orange" padding="lg" className="lg:col-span-7 space-y-3.5">
          <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2.5">
            {isEn ? 'Active Land Lease & Clay Contracts' : 'চলমান জমি লিজ ও মাটি চুক্তির তালিকা'}
          </h3>

          <div className="space-y-3">
            {enterpriseState.landLeases.map((lease) => {
              const due = Math.max(0, lease.totalContractAmount - lease.paidAmount);
              const pct =
                lease.contractedTrucks > 0
                  ? Math.min(100, Math.round((lease.deliveredTrucks / lease.contractedTrucks) * 100))
                  : 0;
              return (
                <div
                  key={lease.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {lease.landownerName} ({formatBn(lease.landAreaBigha)}{' '}
                        {isEn ? 'Bigha' : 'বিঘা'})
                      </div>
                      <div className="text-xs text-slate-600">
                        {lease.mouzaOrLocation} · {lease.phone}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-slate-900">
                        {isEn ? 'Contract:' : 'মোট চুক্তি:'}{' '}
                        {formatCurrencyBn(lease.totalContractAmount)}
                      </div>
                      <div className="font-bold text-rose-700">
                        {isEn ? 'Due:' : 'বাকি:'} {formatCurrencyBn(due)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>
                        {isEn ? 'Clay Trucks Received:' : 'মাটির গাড়ি প্রাপ্তি:'}{' '}
                        {formatBn(lease.deliveredTrucks)} / {formatBn(lease.contractedTrucks)}{' '}
                        {isEn ? 'trucks' : 'গাড়ি'} ({formatBn(pct)}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddLandTruckTrip(lease, 5)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <Truck className="w-3 h-3" />
                        <span>{isEn ? '+5 Clay Trucks' : '+৫ গাড়ি মাটি জমা'}</span>
                      </button>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
