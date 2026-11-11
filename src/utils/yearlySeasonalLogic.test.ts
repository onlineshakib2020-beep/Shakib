import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialKilnState } from './seedData.ts';
import {
  computeSeasonVarianceComparison,
  computeYearlyOrSeasonalReport,
  getAvailableHistoricalYears,
  getDefaultKilnSeasons,
  getDefaultKilnUnits,
} from './yearlySeasonalLogic.ts';
import type { KilnDatabaseState } from '../types/kiln.ts';

function createSeparateMultiYearTestDatabase(): KilnDatabaseState {
  const base = createInitialKilnState();
  base.settings.openingBalance = 50000;
  base.kilnUnits = getDefaultKilnUnits();
  base.kilnSeasons = getDefaultKilnSeasons();

  // Memos across 2025, 2026, and 2027 (crossing calendar-year boundaries within Season 2025-2026 and Season 2026-2027)
  base.salesMemos = [
    {
      id: 'm-2025-1',
      memoNo: '2501',
      date: '2025-11-15',
      customerName: 'হাজী রফিকুল ইসলাম',
      customerPhone: '01711000001',
      customerAddress: 'বাবুলিয়া',
      truckNo: 'সাতক্ষীরা-ট-১১-১০০১',
      driverName: 'করিম',
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
      paidAmount: 70000,
      dueAmount: 40000, // 40,000 credit sale (due)
      paymentMethod: 'নগদ ক্যাশ',
      status: 'PARTIAL',
      kilnId: 'sbl-1',
      createdAt: '2025-11-15T10:00:00Z',
    },
    {
      id: 'm-2026-1',
      memoNo: '2601',
      date: '2026-01-18', // Inside 2025-2026 Season (crosses calendar year into Jan 2026!)
      customerName: 'মেসার্স আলম ট্রেডার্স',
      customerPhone: '01711000002',
      customerAddress: 'সাতক্ষীরা সদর',
      truckNo: 'সাতক্ষীরা-ট-১১-২০০২',
      driverName: 'রহিম',
      items: [
        {
          id: 'it-2',
          gradeId: 'grade-1',
          gradeName: '১ নং ইট',
          quantity: 5000,
          rate: 11000,
          ratePerThousand: true,
          lineTotal: 55000,
        },
        {
          id: 'it-3',
          gradeId: 'grade-2',
          gradeName: '২ নং ইট',
          quantity: 2000,
          rate: 9500,
          ratePerThousand: true,
          lineTotal: 19000,
        },
      ],
      subTotal: 74000,
      discount: 4000,
      totalAmount: 70000,
      paidAmount: 50000,
      dueAmount: 20000,
      paymentMethod: 'নগদ ক্যাশ',
      status: 'PARTIAL',
      kilnId: 'sbl-1',
      createdAt: '2026-01-18T10:00:00Z',
    },
    {
      id: 'm-2026-2',
      memoNo: '2602',
      date: '2026-11-20', // Inside 2026-2027 Season
      customerName: 'সোহেল কন্সট্রাকশন',
      customerPhone: '01811000003',
      customerAddress: 'কলারোয়া',
      truckNo: 'সাতক্ষীরা-ট-১১-৩০০৩',
      driverName: 'জব্বার',
      items: [
        {
          id: 'it-4',
          gradeId: 'grade-1',
          gradeName: '১ নং ইট',
          quantity: 8000,
          rate: 11000,
          ratePerThousand: true,
          lineTotal: 88000,
        },
      ],
      subTotal: 88000,
      discount: 0,
      totalAmount: 88000,
      paidAmount: 60000,
      dueAmount: 28000,
      paymentMethod: 'ব্যাংক চেক / ট্রান্সফার',
      status: 'PARTIAL',
      kilnId: 'sbl-2', // Kiln 2!
      createdAt: '2026-11-20T10:00:00Z',
    },
    {
      id: 'm-2027-1',
      memoNo: '2701',
      date: '2027-02-10', // Inside 2026-2027 Season (crosses calendar year into Feb 2027)
      customerName: 'সাতক্ষীরা বিল্ডার্স',
      customerPhone: '01911000004',
      customerAddress: 'তালা',
      truckNo: 'সাতক্ষীরা-ট-১১-৪০০৪',
      driverName: 'হাসান',
      items: [
        {
          id: 'it-5',
          gradeId: 'grade-picket',
          gradeName: 'পিকেট ইট',
          quantity: 4000,
          rate: 10000,
          ratePerThousand: true,
          lineTotal: 40000,
        },
      ],
      subTotal: 40000,
      discount: 0,
      totalAmount: 40000,
      paidAmount: 40000,
      dueAmount: 0,
      paymentMethod: 'নগদ ক্যাশ',
      status: 'PAID',
      kilnId: 'sbl-1',
      createdAt: '2027-02-10T10:00:00Z',
    },
  ];

  // Cash Transactions (Sales collections, due collections, coal, soil, labor, other income)
  base.cashTransactions = [
    {
      id: 'tx-25-1',
      date: '2025-11-15',
      type: 'IN',
      category: 'ইট বিক্রয় আদায়',
      amount: 70000,
      description: 'মেমো #2501 নগদ জমা',
      referenceId: '2501',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      kilnId: 'sbl-1',
      createdAt: '2025-11-15T10:00:00Z',
    },
    {
      id: 'tx-25-2',
      date: '2025-12-05',
      type: 'OUT',
      category: 'মাটি ক্রয়',
      amount: 25000,
      description: 'মাটির ট্রাক ২০ গাড়ি ক্রয়',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      kilnId: 'sbl-1',
      createdAt: '2025-12-05T12:00:00Z',
    },
    {
      id: 'tx-26-1',
      date: '2026-01-18',
      type: 'IN',
      category: 'ইট বিক্রয় আদায়',
      amount: 50000,
      description: 'মেমো #2601 নগদ জমা',
      referenceId: '2601',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      kilnId: 'sbl-1',
      createdAt: '2026-01-18T10:00:00Z',
    },
    {
      id: 'tx-26-2',
      date: '2026-02-10',
      type: 'IN',
      category: 'বাকি আদায়',
      amount: 15000, // Partial due collection on Memo #2501 in Feb 2026
      description: 'মেমো #2501 বকেয়া আদায়',
      referenceId: '2501',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      kilnId: 'sbl-1',
      createdAt: '2026-02-10T11:00:00Z',
    },
    {
      id: 'tx-26-3',
      date: '2026-03-12',
      type: 'OUT',
      category: 'কয়লা ক্রয়',
      amount: 40000,
      description: 'ইন্দোনেশিয়ান কয়লা ক্রয়',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      kilnId: 'sbl-1',
      createdAt: '2026-03-12T14:00:00Z',
    },
    {
      id: 'tx-26-4',
      date: '2026-11-20',
      type: 'IN',
      category: 'ইট বিক্রয় আদায়',
      amount: 60000,
      description: 'মেমো #2602 নগদ জমা',
      referenceId: '2602',
      paymentMethod: 'ব্যাংক চেক / ট্রান্সফার',
      verified: true,
      kilnId: 'sbl-2',
      createdAt: '2026-11-20T10:00:00Z',
    },
    {
      id: 'tx-27-1',
      date: '2027-02-10',
      type: 'IN',
      category: 'ইট বিক্রয় আদায়',
      amount: 40000,
      description: 'মেমো #2701 নগদ জমা',
      referenceId: '2701',
      paymentMethod: 'নগদ ক্যাশ',
      verified: true,
      kilnId: 'sbl-1',
      createdAt: '2027-02-10T10:00:00Z',
    },
  ];

  // Production records across 2025-2026 and 2026-2027
  base.millPots = [
    {
      id: 'mp-1',
      millId: 'ohab',
      millNameBn: 'ওহাব মিল (১নং মিল)',
      millNameEn: 'Ohab Mill',
      potNo: 'পট-০১',
      date: '2025-11-05',
      rawBricksCut: 40000,
      takenToChulli: 30000,
      remainingRawBricks: 10000,
      ratePerThousand: 650,
      totalPayable: 26000,
      paidAmount: 20000,
      dueAmount: 6000,
      kilnId: 'sbl-1',
      createdAt: '2025-11-05T09:00:00Z',
    },
    {
      id: 'mp-2',
      millId: 'mofijul',
      millNameBn: 'মফিজুল মিল (২নং মিল)',
      millNameEn: 'Mofijul Mill',
      potNo: 'পট-০২',
      date: '2026-11-02',
      rawBricksCut: 50000,
      takenToChulli: 45000,
      remainingRawBricks: 5000,
      ratePerThousand: 650,
      totalPayable: 32500,
      paidAmount: 25000,
      dueAmount: 7500,
      kilnId: 'sbl-1',
      createdAt: '2026-11-02T09:00:00Z',
    },
  ];

  base.chulliUnloads = [
    {
      id: 'cu-1',
      date: '2025-11-12',
      chamberOrRound: 'রাউন্ড-০১',
      sardarName: 'রহিম নিকল সর্দার',
      unloadedByGrade: [
        { gradeId: 'grade-1', gradeName: '১ নং ইট', quantity: 25000 },
        { gradeId: 'grade-2', gradeName: '২ নং ইট', quantity: 5000 },
      ],
      totalBricksUnloaded: 30000,
      ratePerThousand: 750,
      totalBill: 22500,
      paidAmount: 18000,
      dueAmount: 4500,
      kilnId: 'sbl-1',
      createdAt: '2025-11-12T10:00:00Z',
    },
  ];

  return base;
}

