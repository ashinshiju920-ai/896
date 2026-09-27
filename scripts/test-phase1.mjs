// scripts/test-phase1.mjs
// Phase 1 Verification Test Suite
// Verifies: Products -> Add-ons -> Order Snapshots -> Entitlements

import assert from 'node:assert';
import {
  getProductAddOn,
  validateSelectedAddOns,
  calculateProductWithAddOns,
  createOrderItemSnapshot,
  computeOrderPrice,
} from '../functions/utils/pricing.js';
import {
  saveOrder,
  getOrder,
  createEntitlementsForPaidOrder,
  getEntitlementsByOrderId,
  issuePaidFulfillmentLinks,
} from '../functions/utils/db.js';

// In-Memory Cloudflare KV Mock for testing
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
      order_events: new Map(),
    };
  }

  prepare(sql) {
    const self = this;
    return {
      bind(...params) {
        return {
          async run() {
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
            if (sql.includes('FROM orders WHERE id = ?')) {
              const [id] = params;
              return self.tables.orders.get(id) || null;
            }
            return null;
          }
        };
      }
    };
  }
}

const mockEnv = {
  DB: new MockD1(),
  PRODUCTS_KV: new MockKV(),
  DOWNLOAD_SIGNING_KEY: 'test_phase1_secret_key_32_bytes_long',
};

