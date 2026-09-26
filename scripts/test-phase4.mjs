// scripts/test-phase4.mjs
// Automated verification suite for Phase 4: Persistence + Input Validation

import assert from 'node:assert';
import fs from 'node:fs';
import { createSessionToken } from '../functions/utils/auth.js';
import { onRequestGet as handleAdminOrders } from '../functions/api/admin/orders.js';
import { onRequestPost as handleUpload } from '../functions/api/upload.js';
import { onRequestPost as handleProducts } from '../functions/api/products.js';
import { saveOrder } from '../functions/utils/db.js';

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
  async list(options) {
    const prefix = options?.prefix || '';
    const keys = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        keys.push({ name: k });
      }
    }
    return { keys };
  }
}

const mockEnv = {
  ADMIN_SESSION_SECRET: 'test_session_secret_for_hardening_phase4_32bytes_long!',
  CLOUDINARY_CLOUD_NAME: 'mock_cloud',
  CLOUDINARY_API_KEY: 'mock_api_key_123',
  CLOUDINARY_API_SECRET: 'mock_api_secret_456',
  PRODUCTS_KV: new MockKV(),
};

async function runTests() {
  console.log('--- STARTING PHASE 4 VERIFICATION SUITE ---\n');

  // 1. Verify D1 SQL Schema
  console.log('Test 1: D1 Migration Schema (0001_init.sql)');
  const sql = fs.readFileSync('migrations/0001_init.sql', 'utf8');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS orders'), 'orders table must exist');
  assert(sql.includes('amount_paise INTEGER NOT NULL'), 'amount_paise must be INTEGER, never float');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS order_events'), 'order_events table must exist');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS admin_login_attempts'), 'admin_login_attempts must exist');
  assert(sql.includes('CREATE INDEX IF NOT EXISTS idx_orders_cf_order_id'), 'idx_orders_cf_order_id index must exist');
  assert(sql.includes('CREATE INDEX IF NOT EXISTS idx_orders_customer_email'), 'idx_orders_customer_email index must exist');
  console.log('  PASS: 0001_init.sql contains integer paise, tables, and indexes\n');

  // Generate valid admin session cookie for testing
  const validToken = await createSessionToken({ role: 'admin' }, mockEnv.ADMIN_SESSION_SECRET, 3600);
  const adminCookie = `admin_session=${validToken}`;

  // 2. GET /api/admin/orders Protection
  console.log('Test 2: GET /api/admin/orders Route Guard');
  const unauthReq = new Request('https://portal.xylemlearning.online/api/admin/orders');
  const unauthRes = await handleAdminOrders({ request: unauthReq, env: mockEnv });
  assert.strictEqual(unauthRes.status, 401, 'Must return 401 for unauthenticated access');

  // Save sample order into mock KV
  await saveOrder(mockEnv, {
    id: 'order_test_401',
    cf_order_id: 'order_test_401',
    amount_paise: 19900,
    currency: 'INR',
    status: 'PAID',
    customer_name: 'Test Student',
    customer_email: 'student@example.com',
    shipping: { fullName: 'Test Student' },
    items: [{ bookId: 'ielts-full-prep', title: 'IELTS Prep' }],
  });

  const authReq = new Request('https://portal.xylemlearning.online/api/admin/orders?page=1&limit=10', {
    headers: { Cookie: adminCookie },
  });
  const authRes = await handleAdminOrders({ request: authReq, env: mockEnv });
  assert.strictEqual(authRes.status, 200);
  const ordersJson = await authRes.json();
  assert.strictEqual(ordersJson.success, true);
  assert(Array.isArray(ordersJson.orders));
  assert(ordersJson.pagination);
  console.log(`  PASS: GET /api/admin/orders enforces 401 unauth and returns paginated list (${ordersJson.orders.length} items)\n`);

  // 3. POST /api/upload File Size & Magic Bytes Validation
  console.log('Test 3: POST /api/upload Hardening');
  // 3a. Unauthenticated upload -> 401
  const unauthUpReq = new Request('https://portal.xylemlearning.online/api/upload', { method: 'POST' });
  const unauthUpRes = await handleUpload({ request: unauthUpReq, env: mockEnv });
  assert.strictEqual(unauthUpRes.status, 401, 'Upload must require admin');

  // 3b. Oversized file (> 5 MB) -> 400
  const largeBuffer = new Uint8Array(5 * 1024 * 1024 + 1024); // 5 MB + 1 KB
  const largeForm = new FormData();
  largeForm.append('image', new Blob([largeBuffer], { type: 'image/jpeg' }), 'huge.jpg');
  const largeReq = new Request('https://portal.xylemlearning.online/api/upload', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: largeForm,
  });
  const largeRes = await handleUpload({ request: largeReq, env: mockEnv });
  const largeJson = await largeRes.json();
  assert.strictEqual(largeRes.status, 400);
  assert(largeJson.error && largeJson.error.includes('5 MB'), 'Should indicate 5 MB limit');
  console.log('  PASS: Files exceeding 5 MB rejected with 400');

  // 3c. Fake image (text content with .png extension) -> 400 (Magic bytes reject)
  const fakeImageBytes = new TextEncoder().encode('<html><script>alert(1)</script></html>');
  const fakeForm = new FormData();
  fakeForm.append('image', new Blob([fakeImageBytes], { type: 'image/png' }), 'exploit.png');
  const fakeReq = new Request('https://portal.xylemlearning.online/api/upload', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: fakeForm,
  });
  const fakeRes = await handleUpload({ request: fakeReq, env: mockEnv });
  assert.strictEqual(fakeRes.status, 400);
  const fakeJson = await fakeRes.json();
  assert(fakeJson.error.includes('Invalid file format'), 'Magic byte mismatch must be rejected');
  console.log('  PASS: Non-image file disguised as PNG rejected by magic byte validator');

  // 3d. Genuine PNG magic bytes -> accepted
  // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, followed by IHDR chunk
  const validPngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const validForm = new FormData();
  validForm.append('image', new Blob([validPngBytes], { type: 'image/png' }), 'client_name_ignored.png');
  validForm.append('productId', 'ielts_prep_test');

  // Mock global fetch for Cloudinary call inside upload handler
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('cloudinary.com')) {
      return new Response(
        JSON.stringify({
          secure_url: 'https://res.cloudinary.com/mock_cloud/image/upload/v12345/prod_test.png',
          public_id: 'prod_test_public_id',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(url, opts);
  };

  const validReq = new Request('https://portal.xylemlearning.online/api/upload', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: validForm,
  });
  const validRes = await handleUpload({ request: validReq, env: mockEnv });
  assert.strictEqual(validRes.status, 200);
  const validJson = await validRes.json();
  assert.strictEqual(validJson.success, true);
  assert.strictEqual(validJson.mimeType, 'image/png');
  console.log('  PASS: Authentic PNG verified by magic bytes and uploaded with server filename\n');

  // 4. POST /api/products Payload Size & Field Capping
  console.log('Test 4: POST /api/products Validation & 1 MB Cap');
  // 4a. Unauthenticated products update -> 401
  const unauthProdReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    body: JSON.stringify({ books: [] }),
  });
  const unauthProdRes = await handleProducts({ request: unauthProdReq, env: mockEnv });
  assert.strictEqual(unauthProdRes.status, 401);

  // 4b. Payload > 1 MB -> 413
  const hugePayload = JSON.stringify({
    books: [],
    padding: 'x'.repeat(1024 * 1024 + 10),
  });
  const hugeProdReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: hugePayload,
  });
  const hugeProdRes = await handleProducts({ request: hugeProdReq, env: mockEnv });
  assert.strictEqual(hugeProdRes.status, 413, 'Payloads over 1 MB must return 413 Payload Too Large');
  console.log('  PASS: Payloads exceeding 1 MB rejected with HTTP 413');

  // 4c. Valid products with oversized fields -> sanitized & size-capped
  const testBooks = [
    {
      id: 'ielts-oversized-title-id-which-is-longer-than-allowed-limit-and-contains-bad-chars!@#$',
      title: 'A'.repeat(500), // Exceeds 200 chars
      prices: { digital: { price: '299', originalPrice: '699' } },
      features: Array(50).fill('feature').map((f, i) => `${f}_${i}`), // Exceeds 30
    },
  ];

  const validProdReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({ books: testBooks }),
  });
  const validProdRes = await handleProducts({ request: validProdReq, env: mockEnv });
  assert.strictEqual(validProdRes.status, 200);
  const prodJson = await validProdRes.json();
  const savedBook = prodJson.books[0];
  assert(savedBook.id.length <= 64, 'Product ID must be capped to 64');
  assert(!savedBook.id.includes('!'), 'Special characters stripped from ID');
  assert(savedBook.title.length <= 200, 'Title must be capped to 200 characters');
  assert(savedBook.features.length <= 30, 'Features capped to 30 items');
  assert.strictEqual(savedBook.prices.digital.price, 299);
  console.log('  PASS: Products payload sanitized and size-capped successfully\n');

  // Restore global fetch
  globalThis.fetch = originalFetch;

  console.log('--- ALL PHASE 4 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
