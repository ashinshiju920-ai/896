import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ArrowUpDown,
  ShoppingBag,
  Star,
  Users,
  Layers,
  Tag,
  ImageIcon,
  Settings,
  ExternalLink,
  X,
  ShieldCheck,
} from 'lucide-react';
import { XylemLogo } from '../components/XylemLogo';

export type AdminSection =
  | 'dashboard'
  | 'products'
  | 'reorder'
  | 'orders'
  | 'reviews'
  | 'testimonials'
  | 'categories'
  | 'offers'
  | 'media'
  | 'settings';

interface AdminSidebarProps {
  currentSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  productsCount: number;
  ordersCount?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpenMobile,
  onCloseMobile,
  productsCount,
  ordersCount,
}) => {
  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'All Products', icon: BookOpen, badge: productsCount },
    { id: 'reorder', label: 'Arrange / Order', icon: ArrowUpDown },
    { id: 'orders', label: 'Orders & Sales', icon: ShoppingBag, badge: ordersCount },
    { id: 'reviews', label: 'Student Reviews', icon: Star },
    { id: 'testimonials', label: 'Testimonials', icon: Users },
    { id: 'categories', label: 'Exam Categories', icon: Layers },
    { id: 'offers', label: 'Offers & Coupons', icon: Tag },
    { id: 'media', label: 'Media & Assets', icon: ImageIcon },
    { id: 'settings', label: 'Settings & Cloud', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0a2540] text-slate-300 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 overflow-hidden ${
          isOpenMobile
            ? 'translate-x-0 shadow-2xl pointer-events-auto'
            : '-translate-x-full pointer-events-none lg:translate-x-0 lg:pointer-events-auto'
        }`}
        aria-hidden={!isOpenMobile}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <XylemLogo size="sm" light showTagline={false} className="h-6 w-auto shrink-0" />
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/90 border border-emerald-800/50 px-2 py-0.5 rounded-full">
              CMS 2.0
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg lg:hidden cursor-pointer"
            aria-label="Close admin menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Storefront Link & Security Footer */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              <span>View Storefront</span>
            </span>
            <span className="text-[10px] text-slate-500">Live</span>
          </a>

          <div className="px-3 py-2 bg-slate-900/60 rounded-xl flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Staff Session Active</span>
          </div>
        </div>
      </aside>
    </>
  );
};
