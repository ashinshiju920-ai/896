import { Book, ProductAddon } from '../types';

/**
 * Returns the list of add-ons/formats for a book (up to 4).
 * If the book does not have custom addons defined, falls back to legacy digital & physical prices.
 */
export const getBookAddons = (book: Book): ProductAddon[] => {
  if (book && Array.isArray(book.addons) && book.addons.length > 0) {
    return book.addons.slice(0, 4);
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
  const selected = addons.filter((a) => selectedIds.includes(a.id));
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
