// src/utils/analytics.ts
// First-Party Client Funnel Tracking Utilities
// Strictly non-invasive: no mouse/scroll tracking, no keystroke tracking.
// Emits only meaningful business funnel events with client deduplication.
// All network requests are asynchronous, non-blocking, and failure-isolated.

import { AnalyticsEventType } from '../types';

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
