import React, { useState } from 'react';
import { Grid2X2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CategoryFloatingButton: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <aside
      aria-label="Browse categories"
      className="fixed z-40 select-none bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] print:hidden"
    >
      <div className="relative flex items-center justify-end group">
        <div
          className={`hidden sm:flex items-center gap-1.5 mr-3 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-semibold shadow-lg border border-white/10 pointer-events-none transition-all duration-300 origin-right font-['DM_Sans',sans-serif] ${
            isHovered
              ? 'opacity-100 translate-x-0 scale-100'
              : 'opacity-0 translate-x-2 scale-95'
          }`}
          aria-hidden="true"
        >
          <span>Browse categories</span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
        </div>

        <Link
          to="/books"
          id="category-floating-btn"
          aria-label="Browse study material categories"
          title="Browse categories"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-full bg-[#0a2540] text-white shadow-[0_10px_24px_rgba(10,37,64,0.28)] touch-card transition-transform duration-300 ease-out active:scale-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 animate-category-float overflow-hidden"
        >
          <span
            className="absolute inset-0 rounded-full bg-emerald-500/30 animate-category-ring -z-10 pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="absolute -inset-1 rounded-full bg-[#0a2540]/20 blur-md -z-10 pointer-events-none group-hover:bg-emerald-500/30 transition-colors"
            aria-hidden="true"
          />
          <span className="absolute inset-0 bg-linear-to-br from-white/18 via-transparent to-emerald-500/20 pointer-events-none" />
          <Grid2X2 className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />
          <span className="absolute -top-0.5 -right-0.5 sm:top-0 sm:right-0 rounded-full bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black font-['Plus_Jakarta_Sans',sans-serif] px-1.5 py-0.5 border-2 border-white shadow-xs">
            All
          </span>
        </Link>
      </div>
    </aside>
  );
};
