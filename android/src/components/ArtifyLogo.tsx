import React from 'react';

interface ArtifyLogoProps {
  className?: string;
  variant?: 'banner' | 'compact' | 'symbol';
  transparentBg?: boolean;
}

export const ArtifyLogo: React.FC<ArtifyLogoProps> = ({
  className = 'h-10 w-auto',
  variant = 'banner',
  transparentBg = false,
}) => {
  // Redesigned Standalone Emblem Symbol (Perfect for Favicons, App Badges, Mobile Headers)
  if (variant === 'symbol') {
    return (
      <svg
        viewBox="0 0 200 200"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Artify Logo Emblem"
      >
        <defs>
          {/* Left Leg Gradient: Neon Cyan -> Blue -> Purple -> Magenta */}
          <linearGradient id="artify-sym-swoop" x1="60%" y1="0%" x2="10%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="22%" stopColor="#00B8FF" />
            <stop offset="50%" stopColor="#1D68F2" />
            <stop offset="78%" stopColor="#7C3AED" />
            <stop offset="92%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#C026D3" />
          </linearGradient>

          {/* Right Leg Gradient: Cobalt Blue to Deep Royal Navy */}
          <linearGradient id="artify-sym-pillar" x1="25%" y1="0%" x2="75%" y2="100%">
            <stop offset="0%" stopColor="#0080FF" />
            <stop offset="35%" stopColor="#1D4ED8" />
            <stop offset="85%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          {/* Sweeping Highway Bridge Gradient */}
          <linearGradient id="artify-sym-bridge" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="25%" stopColor="#00D2FF" />
            <stop offset="60%" stopColor="#0077FF" />
            <stop offset="100%" stopColor="#0047BA" />
          </linearGradient>

          {/* Bridge Top Highlight Rim Gradient */}
          <linearGradient id="artify-sym-rim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* Skyscraper Facet Gradients */}
          <linearGradient id="artify-sym-tower-front" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E0F2FE" />
          </linearGradient>

          <linearGradient id="artify-sym-tower-side" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>

          <linearGradient id="artify-sym-tower-roof" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BAE6FD" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* Drop shadow for bridge crossing */}
          <filter id="artify-sym-bridge-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0b1736" floodOpacity="0.4" />
          </filter>
        </defs>

        {!transparentBg && <rect width="200" height="200" rx="20" fill="#070c1e" />}

        {/* 1. RIGHT LEG PILLAR WITH CALCULATOR MATRIX */}
        <path
          d="M 103 14 L 122 14 L 182 150 C 186 158, 184 168, 176 173 C 170 178, 144 184, 126 184 C 117 184, 113 177, 111 169 L 98 126 Z"
          fill="url(#artify-sym-pillar)"
        />

        {/* 2. 3D ARCHITECTURAL TOWERS */}
        {/* Tower 1 */}
        <g transform="translate(48, 92)">
          <path d="M 0 16 L 8 13 L 18 13 L 11 16 Z" fill="url(#artify-sym-tower-roof)" />
          <path d="M 0 16 L 11 16 L 11 60 L 0 60 Z" fill="url(#artify-sym-tower-front)" />
          <path d="M 11 16 L 18 13 L 18 60 L 11 60 Z" fill="url(#artify-sym-tower-side)" />
          <line x1="5.5" y1="20" x2="5.5" y2="56" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3,2" strokeOpacity="0.5" />
        </g>

        {/* Tower 2 */}
        <g transform="translate(66, 68)">
          <path d="M 0 20 L 9 16 L 22 16 L 14 20 Z" fill="url(#artify-sym-tower-roof)" />
          <path d="M 0 20 L 14 20 L 14 84 L 0 84 Z" fill="url(#artify-sym-tower-front)" />
          <path d="M 14 20 L 22 16 L 22 84 L 14 84 Z" fill="url(#artify-sym-tower-side)" />
          <line x1="4.5" y1="25" x2="4.5" y2="78" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3,2.5" strokeOpacity="0.5" />
          <line x1="9.5" y1="25" x2="9.5" y2="78" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3,2.5" strokeOpacity="0.5" />
        </g>

        {/* Tower 3 */}
        <g transform="translate(86, 40)">
          <path d="M 0 25 L 10 20 L 25 20 L 16 25 Z" fill="url(#artify-sym-tower-roof)" />
          <path d="M 0 25 L 16 25 L 16 112 L 0 112 Z" fill="url(#artify-sym-tower-front)" />
          <path d="M 16 25 L 25 20 L 25 112 L 16 112 Z" fill="url(#artify-sym-tower-side)" />
          <line x1="5" y1="30" x2="5" y2="105" stroke="#0284C7" strokeWidth="1.4" strokeDasharray="3.5,3" strokeOpacity="0.5" />
          <line x1="11" y1="30" x2="11" y2="105" stroke="#0284C7" strokeWidth="1.4" strokeDasharray="3.5,3" strokeOpacity="0.5" />
        </g>

        {/* 3. LEFT MAIN DIAGONAL LEG (Cyan to Purple Swoop) */}
        <path
          d="M 103 14 L 122 14 L 58 146 C 44 174, 24 187, 8 174 C -2 166, 1 153, 14 142 C 26 132, 44 112, 60 76 L 103 14 Z"
          fill="url(#artify-sym-swoop)"
        />

        {/* Apex Facet Highlight */}
        <path d="M 103 14 L 112 14 L 106 32 L 98 32 Z" fill="#FFFFFF" fillOpacity="0.45" />

        {/* 4. SWEEPING 3D BRIDGE / HIGHWAY RIBBON */}
        <path
          d="M 11 144 C 40 114, 94 92, 154 100 C 176 104, 185 112, 188 116 C 178 131, 144 139, 106 142 C 60 145, 32 152, 11 144 Z"
          fill="#022859"
          fillOpacity="0.35"
        />
        <path
          d="M 12 142 C 42 112, 96 90, 156 98 C 177 102, 185 110, 188 114 C 178 126, 142 136, 104 138 C 56 141, 30 149, 12 142 Z"
          fill="url(#artify-sym-bridge)"
          filter="url(#artify-sym-bridge-shadow)"
        />
        <path
          d="M 12 142 C 42 112, 96 90, 156 98 C 177 102, 185 110, 188 114"
          stroke="url(#artify-sym-rim)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* 5. EMBEDDED ACCOUNTING CALCULATOR KEYPAD MATRIX */}
        <g transform="translate(122, 125)">
          <rect x="0" y="0" width="22" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="25" y="0" width="10" height="21" rx="2.5" fill="#FFFFFF" />
          <rect x="0" y="12" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="12" y="12" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="0" y="24" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="12" y="24" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="25" y="24" width="10" height="9" rx="2.5" fill="#FFFFFF" />
        </g>
      </svg>
    );
  }

  // Redesigned Full Banner Logo (Emblem + Typography with Sleek Proportions)
  return (
    <svg
      viewBox="0 0 340 95"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Artify Construction Accounting System"
    >
      <defs>
        {/* Left Leg Gradient */}
        <linearGradient id="artify-banner-swoop" x1="60%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="22%" stopColor="#00B8FF" />
          <stop offset="50%" stopColor="#1D68F2" />
          <stop offset="78%" stopColor="#7C3AED" />
          <stop offset="92%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>

        {/* Right Leg Gradient */}
        <linearGradient id="artify-banner-pillar" x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor="#0080FF" />
          <stop offset="35%" stopColor="#1D4ED8" />
          <stop offset="85%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>

        {/* Sweeping Highway Bridge Gradient */}
        <linearGradient id="artify-banner-bridge" x1="0%" y1="30%" x2="100%" y2="70%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="25%" stopColor="#00D2FF" />
          <stop offset="60%" stopColor="#0077FF" />
          <stop offset="100%" stopColor="#0047BA" />
        </linearGradient>

        {/* Bridge Top Highlight Rim Gradient */}
        <linearGradient id="artify-banner-rim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="25%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Glowing dot over the 'i' */}
        <linearGradient id="artify-banner-i-dot" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#D946EF" />
        </linearGradient>

        {/* Baseline Accent Lines */}
        <linearGradient id="artify-banner-cyan-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00D2FF" stopOpacity="0" />
          <stop offset="100%" stopColor="#00D2FF" />
        </linearGradient>

        <linearGradient id="artify-banner-purple-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C026D3" />
          <stop offset="100%" stopColor="#C026D3" stopOpacity="0" />
        </linearGradient>

        {/* Vertical Divider */}
        <linearGradient id="artify-banner-divider" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.05" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
        </linearGradient>

        {/* Glow Filters */}
        <filter id="artify-banner-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id="artify-banner-dot-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background Navy Container */}
      {!transparentBg && <rect width="340" height="95" rx="10" fill="#070c1e" />}

      {/* ================= REDESIGNED EMBLEM 'A' (Scaled to fit banner height) ================= */}
      <g transform="translate(12, 8) scale(0.44)">
        {/* Right Leg Pillar */}
        <path
          d="M 103 14 L 122 14 L 182 150 C 186 158, 184 168, 176 173 C 170 178, 144 184, 126 184 C 117 184, 113 177, 111 169 L 98 126 Z"
          fill="url(#artify-banner-pillar)"
        />

        {/* Skyscraper Towers */}
        {/* Tower 1 */}
        <g transform="translate(48, 92)">
          <path d="M 0 16 L 8 13 L 18 13 L 11 16 Z" fill="#BAE6FD" />
          <path d="M 0 16 L 11 16 L 11 60 L 0 60 Z" fill="#FFFFFF" />
          <path d="M 11 16 L 18 13 L 18 60 L 11 60 Z" fill="#0284C7" />
          <line x1="5.5" y1="20" x2="5.5" y2="56" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3,2" strokeOpacity="0.6" />
        </g>

        {/* Tower 2 */}
        <g transform="translate(66, 68)">
          <path d="M 0 20 L 9 16 L 22 16 L 14 20 Z" fill="#BAE6FD" />
          <path d="M 0 20 L 14 20 L 14 84 L 0 84 Z" fill="#FFFFFF" />
          <path d="M 14 20 L 22 16 L 22 84 L 14 84 Z" fill="#0284C7" />
          <line x1="4.5" y1="25" x2="4.5" y2="78" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3,2.5" strokeOpacity="0.6" />
          <line x1="9.5" y1="25" x2="9.5" y2="78" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3,2.5" strokeOpacity="0.6" />
        </g>

        {/* Tower 3 */}
        <g transform="translate(86, 40)">
          <path d="M 0 25 L 10 20 L 25 20 L 16 25 Z" fill="#BAE6FD" />
          <path d="M 0 25 L 16 25 L 16 112 L 0 112 Z" fill="#FFFFFF" />
          <path d="M 16 25 L 25 20 L 25 112 L 16 112 Z" fill="#0284C7" />
          <line x1="5" y1="30" x2="5" y2="105" stroke="#0284C7" strokeWidth="1.4" strokeDasharray="3.5,3" strokeOpacity="0.6" />
          <line x1="11" y1="30" x2="11" y2="105" stroke="#0284C7" strokeWidth="1.4" strokeDasharray="3.5,3" strokeOpacity="0.6" />
        </g>

        {/* Left Main Diagonal Swoop */}
        <path
          d="M 103 14 L 122 14 L 58 146 C 44 174, 24 187, 8 174 C -2 166, 1 153, 14 142 C 26 132, 44 112, 60 76 L 103 14 Z"
          fill="url(#artify-banner-swoop)"
        />
        <path d="M 103 14 L 112 14 L 106 32 L 98 32 Z" fill="#FFFFFF" fillOpacity="0.45" />

        {/* Sweeping Bridge Ribbon */}
        <path
          d="M 11 144 C 40 114, 94 92, 154 100 C 176 104, 185 112, 188 116 C 178 131, 144 139, 106 142 C 60 145, 32 152, 11 144 Z"
          fill="#022859"
          fillOpacity="0.35"
        />
        <path
          d="M 12 142 C 42 112, 96 90, 156 98 C 177 102, 185 110, 188 114 C 178 126, 142 136, 104 138 C 56 141, 30 149, 12 142 Z"
          fill="url(#artify-banner-bridge)"
          filter="url(#artify-banner-glow)"
        />
        <path
          d="M 12 142 C 42 112, 96 90, 156 98 C 177 102, 185 110, 188 114"
          stroke="url(#artify-banner-rim)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Embedded Calculator Keypad */}
        <g transform="translate(122, 125)">
          <rect x="0" y="0" width="22" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="25" y="0" width="10" height="21" rx="2.5" fill="#FFFFFF" />
          <rect x="0" y="12" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="12" y="12" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="0" y="24" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="12" y="24" width="10" height="9" rx="2.5" fill="#FFFFFF" />
          <rect x="25" y="24" width="10" height="9" rx="2.5" fill="#FFFFFF" />
        </g>
      </g>

      {/* Vertical Hairline Divider */}
      <line x1="110" y1="18" x2="110" y2="78" stroke="url(#artify-banner-divider)" strokeWidth="1.2" />

      {/* Typography: Artify */}
      <g transform="translate(124, 47)">
        <text
          x="0"
          y="0"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="33"
          fontWeight="800"
          fill="#FFFFFF"
          letterSpacing="-0.5"
        >
          Artify
        </text>
        <circle
          cx="90"
          cy="-24"
          r="6"
          fill="url(#artify-banner-i-dot)"
          filter="url(#artify-banner-dot-glow)"
        />
      </g>

      {/* CONSTRUCTION */}
      <text
        x="125"
        y="66"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="14"
        fontWeight="800"
        fill="#00D2FF"
        letterSpacing="4.8"
      >
        CONSTRUCTION
      </text>

      {/* ACCOUNTING SYSTEM Baseline */}
      <g transform="translate(125, 78)">
        <line x1="0" y1="0" x2="20" y2="0" stroke="url(#artify-banner-cyan-line)" strokeWidth="1.6" strokeLinecap="round" />
        <text
          x="26"
          y="3"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="8.5"
          fontWeight="700"
          fill="#F1F5F9"
          letterSpacing="2.2"
        >
          ACCOUNTING SYSTEM
        </text>
        <line x1="154" y1="0" x2="174" y2="0" stroke="url(#artify-banner-purple-line)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
};
