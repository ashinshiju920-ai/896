import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import { XylemLogo } from './XylemLogo';
import { useShop } from '../context/ShopContext';

export const Header: React.FC = () => {
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
                onClick={() => {
                  item.action();
                }}
                className={`text-sm font-medium transition-colors cursor-pointer relative py-1 flex items-center gap-1.5 ${
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

            {/* "Shop Now" Button */}
            <Link
              id="header-shop-now-btn"
              to="/books"
              onClick={() => navigateToCatalog('All')}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-[#00875a] text-white hover:bg-[#00734c] active:scale-95 transition-all shadow-xs"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
