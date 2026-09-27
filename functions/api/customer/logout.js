// functions/api/customer/logout.js
// Customer Logout & Server-Side Session Revocation

import { parseCookies, sha256Hex } from '../../utils/auth.js';
import { revokeCustomerSession } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const cookies = parseCookies(request);
    const token = cookies['customer_session'];

    if (token) {
      const tokenHash = await sha256Hex(token);
      await revokeCustomerSession(env, tokenHash);
    }

    const clearCookie = `customer_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    return new Response(
      JSON.stringify({ success: true, message: 'Logged out successfully.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearCookie,
          ...cors,
        },
      }
    );
  } catch (err) {
    console.error('Customer logout error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error processing logout.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
