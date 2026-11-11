/**
 * SBL Brick Kiln GPS Coordinates & Location Metadata (Satkhira, Bangladesh)
 * Requested by User: 22.754719, 89.039367
 */
export const KILN_COORDINATES = {
  lat: 22.754719,
  lon: 89.039367,
  addressBn: 'সৌদিয়া ট্রেডার্স · SBL মিষ্টি মাটির ইট ভাটা (সাতক্ষীরা)',
  addressEn: 'Saudia Traders · SBL Sweet Clay Brick Kiln (Satkhira)',
  coordinatesStrBn: '২২.৭৫৪৭১৯° N, ৮৯.০৩৯৩৬৭° E',
  coordinatesRaw: '22.754719, 89.039367',
  googleMapsUrl: 'https://www.google.com/maps?q=22.754719,89.039367',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=22.754719,89.039367',
};

export interface KilnWeatherRisk {
  riskLevel: 'SAFE' | 'MODERATE' | 'CRITICAL';
  labelBn: string;
  labelEn: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  actionBn: string;
  actionEn: string;
}

export interface HourlyForecastSlot {
  timeStr: string; // e.g. "12:00 PM" or "১২:০০"
  hourNum: number;
  rainProbability: number; // 0 - 100
  rainMm: number;
}

export interface SatkhiraWeatherState {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  precipitationMm: number;
  weatherCode: number;
  conditionBn: string;
  conditionEn: string;
  risk: KilnWeatherRisk;
  hourlySlots: HourlyForecastSlot[];
  lastUpdated: string;
  isFallback: boolean;
}

/**
 * Maps WMO Weather Interpretation Codes (WW) to human-readable Bengali & English descriptions.
 */
export function getWeatherCodeDescription(code: number): {
  conditionBn: string;
  conditionEn: string;
  iconType: 'sun' | 'cloud' | 'rain' | 'thunder' | 'fog';
} {
  if (code === 0) {
    return { conditionBn: 'রৌদ্রোজ্জ্বল পরিষ্কার আকাশ', conditionEn: 'Clear Sunny Sky', iconType: 'sun' };
  }
  if (code >= 1 && code <= 3) {
    return { conditionBn: 'আংশিক মেঘলা আকাশ', conditionEn: 'Partly Cloudy', iconType: 'cloud' };
  }
  if (code === 45 || code === 48) {
    return { conditionBn: 'কুয়াশাচ্ছন্ন আবহাওয়া', conditionEn: 'Foggy / Mist', iconType: 'fog' };
  }
  if (code >= 51 && code <= 57) {
    return { conditionBn: 'হালকা গুঁড়ি গুঁড়ি বৃষ্টি', conditionEn: 'Light Drizzle', iconType: 'rain' };
  }
  if (code >= 61 && code <= 67) {
    return { conditionBn: 'মাঝারি থেকে ভারি বৃষ্টি', conditionEn: 'Rain Showers', iconType: 'rain' };
  }
  if (code >= 80 && code <= 82) {
    return { conditionBn: 'ভারী বর্ষণ / পশলা বৃষ্টি', conditionEn: 'Heavy Showers', iconType: 'rain' };
  }
  if (code >= 95 && code <= 99) {
    return { conditionBn: 'বজ্রসহ বৃষ্টিপাত (কালবৈশাখী)', conditionEn: 'Thunderstorm', iconType: 'thunder' };
  }
  return { conditionBn: 'স্বাভাবিক আবহাওয়া', conditionEn: 'Normal Weather', iconType: 'sun' };
}

/**
 * Assesses rain risk for kiln brick drying field operations.
 * - Raw drying bricks dissolve and get damaged when exposed to rainwater.
 */
