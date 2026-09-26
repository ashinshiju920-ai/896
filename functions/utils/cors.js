// functions/utils/cors.js
// Production-Hardened CORS Configuration (Phase 5.1)
// Replaces wildcard '*' with strict origin matching and credentials support.

const PRODUCTION_ORIGINS = [
  'https://portal.xylemlearning.online',
  'https://xylemlearning.online',
];

/**
 * Checks whether an incoming origin is permitted.
 */
export function isOriginAllowed(origin, env) {
  if (!origin) return true; // Same-origin or non-browser server request

  // Explicit env override
  if (env && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN.trim()) {
    return true;
  }

  // Exact match production domains
  if (PRODUCTION_ORIGINS.includes(origin)) {
    return true;
  }

  // Cloudflare Pages preview & deployment URLs (*.pages.dev)
  if (/^https:\/\/[a-zA-Z0-9_-]+\.pages\.dev$/.test(origin)) {
    return true;
  }

  // Local development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  return false;
}

/**
 * Generates security-hardened CORS headers for a request.
 */
export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, env);

  const matchedOrigin = allowed && origin ? origin : 'https://portal.xylemlearning.online';

  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control, Pragma',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

/**
 * Standard pre-flight OPTIONS request handler.
 */
export function handleOptions(request, env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, env),
  });
}
