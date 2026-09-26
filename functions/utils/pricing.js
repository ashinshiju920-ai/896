// functions/utils/pricing.js
// Server-Authoritative Pricing & Catalog Calculation Engine

export const DEFAULT_CATALOG = [
  {
    id: 'ielts-full-prep',
    title: 'IELTS Full Preparation with Mock Tests',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 999, originalPrice: 1299 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 999, originalPrice: 1299, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'oet-full-prep',
    title: 'OET Full Preparation with Mock Tests',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 999, originalPrice: 1299 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 999, originalPrice: 1299, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'german-full-prep',
    title: 'German A1-B2 Complete Mastery',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 999, originalPrice: 1299 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 999, originalPrice: 1299, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'pte-academic-prep',
    title: 'PTE Academic Complete Preparation',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 999, originalPrice: 1299 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 999, originalPrice: 1299, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-speaking-mastery',
    title: 'IELTS Speaking 8.5 Masterclass',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 899, originalPrice: 1199 },
    },
  },
  {
    id: 'oet-nursing-pharmacology',
    title: 'OET Nursing & Pharmacology',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 899, originalPrice: 1199 },
    },
  },
  {
    id: 'german-b2-grammar',
    title: 'German B2 Advanced Grammar & Vocab',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 899, originalPrice: 1199 },
    },
  },
  {
    id: 'ielts-writing-band8',
    title: 'IELTS Writing Task 1 & 2 Band 8+',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 899, originalPrice: 1199 },
    },
  },
  {
    id: 'pte-79-plus-drills',
    title: 'PTE 79+ Targeted Practice',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 899, originalPrice: 1199 },
    },
  },
];

/**
 * Loads the current catalogue from Cloudflare KV or defaults.
 */
export async function loadCatalogue(env) {
  if (env && env.PRODUCTS_KV) {
    try {
      const data = await env.PRODUCTS_KV.get('xylem_products', { type: 'json' });
      if (data && Array.isArray(data.books) && data.books.length > 0) {
        return data.books;
      }
    } catch {}
  }
  return DEFAULT_CATALOG;
}

/**
 * Returns available add-ons for a book.
 */
export function getBookAddons(book) {
  if (book && Array.isArray(book.addons) && book.addons.length > 0) {
    return book.addons.slice(0, 4);
  }

  const digitalPrice = Number(book?.prices?.digital?.price) || 199;
  const digitalOrig = Number(book?.prices?.digital?.originalPrice) || 599;

  const physicalPrice = Number(book?.prices?.physical?.price) || 999;
  const physicalOrig = Number(book?.prices?.physical?.originalPrice) || 1299;

  return [
    {
      id: 'digital',
      name: 'Digital (PDF)',
      subtitle: 'Instant Download',
      price: digitalPrice,
      originalPrice: digitalOrig,
      deliveryOption: 'digital',
    },
    {
      id: 'physical',
      name: 'Physical (Printed)',
      subtitle: 'Delivered in 3-5 days',
      price: physicalPrice,
      originalPrice: physicalOrig,
      deliveryOption: 'physical',
    },
  ];
}

/**
 * Calculates add-on pricing applying "Buy 2 Get 3rd Free" if applicable.
 */
export function calculateAddonsPricing(addons, selectedIds = [], buy2Get3rdFree = false) {
  const selected = addons.filter((a) => selectedIds.includes(a.id));
  const activeList = selected.length > 0 ? selected : (addons.length > 0 ? [addons[0]] : []);

  const subtotal = activeList.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const originalTotal = activeList.reduce(
    (sum, a) => sum + (Number(a.originalPrice) || Number(a.price) || 0),
    0
  );

  let freeDiscount = 0;
  let freeAddonItem = null;

  if (buy2Get3rdFree && activeList.length >= 3) {
    const sorted = [...activeList].sort((a, b) => a.price - b.price);
    freeAddonItem = sorted[0];
    freeDiscount = Number(freeAddonItem.price) || 0;
  }

  const finalPrice = Math.max(0, subtotal - freeDiscount);
  const hasPhysical = activeList.some((a) => a.deliveryOption === 'physical');

  return {
    selected: activeList,
    subtotal,
    originalTotal,
    freeDiscount,
    finalPrice,
    hasPhysical,
    freeAddonItem,
  };
}

/**
 * Server-only list of verified coupon codes and discount formulas.
 */
export function validateCoupon(code, subtotal) {
  if (!code || typeof code !== 'string') return 0;
  const clean = code.trim().toUpperCase();

  switch (clean) {
    case 'XYLEM20':
      return Math.round(subtotal * 0.20);
    case 'FIRST50':
      return Math.min(50, subtotal);
    case 'SPECIALOFFER':
    case 'OFFER67':
      return Math.round(subtotal * 0.15);
    default:
      return 0;
  }
}

