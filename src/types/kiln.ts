export interface MemoItemRow {
  id: string;
  gradeId: string;
  gradeName: string;
  quantity: number; // Direct piece count entered by user (NO separate unit selector)
  rate: number;     // Rate per 1,000 bricks or per unit
  ratePerThousand: boolean; // true for standard bricks (qty / 1000 * rate)
  lineTotal: number;
}

export interface BrickGrade {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  ratePerUnit: number;
  ratePerThousand: boolean; // default true for bricks, false for per-dali
  currentStock: number;
  seasonProduced: number;
}

export type PaymentMethod =
  | 'নগদ ক্যাশ'
  | 'বিকাশ / নগদ অ্যাপ'
  | 'ব্যাংক চেক / ট্রান্সফার';

export interface MemoPaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: PaymentMethod;
  type: 'INITIAL' | 'DUE_COLLECTION';
  note?: string;
  createdAt: string;
}

export interface MemoDeliveryRecord {
  id: string;
  memoId: string;
  memoNo: string;
  customerName: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  gradeId: string;
  gradeName: string;
  quantity: number; // Bricks delivered in this trip
  truckNo?: string;
  driverName?: string;
  vehicleType?: string;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface SalesMemo {
  id: string;
  memoNo: string;
  date: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  truckNo: string;
  driverName: string;
  vehicleType?: string;
  driverPhone?: string;
  deliveryStatus?: 'DELIVERED' | 'PARTIAL' | 'LOADING' | 'BOOKING';
  deliveredQuantity?: number;
  remainingDeliveryQuantity?: number;
  deliveryHistory?: MemoDeliveryRecord[];
  duePromiseDate?: string;
  items: MemoItemRow[];
  subTotal: number;
  discount: number;
  totalAmount: number; // subTotal - discount
  paidAmount: number;
  dueAmount: number;   // totalAmount - paidAmount
  paymentMethod: PaymentMethod;
  status: 'PAID' | 'DUE' | 'PARTIAL';
  note?: string;
  kilnId?: string;
  createdAt: string;
  paymentHistory?: MemoPaymentRecord[];

  // Legacy single-item compatibility fields
  gradeId?: string;
  gradeName?: string;
  quantity?: number;
  rate?: number;
}

export type CashTxType = 'IN' | 'OUT';

export type ExpenseCategory =
  | 'ইট বিক্রয় আদায়'
  | 'বাকি আদায়'
  | 'কয়লা ক্রয়'
  | 'ভেকু ও ডিজেল'
  | 'মাটি ক্রয়'
  | 'শ্রমিক ও সর্দার পেমেন্ট'
  | 'বিদ্যুৎ ও জ্বালানি'
  | 'অফিস ও আপ্যায়ন'
  | 'অন্যান্য জমা'
  | 'অন্যান্য খরচ';

export interface CashTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: CashTxType;
  category: ExpenseCategory | string;
  amount: number;
  description: string;
  referenceId?: string;
  paymentMethod: PaymentMethod;
  verified: boolean;
  kilnId?: string;
  createdAt: string;
}

export type WorkerRole =
  | 'সর্দার (Sardar)'
  | 'কাঁচা ইট কাটা (Moulder)'
  | 'ভাটা লোড ও আনলোড (Loader)'
  | 'আগুন মিস্ত্রি (Fireman)'
  | 'ভেকু ও ট্রাক ড্রাইভার'
  | 'দিনমজুর (Daily Labour)';

export interface WorkerProfile {
  id: string;
  name: string;
  role: WorkerRole | string;
  phone: string;
  morningRate: number;
  afternoonRate: number;
  active: boolean;
  totalEarnedSeason?: number; // মোট হাজিরা বিল (সকাল + বিকাল কাজের মোট টাকা)
  totalPaidSeason: number;    // মোট জমা দেওয়া টাকা (খোরাকি, হাটবার ও নগদ পেমেন্ট)
}

