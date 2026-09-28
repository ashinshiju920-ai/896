export type ExamCategory = 'IELTS' | 'OET' | 'PTE' | 'German' | 'All';

export type BookFormat = 'digital' | 'physical';

export type ViewType = 'home' | 'catalog' | 'product' | 'cart' | 'checkout' | 'order-success' | 'orders' | 'my-materials' | 'about' | 'admin' | 'login' | 'account';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface DigitalFileReference {
  fileVersionId?: string;
  version?: string;
  releaseNotes?: string;
  checksum?: string;
  filename?: string;
  fileUrl?: string;
  samplePdfName?: string;
  pdfUrl?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
}

export interface DigitalFileVersion {
  id: string;
  productId: string;
  addOnId?: string | null;
  versionLabel: string;
  storageReference?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  releaseNotes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  archivedAt?: string | null;
  createdBy?: string;
}

export interface ProductAddon {
  id: string;
  addOnId?: string;
  name: string;
  subtitle?: string;
  description?: string;
  price: number; // In rupees for legacy/display compatibility
  pricePaise?: number; // Authoritative integer paise (e.g. 9900)
  originalPrice: number;
  discountPercent?: number;
  active?: boolean; // Defaults to true if undefined
  deliveryOption?: 'digital' | 'physical';
  digitalFile?: DigitalFileReference;
  pdfUrl?: string;
  samplePdfName?: string;
}

export type ProductAddOn = ProductAddon;

export interface Book {
  id: string;
  title: string;
  active?: boolean;
  subtitle: string;
  category: ExamCategory;
  type: 'Study Guides' | 'Practice Books' | 'Mock Tests' | 'Vocabulary & Grammar' | 'Bundle Packs';
  isBestSeller?: boolean;
  isNew?: boolean;
  rating: number;
  reviewCount: number;
  buyersCount?: number;
  description: string;
  longDescription: string;
  features: string[];
  whatYouGet: string[];
  tableOfContents: { chapter: string; pages: string }[];
  prices: {
    digital: {
      price: number;
      originalPrice: number;
      discountPercent: number;
    };
    physical: {
      price: number;
      originalPrice: number;
      discountPercent: number;
    };
  };
  coverTheme: {
    bgGradient: string;
    accentColor: string;
    textColor: string;
    badgeText: string;
  };
  samplePdfName: string;
  pdfUrl?: string;
  digitalFile?: DigitalFileReference;
  imageUrl?: string;
  coverImage?: string;
  images?: string[];
  order?: number;
  adLink?: string;
  adText?: string;
  reviews?: Review[];
  totalPages?: number;
  addons?: ProductAddon[];
  addOns?: ProductAddon[];
  buy2Get3rdFree?: boolean;
  addonDealText?: string;
}

export interface OrderItemAddonSnapshot {
  addOnId: string;
  id?: string; // backward-compatibility alias
  nameSnapshot: string;
  name?: string; // backward-compatibility alias
  quantity: number;
  unitPricePaise: number;
  price?: number; // rupee representation for display
  deliveryOption?: 'digital' | 'physical';
  digitalFile?: DigitalFileReference | null;
}

export interface OrderItemSnapshot {
  productId: string;
  bookId?: string; // backward-compatibility alias
  productNameSnapshot: string;
  title?: string; // backward-compatibility alias
  quantity: number;
  unitPricePaise: number;
  unitPrice?: number; // rupee representation for display
  totalPricePaise?: number;
  totalPrice?: number; // rupee representation for display
  format: BookFormat;
  freeDiscount?: number;
  addOns: OrderItemAddonSnapshot[];
  selectedAddons?: Array<{
    id: string;
    name: string;
    price: number;
    pricePaise?: number;
    deliveryOption?: 'digital' | 'physical';
  }>;
  digitalFile?: DigitalFileReference | null;
}

export interface CartItem {
  bookId: string;
  productId?: string;
  book: Book;
  format: BookFormat;
  quantity: number;
  price: number;
  pricePaise?: number;
  selectedAddonIds?: string[];
  selectedAddons?: ProductAddon[];
  addOns?: OrderItemAddonSnapshot[];
  originalPrice?: number;
  freeAddonDiscount?: number;
}

export interface DigitalEntitlement {
  id: string;
  orderId: string;
  productId: string;
  addOnId?: string | null;
  title: string;
  fileReference?: DigitalFileReference | null;
  downloadUrl?: string;
  status: 'ACTIVE' | 'REVOKED';
  grantedAt: string;
}

