import assert from 'node:assert';
import { onRequestPost as handleUploadPost } from '../functions/api/upload.js';
import { onRequestGet as handleProductsGet, onRequestPost as handleProductsPost } from '../functions/api/products.js';
import { createSessionToken } from '../functions/utils/auth.js';

class MockKV {
  constructor() {
    this.store = new Map();
  }

  async get(key, options) {
    const value = this.store.get(key);
    if (!value) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}

const ADMIN_SECRET = 'product_creation_live_sync_secret';
const env = {
  PRODUCTS_KV: new MockKV(),
  ADMIN_SESSION_SECRET: ADMIN_SECRET,
  CLOUDINARY_CLOUD_NAME: 'creation_test_cloud',
  CLOUDINARY_API_KEY: 'creation_test_key',
  CLOUDINARY_API_SECRET: 'creation_test_secret',
};

const cloudinaryCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  if (urlStr.includes('api.cloudinary.com')) {
    const fields = {};
    for (const [key, value] of options.body.entries()) {
      fields[key] = typeof value === 'string'
        ? value
        : { name: value.name, type: value.type, size: value.size };
    }
    cloudinaryCalls.push({ url: urlStr, fields });

    if (urlStr.includes('/image/upload')) {
      return Response.json({
        secure_url: `https://res.cloudinary.com/creation_test_cloud/image/upload/${fields.folder}/${fields.public_id}.jpg`,
        public_id: `${fields.folder}/${fields.public_id}`,
      });
    }

    if (urlStr.includes('/raw/upload')) {
      return Response.json({
        secure_url: 'https://res.cloudinary.com/creation_test_cloud/raw/upload/xylem_products_live.json',
      });
    }
  }

  return typeof originalFetch === 'function'
    ? originalFetch(url, options)
    : new Response('Not Found', { status: 404 });
};

async function adminCookie() {
  const token = await createSessionToken(
    { role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 },
    ADMIN_SECRET
  );
  return `admin_session=${token}`;
}

function validPngFile() {
  const pngBytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  return new File([pngBytes], 'new-product-cover.png', { type: 'image/png' });
}

