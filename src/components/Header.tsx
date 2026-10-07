import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { XylemLogo } from './XylemLogo';
import { useShop } from '../context/ShopContext';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    currentView,
    setCurrentView,
    selectedCategory,
    navigateToCatalog,
    cartCount,
  } = useShop();

  const navItems: { label: string; to: string; action: () => void; isActive: boolean }[] = [
    {
      label: 'Home',
      to: '/',
      action: () => setCurrentView('home'),
      isActive: currentView === 'home',
    },
    {
      label: 'IELTS',
      to: '/books?category=IELTS',
      action: () => navigateToCatalog('IELTS'),
      isActive: currentView === 'catalog' && selectedCategory === 'IELTS',
    },
    {
      label: 'OET',
      to: '/books?category=OET',
      action: () => navigateToCatalog('OET'),
      isActive: currentView === 'catalog' && selectedCategory === 'OET',
    },
    {
      label: 'PTE',
      to: '/books?category=PTE',
      action: () => navigateToCatalog('PTE'),
      isActive: currentView === 'catalog' && selectedCategory === 'PTE',
    },
    {
      label: 'German',
      to: '/books?category=German',
      action: () => navigateToCatalog('German'),
      isActive: currentView === 'catalog' && selectedCategory === 'German',
    },
    {
      label: 'Study Materials',
      to: '/books',
      action: () => navigateToCatalog('All'),
      isActive: currentView === 'catalog' && selectedCategory === 'All',
    },
    {
      label: 'Blog',
      to: '/blog',
      action: () => setCurrentView('blog'),
      isActive: currentView === 'blog',
    },
    {
      label: 'About',
      to: '/about',
      action: () => setCurrentView('about'),
      isActive: currentView === 'about',
    },
  ];

  const handleNavAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 xl:px-8">
        <div className="flex items-center justify-between gap-3 min-h-14 sm:min-h-16 xl:min-h-20">
          {/* Brand Logo */}
          <Link
            to="/"
            onClick={() => setIsMenuOpen(false)}
            className="cursor-pointer transition-transform hover:opacity-95 shrink-0"
            id="brand-logo-btn"
          >
            <span className="block sm:hidden">
              <XylemLogo size="sm" showTagline={false} />
            </span>
            <span className="hidden sm:block xl:hidden">
              <XylemLogo size="sm" showTagline={true} />
            </span>
            <span className="hidden xl:block">
              <XylemLogo size="md" showTagline={true} />
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-5 2xl:gap-6 min-w-0">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => {
                  handleNavAction(item.action);
                }}
                className={`text-sm font-medium transition-colors cursor-pointer relative py-1 flex items-center gap-1.5 whitespace-nowrap ${
                  item.isActive
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-700 hover:text-emerald-700'
                }`}
              >
                <span>{item.label}</span>
                {item.isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          {/* Right Action Icons & Button */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Search Icon — navigates to all products */}
            <button
              id="search-btn"
              onClick={() => {
                navigateToCatalog();
                setIsMenuOpen(false);
              }}
              className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
              title="Browse all study materials"
              aria-label="Search"
            >
              <Search className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* Cart Icon with Counter */}
            <Link
              id="cart-btn"
              to="/cart"
              onClick={() => setIsMenuOpen(false)}
              className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-slate-50 rounded-full transition-colors relative"
              title="Shopping Cart"
              aria-label="Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-emerald-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-xs animate-in zoom-in">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* "Shop Now" Button */}
            <Link
              id="header-shop-now-btn"
              to="/books"
              onClick={() => handleNavAction(() => navigateToCatalog('All'))}
              className="hidden xl:inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-[#00875a] text-white hover:bg-[#00734c] active:scale-95 transition-all shadow-xs whitespace-nowrap"
            >
              Shop Now
            </Link>

            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-full text-slate-800 hover:text-emerald-700 hover:bg-slate-50 transition-colors"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="xl:hidden pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
            <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => handleNavAction(item.action)}
                  className={`min-h-11 inline-flex items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                    item.isActive
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-emerald-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/books"
                onClick={() => handleNavAction(() => navigateToCatalog('All'))}
                className="col-span-2 sm:col-span-4 min-h-11 inline-flex items-center justify-center rounded-lg px-4 text-sm font-bold bg-[#00875a] text-white hover:bg-[#00734c] transition-colors"
              >
                Shop Now
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
