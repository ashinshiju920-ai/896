// functions/api/admin/reset-store-data.js
// Admin-only destructive reset for operational data: orders, analytics, entitlements, and delivery logs.

import { requireAdmin } from '../../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

const TABLES_TO_CLEAR = [
  'analytics_events',
  'meta_purchase_events',
  'order_events',
  'entitlements',
  'order_claims',
  'orders',
];

const KV_PREFIXES_TO_CLEAR = [
  'order:',
  'order_cf:',
  'entitlement:',
  'order_entitlements:',
  'customer_orders:',
  'order_claim:',
  'purchase_thank_you_email_sent:',
  'meta_purchase_sent:',
];

async function clearD1Table(env, table) {
  if (!env?.DB || typeof env.DB.prepare !== 'function') {
    return { table, skipped: true, reason: 'D1_NOT_CONFIGURED' };
  }

  try {
    const before = await env.DB.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
    await env.DB.prepare(`DELETE FROM ${table}`).run();
    return { table, deleted: Number(before?.count || 0) };
  } catch (err) {
    const message = err?.message || String(err);
    if (/no such table/i.test(message)) {
      return { table, skipped: true, reason: 'TABLE_NOT_FOUND' };
    }
    return { table, error: message };
  }
}

async function clearKvPrefix(env, prefix) {
  if (!env?.PRODUCTS_KV || typeof env.PRODUCTS_KV.list !== 'function' || typeof env.PRODUCTS_KV.delete !== 'function') {
    return { prefix, skipped: true, reason: 'KV_NOT_CONFIGURED' };
  }

  let cursor;
  let deleted = 0;
  do {
    const listed = await env.PRODUCTS_KV.list({ prefix, cursor });
    const keys = listed?.keys || [];
    for (const key of keys) {
      if (!key?.name) continue;
      await env.PRODUCTS_KV.delete(key.name);
      deleted += 1;
    }
    cursor = listed?.list_complete ? undefined : listed?.cursor;
  } while (cursor);

  return { prefix, deleted };
}

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed JSON payload.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    if (payload?.confirmation !== 'RESET') {
      return new Response(JSON.stringify({ error: 'Type RESET to confirm this destructive action.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const d1Results = [];
    for (const table of TABLES_TO_CLEAR) {
      d1Results.push(await clearD1Table(env, table));
    }

    const kvResults = [];
    for (const prefix of KV_PREFIXES_TO_CLEAR) {
      kvResults.push(await clearKvPrefix(env, prefix));
    }

    const hasD1Error = d1Results.some((r) => r.error);
    const totalD1Deleted = d1Results.reduce((sum, r) => sum + Number(r.deleted || 0), 0);
    const totalKvDeleted = kvResults.reduce((sum, r) => sum + Number(r.deleted || 0), 0);

    return new Response(
      JSON.stringify({
        success: !hasD1Error,
        resetAt: new Date().toISOString(),
        totals: {
          d1RowsDeleted: totalD1Deleted,
          kvKeysDeleted: totalKvDeleted,
        },
        d1: d1Results,
        kv: kvResults,
      }),
      {
        status: hasD1Error ? 207 : 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          ...cors,
        },
      }
    );
  } catch (err) {
    console.error('Admin reset-store-data error:', err);
    return new Response(JSON.stringify({ error: 'Internal error resetting store data.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
