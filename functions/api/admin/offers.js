// functions/api/admin/offers.js
// Cloudflare Pages Function: Admin Promotions & Offers Management
// Enforces server-authoritative admin authentication, validation of discount rules,
// usage caps, start/expiry windows, and audit event recording.

import { requireAdmin } from '../../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';
import {
  savePromotion,
  getPromotionByCode,
  getPromotionById,
  listPromotions,
  deletePromotion,
  recordAdminAuditEvent,
} from '../../utils/db.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

function deriveOfferStatus(offer) {
  if (!offer.active) return 'DISABLED';
  const now = Date.now();
  if (offer.startsAt || offer.starts_at) {
    const s = new Date(offer.startsAt || offer.starts_at).getTime();
    if (!isNaN(s) && s > now) return 'SCHEDULED';
  }
  if (offer.expiresAt || offer.expires_at) {
    const e = new Date(offer.expiresAt || offer.expires_at).getTime();
    if (!isNaN(e) && e < now) return 'EXPIRED';
  }
  const usageLimit = offer.usageLimit ?? offer.usage_limit;
  const timesUsed = Number(offer.timesUsed ?? offer.times_used ?? 0);
  if (usageLimit != null && timesUsed >= usageLimit) return 'EXHAUSTED';
  return 'ACTIVE';
}

/**
 * GET /api/admin/offers
 * Returns all promotions with derived status and usage stats.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const offers = await listPromotions(env);
    const enriched = offers.map((o) => ({
      ...o,
      status: deriveOfferStatus(o),
    }));

    return new Response(
      JSON.stringify({ success: true, offers: enriched, promotions: enriched }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Admin list offers error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to list offers.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * POST /api/admin/offers
 * Creates a new server-authoritative promotion.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const adminIdentity = request.headers.get('x-admin-user') || 'admin';
    const body = await request.json().catch(() => ({}));

    const code = String(body.code || '').trim().toUpperCase();
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Promotion code is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check code uniqueness
    const existing = await getPromotionByCode(env, code);
    if (existing && existing.id !== body.id) {
      return new Response(
        JSON.stringify({ error: `Promotion code "${code}" already exists.` }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const discountType = (body.discountType || body.discount_type || 'PERCENTAGE').toUpperCase();
    if (discountType !== 'PERCENTAGE' && discountType !== 'FIXED_AMOUNT') {
      return new Response(
        JSON.stringify({ error: 'Discount type must be PERCENTAGE or FIXED_AMOUNT.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const discountValue = Number(body.discountValue ?? body.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) {
      return new Response(
        JSON.stringify({ error: 'Discount value must be a positive number.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      return new Response(
        JSON.stringify({ error: 'Percentage discount cannot exceed 100%.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate dates
    if (body.startsAt && body.expiresAt) {
      const s = new Date(body.startsAt).getTime();
      const e = new Date(body.expiresAt).getTime();
      if (!isNaN(s) && !isNaN(e) && s > e) {
        return new Response(
          JSON.stringify({ error: 'Start date cannot be after expiry date.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const saved = await savePromotion(env, {
      ...body,
      code,
      discountType,
      discountValue,
    });

    await recordAdminAuditEvent(env, {
      action: 'PROMOTION_CREATED',
      targetType: 'PROMOTION',
      targetId: saved.id,
      adminIdentity,
      metadata: { code: saved.code, discountType, discountValue },
    });

    const offerWithStatus = { ...saved, status: deriveOfferStatus(saved) };
    return new Response(
      JSON.stringify({ success: true, offer: offerWithStatus, promotion: offerWithStatus }),
      { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Admin create offer error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to create offer.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * PUT /api/admin/offers
 * Updates an existing promotion.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const adminIdentity = request.headers.get('x-admin-user') || 'admin';
    const body = await request.json().catch(() => ({}));

    let existing = null;
    if (body.code) {
      existing = await getPromotionByCode(env, body.code);
    }
    if (!existing && body.id) {
      existing = await getPromotionById(env, body.id);
    }

    const merged = {
      ...(existing || {}),
      ...body,
      code: body.code || existing?.code,
    };

    if (!merged.code) {
      return new Response(
        JSON.stringify({ error: 'Offer code or ID is required for update.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const saved = await savePromotion(env, merged);

    await recordAdminAuditEvent(env, {
      action: 'PROMOTION_UPDATED',
      targetType: 'PROMOTION',
      targetId: saved.id,
      adminIdentity,
      metadata: { code: saved.code, active: saved.active },
    });

    return new Response(
      JSON.stringify({ success: true, offer: { ...saved, status: deriveOfferStatus(saved) } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Admin update offer error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to update offer.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * DELETE /api/admin/offers
 * Disables a promotion.
 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const adminIdentity = request.headers.get('x-admin-user') || 'admin';
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const id = url.searchParams.get('id');

    if (!code && !id) {
      return new Response(
        JSON.stringify({ error: 'Code or ID parameter is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    await deletePromotion(env, id || code);

    await recordAdminAuditEvent(env, {
      action: 'PROMOTION_DISABLED',
      targetType: 'PROMOTION',
      targetId: id || code,
      adminIdentity,
      metadata: { target: id || code },
    });

    return new Response(
      JSON.stringify({ success: true, message: `Promotion ${id || code} disabled.` }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Admin delete offer error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to delete offer.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
