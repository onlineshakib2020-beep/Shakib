import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFiringEfficiency,
  parseSmartKilnCommand,
} from './aiCommandAndEfficiencyLogic.ts';

describe('parseSmartKilnCommand — Smart AI Voice & Text Command Agent', () => {
  it('parses Banglish memo creation command: "3302 deya akta memo koro 2 no eit 5000 rate 10000 kore hajar phone 01711223344 thikana Satkhira নাম করিম"', () => {
    const cmd =
      '3302 deya akta memo koro 2 no eit 5000 rate 10000 kore hajar phone 01711223344 thikana Satkhira নাম করিম';
    const res = parseSmartKilnCommand(cmd);

    assert.equal(res.intent, 'CREATE_MEMO');
    assert.ok(res.memoPayload);
    assert.equal(res.memoPayload.memoNo, '3302');
    assert.equal(res.memoPayload.gradeId, 'grade-2');
    assert.equal(res.memoPayload.quantity, 5000);
    assert.equal(res.memoPayload.ratePerThousand, 10000);
    assert.equal(res.memoPayload.totalAmount, 50000);
    assert.equal(res.memoPayload.customerPhone, '01711223344');
    assert.equal(res.memoPayload.customerAddress, 'সাতক্ষীরা সদর');
    assert.equal(res.memoPayload.customerName, 'করিম');
  });

  it('parses Banglish firewood khotian command: "hafijul 50 mon kat deyase ata or khotian a add koro r tk dese 4000"', () => {
    const cmd =
      'hafijul 50 mon kat deyase ata or khotian a add koro r tk dese 4000';
    const res = parseSmartKilnCommand(cmd);

    assert.equal(res.intent, 'ADD_WOOD_FUEL_KHOTIAN');
    assert.ok(res.woodFuelPayload);
    assert.equal(res.woodFuelPayload.supplierName, 'হাফিজুল ইসলাম');
    assert.equal(res.woodFuelPayload.quantity, 50);
    assert.equal(res.woodFuelPayload.unit, 'মণ');
    assert.equal(res.woodFuelPayload.paidAmount, 4000);
    assert.equal(res.woodFuelPayload.totalBill, 50 * 180);
    assert.equal(res.woodFuelPayload.dueAmount, 9000 - 4000);
  });

  it('parses Bangla script memo command with partial deposit', () => {
    const cmd =
      'মেমো ৩৩০৫ ১ নং ইট ৩০০০ পিস দর ১১০০০ নাম রহিম ঠিকানা কলারোয়া জমা ২০০০০';
    const res = parseSmartKilnCommand(cmd);

    assert.equal(res.intent, 'CREATE_MEMO');
    assert.ok(res.memoPayload);
    assert.equal(res.memoPayload.memoNo, '3305');
    assert.equal(res.memoPayload.gradeId, 'grade-1');
    assert.equal(res.memoPayload.quantity, 3000);
    assert.equal(res.memoPayload.ratePerThousand, 11000);
    assert.equal(res.memoPayload.totalAmount, 33000);
    assert.equal(res.memoPayload.paidAmount, 20000);
    assert.equal(res.memoPayload.dueAmount, 13000);
  });

  it('parses coal supplier khotian command accurately', () => {
    const cmd = 'rofiq 20 ton koyla deyase rate 18000 tk dese 150000';
    const res = parseSmartKilnCommand(cmd);

    assert.equal(res.intent, 'ADD_SOIL_COAL_KHOTIAN');
    assert.ok(res.soilCoalPayload);
    assert.equal(res.soilCoalPayload.itemType, 'COAL');
    assert.equal(res.soilCoalPayload.supplierName, 'রফিকুল ইসলাম');
    assert.equal(res.soilCoalPayload.quantity, 20);
    assert.equal(res.soilCoalPayload.ratePerUnit, 18000);
    assert.equal(res.soilCoalPayload.totalBill, 360000);
    assert.equal(res.soilCoalPayload.paidAmount, 150000);
  });
});

describe('calculateFiringEfficiency — Kiln Round Coal & Firing Efficiency Tracker', () => {
  it('computes optimal efficiency when coal per 1 lakh bricks is <= 17.5 tons', () => {
    const res = calculateFiringEfficiency({
      roundNo: 1,
      bricksFired: 400000,
      coalUsedTons: 64, // 16 tons per 1 lakh
      coalRatePerTon: 18500,
      woodUsedMaunds: 400, // 100 maunds per 1 lakh
      woodRatePerMaund: 180,
      targetCoalTonsPerLakh: 17,
    });

    assert.equal(res.bricksInLakhs, 4);
    assert.equal(res.coalTonsPerLakhBricks, 16);
    assert.equal(res.coalKgPerThousandBricks, 160);
    assert.equal(res.woodMaundsPerLakhBricks, 100);
    assert.equal(res.rating, 'OPTIMAL');
    assert.equal(res.totalCoalCost, 64 * 18500);
    assert.equal(res.totalWoodCost, 400 * 180);
  });

  it('flags excessive fuel usage when coal exceeds 20 tons per 1 lakh bricks', () => {
    const res = calculateFiringEfficiency({
      roundNo: 2,
      bricksFired: 300000,
      coalUsedTons: 66, // 22 tons per 1 lakh
      coalRatePerTon: 18000,
      woodUsedMaunds: 360,
      woodRatePerMaund: 180,
    });

    assert.equal(res.coalTonsPerLakhBricks, 22);
    assert.equal(res.rating, 'EXCESSIVE');
  });
});
