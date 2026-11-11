import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KILN_THEMES,
  calculateSmartBrickEstimate,
  searchKilnWorkspace,
} from './themeAndEstimatorLogic';
import { createInitialKilnState } from './seedData';

test('KILN_THEMES provides all 4 curated industrial themes with valid hex colors', () => {
  const themeKeys = Object.keys(KILN_THEMES);
  assert.deepEqual(themeKeys, ['terracotta', 'emerald', 'sapphire', 'crimson']);
  for (const key of themeKeys) {
    const theme = KILN_THEMES[key as keyof typeof KILN_THEMES];
    assert.ok(theme.primaryHex.startsWith('#'));
    assert.ok(theme.nameBn.length > 0);
    assert.ok(theme.nameEn.length > 0);
  }
});

test('calculateSmartBrickEstimate accurately computes 5-inch and 10-inch wall brick counts and costs', () => {
  const res5Inch = calculateSmartBrickEstimate({
    mode: 'WALL',
    wallLengthFeet: 20,
    wallHeightFeet: 10,
    wallCount: 2,
    wallThickness: '5_INCH',
    openingDeductionSqFt: 40,
    houseAreaSqFt: 1000,
    floorsCount: 1,
    roadLengthFeet: 100,
    roadWidthFeet: 10,
    solingLayerType: 'FLAT_SINGLE',
    wastagePct: 5,
    ratePerThousand: 13000,
    transportTrips: 1,
    farePerTrip: 1200,
  });

  // Gross area = 20 * 10 * 2 = 400 sq.ft, Net = 400 - 40 = 360 sq.ft
  assert.equal(res5Inch.grossAreaSqFt, 400);
  assert.equal(res5Inch.netAreaSqFt, 360);
  // 360 * 5 = 1800 base bricks, +5% wastage = 90 => 1890 => rounded to nearest 100 = 1900
  assert.equal(res5Inch.baseBricksNeeded, 1800);
  assert.equal(res5Inch.wastageBricks, 90);
  assert.equal(res5Inch.totalBricksNeeded, 1890);
  assert.equal(res5Inch.roundedOrderBricks, 1900);
  // 1.9 * 13000 = 24700 + 1200 transport = 25900
  assert.equal(res5Inch.brickCostAmount, 24700);
  assert.equal(res5Inch.transportCostAmount, 1200);
  assert.equal(res5Inch.grandTotalAmount, 25900);
});

test('calculateSmartBrickEstimate computes house area and road soling modes accurately', () => {
  const houseRes = calculateSmartBrickEstimate({
    mode: 'HOUSE_AREA',
    wallLengthFeet: 0,
    wallHeightFeet: 0,
    wallCount: 1,
    wallThickness: '5_INCH',
    openingDeductionSqFt: 0,
    houseAreaSqFt: 1000,
    floorsCount: 1,
    roadLengthFeet: 0,
    roadWidthFeet: 0,
    solingLayerType: 'FLAT_SINGLE',
    wastagePct: 5,
    ratePerThousand: 13000,
    transportTrips: 12,
    farePerTrip: 1000,
  });

  assert.equal(houseRes.baseBricksNeeded, 28000);
  assert.equal(houseRes.totalBricksNeeded, 29400);
  assert.equal(houseRes.roundedOrderBricks, 29400);
  assert.ok(houseRes.estimatedCementBags > 0);
  assert.ok(houseRes.estimatedSandCft > 0);
});

test('searchKilnWorkspace finds matching memos, modules, and workers', () => {
  const state = createInitialKilnState();
  state.salesMemos.push({
    id: 'm-test-1',
    memoNo: 'SBL-1001',
    date: '2026-11-01',
    customerName: 'আলহাজ্ব আব্দুল করিম',
    customerPhone: '01711-000000',
    customerAddress: 'বাবুলিয়া, সাতক্ষীরা',
    truckNo: 'সাতক্ষীরা-ট-১১-১২৩৪',
    driverName: 'রফিক',
    items: [],
    subTotal: 13000,
    discount: 0,
    totalAmount: 13000,
    paidAmount: 10000,
    dueAmount: 3000,
    status: 'DUE',
    paymentMethod: 'নগদ ক্যাশ',
    deliveryStatus: 'DELIVERED',
    paymentHistory: [],
    deliveryHistory: [],
    createdAt: new Date().toISOString(),
  });
  const sections = [
    {
      id: 'dashboard' as const,
      labelBn: 'ড্যাশবোর্ড ও মেমো',
      labelEn: 'Dashboard & Memo',
      descBn: 'সকল সেকশনের শর্টকাট',
      descEn: 'All section shortcuts',
    },
    {
      id: 'cashbook' as const,
      labelBn: 'ক্যাশ বুক',
      labelEn: 'Cash Book',
      descBn: 'নগদ জমা ও খরচ',
      descEn: 'Cash in and out',
    },
  ];

  const cashHits = searchKilnWorkspace('ক্যাশ', state, sections);
  assert.ok(cashHits.some((h) => h.targetTab === 'cashbook'));

  const memoHits = searchKilnWorkspace('SBL-1001', state, sections);
  assert.ok(memoHits.some((h) => h.kind === 'MEMO'));
});

