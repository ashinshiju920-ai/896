// functions/api/customer/login.js
// Customer Email & Password Authentication Endpoint
// Enforces PBKDF2 verification, constant-time checks, KV rate limiting, and HTTP-only sessions

import { hashPassword, generateRandomToken, sha256Hex, timingSafeEqual } from '../../utils/auth.js';
import { getCustomerByEmail, createCustomerSession } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';
import { checkRateLimit } from '../../utils/rateLimit.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Rate Limiting: Max 5 failed login attempts per IP per 15 minutes (900 seconds)
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = await checkRateLimit(env, `cust_login:${clientIp}`, 5, 900);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Please wait 15 minutes before trying again.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds || 900),
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

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 3. Artificial micro-delay to prevent timing analysis & rapid brute-forcing
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. Retrieve customer record by email
    const customer = await getCustomerByEmail(env, email);
    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Email or password is incorrect.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (customer.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: 'Your account is suspended. Please contact support.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 5. Verify password with customer's unique salt
    const computedHash = await hashPassword(password, customer.password_salt);
    const isValid = timingSafeEqual(
      computedHash.trim().toLowerCase(),
      customer.password_hash.trim().toLowerCase()
    );

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Email or password is incorrect.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 6. Generate cryptographically random session token (32 bytes = 64 hex chars)
    const rawSessionToken = generateRandomToken(32);
    const tokenHash = await sha256Hex(rawSessionToken);

    // 7. Store session in D1 (7 days lifetime = 604800 seconds)
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    await createCustomerSession(env, {
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    // 8. Determine environment and set HTTP-only cookie
    const isProd = Boolean(
      (env && env.CASHFREE_ENV === 'PRODUCTION') ||
      request.url.startsWith('https://')
    );

    const sessionCookie = `customer_session=${rawSessionToken}; HttpOnly; ${isProd ? 'Secure;' : ''} SameSite=Lax; Path=/; Max-Age=604800`;

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': sessionCookie,
          ...cors,
        },
      }
    );
  } catch (err) {
    console.error('Customer login error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error processing sign in request.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
