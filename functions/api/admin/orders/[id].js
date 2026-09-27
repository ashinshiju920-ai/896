// functions/api/admin/orders/[id].js
// Admin Order Detail API — Phase 8
// Returns full order detail: order, customer (safe), items (historical), reconciliation, fulfillment, events.
// SECURITY: Requires valid admin session. Never exposes passwords, session tokens, secrets, claim tokens.

import { requireAdmin } from '../../../utils/auth.js';
import { getOrderDetail } from '../../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Admin authentication required
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    // 2. Extract order ID from URL path param
    const orderId = params?.id ? String(params.id).trim() : null;
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing order ID.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 3. Fetch full order detail (customer, items, reconciliation, fulfillment, events)
    const detail = await getOrderDetail(env, orderId);

    if (!detail) {
      return new Response(
        JSON.stringify({ error: 'Order not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ...detail }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          ...cors,
        },
      }
    );
  } catch (err) {
    console.error('Admin order detail error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error fetching order detail.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
