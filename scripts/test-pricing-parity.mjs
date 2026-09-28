// scripts/test-pricing-parity.mjs
// Automated verification suite for Pricing Parity between Client & Server

import assert from 'node:assert';
import { BOOKS } from '../src/data/books.ts';
import { DEFAULT_CATALOG, computeOrderPrice, getBookAddons, calculateAddonsPricing, validateCoupon } from '../functions/utils/pricing.js';
import { getBookAddons as clientGetBookAddons, calculateAddonsPricing as clientCalculateAddonsPricing } from '../src/utils/pricing.ts';

// Mock KV environment
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
};

function computeClientOrderPrice({ cart, couponCode }) {
  let subtotal = 0;
  let hasPhysical = false;

  for (const item of cart) {
    const book = BOOKS.find((b) => b.id === item.bookId) || {
      id: item.bookId,
      prices: { digital: { price: 499 }, physical: { price: 899 } },
    };
    const addons = clientGetBookAddons(book);
    const selectedIds = item.addonIds || [item.format || 'digital'];
    const pricing = clientCalculateAddonsPricing(addons, selectedIds, Boolean(book.buy2Get3rdFree));
    const qty = item.quantity || 1;
    subtotal += pricing.finalPrice * qty;
    if (pricing.hasPhysical || item.format === 'physical') {
      hasPhysical = true;
    }
  }

  const deliveryFee = hasPhysical ? 99 : 0;
  let couponDiscount = 0;
  if (couponCode === 'XYLEM20') couponDiscount = Math.round(subtotal * 0.2);
  else if (couponCode === 'FIRST50') couponDiscount = Math.min(50, subtotal);
  else if (couponCode === 'SPECIALOFFER' || couponCode === 'OFFER67') couponDiscount = Math.round(subtotal * 0.15);

  const total = Math.max(1, subtotal + deliveryFee - couponDiscount);
  return { subtotal, deliveryFee, couponDiscount, total, hasPhysical };
}

