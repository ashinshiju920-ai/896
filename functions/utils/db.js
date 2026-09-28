// functions/utils/db.js
// Cloudflare D1 Database & KV Order Persistence Layer

import { createSessionToken } from './auth.js';

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
    customer_id: order.customer_id || null,
    amount_paise: Number(order.amount_paise ?? order.amountPaise ?? 0) || Math.round(Number(order.total || 0) * 100),
    currency: order.currency || 'INR',
    status: order.status || 'PENDING',
    customer_name: order.customer_name || order.shipping?.fullName || '',
    customer_email: order.customer_email || order.shipping?.email || '',
    customer_phone: order.customer_phone || order.shipping?.phone || '',
    shipping_json: typeof order.shipping_json === 'string' ? order.shipping_json : JSON.stringify(order.shipping || {}),
    items_json: typeof order.items_json === 'string' ? order.items_json : JSON.stringify(order.items || []),
    coupon_code: order.coupon_code || order.couponCode || null,
    discount_paise: Number(order.discount_paise ?? order.discountPaise ?? 0),
    promotion_snapshot_json: typeof order.promotion_snapshot_json === 'string'
      ? order.promotion_snapshot_json
      : (order.promotionSnapshot ? JSON.stringify(order.promotionSnapshot) : null),
    created_at: order.created_at || now,
    updated_at: order.updated_at || now,
  };

  // 1. Primary: Cloudflare D1 Database (if bound)
  if (env && env.DB) {
    const insertWithPromotions = () => env.DB.prepare(
      `INSERT INTO orders (
        id, cf_order_id, customer_id, amount_paise, currency, status,
        customer_name, customer_email, customer_phone,
        shipping_json, items_json, coupon_code, discount_paise, promotion_snapshot_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        orderRecord.id,
        orderRecord.cf_order_id,
        orderRecord.customer_id,
        orderRecord.amount_paise,
        orderRecord.currency,
        orderRecord.status,
        orderRecord.customer_name,
        orderRecord.customer_email,
        orderRecord.customer_phone,
        orderRecord.shipping_json,
        orderRecord.items_json,
        orderRecord.coupon_code,
        orderRecord.discount_paise,
        orderRecord.promotion_snapshot_json,
        orderRecord.created_at,
        orderRecord.updated_at
      )
      .run();

    const insertWithCustomerId = () => env.DB.prepare(
      `INSERT INTO orders (
        id, cf_order_id, customer_id, amount_paise, currency, status,
        customer_name, customer_email, customer_phone,
        shipping_json, items_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        orderRecord.id,
        orderRecord.cf_order_id,
        orderRecord.customer_id,
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

    const insertLegacy = () => env.DB.prepare(
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

    const hasPromotionData =
      Boolean(orderRecord.coupon_code) ||
      Number(orderRecord.discount_paise || 0) > 0 ||
      Boolean(orderRecord.promotion_snapshot_json);

    try {
      if (hasPromotionData) {
        try {
          await insertWithPromotions();
        } catch (_) {
          await insertWithCustomerId();
        }
      } else {
        await insertWithCustomerId();
      }
    } catch (colErr7) {
      try {
        await insertLegacy();
      } catch (_) {
        console.warn('D1 insert failed, continuing to KV fallback:', colErr7.message);
      }
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

  return {
    ...orderRecord,
    shipping: typeof order.shipping_json === 'string' ? JSON.parse(order.shipping_json || '{}') : (order.shipping || {}),
    items: typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : (order.items || []),
  };
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
          amountPaise: row.amount_paise,
          shipping: JSON.parse(row.shipping_json || '{}'),
          items: JSON.parse(row.items_json || '[]'),
          couponCode: row.coupon_code || null,
          discountPaise: row.discount_paise || 0,
          promotionSnapshot: row.promotion_snapshot_json ? JSON.parse(row.promotion_snapshot_json) : null,
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
          couponCode: data.coupon_code || data.couponCode || null,
          discountPaise: data.discount_paise ?? data.discountPaise ?? 0,
          promotionSnapshot: typeof data.promotion_snapshot_json === 'string'
            ? JSON.parse(data.promotion_snapshot_json)
            : (data.promotionSnapshot || null),
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

  // State Transition Safety Guard: Once an order is confirmed PAID,
  // do not allow transitioning back to PENDING, FAILED, or USER_DROPPED.
  const existing = await getOrder(env, cleanId);
  if (existing && existing.status === 'PAID' && newStatus !== 'PAID') {
    console.warn(`Blocked invalid order status transition from PAID to ${newStatus} for order ${cleanId}`);
    return;
  }

  // 1. Update D1
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE orders SET status = ?, updated_at = ? WHERE (id = ? OR cf_order_id = ?) AND (status != 'PAID' OR ? = 'PAID')`
      )
        .bind(newStatus, now, cleanId, cleanId, newStatus)
        .run();
    } catch (d1Err) {
      console.warn('D1 update error:', d1Err.message);
    }
  }

  // 2. Update KV
  if (env && env.PRODUCTS_KV) {
    try {
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

// ==============================================================================
// DIGITAL ENTITLEMENTS (PHASE 1)
// ==============================================================================

/**
 * Saves or updates a digital entitlement in D1 and KV.
 */
export async function saveEntitlement(env, entitlement) {
  const now = new Date().toISOString();
  const rec = {
    id: entitlement.id,
    order_id: entitlement.order_id || entitlement.orderId,
    product_id: entitlement.product_id || entitlement.productId,
    add_on_id: entitlement.add_on_id || entitlement.addOnId || null,
    title: entitlement.title || 'Digital Study Material',
    file_reference_json: typeof entitlement.file_reference_json === 'string'
      ? entitlement.file_reference_json
      : JSON.stringify(entitlement.fileReference || entitlement.file_reference || {}),
    status: entitlement.status || 'ACTIVE',
    granted_at: entitlement.granted_at || entitlement.grantedAt || now,
    created_at: entitlement.created_at || now,
    updated_at: entitlement.updated_at || now,
  };

  // 1. Cloudflare D1
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO entitlements (
          id, order_id, product_id, add_on_id, title,
          file_reference_json, status, granted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          rec.id,
          rec.order_id,
          rec.product_id,
          rec.add_on_id,
          rec.title,
          rec.file_reference_json,
          rec.status,
          rec.granted_at,
          rec.created_at,
          rec.updated_at
        )
        .run();
    } catch (d1Err) {
      console.warn('D1 saveEntitlement error:', d1Err.message);
    }
  }

  // 2. Cloudflare KV
  if (env && env.PRODUCTS_KV) {
    try {
      const ttl = 86400 * 365; // 1 year retention
      await env.PRODUCTS_KV.put(`entitlement:${rec.id}`, JSON.stringify(rec), { expirationTtl: ttl });

      const orderListKey = `order_entitlements:${rec.order_id}`;
      let orderEnts = await env.PRODUCTS_KV.get(orderListKey, { type: 'json' });
      if (!Array.isArray(orderEnts)) orderEnts = [];
      if (!orderEnts.includes(rec.id)) {
        orderEnts.push(rec.id);
        await env.PRODUCTS_KV.put(orderListKey, JSON.stringify(orderEnts), { expirationTtl: ttl });
      }
    } catch (kvErr) {
      console.warn('KV saveEntitlement error:', kvErr.message);
    }
  }

  return {
    ...rec,
    orderId: rec.order_id,
    productId: rec.product_id,
    addOnId: rec.add_on_id,
    grantedAt: rec.granted_at,
    fileReference: JSON.parse(rec.file_reference_json || '{}'),
  };
}

/**
 * Retrieves all digital entitlements for an order from D1 or KV.
 */
export async function getEntitlementsByOrderId(env, orderId) {
  if (!orderId) return [];
  const cleanId = String(orderId).trim();

  // 1. Try D1
  if (env && env.DB) {
    try {
      const rowsRes = await env.DB.prepare(
        `SELECT * FROM entitlements WHERE order_id = ? ORDER BY created_at ASC`
      )
        .bind(cleanId)
        .all();

      if (rowsRes && Array.isArray(rowsRes.results) && rowsRes.results.length > 0) {
        return rowsRes.results.map((r) => ({
          ...r,
          orderId: r.order_id,
          productId: r.product_id,
          addOnId: r.add_on_id,
          grantedAt: r.granted_at,
          fileReference: JSON.parse(r.file_reference_json || '{}'),
        }));
      }
    } catch (d1Err) {
      console.warn('D1 getEntitlementsByOrderId error:', d1Err.message);
    }
  }

  // 2. Try KV
  if (env && env.PRODUCTS_KV) {
    try {
      const orderListKey = `order_entitlements:${cleanId}`;
      const entIds = await env.PRODUCTS_KV.get(orderListKey, { type: 'json' });
      if (Array.isArray(entIds) && entIds.length > 0) {
        const list = [];
        for (const id of entIds) {
          const rec = await env.PRODUCTS_KV.get(`entitlement:${id}`, { type: 'json' });
          if (rec) {
            list.push({
              ...rec,
              orderId: rec.order_id,
              productId: rec.product_id,
              addOnId: rec.add_on_id,
              grantedAt: rec.granted_at,
              fileReference: JSON.parse(rec.file_reference_json || '{}'),
            });
          }
        }
        return list;
      }
    } catch (kvErr) {
      console.warn('KV getEntitlementsByOrderId error:', kvErr.message);
    }
  }

  return [];
}

/**
 * Retrieves a single entitlement by ID from D1 or KV.
 */
export async function getEntitlementById(env, entitlementId) {
  if (!entitlementId) return null;
  const cleanId = String(entitlementId).trim();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(`SELECT * FROM entitlements WHERE id = ? LIMIT 1`)
        .bind(cleanId)
        .first();
      if (row) {
        return {
          ...row,
          orderId: row.order_id,
          productId: row.product_id,
          addOnId: row.add_on_id,
          grantedAt: row.granted_at,
          fileReference: JSON.parse(row.file_reference_json || '{}'),
        };
      }
    } catch (d1Err) {
      console.warn('D1 getEntitlementById error:', d1Err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const rec = await env.PRODUCTS_KV.get(`entitlement:${cleanId}`, { type: 'json' });
      if (rec) {
        return {
          ...rec,
          orderId: rec.order_id,
          productId: rec.product_id,
          addOnId: rec.add_on_id,
          grantedAt: rec.granted_at,
          fileReference: JSON.parse(rec.file_reference_json || '{}'),
        };
      }
    } catch (kvErr) {
      console.warn('KV getEntitlementById error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Creates digital entitlements for a verified PAID order.
 * Strictly IDEMPOTENT: Uses deterministic entitlement IDs (e.g. ent_{orderId}_{productId}_{addOnId || 'main'})
 * and will never create duplicate entitlements if executed multiple times.
 * Only runs if order.status === 'PAID'. Returns [] for unpaid/pending/failed orders.
 */
export async function createEntitlementsForPaidOrder(env, order) {
  if (!order || order.status !== 'PAID') {
    return [];
  }

  const orderId = order.id;
  const items = Array.isArray(order.items)
    ? order.items
    : (typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : []);
  if (items.length === 0) return [];

  // 1. Fetch any existing entitlements for this order
  const existingEntitlements = await getEntitlementsByOrderId(env, orderId);
  const existingMap = new Map();
  for (const ent of existingEntitlements) {
    existingMap.set(ent.id, ent);
  }

  const now = new Date().toISOString();
  const createdOrFound = [];

  for (const item of items) {
    const productId = item.productId || item.bookId || item.id;
    if (!productId) continue;

    const itemFormat = item.format || item.deliveryOption || 'digital';
    const mainTitle = item.productNameSnapshot || item.title || 'Study Material';

    // A. Main Product / Bundle Entitlements (if digital)
    if (itemFormat === 'digital') {
      if (item.isBundle && Array.isArray(item.bundledProductIds) && item.bundledProductIds.length > 0) {
        // Bundle fulfillment creates the individual entitlements contained within the bundle
        for (const bpId of item.bundledProductIds) {
          if (!bpId) continue;
          const bpEntId = `ent_${orderId}_${bpId}_main`;
          if (existingMap.has(bpEntId)) {
            createdOrFound.push(existingMap.get(bpEntId));
          } else {
            const bpFileRef = {
              fileUrl: item.pdfUrl || '',
              filename: `${bpId}.pdf`,
            };
            const bpEntitlement = {
              id: bpEntId,
              order_id: orderId,
              orderId,
              product_id: bpId,
              productId: bpId,
              add_on_id: null,
              addOnId: null,
              title: `${bpId.replace(/-/g, ' ').toUpperCase()}`,
              file_reference_json: JSON.stringify(bpFileRef),
              fileReference: bpFileRef,
              status: 'ACTIVE',
              granted_at: order.updated_at || now,
              grantedAt: order.updated_at || now,
              created_at: now,
              updated_at: now,
            };
            const saved = await saveEntitlement(env, bpEntitlement);
            existingMap.set(bpEntId, saved);
            createdOrFound.push(saved);
          }
        }
      } else {
        const mainEntId = `ent_${orderId}_${productId}_main`;
        if (existingMap.has(mainEntId)) {
          createdOrFound.push(existingMap.get(mainEntId));
        } else {
          const mainFileRef = item.digitalFile || (item.pdfUrl ? {
            fileUrl: item.pdfUrl,
            filename: item.samplePdfName || `${(item.productNameSnapshot || item.title || 'Study_Material').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          } : null);
          const mainEntitlement = {
            id: mainEntId,
            order_id: orderId,
            orderId,
            product_id: productId,
            productId,
            add_on_id: null,
            addOnId: null,
            title: mainTitle,
            file_reference_json: JSON.stringify(mainFileRef || {}),
            fileReference: mainFileRef,
            status: 'ACTIVE',
            granted_at: order.updated_at || now,
            grantedAt: order.updated_at || now,
            created_at: now,
            updated_at: now,
          };
          const saved = await saveEntitlement(env, mainEntitlement);
          existingMap.set(mainEntId, saved);
          createdOrFound.push(saved);
        }
      }
    }

    // B. Add-on Entitlements
    const addOns = Array.isArray(item.addOns) && item.addOns.length > 0
      ? item.addOns
      : (Array.isArray(item.selectedAddons) ? item.selectedAddons : []);

    for (const addon of addOns) {
      const rawAddonId = addon.addOnId || addon.id;
      if (!rawAddonId) continue;
      // Skip generic format selector placeholders if they do not represent separate study material
      if (rawAddonId === 'digital' || rawAddonId === 'physical') {
        if (!addon.digitalFile && (!addon.name || addon.name.includes('(PDF)') || addon.name.includes('(Printed)'))) {
          continue;
        }
      }

      const addonDelivery = addon.deliveryOption || 'digital';
      if (addonDelivery !== 'digital') continue;

      const addonEntId = `ent_${orderId}_${productId}_${rawAddonId}`;
      if (existingMap.has(addonEntId)) {
        createdOrFound.push(existingMap.get(addonEntId));
      } else {
        const addonTitle = addon.nameSnapshot || addon.name || 'Add-on Material';
        const fullTitle = `${mainTitle} — ${addonTitle}`;
        const addonFileRef = addon.digitalFile || (addon.pdfUrl ? {
          fileUrl: addon.pdfUrl,
          filename: addon.samplePdfName || `${(addon.nameSnapshot || addon.name || 'Addon_Material').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        } : null);

        const addonEntitlement = {
          id: addonEntId,
          order_id: orderId,
          orderId,
          product_id: productId,
          productId,
          add_on_id: rawAddonId,
          addOnId: rawAddonId,
          title: fullTitle,
          file_reference_json: JSON.stringify(addonFileRef || {}),
          fileReference: addonFileRef,
          status: 'ACTIVE',
          granted_at: order.updated_at || now,
          grantedAt: order.updated_at || now,
          created_at: now,
          updated_at: now,
        };
        const saved = await saveEntitlement(env, addonEntitlement);
        existingMap.set(addonEntId, saved);
        createdOrFound.push(saved);
      }
    }
  }

  return createdOrFound;
}

/**
 * Issues download links & templates ONLY after confirming order status === 'PAID'.
 * Binds cryptographically signed tokens to each entitled digital product and add-on.
 * Returns safe material metadata for customer access.
 */
export async function issuePaidFulfillmentLinks(order, env) {
  if (!order || order.status !== 'PAID') {
    return null;
  }

  // 1. Create digital entitlements idempotently
  const entitlements = await createEntitlementsForPaidOrder(env, order);
  const items = Array.isArray(order.items) ? order.items : [];

  const secret =
    env?.DOWNLOAD_SIGNING_KEY ||
    env?.ADMIN_SESSION_SECRET ||
    env?.CASHFREE_SECRET_KEY ||
    'xylem_secure_download_signing_key';

  // 2. Generate short-lived signed tokens and safe material records for all entitlements
  const materials = await Promise.all(
    entitlements.map(async (ent) => {
      let token = '';
      if (secret) {
        try {
          token = await createSessionToken(
            {
              orderId: order.id,
              entitlementId: ent.id,
              bookId: ent.productId,
              productId: ent.productId,
              addOnId: ent.addOnId || null,
              exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
            },
            secret
          );
        } catch (tokenErr) {
          console.warn('Could not generate download token:', tokenErr.message);
        }
      }

      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const entParam = `&entitlement_id=${encodeURIComponent(ent.id)}`;
      const bookParam = `&book_id=${encodeURIComponent(ent.productId)}`;
      const downloadUrl = `/api/download?order_id=${encodeURIComponent(order.id)}${entParam}${bookParam}${tokenParam}`;

      // Check whether digital file reference exists in entitlement or order item snapshot
      const fileRef = ent.fileReference || {};
      let hasFile = Boolean(
        fileRef.fileUrl ||
        fileRef.pdfUrl ||
        fileRef.filename ||
        fileRef.samplePdfName
      );

      if (!hasFile) {
        const matchingItem = items.find((it) => (it.productId || it.bookId || it.id) === ent.productId);
        if (matchingItem) {
          if (!ent.addOnId) {
            hasFile = Boolean(matchingItem.digitalFile?.fileUrl || matchingItem.pdfUrl || matchingItem.samplePdfName);
          } else {
            const itemAddOns = matchingItem.addOns || matchingItem.selectedAddons || [];
            const matchingAddon = itemAddOns.find((a) => (a.addOnId || a.id) === ent.addOnId);
            if (matchingAddon) {
              hasFile = Boolean(matchingAddon.digitalFile?.fileUrl || matchingAddon.pdfUrl || matchingAddon.samplePdfName);
            }
          }
        }
      }

      return {
        entitlementId: ent.id,
        name: ent.title,
        type: ent.addOnId ? 'addon' : 'product',
        available: hasFile,
        productId: ent.productId,
        addOnId: ent.addOnId || null,
        downloadUrl: hasFile ? downloadUrl : null,
      };
    })
  );

  // Preserve backwards-compatible downloads list for frontend consumers
  const downloads = materials
    .filter((m) => m.available && m.downloadUrl)
    .map((m) => ({
      bookId: m.productId,
      entitlementId: m.entitlementId,
      title: m.name,
      downloadUrl: m.downloadUrl,
      type: m.type,
    }));

  return {
    googleSheetUrl: GOOGLE_SHEET_COPY_URL,
    downloads,
    materials,
    entitlements,
  };
}

// ==============================================================================
// PHASE 7: CUSTOMER ACCOUNTS, SESSIONS, CLAIMS & PERSISTENT ENTITLEMENTS
// ==============================================================================

/**
 * Saves a post-payment account claim into D1 and KV.
 */
export async function saveOrderClaim(env, { orderId, claimHash, expiresAt, purpose = 'POST_PAYMENT_ACCOUNT_CLAIM' }) {
  const now = new Date().toISOString();
  const rec = {
    id: `claim_${orderId}`,
    order_id: orderId,
    claim_hash: claimHash,
    purpose,
    expires_at: expiresAt,
    consumed_at: null,
    created_at: now,
  };

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO order_claims (id, order_id, claim_hash, purpose, expires_at, consumed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(rec.id, rec.order_id, rec.claim_hash, rec.purpose, rec.expires_at, rec.consumed_at, rec.created_at)
        .run();
    } catch (err) {
      console.warn('D1 saveOrderClaim error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.put(`order_claim:${orderId}`, JSON.stringify(rec), { expirationTtl: 3600 });
    } catch (kvErr) {
      console.warn('KV saveOrderClaim error:', kvErr.message);
    }
  }

  return rec;
}

/**
 * Retrieves an order claim by orderId from D1 or KV.
 */
export async function getOrderClaim(env, orderId) {
  if (!orderId) return null;
  const cleanId = String(orderId).trim();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, order_id, claim_hash, purpose, expires_at, consumed_at, created_at
         FROM order_claims WHERE order_id = ? LIMIT 1`
      )
        .bind(cleanId)
        .first();
      if (row) return row;
    } catch (err) {
      console.warn('D1 getOrderClaim error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const rec = await env.PRODUCTS_KV.get(`order_claim:${cleanId}`, { type: 'json' });
      if (rec) return rec;
    } catch (kvErr) {
      console.warn('KV getOrderClaim error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Marks an order claim as consumed.
 */
export async function consumeOrderClaim(env, orderId) {
  const now = new Date().toISOString();
  const cleanId = String(orderId).trim();

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE order_claims SET consumed_at = ? WHERE order_id = ? AND consumed_at IS NULL`
      )
        .bind(now, cleanId)
        .run();
    } catch (err) {
      console.warn('D1 consumeOrderClaim error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const rec = await env.PRODUCTS_KV.get(`order_claim:${cleanId}`, { type: 'json' });
      if (rec) {
        rec.consumed_at = now;
        await env.PRODUCTS_KV.put(`order_claim:${cleanId}`, JSON.stringify(rec), { expirationTtl: 3600 });
      }
    } catch (kvErr) {
      console.warn('KV consumeOrderClaim error:', kvErr.message);
    }
  }
}

/**
 * Creates a new customer account in D1 and KV.
 */
export async function createCustomer(env, { id, email, name, phone = '', passwordHash, passwordSalt }) {
  const now = new Date().toISOString();
  const customerId = id || `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();
  const cleanPhone = String(phone || '').trim();

  const rec = {
    id: customerId,
    email: cleanEmail,
    name: cleanName,
    phone: cleanPhone,
    password_hash: passwordHash,
    password_salt: passwordSalt,
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO customers (id, email, name, phone, password_hash, password_salt, status, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          rec.id,
          rec.email,
          rec.name,
          rec.phone,
          rec.password_hash,
          rec.password_salt,
          rec.status,
          rec.created_at,
          rec.updated_at,
          rec.last_login_at
        )
        .run();
    } catch (err) {
      console.warn('D1 createCustomer error:', err.message);
      throw err;
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.put(`customer:${rec.id}`, JSON.stringify(rec));
      await env.PRODUCTS_KV.put(`customer_email:${rec.email}`, rec.id);
    } catch (kvErr) {
      console.warn('KV createCustomer error:', kvErr.message);
    }
  }

  return {
    id: rec.id,
    email: rec.email,
    name: rec.name,
    phone: rec.phone,
    status: rec.status,
    createdAt: rec.created_at,
  };
}

/**
 * Retrieves customer record by email (including password hash & salt for authentication).
 */
export async function getCustomerByEmail(env, email) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash, password_salt, status, created_at, updated_at, last_login_at
         FROM customers WHERE email = ? LIMIT 1`
      )
        .bind(cleanEmail)
        .first();
      if (row) return row;
    } catch (err) {
      console.warn('D1 getCustomerByEmail error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const custId = await env.PRODUCTS_KV.get(`customer_email:${cleanEmail}`);
      if (custId) {
        const rec = await env.PRODUCTS_KV.get(`customer:${custId}`, { type: 'json' });
        if (rec) return rec;
      }
    } catch (kvErr) {
      console.warn('KV getCustomerByEmail error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Retrieves safe customer record by ID.
 */
export async function getCustomerById(env, customerId) {
  if (!customerId) return null;
  const cleanId = String(customerId).trim();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, email, name, phone, status, created_at, updated_at, last_login_at
         FROM customers WHERE id = ? LIMIT 1`
      )
        .bind(cleanId)
        .first();
      if (row) return row;
    } catch (err) {
      console.warn('D1 getCustomerById error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const rec = await env.PRODUCTS_KV.get(`customer:${cleanId}`, { type: 'json' });
      if (rec) {
        return {
          id: rec.id,
          email: rec.email,
          name: rec.name,
          phone: rec.phone,
          status: rec.status,
          created_at: rec.created_at,
          updated_at: rec.updated_at,
          last_login_at: rec.last_login_at,
        };
      }
    } catch (kvErr) {
      console.warn('KV getCustomerById error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Changes customer password.
 */
export async function updateCustomerPassword(env, customerId, passwordHash, passwordSalt) {
  const now = new Date().toISOString();
  const cleanId = String(customerId).trim();

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE customers SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?`
      )
        .bind(passwordHash, passwordSalt, now, cleanId)
        .run();
    } catch (err) {
      console.warn('D1 updateCustomerPassword error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const rec = await env.PRODUCTS_KV.get(`customer:${cleanId}`, { type: 'json' });
      if (rec) {
        rec.password_hash = passwordHash;
        rec.password_salt = passwordSalt;
        rec.updated_at = now;
        await env.PRODUCTS_KV.put(`customer:${cleanId}`, JSON.stringify(rec));
      }
    } catch (kvErr) {
      console.warn('KV updateCustomerPassword error:', kvErr.message);
    }
  }
}

/**
 * Creates a new customer session in D1 and KV.
 */
export async function createCustomerSession(env, { customerId, tokenHash, expiresAt }) {
  const now = new Date().toISOString();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const rec = {
    id: sessionId,
    customer_id: customerId,
    token_hash: tokenHash,
    created_at: now,
    expires_at: expiresAt,
    last_seen_at: now,
    revoked_at: null,
  };

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO customer_sessions (id, customer_id, token_hash, created_at, expires_at, last_seen_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(rec.id, rec.customer_id, rec.token_hash, rec.created_at, rec.expires_at, rec.last_seen_at, rec.revoked_at)
        .run();
    } catch (err) {
      console.warn('D1 createCustomerSession error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.put(`customer_sess:${tokenHash}`, JSON.stringify(rec), { expirationTtl: 86400 * 7 });
    } catch (kvErr) {
      console.warn('KV createCustomerSession error:', kvErr.message);
    }
  }

  return rec;
}

/**
 * Resolves customer session from tokenHash and returns customer details.
 * Optimized for Free plan: avoids unnecessary D1 writes on read.
 */
export async function getCustomerSessionByTokenHash(env, tokenHash) {
  if (!tokenHash) return null;
  const cleanHash = String(tokenHash).trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT s.id as session_id, s.customer_id, s.expires_at, s.revoked_at,
                c.id, c.email, c.name, c.phone, c.status
         FROM customer_sessions s
         JOIN customers c ON s.customer_id = c.id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND c.status = 'ACTIVE'
         LIMIT 1`
      )
        .bind(cleanHash, nowIso)
        .first();

      if (row) {
        return {
          sessionId: row.session_id,
          customer: {
            id: row.id,
            email: row.email,
            name: row.name,
            phone: row.phone,
            status: row.status,
          },
        };
      }
    } catch (err) {
      console.warn('D1 getCustomerSessionByTokenHash error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const sess = await env.PRODUCTS_KV.get(`customer_sess:${cleanHash}`, { type: 'json' });
      if (sess && !sess.revoked_at && sess.expires_at > nowIso) {
        const cust = await getCustomerById(env, sess.customer_id);
        if (cust && cust.status === 'ACTIVE') {
          return {
            sessionId: sess.id,
            customer: cust,
          };
        }
      }
    } catch (kvErr) {
      console.warn('KV getCustomerSessionByTokenHash error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Revokes a customer session.
 */
export async function revokeCustomerSession(env, tokenHash) {
  if (!tokenHash) return;
  const cleanHash = String(tokenHash).trim().toLowerCase();
  const now = new Date().toISOString();

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE customer_sessions SET revoked_at = ? WHERE token_hash = ?`
      )
        .bind(now, cleanHash)
        .run();
    } catch (err) {
      console.warn('D1 revokeCustomerSession error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const sess = await env.PRODUCTS_KV.get(`customer_sess:${cleanHash}`, { type: 'json' });
      if (sess) {
        sess.revoked_at = now;
        await env.PRODUCTS_KV.put(`customer_sess:${cleanHash}`, JSON.stringify(sess), { expirationTtl: 300 });
      }
    } catch (kvErr) {
      console.warn('KV revokeCustomerSession error:', kvErr.message);
    }
  }
}

/**
 * Links a verified order to a customer account.
 */
export async function linkOrderToCustomer(env, orderId, customerId) {
  const now = new Date().toISOString();
  const cleanOrderId = String(orderId).trim();
  const cleanCustId = String(customerId).trim();

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ? OR cf_order_id = ?`
      )
        .bind(cleanCustId, now, cleanOrderId, cleanOrderId)
        .run();
    } catch (err) {
      console.warn('D1 linkOrderToCustomer error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const existing = await getOrder(env, cleanOrderId);
      if (existing) {
        existing.customer_id = cleanCustId;
        existing.updated_at = now;
        await env.PRODUCTS_KV.put(`order:${existing.id}`, JSON.stringify(existing), { expirationTtl: 86400 * 30 });
      }

      // Maintain customer_orders list in KV for fallback
      const custOrdersKey = `customer_orders:${cleanCustId}`;
      let orderIds = await env.PRODUCTS_KV.get(custOrdersKey, { type: 'json' });
      if (!Array.isArray(orderIds)) orderIds = [];
      if (!orderIds.includes(cleanOrderId)) {
        orderIds.push(cleanOrderId);
        await env.PRODUCTS_KV.put(custOrdersKey, JSON.stringify(orderIds));
      }
    } catch (kvErr) {
      console.warn('KV linkOrderToCustomer error:', kvErr.message);
    }
  }
}

/**
 * Retrieves all digital entitlements belonging to an authenticated customer's PAID orders.
 * OPTIMIZED FOR FREE PLAN: Single prepared JOIN query, zero N+1.
 */
export async function getCustomerEntitlements(env, customerId) {
  if (!customerId) return [];
  const cleanCustId = String(customerId).trim();

  // 1. Try D1 prepared JOIN
  if (env && env.DB) {
    try {
      const rowsRes = await env.DB.prepare(
        `SELECT e.id, e.order_id, e.product_id, e.add_on_id, e.title,
                e.file_reference_json, e.status, e.granted_at,
                o.created_at as order_created_at
         FROM entitlements e
         JOIN orders o ON e.order_id = o.id
         WHERE o.customer_id = ? AND o.status = 'PAID' AND e.status = 'ACTIVE'
         ORDER BY e.created_at ASC`
      )
        .bind(cleanCustId)
        .all();

      if (rowsRes && Array.isArray(rowsRes.results) && rowsRes.results.length > 0) {
        return rowsRes.results.map((r) => ({
          ...r,
          orderId: r.order_id,
          productId: r.product_id,
          addOnId: r.add_on_id,
          grantedAt: r.granted_at,
          orderCreatedAt: r.order_created_at,
          fileReference: JSON.parse(r.file_reference_json || '{}'),
        }));
      }
    } catch (err) {
      console.warn('D1 getCustomerEntitlements error:', err.message);
    }
  }

  // 2. KV Fallback
  if (env && env.PRODUCTS_KV) {
    try {
      const custOrdersKey = `customer_orders:${cleanCustId}`;
      const orderIds = await env.PRODUCTS_KV.get(custOrdersKey, { type: 'json' });
      if (Array.isArray(orderIds) && orderIds.length > 0) {
        const allEnts = [];
        for (const oId of orderIds) {
          const ord = await getOrder(env, oId);
          if (ord && ord.status === 'PAID') {
            const ents = await getEntitlementsByOrderId(env, oId);
            for (const ent of ents) {
              if (ent.status === 'ACTIVE') {
                allEnts.push({
                  ...ent,
                  orderCreatedAt: ord.created_at,
                });
              }
            }
          }
        }
        return allEnts;
      }
    } catch (kvErr) {
      console.warn('KV getCustomerEntitlements error:', kvErr.message);
    }
  }

  return [];
}

/**
 * Retrieves all PAID orders belonging to an authenticated customer.
 */
export async function getCustomerPaidOrders(env, customerId) {
  if (!customerId) return [];
  const cleanCustId = String(customerId).trim();

  if (env && env.DB) {
    try {
      const rowsRes = await env.DB.prepare(
        `SELECT id, cf_order_id, amount_paise, currency, status,
                customer_name, customer_email, customer_phone,
                shipping_json, items_json, created_at, updated_at
         FROM orders
         WHERE customer_id = ? AND status = 'PAID'
         ORDER BY created_at DESC`
      )
        .bind(cleanCustId)
        .all();

      if (rowsRes && Array.isArray(rowsRes.results)) {
        return rowsRes.results.map((row) => ({
          ...row,
          amount: Math.round((Number(row.amount_paise) || 0) / 100),
          total: Math.round((Number(row.amount_paise) || 0) / 100),
          shipping: typeof row.shipping_json === 'string' ? JSON.parse(row.shipping_json || '{}') : (row.shipping || {}),
          items: typeof row.items_json === 'string' ? JSON.parse(row.items_json || '[]') : (row.items || []),
        }));
      }
    } catch (err) {
      console.warn('D1 getCustomerPaidOrders error:', err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const custOrdersKey = `customer_orders:${cleanCustId}`;
      const orderIds = await env.PRODUCTS_KV.get(custOrdersKey, { type: 'json' });
      if (Array.isArray(orderIds) && orderIds.length > 0) {
        const orders = [];
        for (const oId of orderIds) {
          const ord = await getOrder(env, oId);
          if (ord && ord.status === 'PAID') {
            orders.push({
              ...ord,
              amount: Math.round((Number(ord.amount_paise) || 0) / 100),
              total: Math.round((Number(ord.amount_paise) || 0) / 100),
            });
          }
        }
        return orders;
      }
    } catch (kvErr) {
      console.warn('KV getCustomerPaidOrders error:', kvErr.message);
    }
  }

  return [];
}

// ==============================================================================
// PHASE 8: ADMIN OPERATIONS, RECONCILIATION, FULFILLMENT MONITORING
// ==============================================================================

/**
 * Updates an order's payment-confirmed fields: cf_payment_id, verified_amount_paise,
 * reconciliation_state. Called from webhook when payment succeeds.
 */
export async function updateOrderPaymentConfirmed(env, orderId, { cfPaymentId, verifiedAmountPaise, reconciliationState }) {
  const now = new Date().toISOString();
  const cleanId = String(orderId).trim();

  if (env && env.DB) {
    try {
      try {
        await env.DB.prepare(
          `UPDATE orders SET cf_payment_id = ?, verified_amount_paise = ?, reconciliation_state = ?, updated_at = ?
           WHERE id = ? OR cf_order_id = ?`
        )
          .bind(cfPaymentId || null, verifiedAmountPaise || null, reconciliationState || 'UNKNOWN', now, cleanId, cleanId)
          .run();
      } catch (colErr) {
        // Columns not yet applied (migration pending) — non-fatal
        console.warn('Phase 8 columns not yet applied, skipping reconciliation update:', colErr.message);
      }
    } catch (d1Err) {
      console.warn('D1 updateOrderPaymentConfirmed error:', d1Err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const existing = await getOrder(env, cleanId);
      if (existing) {
        const updated = {
          ...existing,
          cf_payment_id: cfPaymentId || null,
          verified_amount_paise: verifiedAmountPaise || null,
          reconciliation_state: reconciliationState || 'UNKNOWN',
          updated_at: now,
        };
        await env.PRODUCTS_KV.put(`order:${existing.id}`, JSON.stringify(updated), { expirationTtl: 86400 * 30 });
      }
    } catch (kvErr) {
      console.warn('KV updateOrderPaymentConfirmed error:', kvErr.message);
    }
  }
}

/**
 * Retrieves full order detail for admin.
 * OPTIMIZED: targeted column selection, no SELECT *, no N+1.
 * Does NOT expose password/session/secret/claim columns.
 */
export async function getOrderDetail(env, orderId) {
  if (!orderId) return null;
  const cleanId = String(orderId).trim();

  let order = null;
  let items = [];
  let customer = null;
  let entitlements = [];
  let events = [];

  // 1. Fetch order — explicit safe columns only
  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, cf_order_id, cf_payment_id, customer_id,
                amount_paise, currency, status,
                customer_name, customer_email, customer_phone,
                verified_amount_paise, reconciliation_state,
                items_json, shipping_json,
                created_at, updated_at
         FROM orders WHERE id = ? OR cf_order_id = ? LIMIT 1`
      )
        .bind(cleanId, cleanId)
        .first();

      if (row) {
        order = row;
        items = typeof row.items_json === 'string' ? JSON.parse(row.items_json || '[]') : [];
      }
    } catch (d1Err) {
      console.warn('D1 getOrderDetail order query error:', d1Err.message);
    }
  }

  // KV fallback for order
  if (!order && env && env.PRODUCTS_KV) {
    const raw = await getOrder(env, cleanId);
    if (raw) {
      order = raw;
      items = Array.isArray(raw.items) ? raw.items : [];
    }
  }

  if (!order) return null;

  // 2. Fetch customer (safe columns only — no password/hash/salt)
  if (order.customer_id && env && env.DB) {
    try {
      const custRow = await env.DB.prepare(
        `SELECT id, email, name, phone, status, created_at, updated_at, last_login_at
         FROM customers WHERE id = ? LIMIT 1`
      )
        .bind(order.customer_id)
        .first();
      if (custRow) customer = custRow;
    } catch (d1Err) {
      console.warn('D1 getOrderDetail customer query error:', d1Err.message);
    }
  }
  if (!customer && order.customer_id) {
    customer = await getCustomerById(env, order.customer_id);
  }

  // 3. Fetch entitlements for this order
  entitlements = await getEntitlementsByOrderId(env, order.id || cleanId);

  // 4. Fetch order events (most recent last), limited to 50
  if (env && env.DB) {
    try {
      const evtRes = await env.DB.prepare(
        `SELECT id, event_type, raw_payload, created_at
         FROM order_events WHERE order_id = ?
         ORDER BY created_at ASC LIMIT 50`
      )
        .bind(order.id || cleanId)
        .all();
      events = evtRes?.results || [];
    } catch (d1Err) {
      console.warn('D1 getOrderDetail events query error:', d1Err.message);
    }
  }

  // 5. Compute reconciliation
  const expectedPaise = Number(order.amount_paise) || 0;
  const verifiedPaise = order.verified_amount_paise != null ? Number(order.verified_amount_paise) : null;
  let reconcState = order.reconciliation_state || 'UNKNOWN';
  // Re-compute if data available but state is still UNKNOWN (legacy or migration not yet applied)
  if (reconcState === 'UNKNOWN' && order.status === 'PAID' && verifiedPaise != null) {
    reconcState = Math.abs(expectedPaise - verifiedPaise) <= 1 ? 'MATCHED' : 'MISMATCH';
  }

  const reconciliation = {
    expectedPaise,
    expectedAmount: Math.round(expectedPaise / 100),
    verifiedPaise,
    verifiedAmount: verifiedPaise != null ? Math.round(verifiedPaise / 100) : null,
    currency: order.currency || 'INR',
    state: reconcState,
  };

  // 6. Compute fulfillment summary from historical items snapshot
  let expectedCount = 0;
  for (const item of items) {
    const fmt = item.format || item.deliveryOption || 'digital';
    if (fmt === 'digital') {
      expectedCount += 1;
    }
    const addons = Array.isArray(item.addOns) ? item.addOns : (Array.isArray(item.selectedAddons) ? item.selectedAddons : []);
    for (const addon of addons) {
      if ((addon.deliveryOption || 'digital') === 'digital') {
        const rawId = addon.addOnId || addon.id;
        if (rawId && rawId !== 'digital' && rawId !== 'physical') {
          expectedCount += 1;
        }
      }
    }
  }

  const createdCount = entitlements.length;
  let fulfillmentState = 'NOT_STARTED';
  if (order.status !== 'PAID') {
    fulfillmentState = 'NOT_STARTED';
  } else if (expectedCount === 0) {
    fulfillmentState = 'COMPLETE';
  } else if (createdCount === 0) {
    fulfillmentState = 'NOT_STARTED';
  } else if (createdCount >= expectedCount) {
    fulfillmentState = 'COMPLETE';
  } else {
    fulfillmentState = 'PARTIAL';
  }

  const hasFailedEvent = events.some((e) => e.event_type === 'ENTITLEMENT_CREATION_FAILED');
  if (hasFailedEvent && fulfillmentState !== 'COMPLETE') {
    fulfillmentState = 'ERROR';
  }

  const fulfillment = {
    expectedCount,
    createdCount,
    state: fulfillmentState,
    entitlements: entitlements.map((e) => ({
      id: e.id,
      title: e.title,
      type: (e.add_on_id || e.addOnId) ? 'ADDON' : 'PRODUCT',
      productId: e.product_id || e.productId,
      addOnId: e.add_on_id || e.addOnId || null,
      status: e.status,
      grantedAt: e.granted_at || e.grantedAt,
      orderId: e.order_id || e.orderId,
      // file_reference_json intentionally omitted — do not expose private file keys
    })),
  };

  return {
    order: {
      id: order.id,
      cf_order_id: order.cf_order_id,
      cf_payment_id: order.cf_payment_id || null,
      customer_id: order.customer_id || null,
      amount_paise: order.amount_paise,
      amount: Math.round((Number(order.amount_paise) || 0) / 100),
      currency: order.currency || 'INR',
      status: order.status,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      shipping: typeof order.shipping_json === 'string' ? JSON.parse(order.shipping_json || '{}') : (order.shipping || {}),
      verified_amount_paise: order.verified_amount_paise,
      reconciliation_state: reconcState,
      created_at: order.created_at,
      updated_at: order.updated_at,
    },
    items,
    customer,
    reconciliation,
    fulfillment,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      createdAt: e.created_at,
      summary: (() => {
        try {
          const p = JSON.parse(e.raw_payload || '{}');
          // Strip any secret-looking fields before sending to admin UI
          const forbidden = ['secret', 'token', 'signature', 'hash', 'password',
            'CASHFREE_SECRET_KEY', 'claim_hash', 'claim_secret', 'salt', 'key'];
          for (const k of forbidden) { delete p[k]; }
          return p;
        } catch { return null; }
      })(),
    })),
  };
}

/**
 * Lists orders with server-side search. Parameterized — no SQL injection risk.
 * Search fields: order id, cf_order_id, cf_payment_id, customer_email, customer_name, customer_phone.
 */
export async function listOrdersWithSearch(env, { page = 1, limit = 20, status = null, search = null } = {}) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
  const offset = (safePage - 1) * safeLimit;

  if (env && env.DB) {
    try {
      const hasStatus = status && status !== 'all';
      const hasSearch = search && String(search).trim().length > 0;
      const safeSearch = hasSearch ? String(search).trim() : null;

      let where = '';
      const filterParams = [];

      if (hasStatus && hasSearch) {
        where = `WHERE status = ? AND (id = ? OR cf_order_id = ? OR cf_payment_id = ? OR customer_email LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`;
        filterParams.push(status, safeSearch, safeSearch, safeSearch, `%${safeSearch}%`, `%${safeSearch}%`, `%${safeSearch}%`);
      } else if (hasStatus) {
        where = `WHERE status = ?`;
        filterParams.push(status);
      } else if (hasSearch) {
        where = `WHERE (id = ? OR cf_order_id = ? OR cf_payment_id = ? OR customer_email LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`;
        filterParams.push(safeSearch, safeSearch, safeSearch, `%${safeSearch}%`, `%${safeSearch}%`, `%${safeSearch}%`);
      }

      const listQuery = `SELECT id, cf_order_id, cf_payment_id, customer_id,
                                amount_paise, currency, status,
                                customer_name, customer_email, customer_phone,
                                verified_amount_paise, reconciliation_state,
                                items_json, shipping_json, created_at, updated_at
                         FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      const countQuery = `SELECT COUNT(*) as total FROM orders ${where}`;

      const [rowsRes, countRes] = await Promise.all([
        env.DB.prepare(listQuery).bind(...filterParams, safeLimit, offset).all(),
        env.DB.prepare(countQuery).bind(...filterParams).first(),
      ]);

      const total = Number(countRes?.total) || 0;
      const orders = (rowsRes?.results || []).map((row) => ({
        ...row,
        amount: Math.round((Number(row.amount_paise) || 0) / 100),
        items: typeof row.items_json === 'string' ? JSON.parse(row.items_json || '[]') : [],
        shipping: typeof row.shipping_json === 'string' ? JSON.parse(row.shipping_json || '{}') : {},
      }));

      return {
        orders,
        pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) || 1 },
      };
    } catch (d1Err) {
      console.warn('D1 listOrdersWithSearch error:', d1Err.message);
    }
  }

  // Fallback to original listOrders (KV path + older schema)
  return listOrders(env, { page, limit, status });
}

/**
 * Retrieves dashboard statistics in a single consolidated D1 query.
 * OPTIMIZED FOR FREE PLAN: one query for all order counts + revenue.
 */
export async function getDashboardStats(env) {
  const defaultStats = {
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    failedOrders: 0,
    userDroppedOrders: 0,
    paidRevenuePaise: 0,
    fulfillmentIssues: 0,
  };

  if (env && env.DB) {
    try {
      const statsRes = await env.DB.prepare(
        `SELECT
           COUNT(*) as total_orders,
           SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_orders,
           SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_orders,
           SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_orders,
           SUM(CASE WHEN status = 'USER_DROPPED' THEN 1 ELSE 0 END) as user_dropped_orders,
           SUM(CASE WHEN status = 'PAID' THEN amount_paise ELSE 0 END) as paid_revenue_paise
         FROM orders`
      ).first();

      let fulfillmentIssues = 0;
      try {
        const fRes = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM orders o
           WHERE o.status = 'PAID'
             AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.order_id = o.id)`
        ).first();
        fulfillmentIssues = Number(fRes?.cnt) || 0;
      } catch (fErr) {
        console.warn('Could not compute fulfillment issues:', fErr.message);
      }

      return {
        totalOrders: Number(statsRes?.total_orders) || 0,
        paidOrders: Number(statsRes?.paid_orders) || 0,
        pendingOrders: Number(statsRes?.pending_orders) || 0,
        failedOrders: Number(statsRes?.failed_orders) || 0,
        userDroppedOrders: Number(statsRes?.user_dropped_orders) || 0,
        paidRevenuePaise: Number(statsRes?.paid_revenue_paise) || 0,
        fulfillmentIssues,
      };
    } catch (d1Err) {
      console.warn('D1 getDashboardStats error:', d1Err.message);
    }
  }

  return defaultStats;
}

/**
 * Records an admin audit event. Non-fatal — never blocks business logic.
 * NEVER stores: passwords, session tokens, secrets, claim tokens, hashes.
 */
export async function recordAdminAuditEvent(env, { action, targetType, targetId, adminIdentity, metadata }) {
  const eventId = `aevt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const safeMetadata = { ...(metadata || {}) };
  const forbiddenKeys = ['password', 'secret', 'token', 'hash', 'salt', 'key', 'signature',
    'claim_hash', 'claim_secret', 'password_hash', 'password_salt'];
  for (const k of forbiddenKeys) { delete safeMetadata[k]; delete safeMetadata[k.toUpperCase()]; }

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_audit_events (id, action, target_type, target_id, admin_identity, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          eventId,
          String(action || ''),
          String(targetType || ''),
          String(targetId || ''),
          String(adminIdentity || 'admin'),
          JSON.stringify(safeMetadata),
          now
        )
        .run();
    } catch (d1Err) {
      console.warn('D1 recordAdminAuditEvent error:', d1Err.message);
    }
  }
}

// ==============================================================================
// PHASE 9: DIGITAL FILE VERSIONING, SAFE REPLACEMENT & LIFETIME ENTITLEMENT
// ==============================================================================

/**
 * Saves or updates a digital file version in D1 and KV.
 */
export async function saveDigitalFileVersion(env, version) {
  const now = new Date().toISOString();
  const rec = {
    id: version.id,
    product_id: version.productId || version.product_id,
    add_on_id: version.addOnId || version.add_on_id || null,
    version_label: version.versionLabel || version.version_label || '1.0',
    storage_reference: version.storageReference || version.storage_reference || '',
    file_name: version.fileName || version.file_name || 'document.pdf',
    mime_type: version.mimeType || version.mime_type || 'application/pdf',
    size_bytes: Number(version.sizeBytes || version.size_bytes || 0),
    checksum: version.checksum || null,
    release_notes: version.releaseNotes || version.release_notes || null,
    status: version.status || 'ACTIVE',
    created_at: version.createdAt || version.created_at || now,
    archived_at: version.archivedAt || version.archived_at || null,
    created_by: version.createdBy || version.created_by || 'admin',
  };

  // 1. Cloudflare D1
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO digital_file_versions (
          id, product_id, add_on_id, version_label, storage_reference,
          file_name, mime_type, size_bytes, checksum, release_notes,
          status, created_at, archived_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          rec.id, rec.product_id, rec.add_on_id, rec.version_label, rec.storage_reference,
          rec.file_name, rec.mime_type, rec.size_bytes, rec.checksum, rec.release_notes,
          rec.status, rec.created_at, rec.archived_at, rec.created_by
        )
        .run();
    } catch (d1Err) {
      console.warn('D1 saveDigitalFileVersion error:', d1Err.message);
    }
  }

  // 2. Cloudflare KV Cache
  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.put(`file_ver:${rec.id}`, JSON.stringify(rec), { expirationTtl: 86400 * 365 });
      const activeKey = `current_file_ver:${rec.product_id}:${rec.add_on_id || 'main'}`;
      if (rec.status === 'ACTIVE') {
        await env.PRODUCTS_KV.put(activeKey, JSON.stringify(rec), { expirationTtl: 86400 * 365 });
      }

      // Maintain versions list
      const listKey = `file_vers_list:${rec.product_id}:${rec.add_on_id || 'main'}`;
      let vers = await env.PRODUCTS_KV.get(listKey, { type: 'json' });
      if (!Array.isArray(vers)) vers = [];
      const existingIdx = vers.findIndex((v) => v.id === rec.id);
      if (existingIdx >= 0) {
        vers[existingIdx] = rec;
      } else {
        vers.unshift(rec);
      }
      await env.PRODUCTS_KV.put(listKey, JSON.stringify(vers), { expirationTtl: 86400 * 365 });
    } catch (kvErr) {
      console.warn('KV saveDigitalFileVersion error:', kvErr.message);
    }
  }

  return {
    id: rec.id,
    productId: rec.product_id,
    addOnId: rec.add_on_id,
    versionLabel: rec.version_label,
    storageReference: rec.storage_reference,
    fileName: rec.file_name,
    mimeType: rec.mime_type,
    sizeBytes: rec.size_bytes,
    checksum: rec.checksum,
    releaseNotes: rec.release_notes,
    status: rec.status,
    createdAt: rec.created_at,
    archivedAt: rec.archived_at,
    createdBy: rec.created_by,
  };
}

/**
 * Retrieves the current authorized ACTIVE file version for a product or add-on.
 * Free plan optimized: targeted single-row lookup with index.
 */
export async function getActiveFileVersion(env, productId, addOnId = null) {
  if (!productId) return null;
  const cleanProdId = String(productId).trim();
  const cleanAddonId = addOnId ? String(addOnId).trim() : null;

  // 1. Try D1
  if (env && env.DB) {
    try {
      let query;
      let params;
      if (cleanAddonId) {
        query = `SELECT id, product_id, add_on_id, version_label, storage_reference,
                        file_name, mime_type, size_bytes, checksum, release_notes,
                        status, created_at, archived_at, created_by
                 FROM digital_file_versions
                 WHERE product_id = ? AND add_on_id = ? AND status = 'ACTIVE'
                 ORDER BY created_at DESC LIMIT 1`;
        params = [cleanProdId, cleanAddonId];
      } else {
        query = `SELECT id, product_id, add_on_id, version_label, storage_reference,
                        file_name, mime_type, size_bytes, checksum, release_notes,
                        status, created_at, archived_at, created_by
                 FROM digital_file_versions
                 WHERE product_id = ? AND (add_on_id IS NULL OR add_on_id = '') AND status = 'ACTIVE'
                 ORDER BY created_at DESC LIMIT 1`;
        params = [cleanProdId];
      }

      const row = await env.DB.prepare(query).bind(...params).first();
      if (row) {
        return {
          id: row.id,
          productId: row.product_id,
          addOnId: row.add_on_id,
          versionLabel: row.version_label,
          storageReference: row.storage_reference,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          checksum: row.checksum,
          releaseNotes: row.release_notes,
          status: row.status,
          createdAt: row.created_at,
          archivedAt: row.archived_at,
          createdBy: row.created_by,
        };
      }
    } catch (d1Err) {
      console.warn('D1 getActiveFileVersion error:', d1Err.message);
    }
  }

  // 2. Try KV
  if (env && env.PRODUCTS_KV) {
    try {
      const activeKey = `current_file_ver:${cleanProdId}:${cleanAddonId || 'main'}`;
      const rec = await env.PRODUCTS_KV.get(activeKey, { type: 'json' });
      if (rec && rec.status === 'ACTIVE') {
        return {
          id: rec.id,
          productId: rec.product_id || rec.productId,
          addOnId: rec.add_on_id || rec.addOnId,
          versionLabel: rec.version_label || rec.versionLabel,
          storageReference: rec.storage_reference || rec.storageReference,
          fileName: rec.file_name || rec.fileName,
          mimeType: rec.mime_type || rec.mimeType,
          sizeBytes: rec.size_bytes || rec.sizeBytes,
          checksum: rec.checksum,
          releaseNotes: rec.release_notes || rec.releaseNotes,
          status: rec.status,
          createdAt: rec.created_at || rec.createdAt,
          archivedAt: rec.archived_at || rec.archivedAt,
          createdBy: rec.created_by || rec.createdBy,
        };
      }
    } catch (kvErr) {
      console.warn('KV getActiveFileVersion error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Retrieves a file version by ID.
 */
export async function getFileVersionById(env, versionId) {
  if (!versionId) return null;
  const cleanId = String(versionId).trim();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, product_id, add_on_id, version_label, storage_reference,
                file_name, mime_type, size_bytes, checksum, release_notes,
                status, created_at, archived_at, created_by
         FROM digital_file_versions WHERE id = ? LIMIT 1`
      )
        .bind(cleanId)
        .first();
      if (row) {
        return {
          id: row.id,
          productId: row.product_id,
          addOnId: row.add_on_id,
          versionLabel: row.version_label,
          storageReference: row.storage_reference,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          checksum: row.checksum,
          releaseNotes: row.release_notes,
          status: row.status,
          createdAt: row.created_at,
          archivedAt: row.archived_at,
          createdBy: row.created_by,
        };
      }
    } catch (d1Err) {
      console.warn('D1 getFileVersionById error:', d1Err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const rec = await env.PRODUCTS_KV.get(`file_ver:${cleanId}`, { type: 'json' });
      if (rec) {
        return {
          id: rec.id,
          productId: rec.product_id || rec.productId,
          addOnId: rec.add_on_id || rec.addOnId,
          versionLabel: rec.version_label || rec.versionLabel,
          storageReference: rec.storage_reference || rec.storageReference,
          fileName: rec.file_name || rec.fileName,
          mimeType: rec.mime_type || rec.mimeType,
          sizeBytes: rec.size_bytes || rec.sizeBytes,
          checksum: rec.checksum,
          releaseNotes: rec.release_notes || rec.releaseNotes,
          status: rec.status,
          createdAt: rec.created_at || rec.createdAt,
          archivedAt: rec.archived_at || rec.archivedAt,
          createdBy: rec.created_by || rec.createdBy,
        };
      }
    } catch (kvErr) {
      console.warn('KV getFileVersionById error:', kvErr.message);
    }
  }

  return null;
}

/**
 * Lists all file versions for a product or add-on (for admin version history).
 */
export async function listDigitalFileVersions(env, productId, addOnId = null) {
  if (!productId) return [];
  const cleanProdId = String(productId).trim();
  const cleanAddonId = addOnId ? String(addOnId).trim() : null;

  if (env && env.DB) {
    try {
      let query;
      let params;
      if (cleanAddonId) {
        query = `SELECT id, product_id, add_on_id, version_label, storage_reference,
                        file_name, mime_type, size_bytes, checksum, release_notes,
                        status, created_at, archived_at, created_by
                 FROM digital_file_versions
                 WHERE product_id = ? AND add_on_id = ?
                 ORDER BY created_at DESC LIMIT 50`;
        params = [cleanProdId, cleanAddonId];
      } else {
        query = `SELECT id, product_id, add_on_id, version_label, storage_reference,
                        file_name, mime_type, size_bytes, checksum, release_notes,
                        status, created_at, archived_at, created_by
                 FROM digital_file_versions
                 WHERE product_id = ? AND (add_on_id IS NULL OR add_on_id = '')
                 ORDER BY created_at DESC LIMIT 50`;
        params = [cleanProdId];
      }

      const rowsRes = await env.DB.prepare(query).bind(...params).all();
      if (rowsRes && Array.isArray(rowsRes.results)) {
        return rowsRes.results.map((r) => ({
          id: r.id,
          productId: r.product_id,
          addOnId: r.add_on_id,
          versionLabel: r.version_label,
          storageReference: r.storage_reference,
          fileName: r.file_name,
          mimeType: r.mime_type,
          sizeBytes: r.size_bytes,
          checksum: r.checksum,
          releaseNotes: r.release_notes,
          status: r.status,
          createdAt: r.created_at,
          archivedAt: r.archived_at,
          createdBy: r.created_by,
        }));
      }
    } catch (d1Err) {
      console.warn('D1 listDigitalFileVersions error:', d1Err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      const listKey = `file_vers_list:${cleanProdId}:${cleanAddonId || 'main'}`;
      const vers = await env.PRODUCTS_KV.get(listKey, { type: 'json' });
      if (Array.isArray(vers)) return vers;
    } catch (kvErr) {
      console.warn('KV listDigitalFileVersions error:', kvErr.message);
    }
  }

  return [];
}

/**
 * Executes the Safe Replacement Flow:
 * 1. Inserts new active version record.
 * 2. Archives previous active versions for (product_id, add_on_id).
 * 3. Updates KV catalog so digitalFile points to the new version.
 * 4. Records admin audit events.
 * 
 * If any step fails: OLD VERSION REMAINS ACTIVE!
 */
export async function replaceDigitalFileVersion(env, {
  productId,
  addOnId = null,
  versionLabel,
  storageReference,
  fileName,
  mimeType = 'application/pdf',
  sizeBytes = 0,
  checksum = null,
  releaseNotes = null,
  adminIdentity = 'admin',
}) {
  const now = new Date().toISOString();
  const cleanProdId = String(productId).trim();
  const cleanAddonId = addOnId ? String(addOnId).trim() : null;
  const versionId = `dfv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Find current active version to archive later
  const previousActive = await getActiveFileVersion(env, cleanProdId, cleanAddonId);

  // Determine human-readable version label if not provided
  let safeVersionLabel = String(versionLabel || '').trim();
  if (!safeVersionLabel) {
    const history = await listDigitalFileVersions(env, cleanProdId, cleanAddonId);
    safeVersionLabel = `v${history.length + 1}.0`;
  }

  const newVersionRec = {
    id: versionId,
    product_id: cleanProdId,
    add_on_id: cleanAddonId,
    version_label: safeVersionLabel,
    storage_reference: storageReference,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: Number(sizeBytes) || 0,
    checksum: checksum || null,
    release_notes: releaseNotes ? String(releaseNotes).slice(0, 500) : null,
    status: 'ACTIVE',
    created_at: now,
    archived_at: null,
    created_by: adminIdentity,
  };

  // Step 1: Save new version as ACTIVE
  await saveDigitalFileVersion(env, newVersionRec);

  // Step 2: Archive previous active version(s)
  if (previousActive && previousActive.id !== versionId) {
    if (env && env.DB) {
      try {
        await env.DB.prepare(
          `UPDATE digital_file_versions SET status = 'ARCHIVED', archived_at = ?
           WHERE product_id = ? AND (add_on_id = ? OR (add_on_id IS NULL AND ? IS NULL)) AND id != ? AND status = 'ACTIVE'`
        )
          .bind(now, cleanProdId, cleanAddonId, cleanAddonId, versionId)
          .run();
      } catch (d1Err) {
        console.warn('D1 archive previous versions error:', d1Err.message);
      }
    }

    if (env && env.PRODUCTS_KV) {
      try {
        const prevKey = `file_ver:${previousActive.id}`;
        const prevData = await env.PRODUCTS_KV.get(prevKey, { type: 'json' });
        if (prevData) {
          prevData.status = 'ARCHIVED';
          prevData.archived_at = now;
          await env.PRODUCTS_KV.put(prevKey, JSON.stringify(prevData), { expirationTtl: 86400 * 365 });
        }
      } catch (kvErr) {
        console.warn('KV archive previous version error:', kvErr.message);
      }
    }

    // Record archive audit event
    await recordAdminAuditEvent(env, {
      action: 'DIGITAL_FILE_ARCHIVED',
      targetType: 'DIGITAL_FILE_VERSION',
      targetId: previousActive.id,
      adminIdentity,
      metadata: {
        productId: cleanProdId,
        addOnId: cleanAddonId,
        archivedVersionLabel: previousActive.versionLabel,
        archivedFileName: previousActive.fileName,
      },
    });
  }

  // Step 3: Update catalog in KV to keep digitalFile synchronized
  if (env && env.PRODUCTS_KV) {
    try {
      const catalog = await env.PRODUCTS_KV.get('xylem_products', { type: 'json' });
      if (catalog && Array.isArray(catalog.books)) {
        const bookIdx = catalog.books.findIndex((b) => b.id === cleanProdId);
        if (bookIdx >= 0) {
          const book = catalog.books[bookIdx];
          const newFileRef = {
            fileVersionId: versionId,
            version: safeVersionLabel,
            filename: fileName,
            fileUrl: storageReference,
            samplePdfName: fileName,
            pdfUrl: storageReference,
            fileSizeBytes: Number(sizeBytes) || 0,
            mimeType,
            checksum,
            releaseNotes: newVersionRec.release_notes,
            status: 'ACTIVE',
            createdAt: now,
          };

          if (!cleanAddonId) {
            book.digitalFile = newFileRef;
            book.samplePdfName = fileName;
            book.pdfUrl = storageReference;
          } else {
            const rawAddons = book.addOns || book.addons || [];
            const addonIdx = rawAddons.findIndex((a) => (a.id || a.addOnId) === cleanAddonId);
            if (addonIdx >= 0) {
              rawAddons[addonIdx].digitalFile = newFileRef;
              rawAddons[addonIdx].samplePdfName = fileName;
              rawAddons[addonIdx].pdfUrl = storageReference;
              book.addOns = rawAddons;
              book.addons = rawAddons;
            }
          }
          catalog.books[bookIdx] = book;
          catalog.version = Math.round(Date.now() / 1000);
          catalog.updatedAt = now;
          await env.PRODUCTS_KV.put('xylem_products', JSON.stringify(catalog));
          await env.PRODUCTS_KV.put('xylem_products_version', String(catalog.version));
        }
      }
    } catch (catErr) {
      console.warn('Could not update catalog in KV after version replace:', catErr.message);
    }
  }

  // Step 4: Record administrative audit events
  await recordAdminAuditEvent(env, {
    action: 'DIGITAL_FILE_UPLOADED',
    targetType: 'DIGITAL_FILE_VERSION',
    targetId: versionId,
    adminIdentity,
    metadata: {
      productId: cleanProdId,
      addOnId: cleanAddonId,
      versionLabel: safeVersionLabel,
      fileName,
      sizeBytes,
      checksum,
    },
  });

  await recordAdminAuditEvent(env, {
    action: 'DIGITAL_FILE_VERSION_CREATED',
    targetType: 'DIGITAL_FILE_VERSION',
    targetId: versionId,
    adminIdentity,
    metadata: {
      productId: cleanProdId,
      addOnId: cleanAddonId,
      versionLabel: safeVersionLabel,
      fileName,
      status: 'ACTIVE',
    },
  });

  await recordAdminAuditEvent(env, {
    action: 'DIGITAL_FILE_REPLACED',
    targetType: cleanAddonId ? 'ADDON' : 'PRODUCT',
    targetId: cleanAddonId ? `${cleanProdId}:${cleanAddonId}` : cleanProdId,
    adminIdentity,
    metadata: {
      productId: cleanProdId,
      addOnId: cleanAddonId,
      newVersionId: versionId,
      newVersionLabel: safeVersionLabel,
      previousVersionId: previousActive?.id || null,
      previousVersionLabel: previousActive?.versionLabel || null,
    },
  });

  return {
    success: true,
    version: {
      id: versionId,
      productId: cleanProdId,
      addOnId: cleanAddonId,
      versionLabel: safeVersionLabel,
      storageReference,
      fileName,
      mimeType,
      sizeBytes,
      checksum,
      releaseNotes: newVersionRec.release_notes,
      status: 'ACTIVE',
      createdAt: now,
      createdBy: adminIdentity,
    },
    archivedVersion: previousActive ? {
      ...previousActive,
      status: 'ARCHIVED',
      archivedAt: now,
    } : null,
  };
}

// ----------------------------------------------------------------------------
// PHASE 10: PROMOTIONS, COUPONS & PROMOTIONAL PRICING ENGINE
// ----------------------------------------------------------------------------

export const DEFAULT_PROMOTIONS = [
  {
    id: 'promo_seed_xylem20',
    code: 'XYLEM20',
    name: 'Flat 20% Discount',
    type: 'COUPON',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    active: true,
    startsAt: null,
    expiresAt: null,
    minimumOrderPaise: 0,
    maximumDiscountPaise: null,
    usageLimit: null,
    timesUsed: 0,
    perCustomerLimit: 5,
    firstOrderOnly: false,
    applicableProductIds: null,
    applicableAddOnIds: null,
  },
  {
    id: 'promo_seed_first50',
    code: 'FIRST50',
    name: 'First Time Learner ₹50 Off',
    type: 'COUPON',
    discountType: 'FIXED_AMOUNT',
    discountValue: 5000,
    active: true,
    startsAt: null,
    expiresAt: null,
    minimumOrderPaise: 0,
    maximumDiscountPaise: null,
    usageLimit: null,
    timesUsed: 0,
    perCustomerLimit: 1,
    firstOrderOnly: true,
    applicableProductIds: null,
    applicableAddOnIds: null,
  },
  {
    id: 'promo_seed_specialoffer',
    code: 'SPECIALOFFER',
    name: 'Special Seasonal 15% Off',
    type: 'COUPON',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    active: true,
    startsAt: null,
    expiresAt: null,
    minimumOrderPaise: 0,
    maximumDiscountPaise: null,
    usageLimit: null,
    timesUsed: 0,
    perCustomerLimit: 5,
    firstOrderOnly: false,
    applicableProductIds: null,
    applicableAddOnIds: null,
  },
  {
    id: 'promo_seed_offer67',
    code: 'OFFER67',
    name: 'Partner Voucher 15% Off',
    type: 'COUPON',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    active: true,
    startsAt: null,
    expiresAt: null,
    minimumOrderPaise: 0,
    maximumDiscountPaise: null,
    usageLimit: null,
    timesUsed: 0,
    perCustomerLimit: 5,
    firstOrderOnly: false,
    applicableProductIds: null,
    applicableAddOnIds: null,
  },
];

function mapPromotionRow(r) {
  if (!r) return null;
  let appProd = null;
  let appAddon = null;
  try {
    if (r.applicable_product_ids_json) appProd = JSON.parse(r.applicable_product_ids_json);
  } catch {}
  try {
    if (r.applicable_addon_ids_json) appAddon = JSON.parse(r.applicable_addon_ids_json);
  } catch {}

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type || 'COUPON',
    discountType: r.discount_type || r.discountType || 'PERCENTAGE',
    discount_type: r.discount_type || r.discountType || 'PERCENTAGE',
    discountValue: Number(r.discount_value ?? r.discountValue ?? 0),
    discount_value: Number(r.discount_value ?? r.discountValue ?? 0),
    active: Boolean(r.active),
    startsAt: r.starts_at || r.startsAt || null,
    starts_at: r.starts_at || r.startsAt || null,
    expiresAt: r.expires_at || r.expiresAt || null,
    expires_at: r.expires_at || r.expiresAt || null,
    minimumOrderPaise: Number(r.minimum_order_paise ?? r.minimumOrderPaise ?? 0),
    minimum_order_paise: Number(r.minimum_order_paise ?? r.minimumOrderPaise ?? 0),
    maximumDiscountPaise: r.maximum_discount_paise != null ? Number(r.maximum_discount_paise) : (r.maximumDiscountPaise != null ? Number(r.maximumDiscountPaise) : null),
    maximum_discount_paise: r.maximum_discount_paise != null ? Number(r.maximum_discount_paise) : (r.maximumDiscountPaise != null ? Number(r.maximumDiscountPaise) : null),
    usageLimit: r.usage_limit != null ? Number(r.usage_limit) : (r.usageLimit != null ? Number(r.usageLimit) : null),
    usage_limit: r.usage_limit != null ? Number(r.usage_limit) : (r.usageLimit != null ? Number(r.usageLimit) : null),
    timesUsed: Number(r.times_used ?? r.timesUsed ?? 0),
    times_used: Number(r.times_used ?? r.timesUsed ?? 0),
    perCustomerLimit: r.per_customer_limit != null ? Number(r.per_customer_limit) : (r.perCustomerLimit != null ? Number(r.perCustomerLimit) : 1),
    per_customer_limit: r.per_customer_limit != null ? Number(r.per_customer_limit) : (r.perCustomerLimit != null ? Number(r.perCustomerLimit) : 1),
    firstOrderOnly: Boolean(r.first_order_only ?? r.firstOrderOnly),
    first_order_only: Boolean(r.first_order_only ?? r.firstOrderOnly),
    applicableProductIds: appProd,
    applicable_product_ids: appProd,
    applicableAddOnIds: appAddon,
    applicable_addon_ids: appAddon,
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    created_at: r.created_at || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
    updated_at: r.updated_at || r.updatedAt || new Date().toISOString(),
  };
}

/**
 * Saves or updates a promotion in D1 and warms KV cache.
 */
export async function savePromotion(env, promo) {
  if (!promo || !promo.code) {
    throw new Error('Promotion code is required.');
  }

  const now = new Date().toISOString();
  const cleanCode = String(promo.code).trim().toUpperCase();
  const rec = {
    id: promo.id || `promo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    code: cleanCode,
    name: String(promo.name || cleanCode).trim(),
    type: promo.type || 'COUPON',
    discount_type: promo.discountType || promo.discount_type || 'PERCENTAGE',
    discount_value: Number(promo.discountValue ?? promo.discount_value ?? 0),
    active: promo.active !== false && promo.active !== 0 ? 1 : 0,
    starts_at: promo.startsAt || promo.starts_at || null,
    expires_at: promo.expiresAt || promo.expires_at || null,
    minimum_order_paise: Number(promo.minimumOrderPaise ?? promo.minimum_order_paise ?? 0),
    maximum_discount_paise: promo.maximumDiscountPaise != null ? Number(promo.maximumDiscountPaise) : (promo.maximum_discount_paise != null ? Number(promo.maximum_discount_paise) : null),
    usage_limit: promo.usageLimit != null ? Number(promo.usageLimit) : (promo.usage_limit != null ? Number(promo.usage_limit) : null),
    times_used: Number(promo.timesUsed ?? promo.times_used ?? 0),
    per_customer_limit: promo.perCustomerLimit != null ? Number(promo.perCustomerLimit) : (promo.per_customer_limit != null ? Number(promo.per_customer_limit) : 1),
    first_order_only: promo.firstOrderOnly || promo.first_order_only ? 1 : 0,
    applicable_product_ids_json: promo.applicableProductIds ? JSON.stringify(promo.applicableProductIds) : (promo.applicable_product_ids_json || null),
    applicable_addon_ids_json: promo.applicableAddOnIds ? JSON.stringify(promo.applicableAddOnIds) : (promo.applicable_addon_ids_json || null),
    created_at: promo.createdAt || promo.created_at || now,
    updated_at: now,
  };

  // 1. D1 Database
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO promotions (
          id, code, name, type, discount_type, discount_value, active,
          starts_at, expires_at, minimum_order_paise, maximum_discount_paise,
          usage_limit, times_used, per_customer_limit, first_order_only,
          applicable_product_ids_json, applicable_addon_ids_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          rec.id, rec.code, rec.name, rec.type, rec.discount_type, rec.discount_value, rec.active,
          rec.starts_at, rec.expires_at, rec.minimum_order_paise, rec.maximum_discount_paise,
          rec.usage_limit, rec.times_used, rec.per_customer_limit, rec.first_order_only,
          rec.applicable_product_ids_json, rec.applicable_addon_ids_json, rec.created_at, rec.updated_at
        )
        .run();
    } catch (d1Err) {
      console.warn('D1 savePromotion error:', d1Err.message);
    }
  }

  // 2. KV Cache
  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.put(`promo:${rec.code}`, JSON.stringify(rec), { expirationTtl: 86400 * 30 });
    } catch (kvErr) {
      console.warn('KV savePromotion error:', kvErr.message);
    }
  }

  return mapPromotionRow(rec);
}

/**
 * Retrieves a promotion by code (checks KV cache -> D1 -> built-in defaults).
 */
export async function getPromotionByCode(env, code) {
  if (!code || typeof code !== 'string') return null;
  const cleanCode = code.trim().toUpperCase();

  // 1. Try KV cache
  if (env && env.PRODUCTS_KV) {
    try {
      const cached = await env.PRODUCTS_KV.get(`promo:${cleanCode}`, { type: 'json' });
      if (cached) return mapPromotionRow(cached);
    } catch (kvErr) {
      console.warn('KV getPromotionByCode error:', kvErr.message);
    }
  }

  // 2. Try D1
  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, code, name, type, discount_type, discount_value, active,
                starts_at, expires_at, minimum_order_paise, maximum_discount_paise,
                usage_limit, times_used, per_customer_limit, first_order_only,
                applicable_product_ids_json, applicable_addon_ids_json, created_at, updated_at
         FROM promotions WHERE code = ? LIMIT 1`
      )
        .bind(cleanCode)
        .first();

      if (row) {
        const mapped = mapPromotionRow(row);
        if (env.PRODUCTS_KV) {
          try {
            await env.PRODUCTS_KV.put(`promo:${cleanCode}`, JSON.stringify(row), { expirationTtl: 86400 * 30 });
          } catch {}
        }
        return mapped;
      }
    } catch (d1Err) {
      console.warn('D1 getPromotionByCode error:', d1Err.message);
    }
  }

  // 3. Fallback to built-in verified promotions
  const found = DEFAULT_PROMOTIONS.find((p) => p.code === cleanCode);
  return found ? { ...found } : null;
}

/**
 * Retrieves a promotion by its unique ID.
 */
export async function getPromotionById(env, id) {
  if (!id) return null;
  const cleanId = String(id).trim();

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT id, code, name, type, discount_type, discount_value, active,
                starts_at, expires_at, minimum_order_paise, maximum_discount_paise,
                usage_limit, times_used, per_customer_limit, first_order_only,
                applicable_product_ids_json, applicable_addon_ids_json, created_at, updated_at
         FROM promotions WHERE id = ? LIMIT 1`
      )
        .bind(cleanId)
        .first();

      if (row) {
        return mapPromotionRow(row);
      }
    } catch (d1Err) {
      console.warn('D1 getPromotionById error:', d1Err.message);
    }
  }

  const found = DEFAULT_PROMOTIONS.find((p) => p.id === cleanId);
  return found ? { ...found } : null;
}


/**
 * Lists all promotions for admin management.
 */
export async function listPromotions(env) {
  if (env && env.DB) {
    try {
      const rowsRes = await env.DB.prepare(
        `SELECT id, code, name, type, discount_type, discount_value, active,
                starts_at, expires_at, minimum_order_paise, maximum_discount_paise,
                usage_limit, times_used, per_customer_limit, first_order_only,
                applicable_product_ids_json, applicable_addon_ids_json, created_at, updated_at
         FROM promotions ORDER BY created_at DESC LIMIT 100`
      ).all();

      if (rowsRes && Array.isArray(rowsRes.results) && rowsRes.results.length > 0) {
        return rowsRes.results.map(mapPromotionRow);
      }
    } catch (d1Err) {
      console.warn('D1 listPromotions error:', d1Err.message);
    }
  }

  // Fallback to default verified promotions
  return DEFAULT_PROMOTIONS.map((p) => ({ ...p }));
}

/**
 * Deactivates or removes a promotion.
 */
export async function deletePromotion(env, idOrCode) {
  if (!idOrCode) return false;
  const clean = String(idOrCode).trim();
  const cleanCode = clean.toUpperCase();
  const now = new Date().toISOString();

  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE promotions SET active = 0, updated_at = ? WHERE id = ? OR code = ?`
      )
        .bind(now, clean, cleanCode)
        .run();
    } catch (d1Err) {
      console.warn('D1 deletePromotion error:', d1Err.message);
    }
  }

  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.delete(`promo:${cleanCode}`);
    } catch {}
  }

  return true;
}

