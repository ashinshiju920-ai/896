import React from 'react';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BookCover } from '../components/BookCover';
import { BOOKS } from '../data/books';

export const CartView: React.FC = () => {
  const {
    cart,
    updateCartQty,
    removeFromCart,
    subtotal,
    deliveryFee,
    total,
    setCurrentView,
    setCheckoutStep,
    navigateToProduct,
    addToCart,
  } = useShop();

  const handleCheckout = () => {
    setCheckoutStep(1);
    setCurrentView('checkout');
  };

  const recommendations = BOOKS.slice(2, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            Your Cart
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review your digital and physical study materials.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('catalog')}
          className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          <span>Continue Shopping</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {cart.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Cart Items List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
              {cart.map((item, idx) => {
                const itemKey = `${item.bookId}-${
                  item.selectedAddonIds ? item.selectedAddonIds.slice().sort().join('-') : item.format
                }-${idx}`;

                return (
                  <div
                    key={itemKey}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        onClick={() => navigateToProduct(item.bookId)}
                        className="cursor-pointer shrink-0"
                      >
                        <BookCover book={item.book} size="sm" showShadow={false} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <h3
                          onClick={() => navigateToProduct(item.bookId)}
                          className="text-sm sm:text-base font-semibold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] hover:text-emerald-700 cursor-pointer truncate"
                        >
                          {item.book.title}
                        </h3>

                        {item.selectedAddons && item.selectedAddons.length > 0 ? (
                          <div className="space-y-1 pt-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.selectedAddons.map((addon) => {
                                const isFree =
                                  item.freeAddonDiscount &&
                                  item.freeAddonDiscount > 0 &&
                                  addon.price === item.freeAddonDiscount;
                                return (
                                  <span
                                    key={addon.id}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                      isFree
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {addon.name} {isFree ? '• FREE (₹0)' : `• ₹${addon.price}`}
                                  </span>
                                );
                              })}
                            </div>
                            {item.freeAddonDiscount && item.freeAddonDiscount > 0 && (
                              <div className="text-[10px] font-bold text-emerald-700">
                                🎁 "Buy 2 Get 3rd Free" Applied: Saved ₹
                                {item.freeAddonDiscount * item.quantity}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                item.format === 'digital'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.format === 'digital' ? 'Digital (PDF eBook)' : 'Paperback Printed'}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500 font-medium">
                              {item.book.category}
                            </span>
                          </div>
                        )}

                        <div className="text-sm font-bold text-slate-900 pt-1">
                          ₹{item.price}
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Delete */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <button
                          onClick={() => updateCartQty(item.bookId, item.format, -1, item.selectedAddonIds)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQty(item.bookId, item.format, 1, item.selectedAddonIds)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-sm font-bold text-slate-900 min-w-[70px] text-right">
                        ₹{item.price * item.quantity}
                      </div>

                      <button
                        onClick={() => removeFromCart(item.bookId, item.format, item.selectedAddonIds)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note regarding digital downloads */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                Digital PDFs are accessible immediately upon successful payment confirmation.
              </span>
            </div>
          </div>

          {/* Order Summary (4 cols) from Image 4 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] pb-3 border-b border-slate-100">
                Order Summary
              </h2>

              <div className="space-y-2.5 text-xs text-slate-600 font-['DM_Sans',sans-serif]">
                <div className="flex justify-between">
                  <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span className="font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">₹{subtotal}</span>
                </div>

                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-semibold text-emerald-600">
                    {deliveryFee > 0 ? `₹${deliveryFee}` : 'FREE'}
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    ₹{total}
                  </span>
                </div>
              </div>

              <button
                id="proceed-to-checkout-btn"
                onClick={handleCheckout}
                className="w-full py-3.5 px-4 rounded-xl bg-[#00875a] hover:bg-[#00734c] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Your information is safe and secure</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Your cart is currently empty</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Browse our top-rated IELTS, OET, PTE, and German preparation books and start studying today.
          </p>
          <button
            onClick={() => setCurrentView('catalog')}
            className="px-6 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-semibold rounded-xl"
          >
            Explore Study Materials
          </button>
        </div>
      )}

      {/* You May Also Like Row (Image 4 bottom-left) */}
      <div className="pt-6 border-t border-slate-200">
        <h3 className="text-base font-bold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] mb-4">
          You May Also Like
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {recommendations.map((book) => (
            <div
              key={book.id}
              onClick={() => navigateToProduct(book.id)}
              className="bg-white p-3 rounded-xl border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex justify-center pb-2">
                <BookCover book={book} size="sm" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700">
                {book.title}
              </h4>
              <div className="text-xs font-bold text-slate-900 mt-1">
                ₹{book.prices.digital.price}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(book, 'digital');
                }}
                className="mt-2 w-full py-1 bg-[#00875a] hover:bg-[#00734c] text-white text-[10px] font-semibold rounded-md"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
