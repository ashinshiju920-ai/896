import { Book, BookFormat, ProductAddon, CartItem } from '../types';

/**
 * Returns active, customer-selectable optional add-ons for a product.
 * Filters out:
 * - base formats ('digital', 'physical')
 * - inactive add-ons (active === false)
 * - invalid/malformed add-ons without an ID or valid price
 * Tolerates malformed catalog data safely and deduplicates by ID.
 */
export const getSelectableAddons = (book: Book | null | undefined): ProductAddon[] => {
  if (!book) return [];

  const rawAddons = Array.isArray(book.addOns)
    ? book.addOns
    : (Array.isArray(book.addons) ? book.addons : []);

  if (!Array.isArray(rawAddons) || rawAddons.length === 0) {
    return [];
  }

  const seenIds = new Set<string>();
  const selectable: ProductAddon[] = [];

  for (const item of rawAddons) {
    if (!item || typeof item !== 'object') continue;

    // Filter out inactive add-ons
    if (item.active === false) continue;

    const rawId = typeof item.id === 'string' ? item.id.trim() : '';
    if (!rawId) continue;

    // Filter out format identifiers that represent the base book
    if (rawId === 'digital' || rawId === 'physical' || rawId === 'addon_digital' || rawId === 'addon_physical') {
      continue;
    }

    // Prevent duplicate IDs (keep the first occurrence)
    if (seenIds.has(rawId)) continue;
    seenIds.add(rawId);

    // Validate and sanitize price
    const numPrice = Number(item.price);
    const numPaise = Number(item.pricePaise);
    let resolvedPrice = 0;
    if (!isNaN(numPrice) && isFinite(numPrice) && numPrice >= 0) {
      resolvedPrice = numPrice;
    } else if (!isNaN(numPaise) && isFinite(numPaise) && numPaise >= 0) {
      resolvedPrice = Math.round(numPaise / 100);
    } else {
      // Invalid price -> skip rendering as a purchasable option
      continue;
    }

    const origPrice = Number(item.originalPrice);
    const resolvedOrigPrice = !isNaN(origPrice) && isFinite(origPrice) && origPrice >= resolvedPrice
      ? origPrice
      : resolvedPrice;

    selectable.push({
      ...item,
      id: rawId,
      name: (item.name && typeof item.name === 'string') ? item.name.trim() : 'Optional Study Material',
      description: (item.description && typeof item.description === 'string') ? item.description.trim() : (item.subtitle || ''),
      price: resolvedPrice,
      pricePaise: item.pricePaise !== undefined ? Math.round(Number(item.pricePaise)) : Math.round(resolvedPrice * 100),
      originalPrice: resolvedOrigPrice,
      active: true,
      deliveryOption: item.deliveryOption === 'physical' ? 'physical' : 'digital',
      digitalFile: item.digitalFile || (item.pdfUrl ? { filename: item.samplePdfName || `${rawId}.pdf`, fileUrl: item.pdfUrl } : undefined),
    });
  }

  return selectable;
};

/**
 * Stable cart line identity.
 * Two cart items represent the same purchase configuration if and only if
 * they have the same productId/bookId, format, and sorted unique selected add-on IDs.
 */
export const getCartLineKey = (
  bookId: string,
  format: BookFormat,
  selectedAddonIds: string[] = []
): string => {
  const safeIds = Array.isArray(selectedAddonIds)
    ? selectedAddonIds.filter(Boolean).map(String).sort()
    : [];
  const uniqueSorted = Array.from(new Set(safeIds));
  return `${bookId}_${format}_${uniqueSorted.join(',')}`;
};

export interface ProductDisplayPriceResult {
  basePrice: number;
  baseOriginalPrice: number;
  addOnsPrice: number;
  totalPrice: number;
  totalOriginalPrice: number;
  selectedAddons: ProductAddon[];
}

/**
 * Calculates display-only prices for the customer UI.
 * IMPORTANT: This calculation is for rendering display only and carries NO payment authority.
 */
