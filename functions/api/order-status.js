// functions/api/order-status.js
// Server-Side Cashfree Order Verification & Fulfillment Gate

import { getOrder, updateOrderStatus, saveOrder, recordOrderEvent } from '../utils/db.js';
import { getCorsHeaders, handleOptions } from '../utils/cors.js';
import { provisionPortalAccessForPaidOrder, recoverProductFromCashfreeOrder } from '../utils/portalBridge.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const url = new URL(request.url, 'http://localhost');
    const orderId = url.searchParams.get('order_id') || url.searchParams.get('orderId');

    if (!orderId || typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing order_id parameter.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const cleanOrderId = orderId.trim();

    const secretKey = env && env.CASHFREE_SECRET_KEY ? String(env.CASHFREE_SECRET_KEY).trim() : '';
    const appId = env && env.CASHFREE_APP_ID ? String(env.CASHFREE_APP_ID).trim() : '';
    const configuredEnv = env && env.CASHFREE_ENV ? String(env.CASHFREE_ENV).trim().toUpperCase() : '';
    const isProd = secretKey.startsWith('cfsk_ma_prod_') || configuredEnv === 'PRODUCTION';
    const baseUrl = (env && env.CASHFREE_BASE_URL) || (isProd
      ? 'https://api.cashfree.com/pg/orders'
      : 'https://sandbox.cashfree.com/pg/orders');

    // 1. Look up order in D1 / KV
    let order = await getOrder(env, cleanOrderId);
    let paidConfirmedByCashfree = false;

    // 1b. If not found in local storage, query Cashfree server-to-server for safe recovery
    if (!order && secretKey && appId) {
      try {
        const cfRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(cleanOrderId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-version': '2023-08-01',
            'x-client-id': appId,
            'x-client-secret': secretKey,
          },
        });

        if (cfRes.ok) {
          const cfData = await cfRes.json();
          const cfOrderStatus = String(cfData?.order_status || '').toUpperCase();

          if (cfOrderStatus === 'PAID') {
            const recoveredItem = await recoverProductFromCashfreeOrder(cfData, env);
            if (recoveredItem) {
              const paidPaise = Math.round(Number(cfData.order_amount) * 100);
              const customerDetails = cfData.customer_details || {};
              const recoveredOrder = {
                id: cleanOrderId,
                cf_order_id: cleanOrderId,
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

              try {
                await saveOrder(env, recoveredOrder);
                await recordOrderEvent(env, {
                  orderId: cleanOrderId,
                  eventType: 'ORDER_RECOVERED_FROM_CASHFREE',
                  rawPayload: JSON.stringify({
                    cfOrderId: cleanOrderId,
                    orderAmount: cfData.order_amount,
                    customerEmail: customerDetails.customer_email,
                    recoveredProduct: recoveredItem.title,
                  }),
                });
              } catch (persistErr) {
                console.error('Failed to persist recovered order to DB:', persistErr?.message);
              }

              order = recoveredOrder;
              paidConfirmedByCashfree = true;
            } else {
              console.warn(`Paid order ${cleanOrderId} verified at Cashfree but product could not be authoritatively recovered.`);
              return new Response(
                JSON.stringify({
                  status: 'PAID_PRODUCT_INDETERMINATE',
                  orderId: cleanOrderId,
                  error: 'PAID ORDER VERIFIED — PRODUCT MAPPING REQUIRES SAFE RECOVERY',
                }),
                { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
              );
            }
          }
        }
      } catch (recoveryErr) {
        console.warn('Could not query Cashfree for missing order recovery:', recoveryErr?.message);
      }
    }

    if (!order) {
      return new Response(
        JSON.stringify({
          status: 'NOT_FOUND',
          orderId: cleanOrderId,
          items: [],
          error: 'Order not found in database.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 2. If status is not yet PAID, query Cashfree Get Order API server-side
    if (order.status !== 'PAID' && secretKey && appId) {
      try {
        const configuredEnv = env && env.CASHFREE_ENV ? String(env.CASHFREE_ENV).trim().toUpperCase() : '';
        const isProd = secretKey.startsWith('cfsk_ma_prod_') || configuredEnv === 'PRODUCTION';
        const baseUrl = (env && env.CASHFREE_BASE_URL) || (isProd
          ? 'https://api.cashfree.com/pg/orders'
          : 'https://sandbox.cashfree.com/pg/orders');

        const cfOrderId = order.cf_order_id || order.id;
        const cfRes = await fetch(`${baseUrl}/${encodeURIComponent(cfOrderId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-version': '2023-08-01',
            'x-client-id': appId,
            'x-client-secret': secretKey,
          },
        });

        if (cfRes.ok) {
          const cfData = await cfRes.json();
          const cfOrderStatus = String(cfData?.order_status || '').toUpperCase();
          if (cfData && cfOrderStatus === 'PAID') {
            const paidPaise = Math.round(Number(cfData.order_amount) * 100);
            if (Math.abs(order.amount_paise - paidPaise) <= 1) {
              await updateOrderStatus(env, order.id, 'PAID');
              order.status = 'PAID';
              paidConfirmedByCashfree = true;
            }
          } else if (['FAILED', 'EXPIRED', 'TERMINATED', 'CANCELLED', 'CANCELED'].includes(cfOrderStatus)) {
            await updateOrderStatus(env, order.id, 'FAILED');
            order.status = 'FAILED';
          } else if (['USER_DROPPED', 'DROPPED'].includes(cfOrderStatus)) {
            await updateOrderStatus(env, order.id, 'USER_DROPPED');
            order.status = 'USER_DROPPED';
          }
        }
      } catch (cfFetchErr) {
        console.warn('Could not query Cashfree order status:', cfFetchErr.message);
      }
    }

    const studentPortalUrl = 'https://portal.aylemlearning.online/';

    // 3. Return ONLY verified, non-internal fields.
    // Digital content is now accessed exclusively through the external student portal.
    if (order.status === 'PAID') {
      try {
        await provisionPortalAccessForPaidOrder(env, order, { source: 'ORDER_STATUS_PAID_VERIFY' });
      } catch (bridgeErr) {
        console.warn('Portal bridge invocation error in order-status:', bridgeErr?.message);
      }

      return new Response(
        JSON.stringify({
          status: 'PAID',
          orderId: order.id,
          items: order.items || [],
          materials: [],
          fulfillment: null,
          portalUrl: studentPortalUrl,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          isClaimed: Boolean(order.customer_id),
          total: Math.round(order.amount_paise / 100),
          currency: order.currency || 'INR',
          date: order.created_at,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (order.status === 'FAILED') {
      return new Response(
        JSON.stringify({
          status: 'FAILED',
          orderId: order.id,
          items: order.items || [],
          total: Math.round(order.amount_paise / 100),
          error: 'Payment failed.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (order.status === 'USER_DROPPED') {
      return new Response(
        JSON.stringify({
          status: 'USER_DROPPED',
          orderId: order.id,
          items: order.items || [],
          total: Math.round(order.amount_paise / 100),
          error: 'Payment was not completed.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Pending or unpaid order: return status with NO fulfillment links or materials
    return new Response(
      JSON.stringify({
        status: order.status || 'PENDING',
        orderId: order.id,
        items: order.items || [],
        total: Math.round(order.amount_paise / 100),
        message: 'Payment is being verified.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  } catch (err) {
    console.error('Order status retrieval error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error retrieving order status.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
