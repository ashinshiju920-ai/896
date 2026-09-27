// functions/api/admin/orders.js
// Admin-Protected Paginated Orders Endpoint — Phase 8
// Supports: server-side pagination, status filtering, server-side search.
// Search fields: order ID, Cashfree order ID, Cashfree payment ID, customer email, customer name.
// All queries use parameterized statements — no SQL injection via user input.

import { requireAdmin } from '../../utils/auth.js';
import { listOrdersWithSearch } from '../../utils/db.js';
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

    // 2. Parse pagination + filter + search query params
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // Status filter: accept 'all' as no filter
    const rawStatus = url.searchParams.get('status') || null;
    const status = rawStatus === 'all' ? null : rawStatus;

    // Server-side search (parameterized — user input never interpolated into SQL)
    const rawSearch = url.searchParams.get('search') || '';
    const search = rawSearch.trim().slice(0, 200); // max 200 chars to prevent abuse

    // 3. Query orders from D1 with search and filter
    const result = await listOrdersWithSearch(env, { page, limit, status, search: search || null });

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