export const calculateDisplayPrice = (
  book: Book,
  format: BookFormat = 'digital',
  selectedAddonIds: string[] = []
): ProductDisplayPriceResult => {
  if (!book) {
    return {
      basePrice: 0,
      baseOriginalPrice: 0,
      addOnsPrice: 0,
      totalPrice: 0,
      totalOriginalPrice: 0,
      selectedAddons: [],
    };
  }

  const isPhysical = format === 'physical';
  const basePrice = isPhysical
    ? (Number(book.prices?.physical?.price) ?? 899)
    : (Number(book.prices?.digital?.price) ?? 199);
  const baseOriginalPrice = isPhysical
    ? (Number(book.prices?.physical?.originalPrice) ?? 1499)
    : (Number(book.prices?.digital?.originalPrice) ?? 599);

  const selectableAddons = getSelectableAddons(book);
  const safeSelectedIds = new Set(
    (selectedAddonIds || []).filter(Boolean).map(String)
  );

  const selectedAddons = selectableAddons.filter((a) => safeSelectedIds.has(a.id));

  const addOnsPrice = selectedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const addOnsOriginalPrice = selectedAddons.reduce(
    (sum, a) => sum + (Number(a.originalPrice) || Number(a.price) || 0),
    0
  );

  return {
    basePrice,
    baseOriginalPrice,
    addOnsPrice,
    totalPrice: basePrice + addOnsPrice,
    totalOriginalPrice: baseOriginalPrice + addOnsOriginalPrice,
    selectedAddons,
  };
};

/**
 * Returns the list of add-ons/formats for a book.
 * If the book does not have custom addons defined, falls back to legacy digital & physical prices.
 */
export const getBookAddons = (book: Book): ProductAddon[] => {
  const custom = book && (Array.isArray(book.addOns) && book.addOns.length > 0 ? book.addOns : (Array.isArray(book.addons) && book.addons.length > 0 ? book.addons : []));
  if (custom && custom.length > 0) {
    return custom.map((a) => ({
      ...a,
      id: a.id === 'addon_digital' ? 'digital' : (a.id === 'addon_physical' ? 'physical' : a.id),
    }));
  }

  const digitalPrice = book?.prices?.digital?.price ?? 499;
  const digitalOrig = book?.prices?.digital?.originalPrice ?? 999;
  const digitalDisc = Math.round(((digitalOrig - digitalPrice) / digitalOrig) * 100);

  const physicalPrice = book?.prices?.physical?.price ?? 899;
  const physicalOrig = book?.prices?.physical?.originalPrice ?? 1499;
  const physicalDisc = Math.round(((physicalOrig - physicalPrice) / physicalOrig) * 100);

  return [
    {
      id: 'digital',
      name: 'Digital (PDF)',
      subtitle: 'Instant Download',
      price: digitalPrice,
      originalPrice: digitalOrig,
      discountPercent: digitalDisc > 0 ? digitalDisc : 50,
      deliveryOption: 'digital',
    },
    {
      id: 'physical',
      name: 'Physical (Printed)',
      subtitle: 'Delivered in 3-5 days',
      price: physicalPrice,
      originalPrice: physicalOrig,
      discountPercent: physicalDisc > 0 ? physicalDisc : 40,
      deliveryOption: 'physical',
    },
  ];
};

export interface AddonsPricingCalculation {
  selected: ProductAddon[];
  subtotal: number;
  originalTotal: number;
  freeDiscount: number;
  finalPrice: number;
  savingsTotal: number;
  hasPhysical: boolean;
  freeAddonItem?: ProductAddon;
}

/**
 * Calculates pricing for selected add-ons, applying the "Buy 2 Get 3rd Free" deal if applicable.
 */
export const calculateAddonsPricing = (
  addons: ProductAddon[],
  selectedIds: string[],
  buy2Get3rdFree = false
): AddonsPricingCalculation => {
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
  let freeAddonItem: ProductAddon | undefined;

  // Buy 2 Get 3rd Free: if customer selected 3 or more add-ons
  if (buy2Get3rdFree && activeList.length >= 3) {
    // The lowest priced add-on among selected is free
    const sortedByPrice = [...activeList].sort((a, b) => a.price - b.price);
    freeAddonItem = sortedByPrice[0];
    freeDiscount = Number(freeAddonItem.price) || 0;
  }

  const finalPrice = Math.max(0, subtotal - freeDiscount);
  const savingsTotal = Math.max(0, originalTotal - finalPrice);
  const hasPhysical = activeList.some((a) => a.deliveryOption === 'physical');

  return {
    selected: activeList,
    subtotal,
    originalTotal,
    freeDiscount,
    finalPrice,
    savingsTotal,
    hasPhysical,
    freeAddonItem,
  };
};

/**
 * Retrieves a specific add-on for a book by ID.
 */