export interface ShippingInfo {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  deliveryOption: 'digital' | 'physical';
  saveAddress: boolean;
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallets';

export interface Order {
  id: string;
  date: string;
  items: Array<CartItem | OrderItemSnapshot | any>;
  shipping: ShippingInfo;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  amount_paise?: number;
  couponCode?: string | null;
  discountPaise?: number;
  promotionSnapshot?: PromotionSnapshot | null;
  paymentMethod?: PaymentMethod | string;
  status: 'PAID' | 'PENDING' | 'confirmed' | 'dispatched' | 'delivered' | 'FAILED' | 'USER_DROPPED' | string;
  paymentId?: string;
  customerId?: string;
  isClaimed?: boolean;
  fulfillment?: {
    googleSheetUrl?: string;
    downloads?: Array<{
      bookId: string;
      entitlementId?: string;
      title: string;
      downloadUrl: string;
      type?: 'product' | 'addon';
    }>;
    materials?: Array<{
      entitlementId: string;
      name: string;
      type: 'product' | 'addon';
      available: boolean;
      productId?: string;
      addOnId?: string | null;
      downloadUrl?: string | null;
    }>;
    entitlements?: DigitalEntitlement[];
  } | null;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
  bandOrScore?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  quote: string;
  rating: number;
}

export interface ExamPath {
  category: ExamCategory;
  title: string;
  description: string;
  bgImage: string;
  badgeText?: string;
  isMedicalCross?: boolean;
  scriptWords: string[];
  redirectTarget?: 'catalog' | 'product';
  targetProductId?: string;
  arrowColor?: string;
  badgeColor?: string;
  showBadge?: boolean;
}

// -------------------------------------------------------------
// PHASE 10: PROMOTIONS, COUPONS & BUNDLES
// -------------------------------------------------------------

export type PromotionType = 'COUPON' | 'PRODUCT_OFFER' | 'BUNDLE_OFFER';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED' | 'EXHAUSTED';

export interface Promotion {
  id: string;
  code: string;
  name: string;
  type: PromotionType;
  discountType: DiscountType;
  discountValue: number; // percentage (e.g. 20) or integer paise (e.g. 5000 for ₹50)
  active: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  minimumOrderPaise: number;
  maximumDiscountPaise?: number | null;
  usageLimit?: number | null;
  timesUsed?: number;
  perCustomerLimit?: number;
  firstOrderOnly?: boolean;
  applicableProductIds?: string[];
  applicableAddOnIds?: string[];
  status?: PromotionStatus;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PromotionSnapshot {
  code: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  discountPaise: number;
  discountRupees: number;
}

export interface BundleDeal {
  id: string;
  title: string;
  description: string;
  priceRupees: number;
  pricePaise: number;
  originalPriceRupees?: number;
  productIds: string[];
  includedAddonIds?: string[];
  active: boolean;
}

// -------------------------------------------------------------
// PHASE 11: ANALYTICS & SALES FUNNEL METRICS
// -------------------------------------------------------------

export type AnalyticsEventType =
  | 'PRODUCT_VIEWED'
  | 'ADD_TO_CART'
  | 'ADDON_SELECTED'
  | 'CHECKOUT_STARTED'
  | 'PAYMENT_INITIATED'
  | 'ORDER_PAID'
  | 'COUPON_APPLIED';

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  eventDate: string;
  productId?: string | null;
  addOnId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export type AnalyticsDateFilter =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'
  | 'custom';

export interface AnalyticsSalesOverview {
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  userDroppedOrders: number;
  paidRevenuePaise: number;
  paidRevenue: number;
  averageOrderValuePaise: number;
  averageOrderValue: number;
  checkoutConversionRate: number; // percentage e.g. 42.5
}

export interface AnalyticsFunnelMetrics {
  productViews: number;
  addToCart: number;
  checkoutStarts: number;
  paymentInitiated: number;
  orderPaid: number;
  cartToCheckoutRate: number;
  checkoutToPaidRate: number;
  overallConversionRate: number;
}

export interface ProductPerformanceMetric {
  productId: string;
  title: string;
  views: number;
  addToCart: number;
  checkoutStarts: number;
  paidOrders: number;
  revenuePaise: number;
  revenue: number;
  conversionRate: number; // percentage
}

export interface AddOnPerformanceMetric {
  addOnId: string;
  name: string;
  parentProductId?: string;
  selections: number;
  paidPurchases: number;
  eligibleBasePurchases: number;
  attachmentRate: number; // (paidPurchases / eligibleBasePurchases) * 100
  revenuePaise: number;
  revenue: number;
}

export interface PromotionPerformanceMetric {
  code: string;
  name: string;
  discountType: string;
  timesUsed: number;
  paidOrders: number;
  discountGivenPaise: number;
  discountGiven: number;
  revenueGeneratedPaise: number;
  revenueGenerated: number;
}

export interface AnalyticsDashboardResponse {
  success: boolean;
  dateRange: {
    filter: AnalyticsDateFilter;
    startDate: string;
    endDate: string;
    timezone: string;
  };
  overview: AnalyticsSalesOverview;
  funnel: AnalyticsFunnelMetrics;
  topProducts: ProductPerformanceMetric[];
  addOnPerformance: AddOnPerformanceMetric[];
  promotions: PromotionPerformanceMetric[];
}



