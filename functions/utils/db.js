// functions/utils/db.js
// Cloudflare D1 Database & KV Order Persistence Layer

export const GOOGLE_SHEET_COPY_URL =
  'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/copy';

/**
 * Saves a new pending order into Cloudflare D1 and KV.
 */
export async function saveOrder(env, order) {
  const now = new Date().toISOString();
  const orderRecord = {
    id: order.id,
    cf_order_id: order.cf_order_id || order.id,
    amount_paise: Number(order.amount_paise) || Math.round(Number(order.total) * 100),
    currency: order.currency || 'INR',
    status: order.status || 'PENDING',
    customer_name: order.customer_name || order.shipping?.fullName || '',
    customer_email: order.customer_email || order.shipping?.email || '',
    customer_phone: order.customer_phone || order.shipping?.phone || '',
    shipping_json: typeof order.shipping_json === 'string' ? order.shipping_json : JSON.stringify(order.shipping || {}),
    items_json: typeof order.items_json === 'string' ? order.items_json : JSON.stringify(order.items || []),
    created_at: order.created_at || now,
    updated_at: order.updated_at || now,
  };

  // 1. Primary: Cloudflare D1 Database (if bound)
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO orders (
          id, cf_order_id, amount_paise, currency, status,
          customer_name, customer_email, customer_phone,
          shipping_json, items_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          orderRecord.id,
          orderRecord.cf_order_id,
          orderRecord.amount_paise,
          orderRecord.currency,
          orderRecord.status,
          orderRecord.customer_name,
          orderRecord.customer_email,
          orderRecord.customer_phone,
          orderRecord.shipping_json,
          orderRecord.items_json,
          orderRecord.created_at,
          orderRecord.updated_at
        )
        .run();
    } catch (d1Err) {
      console.warn('D1 insert failed, continuing to KV fallback:', d1Err.message);
    }
  }

  // 2. Secondary & Local Fallback: Cloudflare KV
  if (env && env.PRODUCTS_KV) {
    try {
      const ttl = 86400 * 30; // 30 days retention
      await env.PRODUCTS_KV.put(`order:${orderRecord.id}`, JSON.stringify(orderRecord), { expirationTtl: ttl });
      if (orderRecord.cf_order_id && orderRecord.cf_order_id !== orderRecord.id) {
        await env.PRODUCTS_KV.put(`order_cf:${orderRecord.cf_order_id}`, orderRecord.id, { expirationTtl: ttl });
      }
    } catch (kvErr) {
      console.warn('KV order persistence error:', kvErr.message);
    }
  }

  return orderRecord;
}

/**
 * Retrieves an order from D1 or KV by either internal order ID or Cashfree order ID.
 */
export async function getOrder(env, orderId) {
  if (!orderId) return null;
  const cleanId = String(orderId).trim();

  // 1. Try D1
  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT * FROM orders WHERE id = ? OR cf_order_id = ? LIMIT 1`
      )
        .bind(cleanId, cleanId)
        .first();

      if (row) {
        return {
          ...row,
          shipping: JSON.parse(row.shipping_json || '{}'),
          items: JSON.parse(row.items_json || '[]'),
        };
      }
    } catch (d1Err) {
      console.warn('D1 query error:', d1Err.message);
    }
  }

  // 2. Try KV
  if (env && env.PRODUCTS_KV) {
    try {
      let data = await env.PRODUCTS_KV.get(`order:${cleanId}`, { type: 'json' });
      if (!data) {
        const mappedId = await env.PRODUCTS_KV.get(`order_cf:${cleanId}`);
        if (mappedId) {
          data = await env.PRODUCTS_KV.get(`order:${mappedId}`, { type: 'json' });
        }
      }
      if (data) {
        return {
          ...data,
          shipping: typeof data.shipping_json === 'string' ? JSON.parse(data.shipping_json) : (data.shipping || {}),
          items: typeof data.items_json === 'string' ? JSON.parse(data.items_json) : (data.items || []),
        };
      }
    } catch (kvErr) {
      console.warn('KV query error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Updates order status (e.g. to 'PAID') idempotently.
 */
export async function updateOrderStatus(env, orderId, newStatus) {
  const now = new Date().toISOString();
  const cleanId = String(orderId).trim();

  // 1. Update D1
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE orders SET status = ?, updated_at = ? WHERE id = ? OR cf_order_id = ?`
      )
        .bind(newStatus, now, cleanId, cleanId)
        .run();
    } catch (d1Err) {
      console.warn('D1 update error:', d1Err.message);
    }
  }

  // 2. Update KV
  if (env && env.PRODUCTS_KV) {
    try {
      const existing = await getOrder(env, cleanId);
      if (existing) {
        const updated = {
          ...existing,
          status: newStatus,
          updated_at: now,
        };
        await env.PRODUCTS_KV.put(`order:${existing.id}`, JSON.stringify(updated), { expirationTtl: 86400 * 30 });
      }
    } catch (kvErr) {
      console.warn('KV update error:', kvErr.message);
    }
  }
}