async function runPhase1Tests() {
  console.log('==================================================');
  console.log('STARTING PHASE 1 DATA FOUNDATION TEST SUITE');
  console.log('==================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Old product with no add-ons
  // -------------------------------------------------------------------------
  console.log('TEST 1: Old product with no add-ons -> Loads successfully');
  const oldProduct = {
    id: 'legacy-ielts-guide',
    title: 'Legacy IELTS Guide',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 899, originalPrice: 1499 },
    },
    samplePdfName: 'legacy-ielts.pdf',
    pdfUrl: 'https://example.com/legacy-ielts.pdf',
    // No addOns defined
  };
  const legacyAddons = validateSelectedAddOns(oldProduct, ['digital']);
  assert.strictEqual(legacyAddons.isValid, true, 'Legacy product should safely default for digital format');
  assert.strictEqual(legacyAddons.validAddOns.length, 1);
  assert.strictEqual(legacyAddons.validAddOns[0].id, 'digital');
  console.log('  PASS: Legacy product without add-ons loads and resolves format safely.\n');

  // -------------------------------------------------------------------------
  // TEST 2: Product with one active add-on
  // -------------------------------------------------------------------------
  console.log('TEST 2: Product with one active add-on -> Add-on loads correctly');
  const productOneAddon = {
    id: 'oet-guide-single-addon',
    title: 'OET Nursing Guide',
    prices: {
      digital: { price: 199, originalPrice: 599 },
    },
    addOns: [
      {
        id: 'mock-tests-vol1',
        name: '10 OET Mock Tests Volume 1',
        description: 'Comprehensive practice tests',
        pricePaise: 9900,
        price: 99,
        active: true,
        deliveryOption: 'digital',
        digitalFile: { filename: 'oet-mocks-vol1.pdf', fileUrl: 'https://example.com/mocks.pdf' },
      },
    ],
  };
  const addonFound = getProductAddOn(productOneAddon, 'mock-tests-vol1');
  assert.ok(addonFound, 'Active add-on must be found');
  assert.strictEqual(addonFound.id, 'mock-tests-vol1');
  assert.strictEqual(addonFound.pricePaise, 9900);
  assert.strictEqual(addonFound.price, 99);
  assert.strictEqual(addonFound.active, true);
  console.log('  PASS: Single active add-on resolved with integer paise (9900) and metadata.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Product with multiple add-ons
  // -------------------------------------------------------------------------
  console.log('TEST 3: Product with multiple add-ons -> All add-ons load correctly');
  const productMultiAddons = {
    id: 'pte-complete-suite',
    title: 'PTE Complete Suite',
    prices: {
      digital: { price: 199, originalPrice: 599 },
    },
    addOns: [
      {
        id: 'pte-mock-tests',
        name: 'PTE 15 Mock Tests',
        pricePaise: 9900,
        price: 99,
        active: true,
        deliveryOption: 'digital',
      },
      {
        id: 'pte-vocab-booster',
        name: 'PTE Academic Vocabulary Booster',
        pricePaise: 4900,
        price: 49,
        active: true,
        deliveryOption: 'digital',
      },
      {
        id: 'pte-speaking-audio',
        name: 'PTE Speaking Audio Bank',
        pricePaise: 7900,
        price: 79,
        active: true,
        deliveryOption: 'digital',
      },
    ],
  };
  const multiValidation = validateSelectedAddOns(productMultiAddons, [
    'pte-mock-tests',
    'pte-vocab-booster',
    'pte-speaking-audio',
  ]);
  assert.strictEqual(multiValidation.isValid, true);
  assert.strictEqual(multiValidation.validAddOns.length, 3);
  assert.strictEqual(multiValidation.validAddOns[0].id, 'pte-mock-tests');
  assert.strictEqual(multiValidation.validAddOns[1].id, 'pte-vocab-booster');
  assert.strictEqual(multiValidation.validAddOns[2].id, 'pte-speaking-audio');
  console.log('  PASS: All 3 active add-ons validated and loaded correctly.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Inactive add-on
  // -------------------------------------------------------------------------
  console.log('TEST 4: Inactive add-on -> Server validation does NOT allow purchase');
  const productWithInactive = {
    id: 'german-b1-suite',
    title: 'German B1 Guide',
    prices: {
      digital: { price: 199, originalPrice: 599 },
    },
    addOns: [
      {
        id: 'german-grammar-pack',
        name: 'German Grammar Intensive',
        pricePaise: 4900,
        price: 49,
        active: false, // Inactive
        deliveryOption: 'digital',
      },
    ],
  };
  const inactiveCheck = validateSelectedAddOns(productWithInactive, ['german-grammar-pack']);
  assert.strictEqual(inactiveCheck.isValid, false, 'Inactive add-on must be rejected');
  assert.ok(inactiveCheck.error.includes('inactive'), 'Error must specify add-on is inactive');
  console.log(`  PASS: Inactive add-on safely blocked: "${inactiveCheck.error}".\n`);

  // -------------------------------------------------------------------------
  // TEST 5: Unknown add-on ID
  // -------------------------------------------------------------------------
  console.log('TEST 5: Unknown add-on ID -> Validation fails safely');
  const unknownCheck = validateSelectedAddOns(productMultiAddons, ['non-existent-addon-xyz']);
  assert.strictEqual(unknownCheck.isValid, false, 'Unknown add-on must be rejected');
  assert.ok(unknownCheck.error.includes('Unknown add-on ID'), 'Error message must report unknown add-on ID');
  console.log(`  PASS: Unknown add-on safely blocked: "${unknownCheck.error}".\n`);

  // -------------------------------------------------------------------------
  // TEST 6: Historical price snapshot
  // -------------------------------------------------------------------------
  console.log('TEST 6: Historical price snapshot -> Immutable record unaffected by future catalog price edits');
  const mutableProduct = {
    id: 'dynamic-ielts-course',
    title: 'IELTS Dynamic Masterclass',
    prices: {
      digital: { price: 199, originalPrice: 599 },
    },
    addOns: [
      {
        id: 'mock-test-addon',
        name: 'Official Mock Test Pack',
        pricePaise: 9900, // ₹99
        price: 99,
        active: true,
        deliveryOption: 'digital',
      },
    ],
  };

  // Step 1: Customer purchases at current price (₹199 + ₹99 = ₹298)
  const orderSnapshot = createOrderItemSnapshot(mutableProduct, ['mock-test-addon'], 1, 'digital');
  assert.strictEqual(orderSnapshot.unitPricePaise, 29800);
  assert.strictEqual(orderSnapshot.unitPrice, 298);
  assert.strictEqual(orderSnapshot.addOns[0].unitPricePaise, 9900);
  assert.strictEqual(orderSnapshot.addOns[0].price, 99);

  // Step 2: Admin alters catalog prices later (IELTS = ₹249, Add-on = ₹149)
  mutableProduct.prices.digital.price = 249;
  mutableProduct.addOns[0].pricePaise = 14900;
  mutableProduct.addOns[0].price = 149;

  // Step 3: Verify the snapshot created earlier REMAINS ₹199 + ₹99
  assert.strictEqual(orderSnapshot.unitPricePaise, 29800, 'Historical snapshot must not change');
  assert.strictEqual(orderSnapshot.addOns[0].unitPricePaise, 9900, 'Add-on snapshot price must not change');
  assert.strictEqual(orderSnapshot.addOns[0].price, 99);
  console.log('  PASS: Historical price snapshot preserved at ₹199 + ₹99 despite catalog price increase.\n');

  // -------------------------------------------------------------------------
  // TEST 7: Order without add-ons
  // -------------------------------------------------------------------------
  console.log('TEST 7: Order without add-ons -> Existing order remains compatible');
  const legacyOrder = {
    id: 'ord_legacy_001',
    cf_order_id: 'cf_ord_legacy_001',
    amount_paise: 19900,
    status: 'PAID',
    items: [
      {
        bookId: 'legacy-ielts-guide',
        title: 'Legacy IELTS Guide',
        format: 'digital',
        quantity: 1,
        unitPrice: 199,
        totalPrice: 199,
      },
    ],
  };
  const savedLegacyOrder = await saveOrder(mockEnv, legacyOrder);
  const fetchedLegacyOrder = await getOrder(mockEnv, 'ord_legacy_001');
  assert.ok(fetchedLegacyOrder);
  assert.strictEqual(fetchedLegacyOrder.id, 'ord_legacy_001');
  assert.strictEqual(fetchedLegacyOrder.amount_paise, 19900);
  assert.strictEqual(fetchedLegacyOrder.items.length, 1);
  assert.strictEqual(fetchedLegacyOrder.items[0].bookId, 'legacy-ielts-guide');
  console.log('  PASS: Legacy order without add-ons parsed and stored with 100% backward compatibility.\n');

  // -------------------------------------------------------------------------
  // TEST 8: Order with multiple add-ons
  // -------------------------------------------------------------------------
  console.log('TEST 8: Order with multiple add-ons -> All purchased components reconstructed');
  const multiAddonSnapshot = createOrderItemSnapshot(
    productMultiAddons,
    ['pte-mock-tests', 'pte-vocab-booster'],
    2, // quantity 2
    'digital'
  );
  // Base: 19900 + 9900 + 4900 = 34700 paise (₹347)
  // For qty 2 = 69400 paise (₹694)
  assert.strictEqual(multiAddonSnapshot.unitPricePaise, 34700);
  assert.strictEqual(multiAddonSnapshot.totalPricePaise, 69400);
  assert.strictEqual(multiAddonSnapshot.addOns.length, 2);
  assert.strictEqual(multiAddonSnapshot.addOns[0].addOnId, 'pte-mock-tests');
  assert.strictEqual(multiAddonSnapshot.addOns[1].addOnId, 'pte-vocab-booster');

  const multiOrder = {
    id: 'ord_multi_addons_002',
    amount_paise: 69400,
    status: 'PAID',
    items: [multiAddonSnapshot],
  };
  await saveOrder(mockEnv, multiOrder);
  const retrievedMultiOrder = await getOrder(mockEnv, 'ord_multi_addons_002');
  assert.strictEqual(retrievedMultiOrder.items[0].addOns.length, 2);
  assert.strictEqual(retrievedMultiOrder.items[0].addOns[0].nameSnapshot, 'PTE 15 Mock Tests');
  assert.strictEqual(retrievedMultiOrder.items[0].addOns[1].nameSnapshot, 'PTE Academic Vocabulary Booster');
  console.log('  PASS: Multi-add-on order serialized to D1/KV and completely reconstructed.\n');

  // -------------------------------------------------------------------------
  // TEST 9: Entitlements for paid order
  // -------------------------------------------------------------------------
  console.log('TEST 9: Entitlements for paid order -> Main product entitlement created');
  const paidSingleOrder = {
    id: 'ord_paid_single_003',
    status: 'PAID',
    items: [
      {
        productId: 'ielts-core-guide',
        bookId: 'ielts-core-guide',
        title: 'IELTS Core Guide 2026',
        format: 'digital',
        quantity: 1,
      },
    ],
  };
  const singleEntitlements = await createEntitlementsForPaidOrder(mockEnv, paidSingleOrder);
  assert.strictEqual(singleEntitlements.length, 1);
  assert.strictEqual(singleEntitlements[0].orderId, 'ord_paid_single_003');
  assert.strictEqual(singleEntitlements[0].productId, 'ielts-core-guide');
  assert.strictEqual(singleEntitlements[0].addOnId, null);
  assert.strictEqual(singleEntitlements[0].status, 'ACTIVE');
  console.log('  PASS: Main product digital entitlement granted for verified paid order.\n');

  // -------------------------------------------------------------------------
  // TEST 10: Paid order with two add-ons
  // -------------------------------------------------------------------------
  console.log('TEST 10: Paid order with two add-ons -> Exactly 3 entitlements (main + 2 add-ons)');
  const paidWithAddonsOrder = {
    id: 'ord_paid_three_entitlements_004',
    status: 'PAID',
    items: [
      {
        productId: 'oet-complete-package',
        productNameSnapshot: 'OET Complete Package',
        format: 'digital',
        addOns: [
          { addOnId: 'mock-test-vol1', nameSnapshot: 'Mock Tests Vol 1', deliveryOption: 'digital' },
          { addOnId: 'vocab-flashcards', nameSnapshot: 'Vocab Flashcards', deliveryOption: 'digital' },
        ],
      },
    ],
  };
  const threeEntitlements = await createEntitlementsForPaidOrder(mockEnv, paidWithAddonsOrder);
  assert.strictEqual(threeEntitlements.length, 3, 'Must create exactly 3 entitlements');
  
  const mainEnt = threeEntitlements.find((e) => e.addOnId === null);
  const mockEnt = threeEntitlements.find((e) => e.addOnId === 'mock-test-vol1');
  const vocabEnt = threeEntitlements.find((e) => e.addOnId === 'vocab-flashcards');

  assert.ok(mainEnt, 'Main product entitlement must exist');
  assert.ok(mockEnt, 'Mock tests add-on entitlement must exist');
  assert.ok(vocabEnt, 'Vocab flashcards add-on entitlement must exist');

  assert.strictEqual(mainEnt.title, 'OET Complete Package');
  assert.strictEqual(mockEnt.title, 'OET Complete Package — Mock Tests Vol 1');
  assert.strictEqual(vocabEnt.title, 'OET Complete Package — Vocab Flashcards');
  console.log('  PASS: Verified 3 distinct entitlements created (1 main + 2 add-ons).\n');

  // -------------------------------------------------------------------------
  // TEST 11: Entitlement creation called twice
  // -------------------------------------------------------------------------
  console.log('TEST 11: Entitlement creation called twice -> IDEMPOTENT (no duplicates)');
  const run1 = await createEntitlementsForPaidOrder(mockEnv, paidWithAddonsOrder);
  const run2 = await createEntitlementsForPaidOrder(mockEnv, paidWithAddonsOrder);
  assert.strictEqual(run1.length, 3);
  assert.strictEqual(run2.length, 3);

  const storedEntitlements = await getEntitlementsByOrderId(mockEnv, 'ord_paid_three_entitlements_004');
  assert.strictEqual(storedEntitlements.length, 3, 'Stored entitlements count must stay strictly 3 (no duplicates)');
  console.log('  PASS: Idempotency confirmed. Calling createEntitlementsForPaidOrder twice produces 0 duplicate records.\n');

  // -------------------------------------------------------------------------
  // TEST 12: Unpaid order
  // -------------------------------------------------------------------------
  console.log('TEST 12: Unpaid order -> Zero entitlements created');
  const unpaidOrder = {
    id: 'ord_unpaid_test_005',
    status: 'PENDING', // Unpaid
    items: [
      {
        productId: 'ielts-unpaid-guide',
        format: 'digital',
        addOns: [{ addOnId: 'mock-addon', deliveryOption: 'digital' }],
      },
    ],
  };
  const unpaidEntitlements = await createEntitlementsForPaidOrder(mockEnv, unpaidOrder);
  assert.strictEqual(unpaidEntitlements.length, 0, 'Unpaid order must yield 0 entitlements');

  const storedUnpaid = await getEntitlementsByOrderId(mockEnv, 'ord_unpaid_test_005');
  assert.strictEqual(storedUnpaid.length, 0, 'No entitlements should exist in database for unpaid order');
  console.log('  PASS: Unpaid order correctly denied all digital entitlements.\n');

  console.log('==================================================');
  console.log('ALL 12 PHASE 1 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
}

runPhase1Tests().catch((err) => {
  console.error('Phase 1 test failed:', err);
  process.exit(1);
});
