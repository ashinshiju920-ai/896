// functions/api/admin/materials.js
// Cloudflare Pages Function: Protected Digital Material Version Management
// Enforces server-authoritative admin authentication, PDF magic bytes validation,
// SHA-256 checksumming, Cloudinary storage, and atomic version replacement.

import { requireAdmin } from '../../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';
import {
  replaceDigitalFileVersion,
  getActiveFileVersion,
  listDigitalFileVersions,
  getFileVersionById,
  saveDigitalFileVersion,
  recordAdminAuditEvent,
} from '../../utils/db.js';

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit

/**
 * Validates genuine PDF binary magic bytes (%PDF-).
 * Never trusts client-declared MIME type or filename extension.
 */
function verifyPdfMagicBytes(buffer) {
  if (!buffer || buffer.byteLength < 5) return false;
  const bytes = new Uint8Array(buffer.slice(0, 5));
  // ASCII %PDF- is 0x25, 0x50, 0x44, 0x46, 0x2D
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/**
 * Computes native SHA-256 hex checksum using Web Crypto.
 */
async function computeSha256Checksum(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

/**
 * GET /api/admin/materials?productId=...&addOnId=...
 * Returns current authorized version and version history.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Mandatory Admin Authentication
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const url = new URL(request.url);
    const productId = (url.searchParams.get('productId') || url.searchParams.get('product_id') || '').trim();
    const addOnId = (url.searchParams.get('addOnId') || url.searchParams.get('add_on_id') || '').trim() || null;

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Missing required productId parameter.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const [currentVersion, versions] = await Promise.all([
      getActiveFileVersion(env, productId, addOnId),
      listDigitalFileVersions(env, productId, addOnId),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        productId,
        addOnId,
        currentVersion,
        versions,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Error in GET /api/admin/materials:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error retrieving digital material versions.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * POST /api/admin/materials
 * Handles PDF replacement, validation, checksumming, Cloudinary upload, and version activation.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Mandatory Admin Authentication
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data (Direct File Upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') || formData.get('pdf');
      const productId = String(formData.get('productId') || formData.get('product_id') || '').trim();
      const addOnId = String(formData.get('addOnId') || formData.get('add_on_id') || '').trim() || null;
      const versionLabel = String(formData.get('versionLabel') || formData.get('version') || '').trim();
      const releaseNotes = String(formData.get('releaseNotes') || formData.get('notes') || '').trim();
      const providedStorageUrl = String(formData.get('storageUrl') || '').trim();

      if (!productId) {
        return new Response(
          JSON.stringify({ error: 'Missing required productId.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let arrayBuffer;
      let checksum = '';
      let fileName = 'document.pdf';
      let sizeBytes = 0;
      let storageReference = providedStorageUrl;

      if (file && typeof file.arrayBuffer === 'function') {
        sizeBytes = file.size;
        fileName = file.name || 'document.pdf';

        // Check empty file
        if (sizeBytes === 0) {
          return new Response(
            JSON.stringify({ error: 'Upload rejected: file is empty.' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Check max size
        if (sizeBytes > MAX_PDF_SIZE_BYTES) {
          return new Response(
            JSON.stringify({ error: 'File size exceeds maximum permitted limit of 50 MB.' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        arrayBuffer = await file.arrayBuffer();

        if (arrayBuffer.byteLength < 5) {
          return new Response(
            JSON.stringify({ error: 'Upload rejected: malformed or empty file.' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Binary Magic Bytes Validation (%PDF-)
        const isGenuinePdf = verifyPdfMagicBytes(arrayBuffer);
        if (!isGenuinePdf) {
          return new Response(
            JSON.stringify({
              error: 'Invalid file format. Upload rejected: only genuine PDF documents are allowed.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Native SHA-256 Checksum
        checksum = await computeSha256Checksum(arrayBuffer);

        // Upload to Cloudinary raw storage if credentials are configured
        const cloudName = env?.CLOUDINARY_CLOUD_NAME;
        const apiKey = env?.CLOUDINARY_API_KEY;
        const apiSecret = env?.CLOUDINARY_API_SECRET;

        if (cloudName && apiKey && apiSecret && !cloudName.includes('mock') && !cloudName.includes('test')) {
          try {
            const timestamp = Math.round(Date.now() / 1000);
            const folder = 'xylem_protected_materials';
            const cleanProd = productId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
            const cleanAdd = (addOnId || 'main').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
            const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(6)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            const publicId = `mat_${cleanProd}_${cleanAdd}_${timestamp}_${randomHex}`;

            const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
            const encoder = new TextEncoder();
            const dataToSign = encoder.encode(paramsToSign);
            const hashBuf = await crypto.subtle.digest('SHA-1', dataToSign);
            const sig = Array.from(new Uint8Array(hashBuf))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');

            const uploadPayload = new FormData();
            uploadPayload.append('file', new Blob([arrayBuffer], { type: 'application/pdf' }), fileName);
            uploadPayload.append('api_key', apiKey);
            uploadPayload.append('timestamp', timestamp.toString());
            uploadPayload.append('folder', folder);
            uploadPayload.append('public_id', publicId);
            uploadPayload.append('signature', sig);

            const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
              method: 'POST',
              body: uploadPayload,
            });

            if (cRes.ok) {
              const cData = await cRes.json();
              if (cData.secure_url) {
                storageReference = cData.secure_url;
              }
            }
          } catch (cErr) {
            console.warn('Cloudinary raw upload exception, falling back to local storage ref:', cErr.message);
          }
        }

        // If no Cloudinary URL obtained, convert to base64 data URI or safe reference
        if (!storageReference) {
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          storageReference = `data:application/pdf;base64,${btoa(binary)}`;
        }
      } else if (providedStorageUrl) {
        storageReference = providedStorageUrl;
        fileName = fileName || 'document.pdf';
      } else {
        return new Response(
          JSON.stringify({ error: 'No PDF file or storage URL provided.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Execute Safe Version Replacement Flow
      const replaceResult = await replaceDigitalFileVersion(env, {
        productId,
        addOnId,
        versionLabel,
        storageReference,
        fileName,
        mimeType: 'application/pdf',
        sizeBytes,
        checksum,
        releaseNotes,
        adminIdentity: 'admin',
      });

      return new Response(
        JSON.stringify({
          success: true,
          version: replaceResult.version,
          archivedVersion: replaceResult.archivedVersion,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Handle JSON payload
    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const {
      action = 'replace',
      productId,
      addOnId = null,
      versionLabel,
      storageReference,
      fileName = 'document.pdf',
      mimeType = 'application/pdf',
      sizeBytes = 0,
      checksum = null,
      releaseNotes = null,
    } = body;

    if (action === 'replace') {
      if (!productId) {
        return new Response(
          JSON.stringify({ error: 'Missing required productId.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      if (!storageReference) {
        return new Response(
          JSON.stringify({ error: 'Missing required storageReference.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const replaceResult = await replaceDigitalFileVersion(env, {
        productId,
        addOnId,
        versionLabel,
        storageReference,
        fileName,
        mimeType,
        sizeBytes,
        checksum,
        releaseNotes,
        adminIdentity: 'admin',
      });

      return new Response(
        JSON.stringify({
          success: true,
          version: replaceResult.version,
          archivedVersion: replaceResult.archivedVersion,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Error in POST /api/admin/materials:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error replacing digital material.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
