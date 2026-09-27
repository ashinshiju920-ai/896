// functions/api/customer/change-password.js
// Customer Password Change with PBKDF2 Verification & Re-hashing

import { parseCookies, sha256Hex, hashPassword, generateRandomToken, timingSafeEqual } from '../../utils/auth.js';
import { getCustomerSessionByTokenHash, getCustomerByEmail, updateCustomerPassword } from '../../utils/db.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const cookies = parseCookies(request);
    const token = cookies['customer_session'];

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const tokenHash = await sha256Hex(token);
    const sessionData = await getCustomerSessionByTokenHash(env, tokenHash);

    if (!sessionData || !sessionData.customer) {
      return new Response(
        JSON.stringify({ error: 'Session expired. Please sign in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    const confirmNewPassword = typeof body?.confirmNewPassword === 'string' ? body.confirmNewPassword : '';

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Current password and new password are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'New password must be at least 8 characters long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (newPassword !== confirmNewPassword) {
      return new Response(
        JSON.stringify({ error: 'New password and confirmation do not match.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const fullCustomer = await getCustomerByEmail(env, sessionData.customer.email);
    if (!fullCustomer) {
      return new Response(
        JSON.stringify({ error: 'Customer record not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Verify current password
    const computedCurrentHash = await hashPassword(currentPassword, fullCustomer.password_salt);
    const isCurrentValid = timingSafeEqual(
      computedCurrentHash.trim().toLowerCase(),
      fullCustomer.password_hash.trim().toLowerCase()
    );

    if (!isCurrentValid) {
      return new Response(
        JSON.stringify({ error: 'Current password is incorrect.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Hash new password with fresh salt
    const newSalt = generateRandomToken(16);
    const newHash = await hashPassword(newPassword, newSalt);

    await updateCustomerPassword(env, fullCustomer.id, newHash, newSalt);

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  } catch (err) {
    console.error('Change password error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error updating password.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
