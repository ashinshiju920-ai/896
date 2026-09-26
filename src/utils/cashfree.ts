declare global {
  interface Window {
    Cashfree?: (config: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: '_modal' | '_self' | '_blank';
      }) => Promise<{
        error?: { message: string; code?: string };
        redirect?: boolean;
        paymentDetails?: any;
      }>;
    };
  }
}

export const GOOGLE_SHEET_COPY_URL =
  'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/copy';

export const CASHFREE_PAYMENT_FORM_URL =
  'https://payments.cashfree.com/forms/study-portal-buy';

/**
 * Ensures Cashfree v3 JS SDK is injected into the DOM and initialized with correct mode (production vs sandbox).
 */
export async function loadCashfreeSDK(mode: 'sandbox' | 'production' = 'production'): Promise<any> {
  if (typeof window === 'undefined') return null;

  if (window.Cashfree) {
    return window.Cashfree({ mode });
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="cashfree.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.Cashfree) {
          resolve(window.Cashfree({ mode }));
        } else {
          reject(new Error('Cashfree SDK failed to initialize'));
        }
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree({ mode }));
      } else {
        reject(new Error('Cashfree SDK object not found on window'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK script'));
    document.head.appendChild(script);
  });
}

export interface CheckoutIntentParams {
  cart: Array<{
    bookId: string;
    addonIds?: string[];
    format?: 'digital' | 'physical';
    quantity?: number;
  }>;
  couponCode?: string | null;
  shippingInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    deliveryOption?: 'digital' | 'physical';
  };
  deliveryOption?: 'digital' | 'physical';
}

/**
 * Creates a Cashfree payment order via Cloudflare Pages endpoint.
 * STRICT RULE 3: Sends ONLY intent (IDs, format, quantities), NEVER prices or totals.
 */
export async function createCashfreeOrder(params: CheckoutIntentParams): Promise<{
  success: boolean;
  paymentSessionId: string;
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  environment?: 'sandbox' | 'production';
  isProd?: boolean;
}> {
  // Strip any accidental price or status fields before sending
  const sanitizedIntent = {
    cart: (params.cart || []).map((item) => ({
      bookId: item.bookId,
      addonIds: item.addonIds || [],
      format: item.format || 'digital',
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    })),
    couponCode: params.couponCode ? String(params.couponCode).trim() : null,
    deliveryOption: params.deliveryOption || 'digital',
    shippingInfo: {
      fullName: params.shippingInfo?.fullName || '',
      email: params.shippingInfo?.email || '',
      phone: params.shippingInfo?.phone || '',
      address: `${params.shippingInfo?.addressLine1 || ''} ${params.shippingInfo?.addressLine2 || ''}`.trim(),
      city: params.shippingInfo?.city || '',
      state: params.shippingInfo?.state || '',
      pincode: params.shippingInfo?.pinCode || '',
      deliveryOption: params.deliveryOption || params.shippingInfo?.deliveryOption || 'digital',
    },
  };

  let data: any = {};
  let res: Response;

  try {
    res = await fetch('/api/create-cashfree-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizedIntent),
    });

    data = await res.json();
  } catch (netErr: any) {
    throw new Error(netErr.message || 'Network error connecting to payment gateway.');
  }

  const sessionId = data.payment_session_id || data.paymentSessionId;
  const orderId = data.order_id || data.orderId;

  if (res.ok && sessionId) {
    return {
      success: true,
      paymentSessionId: sessionId,
      orderId,
      orderAmount: Number(data.order_amount ?? data.orderAmount ?? 0),
      orderCurrency: data.order_currency || data.orderCurrency || 'INR',
      environment: data.environment || (data.isProd ? 'production' : 'sandbox'),
      isProd: Boolean(data.isProd),
    };
  }

  const errorMessage =
    data.error ||
    data.message ||
    (data.details && (data.details.message || data.details.error)) ||
    `Payment gateway initialization failed (${res.status || 'unknown'})`;
  throw new Error(errorMessage);
}

export interface OrderStatusResponse {
  status: 'PAID' | 'PENDING' | 'FAILED' | 'USER_DROPPED' | 'NOT_FOUND';
  orderId: string;
  items?: any[];
  fulfillment?: {
    googleSheetUrl: string;
    downloads: Array<{
      bookId: string;
      title: string;
      downloadUrl: string;
    }>;
  } | null;
  total?: number;
  customerName?: string;
  customerEmail?: string;
  date?: string;
  error?: string;
}

/**
 * Calls GET /api/order-status?order_id=... to verify whether the order is confirmed as PAID.
 */
export async function checkOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  if (!orderId) {
    return { status: 'NOT_FOUND', orderId: '' };
  }

  try {
    const res = await fetch(`/api/order-status?order_id=${encodeURIComponent(orderId)}`);
    if (!res.ok) {
      return { status: 'NOT_FOUND', orderId };
    }
    const data: OrderStatusResponse = await res.json();
    return data;
  } catch (err: any) {
    return { status: 'PENDING', orderId, error: err.message };
  }
}
