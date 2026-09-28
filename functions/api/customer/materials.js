// functions/api/customer/materials.js
// Authenticated Customer Study Materials & Orders API
// Single-query JOIN execution optimized for Cloudflare Free plan

import { parseCookies, sha256Hex } from '../../utils/auth.js';
import {
  getCustomerSessionByTokenHash,
  getCustomerPaidOrders,
} from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Mandatory server-authoritative authentication via HTTP-only cookie
    const cookies = parseCookies(request);
    const token = cookies['customer_session'];

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required to access study materials.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const tokenHash = await sha256Hex(token);
    const sessionData = await getCustomerSessionByTokenHash(env, tokenHash);

    if (!sessionData || !sessionData.customer) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired customer session. Please sign in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const customer = sessionData.customer;

    // 2. Fetch paid orders. Digital content is accessed only through the external student portal.
    const paidOrders = await getCustomerPaidOrders(env, customer.id);
    const studentPortalUrl = (env && env.STUDENT_PORTAL_URL)
      ? String(env.STUDENT_PORTAL_URL).trim()
      : 'https://portal.aylemlearning.online/';

    // Format safe orders list
    const safeOrders = paidOrders.map((o) => ({
      id: o.id,
      date: o.created_at,
      total: o.total || Math.round((o.amount_paise || 0) / 100),
      currency: o.currency || 'INR',
      status: o.status,
      items: o.items || [],
    }));

    return new Response(
      JSON.stringify({
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        },
        materials: [],
        orders: safeOrders,
        googleSheetUrl: null,
        portalUrl: studentPortalUrl,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  } catch (err) {
    console.error('Customer materials retrieval error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error retrieving customer materials.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
