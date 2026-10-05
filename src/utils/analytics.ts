// src/utils/analytics.ts
// First-Party Client Funnel Tracking Utilities
// Strictly non-invasive: no mouse/scroll tracking, no keystroke tracking.
// Emits only meaningful business funnel events with client deduplication.
// All network requests are asynchronous, non-blocking, and failure-isolated.

import { AnalyticsEventType } from '../types';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const ATTRIBUTION_STORAGE_KEY = 'aylem_marketing_attribution';
const PURCHASE_DEDUP_PREFIX = 'aylem_meta_purchase_';

type MarketingAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  landingPage?: string;
  referrer?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

// Anonymous client session ID (separate from customer authentication)
export function getAnalyticsSessionId(): string {
  try {
    const KEY = 'xylem_asess_id';
    let sessId = sessionStorage.getItem(KEY);
    if (!sessId) {
      sessId = `asess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(KEY, sessId);
    }
    return sessId;
  } catch {
    return 'asess_fallback';
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function captureMarketingAttribution(): void {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const trackedKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    const hasTrackedParam = trackedKeys.some((key) => params.has(key));

    if (!hasTrackedParam) return;

    const existingRaw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const now = new Date().toISOString();
    const next: MarketingAttribution = {
      ...existing,
      landingPage: existing.landingPage || window.location.href,
      referrer: existing.referrer || document.referrer || '',
      firstSeenAt: existing.firstSeenAt || now,
      lastSeenAt: now,
    };

    trackedKeys.forEach((key) => {
      const value = params.get(key);
      if (value) {
        (next as Record<string, string>)[key] = value;
      }
    });

    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal attribution capture.
  }
}

export function getMarketingAttribution(): MarketingAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getMetaClickData(): Record<string, string> {
  const data: Record<string, string> = {};
  const fbp = readCookie('_fbp');
  const fbc = readCookie('_fbc');
  if (fbp) data.fbp = fbp;
  if (fbc) data.fbc = fbc;
  return data;
}

export function trackMetaPurchase(order: {
  orderId?: string;
  total?: number;
  currency?: string;
  items?: any[];
}): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;

  const orderId = order.orderId || '';
  if (!orderId) return;

  try {
    const dedupKey = `${PURCHASE_DEDUP_PREFIX}${orderId}`;
    if (localStorage.getItem(dedupKey)) return;
    localStorage.setItem(dedupKey, '1');

    const items = Array.isArray(order.items) ? order.items : [];
    const contentIds = items
      .map((item) => item.productId || item.bookId || item.id)
      .filter(Boolean);
    const contents = items.map((item) => ({
      id: item.productId || item.bookId || item.id || orderId,
      quantity: Math.max(1, Number(item.quantity || 1)),
      item_price: Number(item.unitPrice || item.price || 0),
    }));
    const attribution = getMarketingAttribution();
    const eventId = `purchase_${orderId}`;

    window.fbq(
      'track',
      'Purchase',
      {
        value: Number(order.total || 0),
        currency: order.currency || 'INR',
        content_type: 'product',
        content_ids: contentIds,
        contents,
        num_items: items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0) || 1,
        order_id: orderId,
        ...attribution,
        ...getMetaClickData(),
      },
      { eventID: eventId }
    );
  } catch {
    // Meta tracking must never block successful payment handling.
  }
}

export async function trackMetaPurchaseBeforeRedirect(order: {
  orderId?: string;
  total?: number;
  currency?: string;
  items?: any[];
}): Promise<void> {
  trackMetaPurchase(order);
  await new Promise((resolve) => window.setTimeout(resolve, 450));
}

// In-memory deduplication caches to prevent duplicate events on React component re-renders
const viewedProductsSet = new Set<string>();
const selectedAddonsSet = new Set<string>();
let checkoutStartedFired = false;

async function sendAnalyticsEvent(payload: {
  eventType: AnalyticsEventType;
  productId?: string | null;
  addOnId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<void> {
  try {
    const sessionId = getAnalyticsSessionId();
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        ...payload,
        sessionId,
      }),
    });
  } catch {
    // Non-fatal: Failures never interrupt customer operations
  }
}

/**
 * Tracks a meaningful product page view.
 * Deduplicated per product per browser session to prevent React render spam.
 */
export function trackProductView(productId: string): void {
  if (!productId || typeof productId !== 'string') return;
  const cleanId = productId.trim();
  if (viewedProductsSet.has(cleanId)) return;
  viewedProductsSet.add(cleanId);

  sendAnalyticsEvent({
    eventType: 'PRODUCT_VIEWED',
    productId: cleanId,
  });
}

/**
 * Tracks intentional Add-to-Cart event.
 */
export function trackAddToCart(productId: string, addOnIds: string[] = []): void {
  if (!productId || typeof productId !== 'string') return;
  const cleanId = productId.trim();

  sendAnalyticsEvent({
    eventType: 'ADD_TO_CART',
    productId: cleanId,
    metadata: {
      addOnIds: addOnIds.filter(Boolean),
    },
  });
}

/**
 * Tracks intentional Add-On selection toggle.
 * Deduplicated per product + add-on combination.
 */
export function trackAddonSelected(productId: string, addOnId: string): void {
  if (!productId || !addOnId) return;
  const key = `${productId}:${addOnId}`;
  if (selectedAddonsSet.has(key)) return;
  selectedAddonsSet.add(key);

  sendAnalyticsEvent({
    eventType: 'ADDON_SELECTED',
    productId,
    addOnId,
  });
}

/**
 * Tracks customer checkout entry with active items in cart.
 * Deduplicated per page visit.
 */
export function trackCheckoutStarted(cartProductIds: string[] = [], itemCount = 1): void {
  if (checkoutStartedFired) return;
  checkoutStartedFired = true;

  sendAnalyticsEvent({
    eventType: 'CHECKOUT_STARTED',
    productId: cartProductIds[0] || null,
    metadata: {
      cartProductIds,
      itemCount,
    },
  });
}

/**
 * Resets checkout started flag (e.g. if customer returns to shop and checks out again).
 */
export function resetCheckoutTracking(): void {
  checkoutStartedFired = false;
}
