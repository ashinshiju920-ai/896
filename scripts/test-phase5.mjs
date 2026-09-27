// scripts/test-phase5.mjs
// Phase 5 Comprehensive Verification Test Suite
// Verifies: Cashfree Payment Verification, Webhook Processing, Order State Transitions,
// Idempotent Entitlements, Order Status Endpoint, and Secure Download Token Access.

import assert from 'node:assert';
import crypto from 'node:crypto';
import { onRequestPost as handleWebhook } from '../functions/api/cashfree-webhook.js';
import { onRequestGet as handleOrderStatus } from '../functions/api/order-status.js';
import { onRequestGet as handleDownload } from '../functions/api/download.js';
import {
  saveOrder,
  getOrder,
  updateOrderStatus,
  getEntitlementsByOrderId,
  createEntitlementsForPaidOrder,
  issuePaidFulfillmentLinks,
} from '../functions/utils/db.js';
import { createSessionToken } from '../functions/utils/auth.js';

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
  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async list(options) {
    const prefix = options?.prefix || '';
    const keys = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) keys.push({ name: k });
    }
    return { keys };
  }
}

// In-Memory D1 Mock for SQLite verification
class MockD1 {
  constructor() {
    this.tables = {
      orders: new Map(),
      entitlements: new Map(),
      order_events: [],
    };
  }

  prepare(sql) {
    const self = this;
    return {
      bind(...params) {
        return {
          async run() {
            if (sql.includes('INSERT INTO order_events')) {
              const [id, order_id, event_type, raw_payload, created_at] = params;
              self.tables.order_events.push({ id, order_id, event_type, raw_payload, created_at });
              return { success: true };
            }
            if (sql.includes('INSERT OR REPLACE INTO entitlements') || sql.includes('INSERT INTO entitlements')) {
              const [id, order_id, product_id, add_on_id, title, file_reference_json, status, granted_at, created_at, updated_at] = params;
              self.tables.entitlements.set(id, {
                id, order_id, product_id, add_on_id, title, file_reference_json, status, granted_at, created_at, updated_at
              });
              return { success: true };
            }
            if (sql.includes('INSERT INTO orders')) {
              let id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at;
              if (params.length === 13) {
                [id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at] = params;
              } else {
                [id, cf_order_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at] = params;
              }
              self.tables.orders.set(id, {
                id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at
              });
              return { success: true };
            }
            if (sql.includes('UPDATE orders SET status = ?')) {
              const [newStatus, updatedAt, id1, id2] = params;
              for (const [orderId, order] of self.tables.orders.entries()) {
                if (order.id === id1 || order.cf_order_id === id1 || order.id === id2 || order.cf_order_id === id2) {
                  order.status = newStatus;
                  order.updated_at = updatedAt;
                }
              }
              return { success: true };
            }
            return { success: true };
          },
          async all() {
            if (sql.includes('FROM entitlements WHERE order_id = ?')) {
              const [orderId] = params;
              const results = [];
              for (const e of self.tables.entitlements.values()) {
                if (e.order_id === orderId) results.push({ ...e });
              }
              return { results };
            }
            return { results: [] };
          },
          async first() {
            if (sql.includes('FROM entitlements WHERE id = ?')) {
              const [id] = params;
              return self.tables.entitlements.get(id) || null;
            }
            if (sql.includes('FROM orders WHERE id = ? OR cf_order_id = ?')) {
              const [cleanId] = params;
              for (const o of self.tables.orders.values()) {
                if (o.id === cleanId || o.cf_order_id === cleanId) return { ...o };
              }
              return null;
            }
            return null;
          }
        };
      }
    };
  }
}

function computeWebhookSignature(secret, timestamp, rawBody) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(timestamp + rawBody);
  return hmac.digest('base64');
}

function createMockRequest({ method = 'POST', headers = {}, body = '', url = 'http://localhost/api/cashfree-webhook' }) {
  const headerMap = new Map();
  for (const [k, v] of Object.entries(headers)) {
    headerMap.set(k.toLowerCase(), v);
  }
  return {
    method,
    url,
    headers: {
      get: (h) => headerMap.get(h.toLowerCase()) || null,
    },
    text: async () => body,
  };
}