/**
 * Records an order event (webhook payload, status check) into audit log.
 */
export async function recordOrderEvent(env, { orderId, eventType, rawPayload }) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO order_events (id, order_id, event_type, raw_payload, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(eventId, orderId || 'unknown', eventType, rawPayload || '', now)
        .run();
    } catch (err) {
      console.warn('Could not record order event in D1:', err.message);
    }
  }
}

/**
 * Retrieves paginated list of orders from D1 or KV with optional status filtering.
 */
export async function listOrders(env, { page = 1, limit = 20, status = null } = {}) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
  const offset = (safePage - 1) * safeLimit;

  // 1. Try D1
  if (env && env.DB) {
    try {
      let query = 'SELECT * FROM orders';
      let countQuery = 'SELECT COUNT(*) as total FROM orders';
      const params = [];
      const countParams = [];

      if (status) {
        query += ' WHERE status = ?';
        countQuery += ' WHERE status = ?';
        params.push(status);
        countParams.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(safeLimit, offset);

      const [rowsRes, countRes] = await Promise.all([
        env.DB.prepare(query).bind(...params).all(),
        env.DB.prepare(countQuery).bind(...countParams).first(),
      ]);

      const total = Number(countRes?.total) || 0;
      const orders = (rowsRes?.results || []).map((row) => ({
        ...row,
        amount: Math.round((Number(row.amount_paise) || 0) / 100),
        shipping: typeof row.shipping_json === 'string' ? JSON.parse(row.shipping_json || '{}') : (row.shipping || {}),
        items: typeof row.items_json === 'string' ? JSON.parse(row.items_json || '[]') : (row.items || []),
      }));

      return {
        orders,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit) || 1,
        },
      };
    } catch (d1Err) {
      console.warn('D1 listOrders error:', d1Err.message);
    }
  }

  // 2. Fallback to KV
  if (env && env.PRODUCTS_KV) {
    try {
      const listRes = await env.PRODUCTS_KV.list({ prefix: 'order:' });
      const allKeys = (listRes.keys || []).map((k) => k.name);
      
      const orders = [];
      const targetKeys = allKeys.slice(offset, offset + safeLimit);
      for (const k of targetKeys) {
        const orderData = await env.PRODUCTS_KV.get(k, { type: 'json' });
        if (orderData) {
          if (!status || orderData.status === status) {
            orders.push({
              ...orderData,
              amount: Math.round((Number(orderData.amount_paise) || 0) / 100),
              shipping: typeof orderData.shipping_json === 'string' ? JSON.parse(orderData.shipping_json) : (orderData.shipping || {}),
              items: typeof orderData.items_json === 'string' ? JSON.parse(orderData.items_json) : (orderData.items || []),
            });
          }
        }
      }

      const total = allKeys.length;
      return {
        orders,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit) || 1,
        },
      };
    } catch (kvErr) {
      console.warn('KV listOrders error:', kvErr.message);
    }
  }

  return {
    orders: [],
    pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 1 },
  };
}

import { createSessionToken } from './auth.js';

/**
 * Issues download links & templates ONLY after confirming order status === 'PAID'.
 * Binds cryptographically signed tokens to each entitled digital product.
 */
export async function issuePaidFulfillmentLinks(order, env) {
  if (!order || order.status !== 'PAID') {
    return null;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const digitalItems = items.filter((i) => i.format === 'digital' || i.deliveryOption === 'digital');

  const secret =
    env?.DOWNLOAD_SIGNING_KEY ||
    env?.ADMIN_SESSION_SECRET ||
    env?.CASHFREE_SECRET_KEY ||
    'xylem_secure_download_signing_key';

  const downloads = await Promise.all(
    digitalItems.map(async (item) => {
      const bookId = item.bookId || item.id;
      let token = '';
      if (secret) {
        try {
          token = await createSessionToken(
            {
              orderId: order.id,
              bookId,
              exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
            },
            secret
          );
        } catch (tokenErr) {
          console.warn('Could not generate download token:', tokenErr.message);
        }
      }

      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      return {
        bookId,
        title: item.title,
        downloadUrl: `/api/download?order_id=${encodeURIComponent(order.id)}&book_id=${encodeURIComponent(bookId)}${tokenParam}`,
      };
    })
  );

  return {
    googleSheetUrl: GOOGLE_SHEET_COPY_URL,
    downloads,
  };
}
