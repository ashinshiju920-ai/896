// functions/api/admin/orders/[id]/retry-fulfillment.js
// Admin Fulfillment Retry Endpoint — Phase 8
// Allows admin to safely retry digital entitlement creation for PAID orders.
// SECURITY RULES:
//   - Requires valid admin session (server-side)
//   - Only processes orders with status === 'PAID'
//   - Uses existing idempotent createEntitlementsForPaidOrder (no duplicates)
//   - Records audit event for the retry action
//   - Does NOT expose secrets, file keys, or internal errors

import { requireAdmin } from '../../../../utils/auth.js';
import { getOrder, createEntitlementsForPaidOrder, recordOrderEvent, recordAdminAuditEvent } from '../../../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Require admin authentication — server-side enforcement
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const orderId = params?.id ? String(params.id).trim() : null;
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing order ID.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 2. Fetch order and verify it exists
    const order = await getOrder(env, orderId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 3. SAFETY GATE: Only allow retry for PAID orders
    //    PENDING / FAILED / USER_DROPPED orders must NOT be fulfilled
    if (order.status !== 'PAID') {
      return new Response(
        JSON.stringify({
          error: `Fulfillment retry is only allowed for PAID orders. Current status: ${order.status}`,
          orderStatus: order.status,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 4. Run idempotent entitlement creation (from Phase 5 — no duplicates)
    let entitlements = [];
    let fulfillmentError = null;

    try {
      entitlements = await createEntitlementsForPaidOrder(env, order);
    } catch (entErr) {
      console.warn('Fulfillment retry error:', entErr.message);
      fulfillmentError = 'Fulfillment could not be completed.'; // safe message only
    }

    // 5. Record retry event in order_events
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'FULFILLMENT_RETRIED',
      rawPayload: JSON.stringify({
        entitlementCount: entitlements.length,
        success: !fulfillmentError,
      }),
    });

    // 6. Record admin audit event (action, target, identity — no secrets)
    await recordAdminAuditEvent(env, {
      action: 'ADMIN_RETRIED_FULFILLMENT',
      targetType: 'order',
      targetId: order.id,
      adminIdentity: 'admin',
      metadata: {
        orderId: order.id,
        entitlementCount: entitlements.length,
        success: !fulfillmentError,
      },
    });

    if (fulfillmentError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: fulfillmentError,
          orderId: order.id,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        entitlementCount: entitlements.length,
        // Return only safe entitlement summary — no file keys
        entitlements: entitlements.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          type: (e.add_on_id || e.addOnId) ? 'ADDON' : 'PRODUCT',
        })),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...cors,
        },
      }
    );
  } catch (err) {
    console.error('Admin retry-fulfillment error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error during fulfillment retry.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
