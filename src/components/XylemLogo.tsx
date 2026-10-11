import React from 'react';

interface XylemLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  light?: boolean;
}

export const XylemLogo: React.FC<XylemLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
  light = false,
}) => {
  const navyColor = light ? '#ffffff' : '#0a2540';
  const greenColor = light ? '#34d399' : '#00875a';
  const subtextColor = light ? '#94a3b8' : '#0a2540';

  const dimensions = {
    sm: { width: 140, height: 38 },
    md: { width: 175, height: 48 },
    lg: { width: 230, height: 62 },
    xl: { width: 300, height: 82 },
  }[size];

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 260 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* The X glyph */}
        <g id="x-glyph">
          {/* Bottom-left arm in emerald green */}
          <path
            d="M8 52L26 27L12 6H29L38 21L24 52H8Z"
            fill={greenColor}
          />
          
          {/* Top-right to bottom-left main stroke in navy */}
          <path
            d="M32 6H49L23 52H6L32 6Z"
            fill={navyColor}
          />

          {/* Top-right leaf feature on the X */}
          <path
            d="M26 27C27 18 35 7 51 4C51 18 42 27 34 29C30 30 27 28 26 27Z"
            fill={greenColor}
          />
          {/* Leaf vein */}
          <path
            d="M27 27C34 22 42 16 50 5"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Bottom-right diagonal in navy */}
          <path
            d="M36 30L49 52H32L24 38L36 30Z"
            fill={navyColor}
          />
        </g>

        {/* XYLEM letters in Navy */}
        <g id="xylem-text" fill={navyColor} fontWeight="900" fontFamily="'Plus Jakarta Sans', sans-serif">
          {/* Y */}
          <path
            d="M58 6H72L81 26L90 6H104L88 34V52H74V34L58 6Z"
          />
          {/* L */}
          <path
            d="M109 6H123V41H147V52H109V6Z"
          />
          {/* E */}
          <path
            d="M153 6H191V17H167V24H187V34H167V41H192V52H153V6Z"
          />
          {/* M */}
          <path
            d="M198 6H215L227 33L239 6H256V52H243V23L232 46H222L211 23V52H198V6Z"
          />
        </g>

        {/* LEARNING in Emerald Green */}
        <text
          x="134"
          y="66"
          textAnchor="middle"
          fill={greenColor}
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight="800"
          fontSize="13"
          letterSpacing="5.5"
        >
          LEARNING
        </text>
      </svg>

      {/* Tagline: LEARN • PRACTICE • ACHIEVE */}
      {showTagline && (
        <div
          className={`text-[9px] sm:text-[10px] tracking-[0.28em] font-semibold mt-0.5 uppercase transition-colors`}
          style={{ color: subtextColor }}
        >
          <span>LEARN</span>
          <span className="mx-2 text-emerald-600 font-bold">•</span>
          <span>PRACTICE</span>
          <span className="mx-2 text-emerald-600 font-bold">•</span>
          <span>ACHIEVE</span>
        </div>
      )}
    </div>
  );
};
