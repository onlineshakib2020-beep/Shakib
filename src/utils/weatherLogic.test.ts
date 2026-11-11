import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessKilnRainRisk,
  extractNextHourlyForecast,
  formatHourSlotLabel,
  getFallbackSatkhiraWeather,
  getWeatherCodeDescription,
} from './weatherLogic';

test('getWeatherCodeDescription maps WMO codes accurately to Bengali and English', () => {
  const clear = getWeatherCodeDescription(0);
  assert.equal(clear.conditionBn, 'রৌদ্রোজ্জ্বল পরিষ্কার আকাশ');
  assert.equal(clear.conditionEn, 'Clear Sunny Sky');
  assert.equal(clear.iconType, 'sun');

  const partlyCloudy = getWeatherCodeDescription(2);
  assert.equal(partlyCloudy.conditionBn, 'আংশিক মেঘলা আকাশ');
  assert.equal(partlyCloudy.iconType, 'cloud');

  const rain = getWeatherCodeDescription(63);
  assert.equal(rain.conditionBn, 'মাঝারি থেকে ভারি বৃষ্টি');
  assert.equal(rain.iconType, 'rain');

  const thunder = getWeatherCodeDescription(95);
  assert.equal(thunder.conditionBn, 'বজ্রসহ বৃষ্টিপাত (কালবৈশাখী)');
  assert.equal(thunder.iconType, 'thunder');
});

test('assessKilnRainRisk categorizes risk correctly for brick drying operations', () => {
  // Low probability, no rain => SAFE
  const safe = assessKilnRainRisk(10, 0, 0);
  assert.equal(safe.riskLevel, 'SAFE');
  assert.match(safe.labelBn, /অনুকূল/);

  // Moderate probability => MODERATE
  const moderate = assessKilnRainRisk(30, 0, 2);
  assert.equal(moderate.riskLevel, 'MODERATE');
  assert.match(moderate.actionBn, /পলিথিন প্রস্তুত রাখুন/);

  // High probability => CRITICAL
  const criticalProb = assessKilnRainRisk(60, 0, 1);
  assert.equal(criticalProb.riskLevel, 'CRITICAL');
  assert.match(criticalProb.labelBn, /জরুরি সতর্কতা/);

  // Currently raining code (e.g. 61) => CRITICAL
  const criticalRaining = assessKilnRainRisk(10, 1.2, 61);
  assert.equal(criticalRaining.riskLevel, 'CRITICAL');
  assert.match(criticalRaining.actionBn, /পলিথিন ও ত্রিপল দিয়ে ঢেকে রাখুন/);
});

test('extractNextHourlyForecast extracts upcoming time slots and rain probabilities', () => {
  const now = new Date();
  const times: string[] = [];
  const probs: number[] = [];
  const rains: number[] = [];

  for (let i = 0; i < 10; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    times.push(d.toISOString().slice(0, 19));
    probs.push(i * 10);
    rains.push(i === 5 ? 1.5 : 0);
  }

  const slots = extractNextHourlyForecast(
    {
      time: times,
      precipitation_probability: probs,
      rain: rains,
    },
    6
  );

  assert.equal(slots.length, 6);
  assert.ok(slots[0].timeStr);
  assert.ok(typeof slots[0].rainProbability === 'number');
});

test('getFallbackSatkhiraWeather provides safe default state when offline', () => {
  const fb = getFallbackSatkhiraWeather();
  assert.equal(fb.isFallback, true);
  assert.ok(fb.temperature > 0);
  assert.equal(fb.hourlySlots.length, 6);
  assert.equal(fb.risk.riskLevel, 'SAFE');
});
