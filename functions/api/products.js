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
const D1_CATALOG_KEY = 'xylem_products';

async function ensureCatalogTable(env) {
  if (!env?.DB || typeof env.DB.prepare !== 'function') return false;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_kv_store (
      storage_key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  return true;
}

async function getCatalogFromD1(env) {
  if (!(await ensureCatalogTable(env))) return null;
  const row = await env.DB.prepare('SELECT value FROM app_kv_store WHERE storage_key = ?')
    .bind(D1_CATALOG_KEY)
    .first();
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function saveCatalogToD1(env, catalog) {
  if (!(await ensureCatalogTable(env))) return false;
  await env.DB.prepare(`
    INSERT INTO app_kv_store (storage_key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(storage_key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).bind(D1_CATALOG_KEY, JSON.stringify(catalog), catalog.updatedAt || new Date().toISOString()).run();
  return true;
}

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

  const tableOfContents = Array.isArray(raw.tableOfContents)
    ? raw.tableOfContents
        .slice(0, 50)
        .map((c) => ({
          chapter: sanitizeString(c?.chapter, 300),
          pages: sanitizeString(c?.pages, 50),
        }))
        .filter((c) => c.chapter)
    : [];

  const rawAddonsList = Array.isArray(raw.addOns)
    ? raw.addOns
    : (Array.isArray(raw.addons) ? raw.addons : []);

  const seenAddonIds = new Set();
  const cleanAddons = [];

  for (const a of rawAddonsList.slice(0, 25)) {
    if (!a || typeof a !== 'object') continue;
    let rawId = sanitizeString(a.id, 64) || `addon_${Date.now()}`;
    let normId = rawId === 'addon_digital' ? 'digital' : (rawId === 'addon_physical' ? 'physical' : rawId);

    // Rule 15: Server validation: Ensure unique add-on IDs within product
    if (seenAddonIds.has(normId)) {
      normId = `${normId}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seenAddonIds.add(normId);

    // Rule 16: Name (1-120 chars)
    const name = sanitizeString(a.name, 120) || (normId === 'physical' ? 'Physical (Printed)' : (normId === 'digital' ? 'Digital (PDF)' : 'Optional Study Material'));

    // Rule 16: Description (0-500 chars)
    const description = sanitizeString(a.description || a.subtitle, 500);
    const subtitle = sanitizeString(a.subtitle || a.description, 150);

    // Rule 7: Price validation (non-negative, no NaN, no Infinity, sensible upper limit 100,000 rupees / 10,000,000 paise)
    const rawPrice = Number(a.price);
    const rawPricePaise = Number(a.pricePaise);

    let aPriceRupees = 0;
    if (!isNaN(rawPrice) && isFinite(rawPrice) && rawPrice >= 0) {
      aPriceRupees = Math.min(100000, Math.floor(rawPrice));
    } else if (!isNaN(rawPricePaise) && isFinite(rawPricePaise) && rawPricePaise >= 0) {
      aPriceRupees = Math.min(100000, Math.floor(rawPricePaise / 100));
    } else if (normId === 'physical') {
      aPriceRupees = physicalPrice;
    } else if (normId === 'digital') {
      aPriceRupees = digitalPrice;
    }

    const aPricePaise = !isNaN(rawPricePaise) && isFinite(rawPricePaise) && rawPricePaise >= 0
      ? Math.min(10000000, Math.floor(rawPricePaise))
      : Math.round(aPriceRupees * 100);

    const aOrigRupees = sanitizeNumber(
      a.originalPrice,
      0,
      100000,
      normId === 'physical' ? physicalOrig : (normId === 'digital' ? digitalOrig : aPriceRupees)
    );

    // Rule 10 & 11: Digital file validation (Phase 9 Versioning support)
    let digitalFile = null;
    if (a.digitalFile && typeof a.digitalFile === 'object') {
      const fName = sanitizeString(a.digitalFile.filename || a.digitalFile.samplePdfName, 200);
      const fUrl = a.digitalFile.fileUrl ? sanitizeString(a.digitalFile.fileUrl, 1000000) : '';
      const fMime = sanitizeString(a.digitalFile.mimeType, 100) || 'application/pdf';
      const fSize = sanitizeNumber(a.digitalFile.fileSizeBytes, 0, 100000000, 0);
      const fVerId = sanitizeString(a.digitalFile.fileVersionId || a.digitalFile.versionId, 64);
      const fVer = sanitizeString(a.digitalFile.version || a.digitalFile.versionLabel, 50);
      const fNotes = sanitizeString(a.digitalFile.releaseNotes, 500);
      const fChecksum = sanitizeString(a.digitalFile.checksum, 100);
      const fStatus = a.digitalFile.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';

      if (fUrl || fName) {
        digitalFile = {
          filename: fName || 'addon-material.pdf',
          fileUrl: fUrl,
          mimeType: fMime,
          ...(fVerId ? { fileVersionId: fVerId } : {}),
          ...(fVer ? { version: fVer } : {}),
          ...(fNotes ? { releaseNotes: fNotes } : {}),
          ...(fChecksum ? { checksum: fChecksum } : {}),
          ...(fSize > 0 ? { fileSizeBytes: fSize } : {}),
          status: fStatus,
        };
      }
    } else if (a.pdfUrl) {
      digitalFile = {
        filename: sanitizeString(a.samplePdfName || `${normId}.pdf`, 200),
        fileUrl: sanitizeString(a.pdfUrl, 1000000),
        mimeType: 'application/pdf',
        status: 'ACTIVE',
      };
    }

    cleanAddons.push({
      id: normId,
      name,
      subtitle,
      description,
      price: aPriceRupees,
      pricePaise: aPricePaise,
      originalPrice: aOrigRupees,
      active: a.active !== undefined ? Boolean(a.active) : true,
      deliveryOption: a.deliveryOption === 'physical' || normId === 'physical' ? 'physical' : 'digital',
      digitalFile,
      pdfUrl: digitalFile?.fileUrl || '',
      samplePdfName: digitalFile?.filename || '',
    });
  }

  // If raw addons were provided (even if empty []), respect it. If omitted completely on legacy records, fallback to digital/physical defaults.
  let finalAddons = cleanAddons;
  if (rawAddonsList.length === 0 && raw.addOns === undefined && raw.addons === undefined) {
    finalAddons = [
      {
        id: 'digital',
        name: 'Digital (PDF)',
        subtitle: 'Instant Download',
        description: 'Instant Download',
        price: digitalPrice,
        pricePaise: digitalPrice * 100,
        originalPrice: digitalOrig,
        active: true,
        deliveryOption: 'digital',
      },
      {
        id: 'physical',
        name: 'Physical (Printed)',
        subtitle: 'Delivered in 3-5 days',
        description: 'Delivered in 3-5 days',
        price: physicalPrice,
        pricePaise: physicalPrice * 100,
        originalPrice: physicalOrig,
        active: true,
        deliveryOption: 'physical',
      },
    ];
  }

  // Guarantee digital and physical addons stay synchronized with prices if provided
  finalAddons = finalAddons.map((addon) => {
    if (addon.id === 'digital' && raw.prices?.digital?.price !== undefined) {
      return { ...addon, price: digitalPrice, pricePaise: digitalPrice * 100, originalPrice: digitalOrig };
    }
    if (addon.id === 'physical' && raw.prices?.physical?.price !== undefined) {
      return { ...addon, price: physicalPrice, pricePaise: physicalPrice * 100, originalPrice: physicalOrig };
    }
    return addon;
  });

  const addons = finalAddons;

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

  let productDigitalFile = null;
  if (raw.digitalFile && typeof raw.digitalFile === 'object') {
    const fVerId = sanitizeString(raw.digitalFile.fileVersionId || raw.digitalFile.versionId, 64);
    const fVer = sanitizeString(raw.digitalFile.version || raw.digitalFile.versionLabel, 50);
    const fNotes = sanitizeString(raw.digitalFile.releaseNotes, 500);
    const fChecksum = sanitizeString(raw.digitalFile.checksum, 100);
    const fStatus = raw.digitalFile.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    const fSize = sanitizeNumber(raw.digitalFile.fileSizeBytes, 0, 100000000, 0);

    productDigitalFile = {
      filename: sanitizeString(raw.digitalFile.filename || raw.samplePdfName, 200),
      fileUrl: sanitizeString(raw.digitalFile.fileUrl || raw.pdfUrl, 1000000),
      mimeType: sanitizeString(raw.digitalFile.mimeType, 100) || 'application/pdf',
      ...(fVerId ? { fileVersionId: fVerId } : {}),
      ...(fVer ? { version: fVer } : {}),
      ...(fNotes ? { releaseNotes: fNotes } : {}),
      ...(fChecksum ? { checksum: fChecksum } : {}),
      ...(fSize > 0 ? { fileSizeBytes: fSize } : {}),
      status: fStatus,
    };
  } else if (raw.pdfUrl) {
    productDigitalFile = {
      filename: sanitizeString(raw.samplePdfName, 200) || 'Official_Prep_Guide.pdf',
      fileUrl: sanitizeString(raw.pdfUrl, 1000000),
      mimeType: 'application/pdf',
      status: 'ACTIVE',
    };
  }

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
    digitalFile: productDigitalFile,
    prices: {
      digital: { price: digitalPrice, originalPrice: digitalOrig },
      physical: { price: physicalPrice, originalPrice: physicalOrig },
    },
    disablePaperback: Boolean(raw.disablePaperback),
    features,
    whatYouGet,
    tableOfContents,
    addons,
    addOns: addons,
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
        if (safeBook.digitalFile) {
          const { fileUrl, ...safeFile } = safeBook.digitalFile;
          safeBook.digitalFile = safeFile;
        }
        const rawAddons = Array.isArray(safeBook.addOns)
          ? safeBook.addOns
          : (Array.isArray(safeBook.addons) ? safeBook.addons : []);

        const cleanAddons = rawAddons.map((a) => {
          const { pdfUrl: aPdf, digitalFile: aFile, ...safeAddon } = a;
          if (aFile) {
            const { fileUrl: aFileUrl, ...safeAFile } = aFile;
            safeAddon.digitalFile = safeAFile;
          }
          return safeAddon;
        });

        safeBook.addons = cleanAddons;
        safeBook.addOns = cleanAddons;
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

    // 2. D1 catalog storage fallback/primary for Pages projects without KV
    const d1Catalog = await getCatalogFromD1(env);
    if (d1Catalog && Array.isArray(d1Catalog.books)) {
      if (checkOnly) {
        return new Response(
          JSON.stringify({
            success: true,
            version: d1Catalog.version || 0,
            count: d1Catalog.count || d1Catalog.books.length,
          }),
          {
            status: 200,
            headers: responseHeaders,
          }
        );
      }
      return new Response(
        JSON.stringify({ success: true, ...d1Catalog, books: sanitizeBooks(d1Catalog.books) }),
        {
          status: 200,
          headers: responseHeaders,
        }
      );
    }

    // 3. Cloudinary raw storage fallback
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

    let currentCatalog = null;
    if (env && env.PRODUCTS_KV) {
      try {
        currentCatalog = await env.PRODUCTS_KV.get('xylem_products', { type: 'json' });
      } catch {}
    }
    if (!currentCatalog) {
      try {
        currentCatalog = await getCatalogFromD1(env);
      } catch (d1ReadErr) {
        console.warn('D1 catalog read error:', d1ReadErr?.message || d1ReadErr);
      }
    }
    if (!currentCatalog) {
      try {
        if (cloudName) {
          const cRes = await fetch(
            `https://res.cloudinary.com/${cloudName}/raw/upload/xylem_products_live.json?_t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (cRes.ok) currentCatalog = await cRes.json();
        }
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
          arrowColor: sanitizeString(p.arrowColor, 50) || undefined,
          badgeColor: sanitizeString(p.badgeColor, 50) || undefined,
          showBadge: p.showBadge !== false,
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

    const rawCatalogBanner = payload.catalogBanner !== undefined ? payload.catalogBanner : currentCatalog?.catalogBanner;
    const sanitizedCatalogBanner = rawCatalogBanner && typeof rawCatalogBanner === 'object'
      ? {
          title: sanitizeString(rawCatalogBanner.title, 150),
          subtitle: sanitizeString(rawCatalogBanner.subtitle, 500),
          desktopBgImage: sanitizeString(rawCatalogBanner.desktopBgImage, 1000),
          mobileBgImage: sanitizeString(rawCatalogBanner.mobileBgImage, 1000),
          titleColor: sanitizeString(rawCatalogBanner.titleColor, 50),
          subtitleColor: sanitizeString(rawCatalogBanner.subtitleColor, 50),
          badgeTextColor: sanitizeString(rawCatalogBanner.badgeTextColor, 50),
          badgeBgColor: sanitizeString(rawCatalogBanner.badgeBgColor, 50),
          overlayOpacity: sanitizeNumber(rawCatalogBanner.overlayOpacity, 0, 100, 50),
          featurePills: Array.isArray(rawCatalogBanner.featurePills)
            ? rawCatalogBanner.featurePills.map((p) => sanitizeString(p, 100)).slice(0, 10)
            : undefined,
        }
      : undefined;

    const rawHomeSpotlight = payload.homeSpotlight !== undefined ? payload.homeSpotlight : currentCatalog?.homeSpotlight;
    const sanitizedHomeSpotlight = rawHomeSpotlight && typeof rawHomeSpotlight === 'object'
      ? {
          enabled: rawHomeSpotlight.enabled !== false,
          productId: sanitizeString(rawHomeSpotlight.productId, 100),
          imageUrl: sanitizeString(rawHomeSpotlight.imageUrl, 1000),
          badgeText: sanitizeString(rawHomeSpotlight.badgeText, 80),
          secondaryBadgeText: sanitizeString(rawHomeSpotlight.secondaryBadgeText, 80),
          title: sanitizeString(rawHomeSpotlight.title, 160),
          description: sanitizeString(rawHomeSpotlight.description, 600),
          price: rawHomeSpotlight.price === '' || rawHomeSpotlight.price === null || rawHomeSpotlight.price === undefined
            ? undefined
            : sanitizeNumber(rawHomeSpotlight.price, 0, 1000000, 0),
          originalPrice: rawHomeSpotlight.originalPrice === '' || rawHomeSpotlight.originalPrice === null || rawHomeSpotlight.originalPrice === undefined
            ? undefined
            : sanitizeNumber(rawHomeSpotlight.originalPrice, 0, 1000000, 0),
          buttonText: sanitizeString(rawHomeSpotlight.buttonText, 80),
          backgroundColor: sanitizeString(rawHomeSpotlight.backgroundColor, 50),
        }
      : undefined;

    const timestamp = Math.round(Date.now() / 1000);
    const updatedCatalog = {
      version: timestamp,
      updatedAt: new Date().toISOString(),
      count: sanitizedBooks.length,
      books: sanitizedBooks,
      ...(sanitizedExamPaths !== undefined ? { examPaths: sanitizedExamPaths } : {}),
      ...(sanitizedTestimonials !== undefined ? { testimonials: sanitizedTestimonials } : {}),
      ...(sanitizedCatalogBanner !== undefined ? { catalogBanner: sanitizedCatalogBanner } : {}),
      ...(sanitizedHomeSpotlight !== undefined ? { homeSpotlight: sanitizedHomeSpotlight } : {}),
    };


    let savedToKv = false;
    let savedToD1 = false;
    let cloudinaryUrl = null;
    let cloudinaryWarning = null;

    // 4. Save to Cloudflare KV (PRODUCTS_KV)
    if (env && env.PRODUCTS_KV) {
      await env.PRODUCTS_KV.put('xylem_products', JSON.stringify(updatedCatalog));
      await env.PRODUCTS_KV.put('xylem_products_version', String(timestamp));
      savedToKv = true;
    }

    // 5. Save to D1 catalog storage when available
    try {
      savedToD1 = await saveCatalogToD1(env, updatedCatalog);
    } catch (d1WriteErr) {
      console.error('D1 catalog save error:', d1WriteErr);
    }

    // 6. Mirror to Cloudinary raw storage when credentials are available.
    // D1/KV are authoritative; Cloudinary raw failure should not block admin catalog saves.
    if (cloudName && apiKey && apiSecret) {
      try {
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

        const cResult = await cRes.json().catch(() => ({}));

        if (cRes.ok) {
          cloudinaryUrl = cResult.secure_url || null;
        } else {
          console.error('Cloudinary catalog mirror error:', cResult);
          cloudinaryWarning = cResult?.error?.message || cResult?.message || 'Cloudinary catalog mirror failed.';
        }
      } catch (cloudinaryErr) {
        console.error('Cloudinary catalog mirror exception:', cloudinaryErr);
        cloudinaryWarning = cloudinaryErr?.message || 'Cloudinary catalog mirror failed.';
      }
    } else {
      cloudinaryWarning = 'Cloudinary raw catalog mirror is not configured.';
    }

    if (!savedToKv && !savedToD1 && !cloudinaryUrl) {
      return new Response(
        JSON.stringify({
          error: 'Catalog storage update failed.',
          details: cloudinaryWarning || 'No catalog storage backend accepted the update.',
        }),
        {
          status: 500,
          headers: responseHeaders,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: timestamp,
        updatedAt: updatedCatalog.updatedAt,
        count: updatedCatalog.count,
        storage: {
          kv: savedToKv,
          d1: savedToD1,
          cloudinary: Boolean(cloudinaryUrl),
        },
        ...(cloudinaryUrl ? { cloudinaryUrl } : {}),
        ...(cloudinaryWarning ? { warning: cloudinaryWarning } : {}),
        books: updatedCatalog.books,
        examPaths: updatedCatalog.examPaths,
        testimonials: updatedCatalog.testimonials,
        catalogBanner: updatedCatalog.catalogBanner,
        homeSpotlight: updatedCatalog.homeSpotlight,
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