test('getAvailableHistoricalYears discovers all years from transactions and seasons', () => {
  const testDb = createSeparateMultiYearTestDatabase();
  const years = getAvailableHistoricalYears(testDb);
  assert.ok(years.includes(2025));
  assert.ok(years.includes(2026));
  assert.ok(years.includes(2027));
});

test('Yearly accounting separates sales from actual collections and reconciles 12 monthly rows', () => {
  const testDb = createSeparateMultiYearTestDatabase();

  // 1. Test Year 2025
  const report2025 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'YEAR',
    year: 2025,
    kilnId: 'ALL',
  });
  assert.equal(report2025.totalSalesAmount, 110000);
  // Credit sale of 40,000 is NOT counted as actual cash collection!
  assert.equal(report2025.totalActualCollections, 70000);
  assert.equal(report2025.totalExpenses, 25000);
  assert.equal(report2025.soilAndRawMaterialAmount, 25000);
  assert.equal(report2025.monthlyBreakdown.length, 12);

  // Sum of 12 monthly rows must match yearly totals
  const sumMonthlySales2025 = report2025.monthlyBreakdown.reduce(
    (s, m) => s + m.salesAmount,
    0
  );
  const sumMonthlyCols2025 = report2025.monthlyBreakdown.reduce(
    (s, m) => s + m.actualCollectionAmount,
    0
  );
  assert.equal(sumMonthlySales2025, report2025.totalSalesAmount);
  assert.equal(sumMonthlyCols2025, report2025.totalActualCollections);

  // 2. Test Year 2026
  const report2026 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'YEAR',
    year: 2026,
    kilnId: 'ALL',
  });
  // In 2026: Memo #2601 (70,000) + Memo #2602 (88,000) = 158,000
  assert.equal(report2026.totalSalesAmount, 158000);
  // Actual collections in 2026: 50,000 (#2601 initial) + 15,000 (#2501 due collected in Feb 2026) + 60,000 (#2602 initial) = 125,000
  assert.equal(report2026.totalActualCollections, 125000);
  assert.equal(report2026.dueCollections, 15000);
  assert.equal(report2026.totalExpenses, 40000);

  // Check Opening + Period Sales - Period Collections = Closing Receivables for 2026
  // Before 2026: Sales 110,000 - Collections 70,000 = 40,000 Opening Receivables
  assert.equal(report2026.reconciliation.openingCustomerReceivables, 40000);
  // Closing 2026 Receivables: 40,000 + 158,000 - 125,000 = 73,000
  assert.equal(report2026.reconciliation.closingCustomerReceivables, 73000);
});

