// scripts/test-phase13f-hardening.mjs
// Step 13F.1 Hardening & Order Recovery Verification Tests

import assert from 'node:assert';
import crypto from 'node:crypto';

import { saveOrder, getOrder, updateOrderStatus } from '../functions/utils/db.js';
import {
  recoverProductFromCashfreeOrder,
  provisionPortalAccessForPaidOrder,
} from '../functions/utils/portalBridge.js';
import { onRequestPost as handleCreateCashfreeOrder } from '../functions/api/create-cashfree-order.js';
import { onRequestPost as handleCashfreeWebhook } from '../functions/api/cashfree-webhook.js';
import { onRequestGet as handleOrderStatusGet } from '../functions/api/order-status.js';

class MockD1 {
  constructor() {
    this.orders = new Map();
    this.events = [];
  }

  prepare(query) {
    const trimmed = query.trim();
    return {
      bind: (...args) => ({
        run: async () => {
          if (trimmed.startsWith('INSERT INTO orders')) {
            const [
              id, cf_order_id, customer_id, amount_paise, currency, status,
              customer_name, customer_email, customer_phone,
              shipping_address_json, items_json, coupon_code, discount_paise,
              promotion_snapshot_json, subtotal_paise, shipping_paise, total_paise
            ] = args;
            const row = {
              id, cf_order_id, customer_id, amount_paise, currency, status,
              customer_name, customer_email, customer_phone,
              shipping_address_json, items_json, coupon_code, discount_paise,
              promotion_snapshot_json, subtotal_paise, shipping_paise, total_paise,
              created_at: new Date().toISOString(),
            };
            this.orders.set(id, row);
            return { success: true };
          }
          if (trimmed.startsWith('INSERT INTO order_events')) {
            this.events.push(args);
            return { success: true };
          }
          if (trimmed.startsWith('UPDATE orders SET status =')) {
            const [status, id] = args;
            const row = this.orders.get(id);
            if (row) row.status = status;
            return { success: true };
          }
          return { success: true };
        },
        first: async () => {
          if (trimmed.startsWith('SELECT * FROM orders WHERE id =')) {
            const [id] = args;
            return this.orders.get(id) || null;
          }
          if (trimmed.startsWith('SELECT COUNT(*) as cnt FROM orders')) {
            return { cnt: this.orders.size };
          }
          if (trimmed.startsWith('SELECT COUNT(*) as cnt FROM order_events')) {
            return { cnt: this.events.length };
          }
          return null;
        },
        all: async () => ({ results: [] }),
      }),
    };
  }
}

function makeEnv(overrides = {}) {
  return {
    DB: new MockD1(),
    CASHFREE_SECRET_KEY: 'cfsk_ma_test_hardening_secret',
    CASHFREE_APP_ID: 'TEST_APP_HARDENING',
    CASHFREE_ENV: 'SANDBOX',
    MAIN_SITE_INTEGRATION_SECRET: 'hardening_shared_secret',
    PORTAL_PURCHASE_BRIDGE_URL: 'https://portal.test.local/api/integrations/main-site/purchase',
    PORTAL_BRIDGE_TIMEOUT_MS: '2000',
    ...overrides,
  };
}

function signWebhook(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');
}

async function test1_brokenDbFailsCheckoutSafely() {
  // Test: Broken DB (like string DB="xylem-production-db") must reject checkout with 500 and NOT proceed to Cashfree
  const env = makeEnv({ DB: 'xylem-production-db' }); // string DB!
  delete env.PRODUCTS_KV;

  let cashfreeCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('cashfree.com')) {
      cashfreeCalled = true;
    }
    return new Response(JSON.stringify({ payment_session_id: 'fake' }), { status: 200 });
  };

  try {
    const req = new Request('https://aylemlearning.online/api/create-cashfree-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [{ productId: 'ielts-full-prep', quantity: 1, deliveryOption: 'digital' }],
        shippingInfo: {
          fullName: 'Test Student',
          email: 'student@example.com',
          phone: '9876543210',
          deliveryOption: 'digital',
        },
      }),
    });

    const res = await handleCreateCashfreeOrder({ request: req, env });
    assert.strictEqual(res.status, 500, 'Expected HTTP 500 when DB is a plain string');
    assert.strictEqual(cashfreeCalled, false, 'Cashfree payment session must NOT be created if DB persistence fails');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('  OK: Broken DB binding halts checkout with HTTP 500 and prevents orphan payment session');
}

async function test2_correctD1PersistsAndPermitsCheckout() {
  const env = makeEnv();
  let cashfreePayload = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('cashfree.com')) {
      cashfreePayload = JSON.parse(opts.body);
      return new Response(JSON.stringify({ payment_session_id: 'session_test_123', order_id: cashfreePayload.order_id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('https://aylemlearning.online/api/create-cashfree-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [{ productId: 'ielts-full-prep', quantity: 1, deliveryOption: 'digital' }],
        shippingInfo: {
          fullName: 'Valid User',
          email: 'valid@example.com',
          phone: '9876543210',
          deliveryOption: 'digital',
        },
      }),
    });

    const res = await handleCreateCashfreeOrder({ request: req, env });
    assert.strictEqual(res.status, 200, 'Expected 200 with valid D1');
    const data = await res.json();
    assert.ok(data.paymentSessionId, 'Expected paymentSessionId');
    assert.ok(env.DB.orders.has(data.orderId), 'Order must be persisted in D1 before gateway returns');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('  OK: Valid D1 binding persists order before calling Cashfree');
}

