// functions/api/download.js
// Server-Side Protected Study Material Download Gate
// Unlocks downloads ONLY for orders verified as PAID in D1 / KV
// Delivers authentic configured PDFs with mandatory signed session token verification

import {
  getOrder,
  recordOrderEvent,
  getEntitlementsByOrderId,
  createEntitlementsForPaidOrder,
  getCustomerSessionByTokenHash,
  getActiveFileVersion,
  getFileVersionById,
} from '../utils/db.js';
import { loadCatalogue } from '../utils/pricing.js';
import { verifySessionToken, parseCookies, sha256Hex } from '../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../utils/cors.js';
import { checkRateLimit } from '../utils/rateLimit.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const url = new URL(request.url, 'http://localhost');
    const orderId = (url.searchParams.get('order_id') || url.searchParams.get('orderId') || '').trim();
    const bookId = (url.searchParams.get('book_id') || url.searchParams.get('productId') || '').trim();
    const entitlementId = (url.searchParams.get('entitlement_id') || url.searchParams.get('entitlementId') || '').trim();
    const token = (url.searchParams.get('token') || url.searchParams.get('download_token') || '').trim();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id parameter.' }),
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

    // 2. Token Security Verification: Mandatory signed authorization token
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Access denied: download token is required.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const secret =
      env?.DOWNLOAD_SIGNING_KEY ||
      env?.ADMIN_SESSION_SECRET ||
      env?.CASHFREE_SECRET_KEY ||
      'xylem_secure_download_signing_key';

    const tokenPayload = await verifySessionToken(token, secret);
    if (!tokenPayload) {
      return new Response(
        JSON.stringify({ error: 'Access denied: invalid or expired download token.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Verify token order binding
    if (!tokenPayload.orderId || tokenPayload.orderId !== orderId) {
      return new Response(
        JSON.stringify({ error: 'Access denied: token does not match requested order.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 3. Verify order in D1 / KV
    const order = await getOrder(env, orderId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Access denied: order not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 4. Verify payment status is strictly PAID
    if (order.status !== 'PAID') {
      return new Response(
        JSON.stringify({ error: 'Payment required: order has not been confirmed as PAID.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 4b. Cross-Customer Security: Prevent Customer A from downloading Customer B's order
    if (order.customer_id) {
      if (tokenPayload.customerId && tokenPayload.customerId !== order.customer_id) {
        return new Response(
          JSON.stringify({ error: 'Access denied: token does not match order owner.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      const cookies = parseCookies(request);
      if (cookies['customer_session']) {
        try {
          const sessHash = await sha256Hex(cookies['customer_session']);
          const sess = await getCustomerSessionByTokenHash(env, sessHash);
          if (sess && sess.customer && sess.customer.id !== order.customer_id) {
            return new Response(
              JSON.stringify({ error: 'Access denied: order belongs to another customer account.' }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
            );
          }
        } catch {}
      }
    }

    // 5. Verify Digital Entitlement exists and belongs to this order
    let entitlements = await getEntitlementsByOrderId(env, order.id);
    if (!entitlements || entitlements.length === 0) {
      entitlements = await createEntitlementsForPaidOrder(env, order);
    }

    const targetEntitlementId = entitlementId || tokenPayload.entitlementId;
    const targetBookId = bookId || tokenPayload.bookId || tokenPayload.productId;
    const targetAddonId = tokenPayload.addOnId || null;

    // Cross-check token parameters against URL parameters if both provided
    if (tokenPayload.entitlementId && entitlementId && tokenPayload.entitlementId !== entitlementId) {
      return new Response(
        JSON.stringify({ error: 'Access denied: token entitlement mismatch.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
    if (tokenPayload.bookId && bookId && tokenPayload.bookId !== bookId && tokenPayload.bookId !== targetAddonId) {
      return new Response(
        JSON.stringify({ error: 'Access denied: token product mismatch.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    let matchingEntitlement = null;
    if (targetEntitlementId) {
      matchingEntitlement = entitlements.find((e) => e.id === targetEntitlementId);
    }
    if (!matchingEntitlement && targetBookId) {
      matchingEntitlement = entitlements.find(
        (e) => (e.productId === targetBookId || e.addOnId === targetBookId)
      );
    }

    if (!matchingEntitlement) {
      return new Response(
        JSON.stringify({ error: 'Access denied: no active entitlement found for this order.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Check entitlement ownership and active status
    if (matchingEntitlement.orderId !== order.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied: entitlement does not belong to this order.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
    if (matchingEntitlement.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: 'Access denied: entitlement is not active.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 5b. Safe Version Resolution & Protection (Phase 9)
    // Archived files must remain protected. Customer cannot submit arbitrary version IDs.
    const requestedVersionId = (url.searchParams.get('file_version_id') || url.searchParams.get('version_id') || url.searchParams.get('versionId') || '').trim();
    if (requestedVersionId) {
      const requestedVer = await getFileVersionById(env, requestedVersionId);
      if (requestedVer) {
        if (requestedVer.status === 'ARCHIVED') {
          return new Response(
            JSON.stringify({ error: 'Access denied: requested file version is archived and cannot be downloaded.' }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
          );
        }
        if (
          requestedVer.productId !== matchingEntitlement.productId ||
          (matchingEntitlement.addOnId && requestedVer.addOnId !== matchingEntitlement.addOnId)
        ) {
          return new Response(
            JSON.stringify({ error: 'Access denied: requested version does not match authorized material.' }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
          );
        }
      }
    }

    // 6. Resolve digital file reference
    // Lifetime Entitlement Continuity: Always resolves to the CURRENT AUTHORIZED ACTIVE VERSION.
    let resolvedPdfUrl = '';
    let resolvedFilename = '';
    let currentVersionLabel = '';
    let currentVersionId = '';

    // A. First check authoritative digital_file_versions table / KV
    const activeVersion = await getActiveFileVersion(env, matchingEntitlement.productId, matchingEntitlement.addOnId);
    if (activeVersion && activeVersion.status === 'ACTIVE' && activeVersion.storageReference) {
      resolvedPdfUrl = activeVersion.storageReference;
      resolvedFilename = activeVersion.fileName;
      currentVersionLabel = activeVersion.versionLabel;
      currentVersionId = activeVersion.id;
    }

    // B. Check KV catalog current digitalFile / pdfUrl
    if (!resolvedPdfUrl) {
      const catalog = await loadCatalogue(env);
      const book = catalog.find((b) => b.id === matchingEntitlement.productId);
      if (book) {
        if (!matchingEntitlement.addOnId) {
          resolvedPdfUrl = book.digitalFile?.fileUrl || book.pdfUrl || '';
          resolvedFilename = book.digitalFile?.filename || book.samplePdfName || '';
          currentVersionLabel = book.digitalFile?.version || '';
          currentVersionId = book.digitalFile?.fileVersionId || '';
        } else {
          const addOns = book.addons || book.addOns || [];
          const addOn = addOns.find((a) => (a.id || a.addOnId) === matchingEntitlement.addOnId);
          if (addOn) {
            resolvedPdfUrl = addOn.digitalFile?.fileUrl || addOn.pdfUrl || '';
            resolvedFilename = addOn.digitalFile?.filename || addOn.samplePdfName || '';
            currentVersionLabel = addOn.digitalFile?.version || '';
            currentVersionId = addOn.digitalFile?.fileVersionId || '';
          }
        }
      }
    }

    // C. Backward-compatibility: Check entitlement's stored fileReference snapshot
    if (!resolvedPdfUrl) {
      const fileRef = matchingEntitlement.fileReference || {};
      resolvedPdfUrl = fileRef.fileUrl || fileRef.pdfUrl || '';
      resolvedFilename = fileRef.filename || fileRef.samplePdfName || '';
      currentVersionLabel = fileRef.version || '';
      currentVersionId = fileRef.fileVersionId || '';
    }

    // D. Check order items snapshot fallback
    if (!resolvedPdfUrl) {
      const items = Array.isArray(order.items) ? order.items : [];
      const item = items.find((it) => (it.productId || it.bookId || it.id) === matchingEntitlement.productId);
      if (item) {
        if (!matchingEntitlement.addOnId) {
          if (item.digitalFile?.fileUrl) resolvedPdfUrl = item.digitalFile.fileUrl;
          if (item.digitalFile?.filename) resolvedFilename = item.digitalFile.filename;
          if (!resolvedPdfUrl && item.pdfUrl) resolvedPdfUrl = item.pdfUrl;
        } else {
          const itemAddOns = item.addOns || item.selectedAddons || [];
          const matchingAddon = itemAddOns.find((a) => (a.addOnId || a.id) === matchingEntitlement.addOnId);
          if (matchingAddon) {
            if (matchingAddon.digitalFile?.fileUrl) resolvedPdfUrl = matchingAddon.digitalFile.fileUrl;
            if (matchingAddon.digitalFile?.filename) resolvedFilename = matchingAddon.digitalFile.filename;
            if (!resolvedPdfUrl && matchingAddon.pdfUrl) resolvedPdfUrl = matchingAddon.pdfUrl;
          }
        }
      }
    }

    if (!resolvedPdfUrl) {
      return new Response(
        JSON.stringify({ error: 'Material temporarily unavailable. Please try again later.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 7. Sanitize filename to prevent header injection
    const defaultName = `${(matchingEntitlement.title || 'Xylem_Learning_Material').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const filename = (resolvedFilename || defaultName).replace(/[\r\n"\\/]/g, '_');

    let pdfBytes;

    if (resolvedPdfUrl.startsWith('data:')) {
      // Base64 data URI
      try {
        const base64Data = resolvedPdfUrl.split(',')[1] || '';
        const binaryStr = atob(base64Data);
        pdfBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          pdfBytes[i] = binaryStr.charCodeAt(i);
        }
      } catch {
        return new Response(
          JSON.stringify({ error: 'Material temporarily unavailable. Please try again later.' }),
          { status: 503, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
    } else if (resolvedPdfUrl.startsWith('http://') || resolvedPdfUrl.startsWith('https://')) {
      // Server-side fetch from authenticated storage or CDN
      try {
        const upstreamRes = await fetch(resolvedPdfUrl, {
          headers: {
            'User-Agent': 'Xylem-Learning-Fulfillment-Engine/1.0',
          },
        });

        if (!upstreamRes.ok) {
          console.warn(`Upstream PDF fetch failed (${upstreamRes.status}) for entitlement ${matchingEntitlement.id}`);
          return new Response(
            JSON.stringify({ error: 'Material temporarily unavailable. Please try again later.' }),
            { status: 503, headers: { 'Content-Type': 'application/json', ...cors } }
          );
        }

        const arrayBuffer = await upstreamRes.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
      } catch (fetchErr) {
        console.warn(`Upstream PDF fetch exception for entitlement ${matchingEntitlement.id}:`, fetchErr.message);
        return new Response(
          JSON.stringify({ error: 'Material temporarily unavailable. Please try again later.' }),
          { status: 503, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Material temporarily unavailable. Please try again later.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // 8. Record audit event
    try {
      await recordOrderEvent(env, {
        orderId: order.id,
        eventType: 'DIGITAL_DOWNLOAD',
        rawPayload: JSON.stringify({
          entitlementId: matchingEntitlement.id,
          productId: matchingEntitlement.productId,
          addOnId: matchingEntitlement.addOnId,
          versionId: currentVersionId || undefined,
          version: currentVersionLabel || undefined,
          filename,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (auditErr) {
      console.warn('Failed to record digital download audit event:', auditErr.message);
    }

    // 9. Return secure PDF stream with non-sniff and no-store headers
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
