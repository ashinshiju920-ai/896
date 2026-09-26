// scripts/test-step3.mjs
// Comprehensive Verification Suite for Step 3: Production-Ready Digital PDF Delivery System

import assert from 'node:assert';
import { onRequestGet as handleDownload } from '../functions/api/download.js';
import { onRequestGet as handleOrderStatus } from '../functions/api/order-status.js';
import { onRequestPost as handleCreateOrder } from '../functions/api/create-cashfree-order.js';
import { onRequestPost as handleWebhook } from '../functions/api/cashfree-webhook.js';
import { saveOrder, getOrder, issuePaidFulfillmentLinks } from '../functions/utils/db.js';
import { createSessionToken } from '../functions/utils/auth.js';

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

const SIGNING_SECRET = 'step3_signing_secret_for_tests_32bytes_long!';

const mockEnv = {
  CASHFREE_APP_ID: 'TEST_APP_ID_STEP3',
  CASHFREE_SECRET_KEY: 'cfsk_ma_test_secret_step3_123456789',
  CASHFREE_ENV: 'SANDBOX',
  DOWNLOAD_SIGNING_KEY: SIGNING_SECRET,
  ADMIN_SESSION_SECRET: SIGNING_SECRET,
  PRODUCTS_KV: new MockKV(),
};

// Authentic sample binary PDF content
const SAMPLE_IELTS_PDF = `%PDF-1.4\n1 0 obj\n<< /Title (IELTS Authentic Guide) >>\nendobj\nstream\nXYLEM LEARNING OFFICIAL IELTS COMPLETE COURSEWARE\nendstream\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
const SAMPLE_OET_PDF = `%PDF-1.4\n1 0 obj\n<< /Title (OET Authentic Guide) >>\nendobj\nstream\nXYLEM LEARNING OFFICIAL OET MEDICAL COURSEWARE\nendstream\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;

const ieltsBase64 = `data:application/pdf;base64,${Buffer.from(SAMPLE_IELTS_PDF).toString('base64')}`;
const oetBase64 = `data:application/pdf;base64,${Buffer.from(SAMPLE_OET_PDF).toString('base64')}`;

