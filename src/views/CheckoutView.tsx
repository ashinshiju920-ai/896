import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  Zap,
  Star,
  Check,
  ArrowRight,
  Shield,
  Headphones,
  Search,
  User,
  ShoppingBag,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { XylemLogo } from '../components/XylemLogo';
import { CashfreeLogo } from '../components/CashfreeLogo';
import { BookCover } from '../components/BookCover';
import { createCashfreeOrder, loadCashfreeSDK } from '../utils/cashfree';

export const CheckoutView: React.FC = () => {
  const {
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
    shippingInfo,
    setShippingInfo,
    showToast,
  } = useShop();

  const [isProcessing, setIsProcessing] = useState(false);

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

  const totalOriginalPrice = cart.reduce(
    (sum, item) => sum + ((item.originalPrice || item.price) * item.quantity),
    0
  );
  const displayDiscount = Math.max(0, totalOriginalPrice - total);
  const discountPercent = totalOriginalPrice > 0
    ? Math.round((displayDiscount / totalOriginalPrice) * 100)
    : 0;

  // Server-authoritative checkout sending intent only
  const handleProceedToPayment = async () => {
    // Validate customer info
    if (!shippingInfo.fullName.trim()) {
      showToast('Please enter your full name', 'warning');
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

    setIsProcessing(true);
    try {
      const cartPayload = cart.map((item: any) => ({
        bookId: item.bookId || item.book?.id,
        addonIds: item.selectedAddonIds || [item.format || 'digital'],
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
      showToast(err.message || 'Error processing order. Please try again.', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['DM_Sans',sans-serif] selection:bg-emerald-100 selection:text-emerald-900 flex flex-col">
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            to="/"
            className="cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-2"
          >
            <XylemLogo />
          </Link>

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
          <div className="flex items-center gap-3 sm:gap-4">
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
              Complete your payment securely with Cashfree and get instant access to your study materials.
            </p>
          </div>
        </div>
      </section>

      {/* 3. MAIN CHECKOUT SECTION */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* LEFT COLUMN: Order Summary Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Order Summary
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Products List Block */}
            <div className="space-y-4 pb-6 border-b border-slate-100 max-h-96 overflow-y-auto pr-1">
              {cart.map((item, idx) => (
                <div key={`${item.bookId}-${item.format}-${idx}`} className="flex items-start gap-4">
                  <div className="w-16 h-22 shrink-0 rounded-xl overflow-hidden shadow-xs border border-slate-100 bg-slate-50 flex items-center justify-center">
                    {item.book.coverImage ? (
                      <img
                        src={item.book.coverImage}
                        alt={item.book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookCover book={item.book} size="sm" showShadow={false} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug font-['Plus_Jakarta_Sans',sans-serif] line-clamp-1">
                      {item.book.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {item.format === 'physical' ? 'Printed Book' : 'Instant Digital PDF'}
                      </span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                      ₹{item.price * item.quantity}
                    </div>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="text-[11px] text-slate-400 line-through">
                        ₹{item.originalPrice * item.quantity}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">₹{subtotal}</span>
              </div>

              {displayDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700 font-medium">Discount Applied</span>
                    <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200/80 uppercase">
                      OFFER SAVINGS
                    </span>
                  </div>
                  <span className="font-bold text-emerald-600">- ₹{displayDiscount}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery</span>
                <span className="font-semibold text-emerald-600">
                  {hasPhysical ? (deliveryFee > 0 ? `₹${deliveryFee}` : 'FREE') : 'FREE (Instant Download)'}
                </span>
              </div>
            </div>

            {/* Total Amount Highlight Box */}
            <div className="bg-[#eef9f5] border border-emerald-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <div className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Total Amount
                </div>
                {displayDiscount > 0 && (
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                    You save ₹{displayDiscount} ({discountPercent}% off)
                  </div>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                ₹{total}
              </div>
            </div>

            {/* Security Assurance Banner */}
            <div className="bg-emerald-50/50 border border-emerald-100/80 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">
                  Your purchase is 100% secure
                </div>
                <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  We use industry-standard encryption to protect your data and payments.
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Customer Details & Cashfree Payments Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 text-center flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Cashfree Logo */}
              <div className="flex justify-center pt-2">
                <CashfreeLogo className="h-10" />
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

              {/* Descriptive Heading */}
              <div className="pt-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Secure Payment with Cashfree
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed mt-1">
                  Click below to proceed to Cashfree's secure payment checkout. You can pay via UPI, cards, netbanking, or wallets.
                </p>
              </div>

              {/* BIG EMERALD PROCEED TO PAYMENT BUTTON */}
              <div className="pt-2">
                <button
                  onClick={handleProceedToPayment}
                  disabled={isProcessing}
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
                      <span>Proceed to Payment (₹{total})</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>


            </div>

            {/* Powered by Cashfree Footer Pill */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-center gap-2 text-xs text-slate-600 mt-4">
              <span className="font-bold text-slate-800">Powered by Cashfree Payments</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">India's most trusted payment gateway</span>
            </div>
          </div>
        </div>

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
                <span className="text-xs font-bold text-slate-800">Instant Access</span>
                <span className="text-[10px] text-slate-500">Direct Download</span>
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
          <div>© 2025 Xylem Learning. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => showToast('All customer information is encrypted & never shared.')}
              className="hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => showToast('Terms: Instant digital delivery upon payment confirmation.')}
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
