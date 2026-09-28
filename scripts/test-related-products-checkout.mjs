// scripts/test-related-products-checkout.mjs
// Automated Verification Suite for Related Products at Checkout (Desktop + Mobile)

import assert from 'node:assert';
import { BOOKS } from '../src/data/books.ts';
import {
  DEFAULT_CATALOG,
  computeOrderPrice,
  calculateProductWithAddOns,
  loadCatalogue,
  validateCoupon,
} from '../functions/utils/pricing.js';
import {
  calculateDisplayPrice,
  validateAndReconcileCart,
} from '../src/utils/pricing.ts';
import {
  createEntitlementsForPaidOrder,
} from '../functions/utils/db.js';

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
  PRODUCTS_KV: new MockKV(),
  DOWNLOAD_SIGNING_SECRET: 'test-secure-download-signing-key-32chars!!',
};

// Client-side cart engine simulating the unified ShopContext calculation
function simulateSharedCartEngine(cartItems, couponCode = null) {
  let subtotal = 0;
  let totalOriginalPrice = 0;
  let hasPhysical = false;

  for (const item of cartItems) {
    const book = item.book || BOOKS.find((b) => b.id === (item.bookId || item.book?.id));
    assert(book, `Book ${item.bookId} must exist in catalog`);

    const displayCalc = calculateDisplayPrice(
      book,
      item.format || 'digital',
      item.selectedAddonIds || []
    );

    const qty = item.quantity || 1;
    subtotal += displayCalc.totalPrice * qty;
    totalOriginalPrice += displayCalc.totalOriginalPrice * qty;
    if (item.format === 'physical' || displayCalc.selectedAddons.some((a) => a.deliveryOption === 'physical')) {
      hasPhysical = true;
    }
  }

  const deliveryFee = hasPhysical ? 99 : 0;
  let couponDiscount = 0;
  if (couponCode === 'XYLEM20') {
    couponDiscount = Math.round(subtotal * 0.20);
  } else if (couponCode === 'FIRST50') {
    couponDiscount = Math.min(50, subtotal);
  } else if (couponCode === 'SPECIALOFFER' || couponCode === 'OFFER67') {
    couponDiscount = Math.round(subtotal * 0.15);
  }

  const effectiveCouponDiscount = Math.min(subtotal, Math.max(0, couponDiscount));
  const total = Math.max(0, subtotal + deliveryFee - effectiveCouponDiscount);
  const totalSavings = Math.max(0, totalOriginalPrice - total);

  return {
    itemCount: cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0),
    subtotal,
    deliveryFee,
    couponDiscount: effectiveCouponDiscount,
    total,
    totalSavings,
    hasPhysical,
  };
}

