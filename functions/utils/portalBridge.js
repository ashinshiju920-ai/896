// functions/utils/portalBridge.js
// Server-to-server bridge from verified main-site PAID orders to Student Portal.

import { recordOrderEvent } from './db.js';
import { loadCatalogue } from './pricing.js';

export const PORTAL_PURCHASE_BRIDGE_DEFAULT_URL =
  'https://portal.aylemlearning.online/api/integrations/main-site/purchase';

export const PORTAL_COURSE_MAP = {
  IELTS: 'ielts',
  OET: 'oet',
  PTE: 'pte',
  GERMAN: 'german',
};

export async function recoverProductFromCashfreeOrder(cfData, env) {
  if (!cfData || typeof cfData !== 'object') return null;

  const note = String(cfData.order_note || '').trim();
  const catalog = await loadCatalogue(env);

  // Check if order_tags has an explicit product ID
  if (cfData.order_tags && typeof cfData.order_tags === 'object') {
    const tagProductId = cfData.order_tags.product_id || cfData.order_tags.productId;
    if (tagProductId) {
      const match = catalog.find((p) => p.id === tagProductId);
      if (match) {
        const deliveryOption = cfData.order_tags?.delivery_option === 'physical' ? 'physical' : 'digital';
        return {
          productId: match.id,
          bookId: match.id,
          id: match.id,
          title: match.title,
          category: match.category,
          format: deliveryOption,
        };
      }
    }
  }

  // Check order_note: formatted like "Xylem Learning - {product title prefix}"
  let candidatePrefix = '';
  if (note.startsWith('Xylem Learning - ')) {
    candidatePrefix = note.slice('Xylem Learning - '.length).trim().toLowerCase();
  } else if (note.startsWith('Aylem Learning - ')) {
    candidatePrefix = note.slice('Aylem Learning - '.length).trim().toLowerCase();
  } else if (note) {
    candidatePrefix = note.toLowerCase();
  }

  if (!candidatePrefix || candidatePrefix === 'exam study guide') {
    // Generic fallback note; cannot determine course authoritatively without guessing
    return null;
  }

  // Match against catalog products
  const matches = catalog.filter((product) => {
    const titleLower = String(product.title || '').toLowerCase();
    const titlePrefix = titleLower.slice(0, candidatePrefix.length);
    return titlePrefix === candidatePrefix || titleLower.includes(candidatePrefix);
  });

  if (matches.length !== 1) {
    // Ambiguous (multiple matches) or not found: DO NOT GUESS
    return null;
  }

  const matchedProduct = matches[0];
  const deliveryOption = cfData.order_tags?.delivery_option === 'physical' ? 'physical' : 'digital';

  return {
    productId: matchedProduct.id,
    bookId: matchedProduct.id,
    id: matchedProduct.id,
    title: matchedProduct.title,
    category: matchedProduct.category,
    format: deliveryOption,
  };
}

function normalizeCategory(category) {
  const clean = String(category || '').trim().toUpperCase();
  if (clean === 'GERMAN') return 'GERMAN';
  if (clean === 'IELTS' || clean === 'OET' || clean === 'PTE') return clean;
  return null;
}

