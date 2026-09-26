// functions/utils/auth.js
// Cloudflare Pages Functions Web Crypto Authentication Utility

function bufferToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUint8Array(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function hexToBytes(hex) {
  const cleanHex = hex.trim().toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password using Web Crypto PBKDF2 (SHA-256, >=100,000 iterations).
 * Matches Node crypto.pbkdf2Sync output byte-for-byte.
 */
export async function hashPassword(password, salt) {
  if (!password || !salt) {
    throw new Error('Password and salt are required for hashing');
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = typeof salt === 'string' && /^[0-9a-fA-F]{32,}$/.test(salt.trim())
    ? hexToBytes(salt.trim())
    : enc.encode(String(salt));

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Creates an HMAC-SHA256 signed session token:
 * base64url(payload) + "." + base64url(signature)
 */
export async function createSessionToken(payload, secret) {
  if (!secret) throw new Error('Secret is required to create session token');

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payloadStr = JSON.stringify(payload);
  const encodedPayload = bufferToBase64Url(enc.encode(payloadStr));
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(encodedPayload));
  const encodedSignature = bufferToBase64Url(signature);

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies an HMAC-SHA256 session token using constant-time comparison.
 * Returns decoded payload if valid and unexpired; otherwise returns null.
 */
export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.') || !secret) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlToUint8Array(encodedSignature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      enc.encode(encodedPayload)
    );

    if (!isValid) return null;

    const payloadBytes = base64UrlToUint8Array(encodedPayload);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && typeof payload.exp === 'number' && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

import { getCorsHeaders } from './cors.js';

/**
 * Middleware function that reads the session cookie, verifies it,
 * and returns HTTP 401 JSON Response if invalid or absent.
 * Returns null if authentication succeeds.
 */
export async function requireAdmin(request, env) {
  const cors = getCorsHeaders(request, env);
  const secret = env?.ADMIN_SESSION_SECRET || env?.ADMIN_PASSWORD_HASH;

  if (!secret) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error: Admin authentication is not configured.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

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

  const token = cookies['admin_session'];
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Admin authentication required' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  const session = await verifySessionToken(token, secret);
  if (!session || session.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or expired admin session' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  }

  return null;
}
