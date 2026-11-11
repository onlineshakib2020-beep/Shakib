import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Layers,
  MapPin,
  Navigation,
  X,
  Copy,
  Check,
  Compass,
  Flame,
  Truck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { KILN_COORDINATES } from '../utils/weatherLogic';

interface KilnMapLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEn?: boolean;
}

interface KilnZone {
  id: string;
  nameBn: string;
  nameEn: string;
  category: 'chulli' | 'mill' | 'office' | 'delivery' | 'field';
  lat: number;
  lng: number;
  descBn: string;
  descEn: string;
}

const KILN_ZONES: KilnZone[] = [
  {
    id: 'zone-main-chulli',
    nameBn: 'মূল চুল্লি ও ফায়ারিং এলাকা',
    nameEn: 'Main Brick Firing Kiln',
    category: 'chulli',
    lat: 22.754719,
    lng: 89.039367,
    descBn: 'কেন্দ্রীয় চুল্লি, চিমনি ও পোড়াই মিস্ত্রিদের কর্মস্থল (22.754719, 89.039367)',
    descEn: 'Core kiln chimneystack, porai mistri chambers and brick firing zone',
  },
  {
    id: 'zone-drying-field',
    nameBn: 'কাঁচা ইট শুকানোর সুবিশাল মাঠ',
    nameEn: 'Raw Brick Sun Drying Field',
    category: 'field',
    lat: 22.75515,
    lng: 89.0392,
    descBn: 'রোদ শুকানো মাঠ ও ত্রিপল প্রোটেকশন জোন (বৃষ্টির ঝুঁকি ট্র্যাকার সংযুক্ত)',
    descEn: 'Open air sun drying yard with rain tarp coverage area',
  },
  {
    id: 'zone-mill-ohhab',
    nameBn: '1 নং ওহাব মিল পট',
    nameEn: 'Mill Pot 1 (Ohhab Mill)',
    category: 'mill',
    lat: 22.75435,
    lng: 89.03895,
    descBn: 'ওহাব সর্দারের কাঁচা ইট তৈরির মিল মেশিন ও লেবার শেড',
    descEn: 'Ohhab mill brick cutting pugmill and labor shed',
  },
  {
    id: 'zone-mill-mofijul',
    nameBn: '2 নং মফিজুল মিল পট',
    nameEn: 'Mill Pot 2 (Mofijul Mill)',
    category: 'mill',
    lat: 22.75458,
    lng: 89.03982,
    descBn: 'মফিজুল সর্দারের কাঁচা ইট কাটার মিল এলাকা',
    descEn: 'Mofijul mill brick cutting pugmill station',
  },
  {
    id: 'zone-mill-shofikul',
    nameBn: '3 নং শফিকুল মিল পট',
    nameEn: 'Mill Pot 3 (Shofikul Mill)',
    category: 'mill',
    lat: 22.75532,
    lng: 89.03875,
    descBn: 'শফিকুল সর্দারের মিল পট ও মাটি ডাম্পিং স্পট',
    descEn: 'Shofikul mill clay molding setup and depot',
  },
  {
    id: 'zone-office-counter',
    nameBn: 'ভাটা অফিস ও ক্যাশ কাউন্টার',
    nameEn: 'Kiln Office & Cash Counter',
    category: 'office',
    lat: 22.75445,
    lng: 89.03945,
    descBn: 'মেমো প্রদান, ক্যাশ বুক এন্ট্রি ও গ্রাহক অভ্যর্থনা কক্ষ',
    descEn: 'Cash register desk, memo counter and proprietor room',
  },
  {
    id: 'zone-truck-gate',
    nameBn: 'প্রধান গেট ও ট্রাক আনলোড ডিপো',
    nameEn: 'Main Gate & Truck Delivery Depot',
    category: 'delivery',
    lat: 22.75418,
    lng: 89.03962,
    descBn: 'কয়লা, মাটি ট্রাক ও ইট ডেলিভারি ভেকু এন্ট্রি গেট',
    descEn: 'Coal truck unloading, veku entry and delivery dispatch gate',
  },
];