try {
  const cookie = await adminCookie();

  console.log('TEST: Upload image while creating a new product');
  const uploadForm = new FormData();
  uploadForm.append('image', validPngFile());
  uploadForm.append('productId', 'new-product');

  const uploadRes = await handleUploadPost({
    env,
    request: new Request('https://shop.example/api/upload', {
      method: 'POST',
      headers: { Cookie: cookie, 'cf-connecting-ip': '127.0.0.1' },
      body: uploadForm,
    }),
  });
  assert.strictEqual(uploadRes.status, 200);
  const uploadData = await uploadRes.json();
  assert.strictEqual(uploadData.success, true);
  assert.ok(uploadData.imageUrl.includes('res.cloudinary.com/creation_test_cloud/image/upload'));
  assert.strictEqual(uploadData.productId, 'new-product');

  const imageCall = cloudinaryCalls.find((call) => call.url.includes('/image/upload'));
  assert.ok(imageCall, 'Cloudinary image upload must be called');
  assert.strictEqual(imageCall.fields.folder, 'ecommerce_products');
  assert.ok(imageCall.fields.public_id.startsWith('product_new-product_'));
  assert.ok(imageCall.fields.signature, 'Cloudinary signed upload must include signature');
  console.log('  PASS: New-product image upload signs and posts to Cloudinary.');

  console.log('TEST: Create product with custom prices and uploaded Cloudinary image');
  const newProduct = {
    id: 'book_created_live_sync',
    title: 'Created Live Sync Product',
    subtitle: 'Custom price and uploaded image',
    category: 'IELTS',
    type: 'Study Guides',
    rating: 4.9,
    reviewCount: 0,
    description: 'Created through admin product creation flow.',
    longDescription: 'Created through admin product creation flow.',
    features: ['Live synced'],
    whatYouGet: ['Cloudinary cover image'],
    tableOfContents: [{ chapter: 'Intro', pages: '1-5' }],
    prices: {
      digital: { price: 321, originalPrice: 654, discountPercent: 51 },
      physical: { price: 987, originalPrice: 1234, discountPercent: 20 },
    },
    coverTheme: {
      bgGradient: 'from-slate-900 to-emerald-900',
      accentColor: '#00875a',
      textColor: '#ffffff',
      badgeText: 'NEW',
    },
    samplePdfName: 'created-live-sync.pdf',
    pdfUrl: '',
    imageUrl: uploadData.imageUrl,
    coverImage: uploadData.imageUrl,
    images: [uploadData.imageUrl],
    totalPages: 120,
    addOns: [
      { id: 'digital', name: 'Digital (PDF)', price: 321, pricePaise: 32100, originalPrice: 654, deliveryOption: 'digital', active: true },
      { id: 'physical', name: 'Physical (Printed)', price: 987, pricePaise: 98700, originalPrice: 1234, deliveryOption: 'physical', active: true },
      { id: 'addon_custom_module', name: 'Custom Module', price: 77, pricePaise: 7700, originalPrice: 99, deliveryOption: 'digital', active: true },
    ],
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 321, pricePaise: 32100, originalPrice: 654, deliveryOption: 'digital', active: true },
      { id: 'physical', name: 'Physical (Printed)', price: 987, pricePaise: 98700, originalPrice: 1234, deliveryOption: 'physical', active: true },
      { id: 'addon_custom_module', name: 'Custom Module', price: 77, pricePaise: 7700, originalPrice: 99, deliveryOption: 'digital', active: true },
    ],
  };

  const saveRes = await handleProductsPost({
    env,
    request: new Request('https://shop.example/api/products', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ books: [newProduct] }),
    }),
  });
  assert.strictEqual(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.strictEqual(saveData.success, true);
  assert.strictEqual(saveData.books.length, 1);

  const savedProduct = saveData.books[0];
  assert.strictEqual(savedProduct.prices.digital.price, 321);
  assert.strictEqual(savedProduct.prices.digital.originalPrice, 654);
  assert.strictEqual(savedProduct.prices.physical.price, 987);
  assert.strictEqual(savedProduct.prices.physical.originalPrice, 1234);
  assert.strictEqual(savedProduct.imageUrl, uploadData.imageUrl);
  assert.deepStrictEqual(savedProduct.images, [uploadData.imageUrl]);
  assert.strictEqual(savedProduct.addOns.find((a) => a.id === 'digital').pricePaise, 32100);
  assert.strictEqual(savedProduct.addOns.find((a) => a.id === 'physical').pricePaise, 98700);
  assert.strictEqual(savedProduct.addOns.find((a) => a.id === 'addon_custom_module').pricePaise, 7700);
  console.log('  PASS: Server persisted custom prices, add-on paise, and uploaded image URL.');

  console.log('TEST: Public live catalog returns the newly created product');
  const publicGetRes = await handleProductsGet({
    env,
    request: new Request('https://shop.example/api/products'),
  });
  assert.strictEqual(publicGetRes.status, 200);
  const publicData = await publicGetRes.json();
  const publicProduct = publicData.books.find((book) => book.id === newProduct.id);
  assert.ok(publicProduct, 'Created product must be present in public catalog');
  assert.strictEqual(publicProduct.prices.digital.price, 321);
  assert.strictEqual(publicProduct.prices.physical.price, 987);
  assert.strictEqual(publicProduct.imageUrl, uploadData.imageUrl);
  assert.strictEqual(publicProduct.addOns.find((a) => a.id === 'addon_custom_module').pricePaise, 7700);
  console.log('  PASS: Live catalog read returns custom prices and Cloudinary image.');

  console.log('\nALL PRODUCT CREATION LIVE SYNC TESTS PASSED');
} finally {
  globalThis.fetch = originalFetch;
}
