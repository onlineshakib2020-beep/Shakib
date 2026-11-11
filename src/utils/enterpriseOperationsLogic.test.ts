import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyWhatsAppClosingSummary,
  calculateStaffSalaryPayable,
  computeBrickWastageSummary,
  computeKilnChamberSummary,
  computeLandLeaseSummary,
  createInitialEnterpriseState,
} from './enterpriseOperationsLogic';
import { createInitialKilnState, getTodayAndYesterday } from './seedData';
import { calculateDashboardMetrics } from './kilnLogic';
import { normalizeToPureBengali, normalizeToPureEnglish } from './languageNormalizer';

test('computeKilnChamberSummary aggregates 24 chambers accurately', () => {
  const state = createInitialEnterpriseState('2026-11-01');
  assert.equal(state.chambers.length, 24);
  const summary = computeKilnChamberSummary(state.chambers);
  assert.equal(summary.counts.FIRING, 4);
  assert.equal(summary.counts.LOADING, 4);
  assert.equal(summary.counts.UNLOADING, 4);
  assert.equal(summary.counts.EMPTY, 4);
  assert.ok(summary.totalBricksInKiln > 0);
  assert.equal(summary.maxFiringTempC, 980);
});

test('computeBrickWastageSummary calculates wastage percentage and loss breakdown', () => {
  const state = createInitialEnterpriseState('2026-11-01');
  const summary = computeBrickWastageSummary(state.wastageRecords, 37000);
  assert.equal(summary.rawRainLost, 1200);
  assert.equal(summary.chulliOverburntLost, 650);
  assert.equal(summary.totalBricksLost, 1850);
  assert.equal(summary.wastagePct, 5);
});

test('calculateStaffSalaryPayable computes net payable after advance deduction', () => {
  const res = calculateStaffSalaryPayable(20000, 3000, 10000);
  assert.equal(res.netPayableAfterAdvance, 17000);
  assert.equal(res.remainingDue, 7000);
  assert.equal(res.status, 'PARTIAL');

  const paidFull = calculateStaffSalaryPayable(15000, 2000, 13000);
  assert.equal(paidFull.remainingDue, 0);
  assert.equal(paidFull.status, 'PAID');
});

test('computeLandLeaseSummary computes total trucks, remaining trucks, and due balance', () => {
  const state = createInitialEnterpriseState('2026-11-01');
  const summary = computeLandLeaseSummary(state.landLeases);
  assert.equal(summary.totalAreaBigha, 7.5);
  assert.equal(summary.totalContractedTrucks, 570);
  assert.equal(summary.totalDeliveredTrucks, 435);
  assert.equal(summary.remainingTrucks, 135);
  assert.equal(summary.totalDueAmount, 60000);
});

test('buildDailyWhatsAppClosingSummary generates pure Bengali and pure English summaries', () => {
  const db = createInitialKilnState();
  const { todayDate, yesterdayDate } = getTodayAndYesterday();
  const metrics = calculateDashboardMetrics(db, todayDate, yesterdayDate);

  const bnMsg = buildDailyWhatsAppClosingSummary(db, metrics, 'bn');
  assert.ok(bnMsg.includes('SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)'));
  assert.ok(!bnMsg.includes('Today Bricks Sold'));

  const enMsg = buildDailyWhatsAppClosingSummary(db, metrics, 'en');
  assert.ok(enMsg.includes('SBL Sweet Clay Bricks (Babulia, Satkhira)'));
  assert.ok(!/[০-৯]/.test(enMsg));
});

test('normalizeToPureBengali and normalizeToPureEnglish enforce English digits (0-9) and clean output', () => {
  const mixedBn = 'মোট ইট বিক্রয় (Total Sales) - ২০২৬-১১-০১';
  const pureBn = normalizeToPureBengali(mixedBn);
  assert.ok(pureBn.includes('Total Sales'));
  assert.ok(pureBn.includes('2026-11-01'));
  assert.ok(!/[০-৯]/.test(pureBn));

  const bnCurrency = 'মোট ইট বিক্রয় ৳ ১,২৫,০০০ পিস ইট';
  const pureEn = normalizeToPureEnglish(bnCurrency);
  assert.ok(pureEn.includes('Total Brick Sales'));
  assert.ok(pureEn.includes('Tk 1,25,000'));
  assert.ok(!/[০-৯]/.test(pureEn));
});

