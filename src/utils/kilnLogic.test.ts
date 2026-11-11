import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoUnloadConfirmation,
  computeDamperMaintenanceAlerts,
  computeFeedKilnLineSystemStatus,
  computeSeasonWastageReconciliation,
  createDefaultFeedKilnLineSystem,
  createDefaultSeasonWastageConfig,
  getFeedKilnLineZoneState,
} from './enterpriseOperationsLogic';
import {
  calculateTruckFootMeasurement,
  computeFridayHatbarSardarSummarySheet,
} from './themeAndEstimatorLogic';
import { processLocalApiMutation } from './offlineLocalDatabaseEngine';
import { computeDatabaseRecordSummary } from './scheduledBackupLogic';
import { createInitialKilnState } from './seedData';
import {
  buildQuickCashTransactionPayload,
  calculateAdvanceBookingBill,
  calculateChulliLineUnloadBill,
  calculateComplianceItemBill,
  calculateDashboardMetrics,
  calculateLiveLiquidity,
  calculateMultiItemMemoTotals,
  calculateRowTotal,
  calculateSardarFridaySettlement,
  calculateSoilCoalBill,
  calculateVanLoadBill,
  calculateVehicleDieselExpense,
  calculateWoodFuelBill,
  cleanBrickGradeName,
  computeBrickGradeReport,
  computeComplianceSummary,
  computeComprehensiveBusinessAnalysis,
  computeCustomerPartyStatements,
  computeDadonReconciliationSummary,
  computeDailyClosingSheet,
  computeDailyGoalProgress,
  computeDailyMillProductionGoal,
  computeDueTagadaList,
  computeEstimatedPerThousandBrickCost,
  computeKilnBrickPipelineSummary,
  computeSevenDayLiquidityHealth,
  computeSoilCoalSummary,
  computeUnloadLineAndSalesReconciliation,
  computeVehicleDieselSummary,
  computeWoodFuelSupplierSummary,
  computeWorkerBalanceWithDina,
  computeNewWorkWithDinaAdjustment,
  extractBanglaAmount,
  formatBn,
  generateDailyChartData,
  generateUniqueMemoNo,
  normalizeBangladeshWhatsAppPhone,
  normalizeLegacyMemo,
  parseBanglaAgentIntent,
  parseBanglaDigits,
  requiresSafeConfirmation,
  validateStockForMultiItemMemo,
} from './kilnLogic.ts';
import type {
  AdvanceBrickBooking,
  BrickGrade,
  CashTransaction,
  ChulliUnloadRecord,
  ComplianceInstallmentRecord,
  MillPotRecord,
  SalesMemo,
  SoilCoalRecord,
  VehicleDieselRecord,
  WoodFuelRecord,
} from '../types/kiln.ts';

test('formatBn and parseBanglaDigits convert accurately', () => {
  assert.equal(formatBn(125000), '১,২৫,০০০');
  assert.equal(formatBn(0), '০');
  assert.equal(parseBanglaDigits('৫০০০ পিস ১৩৫০০ দর'), '5000 পিস 13500 দর');
});

test('calculateRowTotal strictly computes per-1000 rate (1000 @ 11000 = 11000, 500 @ 11000 = 5500) and cleanBrickGradeName strips English tags', () => {
  // Per-1,000 brick rate: 1,000 bricks at 11,000 rate = 11,000
  assert.equal(calculateRowTotal(1000, 11000, true), 11000);
  // Per-1,000 brick rate: 500 bricks at 11,000 rate = 5,500
  assert.equal(calculateRowTotal(500, 11000, true), 5500);
  // Clean brick grade names
  assert.equal(cleanBrickGradeName('১ নং ইট (First Class)'), '১ নং ইট');
  assert.equal(cleanBrickGradeName('পিকেট ইট (Picket)'), 'পিকেট ইট');
  // Legacy compatibility: 5,000 bricks at 13.5 rate = 67,500
  assert.equal(calculateRowTotal(5000, 13.5), 67500);
  // 2,500 bricks at 12 rate = 30,000
  assert.equal(calculateRowTotal(2500, 12), 30000);
  // 500 bricks at 13.5 rate = 6,750
  assert.equal(calculateRowTotal(500, 13.5), 6750);
  // Unique memo number generation and duplicate prevention
  assert.equal(generateUniqueMemoNo([]).memoNo, '3001');
  assert.equal(generateUniqueMemoNo([{ memoNo: '3001' }]).memoNo, '3002');
  assert.equal(
    generateUniqueMemoNo([{ memoNo: '3002' }, { memoNo: '3001' }]).memoNo,
    '3003'
  );
  const memos = [{ memoNo: 'BF-2026-104' }, { memoNo: 'BF-2026-125' }];
  const nextMemo = generateUniqueMemoNo(memos);
  assert.equal(nextMemo.memoNo, 'BF-2026-126');
  const dupMemo = generateUniqueMemoNo(memos, 'BF-2026-125');
  assert.ok(dupMemo.duplicateErrorBn);
});

test('calculateMultiItemMemoTotals supports multi-item rows, discount and partial payment', () => {
  const items = [
    { quantity: 5000, rate: 13.5 }, // 67,500
    { quantity: 3000, rate: 12 }, // 36,000
  ];
  // Subtotal = 1,03,500; Discount = 3,500; Total = 1,00,000; Paid = 60,000; Due = 40,000
  const totals = calculateMultiItemMemoTotals({
    items,
    discount: 3500,
    paidAmount: 60000,
  });

  assert.equal(totals.subTotal, 103500);
  assert.equal(totals.discount, 3500);
  assert.equal(totals.totalAmount, 100000);
  assert.equal(totals.paidAmount, 60000);
  assert.equal(totals.dueAmount, 40000);
  assert.equal(totals.status, 'PARTIAL');
});

test('validateStockForMultiItemMemo validates combined quantity across rows', () => {
  const grades: BrickGrade[] = [
    {
      id: 'g-1',
      code: 'SBL-1',
      nameBn: '১ নং ইট',
      nameEn: 'Grade 1',
      ratePerUnit: 13500,
      ratePerThousand: true,
      currentStock: 10000,
      seasonProduced: 100000,
    },
    {
      id: 'g-2',
      code: 'SBL-2',
      nameBn: '২ নং ইট',
      nameEn: 'Grade 2',
      ratePerUnit: 12000,
      ratePerThousand: true,
      currentStock: 5000,
      seasonProduced: 50000,
    },
  ];

  // Valid order
  const validCheck = validateStockForMultiItemMemo(grades, [
    { gradeId: 'g-1', quantity: 4000 },
    { gradeId: 'g-2', quantity: 3000 },
  ]);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.updatedStock['g-1'], 6000);
  assert.equal(validCheck.updatedStock['g-2'], 2000);

  // Over-stock order when strict stock check is used
  const invalidCheck = validateStockForMultiItemMemo(grades, [
    { gradeId: 'g-1', quantity: 12000 },
  ]);
  assert.equal(invalidCheck.valid, false);
  assert.ok(invalidCheck.errorBn?.includes('পর্যাপ্ত স্টক নেই'));

  // Zero-stock / over-stock memo allowed when allowZeroOrAnyStock = true ("ইট থাক বা না থাক মেমো করা যাবে")
  const zeroStockAllowed = validateStockForMultiItemMemo(
    [{ ...grades[0], currentStock: 0 }],
    [{ gradeId: 'g-1', quantity: 5000 }],
    true
  );
  assert.equal(zeroStockAllowed.valid, true);
  assert.equal(zeroStockAllowed.updatedStock['g-1'], 0);
});

test('calculateDashboardMetrics computes cash balance including Opening Balance', () => {
  const today = '2026-10-20';
  const yesterday = '2026-10-19';

  const brickGrades: BrickGrade[] = [
    {
      id: 'g-1',
      code: 'SBL-1',
      nameBn: '১ নং ইট',
      nameEn: 'Grade 1',
      ratePerUnit: 13500,
      ratePerThousand: true,
      currentStock: 50000,
      seasonProduced: 100000,
    },
  ];

  const salesMemos: SalesMemo[] = [
    {
      id: 'm1',
      memoNo: 'BF-2026-001',
      date: today,
      customerName: 'করিম সাহেব',
      customerPhone: '01700000000',
      customerAddress: 'সদর',
      truckNo: '১১-২২৩৩',
      driverName: 'আলম',
      items: [
        {
          id: 'it1',
          gradeId: 'g-1',
          gradeName: '১ নং ইট',
          quantity: 4000,
          rate: 13500,
          ratePerThousand: true,
          lineTotal: 54000,
        },
      ],
      subTotal: 54000,
      discount: 0,
      totalAmount: 54000,
      paidAmount: 30000,
      dueAmount: 24000,
      paymentMethod: 'নগদ ক্যাশ',
      status: 'PARTIAL',
      createdAt: today,
    },
  ];

  const cashTransactions: CashTransaction[] = [
    {
      id: 't1',
      date: today,
      type: 'IN',
      category: 'ইট বিক্রয় আদায়',
      amount: 30000,
      description: 'মেমো BF-2026-001 জমা',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: today,
    },
    {
      id: 't2',
      date: today,
      type: 'OUT',
      category: 'কয়লা ক্রয়',
      amount: 10000,
      description: 'কয়লা খরচ',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: today,
    },
  ];

  const metrics = calculateDashboardMetrics(
    {
      settings: {
        bhataName: 'BrickFlow — Bhata Management System',
        tagline: 'ইটভাটার আধুনিক ডিজিটাল হিসাব ও ব্যবস্থাপনা',
        proprietorName: 'মোঃ কামরুল ইসলাম',
        phone1: '০১৯১৩-৬৭৮০১০',
        phone2: '০১৭২৮-২৮৭০১৮',
        address: 'বাবুলিয়া, সাতক্ষীরা',
        openingBalance: 50000, // Opening balance: 50,000
        theme: 'light',
      },
      brickGrades,
      salesMemos,
      cashTransactions,
    },
    today,
    yesterday
  );

  // Current Cash Balance = 50,000 (opening) + 30,000 (cash in) - 10,000 (expense) = 70,000
  assert.equal(metrics.openingBalance, 50000);
  assert.equal(metrics.totalCashIn, 30000);
  assert.equal(metrics.totalExpense, 10000);
  assert.equal(metrics.currentCashBalance, 70000);
  assert.equal(metrics.liveLiquidityToday, 20000);
  assert.equal(metrics.liveLiquidityAllTime, 20000);
  assert.equal(metrics.totalCustomerDue, 24000);
  assert.equal(metrics.todaySalesAmount, 54000);
  assert.equal(metrics.todayBricksSold, 4000);

  const liveLiq = calculateLiveLiquidity({
    todayCashIn: metrics.todayCashIn,
    todayExpense: metrics.todayExpense,
    totalCashIn: metrics.totalCashIn,
    totalExpense: metrics.totalExpense,
    openingBalance: metrics.openingBalance,
  });
  assert.equal(liveLiq.dailyNetCashInHand, 20000);
  assert.equal(liveLiq.seasonalNetCashInHand, 20000);
  assert.equal(liveLiq.actualCashInHandWithOpening, 70000);
  assert.equal(liveLiq.collectionCoveragePct, 75);
  assert.equal(liveLiq.status, 'POSITIVE');

  const chart = generateDailyChartData(salesMemos, cashTransactions, 7);
  assert.equal(chart.length, 7);
});

