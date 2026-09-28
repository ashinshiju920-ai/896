import React, { useState, useEffect } from 'react';
import {
  Star,
  ChevronRight,
  Heart,
  ShoppingBag,
  CheckCircle2,
  FileText,
  BookOpen,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  DownloadCloud,
  ExternalLink,
  Plus,
  Users,
  Check,
  Tag,
  Gift,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BookCover } from '../components/BookCover';
import { BackButton } from '../components/BackButton';
import { BookFormat, ProductAddon } from '../types';
import {
  getBookAddons,
  calculateAddonsPricing,
  getSelectableAddons,
  calculateDisplayPrice,
} from '../utils/pricing';
import { useParams, Link } from 'react-router-dom';
import { findBookBySlug } from '../utils/productSlug';
import { NotFoundView } from './NotFoundView';
import { trackProductView, trackAddToCart, trackAddonSelected } from '../utils/analytics';

export const ProductDetailView: React.FC = () => {
  const {
    books,
    selectedBookId,
    addToCart,
    buyNow,
    openCart,
    setCurrentView,
    navigateToProduct,
    navigateToCatalog,
    toggleWishlist,
    isInWishlist,
    addReview,
    showToast,
  } = useShop();

  const { slug } = useParams<{ slug?: string }>();
  const book = slug
    ? findBookBySlug(slug, books)
    : (books.find((b) => b.id === selectedBookId) || books[0]);

  // Page title for SEO & Analytics view tracking
  useEffect(() => {
    if (book) {
      document.title = `${book.title} | Xylem Learning`;
      trackProductView(book.id);
    }
    return () => {
      document.title = 'Xylem Learning — Exam Preparation Books & Study Materials';
    };
  }, [book]);

  // If a slug was specifically passed in URL but does not match any product
  if (slug && !book) {
    return (
      <NotFoundView
        title="Product Not Found"
        message={`We couldn't find any study guide or book matching "${slug}". It may have been updated, renamed, or removed.`}
      />
    );
  }

  if (!book) {
    return (
      <NotFoundView
        title="Product Unavailable"
        message="The requested study material is currently not available. Please explore our other exam guides."
      />
    );
  }

  // Base format state (Digital PDF vs Physical Book)
  const isPaperbackDisabled = Boolean(book.disablePaperback);
  const [format, setFormat] = useState<BookFormat>('digital');

  useEffect(() => {
    if (isPaperbackDisabled && format === 'physical') {
      setFormat('digital');
    }
  }, [isPaperbackDisabled, format]);

  // Customer-selectable active optional add-ons
  const selectableAddons = getSelectableAddons(book);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);


  // When book changes, reset add-on selection so it never leaks across products
  useEffect(() => {
    setSelectedAddonIds([]);
  }, [book.id]);

  const toggleAddonSelection = (addonId: string) => {
    setSelectedAddonIds((prev) => {
      if (prev.includes(addonId)) {
        return prev.filter((id) => id !== addonId);
      } else {
        // Track meaningful add-on selection
        trackAddonSelected(book.id, addonId);
        // Prevent duplicate IDs (Set behavior)
        return Array.from(new Set([...prev, addonId]));
      }
    });
  };

  const displayCalc = calculateDisplayPrice(book, format, selectedAddonIds);

  const digitalPrice = Number(book.prices?.digital?.price) || 199;
  const digitalOrig = Number(book.prices?.digital?.originalPrice) || 599;
  const digitalDiscount = Math.round(((digitalOrig - digitalPrice) / digitalOrig) * 100);

  const physicalPrice = Number(book.prices?.physical?.price) || 899;
  const physicalOrig = Number(book.prices?.physical?.originalPrice) || 1499;
  const physicalDiscount = Math.round(((physicalOrig - physicalPrice) / physicalOrig) * 100);

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'included' | 'reviews'>('description');
  const [selectedThumbnail, setSelectedThumbnail] = useState<number>(0);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBand, setReviewBand] = useState('Band 8.0 Achieved');
  const [reviewComment, setReviewComment] = useState('');

  const isFavorited = isInWishlist(book.id);

  // Recommendations: exclude current book
  const recommendations = books.filter((b) => b.id !== book.id).slice(0, 4);

  const handleAddToCart = () => {
    trackAddToCart(book.id, selectedAddonIds);
    addToCart(book, format, quantity, selectedAddonIds);
  };

  const handleBuyNow = () => {
    trackAddToCart(book.id, selectedAddonIds);
    buyNow(book, format, quantity, selectedAddonIds);
  };

  const handleInlineReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAuthor.trim() || !reviewComment.trim()) {
      showToast('Please enter your name and comment', 'warning');
      return;
    }
    addReview(book.id, {
      author: reviewAuthor.trim(),
      rating: reviewRating,
      bandOrScore: reviewBand.trim(),
      comment: reviewComment.trim(),
      verified: true,
    });
    setReviewAuthor('');
    setReviewComment('');
    setShowReviewForm(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8 sm:space-y-12">
      {/* Breadcrumbs + Back Button */}
      <div className="flex items-center justify-between">
        <BackButton to={`/books?category=${encodeURIComponent(book.category)}`} label="Back to Catalog" />
        <nav className="hidden sm:flex items-center space-x-2 text-xs text-slate-500">
          <Link
            to="/"
            className="hover:text-emerald-700 transition-colors"
          >
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link
            to={`/books?category=${encodeURIComponent(book.category)}`}
            className="hover:text-emerald-700 transition-colors"
          >
            {book.category}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
            {book.title}
          </span>
        </nav>
      </div>

      {/* Main Product Layout - stacks vertically on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-14">
        {/* Left Column: Gallery & Book Preview */}
        <div className="lg:col-span-6 flex flex-col sm:flex-row gap-4 items-center sm:items-start justify-center">
          {/* Thumbnails list on left */}
          <div className="flex sm:flex-col gap-3 order-2 sm:order-1">
            {[0, 1, 2, 3].map((idx) => {
              const imgUrl = (book.images && book.images[idx]) || (idx === 0 ? (book.imageUrl || book.coverImage) : null);
              const labels = ['Cover', 'Page 2', 'Sample', 'Back'];
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedThumbnail(idx)}
                  className={`w-14 h-18 rounded-lg border-2 p-1 overflow-hidden transition-all flex flex-col items-center justify-center relative ${
                    selectedThumbnail === idx
                      ? 'border-emerald-600 ring-2 ring-emerald-100 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 opacity-80'
                  }`}
                  aria-label={`View image ${idx + 1}`}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={`${book.title} view ${idx + 1}`}
                      className="w-full h-full object-cover rounded-xs"
                    />
                  ) : idx === 0 ? (
                    <div className="w-full h-full bg-slate-900 rounded-xs flex items-center justify-center text-[7px] text-white font-bold">
                      Cover
                    </div>
                  ) : idx === 1 ? (
                    <div className="w-full h-full bg-slate-100 rounded-xs flex flex-col items-center justify-center p-0.5 text-[6px] text-slate-600">
                      <div className="w-3/4 h-1 bg-slate-300 mb-0.5"></div>
                      <div className="w-1/2 h-1 bg-slate-300"></div>
                      <span>TOC</span>
                    </div>
                  ) : idx === 2 ? (
                    <div className="w-full h-full bg-emerald-50 rounded-xs flex flex-col items-center justify-center p-0.5 text-[6px] text-emerald-800 font-bold">
                      <span>MOCK</span>
                      <span>TEST</span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-slate-800 rounded-xs flex items-center justify-center text-[6px] text-slate-300">
                      Back
                    </div>
                  )}
                  <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-[6px] text-white px-1 rounded-xs">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main Book Visual Display */}
          <div className="order-1 sm:order-2 flex-1 w-full max-w-sm bg-gradient-to-b from-slate-50 to-slate-100/60 rounded-3xl p-8 border border-slate-200/80 flex flex-col items-center relative shadow-sm">
            {/* Carousel navigation arrows */}
            <button
              onClick={() => setSelectedThumbnail((prev) => (prev > 0 ? prev - 1 : 3))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-700 hover:bg-white hover:text-emerald-700 transition-colors z-20"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedThumbnail((prev) => (prev < 3 ? prev + 1 : 0))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-700 hover:bg-white hover:text-emerald-700 transition-colors z-20"
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Display according to selected thumbnail */}
            <div className="py-4 w-full flex items-center justify-center min-h-[320px]">
              {(() => {
                const activeCustomImg = (book.images && book.images[selectedThumbnail]) || (selectedThumbnail === 0 ? (book.imageUrl || book.coverImage) : null);
                if (activeCustomImg && selectedThumbnail > 0) {
                  return (
                    <div className="w-56 h-76 sm:w-64 sm:h-88 rounded-xl overflow-hidden shadow-xl border border-slate-200 bg-white flex items-center justify-center p-2">
                      <img
                        src={activeCustomImg}
                        alt={`${book.title} slide ${selectedThumbnail + 1}`}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>
                  );
                }
                return <BookCover book={book} size="lg" />;
              })()}
            </div>


          </div>
        </div>

        {/* Right Column: Title, Format Selectors, CTA (Image 2 & 4) */}
        <div className="lg:col-span-6 space-y-6 text-left">
          {/* Badge & Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {book.isBestSeller && (
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-md">
                  BEST SELLER
                </span>
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1 rounded-md">
                {book.category} Exam
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
              {book.title}
            </h1>

            {/* Star Rating & Social Proof */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <span className="text-sm font-bold text-slate-800">{book.rating}</span>
              <span className="text-xs text-slate-500">({book.reviewCount} reviews)</span>
              {book.buyersCount !== undefined && book.buyersCount > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{book.buyersCount.toLocaleString()} students bought this</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Description Snippet */}
          <p className="text-sm text-slate-600 leading-relaxed">
            {book.description}
          </p>

          {/* Feature Badges from Image 2 */}
          <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100">
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
              <BookOpen className="w-4 h-4 text-emerald-600 mb-1" />
              <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                Complete Syllabus
              </span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1" />
              <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                500+ Practice
              </span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
              <Sparkles className="w-4 h-4 text-emerald-600 mb-1" />
              <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                Full Mock Tests
              </span>
            </div>
          </div>

          {/* 1. Base Format Selection (Digital PDF vs Physical Book) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Select Book Format
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Choose digital or printed
              </span>
            </div>

            {isPaperbackDisabled ? (
              /* Single Digital Card when Paperback is turned off */
              <div className="p-3.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500/20 flex items-center justify-between select-none">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-600 text-white">
                    <DownloadCloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">Digital Edition</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        PDF eBook
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">Instant PDF Download • Lifetime Access</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold text-slate-900">₹{digitalPrice}</div>
                  {digitalOrig > digitalPrice && (
                    <div className="flex items-center justify-end gap-1 text-[10px]">
                      <span className="line-through text-slate-400">₹{digitalOrig}</span>
                      {digitalDiscount > 0 && (
                        <span className="font-bold text-emerald-700">{digitalDiscount}% OFF</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Digital Option */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Select Digital PDF edition"
                  onClick={() => setFormat('digital')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setFormat('digital');
                    }
                  }}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between select-none ${
                    format === 'digital'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        format === 'digital' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <DownloadCloud className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">Digital Edition</h4>
                      <p className="text-[10px] text-slate-500 truncate">Instant PDF Download</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-slate-900">₹{digitalPrice}</div>
                    {digitalOrig > digitalPrice && (
                      <div className="flex items-center justify-end gap-1 text-[10px]">
                        <span className="line-through text-slate-400">₹{digitalOrig}</span>
                        {digitalDiscount > 0 && (
                          <span className="font-bold text-emerald-700">{digitalDiscount}% OFF</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Physical Option */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Select Paperback Printed edition"
                  onClick={() => setFormat('physical')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setFormat('physical');
                    }
                  }}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between select-none ${
                    format === 'physical'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        format === 'physical' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">Paperback Edition</h4>
                      <p className="text-[10px] text-slate-500 truncate">Delivered in 3-5 days</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-slate-900">₹{physicalPrice}</div>
                    {physicalOrig > physicalPrice && (
                      <div className="flex items-center justify-end gap-1 text-[10px]">
                        <span className="line-through text-slate-400">₹{physicalOrig}</span>
                        {physicalDiscount > 0 && (
                          <span className="font-bold text-emerald-700">{physicalDiscount}% OFF</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Optional Add-ons Section: "Add Optional Materials" */}
          {selectableAddons.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <span>Add Optional Materials</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Optional
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enhance your preparation with extra mock tests & study resources.
                  </p>
                </div>
                {selectedAddonIds.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {selectedAddonIds.length} Selected
                  </span>
                )}
              </div>

              {/* Add-on Cards */}
              <div className="grid grid-cols-1 gap-2.5">
                {selectableAddons.map((addon) => {
                  const isChecked = selectedAddonIds.includes(addon.id);
                  const isPhysical = addon.deliveryOption === 'physical';

                  return (
                    <div
                      key={addon.id}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      aria-label={`${addon.name} for ₹${addon.price}`}
                      onClick={() => toggleAddonSelection(addon.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleAddonSelection(addon.id);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between select-none ${
                        isChecked
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 pr-3">
                        {/* Checkbox Icon */}
                        <div
                          className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked ? 'bg-emerald-600 text-white shadow-xs' : 'border-2 border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {addon.name}
                            </h4>
                            {addon.digitalFile?.filename && (
                              <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                                PDF
                              </span>
                            )}
                          </div>
                          {addon.description && (
                            <p className="text-[11px] text-slate-500 leading-snug line-clamp-1 mt-0.5">
                              {addon.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                            {isPhysical ? (
                              <>
                                <BookOpen className="w-3 h-3 text-slate-400" />
                                <span>Printed Delivery</span>
                              </>
                            ) : (
                              <>
                                <DownloadCloud className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-medium">Instant PDF Download</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-slate-900">
                          ₹{addon.price}
                        </div>
                        {addon.originalPrice > addon.price && (
                          <div className="flex items-center justify-end gap-1 text-[10px]">
                            <span className="line-through text-slate-400">
                              ₹{addon.originalPrice}
                            </span>
                            {addon.discountPercent ? (
                              <span className="font-bold text-emerald-700">
                                {addon.discountPercent}% OFF
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bundle Upsell Incentive Card */}
              {selectableAddons.length >= 2 && selectedAddonIds.length < selectableAddons.length && (
                <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-emerald-50 border border-purple-200/80 rounded-2xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800 bg-purple-200/80 px-2 py-0.5 rounded">
                        Bundle Deal
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        Buy 2 Add-ons, Get 3rd FREE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Add all {selectableAddons.length} study resources to qualify for automatic 3rd add-on discount
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAddonIds(selectableAddons.map((a) => a.id))}
                    className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Select All Add-ons
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Total Price Summary Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Selected Total:</span>
                <span className="text-lg font-black text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
                  ₹{displayCalc.totalPrice * quantity}
                </span>
                {displayCalc.totalOriginalPrice > displayCalc.totalPrice && (
                  <span className="line-through text-slate-400 text-xs">
                    ₹{displayCalc.totalOriginalPrice * quantity}
                  </span>
                )}
              </div>
              {displayCalc.totalOriginalPrice > displayCalc.totalPrice && (
                <span className="font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full text-[11px]">
                  Save ₹{(displayCalc.totalOriginalPrice - displayCalc.totalPrice) * quantity}
                </span>
              )}
            </div>

            {/* Breakdown line showing Base + Selected Add-ons */}
            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-0.5">
              <span>Base ({format === 'physical' ? 'Physical' : 'Digital'}): ₹{displayCalc.basePrice}</span>
              {displayCalc.selectedAddons.length > 0 && (
                <>
                  <span>+</span>
                  <span>{displayCalc.selectedAddons.length} Optional Material{displayCalc.selectedAddons.length > 1 ? 's' : ''} (₹{displayCalc.addOnsPrice})</span>
                </>
              )}
              {quantity > 1 && <span>× {quantity} qty</span>}
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Quantity
            </span>
            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors"
              >
                -
              </button>
              <span className="w-10 text-center text-xs font-bold text-slate-900">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Action Buttons: Add to Cart & Add to Wishlist */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              id="add-to-cart-primary"
              onClick={handleAddToCart}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-[#00875a] hover:bg-[#00734c] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </button>

            <button
              id="wishlist-btn"
              onClick={() => toggleWishlist(book.id)}
              className={`w-full sm:w-auto py-3.5 px-5 rounded-xl border font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                isFavorited
                  ? 'bg-rose-50 border-rose-300 text-rose-600'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="sm:hidden">Wishlist</span>
            </button>

            <button
              id="buy-now-btn"
              onClick={handleBuyNow}
              className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-[#0a2540] hover:bg-[#081d33] text-white font-bold text-sm transition-all"
            >
              Buy Now
            </button>
          </div>

          {/* External Ad / Affiliate Link Banner if configured */}
          {book.adLink && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded">
                    Official Partner Offer
                  </span>
                  <span className="text-[11px] text-amber-900 font-semibold">Special Direct Route</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {book.adText || 'Also available on external retailer or Amazon'}
                </p>
              </div>
              <a
                href={book.adLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
              >
                <span>Visit Partner Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Guarantee Badges */}
          <div className="grid grid-cols-3 gap-3 pt-4 text-slate-500 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Original Products</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Secure Checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Easy Returns (7 Days)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section: Description | What's Included | Reviews (Image 2) */}
      <div className="border-t border-slate-200 pt-8">
        <div className="flex items-center space-x-6 border-b border-slate-200 pb-3 font-['DM_Sans',sans-serif]">
          <button
            onClick={() => setActiveTab('description')}
            className={`text-sm font-semibold pb-2 transition-colors relative ${
              activeTab === 'description'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Description
            {activeTab === 'description' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('included')}
            className={`text-sm font-semibold pb-2 transition-colors relative ${
              activeTab === 'included'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            What's Included
            {activeTab === 'included' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`text-sm font-semibold pb-2 transition-colors relative ${
              activeTab === 'reviews'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Reviews ({book.reviewCount})
            {activeTab === 'reviews' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="py-6">
          {activeTab === 'description' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  About This Book
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-['DM_Sans',sans-serif]">
                  {book.longDescription}
                </p>
                <div className="pt-2 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-['DM_Sans',sans-serif]">
                    Key Highlights:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 font-['DM_Sans',sans-serif]">
                    {book.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* What You'll Get Card (Image 2) */}
              <div className="lg:col-span-5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-6">
                <h4 className="text-sm font-bold text-slate-900 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
                  What You'll Get
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-700 font-['DM_Sans',sans-serif]">
                  {book.whatYouGet.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'included' && (
            <div className="space-y-6 max-w-3xl">

              {/* What You'll Get — checklist */}
              {book.whatYouGet && book.whatYouGet.length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-3 font-['Plus_Jakarta_Sans',sans-serif] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </span>
                    What's Inside This Course
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-['DM_Sans',sans-serif]">
                    {book.whatYouGet.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Table of Contents */}
              {book.tableOfContents && book.tableOfContents.length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-3 font-['Plus_Jakarta_Sans',sans-serif]">
                    Syllabus Breakdown
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden font-['DM_Sans',sans-serif]">
                    {book.tableOfContents.map((chap, i) => (
                      <div key={i} className="flex items-center justify-between p-3.5 text-xs hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 shrink-0 w-5 text-right">{i + 1}.</span>
                          <span className="font-medium text-slate-800">{chap.chapter}</span>
                        </div>
                        {chap.pages && (
                          <span className="text-slate-400 font-semibold shrink-0 ml-3">{chap.pages}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!book.whatYouGet || book.whatYouGet.length === 0) && (!book.tableOfContents || book.tableOfContents.length === 0) && (
                <div className="py-10 text-center text-slate-400 text-sm font-['DM_Sans',sans-serif]">
                  Course content details coming soon.
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Rating Summary Card & Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                      {book.rating}
                    </div>
                    <div className="flex items-center text-amber-400 my-1 justify-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                    <div className="text-xs text-slate-500">Based on {book.reviewCount} reviews</div>
                  </div>
                  <div className="border-l border-slate-200 pl-6 space-y-1 text-xs text-slate-600">
                    <div>✓ 98% of learners would recommend this guide</div>
                    <div>✓ Verified by Cambridge & British Council test patterns</div>
                    {book.buyersCount !== undefined && book.buyersCount > 0 && (
                      <div className="font-semibold text-emerald-700">
                        ✓ {book.buyersCount.toLocaleString()}+ students already purchased this book
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showReviewForm ? 'Cancel Review' : 'Write a Review'}</span>
                </button>
              </div>

              {/* Inline Write Review Form */}
              {showReviewForm && (
                <form
                  onSubmit={handleInlineReviewSubmit}
                  className="p-6 bg-white border-2 border-emerald-200 rounded-2xl shadow-sm space-y-4 animate-in fade-in duration-150"
                >
                  <h4 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Submit Your Student Review for "{book.title}"
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Your Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={reviewAuthor}
                        onChange={(e) => setReviewAuthor(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Exam Band / Score</label>
                      <input
                        type="text"
                        placeholder="e.g. Band 8.0 Achieved"
                        value={reviewBand}
                        onChange={(e) => setReviewBand(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Rating</label>
                    <div className="flex items-center gap-2 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setReviewRating(s)}
                          className="p-1 text-amber-400 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              s <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">{reviewRating}.0 Stars</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Review Comments</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Share your exam preparation experience and how this material helped..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Submit Verified Review
                  </button>
                </form>
              )}

              {/* Reviews List */}
              <div className="space-y-4">
                {(book.reviews && book.reviews.length > 0
                  ? book.reviews
                  : [
                      {
                        id: 'r1',
                        author: 'Arjun S.',
                        bandOrScore: 'Band 8.0 Achieved',
                        comment: 'Comprehensive practice tests! The writing templates were an absolute lifesaver.',
                        date: 'September 12, 2026',
                        rating: 5,
                        verified: true,
                      },
                      {
                        id: 'r2',
                        author: 'Priya Nambiar',
                        bandOrScore: 'Band 7.5',
                        comment: 'Clean layout, straightforward explanations, and the mock exam audio scripts are clear.',
                        date: 'August 28, 2026',
                        rating: 5,
                        verified: true,
                      },
                    ]
                ).map((rev, i) => (
                  <div key={rev.id || i} className="p-4 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{rev.author}</span>
                      <span className="text-slate-400">{rev.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-amber-400">
                        {[...Array(5)].map((_, s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s < (rev.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      {rev.bandOrScore && (
                        <span className="text-emerald-700 font-semibold">{rev.bandOrScore}</span>
                      )}
                    </div>
                    <p className="text-slate-600 mt-1">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* You May Also Like Section (Image 2) */}
      <div className="border-t border-slate-200 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            You May Also Like
          </h3>
          <button
            onClick={() => setCurrentView('catalog')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 font-['DM_Sans',sans-serif]"
          >
            View All Books →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              onClick={() => navigateToProduct(rec.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex justify-center pb-3 group-hover:scale-105 transition-transform">
                <BookCover book={rec} size="sm" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 truncate group-hover:text-emerald-700 font-['Plus_Jakarta_Sans',sans-serif]">
                  {rec.title}
                </h4>
                <div className="flex items-center gap-1 my-1 text-[11px] text-amber-500 font-semibold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{rec.rating}</span>
                </div>
                <div className="text-xs font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  ₹{rec.prices?.digital?.price ?? 199}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  buyNow(rec, 'digital');
                }}
                className="mt-3 w-full py-1.5 bg-[#00875a] hover:bg-[#00734c] text-white text-[11px] font-bold rounded-lg font-['DM_Sans',sans-serif] active:scale-95"
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Physical Copy Callout Banner (Image 2) */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-slate-100 to-emerald-50/50 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Prefer a Physical Copy?
          </h4>
          <p className="text-xs sm:text-sm text-slate-600">
            Get the high-quality spiral or bound book delivered straight to your doorstep.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">
              ₹{book.prices?.physical?.price ?? 999}
            </div>
            <div className="text-xs text-slate-400 line-through">
              ₹{book.prices?.physical?.originalPrice ?? 1299}
            </div>
          </div>
          <button
            onClick={() => {
              buyNow(book, 'physical');
            }}
            className="px-5 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            Buy Physical Book
          </button>
        </div>
      </div>
    </div>
  );
};
