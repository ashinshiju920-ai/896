// functions/api/products.js
// Cloudflare Pages Function: Products & Catalog Management
// Hardened with requireAdmin, 1 MB payload cap, and strict field size-capping & schema validation

import { requireAdmin } from '../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../utils/cors.js';

function getResponseHeaders(request, env) {
  const cors = getCorsHeaders(request, env);
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    ...cors,
  };
}

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB limit

function sanitizeString(val, maxLength = 250) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLength);
}

function sanitizeNumber(val, min = 0, max = 10000000, fallback = 0) {
  const num = Number(val);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

/**
 * Validates and strictly size-caps each field of a product record.
 */
function sanitizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const rawId = sanitizeString(raw.id, 64);
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '') || `prod_${Date.now()}`;

  const digitalPrice = sanitizeNumber(raw.prices?.digital?.price, 0, 100000, 499);
  const digitalOrig = sanitizeNumber(raw.prices?.digital?.originalPrice, digitalPrice, 100000, 999);
  const physicalPrice = sanitizeNumber(raw.prices?.physical?.price, 0, 100000, 899);
  const physicalOrig = sanitizeNumber(raw.prices?.physical?.originalPrice, physicalPrice, 100000, 1499);

  const images = Array.isArray(raw.images)
    ? raw.images.map((img) => sanitizeString(img, 500)).filter(Boolean).slice(0, 8)
    : (raw.imageUrl ? [sanitizeString(raw.imageUrl, 500)] : []);

  const features = Array.isArray(raw.features)
    ? raw.features.map((f) => sanitizeString(f, 300)).filter(Boolean).slice(0, 30)
    : [];

  const whatYouGet = Array.isArray(raw.whatYouGet)
    ? raw.whatYouGet.map((w) => sanitizeString(w, 300)).filter(Boolean).slice(0, 30)
    : [];

  let cleanAddons = Array.isArray(raw.addons) && raw.addons.length > 0
    ? raw.addons.slice(0, 10).map((a) => {
        const rawId = sanitizeString(a.id, 64) || 'addon';
        const normId = rawId === 'addon_digital' ? 'digital' : (rawId === 'addon_physical' ? 'physical' : rawId);
        return {
          id: normId,
          name: sanitizeString(a.name, 100) || (normId === 'physical' ? 'Physical (Printed)' : 'Digital (PDF)'),
          subtitle: sanitizeString(a.subtitle, 150),
          price: sanitizeNumber(a.price, 0, 100000, normId === 'physical' ? physicalPrice : digitalPrice),
          originalPrice: sanitizeNumber(a.originalPrice, 0, 100000, normId === 'physical' ? physicalOrig : digitalOrig),
          deliveryOption: a.deliveryOption === 'physical' || normId === 'physical' ? 'physical' : 'digital',
        };
      })
    : [
        {
          id: 'digital',
          name: 'Digital (PDF)',
          subtitle: 'Instant Download',
          price: digitalPrice,
          originalPrice: digitalOrig,
          deliveryOption: 'digital',
        },
        {
          id: 'physical',
          name: 'Physical (Printed)',
          subtitle: 'Delivered in 3-5 days',
          price: physicalPrice,
          originalPrice: physicalOrig,
          deliveryOption: 'physical',
        },
      ];

  // Guarantee digital and physical addons stay synchronized with prices if provided
  cleanAddons = cleanAddons.map((addon) => {
    if (addon.id === 'digital' && raw.prices?.digital?.price !== undefined) {
      return { ...addon, price: digitalPrice, originalPrice: digitalOrig };
    }
    if (addon.id === 'physical' && raw.prices?.physical?.price !== undefined) {
      return { ...addon, price: physicalPrice, originalPrice: physicalOrig };
    }
    return addon;
  });

  const addons = cleanAddons;

  const reviews = Array.isArray(raw.reviews)
    ? raw.reviews.slice(0, 100).map((r) => ({
        id: sanitizeString(r.id, 64) || `rev_${Date.now()}`,
        author: sanitizeString(r.author, 100) || 'Learner',
        rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
        comment: sanitizeString(r.comment, 2000),
        date: sanitizeString(r.date, 50) || new Date().toISOString().slice(0, 10),
        verified: Boolean(r.verified),
        bandOrScore: sanitizeString(r.bandOrScore, 50),
      }))
    : [];

  return {
    id: cleanId,
    title: sanitizeString(raw.title, 200) || 'Study Material',
    subtitle: sanitizeString(raw.subtitle, 300),
    category: sanitizeString(raw.category, 50) || 'General',
    type: sanitizeString(raw.type, 50) || 'Study Guides',
    description: sanitizeString(raw.description, 5000),
    longDescription: sanitizeString(raw.longDescription, 10000),
    imageUrl: sanitizeString(raw.imageUrl, 500) || (images[0] || ''),
    coverImage: sanitizeString(raw.coverImage, 500) || (images[0] || ''),
    images,
    badge: sanitizeString(raw.badge, 50),
    badgeColor: sanitizeString(raw.badgeColor, 30),
    rating: Math.max(1, Math.min(5, Number(raw.rating) || 4.8)),
    reviewCount: sanitizeNumber(raw.reviewCount, 0, 1000000, 0),
    author: sanitizeString(raw.author, 100) || 'Xylem Learning',
    samplePdfName: sanitizeString(raw.samplePdfName, 100) || 'Official_Prep_Guide.pdf',
    pdfUrl: sanitizeString(raw.pdfUrl, 500),
    prices: {
      digital: { price: digitalPrice, originalPrice: digitalOrig },
      physical: { price: physicalPrice, originalPrice: physicalOrig },
    },
    features,
    whatYouGet,
    addons,
    buy2Get3rdFree: Boolean(raw.buy2Get3rdFree),
    reviews,
    order: sanitizeNumber(raw.order, 0, 1000, 0),
  };
}

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const responseHeaders = getResponseHeaders(request, env);

  try {
    const url = new URL(request.url);
    const checkOnly = url.searchParams.get('check') === 'version';

    // Determine whether caller is authenticated admin
    const authErr = await requireAdmin(request, env);
    const isAdmin = !authErr;

    const sanitizeBooks = (books) => {
      if (!Array.isArray(books)) return [];
      if (isAdmin) return books;
      return books.map((b) => {
        const { pdfUrl, ...safeBook } = b;
        return safeBook;
      });
    };

    // 1. Cloudflare KV retrieval (authoritative storage)
    if (env && env.PRODUCTS_KV) {
      if (checkOnly) {
        const version = await env.PRODUCTS_KV.get('xylem_products_version');
        if (version) {
          return new Response(JSON.stringify({ success: true, version: Number(version) }), {
            status: 200,
            headers: responseHeaders,
          });
        }
      }

      const data = await env.PRODUCTS_KV.get('xylem_products', { type: 'json' });
      if (data && Array.isArray(data.books)) {
        if (checkOnly) {
          return new Response(
            JSON.stringify({
              success: true,
              version: data.version || 0,
              count: data.count || data.books.length,
            }),
            {
              status: 200,
              headers: responseHeaders,
            }
          );
        }
        return new Response(
          JSON.stringify({ success: true, ...data, books: sanitizeBooks(data.books) }),
          {
            status: 200,
            headers: responseHeaders,
          }
        );
      }
    }

    // 2. Cloudinary raw storage fallback
    const cloudName = env?.CLOUDINARY_CLOUD_NAME;
    if (cloudName) {
      const rawUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/xylem_products_live.json?_t=${Date.now()}`;
      const res = await fetch(rawUrl, { cache: 'no-store' });

      if (res.ok) {
        const data = await res.json();
        if (checkOnly) {
          return new Response(
            JSON.stringify({
              success: true,
              version: data.version || 0,
              count: data.count || data.books?.length || 0,
            }),
            {
              status: 200,
              headers: responseHeaders,
            }
          );
        }
        return new Response(
          JSON.stringify({ success: true, ...data, books: sanitizeBooks(data.books) }),
          {
            status: 200,
            headers: responseHeaders,
          }
        );
      }
    }

    return new Response(JSON.stringify({ success: false, message: 'No remote catalog initialized yet' }), {
      status: 404,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Products GET error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch products catalog.' }), {
      status: 500,
      headers: responseHeaders,
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const responseHeaders = getResponseHeaders(request, env);

  try {
    // 1. Enforce admin authentication
    const authError = await requireAdmin(request, env);
    if (authError) return authError;

    // 2. Reject payloads exceeding 1 MB limit (Rule 4.5)
    const rawBody = await request.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({
          error: `Payload too large. Request body of ${rawBody.length} bytes exceeds 1 MB limit.`,
        }),
        {
          status: 413,
          headers: responseHeaders,
        }
      );
    }

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload.' }),
        { status: 400, headers: responseHeaders }
      );
    }

    const cloudName = env?.CLOUDINARY_CLOUD_NAME;
    const apiKey = env?.CLOUDINARY_API_KEY;
    const apiSecret = env?.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary credentials missing in environment');
      return new Response(
        JSON.stringify({ error: 'Catalog storage configuration is unavailable.' }),
        {
          status: 500,
          headers: responseHeaders,
        }
      );
    }

    let currentCatalog = null;
    if (env && env.PRODUCTS_KV) {
      try {
        currentCatalog = await env.PRODUCTS_KV.get('xylem_products', { type: 'json' });
      } catch {}
    }
    if (!currentCatalog) {
      try {
        const cRes = await fetch(
          `https://res.cloudinary.com/${cloudName}/raw/upload/xylem_products_live.json?_t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (cRes.ok) currentCatalog = await cRes.json();
      } catch {}
    }

    let rawBooks = payload.books;

    // Handle single-product image update action directly
    if (payload.action === 'update-product-image' && payload.productId && payload.imageUrl) {
      const existingBooks = currentCatalog && Array.isArray(currentCatalog.books) ? currentCatalog.books : [];
      const prodId = sanitizeString(payload.productId, 64);
      const cleanImg = sanitizeString(payload.imageUrl, 500);

      const idx = existingBooks.findIndex(
        (b) => b.id === prodId || (b.title && b.title.toLowerCase().includes(prodId.toLowerCase()))
      );

      if (idx !== -1) {
        const targetBook = existingBooks[idx];
        const slot = Math.max(0, Math.min(3, Number(payload.slotIndex) || 0));
        const currentImages = Array.isArray(targetBook.images) && targetBook.images.length > 0
          ? [...targetBook.images]
          : (targetBook.imageUrl ? [targetBook.imageUrl] : []);

        currentImages[slot] = cleanImg;
        const nextImages = currentImages.filter(Boolean).slice(0, 4);

        existingBooks[idx] = {
          ...targetBook,
          images: nextImages,
          imageUrl: slot === 0 || !targetBook.imageUrl ? cleanImg : targetBook.imageUrl,
        };
      }
      rawBooks = existingBooks;
    }

    if (!Array.isArray(rawBooks)) {
      rawBooks = currentCatalog && Array.isArray(currentCatalog.books) ? currentCatalog.books : [];
    }

    // 3. Size-cap and validate every field of each product (Rule 4.5)
    const sanitizedBooks = rawBooks
      .slice(0, 200)
      .map(sanitizeProduct)
      .filter(Boolean);

    // Sanitize exam paths and testimonials
    const rawExamPaths = Array.isArray(payload.examPaths) ? payload.examPaths : currentCatalog?.examPaths;
    const sanitizedExamPaths = Array.isArray(rawExamPaths)
      ? rawExamPaths.slice(0, 20).map((p) => ({
          category: sanitizeString(p.category, 50),
          title: sanitizeString(p.title, 100),
          description: sanitizeString(p.description, 500),
          bgImage: sanitizeString(p.bgImage, 500),
          badgeText: sanitizeString(p.badgeText, 50),
          isMedicalCross: Boolean(p.isMedicalCross),
          scriptWords: Array.isArray(p.scriptWords) ? p.scriptWords.map((s) => sanitizeString(s, 50)).slice(0, 5) : [],
          redirectTarget: p.redirectTarget === 'product' ? 'product' : 'catalog',
          targetProductId: sanitizeString(p.targetProductId, 64),
        }))
      : undefined;

    const rawTestimonials = Array.isArray(payload.testimonials) ? payload.testimonials : currentCatalog?.testimonials;
    const sanitizedTestimonials = Array.isArray(rawTestimonials)
      ? rawTestimonials.slice(0, 50).map((t) => ({
          id: sanitizeString(t.id, 64),
          name: sanitizeString(t.name, 100),
          role: sanitizeString(t.role, 100),
          avatar: sanitizeString(t.avatar, 500),
          quote: sanitizeString(t.quote, 1000),
          rating: Math.max(1, Math.min(5, Number(t.rating) || 5)),
        }))
      : undefined;

    const timestamp = Math.round(Date.now() / 1000);
    const updatedCatalog = {
      version: timestamp,
      updatedAt: new Date().toISOString(),
      count: sanitizedBooks.length,
      books: sanitizedBooks,
      ...(sanitizedExamPaths !== undefined ? { examPaths: sanitizedExamPaths } : {}),
      ...(sanitizedTestimonials !== undefined ? { testimonials: sanitizedTestimonials } : {}),
    };

    // 4. Save to Cloudflare KV (PRODUCTS_KV)
    if (env && env.PRODUCTS_KV) {
      await env.PRODUCTS_KV.put('xylem_products', JSON.stringify(updatedCatalog));
      await env.PRODUCTS_KV.put('xylem_products_version', String(timestamp));
    }

    // 5. Save to Cloudinary raw storage with instant CDN cache purge
    const publicId = 'xylem_products_live';
    const paramsToSign = `invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const uploadData = new FormData();
    const blob = new Blob([JSON.stringify(updatedCatalog)], { type: 'application/json' });
    uploadData.append('file', blob, 'xylem_products_live.json');
    uploadData.append('api_key', apiKey);
    uploadData.append('timestamp', timestamp.toString());
    uploadData.append('public_id', publicId);
    uploadData.append('overwrite', 'true');
    uploadData.append('invalidate', 'true');
    uploadData.append('signature', signature);

    const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: 'POST',
      body: uploadData,
    });

    const cResult = await cRes.json();

    if (!cRes.ok) {
      console.error('Cloudinary save error:', cResult);
      return new Response(JSON.stringify({ error: 'Catalog storage update failed.' }), {
        status: 500,
        headers: responseHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: timestamp,
        updatedAt: updatedCatalog.updatedAt,
        count: updatedCatalog.count,
        cloudinaryUrl: cResult.secure_url,
        books: updatedCatalog.books,
        examPaths: updatedCatalog.examPaths,
        testimonials: updatedCatalog.testimonials,
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (err) {
    console.error('Products POST error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error updating catalog.' }), {
      status: 500,
      headers: responseHeaders,
    });
  }
}
