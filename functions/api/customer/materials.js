// functions/api/customer/materials.js
// Authenticated Customer Study Materials & Orders API
// Single-query JOIN execution optimized for Cloudflare Free plan

import { parseCookies, sha256Hex, createSessionToken } from '../../utils/auth.js';
import {
  getCustomerSessionByTokenHash,
  getCustomerEntitlements,
  getCustomerPaidOrders,
  getActiveFileVersion,
  GOOGLE_SHEET_COPY_URL,
} from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    // 1. Mandatory server-authoritative authentication via HTTP-only cookie
    const cookies = parseCookies(request);
    const token = cookies['customer_session'];

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required to access study materials.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const tokenHash = await sha256Hex(token);
    const sessionData = await getCustomerSessionByTokenHash(env, tokenHash);

    if (!sessionData || !sessionData.customer) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired customer session. Please sign in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const customer = sessionData.customer;

    // 2. Fetch all active entitlements belonging to this customer's PAID orders (single prepared JOIN query)
    const entitlements = await getCustomerEntitlements(env, customer.id);
    const paidOrders = await getCustomerPaidOrders(env, customer.id);

    const secret =
      env?.DOWNLOAD_SIGNING_KEY ||
      env?.ADMIN_SESSION_SECRET ||
      env?.CASHFREE_SECRET_KEY ||
      'xylem_secure_download_signing_key';

    // 3. Issue fresh 24h signed download tokens for each entitled study material
    const materials = await Promise.all(
      entitlements.map(async (ent) => {
        let token = '';
        if (secret) {
          try {
            token = await createSessionToken(
              {
                orderId: ent.orderId,
                entitlementId: ent.id,
                bookId: ent.productId,
                productId: ent.productId,
                addOnId: ent.addOnId || null,
                customerId: customer.id,
                exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
              },
              secret
            );
          } catch (tokenErr) {
            console.warn('Could not generate download token for customer material:', tokenErr.message);
          }
        }

        const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
        const entParam = `&entitlement_id=${encodeURIComponent(ent.id)}`;
        const bookParam = `&book_id=${encodeURIComponent(ent.productId)}`;
        const downloadUrl = `/api/download?order_id=${encodeURIComponent(ent.orderId)}${entParam}${bookParam}${tokenParam}`;

        let activeVer = null;
        try {
          activeVer = await getActiveFileVersion(env, ent.productId, ent.addOnId);
        } catch {}

        const fileRef = ent.fileReference || {};
        const hasFile = Boolean(
          activeVer?.storageReference ||
          fileRef.fileUrl ||
          fileRef.pdfUrl ||
          fileRef.filename ||
          fileRef.samplePdfName
        );

        return {
          entitlementId: ent.id,
          orderId: ent.orderId,
          name: ent.title,
          type: ent.addOnId ? 'addon' : 'product',
          available: hasFile,
          version: activeVer?.versionLabel || fileRef.version || undefined,
          updatedAt: activeVer?.createdAt || undefined,
          productId: ent.productId,
          addOnId: ent.addOnId || null,
          purchasedAt: ent.grantedAt || ent.orderCreatedAt || '',
          status: ent.status,
          downloadUrl: hasFile ? downloadUrl : null,
        };
      })
    );

    // Format safe orders list
    const safeOrders = paidOrders.map((o) => ({
      id: o.id,
      date: o.created_at,
      total: o.total || Math.round((o.amount_paise || 0) / 100),
      currency: o.currency || 'INR',
      status: o.status,
      items: o.items || [],
    }));

    return new Response(
      JSON.stringify({
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        },
        materials,
        orders: safeOrders,
        googleSheetUrl: GOOGLE_SHEET_COPY_URL,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  } catch (err) {
    console.error('Customer materials retrieval error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error retrieving customer materials.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
