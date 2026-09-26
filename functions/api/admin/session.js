// functions/api/admin/session.js
import { verifySessionToken } from '../../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);
  const secret = env?.ADMIN_SESSION_SECRET || env?.ADMIN_PASSWORD_HASH;

  if (!secret) {
    return new Response(
      JSON.stringify({ authenticated: false }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf('=');
        if (idx === -1) return [c, ''];
        return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
      })
  );

  const token = cookies['admin_session'];
  if (!token) {
    return new Response(
      JSON.stringify({ authenticated: false }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  const session = await verifySessionToken(token, secret);
  const isAuthenticated = Boolean(session && session.role === 'admin');

  return new Response(
    JSON.stringify({ authenticated: isAuthenticated }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    }
  );
}