test('Seasonal accounting accurately groups cross-calendar-year transactions (2025-2026 vs 2026-2027)', () => {
  const testDb = createSeparateMultiYearTestDatabase();

  // Season 2025-2026 (2025-10-01 to 2026-06-30, kiln sbl-1)
  const season2526 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'SEASON',
    seasonId: 'season-2025-2026',
    kilnId: 'ALL',
  });
  // Includes Nov 2025 Memo #2501 (110,000) AND Jan 2026 Memo #2601 (70,000) = 180,000
  assert.equal(season2526.totalSalesAmount, 180000);
  // Collections in Season 2025-2026: 70,000 (Nov 2025) + 50,000 (Jan 2026) + 15,000 (Feb 2026) = 135,000
  assert.equal(season2526.totalActualCollections, 135000);
  // Expenses in Season 2025-2026: 25,000 (Dec 2025 Soil) + 40,000 (Mar 2026 Coal) = 65,000
  assert.equal(season2526.totalExpenses, 65000);
  assert.equal(season2526.rawBricksCut, 40000);
  assert.equal(season2526.pakaUnloadedBricks, 30000);
  assert.equal(season2526.totalBricksSoldQty, 17000); // 10,000 + 5,000 + 2,000
  // Stock reconciliation: 0 opening + 30,000 unloaded - 17,000 sold = 13,000 closing
  assert.equal(season2526.reconciliation.closingStockBricks, 13000);

  // Season 2026-2027 (2026-10-01 to 2027-06-30, kilns sbl-1 & sbl-2)
  const season2627 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'SEASON',
    seasonId: 'season-2026-2027',
    kilnId: 'ALL',
  });
  // Includes Nov 2026 Memo #2602 (88,000) + Feb 2027 Memo #2701 (40,000) = 128,000
  assert.equal(season2627.totalSalesAmount, 128000);
  assert.equal(season2627.totalActualCollections, 100000);
  // Opening receivables entering Season 2026-2027 (on 2026-10-01) is 180,000 - 135,000 = 45,000
  assert.equal(season2627.reconciliation.openingCustomerReceivables, 45000);
  // Closing receivables at end of Season 2026-2027: 45,000 + 128,000 - 100,000 = 73,000
  assert.equal(season2627.reconciliation.closingCustomerReceivables, 73000);
});

