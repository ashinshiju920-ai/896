const DEFAULT_PIXEL_ID = '1066331326319035';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    String(cookieHeader || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

async function sha256(value) {
  const clean = cleanString(value).toLowerCase();
  if (!clean) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizePhone(phone) {
  const digits = cleanString(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function splitName(name) {
  const parts = cleanString(name).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

function getRequestUserData(request) {
  if (!request) return {};
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const userData = {};
  const fbp = cleanString(cookies._fbp);
  const fbc = cleanString(cookies._fbc);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';
  const ua = request.headers.get('user-agent') || '';
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  return userData;
}

function getOrderItems(order) {
  if (Array.isArray(order?.items)) return order.items;
  if (typeof order?.items === 'string') {
    try {
      const parsed = JSON.parse(order.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rupeesFromPaise(paise) {
  const num = Number(paise || 0);
  return Math.round(num) / 100;
}

function buildContents(items) {
  return items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice =
      item.unitPrice !== undefined
        ? Number(item.unitPrice)
        : item.unitPricePaise !== undefined
        ? rupeesFromPaise(item.unitPricePaise)
        : item.price !== undefined
        ? Number(item.price)
        : 0;
    return {
      id: item.productId || item.bookId || item.id,
      quantity,
      item_price: unitPrice,
    };
  }).filter((item) => item.id);
}

export async function sendMetaPurchaseEvent(env, order, options = {}) {
  const accessToken = cleanString(env?.META_CAPI_ACCESS_TOKEN);
  const pixelId = cleanString(env?.META_PIXEL_ID) || DEFAULT_PIXEL_ID;
  if (!accessToken || !pixelId || !order?.id) {
    return { attempted: false, reason: 'META_CAPI_NOT_CONFIGURED' };
  }

  const items = getOrderItems(order);
  const contents = buildContents(items);
  const contentIds = contents.map((item) => item.id);
  const value = order.amount_paise !== undefined
    ? rupeesFromPaise(order.amount_paise)
    : order.total_paise !== undefined
    ? rupeesFromPaise(order.total_paise)
    : Number(order.total || 0);
  const currency = order.currency || 'INR';
  const eventId = `purchase_${order.id}`;
  const { firstName, lastName } = splitName(order.customer_name || order.shipping?.fullName || '');

  const userData = {
    ...(await sha256(order.customer_email || order.shipping?.email) ? { em: [await sha256(order.customer_email || order.shipping?.email)] } : {}),
    ...(await sha256(normalizePhone(order.customer_phone || order.shipping?.phone)) ? { ph: [await sha256(normalizePhone(order.customer_phone || order.shipping?.phone))] } : {}),
    ...(await sha256(firstName) ? { fn: [await sha256(firstName)] } : {}),
    ...(await sha256(lastName) ? { ln: [await sha256(lastName)] } : {}),
    ...getRequestUserData(options.request),
  };

  const requestUrl = options.request ? new URL(options.request.url) : null;
  const siteOrigin = cleanString(env?.SITE_URL) || requestUrl?.origin || 'https://aylemlearning.online';
  const eventSourceUrl = `${siteOrigin.replace(/\/+$/, '')}/order-success?order_id=${encodeURIComponent(order.id)}`;

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: {
          value,
          currency,
          content_type: 'product',
          content_ids: contentIds,
          contents,
          num_items: contents.reduce((sum, item) => sum + item.quantity, 0) || 1,
          order_id: order.id,
        },
      },
    ],
  };

  const testEventCode = cleanString(env?.META_TEST_EVENT_CODE);
  if (testEventCode) payload.test_event_code = testEventCode;

  const apiVersion = cleanString(env?.META_CAPI_GRAPH_VERSION) || 'v23.0';
  const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        attempted: true,
        success: false,
        status: res.status,
        error: body?.error?.message || 'Meta CAPI request failed',
      };
    }
    return {
      attempted: true,
      success: true,
      eventId,
      eventsReceived: body?.events_received,
      fbtraceId: body?.fbtrace_id,
    };
  } catch (err) {
    return {
      attempted: true,
      success: false,
      error: err?.message || 'Meta CAPI network error',
    };
  }
}
