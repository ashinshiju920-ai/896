// scripts/test-phase3.mjs
// Automated verification suite for Phase 3: Server-Authoritative Pricing & Payment Verification

import assert from 'node:assert';
import { computeOrderPrice, validateShippingInfo } from '../functions/utils/pricing.js';
import { saveOrder, getOrder, updateOrderStatus, issuePaidFulfillmentLinks } from '../functions/utils/db.js';
import { onRequestPost as handleCreateOrder } from '../functions/api/create-cashfree-order.js';
import { onRequestPost as handleWebhook } from '../functions/api/cashfree-webhook.js';
import { onRequestGet as handleOrderStatus } from '../functions/api/order-status.js';
import { onRequestGet as handleDownload } from '../functions/api/download.js';

// In-Memory Mock KV
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
}

const mockEnv = {
  CASHFREE_APP_ID: 'TEST_APP_ID_123',
  CASHFREE_SECRET_KEY: 'cfsk_ma_test_mock_secret_key_123456789',
  CASHFREE_ENV: 'SANDBOX',
  PRODUCTS_KV: new MockKV(),
};

async function runTests() {
  console.log('--- STARTING PHASE 3 VERIFICATION SUITE ---\n');

  // TEST 1: Reject Price Tampering (Top-level and in Cart)
  console.log('Test 1: Price Tampering Rejection in /api/create-cashfree-order');
  const tamperedPayloads = [
    { price: 10, cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1 }] },
    { total: 5, cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1 }] },
    { requestedAmount: 50, cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1 }] },
    { amount: 10, cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1 }] },
    { cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1, price: 50 }] },
    { cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1, total: 50 }] },
  ];

  for (const payload of tamperedPayloads) {
    const req = new Request('https://portal.xylemlearning.online/api/create-cashfree-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res = await handleCreateOrder({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 400, `Expected HTTP 400 for tampered payload: ${JSON.stringify(payload)}`);
    const json = await res.json();
    assert(json.error.includes('Price tampering detected'), 'Should include price tampering error message');
  }
  console.log('  PASS: All tampered payloads rejected with HTTP 400\n');

  // TEST 2: Authoritative Server Pricing Calculation
  console.log('Test 2: Authoritative Server Price Computation');
  const pricingResult = await computeOrderPrice(
    {
      cart: [{ bookId: 'ielts-full-prep', format: 'digital', quantity: 1 }],
      couponCode: 'XYLEM20',
      deliveryOption: 'digital',
    },
    mockEnv
  );
  // Default digital price is 199. 20% coupon off 199 is 40. Total should be 199 - 40 = 159.
  assert.strictEqual(pricingResult.subtotal, 199);
  assert.strictEqual(pricingResult.deliveryFee, 0);
  assert.strictEqual(pricingResult.couponDiscount, 40);
  assert.strictEqual(pricingResult.total, 159);
  assert.strictEqual(pricingResult.totalPaise, 15900);
  console.log(`  PASS: Subtotal=₹${pricingResult.subtotal}, Discount=₹${pricingResult.couponDiscount}, Total=₹${pricingResult.total}\n`);

  // TEST 3: Shipping Validation
  console.log('Test 3: Shipping Validation');
  const invalidShipping = validateShippingInfo({ fullName: '', email: 'bad-email', phone: '123' }, true);
  assert.strictEqual(invalidShipping.isValid, false);
  assert(invalidShipping.errors.length >= 3);

  const validShipping = validateShippingInfo(
    {
      fullName: 'Ashin Shiju',
      email: 'ashin@example.com',
      phone: '9876543210',
      address: '123 Main St',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682016',
    },
    true
  );
  assert.strictEqual(validShipping.isValid, true);
  console.log('  PASS: Shipping validation correctly enforces Indian mobile and required address fields\n');

  // TEST 4: D1 / KV Order Persistence
  console.log('Test 4: Order Persistence & Retrieval');
  const testOrderId = `order_${Date.now()}_test`;
  await saveOrder(mockEnv, {
    id: testOrderId,
    cf_order_id: testOrderId,
    amount_paise: 15900,
    currency: 'INR',
    status: 'PENDING',
    customer_name: 'Ashin Shiju',
    customer_email: 'ashin@example.com',
    shipping: validShipping.clean,
    items: [{ bookId: 'ielts-full-prep', title: 'IELTS Full Prep', format: 'digital', quantity: 1 }],
  });

  const retrieved = await getOrder(mockEnv, testOrderId);
  assert(retrieved, 'Order must be retrievable');
  assert.strictEqual(retrieved.status, 'PENDING');
  assert.strictEqual(retrieved.amount_paise, 15900);
  console.log('  PASS: Pending order saved and retrieved successfully\n');

  // TEST 5: Order Status Endpoint before Payment (UNPAID)
  console.log('Test 5: GET /api/order-status on PENDING order');
  const statusReqUnpaid = new Request(`https://portal.xylemlearning.online/api/order-status?order_id=${testOrderId}`);
  const statusResUnpaid = await handleOrderStatus({ request: statusReqUnpaid, env: mockEnv });
  assert.strictEqual(statusResUnpaid.status, 200);
  const statusJsonUnpaid = await statusResUnpaid.json();
  assert.strictEqual(statusJsonUnpaid.status, 'PENDING');
  assert.strictEqual(statusJsonUnpaid.fulfillment, undefined, 'Must NOT issue fulfillment links on unpaid order!');
  console.log('  PASS: Unpaid order does not leak fulfillment links\n');

  // TEST 6: Protected Download Gate on Unpaid Order (Must return 403)
  console.log('Test 6: Protected Download Gate on PENDING order (HTTP 403 expected)');
  const dlReqUnpaid = new Request(`https://portal.xylemlearning.online/api/download?order_id=${testOrderId}&book_id=ielts-full-prep`);
  const dlResUnpaid = await handleDownload({ request: dlReqUnpaid, env: mockEnv });
  assert.strictEqual(dlResUnpaid.status, 403, 'Must return 403 Forbidden for unpaid download attempt');
  console.log('  PASS: Unpaid download blocked with HTTP 403\n');

  // TEST 7: Webhook Signature Verification
  console.log('Test 7: Cashfree Webhook Signature & Amount Verification');
  const webhookBody = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: testOrderId, order_amount: 159 },
      payment: { payment_amount: 159, payment_status: 'SUCCESS' },
    },
  });

  // 7a. Reject invalid signature
  const fakeWebhookReq = new Request('https://portal.xylemlearning.online/api/cashfree-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'invalid_signature_string',
      'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body: webhookBody,
  });
  const fakeWebhookRes = await handleWebhook({ request: fakeWebhookReq, env: mockEnv });
  assert.strictEqual(fakeWebhookRes.status, 401, 'Invalid signature must be rejected with 401');

  // 7b. Reject expired timestamp (replay defense)
  const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
  const expiredWebhookReq = new Request('https://portal.xylemlearning.online/api/cashfree-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'some_sig',
      'x-webhook-timestamp': expiredTimestamp,
    },
    body: webhookBody,
  });
  const expiredWebhookRes = await handleWebhook({ request: expiredWebhookReq, env: mockEnv });
  assert.strictEqual(expiredWebhookRes.status, 401, 'Expired timestamp must be rejected with 401');

  // 7c. Valid Signature with Amount Match -> Sets status to PAID
  const validTimestamp = String(Math.floor(Date.now() / 1000));
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(mockEnv.CASHFREE_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(validTimestamp + webhookBody));
  const validSig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  const validWebhookReq = new Request('https://portal.xylemlearning.online/api/cashfree-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': validSig,
      'x-webhook-timestamp': validTimestamp,
    },
    body: webhookBody,
  });
  const validWebhookRes = await handleWebhook({ request: validWebhookReq, env: mockEnv });
  assert.strictEqual(validWebhookRes.status, 200);

  const updatedOrder = await getOrder(mockEnv, testOrderId);
  assert.strictEqual(updatedOrder.status, 'PAID', 'Order status must be updated to PAID');
  console.log('  PASS: Webhook signature verified and order status transitioned to PAID\n');

  // TEST 8: Order Status Endpoint on Confirmed PAID Order
  console.log('Test 8: GET /api/order-status on PAID order unlocks fulfillment');
  const statusReqPaid = new Request(`https://portal.xylemlearning.online/api/order-status?order_id=${testOrderId}`);
  const statusResPaid = await handleOrderStatus({ request: statusReqPaid, env: mockEnv });
  assert.strictEqual(statusResPaid.status, 200);
  const statusJsonPaid = await statusResPaid.json();
  assert.strictEqual(statusJsonPaid.status, 'PAID');
  assert(statusJsonPaid.fulfillment, 'Fulfillment links must be present for PAID order');
  assert(statusJsonPaid.fulfillment.googleSheetUrl.includes('/copy'));
  assert(statusJsonPaid.fulfillment.downloads.length > 0);
  console.log('  PASS: Verified PAID order returns Google Sheet template and download links\n');

  // TEST 9: Protected Download Gate on Confirmed PAID Order with configured asset
  console.log('Test 9: Protected Download Gate on PAID order (HTTP 200 expected)');
  const authenticPdfSample = `%PDF-1.4\n1 0 obj\n<< /Title (IELTS Full Preparation) >>\nendobj\nstream\nStatus: VERIFIED PAID\nendstream\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
  const pdfBase64 = `data:application/pdf;base64,${Buffer.from(authenticPdfSample).toString('base64')}`;
  await mockEnv.PRODUCTS_KV.put('xylem_products', JSON.stringify({
    books: [
      {
        id: 'ielts-full-prep',
        title: 'IELTS Full Prep',
        pdfUrl: pdfBase64,
        samplePdfName: 'IELTS_Full_Prep_Official.pdf',
      },
    ],
  }));

  const dlReqPaid = new Request(`https://portal.xylemlearning.online/api/download?order_id=${testOrderId}&book_id=ielts-full-prep`);
  const dlResPaid = await handleDownload({ request: dlReqPaid, env: mockEnv });
  assert.strictEqual(dlResPaid.status, 200);
  const dlContent = await dlResPaid.text();
  assert(dlContent.includes('%PDF-1.4'));
  assert(dlContent.includes('Status: VERIFIED PAID'));
  console.log('  PASS: Download unlocked with authentic verified PDF\n');

  // TEST 9b: Paid order with missing configured asset must return safe 404, never fake PDF
  console.log('Test 9b: Missing asset returns safe 404 without fake PDF');
  await mockEnv.PRODUCTS_KV.put('xylem_products', JSON.stringify({
    books: [
      {
        id: 'ielts-full-prep',
        title: 'IELTS Full Prep',
        pdfUrl: '', // No PDF configured
      },
    ],
  }));
  const dlResMissing = await handleDownload({ request: dlReqPaid, env: mockEnv });
  assert.strictEqual(dlResMissing.status, 404);
  const dlMissingJson = await dlResMissing.json();
  assert(dlMissingJson.error.includes('temporarily unavailable'));
  console.log('  PASS: Missing PDF returns safe HTTP 404 without fake document generation\n');

  console.log('--- ALL PHASE 3 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
