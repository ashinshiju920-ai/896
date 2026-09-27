// functions/api/admin/dashboard.js
// Admin Dashboard Statistics API — Phase 8
// Returns consolidated stats in a single request to minimize D1 queries on Cloudflare Free plan.
// SECURITY: Requires admin authentication.

import { requireAdmin } from '../../utils/auth.js';
import { getDashboardStats } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Admin authentication required
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    // 2. Fetch consolidated dashboard stats (single D1 query + one fulfillment query)
    const stats = await getDashboardStats(env);

    // Format revenue as display values (keeping paise for precision)
    const paidRevenue = Math.round(stats.paidRevenuePaise / 100);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalOrders: stats.totalOrders,
          paidOrders: stats.paidOrders,
          pendingOrders: stats.pendingOrders,
          failedOrders: stats.failedOrders,
          userDroppedOrders: stats.userDroppedOrders,
          paidRevenuePaise: stats.paidRevenuePaise,
          paidRevenue,
          fulfillmentIssues: stats.fulfillmentIssues,
        },
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
    console.error('Admin dashboard stats error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error fetching dashboard statistics.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
