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
  deliveryStatus?: 'DELIVERED' | 'LOADING' | 'BOOKING';
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

export interface KilnSettings {
  bhataName: string;
  tagline: string;
  proprietorName: string;
  phone1: string;
  phone2: string;
  address: string;
  openingBalance: number;
  theme: 'light' | 'dark' | 'system';
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
  | 'mill_hisab'
  | 'van_hisab'
  | 'porai_mistri'
  | 'unload_hisab'
  | 'cashbook'
  | 'bricks'
  | 'labour'
  | 'customer_search'
  | 'notes'
  | 'agent'
  | 'settings';

export type KpiCardId =
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
  createdAt: string;
}

export interface ChulliLoadRecord {
  id: string;
  date: string;
  millId?: MillId;
  millNameBn?: string;
  potNo?: string;
  sardarName: string;       // ভ্যান সর্দারের নাম (যেমন: সেলিম সর্দার)
  rawBricksLoaded: number;  // চুল্লিতে লোড করা কাঁচা ইটের পিস সংখ্যা
  vanCount: number;         // ভ্যান সংখ্যা = rawBricksLoaded / 100 (১০০ পিস প্রতি ভ্যান)
  ratePerVan: number;       // ডিফল্ট ১১.৫ টাকা প্রতি ভ্যান (১০০ পিস)
  totalBill: number;        // মোট বিল = Math.round((rawBricksLoaded / 100) * ratePerVan)
  paidAmount: number;       // কত টাকা জমা দেওয়া হয়েছে
  dueAmount: number;        // বাকি পাওনা
  note?: string;
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
  unloadedByGrade: UnloadedGradeItem[]; // কোন গ্রেডের কত ইট বাহির হয়েছে (১ নং, ১.৫ নং, ২ নং, ৩ নং, পিকেট, গড়িয়া)
  totalBricksUnloaded: number; // মোট বাহির করা পোড়ানো ইট
  ratePerThousand: number;  // ডিফল্ট ৭৫০ টাকা প্রতি ১০০০ ইট
  totalBill: number;        // মোট বিল = Math.round((totalBricksUnloaded / 1000) * ratePerThousand)
  paidAmount: number;       // কত টাকা দেওয়া হয়েছে
  dueAmount: number;        // বাকি পাওনা
  note?: string;
  createdAt: string;
}

export interface PoraiMistriRecord {
  id: string;
  date: string;
  mistriName: string;       // পোড়াই মিস্ত্রির নাম (যেমন: আলী হোসেন পোড়াই মিস্ত্রি)
  chamberOrRound: string;   // চুল্লি রাউন্ড বা চেম্বার নং (যেমন: রাউন্ড-০১)
  bricksFired: number;      // চুল্লিতে পোড়ানো ইটের সংখ্যা (পিস)
  ratePerThousand: number;  // প্রতি ১০০০ ইট পোড়াই রেট বা চুক্তি
  totalBill: number;        // মোট বিল = Math.round((bricksFired / 1000) * ratePerThousand)
  paidAmount: number;       // কত টাকা জমা দেওয়া হয়েছে
  dueAmount: number;        // আর পাবে কত (বাকি)
  note?: string;
  createdAt: string;
}

export type ProductionPaymentSection =
  | 'MILL'
  | 'VAN_LOAD'
  | 'PORAI_MISTRI'
  | 'UNLOAD';

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
  productionPayments?: ProductionPaymentRecord[];
  agentTasks: AgentTask[];
  agentMessages: AgentMessage[];
  auditLogs: AgentAuditLog[];
  context: ConversationContext;
}