async function test3_productRecoveryAuthoritativeMatch() {
  const env = makeEnv();

  // Test 3a: IELTS Full Prep note resolves to IELTS
  const cfDataIelts = {
    order_id: 'order_123',
    order_amount: 199.00,
    order_currency: 'INR',
    order_status: 'PAID',
    order_note: 'Xylem Learning - IELTS Full Preparation with Mock Tests',
    order_tags: { delivery_option: 'digital' },
  };
  const recoveredIelts = await recoverProductFromCashfreeOrder(cfDataIelts, env);
  assert.ok(recoveredIelts, 'Should recover IELTS product');
  assert.strictEqual(recoveredIelts.productId, 'ielts-full-prep');
  assert.strictEqual(recoveredIelts.category, 'IELTS');

  // Test 3b: Generic note does NOT guess IELTS
  const cfDataGeneric = {
    order_id: 'order_456',
    order_amount: 199.00,
    order_currency: 'INR',
    order_status: 'PAID',
    order_note: 'Xylem Learning - Exam Study Guide',
  };
  const recoveredGeneric = await recoverProductFromCashfreeOrder(cfDataGeneric, env);
  assert.strictEqual(recoveredGeneric, null, 'Must NOT guess product if note is generic');

  // Test 3c: Empty note does NOT guess
  const cfDataEmpty = {
    order_id: 'order_789',
    order_amount: 199.00,
    order_currency: 'INR',
    order_status: 'PAID',
    order_note: '',
  };
  const recoveredEmpty = await recoverProductFromCashfreeOrder(cfDataEmpty, env);
  assert.strictEqual(recoveredEmpty, null, 'Must NOT guess product if note is empty');

  console.log('  OK: Product recovery is strictly authoritative and rejects ambiguous/generic metadata');
}

async function test4_orderStatusServerSideRecovery() {
  const env = makeEnv();
  // Order does NOT exist in DB initially
  const orderId = 'order_unpersisted_123';

  let portalProvisionCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('cashfree.com/pg/orders')) {
      return new Response(JSON.stringify({
        order_id: orderId,
        order_amount: 199.00,
        order_currency: 'INR',
        order_status: 'PAID',
        order_note: 'Xylem Learning - IELTS Full Preparation with Mock Tests',
        customer_details: {
          customer_name: 'Recovered Student',
          customer_email: 'recovered@example.com',
          customer_phone: '9876543210',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('portal.test.local')) {
      portalProvisionCalled = true;
      return new Response(JSON.stringify({ ok: true, status: 'PROVISIONED' }), { status: 200 });
    }
    return originalFetch(url);
  };

  try {
    const req = new Request(`https://aylemlearning.online/api/order-status?order_id=${orderId}`, {
      method: 'GET',
    });

    const res = await handleOrderStatusGet({ request: req, env });
    assert.strictEqual(res.status, 200, 'Expected HTTP 200 on recovered paid order');
    const data = await res.json();
    assert.strictEqual(data.status, 'PAID');
    assert.strictEqual(data.portalUrl, 'https://portal.aylemlearning.online/');
    assert.ok(env.DB.orders.has(orderId), 'Recovered order must now be persisted in D1');
    assert.strictEqual(portalProvisionCalled, true, 'Portal bridge must be invoked upon recovery');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('  OK: /api/order-status safely recovers unpersisted PAID order, writes to D1, and provisions portal');
}

async function test5_webhookDoesNotBlindlyProvisionUnknownOrder() {
  const env = makeEnv();
  const orderId = 'order_unknown_random';

  let portalProvisionCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('portal.test.local')) {
      portalProvisionCalled = true;
    }
    return originalFetch(url);
  };

  try {
    const payload = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: orderId, order_amount: 199.00, order_note: 'Exam Study Guide' }, // generic unrecoverable note
        payment: { payment_status: 'SUCCESS' },
      },
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = signWebhook(env.CASHFREE_SECRET_KEY, ts, payload);

    const req = new Request('https://aylemlearning.online/api/cashfree-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': sig,
        'x-webhook-timestamp': ts,
      },
      body: payload,
    });

    const res = await handleCashfreeWebhook({ request: req, env });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.warning, 'Order not found or product unrecoverable');
    assert.strictEqual(portalProvisionCalled, false, 'Must NOT provision portal when product cannot be authoritatively determined');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('  OK: Webhook with unrecoverable product rejects provisioning safely');
}

async function main() {
  console.log('=== STEP 13F.1 HARDENING TESTS ===');
  await test1_brokenDbFailsCheckoutSafely();
  await test2_correctD1PersistsAndPermitsCheckout();
  await test3_productRecoveryAuthoritativeMatch();
  await test4_orderStatusServerSideRecovery();
  await test5_webhookDoesNotBlindlyProvisionUnknownOrder();
  console.log('ALL STEP 13F.1 HARDENING TESTS PASSED SUCCESSFULLY!\n');
}

main().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
