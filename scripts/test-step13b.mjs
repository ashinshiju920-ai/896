// scripts/test-step13b.mjs
// Step 13B backend-only bridge tests. No real Cashfree or portal calls.

import assert from 'node:assert';
import crypto from 'node:crypto';

import { saveOrder, getOrder } from '../functions/utils/db.js';
import {
  resolveEligiblePortalCourses,
  provisionPortalAccessForPaidOrder,
} from '../functions/utils/portalBridge.js';
import { onRequestPost as handleCashfreeWebhook } from '../functions/api/cashfree-webhook.js';
import { onRequestGet as handleOrderStatusGet } from '../functions/api/order-status.js';

class MockKV {
  constructor() {
    this.store = new Map();
  }
  async get(key, options) {
    const value = this.store.get(key);
    if (!value) return null;
    if (options && options.type === 'json') return JSON.parse(value);
    return value;
  }
  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}

function makeEnv(overrides = {}) {
  return {
    PRODUCTS_KV: new MockKV(),
    CASHFREE_SECRET_KEY: 'cfsk_ma_test_step13b_secret',
    CASHFREE_APP_ID: 'TEST_APP_STEP13B',
    CASHFREE_ENV: 'SANDBOX',
    MAIN_SITE_INTEGRATION_SECRET: 'step13b_shared_secret_for_local_tests_only',
    PORTAL_PURCHASE_BRIDGE_URL: 'https://portal.test.local/api/integrations/main-site/purchase',
    PORTAL_BRIDGE_TIMEOUT_MS: '2000',
    ...overrides,
  };
}

function signCashfreeWebhook(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');
}

function decodeSignedPortalRequest(req) {
  const headers = req.headers instanceof Headers ? req.headers : new Headers(req.headers || {});
  const timestamp = headers.get('x-webhook-timestamp');
  const signature = headers.get('x-webhook-signature');
  const expected = crypto
    .createHmac('sha256', 'step13b_shared_secret_for_local_tests_only')
    .update(timestamp + req.body)
    .digest('base64');
  assert.strictEqual(signature, expected, 'Portal bridge HMAC signature must match timestamp + raw body');
  return JSON.parse(req.body);
}