test('normalizeLegacyMemo converts legacy single-line memo into multi-item structure', () => {
  const legacy = {
    id: 'leg-1',
    memoNo: 'SBL-100',
    customerName: 'রহিম',
    quantity: 5000,
    rate: 13500,
    totalAmount: 67500,
    paidAmount: 50000,
    dueAmount: 17500,
  };
  const normalized = normalizeLegacyMemo(legacy);
  assert.equal(Array.isArray(normalized.items), true);
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].quantity, 5000);
  assert.equal(normalized.subTotal, 67500);
  assert.equal(normalized.dueAmount, 17500);
});

test('parseBanglaAgentIntent correctly routes all example Bengali voice commands', () => {
  // 1. "আজকের মোট বিক্রয় কত?"
  const t1 = parseBanglaAgentIntent('আজকের মোট বিক্রয় কত?', {});
  assert.equal(t1.intent, 'get_sales_summary');
  assert.equal(t1.dateScope, 'TODAY');

  // 2. "রহিমের নামে কত টাকা বাকি আছে?"
  const t2 = parseBanglaAgentIntent('রহিমের নামে কত টাকা বাকি আছে?', {});
  assert.equal(t2.intent, 'get_customer_balance');
  assert.equal(t2.customerName, 'রহিম');

  // 3. "আজ পাঁচ হাজার টাকার কয়লার খরচ যোগ করো।"
  const t3 = parseBanglaAgentIntent('আজ পাঁচ হাজার টাকার কয়লার খরচ যোগ করো।', {});
  assert.equal(t3.intent, 'create_expense');
  assert.equal(t3.amount, 5000);
  assert.equal(t3.category, 'কয়লা ক্রয়');

  // 4. "মেমো ১২৫ খুঁজে বের করো।"
  const t4 = parseBanglaAgentIntent('মেমো ১২৫ খুঁজে বের করো।', {});
  assert.equal(t4.intent, 'search_memo');
  assert.equal(t4.query, '125');

  // 5. "এই ক্রেতার মেমোতে দশ হাজার টাকা জমা করো।"
  const t5 = parseBanglaAgentIntent('এই ক্রেতার মেমোতে দশ হাজার টাকা জমা করো।', {
    lastReferencedCustomer: 'হাজী আব্দুল মান্নান',
  });
  assert.equal(t5.intent, 'record_payment');
  assert.equal(t5.amount, 10000);
  assert.equal(t5.customerName, 'হাজী আব্দুল মান্নান');

  // 6. "একটা নোট লিখে রাখো, কাল কয়লা আনতে হবে।"
  const t6 = parseBanglaAgentIntent('একটা নোট লিখে রাখো, কাল কয়লা আনতে হবে।', {});
  assert.equal(t6.intent, 'create_note');
  assert.ok(t6.noteText?.includes('কাল কয়লা আনতে হবে'));

  // 7. Explicit confirmation "হ্যাঁ, কনফার্ম করো"
  const t7 = parseBanglaAgentIntent('হ্যাঁ', {});
  assert.equal(t7.intent, 'CONFIRM_ACTION');
  const t8 = parseBanglaAgentIntent('বাতিল করো', {});
  assert.equal(t8.intent, 'CANCEL_ACTION');

  // 8. Multi-turn memo creation ("একটা নতুন মেমো তৈরি করো।" -> "হাজী করিম ২০০০ পিস")
  const t9 = parseBanglaAgentIntent('একটা নতুন মেমো তৈরি করো।', {});
  assert.equal(t9.intent, 'create_sales_memo');

  const t10 = parseBanglaAgentIntent('হাজী করিম ২০০০ পিস', {
    pendingMemoData: { gradeId: 'grade-1' },
  });
  assert.equal(t10.intent, 'create_sales_memo');
  assert.equal(t10.customerName, 'হাজী করিম');
  assert.equal(t10.quantity, 2000);

  const t10b = parseBanglaAgentIntent('রহিমের নামে ৫ হাজার ইটের মেমো করো।', {});
  assert.equal(t10b.intent, 'create_sales_memo');
  assert.equal(t10b.customerName, 'রহিম');
  assert.equal(t10b.quantity, 5000);

  // 9. Financial confirmation safety gate
  assert.equal(requiresSafeConfirmation({ actionType: 'ADD_EXPENSE', amount: 5000 }), true);
  assert.equal(requiresSafeConfirmation({ actionType: 'DELETE_MEMO' }), true);
});

test('Natural Bengali personality, pronoun resolution, and thinking before using tools', () => {
  // 1. Simple greeting does not trigger database tools
  const g1 = parseBanglaAgentIntent('হ্যালো কেমন আছো?', {});
  assert.equal(g1.intent, 'CONVERSATIONAL');
  assert.equal(g1.conversationalType, 'GREETING');

  // 2. "রহিমের কত টাকা বাকি?" -> get_customer_balance with customerName='রহিম'
  const r1 = parseBanglaAgentIntent('রহিমের কত টাকা বাকি?', {});
  assert.equal(r1.intent, 'get_customer_balance');
  assert.equal(r1.customerName, 'রহিম');

  // 3. Follow-up "সব মিলিয়ে মোট বকেয়াটাও বলে দাও" uses lastCustomerName from context
  const r2 = parseBanglaAgentIntent('সব মিলিয়ে মোট বকেয়াটাও বলে দাও', {
    lastCustomerName: 'রহিম',
    candidateMemoNumbers: ['BF-2026-102', 'BF-2026-108'],
  });
  assert.equal(r2.intent, 'get_customer_balance');
  assert.equal(r2.customerName, 'রহিম');
  assert.equal(r2.summaryMode, 'TOTAL');

  // 4. Reference "ওই মেমোটা দেখাও" resolves lastMemoNo from context
  const m1 = parseBanglaAgentIntent('ওই মেমোটা দেখাও', {
    lastMemoNo: 'BF-2026-125',
  });
  assert.equal(m1.intent, 'search_memo');
  assert.equal(m1.query, 'BF-2026-125');

  // 5. Reference "তার বাকি কত?" resolves lastCustomerName from context
  const c1 = parseBanglaAgentIntent('তার বাকি কত?', {
    lastCustomerName: 'হাজী আব্দুল মান্নান',
  });
  assert.equal(c1.intent, 'get_customer_balance');
  assert.equal(c1.customerName, 'হাজী আব্দুল মান্নান');

  // 6. Natural save instruction "এবার সেটা সেভ করো" triggers CONFIRM_ACTION
  const s1 = parseBanglaAgentIntent('এবার সেটা সেভ করো', {});
  assert.equal(s1.intent, 'CONFIRM_ACTION');

  // 7. Reference "আগের হিসাবটা দেখাও" resolves lastTopic
  const prev1 = parseBanglaAgentIntent('আগের হিসাবটা বলো', {
    lastTopic: 'EXPENSE',
    lastDateScope: 'TODAY',
  });
  assert.equal(prev1.intent, 'get_expense_summary');

  // 8. Alipro e-commerce style deep business analysis intent & calculation
  const a1 = parseBanglaAgentIntent('পুরো ব্যবসার অ্যানালাইসিস দাও।', {});
  assert.equal(a1.intent, 'analyze_business');

  const analysis = computeComprehensiveBusinessAnalysis(
    {
      settings: {
        bhataName: 'BrickFlow',
        tagline: 'SBL',
        proprietorName: 'কামরুল ইসলাম',
        phone1: '019',
        phone2: '017',
        address: 'সাতক্ষীরা',
        openingBalance: 100000,
        theme: 'light',
      },
      brickGrades: [
        {
          id: 'g-1',
          code: 'SBL-1',
          nameBn: '১ নং ইট',
          nameEn: 'Grade 1',
          ratePerUnit: 13.5,
          ratePerThousand: false,
          currentStock: 50000,
          seasonProduced: 100000,
        },
      ],
      salesMemos: [
        {
          id: 'm1',
          memoNo: 'BF-2026-125',
          date: '2026-10-21',
          customerName: 'রহিম',
          customerPhone: '017',
          customerAddress: 'সদর',
          truckNo: '১১',
          driverName: 'আলম',
          items: [
            {
              id: 'i1',
              gradeId: 'g-1',
              gradeName: '১ নং ইট',
              quantity: 10000,
              rate: 13.5,
              ratePerThousand: false,
              lineTotal: 135000,
            },
          ],
          subTotal: 135000,
          discount: 0,
          totalAmount: 135000,
          paidAmount: 100000,
          dueAmount: 35000,
          paymentMethod: 'নগদ ক্যাশ',
          status: 'PARTIAL',
          createdAt: '2026-10-21',
        },
      ],
      cashTransactions: [
        {
          id: 'tx1',
          date: '2026-10-21',
          type: 'IN',
          category: 'ইট বিক্রয় আদায়',
          amount: 100000,
          description: 'মেমো জমা',
          paymentMethod: 'নগদ ক্যাশ',
          verified: true,
          createdAt: '2026-10-21',
        },
      ],
    },
    '2026-10-21',
    '2026-10-20'
  );
  assert.equal(analysis.totalSalesRevenue, 135000);
  assert.equal(analysis.averageOrderValue, 135000);
  assert.equal(analysis.totalInventoryValuation, 675000);
  assert.ok(analysis.spokenExecutiveSummaryBn.includes('অ্যানালাইসিস'));
});

