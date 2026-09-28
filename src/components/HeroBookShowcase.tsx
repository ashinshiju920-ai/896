import React, { useState, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BOOKS } from '../data/books';

export const HeroBookShowcase: React.FC = () => {
  const { navigateToProduct, navigateToCatalog, openPdfViewer, books } = useShop();

  // 3D Tilt state
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [hoveredBook, setHoveredBook] = useState<'ielts' | 'oet' | 'german' | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate subtle rotation (-6 to 6 deg)
    const rotX = -((y - centerY) / centerY) * 7;
    const rotY = ((x - centerX) / centerX) * 7;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.35,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
    setHoveredBook(null);
  };

  const safeBooks = Array.isArray(books) && books.length > 0 ? books : BOOKS;
  const ieltsBook = safeBooks.find((b) => b?.category === 'IELTS') || safeBooks[0] || BOOKS[0];
  const oetBook = safeBooks.find((b) => b?.category === 'OET') || safeBooks[1] || safeBooks[0] || BOOKS[1];
  const germanBook = safeBooks.find((b) => b?.category === 'German') || safeBooks[3] || safeBooks[0] || BOOKS[2];

  return (
    <div className="relative w-full max-w-xl mx-auto flex items-center justify-center select-none py-2 sm:py-4">
      {/* Ambient Breathing Emerald Glow behind the showcase */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400/20 via-teal-300/15 to-cyan-400/20 rounded-[48px] blur-3xl -z-10 animate-pulse-glow pointer-events-none" />



      {/* Main 3D Perspective Wrapper */}
      <div
        style={{ perspective: 1200 }}
        className="w-full transition-transform duration-200 ease-out animate-float-gentle touch-manipulation"
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`,
            transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
            transformStyle: 'preserve-3d',
          }}
          className="relative rounded-[28px] sm:rounded-[38px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,135,90,0.2)] border border-[#d2ebe5] bg-[#f2f9f8] group cursor-pointer"
        >
          {/* Base High-Resolution Showcase Graphic */}
          <img
            src="/hero-books-showcase.jpg"
            alt="Aylem Learning Official Preparation Guides - IELTS, OET, and German"
            className="w-full h-auto block object-cover rounded-[28px] sm:rounded-[38px] transition-transform duration-500 group-hover:scale-[1.015]"
            draggable={false}
          />

          {/* Animated Specular Light Glare (Follows Cursor) */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle 380px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.7), transparent 80%)`,
              opacity: glarePos.opacity,
            }}
          />

          {/* Diagonal Animated Sheen Sweep Effect (Periodic Gloss) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[28px] sm:rounded-[38px]">
            <div className="w-[50%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-25 -translate-x-[200%] group-hover:animate-shimmer" />
          </div>

          {/* Pulsating Live Radar Ping on the Top-Right Badge */}
          <div className="absolute top-[3.6%] right-[3.8%] sm:top-[4%] sm:right-[4%] pointer-events-none flex items-center gap-1">
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
          </div>

          {/* =========================================================================
              INTERACTIVE HOTSPOTS FOR THE 3 BOOKS (Clickable & Responsive)
              ========================================================================= */}

          {/* 1. Left Book: IELTS */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigateToProduct(ieltsBook.id);
            }}
            onMouseEnter={() => setHoveredBook('ielts')}
            onMouseLeave={() => setHoveredBook(null)}
            className="absolute left-[3%] top-[14%] w-[31%] h-[68%] rounded-2xl z-10 hover:bg-emerald-600/5 active:scale-95 transition-all flex flex-col justify-end p-2 sm:p-3"
            title="Click to view IELTS Full Preparation Guide"
          >
            {hoveredBook === 'ielts' && (
              <div className="bg-[#0a2540]/95 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold py-1.5 px-2.5 rounded-xl shadow-lg border border-cyan-400/40 text-center animate-in fade-in zoom-in-95 duration-150 flex items-center justify-center gap-1">
                <span>IELTS Prep</span>
                <ChevronRight className="w-3 h-3 text-cyan-300" />
              </div>
            )}
          </div>

          {/* 2. Center Book: OET (Hero Spotlight) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigateToProduct(oetBook.id);
            }}
            onMouseEnter={() => setHoveredBook('oet')}
            onMouseLeave={() => setHoveredBook(null)}
            className="absolute left-[34%] top-[13%] w-[34%] h-[70%] rounded-2xl z-10 hover:bg-emerald-600/5 active:scale-95 transition-all flex flex-col justify-end p-2 sm:p-3"
            title="Click to view OET Full Preparation Guide (500+ Mocks)"
          >
            {hoveredBook === 'oet' && (
              <div className="bg-[#00875a]/95 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold py-1.5 px-2.5 rounded-xl shadow-lg border border-emerald-300/40 text-center animate-in fade-in zoom-in-95 duration-150 flex items-center justify-center gap-1">
                <span>OET Healthcare</span>
                <ChevronRight className="w-3 h-3 text-emerald-200" />
              </div>
            )}
          </div>

          {/* 3. Right Book: German */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigateToProduct(germanBook.id);
            }}
            onMouseEnter={() => setHoveredBook('german')}
            onMouseLeave={() => setHoveredBook(null)}
            className="absolute right-[3%] top-[14%] w-[31%] h-[68%] rounded-2xl z-10 hover:bg-emerald-600/5 active:scale-95 transition-all flex flex-col justify-end p-2 sm:p-3"
            title="Click to view German A1-B2 Preparation Guide"
          >
            {hoveredBook === 'german' && (
              <div className="bg-[#0a2540]/95 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold py-1.5 px-2.5 rounded-xl shadow-lg border border-amber-400/40 text-center animate-in fade-in zoom-in-95 duration-150 flex items-center justify-center gap-1">
                <span>German Prep</span>
                <ChevronRight className="w-3 h-3 text-amber-300" />
              </div>
            )}
          </div>

          {/* =========================================================================
              BOTTOM BAR INTERACTIVE BUTTONS
              ========================================================================= */}
          {/* Instant PDF Download Hotspot */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              openPdfViewer(ieltsBook);
            }}
            className="absolute left-[5%] bottom-[4%] w-[32%] h-[12%] rounded-xl z-20 cursor-pointer hover:bg-emerald-600/10 active:bg-emerald-600/20 transition-colors"
            title="Preview instant downloadable sample PDF"
          />

          {/* Optional Printed Book Hotspot */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigateToProduct(oetBook.id);
            }}
            className="absolute left-[38%] bottom-[4%] w-[30%] h-[12%] rounded-xl z-20 cursor-pointer hover:bg-emerald-600/10 active:bg-emerald-600/20 transition-colors"
            title="Learn about doorstep delivery for physical printed books"
          />

          {/* View All Guides Hotspot */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigateToCatalog('All');
            }}
            className="absolute right-[5%] bottom-[4%] w-[25%] h-[12%] rounded-xl z-20 cursor-pointer hover:bg-emerald-600/10 active:bg-emerald-600/20 transition-colors flex items-center justify-end pr-1"
            title="View all preparation guides and syllabus books"
          />
        </div>
      </div>
    </div>
  );
};
