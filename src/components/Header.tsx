import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X } from 'lucide-react';
import { XylemLogo } from './XylemLogo';
import { useShop } from '../context/ShopContext';
import { ExamCategory } from '../types';

export const Header: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    selectedCategory,
    navigateToCatalog,
    openCart,
    cartCount,
  } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { label: string; to: string; action: () => void; isActive: boolean; isSpecial?: boolean }[] = [
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
      label: 'About',
      to: '/about',
      action: () => setCurrentView('about'),
      isActive: currentView === 'about',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20">
          {/* Brand Logo */}
          <Link
            to="/"
            className="cursor-pointer transition-transform hover:opacity-95"
            id="brand-logo-btn"
          >
            <XylemLogo size="md" showTagline={true} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={(e) => {
                  item.action();
                }}
                className={`text-sm font-medium transition-colors cursor-pointer relative py-1 flex items-center gap-1.5 ${
                  item.isActive
                    ? 'text-emerald-700 font-semibold'
                    : item.isSpecial
                    ? 'text-slate-900 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-slate-200'
                    : 'text-slate-700 hover:text-emerald-700'
                }`}
              >
                {item.isSpecial && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                <span>{item.label}</span>
                {item.isActive && !item.isSpecial && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          {/* Right Action Icons & Button */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Search Icon — navigates to all products */}
            <button
              id="search-btn"
              onClick={() => navigateToCatalog()}
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

            {/* "Shop Now" Button (as in Image 4 & 5) */}
            <Link
              id="header-shop-now-btn"
              to="/books"
              onClick={() => navigateToCatalog('All')}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-[#00875a] text-white hover:bg-[#00734c] active:scale-95 transition-all shadow-xs"
            >
              Shop Now
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-700 hover:text-emerald-700 rounded-lg cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed top-14 left-0 right-0 z-40 border-t border-slate-100 bg-white px-4 pt-4 pb-8 space-y-1 shadow-2xl animate-in slide-in-from-top duration-200 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => {
                  item.action();
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-xl text-base font-medium flex items-center justify-between touch-card ${
                  item.isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                {item.label}
                {item.isActive && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
              </Link>
            ))}

            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
              {currentCustomer ? (
                <>
                  <Link
                    to="/my-materials"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold text-emerald-800 bg-emerald-50/70 flex items-center justify-between touch-card"
                  >
                    <span className="flex items-center gap-2">
                      <DownloadCloud className="w-4 h-4 text-emerald-600" />
                      My Study Materials
                    </span>
                    <span className="text-xs text-emerald-700 font-mono">{currentCustomer.name}</span>
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 flex items-center gap-2 touch-card"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    My Account ({currentCustomer.email})
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logoutCustomer();
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2 touch-card cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#00875a] flex items-center justify-between touch-card"
                  >
                    <span className="flex items-center gap-2">
                      <LogIn className="w-4 h-4" />
                      Sign In to Account
                    </span>
                  </Link>
                  <Link
                    to="/my-materials"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 flex items-center gap-2 touch-card"
                  >
                    <DownloadCloud className="w-4 h-4 text-emerald-600" />
                    My Study Materials
                  </Link>
                </>
              )}
              <Link
                to="/admin"
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 flex items-center gap-2 touch-card"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Admin Dashboard
              </Link>
              <Link
                to="/books"
                onClick={() => {
                  navigateToCatalog('All');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-4 bg-[#00875a] text-white font-semibold rounded-xl text-center touch-card active:bg-[#00734c]"
              >
                Shop All Books & Materials
              </Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
