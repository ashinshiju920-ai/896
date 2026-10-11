import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  DownloadCloud,
  ShieldCheck,
  Package,
  Calendar,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Loader2,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BookCover } from '../components/BookCover';
import { BackButton } from '../components/BackButton';
import { checkOrderStatus, STUDENT_PORTAL_URL } from '../utils/cashfree';

interface MyMaterialsViewProps {
  initialTab?: 'materials' | 'orders';
}

interface MaterialCardItem {
  entitlementId: string;
  orderId: string;
  name: string;
  type: 'product' | 'addon';
  available: boolean;
  version?: string;
  updatedAt?: string;
  productId: string;
  addOnId?: string | null;
  downloadUrl?: string | null;
  purchaseDate: string;
  bookObj?: any;
}

export const MyMaterialsView: React.FC<MyMaterialsViewProps> = ({ initialTab = 'materials' }) => {
  const {
    orders,
    books,
    setCurrentView,
    openPdfViewer,
    showToast,
    currentCustomer,
    logoutCustomer,
    isCustomerLoading,
  } = useShop();

  const [activeTab, setActiveTab] = useState<'materials' | 'orders'>(initialTab);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Authenticated customer study materials from server (Phase 7)
  const [serverMaterials, setServerMaterials] = useState<MaterialCardItem[]>([]);
  const [serverOrders, setServerOrders] = useState<any[]>([]);
  const [isLoadingServerMaterials, setIsLoadingServerMaterials] = useState<boolean>(false);

  useEffect(() => {
    showToast('Opening the Aylem student portal for your study materials.', 'info');
    window.location.assign(STUDENT_PORTAL_URL);
  }, [showToast]);

  useEffect(() => {
    if (!currentCustomer) {
      setServerMaterials([]);
      setServerOrders([]);
      return;
    }

    let isMounted = true;
    setIsLoadingServerMaterials(true);
    fetch('/api/customer/materials')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.materials)) {
            const mapped = data.materials.map((m: any) => ({
              entitlementId: m.entitlementId,
              orderId: m.orderId,
              name: m.name,
              type: m.type,
              available: m.available !== false,
              version: m.version,
              updatedAt: m.updatedAt,
              productId: m.productId,
              addOnId: m.addOnId,
              downloadUrl: m.downloadUrl,
              purchaseDate: m.purchasedAt
                ? new Date(m.purchasedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Lifetime Access',
              bookObj: (books || []).find((b) => b.id === m.productId),
            }));
            setServerMaterials(mapped);
            setServerOrders(data.orders || []);
          }
        }
      })
      .catch((err) => console.warn('Could not load customer materials:', err))
      .finally(() => {
        if (isMounted) setIsLoadingServerMaterials(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentCustomer, books]);

  // Extract all authorized materials across paid orders
  const paidOrders = orders.filter((o) => o.status === 'PAID' || o.status === 'confirmed');

  const allMaterials: MaterialCardItem[] = [];
  const seenEntitlementKeys = new Set<string>();

  for (const order of paidOrders) {
    const orderDate = order.date || 'Recent';

    // 1. Check fulfillment.materials first
    if (order.fulfillment?.materials && Array.isArray(order.fulfillment.materials) && order.fulfillment.materials.length > 0) {
      for (const mat of order.fulfillment.materials) {
        const key = mat.entitlementId || `${mat.productId}_${mat.addOnId || 'main'}`;
        if (!seenEntitlementKeys.has(key)) {
          seenEntitlementKeys.add(key);
          const bookObj = (books || []).find((b) => b.id === mat.productId);
          allMaterials.push({
            entitlementId: mat.entitlementId || key,
            orderId: order.id,
            name: mat.name,
            type: mat.type,
            available: mat.available !== false,
            productId: mat.productId || '',
            addOnId: mat.addOnId || null,
            downloadUrl: mat.downloadUrl,
            purchaseDate: orderDate,
            bookObj,
          });
        }
      }
    } else if (order.fulfillment?.downloads && Array.isArray(order.fulfillment.downloads) && order.fulfillment.downloads.length > 0) {
      // 2. Check fulfillment.downloads fallback
      for (const dl of order.fulfillment.downloads) {
        const key = dl.entitlementId || dl.bookId;
        if (!seenEntitlementKeys.has(key)) {
          seenEntitlementKeys.add(key);
          const bookObj = (books || []).find((b) => b.id === dl.bookId);
          allMaterials.push({
            entitlementId: key,
            orderId: order.id,
            name: dl.title,
            type: dl.type || 'product',
            available: true,
            productId: dl.bookId,
            addOnId: null,
            downloadUrl: dl.downloadUrl,
            purchaseDate: orderDate,
            bookObj,
          });
        }
      }
    } else if (Array.isArray(order.items)) {
      // 3. Fallback: reconstruct from order item snapshots
      for (const item of order.items) {
        const bookId = item.productId || item.bookId || item.book?.id;
        const bookObj = item.book || (books || []).find((b) => b.id === bookId);
        const isDigital = item.format === 'digital' || item.deliveryOption === 'digital';

        if (isDigital && bookId) {
          const mainKey = `ent_${order.id}_${bookId}_main`;
          if (!seenEntitlementKeys.has(mainKey)) {
            seenEntitlementKeys.add(mainKey);
            allMaterials.push({
              entitlementId: mainKey,
              orderId: order.id,
              name: item.productNameSnapshot || item.title || bookObj?.title || 'Study Material',
              type: 'product',
              available: true,
              productId: bookId,
              addOnId: null,
              downloadUrl: `/api/download?order_id=${encodeURIComponent(order.id)}&book_id=${encodeURIComponent(bookId)}`,
              purchaseDate: orderDate,
              bookObj,
            });
          }
        }

        // Check add-ons
        const addOns = item.addOns || item.selectedAddons || [];
        for (const addon of addOns) {
          const addonId = addon.addOnId || addon.id;
          if (addonId && addon.deliveryOption !== 'physical') {
            const addonKey = `ent_${order.id}_${bookId}_${addonId}`;
            if (!seenEntitlementKeys.has(addonKey)) {
              seenEntitlementKeys.add(addonKey);
              allMaterials.push({
                entitlementId: addonKey,
                orderId: order.id,
                name: `${item.productNameSnapshot || bookObj?.title || 'Study Guide'} — ${addon.nameSnapshot || addon.name || 'Add-on'}`,
                type: 'addon',
                available: true,
                productId: bookId,
                addOnId: addonId,
                downloadUrl: `/api/download?order_id=${encodeURIComponent(order.id)}&entitlement_id=${encodeURIComponent(addonKey)}`,
                purchaseDate: orderDate,
                bookObj,
              });
            }
          }
        }
      }
    }
  }

  // Handle protected re-download flow with automatic token renewal
  const handleSecureDownload = async (material: MaterialCardItem) => {
    const cardId = material.entitlementId;
    setDownloadingId(cardId);
    showToast(`Preparing your download for "${material.name}"...`, 'info');

    try {
      let downloadUrl = material.downloadUrl;

      // Always request fresh server authorization for security & token freshness
      const freshStatus = await checkOrderStatus(material.orderId);
      if (freshStatus && freshStatus.status === 'PAID') {
        const freshMat = freshStatus.materials?.find(
          (m) => m.entitlementId === material.entitlementId || m.name === material.name
        );
        if (freshMat?.downloadUrl) {
          downloadUrl = freshMat.downloadUrl;
        } else if (freshStatus.fulfillment?.downloads) {
          const freshDl = freshStatus.fulfillment.downloads.find(
            (d) => d.bookId === material.productId || d.entitlementId === material.entitlementId
          );
          if (freshDl?.downloadUrl) {
            downloadUrl = freshDl.downloadUrl;
          }
        }
      }

      if (!downloadUrl) {
        showToast('Material temporarily unavailable. Please try again later.', 'warning');
        return;
      }

      const res = await fetch(downloadUrl);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/pdf')) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${material.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          showToast(`Downloaded "${material.name}"! Check your downloads folder.`, 'success');
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

  const effectiveMaterials: MaterialCardItem[] = currentCustomer
    ? (serverMaterials.length > 0 ? serverMaterials : allMaterials)
    : allMaterials;

  const effectiveOrders = currentCustomer && serverOrders.length > 0 ? serverOrders : orders;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Header with Navigation & Customer Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <BackButton to="/" label="Home" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Personal Dashboard
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Lifetime Access
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] mt-1">
              {currentCustomer ? `Welcome, ${currentCustomer.name}!` : 'My Study Materials'}
            </h1>
            {currentCustomer && (
              <p className="text-xs text-slate-500 font-mono">
                {currentCustomer.email}
              </p>
            )}
          </div>
        </div>

        {/* Tab Toggle & Account Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('materials')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'materials'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Materials ({effectiveMaterials.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Order History ({effectiveOrders.length})
            </button>
          </div>

          {currentCustomer ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('account')}
                className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>My Account</span>
              </button>
              <button
                onClick={logoutCustomer}
                className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentView('login')}
              className="px-4 py-2 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: MY STUDY MATERIALS */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {/* Lifetime Access Explainer Banner */}
          <div className="bg-gradient-to-r from-emerald-800 via-[#00875a] to-[#0a2540] rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  Permanent Entitlement Access
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-['Plus_Jakarta_Sans',sans-serif]">
                Your study materials never expire.
              </h2>
              <p className="text-xs text-emerald-100 max-w-xl">
                All purchased study guides and add-on packs come with permanent lifetime access. You can return anytime to read online or generate fresh download authorizations.
              </p>
            </div>
            <button
              onClick={() => setCurrentView('catalog')}
              className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>Explore More Books</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Materials List */}
          {isLoadingServerMaterials ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading your authorized study materials...</p>
            </div>
          ) : effectiveMaterials.length > 0 ? (
            <div className="space-y-4">
              {effectiveMaterials.map((material) => {
                const isDownloading = downloadingId === material.entitlementId;

                return (
                  <div
                    key={material.entitlementId}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {material.bookObj && material.type === 'product' ? (
                          <BookCover book={material.bookObj} size="sm" showShadow={false} />
                        ) : (
                          <div className="w-12 h-16 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col items-center justify-center font-bold text-emerald-800 text-[10px] uppercase">
                            <span>{material.type === 'addon' ? 'Add-on' : 'PDF'}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              material.type === 'addon'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {material.type === 'addon' ? 'Add-on Material' : 'Main Study Guide'}
                          </span>
                          {material.version && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                              Latest: v{material.version}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 font-medium">
                            Purchased {material.purchaseDate}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                          {material.name}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Lifetime Access Verified
                          </span>
                          <span>•</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Order #{material.orderId}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      {material.bookObj && material.type === 'product' && (
                        <button
                          onClick={() => openPdfViewer(material.bookObj)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-slate-600" />
                          <span>Read Online</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleSecureDownload(material)}
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
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-4 px-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No study materials yet</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your purchased digital study guides, mock test packs, and vocabulary materials will appear here with lifetime access and instant re-downloads.
              </p>
              <button
                onClick={() => setCurrentView('catalog')}
                className="px-6 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Browse Study Materials
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {effectiveOrders.length > 0 ? (
            <div className="space-y-4">
              {effectiveOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Order ID</span>
                        <span className="font-bold text-slate-900 font-mono">#{order.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                        <span className="font-semibold text-slate-900">{order.date}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total</span>
                        <span className="font-bold text-slate-900">₹{order.total}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                          order.status === 'PAID' || order.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            order.status === 'PAID' || order.status === 'confirmed'
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        {order.status === 'PAID' || order.status === 'confirmed'
                          ? 'Paid & Confirmed'
                          : 'Payment Pending'}
                      </span>

                      <button
                        onClick={() => setActiveTab('materials')}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        View Materials
                      </button>
                    </div>
                  </div>

                  {/* Items in this order */}
                  <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-4 sm:space-y-0">
                    {(order.items || []).map((item: any, idx: number) => {
                      const bookId = item.productId || item.bookId || item.book?.id;
                      const bookObj = item.book || (books || []).find((b) => b.id === bookId);

                      return (
                        <div
                          key={`${order.id}-${bookId || idx}`}
                          className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="shrink-0">
                              {bookObj ? (
                                <BookCover book={bookObj} size="sm" showShadow={false} />
                              ) : (
                                <div className="w-12 h-16 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400 text-xs">
                                  PDF
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                                {item.productNameSnapshot || item.title || bookObj?.title || 'Study Guide'}
                              </h4>
                              <p className="text-xs text-slate-500">
                                Format: {item.format === 'physical' ? 'Printed Book' : 'Digital PDF'} • Qty: {item.quantity || 1}
                              </p>
                              {Array.isArray(item.addOns) && item.addOns.length > 0 && (
                                <div className="text-[11px] text-purple-700 font-medium mt-0.5">
                                  Includes: {item.addOns.map((a: any) => a.nameSnapshot || a.name).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-900">
                              ₹{item.price ? item.price * (item.quantity || 1) : item.unitPrice || '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-4 px-4">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">No orders placed yet</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once you purchase digital or physical study materials, they will appear here with full invoice and order details.
              </p>
              <button
                onClick={() => setCurrentView('catalog')}
                className="px-6 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Explore Books & Guides
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
