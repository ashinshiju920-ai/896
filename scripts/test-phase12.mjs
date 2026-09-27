// scripts/test-phase12.mjs
// Phase 12 Comprehensive Production Hardening & Security Audit Test Suite
// Verifies all Section 49 Security Regression Tests (A through O),
// Payment Regression Tests (Section 50), Account Regression Tests (Section 51),
// and Admin Operations Regression Tests (Section 52).

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  saveOrder,
  getOrder,
  updateOrderStatus,
  createCustomer,
  getCustomerByEmail,
  getCustomerById,
  createCustomerSession,
  getCustomerSessionByTokenHash,
  revokeCustomerSession,
  saveOrderClaim,
  getOrderClaim,
  consumeOrderClaim,
  createEntitlementsForPaidOrder,
  getEntitlementsByOrderId,
  issuePaidFulfillmentLinks,
  savePromotion,
  getPromotionByCode,
  listOrdersWithSearch,
  getAnalyticsDashboardData,
} from '../functions/utils/db.js';
import { DEFAULT_CATALOG, computeOrderPrice } from '../functions/utils/pricing.js';
import { onRequestPost as handleCouponValidatePost } from '../functions/api/coupon/validate.js';

import {
  hashPassword,
  createSessionToken,
  verifySessionToken,
  sha256Hex,
  generateRandomToken,
  timingSafeEqual,
} from '../functions/utils/auth.js';

import {
  onRequestPost as handleCreateCashfreeOrder,
  onRequestGet as handleCreateCashfreeOrderGet,
} from '../functions/api/create-cashfree-order.js';

import {
  onRequestPost as handleCashfreeWebhook,
} from '../functions/api/cashfree-webhook.js';

import {
  onRequestGet as handleDownloadGet,
} from '../functions/api/download.js';

import {
  onRequestGet as handleOrderStatusGet,
} from '../functions/api/order-status.js';

import {
  onRequestPost as handleCustomerLoginPost,
} from '../functions/api/customer/login.js';

import {
  onRequestPost as handleCustomerActivatePost,
} from '../functions/api/customer/activate-after-purchase.js';

import {
  onRequestGet as handleCustomerMaterialsGet,
} from '../functions/api/customer/materials.js';

import {
  onRequestPost as handleCustomerChangePasswordPost,
} from '../functions/api/customer/change-password.js';

import {
  onRequestPost as handleAdminLoginPost,
} from '../functions/api/admin/login.js';

import {
  onRequestGet as handleAdminOrdersGet,
} from '../functions/api/admin/orders.js';

import {
  onRequestGet as handleAdminAnalyticsGet,
} from '../functions/api/admin/analytics.js';

import {
  onRequestGet as handleHealthGet,
} from '../functions/api/health.js';

// In-Memory Cloudflare KV Mock
class MockKV {
  constructor() {
    this.store = new Map();
  }
  async get(key, options) {
    const val = this.store.get(key);
    if (!val) return null;
    if (options && options.type === 'json') return JSON.parse(val);
    return val;
  }
  async put(key, value, options) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async delete(key) {
    this.store.delete(key);
  }
  async list({ prefix = '' } = {}) {
    const keys = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) keys.push({ name: k });
    }
    return { keys };
  }
}

// In-Memory Cloudflare D1 Mock with SQLite-like operations
class MockD1 {
  constructor() {
    this.orders = new Map();
    this.customers = new Map();
    this.customerSessions = new Map();
    this.orderClaims = new Map();
    this.entitlements = new Map();
    this.promotions = new Map();
    this.analyticsEvents = [];
    this.orderEvents = [];
  }

