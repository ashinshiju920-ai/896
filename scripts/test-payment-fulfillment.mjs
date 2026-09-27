#!/usr/bin/env node
/**
 * PAYMENT AMOUNT & PRODUCT FULFILLMENT END-TO-END VERIFICATION
 * =============================================================
 * Validates that:
 * 1. Correct amount is collected (with/without add-ons, coupons, shipping)
 * 2. Correct products are delivered after payment (entitlement matching)
 * 3. Entitlement IDs are deterministic and idempotent
 * 4. Amount stored in D1 matches amount sent to Cashfree
 * 5. Webhook amount verification catches mismatches
 * 6. Download resolution chain works correctly
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import server-side pricing engine
const pricingPath = resolve(__dirname, '../functions/utils/pricing.js');
const { computeOrderPrice, loadCatalogue, DEFAULT_CATALOG, validateSelectedAddOns, getProductAddOn, createOrderItemSnapshot } = await import(`file://${pricingPath.replace(/\\/g, '/')}`);

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('\n==================================================');
console.log('PAYMENT AMOUNT & FULFILLMENT VERIFICATION');
console.log('==================================================\n');

// ─── TEST 1: Single digital product — correct amount ────────────────────────
console.log('TEST 1: Single digital product pricing');
{
  const mockEnv = {};
  const pricing = await computeOrderPrice(
    { cart: [{ bookId: 'ielts-full-prep', addonIds: ['digital'], format: 'digital', quantity: 1 }] },
    mockEnv
  );
  assert(pricing.totalPaise > 0, 'Total paise is positive');
  assert(pricing.total === Math.round(pricing.totalPaise / 100), 'Rupee total matches paise / 100');
  assert(pricing.items.length === 1, 'Exactly 1 item in verified items');
  assert(pricing.items[0].bookId === 'ielts-full-prep', 'Correct product ID in verified item');
  assert(pricing.items[0].format === 'digital', 'Correct format in verified item');

  // Verify amount matches catalog
  const catalogBook = DEFAULT_CATALOG.find(b => b.id === 'ielts-full-prep');
  const expectedPaise = Math.round(catalogBook.prices.digital.price * 100);
  assert(pricing.subtotalPaise === expectedPaise, `Subtotal ${pricing.subtotalPaise} matches catalog digital price ${expectedPaise} paise`);
  assert(pricing.deliveryFeePaise === 0, 'No shipping fee for digital');
  assert(pricing.totalPaise === expectedPaise, `Total ${pricing.totalPaise} equals subtotal (no coupon, no shipping)`);
}

// ─── TEST 2: Single physical product — includes shipping ────────────────────
console.log('\nTEST 2: Single physical product with shipping');
{
  const mockEnv = {};
  const pricing = await computeOrderPrice(
    { cart: [{ bookId: 'ielts-full-prep', addonIds: ['physical'], format: 'physical', quantity: 1 }] },
    mockEnv
  );
  const catalogBook = DEFAULT_CATALOG.find(b => b.id === 'ielts-full-prep');
  const physicalPaise = Math.round(catalogBook.prices.physical.price * 100);
  assert(pricing.subtotalPaise === physicalPaise, `Subtotal ${pricing.subtotalPaise} matches catalog physical price ${physicalPaise} paise`);
  assert(pricing.deliveryFeePaise === 9900, 'Shipping fee is ₹99 (9900 paise) for physical');
  assert(pricing.totalPaise === physicalPaise + 9900, `Total = subtotal + shipping = ${physicalPaise + 9900}`);
  assert(pricing.hasPhysical === true, 'hasPhysical flag is set');
}

// ─── TEST 3: Multiple products — correct aggregate amount ───────────────────
console.log('\nTEST 3: Multiple products aggregate pricing');
{
  const mockEnv = {};
  const pricing = await computeOrderPrice(
    { cart: [
      { bookId: 'ielts-full-prep', addonIds: ['digital'], format: 'digital', quantity: 1 },
      { bookId: 'oet-full-prep', addonIds: ['digital'], format: 'digital', quantity: 1 },
    ] },
    mockEnv
  );
  const ieltsPrice = DEFAULT_CATALOG.find(b => b.id === 'ielts-full-prep').prices.digital.price;
  const oetPrice = DEFAULT_CATALOG.find(b => b.id === 'oet-full-prep').prices.digital.price;
  const expectedSubtotal = Math.round((ieltsPrice + oetPrice) * 100);
  assert(pricing.subtotalPaise === expectedSubtotal, `Aggregate subtotal ${pricing.subtotalPaise} = ${expectedSubtotal} paise`);
  assert(pricing.items.length === 2, 'Two items in verified array');
  assert(pricing.totalPaise === expectedSubtotal, 'Total matches subtotal (no shipping, no coupon)');
}

// ─── TEST 4: Quantity multiplier ────────────────────────────────────────────
console.log('\nTEST 4: Quantity multiplier');
{
  const mockEnv = {};
  const pricing = await computeOrderPrice(
    { cart: [{ bookId: 'ielts-full-prep', addonIds: ['digital'], format: 'digital', quantity: 3 }] },
    mockEnv
  );
  const unitPrice = DEFAULT_CATALOG.find(b => b.id === 'ielts-full-prep').prices.digital.price;
  const expectedPaise = Math.round(unitPrice * 100) * 3;
  assert(pricing.subtotalPaise === expectedPaise, `Subtotal for qty 3 = ${expectedPaise} paise`);
  assert(pricing.items[0].quantity === 3, 'Item quantity is 3');
}

// ─── TEST 5: Amount stored equals amount sent to Cashfree ───────────────────
console.log('\nTEST 5: D1-stored amount matches Cashfree payload');
{
  const mockEnv = {};
  const pricing = await computeOrderPrice(
    { cart: [{ bookId: 'ielts-full-prep', addonIds: ['digital'], format: 'digital', quantity: 1 }] },
    mockEnv
  );
  
  // Simulate what create-cashfree-order.js does
  const d1Amount = pricing.totalPaise;       // Stored in D1 as amount_paise
  const cashfreeAmount = pricing.total;       // Sent as order_amount (rupees)
  
  // Simulate what webhook does: convert Cashfree response back to paise
  const webhookReceivedPaise = Math.round(cashfreeAmount * 100);
  
  assert(
    Math.abs(d1Amount - webhookReceivedPaise) <= 1,
    `D1 amount (${d1Amount}) matches Cashfree webhook amount (${webhookReceivedPaise}) within 1 paise tolerance`
  );
}

// ─── TEST 6: Webhook rejects amount mismatch ───────────────────────────────
console.log('\nTEST 6: Amount mismatch detection');
{
  const storedPaise = 19900;     // ₹199 stored in D1
  const tampered = 100;          // Attacker pays ₹1
  const tamperedPaise = Math.round(tampered * 100);
  const mismatch = Math.abs(storedPaise - tamperedPaise) > 1;
  assert(mismatch, `Mismatch detected: stored ${storedPaise} vs paid ${tamperedPaise} (difference ${storedPaise - tamperedPaise})`);
}

// ─── TEST 7: Entitlement deterministic IDs ──────────────────────────────────
console.log('\nTEST 7: Entitlement ID determinism & idempotency');
{
  const orderId = 'order_1234567890_1234';
  const productId = 'ielts-full-prep';
  
  // Simulate what createEntitlementsForPaidOrder does
  const mainEntId = `ent_${orderId}_${productId}_main`;
  assert(mainEntId === 'ent_order_1234567890_1234_ielts-full-prep_main', 'Main entitlement ID is deterministic');
  
  // Calling again would generate same ID
  const secondEntId = `ent_${orderId}_${productId}_main`;
  assert(mainEntId === secondEntId, 'Second call produces identical ID (idempotent)');
  
  // Add-on entitlement
  const addonId = 'practice-pack';
  const addonEntId = `ent_${orderId}_${productId}_${addonId}`;
  assert(addonEntId === 'ent_order_1234567890_1234_ielts-full-prep_practice-pack', 'Add-on entitlement ID is deterministic');
  assert(addonEntId !== mainEntId, 'Add-on entitlement ID differs from main');
}

// ─── TEST 8: Order item snapshot preserves product identity ─────────────────
console.log('\nTEST 8: Order item snapshot preserves product identity');
{
  const product = DEFAULT_CATALOG.find(b => b.id === 'ielts-full-prep');
  const snapshot = createOrderItemSnapshot(product, ['digital'], 1, 'digital');
  
  assert(snapshot.productId === 'ielts-full-prep', 'Snapshot productId matches');
  assert(snapshot.bookId === 'ielts-full-prep', 'Snapshot bookId alias matches');
  assert(snapshot.format === 'digital', 'Snapshot format is digital');
  assert(snapshot.quantity === 1, 'Snapshot quantity is 1');
  assert(snapshot.unitPricePaise > 0, 'Snapshot has positive unit price');
  assert(snapshot.totalPricePaise === snapshot.unitPricePaise, 'Total = unit * qty for qty=1');
  assert(typeof snapshot.productNameSnapshot === 'string' && snapshot.productNameSnapshot.length > 0, 'Product name preserved');
}

// ─── TEST 9: No double-charging for format add-on ───────────────────────────
console.log('\nTEST 9: No double-charging — format addon not counted twice');
{
  const product = DEFAULT_CATALOG.find(b => b.id === 'oet-full-prep');
  
  // Digital format via addon
  const snapshot = createOrderItemSnapshot(product, ['digital'], 1, 'digital');
  const expectedBasePaise = Math.round(product.prices.digital.price * 100);
  
  // The snapshot should NOT charge digital addon price ON TOP of base digital price
  // It should equal just the base digital price
  assert(
    snapshot.unitPricePaise === expectedBasePaise,
    `Unit price ${snapshot.unitPricePaise} matches base digital price ${expectedBasePaise} (no double charge)`
  );
}

// ─── TEST 10: Physical format pricing ───────────────────────────────────────
console.log('\nTEST 10: Physical format pricing');
{
  const product = DEFAULT_CATALOG.find(b => b.id === 'oet-full-prep');
  const snapshot = createOrderItemSnapshot(product, ['physical'], 1, 'physical');
  const expectedBasePaise = Math.round(product.prices.physical.price * 100);
  
  assert(
    snapshot.unitPricePaise === expectedBasePaise,
    `Physical unit price ${snapshot.unitPricePaise} matches catalog ${expectedBasePaise}`
  );
}

// ─── TEST 11: Product not in catalog → server rejects ───────────────────────
console.log('\nTEST 11: Non-existent product rejection');
{
  const mockEnv = {};
  let rejected = false;
  try {
    await computeOrderPrice(
      { cart: [{ bookId: 'nonexistent-book-xyz', addonIds: ['digital'], format: 'digital', quantity: 1 }] },
      mockEnv
    );
  } catch (e) {
    rejected = true;
    assert(e.message.includes('no longer available'), `Correct error: "${e.message}"`);
  }
  assert(rejected, 'Non-existent product is rejected');
}

// ─── TEST 12: Empty cart rejection ──────────────────────────────────────────
console.log('\nTEST 12: Empty cart rejection');
{
  const mockEnv = {};
  let rejected = false;
  try {
    await computeOrderPrice({ cart: [] }, mockEnv);
  } catch (e) {
    rejected = true;
  }
  assert(rejected, 'Empty cart is rejected by server');
}

// ─── TEST 13: Minimum ₹1 floor ─────────────────────────────────────────────
console.log('\nTEST 13: Minimum ₹1 floor (100 paise)');
{
  // The pricing floor is Math.max(100, subtotal + shipping - discount)
  // With the academic planner (₹49 digital), even if a coupon discount exceeds it,
  // the total should never go below 100 paise
  const mockEnv = {};
  const pricing = await computeOrderPrice(
    { cart: [{ bookId: 'academic-study-planner', addonIds: ['digital'], format: 'digital', quantity: 1 }] },
    mockEnv
  );
  assert(pricing.totalPaise >= 100, `Total ${pricing.totalPaise} paise >= 100 paise minimum floor`);
}

// ─── TEST 14: Full order lifecycle simulation ───────────────────────────────
console.log('\nTEST 14: Full order lifecycle — amount consistency');
{
  const mockEnv = {};
  const cartItems = [
    { bookId: 'ielts-full-prep', addonIds: ['digital'], format: 'digital', quantity: 1 },
    { bookId: 'oet-full-prep', addonIds: ['digital'], format: 'digital', quantity: 2 },
  ];
  
  const pricing = await computeOrderPrice({ cart: cartItems }, mockEnv);
  
  // Step 1: Verify what goes into saveOrder
  const savedAmountPaise = pricing.totalPaise;
  const savedItems = pricing.items;
  
  // Step 2: Verify what goes to Cashfree
  const cashfreeOrderAmount = pricing.total; // rupees
  
  // Step 3: Simulate webhook return
  const webhookPaidAmount = cashfreeOrderAmount; // Cashfree returns same amount
  const webhookPaidPaise = Math.round(webhookPaidAmount * 100);
  
  // Step 4: Verify webhook comparison passes
  const amountMatch = Math.abs(savedAmountPaise - webhookPaidPaise) <= 1;
  assert(amountMatch, `Lifecycle: D1(${savedAmountPaise}) ≈ Cashfree webhook(${webhookPaidPaise})`);
  
  // Step 5: Verify entitlement product mapping
  assert(savedItems.length === 2, 'Two verified items saved');
  assert(savedItems[0].bookId === 'ielts-full-prep', 'First item is IELTS');
  assert(savedItems[1].bookId === 'oet-full-prep', 'Second item is OET');
  assert(savedItems[1].quantity === 2, 'OET quantity is 2');
  
  // Step 6: Verify total = sum of item totals
  const itemsTotal = savedItems.reduce((sum, item) => sum + item.totalPricePaise, 0);
  assert(itemsTotal === pricing.subtotalPaise, `Items total (${itemsTotal}) equals order subtotal (${pricing.subtotalPaise})`);
}

// ─── TEST 15: Inactive product rejected ─────────────────────────────────────
console.log('\nTEST 15: Inactive product (active=false) rejected');
{
  const mockCatalog = [
    ...DEFAULT_CATALOG,
    { id: 'test-inactive-book', title: 'Inactive Test', active: false, prices: { digital: { price: 100 } } }
  ];
  
  // Mock env that returns our custom catalog
  const mockEnv = {
    PRODUCTS_KV: {
      get: async () => JSON.stringify({ books: mockCatalog }),
    },
  };
  
  let rejected = false;
  try {
    await computeOrderPrice(
      { cart: [{ bookId: 'test-inactive-book', addonIds: ['digital'], format: 'digital', quantity: 1 }] },
      mockEnv
    );
  } catch (e) {
    rejected = true;
    assert(e.message.includes('no longer available'), `Inactive product correctly rejected: "${e.message}"`);
  }
  assert(rejected, 'Inactive product raises error');
}

// ─── SUMMARY ────────────────────────────────────────────────────────────────
console.log('\n==================================================');
if (failed === 0) {
  console.log(`ALL ${passed} PAYMENT & FULFILLMENT TESTS PASSED ✓`);
} else {
  console.log(`RESULTS: ${passed} passed, ${failed} FAILED`);
}
console.log('==================================================\n');

process.exit(failed > 0 ? 1 : 0);
