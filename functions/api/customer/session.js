// functions/api/customer/session.js
// Resolves Authenticated Customer Session via HTTP-Only Cookie
// Highly optimized for Cloudflare Free plan: 0 writes on read

import { parseCookies, sha256Hex } from '../../utils/auth.js';
import { getCustomerSessionByTokenHash } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const cookies = parseCookies(request);
    const token = cookies['customer_session'];

    if (!token) {
      return new Response(
        JSON.stringify({ authenticated: false }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const tokenHash = await sha256Hex(token);
    const sessionData = await getCustomerSessionByTokenHash(env, tokenHash);

    if (!sessionData || !sessionData.customer) {
      return new Response(
        JSON.stringify({ authenticated: false }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Return safe customer profile (never expose password hash or raw session token)
    return new Response(
      JSON.stringify({
        authenticated: true,
        customer: {
          id: sessionData.customer.id,
          name: sessionData.customer.name,
          email: sessionData.customer.email,
          phone: sessionData.customer.phone || '',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  } catch (err) {
    console.error('Customer session check error:', err);
    return new Response(
      JSON.stringify({ authenticated: false, error: 'Session check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