/**
 * Authoritative Server Price Computation.
 * Recomputes all prices directly from server catalogue; ignores client-supplied prices.
 */
export async function computeOrderPrice(orderIntent, env) {
  const { cart = [], couponCode = null, deliveryOption = 'digital' } = orderIntent;

  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Order cart cannot be empty.');
  }

  const catalog = await loadCatalogue(env);
  let orderSubtotal = 0;
  let hasPhysical = deliveryOption === 'physical';
  const verifiedItems = [];

  for (const item of cart) {
    const bookId = item.bookId || item.productId || item.id;
    if (!bookId) throw new Error('Missing book ID in cart item.');

    const book = catalog.find((b) => b.id === bookId);
    if (!book) {
      throw new Error(`Product not found in catalog: ${bookId}`);
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const availableAddons = getBookAddons(book);

    let selectedAddonIds = [];
    if (Array.isArray(item.addonIds) && item.addonIds.length > 0) {
      selectedAddonIds = item.addonIds;
    } else if (item.format === 'physical') {
      selectedAddonIds = ['physical'];
    } else {
      selectedAddonIds = ['digital'];
    }

    const pricing = calculateAddonsPricing(
      availableAddons,
      selectedAddonIds,
      Boolean(book.buy2Get3rdFree)
    );

    const itemTotal = pricing.finalPrice * quantity;
    orderSubtotal += itemTotal;

    if (pricing.hasPhysical) {
      hasPhysical = true;
    }

    verifiedItems.push({
      bookId: book.id,
      title: book.title,
      format: item.format || (pricing.hasPhysical ? 'physical' : 'digital'),
      quantity,
      selectedAddons: pricing.selected.map((a) => ({ id: a.id, name: a.name, price: a.price })),
      freeDiscount: pricing.freeDiscount,
      unitPrice: pricing.finalPrice,
      totalPrice: itemTotal,
    });
  }

  // Delivery fee: ₹99 for physical items, ₹0 for digital
  const deliveryFee = hasPhysical ? 99 : 0;

  // Validate coupon server-side
  const couponDiscount = validateCoupon(couponCode, orderSubtotal);

  // Final Total in Rupees and Paise
  const totalRupees = Math.max(1, orderSubtotal + deliveryFee - couponDiscount);
  const totalPaise = Math.round(totalRupees * 100);

  return {
    subtotal: orderSubtotal,
    deliveryFee,
    couponDiscount,
    couponCode: couponDiscount > 0 ? couponCode.trim().toUpperCase() : null,
    total: totalRupees,
    totalPaise,
    hasPhysical,
    items: verifiedItems,
  };
}

/**
 * Validates shipping and customer contact info.
 */
export function validateShippingInfo(shippingInfo = {}, requiresPhysical = false) {
  const errors = [];

  const fullName = String(shippingInfo.fullName || shippingInfo.name || '').trim();
  const email = String(shippingInfo.email || '').trim().toLowerCase();
  const phone = String(shippingInfo.phone || '').trim().replace(/\D/g, '');

  if (!fullName) {
    errors.push('Full name is required.');
  } else if (fullName.length > 100) {
    errors.push('Full name must be under 100 characters.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 100) {
    errors.push('A valid email address is required.');
  }

  // Validate Indian mobile phone: 10 digits starting with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phone || !phoneRegex.test(phone)) {
    errors.push('A valid 10-digit Indian mobile number is required.');
  }

  if (requiresPhysical) {
    const address = String(shippingInfo.address || '').trim();
    const city = String(shippingInfo.city || '').trim();
    const state = String(shippingInfo.state || '').trim();
    const pincode = String(shippingInfo.pincode || shippingInfo.pin || '').trim();

    if (!address || address.length > 250) errors.push('Valid delivery address is required (max 250 chars).');
    if (!city || city.length > 100) errors.push('City is required.');
    if (!state || state.length > 100) errors.push('State is required.');
    if (!/^\d{6}$/.test(pincode)) errors.push('A valid 6-digit Indian PIN code is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    clean: {
      fullName: fullName.slice(0, 100),
      email: email.slice(0, 100),
      phone,
      address: String(shippingInfo.address || '').trim().slice(0, 250),
      city: String(shippingInfo.city || '').trim().slice(0, 100),
      state: String(shippingInfo.state || '').trim().slice(0, 100),
      pincode: String(shippingInfo.pincode || shippingInfo.pin || '').trim().slice(0, 6),
      deliveryOption: requiresPhysical ? 'physical' : 'digital',
    },
  };
}