async function withMockFetch(handler) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), ...init });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await handler(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function run() {
  console.log('=== STEP 13B MAIN-SITE PURCHASE BRIDGE TESTS ===\n');

  {
    const env = makeEnv();
    const order = {
      id: 'order_courses_all',
      status: 'PAID',
      customer_email: 'student@example.com',
      items: [
        { productId: 'ielts-full-prep', format: 'digital' },
        { productId: 'oet-full-prep', format: 'digital' },
        { productId: 'pte-full-prep', format: 'digital' },
        { productId: 'german-full-prep', format: 'digital' },
      ],
    };
    const result = await resolveEligiblePortalCourses(order, env);
    assert.deepStrictEqual(result.courses.map((c) => c.productKey).sort(), ['german', 'ielts', 'oet', 'pte']);
    console.log('  OK: IELTS, OET, PTE, and German resolve from server catalog categories');
  }

  {
    const env = makeEnv();
    const order = {
      id: 'order_multi_ielts',
      status: 'PAID',
      customer_email: 'student@example.com',
      items: [
        { productId: 'ielts-full-prep', format: 'digital' },
        { productId: 'ielts-vocab-booster', format: 'digital' },
        { productId: 'ielts-writing-task', format: 'physical' },
      ],
    };
    const result = await resolveEligiblePortalCourses(order, env);
    assert.strictEqual(result.courses.length, 1);
    assert.strictEqual(result.courses[0].productKey, 'ielts');
    console.log('  OK: Multiple IELTS products dedupe to one IELTS provisioning event');
  }

  {
    const env = makeEnv();
    const order = {
      id: 'order_mixed_courses',
      status: 'PAID',
      customer_email: 'student@example.com',
      items: [
        { productId: 'ielts-full-prep', format: 'digital' },
        { productId: 'oet-full-prep', format: 'physical' },
        { productId: 'german-full-prep', format: 'digital', addOns: [{ addOnId: 'addon_mock_tests' }] },
      ],
    };
    await withMockFetch(async (calls) => {
      const result = await provisionPortalAccessForPaidOrder(env, order, { source: 'TEST' });
      assert.strictEqual(result.successCount, 3);
      assert.strictEqual(calls.length, 3);
      const bodies = calls.map(decodeSignedPortalRequest);
      assert.deepStrictEqual(bodies.map((b) => b.productKey).sort(), ['german', 'ielts', 'oet']);
      assert(bodies.every((b) => b.email === 'student@example.com'));
      assert(bodies.every((b) => b.paymentStatus === 'PAID'));
      assert(bodies.every((b) => b.orderId.startsWith('order_mixed_courses:')));
    });
    console.log('  OK: Digital, physical, and add-on-bearing orders provision by parent course only');
  }

  {
    const env = makeEnv();
    const order = {
      id: 'order_unknown',
      status: 'PAID',
      customer_email: 'student@example.com',
      items: [{ productId: 'not-real-product', format: 'digital' }],
    };
    await withMockFetch(async (calls) => {
      const result = await provisionPortalAccessForPaidOrder(env, order, { source: 'TEST' });
      assert.strictEqual(result.attempted, false);
      assert.strictEqual(calls.length, 0);
    });
    console.log('  OK: Unknown product is skipped without guessing course access');
  }

  {
    const env = makeEnv();
    const order = {
      id: 'order_portal_500',
      status: 'PAID',
      customer_email: 'student@example.com',
      items: [{ productId: 'pte-full-prep', format: 'digital' }],
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('portal error', { status: 500 });
    try {
      const result = await provisionPortalAccessForPaidOrder(env, order, { source: 'TEST' });
      assert.strictEqual(result.failureCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log('  OK: Portal 500 is contained as provisioning failure');
  }

  {
    const env = makeEnv();
    await saveOrder(env, {
      id: 'order_webhook_bridge',
      cf_order_id: 'order_webhook_bridge',
      amount_paise: 19900,
      currency: 'INR',
      status: 'PENDING',
      customer_email: 'paid@example.com',
      customer_name: 'Paid Student',
      items: [{ productId: 'ielts-full-prep', format: 'digital', quantity: 1, unitPricePaise: 19900 }],
    });

    const rawBody = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: 'order_webhook_bridge', order_amount: 199, order_currency: 'INR' },
        payment: { payment_status: 'SUCCESS', payment_amount: 199, payment_currency: 'INR' },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signCashfreeWebhook(env.CASHFREE_SECRET_KEY, timestamp, rawBody);

    await withMockFetch(async (calls) => {
      const req = new Request('https://main.test/api/cashfree-webhook', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature },
        body: rawBody,
      });
      const res = await handleCashfreeWebhook({ request: req, env });
      assert.strictEqual(res.status, 200);
      const stored = await getOrder(env, 'order_webhook_bridge');
      assert.strictEqual(stored.status, 'PAID');
      assert.strictEqual(calls.length, 1);
      const body = decodeSignedPortalRequest(calls[0]);
      assert.strictEqual(body.productKey, 'ielts');
      assert.strictEqual(body.email, 'paid@example.com');
    });
    console.log('  OK: Verified PAID Cashfree webhook triggers bridge after PAID persistence');
  }

  {
    const env = makeEnv();
    await saveOrder(env, {
      id: 'order_status_retry',
      cf_order_id: 'order_status_retry',
      amount_paise: 19900,
      currency: 'INR',
      status: 'PENDING',
      customer_email: 'retry@example.com',
      customer_name: 'Retry Student',
      items: [{ productId: 'oet-full-prep', format: 'physical', quantity: 1, unitPricePaise: 119900 }],
    });

    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), ...init });
      if (String(url).includes('/pg/orders/')) {
        return new Response(JSON.stringify({ order_status: 'PAID', order_amount: 199 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const req = new Request('https://main.test/api/order-status?order_id=order_status_retry');
      const res = await handleOrderStatusGet({ request: req, env });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.status, 'PAID');
      const portalCalls = calls.filter((c) => c.url.includes('/api/integrations/main-site/purchase'));
      assert.strictEqual(portalCalls.length, 1);
      const portalBody = decodeSignedPortalRequest(portalCalls[0]);
      assert.strictEqual(portalBody.productKey, 'oet');
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log('  OK: order-status Cashfree verification retries bridge idempotently');
  }

  {
    const env = makeEnv();
    const order = {
      id: 'order_discount_price_irrelevant',
      status: 'PAID',
      customer_email: 'discount@example.com',
      amount_paise: 1,
      coupon_code: 'ANYCOUPON',
      items: [{ productId: 'german-full-prep', format: 'digital', unitPricePaise: 1 }],
    };
    await withMockFetch(async (calls) => {
      const result = await provisionPortalAccessForPaidOrder(env, order, { source: 'TEST' });
      assert.strictEqual(result.successCount, 1);
      assert.strictEqual(decodeSignedPortalRequest(calls[0]).productKey, 'german');
    });
    console.log('  OK: Provisioning is independent of price and coupons after PAID');
  }

  console.log('\nSTEP 13B TESTS PASSED');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