test('parseBanglaAgentIntent parses full PC/system voice control commands (print, scroll, stock add, attendance, navigation)', () => {
  const pPrint = parseBanglaAgentIntent('মেমো ১২৫ প্রিন্ট করো।', {});
  assert.equal(pPrint.intent, 'control_system_ui');
  assert.equal(pPrint.uiAction?.type, 'PRINT_MEMO');
  assert.equal(pPrint.uiAction?.memoNo, '125');

  const pScroll = parseBanglaAgentIntent('নিচে নামাও', {});
  assert.equal(pScroll.intent, 'control_system_ui');
  assert.equal(pScroll.uiAction?.type, 'SCROLL_DOWN');

  const pStock = parseBanglaAgentIntent('১০ হাজার ১ নং ইট স্টকে যোগ করো', {});
  assert.equal(pStock.intent, 'update_brick_stock_or_rate');
  assert.equal(pStock.quantity, 10000);
  assert.equal(pStock.gradeId, 'grade-1');

  const pAtt = parseBanglaAgentIntent('রফিকুল সর্দারের হাজিরা দাও', {});
  assert.equal(pAtt.intent, 'record_worker_attendance');
  assert.equal(pAtt.workerName, 'রফিকুল সর্দার');

  const pNav = parseBanglaAgentIntent('ক্যাশ বুক খোলো।', {});
  assert.equal(pNav.intent, 'navigate_to_tab');
  assert.equal(pNav.targetTab, 'cashbook');
  assert.equal(pNav.uiAction?.type, 'NAVIGATE_TAB');

  const pFilterMemos = parseBanglaAgentIntent('বকেয়া মেমো ফিল্টার করো।', {});
  assert.equal(pFilterMemos.intent, 'control_system_ui');
  assert.equal(pFilterMemos.uiAction?.type, 'FILTER_MEMOS');
  assert.equal(pFilterMemos.uiAction?.memoStatusFilter, 'DUE');

  const pFilterCash = parseBanglaAgentIntent('শুধু খরচের তালিকা দেখাও।', {});
  assert.equal(pFilterCash.intent, 'control_system_ui');
  assert.equal(pFilterCash.uiAction?.type, 'FILTER_CASHBOOK');
  assert.equal(pFilterCash.uiAction?.cashTypeFilter, 'OUT');

  const pKpiModal = parseBanglaAgentIntent('বিক্রয় রিপোর্ট খোলো।', {});
  assert.equal(pKpiModal.intent, 'control_system_ui');
  assert.equal(pKpiModal.uiAction?.type, 'OPEN_KPI_MODAL');
  assert.equal(pKpiModal.uiAction?.kpiId, 'TOTAL_BRICKS_SOLD');

  const pClearForm = parseBanglaAgentIntent('ফর্ম পরিষ্কার করো।', {});
  assert.equal(pClearForm.intent, 'control_system_ui');
  assert.equal(pClearForm.uiAction?.type, 'CLEAR_MEMO_FORM');

  const pOpening = parseBanglaAgentIntent('প্রারম্ভিক ব্যালেন্স ৫ লাখ টাকা সেট করো।', {});
  assert.equal(pOpening.intent, 'update_opening_balance');
  assert.equal(pOpening.amount, 500000);
});

test('computeKilnBrickPipelineSummary calculates raw produced, fired, remaining raw, paka produced, step-by-step delivered, and remaining paka stock', () => {
  const summary = computeKilnBrickPipelineSummary({
    millPots: [
      {
        id: 'p1',
        millId: 'ohab',
        millNameBn: 'ওহাব মিল',
        millNameEn: 'Ohab Mill',
        potNo: 'পট-০১',
        date: '2026-10-25',
        rawBricksCut: 100000,
        takenToChulli: 0,
        remainingRawBricks: 100000,
        ratePerThousand: 1200,
        totalPayable: 120000,
        paidAmount: 50000,
        dueAmount: 70000,
        createdAt: '2026-10-25',
      },
    ],
    chulliLoads: [
      {
        id: 'l1',
        date: '2026-10-25',
        sardarName: 'সেলিম সর্দার',
        rawBricksLoaded: 60000,
        vanCount: 600,
        ratePerVan: 11.5,
        totalBill: 6900,
        paidAmount: 0,
        dueAmount: 6900,
        createdAt: '2026-10-25',
      },
    ],
    poraiMistriRecords: [
      {
        id: 'pm1',
        date: '2026-10-25',
        mistriName: 'আলী হোসেন',
        chamberOrRound: 'রাউন্ড-০১',
        bricksFired: 60000,
        ratePerThousand: 400,
        totalBill: 24000,
        paidAmount: 0,
        dueAmount: 24000,
        createdAt: '2026-10-25',
      },
    ],
    chulliUnloads: [
      {
        id: 'u1',
        date: '2026-10-25',
        chamberOrRound: 'রাউন্ড-০১',
        sardarName: 'রহিম সর্দার',
        unloadedByGrade: [{ gradeId: 'grade-1', gradeName: '১ নং ইট', quantity: 50000 }],
        totalBricksUnloaded: 50000,
        ratePerThousand: 750,
        totalBill: 37500,
        paidAmount: 0,
        dueAmount: 37500,
        createdAt: '2026-10-25',
      },
    ],
    brickGrades: [
      {
        id: 'grade-1',
        code: 'BF-1',
        nameBn: '১ নং ইট',
        nameEn: '1 No Brick',
        ratePerUnit: 11000,
        ratePerThousand: true,
        currentStock: 40000,
        seasonProduced: 50000,
      },
    ],
    salesMemos: [
      {
        id: 'm3001',
        memoNo: '3001',
        date: '2026-10-25',
        customerName: 'আলহাজ্ব করিম সাহেব',
        customerPhone: '01711000000',
        customerAddress: 'সাতক্ষীরা',
        truckNo: '১১-২২৩৩',
        driverName: 'রহমান',
        items: [
          {
            id: 'it-1',
            gradeId: 'grade-1',
            gradeName: '১ নং ইট',
            quantity: 10000,
            rate: 11000,
            ratePerThousand: true,
            lineTotal: 110000,
          },
        ],
        subTotal: 110000,
        discount: 0,
        totalAmount: 110000,
        paidAmount: 50000,
        dueAmount: 60000,
        paymentMethod: 'নগদ ক্যাশ',
        status: 'PARTIAL',
        createdAt: '2026-10-25',
        deliveredQuantity: 6500,
        remainingDeliveryQuantity: 3500,
        deliveryStatus: 'PARTIAL',
        deliveryHistory: [
          {
            id: 'del-1',
            memoId: 'm3001',
            memoNo: '3001',
            customerName: 'আলহাজ্ব করিম সাহেব',
            customerPhone: '01711000000',
            date: '2026-10-25',
            gradeId: 'grade-1',
            gradeName: '১ নং ইট',
            quantity: 4000,
            truckNo: '১১-২২৩৩',
            driverName: 'রহমান',
            note: '১ম ট্রিপ ডেলিভারি',
            createdAt: '2026-10-25',
          },
          {
            id: 'del-2',
            memoId: 'm3001',
            memoNo: '3001',
            customerName: 'আলহাজ্ব করিম সাহেব',
            customerPhone: '01711000000',
            date: '2026-10-25',
            gradeId: 'grade-1',
            gradeName: '১ নং ইট',
            quantity: 2500,
            truckNo: '১১-২২৩৩',
            driverName: 'রহমান',
            note: '২য় ট্রিপ ডেলিভারি',
            createdAt: '2026-10-25',
          },
        ],
      },
    ],
  });

  assert.equal(summary.rawBricksProduced, 100000);
  assert.equal(summary.firedOrLoadedBricks, 60000);
  assert.equal(summary.currentRawBricks, 40000);
  assert.equal(summary.totalPakaProduced, 50000);
  assert.equal(summary.totalMemoOrderedBricks, 10000);
  assert.equal(summary.totalDeliveredBricks, 6500);
  assert.equal(summary.totalPendingDeliveryBricks, 3500);
  assert.equal(summary.currentAvailablePakaBricks, 43500);
});

test('calculateVanLoadBill computes Van Load bill per 1,000 bricks and normalizes legacy per-100 rates', () => {
  // 10,000 bricks at 115 Tk per 1,000 pcs = 1,150 Tk
  const res1 = calculateVanLoadBill(10000, 115);
  assert.equal(res1.ratePerThousand, 115);
  assert.equal(res1.thousandUnits, 10);
  assert.equal(res1.totalBill, 1150);

  // 10,000 bricks at 130 Tk per 1,000 pcs = 1,300 Tk
  const res2 = calculateVanLoadBill(10000, 130);
  assert.equal(res2.ratePerThousand, 130);
  assert.equal(res2.totalBill, 1300);

  // 15,000 bricks at 120 Tk per 1,000 pcs = 1,800 Tk
  const res3 = calculateVanLoadBill(15000, 120);
  assert.equal(res3.ratePerThousand, 120);
  assert.equal(res3.totalBill, 1800);

  // Legacy per-100 rate (11.5 Tk) automatically normalizes to 115 Tk per 1,000 pcs
  const legacy = calculateVanLoadBill(10000, 11.5);
  assert.equal(legacy.ratePerThousand, 115);
  assert.equal(legacy.totalBill, 1150);

  // Raw + Chamber Setup Paka Bricks: 3,500 raw + 500 paka = 4,000 total bricks (1 full line) @ 350 Tk/thousand = 1,400 Tk
  const dualLoad = calculateVanLoadBill(3500, 350, 500);
  assert.equal(dualLoad.rawBricksLoaded, 3500);
  assert.equal(dualLoad.pakaBricksLoaded, 500);
  assert.equal(dualLoad.totalBricksLoaded, 4000);
  assert.equal(dualLoad.fullLines, 1);
  assert.equal(dualLoad.partialBricks, 0);
  assert.equal(dualLoad.ratePerThousand, 350);
  assert.equal(dualLoad.totalBill, 1400); // Sardar is paid for all 4,000 bricks!
});

test('computeSevenDayLiquidityHealth calculates 7-day Net Cash Movement (Collections minus Expenses) and liquidity gauge', () => {
  const txList: CashTransaction[] = [
    {
      id: 'tx-1',
      date: '2026-10-25',
      type: 'IN',
      category: 'ইট বিক্রয় আদায়',
      amount: 80000,
      description: 'ক্যাশ মেমো আদায়',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: '2026-10-25',
    },
    {
      id: 'tx-2',
      date: '2026-10-25',
      type: 'OUT',
      category: 'কয়লা ক্রয়',
      amount: 30000,
      description: 'কয়লা খরচ',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: '2026-10-25',
    },
    {
      id: 'tx-3',
      date: '2026-10-28',
      type: 'OUT',
      category: 'শ্রমিক ও সর্দার পেমেন্ট',
      amount: 25000,
      description: 'হাটবার পেমেন্ট',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: '2026-10-28',
    },
    {
      id: 'tx-4',
      date: '2026-10-31',
      type: 'IN',
      category: 'বকেয়া আদায়',
      amount: 95000,
      description: 'বকেয়া আদায়',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: '2026-10-31',
    },
    {
      id: 'tx-5',
      date: '2026-10-31',
      type: 'OUT',
      category: 'ভেকু ও ডিজেল',
      amount: 15000,
      description: 'ডিজেল ক্রয়',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      createdAt: '2026-10-31',
    },
  ];

  const report = computeSevenDayLiquidityHealth(txList, 50000, '2026-10-31');

  assert.equal(report.days.length, 7);
  assert.equal(report.days[0].date, '2026-10-25');
  assert.equal(report.days[0].collections, 80000);
  assert.equal(report.days[0].expenses, 30000);
  assert.equal(report.days[0].netCashMovement, 50000);

  // 2026-10-28 (index 3): 0 collections - 25,000 expenses = -25,000
  assert.equal(report.days[3].date, '2026-10-28');
  assert.equal(report.days[3].netCashMovement, -25000);

  // 2026-10-31 (index 6): 95,000 collections - 15,000 expenses = +80,000
  assert.equal(report.days[6].date, '2026-10-31');
  assert.equal(report.days[6].netCashMovement, 80000);

  // 7-day totals: Collections = 175,000, Expenses = 70,000, Net = +105,000
  assert.equal(report.total7dCollections, 175000);
  assert.equal(report.total7dExpenses, 70000);
  assert.equal(report.total7dNetCashMovement, 105000);
  assert.equal(report.currentCashBalance, 155000); // 50k opening + 175k - 70k
  assert.ok(report.gaugeScore >= 75);
  assert.equal(report.statusLevel, 'STRONG');
});