test('Kiln filter and Archive search filters isolate records without mixing unrelated kilns', () => {
  const testDb = createSeparateMultiYearTestDatabase();

  // Filter Year 2026 for Kiln sbl-2 only
  const kiln2Report = computeYearlyOrSeasonalReport(testDb, {
    mode: 'YEAR',
    year: 2026,
    kilnId: 'sbl-2',
  });
  assert.equal(kiln2Report.totalSalesAmount, 88000);
  assert.equal(kiln2Report.totalMemoCount, 1);

  // Filter Archive by Memo No '2601'
  const memoSearchReport = computeYearlyOrSeasonalReport(testDb, {
    mode: 'YEAR',
    year: 2026,
    kilnId: 'ALL',
    memoNoQuery: '2601',
  });
  assert.ok(memoSearchReport.archiveEntries.length >= 1);
  assert.ok(
    memoSearchReport.archiveEntries.every(
      (e) => e.memoNo === '2601' || e.descriptionBn.includes('2601')
    )
  );
});

test('computeSeasonVarianceComparison calculates exact variances in sales, production, and expenses between two seasons', () => {
  const testDb = createSeparateMultiYearTestDatabase();

  const season2627 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'SEASON',
    seasonId: 'season-2026-2027',
    kilnId: 'ALL',
  });
  const season2526 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'SEASON',
    seasonId: 'season-2025-2026',
    kilnId: 'ALL',
  });

  const comparison = computeSeasonVarianceComparison(season2627, season2526);

  // Sales: Season 26-27 (128,000) vs Season 25-26 (180,000) -> diff = -52,000 (-28.9%)
  assert.equal(comparison.sales.seasonAValue, 128000);
  assert.equal(comparison.sales.seasonBValue, 180000);
  assert.equal(comparison.sales.diffAminusB, -52000);
  assert.equal(comparison.sales.variancePct, -28.9);

  // Raw production: Season 26-27 (50,000) vs Season 25-26 (40,000) -> diff = +10,000 (+25%)
  assert.equal(comparison.rawProduction.seasonAValue, 50000);
  assert.equal(comparison.rawProduction.seasonBValue, 40000);
  assert.equal(comparison.rawProduction.diffAminusB, 10000);
  assert.equal(comparison.rawProduction.variancePct, 25);

  // Fired (Paka) production: Season 26-27 (0) vs Season 25-26 (30,000) -> diff = -30,000 (-100%)
  assert.equal(comparison.pakaProduction.seasonAValue, 0);
  assert.equal(comparison.pakaProduction.seasonBValue, 30000);
  assert.equal(comparison.pakaProduction.diffAminusB, -30000);
  assert.equal(comparison.pakaProduction.variancePct, -100);

  // Expenses: Season 26-27 (0) vs Season 25-26 (65,000) -> diff = -65,000 (-100%)
  assert.equal(comparison.expenses.seasonAValue, 0);
  assert.equal(comparison.expenses.seasonBValue, 65000);
  assert.equal(comparison.expenses.diffAminusB, -65000);
  assert.equal(comparison.expenses.variancePct, -100);
});

