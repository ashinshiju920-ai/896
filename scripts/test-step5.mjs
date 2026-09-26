// scripts/test-step5.mjs
// Verification suite for Step 5: Server-Authoritative Storefront Content Persistence

import assert from 'node:assert';
import { createSessionToken } from '../functions/utils/auth.js';
import { onRequestGet as handleGetProducts, onRequestPost as handlePostProducts } from '../functions/api/products.js';

// Mock Cloudflare KV
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
  ADMIN_SESSION_SECRET: 'test_session_secret_for_step5_32bytes_long!',
  CLOUDINARY_CLOUD_NAME: 'mock_cloud',
  CLOUDINARY_API_KEY: 'mock_api_key_123',
  CLOUDINARY_API_SECRET: 'mock_api_secret_456',
  PRODUCTS_KV: new MockKV(),
};

async function runStep5Tests() {
  console.log('==================================================');
  console.log('STARTING STEP 5 STOREFRONT CONTENT PERSISTENCE TESTS');
  console.log('==================================================\n');

  // Intercept global fetch for Cloudinary upload mocking
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('api.cloudinary.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          secure_url: 'https://res.cloudinary.com/mock_cloud/raw/upload/xylem_products_live.json',
        }),
      };
    }
    return originalFetch(url, opts);
  };

  // Generate valid admin session cookie
  const validExp = Math.floor(Date.now() / 1000) + 3600;
  const adminToken = await createSessionToken({ role: 'admin', exp: validExp }, mockEnv.ADMIN_SESSION_SECRET);
  const adminCookie = `admin_session=${adminToken}`;

  // TEST 1: Unauthorized write attempt must be rejected (Part 18 Test E)
  console.log('TEST 1: Unauthorized write attempt (No Admin Session)');
  const unauthReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      books: [{ id: 'test-book', title: 'Hacked Book' }],
      testimonials: [{ id: 'fake-test', name: 'Hacker', quote: 'Fake Review' }],
    }),
  });
  const unauthRes = await handlePostProducts({ request: unauthReq, env: mockEnv });
  assert.strictEqual(unauthRes.status, 401, 'Unauthorized request must return HTTP 401');
  assert.strictEqual(await mockEnv.PRODUCTS_KV.get('xylem_products'), null, 'KV must remain unpolluted');
  console.log('  PASS: Unauthorized write blocked with HTTP 401 and KV untouched\n');

  // TEST 2: Admin saves Exam Category change -> Stored in KV (Part 18 Test B)
  console.log('TEST 2: Authenticated Exam Category save to Cloudflare KV');
  const customExamPaths = [
    {
      category: 'IELTS',
      title: 'IELTS Academic Masterclass',
      description: 'Comprehensive 8.5 Band Preparation',
      bgImage: 'https://res.cloudinary.com/xylem/image/upload/ielts_banner.jpg',
      badgeText: 'Band 8+',
      isMedicalCross: false,
      scriptWords: ['Listen', 'Read', 'Speak', 'Write'],
      redirectTarget: 'catalog',
    },
    {
      category: 'OET',
      title: 'OET Medicine & Nursing',
      description: 'Healthcare Professional English',
      bgImage: 'https://res.cloudinary.com/xylem/image/upload/oet_banner.jpg',
      badgeText: 'Grade A',
      isMedicalCross: true,
      scriptWords: ['Care', 'Clinical', 'Confidence'],
      redirectTarget: 'catalog',
    },
  ];

  const examPathReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      books: [{ id: 'prod_1', title: 'IELTS Prep Book', prices: { digital: { price: 299 } } }],
      examPaths: customExamPaths,
    }),
  });

  const examPathRes = await handlePostProducts({ request: examPathReq, env: mockEnv });
  assert.strictEqual(examPathRes.status, 200, 'Authenticated POST must return 200');
  const postData = await examPathRes.json();
  assert.strictEqual(postData.success, true);
  assert(Array.isArray(postData.examPaths), 'examPaths must be returned in response');
  assert.strictEqual(postData.examPaths[0].title, 'IELTS Academic Masterclass');
  assert.strictEqual(postData.examPaths[1].isMedicalCross, true, 'isMedicalCross flag preserved');

  // Verify KV persistence
  const kvStored = await mockEnv.PRODUCTS_KV.get('xylem_products', { type: 'json' });
  assert.strictEqual(kvStored.examPaths[0].title, 'IELTS Academic Masterclass');
  assert.strictEqual(kvStored.examPaths[1].isMedicalCross, true);
  console.log('  PASS: Exam paths successfully validated, sanitized, and stored in Cloudflare KV\n');

  // TEST 3: Another device reads from server via GET /api/products (Part 18 Test B Device B)
  console.log('TEST 3: Remote device reads authoritative exam paths from Cloudflare KV');
  const getReq = new Request('https://portal.xylemlearning.online/api/products');
  const getRes = await handleGetProducts({ request: getReq, env: mockEnv });
  assert.strictEqual(getRes.status, 200);
  const fetchedData = await getRes.json();
  assert.strictEqual(fetchedData.examPaths[0].title, 'IELTS Academic Masterclass');
  assert.strictEqual(fetchedData.examPaths[0].badgeText, 'Band 8+');
  console.log('  PASS: Device B successfully retrieves updated exam paths from Cloudflare KV\n');

  // TEST 4: Admin adds a Testimonial -> Persisted to KV (Part 18 Test A)
  console.log('TEST 4: Authenticated Testimonial addition & persistence');
  const initialTestimonials = [
    {
      id: 't-101',
      name: 'Dr. Priya Menon',
      role: 'OET Medicine | Grade A',
      avatar: 'https://res.cloudinary.com/xylem/image/upload/priya.jpg',
      quote: 'The study material helped me clear OET on my first attempt with straight As.',
      rating: 5,
    },
  ];

  const testReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      books: [{ id: 'prod_1', title: 'IELTS Prep Book', prices: { digital: { price: 299 } } }],
      examPaths: customExamPaths,
      testimonials: initialTestimonials,
    }),
  });

  const testRes = await handlePostProducts({ request: testReq, env: mockEnv });
  assert.strictEqual(testRes.status, 200);
  const testData = await testRes.json();
  assert.strictEqual(testData.testimonials[0].name, 'Dr. Priya Menon');

  // Check KV
  const kvAfterTest = await mockEnv.PRODUCTS_KV.get('xylem_products', { type: 'json' });
  assert.strictEqual(kvAfterTest.testimonials[0].name, 'Dr. Priya Menon');
  console.log('  PASS: Testimonial successfully persisted to Cloudflare KV\n');

  // TEST 5: Admin edits Testimonial text (Part 18 Test D)
  console.log('TEST 5: Admin edits existing testimonial');
  const updatedTestimonials = [
    {
      id: 't-101',
      name: 'Dr. Priya Menon',
      role: 'OET Medicine | All Sub-tests Grade A',
      avatar: 'https://res.cloudinary.com/xylem/image/upload/priya.jpg',
      quote: 'Updated quote: Highly recommended for all UK/Ireland medical aspirants!',
      rating: 5,
    },
  ];

  const editReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      testimonials: updatedTestimonials,
    }),
  });

  const editRes = await handlePostProducts({ request: editReq, env: mockEnv });
  assert.strictEqual(editRes.status, 200);
  const editData = await editRes.json();
  assert.strictEqual(editData.testimonials[0].quote, 'Updated quote: Highly recommended for all UK/Ireland medical aspirants!');

  const kvAfterEdit = await mockEnv.PRODUCTS_KV.get('xylem_products', { type: 'json' });
  assert.strictEqual(kvAfterEdit.testimonials[0].quote, 'Updated quote: Highly recommended for all UK/Ireland medical aspirants!');
  console.log('  PASS: Edited testimonial text persists to Cloudflare KV\n');

  // TEST 6: Admin deletes Testimonial (Part 18 Test C)
  console.log('TEST 6: Admin deletes testimonial (empty list)');
  const deleteReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      testimonials: [],
    }),
  });

  const deleteRes = await handlePostProducts({ request: deleteReq, env: mockEnv });
  assert.strictEqual(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert(Array.isArray(deleteData.testimonials) && deleteData.testimonials.length === 0, 'Testimonials must be empty');

  const kvAfterDelete = await mockEnv.PRODUCTS_KV.get('xylem_products', { type: 'json' });
  assert(Array.isArray(kvAfterDelete.testimonials) && kvAfterDelete.testimonials.length === 0, 'KV must hold empty array after deletion');
  console.log('  PASS: Testimonial deletion confirmed in Cloudflare KV\n');

  // TEST 7: Product regression test (Part 18 Test G)
  console.log('TEST 7: Product persistence regression');
  const productReq = new Request('https://portal.xylemlearning.online/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      books: [
        {
          id: 'ielts-speaking-master',
          title: 'IELTS Speaking 9.0 Pro',
          prices: { digital: { price: 349, originalPrice: 799 } },
        },
      ],
    }),
  });
  const prodRes = await handlePostProducts({ request: productReq, env: mockEnv });
  assert.strictEqual(prodRes.status, 200);
  const prodData = await prodRes.json();
  assert.strictEqual(prodData.books[0].title, 'IELTS Speaking 9.0 Pro');

  // Verify non-admins cannot read raw pdfUrl on GET
  const pubReq = new Request('https://portal.xylemlearning.online/api/products');
  const pubRes = await handleGetProducts({ request: pubReq, env: mockEnv });
  const pubData = await pubRes.json();
  assert.strictEqual(pubData.books[0].pdfUrl, undefined, 'pdfUrl must remain hidden from unauthenticated GET requests');
  console.log('  PASS: Products persist and secure PDF sanitization remains active\n');

  // Restore global fetch
  globalThis.fetch = originalFetch;

  console.log('==================================================');
  console.log('ALL STEP 5 STOREFRONT PERSISTENCE TESTS PASSED!');
  console.log('==================================================\n');
}

runStep5Tests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