export interface WorkerAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  workerId: string;
  workerName: string;
  workerRole: string;
  recordType?: 'HAJIRA' | 'PAYMENT';
  paymentType?: string;
  morningPresent: boolean;
  afternoonPresent: boolean;
  morningAmount: number;
  afternoonAmount: number;
  khorakiAmount: number;
  hatbarAmount: number;
  totalPaid: number;
  note: string;
  cashTxId?: string;
  kilnId?: string;
  createdAt: string;
}

export interface KilnNote {
  id: string;
  date: string; // YYYY-MM-DD
  title?: string;
  text: string;
  priority: 'NORMAL' | 'URGENT';
  pinned?: boolean;
  completed: boolean;
  createdAt: string;
}

export interface DailyKilnGoals {
  rawBricksCutTarget: number;     // দৈনিক কাঁচা ইট কাটার লক্ষ্যমাত্রা (পিস)
  bricksSoldTarget: number;       // দৈনিক ইট বিক্রির লক্ষ্যমাত্রা (পিস)
  cashCollectionTarget: number;   // দৈনিক নগদ আদায়ের লক্ষ্যমাত্রা (৳)
  unloadLinesTarget: number;      // দৈনিক চুল্লি আনলোড লাইন লক্ষ্যমাত্রা (১ লাইন = ৪০০০ ইট)
  millDailyTargets?: Partial<Record<MillId, number>>; // মিলভিত্তিক দৈনিক কাঁচা ইট লক্ষ্যমাত্রা
}

export interface EstimatedCostOverrides {
  millRatePerThousand?: number;
  vanLoadRatePerThousand?: number;
  poraiRatePerThousand?: number;
  unloadRatePerLine?: number;
  soilCostPerThousand?: number;
  coalWoodCostPerThousand?: number;
  otherOverheadPerThousand?: number;
}

export interface KilnSettings {
  bhataName: string;
  tagline: string;
  proprietorName: string;
  phone1: string;
  phone2: string;
  address: string;
  openingBalance: number;
  theme: 'light' | 'dark' | 'system';
  dailyGoals?: DailyKilnGoals;
  estimatedCostOverrides?: EstimatedCostOverrides;
}

export type TaskStatus =
  | 'PLANNED'
  | 'AWAITING_CONFIRMATION'
  | 'RUNNING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface AgentTaskStep {
  id: string;
  labelBn: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CONFIRMATION';
  timestamp?: string;
}

export interface AgentToolExecution {
  id: string;
  toolName: string;
  inputSummary: string;
  outputSummary: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CONFIRMATION';
  durationMs: number;
  timestamp: string;
}

export type LiveSessionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'EXECUTING_TASK'
  | 'SPEAKING'
  | 'COMPLETED'
  | 'ERROR'
  | 'PAUSED'
  | 'AWAITING_CONFIRMATION';

export interface PendingConfirmation {
  actionType:
    | 'HIGH_VALUE_EXPENSE'
    | 'CREATE_MEMO'
    | 'RECORD_PAYMENT'
    | 'CREATE_EXPENSE'
    | 'DELETE_MEMO'
    | 'DELETE_CASH_TX'
    | 'BULK_MODIFICATION';
  summaryBn: string;
  amount?: number;
  category?: string;
  customerName?: string;
  memoNo?: string;
  date?: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
}

export type SystemUiActionType =
  | 'NAVIGATE_TAB'
  | 'OPEN_KPI_MODAL'
  | 'CLOSE_MODAL'
  | 'PRINT_MEMO'
  | 'PRINT_PAGE'
  | 'SCROLL_DOWN'
  | 'SCROLL_UP'
  | 'SCROLL_TOP'
  | 'FULLSCREEN_TOGGLE'
  | 'EXPORT_BACKUP'
  | 'REFRESH_STATE'
  | 'FILTER_MEMOS'
  | 'FILTER_CASHBOOK'
  | 'FILL_MEMO_FORM'
  | 'CLEAR_MEMO_FORM';