/**
 * Records a coupon redemption upon successful order payment and atomically increments times_used.
 */
export async function recordPromotionRedemption(env, redemption) {
  const code = redemption?.promotionCode || redemption?.code;
  if (!redemption || !code || !redemption.orderId) return null;
  const now = new Date().toISOString();
  const cleanCode = String(code).trim().toUpperCase();
  const id = redemption.id || `promo_red_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (env && env.DB) {
    try {
      // 1. Insert redemption record
      await env.DB.prepare(
        `INSERT OR IGNORE INTO promotion_redemptions (
          id, promotion_id, promotion_code, order_id, customer_id, customer_email, discount_paise, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          redemption.promotionId || cleanCode,
          cleanCode,
          redemption.orderId,
          redemption.customerId || null,
          redemption.customerEmail || null,
          Number(redemption.discountPaise || 0),
          now
        )
        .run();

      // 2. Concurrency-safe atomic increment of usage limit
      await env.DB.prepare(
        `UPDATE promotions
         SET times_used = times_used + 1, updated_at = ?
         WHERE code = ? AND (usage_limit IS NULL OR times_used < usage_limit)`
      )
        .bind(now, cleanCode)
        .run();
    } catch (d1Err) {
      console.warn('D1 recordPromotionRedemption error:', d1Err.message);
    }
  }

  // Update KV cache if present
  if (env && env.PRODUCTS_KV) {
    try {
      const cached = await env.PRODUCTS_KV.get(`promo:${cleanCode}`, { type: 'json' });
      if (cached) {
        cached.times_used = Number(cached.times_used || 0) + 1;
        await env.PRODUCTS_KV.put(`promo:${cleanCode}`, JSON.stringify(cached), { expirationTtl: 86400 * 30 });
      }
    } catch {}
  }

  return { id, success: true };
}

