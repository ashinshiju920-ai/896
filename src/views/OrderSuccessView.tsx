import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  DownloadCloud,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Package,
  ExternalLink,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BookCover } from '../components/BookCover';
import { checkOrderStatus, OrderStatusResponse, STUDENT_PORTAL_URL } from '../utils/cashfree';
import { Order } from '../types';
import { BOOKS } from '../data/books';

export const OrderSuccessView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    currentOrder,
    setCurrentOrder,
    setCurrentView,
    openPdfViewer,
    showToast,
    books,
    shippingInfo,
    currentCustomer,
    setCurrentCustomer,
  } = useShop();

  const urlOrderId = (searchParams.get('order_id') || searchParams.get('orderId') || '').trim();
  const gatewayReturnStatus = (
    searchParams.get('order_status') ||
    searchParams.get('payment_status') ||
    searchParams.get('cf_status') ||
    searchParams.get('status') ||
    ''
  ).toUpperCase();

  // Local verification states
  const [orderStatus, setOrderStatus] = useState<'IDLE' | 'LOADING' | 'PENDING' | 'PAID' | 'FAILED' | 'USER_DROPPED' | 'NOT_FOUND'>('IDLE');
  const [verifiedData, setVerifiedData] = useState<OrderStatusResponse | null>(null);
  const [pollCount, setPollCount] = useState<number>(0);
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Post-payment Account Activation State (Phase 7)
  const [actName, setActName] = useState<string>('');
  const [actPassword, setActPassword] = useState<string>('');
  const [actConfirmPassword, setActConfirmPassword] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activationSuccess, setActivationSuccess] = useState<boolean>(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState<boolean>(false);

  const pollTimerRef = useRef<any>(null);

  // Populate activation name from order if empty
  useEffect(() => {
    if (currentOrder?.shipping?.fullName && !actName) {
      setActName(currentOrder.shipping.fullName);
    }
  }, [currentOrder?.shipping?.fullName, actName]);

  // Handle post-payment account activation
  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder) return;

    if (!actPassword || actPassword.length < 8) {
      setActivationError('Password must be at least 8 characters long.');
      return;
    }
    if (actPassword !== actConfirmPassword) {
      setActivationError('Passwords do not match.');
      return;
    }

    setIsActivating(true);
    setActivationError(null);

    try {
      const res = await fetch('/api/customer/activate-after-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrder.id,
          name: actName || currentOrder.shipping.fullName || 'Student',
          password: actPassword,
          confirmPassword: actConfirmPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActivationSuccess(true);
        if (data.customer) {
          setCurrentCustomer(data.customer);
        }
        showToast('Account created! Your verified purchase is now linked.', 'success');
      } else {
        if (res.status === 409 && data.accountExists) {
          setAccountExists(true);
        }
        setActivationError(data.error || 'Failed to activate account.');
      }
    } catch {
      setActivationError('Network error connecting to server. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  // Core verification function against backend
  const verifyOrder = useCallback(
    async (orderIdToVerify: string, isManual = false) => {
      if (!orderIdToVerify) return;

      if (isManual) setIsManualChecking(true);

      try {
        const res = await checkOrderStatus(orderIdToVerify);
        setVerifiedData(res);

        if (res.status === 'PAID') {
          setOrderStatus('PAID');
          // Reconstruct and persist verified order into session & history
          const reconstructedOrder: Order = {
            id: res.orderId || orderIdToVerify,
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
              const bookId = it.productId || it.bookId || it.id;
              const bookObj =
                (books || []).find((b) => b.id === bookId) ||
                BOOKS.find((b) => b.id === bookId) ||
                BOOKS[0];
              return {
                bookId,
                book: bookObj,
                format: (it.format === 'physical' ? 'physical' : 'digital') as 'digital' | 'physical',
                quantity: it.quantity || 1,
                price: it.unitPrice || (it.format === 'physical' ? 999 : 199),
                productNameSnapshot: it.productNameSnapshot || bookObj?.title,
                addOns: it.addOns || [],
              };
            }),
            shipping: {
              ...shippingInfo,
              fullName: res.customerName || shippingInfo.fullName || 'Student',
              email: res.customerEmail || shippingInfo.email || '',
            },
            subtotal: res.total || 199,
            discount: 0,
            deliveryFee: 0,
            total: res.total || 199,
            paymentMethod: 'upi',
            status: 'PAID',
            fulfillment: null,
          };

          setCurrentOrder(reconstructedOrder);
          showToast('Payment verified. Redirecting to the student portal.', 'success');
          window.location.replace(STUDENT_PORTAL_URL);
        } else if (res.status === 'PENDING') {
          setOrderStatus('PENDING');
          if (isManual) {
            showToast('Payment is still being processed. Please check back shortly.', 'info');
          }
        } else if (res.status === 'FAILED') {
          setOrderStatus('FAILED');
          showToast('Payment failed. Please try again from checkout.', 'warning');
          navigate(`/checkout?payment=failed&order_id=${encodeURIComponent(orderIdToVerify)}`, { replace: true });
        } else if (res.status === 'USER_DROPPED') {
          setOrderStatus('USER_DROPPED');
          showToast('Payment was not completed. Please try again from checkout.', 'warning');
          navigate(`/checkout?payment=cancelled&order_id=${encodeURIComponent(orderIdToVerify)}`, { replace: true });
        } else {
          setOrderStatus('NOT_FOUND');
        }
      } catch {
        setOrderStatus('PENDING');
      } finally {
        if (isManual) setIsManualChecking(false);
      }
    },
    [books, navigate, setCurrentOrder, shippingInfo, showToast]
  );

  // Initialize verification on mount or URL change
  useEffect(() => {
    const targetId = urlOrderId || currentOrder?.id;

    if (['FAILED', 'CANCELLED', 'CANCELED', 'USER_DROPPED', 'DROPPED'].includes(gatewayReturnStatus)) {
      showToast('Payment was not completed. Please try again from checkout.', 'warning');
      navigate(`/checkout?payment=failed${targetId ? `&order_id=${encodeURIComponent(targetId)}` : ''}`, { replace: true });
      return;
    }

    if (!targetId) {
      if (!currentOrder || currentOrder.status !== 'PAID') {
        setOrderStatus('NOT_FOUND');
      } else {
        setOrderStatus('PAID');
      }
      return;
    }

    setOrderStatus('LOADING');
    verifyOrder(targetId);
  }, [urlOrderId, currentOrder?.id, verifyOrder, gatewayReturnStatus, navigate, showToast]);

  // Controlled polling with backoff for PENDING status (max 5 attempts, ~15 seconds total)
  useEffect(() => {
    if (orderStatus === 'PENDING' && pollCount < 5) {
      const targetId = urlOrderId || currentOrder?.id;
      if (targetId) {
        pollTimerRef.current = setTimeout(() => {
          setPollCount((prev) => prev + 1);
          verifyOrder(targetId);
        }, 3000);
      }
    }

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [orderStatus, pollCount, urlOrderId, currentOrder?.id, verifyOrder]);

  // Protected download handler with automatic token renewal on expiry (403)
  const handleDownload = async (
    url: string,
    title: string,
    orderId?: string,
    entitlementId?: string
  ) => {
    try {
      const activeId = entitlementId || title;
      setDownloadingId(activeId);
      showToast(`Preparing your download for ${title}...`, 'info');

      let targetUrl = url;

      // 1. Initial attempt with provided URL
      let res = await fetch(targetUrl);

      // 2. If 403 (token expired or stale), request fresh server authorization
      if (res.status === 403 && orderId) {
        const freshStatus = await checkOrderStatus(orderId);
        if (freshStatus && freshStatus.status === 'PAID') {
          const freshMat = freshStatus.materials?.find(
            (m) => m.entitlementId === entitlementId || m.name === title
          );
          if (freshMat?.downloadUrl) {
            targetUrl = freshMat.downloadUrl;
            res = await fetch(targetUrl);
          }
        }
      }

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/pdf')) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          showToast(`Downloaded "${title}"! Check your downloads folder.`, 'success');
          return;
        }
      }

      let errMsg = 'Material temporarily unavailable. Please try again later.';
      if (res.status === 403) {
        errMsg = 'Your access could not be verified. Please refresh and try again.';
      } else {
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch {}
      }
      showToast(errMsg, 'warning');
    } catch {
      showToast('Material temporarily unavailable. Please try again later.', 'warning');
    } finally {
      setDownloadingId(null);
    }
  };

  // 1. LOADING STATE
  if (orderStatus === 'LOADING') {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">
          Verifying your order...
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Connecting to secure server to confirm payment status and authorization tokens.
        </p>
      </div>
    );
  }

  // 2. PENDING STATE (Section 20 & 21)
  if (orderStatus === 'PENDING') {
    const targetId = urlOrderId || currentOrder?.id || 'Unknown';
    const isExhausted = pollCount >= 5;

    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto ring-8 ring-amber-50">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            Payment Verification
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            We're confirming your payment.
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {isExhausted
              ? 'Payment verification is taking longer than expected. Your order is safely recorded and can be checked again.'
              : 'This usually takes a few seconds while the bank confirms the transaction.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-xs font-mono text-slate-700">
          <span>Order ID: <strong>#{targetId}</strong></span>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => verifyOrder(targetId, true)}
            disabled={isManualChecking}
            className="w-full sm:w-auto px-6 py-3 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isManualChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Check Again</span>
              </>
            )}
          </button>
          <button
            onClick={() => navigate('/my-materials')}
            className="w-full sm:w-auto px-5 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Go to My Materials
          </button>
        </div>
      </div>
    );
  }

  // 3. FAILED STATE (Section 20)
  if (orderStatus === 'FAILED') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto ring-8 ring-rose-50">
          <XCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-800 bg-rose-100 px-3 py-1 rounded-full">
            Payment Not Completed
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            Your payment was not confirmed.
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            The payment gateway reported that this transaction was not completed. No money was captured, and no digital materials have been unlocked.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => navigate('/checkout')}
            className="px-6 py-3 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            Return to Checkout
          </button>
        </div>
      </div>
    );
  }

  // 4. USER_DROPPED STATE (Section 20)
  if (orderStatus === 'USER_DROPPED') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto ring-8 ring-slate-50">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 bg-slate-200 px-3 py-1 rounded-full">
            Checkout Incomplete
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            Payment was not completed.
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            The payment session was closed before completion. No digital materials have been unlocked.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => navigate('/checkout')}
            className="px-6 py-3 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 5. NOT_FOUND / UNKNOWN ERROR STATE (Section 27)
  if (orderStatus === 'NOT_FOUND' || !currentOrder || currentOrder.status !== 'PAID') {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto ring-8 ring-slate-50">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Order not found</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          We could not find the requested order record. Instant downloads are unlocked only after verified server payment confirmation.
        </p>
        <button
          onClick={() => setCurrentView('catalog')}
          className="px-5 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          Browse Study Materials
        </button>
      </div>
    );
  }

  // 6. VERIFIED PAID STATE (Sections 4, 5, 6, 8)
  const displayMaterials = (currentOrder.fulfillment?.materials && currentOrder.fulfillment.materials.length > 0)
    ? currentOrder.fulfillment.materials
    : (currentOrder.fulfillment?.downloads || []).map((d) => ({
        entitlementId: d.entitlementId || d.bookId,
        name: d.title,
        type: (d.type || 'product') as 'product' | 'addon',
        available: true,
        productId: d.bookId,
        addOnId: null,
        downloadUrl: d.downloadUrl,
      }));

  const hasPhysical = (currentOrder.items || []).some((i) => i.format === 'physical');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Celebration Header (Section 4) */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-emerald-700 block">
          PAYMENT CONFIRMED & ORDER PLACED
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
          Thank You, {currentOrder.shipping.fullName || 'Student'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Your payment has been verified. Your study materials are unlocked and ready for instant access.
        </p>

        <div className="inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
          <span>Order ID: <strong className="font-mono text-slate-900">#{currentOrder.id}</strong></span>
          <span>•</span>
          <span>Amount Paid: <strong className="text-slate-900">₹{currentOrder.total}</strong></span>
          <span>•</span>
          <span>Date: <strong>{currentOrder.date}</strong></span>
        </div>
      </div>

      {/* Official Google Sheet Copy Template Link (if available) */}
      {currentOrder.fulfillment?.googleSheetUrl && (
        <div className="bg-gradient-to-r from-emerald-600 via-[#00875a] to-[#0a2540] rounded-3xl p-6 sm:p-7 text-white shadow-lg border border-emerald-400/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-2.5 py-1 rounded-full inline-block">
                Study Planner & Template Access
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-['Plus_Jakarta_Sans',sans-serif] text-white">
                Official Google Sheet Study Planner Template
              </h2>
              <p className="text-xs text-slate-200 max-w-lg">
                Click below to make your personal copy in Google Sheets with interactive study schedules, mock test trackers, and band score analytics.
              </p>
            </div>

            <a
              href={currentOrder.fulfillment.googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-emerald-800 hover:bg-emerald-50 text-xs sm:text-sm font-bold rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <span>Open Google Sheet /copy Template</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Existing Customer / Account Linked Card (Section 3) */}
      {(currentCustomer || activationSuccess || verifiedData?.isClaimed) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Lifetime Account Linked
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Your purchase has been added to your Aylem Learning account.
            </h3>
            <p className="text-xs text-slate-600">
              Linked to {currentCustomer?.email || currentOrder.shipping.email}. Access this study material anytime from any device.
            </p>
          </div>

          <button
            onClick={() => navigate('/my-materials')}
            className="px-6 py-3 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-2xl shadow-xs transition-all hover:scale-105 active:scale-95 shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <span>Go to My Materials</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Post-Payment Account Activation Card (Section 2 & 31) */}
      {!currentCustomer && !activationSuccess && !verifiedData?.isClaimed && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-[#0a2540] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                SAVE YOUR LIFETIME ACCESS
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif]">
              Create your account to access your materials anytime.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Your purchased study materials will be permanently tied to your personal account so you can log in, review notes, and get fresh download authorizations anytime.
            </p>
          </div>

          {accountExists ? (
            <div className="p-4 bg-amber-500/20 border border-amber-400/30 rounded-2xl space-y-3">
              <p className="text-xs text-amber-200">
                An account already exists for <strong>{currentOrder.shipping.email}</strong>. Please sign in to link this verified purchase to your account.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 bg-amber-400 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-300 transition-all cursor-pointer"
              >
                Sign In to Link Purchase
              </button>
            </div>
          ) : (
            <form onSubmit={handleActivateAccount} className="space-y-4 max-w-lg">
              {activationError && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-200 rounded-xl text-xs">
                  {activationError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={actName}
                    onChange={(e) => setActName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email (Read-only)
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={currentOrder.shipping.email}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-slate-400 text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Create Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={actPassword}
                    onChange={(e) => setActPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={actConfirmPassword}
                    onChange={(e) => setActConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                <button
                  type="submit"
                  disabled={isActivating}
                  className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-70 text-slate-950 text-xs font-extrabold rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create My Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Materials Section (Sections 4, 6, 7) */}
      {displayMaterials.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                INSTANT ACCESS READY
              </span>
              <h2 className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] mt-1">
                Your Study Materials Are Ready
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Lifetime Access
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {displayMaterials.map((material) => {
              const bookObj = (books || []).find((b) => b.id === material.productId);
              const downloadUrl =
                material.downloadUrl ||
                `/api/download?order_id=${encodeURIComponent(currentOrder.id)}&entitlement_id=${encodeURIComponent(material.entitlementId)}`;
              const isDownloading = downloadingId === material.entitlementId;

              return (
                <div
                  key={material.entitlementId}
                  className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="shrink-0">
                      {bookObj && material.type === 'product' ? (
                        <BookCover book={bookObj} size="sm" showShadow={false} />
                      ) : (
                        <div className="w-12 h-16 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col items-center justify-center font-bold text-emerald-800 text-[10px] uppercase">
                          <span>{material.type === 'addon' ? 'Add-on' : 'PDF'}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            material.type === 'addon'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {material.type === 'addon' ? 'Additional Practice Material' : 'Main Preparation Guide'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                        {material.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {material.type === 'addon' ? 'Practice Tests & Drill Notes' : 'Complete Study Guide'} • High-Res PDF
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-700 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Permanent License Activated for {currentOrder.shipping?.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {bookObj && material.type === 'product' && (
                      <button
                        onClick={() => openPdfViewer(bookObj)}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-slate-600" />
                        <span>Read Online</span>
                      </button>
                    )}

                    {material.available && downloadUrl ? (
                      <button
                        onClick={() =>
                          handleDownload(
                            downloadUrl,
                            material.name,
                            currentOrder.id,
                            material.entitlementId
                          )
                        }
                        disabled={isDownloading}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#00875a] hover:bg-[#00734c] disabled:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Preparing...</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-4 h-4" />
                            <span>Download PDF</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic px-3 py-2">
                        Delivery pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lifetime Access Callout (Section 4 & 8) */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
        <div className="space-y-2 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Lifetime Access
            </span>
          </div>
          <h3 className="text-xl font-bold font-['Plus_Jakarta_Sans',sans-serif]">
            Your purchased materials remain available through your account.
          </h3>
          <p className="text-xs text-slate-300 max-w-lg">
            Return anytime to review your guides, track practice mocks, and generate fresh authorized download links whenever you need them.
          </p>
        </div>

        <button
          onClick={() => navigate('/my-materials')}
          className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <span>Go to My Materials</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Physical Delivery Tracking Card (if order has physical books) */}
      {hasPhysical && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Physical Printed Book Order
              </h3>
              <p className="text-xs text-slate-500">
                Courier dispatch scheduled within 24 hours. Expected delivery: 3-5 business days.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-700">
            <div className="font-bold text-slate-900">Shipping Address:</div>
            <div>{currentOrder.shipping.fullName}</div>
            <div>{currentOrder.shipping.addressLine1}, {currentOrder.shipping.addressLine2}</div>
            <div>{currentOrder.shipping.city}, {currentOrder.shipping.state} - {currentOrder.shipping.pinCode}</div>
            <div className="text-slate-500 pt-1">Contact: +91 {currentOrder.shipping.phone}</div>
          </div>
        </div>
      )}

      {/* Need Help Box */}
      <div className="border border-slate-200 bg-white rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div>
          <span className="font-bold text-slate-900 block text-sm">Need help with your order?</span>
          <span>Reference Order ID <strong className="font-mono text-slate-900">#{currentOrder.id}</strong> when contacting our support team at <a href="mailto:aylembookstore@gmail.com" className="text-emerald-700 underline font-semibold">aylembookstore@gmail.com</a> or call <a href="tel:+916282377918" className="text-emerald-700 underline font-semibold">+91 6282377918</a>.</span>
        </div>

        <button
          onClick={() => setCurrentView('catalog')}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl shrink-0 cursor-pointer"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
};
