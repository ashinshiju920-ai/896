import {
  PII_DATA_TYPE,
  createMetaParamContext,
  getClientIpFromBuilderOrCookie,
  getNormalizedAndHashedPII,
} from './metaParamBuilder.js';

const DEFAULT_PIXEL_ID = '1066331326319035';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitName(name) {
  const parts = cleanString(name).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

function getRequestUserData(request, builder) {
  if (!request || !builder) return {};
  const userData = {};
  const fbp = cleanString(builder.getFbp?.());
  const fbc = cleanString(builder.getFbc?.());
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const ip = getClientIpFromBuilderOrCookie(builder, request);
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
  const { builder } = createMetaParamContext(options.request);
  const email = getNormalizedAndHashedPII(builder, order.customer_email || order.shipping?.email, PII_DATA_TYPE.EMAIL);
  const phone = getNormalizedAndHashedPII(builder, order.customer_phone || order.shipping?.phone, PII_DATA_TYPE.PHONE);
  const hashedFirstName = getNormalizedAndHashedPII(builder, firstName, PII_DATA_TYPE.FIRST_NAME);
  const hashedLastName = getNormalizedAndHashedPII(builder, lastName, PII_DATA_TYPE.LAST_NAME);

  const userData = {
    ...(email ? { em: [email] } : {}),
    ...(phone ? { ph: [phone] } : {}),
    ...(hashedFirstName ? { fn: [hashedFirstName] } : {}),
    ...(hashedLastName ? { ln: [hashedLastName] } : {}),
    ...getRequestUserData(options.request, builder),
  };

  const requestUrl = options.request ? new URL(options.request.url) : null;
  const siteOrigin = cleanString(env?.SITE_URL) || requestUrl?.origin || 'https://aylemlearning.online';
  const eventSourceUrl =
    cleanString(builder.getEventSourceUrl?.()) ||
    `${siteOrigin.replace(/\/+$/, '')}/order-success?order_id=${encodeURIComponent(order.id)}`;
  const referrerUrl = cleanString(builder.getReferrerUrl?.());

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        ...(referrerUrl ? { referrer_url: referrerUrl } : {}),
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