test('calculateWoodFuelBill and computeWoodFuelSupplierSummary handle multiple wood suppliers with different rates and daily deliveries', () => {
  // Supplier 1: Jalil Bepari at 220 Tk/Maund, 150 Maunds = 33,000 Tk, paid 20,000 -> due 13,000
  const bill1 = calculateWoodFuelBill(150, 220, 20000);
  assert.equal(bill1.totalBill, 33000);
  assert.equal(bill1.paidAmount, 20000);
  assert.equal(bill1.dueAmount, 13000);
  assert.equal(bill1.status, 'PARTIAL');

  // Supplier 2: Karim Wood Supplier at 250 Tk/Maund, 100 Maunds = 25,000 Tk, paid 25,000 -> due 0
  const bill2 = calculateWoodFuelBill(100, 250, 25000);
  assert.equal(bill2.totalBill, 25000);
  assert.equal(bill2.dueAmount, 0);
  assert.equal(bill2.status, 'PAID');

  const records: WoodFuelRecord[] = [
    {
      id: 'wf-1',
      date: '2026-10-29',
      supplierName: 'জলিল ব্যাপারী',
      supplierPhone: '01711-223344',
      woodType: 'গজারি কাঠ',
      vehicleOrChallan: 'ট্রাক-০১',
      quantity: 150,
      unit: 'মণ',
      ratePerUnit: 220,
      totalBill: 33000,
      paidAmount: 20000,
      dueAmount: 13000,
      createdAt: '2026-10-29T10:00:00Z',
    },
    {
      id: 'wf-2',
      date: '2026-10-30',
      supplierName: 'করিম কাঠ সাপ্লায়ার',
      supplierPhone: '01819-556677',
      woodType: 'তেঁতুল ও বাবলা কাঠ',
      vehicleOrChallan: 'ভ্যান-০২',
      quantity: 100,
      unit: 'মণ',
      ratePerUnit: 250,
      totalBill: 25000,
      paidAmount: 25000,
      dueAmount: 0,
      createdAt: '2026-10-30T11:00:00Z',
    },
    {
      id: 'wf-3',
      date: '2026-10-31',
      supplierName: 'জলিল ব্যাপারী',
      supplierPhone: '01711-223344',
      woodType: 'আম ও কড়ই কাঠ',
      vehicleOrChallan: 'ট্রাক-০৫',
      quantity: 200,
      unit: 'মণ',
      ratePerUnit: 230, // Updated rate for second delivery
      totalBill: 46000,
      paidAmount: 16000,
      dueAmount: 30000,
      createdAt: '2026-10-31T09:00:00Z',
    },
  ];

  const summary = computeWoodFuelSupplierSummary(records);
  assert.equal(summary.totalDeliveries, 3);
  assert.equal(summary.uniqueSuppliersCount, 2);
  assert.equal(summary.totalMaundEquivalent, 450);
  assert.equal(summary.totalBillAmount, 104000); // 33k + 25k + 46k
  assert.equal(summary.totalPaidAmount, 61000); // 20k + 25k + 16k
  assert.equal(summary.totalDueAmount, 43000); // 13k + 0 + 30k

  const jalil = summary.suppliers.find((s) => s.supplierName === 'জলিল ব্যাপারী');
  assert.ok(jalil);
  assert.equal(jalil.deliveryCount, 2);
  assert.equal(jalil.totalQuantity, 350);
  assert.equal(jalil.latestRate, 230);
  assert.deepEqual(jalil.distinctRates, [230, 220]);
  assert.equal(jalil.totalBill, 79000);
  assert.equal(jalil.totalPaid, 36000);
  assert.equal(jalil.totalDue, 43000);
});

test('5 advanced kiln ledgers (Soil/Coal, Dadon Reconciliation, Advance Booking & Party Statement, Vehicle Diesel, Compliance) calculate accurately', () => {
  // 1. Soil & Coal Supplier Ledger
  const scBill = calculateSoilCoalBill(10, 2400, 15000);
  assert.equal(scBill.totalBill, 24000);
  assert.equal(scBill.dueAmount, 9000);
  assert.equal(scBill.status, 'PARTIAL');

  const scRecords: SoilCoalRecord[] = [
    {
      id: 'sc-1',
      date: '2026-10-30',
      itemType: 'SOIL',
      supplierName: 'রহমান মাটি সাপ্লায়ার',
      specification: 'এঁটেল মাটি',
      quantity: 10,
      unit: 'গাড়ি (ট্রাক/ট্রলি)',
      ratePerUnit: 2400,
      totalBill: 24000,
      paidAmount: 15000,
      dueAmount: 9000,
      createdAt: '2026-10-30T10:00:00Z',
    },
    {
      id: 'sc-2',
      date: '2026-10-31',
      itemType: 'COAL',
      supplierName: 'সাতক্ষীরা কোল ট্রেডার্স',
      specification: 'ইন্দোনেশিয়ান কয়লা',
      quantity: 5,
      unit: 'টন',
      ratePerUnit: 22000,
      totalBill: 110000,
      paidAmount: 60000,
      dueAmount: 50000,
      createdAt: '2026-10-31T10:00:00Z',
    },
  ];
  const scSummary = computeSoilCoalSummary(scRecords);
  assert.equal(scSummary.soilTotalBill, 24000);
  assert.equal(scSummary.coalTotalBill, 110000);
  assert.equal(scSummary.grandTotalBill, 134000);
  assert.equal(scSummary.grandTotalDue, 59000);

  // 2. Sardar & Mistri Dadon Reconciliation
  const dadonSummary = computeDadonReconciliationSummary({
    dadonRecords: [
      {
        id: 'd-1',
        date: '2026-10-01',
        recipientName: 'ওহাব মিল সর্দার',
        roleCategory: 'মিল সর্দার',
        advanceAmount: 50000,
        manualWorkBill: 5000,
        cashReturnedOrSettled: 0,
        createdAt: '2026-10-01T10:00:00Z',
      },
    ],
    millPots: [
      {
        id: 'mp-1',
        millId: 'ohab',
        millNameBn: 'ওহাবের মিল',
        millNameEn: 'Ohab Mill',
        potNo: 'পট-০১',
        date: '2026-10-20',
        rawBricksCut: 30000,
        takenToChulli: 0,
        remainingRawBricks: 30000,
        ratePerThousand: 1000,
        totalPayable: 30000,
        paidAmount: 0,
        dueAmount: 30000,
        createdAt: '2026-10-20T10:00:00Z',
      },
    ],
  });
  assert.equal(dadonSummary.totalDadonGiven, 50000);
  assert.equal(dadonSummary.totalWorkBillEarned, 35000); // 30k auto + 5k manual
  assert.equal(dadonSummary.totalDadonAdjusted, 35000);
  assert.equal(dadonSummary.totalUnrecoveredDadon, 15000);

  // 3. Advance Brick Booking & Customer Party Statement
  const bkCalc = calculateAdvanceBookingBill(20000, 10500, 150000, 8000);
  assert.equal(bkCalc.totalAmount, 210000);
  assert.equal(bkCalc.dueAmount, 60000);
  assert.equal(bkCalc.remainingBricks, 12000);
  assert.equal(bkCalc.status, 'PARTIAL_DELIVERED');

  const bookings: AdvanceBrickBooking[] = [
    {
      id: 'bk-1',
      bookingNo: 'BK-4001',
      date: '2026-10-15',
      deliveryTargetDate: '2026-11-15',
      customerName: 'আলহাজ্ব রফিকুল ইসলাম',
      customerPhone: '01711-998877',
      gradeId: 'grade-1',
      gradeName: '১ নং ইট',
      bookedQuantity: 20000,
      ratePerThousand: 10500,
      totalAmount: 210000,
      advancePaid: 150000,
      dueAmount: 60000,
      deliveredQuantity: 8000,
      status: 'PARTIAL_DELIVERED',
      createdAt: '2026-10-15T10:00:00Z',
    },
  ];
  const partyReport = computeCustomerPartyStatements([], bookings);
  assert.equal(partyReport.totalBookedBricks, 20000);
  assert.equal(partyReport.totalBookingRemainingBricks, 12000);
  assert.equal(partyReport.parties[0]?.pendingBricksToDeliver, 12000);
  assert.equal(partyReport.parties[0]?.totalDueAmount, 60000);

  // 4. Vehicle, Veku & Diesel Tracker
  const vdCalc = calculateVehicleDieselExpense(40, 110, 600, 1000);
  assert.equal(vdCalc.dieselCost, 4400);
  assert.equal(vdCalc.totalExpense, 6000);
  const vdRecords: VehicleDieselRecord[] = [
    {
      id: 'vd-1',
      date: '2026-10-31',
      vehicleName: 'ভেকু-০১',
      vehicleType: 'ভেকু (Excavator)',
      driverName: 'হাসান ড্রাইভার',
      workOrTripSummary: '৮ ঘণ্টা মাটি কাটা',
      ...vdCalc,
      createdAt: '2026-10-31T10:00:00Z',
    },
  ];
  const vdSummary = computeVehicleDieselSummary(vdRecords);
  assert.equal(vdSummary.totalDieselLiters, 40);
  assert.equal(vdSummary.totalExpense, 6000);

  // 5. Kiln Compliance & Installment Tracker
  const compCalc = calculateComplianceItemBill(50000, 20000);
  assert.equal(compCalc.dueAmount, 30000);
  assert.equal(compCalc.status, 'PARTIAL');
  const compRecords: ComplianceInstallmentRecord[] = [
    {
      id: 'c-1',
      titleBn: 'পরিবেশ অধিদপ্তর নবায়ন ফি',
      category: 'পরিবেশ অধিদপ্তর ছাড়পত্র (DoE)',
      authorityOrBankName: 'পরিবেশ অধিদপ্তর, সাতক্ষীরা',
      dueDate: '2026-10-15',
      ...compCalc,
      createdAt: '2026-10-01T10:00:00Z',
    },
  ];
  const compSummary = computeComplianceSummary(compRecords, '2026-10-31');
  assert.equal(compSummary.totalDue, 30000);
  assert.equal(compSummary.overdueCount, 1);
});