export const getProductAddOn = (book: Book, addOnId: string): ProductAddon | null => {
  if (!book || !addOnId) return null;
  const cleanId = String(addOnId).trim();
  const normalizedId = cleanId === 'addon_digital' ? 'digital' : (cleanId === 'addon_physical' ? 'physical' : cleanId);

  const addons = Array.isArray(book.addOns)
    ? book.addOns
    : (Array.isArray(book.addons) ? book.addons : []);

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
      digitalFile: found.digitalFile || (found.pdfUrl ? { filename: found.samplePdfName || `${found.id}.pdf`, fileUrl: found.pdfUrl } : undefined),
    };
  }

  // Fallback defaults for legacy 'digital' and 'physical' if not explicitly defined in addons array
  if (normalizedId === 'digital' || normalizedId === 'physical') {
    const isPhys = normalizedId === 'physical';
    const priceRupees = isPhys
      ? (Number(book.prices?.physical?.price) || 899)
      : (Number(book.prices?.digital?.price) || 199);
    const origRupees = isPhys
      ? (Number(book.prices?.physical?.originalPrice) || 1499)
      : (Number(book.prices?.digital?.originalPrice) || 599);
    return {
      id: normalizedId,
      name: isPhys ? 'Physical (Printed)' : 'Digital (PDF)',
      subtitle: isPhys ? 'Delivered in 3-5 days' : 'Instant Download',
      description: isPhys ? 'Delivered in 3-5 days' : 'Instant Download',
      price: priceRupees,
      pricePaise: Math.round(priceRupees * 100),
      originalPrice: origRupees,
      active: true,
      deliveryOption: isPhys ? 'physical' : 'digital',
      digitalFile: isPhys ? undefined : (book.digitalFile || { filename: book.samplePdfName || `${book.id}.pdf`, fileUrl: book.pdfUrl || '' }),
    };
  }

  return null;
};

export interface ValidateAddOnsResult {
  isValid: boolean;
  error?: string;
  validAddOns: ProductAddon[];
}

/**
 * Validates selected add-on IDs against a book.
 * Fails safely if an add-on is unknown or marked inactive.
 */
export const validateSelectedAddOns = (book: Book, addOnIds: string[] = []): ValidateAddOnsResult => {
  if (!book) {
    return { isValid: false, error: 'Product not provided for add-on validation.', validAddOns: [] };
  }

  if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
    return { isValid: true, validAddOns: [] };
  }

  const validAddOns: ProductAddon[] = [];
  for (const rawId of addOnIds) {
    if (!rawId) continue;
    const addon = getProductAddOn(book, rawId);
    if (!addon) {
      return {
        isValid: false,
        error: `Unknown add-on ID "${rawId}" for product "${book.id}".`,
        validAddOns: [],
      };
    }
    if (addon.active === false) {
      return {
        isValid: false,
        error: `Add-on "${addon.name || rawId}" is inactive and cannot be purchased.`,
        validAddOns: [],
      };
    }
    validAddOns.push(addon);
  }

  return { isValid: true, validAddOns };
};

/**
 * Creates an immutable historical snapshot of an ordered product and its purchased add-ons.
 */