test('computeYearlyOrSeasonalReport calculates monthly Fuel & Wood Usage alongside monthly brick production volume', () => {
  const testDb = createSeparateMultiYearTestDatabase();
  testDb.woodFuelRecords = [
    {
      id: 'wf-nov-26',
      date: '2026-11-08',
      supplierName: 'রহিম কাঠ ব্যাপারী',
      supplierPhone: '01711223344',
      woodType: 'সুন্দরী ও গরান কাঠ',
      quantity: 120,
      unit: 'মণ',
      ratePerUnit: 350,
      totalBill: 42000,
      paidAmount: 30000,
      dueAmount: 12000,
      paymentMethod: 'নগদ ক্যাশ',
      kilnId: 'sbl-1',
      createdAt: '2026-11-08T10:00:00Z',
    },
    {
      id: 'wf-dec-26',
      date: '2026-12-15',
      supplierName: 'করিম কাঠ সাপ্লাইয়ার',
      supplierPhone: '01819887766',
      woodType: 'বাবলা ও মেহগনি কাঠ',
      quantity: 2,
      unit: 'টন', // 2 Ton = 50 Maund
      ratePerUnit: 8500,
      totalBill: 17000,
      paidAmount: 17000,
      dueAmount: 0,
      paymentMethod: 'নগদ ক্যাশ',
      kilnId: 'sbl-1',
      createdAt: '2026-12-15T10:00:00Z',
    },
  ];

  const season2627 = computeYearlyOrSeasonalReport(testDb, {
    mode: 'SEASON',
    seasonId: 'season-2026-2027',
    kilnId: 'ALL',
  });

  // Total wood fuel: 120 Maund + 50 Maund (2 Ton) = 170 Maund
  assert.equal(season2627.totalWoodFuelDeliveries, 2);
  assert.equal(season2627.totalWoodFuelMaund, 170);
  assert.equal(season2627.totalWoodFuelBillAmount, 59000);
  assert.equal(season2627.totalWoodFuelPaidAmount, 47000);
  assert.equal(season2627.totalWoodFuelDueAmount, 12000);
  assert.equal(season2627.totalFuelAndWoodCost, 59000);
  // Raw bricks cut in Season 2026-2027 is 50,000 -> 59,000 / 50 = 1,180 Tk per 1,000 bricks
  assert.equal(season2627.fuelCostPerThousandBricks, 1180);

  // Check Nov 2026 monthly point (has both 50,000 raw bricks cut AND 120 Maund wood fuel)
  const nov2026 = season2627.monthlyBreakdown.find((m) => m.monthKey === '2026-11');
  assert.ok(nov2026);
  assert.equal(nov2026.productionVolumeBricks, 50000);
  assert.equal(nov2026.woodFuelMaund, 120);
  assert.equal(nov2026.woodFuelBillAmount, 42000);
  assert.equal(nov2026.fuelAndCoalExpenseAmount, 42000);

  // Check Dec 2026 monthly point (50 Maund equivalent from 2 Ton)
  const dec2026 = season2627.monthlyBreakdown.find((m) => m.monthKey === '2026-12');
  assert.ok(dec2026);
  assert.equal(dec2026.woodFuelMaund, 50);
  assert.equal(dec2026.woodFuelBillAmount, 17000);
});


