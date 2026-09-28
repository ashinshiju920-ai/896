import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, ShoppingBag, Menu, X, Heart, DownloadCloud, ShieldCheck, LogIn, LogOut } from 'lucide-react';
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
    setIsSearchOpen,
    wishlist,
    orders,
    shippingInfo,
    currentCustomer,
    logoutCustomer,
  } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

            {/* User Profile / Downloads menu */}
            <div className="relative">
              <button
                id="user-profile-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-slate-50 rounded-full transition-colors relative cursor-pointer"
                title="Account & Downloads"
                aria-label="Account"
              >
                <User className="w-5 h-5 stroke-[2.2]" />
                {orders.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">
                        {currentCustomer ? 'Student Account' : 'Personal Study Dashboard'}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {currentCustomer ? currentCustomer.name : (shippingInfo.fullName || 'Guest Student')}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {currentCustomer ? currentCustomer.email : (shippingInfo.email || 'Sign in to sync your access')}
                      </p>
                    </div>

                    {!currentCustomer && (
                      <div className="p-2 border-b border-slate-100 bg-emerald-50/50">
                        <Link
                          to="/login"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full px-3 py-2 bg-[#00875a] hover:bg-[#00734c] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Sign In to Account</span>
                        </Link>
                      </div>
                    )}

                    <Link
                      to="/my-materials"
                      onClick={() => {
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <DownloadCloud className="w-4 h-4 text-emerald-600" />
                        My Study Materials
                      </span>
                      {orders.length > 0 && (
                        <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          {orders.length} orders
                        </span>
                      )}
                    </Link>

                    {currentCustomer && (
                      <Link
                        to="/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="w-4 h-4 text-slate-500" />
                        Account & Security
                      </Link>
                    )}

                    <Link
                      to="/books"
                      onClick={() => {
                        navigateToCatalog('All');
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Heart className="w-4 h-4 text-rose-500" />
                      Saved to Wishlist ({wishlist.length})
                    </Link>

                    <div className="border-t border-slate-100 my-1" />

                    {currentCustomer && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logoutCustomer();
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        Sign Out
                      </button>
                    )}

                    <Link
                      to="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Admin Dashboard
                    </Link>

                    <div className="px-4 py-2 text-[11px] text-slate-400">
                      Xylem Learning Digital Store v2.5
                    </div>
                  </div>
                </>
              )}
            </div>

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
