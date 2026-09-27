import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  Package,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  User,
  CreditCard,
  Activity,
  ChevronDown,
  ChevronRight,
  BarChart2,
  XCircle,
  Download,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: any | null;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatCurrency(paise: number | null | undefined): string {
  if (paise == null) return '—';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  USER_DROPPED: 'bg-slate-100 text-slate-600 border-slate-200',
};
const STATUS_DOT: Record<string, string> = {
  PAID: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  FAILED: 'bg-red-500',
  USER_DROPPED: 'bg-slate-400',
};

const FULFILLMENT_STYLE: Record<string, string> = {
  COMPLETE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_STARTED: 'bg-slate-100 text-slate-600 border-slate-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
};

const RECONCILIATION_STYLE: Record<string, string> = {
  MATCHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MISMATCH: 'bg-red-50 text-red-700 border-red-200',
  UNKNOWN: 'bg-slate-100 text-slate-500 border-slate-200',
};

// ─────────────────────────────────────────────
// Section Wrapper
// ─────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1.5">
      {title}
    </h4>
    {children}
  </div>
);

// ─────────────────────────────────────────────
// Row helper
// ─────────────────────────────────────────────
const Row: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-slate-400 text-xs shrink-0 w-32">{label}</span>
    <span className={`text-xs font-semibold text-slate-800 text-right ${mono ? 'font-mono' : ''}`}>
      {value ?? '—'}
    </span>
  </div>
);