async function runStep3Tests() {
  console.log('==================================================');
  console.log('STARTING STEP 3 DIGITAL PDF DELIVERY TEST SUITE');
  console.log('==================================================\n');

  // Seed Catalog in Mock KV
  await mockEnv.PRODUCTS_KV.put(
    'xylem_products',
    JSON.stringify({
      books: [
        {
          id: 'ielts-full-prep',
          title: 'IELTS Full Preparation with Mock Tests',
          pdfUrl: ieltsBase64,
          samplePdfName: 'Xylem-IELTS-Full-Preparation-Guide.pdf',
        },
        {
          id: 'oet-full-prep',
          title: 'OET Full Preparation with Mock Tests',
          pdfUrl: oetBase64,
          samplePdfName: 'Xylem-OET-Full-Preparation-Guide.pdf',
        },
        {
          id: 'pte-academic-prep',
          title: 'PTE Academic Complete Preparation',
          pdfUrl: '', // Missing PDF URL configured
          samplePdfName: 'Xylem-PTE-Prep.pdf',
        },
        {
          id: 'physical-handbook',
          title: 'Physical Printed Handbook Only',
          pdfUrl: '',
          samplePdfName: '',
        },
      ],
    })
  );

  // Seed Test Orders
  const orderUnpaid = 'order_unpaid_101';
  await saveOrder(mockEnv, {
    id: orderUnpaid,
    amount_paise: 19900,
    status: 'UNPAID',
    items: [{ bookId: 'ielts-full-prep', title: 'IELTS Full Prep', format: 'digital' }],
  });

  const orderPending = 'order_pending_102';
  await saveOrder(mockEnv, {
    id: orderPending,
    amount_paise: 19900,
    status: 'PENDING',
    items: [{ bookId: 'ielts-full-prep', title: 'IELTS Full Prep', format: 'digital' }],
  });

  const orderFailed = 'order_failed_103';
  await saveOrder(mockEnv, {
    id: orderFailed,
    amount_paise: 19900,
    status: 'FAILED',
    items: [{ bookId: 'ielts-full-prep', title: 'IELTS Full Prep', format: 'digital' }],
  });

  const orderPaidSingle = 'order_paid_single_104';
  await saveOrder(mockEnv, {
    id: orderPaidSingle,
    amount_paise: 19900,
    status: 'PAID',
    items: [{ bookId: 'ielts-full-prep', title: 'IELTS Full Prep', format: 'digital' }],
  });

  const orderPaidMulti = 'order_paid_multi_105';
  await saveOrder(mockEnv, {
    id: orderPaidMulti,
    amount_paise: 39800,
    status: 'PAID',
    items: [
      { bookId: 'ielts-full-prep', title: 'IELTS Full Prep', format: 'digital' },
      { bookId: 'oet-full-prep', title: 'OET Full Prep', format: 'digital' },
    ],
  });

  const orderPaidPhysical = 'order_paid_physical_106';
  await saveOrder(mockEnv, {
    id: orderPaidPhysical,
    amount_paise: 99900,
    status: 'PAID',
    items: [{ bookId: 'physical-handbook', title: 'Physical Handbook', format: 'physical' }],
  });

  const orderPaidMissingPdf = 'order_paid_missing_pdf_107';
  await saveOrder(mockEnv, {
    id: orderPaidMissingPdf,
    amount_paise: 19900,
    status: 'PAID',
    items: [{ bookId: 'pte-academic-prep', title: 'PTE Academic Prep', format: 'digital' }],
  });

  // TEST 1: Unpaid order requests download -> DENY (403)
  console.log('TEST 1: Unpaid order requests download -> DENY');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderUnpaid}&book_id=ielts-full-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Unpaid order must be denied with 403');
    console.log('  PASS: Blocked with HTTP 403\n');
  }

  // TEST 2: Pending order requests download -> DENY (403)
  console.log('TEST 2: Pending order requests download -> DENY');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPending}&book_id=ielts-full-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Pending order must be denied with 403');
    console.log('  PASS: Blocked with HTTP 403\n');
  }

  // TEST 3: Failed order requests download -> DENY (403)
  console.log('TEST 3: Failed order requests download -> DENY');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderFailed}&book_id=ielts-full-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Failed order must be denied with 403');
    console.log('  PASS: Blocked with HTTP 403\n');
  }

  // TEST 4: Paid order requests purchased IELTS -> ALLOW (200 with authentic PDF)
  console.log('TEST 4: Paid order requests purchased IELTS -> ALLOW');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidSingle}&book_id=ielts-full-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 200, 'Paid purchased book must be allowed with 200');
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    assert(res.headers.get('content-disposition').includes('Xylem-IELTS-Full-Preparation-Guide.pdf'));
    const body = await res.text();
    assert(body.includes('XYLEM LEARNING OFFICIAL IELTS COMPLETE COURSEWARE'));
    console.log('  PASS: Allowed with HTTP 200 and authentic purchased PDF binary\n');
  }

  // TEST 5: Paid order requests unpurchased PTE -> DENY (403)
  console.log('TEST 5: Paid order requests unpurchased PTE -> DENY');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidSingle}&book_id=pte-academic-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Unpurchased product must be denied with 403');
    const json = await res.json();
    assert(json.error.includes('not part of this purchased order'));
    console.log('  PASS: Blocked with HTTP 403 product entitlement check\n');
  }

  // TEST 6: Paid order references missing PDF -> Safe failure, no fake PDF (404)
  console.log('TEST 6: Paid order references missing PDF -> Safe failure, NO fake PDF');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidMissingPdf}&book_id=pte-academic-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 404, 'Missing PDF must return HTTP 404');
    const json = await res.json();
    assert.strictEqual(json.error, 'Your digital book is temporarily unavailable. Please contact support.');
    console.log('  PASS: Returned safe HTTP 404 with support message, zero fake/placeholder document generated\n');
  }

  // TEST 7: Invalid/nonexistent order ID -> DENY (404)
  console.log('TEST 7: Invalid/nonexistent order ID -> DENY');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=nonexistent_order_99999&book_id=ielts-full-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 404, 'Nonexistent order must return 404');
    console.log('  PASS: Blocked with HTTP 404\n');
  }

  // TEST 8: Invalid product ID -> DENY (403/400)
  console.log('TEST 8: Invalid product ID -> DENY');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidSingle}&book_id=totally-fake-product-sku`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Invalid product ID must be denied with 403');
    console.log('  PASS: Blocked with HTTP 403\n');
  }

  // TEST 9: Attempt to manipulate product ID in URL -> DENY (403)
  console.log('TEST 9: Attempt to manipulate product ID in URL -> DENY');
  {
    // Customer paid for IELTS in orderPaidSingle, attempts to manipulate URL to download OET
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidSingle}&book_id=oet-full-prep`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Manipulated product ID must be denied');
    console.log('  PASS: URL manipulation blocked with HTTP 403\n');
  }

  // TEST 10: Attempt to reuse expired/invalid token -> DENY (403)
  console.log('TEST 10: Attempt to reuse expired/invalid token -> DENY');
  {
    // 10a. Fake/invalid token
    const fakeTokenReq = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidSingle}&book_id=ielts-full-prep&token=fake.forged.token`);
    const fakeTokenRes = await handleDownload({ request: fakeTokenReq, env: mockEnv });
    assert.strictEqual(fakeTokenRes.status, 403, 'Forged token must be rejected with 403');

    // 10b. Expired token (created with exp in past)
    const expiredToken = await createSessionToken(
      { orderId: orderPaidSingle, bookId: 'ielts-full-prep', exp: Math.floor(Date.now() / 1000) - 3600 },
      SIGNING_SECRET
    );
    const expiredReq = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidSingle}&book_id=ielts-full-prep&token=${expiredToken}`);
    const expiredRes = await handleDownload({ request: expiredReq, env: mockEnv });
    assert.strictEqual(expiredRes.status, 403, 'Expired token must be rejected with 403');

    // 10c. Mismatched token (token created for IELTS, passed with OET)
    const validIeltsToken = await createSessionToken(
      { orderId: orderPaidMulti, bookId: 'ielts-full-prep', exp: Math.floor(Date.now() / 1000) + 3600 },
      SIGNING_SECRET
    );
    const mismatchedReq = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidMulti}&book_id=oet-full-prep&token=${validIeltsToken}`);
    const mismatchedRes = await handleDownload({ request: mismatchedReq, env: mockEnv });
    assert.strictEqual(mismatchedRes.status, 403, 'Token mismatched to product must be rejected with 403');

    console.log('  PASS: Forged, expired, and mismatched tokens all rejected with HTTP 403\n');
  }

  // TEST 11: Multiple-product paid order -> Each purchased product can be downloaded separately
  console.log('TEST 11: Multiple-product paid order -> Download each purchased product separately');
  {
    // Download IELTS from multi-order
    const reqIelts = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidMulti}&book_id=ielts-full-prep`);
    const resIelts = await handleDownload({ request: reqIelts, env: mockEnv });
    assert.strictEqual(resIelts.status, 200);
    const bodyIelts = await resIelts.text();
    assert(bodyIelts.includes('IELTS COMPLETE COURSEWARE'));

    // Download OET from multi-order
    const reqOet = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidMulti}&book_id=oet-full-prep`);
    const resOet = await handleDownload({ request: reqOet, env: mockEnv });
    assert.strictEqual(resOet.status, 200);
    const bodyOet = await resOet.text();
    assert(bodyOet.includes('OET MEDICAL COURSEWARE'));

    // Attempt unpurchased PTE from multi-order
    const reqPte = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidMulti}&book_id=pte-academic-prep`);
    const resPte = await handleDownload({ request: reqPte, env: mockEnv });
    assert.strictEqual(resPte.status, 403);

    console.log('  PASS: Multi-product order permits downloading each purchased product individually and rejects unpurchased products\n');
  }

  // TEST 12: Physical-only product -> No misleading digital download (403)
  console.log('TEST 12: Physical-only product -> No misleading digital download');
  {
    const req = new Request(`https://portal.xylemlearning.online/api/download?order_id=${orderPaidPhysical}&book_id=physical-handbook`);
    const res = await handleDownload({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403, 'Physical item download must be denied with 403');
    const json = await res.json();
    assert(json.error.includes('physical-only product'));
    console.log('  PASS: Physical-only item download rejected with HTTP 403\n');
  }

  // TEST 13: Order fulfillment links -> Only contains entitled digital products
  console.log('TEST 13: Order fulfillment links -> Only contains entitled digital products');
  {
    const orderObj = await getOrder(mockEnv, orderPaidMulti);
    const fulfillment = await issuePaidFulfillmentLinks(orderObj, mockEnv);
    assert(fulfillment, 'Must return fulfillment for PAID order');
    assert.strictEqual(fulfillment.downloads.length, 2, 'Must have exactly 2 download links for 2 digital items');
    assert(fulfillment.downloads[0].downloadUrl.includes('book_id=ielts-full-prep'));
    assert(fulfillment.downloads[1].downloadUrl.includes('book_id=oet-full-prep'));

    // Physical order fulfillment should contain NO download links
    const physicalOrderObj = await getOrder(mockEnv, orderPaidPhysical);
    const physicalFulfillment = await issuePaidFulfillmentLinks(physicalOrderObj, mockEnv);
    assert.strictEqual(physicalFulfillment.downloads.length, 0, 'Physical order must have 0 download links');
    console.log('  PASS: Server only issues download links for verified digital items\n');
  }

  // TEST 14: OrdersHistoryView / OrderStatus endpoint verification
  console.log('TEST 14: OrdersHistoryView / OrderStatus endpoint security');
  {
    const reqStatus = new Request(`https://portal.xylemlearning.online/api/order-status?order_id=${orderPaidMulti}`);
    const resStatus = await handleOrderStatus({ request: reqStatus, env: mockEnv });
    assert.strictEqual(resStatus.status, 200);
    const jsonStatus = await resStatus.json();
    assert.strictEqual(jsonStatus.status, 'PAID');
    assert.strictEqual(jsonStatus.fulfillment.downloads.length, 2);
    // Unpaid status does not leak fulfillment
    const reqUnpaidStatus = new Request(`https://portal.xylemlearning.online/api/order-status?order_id=${orderUnpaid}`);
    const resUnpaidStatus = await handleOrderStatus({ request: reqUnpaidStatus, env: mockEnv });
    const jsonUnpaidStatus = await resUnpaidStatus.json();
    assert.strictEqual(jsonUnpaidStatus.fulfillment, undefined);
    console.log('  PASS: Order status endpoint securely governs download link issuance\n');
  }

  // TEST 15: Existing Cashfree flow unaffected
  console.log('TEST 15: Existing Cashfree checkout flow unaffected');
  {
    const newOrderId = `order_cf_flow_${Date.now()}`;
    await saveOrder(mockEnv, {
      id: newOrderId,
      cf_order_id: newOrderId,
      amount_paise: 19900,
      status: 'PENDING',
      items: [{ bookId: 'ielts-full-prep', format: 'digital' }],
    });

    const webhookBody = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: newOrderId, order_amount: 199 },
        payment: { payment_amount: 199, payment_status: 'SUCCESS' },
      },
    });

    const timestamp = String(Math.floor(Date.now() / 1000));
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(mockEnv.CASHFREE_SECRET_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(timestamp + webhookBody));
    const validSig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    const webhookReq = new Request('https://portal.xylemlearning.online/api/cashfree-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': validSig,
        'x-webhook-timestamp': timestamp,
      },
      body: webhookBody,
    });

    const webhookRes = await handleWebhook({ request: webhookReq, env: mockEnv });
    assert.strictEqual(webhookRes.status, 200);

    const verifiedOrder = await getOrder(mockEnv, newOrderId);
    assert.strictEqual(verifiedOrder.status, 'PAID');

    // And now the download is unlocked!
    const dlReq = new Request(`https://portal.xylemlearning.online/api/download?order_id=${newOrderId}&book_id=ielts-full-prep`);
    const dlRes = await handleDownload({ request: dlReq, env: mockEnv });
    assert.strictEqual(dlRes.status, 200);
    console.log('  PASS: Complete Cashfree order transition -> download unlock verified\n');
  }

  console.log('==================================================');
  console.log('ALL 15 STEP 3 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
}

runStep3Tests().catch((err) => {
  console.error('Step 3 verification failed:', err);
  process.exit(1);
});
