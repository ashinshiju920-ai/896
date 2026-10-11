import { recordOrderEvent } from './db.js';

const PORTAL_URL = 'https://portal.aylemlearning.online';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCustomerEmail(order) {
  return String(order?.customer_email || order?.shipping?.email || '').trim().toLowerCase();
}

function getCustomerName(order) {
  return String(order?.customer_name || order?.shipping?.fullName || 'there').trim();
}

function getOrderItems(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items
    .map((item) => item.productNameSnapshot || item.title || item.name || item.productId || item.bookId)
    .filter(Boolean)
    .slice(0, 8);
}

async function wasEmailAlreadySent(env, orderId) {
  if (!env?.PRODUCTS_KV || !orderId) return false;
  try {
    return Boolean(await env.PRODUCTS_KV.get(`purchase_thank_you_email_sent:${orderId}`));
  } catch {
    return false;
  }
}

async function markEmailSent(env, orderId) {
  if (!env?.PRODUCTS_KV || !orderId) return;
  try {
    await env.PRODUCTS_KV.put(
      `purchase_thank_you_email_sent:${orderId}`,
      new Date().toISOString(),
      { expirationTtl: 86400 * 365 }
    );
  } catch (err) {
    console.warn('Could not mark purchase email sent:', err?.message);
  }
}

export async function sendPurchaseThankYouEmail(env, order, { source = 'UNKNOWN' } = {}) {
  if (!order?.id || order.status !== 'PAID') {
    return { attempted: false, skipped: true, reason: 'ORDER_NOT_PAID' };
  }

  const apiKey = String(env?.RESEND_API_KEY || '').trim();
  const from = String(env?.RESEND_FROM_EMAIL || '').trim();
  const to = getCustomerEmail(order);

  if (!apiKey || !from) {
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PURCHASE_EMAIL_SKIPPED',
      rawPayload: JSON.stringify({ source, reason: 'RESEND_NOT_CONFIGURED' }),
    });
    return { attempted: false, skipped: true, reason: 'RESEND_NOT_CONFIGURED' };
  }

  if (!to) {
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PURCHASE_EMAIL_SKIPPED',
      rawPayload: JSON.stringify({ source, reason: 'NO_CUSTOMER_EMAIL' }),
    });
    return { attempted: false, skipped: true, reason: 'NO_CUSTOMER_EMAIL' };
  }

  if (await wasEmailAlreadySent(env, order.id)) {
    return { attempted: false, skipped: true, reason: 'ALREADY_SENT' };
  }

  const customerName = getCustomerName(order);
  const safeName = escapeHtml(customerName);
  const itemNames = getOrderItems(order);
  const total = Number(order.total_paise || order.amount_paise || 0) / 100;
  const currency = escapeHtml(order.currency || 'INR');
  const subject = 'Thank you for your purchase from Aylem Learning';
  const itemListHtml = itemNames.length
    ? `<ul style="padding-left:18px;margin:12px 0;color:#334155;">${itemNames.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const itemListText = itemNames.length ? `\nYour materials:\n${itemNames.map((item) => `- ${item}`).join('\n')}\n` : '';

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0a2540;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
        <p style="margin:0 0 8px;color:#00875a;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Aylem Learning</p>
        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#0a2540;">Thank you for your purchase, ${safeName}!</h1>
        <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 14px;">
          We are so happy to be part of your learning journey. Your study materials are ready, and we hope they help you prepare with more clarity, confidence, and momentum.
        </p>
        ${itemListHtml}
        <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 18px;">
          Order <strong>${escapeHtml(order.id)}</strong>${total > 0 ? ` &middot; ${currency} ${total.toFixed(2)}` : ''}
        </p>
        <a href="${PORTAL_URL}" style="display:inline-block;background:#00875a;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px;">
          Open Student Portal
        </a>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin:18px 0 0;">
          You can access your learning portal here anytime: <a href="${PORTAL_URL}" style="color:#00875a;font-weight:700;">${PORTAL_URL}</a>
        </p>
        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:22px 0 0;">
          Warm wishes,<br />Team Aylem Learning
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = `Thank you for your purchase, ${customerName}!

We are so happy to be part of your learning journey. Your study materials are ready, and we hope they help you prepare with more clarity, confidence, and momentum.
${itemListText}
Order: ${order.id}${total > 0 ? ` (${order.currency || 'INR'} ${total.toFixed(2)})` : ''}

Open your student portal here:
${PORTAL_URL}

Warm wishes,
Team Aylem Learning`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        tags: [
          { name: 'order_id', value: String(order.id).slice(0, 256) },
          { name: 'source', value: String(source).slice(0, 256) },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Resend returned ${res.status}`);
    }

    await markEmailSent(env, order.id);
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PURCHASE_EMAIL_SENT',
      rawPayload: JSON.stringify({ source, resendId: data?.id || null, to }),
    });
    return { attempted: true, success: true, id: data?.id || null };
  } catch (err) {
    await recordOrderEvent(env, {
      orderId: order.id,
      eventType: 'PURCHASE_EMAIL_FAILED',
      rawPayload: JSON.stringify({ source, error: err?.message || 'Unknown error', to }),
    });
    return { attempted: true, success: false, error: err?.message || 'Unknown error' };
  }
}