function getOrderItems(order) {
  if (Array.isArray(order?.items)) return order.items;
  if (typeof order?.items_json === 'string') {
    try {
      const parsed = JSON.parse(order.items_json || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getStoredEmail(order) {
  return String(order?.customer_email || '').trim().toLowerCase();
}

async function hmacSha256Base64(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  let binary = '';
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function resolveEligiblePortalCourses(order, env) {
  const items = getOrderItems(order);
  if (items.length === 0) {
    return { courses: [], skipped: [{ reason: 'NO_ORDER_ITEMS' }] };
  }

  const catalog = await loadCatalogue(env);
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const courseMap = new Map();
  const skipped = [];

  for (const item of items) {
    const productId = item?.productId || item?.bookId || item?.id;
    if (!productId) {
      skipped.push({ reason: 'MISSING_PRODUCT_ID' });
      continue;
    }

    const product = byId.get(productId);
    if (!product) {
      skipped.push({ productId, reason: 'PRODUCT_NOT_FOUND_IN_SERVER_CATALOG' });
      continue;
    }

    const category = normalizeCategory(product.category);
    if (!category) {
      skipped.push({
        productId,
        category: product.category || null,
        reason: 'NON_PORTAL_CATEGORY',
      });
      continue;
    }

    if (!courseMap.has(category)) {
      courseMap.set(category, {
        category,
        productKey: PORTAL_COURSE_MAP[category],
        sourceProductIds: [productId],
      });
    } else {
      const existing = courseMap.get(category);
      if (!existing.sourceProductIds.includes(productId)) {
        existing.sourceProductIds.push(productId);
      }
    }
  }

  return { courses: Array.from(courseMap.values()), skipped };
}

async function recordBridgeEvent(env, orderId, eventType, payload) {
  try {
    await recordOrderEvent(env, {
      orderId,
      eventType,
      rawPayload: JSON.stringify(payload || {}),
    });
  } catch (err) {
    console.warn('Could not record portal bridge event:', err?.message);
  }
}

export async function provisionPortalAccessForPaidOrder(env, order, options = {}) {
  const source = options.source || 'UNKNOWN';
  const orderId = order?.id || order?.cf_order_id || 'unknown';

  if (!order || order.status !== 'PAID') {
    await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_SKIPPED_UNPAID', {
      source,
      status: order?.status || null,
    });
    return { attempted: false, successCount: 0, failureCount: 0, skipped: ['ORDER_NOT_PAID'] };
  }

  const email = getStoredEmail(order);
  if (!email) {
    await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_SKIPPED_NO_EMAIL', { source });
    return { attempted: false, successCount: 0, failureCount: 0, skipped: ['NO_CUSTOMER_EMAIL'] };
  }

  const secret = env?.MAIN_SITE_INTEGRATION_SECRET
    ? String(env.MAIN_SITE_INTEGRATION_SECRET).trim()
    : '';
  const endpoint = env?.PORTAL_PURCHASE_BRIDGE_URL
    ? String(env.PORTAL_PURCHASE_BRIDGE_URL).trim()
    : PORTAL_PURCHASE_BRIDGE_DEFAULT_URL;

  const { courses, skipped } = await resolveEligiblePortalCourses(order, env);
  if (skipped.length > 0) {
    await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_SKIPPED_ITEMS', { source, skipped });
  }

  if (courses.length === 0) {
    await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_NO_ELIGIBLE_COURSES', { source });
    return { attempted: false, successCount: 0, failureCount: 0, skipped };
  }

  if (!secret || !endpoint) {
    await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_NOT_CONFIGURED', {
      source,
      courseCount: courses.length,
      hasEndpoint: Boolean(endpoint),
      hasSecret: Boolean(secret),
    });
    return { attempted: false, successCount: 0, failureCount: 0, skipped: ['BRIDGE_NOT_CONFIGURED'] };
  }

  let successCount = 0;
  let failureCount = 0;
  const results = [];

  for (const course of courses) {
    const externalReference = `${orderId}:${course.productKey}`;
    const body = {
      orderId: externalReference,
      mainSiteOrderId: orderId,
      email,
      customerEmail: email,
      customerName: order.customer_name || 'Valued Customer',
      productKey: course.productKey,
      courseKey: course.productKey,
      courseSlug: course.productKey,
      courseCategory: course.category,
      paymentStatus: 'PAID',
      source: 'MAIN_SITE_PURCHASE',
    };
    const rawBody = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    let signature;
    try {
      signature = await hmacSha256Base64(secret, timestamp + rawBody);
    } catch (err) {
      failureCount += 1;
      results.push({ course: course.category, success: false, error: 'SIGNATURE_FAILED' });
      await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_SIGNATURE_FAILED', {
        source,
        course: course.category,
        error: err?.message || 'Unable to sign request',
      });
      continue;
    }

    const timeoutMs = Math.max(1000, Math.min(10000, Number(env?.PORTAL_BRIDGE_TIMEOUT_MS) || 4000));
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': signature,
        },
        body: rawBody,
        signal,
      });

      const ok = res.ok;
      const responseText = ok ? null : await res.text();
      if (ok) successCount += 1;
      else failureCount += 1;

      const result = {
        course: course.category,
        productKey: course.productKey,
        externalReference,
        success: ok,
        status: res.status,
        error: responseText,
      };
      results.push(result);

      await recordBridgeEvent(env, orderId, ok ? 'PORTAL_BRIDGE_PROVISIONED' : 'PORTAL_BRIDGE_FAILED', {
        source,
        course: course.category,
        productKey: course.productKey,
        externalReference,
        httpStatus: res.status,
        responseBody: responseText ? responseText.slice(0, 300) : null,
        success: ok,
      });
    } catch (err) {
      failureCount += 1;
      const isTimeout = err?.name === 'TimeoutError' || /timeout/i.test(String(err?.message || ''));
      results.push({
        course: course.category,
        productKey: course.productKey,
        externalReference,
        success: false,
        error: isTimeout ? 'TIMEOUT' : 'REQUEST_FAILED',
      });
      await recordBridgeEvent(env, orderId, 'PORTAL_BRIDGE_FAILED', {
        source,
        course: course.category,
        productKey: course.productKey,
        externalReference,
        success: false,
        error: isTimeout ? 'TIMEOUT' : 'REQUEST_FAILED',
      });
    }
  }

  return {
    attempted: true,
    successCount,
    failureCount,
    skipped,
    results,
  };
}