test('computeFiringRoundMetrics and computeOverallCoalEfficiencyReport evaluate per-lakh coal efficiency and excess alerts accurately', async () => {
  const {
    createInitialFiringRounds,
    computeFiringRoundMetrics,
    computeOverallCoalEfficiencyReport,
  } = await import('./themeAndEstimatorLogic');

  const initialRounds = createInitialFiringRounds('2026-11-01');
  assert.equal(initialRounds.length, 3);

  // Round 1: 4,20,000 bricks with 68.5 tons => 16.31 tons/lakh (Optimal vs 17.2 benchmark)
  const r1 = computeFiringRoundMetrics(initialRounds[0], 17.2);
  assert.equal(r1.coalPerLakhBricksTons, 16.31);
  assert.equal(r1.efficiencyStatus, 'OPTIMAL');

  // Round 2: 4,00,000 bricks with 74.8 tons => 18.70 tons/lakh (Excess Warning vs 17.2 benchmark)
  const r2 = computeFiringRoundMetrics(initialRounds[1], 17.2);
  assert.equal(r2.coalPerLakhBricksTons, 18.7);
  assert.equal(r2.efficiencyStatus, 'EXCESS_WARNING');

  const overall = computeOverallCoalEfficiencyReport(initialRounds, 17.2);
  assert.equal(overall.totalBricksFired, 1252000);
  assert.equal(overall.excessWarningCount, 1);
  assert.equal(overall.bestRound?.record.roundNo, 1);
  assert.ok(overall.avgWoodPerLakhMaunds > 0);
  assert.equal(overall.firemanSummaries.length, 2);
  assert.equal(overall.firemanSummaries[0].efficiencyStatus, 'OPTIMAL');
  assert.equal(overall.firemanSummaries[1].efficiencyStatus, 'EXCESS_WARNING');
});

test('computeSmartKilnAlerts aggregates customer due, coal excess burn, booking delivery, license kisti, and dismisses resolved alerts', async () => {
  const {
    createInitialFiringRounds,
    computeSmartKilnAlerts,
  } = await import('./themeAndEstimatorLogic');

  const state = createInitialKilnState();
  state.salesMemos.push({
    id: 'm-due-alert-1',
    memoNo: 'SBL-2099',
    date: '2026-10-25',
    duePromiseDate: '2026-11-01',
    customerName: 'মোঃ রফিকুল ইসলাম',
    customerPhone: '01712-345678',
    customerAddress: 'সাতক্ষীরা সদর',
    truckNo: 'সাতক্ষীরা-ট-১১-৯৯৯৯',
    driverName: 'কবির',
    items: [],
    subTotal: 65000,
    discount: 0,
    totalAmount: 65000,
    paidAmount: 25000,
    dueAmount: 40000,
    status: 'PARTIAL',
    paymentMethod: 'নগদ ক্যাশ',
    deliveryStatus: 'DELIVERED',
    paymentHistory: [],
    deliveryHistory: [],
    createdAt: new Date().toISOString(),
  });

  const rounds = createInitialFiringRounds('2026-11-02');
  const report = computeSmartKilnAlerts(state, rounds, 17.2, '2026-11-02', []);

  assert.ok(report.totalActiveCount > 0);
  assert.ok(report.criticalCount >= 1);
  assert.ok(report.byCategory.DUE_TAGADA >= 1);
  assert.ok(report.byCategory.COAL_FIRING >= 1);

  const firstId = report.activeAlerts[0].id;
  const reportAfterDismiss = computeSmartKilnAlerts(state, rounds, 17.2, '2026-11-02', [firstId]);
  assert.equal(reportAfterDismiss.totalActiveCount, report.totalActiveCount - 1);
});


