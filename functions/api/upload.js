// functions/api/upload.js
// Cloudflare Pages Function: Cloudinary Image Upload
// Hardened with requireAdmin, 5 MB limit, binary magic bytes validation, KV rate limiting, and strict CORS

import { requireAdmin } from '../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../utils/cors.js';
import { checkRateLimit } from '../utils/rateLimit.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates genuine image binary magic bytes.
 * Never trusts client-declared MIME type or filename extension.
 */
function verifyImageMagicBytes(buffer) {
  if (!buffer || buffer.byteLength < 12) return null;
  const bytes = new Uint8Array(buffer.slice(0, 12));

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: 'RIFF' .... 'WEBP'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Enforce admin authentication
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    // 2. Rate Limiting (Phase 5.3): Max 30 uploads per IP per 10 minutes
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = await checkRateLimit(env, `upload:${clientIp}`, 30, 600);

    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many upload attempts. Please wait before uploading more files.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds || 600),
            ...corsHeaders,
          },
        }
      );
    }

    // 3. Read Cloudinary credentials (Rule 2: throw 500 if missing, never fall back to literal)
    const cloudName = env && env.CLOUDINARY_CLOUD_NAME ? String(env.CLOUDINARY_CLOUD_NAME).trim() : '';
    const apiKey = env && env.CLOUDINARY_API_KEY ? String(env.CLOUDINARY_API_KEY).trim() : '';
    const apiSecret = env && env.CLOUDINARY_API_SECRET ? String(env.CLOUDINARY_API_SECRET).trim() : '';

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary credentials missing from environment');
      return new Response(
        JSON.stringify({ error: 'Media storage configuration unavailable.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image');
    const productId = formData.get('productId') || 'unassigned';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return new Response(
        JSON.stringify({ error: 'No image file provided in request.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 4. Enforce maximum file size: 5 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds maximum permitted limit of 5 MB.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 5. Verify authentic binary magic bytes (only JPEG, PNG, WebP)
    const arrayBuffer = await file.arrayBuffer();
    const verifiedMime = verifyImageMagicBytes(arrayBuffer);

    if (!verifiedMime) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file format. Upload rejected: only genuine JPEG, PNG, and WebP images are allowed.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'ecommerce_products';

    // 6. Generate filename strictly server-side (never trust client filename)
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const cleanProductId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'item';
    const serverPublicId = `product_${cleanProductId}_${timestamp}_${randomHex}`;
    const extension = verifiedMime.split('/')[1] === 'jpeg' ? 'jpg' : verifiedMime.split('/')[1];
    const serverFilename = `${serverPublicId}.${extension}`;

    // Cloudinary signature generation (SHA-1 over alphabetical key=value pairs)
    const paramsToSign = `folder=${folder}&public_id=${serverPublicId}&timestamp=${timestamp}${apiSecret}`;
    
    // Web Crypto SHA-1 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Prepare payload for Cloudinary REST API
    const uploadData = new FormData();
    uploadData.append('file', new Blob([arrayBuffer], { type: verifiedMime }), serverFilename);
    uploadData.append('api_key', apiKey);
    uploadData.append('timestamp', timestamp.toString());
    uploadData.append('folder', folder);
    uploadData.append('public_id', serverPublicId);
    uploadData.append('signature', signature);

    // Direct upload call from Cloudflare Edge to Cloudinary
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadData,
      }
    );

    const result = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok) {
      console.error('Cloudinary API upload error:', result);
      return new Response(JSON.stringify({ error: 'Image processing failed. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        productId: cleanProductId,
        mimeType: verifiedMime,
        sizeBytes: arrayBuffer.byteLength,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('Internal upload exception:', err);
    return new Response(JSON.stringify({ error: 'Internal server error during upload.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
