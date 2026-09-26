// functions/utils/rateLimit.js
// Cloudflare KV-Backed Sliding Window Rate Limiting (Phase 5.3)

/**
 * Checks and records rate limits backed by Cloudflare KV.
 *
 * @param {object} env Cloudflare environment bindings
 * @param {string} key Unique identifier (e.g. 'order:<ip>' or 'upload:<ip>')
 * @param {number} limit Maximum permitted requests within the window
 * @param {number} windowSeconds Duration of the rate limiting window in seconds
 * @returns {Promise<{ allowed: boolean, remaining: number, resetSeconds: number }>}
 */
export async function checkRateLimit(env, key, limit = 20, windowSeconds = 60) {
  if (!env || !env.PRODUCTS_KV) {
    // If KV is not bound (e.g. local unit tests without KV), allow gracefully
    return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  }

  const rateKey = `ratelimit:${key}`;

  try {
    const raw = await env.PRODUCTS_KV.get(rateKey);
    const count = raw ? parseInt(raw, 10) || 0 : 0;

    if (count >= limit) {
      return { allowed: false, remaining: 0, resetSeconds: windowSeconds };
    }

    const nextCount = count + 1;
    await env.PRODUCTS_KV.put(rateKey, String(nextCount), { expirationTtl: windowSeconds });

    return { allowed: true, remaining: limit - nextCount, resetSeconds: windowSeconds };
  } catch (err) {
    console.warn('Rate limit KV check warning:', err.message);
    return { allowed: true, remaining: 1, resetSeconds: windowSeconds };
  }
}
