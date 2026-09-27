// functions/utils/pricing.js
// Server-Authoritative Pricing & Catalog Calculation Engine

import { getPromotionByCode, getPromotionRedemptionCount, customerHasPaidOrders } from './db.js';

export const BUNDLE_DEALS = [
  {
    id: 'ielts-complete-bundle',
    title: 'IELTS Complete Preparation Bundle',
    pricePaise: 29900,
    price: 299,
    bundledProductIds: ['ielts-academic-guide', 'ielts-mock-tests', 'ielts-vocab-pack'],
  },
];

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
      physical: { price: 1199, originalPrice: 1599 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1199, originalPrice: 1599, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'german-full-prep',
    title: 'German Full Preparation with Mock Tests',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 1149, originalPrice: 1499 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1149, originalPrice: 1499, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'pte-full-prep',
    title: 'PTE Full Preparation with Mock Tests',
    prices: {
      digital: { price: 199, originalPrice: 599 },
      physical: { price: 1099, originalPrice: 1499 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 199, originalPrice: 599, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1099, originalPrice: 1499, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-complete-guide',
    title: 'IELTS Preparation Complete Study Guide',
    prices: {
      digital: { price: 499, originalPrice: 999 },
      physical: { price: 1299, originalPrice: 1599 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 499, originalPrice: 999, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1299, originalPrice: 1599, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-practice-tests',
    title: 'IELTS Practice Tests 10 Full-Length Mock Tests',
    prices: {
      digital: { price: 599, originalPrice: 1199 },
      physical: { price: 1499, originalPrice: 1899 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 599, originalPrice: 1199, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1499, originalPrice: 1899, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-vocabulary',
    title: 'IELTS Vocabulary Build Your Word Power',
    prices: {
      digital: { price: 299, originalPrice: 699 },
      physical: { price: 999, originalPrice: 1299 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 299, originalPrice: 699, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 999, originalPrice: 1299, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-grammar',
    title: 'IELTS Grammar for Higher Band',
    prices: {
      digital: { price: 349, originalPrice: 799 },
      physical: { price: 1099, originalPrice: 1399 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 349, originalPrice: 799, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1099, originalPrice: 1399, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-writing-master',
    title: 'IELTS Writing Task 1 & 2 Masterclass',
    prices: {
      digital: { price: 399, originalPrice: 899 },
      physical: { price: 1199, originalPrice: 1599 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 399, originalPrice: 899, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1199, originalPrice: 1599, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'ielts-speaking-master',
    title: 'IELTS Speaking Masterclass',
    prices: {
      digital: { price: 349, originalPrice: 799 },
      physical: { price: 1099, originalPrice: 1499 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 349, originalPrice: 799, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 1099, originalPrice: 1499, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
  {
    id: 'academic-study-planner',
    title: 'Academic Study Planner & Progress Tracker',
    prices: {
      digital: { price: 49, originalPrice: 199 },
      physical: { price: 499, originalPrice: 799 },
    },
    addons: [
      { id: 'digital', name: 'Digital (PDF)', price: 49, originalPrice: 199, deliveryOption: 'digital' },
      { id: 'physical', name: 'Physical (Printed)', price: 499, originalPrice: 799, deliveryOption: 'physical' },
    ],
    buy2Get3rdFree: false,
  },
];


/**
 * Loads the current catalogue from Cloudflare KV, merged with DEFAULT_CATALOG.
 * - KV books take precedence (admin-managed, dynamic IDs like book-1789851004063)
 * - DEFAULT_CATALOG books fill in any gaps
 * This ensures BOTH original books AND admin-created books are resolvable.
 */
export async function loadCatalogue(env) {
  let kvBooks = [];

  if (env && env.PRODUCTS_KV) {
    try {
      const data = await env.PRODUCTS_KV.get('xylem_products', { type: 'json' });
      if (data && Array.isArray(data.books) && data.books.length > 0) {
        kvBooks = data.books;
      }
    } catch (e) {
      console.warn('KV catalog read failed, using defaults:', e?.message);
    }
  }

  // Merge: KV books first (they override defaults), then add any DEFAULT books not already in KV
  const kvIds = new Set(kvBooks.map((b) => b.id));
  const mergedCatalog = [
    ...kvBooks,
    ...DEFAULT_CATALOG.filter((b) => !kvIds.has(b.id)),
  ];

  return mergedCatalog.length > 0 ? mergedCatalog : DEFAULT_CATALOG;
}

/**
 * Returns available add-ons for a book.
 */
export function getBookAddons(book) {
  if (book && Array.isArray(book.addons) && book.addons.length > 0) {
    return book.addons.slice(0, 4).map((a) => ({
      ...a,
      id: a.id === 'addon_digital' ? 'digital' : (a.id === 'addon_physical' ? 'physical' : a.id),
    }));
  }

  // IMPORTANT: These fallback defaults must match the client-side pricing.ts exactly
  // Client uses `?? 499` for digital and `?? 899` for physical
  const numDigital = Number(book?.prices?.digital?.price);
  const digitalPrice = !isNaN(numDigital) && numDigital >= 0 ? numDigital : 499;
  const numDigitalOrig = Number(book?.prices?.digital?.originalPrice);
  const digitalOrig = !isNaN(numDigitalOrig) && numDigitalOrig >= digitalPrice ? numDigitalOrig : 999;

  const numPhysical = Number(book?.prices?.physical?.price);
  const physicalPrice = !isNaN(numPhysical) && numPhysical >= 0 ? numPhysical : 899;
  const numPhysicalOrig = Number(book?.prices?.physical?.originalPrice);
  const physicalOrig = !isNaN(numPhysicalOrig) && numPhysicalOrig >= physicalPrice ? numPhysicalOrig : 1499;

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
 * Retrieves a specific add-on for a product by ID.
 * Returns normalized add-on with price in paise, active state, and file reference.
 */
export function getProductAddOn(product, addOnId) {
  if (!product || !addOnId) return null;
  const cleanId = String(addOnId).trim();
  const normalizedId = cleanId === 'addon_digital' ? 'digital' : (cleanId === 'addon_physical' ? 'physical' : cleanId);

  const addons = Array.isArray(product.addOns)
    ? product.addOns
    : (Array.isArray(product.addons) ? product.addons : []);

  const found = addons.find((a) => {
    const aId = a.id === 'addon_digital' ? 'digital' : (a.id === 'addon_physical' ? 'physical' : a.id);
    return aId === normalizedId || a.id === cleanId;
  });

  if (found) {
    const price = Number(found.price) || (found.pricePaise ? Math.round(found.pricePaise / 100) : 0);
    const pricePaise = found.pricePaise !== undefined ? Number(found.pricePaise) : Math.round(price * 100);
    return {
      ...found,
      id: found.id === 'addon_digital' ? 'digital' : (found.id === 'addon_physical' ? 'physical' : found.id),
      name: found.name || 'Add-on Material',
      description: found.description || found.subtitle || '',
      price,
      pricePaise,
      active: found.active !== undefined ? Boolean(found.active) : true,
      deliveryOption: found.deliveryOption || 'digital',
      digitalFile: found.digitalFile || (found.pdfUrl ? { filename: found.samplePdfName || `${found.id}.pdf`, fileUrl: found.pdfUrl } : null),
    };
  }

  // Fallback defaults for legacy 'digital' and 'physical' if not explicitly defined in addons array
  if (normalizedId === 'digital' || normalizedId === 'physical') {
    const isPhys = normalizedId === 'physical';
    const priceRupees = isPhys
      ? (Number(product.prices?.physical?.price) || 899)
      : (Number(product.prices?.digital?.price) || Number(product.price) || 199);
    return {
      id: normalizedId,
      name: isPhys ? 'Physical (Printed)' : 'Digital (PDF)',
      subtitle: isPhys ? 'Delivered in 3-5 days' : 'Instant Download',
      description: isPhys ? 'Delivered in 3-5 days' : 'Instant Download',
      price: priceRupees,
      pricePaise: Math.round(priceRupees * 100),
      active: true,
      deliveryOption: isPhys ? 'physical' : 'digital',
      digitalFile: isPhys ? null : (product.digitalFile || { filename: product.samplePdfName || `${product.id}.pdf`, fileUrl: product.pdfUrl || '' }),
    };
  }

  return null;
}

/**
 * Validates an array of selected add-on IDs against a product.
 * Returns { isValid: true, validAddOns: [...] } or { isValid: false, error: '...' }
 * Fails safely if any add-on is unknown or marked inactive (active === false).
 */
export function validateSelectedAddOns(product, addOnIds = []) {
  if (!product) {
    return { isValid: false, error: 'Product not provided for add-on validation.', validAddOns: [] };
  }

  if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
    return { isValid: true, validAddOns: [] };
  }

  const validAddOns = [];
  for (const rawId of addOnIds) {
    if (!rawId) continue;
    const addon = getProductAddOn(product, rawId);
    if (!addon) {
      return {
        isValid: false,
        error: `Unknown add-on ID "${rawId}" for product "${product.id}". One of the selected optional materials is no longer available.`,
        validAddOns: [],
      };
    }
    if (addon.active === false) {
      return {
        isValid: false,
        error: `Add-on "${addon.name || rawId}" is inactive and cannot be purchased. The selected optional material is no longer available.`,
        validAddOns: [],
      };
    }
    validAddOns.push(addon);
  }

  return { isValid: true, validAddOns };
}

/**
 * Calculates add-on pricing applying "Buy 2 Get 3rd Free" if applicable.
 */
export function calculateAddonsPricing(addons, selectedIds = [], buy2Get3rdFree = false) {
  const normalizedSelectedIds = (selectedIds || []).map((id) =>
    id === 'addon_digital' ? 'digital' : (id === 'addon_physical' ? 'physical' : id)
  );

  const selected = addons.filter((a) => {
    const normId = a.id === 'addon_digital' ? 'digital' : (a.id === 'addon_physical' ? 'physical' : a.id);
    return normalizedSelectedIds.includes(normId) || normalizedSelectedIds.includes(a.id);
  });
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
 * High-level product + add-ons calculation engine using integer paise.
 */
export function calculateProductWithAddOns(product, selectedAddOnIds = [], options = {}) {
  const { buy2Get3rdFree = false } = options;
  const validation = validateSelectedAddOns(product, selectedAddOnIds);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const selected = validation.validAddOns;
  const activeList = selected.length > 0
    ? selected
    : getBookAddons(product).slice(0, 1).map((a) => ({
        ...a,
        pricePaise: Math.round((Number(a.price) || 0) * 100),
        active: true,
      }));

  const subtotalPaise = activeList.reduce((sum, a) => {
    return sum + (a.pricePaise !== undefined ? Number(a.pricePaise) : Math.round(Number(a.price || 0) * 100));
  }, 0);

  const originalTotalPaise = activeList.reduce((sum, a) => {
    const orig = Number(a.originalPrice) || Number(a.price) || 0;
    return sum + (a.originalPricePaise ? Number(a.originalPricePaise) : Math.round(orig * 100));
  }, 0);

  let freeDiscountPaise = 0;
  let freeAddonItem = null;

  if (buy2Get3rdFree && activeList.length >= 3) {
    const sorted = [...activeList].sort((a, b) => (a.pricePaise || 0) - (b.pricePaise || 0));
    freeAddonItem = sorted[0];
    freeDiscountPaise = Number(freeAddonItem.pricePaise) || 0;
  }

  const finalPricePaise = Math.max(0, subtotalPaise - freeDiscountPaise);
  const hasPhysical = activeList.some((a) => a.deliveryOption === 'physical');

  return {
    selected: activeList,
    subtotalPaise,
    subtotal: Math.round(subtotalPaise / 100),
    originalTotalPaise,
    originalTotal: Math.round(originalTotalPaise / 100),
    freeDiscountPaise,
    freeDiscount: Math.round(freeDiscountPaise / 100),
    finalPricePaise,
    finalPrice: Math.round(finalPricePaise / 100),
    hasPhysical,
    freeAddonItem,
  };
}

/**
 * Creates an immutable historical snapshot of an ordered product and its purchased add-ons.
 * Preserves exact price snapshots in integer paise, protecting historical orders against catalog changes.
 */
export function createOrderItemSnapshot(product, selectedAddOnIds = [], quantity = 1, format = 'digital') {
  if (!product) throw new Error('Product is required to create order item snapshot.');
  const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));

  const isPhysical = format === 'physical';
  const basePriceRupees = isPhysical
    ? (Number(product.prices?.physical?.price) || 899)
    : (Number(product.prices?.digital?.price) || Number(product.price) || 199);
  const basePricePaise = Math.round(basePriceRupees * 100);

  const validation = validateSelectedAddOns(product, selectedAddOnIds);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const addOnsSnapshots = validation.validAddOns.map((a) => {
    const unitPaise = a.pricePaise !== undefined ? Number(a.pricePaise) : Math.round((Number(a.price) || 0) * 100);
    return {
      addOnId: a.id,
      id: a.id, // backward-compatibility alias
      nameSnapshot: a.name || 'Add-on Material',
      name: a.name || 'Add-on Material', // backward-compatibility alias
      quantity: 1,
      unitPricePaise: unitPaise,
      price: Math.round(unitPaise / 100),
      deliveryOption: a.deliveryOption || 'digital',
      digitalFile: a.digitalFile || (a.pdfUrl ? { filename: a.samplePdfName || `${a.id}.pdf`, fileUrl: a.pdfUrl } : null),
    };
  });

  const hasFormatAddon = addOnsSnapshots.some((a) => a.addOnId === 'digital' || a.addOnId === 'physical');
  const optionalAddons = addOnsSnapshots.filter((a) =>
    hasFormatAddon ? (a.addOnId !== 'digital' && a.addOnId !== 'physical') : true
  );

  let freeDiscountPaise = 0;
  if (product.buy2Get3rdFree && optionalAddons.length >= 3) {
    const sorted = [...optionalAddons].sort((a, b) => a.unitPricePaise - b.unitPricePaise);
    freeDiscountPaise = sorted[0].unitPricePaise;
  }

  const addOnsSubtotalPaise = Math.max(0, optionalAddons.reduce((sum, a) => sum + a.unitPricePaise, 0) - freeDiscountPaise);

  const totalItemUnitPricePaise = basePricePaise + addOnsSubtotalPaise;
  const totalPricePaise = totalItemUnitPricePaise * safeQty;
  const titleSnapshot = product.title || product.name || 'Study Material';

  return {
    productId: product.id,
    bookId: product.id, // backward-compatibility alias
    productNameSnapshot: titleSnapshot,
    title: titleSnapshot, // backward-compatibility alias
    format: isPhysical ? 'physical' : 'digital',
    quantity: safeQty,
    unitPricePaise: totalItemUnitPricePaise,
    unitPrice: Math.round(totalItemUnitPricePaise / 100),
    totalPricePaise,
    totalPrice: Math.round(totalPricePaise / 100),
    freeDiscount: Math.round(freeDiscountPaise / 100),
    freeDiscountPaise,
    addOns: optionalAddons,
    selectedAddons: optionalAddons.map((a) => ({
      id: a.addOnId,
      name: a.nameSnapshot,
      price: a.price,
      pricePaise: a.unitPricePaise,
      deliveryOption: a.deliveryOption,
    })),
    digitalFile: product.digitalFile || {
      filename: product.samplePdfName || `${product.id}.pdf`,
      fileUrl: product.pdfUrl || '',
    },
  };
}

/**
 * Server-only list of verified coupon codes and discount formulas (legacy synchronous helper).
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
 * Authoritative Server-Side Promotional Validation & Discount Calculation.
 * Enforces coupon existence, active window, usage limits, per-customer limits,
 * first-order only status, product/add-on targeting, minimum order, and maximum discount caps.
 */
export async function validatePromotionAuthoritative({
  couponCode,
  orderSubtotalPaise,
  verifiedItems = [],
  customerId = null,
  customerEmail = null,
  env = null,
}) {
  if (!couponCode || typeof couponCode !== 'string' || !couponCode.trim()) {
    return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'No coupon code provided.' };
  }

  const cleanCode = couponCode.trim().toUpperCase();
  const promo = await getPromotionByCode(env, cleanCode);

  if (!promo) {
    return { isValid: false, discountPaise: 0, discountRupees: 0, error: `Invalid coupon code "${cleanCode}".` };
  }

  // 1. Active check
  if (!promo.active) {
    return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'Coupon is currently inactive.' };
  }

  const now = Date.now();

  // 2. Starts at check (server-time enforced)
  if (promo.startsAt || promo.starts_at) {
    const startTime = new Date(promo.startsAt || promo.starts_at).getTime();
    if (!isNaN(startTime) && startTime > now) {
      return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'Coupon promotion has not started yet.' };
    }
  }

  // 3. Expires at check (server-time enforced)
  if (promo.expiresAt || promo.expires_at) {
    const expireTime = new Date(promo.expiresAt || promo.expires_at).getTime();
    if (!isNaN(expireTime) && expireTime < now) {
      return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'Coupon has expired.' };
    }
  }

  // 4. Global usage limit check
  const usageLimit = promo.usageLimit ?? promo.usage_limit;
  const timesUsed = Number(promo.timesUsed ?? promo.times_used ?? 0);
  if (usageLimit != null && timesUsed >= usageLimit) {
    return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'Coupon usage limit has been reached.' };
  }

  // 5. Per-customer limit check
  const perCustomerLimit = promo.perCustomerLimit ?? promo.per_customer_limit;
  if (perCustomerLimit != null && (customerId || customerEmail)) {
    try {
      const redemptions = await getPromotionRedemptionCount(env, cleanCode, customerId, customerEmail);
      if (redemptions >= perCustomerLimit) {
        return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'You have reached the maximum redemptions for this coupon.' };
      }
    } catch (countErr) {
      console.warn('Could not check customer redemption count:', countErr.message);
    }
  }

  // 6. First-order only check
  const firstOrderOnly = Boolean(promo.firstOrderOnly ?? promo.first_order_only);
  if (firstOrderOnly && (customerId || customerEmail)) {
    try {
      const hasPriorPaid = await customerHasPaidOrders(env, customerId, customerEmail);
      if (hasPriorPaid) {
        return { isValid: false, discountPaise: 0, discountRupees: 0, error: 'This coupon is valid only on your first purchase.' };
      }
    } catch (priorErr) {
      console.warn('Could not check customer prior orders:', priorErr.message);
    }
  }

  // 7. Product & Add-On qualification check
  const applicableProducts = promo.applicableProductIds || promo.applicable_product_ids;
  const applicableAddOns = promo.applicableAddOnIds || promo.applicable_addon_ids;

  let hasTargeting = false;
  let qualifyingSubtotalPaise = 0;

  if (Array.isArray(applicableProducts) && applicableProducts.length > 0) {
    hasTargeting = true;
    for (const item of verifiedItems) {
      const itemProdId = item.productId || item.bookId;
      if (applicableProducts.includes(itemProdId)) {
        // Base price of qualifying product
        const baseItemPaise = (item.unitPricePaise || 0) * (item.quantity || 1);
        qualifyingSubtotalPaise += baseItemPaise;
      }
    }
  }

  if (Array.isArray(applicableAddOns) && applicableAddOns.length > 0) {
    hasTargeting = true;
    for (const item of verifiedItems) {
      const addons = Array.isArray(item.addOns) ? item.addOns : (Array.isArray(item.selectedAddons) ? item.selectedAddons : []);
      for (const addon of addons) {
        const addonId = addon.addOnId || addon.id;
        if (applicableAddOns.includes(addonId)) {
          const addonPricePaise = addon.unitPricePaise !== undefined ? addon.unitPricePaise : Math.round((addon.price || 0) * 100);
          qualifyingSubtotalPaise += addonPricePaise * (item.quantity || 1);
        }
      }
    }
  }

  if (!hasTargeting) {
    qualifyingSubtotalPaise = orderSubtotalPaise;
  } else if (qualifyingSubtotalPaise === 0) {
    return {
      isValid: false,
      discountPaise: 0,
      discountRupees: 0,
      error: 'Coupon is not applicable to any qualifying products or add-ons in your cart.',
    };
  }

  // 8. Minimum order requirement
  const minOrderPaise = Number(promo.minimumOrderPaise ?? promo.minimum_order_paise ?? 0);
  if (minOrderPaise > 0 && orderSubtotalPaise < minOrderPaise) {
    return {
      isValid: false,
      discountPaise: 0,
      discountRupees: 0,
      error: `Minimum order of ₹${Math.round(minOrderPaise / 100)} required for this coupon.`,
    };
  }

  // 9. Compute discount
  const discountType = promo.discountType || promo.discount_type || 'PERCENTAGE';
  const discountValue = Number(promo.discountValue ?? promo.discount_value ?? 0);
  let calculatedDiscountPaise = 0;

  if (discountType === 'PERCENTAGE') {
    const safePercent = Math.min(100, Math.max(0, discountValue));
    calculatedDiscountPaise = Math.round(qualifyingSubtotalPaise * (safePercent / 100));
  } else if (discountType === 'FIXED_AMOUNT') {
    calculatedDiscountPaise = Math.min(qualifyingSubtotalPaise, Math.max(0, discountValue));
  }

  // 10. Maximum discount cap
  const maxDiscountPaise = promo.maximumDiscountPaise ?? promo.maximum_discount_paise;
  if (maxDiscountPaise != null && maxDiscountPaise > 0 && calculatedDiscountPaise > maxDiscountPaise) {
    calculatedDiscountPaise = maxDiscountPaise;
  }

  // Final bound check: discount cannot exceed total subtotal or be negative
  calculatedDiscountPaise = Math.min(orderSubtotalPaise, Math.max(0, calculatedDiscountPaise));
  const calculatedDiscountRupees = Math.round(calculatedDiscountPaise / 100);

  return {
    isValid: true,
    discountPaise: calculatedDiscountPaise,
    discountRupees: calculatedDiscountRupees,
    promo: {
      id: promo.id,
      code: promo.code,
      name: promo.name,
      discountType,
      discountValue,
      discountPaise: calculatedDiscountPaise,
      discountRupees: calculatedDiscountRupees,
    },
  };
}

/**
 * Authoritative Server Price Computation.
 * Recomputes all prices directly from server catalogue in integer paise; ignores client-supplied prices.
 */
export async function computeOrderPrice(orderIntent, env) {
  let cart, couponCode, deliveryOption, customerId, customerEmail, strictCouponValidation;
  let targetEnv = env;

  if (Array.isArray(orderIntent)) {
    cart = orderIntent;
    deliveryOption = typeof env === 'string' ? env : 'digital';
    couponCode = typeof arguments[2] === 'string' ? arguments[2] : null;
    targetEnv = (arguments[3] && typeof arguments[3] === 'object') ? arguments[3] : {};
    const custCtx = (arguments[4] && typeof arguments[4] === 'object') ? arguments[4] : {};
    customerId = custCtx.customerId || null;
    customerEmail = custCtx.customerEmail || null;
    strictCouponValidation = false;
  } else {
    ({
      cart = [],
      couponCode = null,
      deliveryOption = 'digital',
      customerId = null,
      customerEmail = null,
      strictCouponValidation = false,
    } = orderIntent || {});
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Order cart cannot be empty.');
  }

  const catalog = await loadCatalogue(targetEnv);
  let orderSubtotalPaise = 0;
  let hasPhysical = deliveryOption === 'physical';
  const verifiedItems = [];

  for (const item of cart) {
    const bookId = item.bookId || item.productId || item.id;
    if (!bookId) throw new Error('Missing book ID in cart item.');

    const bundleConfig = BUNDLE_DEALS.find((b) => b.id === bookId);
    const isBundle = Boolean(item.isBundle || bundleConfig);
    const book = catalog.find((b) => b.id === bookId);
    if ((!book || book.active === false) && !isBundle) {
      throw new Error('One of the selected products is no longer available.');
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

    if (isBundle) {
      // Authoritative bundle price from server catalog; client cannot manipulate
      const bundlePricePaise = bundleConfig
        ? bundleConfig.pricePaise
        : Math.max(100, Math.floor(Number(book?.prices?.digital?.price ? book.prices.digital.price * 100 : 29900)));
      const lineTotalPaise = bundlePricePaise * quantity;
      orderSubtotalPaise += lineTotalPaise;
      verifiedItems.push({
        id: bookId,
        bookId,
        title: (bundleConfig && bundleConfig.title) || item.title || (book ? book.title : 'Complete Preparation Bundle'),
        price: Math.round(bundlePricePaise / 100),
        pricePaise: bundlePricePaise,
        quantity,
        isBundle: true,
        bundledProductIds: (bundleConfig && bundleConfig.bundledProductIds) || item.bundledProductIds || [],
        lineTotalPaise,
        selectedAddons: [],
      });
      continue;
    }

    let selectedAddonIds = [];
    if (Array.isArray(item.addonIds)) {
      selectedAddonIds = item.addonIds;
    } else if (Array.isArray(item.selectedAddonIds)) {
      selectedAddonIds = item.selectedAddonIds;
    } else {
      selectedAddonIds = [];
    }

    // Validate that addOnIds contains valid strings and no duplicates
    const seenAddons = new Set();
    for (const rawId of selectedAddonIds) {
      if (typeof rawId !== 'string' || !rawId.trim()) {
        throw new Error('Invalid add-on identifier in cart.');
      }
      const cleanId = rawId.trim();
      if (seenAddons.has(cleanId)) {
        throw new Error(`Duplicate add-on "${cleanId}" detected in cart item.`);
      }
      seenAddons.add(cleanId);
    }

    // Server-side validation: reject unknown or inactive add-ons
    const addOnValidation = validateSelectedAddOns(book, selectedAddonIds);
    if (!addOnValidation.isValid) {
      throw new Error(addOnValidation.error);
    }

    const isPhysicalFormat = item.format === 'physical' || selectedAddonIds.includes('physical');
    const itemFormat = isPhysicalFormat ? 'physical' : 'digital';

    // Create immutable order item snapshot with authoritative integer paise
    const snapshot = createOrderItemSnapshot(
      book,
      selectedAddonIds,
      quantity,
      itemFormat
    );

    // Support bundle items
    if (item.isBundle || book.isBundle) {
      snapshot.isBundle = true;
      snapshot.bundledProductIds = item.bundledProductIds || book.bundledProductIds || [];
      snapshot.bundleName = book.title;
    }

    orderSubtotalPaise += snapshot.totalPricePaise;

    if (snapshot.format === 'physical' || snapshot.addOns.some((a) => a.deliveryOption === 'physical')) {
      hasPhysical = true;
    }

    verifiedItems.push({
      ...snapshot,
      bookId: book.id,
      productId: book.id,
      title: snapshot.productNameSnapshot,
      format: snapshot.format,
      quantity,
      selectedAddons: snapshot.selectedAddons,
      addOns: snapshot.addOns,
      freeDiscount: snapshot.freeDiscount || 0,
      unitPrice: snapshot.unitPrice,
      unitPricePaise: snapshot.unitPricePaise,
      totalPrice: snapshot.totalPrice,
      totalPricePaise: snapshot.totalPricePaise,
    });
  }

  // Authoritative shipping calculation: ₹99 (9900 paise) for physical, ₹0 for digital
  const deliveryFeePaise = hasPhysical ? 9900 : 0;
  const deliveryFee = Math.round(deliveryFeePaise / 100);

  // Authoritative server-side promotional validation & discount calculation
  const orderSubtotalRupees = Math.round(orderSubtotalPaise / 100);
  let couponDiscountPaise = 0;
  let couponDiscountRupees = 0;
  let appliedPromoSnapshot = null;
  let couponError = null;

  if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
    const promoValidation = await validatePromotionAuthoritative({
      couponCode,
      orderSubtotalPaise,
      verifiedItems,
      customerId: customerId || (orderIntent && orderIntent.customerId) || null,
      customerEmail: customerEmail || (orderIntent && (orderIntent.customerEmail || orderIntent.shippingInfo?.email)) || null,
      env: targetEnv,
    });

    if (promoValidation.isValid) {
      couponDiscountPaise = promoValidation.discountPaise;
      couponDiscountRupees = promoValidation.discountRupees;
      appliedPromoSnapshot = promoValidation.promo;
    } else {
      couponError = promoValidation.error;
      if (strictCouponValidation || (orderIntent && orderIntent.strictCouponValidation)) {
        throw new Error(promoValidation.error || 'Invalid coupon code.');
      }
    }
  }

  // Final Total in Integer Paise (minimum 100 paise = ₹1)
  const finalTotalPaise = Math.max(100, orderSubtotalPaise + deliveryFeePaise - couponDiscountPaise);
  const totalRupees = Math.round(finalTotalPaise / 100);

  return {
    subtotal: orderSubtotalRupees,
    subtotalPaise: orderSubtotalPaise,
    deliveryFee,
    deliveryFeePaise,
    shipping: deliveryFee,
    shippingPaise: deliveryFeePaise,
    couponDiscount: couponDiscountRupees,
    couponDiscountPaise,
    couponCode: couponDiscountPaise > 0 ? couponCode.trim().toUpperCase() : null,
    couponError,
    promotionSnapshot: appliedPromoSnapshot,
    total: totalRupees,
    totalPaise: finalTotalPaise,
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
    // Accept both 'address' and 'addressLine1' (sent by CheckoutView)
    const address = String(
      shippingInfo.address || shippingInfo.addressLine1 || ''
    ).trim();
    const city = String(shippingInfo.city || '').trim();
    const state = String(shippingInfo.state || '').trim();
    // Accept both 'pincode'/'pin' and 'pinCode' (camelCase sent by CheckoutView)
    const pincode = String(
      shippingInfo.pincode || shippingInfo.pin || shippingInfo.pinCode || ''
    ).trim();

    if (!address || address.length > 250) errors.push('Valid delivery address is required (max 250 chars).');
    if (!city || city.length > 100) errors.push('City is required.');
    if (!state || state.length > 100) errors.push('State is required.');
    if (!/^\d{6}$/.test(pincode)) errors.push('A valid 6-digit Indian PIN code is required.');
  }

  // Build clean address from whichever field was provided
  const cleanAddress = String(
    shippingInfo.address || shippingInfo.addressLine1 || ''
  ).trim().slice(0, 250);
  const cleanPincode = String(
    shippingInfo.pincode || shippingInfo.pin || shippingInfo.pinCode || ''
  ).trim().slice(0, 6);

  return {
    isValid: errors.length === 0,
    errors,
    clean: {
      fullName: fullName.slice(0, 100),
      email: email.slice(0, 100),
      phone,
      address: cleanAddress,
      city: String(shippingInfo.city || '').trim().slice(0, 100),
      state: String(shippingInfo.state || '').trim().slice(0, 100),
      pincode: cleanPincode,
      deliveryOption: requiresPhysical ? 'physical' : 'digital',
    },
  };
}

