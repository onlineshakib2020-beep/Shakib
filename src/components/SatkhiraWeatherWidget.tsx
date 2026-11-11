import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  Compass,
  Droplets,
  MapPin,
  RefreshCw,
  Sun,
  Umbrella,
  Wind,
} from 'lucide-react';
import {
  assessKilnRainRisk,
  extractNextHourlyForecast,
  getFallbackSatkhiraWeather,
  getWeatherCodeDescription,
  KILN_COORDINATES,
  type SatkhiraWeatherState,
} from '../utils/weatherLogic';
import { formatBn } from '../utils/kilnLogic';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

interface SatkhiraWeatherWidgetProps {
  isEn?: boolean;
  className?: string;
  onOpenMapModal?: () => void;
}

export const SatkhiraWeatherWidget: React.FC<SatkhiraWeatherWidgetProps> = ({
  isEn = false,
  className = '',
  onOpenMapModal,
}) => {
  const [weather, setWeather] = useState<SatkhiraWeatherState>(() => {
    // Try to restore last known weather from localStorage for instant display
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('sbl_satkhira_weather_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.temperature === 'number') {
            return parsed;
          }
        }
      } catch {
        // ignore parse error
      }
    }
    return getFallbackSatkhiraWeather();
  });

  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [showInlineMap, setShowInlineMap] = useState<boolean>(false);

  const fetchLiveWeather = useCallback(async () => {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${KILN_COORDINATES.lat}&longitude=${KILN_COORDINATES.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation_probability,rain&timezone=Asia%2FDhaka&forecast_days=2`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
      const data = await res.json();

      const current = data.current || {};
      const hourly = data.hourly || {};

      const temp = Math.round(current.temperature_2m ?? 31);
      const appTemp = Math.round(current.apparent_temperature ?? temp);
      const humidity = Math.round(current.relative_humidity_2m ?? 50);
      const windSpeed = Math.round(current.wind_speed_10m ?? 10);
      const rainMm = Number(current.rain ?? current.precipitation ?? 0);
      const code = Number(current.weather_code ?? 0);

      const slots = extractNextHourlyForecast(hourly, 6);
      const maxNextProb = slots.reduce((max, s) => Math.max(max, s.rainProbability), 0);

      const desc = getWeatherCodeDescription(code);
      const risk = assessKilnRainRisk(maxNextProb, rainMm, code);

      const nowTimeStr = new Date().toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const nextState: SatkhiraWeatherState = {
        temperature: temp,
        apparentTemperature: appTemp,
        humidity,
        windSpeed,
        precipitationMm: rainMm,
        weatherCode: code,
        conditionBn: desc.conditionBn,
        conditionEn: desc.conditionEn,
        risk,
        hourlySlots: slots,
        lastUpdated: nowTimeStr,
        isFallback: false,
      };

      setWeather(nextState);
      setLastRefreshedAt(nowTimeStr);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('sbl_satkhira_weather_cache', JSON.stringify(nextState));
        } catch {
          // ignore storage error
        }
      }
    } catch {
      // In case of network timeout or block, keep existing or fallback
      setWeather((prev) => ({
        ...prev,
        isFallback: true,
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveWeather();
    // Refresh weather every 15 minutes
    const interval = setInterval(fetchLiveWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLiveWeather]);

  const renderWeatherIcon = () => {
    const code = weather.weatherCode;
    if (code >= 95) return <CloudLightning className="w-8 h-8 text-amber-400 animate-pulse" />;
    if (code >= 80) return <CloudRain className="w-8 h-8 text-sky-400" />;
    if (code >= 51) return <CloudDrizzle className="w-8 h-8 text-sky-300" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-8 h-8 text-slate-300" />;
    return <Sun className="w-8 h-8 text-amber-400 animate-[spin_12s_linear_infinite]" />;
  };

  const isCritical = weather.risk.riskLevel === 'CRITICAL';
  const isModerate = weather.risk.riskLevel === 'MODERATE';

  return (
    <Card
      as="section"
      aria-label={isEn ? 'Kiln Local Weather & Rain Risk Tracker' : 'ভাটা লোকাল আবহাওয়া ও বৃষ্টির ঝুঁকি ট্র্যাকার'}
      data-testid="satkhira-weather-widget"
      variant={isCritical ? 'critical' : isModerate ? 'warning' : 'dark'}
      topAccent={isCritical ? 'rose' : isModerate ? 'amber' : 'orange'}
      padding="lg"
      className={`relative transition-all ${className}`}
    >
      {/* Decorative background glow */}
      <div
        className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          isCritical ? 'bg-rose-600/25' : isModerate ? 'bg-amber-500/20' : 'bg-orange-500/15'
        }`}
      />

      {/* Top Header: Location, Live Status & Refresh */}
      <CardHeader bordered borderVariant="dark" className="relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0 shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black tracking-wide uppercase text-orange-400">
                {isEn ? 'KILN LOCAL WEATHER · SATKHIRA' : 'ভাটা লোকাল আবহাওয়া ও বৃষ্টির ঝুঁকি ট্র্যাকার'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {isEn ? 'Live' : 'লাইভ'}
              </span>
              <span className="hidden md:inline-block text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                GPS: {KILN_COORDINATES.coordinatesRaw}
              </span>
            </div>
            <CardTitle as="h3" className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
              <span>
                {isEn ? KILN_COORDINATES.addressEn : KILN_COORDINATES.addressBn}
              </span>
              <span className="text-xs font-mono font-bold text-amber-300">
                ({KILN_COORDINATES.coordinatesStrBn})
              </span>
            </CardTitle>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {onOpenMapModal && (
            <button
              type="button"
              onClick={onOpenMapModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{isEn ? 'Kiln Live Map' : 'ভাটার গুগল ম্যাপ ও স্যাটেলাইট'}</span>
            </button>
          )}
          <span className="text-[11px] text-slate-400 tabular-nums">
            {isEn ? 'Updated:' : 'আপডেট:'}{' '}
            {weather.lastUpdated || lastRefreshedAt || 'লাইভ'}
          </span>
          <button
            type="button"
            onClick={fetchLiveWeather}
            disabled={loading}
            title={isEn ? 'Refresh Weather' : 'আবহাওয়া তথ্য রিফ্রেশ করুন'}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
            <span className="hidden sm:inline">{isEn ? 'Refresh' : 'রিফ্রেশ'}</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-4">
        {/* Current Core Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Main Temp & Condition (5 Cols) */}
          <Card
            variant="darkSubtle"
            padding="sm"
            className="md:col-span-5 flex items-center gap-4"
          >
            <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 shrink-0">
              {renderWeatherIcon()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatBn(weather.temperature)}°C
                </span>
                <span className="text-xs text-slate-400">
                  {isEn ? 'Feels' : 'অনুভূত'}: {formatBn(weather.apparentTemperature)}°C
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">
                {isEn ? weather.conditionEn : weather.conditionBn}
              </div>
            </div>
          </Card>

          {/* 3 Secondary Operational Indicators: Humidity, Wind, Rain (7 Cols) */}
          <div className="md:col-span-7 grid grid-cols-3 gap-2.5">
            <Card variant="darkSubtle" padding="sm" className="text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-400">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                <span>{isEn ? 'Humidity' : 'আর্দ্রতা'}</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-sky-300 tabular-nums mt-0.5">
                {formatBn(weather.humidity)}%
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {weather.humidity <= 55
                  ? isEn
                    ? 'Fast drying'
                    : 'দ্রুত ইট শুকাবে'
                  : isEn
                  ? 'Slow drying'
                  : 'দেরিতে শুকাবে'}
              </span>
            </Card>

            <Card variant="darkSubtle" padding="sm" className="text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-400">
                <Wind className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEn ? 'Wind' : 'বাতাস'}</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-300 tabular-nums mt-0.5">
                {formatBn(weather.windSpeed)}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  {isEn ? 'km/h' : 'কিমি/ঘ'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {weather.windSpeed >= 20
                  ? isEn
                    ? 'High wind'
                    : 'ঝড়ো বাতাস'
                  : isEn
                  ? 'Gentle breeze'
                  : 'স্বাভাবিক হাওয়া'}
              </span>
            </Card>

            <Card
              variant={weather.precipitationMm > 0 ? 'critical' : 'darkSubtle'}
              padding="sm"
              className="text-center transition-colors"
            >
              <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-400">
                <Umbrella className="w-3.5 h-3.5 text-rose-400" />
                <span>{isEn ? 'Rainfall' : 'বৃষ্টিপাত'}</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-white tabular-nums mt-0.5">
                {formatBn(weather.precipitationMm)}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  {isEn ? 'mm' : 'মিমি'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {weather.precipitationMm > 0
                  ? isEn
                    ? 'Active Rain'
                    : 'বৃষ্টি পড়ছে'
                  : isEn
                  ? 'No Rain'
                  : 'বৃষ্টি নেই'}
              </span>
            </Card>
          </div>
        </div>

        {/* Actionable Kiln Rain Advisory Banner */}
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            isCritical
              ? 'bg-rose-950/90 border-rose-600 text-white'
              : isModerate
              ? 'bg-amber-950/80 border-amber-500/80 text-amber-100'
              : 'bg-emerald-950/70 border-emerald-600/70 text-emerald-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-black/30 shrink-0 mt-0.5">
              {isCritical ? (
                <AlertTriangle className="w-5 h-5 text-rose-300 animate-bounce" />
              ) : isModerate ? (
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-xs sm:text-sm font-black tracking-tight">
                  {isEn ? weather.risk.labelEn : weather.risk.labelBn}
                </strong>
              </div>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                {isEn ? weather.risk.actionEn : weather.risk.actionBn}
              </p>
            </div>
          </div>

          {isCritical && (
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black shadow-sm uppercase tracking-wide">
                <Umbrella className="w-3.5 h-3.5" />
                {isEn ? 'Cover Bricks Now' : 'ইট ত্রিপল দিয়ে ঢাকুন'}
              </span>
            </div>
          )}
        </div>

        {/* Hourly Rain Probability Forecast (Next 6 Hours) */}
        {weather.hourlySlots && weather.hourlySlots.length > 0 && (
          <Card variant="darkSubtle" padding="sm" className="space-y-2.5 bg-slate-950/60">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>
                {isEn
                  ? 'Next 6 Hours Rain Probability (Hourly Timeline):'
                  : 'আগামী ৬ ঘণ্টার বৃষ্টির সম্ভাবনা (ঘণ্টাভিত্তিক পূর্বাভাস):'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isEn ? 'Green: Safe · Red: Rain Risk' : 'সবুজ: নিরাপদ · লাল: বৃষ্টির ঝুঁকি'}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {weather.hourlySlots.map((slot, idx) => {
                const prob = slot.rainProbability;
                const isSlotHigh = prob >= 40;
                const isSlotMed = prob >= 20 && prob < 40;
                const barColor = isSlotHigh
                  ? 'bg-rose-500'
                  : isSlotMed
                  ? 'bg-amber-400'
                  : 'bg-emerald-400';
                const textColor = isSlotHigh
                  ? 'text-rose-400 font-bold'
                  : isSlotMed
                  ? 'text-amber-400 font-semibold'
                  : 'text-emerald-400';

                return (
                  <div
                    key={`${slot.timeStr}-${idx}`}
                    className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 text-center space-y-1"
                  >
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {slot.timeStr}
                    </span>
                    <div className="text-xs font-mono tabular-nums">
                      <span className={textColor}>{formatBn(prob)}%</span>
                    </div>
                    {/* Visual miniature probability fill bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${Math.max(6, prob)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Collapsible Inline Live Kiln Map Preview (22.754719, 89.039367) */}
        {showInlineMap && (
          <Card
            variant="darkSubtle"
            padding="sm"
            data-testid="inline-kiln-map-preview"
            className="space-y-2.5 bg-slate-950/80"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <MapPin className="w-4 h-4 text-orange-500" />
                <span>
                  ভাটার সরাসরি স্যাটেলাইট লোকেশন পিন ({KILN_COORDINATES.coordinatesRaw})
                </span>
              </div>
              {onOpenMapModal && (
                <button
                  type="button"
                  onClick={onOpenMapModal}
                  className="text-[11px] font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer"
                >
                  পূর্ণাঙ্গ ল্যান্ডমার্ক ম্যাপ ও স্যাটেলাইট ভিউ খুলুন →
                </button>
              )}
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-700 h-56 bg-slate-900">
              <iframe
                title="Satkhira Kiln Exact GPS Location Preview"
                src={`https://maps.google.com/maps?q=${KILN_COORDINATES.lat},${KILN_COORDINATES.lon}&hl=bn&z=17&t=k&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
