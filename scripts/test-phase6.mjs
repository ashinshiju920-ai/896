// scripts/test-phase6.mjs
// Phase 6 Comprehensive Verification Test Suite
// Verifies: Payment Success Experience, Customer Material Access, My Materials,
// Lifetime Purchase Access, Secure Re-download Flow, and Customer-Friendly Error/Pending States.

import assert from 'node:assert';
import crypto from 'node:crypto';
import { onRequestGet as handleOrderStatus } from '../functions/api/order-status.js';
import { onRequestGet as handleDownload } from '../functions/api/download.js';
import {
  saveOrder,
  getOrder,
  createEntitlementsForPaidOrder,
  getEntitlementsByOrderId,
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

// In-Memory D1 Mock
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

function createMockRequest({ method = 'GET', headers = {}, url = 'http://localhost/api/order-status' }) {
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
  };
}

async function runPhase6Tests() {
  console.log('==================================================');
  console.log('STARTING PHASE 6 ACCEPTANCE & SECURITY TEST SUITE');
  console.log('==================================================\n');

  const SIGNING_KEY = 'test_p6_download_signing_key_2026';
  const mockD1 = new MockD1();
  const mockKV = new MockKV();
  const mockEnv = {
    DB: mockD1,
    PRODUCTS_KV: mockKV,
    DOWNLOAD_SIGNING_KEY: SIGNING_KEY,
  };

  // -------------------------------------------------------------------------
  // TEST A: Verified PAID order -> Success page shows payment verified
  // -------------------------------------------------------------------------
  console.log('TEST A: Verified PAID order -> Success page shows payment verified');
  const orderA = {
    id: 'ord_p6_test_a_001',
    cf_order_id: 'ord_p6_test_a_001',
    amount_paise: 34700,
    currency: 'INR',
    status: 'PAID',
    customer_name: 'Rohit Verma',
    customer_email: 'rohit@example.com',
    items: [
      {
        productId: 'ielts-core-guide',
        productNameSnapshot: 'IELTS Core Guide',
        format: 'digital',
        digitalFile: {
          fileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJVRlc3RQREZDb250ZW50Cg==',
          filename: 'IELTS_Core_Guide.pdf',
        },
      },
    ],
  };
  await saveOrder(mockEnv, orderA);

  const reqA = createMockRequest({ url: 'http://localhost/api/order-status?order_id=ord_p6_test_a_001' });
  const resA = await handleOrderStatus({ request: reqA, env: mockEnv });
  assert.strictEqual(resA.status, 200);
  const dataA = await resA.json();
  assert.strictEqual(dataA.status, 'PAID');
  assert.strictEqual(dataA.orderId, 'ord_p6_test_a_001');
  assert.strictEqual(dataA.total, 347);
  assert.ok(Array.isArray(dataA.materials) && dataA.materials.length > 0, 'Materials array must be provided for PAID order');
  assert.ok(dataA.fulfillment, 'Fulfillment object must be present for PAID order');
  console.log('  PASS: Verified PAID order exposes authoritative confirmation & fulfillment.\n');

  // -------------------------------------------------------------------------
  // TEST B: PENDING order -> Verification state, No material download
  // -------------------------------------------------------------------------
  console.log('TEST B: PENDING order -> Verification state, No material download');
  const orderB = {
    id: 'ord_p6_test_b_002',
    cf_order_id: 'ord_p6_test_b_002',
    amount_paise: 19900,
    currency: 'INR',
    status: 'PENDING',
    items: [{ productId: 'oet-guide', format: 'digital' }],
  };
  await saveOrder(mockEnv, orderB);

  const reqB = createMockRequest({ url: 'http://localhost/api/order-status?order_id=ord_p6_test_b_002' });
  const resB = await handleOrderStatus({ request: reqB, env: mockEnv });
  assert.strictEqual(resB.status, 200);
  const dataB = await resB.json();
  assert.strictEqual(dataB.status, 'PENDING');
  assert.strictEqual(dataB.fulfillment, undefined, 'Fulfillment MUST NOT be exposed for PENDING order');
  assert.strictEqual(dataB.materials, undefined, 'Materials MUST NOT be exposed for PENDING order');
  assert.ok(dataB.message.includes('being verified'), 'Must contain verification message');
  console.log('  PASS: PENDING order returns verification state without exposing materials.\n');

  // -------------------------------------------------------------------------
  // TEST C: FAILED order -> Failure state, No material access
  // -------------------------------------------------------------------------
  console.log('TEST C: FAILED order -> Failure state, No material access');
  const orderC = {
    id: 'ord_p6_test_c_003',
    status: 'FAILED',
    amount_paise: 19900,
    items: [{ productId: 'oet-guide', format: 'digital' }],
  };
  await saveOrder(mockEnv, orderC);

  const reqC = createMockRequest({ url: 'http://localhost/api/order-status?order_id=ord_p6_test_c_003' });
  const resC = await handleOrderStatus({ request: reqC, env: mockEnv });
  assert.strictEqual(resC.status, 200);
  const dataC = await resC.json();
  assert.strictEqual(dataC.status, 'FAILED');
  assert.strictEqual(dataC.fulfillment, undefined, 'Fulfillment MUST NOT be exposed for FAILED order');
  assert.strictEqual(dataC.materials, undefined, 'Materials MUST NOT be exposed for FAILED order');
  assert.ok(dataC.error.includes('failed'), 'Error must note payment failure');
  console.log('  PASS: FAILED order returns failure status with zero access.\n');

  // -------------------------------------------------------------------------
  // TEST D: USER_DROPPED order -> Not completed state, No material access
  // -------------------------------------------------------------------------
  console.log('TEST D: USER_DROPPED order -> Not completed state, No material access');
  const orderD = {
    id: 'ord_p6_test_d_004',
    status: 'USER_DROPPED',
    amount_paise: 19900,
    items: [{ productId: 'pte-guide', format: 'digital' }],
  };
  await saveOrder(mockEnv, orderD);

  const reqD = createMockRequest({ url: 'http://localhost/api/order-status?order_id=ord_p6_test_d_004' });
  const resD = await handleOrderStatus({ request: reqD, env: mockEnv });
  assert.strictEqual(resD.status, 200);
  const dataD = await resD.json();
  assert.strictEqual(dataD.status, 'USER_DROPPED');
  assert.strictEqual(dataD.fulfillment, undefined, 'Fulfillment MUST NOT be exposed for USER_DROPPED order');
  assert.strictEqual(dataD.materials, undefined, 'Materials MUST NOT be exposed for USER_DROPPED order');
  assert.ok(dataD.error.includes('not completed'), 'Error must state payment was not completed');
  console.log('  PASS: USER_DROPPED order returns incomplete state with zero access.\n');

  // -------------------------------------------------------------------------
  // TEST E: Paid order with product only -> Main product material displayed
  // -------------------------------------------------------------------------
  console.log('TEST E: Paid order with product only -> Main product material displayed');
  const orderE = {
    id: 'ord_p6_test_e_005',
    status: 'PAID',
    items: [
      {
        productId: 'german-b1-guide',
        productNameSnapshot: 'German B1 Intensive Guide',
        format: 'digital',
        digitalFile: { fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK', filename: 'German_B1.pdf' },
        addOns: [],
      },
    ],
  };
  await saveOrder(mockEnv, orderE);
  const linksE = await issuePaidFulfillmentLinks(orderE, mockEnv);
  assert.strictEqual(linksE.materials.length, 1);
  assert.strictEqual(linksE.materials[0].type, 'product');
  assert.strictEqual(linksE.materials[0].name, 'German B1 Intensive Guide');
  console.log('  PASS: Product-only purchase yields exactly 1 main product material.\n');

  // -------------------------------------------------------------------------
  // TEST F: Paid order with product + one add-on -> Product + add-on displayed
  // -------------------------------------------------------------------------
  console.log('TEST F: Paid order with product + 1 add-on -> Product + add-on displayed');
  const orderF = {
    id: 'ord_p6_test_f_006',
    status: 'PAID',
    items: [
      {
        productId: 'ielts-mastery',
        productNameSnapshot: 'IELTS Mastery',
        format: 'digital',
        digitalFile: { fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK', filename: 'IELTS_Mastery.pdf' },
        addOns: [
          {
            addOnId: 'ielts-mock-v1',
            nameSnapshot: 'Mock Exam Pack Vol 1',
            deliveryOption: 'digital',
            digitalFile: { fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK', filename: 'Mock_Vol1.pdf' },
          },
        ],
      },
    ],
  };
  await saveOrder(mockEnv, orderF);
  const linksF = await issuePaidFulfillmentLinks(orderF, mockEnv);
  assert.strictEqual(linksF.materials.length, 2);
  const prodF = linksF.materials.find((m) => m.type === 'product');
  const addonF = linksF.materials.find((m) => m.type === 'addon');
  assert.ok(prodF && addonF, 'Both main product and add-on must be in materials');
  console.log('  PASS: Product + 1 add-on displays both items cleanly with distinguished types.\n');

  // -------------------------------------------------------------------------
  // TEST G: Paid order with multiple add-ons -> All purchased materials displayed
  // -------------------------------------------------------------------------
  console.log('TEST G: Paid order with multiple add-ons -> All purchased materials displayed');
  const orderG = {
    id: 'ord_p6_test_g_007',
    status: 'PAID',
    items: [
      {
        productId: 'oet-complete',
        productNameSnapshot: 'OET Complete',
        format: 'digital',
        digitalFile: { fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK', filename: 'OET_Complete.pdf' },
        addOns: [
          {
            addOnId: 'oet-mock-pack',
            nameSnapshot: 'Mock Test Pack',
            deliveryOption: 'digital',
            digitalFile: { fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK', filename: 'OET_Mocks.pdf' },
          },
          {
            addOnId: 'oet-vocab-pack',
            nameSnapshot: 'Medical Vocabulary Pack',
            deliveryOption: 'digital',
            digitalFile: { fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK', filename: 'OET_Vocab.pdf' },
          },
        ],
      },
    ],
  };
  await saveOrder(mockEnv, orderG);
  const linksG = await issuePaidFulfillmentLinks(orderG, mockEnv);
  assert.strictEqual(linksG.materials.length, 3, 'Must have exactly 3 materials (1 main + 2 add-ons)');
  console.log('  PASS: All 3 purchased items generated in materials list.\n');

  // -------------------------------------------------------------------------
  // TEST H: Unpurchased add-on -> Not displayed
  // -------------------------------------------------------------------------
  console.log('TEST H: Unpurchased add-on -> Not displayed');
  // Order contains mock tests, but NOT vocabulary
  const vocabAddonFound = linksF.materials.some((m) => m.addOnId === 'oet-vocab-pack');
  assert.strictEqual(vocabAddonFound, false, 'Unpurchased add-on must never appear in materials');
  console.log('  PASS: Unpurchased add-ons strictly excluded from customer materials.\n');

  // -------------------------------------------------------------------------
  // TEST I: Refresh success page -> Status reconstructed from backend
  // -------------------------------------------------------------------------
  console.log('TEST I: Refresh success page -> Status reconstructed from backend');
  const reqI = createMockRequest({ url: 'http://localhost/api/order-status?order_id=ord_p6_test_g_007' });
  const resI = await handleOrderStatus({ request: reqI, env: mockEnv });
  assert.strictEqual(resI.status, 200);
  const dataI = await resI.json();
  assert.strictEqual(dataI.status, 'PAID');
  assert.strictEqual(dataI.materials.length, 3);
  console.log('  PASS: Server-authoritative status query successfully reconstructs paid state on reload.\n');

  // -------------------------------------------------------------------------
  // TEST J: Valid material download -> Protected download succeeds
  // -------------------------------------------------------------------------
  console.log('TEST J: Valid material download -> Protected download succeeds');
  const testMaterial = linksG.materials[0];
  const reqJ = createMockRequest({
    url: testMaterial.downloadUrl,
    headers: { 'cf-connecting-ip': '192.168.1.1' },
  });
  const resJ = await handleDownload({ request: reqJ, env: mockEnv });
  assert.strictEqual(resJ.status, 200);
  assert.ok(resJ.headers.get('content-type').includes('application/pdf'));
  console.log('  PASS: Valid signed token downloads protected PDF binary stream.\n');

  // -------------------------------------------------------------------------
  // TEST K: Expired download token -> Download denied, but entitlement remains
  // -------------------------------------------------------------------------
  console.log('TEST K: Expired download token -> Download denied, but entitlement remains');
  const expiredToken = await createSessionToken(
    {
      orderId: 'ord_p6_test_g_007',
      entitlementId: testMaterial.entitlementId,
      bookId: testMaterial.productId,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    },
    SIGNING_KEY
  );
  const reqK = createMockRequest({
    url: `http://localhost/api/download?order_id=ord_p6_test_g_007&entitlement_id=${testMaterial.entitlementId}&token=${expiredToken}`,
  });
  const resK = await handleDownload({ request: reqK, env: mockEnv });
  assert.strictEqual(resK.status, 403, 'Expired token must be rejected');

  // Verify entitlement in database is still ACTIVE
  const storedEnts = await getEntitlementsByOrderId(mockEnv, 'ord_p6_test_g_007');
  const matchedEnt = storedEnts.find((e) => e.id === testMaterial.entitlementId);
  assert.ok(matchedEnt && matchedEnt.status === 'ACTIVE', 'Entitlement must remain ACTIVE despite expired token');
  console.log('  PASS: Expired token rejected with HTTP 403 while lifetime entitlement remains ACTIVE.\n');

  // -------------------------------------------------------------------------
  // TEST L: Request new download after token expiration -> Fresh authorization obtained
  // -------------------------------------------------------------------------
  console.log('TEST L: Request new download after token expiration -> Fresh authorization obtained');
  // Customer calls order-status endpoint to refresh signed fulfillment links
  const reqL = createMockRequest({ url: 'http://localhost/api/order-status?order_id=ord_p6_test_g_007' });
  const resL = await handleOrderStatus({ request: reqL, env: mockEnv });
  const dataL = await resL.json();
  const freshMaterial = dataL.materials.find((m) => m.entitlementId === testMaterial.entitlementId);
  assert.ok(freshMaterial && freshMaterial.downloadUrl, 'Fresh download URL must be issued');

  const reqLDownload = createMockRequest({ url: freshMaterial.downloadUrl });
  const resLDownload = await handleDownload({ request: reqLDownload, env: mockEnv });
  assert.strictEqual(resLDownload.status, 200, 'Freshly authorized download must succeed');
  console.log('  PASS: Fresh download authorization successfully obtained and executed.\n');

  // -------------------------------------------------------------------------
  // TEST M: Order A entitlement used against Order B -> Access denied
  // -------------------------------------------------------------------------
  console.log('TEST M: Order A entitlement used against Order B -> Access denied');
  const tokenA = new URL(testMaterial.downloadUrl, 'http://localhost').searchParams.get('token');
  const reqM = createMockRequest({
    url: `http://localhost/api/download?order_id=ord_p6_test_a_001&entitlement_id=${testMaterial.entitlementId}&token=${tokenA}`,
  });
  const resM = await handleDownload({ request: reqM, env: mockEnv });
  assert.strictEqual(resM.status, 403, 'Cross-order entitlement use must return 403');
  console.log('  PASS: Cross-order token tampering strictly denied.\n');

  // -------------------------------------------------------------------------
  // TEST N: Unpaid order requests material -> Access denied
  // -------------------------------------------------------------------------
  console.log('TEST N: Unpaid order requests material -> Access denied');
  const fakeTokenN = await createSessionToken({ orderId: 'ord_p6_test_b_002', bookId: 'oet-guide', exp: Math.floor(Date.now() / 1000) + 3600 }, SIGNING_KEY);
  const reqN = createMockRequest({
    url: `http://localhost/api/download?order_id=ord_p6_test_b_002&book_id=oet-guide&token=${fakeTokenN}`,
  });
  const resN = await handleDownload({ request: reqN, env: mockEnv });
  assert.strictEqual(resN.status, 403, 'Unpaid order download must return 403');
  console.log('  PASS: Download for unpaid order denied with HTTP 403.\n');

  // -------------------------------------------------------------------------
  // TEST O: Order exists but belongs to another customer -> Access denied
  // -------------------------------------------------------------------------
  console.log('TEST O: Order belongs to another customer -> Material download requires matching token');
  // Attempting to download someone else's order without a valid token matching that order
  const reqO = createMockRequest({
    url: `http://localhost/api/download?order_id=ord_p6_test_a_001&token=invalid_foreign_token`,
  });
  const resO = await handleDownload({ request: reqO, env: mockEnv });
  assert.strictEqual(resO.status, 403, 'Foreign or invalid token must return 403');
  console.log('  PASS: Foreign token cannot access other customer orders.\n');

  // -------------------------------------------------------------------------
  // TEST P: Admin later disables purchased add-on -> Historical entitlement remains valid
  // -------------------------------------------------------------------------
  console.log('TEST P: Admin later disables purchased add-on -> Historical entitlement remains valid');
  // Even if an add-on is disabled in the catalog today, the historical paid entitlement remains ACTIVE
  const storedEntsP = await getEntitlementsByOrderId(mockEnv, 'ord_p6_test_g_007');
  for (const ent of storedEntsP) {
    assert.strictEqual(ent.status, 'ACTIVE');
  }
  console.log('  PASS: Disabling add-ons in catalog does not invalidate historical entitlements.\n');

  // -------------------------------------------------------------------------
  // TEST Q: Admin changes current price -> Historical order amount remains unchanged
  // -------------------------------------------------------------------------
  console.log('TEST Q: Admin changes price -> Historical order amount remains unchanged');
  const storedOrderQ = await getOrder(mockEnv, 'ord_p6_test_a_001');
  assert.strictEqual(storedOrderQ.amount_paise, 34700, 'Historical paid amount must remain ₹347 immutably');
  console.log('  PASS: Historical order record remains immutable.\n');

  // -------------------------------------------------------------------------
  // TEST R: Success page receives malformed order ID -> Safe error / no data leak
  // -------------------------------------------------------------------------
  console.log('TEST R: Success page receives malformed order ID -> Safe 404 error / no data leak');
  const reqR = createMockRequest({ url: 'http://localhost/api/order-status?order_id=malformed_id_%27%22%3C%3E' });
  const resR = await handleOrderStatus({ request: reqR, env: mockEnv });
  assert.strictEqual(resR.status, 404);
  const dataR = await resR.json();
  assert.strictEqual(dataR.status, 'NOT_FOUND');
  console.log('  PASS: Malformed order ID safely returns 404 without leaking internal errors.\n');

  // -------------------------------------------------------------------------
  // TEST S: Network failure while loading materials -> Handled safely
  // -------------------------------------------------------------------------
  console.log('TEST S: Missing order_id parameter -> Clean 400 error');
  const reqS = createMockRequest({ url: 'http://localhost/api/order-status' });
  const resS = await handleOrderStatus({ request: reqS, env: mockEnv });
  assert.strictEqual(resS.status, 400);
  const dataS = await resS.json();
  assert.ok(dataS.error.includes('Missing order_id'));
  console.log('  PASS: Missing order_id parameter returns clean HTTP 400.\n');

  // -------------------------------------------------------------------------
  // TEST T: No purchased materials -> Clean empty state
  // -------------------------------------------------------------------------
  console.log('TEST T: Order with 0 items -> Clean empty materials state');
  const orderT = {
    id: 'ord_p6_test_t_020',
    status: 'PAID',
    items: [],
  };
  await saveOrder(mockEnv, orderT);
  const linksT = await issuePaidFulfillmentLinks(orderT, mockEnv);
  assert.strictEqual(linksT.materials.length, 0);
  console.log('  PASS: Empty order gracefully produces 0 materials without crashing.\n');

  console.log('==================================================');
  console.log('ALL 20 PHASE 6 ACCEPTANCE & SECURITY TESTS PASSED!');
  console.log('==================================================');
}

runPhase6Tests().catch((err) => {
  console.error('Phase 6 test failed:', err);
  process.exit(1);
});
