import React, { useState } from 'react';
import {
  Search,
  Plus,
  ArrowUpDown,
  Edit3,
  Trash2,
  ExternalLink,
  CheckCircle2,
  FileText,
  Star,
  BookOpen,
} from 'lucide-react';
import { Book, ExamCategory } from '../../types';
import { BookCover } from '../../components/BookCover';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ProductsPageProps {
  books: Book[];
  onOpenNewProduct: () => void;
  onOpenEditProduct: (book: Book) => void;
  onDeleteProduct: (bookId: string) => void;
  onNavigateToReorder: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  books,
  onOpenNewProduct,
  onOpenEditProduct,
  onDeleteProduct,
  onNavigateToReorder,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExamCategory | 'All'>('All');
  const [productToDelete, setProductToDelete] = useState<Book | null>(null);

  const categories: Array<ExamCategory | 'All'> = ['All', 'IELTS', 'OET', 'PTE', 'German'];

  // Client-side filtering
  const filteredBooks = books.filter((b) => {
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.subtitle.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const confirmDelete = () => {
    if (!productToDelete) return;
    onDeleteProduct(productToDelete.id);
    showToast(`Deleted "${productToDelete.title}" from catalog`, 'info');
    setProductToDelete(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search products by title, subtitle, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToReorder}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Arrange Order</span>
          </button>
          <button
            onClick={onOpenNewProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              categoryFilter === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat} {cat === 'All' ? `(${books.length})` : `(${books.filter((b) => b.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Products Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredBooks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredBooks.map((book) => {
              const hasPdf = Boolean(book.pdfUrl);
              const digitalPrice = book.prices?.digital?.price ?? 199;
              const physicalPrice = book.prices?.physical?.price ?? 999;
              const reviewsCount = Array.isArray(book.reviews) ? book.reviews.length : 0;

              return (
                <div
                  key={book.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 shrink-0">
                      <BookCover book={book} size="sm" showShadow={false} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {book.category}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                          {book.type || 'Study Guide'}
                        </span>
                        {book.isBestSeller && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Bestseller
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] truncate">
                        {book.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate max-w-lg">
                        {book.subtitle || book.description}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span>Digital: <strong className="text-slate-900">₹{digitalPrice}</strong></span>
                        <span>•</span>
                        <span>Physical: <strong className="text-slate-900">₹{physicalPrice}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{book.rating || 4.8} ({reviewsCount})</span>
                        </span>
                        <span>•</span>
                        {hasPdf ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>PDF Connected</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">No PDF Attached</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <a
                      href={`/books/${book.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                      title="View on Storefront"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => onOpenEditProduct(book)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setProductToDelete(book)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No products match your criteria</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search query or selecting a different exam category.
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(productToDelete)}
        title="Delete Study Material?"
        message={`Are you sure you want to delete "${productToDelete?.title}" from the store catalog? This will remove the guide, its images, and study curriculum from the live storefront. This action cannot be undone.`}
        confirmLabel="Yes, Delete Product"
        cancelLabel="Keep Product"
        isDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
};