export function assessKilnRainRisk(
  maxRainProbability: number,
  currentRainMm: number,
  weatherCode: number
): KilnWeatherRisk {
  // If it's currently raining or thunderstorm
  const isCurrentlyRaining = currentRainMm > 0.2 || (weatherCode >= 51 && weatherCode <= 99);

  if (isCurrentlyRaining || maxRainProbability >= 45) {
    return {
      riskLevel: 'CRITICAL',
      labelBn: '⚠️ জরুরি সতর্কতা! বৃষ্টির উচ্চ ঝুঁকি',
      labelEn: '⚠️ CRITICAL! High Rain Risk',
      badgeBg: 'bg-rose-500/20',
      textColor: 'text-rose-400',
      borderColor: 'border-rose-500/60',
      actionBn: 'মাঠের কাঁচা ইট দ্রুত পলিথিন ও ত্রিপল দিয়ে ঢেকে রাখুন! কাঁচা ইট গলনের আশঙ্কা রয়েছে।',
      actionEn: 'Immediately cover drying bricks with polythene tarpaulins! High risk of mud melt.',
    };
  }

  if (maxRainProbability >= 20 || (weatherCode >= 1 && weatherCode <= 3 && maxRainProbability >= 15)) {
    return {
      riskLevel: 'MODERATE',
      labelBn: 'সতর্কতা: বৃষ্টির সম্ভাবনা বিদ্যমান',
      labelEn: 'MODERATE: Chance of Rain',
      badgeBg: 'bg-amber-500/20',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/60',
      actionBn: 'আকাশ মেঘলা বা বৃষ্টির আভাস। মাঠে ত্রিপল ও পলিথিন প্রস্তুত রাখুন, সর্দারদের সতর্ক করুন।',
      actionEn: 'Clouds in sky. Keep polythene rolls ready on field and alert yard sardars.',
    };
  }

  return {
    riskLevel: 'SAFE',
    labelBn: 'অনুকূল আবহাওয়া: বৃষ্টির কোনো ঝুঁকি নেই',
    labelEn: 'SAFE: Ideal Sunny Weather',
    badgeBg: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60',
    actionBn: 'রোদে কাঁচা ইট শুকানো ও চুল্লি পোড়াইয়ের জন্য চমৎকার আবহাওয়া। পুরোদমে কাজ চালানো যাবে।',
    actionEn: 'Perfect conditions for open-air brick drying and kiln firing operations.',
  };
}

/**
 * Formats hour string into standard time format.
 */
export function formatHourSlotLabel(isoTimeStr: string): string {
  try {
    const d = new Date(isoTimeStr);
    let h = d.getHours();
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:00 ${period}`;
  } catch {
    return isoTimeStr.slice(11, 16) || 'N/A';
  }
}

/**
 * Extracts the next N hours of forecast from Open-Meteo response.
 */
export function extractNextHourlyForecast(
  hourlyData: {
    time?: string[];
    precipitation_probability?: number[];
    rain?: number[];
  },
  hoursCount = 6
): HourlyForecastSlot[] {
  if (!hourlyData || !Array.isArray(hourlyData.time)) {
    return [];
  }

  const now = new Date();
  const currentHourEpoch = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();

  const slots: HourlyForecastSlot[] = [];
  const times = hourlyData.time;
  const probs = hourlyData.precipitation_probability || [];
  const rains = hourlyData.rain || [];

  for (let i = 0; i < times.length && slots.length < hoursCount; i++) {
    const tEpoch = new Date(times[i]).getTime();
    if (tEpoch >= currentHourEpoch) {
      const d = new Date(times[i]);
      slots.push({
        timeStr: formatHourSlotLabel(times[i]),
        hourNum: d.getHours(),
        rainProbability: Math.min(100, Math.max(0, probs[i] ?? 0)),
        rainMm: Math.max(0, rains[i] ?? 0),
      });
    }
  }

  return slots;
}

/**
 * Provides a resilient, realistic fallback weather object for Satkhira in case of network offline.
 */
export function getFallbackSatkhiraWeather(): SatkhiraWeatherState {
  const defaultHourly: HourlyForecastSlot[] = [
    { timeStr: '১০:০০ AM', hourNum: 10, rainProbability: 5, rainMm: 0 },
    { timeStr: '১২:০০ PM', hourNum: 12, rainProbability: 10, rainMm: 0 },
    { timeStr: '০২:০০ PM', hourNum: 14, rainProbability: 10, rainMm: 0 },
    { timeStr: '০৪:০০ PM', hourNum: 16, rainProbability: 5, rainMm: 0 },
    { timeStr: '০৬:০০ PM', hourNum: 18, rainProbability: 5, rainMm: 0 },
    { timeStr: '০৮:০০ PM', hourNum: 20, rainProbability: 5, rainMm: 0 },
  ];

  return {
    temperature: 31,
    apparentTemperature: 33,
    humidity: 48,
    windSpeed: 11,
    precipitationMm: 0,
    weatherCode: 0,
    conditionBn: 'রৌদ্রোজ্জ্বল পরিষ্কার আকাশ',
    conditionEn: 'Clear Sunny Sky',
    risk: assessKilnRainRisk(10, 0, 0),
    hourlySlots: defaultHourly,
    lastUpdated: 'অফলাইন ব্যাকআপ',
    isFallback: true,
  };
}