export interface SystemUiAction {
  type: SystemUiActionType;
  tab?: NavigationTab;
  kpiId?: KpiCardId;
  memoNo?: string;
  searchQuery?: string;
  memoStatusFilter?: 'ALL' | 'PAID' | 'DUE';
  cashTypeFilter?: 'ALL' | 'IN' | 'OUT';
  cashCategoryFilter?: string;
  formDraft?: {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    truckNo?: string;
    gradeId?: string;
    quantity?: number;
    rate?: number;
    discount?: number;
    paidAmount?: number;
    note?: string;
  };
  labelBn?: string;
}

export interface AgentTask {
  id: string;
  userRequest: string;
  parsedIntent: string;
  status: TaskStatus;
  steps: AgentTaskStep[];
  toolCalls: AgentToolExecution[];
  pendingConfirmation?: PendingConfirmation;
  finalSummaryBn?: string;
  navigationTarget?: NavigationTab;
  kpiReportTarget?: KpiCardId;
  uiAction?: SystemUiAction;
  retryCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  isVoice?: boolean;
  taskId?: string;
  toolName?: string;
}

export interface AgentAuditLog {
  id: string;
  timestamp: string;
  actor: 'USER' | 'AI_AGENT' | 'SYSTEM_QA';
  action: string;
  detailsBn: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
}

export interface ConversationContext {
  pendingExpenseAmount?: number;
  pendingExpenseCategory?: string;
  pendingExpenseDate?: string;
  pendingExpenseDescription?: string;
  pendingMemoData?: {
    customerName?: string;
    customerPhone?: string;
    gradeId?: string;
    quantity?: number;
    rate?: number;
    paidAmount?: number;
    discount?: number;
    note?: string;
  };
  pendingPaymentData?: {
    customerNameOrMemoNo?: string;
    amount?: number;
  };
  lastReferencedMemoId?: string;
  lastReferencedMemoNo?: string;
  lastReferencedCustomer?: string;
  lastCandidateMemoNos?: string[];
  lastTopic?:
    | 'SALES'
    | 'EXPENSE'
    | 'CUSTOMER_DUE'
    | 'MEMO_DETAIL'
    | 'STOCK'
    | 'CASH_BALANCE'
    | 'NOTE'
    | 'BRICK_RATES'
    | 'BUSINESS_ANALYSIS'
    | 'GENERAL';
  lastDateScope?: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'SEASON';
  lastQueryDateRange?: { start: string; end: string; labelBn: string };
  lastMentionedCustomer?: string;
  lastMentionedGradeId?: string;
}

export interface BusinessAnalysisReport {
  totalSalesRevenue: number;
  totalBricksSold: number;
  totalMemoCount: number;
  averageOrderValue: number;
  totalCashIn: number;
  totalExpense: number;
  netOperatingCashflow: number;
  currentCashBalance: number;
  totalCustomerDue: number;
  collectionEfficiencyPct: number;
  dueRiskPct: number;
  expenseToSalesRatioPct: number;
  totalInventoryPieces: number;
  totalInventoryValuation: number;
  topSellingGrade: {
    nameBn: string;
    soldQty: number;
    revenue: number;
    sharePct: number;
  };
  topCustomer: {
    name: string;
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    memoCount: number;
  };
  topDebtor: {
    name: string;
    dueAmount: number;
    memoNo: string;
    shareOfTotalDuePct: number;
  } | null;
  topExpenseDriver: {
    category: string;
    amount: number;
    sharePct: number;
  };
  gradeBreakdown: Array<{
    id: string;
    nameBn: string;
    soldQty: number;
    revenue: number;
    revenueSharePct: number;
    currentStock: number;
    stockValue: number;
  }>;
  expenseBreakdown: Array<{
    category: string;
    amount: number;
    sharePct: number;
  }>;
  healthScore: number;
  healthLabelBn: string;
  spokenExecutiveSummaryBn: string;
  recommendationsBn: string[];
}

