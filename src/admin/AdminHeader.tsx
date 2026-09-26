import React from 'react';
import { Menu, LogOut, RefreshCw, Wifi, CheckCircle2 } from 'lucide-react';
import { AdminSection } from './AdminSidebar';

interface AdminHeaderProps {
  currentSection: AdminSection;
  onOpenMobileSidebar: () => void;
  onLogout: () => void;
  isCloudSyncing: boolean;
  lastCloudSync: Date | null;
  onRefreshCloud: () => Promise<void>;
}

const SECTION_TITLES: Record<AdminSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'Real-time performance metrics and recent student orders',
  },
  products: {
    title: 'Product Catalog Management',
    subtitle: 'Create, edit, and organize all official exam prep study guides',
  },
  reorder: {
    title: 'Storefront Arrangement',
    subtitle: 'Reorder books and set ranking positions on the live storefront',
  },
  orders: {
    title: 'Orders & Fulfillment',
    subtitle: 'Server-verified paid transactions and customer download access',
  },
  reviews: {
    title: 'Student Reviews',
    subtitle: 'Manage verified student ratings, testimonials, and band scores',
  },
  testimonials: {
    title: 'Homepage Testimonials',
    subtitle: 'Featured student success stories displayed on the homepage',
  },
  categories: {
    title: 'Exam Categories & Paths',
    subtitle: 'Configure IELTS, OET, PTE, and German hero cards and badges',
  },
  offers: {
    title: 'Offers & Promotions',
    subtitle: 'Server-authoritative discount coupons and bundle deal rules',
  },
  media: {
    title: 'Media & Asset Manager',
    subtitle: 'Cloudinary CDN uploads for book covers, syllabus guides, and avatars',
  },
  settings: {
    title: 'System & Cloud Settings',
    subtitle: 'Edge persistence, KV database status, and session security',
  },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentSection,
  onOpenMobileSidebar,
  onLogout,
  isCloudSyncing,
  lastCloudSync,
  onRefreshCloud,
}) => {
  const info = SECTION_TITLES[currentSection] || {
    title: 'Admin Console',
    subtitle: 'Xylem Learning Management System',
  };

  return (
    <header className="h-16 px-4 sm:px-8 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] truncate">
            {info.title}
          </h1>
          <p className="text-[11px] text-slate-500 truncate hidden sm:block">
            {info.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Cloud Sync Status & Logout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Cloud Sync State */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px]">
          {isCloudSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              <span className="text-emerald-700 font-semibold">Syncing to Cloud...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-slate-600 font-medium">
                {lastCloudSync
                  ? `Synced at ${lastCloudSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Live Edge Sync Ready'}
              </span>
            </>
          )}
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={() => onRefreshCloud()}
          disabled={isCloudSyncing}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          title="Refresh Catalog from Cloud"
        >
          <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>

        <div className="h-5 w-px bg-slate-200" />

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
};
