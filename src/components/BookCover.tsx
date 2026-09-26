import React from 'react';
import { Book } from '../types';

interface BookCoverProps {
  book: Book;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showShadow?: boolean;
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  size = 'md',
  className = '',
  showShadow = true,
}) => {
  const sizeClasses = {
    sm: 'w-24 h-32 text-[8px]',
    md: 'w-40 h-56 text-[11px]',
    lg: 'w-56 h-76 sm:w-64 sm:h-88 text-[13px]',
    xl: 'w-72 h-96 sm:w-80 sm:h-[440px] text-[15px]',
  }[size];

  // Specific theme styles based on category/id
  const getCoverArt = () => {
    switch (book.category) {
      case 'IELTS':
        return {
          bg: 'bg-gradient-to-b from-[#0a233f] via-[#0f2e54] to-[#071626]',
          accent: '#38bdf8',
          accentBg: 'bg-sky-500/20',
          spineColor: '#071626',
          title: 'IELTS',
          sub: 'FULL PREPARATION',
          badgeBg: 'bg-teal-500/90 text-white',
          motif: (
            <div className="absolute inset-x-0 bottom-0 h-28 opacity-30 pointer-events-none flex items-end justify-center overflow-hidden">
              {/* London skyline outline silhouette */}
              <svg viewBox="0 0 300 120" fill="currentColor" className="w-full text-amber-100">
                <path d="M10 120 L10 80 L20 80 L20 60 L25 50 L30 60 L30 80 L40 80 L40 120 Z" />
                <path d="M60 120 L60 40 L70 20 L80 40 L80 120 Z" />
                <rect x="95" y="50" width="40" height="70" rx="2" />
                {/* Big Ben */}
                <path d="M150 120 L150 35 L158 35 L160 10 L162 35 L170 35 L170 120 Z" />
                <circle cx="160" cy="45" r="4" fill="#fbbf24" />
                {/* London Eye wheel hint */}
                <circle cx="210" cy="70" r="30" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="3,3" />
                <rect x="250" y="65" width="40" height="55" />
              </svg>
            </div>
          ),
        };
      case 'OET':
        return {
          bg: 'bg-gradient-to-b from-[#005f56] via-[#008779] to-[#013b35]',
          accent: '#34d399',
          accentBg: 'bg-emerald-500/20',
          spineColor: '#013b35',
          title: 'OET',
          sub: 'FULL PREPARATION',
          badgeBg: 'bg-emerald-500 text-white',
          motif: (
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-25 pointer-events-none flex items-end justify-center">
              {/* Medical stethoscope / cross motif */}
              <svg viewBox="0 0 200 100" fill="none" stroke="currentColor" strokeWidth="2" className="w-full text-emerald-200">
                <path d="M10 50 Q40 10 70 50 T130 50 Q160 90 190 50" />
                <path d="M100 20 V80 M70 50 H130" strokeWidth="4" />
              </svg>
            </div>
          ),
        };
      case 'German':
        return {
          bg: 'bg-gradient-to-b from-[#d9480f] via-[#f76707] to-[#8c2d04]',
          accent: '#fef08a',
          accentBg: 'bg-amber-400/20',
          spineColor: '#702202',
          title: 'GERMAN',
          sub: 'FULL PREPARATION',
          badgeBg: 'bg-amber-400 text-slate-950 font-bold',
          motif: (
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-30 pointer-events-none flex items-end justify-center">
              {/* Brandenburg Gate columns hint */}
              <svg viewBox="0 0 200 80" fill="currentColor" className="w-full text-amber-200">
                <rect x="20" y="30" width="10" height="50" />
                <rect x="45" y="30" width="10" height="50" />
                <rect x="70" y="30" width="10" height="50" />
                <rect x="95" y="30" width="10" height="50" />
                <rect x="120" y="30" width="10" height="50" />
                <rect x="145" y="30" width="10" height="50" />
                <rect x="170" y="30" width="10" height="50" />
                <rect x="15" y="20" width="170" height="10" />
                <path d="M85 5 L115 5 L100 20 Z" />
              </svg>
            </div>
          ),
        };
      case 'PTE':
        return {
          bg: 'bg-gradient-to-b from-[#3b1b59] via-[#52227d] to-[#220d36]',
          accent: '#e9d5ff',
          accentBg: 'bg-purple-500/20',
          spineColor: '#1d092e',
          title: 'PTE',
          sub: 'FULL PREPARATION',
          badgeBg: 'bg-purple-500 text-white',
          motif: (
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-25 pointer-events-none flex items-end justify-center">
              {/* Digital waves & modern geometric network */}
              <svg viewBox="0 0 200 80" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full text-purple-200">
                <circle cx="50" cy="40" r="25" strokeDasharray="4,4" />
                <circle cx="150" cy="40" r="30" strokeDasharray="3,3" />
                <line x1="50" y1="40" x2="150" y2="40" strokeWidth="2" />
                <circle cx="100" cy="40" r="4" fill="currentColor" />
              </svg>
            </div>
          ),
        };
      default:
        return {
          bg: 'bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8]',
          accent: '#0f766e',
          accentBg: 'bg-slate-300/50',
          spineColor: '#64748b',
          title: 'STUDY',
          sub: 'PLANNER',
          badgeBg: 'bg-slate-800 text-white',
          motif: (
            <div className="absolute inset-x-0 bottom-4 px-4 opacity-40">
              <div className="border border-dashed border-slate-700 h-20 rounded p-1 flex flex-col justify-between">
                <div className="h-1 bg-slate-600 rounded w-3/4"></div>
                <div className="h-1 bg-slate-600 rounded w-1/2"></div>
                <div className="h-1 bg-slate-600 rounded w-4/5"></div>
              </div>
            </div>
          ),
        };
    }
  };

  const theme = getCoverArt();
  const isLightCover = book.category === 'All';

  return (
    <div
      className={`relative inline-block select-none transition-transform duration-300 ${sizeClasses} ${className}`}
      style={{ perspective: '1000px' }}
    >
      {/* 3D Book Container */}
      <div
        className={`relative w-full h-full rounded-r-md rounded-l-xs overflow-hidden ${theme.bg} ${
          showShadow
            ? 'shadow-[6px_10px_20px_rgba(0,0,0,0.35),-2px_2px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/10'
            : 'border border-slate-200'
        } flex flex-col justify-between p-3 sm:p-4 text-center`}
      >
        {/* Book Left Spine Emboss / Crease */}
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none z-20" />
        <div className="absolute left-3 top-0 bottom-0 w-[1px] bg-black/20 pointer-events-none z-20" />

        {book.imageUrl || book.coverImage ? (
          <>
            {/* Custom Uploaded / Product Image */}
            <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-slate-900">
              <img
                src={book.imageUrl || book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            {/* Optional badge overlay if specified */}
            {book.coverTheme?.badgeText && (
              <div className="relative z-10 mt-auto pt-2 flex justify-center pb-1">
                <div
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold shadow-md bg-black/75 backdrop-blur-xs text-white border border-white/20"
                >
                  {book.coverTheme.badgeText}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Top Header on Book Cover */}
            <div className="relative z-10 text-center pt-1">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <span
                  className={`text-[8px] sm:text-[9px] font-bold tracking-[0.2em] uppercase ${
                    isLightCover ? 'text-slate-700' : 'text-slate-200'
                  }`}
                >
                  XYLEM LEARNING
                </span>
              </div>
              <div
                className={`text-[7px] sm:text-[8px] uppercase tracking-wider font-semibold ${
                  isLightCover ? 'text-slate-500' : 'text-slate-300/80'
                }`}
              >
                {book.subtitle.includes('Academic') ? 'Academic & General' : 'Official Preparation'}
              </div>
            </div>

            {/* Center Title Display */}
            <div className="relative z-10 my-auto py-2">
              <h3
                className={`font-black tracking-tight leading-none ${
                  isLightCover ? 'text-slate-900' : 'text-white'
                } font-['Plus_Jakarta_Sans',sans-serif]`}
                style={{
                  fontSize: size === 'sm' ? '14px' : size === 'md' ? '22px' : size === 'lg' ? '30px' : '36px',
                }}
              >
                {theme.title}
              </h3>

              <div
                className={`font-bold tracking-wider mt-1 text-[9px] sm:text-[11px] ${
                  isLightCover ? 'text-teal-700' : 'text-slate-200'
                }`}
              >
                {theme.sub}
              </div>

              <div
                className={`text-[7px] sm:text-[9px] mt-1 font-medium ${
                  isLightCover ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                WITH MOCK TESTS
              </div>

              {/* Badge Circle in center or bottom */}
              <div className="mt-2 flex justify-center">
                <div
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold shadow-md ${theme.badgeBg}`}
                >
                  {book.coverTheme.badgeText || '500+ MOCK TESTS'}
                </div>
              </div>
            </div>

            {/* Background Motif Graphic */}
            {theme.motif}

            {/* Bottom Logo & Footer Bar on Book Cover */}
            <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-left">
              <div className="flex flex-col">
                <span
                  className={`text-[7px] font-bold tracking-widest uppercase ${
                    isLightCover ? 'text-slate-800' : 'text-white'
                  }`}
                >
                  XYLEM
                </span>
                <span
                  className={`text-[5px] tracking-wider uppercase font-semibold ${
                    isLightCover ? 'text-teal-700' : 'text-teal-400'
                  }`}
                >
                  LEARNING
                </span>
              </div>
              <div
                className={`text-[6px] tracking-tight font-medium ${
                  isLightCover ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Study Guide
              </div>
            </div>
          </>
        )}

        {/* Subtle glossy sheen line across book */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 pointer-events-none z-10" />
      </div>
    </div>
  );
};