export const KilnMapLocationModal: React.FC<KilnMapLocationModalProps> = ({
  isOpen,
  onClose,
  isEn = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('satellite');
  const [copied, setCopied] = useState(false);
  const [activeZone, setActiveZone] = useState<KilnZone>(KILN_ZONES[0]);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  // Reference to google map instance
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const apiKey =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY) ||
    'AIzaSyA_1kk9-ERoDJGzPT2HewjNMegU9Glv1ds';

  const handleCopyCoordinates = () => {
    navigator.clipboard.writeText(KILN_COORDINATES.coordinatesRaw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Initialize Google Maps JavaScript API with automatic gm_authFailure fallback
  useEffect(() => {
    if (!isOpen || useEmbedFallback) return;

    let isMounted = true;
    const win = window as unknown as { gm_authFailure?: () => void };
    const prevAuthFailure = win.gm_authFailure;
    win.gm_authFailure = () => {
      if (isMounted) {
        setLoadError(true);
        setUseEmbedFallback(true);
      }
    };

    const initMap = async () => {
      try {
        setOptions({
          key: apiKey,
          v: 'weekly',
          language: isEn ? 'en' : 'bn',
        });

        const mapsLib = (await importLibrary('maps')) as google.maps.MapsLibrary;
        const markerLib = (await importLibrary('marker')) as google.maps.MarkerLibrary;
        if (!isMounted || !mapContainerRef.current) return;

        const center = { lat: activeZone.lat, lng: activeZone.lng };

        const map = new mapsLib.Map(mapContainerRef.current, {
          center,
          zoom: 17,
          mapTypeId: mapType,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        googleMapInstanceRef.current = map;

        // Clear existing markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        // Add markers for all kiln zones
        KILN_ZONES.forEach((zone) => {
          const isMain = zone.id === 'zone-main-chulli';
          const marker = new markerLib.Marker({
            position: { lat: zone.lat, lng: zone.lng },
            map,
            title: isEn ? zone.nameEn : zone.nameBn,
            animation:
              isMain && typeof window !== 'undefined' && (window as unknown as { google?: typeof google }).google?.maps?.Animation
                ? (window as unknown as { google?: typeof google }).google?.maps?.Animation?.DROP
                : undefined,
          });

          const infoWindow = new mapsLib.InfoWindow({
            content: `
              <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 240px; color: #0F172A;">
                <div style="font-size: 13px; font-weight: 800; color: #C2410C;">${
                  isEn ? zone.nameEn : zone.nameBn
                }</div>
                <div style="font-size: 11px; color: #475569; margin-top: 3px;">${
                  isEn ? zone.descEn : zone.descBn
                }</div>
                <div style="font-size: 10px; font-weight: bold; color: #059669; margin-top: 4px;">
                  GPS: ${zone.lat.toFixed(6)}, ${zone.lng.toFixed(6)}
                </div>
              </div>
            `,
          });

          marker.addListener('click', () => {
            setActiveZone(zone);
            infoWindow.open(map, marker);
          });

          if (isMain) {
            infoWindow.open(map, marker);
          }

          markersRef.current.push(marker);
        });

        setMapsLoaded(true);
        setLoadError(false);
      } catch (err) {
        // If Google Maps API loader fails (domain restrictions, network), switch gracefully to Google Maps Embed iframe
        console.warn('Google Maps JS API load failed, switching to Google Maps Embed iframe:', err);
        if (isMounted) {
          setLoadError(true);
          setUseEmbedFallback(true);
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      win.gm_authFailure = prevAuthFailure;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [isOpen, mapType, useEmbedFallback, apiKey]);

  // Update map center when active zone changes
  useEffect(() => {
    if (googleMapInstanceRef.current) {
      googleMapInstanceRef.current.panTo({ lat: activeZone.lat, lng: activeZone.lng });
      googleMapInstanceRef.current.setZoom(17);
    }
  }, [activeZone]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiln-map-title"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white border border-slate-200 border-t-4 border-t-orange-600 rounded-3xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-950/40 shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                  {isEn ? 'KILN GPS & GOOGLE MAPS LOCATION' : 'ভাটা জিপিএস ও লাইভ গুগল ম্যাপ'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {isEn ? 'Live Verified' : 'সরাসরি ভেরিফাইড'}
                </span>
              </div>
              <h2 id="kiln-map-title" className="text-base sm:text-lg font-black text-white">
                {isEn
                  ? 'SBL Sweet Clay Bricks (Babulia, Satkhira)'
                  : 'SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Direct Google Maps Navigation Button */}
            <a
              href={KILN_COORDINATES.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isEn ? 'Get Directions' : 'ডিরেকশন ও রাস্তা'}</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="ম্যাপ মডাল বন্ধ করুন"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* GPS Quick Strip */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-orange-400 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              {isEn ? 'Coordinates:' : 'জিপিএস কোঅর্ডিনেট:'}
            </span>
            <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              {KILN_COORDINATES.coordinatesRaw}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              ({KILN_COORDINATES.coordinatesStrBn})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{isEn ? 'Copied!' : 'কপি হয়েছে!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? 'Copy Coordinates' : 'কোঅর্ডিনেট কপি'}</span>
                </>
              )}
            </button>

            {/* Map Mode Toggle: Satellite vs Roadmap */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700">
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                  mapType === 'satellite'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isEn ? 'Satellite' : 'স্যাটেলাইট ভিউ'}
              </button>
              <button
                type="button"
                onClick={() => setMapType('roadmap')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                  mapType === 'roadmap'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isEn ? 'Roadmap' : 'রোড ম্যাপ'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Main Body: Left Zone Selector + Right Interactive Map */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-[380px] sm:min-h-[480px]">
          {/* Left 4 Cols: Kiln Zones & Landmarks List */}
          <div className="lg:col-span-4 bg-slate-50 border-r border-slate-200 p-3.5 overflow-y-auto space-y-2 max-h-[220px] lg:max-h-none">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 px-1 mb-1">
              {isEn ? 'Kiln Field Landmarks (Click to Locate):' : 'ভাটার অভ্যন্তরীণ ল্যান্ডমার্ক (ক্লিক করে জুম করুন):'}
            </div>

            {KILN_ZONES.map((zone) => {
              const isSelected = activeZone.id === zone.id;
              const isChulli = zone.category === 'chulli';
              const isMill = zone.category === 'mill';
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setActiveZone(zone)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-orange-500 shadow-sm ring-2 ring-orange-500/20'
                      : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isChulli
                          ? 'bg-rose-100 text-rose-700'
                          : isMill
                          ? 'bg-amber-100 text-amber-700'
                          : zone.category === 'delivery'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isChulli ? (
                        <Flame className="w-4 h-4" />
                      ) : isMill ? (
                        <Layers className="w-4 h-4" />
                      ) : zone.category === 'delivery' ? (
                        <Truck className="w-4 h-4" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {isEn ? zone.nameEn : zone.nameBn}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {isEn ? zone.descEn : zone.descBn}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-950 mt-3 space-y-1">
              <strong className="block font-black text-orange-900">
                {isEn ? '📍 Exact Kiln Center Coordinates:' : '📍 ভাটার সঠিক মূল জিপিএস পিন:'}
              </strong>
              <div className="font-mono font-bold text-orange-800">22.754719, 89.039367</div>
              <p className="text-[11px] text-orange-900/80 leading-relaxed">
                {isEn
                  ? 'All rain forecasts, cloud trackers, and soil logistics are synchronized with this exact coordinate.'
                  : 'সকল বৃষ্টি পূর্বাভাস, মেঘ ট্র্যাকার ও মাটি/কয়লা ট্র্যাকিং এই সুনির্দিষ্ট পিন অনুযায়ী আপডেট হয়।'}
              </p>
            </div>
          </div>

          {/* Right 8 Cols: Interactive Google Maps Canvas or Embed Fallback */}
          <div className="lg:col-span-8 relative bg-slate-900 flex flex-col h-full min-h-[360px]">
            {!useEmbedFallback ? (
              <div ref={mapContainerRef} className="w-full h-full min-h-[360px] flex-1" />
            ) : (
              <iframe
                title="Google Maps Kiln Location"
                src={`https://maps.google.com/maps?q=${activeZone.lat},${activeZone.lng}&hl=bn&z=17&t=${
                  mapType === 'satellite' ? 'k' : 'm'
                }&output=embed`}
                className="w-full h-full min-h-[360px] flex-1 border-0"
                loading="lazy"
                allowFullScreen
              />
            )}

            {/* Active Landmark HUD Overlay on Bottom Right */}
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-slate-950/90 backdrop-blur-md text-white border border-slate-700/80 p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 pointer-events-auto">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                  {isEn ? 'Active Kiln Target' : 'নির্বাচিত ভাটা স্পট'}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {isEn ? activeZone.nameEn : activeZone.nameBn}
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  {activeZone.lat.toFixed(6)}, {activeZone.lng.toFixed(6)}
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${activeZone.lat},${activeZone.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-xs shrink-0"
              >
                <span>{isEn ? 'Open App' : 'গুগল ম্যাপে'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-slate-600 font-medium tabular-nums">
            SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা) · জিপিএস: 22.754719, 89.039367
          </div>

          <div className="flex items-center gap-2">
            <a
              href={KILN_COORDINATES.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-300 text-xs font-bold hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isEn ? 'Open Full Google Maps' : 'গুগল ম্যাপে পুরো ভিউ'}</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              {isEn ? 'Close' : 'বন্ধ করুন'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
