// functions/api/admin/orders.js
// Admin-Protected Paginated Orders Endpoint

import { requireAdmin } from '../../utils/auth.js';
import { listOrders } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Enforce admin authentication
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    // 2. Parse pagination query params
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const status = url.searchParams.get('status') || null;

    // 3. Query orders from D1 (with KV fallback)
    const result = await listOrders(env, { page, limit, status });

    return new Response(
      JSON.stringify({
        success: true,
        orders: result.orders,
        pagination: result.pagination,
      }),
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
    console.error('Admin orders listing error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error listing orders.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...cors,
        },
      }
    );
  }
}
