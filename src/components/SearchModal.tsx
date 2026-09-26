import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, ArrowRight, BookOpen } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BOOKS } from '../data/books';
import { BookCover } from './BookCover';

export const SearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, navigateToProduct } = useShop();
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchTerm('');
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const results = BOOKS.filter(
    (b) =>
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => setIsSearchOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search IELTS, OET, PTE, German books, mock tests..."
            className="w-full text-base font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsSearchOpen(false)}
            className="text-xs font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Quick Tag Recommendations */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium shrink-0">Trending:</span>
          {['IELTS Full Preparation', 'OET', 'German A1-B2', 'PTE Academic', 'Mock Tests'].map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchTerm(tag)}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-full border border-slate-200 text-xs font-medium transition-colors shrink-0"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 p-2">
          {results.length > 0 ? (
            results.map((book) => (
              <div
                key={book.id}
                onClick={() => {
                  navigateToProduct(book.id);
                  setIsSearchOpen(false);
                }}
                className="flex items-center gap-4 p-3 hover:bg-emerald-50/50 rounded-xl cursor-pointer transition-colors group"
              >
                <div className="shrink-0 w-12 h-16 flex items-center justify-center">
                  <BookCover book={book} size="sm" showShadow={false} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {book.category}
                    </span>
                    {book.isBestSeller && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Best Seller
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                    {book.title}
                  </h4>
                  <p className="text-xs text-slate-500 truncate">{book.subtitle}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="font-bold text-slate-900">
                      ₹{book.prices.digital.price}
                    </span>
                    <span className="text-slate-400 line-through text-[11px]">
                      ₹{book.prices.digital.originalPrice}
                    </span>
                    <span className="flex items-center text-amber-500 text-[11px] font-semibold">
                      <Star className="w-3 h-3 fill-amber-400 mr-1" />
                      {book.rating} ({book.reviewCount})
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-500">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No books found for "{searchTerm}"</p>
              <p className="text-xs text-slate-400 mt-1">
                Try searching for IELTS, OET, PTE, German, or study planner.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