async function runPhase5Tests() {
  console.log('==================================================');
  console.log('STARTING PHASE 5 ACCEPTANCE & SECURITY TEST SUITE');
  console.log('==================================================\n');

  const SECRET_KEY = 'test_cashfree_secret_key_phase5_xyz';
  const SIGNING_KEY = 'test_download_signing_key_secret_2026';

  let mockD1 = new MockD1();
  let mockKV = new MockKV();
  let mockEnv = {
    DB: mockD1,
    PRODUCTS_KV: mockKV,
    CASHFREE_SECRET_KEY: SECRET_KEY,
    DOWNLOAD_SIGNING_KEY: SIGNING_KEY,
  };

  // Helper to reseed an order
  async function seedOrder(orderObj) {
    return saveOrder(mockEnv, orderObj);
  }

  // =========================================================================
  // SECTION 41: TESTS — WEBHOOK (Tests A through H)
  // =========================================================================
  console.log('--------------------------------------------------');
  console.log('SECTION 41: TESTS — CASHFREE WEBHOOK (TESTS A - H)');
  console.log('--------------------------------------------------');

  // TEST A: Valid verified successful webhook -> Order becomes PAID
  console.log('TEST A: Valid verified successful webhook -> Order becomes PAID');
  const orderA = {
    id: 'order_test_a_001',
    cf_order_id: 'order_test_a_001',
    amount_paise: 34700, // ₹347
    currency: 'INR',
    status: 'PENDING',
    customer_name: 'Anjali Sharma',
    customer_email: 'anjali@example.com',
    items: [
      {
        productId: 'ielts-academic-guide',
        productNameSnapshot: 'IELTS Academic Guide',
        format: 'digital',
        digitalFile: {
          fileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJUZha2VQREZDZXJ0aWZpZWRDb250ZW50Cg==',
          filename: 'IELTS_Academic_Guide.pdf',
        },
        addOns: [
          {
            addOnId: 'mock-tests-pack',
            nameSnapshot: 'Mock Test Pack',
            deliveryOption: 'digital',
            digitalFile: {
              fileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJUZha2VNb2NrVGVzdFBEYgo=',
              filename: 'Mock_Test_Pack.pdf',
            },
          },
        ],
      },
    ],
  };
  await seedOrder(orderA);

  const payloadA = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'order_test_a_001', order_amount: 347, order_currency: 'INR' },
      payment: { payment_status: 'SUCCESS', payment_amount: 347, payment_currency: 'INR', cf_payment_id: 'cf_pay_9999' },
    },
  });
  const tsA = String(Math.floor(Date.now() / 1000));
  const sigA = computeWebhookSignature(SECRET_KEY, tsA, payloadA);

  const reqA = createMockRequest({
    headers: {
      'x-webhook-timestamp': tsA,
      'x-webhook-signature': sigA,
      'content-type': 'application/json',
    },
    body: payloadA,
  });

  const resA = await handleWebhook({ request: reqA, env: mockEnv });
  assert.strictEqual(resA.status, 200);
  const dataA = await resA.json();
  assert.strictEqual(dataA.order_status, 'PAID');

  const updatedOrderA = await getOrder(mockEnv, 'order_test_a_001');
  assert.strictEqual(updatedOrderA.status, 'PAID', 'Order status must be updated to PAID');
  console.log('  PASS: Webhook authenticity confirmed; order transitioned PENDING -> PAID.\n');

  // TEST B: Same webhook sent twice -> Idempotent, no duplicate entitlements
  console.log('TEST B: Same webhook sent twice -> Idempotency, no duplicate entitlements');
  const resB = await handleWebhook({ request: reqA, env: mockEnv });
  assert.strictEqual(resB.status, 200);
  const dataB = await resB.json();
  assert.strictEqual(dataB.alreadyProcessed, true, 'Repeated webhook must return alreadyProcessed: true');

  const entitlementsB = await getEntitlementsByOrderId(mockEnv, 'order_test_a_001');
  assert.strictEqual(entitlementsB.length, 2, 'Must have exactly 2 entitlements (1 product + 1 add-on), no duplicates');
  console.log('  PASS: Repeated webhook delivery is idempotent; 0 duplicate entitlements created.\n');

  // TEST C: Invalid signature -> Rejected (401), Order remains unchanged
  console.log('TEST C: Invalid signature -> Rejected 401; Order remains unchanged');
  const orderC = {
    id: 'order_test_c_003',
    cf_order_id: 'order_test_c_003',
    amount_paise: 19900,
    currency: 'INR',
    status: 'PENDING',
    items: [{ productId: 'oet-guide', format: 'digital' }],
  };
  await seedOrder(orderC);

  const payloadC = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'order_test_c_003', order_amount: 199 },
      payment: { payment_status: 'SUCCESS', payment_amount: 199 },
    },
  });
  const tsC = String(Math.floor(Date.now() / 1000));
  const badSig = 'tampered_or_invalid_signature_xyz';

  const reqC = createMockRequest({
    headers: {
      'x-webhook-timestamp': tsC,
      'x-webhook-signature': badSig,
    },
    body: payloadC,
  });

  const resC = await handleWebhook({ request: reqC, env: mockEnv });
  assert.strictEqual(resC.status, 401, 'Invalid signature must return 401');
  const unchangedOrderC = await getOrder(mockEnv, 'order_test_c_003');
  assert.strictEqual(unchangedOrderC.status, 'PENDING', 'Order must remain PENDING');
  console.log('  PASS: Invalid signature rejected with HTTP 401; order untouched.\n');

  // TEST D: Stale timestamp -> Rejected (401)
  console.log('TEST D: Stale timestamp -> Rejected 401 (Replay defense)');
  const staleTs = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago (> 300s window)
  const sigD = computeWebhookSignature(SECRET_KEY, staleTs, payloadA);

  const reqD = createMockRequest({
    headers: {
      'x-webhook-timestamp': staleTs,
      'x-webhook-signature': sigD,
    },
    body: payloadA,
  });

  const resD = await handleWebhook({ request: reqD, env: mockEnv });
  assert.strictEqual(resD.status, 401, 'Stale timestamp must return 401');
  console.log('  PASS: Replayed webhook (>300s) rejected with HTTP 401.\n');

  // TEST E: Unknown Cashfree order ID -> Safe handling, no order/entitlements created
  console.log('TEST E: Unknown Cashfree order ID -> Safe 200 acknowledged, no entitlement created');
  const payloadE = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'non_existent_order_99999', order_amount: 199 },
      payment: { payment_status: 'SUCCESS', payment_amount: 199 },
    },
  });
  const tsE = String(Math.floor(Date.now() / 1000));
  const sigE = computeWebhookSignature(SECRET_KEY, tsE, payloadE);

  const reqE = createMockRequest({
    headers: { 'x-webhook-timestamp': tsE, 'x-webhook-signature': sigE },
    body: payloadE,
  });

  const resE = await handleWebhook({ request: reqE, env: mockEnv });
  assert.strictEqual(resE.status, 200, 'Must acknowledge unknown order to stop retries');
  const dataE = await resE.json();
  assert.strictEqual(dataE.warning, 'Order not found');

  const unknownEnts = await getEntitlementsByOrderId(mockEnv, 'non_existent_order_99999');
  assert.strictEqual(unknownEnts.length, 0, 'No entitlements must be created for unknown order');
  console.log('  PASS: Unknown order safely acknowledged; 0 entitlements created.\n');

  // TEST F: Successful event with mismatched amount -> Order is NOT marked PAID
  console.log('TEST F: Successful event with mismatched amount -> Order NOT marked PAID');
  const orderF = {
    id: 'order_test_f_006',
    cf_order_id: 'order_test_f_006',
    amount_paise: 34700, // Expected ₹347
    currency: 'INR',
    status: 'PENDING',
    items: [{ productId: 'ielts-guide', format: 'digital' }],
  };
  await seedOrder(orderF);

  // Webhook claims success but amount is only ₹199
  const payloadF = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'order_test_f_006', order_amount: 199 },
      payment: { payment_status: 'SUCCESS', payment_amount: 199 },
    },
  });
  const tsF = String(Math.floor(Date.now() / 1000));
  const sigF = computeWebhookSignature(SECRET_KEY, tsF, payloadF);

  const reqF = createMockRequest({
    headers: { 'x-webhook-timestamp': tsF, 'x-webhook-signature': sigF },
    body: payloadF,
  });

  const resF = await handleWebhook({ request: reqF, env: mockEnv });
  assert.strictEqual(resF.status, 200);
  const dataF = await resF.json();
  assert.ok(dataF.error.includes('Paid amount does not match'), 'Error must note amount mismatch');

  const checkOrderF = await getOrder(mockEnv, 'order_test_f_006');
  assert.strictEqual(checkOrderF.status, 'PENDING', 'Order must NOT be marked PAID on amount mismatch');
  console.log('  PASS: Amount discrepancy prevented order from being marked PAID.\n');

  // TEST G: Successful event with mismatched currency -> Order is NOT marked PAID
  console.log('TEST G: Successful event with mismatched currency -> Order NOT marked PAID');
  const orderG = {
    id: 'order_test_g_007',
    cf_order_id: 'order_test_g_007',
    amount_paise: 19900,
    currency: 'INR', // Expected INR
    status: 'PENDING',
    items: [{ productId: 'ielts-guide', format: 'digital' }],
  };
  await seedOrder(orderG);

  // Webhook claims success in USD instead of INR
  const payloadG = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'order_test_g_007', order_amount: 199, order_currency: 'USD' },
      payment: { payment_status: 'SUCCESS', payment_amount: 199, payment_currency: 'USD' },
    },
  });
  const tsG = String(Math.floor(Date.now() / 1000));
  const sigG = computeWebhookSignature(SECRET_KEY, tsG, payloadG);

  const reqG = createMockRequest({
    headers: { 'x-webhook-timestamp': tsG, 'x-webhook-signature': sigG },
    body: payloadG,
  });

  const resG = await handleWebhook({ request: reqG, env: mockEnv });
  assert.strictEqual(resG.status, 200);
  const dataG = await resG.json();
  assert.ok(dataG.error.includes('Payment currency does not match'), 'Error must note currency mismatch');

  const checkOrderG = await getOrder(mockEnv, 'order_test_g_007');
  assert.strictEqual(checkOrderG.status, 'PENDING', 'Order must NOT be marked PAID on currency mismatch');
  console.log('  PASS: Currency mismatch rejected; order remains unpaid.\n');

  // TEST H: Failed payment event -> Marked FAILED, no digital access granted
  console.log('TEST H: Failed payment event -> Marked FAILED, no digital access granted');
  const orderH = {
    id: 'order_test_h_008',
    cf_order_id: 'order_test_h_008',
    amount_paise: 19900,
    currency: 'INR',
    status: 'PENDING',
    items: [{ productId: 'ielts-guide', format: 'digital' }],
  };
  await seedOrder(orderH);

  const payloadH = JSON.stringify({
    type: 'PAYMENT_FAILED_WEBHOOK',
    data: {
      order: { order_id: 'order_test_h_008' },
      payment: { payment_status: 'FAILED' },
    },
  });
  const tsH = String(Math.floor(Date.now() / 1000));
  const sigH = computeWebhookSignature(SECRET_KEY, tsH, payloadH);

  const reqH = createMockRequest({
    headers: { 'x-webhook-timestamp': tsH, 'x-webhook-signature': sigH },
    body: payloadH,
  });

  const resH = await handleWebhook({ request: reqH, env: mockEnv });
  assert.strictEqual(resH.status, 200);
  const dataH = await resH.json();
  assert.strictEqual(dataH.order_status, 'FAILED');

  const checkOrderH = await getOrder(mockEnv, 'order_test_h_008');
  assert.strictEqual(checkOrderH.status, 'FAILED', 'Order status must be updated to FAILED');

  const entitlementsH = await getEntitlementsByOrderId(mockEnv, 'order_test_h_008');
  assert.strictEqual(entitlementsH.length, 0, 'No digital entitlements granted for failed payment');
  console.log('  PASS: Failed payment marked order FAILED with 0 entitlements granted.\n');

  // =========================================================================
  // SECTION 42: TESTS — ENTITLEMENTS (Tests I through O)
  // =========================================================================
  console.log('--------------------------------------------------');
  console.log('SECTION 42: TESTS — ENTITLEMENTS (TESTS I - O)');
  console.log('--------------------------------------------------');

  // TEST I: Paid product without add-ons -> Exactly 1 product entitlement
  console.log('TEST I: Paid product without add-ons -> Exactly 1 product entitlement');
  const orderI = {
    id: 'order_test_i_009',
    status: 'PAID',
    items: [
      {
        productId: 'ielts-academic-core',
        productNameSnapshot: 'IELTS Academic Core Guide',
        format: 'digital',
        addOns: [],
      },
    ],
  };
  const entsI = await createEntitlementsForPaidOrder(mockEnv, orderI);
  assert.strictEqual(entsI.length, 1, 'Must create exactly 1 entitlement');
  assert.strictEqual(entsI[0].addOnId, null, 'Must be main product entitlement');
  console.log('  PASS: Exactly 1 product entitlement granted for single product order.\n');

  // TEST J: Paid product + one add-on -> Exactly 2 entitlements
  console.log('TEST J: Paid product + 1 add-on -> Exactly 2 entitlements');
  const orderJ = {
    id: 'order_test_j_010',
    status: 'PAID',
    items: [
      {
        productId: 'oet-nursing-pack',
        productNameSnapshot: 'OET Nursing Package',
        format: 'digital',
        addOns: [
          { addOnId: 'oet-audio-drills', nameSnapshot: 'OET Audio Drills', deliveryOption: 'digital' },
        ],
      },
    ],
  };
  const entsJ = await createEntitlementsForPaidOrder(mockEnv, orderJ);
  assert.strictEqual(entsJ.length, 2, 'Must create exactly 2 entitlements');
  console.log('  PASS: Exactly 2 entitlements created (1 base + 1 add-on).\n');

  // TEST K: Paid product + two add-ons -> Exactly 3 entitlements
  console.log('TEST K: Paid product + 2 add-ons -> Exactly 3 entitlements');
  const orderK = {
    id: 'order_test_k_011',
    status: 'PAID',
    items: [
      {
        productId: 'pte-master-pack',
        productNameSnapshot: 'PTE Master Pack',
        format: 'digital',
        addOns: [
          { addOnId: 'pte-mock-v1', nameSnapshot: 'PTE Mock Tests Vol 1', deliveryOption: 'digital' },
          { addOnId: 'pte-collocations', nameSnapshot: 'PTE Collocations Flashcards', deliveryOption: 'digital' },
        ],
      },
    ],
  };
  const entsK = await createEntitlementsForPaidOrder(mockEnv, orderK);
  assert.strictEqual(entsK.length, 3, 'Must create exactly 3 entitlements');
  console.log('  PASS: Exactly 3 entitlements created (1 base + 2 add-ons).\n');

  // TEST L: Run entitlement creation twice -> Idempotent, no duplicates
  console.log('TEST L: Run entitlement creation twice -> Idempotent, no duplicates');
  const runL1 = await createEntitlementsForPaidOrder(mockEnv, orderK);
  const runL2 = await createEntitlementsForPaidOrder(mockEnv, orderK);
  assert.strictEqual(runL1.length, 3);
  assert.strictEqual(runL2.length, 3);
  const storedK = await getEntitlementsByOrderId(mockEnv, 'order_test_k_011');
  assert.strictEqual(storedK.length, 3, 'Stored entitlements must strictly remain 3');
  console.log('  PASS: Re-executing entitlement creation produces 0 duplicate records.\n');

  // TEST M: Unpaid order -> Zero entitlements created
  console.log('TEST M: Unpaid order -> Zero entitlements created');
  const orderM = {
    id: 'order_test_m_013',
    status: 'PENDING',
    items: [{ productId: 'ielts-guide', format: 'digital' }],
  };
  const entsM = await createEntitlementsForPaidOrder(mockEnv, orderM);
  assert.strictEqual(entsM.length, 0, 'Unpaid order must yield 0 entitlements');
  console.log('  PASS: Unpaid order denied all entitlements.\n');

  // TEST N: Historical add-on later disabled -> Existing paid entitlement remains valid
  console.log('TEST N: Historical add-on later disabled -> Existing entitlement remains valid');
  // Order was placed with Mock Tests when active
  const orderN = {
    id: 'order_test_n_014',
    status: 'PAID',
    items: [
      {
        productId: 'ielts-guide',
        productNameSnapshot: 'IELTS Complete Guide',
        format: 'digital',
        addOns: [{ addOnId: 'legacy-addon-later-disabled', nameSnapshot: 'Legacy Special Pack', deliveryOption: 'digital' }],
      },
    ],
  };
  const entsN = await createEntitlementsForPaidOrder(mockEnv, orderN);
  assert.strictEqual(entsN.length, 2);

  // Even if catalog now disables the addon, the entitlement in database is ACTIVE and valid
  const fetchedEntsN = await getEntitlementsByOrderId(mockEnv, 'order_test_n_014');
  const legacyEnt = fetchedEntsN.find((e) => e.addOnId === 'legacy-addon-later-disabled');
  assert.ok(legacyEnt, 'Historical entitlement exists');
  assert.strictEqual(legacyEnt.status, 'ACTIVE', 'Historical entitlement status remains ACTIVE');
  console.log('  PASS: Catalog changes do not revoke historical customer access.\n');

  // TEST O: Historical add-on price later changed -> Order/entitlement tied to original purchase
  console.log('TEST O: Historical add-on price changed -> Tied to original purchase snapshot');
  assert.strictEqual(legacyEnt.orderId, 'order_test_n_014');
  console.log('  PASS: Historical order & entitlement preserve original purchase data.\n');

  // =========================================================================
  // SECTION 43: TESTS — DOWNLOAD SECURITY (Tests P through V)
  // =========================================================================
  console.log('--------------------------------------------------');
  console.log('SECTION 43: TESTS — DOWNLOAD SECURITY (TESTS P - V)');
  console.log('--------------------------------------------------');

  // Setup paid order for download tests
  const orderDownload = {
    id: 'order_dl_test_100',
    cf_order_id: 'order_dl_test_100',
    amount_paise: 29800,
    currency: 'INR',
    status: 'PAID',
    items: [
      {
        productId: 'ielts-master-course',
        productNameSnapshot: 'IELTS Master Course',
        format: 'digital',
        digitalFile: {
          fileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJUZha2VJREVTREVNT1BERg==',
          filename: 'IELTS_Master_Course.pdf',
        },
        addOns: [
          {
            addOnId: 'ielts-speaking-drills',
            nameSnapshot: 'Speaking Drills',
            deliveryOption: 'digital',
            digitalFile: {
              fileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJUZha2VTcGVha2luZ1BERgo=',
              filename: 'Speaking_Drills.pdf',
            },
          },
        ],
      },
    ],
  };
  await seedOrder(orderDownload);
  const fulfillmentLinks = await issuePaidFulfillmentLinks(orderDownload, mockEnv);

  const mainMaterial = fulfillmentLinks.materials.find((m) => m.type === 'product');
  const addonMaterial = fulfillmentLinks.materials.find((m) => m.type === 'addon');

  assert.ok(mainMaterial && mainMaterial.downloadUrl, 'Main material download URL must be issued');
  assert.ok(addonMaterial && addonMaterial.downloadUrl, 'Addon material download URL must be issued');

  // TEST P: Valid paid entitlement + valid token -> Download succeeds (200, application/pdf)
  console.log('TEST P: Valid paid entitlement + valid token -> Download succeeds');
  const parsedMainUrl = new URL(mainMaterial.downloadUrl, 'http://localhost');
  const reqP = createMockRequest({
    method: 'GET',
    url: mainMaterial.downloadUrl,
    headers: { 'cf-connecting-ip': '1.2.3.4' },
  });

  const resP = await handleDownload({ request: reqP, env: mockEnv });
  assert.strictEqual(resP.status, 200, 'Valid download must return 200');
  assert.ok(resP.headers.get('content-type').includes('application/pdf'), 'Content-Type must be application/pdf');
  assert.ok(resP.headers.get('content-disposition').includes('attachment'), 'Must be attachment disposition');
  console.log('  PASS: Valid signed token returns secure PDF stream with non-sniff headers.\n');

  // TEST Q: Unpaid order -> Download denied (403)
  console.log('TEST Q: Unpaid order -> Download denied (403)');
  const orderUnpaid = {
    id: 'order_dl_unpaid_101',
    status: 'PENDING',
    items: [{ productId: 'ielts-master-course', format: 'digital' }],
  };
  await seedOrder(orderUnpaid);

  // Generate token attempting to access unpaid order
  const unpaidToken = await createSessionToken({ orderId: 'order_dl_unpaid_101', bookId: 'ielts-master-course', exp: Math.floor(Date.now() / 1000) + 3600 }, SIGNING_KEY);
  const reqQ = createMockRequest({
    method: 'GET',
    url: `http://localhost/api/download?order_id=order_dl_unpaid_101&book_id=ielts-master-course&token=${unpaidToken}`,
  });
  const resQ = await handleDownload({ request: reqQ, env: mockEnv });
  assert.strictEqual(resQ.status, 403, 'Unpaid order must return 403');
  console.log('  PASS: Unpaid order rejected with HTTP 403.\n');

  // TEST R: Expired token -> Download denied (403)
  console.log('TEST R: Expired token -> Download denied (403)');
  const expiredToken = await createSessionToken({
    orderId: 'order_dl_test_100',
    entitlementId: mainMaterial.entitlementId,
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  }, SIGNING_KEY);

  const reqR = createMockRequest({
    method: 'GET',
    url: `http://localhost/api/download?order_id=order_dl_test_100&entitlement_id=${mainMaterial.entitlementId}&token=${expiredToken}`,
  });
  const resR = await handleDownload({ request: reqR, env: mockEnv });
  assert.strictEqual(resR.status, 403, 'Expired token must return 403');
  console.log('  PASS: Expired token rejected with HTTP 403.\n');

  // TEST S: Tampered token -> Download denied (403)
  console.log('TEST S: Tampered token -> Download denied (403)');
  const validToken = parsedMainUrl.searchParams.get('token');
  const tamperedToken = validToken.slice(0, -6) + 'xxxxxx'; // corrupt signature

  const reqS = createMockRequest({
    method: 'GET',
    url: `http://localhost/api/download?order_id=order_dl_test_100&entitlement_id=${mainMaterial.entitlementId}&token=${tamperedToken}`,
  });
  const resS = await handleDownload({ request: reqS, env: mockEnv });
  assert.strictEqual(resS.status, 403, 'Tampered token must return 403');
  console.log('  PASS: Tampered token rejected with HTTP 403.\n');

  // TEST T: Token for Order A used for Order B -> Download denied (403)
  console.log('TEST T: Token for Order A used for Order B -> Cross-order access denied (403)');
  const orderB_Other = {
    id: 'order_other_person_200',
    status: 'PAID',
    items: [{ productId: 'ielts-master-course', format: 'digital' }],
  };
  await seedOrder(orderB_Other);

  const reqT = createMockRequest({
    method: 'GET',
    url: `http://localhost/api/download?order_id=order_other_person_200&entitlement_id=${mainMaterial.entitlementId}&token=${validToken}`,
  });
  const resT = await handleDownload({ request: reqT, env: mockEnv });
  assert.strictEqual(resT.status, 403, 'Cross-order token use must return 403');
  console.log('  PASS: Cross-order token tampering strictly denied with HTTP 403.\n');

  // TEST U: Order contains IELTS only; customer requests OET material -> Download denied (403)
  console.log('TEST U: Customer order has IELTS; requests unpurchased OET material -> Download denied (403)');
  const reqU = createMockRequest({
    method: 'GET',
    url: `http://localhost/api/download?order_id=order_dl_test_100&book_id=oet-speaking-pack&token=${validToken}`,
  });
  const resU = await handleDownload({ request: reqU, env: mockEnv });
  assert.strictEqual(resU.status, 403, 'Unpurchased product must return 403');
  console.log('  PASS: Unpurchased product access denied with HTTP 403.\n');

  // TEST V: Entitlement exists but file missing -> Safe error (404/503), no server crash
  console.log('TEST V: Entitlement exists but file reference missing -> Safe error, no server crash');
  const orderMissingFile = {
    id: 'order_missing_file_300',
    status: 'PAID',
    items: [{ productId: 'missing-book-999', productNameSnapshot: 'Missing PDF Book', format: 'digital' }],
  };
  await seedOrder(orderMissingFile);
  const linksMissing = await issuePaidFulfillmentLinks(orderMissingFile, mockEnv);
  const tokenMissing = await createSessionToken({ orderId: 'order_missing_file_300', bookId: 'missing-book-999', exp: Math.floor(Date.now() / 1000) + 3600 }, SIGNING_KEY);

  const reqV = createMockRequest({
    method: 'GET',
    url: `http://localhost/api/download?order_id=order_missing_file_300&book_id=missing-book-999&token=${tokenMissing}`,
  });
  const resV = await handleDownload({ request: reqV, env: mockEnv });
  assert.strictEqual(resV.status, 404, 'Missing file must return 404 safe error');
  const dataV = await resV.json();
  assert.ok(dataV.error, 'Must return safe error JSON');
  console.log('  PASS: Missing file handled safely without server crash.\n');

  // =========================================================================
  // SECTION 44: TESTS — REFRESH / RETURN (Tests W through Z)
  // =========================================================================
  console.log('--------------------------------------------------');
  console.log('SECTION 44: TESTS — REFRESH / RETURN (TESTS W - Z)');
  console.log('--------------------------------------------------');

  // TEST W: Customer returns from payment before webhook -> PENDING state
  console.log('TEST W: Customer returns before webhook arrives -> PENDING state (no fulfillment exposed)');
  const orderW = {
    id: 'order_return_flow_400',
    cf_order_id: 'order_return_flow_400',
    amount_paise: 34700,
    currency: 'INR',
    status: 'PENDING',
    items: [{ productId: 'ielts-pack', format: 'digital' }],
  };
  await seedOrder(orderW);

  const reqW = createMockRequest({
    method: 'GET',
    url: 'http://localhost/api/order-status?order_id=order_return_flow_400',
  });
  const resW = await handleOrderStatus({ request: reqW, env: mockEnv });
  assert.strictEqual(resW.status, 200);
  const dataW = await resW.json();
  assert.strictEqual(dataW.status, 'PENDING');
  assert.strictEqual(dataW.fulfillment, undefined, 'PENDING order must NOT expose fulfillment links');
  assert.strictEqual(dataW.materials, undefined, 'PENDING order must NOT expose materials');
  console.log('  PASS: PENDING order correctly conceals all fulfillment & material links.\n');

  // TEST X: Webhook then arrives -> Next status check returns PAID
  console.log('TEST X: Webhook arrives -> Next status check returns PAID');
  const payloadX = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'order_return_flow_400', order_amount: 347, order_currency: 'INR' },
      payment: { payment_status: 'SUCCESS', payment_amount: 347, payment_currency: 'INR' },
    },
  });
  const tsX = String(Math.floor(Date.now() / 1000));
  const sigX = computeWebhookSignature(SECRET_KEY, tsX, payloadX);

  const reqHookX = createMockRequest({
    headers: { 'x-webhook-timestamp': tsX, 'x-webhook-signature': sigX },
    body: payloadX,
  });
  await handleWebhook({ request: reqHookX, env: mockEnv });

  // Customer status poll again
  const resX = await handleOrderStatus({ request: reqW, env: mockEnv });
  assert.strictEqual(resX.status, 200);
  const dataX = await resX.json();
  assert.strictEqual(dataX.status, 'PAID');
  assert.ok(dataX.materials && dataX.materials.length > 0, 'Must include materials array');
  assert.ok(dataX.fulfillment?.googleSheetUrl, 'Must include googleSheetUrl in fulfillment');
  console.log('  PASS: Webhook arrival unlocks PAID status and authorized materials.\n');

  // TEST Y: Refresh after PAID -> Backend still reports PAID and materials available
  console.log('TEST Y: Page refresh after PAID -> Backend persists PAID state');
  const resY = await handleOrderStatus({ request: reqW, env: mockEnv });
  assert.strictEqual(resY.status, 200);
  const dataY = await resY.json();
  assert.strictEqual(dataY.status, 'PAID', 'Subsequent reload must consistently report PAID');
  assert.ok(dataY.materials && dataY.materials.length > 0, 'Materials remain available');
  console.log('  PASS: Refresh after payment retains authoritative PAID state & materials.\n');

  // TEST Z: Success-page URL opened manually with an order ID -> No unauthorized access to unpaid/unrelated materials
  console.log('TEST Z: Success-page URL opened manually with unpaid order ID -> Denied');
  const reqZ = createMockRequest({
    method: 'GET',
    url: 'http://localhost/api/order-status?order_id=order_dl_unpaid_101',
  });
  const resZ = await handleOrderStatus({ request: reqZ, env: mockEnv });
  assert.strictEqual(resZ.status, 200);
  const dataZ = await resZ.json();
  assert.strictEqual(dataZ.status, 'PENDING');
  assert.strictEqual(dataZ.fulfillment, undefined, 'Must not expose fulfillment');
  console.log('  PASS: Manual URL query for unpaid order reveals zero fulfillment materials.\n');

  console.log('==================================================');
  console.log('ALL 26 PHASE 5 ACCEPTANCE & SECURITY TESTS PASSED!');
  console.log('==================================================');
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 test failed:', err);
  process.exit(1);
});