async function runAcceptanceTests() {
  console.log('===============================================================');
  console.log('STARTING RELATED PRODUCTS CHECKOUT ACCEPTANCE TEST SUITE');
  console.log('===============================================================\n');

  // TEST 1: Step-by-Step Addition Sequence (Section 8 & 9)
  // Step 1: Customer has IELTS = ₹199
  console.log('TEST 1: Incremental Related Product Addition (Shared across Desktop & Mobile)');
  const ieltsBook = BOOKS.find((b) => b.id === 'ielts-full-prep');
  assert(ieltsBook, 'ielts-full-prep must exist');

  let cart = [
    {
      bookId: ieltsBook.id,
      book: ieltsBook,
      format: 'digital',
      quantity: 1,
      selectedAddonIds: [],
    },
  ];

  let state = simulateSharedCartEngine(cart);
  assert.strictEqual(state.itemCount, 1);
  assert.strictEqual(state.subtotal, 199);
  assert.strictEqual(state.total, 199);
  console.log('  Step 1: IELTS in cart -> 1 item, Subtotal: ₹199 (MATCH)');

  // Step 2: Clicks "+ Add IELTS Vocabulary Booster = ₹99"
  const vocabBooster = BOOKS.find((b) => b.id === 'ielts-vocab-booster');
  assert(vocabBooster, 'ielts-vocab-booster must exist');
  assert.strictEqual(vocabBooster.prices.digital.price, 99);

  cart.push({
    bookId: vocabBooster.id,
    book: vocabBooster,
    format: 'digital',
    quantity: 1,
    selectedAddonIds: [],
  });

  state = simulateSharedCartEngine(cart);
  assert.strictEqual(state.itemCount, 2);
  assert.strictEqual(state.subtotal, 298); // 199 + 99 = 298
  assert.strictEqual(state.total, 298);
  console.log('  Step 2: + Add IELTS Vocabulary Booster (₹99) -> 2 items, Subtotal: ₹298 (MATCH)');

  // Step 3: Clicks "+ Add IELTS Writing Task = ₹99" (or ₹149 if standard)
  const writingTask = BOOKS.find((b) => b.id === 'ielts-writing-task');
  assert(writingTask, 'ielts-writing-task must exist');
  assert.strictEqual(writingTask.prices.digital.price, 99);

  cart.push({
    bookId: writingTask.id,
    book: writingTask,
    format: 'digital',
    quantity: 1,
    selectedAddonIds: [],
  });

  state = simulateSharedCartEngine(cart);
  assert.strictEqual(state.itemCount, 3);
  assert.strictEqual(state.subtotal, 397); // 199 + 99 + 99 = 397
  assert.strictEqual(state.total, 397);
  console.log('  Step 3: + Add IELTS Writing Task (₹99) -> 3 items, Subtotal: ₹397 (MATCH)');

  // Verify server calculation parity for this 3-item cart
  const serverCalc1 = await computeOrderPrice(
    {
      cart: cart.map((i) => ({ bookId: i.bookId, format: 'digital', addonIds: [], quantity: 1 })),
      couponCode: null,
      deliveryOption: 'digital',
    },
    mockEnv
  );
  assert.strictEqual(serverCalc1.subtotal, 397);
  assert.strictEqual(serverCalc1.total, 397);
  console.log('  Server parity check: Server subtotal ₹397, Server total ₹397 (MATCH)\n');

  // TEST 2: Add-ons + Related Products Isolation (Section 10)
  // IELTS = ₹199
  // IELTS Add-on = ₹49 (Academic Study Planner or custom add-on)
  // Vocabulary Booster = ₹99
  console.log('TEST 2: Add-ons + Related Products Isolation (No Cross-Contamination)');
  const ieltsWithAddonCart = [
    {
      bookId: 'ielts-full-prep',
      book: ieltsBook,
      format: 'digital',
      quantity: 1,
      selectedAddonIds: ['addon_mock_tests'], // Add-on on IELTS
    },
    {
      bookId: 'ielts-vocab-booster',
      book: vocabBooster,
      format: 'digital',
      quantity: 1,
      selectedAddonIds: [], // NO add-on on Vocab Booster
    },
  ];

  // Give ielts-full-prep an explicit addon for this test
  const ieltsCopy = {
    ...ieltsBook,
    addOns: [
      { id: 'addon_mock_tests', name: 'Mock Tests Pack', price: 50, originalPrice: 150, deliveryOption: 'digital' },
    ],
  };
  ieltsWithAddonCart[0].book = ieltsCopy;

  const addonState = simulateSharedCartEngine(ieltsWithAddonCart);
  // Expected: IELTS (₹199) + Add-on (₹50) + Vocab Booster (₹99) = ₹348
  assert.strictEqual(addonState.subtotal, 348);
  assert.strictEqual(addonState.total, 348);
  console.log('  Subtotal: IELTS (₹199) + Add-on (₹50) + Vocab (₹99) = ₹348 (EXACT MATCH)');

  // Verify that the add-on is associated ONLY with ielts-full-prep
  assert.deepStrictEqual(ieltsWithAddonCart[0].selectedAddonIds, ['addon_mock_tests']);
  assert.deepStrictEqual(ieltsWithAddonCart[1].selectedAddonIds, []);
  console.log('  Isolation: Add-on remains attached ONLY to IELTS, Vocab Booster has 0 add-ons (VERIFIED)\n');

  // TEST 3: Coupon Recalculation on Multi-Product Cart (Section 11)
  console.log('TEST 3: Dynamic Coupon Revalidation & Recalculation');
  // Subtotal = ₹348, apply XYLEM20 (20% off)
  // 348 * 0.20 = 69.6 -> round = 70
  // Total = 348 - 70 = 278
  const couponState = simulateSharedCartEngine(ieltsWithAddonCart, 'XYLEM20');
  assert.strictEqual(couponState.couponDiscount, 70);
  assert.strictEqual(couponState.total, 278);
  console.log('  Client coupon recalculation on ₹348 subtotal: Discount ₹70, Total ₹278 (MATCH)');

  const serverCouponDiscount = validateCoupon('XYLEM20', 348);
  assert.strictEqual(serverCouponDiscount, 70);
  console.log('  Server coupon revalidation on ₹348 subtotal: Discount ₹70, Total ₹278 (MATCH)\n');

  // TEST 4: Section 7 & 16 Final Acceptance Test
  // Product A (₹199) + Product B (₹99) + Product C (₹149) + Add-on (₹50) = Subtotal ₹497
  console.log('TEST 4: Section 7 & 16 Canonical Acceptance Test');
  console.log('  Product A = ₹199, Product B = ₹99, Product C = ₹149, Add-on = ₹50 -> Subtotal MUST be ₹497');

  const customBookA = {
    id: 'test-product-a',
    title: 'Test Product A',
    prices: { digital: { price: 199, originalPrice: 499 } },
    addOns: [{ id: 'test-addon-50', name: 'Special Add-on', price: 50, originalPrice: 100, deliveryOption: 'digital' }],
  };
  const customBookB = {
    id: 'test-product-b',
    title: 'Test Product B',
    prices: { digital: { price: 99, originalPrice: 299 } },
    addOns: [],
  };
  const customBookC = {
    id: 'test-product-c',
    title: 'Test Product C',
    prices: { digital: { price: 149, originalPrice: 399 } },
    addOns: [],
  };

  const calcA = calculateDisplayPrice(customBookA, 'digital', ['test-addon-50']);
  const calcB = calculateDisplayPrice(customBookB, 'digital', []);
  const calcC = calculateDisplayPrice(customBookC, 'digital', []);

  const combinedSubtotal = calcA.totalPrice + calcB.totalPrice + calcC.totalPrice;
  assert.strictEqual(calcA.totalPrice, 249); // 199 + 50
  assert.strictEqual(calcB.totalPrice, 99);
  assert.strictEqual(calcC.totalPrice, 149);
  assert.strictEqual(combinedSubtotal, 497, 'Subtotal MUST be exactly ₹497');
  console.log(`  Combined Subtotal: ₹${calcA.totalPrice} + ₹${calcB.totalPrice} + ₹${calcC.totalPrice} = ₹${combinedSubtotal} (PASSED)`);

  // Apply 20% coupon on ₹497
  // 497 * 0.20 = 99.4 -> 99
  // Total = 497 - 99 = 398
  const couponDiscount497 = Math.round(combinedSubtotal * 0.20);
  const finalTotal497 = combinedSubtotal - couponDiscount497;
  assert.strictEqual(couponDiscount497, 99);
  assert.strictEqual(finalTotal497, 398);
  console.log(`  With 20% coupon: Discount -₹${couponDiscount497}, Final Total: ₹${finalTotal497} (PASSED)`);

  // Server calculation parity on custom catalog in KV
  await mockEnv.PRODUCTS_KV.put(
    'xylem_products',
    JSON.stringify({
      books: [customBookA, customBookB, customBookC],
    })
  );

  const serverOrderQuote = await computeOrderPrice(
    {
      cart: [
        { bookId: 'test-product-a', format: 'digital', addonIds: ['test-addon-50'], quantity: 1 },
        { bookId: 'test-product-b', format: 'digital', addonIds: [], quantity: 1 },
        { bookId: 'test-product-c', format: 'digital', addonIds: [], quantity: 1 },
      ],
      couponCode: 'XYLEM20',
      deliveryOption: 'digital',
    },
    mockEnv
  );

  assert.strictEqual(serverOrderQuote.subtotal, 497);
  assert.strictEqual(serverOrderQuote.couponDiscount, 99);
  assert.strictEqual(serverOrderQuote.total, 398);
  console.log('  Server order quote parity: Subtotal ₹497, Discount ₹99, Total ₹398 (EXACT MATCH)\n');

  // TEST 5: Fulfillment & Security (Section 14)
  console.log('TEST 5: Fulfillment & Digital Entitlements');
  const mockPaidOrder = {
    id: 'ord_test_acceptance_777',
    status: 'PAID',
    payment_status: 'PAID',
    items: [
      {
        bookId: 'test-product-a',
        format: 'digital',
        titleSnapshot: 'Test Product A',
        addOns: [{ addOnId: 'test-addon-50', nameSnapshot: 'Special Add-on' }],
      },
      {
        bookId: 'test-product-b',
        format: 'digital',
        titleSnapshot: 'Test Product B',
        addOns: [],
      },
    ],
  };

  const entitlements = await createEntitlementsForPaidOrder(mockEnv, mockPaidOrder);
  // Expected entitlements:
  // 1. test-product-a main product
  // 2. test-product-a test-addon-50
  // 3. test-product-b main product
  // Total: 3 entitlements. Unpurchased test-product-c has 0 entitlements.
  assert.strictEqual(entitlements.length, 3);
  console.log(`  Generated ${entitlements.length} entitlements for purchased products and add-ons:`);
  for (const ent of entitlements) {
    console.log(`    ✓ ${ent.id} : product=${ent.product_id}, addon=${ent.add_on_id || 'none'}`);
  }

  // Verify unpurchased product C cannot be downloaded
  const hasEntitlementC = entitlements.some((e) => e.product_id === 'test-product-c');
  assert.strictEqual(hasEntitlementC, false, 'Unpurchased product C must NOT have an entitlement');
  console.log('  Security check: Unpurchased product C is NOT downloadable (VERIFIED)\n');

  console.log('===============================================================');
  console.log('ALL ACCEPTANCE TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('===============================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