/**
 * Checks past redemption count for a promotion code by customer ID or email.
 */
export async function getPromotionRedemptionCount(env, code, customerId, customerEmail) {
  if (!code) return 0;
  const cleanCode = String(code).trim().toUpperCase();
  const cleanCustId = customerId ? String(customerId).trim() : null;
  const cleanEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : null;

  if (!cleanCustId && !cleanEmail) return 0;

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM promotion_redemptions
         WHERE promotion_code = ? AND (
           (? IS NOT NULL AND customer_id = ?) OR
           (? IS NOT NULL AND customer_email = ?)
         )`
      )
        .bind(cleanCode, cleanCustId, cleanCustId, cleanEmail, cleanEmail)
        .first();

      return Number(row?.count || 0);
    } catch (d1Err) {
      console.warn('D1 getPromotionRedemptionCount error:', d1Err.message);
    }
  }

  return 0;
}

/**
 * Checks whether a customer has any prior PAID orders (for first_order_only validation).
 */
export async function customerHasPaidOrders(env, customerId, customerEmail) {
  const cleanCustId = customerId ? String(customerId).trim() : null;
  const cleanEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : null;

  if (!cleanCustId && !cleanEmail) return false;

  if (env && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM orders
         WHERE status = 'PAID' AND (
           (? IS NOT NULL AND customer_id = ?) OR
           (? IS NOT NULL AND customer_email = ?)
         )`
      )
        .bind(cleanCustId, cleanCustId, cleanEmail, cleanEmail)
        .first();

      return Number(row?.count || 0) > 0;
    } catch (d1Err) {
      console.warn('D1 customerHasPaidOrders error:', d1Err.message);
    }
  }

  return false;
}