test('Chulli Line Unload (1 Line = 4000 bricks @ 750 Tk) and automatic Grade/Adla sales reconciliation work accurately', () => {
  // 10 lines unloaded -> 40,000 bricks, bill = 10 * 750 = 7,500 Tk
  const lineBill = calculateChulliLineUnloadBill(10, 750, 4000, 5000);
  assert.equal(lineBill.linesUnloaded, 10);
  assert.equal(lineBill.totalBricksUnloaded, 40000);
  assert.equal(lineBill.totalBill, 7500);
  assert.equal(lineBill.equivalentRatePerThousand, 187.5);
  assert.equal(lineBill.dueAmount, 2500);

  const unloads: ChulliUnloadRecord[] = [
    {
      id: 'un-1',
      date: '2026-10-31',
      chamberOrRound: 'রাউন্ড-০১',
      sardarName: 'রহিম আনলোড সর্দার',
      linesUnloaded: 10,
      bricksPerLine: 4000,
      ratePerLine: 750,
      unloadedByGrade: [],
      totalBricksUnloaded: 40000,
      ratePerThousand: 187.5,
      totalBill: 7500,
      paidAmount: 5000,
      dueAmount: 2500,
      createdAt: '2026-10-31T10:00:00Z',
    },
  ];

  const memos: SalesMemo[] = [
    {
      id: 'm-1',
      memoNo: '3001',
      date: '2026-10-31',
      customerName: 'হাজী করিম',
      customerPhone: '০১৭১১-২২৩৩৪৪',
      customerAddress: 'সাতক্ষীরা সদর',
      truckNo: '১১-২০৪৫',
      driverName: 'আলম',
      duePromiseDate: '2026-10-25',
      items: [
        {
          id: 'i-1',
          gradeId: 'grade-1',
          gradeName: '১ নং ইট',
          quantity: 15000,
          rate: 11000,
          ratePerThousand: true,
          lineTotal: 165000,
        },
        {
          id: 'i-2',
          gradeId: 'grade-picket',
          gradeName: 'পিকেট ইট',
          quantity: 5000,
          rate: 11000,
          ratePerThousand: true,
          lineTotal: 55000,
        },
        {
          id: 'i-3',
          gradeId: 'grade-adla',
          gradeName: 'আদলা ও ড্যামেজ ইট',
          quantity: 4000,
          rate: 6000,
          ratePerThousand: true,
          lineTotal: 24000,
        },
      ],
      subTotal: 244000,
      discount: 0,
      totalAmount: 244000,
      paidAmount: 200000,
      dueAmount: 44000,
      paymentMethod: 'নগদ ক্যাশ',
      status: 'PARTIAL',
      createdAt: '2026-10-31T10:00:00Z',
    },
  ];

  const recon = computeUnloadLineAndSalesReconciliation(unloads, memos, []);
  assert.equal(recon.totalLinesUnloaded, 10);
  assert.equal(recon.totalBricksFromLines, 40000);
  assert.equal(recon.totalUnloadBill, 7500);
  assert.equal(recon.totalSoldBricksAllGrades, 24000);
  assert.equal(recon.totalSoldRevenueAllGrades, 244000);
  assert.equal(recon.totalAdlaAndDamageSoldQty, 4000);
  assert.equal(recon.totalAdlaAndDamageSoldRevenue, 24000);
  assert.equal(recon.remainingUnreconciledOrStockBricks, 16000);
});

test('Estimated Per-1000 Brick Cost, Due Tagada WhatsApp Reminder, and Daily Closing & Goal Tracker work accurately', () => {
  const sampleState = {
    settings: {
      bhataName: 'BrickFlow ইটভাটা',
      tagline: '',
      proprietorName: 'মোঃ কামরুল ইসলাম',
      phone1: '01913678010',
      phone2: '',
      address: 'সাতক্ষীরা',
      openingBalance: 100000,
      theme: 'light' as const,
      dailyGoals: {
        rawBricksCutTarget: 40000,
        bricksSoldTarget: 20000,
        cashCollectionTarget: 150000,
        unloadLinesTarget: 10,
      },
    },
    millPots: [
      {
        id: 'mp-1',
        millId: 'ohab' as const,
        millNameBn: 'ওহাব মিল',
        millNameEn: 'Ohab Mill',
        potNo: 'পট-০১',
        date: '2026-10-31',
        rawBricksCut: 40000,
        takenToChulli: 0,
        remainingRawBricks: 40000,
        ratePerThousand: 1200,
        totalPayable: 48000,
        paidAmount: 20000,
        dueAmount: 28000,
        createdAt: '2026-10-31T10:00:00Z',
      },
    ],
    chulliUnloads: [
      {
        id: 'un-1',
        date: '2026-10-31',
        chamberOrRound: 'রাউন্ড-০১',
        sardarName: 'রহিম সর্দার',
        linesUnloaded: 10,
        bricksPerLine: 4000,
        ratePerLine: 750,
        unloadedByGrade: [],
        totalBricksUnloaded: 40000,
        ratePerThousand: 187.5,
        totalBill: 7500,
        paidAmount: 7500,
        dueAmount: 0,
        createdAt: '2026-10-31T10:00:00Z',
      },
    ],
    salesMemos: [
      {
        id: 'm-1',
        memoNo: '3005',
        date: '2026-10-31',
        customerName: 'হাজী আব্দুল মান্নান',
        customerPhone: '০১৭১২-৩৪৫৬৭৮',
        customerAddress: 'সাতক্ষীরা',
        truckNo: '১১-২০৪৫',
        driverName: 'আলম',
        duePromiseDate: '2026-10-20',
        items: [
          {
            id: 'i-1',
            gradeId: 'grade-1',
            gradeName: '১ নং ইট',
            quantity: 20000,
            rate: 11000,
            ratePerThousand: true,
            lineTotal: 220000,
          },
        ],
        subTotal: 220000,
        discount: 0,
        totalAmount: 220000,
        paidAmount: 160000,
        dueAmount: 60000,
        paymentMethod: 'নগদ ক্যাশ' as const,
        status: 'PARTIAL' as const,
        createdAt: '2026-10-31T10:00:00Z',
      },
    ],
    cashTransactions: [
      {
        id: 'tx-1',
        date: '2026-10-31',
        type: 'IN' as const,
        category: 'ইট বিক্রয় আদায়',
        amount: 160000,
        description: 'মেমো #3005 জমা',
        paymentMethod: 'নগদ ক্যাশ' as const,
        verified: true,
        createdAt: '2026-10-31T10:00:00Z',
      },
      {
        id: 'tx-2',
        date: '2026-10-31',
        type: 'OUT' as const,
        category: 'শ্রমিক ও সর্দার পেমেন্ট',
        amount: 27500,
        description: 'মিল ও আনলোড পেমেন্ট',
        paymentMethod: 'নগদ ক্যাশ' as const,
        verified: true,
        createdAt: '2026-10-31T10:00:00Z',
      },
    ],
  };

  // 1. Estimated Per-1000 Brick Cost
  const costEst = computeEstimatedPerThousandBrickCost(sampleState, {
    soilCostPerThousand: 1000,
    coalWoodCostPerThousand: 3000,
    otherOverheadPerThousand: 500,
  });
  assert.equal(costEst.components.mill.effectiveRatePerThousand, 1200);
  assert.equal(costEst.components.unload.effectiveRatePerThousand, 187.5);
  assert.ok(costEst.estimatedCostPerThousand > 5000);
  assert.equal(costEst.averageSellingRatePerThousand, 11000);
  assert.ok(costEst.estimatedProfitPerThousand > 0);

  // 2. Due Tagada & WhatsApp
  assert.equal(normalizeBangladeshWhatsAppPhone('০১৭১২-৩৪৫৬৭৮'), '8801712345678');
  const tagada = computeDueTagadaList(sampleState.salesMemos, [], '2026-10-31', 'BrickFlow ইটভাটা');
  assert.equal(tagada.items.length, 1);
  assert.equal(tagada.totalDueAmount, 60000);
  assert.equal(tagada.overdueCount, 1);
  assert.equal(tagada.items[0].daysOverdue, 11);
  assert.ok(tagada.items[0].whatsAppUrl.startsWith('https://wa.me/8801712345678?text='));

  // 3. Daily Closing Sheet & Goal Tracker
  const closing = computeDailyClosingSheet(sampleState, '2026-10-31');
  assert.equal(closing.openingCashForDay, 100000);
  assert.equal(closing.todayCashIn, 160000);
  assert.equal(closing.todayCashOut, 27500);
  assert.equal(closing.closingCashForDay, 232500);
  assert.equal(closing.todayUnloadLines, 10);
  assert.equal(closing.todayUnloadBricks, 40000);

  const goals = computeDailyGoalProgress(sampleState, '2026-10-31');
  assert.equal(goals.achievedCount, 4);
  assert.equal(goals.overallCompletionPct, 100);
});

