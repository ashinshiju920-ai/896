// functions/api/customer/activate-after-purchase.js
// Secure Post-Payment Account Creation & Verified Order Linking Endpoint
// Validates cryptographic one-time claim secret, enforces PAID status, and creates authenticated session

import {
  hashPassword,
  generateRandomToken,
  sha256Hex,
  timingSafeEqual,
  parseCookies,
} from '../../utils/auth.js';
import {
  getOrder,
  getOrderClaim,
  consumeOrderClaim,
  createCustomer,
  getCustomerByEmail,
  linkOrderToCustomer,
  createCustomerSession,
} from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';
import { checkRateLimit } from '../../utils/rateLimit.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Rate Limiting: Max 10 activation attempts per IP per 10 minutes
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = await checkRateLimit(env, `cust_activate:${clientIp}`, 10, 600);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait a few minutes before trying again.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds || 600),
            ...cors,
          },
        }
      );
    }

    // 2. Parse request payload
    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request format.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';
    const claimSecretParam = typeof body?.claimSecret === 'string' ? body.claimSecret.trim() : '';

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Please enter your full name (minimum 2 characters).' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (password !== confirmPassword) {
      return new Response(
        JSON.stringify({ error: 'Passwords do not match.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 3. Extract claim secret from HTTP-Only cookie or body fallback
    const cookies = parseCookies(request);
    let rawClaimSecret = claimSecretParam;

    if (!rawClaimSecret) {
      const claimCookie = cookies['order_claim'] || cookies[`order_claim_${orderId}`];
      if (claimCookie) {
        if (claimCookie.includes(':')) {
          const [cookieOrderId, cookieSecret] = claimCookie.split(':');
          if (cookieOrderId === orderId) {
            rawClaimSecret = cookieSecret;
          }
        } else {
          rawClaimSecret = claimCookie;
        }
      }
    }

    if (!rawClaimSecret) {
      return new Response(
        JSON.stringify({ error: 'Access denied: missing or invalid post-payment activation claim.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 4. Verify post-payment claim in D1 / KV
    const claimRecord = await getOrderClaim(env, orderId);
    if (!claimRecord) {
      return new Response(
        JSON.stringify({ error: 'Access denied: no activation claim found for this order.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (claimRecord.consumed_at) {
      return new Response(
        JSON.stringify({ error: 'This activation link has already been used. Please sign in to your account.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const nowIso = new Date().toISOString();
    if (claimRecord.expires_at < nowIso) {
      return new Response(
        JSON.stringify({ error: 'Activation link has expired. Please contact support or sign in.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const computedClaimHash = await sha256Hex(rawClaimSecret);
    const isClaimValid = timingSafeEqual(
      computedClaimHash.trim().toLowerCase(),
      claimRecord.claim_hash.trim().toLowerCase()
    );

    if (!isClaimValid) {
      return new Response(
        JSON.stringify({ error: 'Access denied: invalid activation claim secret.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 5. Verify associated order
    const order = await getOrder(env, orderId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // MANDATORY SECURITY GATE: Only PAID orders can activate accounts and link entitlements!
    if (order.status !== 'PAID') {
      return new Response(
        JSON.stringify({ error: 'Order payment has not been confirmed. Account activation requires a verified PAID order.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const checkoutEmail = (order.customer_email || order.shipping?.email || '').trim().toLowerCase();
    if (!checkoutEmail) {
      return new Response(
        JSON.stringify({ error: 'No verified customer email associated with this order.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 6. Check if order is already linked to another customer
    if (order.customer_id) {
      return new Response(
        JSON.stringify({ error: 'This order is already linked to an existing account. Please sign in.' }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 7. Check if account with checkout email already exists (Section 21)
    const existingCustomer = await getCustomerByEmail(env, checkoutEmail);
    if (existingCustomer) {
      return new Response(
        JSON.stringify({
          error: 'An account already exists for this email. Sign in to continue.',
          accountExists: true,
          email: checkoutEmail,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 8. Create Customer with Web Crypto PBKDF2 hash & unique salt
    const salt = generateRandomToken(16);
    const passwordHash = await hashPassword(password, salt);

    let customer;
    try {
      customer = await createCustomer(env, {
        email: checkoutEmail,
        name,
        phone: order.customer_phone || order.shipping?.phone || '',
        passwordHash,
        passwordSalt: salt,
      });
    } catch (createErr) {
      if (createErr?.message && createErr.message.includes('UNIQUE')) {
        return new Response(
          JSON.stringify({
            error: 'An account already exists for this email. Sign in to continue.',
            accountExists: true,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
      throw createErr;
    }

    // 9. Link verified order to newly created customer
    await linkOrderToCustomer(env, order.id, customer.id);

    // 10. Mark claim as consumed atomically
    await consumeOrderClaim(env, order.id);

    // 11. Create authenticated customer session (7 days = 604800s)
    const rawSessionToken = generateRandomToken(32);
    const tokenHash = await sha256Hex(rawSessionToken);
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    await createCustomerSession(env, {
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    const isProd = Boolean(
      (env && env.CASHFREE_ENV === 'PRODUCTION') ||
      request.url.startsWith('https://')
    );

    const sessionCookie = `customer_session=${rawSessionToken}; HttpOnly; ${isProd ? 'Secure;' : ''} SameSite=Lax; Path=/; Max-Age=604800`;
    const clearClaimCookie = `order_claim=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      ...cors,
    });
    responseHeaders.append('Set-Cookie', sessionCookie);
    responseHeaders.append('Set-Cookie', clearClaimCookie);

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
        },
        orderId: order.id,
        message: 'Account created successfully! Your verified purchase is linked.',
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (err) {
    console.error('Account activation error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error activating account after purchase.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