export type NavigationTab =
  | 'dashboard'
  | 'new_memo'
  | 'memos'
  | 'due_tagada'
  | 'daily_closing'
  | 'hazar_khoroch'
  | 'delivery_hisab'
  | 'mill_hisab'
  | 'van_hisab'
  | 'porai_mistri'
  | 'koyla_dakshta'
  | 'unload_hisab'
  | 'rubbish_hisab'
  | 'chulli_chamber'
  | 'wastage_register'
  | 'jalani_hisab'
  | 'mati_koyla'
  | 'land_lease'
  | 'dadon_khata'
  | 'booking_party'
  | 'veku_truck'
  | 'license_kisti'
  | 'staff_salary'
  | 'cashbook'
  | 'bricks'
  | 'labour'
  | 'yearly_seasonal'
  | 'customer_search'
  | 'notes'
  | 'agent'
  | 'settings';

export type KpiCardId =
  | 'LIVE_LIQUIDITY'
  | 'TOTAL_BRICKS_SOLD'
  | 'TODAY_COLLECTION'
  | 'TOTAL_COLLECTION'
  | 'TOTAL_EXPENSE'
  | 'CASH_BALANCE'
  | 'TOTAL_DUE';

export interface GradeReportRow {
  grade: BrickGrade;
  todayQty: number;
  todayAmount: number;
  yesterdayQty: number;
  yesterdayAmount: number;
  seasonSoldQty: number;
  seasonSoldAmount: number;
}

export interface DailyChartPoint {
  date: string;
  dateLabelBn: string;
  salesAmount: number;
  cashInAmount: number;
  expenseAmount: number;
  bricksSoldQty: number;
}

export interface DashboardMetrics {
  todayDate: string;
  yesterdayDate: string;
  
  // 1. মোট ইট বিক্রয়
  totalBricksSoldAllTime: number;
  totalBrickSalesAmountAllTime: number;
  todayBricksSold: number;
  todaySalesAmount: number;
  todaySalesMemoCount: number;

  // 2. আজকের আদায়
  todayCashIn: number;

  // 3. মোট আদায়
  totalCashIn: number;

  // 4. মোট খরচ
  totalExpense: number;
  todayExpense: number;

  // 5. বর্তমান ক্যাশ ব্যালেন্স: Opening Balance + Total Cash In - Total Expense
  openingBalance: number;
  currentCashBalance: number;

  // 5B. লাইভ লিকুইডিটি (Live Liquidity: Sales Collections minus Operational Expenses in real-time)
  liveLiquidityToday?: number;
  liveLiquidityAllTime?: number;

  // 6. মোট পাওনা
  totalCustomerDue: number;
  dueCustomerCount: number;

  // Yesterday comparison
  yesterdaySalesAmount: number;
  yesterdaySalesMemoCount: number;
  yesterdayBricksSold: number;
  yesterdayCashIn: number;
  yesterdayExpense: number;

  // Stock overview
  totalBrickStockPieces: number;

  // 7-Day visual chart points
  sevenDayChart?: DailyChartPoint[];
}

export interface QaTestResult {
  id: string;
  nameBn: string;
  category: string;
  status:
    | 'WORKING AND VERIFIED'
    | 'IMPLEMENTED, NOT YET VERIFIED'
    | 'BLOCKED BY EXTERNAL SETUP'
    | 'INCOMPLETE'
    | 'FAILED TEST';
  detailsBn: string;
  durationMs: number;
}

export type LanguageMode = 'bn' | 'en';

export type MillId = 'ohab' | 'mofijul' | 'sofikul';

