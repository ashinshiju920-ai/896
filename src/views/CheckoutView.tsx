import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Lock,
  ShieldCheck,
  Zap,
  Star,
  Check,
  CheckCircle2,
  ArrowRight,
  Shield,
  Headphones,
  Search,
  User,
  ShoppingBag,
  Loader2,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { XylemLogo } from '../components/XylemLogo';
import { CashfreeLogo } from '../components/CashfreeLogo';
import { BackButton } from '../components/BackButton';
import { BookCover } from '../components/BookCover';
import { createCashfreeOrder, loadCashfreeSDK, CashfreeOrderPricing } from '../utils/cashfree';
import { trackCheckoutStarted, resetCheckoutTracking, pushBeginCheckoutEvent } from '../utils/analytics';
import { validateAndReconcileCart, getSelectableAddons, calculateDisplayPrice } from '../utils/pricing';
import { Book } from '../types';

const getProductImage = (book?: Book | null): string | null => {
  if (!book) return null;
  return book.coverImage || book.imageUrl || (Array.isArray(book.images) && book.images[0]) || null;
};

export const CheckoutView: React.FC = () => {
  const {
    books,
    isCatalogReady,
    cart,
    subtotal,
    deliveryFee,
    total,
    setCurrentView,
    navigateToCatalog,
    openCart,
    cartCount,
    setIsSearchOpen,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    reconcileCartWithCatalog,
    pruneInvalidAddon,
    refreshProductsFromCloud,
    shippingInfo,
    setShippingInfo,
    showToast,
    currentCustomer,
    addToCart,
    setCart,
  } = useShop();

  const [isProcessing, setIsProcessing] = useState(false);
  const [serverPayableAmount, setServerPayableAmount] = useState<number | null>(null);
  const [serverPricing, setServerPricing] = useState<CashfreeOrderPricing | null>(null);
  const [inputCoupon, setInputCoupon] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeCarouselDot, setActiveCarouselDot] = useState(0);
  const mobileCarouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get('payment');
    if (paymentState === 'failed') {
      showToast('Payment failed. Your selected items are still here so you can try again.', 'warning');
      window.history.replaceState({}, '', '/checkout');
    } else if (paymentState === 'cancelled') {
      showToast('Payment was not completed. Your selected items are still here so you can try again.', 'warning');
      window.history.replaceState({}, '', '/checkout');
    }
  }, [showToast]);

  // 1. Determine primary exam category from cart items
  const primaryCategory = useMemo(() => {
    return (cart[0]?.book?.category || 'IELTS') as string;
  }, [cart]);

  // 2. Fast lookup for items already in cart
  const cartBookIds = useMemo(() => {
    return new Set(cart.map((item) => item.bookId || item.book.id));
  }, [cart]);

  // 3. Find 4 related booster/practice products from the same category
  const relatedProducts = useMemo(() => {
    const sameCategory = books.filter((b) => b.category === primaryCategory);
    const prefix = primaryCategory.toLowerCase();
    const curatedBoosterIds = [
      `${prefix}-vocab-booster`,
      `${prefix}-writing-task`,
      `${prefix}-listening-practice`,
      `${prefix}-reading-strategies`,
    ];

    const sortedSameCategory = [...sameCategory].sort((a, b) => {
      const aIsBooster = curatedBoosterIds.includes(a.id) ? 0 : 1;
      const bIsBooster = curatedBoosterIds.includes(b.id) ? 0 : 1;
      if (aIsBooster !== bIsBooster) return aIsBooster - bIsBooster;

      const aInCart = cartBookIds.has(a.id) ? 1 : 0;
      const bInCart = cartBookIds.has(b.id) ? 1 : 0;
      return aInCart - bInCart;
    });

    let candidates = sortedSameCategory;
    if (candidates.length < 4) {
      const otherBooks = books.filter((b) => b.category !== primaryCategory);
      candidates = [...candidates, ...otherBooks];
    }
    return candidates.slice(0, 4);
  }, [books, primaryCategory, cartBookIds]);

  // 4. Cart interaction handlers (Single shared state across desktop and mobile)
  const handleAddRelatedProduct = (product: Book) => {
    addToCart(product, 'digital', 1, []);
    showToast(`Added "${product.title}" to your order!`, 'success');
  };

  const toggleItemAddon = (itemIndex: number, addonId: string) => {
    setCart((prevCart) => {
      return prevCart.map((item, idx) => {
        if (idx !== itemIndex) return item;

        const currentIds = Array.isArray(item.selectedAddonIds) ? item.selectedAddonIds : [];
        const isSelected = currentIds.includes(addonId);
        const newAddonIds = isSelected
          ? currentIds.filter((id) => id !== addonId)
          : [...currentIds, addonId];

        const displayCalc = calculateDisplayPrice(item.book, item.format, newAddonIds);
        return {
          ...item,
          price: displayCalc.totalPrice,
          originalPrice: displayCalc.totalOriginalPrice,
          selectedAddonIds: newAddonIds,
          selectedAddons: displayCalc.selectedAddons,
        };
      });
    });
  };

  const handleUpdateQuantity = (itemIndex: number, delta: number) => {
    setCart((prevCart) => {
      return prevCart.map((item, idx) => {
        if (idx !== itemIndex) return item;
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      });
    });
  };

  const handleRemoveProduct = (itemIndex: number) => {
    setCart((prevCart) => prevCart.filter((_, idx) => idx !== itemIndex));
    showToast('Product removed from order', 'info');
  };

  const handleCarouselScroll = () => {
    if (mobileCarouselRef.current) {
      const { scrollLeft } = mobileCarouselRef.current;
      const cardWidth = 230;
      const index = Math.min(
        relatedProducts.length - 1,
        Math.max(0, Math.round(scrollLeft / cardWidth))
      );
      setActiveCarouselDot(index);
    }
  };

  // Auto-fill logged-in customer details
  useEffect(() => {
    if (currentCustomer) {
      setShippingInfo((prev) => ({
        ...prev,
        fullName: prev.fullName || currentCustomer.name || '',
        email: prev.email || currentCustomer.email || '',
        phone: prev.phone || currentCustomer.phone || '',
      }));
    }
  }, [currentCustomer, setShippingInfo]);

  // Track checkout started (deduplicated per checkout visit)
  useEffect(() => {
    if (cart.length > 0) {
      const productIds = cart.map((i) => i.book.id);
      trackCheckoutStarted(productIds, cart.length);
      pushBeginCheckoutEvent(cart);
    }
    return () => {
      resetCheckoutTracking();
    };
  }, [cart.length]);

  // If cart is empty, render clean empty checkout notice
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['DM_Sans',sans-serif] flex flex-col justify-between">
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            <Link to="/" className="cursor-pointer flex items-center gap-2">
              <XylemLogo />
            </Link>
            <Link
              to="/books"
              className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Browse Catalog
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-5 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Your Cart is Empty
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              You don't have any study materials in your cart. Choose an IELTS, OET, PTE, or German book to proceed with checkout.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigateToCatalog('All')}
                className="w-full py-3.5 px-6 rounded-xl bg-[#00875a] hover:bg-[#00734c] text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Browse Study Materials</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hasPhysical = cart.some((item) => item.format === 'physical');
  const deliveryOption = hasPhysical ? 'physical' : 'digital';
  // Validate only against the live catalog and selected ID intent. Stored display
  // snapshots are never authoritative and cannot enable payment.
  const cartPreflight = validateAndReconcileCart(cart, books);

  const totalOriginalPrice = cart.reduce(
    (sum, item) => sum + ((item.originalPrice || item.price) * item.quantity),
    0
  );

  // Authoritative server-synced prices (server always takes precedence over estimated client values)
  const payableAmount = serverPayableAmount !== null ? serverPayableAmount : total;
  const authoritativeSubtotal = serverPricing ? serverPricing.subtotal : subtotal;
  const authoritativeDeliveryFee = serverPricing ? serverPricing.shipping : deliveryFee;
  const authoritativeDiscount = serverPricing ? serverPricing.discount : couponDiscount;

  // Catalog MRP savings (difference between catalog MRP and actual payable amount)
  const totalSavings = Math.max(0, totalOriginalPrice - payableAmount);
  const discountPercent = totalOriginalPrice > 0
    ? Math.round((totalSavings / totalOriginalPrice) * 100)
    : 0;

  // A server quote belongs to one cart/coupon/delivery combination only.
  useEffect(() => {
    setServerPayableAmount(null);
    setServerPricing(null);
  }, [cart, appliedCoupon, deliveryOption]);

  const isSubmittingRef = useRef(false);

  // Do not render persisted cart snapshots while the no-cache catalog fetch is
  // still in flight; otherwise a deleted add-on can flash during hydration.
  if (!isCatalogReady) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-sm font-semibold text-slate-600">
        Verifying your cart…
      </div>
    );
  }


  const handleApplyCoupon = async () => {
    const clean = inputCoupon.trim().toUpperCase();
    if (!clean) return;

    setIsValidatingCoupon(true);
    setCouponFeedback(null);

    try {
      const cartPayload = cart.map((item: any) => ({
        bookId: item.bookId || item.book?.id,
        addonIds: item.selectedAddonIds || [item.format || 'digital'],
        format: item.format || 'digital',
        quantity: item.quantity || 1,
      }));

      const res = await fetch('/api/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: clean,
          cart: cartPayload,
          deliveryOption: hasPhysical ? 'physical' : 'digital',
        }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        applyCoupon(clean);
        setCouponFeedback({
          type: 'success',
          message: `✓ ${data.code} applied. Discount: -₹${data.discountRupees}`,
        });
        showToast(`✓ ${data.code} applied! Discount: -₹${data.discountRupees}`, 'success');
        setInputCoupon('');
      } else {
        const errorMsg = data.error || 'Coupon is not valid for this order.';
        setCouponFeedback({ type: 'error', message: errorMsg });
        showToast(errorMsg, 'warning');
      }
    } catch {
      const success = applyCoupon(clean);
      if (success) {
        setCouponFeedback({ type: 'success', message: `✓ ${clean} applied.` });
        setInputCoupon('');
      } else {
        setCouponFeedback({ type: 'error', message: 'Coupon is not valid for this order.' });
      }
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleProceedToPayment = async () => {
    // 0. Double-Click & In-Flight Guard
    if (isSubmittingRef.current || isProcessing) return;

    // 1. Mandatory Pre-Flight Validation
    if (!shippingInfo.fullName.trim() || shippingInfo.fullName.trim().length < 3) {
      showToast('Please enter your full name (minimum 3 characters)', 'warning');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!shippingInfo.email.trim() || !emailRegex.test(shippingInfo.email.trim())) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    const phoneDigits = shippingInfo.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 || !/^[6-9]/.test(phoneDigits)) {
      showToast('Please enter a valid 10-digit mobile number starting with 6-9', 'warning');
      return;
    }
    if (hasPhysical) {
      if (
        !shippingInfo.addressLine1.trim() ||
        !shippingInfo.city.trim() ||
        !shippingInfo.state.trim() ||
        shippingInfo.pinCode.trim().length !== 6
      ) {
        showToast('Please complete shipping address details with a 6-digit PIN code for physical delivery', 'warning');
        return;
      }
    }

    // 2. Pre-Flight Cart Availability & Consistency Validation
    const preflight = validateAndReconcileCart(cart, books);
    if (!preflight.isValid || preflight.hasChanges) {
      reconcileCartWithCatalog();
      return;
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);
    try {
      const cartPayload = cart.map((item: any) => ({
        bookId: item.bookId || item.book?.id,
        addonIds: (item.selectedAddonIds && item.selectedAddonIds.length > 0)
          ? item.selectedAddonIds
          : [item.format || 'digital'],
        format: item.format || 'digital',
        quantity: item.quantity || 1,
      }));

      const orderData = await createCashfreeOrder({
        cart: cartPayload,
        couponCode: appliedCoupon,
        shippingInfo: {
          ...shippingInfo,
          deliveryOption,
        },
        deliveryOption,
      });

      // Synchronize UI with authoritative server-calculated order amount
      if (orderData.orderAmount !== undefined) {
        setServerPayableAmount(orderData.orderAmount);
        if (orderData.pricing) {
          setServerPricing(orderData.pricing);
        }
        if (orderData.orderAmount !== total) {
          showToast('Your order total has been updated to the confirmed server amount.', 'info');
        }
      }

      if (orderData.paymentSessionId) {
        const cashfree = await loadCashfreeSDK(
          orderData.environment || (orderData.isProd ? 'production' : 'sandbox')
        );
        if (cashfree && typeof cashfree.checkout === 'function') {
          await cashfree.checkout({
            paymentSessionId: orderData.paymentSessionId,
            redirectTarget: '_self',
          });
          return;
        }
        showToast('Cashfree SDK could not initialize.', 'warning');
      } else {
        showToast('Order creation failed. Please check details.', 'warning');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      const errMsg = String(err?.message || '');
      const isAvailabilityError =
        errMsg.toLowerCase().includes('no longer available') ||
        errMsg.toLowerCase().includes('inactive') ||
        errMsg.toLowerCase().includes('unknown add-on');

      if (isAvailabilityError) {
        // 1. Extract any specific unknown or inactive add-on ID
        const addonMatch =
          errMsg.match(/Unknown add-on ID "([^"]+)"/i) ||
          errMsg.match(/Add-on "([^"]+)" is inactive/i);
        const badAddonId = addonMatch ? addonMatch[1] : null;

        // 2. Fetch fresh catalog from server
        let freshBooks: Book[] | null = null;
        try {
          freshBooks = await refreshProductsFromCloud(true);
        } catch {}

        // 3. Immediately prune the invalid add-on if identified
        if (badAddonId) {
          pruneInvalidAddon(badAddonId);
          showToast(
            'The selected optional material is no longer available and was removed from your cart. Please review your updated order before proceeding.',
            'warning'
          );
        } else {
          const targetCatalog = (freshBooks && freshBooks.length > 0) ? freshBooks : books;
          const reconciliation = reconcileCartWithCatalog(targetCatalog);
          if (reconciliation.changed) {
            showToast('Your cart was updated to match current availability. Please review before proceeding.', 'info');
          } else {
            showToast('One of the items in your cart is currently unavailable. Please review your cart.', 'warning');
          }
        }
      } else {
        showToast(err.message || 'Error processing order. Please try again.', 'warning');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['DM_Sans',sans-serif] selection:bg-emerald-100 selection:text-emerald-900 flex flex-col">
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-20 flex items-center justify-between">
          {/* Back Button + Brand Logo */}
          <div className="flex items-center gap-2">
            <BackButton to="/cart" label="Cart" />
            <Link
              to="/"
              className="cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-2"
            >
              <XylemLogo />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-semibold text-slate-700">
            <Link to="/" className="hover:text-emerald-700 transition-colors">
              Home
            </Link>
            <Link to="/books?category=IELTS" className="hover:text-emerald-700 transition-colors">
              IELTS
            </Link>
            <Link to="/books?category=OET" className="hover:text-emerald-700 transition-colors">
              OET
            </Link>
            <Link to="/books?category=PTE" className="hover:text-emerald-700 transition-colors">
              PTE
            </Link>
            <Link to="/books?category=German" className="hover:text-emerald-700 transition-colors">
              German
            </Link>
            <Link to="/books" className="hover:text-emerald-700 transition-colors">
              Books
            </Link>
            <Link to="/about" className="hover:text-emerald-700 transition-colors">
              About
            </Link>
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              title="Search materials"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <Link
              to="/orders"
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              title="My Account"
              aria-label="Account"
            >
              <User className="w-5 h-5" />
            </Link>
            <Link
              to="/cart"
              className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              title="Shopping Cart"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-emerald-700 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf6f2] via-[#f2faf7] to-[#f8fafc] pt-6 sm:pt-10 pb-8 sm:pb-10 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center md:text-left md:mx-0 space-y-3 sm:space-y-4">


            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif] leading-tight">
              You’re Almost There!
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              Complete your payment securely with Cashfree. After payment, you will be redirected to the Aylem student portal to access your study materials.
            </p>
          </div>
        </div>
      </section>

      {/* 3. MAIN CHECKOUT SECTION */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* LEFT COLUMN: Order Summary Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-150">
              <h2 className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Order Summary
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Products & Add-ons List Block */}
            <div className="space-y-6">
              {cart.map((item, itemIdx) => {
                const liveBook = books.find((b) => b.id === (item.bookId || item.book?.id)) || item.book;
                const availableAddons = getSelectableAddons(liveBook);
                const baseDigitalPrice = Number(liveBook.prices?.digital?.price) || item.price;
                const baseDigitalOriginalPrice = Number(liveBook.prices?.digital?.originalPrice) || item.originalPrice || baseDigitalPrice;
                const coverImg = getProductImage(liveBook);

                return (
                  <div key={`${item.bookId}-${item.format}-${itemIdx}`} className="space-y-4">
                    {/* Main Product Row */}
                    <div className="flex items-start gap-4">
                      {/* Product Image */}
                      <div className="w-16 h-22 sm:w-20 sm:h-26 shrink-0 rounded-xl overflow-hidden shadow-xs border border-slate-100 bg-slate-50 flex items-center justify-center">
                        {coverImg ? (
                          <img
                            src={coverImg}
                            alt={liveBook.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <BookCover book={liveBook} size="sm" showShadow={false} />
                        )}
                      </div>

                      {/* Product Info & Controls */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug font-['Plus_Jakarta_Sans',sans-serif] line-clamp-2">
                          {item.book.title}
                        </h3>

                        <div className="mt-1">
                          <span className="inline-block text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                            {item.format === 'physical' ? 'Printed Book' : 'Instant Digital PDF'}
                          </span>
                        </div>

                        {/* Quantity Controls & Remove */}
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              disabled={item.quantity <= 1}
                              onClick={() => handleUpdateQuantity(itemIdx, -1)}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-white active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed text-xs font-bold"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => handleUpdateQuantity(itemIdx, 1)}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-white active:scale-95 transition-all cursor-pointer text-xs font-bold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${item.book.title} from cart`}
                            onClick={() => handleRemoveProduct(itemIdx)}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer py-1 px-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      {/* Base Product Price */}
                      <div className="text-right shrink-0">
                        <div className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                          ₹{baseDigitalPrice * item.quantity}
                        </div>
                        {baseDigitalOriginalPrice > baseDigitalPrice && (
                          <div className="text-xs text-slate-400 line-through">
                            ₹{baseDigitalOriginalPrice * item.quantity}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Optional Materials / Add-ons directly belonging to this product */}
                    {availableAddons.length > 0 && (
                      <div className="mt-3 pt-3.5 border-t border-slate-100 space-y-2.5">
                        <div className="text-xs font-bold text-slate-700">
                          Optional Materials (Add-ons)
                        </div>
                        <div className="space-y-2">
                          {availableAddons.map((addon) => {
                            const isChecked = item.selectedAddonIds?.includes(addon.id);
                            return (
                              <label
                                key={addon.id}
                                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-blue-50/40 border-blue-200'
                                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(isChecked)}
                                    onChange={() => toggleItemAddon(itemIdx, addon.id)}
                                    aria-label={`Select ${addon.name}`}
                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <div>
                                    <div className="text-xs sm:text-sm font-semibold text-slate-900">
                                      {addon.name}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {addon.description || addon.subtitle || 'Instant Digital PDF'}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-slate-900 shrink-0 ml-2">
                                  ₹{addon.price}
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => showToast('All available optional materials for this book are shown above.', 'info')}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 pt-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add another optional material</span>
                        </button>
                      </div>
                    )}

                    {/* Divider between products (only if another product follows) */}
                    {itemIdx < cart.length - 1 && (
                      <div className="pt-2 border-b border-slate-200/80" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Promo Code Box — Placed AFTER all products and add-ons */}
            <div className="pt-4 border-t border-slate-150">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Promo Code
                </label>
                <span className="text-[11px] text-slate-400">Apply coupon for discount</span>
              </div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200/90 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-emerald-900">{appliedCoupon} applied</span>
                      {couponDiscount > 0 && (
                        <span className="block text-[11px] text-emerald-700 font-medium">Discount: -₹{couponDiscount}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeCoupon();
                      setCouponFeedback(null);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputCoupon}
                      onChange={(e) => setInputCoupon(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                      placeholder="E.G. XYLEM20"
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold uppercase text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !inputCoupon.trim()}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center min-w-[72px]"
                    >
                      {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {couponFeedback && (
                    <p className={`text-xs font-medium ${couponFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {couponFeedback.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">₹{authoritativeSubtotal}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span>Discount</span>
                  {authoritativeDiscount > 0 && appliedCoupon && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {appliedCoupon}
                    </span>
                  )}
                </div>
                <span className={`font-semibold ${authoritativeDiscount > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  - ₹{authoritativeDiscount}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery</span>
                <span className="font-semibold text-emerald-600">
                  {hasPhysical ? (authoritativeDeliveryFee > 0 ? `₹${authoritativeDeliveryFee}` : 'FREE') : 'Portal Access'}
                </span>
              </div>
            </div>

            {/* Total Amount Highlight Box */}
            <div className="bg-[#eef9f5] border border-emerald-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <div className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Total Amount
                </div>
                {totalSavings > 0 && (
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                    You save ₹{totalSavings} ({discountPercent}% off)
                  </div>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                ₹{payableAmount}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Customer Details & Cashfree Payments Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 text-center flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Cashfree Logo (Centered on Desktop and Mobile) */}
              <div className="flex justify-center pt-1">
                <CashfreeLogo className="h-8 sm:h-9" />
              </div>

              {/* Customer Details Form */}
              <div className="text-left space-y-3 pt-3 pb-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Customer Information
                  </label>
                  <span className="text-[11px] text-slate-400">Required for order fulfillment</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={shippingInfo.fullName}
                    onChange={(e) => setShippingInfo((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={shippingInfo.email}
                      onChange={(e) => setShippingInfo((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="name@example.com"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Mobile Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      maxLength={10}
                      value={shippingInfo.phone}
                      onChange={(e) => setShippingInfo((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                      placeholder="10-digit mobile number"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {hasPhysical && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Delivery Address (Physical Print Edition)
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="addressLine1"
                        value={shippingInfo.addressLine1}
                        onChange={(e) => setShippingInfo((prev) => ({ ...prev, addressLine1: e.target.value }))}
                        placeholder="House/Flat number, Building, Street"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={shippingInfo.city}
                          onChange={(e) => setShippingInfo((prev) => ({ ...prev, city: e.target.value }))}
                          placeholder="City"
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          State <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="state"
                          value={shippingInfo.state}
                          onChange={(e) => setShippingInfo((prev) => ({ ...prev, state: e.target.value }))}
                          placeholder="State"
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          PIN Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="pinCode"
                          maxLength={6}
                          value={shippingInfo.pinCode}
                          onChange={(e) => setShippingInfo((prev) => ({ ...prev, pinCode: e.target.value.replace(/\D/g, '') }))}
                          placeholder="6 digits"
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippingInfo.saveAddress}
                      onChange={(e) => setShippingInfo((prev) => ({ ...prev, saveAddress: e.target.checked }))}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span>Save my contact information for future orders</span>
                  </label>
                </div>
              </div>

              {/* Your Purchase Includes Card (Desktop view) */}
              <div className="hidden lg:block bg-[#eef9f5] border border-emerald-100 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Your purchase includes</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 pl-6 list-none">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Redirects to student portal after payment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Access materials inside the student portal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Secure and encrypted payment</span>
                  </li>
                </ul>
              </div>

              {/* Descriptive Heading */}
              <div className="pt-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Secure Payment with Cashfree
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed mt-1">
                  Click below to proceed to Cashfree's secure payment checkout. You can pay via UPI, cards, netbanking, or wallets.
                </p>
              </div>

              {/* BIG EMERALD PROCEED TO PAYMENT BUTTON */}
              <div className="pt-1">
                <button
                  onClick={handleProceedToPayment}
                  disabled={isProcessing || !isCatalogReady || cartPreflight.hasChanges || !cartPreflight.isValid}
                  id="proceed-to-payment-btn"
                  className="w-full py-4 px-6 rounded-xl bg-[#00704a] hover:bg-[#005a3b] active:scale-[0.99] text-white text-base sm:text-lg font-bold shadow-lg shadow-emerald-900/15 transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Redirecting to Cashfree...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 text-white/90" />
                      <span>Proceed to Payment (₹{payableAmount})</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {/* Payment Methods Badges Row & Powered by Cashfree */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-black tracking-wider text-slate-800">UPI</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-black tracking-wider text-blue-800 italic">VISA</span>
                  <span className="flex items-center -space-x-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block opacity-90"></span>
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-400 inline-block opacity-90"></span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-bold text-slate-700">RuPay</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600">NETBANKING</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-600">Powered by Cashfree Payments</span> • India's most trusted payment gateway
                </div>
              </div>

              {/* Your Purchase Includes Card (Mobile view) */}
              <div className="block lg:hidden bg-[#eef9f5] border border-emerald-100 rounded-2xl p-4 text-left space-y-2 mt-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Your purchase includes</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 pl-6 list-none">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Redirects to student portal after payment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Access materials inside the student portal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Secure and encrypted payment</span>
                  </li>
                </ul>
              </div>

              {/* Bottom Security Card (Desktop view) */}
              <div className="hidden lg:flex bg-emerald-50/50 border border-emerald-100/80 rounded-2xl p-3.5 items-center gap-3 text-left mt-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Your data is 100% secure
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    We use industry-standard encryption to protect your information.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RELATED PRODUCTS SECTION — DESKTOP + MOBILE */}
        {relatedProducts.length > 0 && (
          <section className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80 space-y-5">
            {/* Header: Icon + Title/Subtitle + View All */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-500">
                    <path d="M4 6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" opacity="0.9" />
                    <path d="M11 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V4z" opacity="0.65" />
                    <path d="M18 7a2 2 0 0 1 2-2h1v14h-1a2 2 0 0 1-2-2V7z" opacity="0.4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    More {primaryCategory} Materials
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    <span className="hidden sm:inline">More preparation materials from the same category</span>
                    <span className="sm:hidden">Enhance your preparation with these recommended materials</span>
                  </p>
                </div>
              </div>

              <Link
                to={`/books?category=${primaryCategory}`}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full border border-slate-200 hover:border-emerald-300 text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-colors"
              >
                <span className="hidden sm:inline">View All {primaryCategory} Materials</span>
                <span className="sm:hidden">View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Desktop / Tablet Grid (screen width >= 768px) */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {relatedProducts.map((product) => {
                const isAdded = cartBookIds.has(product.id);
                const productImg = getProductImage(product);
                return (
                  <div
                    key={`desktop-rel-${product.id}`}
                    className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition-all duration-200 group"
                  >
                    <div>
                      {/* Product Cover Visual */}
                      {productImg ? (
                        <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/80 group-hover:scale-[1.01] transition-transform">
                          <img
                            src={productImg}
                            alt={product.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/30 via-white/10 to-transparent pointer-events-none" />
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[8px] font-extrabold text-white uppercase tracking-wider">
                            {product.category}
                          </span>
                          {product.coverTheme?.badgeText && (
                            <div className="absolute bottom-2 inset-x-0 flex justify-center">
                              <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white border border-white/20 tracking-wider uppercase">
                                {product.coverTheme.badgeText}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-b ${product.coverTheme?.bgGradient || 'from-slate-900 to-slate-800'} p-3.5 flex flex-col justify-between shadow-xs border border-black/10 group-hover:scale-[1.01] transition-transform`}>
                          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
                          <div className="flex items-center justify-between text-[9px] font-bold text-white/80 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              XYLEM
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white/15 text-[8px] font-extrabold text-white">
                              {product.category}
                            </span>
                          </div>
                          <div className="text-center my-auto px-1 space-y-1">
                            <div
                              className="text-xs sm:text-sm font-black tracking-tight uppercase leading-tight"
                              style={{ color: product.coverTheme?.accentColor || '#ffffff' }}
                            >
                              {product.title}
                            </div>
                            {product.subtitle && (
                              <div className="text-[9px] text-white/75 font-medium line-clamp-2 leading-tight">
                                {product.subtitle}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-center">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-xs tracking-wider uppercase">
                              {product.coverTheme?.badgeText || 'OFFICIAL PREP'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Product Name */}
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug font-['Plus_Jakarta_Sans',sans-serif] line-clamp-1 mt-3">
                        {product.title}
                      </h4>

                      {/* Instant Digital PDF Badge */}
                      <div className="mt-1">
                        <span className="inline-block text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                          Instant Digital PDF
                        </span>
                      </div>

                      {/* Pricing Row */}
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-sm sm:text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                          ₹{product.prices.digital.price}
                        </span>
                        {product.prices.digital.originalPrice > product.prices.digital.price && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{product.prices.digital.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Button */}
                    <div className="pt-3">
                      {isAdded ? (
                        <button
                          type="button"
                          disabled
                          aria-label={`${product.title} already added to order`}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-default transition-all"
                        >
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Added</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddRelatedProduct(product)}
                          aria-label={`Add ${product.title} to cart`}
                          className="w-full py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-emerald-500/80 text-emerald-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Carousel (screen width < 768px) */}
            <div className="md:hidden">
              <div
                ref={mobileCarouselRef}
                onScroll={handleCarouselScroll}
                className="flex overflow-x-auto gap-3.5 pb-2 scrollbar-none snap-x snap-mandatory -mx-1 px-1"
              >
                {relatedProducts.map((product) => {
                  const isAdded = cartBookIds.has(product.id);
                  const productImg = getProductImage(product);
                  return (
                    <div
                      key={`mobile-rel-${product.id}`}
                      className="w-[200px] min-w-[200px] xs:w-[220px] xs:min-w-[220px] shrink-0 snap-start bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col justify-between"
                    >
                      <div>
                        {/* Cover */}
                        {productImg ? (
                          <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/80">
                            <img
                              src={productImg}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/30 via-white/10 to-transparent pointer-events-none" />
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[8px] font-extrabold text-white uppercase tracking-wider">
                              {product.category}
                            </span>
                            {product.coverTheme?.badgeText && (
                              <div className="absolute bottom-2 inset-x-0 flex justify-center">
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white border border-white/20 tracking-wider uppercase">
                                  {product.coverTheme.badgeText}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-b ${product.coverTheme?.bgGradient || 'from-slate-900 to-slate-800'} p-3 flex flex-col justify-between shadow-xs border border-black/10`}>
                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
                            <div className="flex items-center justify-between text-[8px] font-bold text-white/80 uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                XYLEM
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-white/15 text-[8px] font-extrabold text-white">
                                {product.category}
                              </span>
                            </div>
                            <div className="text-center my-auto px-1 space-y-1">
                              <div
                                className="text-xs font-black tracking-tight uppercase leading-tight"
                                style={{ color: product.coverTheme?.accentColor || '#ffffff' }}
                              >
                                {product.title}
                              </div>
                              {product.subtitle && (
                                <div className="text-[8px] text-white/75 font-medium line-clamp-2 leading-tight">
                                  {product.subtitle}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-center">
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-xs tracking-wider uppercase">
                                {product.coverTheme?.badgeText || 'OFFICIAL PREP'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Title */}
                        <h4 className="text-xs font-bold text-slate-900 leading-snug font-['Plus_Jakarta_Sans',sans-serif] line-clamp-1 mt-2.5">
                          {product.title}
                        </h4>

                        {/* Badge */}
                        <div className="mt-1">
                          <span className="inline-block text-[10px] font-medium text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">
                            Instant Digital PDF
                          </span>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mt-1.5">
                          <span className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                            ₹{product.prices.digital.price}
                          </span>
                          {product.prices.digital.originalPrice > product.prices.digital.price && (
                            <span className="text-[11px] text-slate-400 line-through">
                              ₹{product.prices.digital.originalPrice}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-2.5">
                        {isAdded ? (
                          <button
                            type="button"
                            disabled
                            aria-label={`${product.title} already added to order`}
                            className="w-full py-2 px-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1 cursor-default transition-all"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Added</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddRelatedProduct(product)}
                            aria-label={`Add ${product.title} to cart`}
                            className="w-full py-2 px-2.5 rounded-xl bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-emerald-500/80 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dot Indicators */}
              <div className="flex justify-center items-center gap-2 pt-3">
                {relatedProducts.map((_, dotIdx) => (
                  <button
                    key={`dot-${dotIdx}`}
                    type="button"
                    onClick={() => {
                      if (mobileCarouselRef.current) {
                        const cardWidth = 210;
                        mobileCarouselRef.current.scrollTo({ left: dotIdx * cardWidth, behavior: 'smooth' });
                        setActiveCarouselDot(dotIdx);
                      }
                    }}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      activeCarouselDot === dotIdx ? 'w-5 bg-emerald-600' : 'w-1.5 bg-slate-300'
                    }`}
                    aria-label={`Go to slide ${dotIdx + 1}`}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4. SHOP WITH CONFIDENCE TRUST BAR */}
        <section className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3.5 text-left w-full lg:w-auto">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Shop with Confidence
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your data and payments are always protected with industry-leading security standards.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 w-full lg:w-auto text-center">
              <div className="flex flex-col items-center">
                <Check className="w-4 h-4 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-slate-800">RBI Licensed</span>
                <span className="text-[10px] text-slate-500">Payment Aggregator</span>
              </div>
              <div className="flex flex-col items-center">
                <Zap className="w-4 h-4 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-slate-800">Portal Access</span>
                <span className="text-[10px] text-slate-500">Student portal</span>
              </div>
              <div className="flex flex-col items-center">
                <Shield className="w-4 h-4 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-slate-800">Fraud Protected</span>
                <span className="text-[10px] text-slate-500">Real-time Defense</span>
              </div>
              <div className="flex flex-col items-center">
                <Headphones className="w-4 h-4 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-slate-800">24/7 Support</span>
                <span className="text-[10px] text-slate-500">Dedicated Help</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2025 Aylem Learning. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => showToast('All customer information is encrypted & never shared.')}
              className="hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => showToast('Terms: After payment, access your materials through the student portal.')}
              className="hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              onClick={() => showToast('Refunds: 100% money back guarantee if study materials differ from format.')}
              className="hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Refund Policy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