// ─────────────────────────────────────────────
// Copy button
// ─────────────────────────────────────────────
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string; styleMap?: Record<string, string>; dotMap?: Record<string, string> }> = ({
  status,
  styleMap = STATUS_STYLE,
  dotMap = STATUS_DOT,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
      styleMap[status] || 'bg-slate-100 text-slate-600 border-slate-200'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${dotMap?.[status] || 'bg-slate-400'}`} />
    {status}
  </span>
);

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order: orderSummary, onClose }) => {
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [eventsOpen, setEventsOpen] = useState(false);
  const [entitlementsOpen, setEntitlementsOpen] = useState(true);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryResult, setRetryResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);

  // Fetch full order detail from Phase 8 API
  const fetchDetail = useCallback(async () => {
    if (!orderSummary?.id) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderSummary.id)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setDetailError(err?.error || 'Failed to load order detail.');
      }
    } catch {
      setDetailError('Network error loading order detail.');
    } finally {
      setDetailLoading(false);
    }
  }, [orderSummary?.id]);

  useEffect(() => {
    if (orderSummary) {
      setDetail(null);
      setRetryResult(null);
      setShowRetryConfirm(false);
      fetchDetail();
    }
  }, [orderSummary, fetchDetail]);

  if (!orderSummary) return null;

  const ord = detail?.order || orderSummary;
  const items: any[] = detail?.items || (Array.isArray(orderSummary.items) ? orderSummary.items : []);
  const customer = detail?.customer || null;
  const reconciliation = detail?.reconciliation || null;
  const fulfillment = detail?.fulfillment || null;
  const events: any[] = detail?.events || [];

  const isPaid = ord.status === 'PAID';

  // Compute shipping from detail
  const shipping = detail?.order?.shipping || orderSummary.shipping || {};

  // Historical totals from items snapshot
  const subtotalPaise = items.reduce((sum: number, item: any) => {
    const unitP = item.unitPricePaise || Math.round((item.unitPrice || item.price || 0) * 100);
    const qty = item.quantity || 1;
    return sum + unitP * qty;
  }, 0);
  const discountPaise = (ord.amount_paise || 0) < subtotalPaise ? subtotalPaise - (ord.amount_paise || 0) : 0;

  // Retry fulfillment
  const handleRetry = async () => {
    setShowRetryConfirm(false);
    setRetryLoading(true);
    setRetryResult(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(ord.id)}/retry-fulfillment`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setRetryResult({ success: true, message: `${data.entitlementCount} entitlement(s) confirmed.` });
        await fetchDetail(); // Refresh detail after retry
      } else {
        setRetryResult({ success: false, message: data.error || 'Retry failed.' });
      }
    } catch {
      setRetryResult({ success: false, message: 'Network error during retry.' });
    } finally {
      setRetryLoading(false);
    }
  };

  const canRetry = isPaid && fulfillment && fulfillment.state !== 'COMPLETE';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col my-4">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70 rounded-t-3xl gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Record</span>
              <StatusBadge status={ord.status || 'PENDING'} />
              {fulfillment && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                    FULFILLMENT_STYLE[fulfillment.state] || 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {fulfillment.createdCount}/{fulfillment.expectedCount} {fulfillment.state}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-[#0a2540] font-mono">#{ord.id}</h3>
              <CopyButton text={ord.id} />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close order detail"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Loading ─── */}
        {detailLoading && (
          <div className="px-6 py-4 flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            Loading full order detail…
          </div>
        )}
        {detailError && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {detailError}
          </div>
        )}

        {/* ─── Scrollable Body ─── */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 max-h-[75vh]">

          {/* ORDER INFO */}
          <Section title="Order">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Row label="Order ID" value={<span className="font-mono">{ord.id}</span>} />
              <Row label="Status" value={<StatusBadge status={ord.status || 'PENDING'} />} />
              <Row label="Created" value={formatDate(ord.created_at)} />
              <Row label="Updated" value={formatDate(ord.updated_at)} />
            </div>
          </Section>

          {/* CUSTOMER */}
          <Section title="Customer">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Row label="Name" value={customer?.name || ord.customer_name || '—'} />
              <Row label="Email" value={<span className="font-mono">{customer?.email || ord.customer_email || '—'}</span>} />
              <Row label="Phone" value={<span className="font-mono">{customer?.phone || ord.customer_phone || '—'}</span>} />
              {ord.customer_id && (
                <Row label="Customer ID" value={<span className="font-mono text-[10px]">{ord.customer_id}</span>} />
              )}
              {shipping.deliveryOption && (
                <Row label="Delivery" value={shipping.deliveryOption === 'digital' ? 'Instant Digital Download' : 'Physical Printed Courier'} />
              )}
              {shipping.addressLine1 && (
                <Row
                  label="Address"
                  value={
                    <span className="text-right text-[11px] text-slate-600 block">
                      {[shipping.addressLine1, shipping.addressLine2, shipping.city, shipping.state, shipping.pinCode].filter(Boolean).join(', ')}
                    </span>
                  }
                />
              )}
              {/* NOTE: password_hash, session token, claim_secret are intentionally never shown */}
            </div>
          </Section>

          {/* HISTORICAL PURCHASE — uses stored items snapshot, not current catalog */}
          <Section title="Historical Purchase">
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Prices shown are the historical snapshot at time of purchase — not current catalog prices.
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {items.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-400 text-xs">No items in order snapshot.</div>
              )}
              {items.map((item: any, idx: number) => {
                const isDigital = (item.format || item.deliveryOption || 'digital') === 'digital';
                const title = item.productNameSnapshot || item.title || item.name || 'Study Material';
                const unitPricePaise = item.unitPricePaise || Math.round((item.unitPrice || item.price || 0) * 100);
                const qty = item.quantity || 1;
                const linePaise = unitPricePaise * qty;
                const addons: any[] = Array.isArray(item.addOns) ? item.addOns : (Array.isArray(item.selectedAddons) ? item.selectedAddons : []);

                return (
                  <div key={idx}>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDigital ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {isDigital ? <FileText className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{title}</div>
                          <div className="text-[11px] text-slate-400">
                            {isDigital ? 'Digital PDF' : 'Physical Print'} · Qty {qty}
                            {item.productId || item.bookId ? ` · ID: ${item.productId || item.bookId}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{unitPricePaise ? formatCurrency(linePaise) : '—'}</div>
                        {qty > 1 && unitPricePaise > 0 && (
                          <div className="text-[10px] text-slate-400">{formatCurrency(unitPricePaise)} × {qty}</div>
                        )}
                      </div>
                    </div>
                    {/* Add-ons */}
                    {addons.filter((a) => a.nameSnapshot || a.name).map((addon: any, ai: number) => {
                      const addonName = addon.nameSnapshot || addon.name;
                      const addonPricePaise = addon.pricePaise || Math.round((addon.price || 0) * 100);
                      return (
                        <div key={ai} className="px-4 py-2 flex items-center justify-between gap-3 bg-slate-50/60 border-t border-dashed border-slate-100">
                          <div className="flex items-center gap-3 pl-8">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded-md">Add-on</span>
                            <span className="text-slate-700">{addonName}</span>
                          </div>
                          <span className="font-semibold text-slate-700">{addonPricePaise ? formatCurrency(addonPricePaise) : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              {subtotalPaise > 0 && <Row label="Subtotal" value={formatCurrency(subtotalPaise)} />}
              {discountPaise > 0 && <Row label="Discount" value={<span className="text-emerald-700">−{formatCurrency(discountPaise)}</span>} />}
              <Row label="Shipping" value={<span className="text-emerald-700">FREE</span>} />
              <div className="border-t border-slate-200 pt-2 mt-1">
                <Row
                  label="Total"
                  value={<span className="text-base font-extrabold text-slate-900">{formatCurrency(ord.amount_paise)}</span>}
                />
              </div>
            </div>
          </Section>

          {/* PAYMENT INFORMATION */}
          <Section title="Payment Information">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Row label="Internal Order ID" value={<span className="font-mono">{ord.id}</span>} />
              <Row label="Cashfree Order ID" value={<span className="font-mono">{ord.cf_order_id || ord.id}</span>} />
              {ord.cf_payment_id && (
                <Row label="Cashfree Payment ID" value={<span className="font-mono">{ord.cf_payment_id}</span>} />
              )}
              <Row label="Currency" value={ord.currency || 'INR'} />
              <Row label="Expected Amount" value={formatCurrency(ord.amount_paise)} />
              {ord.verified_amount_paise != null && (
                <Row label="Verified Paid Amount" value={formatCurrency(ord.verified_amount_paise)} />
              )}
              <Row label="Payment Status" value={<StatusBadge status={ord.status || 'PENDING'} />} />
              {/* NOTE: Cashfree secret, API key, webhook signature are NEVER shown */}
            </div>
          </Section>

          {/* PAYMENT RECONCILIATION */}
          {reconciliation && (
            <Section title="Payment Reconciliation">
              <div className={`p-4 rounded-2xl border space-y-2 ${RECONCILIATION_STYLE[reconciliation.state] || 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wide text-[10px]">Result</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${RECONCILIATION_STYLE[reconciliation.state]}`}>
                    {reconciliation.state}
                  </span>
                </div>
                <div className="space-y-1 pt-1">
                  <Row label="Expected" value={formatCurrency(reconciliation.expectedPaise)} />
                  <Row
                    label="Paid (Verified)"
                    value={reconciliation.verifiedPaise != null ? formatCurrency(reconciliation.verifiedPaise) : <span className="text-slate-400">Not yet verified</span>}
                  />
                  <Row label="Currency" value={reconciliation.currency} />
                </div>
                {reconciliation.state === 'MISMATCH' && (
                  <div className="flex items-center gap-2 mt-2 text-red-700 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Amount mismatch detected. This order should not be treated as valid.
                  </div>
                )}
                {reconciliation.state === 'UNKNOWN' && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    Reconciliation data will be available after webhook payment confirmation.
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* FULFILLMENT */}
          {fulfillment && (
            <Section title="Fulfillment">
              <div className={`p-4 rounded-2xl border space-y-3 ${FULFILLMENT_STYLE[fulfillment.state] || 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wide text-[10px]">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${FULFILLMENT_STYLE[fulfillment.state]}`}>
                    {fulfillment.createdCount}/{fulfillment.expectedCount} {fulfillment.state}
                  </span>
                </div>
                <div className="space-y-1">
                  <Row label="Expected Entitlements" value={String(fulfillment.expectedCount)} />
                  <Row label="Created Entitlements" value={String(fulfillment.createdCount)} />
                </div>

                {/* Entitlement List */}
                {fulfillment.entitlements.length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => setEntitlementsOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-current opacity-80 hover:opacity-100 cursor-pointer"
                    >
                      {entitlementsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {entitlementsOpen ? 'Hide' : 'Show'} entitlement details
                    </button>
                    {entitlementsOpen && (
                      <div className="mt-2 space-y-1.5 bg-white/60 rounded-xl p-3 border border-white/80">
                        {fulfillment.entitlements.map((ent: any) => (
                          <div key={ent.id} className="flex items-start justify-between gap-2 text-[11px]">
                            <div>
                              <div className="font-bold text-slate-800">{ent.title}</div>
                              <div className="text-slate-500 font-mono text-[10px]">{ent.id}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${ent.type === 'ADDON' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ent.type}
                              </span>
                              <div className="text-slate-400 text-[10px] mt-0.5">
                                {ent.grantedAt ? formatDate(ent.grantedAt) : '—'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Retry Fulfillment — only for PAID orders with missing/failed fulfillment */}
              {canRetry && (
                <div className="mt-2 space-y-2">
                  {!showRetryConfirm && (
                    <button
                      onClick={() => setShowRetryConfirm(true)}
                      disabled={retryLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retryLoading ? 'animate-spin' : ''}`} />
                      Retry Fulfillment
                    </button>
                  )}

                  {showRetryConfirm && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-amber-800">
                        Retry digital fulfillment for Order #{ord.id}?
                      </p>
                      <p className="text-[11px] text-amber-700">
                        This will run idempotent entitlement creation. No duplicates will be created.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRetry}
                          disabled={retryLoading}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60"
                        >
                          {retryLoading ? 'Retrying…' : 'Retry'}
                        </button>
                        <button
                          onClick={() => setShowRetryConfirm(false)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {retryResult && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${retryResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {retryResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {retryResult.message}
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* ORDER EVENTS */}
          <Section title="Order Event History">
            <button
              onClick={() => setEventsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              {eventsOpen ? 'Hide' : 'Show'} {events.length} event{events.length !== 1 ? 's' : ''}
              {eventsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {eventsOpen && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {events.length === 0 && (
                  <div className="text-slate-400 text-xs px-2">No events recorded for this order.</div>
                )}
                {events.map((evt: any) => (
                  <div key={evt.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-slate-800">{evt.eventType}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(evt.createdAt)}</span>
                      </div>
                      {evt.summary && Object.keys(evt.summary).length > 0 && (
                        <div className="mt-1 text-[10px] text-slate-500 font-mono bg-slate-50 rounded-lg px-2 py-1 break-all">
                          {JSON.stringify(evt.summary)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl gap-3">
          <button
            onClick={fetchDetail}
            disabled={detailLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${detailLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