test('computeDailyMillProductionGoal calculates overall and per-mill daily production progress from millPots accurately', () => {
  const millPots: MillPotRecord[] = [
    {
      id: 'mp-1',
      millId: 'ohab',
      millNameBn: 'ওহাব মিল',
      millNameEn: 'Ohab Mill',
      potNo: 'পট-০১',
      date: '2026-10-31',
      rawBricksCut: 18000,
      takenToChulli: 6000,
      remainingRawBricks: 12000,
      ratePerThousand: 1200,
      totalPayable: 21600,
      paidAmount: 15000,
      dueAmount: 6600,
      createdAt: '2026-10-31T08:00:00Z',
    },
    {
      id: 'mp-2',
      millId: 'mofijul',
      millNameBn: 'মফিজুল মিল',
      millNameEn: 'Mofijul Mill',
      potNo: 'পট-০২',
      date: '2026-10-31',
      rawBricksCut: 12000,
      takenToChulli: 4000,
      remainingRawBricks: 8000,
      ratePerThousand: 1200,
      totalPayable: 14400,
      paidAmount: 10000,
      dueAmount: 4400,
      createdAt: '2026-10-31T09:00:00Z',
    },
    {
      id: 'mp-prev',
      millId: 'sofikul',
      millNameBn: 'শফিকুল মিল',
      millNameEn: 'Sofikul Mill',
      potNo: 'পট-০১',
      date: '2026-10-30',
      rawBricksCut: 15000,
      takenToChulli: 5000,
      remainingRawBricks: 10000,
      ratePerThousand: 1200,
      totalPayable: 18000,
      paidAmount: 18000,
      dueAmount: 0,
      createdAt: '2026-10-30T09:00:00Z',
    },
  ];

  const report = computeDailyMillProductionGoal(millPots, '2026-10-31', {
    rawBricksCutTarget: 50000,
    millDailyTargets: {
      ohab: 18000,
      mofijul: 17000,
      sofikul: 15000,
    },
  });

  assert.equal(report.dailyTargetBricks, 50000);
  assert.equal(report.currentProductionBricks, 30000);
  assert.equal(report.remainingBricks, 20000);
  assert.equal(report.progressPct, 60);
  assert.equal(report.status, 'ON_TRACK');
  assert.equal(report.todayPotsCount, 2);
  assert.equal(report.seasonTotalBricksCut, 45000);

  const ohab = report.millBreakdown.find((m) => m.millId === 'ohab');
  const mofijul = report.millBreakdown.find((m) => m.millId === 'mofijul');
  const sofikul = report.millBreakdown.find((m) => m.millId === 'sofikul');

  assert.equal(ohab?.progressPct, 100);
  assert.equal(ohab?.status, 'ACHIEVED');
  assert.equal(mofijul?.currentBricksCut, 12000);
  assert.equal(mofijul?.status, 'ON_TRACK');
  assert.equal(sofikul?.currentBricksCut, 0);
  assert.equal(sofikul?.seasonTotalBricksCut, 15000);
  assert.equal(sofikul?.status, 'NOT_STARTED');
});

test('calculateSardarFridaySettlement deducts mid-week Khoraki and settles Friday final bill accurately', () => {
  // Mid-week Khoraki: Total bill 60,000, prior paid 10,000, giving 5,000 Khoraki
  const khorakiStep = calculateSardarFridaySettlement(60000, 10000, 5000, 'KHORAKI');
  assert.equal(khorakiStep.totalBill, 60000);
  assert.equal(khorakiStep.priorKhorakiOrPaid, 10000);
  assert.equal(khorakiStep.fridayNetPayableBefore, 50000);
  assert.equal(khorakiStep.appliedPayment, 5000);
  assert.equal(khorakiStep.newTotalPaid, 15000);
  assert.equal(khorakiStep.remainingFridayDue, 45000);
  assert.equal(khorakiStep.isFullyPaid, false);
  assert.ok(khorakiStep.defaultNoteBn.includes('খোরাকি'));

  // Friday Final Settlement: Pay remaining 45,000
  const fridayStep = calculateSardarFridaySettlement(
    60000,
    khorakiStep.newTotalPaid,
    khorakiStep.remainingFridayDue,
    'FRIDAY_FINAL'
  );
  assert.equal(fridayStep.fridayNetPayableBefore, 45000);
  assert.equal(fridayStep.newTotalPaid, 60000);
  assert.equal(fridayStep.remainingFridayDue, 0);
  assert.equal(fridayStep.isFullyPaid, true);
  assert.ok(fridayStep.defaultNoteBn.includes('শুক্রবারের'));

  // Overpayment scenario: Bill 10,000, but took 11,000 -> enters Dina 1,000!
  const overpay = calculateSardarFridaySettlement(10000, 0, 11000, 'FRIDAY_FINAL');
  assert.equal(overpay.totalBill, 10000);
  assert.equal(overpay.appliedPayment, 11000);
  assert.equal(overpay.remainingFridayDue, 0);
  assert.equal(overpay.isDina, true);
  assert.equal(overpay.dinaAmount, 1000);
  assert.ok(overpay.defaultNoteBn.includes('দিনায়'));
});

test('computeWorkerBalanceWithDina and computeNewWorkWithDinaAdjustment correctly track Dina overdrawn balance and deduct from subsequent work bills', () => {
  // Step 1: Worker has bill 10,000, takes 11,000 -> Dina = 1,000
  const b1 = computeWorkerBalanceWithDina(10000, 11000);
  assert.equal(b1.isDina, true);
  assert.equal(b1.dinaAmount, 1000);
  assert.equal(b1.balanceDue, 0);

  // Step 2: Next time worker cuts new bricks worth 15,000 Tk -> 1,000 Dina is deducted, net payable is 14,000 Tk!
  const adj1 = computeNewWorkWithDinaAdjustment(15000, b1.dinaAmount, 0);
  assert.equal(adj1.newWorkBill, 15000);
  assert.equal(adj1.priorDina, 1000);
  assert.equal(adj1.dinaDeductedFromNewWork, 1000);
  assert.equal(adj1.netPayableAfterDina, 14000);
  assert.equal(adj1.remainingDina, 0);
  assert.equal(adj1.finalDueAmount, 14000);

  // Step 3: Now we pay 10,000 Tk out of 14,000 Tk -> remaining due = 4,000 Tk
  const adj2 = computeNewWorkWithDinaAdjustment(15000, 1000, 10000);
  assert.equal(adj2.netPayableAfterDina, 14000);
  assert.equal(adj2.appliedPayment, 10000);
  assert.equal(adj2.finalDueAmount, 4000);
  assert.equal(adj2.finalNewDina, 0);

  // Step 4: What if new work bill (600 Tk) is LESS than Dina (1,000 Tk)?
  // 600 is absorbed by Dina, leaving 400 Tk Dina remaining!
  const adj3 = computeNewWorkWithDinaAdjustment(600, 1000, 0);
  assert.equal(adj3.newWorkBill, 600);
  assert.equal(adj3.dinaDeductedFromNewWork, 600);
  assert.equal(adj3.netPayableAfterDina, 0);
  assert.equal(adj3.remainingDina, 400);
  assert.equal(adj3.finalNewDina, 400);
  assert.equal(adj3.finalDueAmount, 0);
});

test('buildQuickCashTransactionPayload builds validated quick expense and income payloads with smart defaults', () => {
  // 1. Small quick expense with Bengali digits and default note
  const outRes = buildQuickCashTransactionPayload({
    type: 'OUT',
    amountInput: '২০০',
  });
  assert.equal(outRes.valid, true);
  assert.equal(outRes.payload?.type, 'OUT');
  assert.equal(outRes.payload?.category, 'অফিস ও আপ্যায়ন');
  assert.equal(outRes.payload?.amount, 200);
  assert.equal(outRes.payload?.paymentMethod, 'নগদ ক্যাশ');
  assert.ok(outRes.payload?.description.includes('কুইক খরচ এন্ট্রি'));

  // 2. Quick income entry with custom category and custom note
  const inRes = buildQuickCashTransactionPayload({
    type: 'IN',
    category: 'ইট বিক্রয় আদায়',
    amountInput: 1500,
    noteInput: 'খুচরা ২০০ পিস ইট বিক্রি',
    paymentMethod: 'বিকাশ / নগদ অ্যাপ',
  });
  assert.equal(inRes.valid, true);
  assert.equal(inRes.payload?.type, 'IN');
  assert.equal(inRes.payload?.category, 'ইট বিক্রয় আদায়');
  assert.equal(inRes.payload?.amount, 1500);
  assert.equal(inRes.payload?.description, 'খুচরা ২০০ পিস ইট বিক্রি');
  assert.equal(inRes.payload?.paymentMethod, 'বিকাশ / নগদ অ্যাপ');

  // 3. Invalid zero or negative amount is rejected
  const invalidRes = buildQuickCashTransactionPayload({
    type: 'OUT',
    amountInput: 0,
  });
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.errorBn);
});

test('computeFeedKilnLineSystemStatus calculates 208-line fixed chimney capacity, dampers, front load buffer, and fireman shirking alert', () => {
  const defaultSystem = createDefaultFeedKilnLineSystem();
  assert.equal(defaultSystem.fireStartLineNo, 1);

  const status = computeFeedKilnLineSystemStatus({
    ...defaultSystem,
    firedLinesCompleted: 18,
    activeFiringLinesCount: 5,
    rawLinesLoadedAhead: 15,
  });

  // 208 lines * 4,000 bricks = 8,32,000 total capacity
  assert.equal(status.totalLines, 208);
  assert.equal(status.bricksPerLine, 4000);
  assert.equal(status.totalKilnCapacityBricks, 832000);

  // Fire starts at Line 1, 18 lines fired (1-18 = 72,000 bricks),
  // 5 lines actively firing (19-23), 15 lines loaded ahead (24-38)
  assert.equal(status.fireStartLineNo, 1);
  assert.equal(status.firedLinesCompleted, 18);
  assert.equal(status.firedStartLine, 1);
  assert.equal(status.firedEndLine, 18);
  assert.equal(status.firedBricksCompleted, 72000);
  assert.equal(status.activeFiringStartLine, 19);
  assert.equal(status.activeFiringEndLine, 23);
  assert.equal(status.activeFiringBricks, 20000);
  assert.equal(status.rawLoadedAheadStartLine, 24);
  assert.equal(status.rawLoadedAheadEndLine, 38);
  assert.equal(status.rawBricksLoadedAhead, 60000);
  assert.equal(status.totalLoadedLines, 38);
  assert.equal(status.emptyLinesRemaining, 170);
  assert.equal(status.paceStatus, 'ON_TIME');
  assert.equal(status.frontLoadStatus, 'SAFE');

  // Test slow firing / fireman shirking (জোন কামাই / ফাঁকি) & critical low front load buffer
  const slowAndLowLoad = computeFeedKilnLineSystemStatus({
    ...defaultSystem,
    firedLinesCompleted: 10,
    firingDaysElapsed: 5,
    expectedLinesPerDay: 4, // Expected 20 lines in 5 days, only 10 done -> SLOW_SHIRKING
    rawLinesLoadedAhead: 3, // Below minSafeLoadAheadLines (10) -> CRITICAL_LOW
  });
  assert.equal(slowAndLowLoad.paceStatus, 'SLOW_SHIRKING');
  assert.ok(slowAndLowLoad.paceAlertDetailBn.includes('জোন কামাই'));
  assert.equal(slowAndLowLoad.frontLoadStatus, 'CRITICAL_LOW');

  // Verify sectors starting from Line 1:
  // পূর্ব লম্বা সাইড (1-74) -> উত্তর রাউন্ড বাঁক (75-104) -> পশ্চিম লম্বা সাইড (105-178) -> দক্ষিণ রাউন্ড বাঁক (179-208)
  assert.ok(status.currentFireSectorBn.includes('পূর্ব লম্বা সাইড'));
  const northStatus = computeFeedKilnLineSystemStatus({
    ...defaultSystem,
    firedLinesCompleted: 85, // Line 86 (North Round 75-104)
  });
  assert.ok(northStatus.currentFireSectorBn.includes('উত্তর মাথার গোল রাউন্ড'));
  const westStatus = computeFeedKilnLineSystemStatus({
    ...defaultSystem,
    firedLinesCompleted: 120, // Line 121 (West Long Side 105-178)
  });
  assert.ok(westStatus.currentFireSectorBn.includes('পশ্চিম লম্বা সাইড'));
  const southStatus = computeFeedKilnLineSystemStatus({
    ...defaultSystem,
    firedLinesCompleted: 190, // Line 191 (South Round 179-208)
  });
  assert.ok(southStatus.currentFireSectorBn.includes('দক্ষিণ মাথার গোল রাউন্ড'));

  // Verify per-line popup status override (আগুন দেওয়া / আগুন শেষ নির্ধারণ পপআপ)
  const overriddenStatus = computeFeedKilnLineSystemStatus({
    ...defaultSystem,
    firedLinesCompleted: 18,
    activeFiringLinesCount: 5,
    rawLinesLoadedAhead: 15,
    lineOverrides: {
      25: 'ACTIVE_FIRING',
      19: 'FIRED_COOLING',
    },
  });
  assert.equal(overriddenStatus.lineOverrides?.[25], 'ACTIVE_FIRING');
  assert.equal(overriddenStatus.lineOverrides?.[19], 'FIRED_COOLING');
  assert.equal(overriddenStatus.firedLinesCompleted, 19); // 18 original + line 19 marked FIRED_COOLING
  assert.equal(overriddenStatus.activeFiringLinesCount, 5); // 5 original - line 19 + line 25
});

