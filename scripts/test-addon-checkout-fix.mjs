// scripts/test-addon-checkout-fix.mjs
// Verification suite for checkout with add-ons & post-payment entitlement fulfillment

import assert from 'node:assert';
import {
  computeOrderPrice,
  loadCatalogue,
  DEFAULT_CATALOG,
} from '../functions/utils/pricing.js';
import {
  createEntitlementsForPaidOrder,
  issuePaidFulfillmentLinks,
} from '../functions/utils/db.js';

async function runTests() {
  console.log('==================================================');
  console.log('TESTING ADD-ON CHECKOUT & FULFILLMENT FIX');
  console.log('==================================================');

  // 1. Mock Cloudinary fetch
  const mockCloudinaryCatalog = {
    version: 1790543228,
    books: [
      {
        id: 'ielts-practice-tests',
        title: 'IELTS Practice Tests 10 Full-Length Mock Tests',
        prices: {
          digital: { price: 599, originalPrice: 1199 },
          physical: { price: 1499, originalPrice: 1899 },
        },
        addons: [
          {
            id: 'addon_1790543228971_oahrd',
            name: 'Vocabulary Booster Audio & Worksheets',
            price: 99,
            pricePaise: 9900,
            originalPrice: 199,
            active: true,
            deliveryOption: 'digital',
            digitalFile: {
              filename: 'vocab-booster.pdf',
              fileUrl: 'https://res.cloudinary.com/xylem/raw/upload/vocab-booster.pdf',
            },
          },
        ],
      },
    ],
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes('cloudinary.com') && urlStr.includes('xylem_products_live.json')) {
      return {
        ok: true,
        json: async () => mockCloudinaryCatalog,
      };
    }
    return originalFetch(url, options);
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: KV is empty, but Cloudinary has the live catalog with add-on
    // -------------------------------------------------------------------------
    console.log('TEST 1: KV empty -> Falls back to Cloudinary and validates add-on');
    const env = {
      CLOUDINARY_CLOUD_NAME: 'test_xylem_cloud',
      CASHFREE_APP_ID: 'TEST_APP',
      CASHFREE_SECRET_KEY: 'cfsk_ma_test_secret',
    };

    const cartWithAddon = [
      {
        bookId: 'ielts-practice-tests',
        addonIds: ['addon_1790543228971_oahrd'],
        format: 'digital',
        quantity: 1,
      },
    ];

    const pricing = await computeOrderPrice(cartWithAddon, 'digital', null, env);
    console.log(`  Subtotal: ₹${pricing.subtotal}, Total: ₹${pricing.total}, TotalPaise: ${pricing.totalPaise}`);
    assert.strictEqual(pricing.total, 698, 'Total must equal ₹599 (base) + ₹99 (addon) = ₹698');
    assert.strictEqual(pricing.totalPaise, 69800, 'Total paise must equal 69800');
    assert.strictEqual(pricing.items.length, 1, 'Should have 1 cart line');
    assert.strictEqual(pricing.items[0].addOns.length, 1, 'Should have 1 add-on');
    assert.strictEqual(pricing.items[0].addOns[0].addOnId, 'addon_1790543228971_oahrd');
    console.log('  PASS: Successfully calculated ₹698 with add-on from Cloudinary catalog!');

    // -------------------------------------------------------------------------
    // TEST 2: Main product only (without add-on) -> Calculates base price ₹599
    // -------------------------------------------------------------------------
    console.log('\nTEST 2: Main product only (without add-on)');
    const cartWithoutAddon = [
      {
        bookId: 'ielts-practice-tests',
        addonIds: ['digital'],
        format: 'digital',
        quantity: 1,
      },
    ];

    const pricingMainOnly = await computeOrderPrice(cartWithoutAddon, 'digital', null, env);
    console.log(`  Subtotal: ₹${pricingMainOnly.subtotal}, Total: ₹${pricingMainOnly.total}`);
    assert.strictEqual(pricingMainOnly.total, 599, 'Total must equal ₹599 for base product');
    assert.strictEqual(pricingMainOnly.totalPaise, 59900, 'Total paise must equal 59900');
    console.log('  PASS: Successfully calculated ₹599 for main product alone!');

    // -------------------------------------------------------------------------
    // TEST 3: Unknown add-on ID that does NOT exist anywhere -> Rejection
    // -------------------------------------------------------------------------
    console.log('\nTEST 3: Completely unknown add-on ID rejected safely');
    await assert.rejects(
      async () => {
        await computeOrderPrice(
          [
            {
              bookId: 'ielts-practice-tests',
              addonIds: ['completely_fake_addon_999'],
              format: 'digital',
              quantity: 1,
            },
          ],
          'digital',
          null,
          env
        );
      },
      (err) => {
        assert.ok(err.message.includes('Unknown add-on ID "completely_fake_addon_999"'));
        return true;
      }
    );
    console.log('  PASS: Unknown add-on correctly rejected!');

    // -------------------------------------------------------------------------
    // TEST 4: Post-payment entitlement generation for product + add-on
    // -------------------------------------------------------------------------
    console.log('\nTEST 4: Post-payment digital entitlements granted for both product & add-on');
    const mockOrder = {
      id: 'order_test_123',
      status: 'PAID',
      items: pricing.items,
      amount_paise: pricing.totalPaise,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Mock storage for entitlements
    const memoryKV = new Map();
    const mockD1Env = {
      PRODUCTS_KV: {
        get: async (k) => memoryKV.get(k) || null,
        put: async (k, v) => memoryKV.set(k, v),
      },
    };

    const entitlements = await createEntitlementsForPaidOrder(mockD1Env, mockOrder);
    console.log(`  Entitlements created: ${entitlements.length}`);
    for (const ent of entitlements) {
      console.log(`    - ID: ${ent.id}, ProductId: ${ent.productId}, AddOnId: ${ent.addOnId}, Title: ${ent.title}`);
    }

    assert.strictEqual(entitlements.length, 2, 'Must create 2 entitlements (1 main product + 1 add-on)');
    const mainEnt = entitlements.find((e) => e.addOnId === null);
    const addonEnt = entitlements.find((e) => e.addOnId === 'addon_1790543228971_oahrd');

    assert.ok(mainEnt, 'Main product entitlement must exist');
    assert.ok(addonEnt, 'Add-on entitlement must exist');
    console.log('  PASS: Both product and add-on entitlements created with correct IDs!');

    // -------------------------------------------------------------------------
    // TEST 5: Fulfillment links generation for product + add-on
    // -------------------------------------------------------------------------
    console.log('\nTEST 5: Fulfillment download links issued for both product & add-on');
    const fulfillment = await issuePaidFulfillmentLinks(mockOrder, mockD1Env);
    assert.ok(fulfillment && Array.isArray(fulfillment.materials), 'Fulfillment materials must be returned');
    assert.strictEqual(fulfillment.materials.length, 2, 'Must have 2 downloadable materials');

    for (const mat of fulfillment.materials) {
      console.log(`    - Material: ${mat.name}, Type: ${mat.type}, AddOnId: ${mat.addOnId}, Download: ${mat.downloadUrl}`);
    }
    console.log('  PASS: Both product and add-on fulfillment materials ready for instant download!');

    console.log('\n==================================================');
    console.log('ALL TESTS PASSED! ADD-ON CHECKOUT & FULFILLMENT VERIFIED!');
    console.log('==================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
