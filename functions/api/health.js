// functions/api/health.js
// Production Lightweight Health & Readiness Check Endpoint (Phase 12)
// Reports safe operational status without exposing DB contents, bindings, or secrets.

import { getCorsHeaders, handleOptions } from '../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  const hasDb = Boolean(env && env.DB);
  const hasKv = Boolean(env && env.PRODUCTS_KV);
  const hasCloudinaryCloudName = Boolean(env?.CLOUDINARY_CLOUD_NAME);
  const hasCloudinaryApiKey = Boolean(env?.CLOUDINARY_API_KEY);
  const hasCloudinaryApiSecret = Boolean(env?.CLOUDINARY_API_SECRET);

  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'xylem-learning-api',
      timestamp: new Date().toISOString(),
      storage: {
        databaseConfigured: hasDb,
        kvConfigured: hasKv,
        cloudinaryConfigured: hasCloudinaryCloudName && hasCloudinaryApiKey && hasCloudinaryApiSecret,
        cloudinaryCloudNameConfigured: hasCloudinaryCloudName,
        cloudinaryApiKeyConfigured: hasCloudinaryApiKey,
        cloudinaryApiSecretConfigured: hasCloudinaryApiSecret,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, max-age=0',
        ...cors,
      },
    }
  );
}