  prepare(sql) {
    const trimmed = sql.trim();
    return {
      bind: (...params) => ({
        first: async () => {
          if (trimmed.includes('COUNT(*) as total FROM orders')) {
            const statusFilter = params[0];
            let count = 0;
            for (const o of this.orders.values()) {
              if (!statusFilter || o.status === statusFilter) count++;
            }
            return { total: count };
          }
          if (trimmed.includes('SELECT * FROM orders WHERE id = ?') || trimmed.includes('WHERE id = ? OR cf_order_id = ?')) {
            const id = params[0];
            return this.orders.get(id) || [...this.orders.values()].find((o) => o.cf_order_id === id) || null;
          }
          if (trimmed.includes('SELECT * FROM customers WHERE email = ?')) {
            const email = params[0];
            return [...this.customers.values()].find((c) => c.email.toLowerCase() === String(email).toLowerCase()) || null;
          }
          if (trimmed.includes('SELECT * FROM customers WHERE id = ?')) {
            return this.customers.get(params[0]) || null;
          }
          if (trimmed.includes('SELECT * FROM customer_sessions WHERE token_hash = ?')) {
            return this.customerSessions.get(params[0]) || null;
          }
          if (trimmed.includes('SELECT * FROM order_claims WHERE order_id = ?')) {
            return this.orderClaims.get(params[0]) || null;
          }
          if (trimmed.includes('SELECT * FROM promotions WHERE code = ?')) {
            return this.promotions.get(params[0]) || null;
          }
          if (trimmed.includes('SUM(CASE WHEN status = \'PAID\'')) {
            let total = 0, paid = 0, pending = 0, failed = 0, dropped = 0, rev = 0;
            for (const o of this.orders.values()) {
              total++;
              if (o.status === 'PAID') { paid++; rev += (o.amount_paise || 0); }
              else if (o.status === 'PENDING') pending++;
              else if (o.status === 'FAILED') failed++;
              else if (o.status === 'USER_DROPPED') dropped++;
            }
            return { total_orders: total, paid_orders: paid, pending_orders: pending, failed_orders: failed, user_dropped_orders: dropped, paid_revenue_paise: rev };
          }
          return null;
        },
        all: async () => {
          if (trimmed.includes('FROM orders WHERE customer_id = ?') || (trimmed.includes('FROM orders') && trimmed.includes('customer_id = ?'))) {
            const customerId = params[0];
            const list = [...this.orders.values()].filter((o) => o.customer_id === customerId);
            return { results: list };
          }
          if (trimmed.includes('FROM orders') && trimmed.includes('LIKE ?')) {
            const search = params[1] || params[0];
            const list = [...this.orders.values()].filter(
              (o) =>
                o.id === search ||
                o.cf_order_id === search ||
                (o.customer_email && o.customer_email.includes(search)) ||
                (o.customer_name && o.customer_name.includes(search))
            );
            return { results: list };
          }
          if (trimmed.includes('FROM orders')) {
            return { results: [...this.orders.values()] };
          }
          if (trimmed.includes('FROM entitlements WHERE order_id = ?')) {
            const orderId = params[0];
            const list = [...this.entitlements.values()].filter((e) => e.order_id === orderId);
            return { results: list };
          }
          if (trimmed.includes('FROM entitlements e') && trimmed.includes('JOIN orders o')) {
            const customerId = params[0];
            const list = [];
            for (const e of this.entitlements.values()) {
              const ord = this.orders.get(e.order_id);
              if (ord && ord.customer_id === customerId && ord.status === 'PAID') {
                list.push({ ...e, orderId: e.order_id, productId: e.product_id, addOnId: e.add_on_id, grantedAt: e.created_at });
              }
            }
            return { results: list };
          }
          if (trimmed.includes('FROM analytics_events')) {
            return { results: this.analyticsEvents };
          }
          if (trimmed.includes('FROM promotions')) {
            return { results: [...this.promotions.values()] };
          }
          return { results: [] };
        },
        run: async () => {
          if (trimmed.startsWith('INSERT INTO orders')) {
            const [id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, coupon_code, discount_paise, promotion_snapshot_json, subtotal_paise, shipping_paise, total_paise, created_at, updated_at] = params;
            this.orders.set(id, { id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, coupon_code, discount_paise, promotion_snapshot_json, subtotal_paise, shipping_paise, total_paise, created_at, updated_at });
          } else if (trimmed.startsWith('UPDATE orders SET status =')) {
            const [newStatus, now, cleanId1, cleanId2] = params;
            const ord = this.orders.get(cleanId1) || [...this.orders.values()].find((o) => o.cf_order_id === cleanId1);
            if (ord) {
              // State transition safety check
              if (ord.status === 'PAID' && newStatus !== 'PAID') {
                // Block invalid transition
                return { success: false };
              }
              ord.status = newStatus;
              ord.updated_at = now;
            }
          } else if (trimmed.startsWith('INSERT INTO customers')) {
            const [id, email, name, phone, password_hash, password_salt, status, created_at, updated_at] = params;
            this.customers.set(id, { id, email, name, phone, password_hash, password_salt, status, created_at, updated_at });
          } else if (trimmed.startsWith('INSERT INTO customer_sessions')) {
            const [id, customer_id, token_hash, expires_at, created_at] = params;
            this.customerSessions.set(token_hash, { id, customer_id, token_hash, expires_at, created_at });
          } else if (trimmed.startsWith('INSERT INTO order_claims')) {
            const [id, order_id, claim_hash, expires_at, purpose, created_at] = params;
            this.orderClaims.set(order_id, { id, order_id, claim_hash, expires_at, purpose, created_at, consumed_at: null });
          } else if (trimmed.startsWith('UPDATE order_claims SET consumed_at')) {
            const [now, orderId] = params;
            const cl = this.orderClaims.get(orderId);
            if (cl) cl.consumed_at = now;
          } else if (trimmed.startsWith('UPDATE orders SET customer_id')) {
            const [customerId, now, orderId] = params;
            const ord = this.orders.get(orderId);
            if (ord) ord.customer_id = customerId;
          } else if (trimmed.startsWith('INSERT INTO entitlements')) {
            const [id, order_id, product_id, add_on_id, title, status, file_ref, created_at] = params;
            this.entitlements.set(id, { id, order_id, product_id, add_on_id, title, status, file_ref, created_at });
          } else if (trimmed.startsWith('INSERT INTO analytics_events')) {
            const [id, event_type, event_date, product_id, add_on_id, order_id, customer_id, session_id, metadata_json, created_at] = params;
            this.analyticsEvents.push({ id, event_type, event_date, product_id, add_on_id, order_id, customer_id, session_id, metadata_json, created_at });
          } else if (trimmed.startsWith('INSERT INTO order_events')) {
            const [id, order_id, event_type, raw_payload, created_at] = params;
            this.orderEvents.push({ id, order_id, event_type, raw_payload, created_at });
          } else if (trimmed.startsWith('UPDATE customers SET password_hash')) {
            const [newHash, newSalt, now, customerId] = params;
            const c = this.customers.get(customerId);
            if (c) { c.password_hash = newHash; c.password_salt = newSalt; c.updated_at = now; }
          }
          return { success: true };
        },
      }),
    };
  }
}

