import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  Save,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { Book, ExamCategory } from '../../types';
import { BookCover } from '../../components/BookCover';

interface ProductReorderProps {
  books: Book[];
  onReorderBooks: (books: Book[]) => void;
  onBack: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const ProductReorder: React.FC<ProductReorderProps> = ({
  books,
  onReorderBooks,
  onBack,
  showToast,
}) => {
  const [orderedBooks, setOrderedBooks] = useState<Book[]>([...books]);
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | 'All'>('All');
  const [hasChanges, setHasChanges] = useState(false);

  const categories: Array<ExamCategory | 'All'> = ['All', 'IELTS', 'OET', 'PTE', 'German'];

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedBooks.length) return;

    const next = [...orderedBooks];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    setOrderedBooks(next);
    setHasChanges(true);
  };

  const moveToTop = (index: number) => {
    if (index <= 0) return;
    const next = [...orderedBooks];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    setOrderedBooks(next);
    setHasChanges(true);
  };

  const handleSave = () => {
    onReorderBooks(orderedBooks);
    setHasChanges(false);
    showToast('Storefront product arrangement saved & synced live!', 'success');
  };

  const visibleBooks = orderedBooks.filter(
    (b) => selectedCategory === 'All' || b.category === selectedCategory
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              Storefront Product Arrangement
            </h2>
            <p className="text-xs text-slate-500">
              Drag or use controls to set the display priority of study guides across the storefront.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#00875a] hover:bg-[#00734c] disabled:opacity-50 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Arrangement</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Reorderable List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {visibleBooks.map((book) => {
          const globalIndex = orderedBooks.findIndex((b) => b.id === book.id);
          const isFirst = globalIndex === 0;
          const isLast = globalIndex === orderedBooks.length - 1;

          return (
            <div
              key={book.id}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
            >
              {/* Rank & Book Info */}
              <div className="flex items-center gap-4 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 font-mono">
                  #{globalIndex + 1}
                </span>

                <div className="w-10 shrink-0">
                  <BookCover book={book} size="sm" showShadow={false} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                      {book.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate">{book.title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                    {book.subtitle || book.description}
                  </p>
                </div>
              </div>

              {/* Movement Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveToTop(globalIndex)}
                  disabled={isFirst}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                  title="Move to Top (#1)"
                >
                  <ChevronsUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(globalIndex, 'up')}
                  disabled={isFirst}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(globalIndex, 'down')}
                  disabled={isLast}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
