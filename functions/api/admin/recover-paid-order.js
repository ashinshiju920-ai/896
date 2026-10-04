// functions/api/admin/recover-paid-order.js
// Protected production admin endpoint for safe paid order discovery, verification & recovery

import { getOrder, saveOrder, updateOrderStatus, recordOrderEvent } from '../../utils/db.js';
import { provisionPortalAccessForPaidOrder, recoverProductFromCashfreeOrder } from '../../utils/portalBridge.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

function verifyAdminAuth(request, env) {
  const integrationSecret = env && env.MAIN_SITE_INTEGRATION_SECRET
    ? String(env.MAIN_SITE_INTEGRATION_SECRET).trim()
    : '';

  if (!integrationSecret) return false;

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const xSecret = request.headers.get('x-admin-secret') || '';

  return token === integrationSecret || xSecret === integrationSecret;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return handleOptions(request, env);
  }

  if (!verifyAdminAuth(request, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized. Valid secret required.' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  const url = new URL(request.url, 'http://localhost');
  const action = url.searchParams.get('action') || 'check-d1';

  const secretKey = env && env.CASHFREE_SECRET_KEY ? String(env.CASHFREE_SECRET_KEY).trim() : '';
  const appId = env && env.CASHFREE_APP_ID ? String(env.CASHFREE_APP_ID).trim() : '';
  const configuredEnv = env && env.CASHFREE_ENV ? String(env.CASHFREE_ENV).trim().toUpperCase() : '';
  const isProd = secretKey.startsWith('cfsk_ma_prod_') || configuredEnv === 'PRODUCTION';
  const baseUrl = (env && env.CASHFREE_BASE_URL) || (isProd
    ? 'https://api.cashfree.com/pg/orders'
    : 'https://sandbox.cashfree.com/pg/orders');

  // ACTION 1: Check D1 database binding and reachable tables
  if (action === 'check-d1') {
    const isD1Function = Boolean(env.DB && typeof env.DB.prepare === 'function');
    let ordersCount = null;
    let eventsCount = null;
    let error = null;

    if (isD1Function) {
      try {
        const oRow = await env.DB.prepare('SELECT COUNT(*) as cnt FROM orders').first();
        ordersCount = oRow ? oRow.cnt : null;
        const eRow = await env.DB.prepare('SELECT COUNT(*) as cnt FROM order_events').first();
        eventsCount = eRow ? eRow.cnt : null;
      } catch (err) {
        error = err.message;
      }
    }

    return new Response(
      JSON.stringify({
        hasD1Binding: isD1Function,
        d1Type: typeof env.DB,
        ordersCount,
        eventsCount,
        dbError: error,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  // ACTION 2: List recent Cashfree orders to find the real transaction
  if (action === 'list') {
    if (!secretKey || !appId) {
      return new Response(
        JSON.stringify({ error: 'Cashfree credentials not configured in environment.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    try {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const cfRes = await fetch(`${cleanBase}?limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': appId,
          'x-client-secret': secretKey,
        },
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        return new Response(
          JSON.stringify({ error: 'Cashfree API returned error', status: cfRes.status, body: errText }),
          { status: cfRes.status, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      const cfData = await cfRes.json();
      return new Response(
        JSON.stringify({ orders: cfData }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
  }

  // ACTION 3: Query and inspect single Cashfree order
  if (action === 'inspect') {
    const orderId = url.searchParams.get('order_id');
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    try {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const cfRes = await fetch(`${cleanBase}/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': appId,
          'x-client-secret': secretKey,
        },
      });

      const cfData = await cfRes.json();
      const localOrder = await getOrder(env, orderId);
      const recoverableItem = await recoverProductFromCashfreeOrder(cfData, env);

      return new Response(
        JSON.stringify({
          cashfreeStatus: cfRes.status,
          cashfreeOrder: cfData,
          localOrderFound: Boolean(localOrder),
          localOrderStatus: localOrder?.status || null,
          recoverableItem,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
  }

  // ACTION 4: Authoritatively recover paid order & invoke portal bridge
  if (action === 'recover') {
    const orderId = url.searchParams.get('order_id');
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    try {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const cfRes = await fetch(`${cleanBase}/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': appId,
          'x-client-secret': secretKey,
        },
      });

      if (!cfRes.ok) {
        return new Response(
          JSON.stringify({ error: 'Order not found at Cashfree', status: cfRes.status }),
          { status: cfRes.status, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      const cfData = await cfRes.json();
      const cfOrderStatus = String(cfData?.order_status || '').toUpperCase();

      if (cfOrderStatus !== 'PAID') {
        return new Response(
          JSON.stringify({
            error: 'Order is not marked as PAID at Cashfree',
            cashfreeStatus: cfOrderStatus,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      // Recover product authoritatively
      const recoveredItem = await recoverProductFromCashfreeOrder(cfData, env);
      if (!recoveredItem) {
        return new Response(
          JSON.stringify({
            error: 'PAID ORDER VERIFIED — PRODUCT MAPPING REQUIRES SAFE RECOVERY',
            details: 'Could not authoritatively map Cashfree order metadata to catalog course without guessing.',
            orderNote: cfData?.order_note || null,
            orderTags: cfData?.order_tags || null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      const paidPaise = Math.round(Number(cfData.order_amount) * 100);
      const customerDetails = cfData.customer_details || {};
      const recoveredOrder = {
        id: orderId,
        cf_order_id: orderId,
        customer_id: customerDetails.customer_id || null,
        amount_paise: paidPaise,
        currency: cfData.order_currency || 'INR',
        status: 'PAID',
        customer_name: customerDetails.customer_name || 'Valued Customer',
        customer_email: customerDetails.customer_email || '',
        customer_phone: customerDetails.customer_phone || '',
        shipping: {
          fullName: customerDetails.customer_name || 'Valued Customer',
          email: customerDetails.customer_email || '',
          phone: customerDetails.customer_phone || '',
          deliveryOption: recoveredItem.format || 'digital',
        },
        items: [recoveredItem],
        coupon_code: null,
        discount_paise: 0,
        subtotal_paise: paidPaise,
        shipping_paise: 0,
        total_paise: paidPaise,
      };

      await saveOrder(env, recoveredOrder);
      await recordOrderEvent(env, {
        orderId,
        eventType: 'ADMIN_MANUAL_RECOVER_PAID_ORDER',
        rawPayload: JSON.stringify({
          cfOrderId: orderId,
          orderAmount: cfData.order_amount,
          customerEmail: customerDetails.customer_email,
          recoveredProduct: recoveredItem.title,
        }),
      });

      // Invoke portal bridge
      const bridgeResult = await provisionPortalAccessForPaidOrder(env, recoveredOrder, {
        source: 'ADMIN_RECOVER_ORDER',
      });

      return new Response(
        JSON.stringify({
          success: true,
          orderId,
          status: 'PAID',
          amount: cfData.order_amount,
          currency: cfData.order_currency,
          customerEmail: customerDetails.customer_email,
          recoveredProduct: recoveredItem,
          bridgeResult,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: `Unknown action: ${action}` }),
    { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
  );
}
