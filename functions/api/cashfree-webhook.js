// functions/api/cashfree-webhook.js
// Cashfree PG v3 Webhook Signature Verification & Idempotent Order State Management

import { getOrder, updateOrderStatus, recordOrderEvent } from '../utils/db.js';

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Computes base64(HMAC-SHA256(data, secret)) using Web Crypto.
 */
async function computeHmacSha256Base64(secret, message) {
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

export async function onRequestPost(context) {
  const { request, env } = context;

  const secretKey = env && env.CASHFREE_SECRET_KEY ? String(env.CASHFREE_SECRET_KEY).trim() : '';
  if (!secretKey) {
    return new Response('Server configuration error: CASHFREE_SECRET_KEY missing', { status: 500 });
  }

  // 1. Read the RAW body as text BEFORE any JSON parsing
  const rawBody = await request.text();

  // 2. Extract Cashfree signature headers
  const signature =
    request.headers.get('x-webhook-signature') ||
    request.headers.get('x-cf-signature') ||
    '';
  const timestamp =
    request.headers.get('x-webhook-timestamp') ||
    request.headers.get('x-cf-timestamp') ||
    '';

  if (!signature || !timestamp) {
    return new Response('Missing signature or timestamp headers', { status: 401 });
  }

  // 3. Replay defence: Reject if timestamp is older than 5 minutes (300 seconds)
  const parsedTs = parseInt(timestamp, 10);
  if (isNaN(parsedTs)) {
    return new Response('Invalid timestamp header', { status: 401 });
  }

  const timestampSeconds = String(timestamp).length >= 13 ? Math.floor(parsedTs / 1000) : parsedTs;
  const currentSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(currentSeconds - timestampSeconds) > 300) {
    return new Response('Webhook timestamp expired (replay defense)', { status: 401 });
  }

  // 4. Verify signature: base64(HMAC-SHA256(timestamp + rawBody, CASHFREE_SECRET_KEY))
  const dataToSign = timestamp + rawBody;
  const expectedSignature = await computeHmacSha256Base64(secretKey, dataToSign);

  if (!timingSafeEqual(signature, expectedSignature)) {
    console.warn('Webhook signature mismatch rejected.');
    return new Response('Invalid webhook signature', { status: 401 });
  }

  // 5. Parse JSON payload
  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const eventType = payload.type || payload.event_type || '';
  const orderId =
    payload.data?.order?.order_id ||
    payload.order_id ||
    payload.data?.order_id;

  if (!orderId) {
    return new Response(JSON.stringify({ status: 'ok', note: 'No order ID in event' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up order in D1 / KV
  const order = await getOrder(env, orderId);
  if (!order) {
    await recordOrderEvent(env, {
      orderId,
      eventType: `WEBHOOK_UNKNOWN_ORDER_${eventType}`,
      rawPayload: rawBody,
    });
    // Return 200 to acknowledge receipt and stop retries
    return new Response(JSON.stringify({ status: 'ok', warning: 'Order not found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. Idempotent Payment Success Handling
  const isPaymentSuccess =
    eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
    eventType === 'PAYMENT_SUCCESS' ||
    payload.data?.payment?.payment_status === 'SUCCESS';

  if (isPaymentSuccess) {
    // Idempotency: if already PAID, do not double-process
    if (order.status === 'PAID') {
      return new Response(JSON.stringify({ status: 'ok', alreadyProcessed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawPaid =
      payload.data?.payment?.payment_amount ??
      payload.data?.order?.order_amount ??
      payload.order_amount;
    const paidPaise = Math.round(Number(rawPaid) * 100);

    // Confirm paid amount equals stored server-computed amount
    if (Math.abs(order.amount_paise - paidPaise) > 1) {
      // Mismatch => Log and leave unpaid!
      console.error(
        `PAYMENT MISMATCH: Order ${order.id} expected ${order.amount_paise} paise, received ${paidPaise} paise.`
      );
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'PAYMENT_AMOUNT_MISMATCH',
        rawPayload: JSON.stringify({
          expectedPaise: order.amount_paise,
          receivedPaise: paidPaise,
          rawBody,
        }),
      });
      return new Response(
        JSON.stringify({ error: 'Paid amount does not match order record' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Amount confirmed => update to PAID
    await updateOrderStatus(env, order.id, 'PAID');
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PAYMENT_SUCCESS_CONFIRMED',
      rawPayload: rawBody,
    });

    return new Response(
      JSON.stringify({ status: 'ok', order_id: order.id, order_status: 'PAID' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Other events (e.g. PAYMENT_FAILED, USER_DROPPED)
  await recordOrderEvent(env, {
    orderId: order.id,
    eventType: eventType || 'WEBHOOK_EVENT',
    rawPayload: rawBody,
  });

  return new Response(JSON.stringify({ status: 'ok', event: eventType }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
