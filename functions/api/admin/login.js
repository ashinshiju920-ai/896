// functions/api/admin/login.js
import { hashPassword, createSessionToken } from '../../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitKey = `ratelimit:login:${ip}`;

  // Rate Limiting: Max 5 failed attempts per IP per 15 minutes
  let attempts = 0;
  if (env && env.PRODUCTS_KV) {
    try {
      const raw = await env.PRODUCTS_KV.get(rateLimitKey);
      if (raw) attempts = parseInt(raw, 10) || 0;
      if (attempts >= 5) {
        return new Response(
          JSON.stringify({ error: 'Too many failed login attempts. Please try again in 15 minutes.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '900',
              ...cors,
            },
          }
        );
      }
    } catch {}
  }

  // Artificial delay to prevent timing and rapid brute-force attacks
  await new Promise((resolve) => setTimeout(resolve, 500));

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const password = body?.password;
  if (!password || typeof password !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Password is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  const storedHash = env?.ADMIN_PASSWORD_HASH;
  const salt = env?.ADMIN_PASSWORD_SALT;
  const sessionSecret = env?.ADMIN_SESSION_SECRET || storedHash;

  if (!storedHash || !salt || !sessionSecret) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error: Admin credentials not configured in environment.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  const computedHash = await hashPassword(password, salt);

  // Constant-time hash comparison
  const cleanStored = storedHash.trim().toLowerCase();
  const cleanComputed = computedHash.trim().toLowerCase();
  let mismatch = cleanStored.length !== cleanComputed.length;
  for (let i = 0; i < cleanComputed.length; i++) {
    if (cleanComputed.charCodeAt(i) !== cleanStored.charCodeAt(i)) {
      mismatch = true;
    }
  }

  if (mismatch) {
    if (env && env.PRODUCTS_KV) {
      try {
        await env.PRODUCTS_KV.put(rateLimitKey, String(attempts + 1), {
          expirationTtl: 900,
        });
      } catch {}
    }

    return new Response(
      JSON.stringify({ error: 'Invalid credentials. Please try again.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  // Clear rate limit counter on successful login
  if (env && env.PRODUCTS_KV && attempts > 0) {
    try {
      await env.PRODUCTS_KV.delete(rateLimitKey);
    } catch {}
  }

  // Generate 8-hour HMAC signed session token
  const exp = Math.floor(Date.now() / 1000) + 28800;
  const token = await createSessionToken({ role: 'admin', exp }, sessionSecret);

  const cookieVal = `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;

  return new Response(
    JSON.stringify({ success: true, message: 'Authenticated' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieVal,
        ...cors,
      },
    }
  );
}