test('computeSeasonWastageReconciliation calculates last season benchmark and season-end mill raw vs chulli fired wastage', () => {
  const defaultCfg = createDefaultSeasonWastageConfig();
  const ongoing = computeSeasonWastageReconciliation({
    config: {
      ...defaultCfg,
      seasonStatus: 'RUNNING_SEASON',
      lastSeasonMillRawMade: 4000000,
      lastSeasonBricksFired: 3840000,
      lastSeasonBricksSold: 3780000,
    },
    liveMillRawCut: 1200000,
    liveChulliFiredOrLoaded: 600000,
    liveBricksSoldAllGrades: 500000,
  });

  // Last season: 40,00,000 - 38,40,000 = 1,60,000 wasted (4%)
  assert.equal(ongoing.lastSeason.rawLostInFieldOrRain, 160000);
  assert.equal(ongoing.lastSeason.rawWastagePct, 4);
  assert.equal(ongoing.isSeasonEnded, false);

  const completed = computeSeasonWastageReconciliation({
    config: {
      ...defaultCfg,
      seasonStatus: 'SEASON_ENDED',
    },
    liveMillRawCut: 4200000,
    liveChulliFiredOrLoaded: 4032000,
    liveBricksSoldAllGrades: 3980000,
  });

  assert.equal(completed.isSeasonEnded, true);
  assert.equal(completed.currentSeason.rawGapOrLostBricks, 168000);
  assert.equal(completed.currentSeason.rawGapOrLostPct, 4);
});

test('computeFeedKilnLineSystemStatus automatically syncs Van Load (4,000 pcs = 1 line) and Unload Ledger (UNLOADED from Line #1 + wrap-around reload)', () => {
  const defaultSystem = createDefaultFeedKilnLineSystem();

  // Case 1: 18,000 raw bricks loaded in Van Hisab (= 4 full lines ahead + 2,000 partial bricks in next line)
  // and 2 lines unloaded in Unload Hisab (starting from fireStartLineNo = 1: lines 1 and 2 marked UNLOADED)
  const synced = computeFeedKilnLineSystemStatus(
    {
      ...defaultSystem,
      rawLinesLoadedAhead: 0,
      firedLinesCompleted: 0,
      activeFiringLinesCount: 1,
      unloadedLinesBehind: 0,
    },
    {
      totalVanLoadedBricks: 18000,
      totalUnloadedLines: 2,
    }
  );

  assert.equal(synced.autoVanLoadedBricks, 18000);
  assert.equal(synced.autoVanFullLines, 4);
  assert.equal(synced.partialBricksInNextLine, 2000);
  assert.equal(synced.rawLinesLoadedAhead, 4); // Every 4,000 bricks directly adds 1 full line ahead of fire
  assert.equal(synced.unloadedLinesBehind, 2);
  // Lines #1 and #2 should be UNLOADED (আনলোড সাকসেসফুল) starting from fireStartLineNo = 1
  assert.equal(getFeedKilnLineZoneState(1, synced), 'UNLOADED');
  assert.equal(getFeedKilnLineZoneState(2, synced), 'UNLOADED');
  // Line #3 is ACTIVE_FIRING, Lines #4, #5, #6, #7 are RAW_LOADED_AHEAD (লোড সাকসেসফুল)
  assert.equal(getFeedKilnLineZoneState(3, synced), 'ACTIVE_FIRING');
  assert.equal(getFeedKilnLineZoneState(4, synced), 'RAW_LOADED_AHEAD');
  assert.equal(getFeedKilnLineZoneState(7, synced), 'RAW_LOADED_AHEAD');

  // Case 2: Round wrap-around reload — 210 lines loaded (840,000 bricks), 5 lines unloaded from #1
  // First 2 unloaded lines (#1, #2) get reloaded with raw bricks in the new round!
  const wrapped = computeFeedKilnLineSystemStatus(defaultSystem, {
    totalVanLoadedBricks: 210 * 4000,
    totalUnloadedLines: 5,
  });
  assert.equal(wrapped.autoVanFullLines, 210);
  assert.equal(wrapped.loadRoundNo, 2);
  assert.equal(wrapped.loadRoundLabelBn, '২য় রাউন্ড');
  assert.equal(wrapped.reloadedLinesInNewRound, 2);
  assert.equal(getFeedKilnLineZoneState(1, wrapped), 'RAW_LOADED_AHEAD');
  assert.equal(getFeedKilnLineZoneState(3, wrapped), 'UNLOADED');

  // Case 3: Nazrul Sardar unloads 5 lines (20,000 bricks) after Selim Sardar loads 20 lines (80,000 bricks)
  // Active lines in kiln deduct by 5 (from 20 to 15), active bricks deduct by 20,000 (from 80,000 to 60,000),
  // available empty lines in the 208-line kiln automatically increase from 188 to 193,
  // buildAutoUnloadConfirmation highlights lines #1-#5, and activeFiringLinesCount resets to 0.
  const autoConf = buildAutoUnloadConfirmation({
    sardarName: 'নজরুল সর্দার',
    chamberOrRound: 'রাউন্ড-০১',
    fireStartLineNo: 1,
    previousUnloadedLines: 0,
    effectiveUnloadedLines: 5,
    linesUnloadedInEntry: 5,
    bricksPerLine: 4000,
    updatedStockPieces: 20000,
    totalLines: 208,
  });
  assert.equal(autoConf.sardarName, 'নজরুল সর্দার');
  assert.equal(autoConf.linesCleared, 5);
  assert.equal(autoConf.bricksDeducted, 20000);
  assert.equal(autoConf.clearedStartLine, 1);
  assert.equal(autoConf.clearedEndLine, 5);
  assert.deepEqual(autoConf.clearedLineNumbers, [1, 2, 3, 4, 5]);
  assert.equal(autoConf.activeFiringLinesResetToZero, true);

  const nazrulUnloadStatus = computeFeedKilnLineSystemStatus(
    {
      ...defaultSystem,
      firedLinesCompleted: 5,
      activeFiringLinesCount: 0,
      rawLinesLoadedAhead: 15,
      unloadedLinesBehind: 5,
      recentlyClearedLines: autoConf.clearedLineNumbers,
      lastAutoUnloadConfirmation: autoConf,
    },
    {
      totalVanLoadedBricks: 80000,
      totalUnloadedLines: 5,
      totalUnloadedBricks: 20000,
    }
  );
  assert.equal(nazrulUnloadStatus.unloadedLinesBehind, 5);
  assert.equal(nazrulUnloadStatus.unloadedBricksBehind, 20000);
  assert.equal(nazrulUnloadStatus.activeFiringLinesCount, 0);
  assert.equal(nazrulUnloadStatus.totalLoadedLines, 15);
  assert.equal(nazrulUnloadStatus.totalLoadedBricks, 60000);
  assert.equal(nazrulUnloadStatus.emptyLinesRemaining, 193);
  assert.deepEqual(nazrulUnloadStatus.clearedLineNumbers, [1, 2, 3, 4, 5]);
  assert.deepEqual(nazrulUnloadStatus.recentlyClearedLines, [1, 2, 3, 4, 5]);
});

test('computeSoilCoalSummary accurately calculates ESCO hour bills and balances alongside soil & coal', () => {
  const records: SoilCoalRecord[] = [
    {
      id: 'sc-esco-1',
      date: '2026-11-04',
      itemType: 'ESCO',
      supplierName: 'কালাম এসকোভেটর ড্রাইভার',
      specification: 'এসকোভেটর দিয়ে মাটি কাটা ও ড্রেসিং',
      vehicleOrChallan: 'ভেকু-০২',
      workSite: 'বাবুলিয়া কাঁচা মাঠ ও ড্রেসিং',
      hoursWorked: 8.5,
      hoursDateBreakdown: 'আজ ৪.৫ ঘণ্টা + কাল ৪ ঘণ্টা',
      quantity: 8.5,
      unit: 'ঘণ্টা',
      ratePerUnit: 1800,
      totalBill: 15300,
      paidAmount: 10000,
      dueAmount: 5300,
      paymentMethod: 'নগদ ক্যাশ',
      createdAt: '2026-11-04T10:00:00Z',
    },
    {
      id: 'sc-soil-1',
      date: '2026-11-04',
      itemType: 'SOIL',
      supplierName: 'করিম ব্যাপারী',
      specification: 'পলি দোআঁশ মাটি',
      vehicleOrChallan: 'ট্রাক-৫২',
      quantity: 20,
      unit: 'গাড়ি',
      ratePerUnit: 1500,
      totalBill: 30000,
      paidAmount: 20000,
      dueAmount: 10000,
      paymentMethod: 'নগদ ক্যাশ',
      createdAt: '2026-11-04T10:00:00Z',
    },
  ];

  const summary = computeSoilCoalSummary(records);
  assert.equal(summary.escoCount, 1);
  assert.equal(summary.escoTotalHours, 8.5);
  assert.equal(summary.escoTotalBill, 15300);
  assert.equal(summary.escoTotalPaid, 10000);
  assert.equal(summary.escoTotalDue, 5300);
  assert.equal(summary.soilTotalBill, 30000);
  assert.equal(summary.grandTotalPaid, 30000);
  assert.equal(summary.grandTotalDue, 15300);
});

