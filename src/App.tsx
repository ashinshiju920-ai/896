/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ShopProvider, useShop } from './context/ShopContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SearchModal } from './components/SearchModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { ContactModal } from './components/ContactModal';

// Views
import { HomeView } from './views/HomeView';
import { CatalogView } from './views/CatalogView';
import { ProductDetailView } from './views/ProductDetailView';
import { CartView } from './views/CartView';
import { CheckoutView } from './views/CheckoutView';
import { OrderSuccessView } from './views/OrderSuccessView';
import { OrdersHistoryView } from './views/OrdersHistoryView';
import { MyMaterialsView } from './views/MyMaterialsView';
import { CustomerLoginView } from './views/CustomerLoginView';
import { CustomerAccountView } from './views/CustomerAccountView';
import { AboutView } from './views/AboutView';
const AdminView = React.lazy(() => import('./views/AdminView'));
import { NotFoundView } from './views/NotFoundView';
import { checkOrderStatus } from './utils/cashfree';
import { Order } from './types';
import { BOOKS } from './data/books';

const ShopApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    books,
    shippingInfo,
    clearCart,
    setCurrentOrder,
    showToast,
    toasts,
  } = useShop();

  // Handle Cashfree return: verify payment server-side before unlocking order
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id') || params.get('orderId');
    const cfStatus = params.get('cf_status') || params.get('status');

    if (orderId) {
      checkOrderStatus(orderId)
        .then((res) => {
          if (res && res.status === 'PAID') {
            clearCart();
            const verifiedOrder: Order = {
              id: res.orderId || orderId,
              date: res.date
                ? new Date(res.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
              items: (res.items || []).map((it: any) => {
                const bookId = it.bookId || it.id;
                const bookObj =
                  books.find((b) => b.id === bookId) ||
                  BOOKS.find((b) => b.id === bookId) ||
                  BOOKS[0];
                return {
                  bookId,
                  book: bookObj,
                  format: (it.format === 'physical' ? 'physical' : 'digital') as 'digital' | 'physical',
                  quantity: it.quantity || 1,
                  price: it.unitPrice || (it.format === 'physical' ? 999 : 199),
                };
              }),
              shipping: {
                ...shippingInfo,
                fullName: res.customerName || shippingInfo.fullName,
                email: res.customerEmail || shippingInfo.email,
              },
              subtotal: res.total || 199,
              discount: 0,
              deliveryFee: 0,
              total: res.total || 199,
              paymentMethod: 'upi',
              status: 'PAID',
              fulfillment: res.fulfillment ? {
                ...res.fulfillment,
                materials: res.materials || res.fulfillment.materials,
              } : null,
            };
            setCurrentOrder(verifiedOrder);
            navigate('/order-success', { replace: true });
            showToast('Payment confirmed! Your study materials are unlocked.', 'success');
          } else {
            showToast('Payment verification pending or order unpaid.', 'warning');
          }
        })
        .catch(() => {
          showToast('Could not verify payment status with server.', 'warning');
        });
    } else if (cfStatus) {
      // Visiting /?cf_status=success without real payment unlocks nothing!
      showToast('No verified order found. Payment verification required.', 'warning');
      navigate(location.pathname, { replace: true });
    }
  }, [books, navigate]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const isStorefront = !location.pathname.startsWith('/checkout') && !location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] text-slate-900 font-['DM_Sans',sans-serif] selection:bg-emerald-100 selection:text-emerald-900 relative">
      {/* Top Header Navigation */}
      {isStorefront && <Header />}

      {/* Main View Router */}
      <main className="flex-1">
        <Routes>
          {/* Public customer-facing routes */}
          <Route path="/" element={<HomeView />} />
          <Route path="/books" element={<CatalogView />} />
          <Route path="/books/:slug" element={<ProductDetailView />} />
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/product" element={<ProductDetailView />} />
          <Route path="/product/:slug" element={<ProductDetailView />} />
          <Route path="/cart" element={<CartView />} />
          <Route path="/checkout" element={<CheckoutView />} />
          <Route path="/order-success" element={<OrderSuccessView />} />
          <Route path="/my-materials" element={<MyMaterialsView initialTab="materials" />} />
          <Route path="/orders" element={<MyMaterialsView initialTab="orders" />} />
          <Route path="/login" element={<CustomerLoginView />} />
          <Route path="/account" element={<CustomerAccountView />} />
          <Route path="/about" element={<AboutView />} />

          {/* Admin routes (code-split and lazy-loaded) */}
          <Route
            path="/admin/*"
            element={
              <React.Suspense
                fallback={
                  <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                      <p className="text-slate-400 font-mono text-xs tracking-wider uppercase">Loading Admin Console...</p>
                    </div>
                  </div>
                }
              >
                <AdminView />
              </React.Suspense>
            }
          />

          {/* 404 Catch-all */}
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </main>

      {/* Footer */}
      {isStorefront && <Footer />}

      {/* Global Modals & Drawers */}
      <CartDrawer />
      <SearchModal />
      <PdfViewerModal />
      <ContactModal />

      {/* Toast Notifications */}
      {toasts && toasts.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 flex flex-col gap-2 pointer-events-none sm:max-w-sm sm:w-auto w-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all animate-in fade-in slide-in-from-bottom-2 ${
                t.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : t.type === 'info'
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-emerald-900 border-emerald-700 text-emerald-50'
              }`}
            >
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ShopProvider>
      <ShopApp />
    </ShopProvider>
  );
}
