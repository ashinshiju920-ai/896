// functions/api/cashfree-webhook.js
// Cashfree PG v3 Webhook Signature Verification & Idempotent Order State Management

import {
  getOrder,
  saveOrder,
  updateOrderStatus,
  recordOrderEvent,
  createEntitlementsForPaidOrder,
  updateOrderPaymentConfirmed,
  recordPromotionRedemption,
  recordAnalyticsEvent,
} from '../utils/db.js';
import { provisionPortalAccessForPaidOrder, recoverProductFromCashfreeOrder } from '../utils/portalBridge.js';

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

  // 6. Idempotent Payment Success Handling
  const isPaymentSuccess =
    eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
    eventType === 'PAYMENT_SUCCESS' ||
    payload.data?.payment?.payment_status === 'SUCCESS';

  const isPaymentFailed =
    eventType === 'PAYMENT_FAILED_WEBHOOK' ||
    eventType === 'PAYMENT_FAILED' ||
    payload.data?.payment?.payment_status === 'FAILED';

  const isUserDropped =
    eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' ||
    eventType === 'USER_DROPPED' ||
    payload.data?.payment?.payment_status === 'USER_DROPPED';

  // Look up order in D1 / KV
  let order = await getOrder(env, orderId);

  // If order is not found locally, but webhook is a verified payment success, attempt safe authoritative recovery
  if (!order && isPaymentSuccess) {
    const cfOrder = payload.data?.order || {};
    const recoveredItem = await recoverProductFromCashfreeOrder(cfOrder, env);

    if (recoveredItem) {
      const customerDetails = payload.data?.customer_details || {};
      const paymentAmount = payload.data?.payment?.payment_amount || cfOrder.order_amount;
      const paidPaise = Math.round(Number(paymentAmount) * 100);
      const recoveredOrder = {
        id: orderId,
        cf_order_id: orderId,
        customer_id: customerDetails.customer_id || null,
        amount_paise: paidPaise,
        currency: cfOrder.order_currency || 'INR',
        status: 'PAID',
        customer_name: customerDetails.customer_name || 'Valued Customer',
        customer_email: customerDetails.customer_email || '',
        customer_phone: customerDetails.customer_phone || '',
        shipping: {
          fullName: customerDetails.customer_name || 'Valued Customer',
          email: customerDetails.customer_email || '',
          phone: customerDetails.customer_phone || '',
          deliveryOption: recoveredItem.format || 'digital',
        },
        items: [recoveredItem],
        coupon_code: null,
        discount_paise: 0,
        subtotal_paise: paidPaise,
        shipping_paise: 0,
        total_paise: paidPaise,
      };

      try {
        await saveOrder(env, recoveredOrder);
        await recordOrderEvent(env, {
          orderId,
          eventType: 'ORDER_RECOVERED_FROM_WEBHOOK',
          rawPayload: rawBody,
        });
        order = recoveredOrder;
      } catch (persistErr) {
        console.error('Failed to persist recovered order in webhook:', persistErr?.message);
      }
    }
  }

  if (!order) {
    await recordOrderEvent(env, {
      orderId,
      eventType: `WEBHOOK_UNKNOWN_ORDER_${eventType}`,
      rawPayload: rawBody,
    });
    // Return 200 to acknowledge receipt and stop retries
    return new Response(JSON.stringify({ status: 'ok', warning: 'Order not found or product unrecoverable' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (isPaymentSuccess) {
    // Idempotency: if already PAID, do not double-process
    if (order.status === 'PAID') {
      try {
        await provisionPortalAccessForPaidOrder(env, order, { source: 'CASHFREE_WEBHOOK_DUPLICATE_PAID' });
      } catch (bridgeErr) {
        console.warn('Portal bridge retry failed for already-paid webhook:', bridgeErr?.message);
      }
      return new Response(JSON.stringify({ status: 'ok', alreadyProcessed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Currency validation: Must match expected order currency (default 'INR')
    const paidCurrency = String(
      payload.data?.payment?.payment_currency ||
      payload.data?.order?.order_currency ||
      payload.order_currency ||
      'INR'
    ).toUpperCase();
    const expectedCurrency = String(order.currency || 'INR').toUpperCase();

    if (paidCurrency !== expectedCurrency) {
      console.error(
        `CURRENCY MISMATCH: Order ${order.id} expected ${expectedCurrency}, received ${paidCurrency}.`
      );
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'PAYMENT_CURRENCY_MISMATCH',
        rawPayload: JSON.stringify({
          expectedCurrency,
          receivedCurrency: paidCurrency,
          rawBody,
        }),
      });
      return new Response(
        JSON.stringify({ error: 'Payment currency does not match order record' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rawPaid =
      payload.data?.payment?.payment_amount ??
      payload.data?.order?.order_amount ??
      payload.order_amount;
    const paidPaise = Math.round(Number(rawPaid) * 100);

    // Confirm paid amount equals stored server-computed amount
    if (isNaN(paidPaise) || Math.abs(order.amount_paise - paidPaise) > 1) {
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

    // Amount and currency confirmed => update to PAID
    await updateOrderStatus(env, order.id, 'PAID');
    order.status = 'PAID';

    // Phase 8: Store payment reconciliation data
    const cfPaymentId = payload.data?.payment?.cf_payment_id || payload.data?.payment?.payment_id || null;
    try {
      await updateOrderPaymentConfirmed(env, order.id, {
        cfPaymentId,
        verifiedAmountPaise: paidPaise,
        reconciliationState: Math.abs(order.amount_paise - paidPaise) <= 1 ? 'MATCHED' : 'MISMATCH',
      });
    } catch (reconcErr) {
      console.warn('Could not store reconciliation data:', reconcErr.message);
    }

    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'ORDER_MARKED_PAID',
      rawPayload: JSON.stringify({
        paymentId: cfPaymentId,
      }),
    });

    try {
      const entitlements = await createEntitlementsForPaidOrder(env, order);
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'ENTITLEMENTS_CREATED',
        rawPayload: JSON.stringify({
          count: entitlements.length,
          entitlementIds: entitlements.map((e) => e.id),
        }),
      });
    } catch (entErr) {
      console.warn('Could not create entitlements in webhook:', entErr.message);
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'ENTITLEMENT_CREATION_FAILED',
        rawPayload: JSON.stringify({ error: entErr.message }),
      });
    }

    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PAYMENT_SUCCESS_CONFIRMED',
      rawPayload: rawBody,
    });

    try {
      await provisionPortalAccessForPaidOrder(env, order, { source: 'CASHFREE_WEBHOOK' });
    } catch (bridgeErr) {
      console.warn('Portal bridge failed after verified PAID webhook:', bridgeErr?.message);
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'PORTAL_BRIDGE_UNHANDLED_ERROR',
        rawPayload: JSON.stringify({ source: 'CASHFREE_WEBHOOK', error: bridgeErr?.message || 'Unknown error' }),
      });
    }

      // Phase 10: Record promotional coupon redemption if order had coupon applied
      const couponCode = order.coupon_code || order.couponCode;
      if (couponCode) {
        try {
          await recordPromotionRedemption(env, {
            promotionCode: couponCode,
            orderId: order.id,
            customerId: order.customer_id || null,
            customerEmail: order.customer_email || null,
            discountPaise: order.discount_paise || order.discountPaise || 0,
          });
          await recordOrderEvent(env, {
            orderId: order.id,
            eventType: 'PROMOTION_REDEEMED',
            rawPayload: JSON.stringify({
              couponCode,
              discountPaise: order.discount_paise || order.discountPaise || 0,
            }),
          });
        } catch (promoErr) {
          console.warn('Could not record promotion redemption in webhook:', promoErr.message);
        }
      }

    // Phase 11: Record ORDER_PAID analytics event (idempotent, failure-isolated)
    try {
      const firstItem = Array.isArray(order.items) && order.items[0] ? order.items[0] : null;
      await recordAnalyticsEvent(env, {
        eventType: 'ORDER_PAID',
        orderId: order.id,
        customerId: order.customer_id || null,
        productId: firstItem ? (firstItem.productId || firstItem.bookId || firstItem.id) : null,
        metadata: {
          amountPaise: paidPaise || order.amount_paise,
          couponCode: couponCode || null,
        },
      });
    } catch (aErr) {
      console.warn('Analytics ORDER_PAID error (non-fatal):', aErr.message);
    }

    return new Response(
      JSON.stringify({ status: 'ok', order_id: order.id, order_status: 'PAID' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Handle failure and user dropped
  if (isPaymentFailed && order.status !== 'PAID') {
    await updateOrderStatus(env, order.id, 'FAILED');
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PAYMENT_FAILED',
      rawPayload: rawBody,
    });
    return new Response(
      JSON.stringify({ status: 'ok', order_id: order.id, order_status: 'FAILED' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (isUserDropped && order.status !== 'PAID') {
    await updateOrderStatus(env, order.id, 'USER_DROPPED');
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'USER_DROPPED',
      rawPayload: rawBody,
    });
    return new Response(
      JSON.stringify({ status: 'ok', order_id: order.id, order_status: 'USER_DROPPED' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Other events (e.g. general webhook notification)
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