export const createOrderItemSnapshot = (
  book: Book,
  selectedAddOnIds: string[] = [],
  quantity = 1,
  format: 'digital' | 'physical' = 'digital'
) => {
  if (!book) throw new Error('Product is required to create order item snapshot.');
  const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));

  const isPhysical = format === 'physical';
  const basePriceRupees = isPhysical
    ? (Number(book.prices?.physical?.price) || 899)
    : (Number(book.prices?.digital?.price) || 199);
  const basePricePaise = Math.round(basePriceRupees * 100);

  const validation = validateSelectedAddOns(book, selectedAddOnIds);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const addOnsSnapshots = validation.validAddOns.map((a) => {
    const unitPaise = a.pricePaise !== undefined ? Number(a.pricePaise) : Math.round((Number(a.price) || 0) * 100);
    return {
      addOnId: a.id,
      id: a.id,
      nameSnapshot: a.name || 'Add-on Material',
      name: a.name || 'Add-on Material',
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
  if (book.buy2Get3rdFree && optionalAddons.length >= 3) {
    const sorted = [...optionalAddons].sort((a, b) => a.unitPricePaise - b.unitPricePaise);
    freeDiscountPaise = sorted[0].unitPricePaise;
  }

  const addOnsSubtotalPaise = Math.max(0, optionalAddons.reduce((sum, a) => sum + a.unitPricePaise, 0) - freeDiscountPaise);

  const totalItemUnitPricePaise = basePricePaise + addOnsSubtotalPaise;
  const totalPricePaise = totalItemUnitPricePaise * safeQty;
  const titleSnapshot = book.title || 'Study Material';

  return {
    productId: book.id,
    bookId: book.id,
    productNameSnapshot: titleSnapshot,
    title: titleSnapshot,
    format: isPhysical ? ('physical' as const) : ('digital' as const),
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
    digitalFile: book.digitalFile || {
      filename: book.samplePdfName || `${book.id}.pdf`,
      fileUrl: book.pdfUrl || '',
    },
    isBundle: Boolean((book as any).isBundle),
    bundledProductIds: (book as any).bundledProductIds || [],
  };
};

/**
 * Synchronous client coupon discount calculator for instant preview.
 */
export const validateCoupon = (code: string, subtotal: number): number => {
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
};

export interface CartReconciliationResult {
  reconciledCart: CartItem[];
  removedItems: Array<{ id: string; title: string; reason: string }>;
  modifiedItems: Array<{ id: string; title: string; changes: string }>;
  hasChanges: boolean;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validates and reconciles cart items against the authoritative catalog.
 * - Detects unavailable or inactive products and removes them.
 * - Detects unavailable or inactive add-ons and strips them.
 * - Synchronizes prices and original prices with the latest catalog values.
 * - Returns clear error messages and flags changes.
 */
export const validateAndReconcileCart = (
  cart: CartItem[],
  catalog: Book[]
): CartReconciliationResult => {
  if (!Array.isArray(cart) || cart.length === 0) {
    return {
      reconciledCart: [],
      removedItems: [],
      modifiedItems: [],
      hasChanges: false,
      isValid: true,
    };
  }

  const reconciledCart: CartItem[] = [];
  const removedItems: Array<{ id: string; title: string; reason: string }> = [];
  const modifiedItems: Array<{ id: string; title: string; changes: string }> = [];

  for (const item of cart) {
    const bookId = item.bookId || item.book?.id;
    const catalogBook = catalog.find((b) => b.id === bookId);

    // 1. Check product availability
    if (!catalogBook || catalogBook.active === false) {
      removedItems.push({
        id: bookId,
        title: item.book?.title || catalogBook?.title || bookId,
        reason: 'One of the selected products is no longer available.',
      });
      continue;
    }

    // 2. Validate and prune selected add-ons
    const selectableAddons = getSelectableAddons(catalogBook);
    const validAddonIdSet = new Set(selectableAddons.map((a) => a.id));

    const rawAddonIds = Array.isArray(item.selectedAddonIds) ? item.selectedAddonIds : [];
    const validAddonIds: string[] = [];
    let hadInvalidAddon = false;

    for (const aId of rawAddonIds) {
      if (validAddonIdSet.has(aId)) {
        validAddonIds.push(aId);
      } else {
        hadInvalidAddon = true;
      }
    }

    let targetFormat = item.format || 'digital';
    let formatSwitched = false;
    if (targetFormat === 'physical' && catalogBook.disablePaperback) {
      targetFormat = 'digital';
      formatSwitched = true;
    }

    // 3. Recalculate authoritative price from catalog
    const displayCalc = calculateDisplayPrice(catalogBook, targetFormat, validAddonIds);
    const freshPrice = displayCalc.totalPrice;
    const freshOrigPrice = displayCalc.totalOriginalPrice;

    const priceChanged = item.price !== freshPrice || item.originalPrice !== freshOrigPrice;
    const metadataChanged =
      item.book?.coverImage !== catalogBook.coverImage ||
      item.book?.imageUrl !== catalogBook.imageUrl ||
      item.book?.title !== catalogBook.title;

    if (hadInvalidAddon || priceChanged || formatSwitched) {
      modifiedItems.push({
        id: bookId,
        title: catalogBook.title,
        changes: formatSwitched
          ? 'Paperback edition is no longer available and was switched to Digital (PDF).'
          : (hadInvalidAddon
            ? 'One of the selected add-ons is no longer available and was removed.'
            : 'Product price was updated to match current catalog.'),
      });
    }

    reconciledCart.push({
      ...item,
      bookId,
      book: catalogBook,
      format: targetFormat,
      price: freshPrice,
      originalPrice: freshOrigPrice,
      selectedAddonIds: validAddonIds,
      selectedAddons: displayCalc.selectedAddons,
    });

  }

  const hasChanges = removedItems.length > 0 || modifiedItems.length > 0 || reconciledCart.some((item, i) => {
    const orig = cart[i];
    return !orig || orig.book?.coverImage !== item.book?.coverImage || orig.book?.imageUrl !== item.book?.imageUrl;
  });

  let errorMessage: string | undefined;
  if (removedItems.length > 0) {
    errorMessage = 'One of the selected products is no longer available.';
  } else if (modifiedItems.some((m) => m.changes.includes('add-ons'))) {
    errorMessage = 'One of the selected optional materials is no longer available.';
  } else if (modifiedItems.length > 0) {
    errorMessage = 'Product prices in your cart have been updated to the current catalog.';
  }

  return {
    reconciledCart,
    removedItems,
    modifiedItems,
    hasChanges,
    isValid: removedItems.length === 0 && !hasChanges,
    errorMessage,
  };
};



