import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  Check,
  Copy,
  FilePlus2,
  Flame,
  Layers,
  Palette,
  Route,
  Search,
  Sparkles,
  Truck,
  Users,
  X,
} from 'lucide-react';
import type {
  BrickGrade,
  KilnDatabaseState,
  LanguageMode,
  NavigationTab,
  SalesMemo,
} from '../types/kiln';
import {
  cleanBrickGradeName,
  formatBn,
  formatCurrencyBn,
} from '../utils/kilnLogic';
import {
  KILN_THEMES,
  calculateSmartBrickEstimate,
  calculateTruckFootMeasurement,
  searchKilnWorkspace,
  type ConstructionCalculationMode,
  type KilnThemeId,
  type WallThicknessType,
} from '../utils/themeAndEstimatorLogic';

export type DashboardCleanViewMode = 'ALL' | 'ESSENTIAL' | 'ANALYTICS' | 'SHORTCUTS';

interface ThemePaletteBarProps {
  activeTheme?: KilnThemeId;
  onSelectTheme?: (theme: KilnThemeId) => void;
  onOpenEstimator: () => void;
  onOpenQuickSearch: () => void;
  onOpenCoalEfficiency?: () => void;
  onOpenFridayHatbarSheet?: () => void;
  dashboardViewMode?: DashboardCleanViewMode;
  onChangeDashboardViewMode?: (mode: DashboardCleanViewMode) => void;
  isEn?: boolean;
}

