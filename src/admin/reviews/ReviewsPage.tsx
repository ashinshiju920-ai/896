import React, { useState } from 'react';
import {
  Star,
  Plus,
  Trash2,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Search,
} from 'lucide-react';
import { Book, Review } from '../../types';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ReviewsPageProps {
  books: Book[];
  onAddReview: (bookId: string, review: Omit<Review, 'id' | 'date'>) => void;
  onUpdateBook: (bookId: string, updated: Partial<Book>) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({
  books,
  onAddReview,
  onUpdateBook,
  showToast,
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || '');
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [bandOrScore, setBandOrScore] = useState('Band 8.0');
  const [reviewToDelete, setReviewToDelete] = useState<{ bookId: string; reviewId: string } | null>(null);

  const targetBook = books.find((b) => b.id === selectedBookId) || books[0];
  const reviews = targetBook?.reviews || [];

  const handleCreateReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim()) {
      showToast('Please enter both author and review comment', 'warning');
      return;
    }

    onAddReview(targetBook.id, {
      author: author.trim(),
      rating,
      comment: comment.trim(),
      verified: true,
      bandOrScore: bandOrScore.trim(),
    });

    setAuthor('');
    setComment('');
    showToast(`Review added to "${targetBook.title}"!`, 'success');
  };

  const confirmDeleteReview = () => {
    if (!reviewToDelete) return;
    const currentBook = books.find((b) => b.id === reviewToDelete.bookId);
    if (currentBook) {
      const updatedReviews = (currentBook.reviews || []).filter((r) => r.id !== reviewToDelete.reviewId);
      onUpdateBook(currentBook.id, {
        reviews: updatedReviews,
        reviewCount: updatedReviews.length,
      });
      showToast('Review removed from product', 'info');
    }
    setReviewToDelete(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Product Selection Bar */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Select Study Guide to Manage Reviews
        </label>
        <select
          value={selectedBookId}
          onChange={(e) => setSelectedBookId(e.target.value)}
          className="w-full max-w-lg px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              [{b.category}] {b.title} ({Array.isArray(b.reviews) ? b.reviews.length : 0} reviews)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Add Review */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4 h-fit">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Add Verified Student Review
            </h3>
            <p className="text-[11px] text-slate-500">
              For: <strong className="text-slate-800">{targetBook?.title}</strong>
            </p>
          </div>

          <form onSubmit={handleCreateReview} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">Student Name *</label>
              <input
                type="text"
                placeholder="e.g. Karthika Menon"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Star Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-bold"
                >
                  <option value={5}>5 Stars (Excellent)</option>
                  <option value={4}>4 Stars (Good)</option>
                  <option value={3}>3 Stars (Average)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Band / Score</label>
                <input
                  type="text"
                  placeholder="Band 8.5 / Grade B"
                  value={bandOrScore}
                  onChange={(e) => setBandOrScore(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">Review Comment *</label>
              <textarea
                rows={3}
                placeholder="Detailed testimonial on how the study guide helped the candidate succeed..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Attach Review</span>
            </button>
          </form>
        </div>

        {/* Right List: Existing Reviews */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Reviews for Selected Book
              </h3>
              <p className="text-[11px] text-slate-500">Live student feedback</p>
            </div>
            <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{reviews.length} Total</span>
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {reviews.length > 0 ? (
              reviews.map((r) => (
                <div key={r.id} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs font-bold text-slate-900">{r.author}</strong>
                      {r.bandOrScore && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                          {r.bandOrScore}
                        </span>
                      )}
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: r.rating || 5 }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{r.comment}"
                    </p>
                    <span className="text-[10px] text-slate-400 block">{r.date || 'Recent'}</span>
                  </div>

                  <button
                    onClick={() => setReviewToDelete({ bookId: targetBook.id, reviewId: r.id })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No reviews recorded yet for this guide.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Review Confirmation */}
      <ConfirmationModal
        isOpen={Boolean(reviewToDelete)}
        title="Delete Student Review?"
        message="Are you sure you want to remove this verified review from the product? This action cannot be undone."
        confirmLabel="Yes, Delete Review"
        cancelLabel="Keep Review"
        isDanger={true}
        onConfirm={confirmDeleteReview}
        onCancel={() => setReviewToDelete(null)}
      />
    </div>
  );
};
