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
import { WhatsAppButton } from './components/WhatsAppButton';
import { ProgressiveLoader } from './components/ProgressiveLoader';

// Views
import { HomeView } from './views/HomeView';
const CatalogView = React.lazy(() => import('./views/CatalogView').then((m) => ({ default: m.CatalogView })));
const ProductDetailView = React.lazy(() => import('./views/ProductDetailView').then((m) => ({ default: m.ProductDetailView })));
const CartView = React.lazy(() => import('./views/CartView').then((m) => ({ default: m.CartView })));
const CheckoutView = React.lazy(() => import('./views/CheckoutView').then((m) => ({ default: m.CheckoutView })));
const OrderSuccessView = React.lazy(() => import('./views/OrderSuccessView').then((m) => ({ default: m.OrderSuccessView })));
const MyMaterialsView = React.lazy(() => import('./views/MyMaterialsView').then((m) => ({ default: m.MyMaterialsView })));
const CustomerLoginView = React.lazy(() => import('./views/CustomerLoginView').then((m) => ({ default: m.CustomerLoginView })));
const CustomerAccountView = React.lazy(() => import('./views/CustomerAccountView').then((m) => ({ default: m.CustomerAccountView })));
const AboutView = React.lazy(() => import('./views/AboutView').then((m) => ({ default: m.AboutView })));
const PrivacyPolicyView = React.lazy(() => import('./views/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView })));
const TermsConditionsView = React.lazy(() => import('./views/TermsConditionsView').then((m) => ({ default: m.TermsConditionsView })));
const ShippingReturnsRefundPolicyView = React.lazy(() =>
  import('./views/ShippingReturnsRefundPolicyView').then((m) => ({ default: m.ShippingReturnsRefundPolicyView }))
);
const AdminView = React.lazy(() => import('./views/AdminView'));
const NotFoundView = React.lazy(() => import('./views/NotFoundView').then((m) => ({ default: m.NotFoundView })));
import { checkOrderStatus, STUDENT_PORTAL_URL } from './utils/cashfree';
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
    if (location.pathname.startsWith('/order-success')) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id') || params.get('orderId');
    const cfStatus = (params.get('cf_status') || params.get('status') || params.get('order_status') || '').toUpperCase();

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
              fulfillment: null,
            };
            setCurrentOrder(verifiedOrder);
            showToast('Payment confirmed! Redirecting to the student portal.', 'success');
            window.location.replace(STUDENT_PORTAL_URL);
          } else if (res && (res.status === 'FAILED' || res.status === 'USER_DROPPED')) {
            showToast('Payment was not completed. Please try again from checkout.', 'warning');
            navigate(`/checkout?payment=${res.status === 'FAILED' ? 'failed' : 'cancelled'}&order_id=${encodeURIComponent(orderId)}`, { replace: true });
          } else {
            showToast('Payment verification pending or order unpaid.', 'warning');
          }
        })
        .catch(() => {
          showToast('Could not verify payment status with server.', 'warning');
        });
    } else if (['FAILED', 'CANCELLED', 'CANCELED', 'USER_DROPPED', 'DROPPED'].includes(cfStatus)) {
      showToast('Payment was not completed. Please try again from checkout.', 'warning');
      navigate('/checkout?payment=failed', { replace: true });
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
        <React.Suspense
          fallback={<ProgressiveLoader label="Loading page" />}
        >
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
            <Route path="/privacy-policy" element={<PrivacyPolicyView />} />
            <Route path="/terms-and-conditions" element={<TermsConditionsView />} />
            <Route path="/shipping-returns-refund-policy" element={<ShippingReturnsRefundPolicyView />} />

            {/* Admin routes (code-split and lazy-loaded) */}
            <Route
              path="/admin/*"
              element={
                <React.Suspense
                  fallback={<ProgressiveLoader label="Loading admin console" fullscreen dark />}
                >
                  <AdminView />
                </React.Suspense>
              }
            />

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </React.Suspense>
      </main>

      {/* Footer */}
      {isStorefront && <Footer />}

      {/* Floating WhatsApp Quick Contact */}
      {isStorefront && <WhatsAppButton />}

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
