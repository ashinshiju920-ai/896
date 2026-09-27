import assert from 'node:assert/strict';
import { validateAndReconcileCart } from '../src/utils/pricing';
import type { Book, CartItem } from '../src/types';

const oet: Book = {
  id: 'oet-full-prep',
  title: 'OET Full Preparation with Mock Tests',
  active: true,
  prices: {
    digital: { price: 199, originalPrice: 599, discountPercent: 67 },
    physical: { price: 899, originalPrice: 1499, discountPercent: 40 },
  },
  addOns: [{ id: 'cvbc', name: 'CVBC', price: 99, originalPrice: 199, active: true }],
} as Book;

const cartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  bookId: oet.id,
  book: oet,
  format: 'digital',
  quantity: 1,
  price: 298,
  originalPrice: 798,
  selectedAddonIds: ['cvbc'],
  selectedAddons: [{ id: 'cvbc', name: 'CVBC', price: 99, originalPrice: 199, active: true }],
  ...overrides,
});

console.log('Stale checkout reconciliation regression');

// Exact reported scenario: browser has a deleted add-on snapshot priced at ₹99.
{
  const stored = cartItem({
    selectedAddonIds: ['addon_1790542027779_bubh9'],
    selectedAddons: [{ id: 'addon_1790542027779_bubh9', name: 'cvbc', price: 99, originalPrice: 199, active: true }],
  });
  const result = validateAndReconcileCart([stored], [oet]);
  assert.equal(result.hasChanges, true);
  assert.equal(result.isValid, false, 'the initial stale cart must block payment');
  assert.equal(result.errorMessage, 'One of the selected optional materials is no longer available.');
  const reconciled = result.reconciledCart[0];
  assert.deepEqual(reconciled.selectedAddonIds, []);
  assert.deepEqual(reconciled.selectedAddons, []);
  assert.equal(reconciled.price, 199, 'must not retain the browser ₹99');
  assert.equal(reconciled.originalPrice, 599);
  const couponDiscount = Math.round(reconciled.price * 0.2);
  assert.equal(couponDiscount, 40, 'coupon recalculates from the reconciled subtotal');
  assert.equal(reconciled.price - couponDiscount, 159);
  console.log('  ✓ deleted stale add-on is removed with fresh subtotal, discount, savings, and total inputs');
}

// Deleted and disabled add-ons, current price changes, and a mixed multi-add-on line.
{
  const current = {
    ...oet,
    prices: { ...oet.prices, digital: { price: 249, originalPrice: 649, discountPercent: 62 } },
    addOns: [
      { id: 'cvbc', name: 'CVBC (new price)', price: 129, originalPrice: 229, active: true },
      { id: 'disabled', name: 'Disabled', price: 99, originalPrice: 199, active: false },
    ],
  } as Book;
  const result = validateAndReconcileCart([cartItem({ selectedAddonIds: ['cvbc', 'disabled', 'deleted'] })], [current]);
  assert.deepEqual(result.reconciledCart[0].selectedAddonIds, ['cvbc']);
  assert.equal(result.reconciledCart[0].selectedAddons?.[0].price, 129);
  assert.equal(result.reconciledCart[0].price, 378);
  assert.equal(result.reconciledCart[0].originalPrice, 878);
  console.log('  ✓ disabled/deleted add-ons are pruned while valid add-on and product prices refresh');
}

// A deleted product has no display snapshot left to render.
{
  const result = validateAndReconcileCart([cartItem()], []);
  assert.equal(result.reconciledCart.length, 0);
  assert.equal(result.removedItems.length, 1);
  assert.equal(result.errorMessage, 'One of the selected products is no longer available.');
  console.log('  ✓ deleted product is removed completely');
}