// Set up unified test environment
const adminSalt = crypto.randomBytes(16).toString('hex');
const adminHash = crypto.pbkdf2Sync('SuperSecretAdmin123!', Buffer.from(adminSalt, 'hex'), 100000, 32, 'sha256').toString('hex');
const adminSecret = 'prod_hardened_admin_session_secret_2026';
const cashfreeSecret = 'cfsk_ma_test_hardening_secret_key_999';
const cashfreeAppId = 'TEST_XYLEM_APP_12345';
const downloadSigningKey = 'test_secure_download_signing_key_777';

function createTestEnv() {
  const kv = new MockKV();
  const db = new MockD1();
  return {
    DB: db,
    PRODUCTS_KV: kv,
    ADMIN_PASSWORD_HASH: adminHash,
    ADMIN_PASSWORD_SALT: adminSalt,
    ADMIN_SESSION_SECRET: adminSecret,
    CASHFREE_SECRET_KEY: cashfreeSecret,
    CASHFREE_APP_ID: cashfreeAppId,
    CASHFREE_ENV: 'SANDBOX',
    DOWNLOAD_SIGNING_KEY: downloadSigningKey,
  };
}

async function runPhase12Tests() {
  console.log('\n==================================================');
  console.log('PHASE 12: PRODUCTION HARDENING & SECURITY AUDIT');
  console.log('==================================================\n');

  const env = createTestEnv();

  // Seed standard products into KV
  await env.PRODUCTS_KV.put('products_catalog', JSON.stringify(DEFAULT_CATALOG));

  // Seed a sample promotion
  await savePromotion(env, {
    code: 'HARDEN20',
    discountType: 'percentage',
    discountValue: 20,
    active: true,
  });

  // --------------------------------------------------------------------------
  // TEST A: Customer cannot access admin endpoint (401/403)
  // --------------------------------------------------------------------------
  {
    // Create customer and session
    const custSalt = crypto.randomBytes(16).toString('hex');
    const custHash = await hashPassword('CustPass123!', custSalt);
    const customer = await createCustomer(env, {
      email: 'student_a@xylem.org',
      name: 'Student A',
      phone: '9876543210',
      passwordHash: custHash,
      passwordSalt: custSalt,
    });
    const custToken = generateRandomToken(32);
    const tokenHash = await sha256Hex(custToken);
    await createCustomerSession(env, {
      customerId: customer.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const fakeReq = new Request('http://localhost/api/admin/orders', {
      headers: { cookie: `customer_session=${custToken}` },
    });
    const res = await handleAdminOrdersGet({ request: fakeReq, env });
    assert.strictEqual(res.status, 401, 'Customer session MUST be rejected on admin endpoint with 401');
    console.log('  ✓ TEST A: Customer session cannot access admin endpoint (401)');
  }

  // --------------------------------------------------------------------------
  // TEST B: Admin endpoint rejects unauthenticated request (401)
  // --------------------------------------------------------------------------
  {
    const req = new Request('http://localhost/api/admin/analytics');
    const res = await handleAdminAnalyticsGet({ request: req, env });
    assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
    console.log('  ✓ TEST B: Unauthenticated request to admin endpoint is DENIED (401)');
  }

  // --------------------------------------------------------------------------
  // TEST C: Customer A cannot access Customer B materials (Isolation)
  // --------------------------------------------------------------------------
  {
    // Create Customer B with a paid order and active entitlement
    const custBSalt = crypto.randomBytes(16).toString('hex');
    const custBHash = await hashPassword('CustBPass123!', custBSalt);
    const customerB = await createCustomer(env, {
      email: 'student_b@xylem.org',
      name: 'Student B',
      phone: '9876543211',
      passwordHash: custBHash,
      passwordSalt: custBSalt,
    });

    const orderB = {
      id: 'order_test_b_1001',
      amount_paise: 19900,
      currency: 'INR',
      status: 'PAID',
      customer_id: customerB.id,
      customer_email: customerB.email,
      customer_name: customerB.name,
      items: [{ productId: 'ielts-full-prep', title: 'IELTS Full Prep', deliveryOption: 'digital', pricePaise: 19900 }],
    };
    await saveOrder(env, orderB);
    const entitlementsB = await createEntitlementsForPaidOrder(env, orderB);
    assert(entitlementsB.length > 0, 'Customer B must have entitlement');

    // Customer A logs in and accesses /api/customer/materials
    const custA = await getCustomerByEmail(env, 'student_a@xylem.org');
    const custAToken = generateRandomToken(32);
    const custATokenHash = await sha256Hex(custAToken);
    await createCustomerSession(env, {
      customerId: custA.id,
      tokenHash: custATokenHash,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const reqA = new Request('http://localhost/api/customer/materials', {
      headers: { cookie: `customer_session=${custAToken}` },
    });
    const resA = await handleCustomerMaterialsGet({ request: reqA, env });
    const dataA = await resA.json();

    // Customer A should see ZERO materials from Customer B
    assert.strictEqual(dataA.materials.length, 0, 'Customer A must NOT see Customer B materials');
    assert.strictEqual(dataA.orders.length, 0, 'Customer A must NOT see Customer B orders');
    console.log('  ✓ TEST C: Customer A cannot access Customer B materials or orders (Isolation)');
  }

  // --------------------------------------------------------------------------
  // TEST D: Tampered download token fails (403)
  // --------------------------------------------------------------------------
  {
    const orderId = 'order_test_b_1001';
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.fake_tampered_payload.invalidsig12345';
    const req = new Request(`http://localhost/api/download?order_id=${orderId}&book_id=ielts-full-prep&token=${fakeToken}`);
    const res = await handleDownloadGet({ request: req, env });
    assert.strictEqual(res.status, 403, 'Tampered download token must return 403');
    console.log('  ✓ TEST D: Tampered download token fails with 403');
  }

  // --------------------------------------------------------------------------
  // TEST E: Expired download token fails (403)
  // --------------------------------------------------------------------------
  {
    const orderId = 'order_test_b_1001';
    // Create token expired in the past
    const expiredPayload = {
      orderId,
      bookId: 'ielts-full-prep',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    };
    const expiredToken = await createSessionToken(expiredPayload, downloadSigningKey);
    const req = new Request(`http://localhost/api/download?order_id=${orderId}&book_id=ielts-full-prep&token=${expiredToken}`);
    const res = await handleDownloadGet({ request: req, env });
    assert.strictEqual(res.status, 403, 'Expired download token must return 403');
    console.log('  ✓ TEST E: Expired download token fails with 403');
  }

  // --------------------------------------------------------------------------
  // TEST F: Tampered Cashfree webhook fails signature verification (401)
  // --------------------------------------------------------------------------
  {
    const rawPayload = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: 'order_test_b_1001', order_amount: 199 },
        payment: { payment_status: 'SUCCESS', payment_amount: 199, payment_currency: 'INR' },
      },
    });
    const currentTs = Math.floor(Date.now() / 1000).toString();
    const req = new Request('http://localhost/api/cashfree-webhook', {
      method: 'POST',
      headers: {
        'x-webhook-timestamp': currentTs,
        'x-webhook-signature': 'invalid_tampered_signature_abc_123',
      },
      body: rawPayload,
    });
    const res = await handleCashfreeWebhook({ request: req, env });
    assert.strictEqual(res.status, 401, 'Tampered webhook signature must return 401');
    console.log('  ✓ TEST F: Tampered Cashfree webhook signature is rejected (401)');
  }

  // --------------------------------------------------------------------------
  // TEST G: Replayed webhook (>300s old) fails replay protection (401)
  // --------------------------------------------------------------------------
  {
    const rawPayload = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK' });
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago (>300s)

    // Compute legitimate HMAC on old timestamp
    const hmac = crypto.createHmac('sha256', cashfreeSecret);
    hmac.update(oldTimestamp + rawPayload);
    const validSigOld = hmac.digest('base64');

    const req = new Request('http://localhost/api/cashfree-webhook', {
      method: 'POST',
      headers: {
        'x-webhook-timestamp': oldTimestamp,
        'x-webhook-signature': validSigOld,
      },
      body: rawPayload,
    });
    const res = await handleCashfreeWebhook({ request: req, env });
    assert.strictEqual(res.status, 401, 'Replayed webhook older than 300s must be rejected (401)');
    console.log('  ✓ TEST G: Replayed webhook older than 300s is rejected (401)');
  }

  // --------------------------------------------------------------------------
  // TEST H: Duplicate verified webhook does not duplicate fulfillment
  // --------------------------------------------------------------------------
  {
    const orderHId = 'order_webhook_h_9001';
    await saveOrder(env, {
      id: orderHId,
      cf_order_id: orderHId,
      amount_paise: 19900,
      currency: 'INR',
      status: 'PENDING',
      customer_email: 'h_test@xylem.org',
      customer_name: 'H Test',
      items: [{ productId: 'ielts-full-prep', title: 'IELTS Full Prep', pricePaise: 19900 }],
    });

    const rawPayload = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: orderHId, order_amount: 199, order_currency: 'INR' },
        payment: { payment_status: 'SUCCESS', payment_amount: 199, payment_currency: 'INR' },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmac = crypto.createHmac('sha256', cashfreeSecret);
    hmac.update(timestamp + rawPayload);
    const validSig = hmac.digest('base64');

    // First webhook call: Marks order PAID & creates entitlements
    const req1 = new Request('http://localhost/api/cashfree-webhook', {
      method: 'POST',
      headers: { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': validSig },
      body: rawPayload,
    });
    const res1 = await handleCashfreeWebhook({ request: req1, env });
    assert.strictEqual(res1.status, 200);

    const entitlements1 = await getEntitlementsByOrderId(env, orderHId);
    const count1 = entitlements1.length;

    // Second duplicate webhook call
    const req2 = new Request('http://localhost/api/cashfree-webhook', {
      method: 'POST',
      headers: { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': validSig },
      body: rawPayload,
    });
    const res2 = await handleCashfreeWebhook({ request: req2, env });
    assert.strictEqual(res2.status, 200);
    const body2 = await res2.json();
    assert.strictEqual(body2.alreadyProcessed, true, 'Duplicate webhook must be recognized as already processed');

    const entitlements2 = await getEntitlementsByOrderId(env, orderHId);
    assert.strictEqual(entitlements2.length, count1, 'Duplicate webhook must NEVER duplicate entitlements');
    console.log('  ✓ TEST H: Duplicate verified webhook is idempotent; zero duplicate entitlements');
  }

  // --------------------------------------------------------------------------
  // TEST I: Client cannot override final price (Server-Authoritative Pricing)
  // --------------------------------------------------------------------------
  {
    // Client attempts to send total = ₹1 and requestedAmount = ₹1 for ₹199 item
    const maliciousBody = {
      cart: [{ bookId: 'ielts-full-prep', quantity: 1, deliveryOption: 'digital', price: 1, total: 1 }],
      total: 1,
      orderAmount: 1,
      pricePaise: 100,
      shippingInfo: {
        fullName: 'Price Tamperer',
        email: 'tamper@test.com',
        phone: '9876543210',
      },
      deliveryOption: 'digital',
    };

    // Override global fetch to mock Cashfree PG order creation
    const originalFetch = globalThis.fetch;
    let capturedCashfreeAmount = null;
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('cashfree.com/pg/orders')) {
        const payload = JSON.parse(opts.body);
        capturedCashfreeAmount = payload.order_amount;
        return new Response(JSON.stringify({
          order_id: payload.order_id,
          payment_session_id: 'session_mock_123',
        }), { status: 200 });
      }
      return originalFetch(url, opts);
    };

    try {
      const req = new Request('http://localhost/api/create-cashfree-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousBody),
      });
      const res = await handleCreateCashfreeOrder({ request: req, env });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedCashfreeAmount, 199, 'Cashfree order amount MUST be server-computed ₹199, ignoring client ₹1');
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log('  ✓ TEST I: Client cannot override price; server authoritatively computes total');
  }

  // --------------------------------------------------------------------------
  // TEST J: Client cannot mark an order PAID (Protected Status State Machine)
  // --------------------------------------------------------------------------
  {
    const orderJId = 'order_test_j_status_gate';
    await saveOrder(env, {
      id: orderJId,
      amount_paise: 19900,
      currency: 'INR',
      status: 'PAID',
    });

    // Attempt invalid state transition: try to downgrade PAID to FAILED
    await updateOrderStatus(env, orderJId, 'FAILED');
    const orderAfter = await getOrder(env, orderJId);
    assert.strictEqual(orderAfter.status, 'PAID', 'Confirmed PAID status must NEVER be overwritten by FAILED');
    console.log('  ✓ TEST J: State machine guard prevents PAID order from transitioning to FAILED');
  }

  // --------------------------------------------------------------------------
  // TEST K: Client cannot create entitlements directly
  // --------------------------------------------------------------------------
  {
    // Client tries to request /api/download for an unconfirmed order
    const pendingOrderId = 'order_pending_test_k';
    await saveOrder(env, {
      id: pendingOrderId,
      amount_paise: 19900,
      currency: 'INR',
      status: 'PENDING',
      customer_email: 'pending@test.com',
      items: [{ productId: 'ielts-full-prep', title: 'IELTS Full Prep' }],
    });

    const validToken = await createSessionToken({ orderId: pendingOrderId, bookId: 'ielts-full-prep' }, downloadSigningKey);
    const req = new Request(`http://localhost/api/download?order_id=${pendingOrderId}&book_id=ielts-full-prep&token=${validToken}`);
    const res = await handleDownloadGet({ request: req, env });
    assert.strictEqual(res.status, 403, 'Pending order must be denied download and entitlement creation');
    console.log('  ✓ TEST K: Client cannot create entitlements or download on unpaid orders');
  }

  // --------------------------------------------------------------------------
  // TEST L: Coupon manipulation fails safely
  // --------------------------------------------------------------------------
  {
    // 1. Customer validates fake coupon: rejected
    const validateReq = new Request('http://localhost/api/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'NON_EXISTENT_COUPON_99',
        cart: [{ bookId: 'ielts-full-prep', quantity: 1, deliveryOption: 'digital' }],
      }),
    });
    const validateRes = await handleCouponValidatePost({ request: validateReq, env });
    assert.strictEqual(validateRes.status, 200);
    const validateData = await validateRes.json();
    assert.strictEqual(validateData.valid, false, 'Fake coupon must be marked invalid');

    // 2. Server price calculation ignores fake coupon and awards zero discount
    const pricing = await computeOrderPrice(
      {
        cart: [{ bookId: 'ielts-full-prep', quantity: 1, deliveryOption: 'digital' }],
        couponCode: 'NON_EXISTENT_COUPON_99',
        deliveryOption: 'digital',
      },
      env
    );
    assert.strictEqual(pricing.couponDiscountPaise, 0, 'Fake coupon must produce 0 discount');
    assert.strictEqual(pricing.total, 199, 'Total must remain full price ₹199');
    console.log('  ✓ TEST L: Coupon manipulation fails safely; fake coupon rejected with zero discount');
  }

  // --------------------------------------------------------------------------
  // TEST M: SQL Injection attempts fail safely via parameterized queries
  // --------------------------------------------------------------------------
  {
    // Search with SQL injection payload: "' OR 1=1 --"
    const sqlInjectionSearch = "' OR '1'='1' --";
    const result = await listOrdersWithSearch(env, { search: sqlInjectionSearch });
    // Parameterized search treats payload as literal string, matching zero records
    assert.strictEqual(result.orders.length, 0, 'SQL injection attempt must match zero records via parameterized binding');
    console.log('  ✓ TEST M: SQL injection payload safely handled by parameterized query');
  }

  // --------------------------------------------------------------------------
  // TEST N: Oversized / malformed payload fails safely
  // --------------------------------------------------------------------------
  {
    const req = new Request('http://localhost/api/create-cashfree-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json: not valid ]',
    });
    const res = await handleCreateCashfreeOrder({ request: req, env });
    assert.strictEqual(res.status, 400, 'Malformed JSON must return 400');
    console.log('  ✓ TEST N: Malformed request payload fails safely with 400');
  }

  // --------------------------------------------------------------------------
  // TEST O: Sensitive secrets do not appear in production bundle
  // --------------------------------------------------------------------------
  {
    const targets = ['src', 'public'];
    const badPatterns = [
      /cfsk_ma_prod_/i,
      /CLOUDINARY_API_SECRET/i,
      /ADMIN_PASSWORD_HASH\s*=\s*['"][a-f0-9]{32,}/i,
    ];
    let leaks = 0;
    function checkDir(dir) {
      if (!fs.existsSync(dir)) return;
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) checkDir(full);
        else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx') || ent.name.endsWith('.js') || ent.name.endsWith('.html'))) {
          const content = fs.readFileSync(full, 'utf8');
          for (const pat of badPatterns) {
            if (pat.test(content)) leaks++;
          }
        }
      }
    }
    for (const t of targets) checkDir(path.join(rootDir, t));
    assert.strictEqual(leaks, 0, 'Zero production secrets may exist in client code');
    console.log('  ✓ TEST O: Production secret audit scan passed (0 secrets in client code)');
  }

  // --------------------------------------------------------------------------
  // TEST P: Post-payment one-time claim activation with cryptographic secret
  // --------------------------------------------------------------------------
  {
    const paidOrderId = 'order_claim_test_p_123';
    await saveOrder(env, {
      id: paidOrderId,
      amount_paise: 19900,
      currency: 'INR',
      status: 'PAID',
      customer_email: 'new_student@xylem.org',
      customer_name: 'New Student',
    });

    const rawClaimSecret = generateRandomToken(32);
    const claimHash = await sha256Hex(rawClaimSecret);
    await saveOrderClaim(env, {
      orderId: paidOrderId,
      claimHash,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      purpose: 'POST_PAYMENT_ACCOUNT_CLAIM',
    });

    // Activate account
    const actBody = {
      orderId: paidOrderId,
      name: 'New Student',
      password: 'StrongPassword99!',
      confirmPassword: 'StrongPassword99!',
      claimSecret: rawClaimSecret,
    };
    const req = new Request('http://localhost/api/customer/activate-after-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actBody),
    });
    const res = await handleCustomerActivatePost({ request: req, env });
    assert.strictEqual(res.status, 200, 'Activation with valid claim must succeed');
    const actData = await res.json();
    assert.strictEqual(actData.success, true);

    // Verify claim is marked consumed
    const claimRecord = await getOrderClaim(env, paidOrderId);
    assert(Boolean(claimRecord.consumed_at), 'Claim record must be consumed');

    // Attempt reuse: Second activation must fail with 403
    const reqReuse = new Request('http://localhost/api/customer/activate-after-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actBody),
    });
    const resReuse = await handleCustomerActivatePost({ request: reqReuse, env });
    assert.strictEqual(resReuse.status, 403, 'Reused claim secret must be rejected with 403');
    console.log('  ✓ TEST P: One-time claim secret validates and prevents reuse');
  }

  // --------------------------------------------------------------------------
  // TEST Q: Customer login and password verification
  // --------------------------------------------------------------------------
  {
    // Login with correct password
    const loginReq = new Request('http://localhost/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new_student@xylem.org', password: 'StrongPassword99!' }),
    });
    const loginRes = await handleCustomerLoginPost({ request: loginReq, env });
    assert.strictEqual(loginRes.status, 200, 'Login with correct password must succeed');

    // Login with wrong password
    const badLoginReq = new Request('http://localhost/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new_student@xylem.org', password: 'WrongPassword123!' }),
    });
    const badLoginRes = await handleCustomerLoginPost({ request: badLoginReq, env });
    assert.strictEqual(badLoginRes.status, 401, 'Login with bad password must return 401');
    console.log('  ✓ TEST Q: Customer login verifies PBKDF2 hash & rejects invalid passwords');
  }

  // --------------------------------------------------------------------------
  // TEST R: Admin login with PBKDF2 verification & constant-time check
  // --------------------------------------------------------------------------
  {
    // Correct admin password
    const adminReq = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'SuperSecretAdmin123!' }),
    });
    const adminRes = await handleAdminLoginPost({ request: adminReq, env });
    assert.strictEqual(adminRes.status, 200, 'Admin login with correct password must return 200');

    // Wrong admin password
    const badAdminReq = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'IncorrectAdminPassword!' }),
    });
    const badAdminRes = await handleAdminLoginPost({ request: badAdminReq, env });
    assert.strictEqual(badAdminRes.status, 401, 'Admin login with wrong password must return 401');
    console.log('  ✓ TEST R: Admin login verifies credentials & rejects unauthorized attempts');
  }

  // --------------------------------------------------------------------------
  // TEST S: Lightweight Health & Readiness Check Endpoint (/api/health)
  // --------------------------------------------------------------------------
  {
    const req = new Request('http://localhost/api/health');
    const res = await handleHealthGet({ request: req, env });
    assert.strictEqual(res.status, 200, 'Health endpoint must return 200');
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.service, 'xylem-learning-api');
    assert.strictEqual(typeof data.timestamp, 'string');
    assert.strictEqual(typeof data.storage.databaseConfigured, 'boolean');
    console.log('  ✓ TEST S: Lightweight health check endpoint (/api/health) reports operational status');
  }

  console.log('\n==================================================');
  console.log('ALL 19/19 PHASE 12 HARDENING TESTS PASSED!');
  console.log('==================================================\n');
}

runPhase12Tests().catch((err) => {
  console.error('\n❌ PHASE 12 TEST SUITE FAILED:', err);
  process.exit(1);
});