export const ThemeAndSmartToolsBar: React.FC<ThemePaletteBarProps> = ({
  onOpenEstimator,
  onOpenQuickSearch,
  onOpenCoalEfficiency,
  onOpenFridayHatbarSheet,
  dashboardViewMode = 'ESSENTIAL',
  onChangeDashboardViewMode,
  isEn = false,
}) => {
  return (
    <div
      data-testid="theme-and-smart-tools-bar"
      className="bg-gradient-to-r from-slate-950 via-[#0F172A] to-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl p-1 sm:px-3.5 sm:py-2.5 shadow-md flex flex-wrap items-center justify-between gap-1 sm:gap-2 animate-slide-up"
    >
      {/* Left: Dashboard View Mode Switcher (মূল ড্যাশবোর্ড | ইনফরমেশন ও রিপোর্ট ড্যাশবোর্ড | সম্পূর্ণ ভিউ) */}
      {onChangeDashboardViewMode && (
        <div
          data-testid="dashboard-view-mode-switcher"
          className="grid grid-cols-3 sm:inline-flex sm:flex-wrap items-center gap-1 sm:gap-1.5 bg-slate-900/95 p-0.5 sm:p-1.5 rounded-lg sm:rounded-xl border border-slate-700/90 w-full sm:w-auto"
        >
          {(
            [
              {
                id: 'ESSENTIAL' as const,
                bn: '⚡ মূল ড্যাশবোর্ড (শর্টকাট)',
                bnShort: '⚡ মূল ড্যাশবোর্ড',
                en: '⚡ Main Dashboard',
                activeGrad: 'from-amber-400 via-orange-500 to-amber-500 text-slate-950',
              },
              {
                id: 'ANALYTICS' as const,
                bn: '📊 ইনফরমেশন ও রিপোর্ট ড্যাশবোর্ড',
                bnShort: '📊 রিপোর্ট ভিউ',
                en: '📊 Info & Report Dashboard',
                activeGrad: 'from-emerald-400 via-teal-400 to-cyan-400 text-slate-950',
              },
              {
                id: 'ALL' as const,
                bn: '🌐 সম্পূর্ণ ভিউ (সবকিছু)',
                bnShort: '🌐 সম্পূর্ণ ভিউ',
                en: '🌐 Full View (All)',
                activeGrad: 'from-sky-400 via-cyan-400 to-blue-400 text-slate-950',
              },
            ] as const
          ).map((opt) => {
            const isActive = dashboardViewMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`dash-view-mode-${opt.id}`}
                onClick={() => onChangeDashboardViewMode(opt.id)}
                className={`sbl-btn-interactive min-h-[26px] sm:min-h-[38px] px-1 sm:px-3 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black whitespace-nowrap shrink-0 transition-all cursor-pointer text-center truncate ${
                  isActive
                    ? `bg-gradient-to-r ${opt.activeGrad} shadow-sm ring-1 ring-white/40`
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent hover:border-slate-700'
                }`}
              >
                <span className="sm:hidden">{isEn ? opt.en : opt.bnShort}</span>
                <span className="hidden sm:inline">{isEn ? opt.en : opt.bn}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right: 4-Column Compact Single-Row Tools on Mobile + Flex Row on Desktop */}
      <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
        <button
          type="button"
          data-testid="open-quick-workspace-search-btn"
          onClick={onOpenQuickSearch}
          className="sbl-btn-interactive min-h-[26px] sm:min-h-[38px] group inline-flex items-center justify-center sm:justify-between gap-1 px-1 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-[11px] font-black bg-slate-900 hover:bg-slate-800 text-white border border-amber-400/60 hover:border-amber-400 cursor-pointer whitespace-nowrap shrink-0 shadow-xs truncate"
        >
          <span className="inline-flex items-center gap-1 truncate">
            <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="sm:hidden truncate">{isEn ? 'Search' : 'খুঁজুন'}</span>
            <span className="hidden sm:inline">
              {isEn ? 'Quick Search...' : '🔍 দ্রুত খুঁজুন (মেমো/সর্দার)...'}
            </span>
          </span>
          <kbd
            data-skip-lang-norm="true"
            className="hidden lg:inline-block px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono text-[10px] font-black"
          >
            Ctrl+K
          </kbd>
        </button>

        {onOpenFridayHatbarSheet && (
          <button
            type="button"
            data-testid="open-friday-hatbar-sheet-btn"
            onClick={onOpenFridayHatbarSheet}
            className="sbl-btn-interactive min-h-[26px] sm:min-h-[38px] inline-flex items-center justify-center gap-1 px-1 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-[11px] font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 hover:from-amber-200 hover:to-yellow-300 text-slate-950 shadow-xs cursor-pointer whitespace-nowrap shrink-0 truncate"
          >
            <span className="sm:hidden truncate">
              {isEn ? 'Hatbar' : '🖨️ হাটবার'}
            </span>
            <span className="hidden sm:inline">
              {isEn
                ? '🖨️ Friday Hatbar Sheet'
                : '🖨️ শুক্রবারের হাটবার প্রিন্ট শিট'}
            </span>
          </button>
        )}

        {onOpenCoalEfficiency && (
          <button
            type="button"
            data-testid="open-coal-efficiency-btn"
            onClick={onOpenCoalEfficiency}
            className="sbl-btn-interactive min-h-[26px] sm:min-h-[38px] inline-flex items-center justify-center gap-1 px-1 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-[11px] font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xs cursor-pointer whitespace-nowrap shrink-0 truncate"
          >
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-950 shrink-0" />
            <span className="sm:hidden truncate">{isEn ? 'Coal' : 'কয়লা'}</span>
            <span className="hidden sm:inline">
              {isEn ? 'Coal Efficiency' : '🔥 কয়লা দক্ষতা'}
            </span>
          </button>
        )}

        <button
          type="button"
          data-testid="open-smart-brick-estimator-btn"
          onClick={onOpenEstimator}
          className="sbl-btn-interactive min-h-[26px] sm:min-h-[38px] inline-flex items-center justify-center gap-1 px-1 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-[11px] font-black bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 shadow-xs cursor-pointer whitespace-nowrap shrink-0 truncate"
        >
          <Calculator className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-950 shrink-0" />
          <span className="sm:hidden truncate">{isEn ? 'Calc' : 'ইট হিসাব'}</span>
          <span className="hidden sm:inline">
            {isEn ? 'Calculator' : '🧮 ইট ক্যালকুলেটর'}
          </span>
        </button>
      </div>
    </div>
  );
};

interface SmartBrickEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageMode;
  brickGrades: BrickGrade[];
  onConvertToMemo: (payload: {
    customerName: string;
    gradeId: string;
    quantity: number;
    ratePerThousand: number;
    note: string;
  }) => void;
}

export const SmartBrickEstimatorModal: React.FC<SmartBrickEstimatorModalProps> = ({
  isOpen,
  onClose,
  lang,
  brickGrades,
  onConvertToMemo,
}) => {
  const isEn = lang === 'en';
  const defaultGrade = brickGrades[0];

  const [mode, setMode] = useState<ConstructionCalculationMode>('WALL');
  const [customerName, setCustomerName] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState(
    defaultGrade?.id || 'g1'
  );
  const [wallLengthFeet, setWallLengthFeet] = useState('30');
  const [wallHeightFeet, setWallHeightFeet] = useState('10');
  const [wallCount, setWallCount] = useState('2');
  const [wallThickness, setWallThickness] =
    useState<WallThicknessType>('5_INCH');
  const [openingDeductionSqFt, setOpeningDeductionSqFt] = useState('35');
  const [houseAreaSqFt, setHouseAreaSqFt] = useState('1200');
  const [floorsCount, setFloorsCount] = useState('1');
  const [roadLengthFeet, setRoadLengthFeet] = useState('100');
  const [roadWidthFeet, setRoadWidthFeet] = useState('10');
  const [solingLayerType, setSolingLayerType] = useState<
    'FLAT_SINGLE' | 'HERRINGBONE_DOUBLE'
  >('FLAT_SINGLE');
  const [wastagePct, setWastagePct] = useState('5');
  const [customRate, setCustomRate] = useState(
    String(defaultGrade?.ratePerUnit || 13000)
  );
  const [transportTrips, setTransportTrips] = useState('2');
  const [farePerTrip, setFarePerTrip] = useState('1200');
  const [copiedQuote, setCopiedQuote] = useState(false);

  // Truck Measurement (ট্রাক পরিমাপ — লম্বা × প্রস্থ × উচ্চতা ও প্রতি ফুট রেট) States
  const [truckLengthFt, setTruckLengthFt] = useState('16');
  const [truckLengthIn, setTruckLengthIn] = useState('0');
  const [truckWidthFt, setTruckWidthFt] = useState('7');
  const [truckWidthIn, setTruckWidthIn] = useState('6');
  const [truckHeightFt, setTruckHeightFt] = useState('4');
  const [truckHeightIn, setTruckHeightIn] = useState('6');
  const [truckRatePerFoot, setTruckRatePerFoot] = useState('55');
  const [truckTripsCount, setTruckTripsCount] = useState('1');

  const selectedGrade =
    brickGrades.find((g) => g.id === selectedGradeId) || defaultGrade;

  const truckMeasurement = useMemo(
    () =>
      calculateTruckFootMeasurement({
        lengthFeet: Number(truckLengthFt) || 0,
        lengthInches: Number(truckLengthIn) || 0,
        widthFeet: Number(truckWidthFt) || 0,
        widthInches: Number(truckWidthIn) || 0,
        heightFeet: Number(truckHeightFt) || 0,
        heightInches: Number(truckHeightIn) || 0,
        ratePerFoot: Number(truckRatePerFoot) || 0,
        truckCount: Number(truckTripsCount) || 1,
      }),
    [
      truckLengthFt,
      truckLengthIn,
      truckWidthFt,
      truckWidthIn,
      truckHeightFt,
      truckHeightIn,
      truckRatePerFoot,
      truckTripsCount,
    ]
  );

  const estimate = useMemo(
    () =>
      calculateSmartBrickEstimate({
        mode,
        wallLengthFeet: Number(wallLengthFeet) || 0,
        wallHeightFeet: Number(wallHeightFeet) || 0,
        wallCount: Number(wallCount) || 1,
        wallThickness,
        openingDeductionSqFt: Number(openingDeductionSqFt) || 0,
        houseAreaSqFt: Number(houseAreaSqFt) || 0,
        floorsCount: Number(floorsCount) || 1,
        roadLengthFeet: Number(roadLengthFeet) || 0,
        roadWidthFeet: Number(roadWidthFeet) || 0,
        solingLayerType,
        wastagePct: Number(wastagePct) || 0,
        ratePerThousand:
          Number(customRate) || selectedGrade?.ratePerUnit || 13000,
        transportTrips: Number(transportTrips) || 0,
        farePerTrip: Number(farePerTrip) || 0,
      }),
    [
      mode,
      wallLengthFeet,
      wallHeightFeet,
      wallCount,
      wallThickness,
      openingDeductionSqFt,
      houseAreaSqFt,
      floorsCount,
      roadLengthFeet,
      roadWidthFeet,
      solingLayerType,
      wastagePct,
      customRate,
      selectedGrade,
      transportTrips,
      farePerTrip,
    ]
  );

  if (!isOpen) return null;

  const gradeTitle = selectedGrade
    ? cleanBrickGradeName(selectedGrade.nameBn)
    : isEn
    ? '1 No. Special Brick'
    : '১ নং স্পেশাল ইট';

  const quoteSummaryText =
    mode === 'TRUCK_MEASURE'
      ? isEn
        ? `Saudia Traders (SBL Bricks - Satkhira)\nTruck Foot Measurement Bill\nCustomer/Party: ${
            customerName || 'Valued Buyer'
          }\nTruck Dimensions: Length ${formatBn(
            truckMeasurement.decimalLengthFeet
          )} ft × Width ${formatBn(
            truckMeasurement.decimalWidthFeet
          )} ft × Height ${formatBn(
            truckMeasurement.decimalHeightFeet
          )} ft\n1 Truck Capacity: ${formatBn(
            truckMeasurement.singleTruckCft
          )} CFT (Feet)\nTotal Trucks: ${formatBn(
            truckMeasurement.truckCount
          )} (${formatBn(
            truckMeasurement.totalCubicFeet
          )} Total Feet)\nRate per Foot: Tk ${formatBn(
            truckMeasurement.ratePerFoot
          )}\nTotal Foot Bill: ${formatCurrencyBn(
            truckMeasurement.totalFootBill
          )}\nContact: 01913-678010 / 01728-287018`
        : `SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)\n🚚 ট্রাক পরিমাপ ও ফুটের বিল\nক্রেতা/পার্টির নাম: ${
            customerName || 'সম্মানিত ক্রেতা'
          }\nট্রাকের মাপ: লম্বা ${formatBn(
            truckMeasurement.decimalLengthFeet
          )} ফুট × প্রস্থ ${formatBn(
            truckMeasurement.decimalWidthFeet
          )} ফুট × উচ্চতা ${formatBn(
            truckMeasurement.decimalHeightFeet
          )} ফুট\n১ ট্রাকে মোট ফুট: ${formatBn(
            truckMeasurement.singleTruckCft
          )} ফুট (CFT)\nমোট ট্রাক সংখ্যা: ${formatBn(
            truckMeasurement.truckCount
          )}টি (সর্বমোট ${formatBn(
            truckMeasurement.totalCubicFeet
          )} ফুট)\nপ্রতি ফুট রেট: ৳${formatBn(
            truckMeasurement.ratePerFoot
          )}\nসর্বমোট ফুটের বিল: ${formatCurrencyBn(
            truckMeasurement.totalFootBill
          )}\nযোগাযোগ: ০১৯১৩-৬৭৮০১০ / ০১৭২৮-২৮৭০১৮`
      : isEn
      ? `Saudia Traders (SBL Bricks - Satkhira)\nCustomer Estimate: ${
          customerName || 'Valued Buyer'
        }\nBrick Grade: ${gradeTitle}\nNet Area: ${formatBn(
          estimate.netAreaSqFt
        )} sq.ft\nRecommended Bricks: ${formatBn(
          estimate.roundedOrderBricks
        )} pcs\nRate per 1,000: Tk ${formatBn(
          Number(customRate) || 13000
        )}\nBrick Bill: ${formatCurrencyBn(
          estimate.brickCostAmount
        )}\nTransport Fare: ${formatCurrencyBn(
          estimate.transportCostAmount
        )}\nTotal Estimated Bill: ${formatCurrencyBn(
          estimate.grandTotalAmount
        )}\nContact: 01913-678010 / 01728-287018`
      : `SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)\nক্রেতার নাম: ${
          customerName || 'সম্মানিত ক্রেতা'
        }\nইটের গ্রেড: ${gradeTitle}\nমোট কাজের ক্ষেত্রফল: ${formatBn(
          estimate.netAreaSqFt
        )} বর্গফুট\nপ্রয়োজনীয় ইটের পরিমাণ: ${formatBn(
          estimate.roundedOrderBricks
        )} পিস\nহাজার প্রতি দর: ৳${formatBn(
          Number(customRate) || 13000
        )}\nইটের মোট মূল্য: ${formatCurrencyBn(
          estimate.brickCostAmount
        )}\nপরিবহন/গাড়ি ভাড়া: ${formatCurrencyBn(
          estimate.transportCostAmount
        )}\nসর্বমোট সম্ভাব্য বিল: ${formatCurrencyBn(
          estimate.grandTotalAmount
        )}\nযোগাযোগ: ০১৯১৩-৬৭৮০১০ / ০১৭২৮-২৮৭০১৮`;

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(quoteSummaryText);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isEn
          ? 'Smart Brick & Construction Quotation Calculator'
          : 'স্মার্ট ইট ও নির্মাণ কোটেশন ক্যালকুলেটর'
      }
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-950 my-8 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-950">
                {isEn
                  ? 'Smart Brick & Construction Quotation Estimator'
                  : 'স্মার্ট ইট ও নির্মাণ কোটেশন ক্যালকুলেটর'}
              </h2>
              <p className="text-xs font-medium text-slate-700">
                {isEn
                  ? 'Calculate exact bricks, cement, sand & transport cost for walls, houses or roads and convert directly to a Cash Memo'
                  : 'দেওয়াল, বাড়ি বা রাস্তার সোলিংয়ের জন্য কত পিস ইট, সিমেন্ট, বালু ও গাড়ি ভাড়া লাগবে তা হিসাব করে ১-ক্লিকে ক্যাশ মেমো তৈরি করুন'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close calculator' : 'বন্ধ করুন'}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            data-testid="estimator-mode-wall"
            onClick={() => setMode('WALL')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              mode === 'WALL'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-900 hover:bg-white'
            }`}
          >
            <Layers className="w-4 h-4 text-orange-500 shrink-0" />
            <span>
              {isEn ? 'Wall Brickwork (5"/10")' : 'দেওয়াল গাঁথুনি (৫"/১০")'}
            </span>
          </button>
          <button
            type="button"
            data-testid="estimator-mode-house"
            onClick={() => setMode('HOUSE_AREA')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              mode === 'HOUSE_AREA'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-900 hover:bg-white'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {isEn ? 'Full House (Sq.Ft)' : 'বাড়ি বা ভবন (বর্গফুট)'}
            </span>
          </button>
          <button
            type="button"
            data-testid="estimator-mode-road"
            onClick={() => setMode('SOLING_ROAD')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              mode === 'SOLING_ROAD'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-900 hover:bg-white'
            }`}
          >
            <Route className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {isEn ? 'Road Soling' : 'রাস্তা বা মেঝে সোলিং'}
            </span>
          </button>
          <button
            type="button"
            data-testid="estimator-mode-truck-measure"
            onClick={() => setMode('TRUCK_MEASURE')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              mode === 'TRUCK_MEASURE'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm ring-2 ring-orange-300'
                : 'bg-orange-50/80 text-orange-950 border border-orange-200 hover:bg-orange-100'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>
              {isEn ? 'Truck Measure (CFT Bill)' : '🚚 ট্রাক পরিমাপ (ফুটের বিল)'}
            </span>
          </button>
        </div>

        {/* Main 2-Column Estimator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 Cols: Input Controls */}
          <div className="lg:col-span-7 space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200">
              <span className="text-[11px] font-extrabold text-slate-900 mr-1">
                {isEn ? 'Quick Presets:' : 'দ্রুত মাপ নির্বাচন:'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode('WALL');
                  setWallLengthFeet('50');
                  setWallHeightFeet('7');
                  setWallCount('4');
                  setWallThickness('5_INCH');
                  setOpeningDeductionSqFt('40');
                  setTransportTrips('3');
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 border border-slate-300 text-slate-950 text-[11px] font-bold cursor-pointer"
              >
                {isEn ? 'Boundary Wall (4 Sides)' : 'বাউন্ডারি দেওয়াল (৪ পাশ)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('HOUSE_AREA');
                  setHouseAreaSqFt('1000');
                  setFloorsCount('1');
                  setTransportTrips('12');
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 border border-slate-300 text-slate-950 text-[11px] font-bold cursor-pointer"
              >
                {isEn ? '1,000 Sq.Ft 1-Story House' : '১০০০ বর্গফুট ১ তলা বাড়ি'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('HOUSE_AREA');
                  setHouseAreaSqFt('1500');
                  setFloorsCount('1');
                  setTransportTrips('18');
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 border border-slate-300 text-slate-950 text-[11px] font-bold cursor-pointer"
              >
                {isEn ? '1,500 Sq.Ft House' : '১৫০০ বর্গফুট বাড়ি'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-950 mb-1">
                  {isEn ? 'Customer Name (Optional)' : 'ক্রেতার নাম (কোটেশনের জন্য)'}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={
                    isEn ? 'e.g. Alhaj Abdul Karim' : 'যেমন: আলহাজ্ব আব্দুল করিম'
                  }
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-950 mb-1">
                  {isEn ? 'Select Brick Grade' : 'ইটের গ্রেড নির্বাচন করুন'}
                </label>
                <select
                  value={selectedGradeId}
                  onChange={(e) => {
                    const gId = e.target.value;
                    setSelectedGradeId(gId);
                    const found = brickGrades.find((g) => g.id === gId);
                    if (found) {
                      setCustomRate(String(found.ratePerUnit));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
                >
                  {brickGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {cleanBrickGradeName(g.nameBn)} — ৳{formatBn(g.ratePerUnit)}/হাজার
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'WALL' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Wall Length (Feet)' : 'দেওয়ালের দৈর্ঘ্য (ফুট)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={wallLengthFeet}
                    onChange={(e) => setWallLengthFeet(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Wall Height (Feet)' : 'দেওয়ালের উচ্চতা (ফুট)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={wallHeightFeet}
                    onChange={(e) => setWallHeightFeet(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Number of Walls' : 'দেওয়ালের সংখ্যা (টি)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={wallCount}
                    onChange={(e) => setWallCount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Wall Thickness' : 'গাঁথুনির পুরুত্ব'}
                  </label>
                  <select
                    value={wallThickness}
                    onChange={(e) =>
                      setWallThickness(e.target.value as WallThicknessType)
                    }
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
                  >
                    <option value="5_INCH">
                      {isEn
                        ? '5 Inch Partition Wall (5 pcs / sq.ft)'
                        : '৫ ইঞ্চি দেওয়াল গাঁথুনি (প্রতি বর্গফুটে ৫ পিস ইট)'}
                    </option>
                    <option value="10_INCH">
                      {isEn
                        ? '10 Inch Main Wall (10 pcs / sq.ft)'
                        : '১০ ইঞ্চি মেইন দেওয়াল গাঁথুনি (প্রতি বর্গফুটে ১০ পিস ইট)'}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Door/Window Deduct (Sq.Ft)' : 'দরজা-জানালা বাদ (বর্গফুট)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={openingDeductionSqFt}
                    onChange={(e) => setOpeningDeductionSqFt(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            )}

            {mode === 'HOUSE_AREA' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn
                      ? 'Building Plinth Area (Sq.Ft)'
                      : 'বাড়ির ছাদের ক্ষেত্রফল (বর্গফুট)'}
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={houseAreaSqFt}
                    onChange={(e) => setHouseAreaSqFt(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Number of Floors' : 'তলার সংখ্যা (তলা)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={floorsCount}
                    onChange={(e) => setFloorsCount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            )}

            {mode === 'SOLING_ROAD' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Road/Floor Length (Feet)' : 'রাস্তা/মেঝের দৈর্ঘ্য (ফুট)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={roadLengthFeet}
                    onChange={(e) => setRoadLengthFeet(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Width (Feet)' : 'প্রস্থ (ফুট)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={roadWidthFeet}
                    onChange={(e) => setRoadWidthFeet(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Soling Layer Type' : 'সোলিংয়ের ধরন'}
                  </label>
                  <select
                    value={solingLayerType}
                    onChange={(e) =>
                      setSolingLayerType(
                        e.target.value as 'FLAT_SINGLE' | 'HERRINGBONE_DOUBLE'
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl"
                  >
                    <option value="FLAT_SINGLE">
                      {isEn
                        ? 'Single Flat Soling (3.2/sq.ft)'
                        : 'সিঙ্গেল ফ্ল্যাট সোলিং (৩.২টি/বর্গফুট)'}
                    </option>
                    <option value="HERRINGBONE_DOUBLE">
                      {isEn
                        ? 'Herringbone Double (6.5/sq.ft)'
                        : 'হেরিংবোন ডাবল সোলিং (৬.৫টি/বর্গফুট)'}
                    </option>
                  </select>
                </div>
              </div>
            )}

            {mode === 'TRUCK_MEASURE' && (
              <div
                data-testid="truck-measurement-panel"
                className="space-y-3.5 bg-white border-2 border-orange-200 rounded-2xl p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div>
                    <span className="text-[11px] font-extrabold text-orange-700 uppercase tracking-wide block">
                      {isEn
                        ? 'Truck Dimension & Per-Foot Rate Calculator'
                        : '🚚 ট্রাক পরিমাপ (লম্বা × প্রস্থ × উচ্চতা = কত ফুটের ট্রাক)'}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-950">
                      {isEn
                        ? 'Enter Length, Width & Height to calculate total Cubic Feet (CFT) and Total Bill'
                        : 'ট্রাকের দৈর্ঘ্য, প্রস্থ ও উচ্চতা দিয়ে মোট ফুট এবং প্রতি ফুট রেট অনুযায়ী মোট বিল বের করুন'}
                    </h4>
                  </div>
                </div>

                {/* Quick Truck Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-slate-700">
                    {isEn ? 'Truck Size Presets:' : 'গাড়ির মাপ প্রিসেট:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTruckLengthFt('18');
                      setTruckLengthIn('0');
                      setTruckWidthFt('8');
                      setTruckWidthIn('0');
                      setTruckHeightFt('5');
                      setTruckHeightIn('0');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-950 text-[11px] font-extrabold cursor-pointer"
                  >
                    ১০ চাকা ট্রাক (১৮×৮×৫ = ৭২০ ফুট)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTruckLengthFt('16');
                      setTruckLengthIn('0');
                      setTruckWidthFt('7');
                      setTruckWidthIn('6');
                      setTruckHeightFt('4');
                      setTruckHeightIn('6');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-950 text-[11px] font-extrabold cursor-pointer"
                  >
                    ৬ চাকা ট্রাক (১৬×৭.৫×৪.৫ = ৫৪০ ফুট)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTruckLengthFt('12');
                      setTruckLengthIn('0');
                      setTruckWidthFt('6');
                      setTruckWidthIn('6');
                      setTruckHeightFt('3');
                      setTruckHeightIn('6');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-950 text-[11px] font-extrabold cursor-pointer"
                  >
                    মিনি ট্রাক (১২×৬.৫×৩.৫ = ২৭৩ ফুট)
                  </button>
                </div>

                {/* 3 Dimension Boxes: Length, Width, Height (Feet + Inches) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Length (দৈর্ঘ্য / লম্বা) */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                    <label className="block text-xs font-black text-slate-950">
                      {isEn ? '1. Truck Length (লম্বা)' : '১. ট্রাকের দৈর্ঘ্য / লম্বা'}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {isEn ? 'Feet (ফুট)' : 'ফুট (Feet)'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          data-testid="truck-length-feet-input"
                          value={truckLengthFt}
                          onChange={(e) => setTruckLengthFt(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {isEn ? 'Inch (ইঞ্চি)' : 'ইঞ্চি (Inch)'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={11}
                          data-testid="truck-length-inch-input"
                          value={truckLengthIn}
                          onChange={(e) => setTruckLengthIn(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Width (প্রস্থ / চওড়া) */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                    <label className="block text-xs font-black text-slate-950">
                      {isEn ? '2. Truck Width (প্রস্থ)' : '২. ট্রাকের প্রস্থ / চওড়া'}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {isEn ? 'Feet (ফুট)' : 'ফুট (Feet)'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          data-testid="truck-width-feet-input"
                          value={truckWidthFt}
                          onChange={(e) => setTruckWidthFt(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {isEn ? 'Inch (ইঞ্চি)' : 'ইঞ্চি (Inch)'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={11}
                          data-testid="truck-width-inch-input"
                          value={truckWidthIn}
                          onChange={(e) => setTruckWidthIn(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Height (উচ্চতা / হাইট) */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                    <label className="block text-xs font-black text-slate-950">
                      {isEn ? '3. Truck Height (উচ্চতা)' : '৩. ট্রাকের উচ্চতা / হাইট'}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {isEn ? 'Feet (ফুট)' : 'ফুট (Feet)'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          data-testid="truck-height-feet-input"
                          value={truckHeightFt}
                          onChange={(e) => setTruckHeightFt(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {isEn ? 'Inch (ইঞ্চি)' : 'ইঞ্চি (Inch)'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={11}
                          data-testid="truck-height-inch-input"
                          value={truckHeightIn}
                          onChange={(e) => setTruckHeightIn(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-Foot Rate & Number of Trucks Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-black text-orange-900 mb-1">
                      {isEn
                        ? 'Rate Per Foot / CFT (Tk)'
                        : 'প্রতি ফুট রেট / দর (৳ প্রতি সিএফটি)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      data-testid="truck-rate-per-foot-input"
                      value={truckRatePerFoot}
                      onChange={(e) => setTruckRatePerFoot(e.target.value)}
                      placeholder="যেমন: 55"
                      className="w-full px-3 py-2 text-sm font-black tabular-nums bg-orange-50/60 text-slate-950 border-2 border-orange-400 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-950 mb-1">
                      {isEn
                        ? 'Number of Trucks / Trips'
                        : 'মোট কয়টি ট্রাক / ট্রিপ'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      data-testid="truck-trips-count-input"
                      value={truckTripsCount}
                      onChange={(e) => setTruckTripsCount(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-black tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pricing & Transport Row (shown for Wall / House / Road modes) */}
            {mode !== 'TRUCK_MEASURE' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Rate / 1,000 (Tk)' : 'হাজার প্রতি দর (৳)'}
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Wastage Allowance (%)' : 'ভাঙা/অপচয় যোগ (%)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={wastagePct}
                    onChange={(e) => setWastagePct(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Truck/Trolley Trips' : 'গাড়ি/ট্রলি ট্রিপ সংখ্যা'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={transportTrips}
                    onChange={(e) => setTransportTrips(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-950 mb-1">
                    {isEn ? 'Fare Per Trip (Tk)' : 'ট্রিপ প্রতি ভাড়া (৳)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={farePerTrip}
                    onChange={(e) => setFarePerTrip(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-extrabold tabular-nums bg-white text-slate-950 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Cols: High-Contrast Live Quotation Output */}
          <div className="lg:col-span-5 bg-slate-950 text-white border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            {mode === 'TRUCK_MEASURE' ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider block">
                      {isEn
                        ? 'Live Truck CFT & Foot Bill'
                        : '🚚 লাইভ ট্রাক পরিমাপ ও ফুটের বিল'}
                    </span>
                    <h3 className="text-base font-extrabold text-white">
                      {isEn
                        ? 'Length × Width × Height = Total Feet'
                        : `লম্বা ${formatBn(
                            truckMeasurement.decimalLengthFeet
                          )}' × প্রস্থ ${formatBn(
                            truckMeasurement.decimalWidthFeet
                          )}' × উচ্চতা ${formatBn(
                            truckMeasurement.decimalHeightFeet
                          )}'`}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-orange-950 border border-orange-500 text-amber-300 text-xs font-extrabold tabular-nums">
                    {formatBn(truckMeasurement.singleTruckCft)}{' '}
                    {isEn ? 'CFT/Truck' : 'ফুট/ট্রাক'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-200 font-bold block">
                      {isEn
                        ? 'Truck Capacity (1 Truck)'
                        : 'কত ফুটের ট্রাক (১ গাড়ি)'}
                    </span>
                    <span
                      data-testid="truck-single-cft-value"
                      className="text-xl font-black text-amber-300 tabular-nums mt-0.5 block"
                    >
                      {formatBn(truckMeasurement.singleTruckCft)}{' '}
                      {isEn ? 'Feet (CFT)' : 'ফুট (CFT)'}
                    </span>
                    <span className="text-[10px] text-slate-300 tabular-nums">
                      {formatBn(truckMeasurement.decimalLengthFeet)} ×{' '}
                      {formatBn(truckMeasurement.decimalWidthFeet)} ×{' '}
                      {formatBn(truckMeasurement.decimalHeightFeet)} ={' '}
                      {formatBn(truckMeasurement.singleTruckCft)} ফুট
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-200 font-bold block">
                      {isEn
                        ? `Total Feet (${formatBn(truckMeasurement.truckCount)} Trucks)`
                        : `সর্বমোট ফুট (${formatBn(
                            truckMeasurement.truckCount
                          )}টি ট্রাক)`}
                    </span>
                    <span
                      data-testid="truck-total-cft-value"
                      className="text-xl font-black text-emerald-300 tabular-nums mt-0.5 block"
                    >
                      {formatBn(truckMeasurement.totalCubicFeet)}{' '}
                      {isEn ? 'Feet' : 'ফুট'}
                    </span>
                    <span className="text-[10px] text-slate-300 tabular-nums block">
                      {isEn
                        ? `Rate: Tk ${formatBn(truckMeasurement.ratePerFoot)} / Foot`
                        : `প্রতি ফুট রেট: ৳${formatBn(
                            truckMeasurement.ratePerFoot
                          )}`}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>
                      {isEn
                        ? `1 Truck Bill (${formatBn(
                            truckMeasurement.singleTruckCft
                          )} ft × Tk ${formatBn(truckMeasurement.ratePerFoot)}):`
                        : `১ ট্রাকের বিল (${formatBn(
                            truckMeasurement.singleTruckCft
                          )} ফুট × ৳${formatBn(truckMeasurement.ratePerFoot)}):`}
                    </span>
                    <span className="font-extrabold text-white tabular-nums">
                      {formatCurrencyBn(truckMeasurement.singleTruckBill)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>
                      {isEn
                        ? 'Total Trucks / Trips:'
                        : 'মোট ট্রাক / গাড়ি সংখ্যা:'}
                    </span>
                    <span className="font-extrabold text-amber-300 tabular-nums">
                      {formatBn(truckMeasurement.truckCount)}{' '}
                      {isEn ? 'Trucks' : 'টি গাড়ি'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
                    <span className="font-extrabold text-white">
                      {isEn ? 'Total Foot Bill:' : 'সর্বমোট ফুটের বিল:'}
                    </span>
                    <span
                      data-testid="truck-total-foot-bill"
                      className="text-lg font-black text-emerald-300 tabular-nums"
                    >
                      {formatCurrencyBn(truckMeasurement.totalFootBill)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider block">
                      {isEn
                        ? 'Instant Customer Quotation'
                        : 'লাইভ ইট ও খরচের কোটেশন'}
                    </span>
                    <h3 className="text-base font-extrabold text-white">
                      {gradeTitle}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-extrabold tabular-nums">
                    {formatBn(estimate.netAreaSqFt)}{' '}
                    {isEn ? 'sq.ft' : 'বর্গফুট'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-200 font-bold block">
                      {isEn
                        ? 'Recommended Order Bricks'
                        : 'প্রয়োজনীয় মোট ইট (অর্ডার)'}
                    </span>
                    <span
                      data-testid="estimator-total-bricks"
                      className="text-xl font-black text-amber-300 tabular-nums mt-0.5 block"
                    >
                      {formatBn(estimate.roundedOrderBricks)}{' '}
                      {isEn ? 'pcs' : 'পিস'}
                    </span>
                    <span className="text-[10px] text-slate-300 tabular-nums">
                      {isEn
                        ? `Base ${formatBn(
                            estimate.baseBricksNeeded
                          )} + ${formatBn(estimate.wastageBricks)} wastage`
                        : `মূল ${formatBn(
                            estimate.baseBricksNeeded
                          )} + অপচয় ${formatBn(estimate.wastageBricks)} পিস`}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-200 font-bold block">
                      {isEn
                        ? 'Cement & Sand Estimate'
                        : 'আনুমানিক সিমেন্ট ও বালু'}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-300 tabular-nums mt-1 block">
                      {isEn
                        ? `${formatBn(estimate.estimatedCementBags)} Bags Cement`
                        : `সিমেন্ট: ${formatBn(
                            estimate.estimatedCementBags
                          )} বস্তা`}
                    </span>
                    <span className="text-xs font-bold text-slate-200 tabular-nums block">
                      {isEn
                        ? `Sand: ${formatBn(estimate.estimatedSandCft)} CFT`
                        : `বালু: ${formatBn(
                            estimate.estimatedSandCft
                          )} সিএফটি`}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>
                      {isEn
                        ? `Brick Cost (${formatBn(
                            estimate.roundedOrderBricks
                          )} pcs):`
                        : `ইটের মূল্য (${formatBn(
                            estimate.roundedOrderBricks
                          )} পিস):`}
                    </span>
                    <span className="font-extrabold text-white tabular-nums">
                      {formatCurrencyBn(estimate.brickCostAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>
                      {isEn
                        ? `Transport Fare (${formatBn(
                            Number(transportTrips) || 0
                          )} trips):`
                        : `পরিবহন গাড়ি ভাড়া (${formatBn(
                            Number(transportTrips) || 0
                          )} ট্রিপ):`}
                    </span>
                    <span className="font-extrabold text-amber-300 tabular-nums">
                      {formatCurrencyBn(estimate.transportCostAmount)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
                    <span className="font-extrabold text-white">
                      {isEn ? 'Total Estimated Bill:' : 'সর্বমোট সম্ভাব্য বিল:'}
                    </span>
                    <span
                      data-testid="estimator-grand-total"
                      className="text-lg font-black text-emerald-300 tabular-nums"
                    >
                      {formatCurrencyBn(estimate.grandTotalAmount)}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2 pt-1">
              {mode !== 'TRUCK_MEASURE' && (
                <button
                  type="button"
                  data-testid="convert-estimate-to-memo-btn"
                  onClick={() => {
                    onConvertToMemo({
                      customerName: customerName.trim(),
                      gradeId: selectedGrade?.id || 'g1',
                      quantity: estimate.roundedOrderBricks,
                      ratePerThousand:
                        Number(customRate) ||
                        selectedGrade?.ratePerUnit ||
                        13000,
                      note: isEn
                        ? `Estimated for ${estimate.netAreaSqFt} sq.ft construction`
                        : `${formatBn(
                            estimate.netAreaSqFt
                          )} বর্গফুট কাজের কোটেশন থেকে মেমো`,
                    });
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-98"
                >
                  <FilePlus2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isEn
                      ? 'Create Cash Memo from Estimate'
                      : 'এই হিসাব দিয়ে সরাসরি ক্যাশ মেমো তৈরি করুন'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyQuote}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedQuote ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {isEn
                        ? 'Copied to Clipboard!'
                        : 'হিসাব মেসেজ কপি হয়েছে!'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {mode === 'TRUCK_MEASURE'
                        ? isEn
                          ? 'Copy Truck Foot Measurement Bill'
                          : 'ট্রাক পরিমাপ ও ফুটের বিল কপি করুন'
                        : isEn
                        ? 'Copy Quotation for Customer'
                        : 'ক্রেতার জন্য কোটেশন মেসেজ কপি করুন'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface QuickWorkspaceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageMode;
  dbState: KilnDatabaseState;
  navItems: Array<{
    id: NavigationTab;
    labelBn: string;
    labelEn: string;
    descBn: string;
    descEn: string;
  }>;
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMemo: (memo: SalesMemo) => void;
}

export const QuickWorkspaceSearchModal: React.FC<QuickWorkspaceSearchModalProps> = ({
  isOpen,
  onClose,
  lang,
  dbState,
  navItems,
  onSelectTab,
  onSelectMemo,
}) => {
  const isEn = lang === 'en';
  const [query, setQuery] = useState('');

  const hits = useMemo(
    () => searchKilnWorkspace(query, dbState, navItems, dbState.brickGrades),
    [query, dbState, navItems]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Quick Workspace Search' : 'দ্রুত মেমো ও সেকশন সার্চ'}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-start justify-center p-4 pt-16 overflow-y-auto animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 text-slate-950 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
          <Search className="w-5 h-5 text-orange-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isEn
                ? 'Type customer name, memo no, phone, worker or section name...'
                : 'ক্রেতার নাম, মেমো নম্বর, মোবাইল, শ্রমিক বা যেকোনো সেকশনের নাম লিখুন...'
            }
            className="flex-1 text-sm font-bold bg-transparent text-slate-950 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => {
                if (hit.kind === 'MEMO' && hit.memoId) {
                  const found = dbState.salesMemos.find(
                    (m) => m.id === hit.memoId
                  );
                  if (found) {
                    onSelectMemo(found);
                    onClose();
                    return;
                  }
                }
                if (hit.targetTab) {
                  onSelectTab(hit.targetTab);
                }
                onClose();
              }}
              className="w-full py-2.5 px-3 flex items-center justify-between gap-3 text-left hover:bg-orange-50/70 rounded-xl transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
                  {hit.kind === 'MEMO' ? (
                    <BookOpen className="w-4 h-4 text-amber-300" />
                  ) : hit.kind === 'WORKER' ? (
                    <Users className="w-4 h-4 text-emerald-300" />
                  ) : hit.kind === 'GRADE' ? (
                    <Flame className="w-4 h-4 text-orange-300" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-orange-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-950 truncate">
                    {isEn ? hit.titleEn : hit.titleBn}
                  </div>
                  <div className="text-[11px] font-medium text-slate-700 truncate">
                    {isEn ? hit.subtitleEn : hit.subtitleBn}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-950 text-[11px] font-extrabold">
                  {isEn ? hit.badgeEn : hit.badgeBn}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}

          {hits.length === 0 && (
            <div className="py-8 text-center text-xs font-bold text-slate-700">
              {isEn
                ? 'No matching memo, customer, or section found.'
                : 'এই নামে কোনো মেমো, ক্রেতা বা সেকশন পাওয়া যায়নি।'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
