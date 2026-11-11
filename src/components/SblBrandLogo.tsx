import React, { useId } from 'react';

interface SblBrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Bespoke Royal-Industrial Emblem Logo for SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা)
 * Features a 24K gold & crimson-terracotta hexagonal shield crest, 3D beveled
 * interlocking fired clay bricks, a rising kiln furnace flame with 3 quality stars,
 * and a bold embossed metallic gold 'SBL' monogram centerpiece.
 */
export const SblBrandLogo: React.FC<SblBrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const rawId = useId().replace(/:/g, '');
  const bgGradId = `sbl-bg-${rawId}`;
  const goldRimGradId = `sbl-gold-rim-${rawId}`;
  const goldTextGradId = `sbl-gold-text-${rawId}`;
  const flameOuterGradId = `sbl-flame-outer-${rawId}`;
  const flameInnerGradId = `sbl-flame-inner-${rawId}`;
  const brickTopGradId = `sbl-brick-top-${rawId}`;
  const brickFrontGradId = `sbl-brick-front-${rawId}`;
  const plateGradId = `sbl-plate-${rawId}`;
  const glowFilterId = `sbl-glow-${rawId}`;

  const containerDimensions =
    size === 'xs'
      ? 'w-6 h-6 rounded-lg p-[1.5px]'
      : size === 'sm'
      ? 'w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl p-[1.5px] sm:p-[2px]'
      : size === 'lg'
      ? 'w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl p-[2px] sm:p-[2.5px]'
      : size === 'xl'
      ? 'w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl p-[2.5px] sm:p-[3px]'
      : 'w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl p-[1.5px] sm:p-[2px]';

  const innerRadius =
    size === 'xs'
      ? 'rounded-[6px]'
      : size === 'sm'
      ? 'rounded-[6px] sm:rounded-[10px]'
      : size === 'lg'
      ? 'rounded-[10px] sm:rounded-[14px]'
      : size === 'xl'
      ? 'rounded-[14px] sm:rounded-[21px]'
      : 'rounded-[10px] sm:rounded-[14px]';

  return (
    <div
      data-testid="sbl-brand-logo"
      className={`${containerDimensions} relative bg-gradient-to-br from-amber-300 via-orange-500 to-red-700 shadow-lg shadow-orange-950/50 ring-1 ring-amber-200/50 flex items-center justify-center shrink-0 select-none group overflow-hidden transition-transform duration-200 hover:scale-[1.03] ${className}`}
      title="SBL মিষ্টি মাটির ইট (বাবুলিয়া, সাতক্ষীরা) · No. 1 Quality Bricks"
    >
      {/* Inner Dark Kiln Obsidian Chamber */}
      <div
        className={`w-full h-full ${innerRadius} bg-[#120705] flex items-center justify-center relative overflow-hidden`}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          <defs>
            {/* Deep Kiln Ember Radial Backdrop */}
            <radialGradient id={bgGradId} cx="50%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#431407" />
              <stop offset="55%" stopColor="#1C0A05" />
              <stop offset="100%" stopColor="#090403" />
            </radialGradient>

            {/* 24K Metallic Gold Shield & Trim Gradient */}
            <linearGradient id={goldRimGradId} x1="10" y1="6" x2="90" y2="94" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="28%" stopColor="#F59E0B" />
              <stop offset="52%" stopColor="#FFFBEB" />
              <stop offset="76%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>

            {/* Luminous Gold Embossed SBL Lettering Gradient */}
            <linearGradient id={goldTextGradId} x1="50" y1="42" x2="50" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#FEF08A" />
              <stop offset="65%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>

            {/* Kiln Flame Outer Gradient */}
            <linearGradient id={flameOuterGradId} x1="50" y1="7" x2="50" y2="33" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="45%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>

            {/* Kiln Flame Inner Core Gradient */}
            <linearGradient id={flameInnerGradId} x1="50" y1="13" x2="50" y2="31" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>

            {/* Fired Terracotta Brick Front Face */}
            <linearGradient id={brickFrontGradId} x1="15" y1="28" x2="85" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="45%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#9A3412" />
            </linearGradient>

            {/* Fired Brick 3D Top Bevel Face */}
            <linearGradient id={brickTopGradId} x1="20" y1="25" x2="80" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDBA74" />
              <stop offset="50%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#C2410C" />
            </linearGradient>

            {/* Center Royal Nameplate Gradient */}
            <linearGradient id={plateGradId} x1="12" y1="43" x2="88" y2="73" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#0F172A" />
              <stop offset="70%" stopColor="#1E120B" />
              <stop offset="100%" stopColor="#090D16" />
            </linearGradient>

            {/* Soft Drop Shadow for SBL Monogram */}
            <filter id={glowFilterId} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* 1. Background Fill */}
          <rect x="0" y="0" width="100" height="100" fill={`url(#${bgGradId})`} />

          {/* 2. Subtle Warm Kiln Arch Halo */}
          <circle cx="50" cy="36" r="34" fill="#EA580C" fillOpacity="0.14" />
          <circle cx="50" cy="24" r="18" fill="#FDE047" fillOpacity="0.12" />

          {/* 3. Outer Royal Crest Shield Border */}
          <rect
            x="4.5"
            y="4.5"
            width="91"
            height="91"
            rx="20"
            stroke={`url(#${goldRimGradId})`}
            strokeWidth="2.2"
          />
          <rect
            x="8"
            y="8"
            width="84"
            height="84"
            rx="16.5"
            stroke="#F59E0B"
            strokeOpacity="0.32"
            strokeWidth="1"
            strokeDasharray="3 2"
          />

          {/* 4. Top Quality Stars (★ ★) Flanking the Kiln Flame */}
          <polygon
            points="25,18 26.4,21 29.7,21.4 27.2,23.6 27.9,26.8 25,25.1 22.1,26.8 22.8,23.6 20.3,21.4 23.6,21"
            fill="#FDE047"
          />
          <polygon
            points="75,18 76.4,21 79.7,21.4 77.2,23.6 77.9,26.8 75,25.1 72.1,26.8 72.8,23.6 70.3,21.4 73.6,21"
            fill="#FDE047"
          />

          {/* 5. Iconic Rising Kiln Flame & Crown */}
          <path
            d="M50 7.5C50 7.5 63.5 16.5 61 25.5C59.5 30.2 55.2 32.8 50 32.8C44.8 32.8 40.5 30.2 39 25.5C36.5 16.5 50 7.5 50 7.5Z"
            fill={`url(#${flameOuterGradId})`}
          />
          {/* Side Flame Tongues */}
          <path
            d="M39.5 26.5C36 24.2 34.5 19.8 36.2 15.5C36.2 15.5 38.8 20.5 42 23.5"
            stroke="#FB923C"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M60.5 26.5C64 24.2 65.5 19.8 63.8 15.5C63.8 15.5 61.2 20.5 58 23.5"
            stroke="#FB923C"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Inner White-Gold Flame Core */}
          <path
            d="M50 14C50 14 56.5 20 55 25.2C54.1 28.2 52.2 29.8 50 29.8C47.8 29.8 45.9 28.2 45 25.2C43.5 20 50 14 50 14Z"
            fill={`url(#${flameInnerGradId})`}
          />

          {/* 6. Upper Course: 3D Interlocking Fired Clay Bricks */}
          {/* Top-Center Keystone Brick */}
          <rect
            x="35"
            y="26.5"
            width="30"
            height="7.5"
            rx="2"
            fill={`url(#${brickTopGradId})`}
            stroke="#FEF08A"
            strokeWidth="1.1"
          />
          <rect
            x="39"
            y="28.6"
            width="22"
            height="3.3"
            rx="1"
            fill="#7C2D12"
            fillOpacity="0.65"
          />

          {/* Second Course: Two Wide Interlocking Fired Bricks */}
          <rect
            x="14"
            y="35"
            width="34.5"
            height="8.5"
            rx="2"
            fill={`url(#${brickFrontGradId})`}
            stroke="#FDBA74"
            strokeWidth="1.1"
          />
          <rect
            x="18.5"
            y="37.3"
            width="25.5"
            height="3.8"
            rx="1"
            fill="#7C2D12"
            fillOpacity="0.6"
          />

          <rect
            x="51.5"
            y="35"
            width="34.5"
            height="8.5"
            rx="2"
            fill={`url(#${brickFrontGradId})`}
            stroke="#FDBA74"
            strokeWidth="1.1"
          />
          <rect
            x="56"
            y="37.3"
            width="25.5"
            height="3.8"
            rx="1"
            fill="#7C2D12"
            fillOpacity="0.6"
          />

          {/* 7. Centerpiece Royal SBL Monogram Nameplate */}
          <rect
            x="9.5"
            y="43.5"
            width="81"
            height="28.5"
            rx="6.5"
            fill={`url(#${plateGradId})`}
            stroke={`url(#${goldRimGradId})`}
            strokeWidth="2.2"
          />
          {/* Inner Gold Filigree Line & Corner Rivets */}
          <rect
            x="12.5"
            y="46.2"
            width="75"
            height="23.1"
            rx="4.2"
            stroke="#FDE047"
            strokeOpacity="0.35"
            strokeWidth="0.9"
          />
          <circle cx="16" cy="57.8" r="1.6" fill="#FDE047" />
          <circle cx="84" cy="57.8" r="1.6" fill="#FDE047" />

          {/* Bold Embossed 'SBL' Master Typography */}
          <text
            x="50"
            y="65.5"
            textAnchor="middle"
            fill={`url(#${goldTextGradId})`}
            filter={`url(#${glowFilterId})`}
            fontSize="25.5"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
            letterSpacing="2.5"
          >
            SBL
          </text>

          {/* 8. Lower Foundation Course: 3 Interlocking Fired Bricks */}
          <rect
            x="12"
            y="73.2"
            width="23.5"
            height="7.8"
            rx="1.8"
            fill="#C2410C"
            stroke="#FDBA74"
            strokeWidth="1"
          />
          <rect
            x="38"
            y="73.2"
            width="24"
            height="7.8"
            rx="1.8"
            fill={`url(#${brickFrontGradId})`}
            stroke="#FDE047"
            strokeWidth="1.1"
          />
          <rect
            x="64.5"
            y="73.2"
            width="23.5"
            height="7.8"
            rx="1.8"
            fill="#C2410C"
            stroke="#FDBA74"
            strokeWidth="1"
          />

          {/* 9. Bottom Gold Pedestal Ribbon: NO. 1 BRICKS */}
          <rect
            x="19"
            y="82.2"
            width="62"
            height="10"
            rx="4"
            fill="#7C2D12"
            stroke={`url(#${goldRimGradId})`}
            strokeWidth="1.2"
          />
          <text
            x="50"
            y="89.3"
            textAnchor="middle"
            fill="#FEF08A"
            fontSize="6.8"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="1.4"
          >
            ★ NO.1 BRICKS ★
          </text>
        </svg>
      </div>
    </div>
  );
};

