// functions/api/coupon/validate.js
// Customer-facing Server-Authoritative Coupon Validation & Discount Preview

import { computeOrderPrice } from '../../utils/pricing.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';
import { parseCookies, sha256Hex } from '../../utils/auth.js';
import { getCustomerSessionByTokenHash } from '../../utils/db.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || body.couponCode || '').trim();

    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Please enter a coupon code.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const cart = Array.isArray(body.cart) ? body.cart : [];
    if (cart.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Cart is empty.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Resolve customer session if logged in
    const cookies = parseCookies(request);
    let customerId = null;
    let customerEmail = null;
    if (cookies.customer_session) {
      try {
        const tokenHash = await sha256Hex(cookies.customer_session);
        const sessionData = await getCustomerSessionByTokenHash(env, tokenHash);
        if (sessionData && sessionData.customer) {
          customerId = sessionData.customer.id;
          customerEmail = sessionData.customer.email;
        }
      } catch {}
    }

    const pricing = await computeOrderPrice(
      {
        cart,
        couponCode: code,
        deliveryOption: body.deliveryOption || 'digital',
        customerId,
        customerEmail,
      },
      env
    );

    if (pricing.couponDiscountPaise > 0) {
      return new Response(
        JSON.stringify({
          valid: true,
          code: pricing.couponCode,
          discountRupees: pricing.couponDiscount,
          discountPaise: pricing.couponDiscountPaise,
          subtotalRupees: pricing.subtotal,
          subtotalPaise: pricing.subtotalPaise,
          totalRupees: pricing.total,
          totalPaise: pricing.totalPaise,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: false,
        error: pricing.couponError || 'Coupon is not valid for this order.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Coupon validation error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: err?.message || 'Coupon is not valid for this order.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
