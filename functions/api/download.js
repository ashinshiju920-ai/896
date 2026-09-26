// functions/api/download.js
// Server-Side Protected Study Material Download Gate
// Unlocks downloads ONLY for orders verified as PAID in D1 / KV
// Delivers authentic configured PDFs with zero placeholder fallback

import { getOrder, recordOrderEvent } from '../utils/db.js';
import { loadCatalogue } from '../utils/pricing.js';
import { verifySessionToken } from '../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../utils/cors.js';
import { checkRateLimit } from '../utils/rateLimit.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const url = new URL(request.url);
    const orderId = (url.searchParams.get('order_id') || url.searchParams.get('orderId') || '').trim();
    const bookId = (url.searchParams.get('book_id') || url.searchParams.get('productId') || '').trim();
    const token = (url.searchParams.get('token') || url.searchParams.get('download_token') || '').trim();

    if (!orderId || !bookId) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or book_id parameters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 1. Rate Limiting: Max 30 download attempts per IP per minute
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = await checkRateLimit(env, `download:${clientIp}`, 30, 60);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many download requests. Please wait before retrying.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds || 60),
            ...cors,
          },
        }
      );
    }

    // 2. Token Security Verification (if token is provided)
    if (token) {
      const secret =
        env?.DOWNLOAD_SIGNING_KEY ||
        env?.ADMIN_SESSION_SECRET ||
        env?.CASHFREE_SECRET_KEY ||
        'xylem_secure_download_signing_key';

      const tokenPayload = await verifySessionToken(token, secret);
      if (!tokenPayload) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired download token.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      if (tokenPayload.orderId !== orderId || tokenPayload.bookId !== bookId) {
        return new Response(
          JSON.stringify({ error: 'Download token does not match requested order or product.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
    }

    // 3. Verify order in D1 / KV
    const order = await getOrder(env, orderId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 4. Verify payment status is strictly PAID
    if (order.status !== 'PAID') {
      return new Response(
        JSON.stringify({ error: 'Payment required. This order has not been confirmed as PAID.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 5. Verify book in order items & verify digital entitlement
    const items = Array.isArray(order.items) ? order.items : [];
    const matchingItem = items.find((it) => (it.bookId || it.id) === bookId);
    if (!matchingItem) {
      return new Response(
        JSON.stringify({ error: 'The requested item is not part of this purchased order.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const itemFormat = matchingItem.format || matchingItem.deliveryOption;
    if (itemFormat !== 'digital') {
      return new Response(
        JSON.stringify({ error: 'The requested item is a physical-only product with no digital download.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 6. Find book details in KV catalogue
    const catalog = await loadCatalogue(env);
    const book = catalog.find((b) => b.id === bookId);

    // CRITICAL: REMOVE PLACEHOLDER PDF BEHAVIOR
    // If no book in catalog or no pdfUrl configured, return safe error (never generate fake PDF)
    if (!book || !book.pdfUrl) {
      return new Response(
        JSON.stringify({
          error: 'Your digital book is temporarily unavailable. Please contact support.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 7. Deliver authentic configured PDF
    const filename =
      book.samplePdfName ||
      `${(book.title || 'Xylem_Learning_Book').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    let pdfBytes;

    if (book.pdfUrl.startsWith('data:')) {
      // Base64 data URI (e.g. uploaded via admin)
      try {
        const base64Data = book.pdfUrl.split(',')[1] || '';
        const binaryStr = atob(base64Data);
        pdfBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          pdfBytes[i] = binaryStr.charCodeAt(i);
        }
      } catch (decodeErr) {
        return new Response(
          JSON.stringify({ error: 'Your digital book is temporarily unavailable. Please contact support.' }),
          { status: 503, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
    } else if (book.pdfUrl.startsWith('http://') || book.pdfUrl.startsWith('https://')) {
      // Server-side fetch from private/authenticated cloud storage or upstream CDN
      try {
        const upstreamRes = await fetch(book.pdfUrl, {
          headers: {
            'User-Agent': 'Xylem-Learning-Fulfillment-Engine/1.0',
          },
        });

        if (!upstreamRes.ok) {
          console.warn(`Upstream PDF fetch failed (${upstreamRes.status}) for book ${bookId}`);
          return new Response(
            JSON.stringify({ error: 'Your digital book is temporarily unavailable. Please contact support.' }),
            { status: 503, headers: { 'Content-Type': 'application/json', ...cors } }
          );
        }

        const arrayBuffer = await upstreamRes.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
      } catch (fetchErr) {
        console.warn(`Upstream PDF fetch exception for book ${bookId}:`, fetchErr.message);
        return new Response(
          JSON.stringify({ error: 'Your digital book is temporarily unavailable. Please contact support.' }),
          { status: 503, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Your digital book is temporarily unavailable. Please contact support.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 8. Record audit event
    try {
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'DIGITAL_DOWNLOAD',
        rawPayload: JSON.stringify({
          bookId,
          filename,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (auditErr) {
      console.warn('Failed to record digital download audit event:', auditErr.message);
    }

    // 9. Return secure PDF stream / binary with non-sniff and no-store headers
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        ...cors,
      },
    });
  } catch (err) {
    console.error('Error in download handler:', err);
    return new Response(
      JSON.stringify({ error: 'Error retrieving download.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
