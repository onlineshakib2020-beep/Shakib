import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardMetrics,
  calculateMultiItemMemoTotals,
  calculateRowTotal,
  cleanBrickGradeName,
  computeBrickGradeReport,
  computeComprehensiveBusinessAnalysis,
  extractBanglaAmount,
  formatBn,
  generateDailyChartData,
  generateUniqueMemoNo,
  normalizeLegacyMemo,
  parseBanglaAgentIntent,
  parseBanglaDigits,
  requiresSafeConfirmation,
  validateStockForMultiItemMemo,
} from './kilnLogic.ts';
import type { BrickGrade, CashTransaction, SalesMemo } from '../types/kiln.ts';

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
  assert.equal(metrics.totalCustomerDue, 24000);
  assert.equal(metrics.todaySalesAmount, 54000);
  assert.equal(metrics.todayBricksSold, 4000);

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
