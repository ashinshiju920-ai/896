import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, Star, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { BookCover } from '../components/BookCover';
import { BackButton } from '../components/BackButton';
import { ExamCategory } from '../types';

export const CatalogView: React.FC = () => {
  const {
    books,
    selectedCategory,
    setSelectedCategory,
    navigateToProduct,
    addToCart,
    buyNow,
    setCurrentView,
  } = useShop();

  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');

  // Filter categories
  const categories: ExamCategory[] = ['All', 'IELTS', 'OET', 'PTE', 'German'];

  // Sync category from URL query parameter (?category=IELTS)
  useEffect(() => {
    if (categoryParam) {
      const match = categories.find((c) => c.toLowerCase() === categoryParam.toLowerCase());
      if (match && match !== selectedCategory) {
        setSelectedCategory(match);
      }
    }
  }, [categoryParam]);

  const handleCategorySelect = (cat: ExamCategory) => {
    setSelectedCategory(cat);
    if (cat === 'All') {
      searchParams.delete('category');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ category: cat }, { replace: true });
    }
  };

  // Filters state
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'digital' | 'physical'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'popularity' | 'price-low' | 'price-high' | 'rating'>('featured');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const handlePriceToggle = (range: string) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(range) ? prev.filter((r) => r !== range) : [...prev, range]
    );
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const clearFilters = () => {
    setSelectedPriceRanges([]);
    setSelectedTypes([]);
    setSelectedFormat('all');
  };

  // Filtered & sorted books
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      // Category filter
      if (selectedCategory !== 'All' && book.category !== selectedCategory && book.category !== 'All') {
        return false;
      }

      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(book.type)) {
        return false;
      }

      // Price filter (based on active format or digital price)
      const bookPrice = selectedFormat === 'physical'
        ? (book.prices?.physical?.price ?? 999)
        : (book.prices?.digital?.price ?? 199);
      if (selectedPriceRanges.length > 0) {
        const matchesPrice = selectedPriceRanges.some((range) => {
          if (range === 'under-1000') return bookPrice < 1000;
          if (range === '1000-1499') return bookPrice >= 1000 && bookPrice <= 1499;
          if (range === '1500-1999') return bookPrice >= 1500 && bookPrice <= 1999;
          if (range === 'above-2000') return bookPrice >= 2000;
          return true;
        });
        if (!matchesPrice) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'featured') {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      }
      if (sortBy === 'popularity') return (b.reviewCount || 0) - (a.reviewCount || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'price-low') {
        return (a.prices?.digital?.price ?? 199) - (b.prices?.digital?.price ?? 199);
      }
      if (sortBy === 'price-high') {
        return (b.prices?.digital?.price ?? 199) - (a.prices?.digital?.price ?? 199);
      }
      return 0;
    });
  }, [selectedCategory, selectedPriceRanges, selectedTypes, selectedFormat, sortBy]);

  const activeCategoryTitle = selectedCategory === 'All' ? 'Complete Exam Study Materials' : `${selectedCategory} Preparation`;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* Breadcrumb + Back */}
      <div className="flex items-center justify-between">
        <BackButton to="/" label="Home" />
        <nav className="hidden sm:flex items-center space-x-2 text-xs text-slate-500">
          <Link
            to="/"
            className="hover:text-emerald-700 transition-colors"
          >
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-slate-800">{activeCategoryTitle}</span>
        </nav>
      </div>

      {/* Category Hero Banner (Image 4 top) */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0a2540] via-[#0d3356] to-[#081d33] p-6 sm:p-10 text-white shadow-lg">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-white/15 text-slate-200 hover:bg-white/25'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
            {activeCategoryTitle}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed font-['DM_Sans',sans-serif]">
            Achieve your target score with expert-curated study materials, practice books, full-length mock exams, and verified strategies.
          </p>

          {/* Feature Badges from Image 4 */}
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              'Complete Study Guides',
              'Practice Tests & Mock Exams',
              'Exam Tips & Strategies',
              'Latest Exam Format',
            ].map((pill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center text-[11px] font-medium bg-white/10 backdrop-blur-xs border border-white/15 px-3 py-1 rounded-lg text-slate-200"
              >
                ✓ {pill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile filter trigger & Sort bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <button
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
            <span>Filters ({selectedPriceRanges.length + selectedTypes.length + (selectedFormat !== 'all' ? 1 : 0)})</span>
          </button>

          <span className="text-xs sm:text-sm text-slate-600 font-medium">
            Showing <strong className="text-slate-900">{filteredBooks.length}</strong> results
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <label htmlFor="sort-select" className="text-xs text-slate-500 font-medium">
            Sort by:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-emerald-600"
          >
            <option value="featured">Featured / Custom Order</option>
            <option value="popularity">Popularity</option>
            <option value="rating">Highest Rated</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Main Grid with Sidebar Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Filter Sidebar (Image 4) */}
        <aside className={`${mobileFilterOpen ? 'block' : 'hidden'} lg:block lg:col-span-1 space-y-6 bg-slate-50 lg:bg-transparent p-5 lg:p-0 rounded-2xl border lg:border-none border-slate-200`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] uppercase tracking-wider">
              Filter Products
            </h3>
            {(selectedPriceRanges.length > 0 || selectedTypes.length > 0 || selectedFormat !== 'all') && (
              <button
                onClick={clearFilters}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {/* Price Range */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Price Range
            </h4>
            <div className="space-y-2 text-xs">
              {[
                { id: 'under-1000', label: 'Under ₹1,000' },
                { id: '1000-1499', label: '₹1,000 – ₹1,499' },
                { id: '1500-1999', label: '₹1,500 – ₹1,999' },
                { id: 'above-2000', label: 'Above ₹2,000' },
              ].map((range) => (
                <label key={range.id} className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedPriceRanges.includes(range.id)}
                    onChange={() => handlePriceToggle(range.id)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{range.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category / Type */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Category
            </h4>
            <div className="space-y-2 text-xs">
              {[
                'Study Guides',
                'Practice Books',
                'Mock Tests',
                'Vocabulary & Grammar',
                'Bundle Packs',
              ].map((type) => (
                <label key={type} className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => handleTypeToggle(type)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Format
            </h4>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="radio"
                  name="format-filter"
                  checked={selectedFormat === 'all'}
                  onChange={() => setSelectedFormat('all')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span>All Formats</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="radio"
                  name="format-filter"
                  checked={selectedFormat === 'digital'}
                  onChange={() => setSelectedFormat('digital')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span>eBook / Digital (PDF)</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="radio"
                  name="format-filter"
                  checked={selectedFormat === 'physical'}
                  onChange={() => setSelectedFormat('physical')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Physical Printed Book</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Products Grid (Image 4) */}
        <div className="lg:col-span-3">
          {filteredBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredBooks.map((book) => {
                const currentPrice = selectedFormat === 'physical'
                  ? (book.prices?.physical?.price ?? 999)
                  : (book.prices?.digital?.price ?? 199);
                const originalPrice = selectedFormat === 'physical'
                  ? (book.prices?.physical?.originalPrice ?? 1299)
                  : (book.prices?.digital?.originalPrice ?? 599);
                const discount = selectedFormat === 'physical'
                  ? (book.prices?.physical?.discountPercent ?? 23)
                  : (book.prices?.digital?.discountPercent ?? 67);

                return (
                  <div
                    key={book.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div
                      onClick={() => navigateToProduct(book.id)}
                      className="cursor-pointer p-4 pb-0 flex flex-col items-center"
                    >
                      {/* Cover */}
                      <div className="pt-2 pb-4 transition-transform duration-300 group-hover:scale-105">
                        <BookCover book={book} size="md" />
                      </div>

                      {/* Ratings */}
                      <div className="w-full flex items-center justify-between mt-2 text-xs">
                        <div className="flex items-center text-amber-500 font-semibold gap-1">
                          <div className="flex items-center">
                            <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                            <span>{book.rating}</span>
                            <span className="text-slate-400 font-normal ml-1">({book.reviewCount})</span>
                          </div>
                          {book.buyersCount !== undefined && book.buyersCount > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">• {book.buyersCount.toLocaleString()} bought</span>
                          )}
                        </div>
                        {book.isBestSeller && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Best Seller
                          </span>
                        )}
                        {book.isNew && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                            New
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="w-full mt-2 text-left">
                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1 font-['Plus_Jakarta_Sans',sans-serif]">
                          {book.title}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5 font-['DM_Sans',sans-serif]">{book.subtitle}</p>
                      </div>
                    </div>

                    {/* Price & Add to Cart */}
                    <div className="p-4 pt-3 border-t border-slate-100 mt-3">
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                          ₹{currentPrice}
                        </span>
                        <span className="text-xs text-slate-400 line-through font-['DM_Sans',sans-serif]">
                          ₹{originalPrice}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 ml-auto font-['DM_Sans',sans-serif]">
                          {discount}% OFF
                        </span>
                      </div>

                      <button
                        onClick={() => buyNow(book, selectedFormat === 'physical' ? 'physical' : 'digital')}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <span>Buy Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-base font-bold text-slate-800">No books found matching criteria</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Try clearing one or more filters</p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
