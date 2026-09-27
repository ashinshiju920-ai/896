// functions/api/analytics/event.js
// Public Endpoint for First-Party Funnel Event Ingestion
// Strictly non-invasive, rate-limited, and failure-isolated.
// Client can only emit non-financial funnel events:
// PRODUCT_VIEWED, ADD_TO_CART, ADDON_SELECTED, CHECKOUT_STARTED.
// PAYMENT_INITIATED and ORDER_PAID are server-authoritative and rejected here.

import { recordAnalyticsEvent, getCustomerSessionByTokenHash } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';
import { checkRateLimit } from '../../utils/rateLimit.js';
import { sha256Hex } from '../../utils/auth.js';

const ALLOWED_CLIENT_EVENTS = new Set([
  'PRODUCT_VIEWED',
  'ADD_TO_CART',
  'ADDON_SELECTED',
  'CHECKOUT_STARTED',
]);

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. IP Rate Limiting: Max 120 events per IP per 10 minutes (prevents event spam)
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = await checkRateLimit(env, `analytics:${clientIp}`, 120, 600);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await request.json().catch(() => ({}));
    const eventType = String(body.eventType || body.event_type || '').trim().toUpperCase();

    // 2. Event type authorization: Reject financial or server-only events
    if (!ALLOWED_CLIENT_EVENTS.has(eventType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Event type not permitted from client.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 3. Resolve customer ID securely from session token (DO NOT trust client-supplied customerId)
    let customerId = null;
    try {
      const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
      const cookies = Object.fromEntries(
        cookieHeader
          .split(';')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const idx = c.indexOf('=');
            if (idx === -1) return [c, ''];
            return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
          })
      );
      const custToken = cookies['customer_session'];
      if (custToken) {
        const tokenHash = await sha256Hex(custToken);
        const sessionInfo = await getCustomerSessionByTokenHash(env, tokenHash);
        if (sessionInfo && sessionInfo.customer) {
          customerId = sessionInfo.customer.id;
        }
      }
    } catch {
      customerId = null;
    }

    // 4. Sanitize parameters
    const productId = body.productId ? String(body.productId).trim().slice(0, 100) : null;
    const addOnId = body.addOnId ? String(body.addOnId).trim().slice(0, 100) : null;
    const sessionId = body.sessionId ? String(body.sessionId).trim().slice(0, 100) : null;

    // 5. Record event in D1
    const recorded = await recordAnalyticsEvent(env, {
      eventType,
      productId,
      addOnId,
      customerId,
      sessionId,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    });

    return new Response(
      JSON.stringify({ success: true, recorded }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.warn('Analytics event ingestion error (non-fatal):', err.message);
    // Failure isolation: Always return 200 to prevent client app disruption
    return new Response(
      JSON.stringify({ success: true, recorded: false }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
