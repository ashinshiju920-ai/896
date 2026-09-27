// functions/api/admin/analytics.js
// Admin-Protected Analytics & Sales Funnel Reporting API — Phase 11
// SECURITY: Requires verified admin authentication.
// Returns consolidated metrics in a single efficient SQL aggregation query.

import { requireAdmin } from '../../utils/auth.js';
import { getAnalyticsDashboardData } from '../../utils/db.js';
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

    // 2. Parse query parameters
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || '7d';
    const startDate = url.searchParams.get('startDate') || url.searchParams.get('start') || null;
    const endDate = url.searchParams.get('endDate') || url.searchParams.get('end') || null;

    // 3. Fetch consolidated dashboard data
    const data = await getAnalyticsDashboardData(env, {
      filter,
      startDate,
      endDate,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        ...cors,
      },
    });
  } catch (err) {
    console.error('Admin analytics reporting error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error fetching analytics data.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
