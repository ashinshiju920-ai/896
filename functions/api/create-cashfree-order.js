// functions/api/create-cashfree-order.js
// Server-Authoritative Cashfree Order Creation Endpoint
// Hardened with strict CORS, KV rate limiting, and sanitized error responses

import { computeOrderPrice, validateShippingInfo } from '../utils/pricing.js';
import { saveOrder } from '../utils/db.js';
import { getCorsHeaders, handleOptions } from '../utils/cors.js';
import { checkRateLimit } from '../utils/rateLimit.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  const secretKey = env && env.CASHFREE_SECRET_KEY ? String(env.CASHFREE_SECRET_KEY).trim() : '';
  const appId = env && env.CASHFREE_APP_ID ? String(env.CASHFREE_APP_ID).trim() : '';
  const configuredEnv = env && env.CASHFREE_ENV ? String(env.CASHFREE_ENV).trim().toUpperCase() : '';

  const isProd = secretKey.startsWith('cfsk_ma_prod_') || configuredEnv === 'PRODUCTION';

  return new Response(
    JSON.stringify({
      status: 'active',
      endpoint: '/api/create-cashfree-order',
      mode: isProd ? 'production' : 'sandbox',
      hasSecretKey: Boolean(secretKey),
      hasAppId: Boolean(appId),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'OPTIONS') return onRequestOptions(context);
  if (method === 'POST') return onRequestPost(context);
  if (method === 'GET') return onRequestGet(context);
  return new Response('Method not allowed', {
    status: 405,
    headers: getCorsHeaders(context.request, context.env),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Rate Limiting (Phase 5.3): Max 20 order attempts per IP per 10 minutes
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = await checkRateLimit(env, `order:${clientIp}`, 20, 600);

    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many order requests. Please wait a few minutes before trying again.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds || 600),
            ...corsHeaders,
          },
        }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // NON-NEGOTIABLE RULE 3: Reject any request attempting to send prices, amounts, or totals.
    const forbiddenKeys = [
      'requestedAmount',
      'price',
      'total',
      'amount',
      'orderAmount',
      'order_amount',
      'discount',
      'couponDiscount',
      'subtotal',
    ];

    for (const key of forbiddenKeys) {
      if (key in body) {
        return new Response(
          JSON.stringify({
            error: `Price tampering detected: browser may never provide '${key}'. Server is authoritative.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    if (Array.isArray(body.cart)) {
      for (const item of body.cart) {
        if (!item || typeof item !== 'object') continue;
        for (const key of forbiddenKeys) {
          if (key in item) {
            return new Response(
              JSON.stringify({
                error: `Price tampering detected: cart item contains forbidden key '${key}'.`,
              }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
        }
      }
    }

    const {
      cart = [],
      couponCode = null,
      shippingInfo = {},
      deliveryOption = 'digital',
    } = body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Cart cannot be empty.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check credentials (Rule 2: No hardcoded fallback secrets)
    const secretKey = env && env.CASHFREE_SECRET_KEY ? String(env.CASHFREE_SECRET_KEY).trim() : '';
    const appId = env && env.CASHFREE_APP_ID ? String(env.CASHFREE_APP_ID).trim() : '';
    const configuredEnv = env && env.CASHFREE_ENV ? String(env.CASHFREE_ENV).trim().toUpperCase() : '';

    if (!secretKey || !appId) {
      console.error('CASHFREE_SECRET_KEY or CASHFREE_APP_ID missing in environment');
      return new Response(
        JSON.stringify({
          error: 'Payment gateway configuration is unavailable. Please contact administrator.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 2. Authoritative price calculation from KV catalogue
    let pricing;
    try {
      pricing = await computeOrderPrice(
        {
          cart,
          couponCode,
          deliveryOption,
        },
        env
      );
    } catch (pricingErr) {
      return new Response(
        JSON.stringify({ error: pricingErr.message || 'Pricing computation failed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 3. Validate customer & shipping details
    const shippingValidation = validateShippingInfo(shippingInfo, pricing.hasPhysical);
    if (!shippingValidation.isValid) {
      return new Response(
        JSON.stringify({
          error: `Shipping validation failed: ${shippingValidation.errors.join(' ')}`,
          errors: shippingValidation.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const cleanShipping = shippingValidation.clean;

    // Auto-detect Production vs Sandbox
    let isProd = false;
    if (secretKey.startsWith('cfsk_ma_prod_')) {
      isProd = true;
    } else if (secretKey.startsWith('cfsk_ma_test_') || appId.toUpperCase().startsWith('TEST')) {
      isProd = false;
    } else {
      isProd = configuredEnv === 'PRODUCTION';
    }

    const cashfreeUrl = (env && env.CASHFREE_BASE_URL) || (isProd
      ? 'https://api.cashfree.com/pg/orders'
      : 'https://sandbox.cashfree.com/pg/orders');

    // Generate unique order ID
    const timestamp = Math.round(Date.now() / 1000);
    const orderId = `order_${timestamp}_${Math.floor(1000 + Math.random() * 9000)}`;
    const customerId = `cust_${cleanShipping.phone}_${timestamp % 10000}`;

    // 4. Write PENDING order row to D1 / KV BEFORE calling Cashfree
    await saveOrder(env, {
      id: orderId,
      cf_order_id: orderId,
      amount_paise: pricing.totalPaise,
      currency: 'INR',
      status: 'PENDING',
      customer_name: cleanShipping.fullName,
      customer_email: cleanShipping.email,
      customer_phone: cleanShipping.phone,
      shipping: cleanShipping,
      items: pricing.items,
    });

    // Build return URL
    const requestOrigin = new URL(request.url).origin;
    const returnUrl = `${requestOrigin}/?order_id={order_id}&cf_status={order_status}`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: pricing.total,
      order_currency: 'INR',
      customer_details: {
        customer_id: customerId,
        customer_name: cleanShipping.fullName,
        customer_email: cleanShipping.email,
        customer_phone: cleanShipping.phone,
      },
      order_meta: {
        return_url: returnUrl,
      },
      order_note: `Xylem Learning - ${pricing.items[0]?.title ? pricing.items[0].title.slice(0, 35) : 'Exam Study Guide'}`,
      order_tags: {
        product_count: String(pricing.items.length),
        delivery_option: cleanShipping.deliveryOption,
      },
    };

    const cfResponse = await fetch(cashfreeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
      },
      body: JSON.stringify(cashfreePayload),
    });

    const result = await cfResponse.json();

    if (!cfResponse.ok || !result.payment_session_id) {
      console.error('Cashfree order creation error response:', result);
      return new Response(
        JSON.stringify({
          error: 'Unable to initiate order payment with gateway. Please try again later.',
        }),
        {
          status: cfResponse.status || 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: result.order_id || orderId,
        order_id: result.order_id || orderId,
        paymentSessionId: result.payment_session_id,
        payment_session_id: result.payment_session_id,
        orderAmount: pricing.total,
        order_amount: pricing.total,
        orderCurrency: 'INR',
        environment: isProd ? 'production' : 'sandbox',
        isProd,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('Internal order creation error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error processing checkout order.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