export interface MillPotRecord {
  id: string;
  millId: MillId;
  millNameBn: string;
  millNameEn: string;
  potNo: string; // e.g., "পট-০১" / "Pot-01"
  date: string;  // YYYY-MM-DD
  rawBricksCut: number;     // কতগুলো কাঁচা ইট কেটেছে
  takenToChulli: number;    // চুল্লিতে নেওয়া হয়েছে কতগুলো ইট
  remainingRawBricks: number; // মাঠে অবশিষ্ট কাঁচা ইট (rawBricksCut - takenToChulli)
  ratePerThousand: number;  // প্রতি ১০০০ কাঁচা ইট কাটার রেট
  totalPayable: number;     // মোট প্রদেয় টাকা = Math.round((rawBricksCut / 1000) * ratePerThousand)
  paidAmount: number;       // কত টাকা দেওয়া হয়েছে (দাদন / পেমেন্ট)
  dueAmount: number;        // বাকি কত টাকা দিতে হবে (totalPayable - paidAmount)
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface ChulliLoadRecord {
  id: string;
  date: string;
  millId?: MillId;
  millNameBn?: string;
  potNo?: string;
  sardarName: string;       // ভ্যান সর্দারের নাম (যেমন: সেলিম সর্দার)
  rawBricksLoaded: number;  // চুল্লিতে লোড করা মূল কাঁচা ইটের পিস সংখ্যা (মাঠ/পট থেকে আনা)
  pakaBricksLoaded?: number; // চুল্লির লাইনে ব্যবহৃত সহযোগী পাকা ইট (পিস, ঐচ্ছিক)
  totalBricksLoaded?: number; // মোট চুল্লিতে লোডকৃত ইট = rawBricksLoaded + (pakaBricksLoaded || 0)
  vanCount: number;         // ভ্যান সংখ্যা = (totalBricksLoaded || rawBricksLoaded) / 100
  ratePerVan: number;       // হাজার প্রতি রেট (১০০০ পিস)
  totalBill: number;        // মোট বিল = Math.round(((totalBricksLoaded || rawBricksLoaded) / 1000) * ratePerThousand)
  paidAmount: number;       // কত টাকা জমা দেওয়া হয়েছে
  dueAmount: number;        // বাকি পাওনা
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface UnloadedGradeItem {
  gradeId: string;
  gradeName: string;
  quantity: number;
}

export interface ChulliUnloadRecord {
  id: string;
  date: string;
  chamberOrRound: string;   // চুল্লি রাউন্ড বা চেম্বার নং
  sardarName: string;       // আনলোড / নিকল সর্দারের নাম
  linesUnloaded?: number;   // কয় লাইন ইট বের করলো (১ লাইন = ৪০০০ ইট)
  bricksPerLine?: number;   // প্রতি লাইনে ইটের সংখ্যা (ডিফল্ট ৪০০০)
  ratePerLine?: number;     // প্রতি লাইনের রেট (ডিফল্ট ৭৫০ টাকা)
  unloadedByGrade: UnloadedGradeItem[]; // সংরক্ষিত বা স্বয়ংক্রিয় বিক্রয় সমন্বয়কৃত আইটেম
  totalBricksUnloaded: number; // মোট বাহির করা পোড়ানো ইট = linesUnloaded * 4000
  ratePerThousand: number;  // সমতুল্য হাজার রেট বা লাইন রেট
  totalBill: number;        // মোট বিল = Math.round(linesUnloaded * ratePerLine)
  paidAmount: number;       // কত টাকা দেওয়া হয়েছে
  dueAmount: number;        // বাকি পাওনা
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface PoraiMistriRecord {
  id: string;
  date: string;
  mistriName: string;       // পোড়াই মিস্ত্রির নাম / সর্দারের নাম (যেমন: আলী হোসেন পোড়াই মিস্ত্রি দল)
  chamberOrRound: string;   // চুক্তির বিবরণ বা সপ্তাহ (যেমন: সিজন চুক্তি / ১ম সপ্তাহ)
  mistriCount?: number;     // কয়জন পোড়াই মিস্ত্রি কাজ করছে (যেমন: ৮ জন)
  monthsCount?: number;     // কত মাসের হিসাব (যেমন: ৫ মাস)
  monthlyRatePerMistri?: number; // জনপ্রতি মাসিক দর (ঐচ্ছিক)
  contractTotalBill?: number;    // নির্ধারিত টোটাল বিল (৳)
  bricksFired: number;      // চুল্লিতে পোড়ানো ইটের সংখ্যা (পিস)
  ratePerThousand: number;  // প্রতি ১০০০ ইট পোড়াই রেট বা চুক্তি
  totalBill: number;        // মোট নির্ধারিত বিল (৳)
  paidAmount: number;       // প্রতি সপ্তাহে মোট কত টাকা জমা দেওয়া হয়েছে
  dueAmount: number;        // আর পাবে কত (বাকি = totalBill - paidAmount)
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface RubbishRecord {
  id: string;
  date: string;
  sardarName: string;       // রাবিশ সর্দারের নাম (ডিফল্ট: অবেদ রাবিশ সর্দার)
  chamberOrRound: string;   // রাউন্ড বিবরণ (যেমন: ১ম রাউন্ড / ২য় রাউন্ড)
  roundBill: number;        // রাউন্ড হিসেবে নির্ধারিত বিল (৳)
  paidAmount: number;       // খোরাকি বা জমা দেওয়া টাকা (৳)
  dueAmount: number;        // বাকি পাওনা (roundBill - paidAmount)
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export type ProductionPaymentSection =
  | 'MILL'
  | 'VAN_LOAD'
  | 'PORAI_MISTRI'
  | 'UNLOAD'
  | 'RUBBISH'
  | 'JALANI';

export type WoodFuelUnit = 'মণ' | 'টন' | 'গাড়ি' | 'কেজি' | 'সিএফটি';

export interface WoodFuelRecord {
  id: string;
  date: string; // YYYY-MM-DD
  supplierName: string; // সাপ্লায়ার / কাঠ ব্যাপারীর নাম
  supplierPhone?: string;
  woodType: string; // গজারি কাঠ, আম কাঠ, কড়ই/রেইনট্রি কাঠ, বাবলা কাঠ, মিক্সড জ্বালানি কাঠ ইত্যাদি
  vehicleOrChallan?: string; // গাড়ি / ট্রাক / ভ্যান / চালান নং
  quantity: number; // কতটা কাঠ দিল (যেমন ১২০ মণ)
  unit: WoodFuelUnit | string; // 'মণ' | 'টন' | 'গাড়ি' | 'কেজি' | 'সিএফটি'
  ratePerUnit: number; // প্রতি মণ/টন/গাড়ি দর (একেকজনের রেট একেক রকম)
  totalBill: number; // মোট বিল = Math.round(quantity * ratePerUnit)
  paidAmount: number; // কত টাকা পেমেন্ট দেওয়া হয়েছে
  dueAmount: number; // বাকি পাওনা = totalBill - paidAmount
  paymentMethod?: PaymentMethod;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface ProductionPaymentRecord {
  id: string;
  section: ProductionPaymentSection;
  referenceId: string;
  recipientName: string;
  subDetail: string;
  amount: number;
  date: string;
  note: string;
  cashTxId?: string;
  kilnId?: string;
  createdAt: string;
}

export interface KilnUnit {
  id: string;
  nameBn: string;
  nameEn: string;
  locationBn: string;
  active: boolean;
}

export interface SeasonRevisionEntry {
  id: string;
  timestamp: string;
  action: 'CREATED' | 'UPDATED' | 'CLOSED' | 'REOPENED' | 'ADJUSTED';
  actorName: string;
  reasonBn: string;
  damageOrAdjustmentBricks?: number;
  openingCashAdjustment?: number;
  openingStockAdjustment?: number;
}

export interface KilnSeason {
  id: string;
  nameBn: string;
  nameEn: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  kilnIds: string[]; // e.g., ['sbl-1']
  status: 'ACTIVE' | 'CLOSED';
  damageOrAdjustmentBricks: number;
  openingStockOverride?: number;
  openingCashOverride?: number;
  closingNoteBn?: string;
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedReasonBn?: string;
  revisionHistory: SeasonRevisionEntry[];
  createdAt: string;
}

export type SoilCoalItemType = 'SOIL' | 'COAL' | 'ESCO';

export interface SoilCoalRecord {
  id: string;
  date: string; // YYYY-MM-DD
  itemType: SoilCoalItemType; // 'SOIL' (মাটি) | 'COAL' (কয়লা) | 'ESCO' (এসকো/ভেকু বিল)
  supplierName: string; // সাপ্লায়ার / এসকো মালিক বা ড্রাইভারের নাম
  supplierPhone?: string;
  specification: string; // যেমন: এঁটেল মাটি, দোআঁশ মাটি, এসকোভেটর ঘণ্টা বিল ইত্যাদি
  vehicleOrChallan?: string; // গাড়ি / ট্রাক / এসকো নং
  quantity: number; // পরিমাণ বা ঘণ্টা (যেমন: ১০ গাড়ি / ১৫ ঘণ্টা)
  unit: string; // 'গাড়ি (ট্রাক/ট্রলি)' | 'ঘণ্টা' | 'সিএফটি (CFT)' | 'টন'
  ratePerUnit: number; // একক দর বা প্রতি ঘণ্টার রেট
  totalBill: number; // মোট বিল = Math.round(quantity * ratePerUnit)
  paidAmount: number; // নগদ পরিশোধ / জমা
  dueAmount: number; // বকেয়া = totalBill - paidAmount
  hoursWorked?: number; // এসকো কাজের মোট ঘণ্টা
  hoursDateBreakdown?: string; // আজ কত ঘণ্টা, কাল কত ঘণ্টা কাজের বিবরণ
  workSite?: string; // কাজের সাইট বা স্থান
  paymentMethod?: PaymentMethod;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export type DadonRoleCategory =
  | 'মিল সর্দার'
  | 'ভ্যান সর্দার'
  | 'পোড়াই মিস্ত্রি'
  | 'আনলোড সর্দার'
  | 'রাবিশ সর্দার'
  | 'লেবার সর্দার';

export interface DadonAdvanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  recipientName: string; // সর্দার বা মিস্ত্রির নাম
  recipientPhone?: string;
  roleCategory: DadonRoleCategory;
  advanceAmount: number; // প্রদত্ত দাদন বা অগ্রিম টাকা
  manualWorkBill?: number; // ম্যানুয়ালি যুক্ত কাজের বিল (অটো কাজের বিলের পাশাপাশি)
  cashReturnedOrSettled?: number; // নগদ ফেরত বা সমাপনী সমন্বয়
  paymentMethod?: PaymentMethod;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface AdvanceBrickBooking {
  id: string;
  bookingNo: string; // যেমন: BK-4001
  date: string; // বুকিংয়ের তারিখ (YYYY-MM-DD)
  deliveryTargetDate: string; // সম্ভাব্য ডেলিভারির তারিখ
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  gradeId: string;
  gradeName: string;
  bookedQuantity: number; // বুকিংকৃত ইটের সংখ্যা (পিস)
  ratePerThousand: number; // চুক্তিকৃত হাজার দর
  totalAmount: number; // মোট চুক্তিমূল্য = Math.round((bookedQuantity / 1000) * ratePerThousand)
  advancePaid: number; // অগ্রিম জমা টাকা
  dueAmount: number; // বাকি টাকা = totalAmount - advancePaid
  deliveredQuantity: number; // ইতিমধ্যে ডেলিভারিকৃত ইট (পিস)
  status: 'ACTIVE' | 'PARTIAL_DELIVERED' | 'COMPLETED';
  paymentMethod?: PaymentMethod;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export type KilnVehicleType =
  | 'ভেকু (Excavator)'
  | 'ট্রাক (Truck)'
  | 'ট্রলি / ট্রাক্টর'
  | 'পেলোডার / পাওয়ার টিলার';

export interface VehicleDieselRecord {
  id: string;
  date: string; // YYYY-MM-DD
  vehicleName: string; // যেমন: ভেকু-০১, ভাটা ট্রাক (সাতক্ষীরা-ট-১১-২০৪৫), ট্রলি-০২
  vehicleType: KilnVehicleType;
  driverName: string; // ড্রাইভার বা অপারেটরের নাম
  workOrTripSummary: string; // যেমন: ৮ ঘণ্টা মাটি কাটা / ৪ ট্রিপ ইট ডেলিভারি
  dieselLiters: number; // ডিজেল (লিটার)
  dieselRate: number; // প্রতি লিটার দর
  dieselCost: number; // মোট ডিজেল খরচ = Math.round(dieselLiters * dieselRate)
  driverAllowance: number; // ড্রাইভার খোরাকি / ট্রিপ ভাতা
  maintenanceCost: number; // মেরামত / পার্টস / ইঞ্জিন অয়েল খরচ
  totalExpense: number; // সর্বমোট খরচ = dieselCost + driverAllowance + maintenanceCost
  paidAmount: number; // নগদ পরিশোধিত টাকা
  paymentMethod?: PaymentMethod;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export type ComplianceCategory =
  | 'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)'
  | 'ডিসি অফিস লাইসেন্স ও খাজনা'
  | 'ভ্যাট ও আয়কর (VAT & Tax)'
  | 'বিএসটিআই ও ফায়ার সার্ভিস'
  | 'ব্যাংক লোন / সিসি লোন কিস্তি'
  | 'অন্যান্য সরকারি ফি ও নবায়ন';

export interface ComplianceInstallmentRecord {
  id: string;
  titleBn: string; // যেমন: পরিবেশ অধিদপ্তর বার্ষিক ছাড়পত্র নবায়ন ২০২৬-২৭
  category: ComplianceCategory;
  authorityOrBankName: string; // যেমন: পরিবেশ অধিদপ্তর, সাতক্ষীরা / ইসলামী ব্যাংক সাতক্ষীরা শাখা
  referenceNo?: string; // লাইসেন্স নং / ফাইল নং / লোন একাউন্ট নং
  dueDate: string; // পরিশোধ বা মেয়াদের শেষ তারিখ (YYYY-MM-DD)
  totalPayable: number; // মোট ধার্যকৃত ফি বা কিস্তির টাকা
  paidAmount: number; // পরিশোধিত টাকা
  dueAmount: number; // বকেয়া টাকা = totalPayable - paidAmount
  status: 'PAID' | 'PARTIAL' | 'PENDING';
  lastPaidDate?: string;
  paymentMethod?: PaymentMethod;
  note?: string;
  kilnId?: string;
  createdAt: string;
}

export interface KilnDatabaseState {
  settings: KilnSettings;
  brickGrades: BrickGrade[];
  salesMemos: SalesMemo[];
  cashTransactions: CashTransaction[];
  workerProfiles: WorkerProfile[];
  workerAttendance: WorkerAttendance[];
  kilnNotes: KilnNote[];
  millPots?: MillPotRecord[];
  chulliLoads?: ChulliLoadRecord[];
  poraiMistriRecords?: PoraiMistriRecord[];
  chulliUnloads?: ChulliUnloadRecord[];
  rubbishRecords?: RubbishRecord[];
  woodFuelRecords?: WoodFuelRecord[];
  soilCoalRecords?: SoilCoalRecord[];
  dadonRecords?: DadonAdvanceRecord[];
  advanceBookings?: AdvanceBrickBooking[];
  vehicleDieselRecords?: VehicleDieselRecord[];
  complianceRecords?: ComplianceInstallmentRecord[];
  productionPayments?: ProductionPaymentRecord[];
  memoDeliveries?: MemoDeliveryRecord[];
  kilnUnits?: KilnUnit[];
  kilnSeasons?: KilnSeason[];
  agentTasks: AgentTask[];
  agentMessages: AgentMessage[];
  auditLogs: AgentAuditLog[];
  context: ConversationContext;
}