test('computeFeedKilnLineSystemStatus auto-adjusts load, partial line (4,500 bricks), firing, and unload from any selected fireStartLineNo and computeDamperMaintenanceAlerts flags overdue & missing-gap dampers', () => {
  const baseSys = createDefaultFeedKilnLineSystem();

  // User selects Line #50 as fireStartLineNo where fire has started (activeFiringLinesCount: 1 -> Line #50 is firing & already loaded)
  // Then submits 4,500 bricks in Van Hisab (= 1 full line ahead at Line #51 + 500 partial bricks in Line #52)
  const statusFrom50 = computeFeedKilnLineSystemStatus(
    {
      ...baseSys,
      fireStartLineNo: 50,
      firedLinesCompleted: 0,
      activeFiringLinesCount: 1,
      rawLinesLoadedAhead: 0,
      unloadedLinesBehind: 0,
    },
    {
      totalVanLoadedBricks: 4500,
      totalUnloadedLines: 0,
    }
  );

  assert.equal(statusFrom50.fireStartLineNo, 50);
  assert.equal(getFeedKilnLineZoneState(50, statusFrom50), 'ACTIVE_FIRING');
  assert.equal(statusFrom50.rawLinesLoadedAhead, 1);
  assert.equal(getFeedKilnLineZoneState(51, statusFrom50), 'RAW_LOADED_AHEAD');
  assert.equal(statusFrom50.partialBricksInNextLine, 500);
  assert.equal(statusFrom50.partialLoadLineNo, 52);

  // Damper Maintenance Alerts verification
  const alerts = computeDamperMaintenanceAlerts(
    {
      ...baseSys,
      fireStartLineNo: 1,
      firedLinesCompleted: 10,
      activeFiringLinesCount: 3,
      rawLinesLoadedAhead: 12,
      dampers: [
        {
          id: 'd1',
          afterLineNo: 5,
          linesInBlock: 5,
          hasProtectiveGap: true,
          status: 'ACTIVE_CLOSED', // Fire is at 10, so Line 5 is overdue to open!
          sardarName: 'সেলিম সর্দার',
          note: '',
        },
        {
          id: 'd2',
          afterLineNo: 15,
          linesInBlock: 5,
          hasProtectiveGap: false, // Ahead of fire, but missing protective gap!
          status: 'ACTIVE_CLOSED',
          sardarName: 'সেলিম সর্দার',
          note: '',
        },
        {
          id: 'd3',
          afterLineNo: 20,
          linesInBlock: 5,
          hasProtectiveGap: true,
          status: 'ACTIVE_CLOSED',
          sardarName: 'সেলিম সর্দার',
          note: '',
        },
      ],
    }
  );

  assert.equal(alerts.overdueToOpenCount, 1);
  assert.equal(alerts.missingGapCount, 1);
  assert.equal(alerts.healthyActiveCount, 1);
  assert.equal(alerts.needsNewDamperAhead, true);
  assert.equal(alerts.recommendedNextDamperLine, 25);
});

test('calculateTruckFootMeasurement calculates truck CFT/CBM capacity, estimated bricks, and total foot bill from per-foot rate', () => {
  // 16 ft × 7 ft 6 in (7.5 ft) × 4 ft 6 in (4.5 ft) = 540 CFT (ফুট)
  // Rate = 55 Tk/foot -> 1 truck bill = 29,700 Tk; 2 trucks = 1,080 CFT -> 59,400 Tk
  // Default multiplier = 12 bricks/CFT -> 1 truck = 6,480 bricks, 2 trucks = 12,960 bricks
  const res = calculateTruckFootMeasurement({
    lengthFeet: 16,
    lengthInches: 0,
    widthFeet: 7,
    widthInches: 6,
    heightFeet: 4,
    heightInches: 6,
    ratePerFoot: 55,
    truckCount: 2,
  });

  assert.equal(res.decimalLengthFeet, 16);
  assert.equal(res.decimalWidthFeet, 7.5);
  assert.equal(res.decimalHeightFeet, 4.5);
  assert.equal(res.singleTruckCft, 540);
  assert.equal(res.singleTruckCbm, 15.29);
  assert.equal(res.truckCount, 2);
  assert.equal(res.totalCubicFeet, 1080);
  assert.equal(res.totalCubicMetersCbm, 30.58);
  assert.equal(res.bricksPerCubicFoot, 12);
  assert.equal(res.singleTruckEstimatedBricks, 6480);
  assert.equal(res.totalEstimatedBricks, 12960);
  assert.equal(res.singleTruckBill, 29700);
  assert.equal(res.totalFootBill, 59400);
});

test('computeFridayHatbarSardarSummarySheet aggregates all 7 Sardars (Ohab, Mofijul, Sofikul, Selim, Altaf, Nazrul, Obed) with weekly Khoraki/bill and Dina balances', () => {
  const sheet = computeFridayHatbarSardarSummarySheet({
    hatbarDate: '2026-11-07',
    lookbackDays: 7,
    millPots: [
      {
        id: 'm1',
        millId: 'ohab',
        millNameBn: 'মিল-১ (ওহাব সর্দার)',
        millNameEn: 'Mill 1 (Ohab Sardar)',
        potNo: 'পট-১',
        date: '2026-11-05',
        rawBricksCut: 10000,
        takenToChulli: 0,
        remainingRawBricks: 10000,
        ratePerThousand: 1000,
        totalPayable: 10000,
        paidAmount: 11000, // 1,000 Tk Dina
        dueAmount: 0,
        note: '',
        createdAt: '2026-11-05T10:00:00Z',
      },
      {
        id: 'm2',
        millId: 'mofijul',
        millNameBn: 'মিল-২ (মফিজুল সর্দার)',
        millNameEn: 'Mill 2 (Mofijul Sardar)',
        potNo: 'পট-২',
        date: '2026-11-07',
        rawBricksCut: 8000,
        takenToChulli: 0,
        remainingRawBricks: 8000,
        ratePerThousand: 1000,
        totalPayable: 8000,
        paidAmount: 5000, // 3,000 Tk Due
        dueAmount: 3000,
        note: '',
        createdAt: '2026-11-07T10:00:00Z',
      },
    ],
    chulliLoads: [
      {
        id: 'v1',
        date: '2026-11-06',
        sardarName: 'সেলিম সর্দার',
        vanCount: 1,
        rawBricksLoaded: 4000,
        ratePerVan: 350,
        totalBill: 1400,
        paidAmount: 1000,
        dueAmount: 400,
        note: '',
        createdAt: '2026-11-06T10:00:00Z',
      },
    ],
    poraiMistriRecords: [],
    chulliUnloads: [],
    rubbishRecords: [
      {
        id: 'r1',
        date: '2026-11-07',
        sardarName: 'অবেদ রাবিশ সর্দার',
        chamberOrRound: 'রাউন্ড-১',
        roundBill: 5000,
        paidAmount: 2000,
        dueAmount: 3000,
        note: '',
        createdAt: '2026-11-07T10:00:00Z',
      },
    ],
  });

  assert.equal(sheet.rows.length, 7);
  assert.equal(sheet.weekStartDate, '2026-11-01');
  assert.equal(sheet.hatbarDate, '2026-11-07');
  assert.equal(sheet.rows[0].sardarNameBn, 'ওহাব সর্দার');
  assert.equal(sheet.rows[0].isDina, true);
  assert.equal(sheet.rows[0].dinaAmount, 1000);
  assert.equal(sheet.rows[1].sardarNameBn, 'মফিজুল সর্দার');
  assert.equal(sheet.rows[1].balanceDue, 3000);
  assert.equal(sheet.rows[3].sardarNameBn, 'সেলিম সর্দার');
  assert.equal(sheet.rows[3].balanceDue, 400);
  assert.equal(sheet.rows[6].sardarNameBn, 'অবেদ রাবিশ সর্দার');
  assert.equal(sheet.rows[6].balanceDue, 3000);
  assert.equal(sheet.grandWeeklyBill, 24400);
  assert.equal(sheet.grandWeeklyPaid, 19000);
  assert.equal(sheet.grandTotalBalanceDue, 6400);
  assert.equal(sheet.grandTotalDinaAmount, 1000);
});

test('processLocalApiMutation and computeDatabaseRecordSummary execute offline memos, Sardar mill pots, rubbish ledgers, and cash transactions without data loss', () => {
  const initial = createInitialKilnState();
  const initialSummary = computeDatabaseRecordSummary(initial);
  assert.equal(initialSummary.totalRecordsCount, 0);

  // 1. Offline Memo creation
  const memoRes = processLocalApiMutation(
    '/api/memos',
    'POST',
    {
      customerName: 'মোঃ রফিকুল ইসলাম (অফলাইন টেস্ট)',
      customerPhone: '01711-889900',
      items: [{ gradeId: 'grade-1', quantity: 2000, rate: 11000 }],
      discount: 0,
      paidAmount: 15000,
      paymentMethod: 'নগদ ক্যাশ',
    },
    initial
  );
  assert.equal(memoRes.status, 200);
  assert.equal(memoRes.updatedState.salesMemos.length, 1);
  assert.equal(memoRes.updatedState.salesMemos[0].totalAmount, 22000);
  assert.equal(memoRes.updatedState.salesMemos[0].dueAmount, 7000);
  assert.equal(memoRes.updatedState.cashTransactions.length, 1);

  // 2. Offline Mill Pot creation (Ohab Mill)
  const potRes = processLocalApiMutation(
    '/api/production/mill-pot',
    'POST',
    {
      millId: 'ohab',
      potNo: 'পট-১',
      rawBricksCut: 10000,
      takenToChulli: 5000,
      ratePerThousand: 1000,
      paidAmount: 6000,
    },
    memoRes.updatedState
  );
  assert.equal(potRes.status, 200);
  assert.equal(potRes.updatedState.millPots.length, 1);
  assert.equal(potRes.updatedState.millPots[0].totalPayable, 10000);
  assert.equal(potRes.updatedState.millPots[0].dueAmount, 4000);

  // 3. Offline Rubbish Sardar entry (Obed Sardar)
  const rubRes = processLocalApiMutation(
    '/api/production/rubbish',
    'POST',
    {
      sardarName: 'অবেদ রাবিশ সর্দার',
      chamberOrRound: 'রাউন্ড-১',
      roundBill: 5000,
      paidAmount: 2000,
    },
    potRes.updatedState
  );
  assert.equal(rubRes.status, 200);
  assert.equal(rubRes.updatedState.rubbishRecords?.length, 1);
  assert.equal(rubRes.updatedState.rubbishRecords?.[0]?.dueAmount, 3000);

  const afterSummary = computeDatabaseRecordSummary(rubRes.updatedState);
  assert.ok(afterSummary.totalRecordsCount >= 6);
  assert.equal(afterSummary.memoCount, 1);
});
