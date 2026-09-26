import React from 'react';
import { BookOpen, Home, ArrowLeft } from 'lucide-react';
import { useShop } from '../context/ShopContext';

interface NotFoundViewProps {
  title?: string;
  message?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  title = 'Page Not Found',
  message = "The page you're looking for doesn't exist or may have been moved. Let's get you back on track!",
}) => {
  const { setCurrentView, navigateToCatalog } = useShop();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md mx-auto space-y-6">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mb-2 ring-8 ring-emerald-50/50">
          <BookOpen className="w-10 h-10" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
          {title}
        </h1>

        {/* Description */}
        <p className="text-slate-500 text-sm leading-relaxed font-['DM_Sans',sans-serif]">
          {message}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setCurrentView('home')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00875a] hover:bg-[#006e49] text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
          <button
            onClick={() => navigateToCatalog('All')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Books
          </button>
        </div>
      </div>
    </div>
  );
};