async function runParityTests() {
  console.log('=== STARTING PRICING PARITY VERIFICATION SUITE ===\n');

  // TEST 1: All Books exist in DEFAULT_CATALOG with identical prices
  console.log(`Test 1: Catalog Integrity & Price Matching across all ${BOOKS.length} books`);
  assert.strictEqual(BOOKS.length, DEFAULT_CATALOG.length, `Expected BOOKS.length (${BOOKS.length}) to match DEFAULT_CATALOG.length (${DEFAULT_CATALOG.length})`);

  for (const book of BOOKS) {
    const serverBook = DEFAULT_CATALOG.find((b) => b.id === book.id);
    assert(serverBook, `Book "${book.id}" must exist in DEFAULT_CATALOG`);

    assert.strictEqual(
      serverBook.prices.digital.price,
      book.prices.digital.price,
      `Digital price mismatch for "${book.id}": server=${serverBook.prices.digital.price}, client=${book.prices.digital.price}`
    );
    assert.strictEqual(
      serverBook.prices.physical.price,
      book.prices.physical.price,
      `Physical price mismatch for "${book.id}": server=${serverBook.prices.physical.price}, client=${book.prices.physical.price}`
    );
    console.log(`  ✓ ${book.id.padEnd(25)} : Digital ₹${book.prices.digital.price}, Physical ₹${book.prices.physical.price} (MATCH)`);
  }
  console.log('  PASS: All 11 books match exactly between client books.ts and server DEFAULT_CATALOG\n');

  // TEST 2: Single Product Orders - Digital & Physical for EVERY book
  console.log('Test 2: Single Product Orders (Digital & Physical) for every book');
  for (const book of BOOKS) {
    // 2a. Digital order
    const clientDigital = computeClientOrderPrice({
      cart: [{ bookId: book.id, format: 'digital', addonIds: ['digital'], quantity: 1 }],
      couponCode: null,
    });
    const serverDigital = await computeOrderPrice(
      {
        cart: [{ bookId: book.id, format: 'digital', addonIds: ['digital'], quantity: 1 }],
        couponCode: null,
        deliveryOption: 'digital',
      },
      mockEnv
    );
    assert.strictEqual(
      serverDigital.total,
      clientDigital.total,
      `Digital order total mismatch for ${book.id}: server=${serverDigital.total}, client=${clientDigital.total}`
    );
    assert.strictEqual(serverDigital.total, book.prices.digital.price);

    // 2b. Physical order (includes ₹99 delivery fee)
    const clientPhysical = computeClientOrderPrice({
      cart: [{ bookId: book.id, format: 'physical', addonIds: ['physical'], quantity: 1 }],
      couponCode: null,
    });
    const serverPhysical = await computeOrderPrice(
      {
        cart: [{ bookId: book.id, format: 'physical', addonIds: ['physical'], quantity: 1 }],
        couponCode: null,
        deliveryOption: 'physical',
      },
      mockEnv
    );
    assert.strictEqual(
      serverPhysical.total,
      clientPhysical.total,
      `Physical order total mismatch for ${book.id}: server=${serverPhysical.total}, client=${clientPhysical.total}`
    );
    assert.strictEqual(serverPhysical.total, book.prices.physical.price + 99);
  }
  console.log('  PASS: All 22 single-product checkout variations (11 digital + 11 physical) match exactly to the rupee\n');

  // TEST 3: Multi-quantity and Multi-item Cart Checkout
  console.log('Test 3: Multi-Item and Multi-Quantity Cart Checkout');
  const multiCart = [
    { bookId: 'ielts-complete-guide', format: 'digital', addonIds: ['digital'], quantity: 2 },
    { bookId: 'oet-full-prep', format: 'physical', addonIds: ['physical'], quantity: 1 },
    { bookId: 'academic-study-planner', format: 'digital', addonIds: ['digital'], quantity: 3 },
  ];

  const clientMulti = computeClientOrderPrice({ cart: multiCart, couponCode: null });
  const serverMulti = await computeOrderPrice(
    { cart: multiCart, couponCode: null, deliveryOption: 'physical' },
    mockEnv
  );

  // Expected subtotal: (499 * 2) + (1199 * 1) + (49 * 3) = 998 + 1199 + 147 = 2344
  // Delivery: 99
  // Total: 2443
  assert.strictEqual(serverMulti.subtotal, 2344);
  assert.strictEqual(clientMulti.subtotal, 2344);
  assert.strictEqual(serverMulti.total, 2443);
  assert.strictEqual(clientMulti.total, 2443);
  console.log(`  PASS: Multi-item cart: Subtotal ₹${serverMulti.subtotal}, Delivery ₹${serverMulti.deliveryFee}, Total ₹${serverMulti.total} (MATCH)\n`);

  // TEST 4: Coupons Parity (XYLEM20, FIRST50, OFFER67)
  console.log('Test 4: Discount & Coupon Parity');
  const testCoupons = ['XYLEM20', 'FIRST50', 'OFFER67', 'SPECIALOFFER'];
  for (const coupon of testCoupons) {
    const cOrder = computeClientOrderPrice({ cart: multiCart, couponCode: coupon });
    const sOrder = await computeOrderPrice(
      { cart: multiCart, couponCode: coupon, deliveryOption: 'physical' },
      mockEnv
    );
    assert.strictEqual(
      sOrder.couponDiscount,
      cOrder.couponDiscount,
      `Coupon discount mismatch for ${coupon}: server=${sOrder.couponDiscount}, client=${cOrder.couponDiscount}`
    );
    assert.strictEqual(
      sOrder.total,
      cOrder.total,
      `Total with coupon mismatch for ${coupon}: server=${sOrder.total}, client=${cOrder.total}`
    );
    console.log(`  ✓ Coupon ${coupon.padEnd(14)}: Discount ₹${sOrder.couponDiscount}, Final Total ₹${sOrder.total} (MATCH)`);
  }
  console.log('  PASS: All coupon discounts produce identical totals on client and server\n');

  // TEST 5: Buy 2 Get 3rd Free Promotion
  console.log('Test 5: "Buy 2 Get 3rd Free" Add-on Pricing Parity');
  const sampleAddons = [
    { id: 'digital', name: 'Digital PDF', price: 499, deliveryOption: 'digital' },
    { id: 'audio', name: 'Audio Drills', price: 299, deliveryOption: 'digital' },
    { id: 'physical', name: 'Printed Book', price: 899, deliveryOption: 'physical' },
  ];
  const clientDeal = clientCalculateAddonsPricing(sampleAddons, ['digital', 'audio', 'physical'], true);
  const serverDeal = calculateAddonsPricing(sampleAddons, ['digital', 'audio', 'physical'], true);

  // Lowest price item (Audio Drills ₹299) should be free
  assert.strictEqual(clientDeal.freeDiscount, 299);
  assert.strictEqual(serverDeal.freeDiscount, 299);
  assert.strictEqual(clientDeal.finalPrice, (499 + 299 + 899) - 299);
  assert.strictEqual(serverDeal.finalPrice, 1398);
  console.log(`  PASS: Buy 2 Get 3rd Free: Lowest item (₹${serverDeal.freeDiscount}) is free, Final Price ₹${serverDeal.finalPrice} (MATCH)\n`);

  // TEST 6: Legacy Add-on ID Normalization ('addon_digital', 'addon_physical')
  console.log('Test 6: Legacy Add-on ID Normalization');
  const legacyCart = [
    { bookId: 'ielts-complete-guide', addonIds: ['addon_digital'], format: 'digital', quantity: 1 },
  ];
  const serverLegacy = await computeOrderPrice(
    { cart: legacyCart, deliveryOption: 'digital' },
    mockEnv
  );
  assert.strictEqual(serverLegacy.total, 499, 'Legacy ID addon_digital must resolve to digital price 499');
  console.log(`  PASS: Legacy ID 'addon_digital' correctly resolved to ₹${serverLegacy.total}\n`);

  console.log('==================================================');
  console.log('ALL PRICING PARITY TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('==================================================');
}

runParityTests().catch((err) => {
  console.error('\n❌ PRICING PARITY TEST FAILED:', err);
  process.exit(1);
});