// ==============================================================================
// PHASE 11: FIRST-PARTY ANALYTICS & SALES FUNNEL ENGINE
// ==============================================================================

const ALLOWED_ANALYTICS_EVENTS = new Set([
  'PRODUCT_VIEWED',
  'ADD_TO_CART',
  'ADDON_SELECTED',
  'CHECKOUT_STARTED',
  'PAYMENT_INITIATED',
  'ORDER_PAID',
  'COUPON_APPLIED',
]);

/**
 * Returns date range ISO bounds in Asia/Kolkata (IST, UTC+05:30).
 */
export function resolveAnalyticsDateRange(filter = '7d', customStart = null, customEnd = null) {
  const IST_OFFSET_MS = 5.5 * 3600 * 1000;
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);

  // Helper to format Date in IST as YYYY-MM-DD
  const formatIstDate = (d) => d.toISOString().slice(0, 10);

  const todayStr = formatIstDate(nowIst);

  let startStr = todayStr;
  let endStr = todayStr;

  switch (filter) {
    case 'today':
      startStr = todayStr;
      endStr = todayStr;
      break;

    case 'yesterday': {
      const y = new Date(nowIst.getTime() - 24 * 3600 * 1000);
      startStr = formatIstDate(y);
      endStr = startStr;
      break;
    }

    case '7d': {
      const past7 = new Date(nowIst.getTime() - 6 * 24 * 3600 * 1000);
      startStr = formatIstDate(past7);
      endStr = todayStr;
      break;
    }

    case '30d': {
      const past30 = new Date(nowIst.getTime() - 29 * 24 * 3600 * 1000);
      startStr = formatIstDate(past30);
      endStr = todayStr;
      break;
    }

    case 'month': {
      // First day of current month
      const yyyy = nowIst.getUTCFullYear();
      const mm = String(nowIst.getUTCMonth() + 1).padStart(2, '0');
      startStr = `${yyyy}-${mm}-01`;
      endStr = todayStr;
      break;
    }

    case 'custom':
      if (customStart) startStr = String(customStart).slice(0, 10);
      if (customEnd) endStr = String(customEnd).slice(0, 10);
      if (startStr > endStr) {
        const tmp = startStr;
        startStr = endStr;
        endStr = tmp;
      }
      break;

    default: {
      const past7 = new Date(nowIst.getTime() - 6 * 24 * 3600 * 1000);
      startStr = formatIstDate(past7);
      endStr = todayStr;
      break;
    }
  }

  // Convert IST dates to UTC ISO bounds for database comparison
  // startStr 00:00:00 IST = startStr 00:00:00 - 5.5 hours UTC
  const startUtc = new Date(new Date(`${startStr}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);
  const endUtc = new Date(new Date(`${endStr}T23:59:59.999Z`).getTime() - IST_OFFSET_MS);

  return {
    filter,
    startDateStr: startStr,
    endDateStr: endStr,
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
    timezone: 'Asia/Kolkata (IST)',
  };
}

/**
 * Records a single first-party analytics event.
 * Non-fatal: failures are safely logged and will never throw or interrupt checkout/payment.
 */
export async function recordAnalyticsEvent(env, {
  eventType,
  productId = null,
  addOnId = null,
  orderId = null,
  customerId = null,
  sessionId = null,
  metadata = null,
}) {
  if (!eventType || !ALLOWED_ANALYTICS_EVENTS.has(eventType)) {
    return false;
  }

  const IST_OFFSET_MS = 5.5 * 3600 * 1000;
  const now = new Date();
  const eventDate = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const createdAt = now.toISOString();

  const id = `aevt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanProduct = productId ? String(productId).trim().slice(0, 100) : null;
  const cleanAddon = addOnId ? String(addOnId).trim().slice(0, 100) : null;
  const cleanOrder = orderId ? String(orderId).trim().slice(0, 100) : null;
  const cleanCustomer = customerId ? String(customerId).trim().slice(0, 100) : null;
  const cleanSession = sessionId ? String(sessionId).trim().slice(0, 100) : null;

  // Sanitize metadata: strictly exclude auth tokens, passwords, secrets, private file URLs
  let sanitizedMetadataJson = null;
  if (metadata && typeof metadata === 'object') {
    const cleanMeta = {};
    for (const [k, v] of Object.entries(metadata)) {
      const lk = k.toLowerCase();
      if (
        lk.includes('token') ||
        lk.includes('password') ||
        lk.includes('secret') ||
        lk.includes('cookie') ||
        lk.includes('fileurl') ||
        lk.includes('pdfurl')
      ) {
        continue;
      }
      cleanMeta[k] = v;
    }
    sanitizedMetadataJson = JSON.stringify(cleanMeta);
  }

  if (env && env.DB) {
    try {
      // Idempotency for ORDER_PAID: Do not double-count identical order payment event
      if (eventType === 'ORDER_PAID' && cleanOrder) {
        const existing = await env.DB.prepare(
          `SELECT id FROM analytics_events WHERE event_type = 'ORDER_PAID' AND order_id = ? LIMIT 1`
        )
          .bind(cleanOrder)
          .first();
        if (existing) {
          return true; // Already recorded
        }
      }

      await env.DB.prepare(
        `INSERT INTO analytics_events (
          id, event_type, event_date, product_id, add_on_id, order_id,
          customer_id, session_id, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          eventType,
          eventDate,
          cleanProduct,
          cleanAddon,
          cleanOrder,
          cleanCustomer,
          cleanSession,
          sanitizedMetadataJson,
          createdAt
        )
        .run();

      return true;
    } catch (d1Err) {
      console.warn('D1 recordAnalyticsEvent error (non-fatal):', d1Err.message);
    }
  }

  return false;
}

/**
 * Fetches consolidated first-party analytics dashboard metrics.
 * Runs efficient SQL aggregate queries on D1.
 */
export async function getAnalyticsDashboardData(env, { filter = '7d', startDate = null, endDate = null } = {}) {
  const range = resolveAnalyticsDateRange(filter, startDate, endDate);
  const { startIso, endIso, startDateStr, endDateStr, timezone } = range;

  // Default clean state
  const response = {
    success: true,
    dateRange: {
      filter,
      startDate: startDateStr,
      endDate: endDateStr,
      timezone,
    },
    overview: {
      paidOrders: 0,
      pendingOrders: 0,
      failedOrders: 0,
      userDroppedOrders: 0,
      paidRevenuePaise: 0,
      paidRevenue: 0,
      averageOrderValuePaise: 0,
      averageOrderValue: 0,
      checkoutConversionRate: 0,
    },
    funnel: {
      productViews: 0,
      addToCart: 0,
      checkoutStarts: 0,
      paymentInitiated: 0,
      orderPaid: 0,
      cartToCheckoutRate: 0,
      checkoutToPaidRate: 0,
      overallConversionRate: 0,
    },
    topProducts: [],
    addOnPerformance: [],
    promotions: [],
  };

  if (!env || !env.DB) {
    return response;
  }

  try {
    // 1. Orders financial aggregate (real financial source of truth)
    const ordersSummaryPromise = env.DB.prepare(
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_orders,
         SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_orders,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_orders,
         SUM(CASE WHEN status = 'USER_DROPPED' THEN 1 ELSE 0 END) as user_dropped_orders,
         SUM(CASE WHEN status = 'PAID' THEN amount_paise ELSE 0 END) as paid_revenue_paise
       FROM orders
       WHERE created_at >= ? AND created_at <= ?`
    )
      .bind(startIso, endIso)
      .first();

    // 2. Funnel counts by event type
    const funnelCountsPromise = env.DB.prepare(
      `SELECT event_type, COUNT(*) as count
       FROM analytics_events
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY event_type`
    )
      .bind(startIso, endIso)
      .all();

    // 3. Product-level funnel events (views, add to cart, checkout starts)
    const productEventsPromise = env.DB.prepare(
      `SELECT product_id, event_type, COUNT(*) as count
       FROM analytics_events
       WHERE product_id IS NOT NULL AND created_at >= ? AND created_at <= ?
       GROUP BY product_id, event_type`
    )
      .bind(startIso, endIso)
      .all();

    // 4. Add-on selection events
    const addonEventsPromise = env.DB.prepare(
      `SELECT add_on_id, COUNT(*) as count
       FROM analytics_events
       WHERE event_type = 'ADDON_SELECTED' AND add_on_id IS NOT NULL AND created_at >= ? AND created_at <= ?
       GROUP BY add_on_id`
    )
      .bind(startIso, endIso)
      .all();

    // 5. Line-item paid order analysis for product & add-on sales
    const paidOrdersPromise = env.DB.prepare(
      `SELECT id, amount_paise, items_json, coupon_code, discount_paise
       FROM orders
       WHERE status = 'PAID' AND created_at >= ? AND created_at <= ?`
    )
      .bind(startIso, endIso)
      .all();

    // 6. Promotions usage summary
    const promoSummaryPromise = env.DB.prepare(
      `SELECT
         coupon_code,
         COUNT(*) as paid_count,
         SUM(discount_paise) as total_discount_paise,
         SUM(amount_paise) as total_revenue_paise
       FROM orders
       WHERE status = 'PAID' AND coupon_code IS NOT NULL AND created_at >= ? AND created_at <= ?
       GROUP BY coupon_code`
    )
      .bind(startIso, endIso)
      .all();

    // Execute in parallel. Some deployments may not have the optional
    // analytics_events table migrated yet; order-based sales totals must still
    // render correctly in that case.
    const settled = await Promise.allSettled([
      ordersSummaryPromise,
      funnelCountsPromise,
      productEventsPromise,
      addonEventsPromise,
      paidOrdersPromise,
      promoSummaryPromise,
    ]);
    const settledValue = (idx, fallback = null) => {
      const result = settled[idx];
      if (result && result.status === 'fulfilled') return result.value;
      if (result && result.status === 'rejected') {
        console.warn('Analytics dashboard partial query failed:', result.reason?.message || result.reason);
      }
      return fallback;
    };

    const ordersSummary = settledValue(0, null);
    const funnelCountsRes = settledValue(1, { results: [] });
    const productEventsRes = settledValue(2, { results: [] });
    const addonEventsRes = settledValue(3, { results: [] });
    const paidOrdersRes = settledValue(4, { results: [] });
    const promoSummaryRes = settledValue(5, { results: [] });

    // Process Orders Summary
    const paidOrders = Number(ordersSummary?.paid_orders) || 0;
    const pendingOrders = Number(ordersSummary?.pending_orders) || 0;
    const failedOrders = Number(ordersSummary?.failed_orders) || 0;
    const userDroppedOrders = Number(ordersSummary?.user_dropped_orders) || 0;
    const paidRevenuePaise = Number(ordersSummary?.paid_revenue_paise) || 0;
    const paidRevenue = Math.round(paidRevenuePaise / 100);
    const aovPaise = paidOrders > 0 ? Math.round(paidRevenuePaise / paidOrders) : 0;
    const aovRupees = Math.round(aovPaise / 100);

    // Process Funnel Counts
    const eventCounts = {};
    if (funnelCountsRes && Array.isArray(funnelCountsRes.results)) {
      for (const row of funnelCountsRes.results) {
        eventCounts[row.event_type] = Number(row.count) || 0;
      }
    }

    const productViews = eventCounts['PRODUCT_VIEWED'] || 0;
    const addToCart = eventCounts['ADD_TO_CART'] || 0;
    const checkoutStarts = eventCounts['CHECKOUT_STARTED'] || 0;
    const paymentInitiated = eventCounts['PAYMENT_INITIATED'] || 0;
    const orderPaidEvents = eventCounts['ORDER_PAID'] || paidOrders;

    const cartToCheckoutRate = addToCart > 0 ? Math.round((checkoutStarts / addToCart) * 1000) / 10 : 0;
    const checkoutToPaidRate = checkoutStarts > 0 ? Math.round((paidOrders / checkoutStarts) * 1000) / 10 : 0;
    const overallConversionRate = productViews > 0 ? Math.round((paidOrders / productViews) * 1000) / 10 : 0;

    response.overview = {
      paidOrders,
      pendingOrders,
      failedOrders,
      userDroppedOrders,
      paidRevenuePaise,
      paidRevenue,
      averageOrderValuePaise: aovPaise,
      averageOrderValue: aovRupees,
      checkoutConversionRate: checkoutToPaidRate,
    };

    response.funnel = {
      productViews,
      addToCart,
      checkoutStarts,
      paymentInitiated,
      orderPaid: orderPaidEvents,
      cartToCheckoutRate,
      checkoutToPaidRate,
      overallConversionRate,
    };

    // Product line-item analysis
    const productStatsMap = new Map();
    const addonStatsMap = new Map();

    // Populate from analytics events
    if (productEventsRes && Array.isArray(productEventsRes.results)) {
      for (const row of productEventsRes.results) {
        const pId = row.product_id;
        if (!productStatsMap.has(pId)) {
          productStatsMap.set(pId, {
            productId: pId,
            title: pId,
            views: 0,
            addToCart: 0,
            checkoutStarts: 0,
            paidOrders: 0,
            revenuePaise: 0,
            revenue: 0,
            conversionRate: 0,
          });
        }
        const pStats = productStatsMap.get(pId);
        if (row.event_type === 'PRODUCT_VIEWED') pStats.views += Number(row.count) || 0;
        if (row.event_type === 'ADD_TO_CART') pStats.addToCart += Number(row.count) || 0;
        if (row.event_type === 'CHECKOUT_STARTED') pStats.checkoutStarts += Number(row.count) || 0;
      }
    }

    if (addonEventsRes && Array.isArray(addonEventsRes.results)) {
      for (const row of addonEventsRes.results) {
        const aId = row.add_on_id;
        addonStatsMap.set(aId, {
          addOnId: aId,
          name: aId,
          selections: Number(row.count) || 0,
          paidPurchases: 0,
          eligibleBasePurchases: 0,
          attachmentRate: 0,
          revenuePaise: 0,
          revenue: 0,
        });
      }
    }

    // Process actual line items from PAID orders
    const paidOrderRows = paidOrdersRes && Array.isArray(paidOrdersRes.results) ? paidOrdersRes.results : [];
    for (const ord of paidOrderRows) {
      let items = [];
      try {
        items = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : (ord.items || []);
      } catch {
        items = [];
      }

      for (const item of items) {
        const pId = item.productId || item.bookId || item.id;
        if (!pId) continue;

        if (!productStatsMap.has(pId)) {
          productStatsMap.set(pId, {
            productId: pId,
            title: item.title || item.productNameSnapshot || pId,
            views: 0,
            addToCart: 0,
            checkoutStarts: 0,
            paidOrders: 0,
            revenuePaise: 0,
            revenue: 0,
            conversionRate: 0,
          });
        }

        const pStats = productStatsMap.get(pId);
        pStats.paidOrders += (Number(item.quantity) || 1);
        pStats.title = item.title || item.productNameSnapshot || pStats.title;

        // Line item product price. Historical snapshots may store either total
        // price, unit price, or legacy rupee fields.
        const qty = Number(item.quantity) || 1;
        const itemPaise =
          Number(item.totalPricePaise) ||
          Math.round(Number(item.totalPrice || 0) * 100) ||
          (Number(item.unitPricePaise) * qty) ||
          Math.round(Number(item.unitPrice || item.price || 0) * 100 * qty) ||
          0;
        pStats.revenuePaise += itemPaise;
        pStats.revenue = Math.round(pStats.revenuePaise / 100);

        // Process Add-ons
        const addOns = Array.isArray(item.addOns)
          ? item.addOns
          : (Array.isArray(item.selectedAddons) ? item.selectedAddons : []);

        for (const addon of addOns) {
          const aId = addon.addOnId || addon.id;
          if (!aId || aId === 'digital' || aId === 'physical') continue;

          if (!addonStatsMap.has(aId)) {
            addonStatsMap.set(aId, {
              addOnId: aId,
              name: addon.name || addon.nameSnapshot || aId,
              parentProductId: pId,
              selections: 0,
              paidPurchases: 0,
              eligibleBasePurchases: 0,
              attachmentRate: 0,
              revenuePaise: 0,
              revenue: 0,
            });
          }

          const aStats = addonStatsMap.get(aId);
          aStats.name = addon.name || addon.nameSnapshot || aStats.name;
          const addonQty = Number(addon.quantity) || 1;
          aStats.paidPurchases += addonQty;
          const addonPaise =
            (Number(addon.totalPricePaise) || 0) ||
            Math.round(Number(addon.totalPrice || 0) * 100) ||
            (Number(addon.unitPricePaise) * addonQty) ||
            Math.round(Number(addon.pricePaise || 0) * addonQty) ||
            Math.round(Number(addon.unitPrice || addon.price || 0) * 100 * addonQty) ||
            0;
          aStats.revenuePaise += addonPaise;
          aStats.revenue = Math.round(aStats.revenuePaise / 100);
        }
      }
    }

    // Calculate product conversion rate and sort objectively by paid orders
    const productsList = Array.from(productStatsMap.values()).map((p) => {
      p.conversionRate = p.views > 0 ? Math.round((p.paidOrders / p.views) * 1000) / 10 : 0;
      return p;
    });
    productsList.sort((a, b) => b.paidOrders - a.paidOrders || b.revenuePaise - a.revenuePaise);
    response.topProducts = productsList;

    // Calculate add-on attachment rate against total eligible base purchases
    const addonsList = Array.from(addonStatsMap.values()).map((a) => {
      // Denominator: Total paid purchases of base products (or parent product)
      const parentP = a.parentProductId ? productStatsMap.get(a.parentProductId) : null;
      const eligibleBase = parentP ? parentP.paidOrders : paidOrders;
      a.eligibleBasePurchases = eligibleBase;
      a.attachmentRate = eligibleBase > 0 ? Math.round((a.paidPurchases / eligibleBase) * 1000) / 10 : 0;
      return a;
    });
    addonsList.sort((a, b) => b.paidPurchases - a.paidPurchases || b.selections - a.selections);
    response.addOnPerformance = addonsList;

    // Process Promotions Summary
    if (promoSummaryRes && Array.isArray(promoSummaryRes.results)) {
      response.promotions = promoSummaryRes.results.map((row) => {
        const discountPaise = Number(row.total_discount_paise) || 0;
        const revenuePaise = Number(row.total_revenue_paise) || 0;
        return {
          code: String(row.coupon_code),
          name: String(row.coupon_code),
          discountType: 'COUPON',
          timesUsed: Number(row.paid_count) || 0,
          paidOrders: Number(row.paid_count) || 0,
          discountGivenPaise: discountPaise,
          discountGiven: Math.round(discountPaise / 100),
          revenueGeneratedPaise: revenuePaise,
          revenueGenerated: Math.round(revenuePaise / 100),
        };
      });
    }
  } catch (err) {
    console.error('getAnalyticsDashboardData error:', err);
  }

  return response;
}
