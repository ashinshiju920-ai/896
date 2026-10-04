import { Book, ExamPath, Testimonial, CatalogBannerConfig } from '../types';

const CHANNEL_NAME = 'xylem_products_realtime_sync';

/**
 * Uploads an image file securely via Cloudflare Pages edge /api/upload.
 * Never performs direct browser-to-cloud-storage calls or holds credentials client-side.
 */
export async function uploadImageToCloud(file: File, productId: string): Promise<string> {
  const cleanSku = productId.trim() || 'unassigned';
  const formData = new FormData();
  formData.append('image', file);
  formData.append('productId', cleanSku);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Upload failed (status ${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.error) errMessage = errData.error;
    } catch {}
    throw new Error(errMessage);
  }

  const data = await res.json();
  if (data?.success && data?.imageUrl) {
    return data.imageUrl;
  }

  throw new Error(data?.error || 'Failed to upload image: invalid response from server');
}

/**
 * Saves the entire books catalog to the cloud via Cloudflare Pages /api/products
 * with zero-lag cross-tab broadcast. Never signs client-side or calls remote storage directly.
 */
export async function saveCatalogToCloud(
  books: Book[],
  examPaths?: ExamPath[],
  testimonials?: Testimonial[],
  catalogBanner?: CatalogBannerConfig
): Promise<{
  success: boolean;
  version?: number;
  books?: Book[];
  examPaths?: ExamPath[];
  testimonials?: Testimonial[];
  catalogBanner?: CatalogBannerConfig;
  error?: string;
}> {
  // Persist via Cloudflare Pages edge endpoint /api/products
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ books, examPaths, testimonials, catalogBanner }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success) {
        const confirmedVersion = Number(data.version) || Math.floor(Date.now() / 1000);
        const confirmedBooks = Array.isArray(data.books) ? data.books : books;
        const confirmedPaths = Array.isArray(data.examPaths) ? data.examPaths : examPaths;
        const confirmedTestis = Array.isArray(data.testimonials) ? data.testimonials : testimonials;
        const confirmedBanner = data.catalogBanner !== undefined ? data.catalogBanner : catalogBanner;

        // ONLY cache and broadcast AFTER authoritative server write succeeds
        broadcastLocalUpdate(confirmedBooks, confirmedVersion, confirmedPaths, confirmedTestis, confirmedBanner);

        return {
          success: true,
          version: confirmedVersion,
          books: confirmedBooks,
          examPaths: confirmedPaths,
          testimonials: confirmedTestis,
          catalogBanner: confirmedBanner,
        };
      }
      return { success: false, error: data?.error || 'Failed to sync catalog with server' };
    }

    let errMsg = `Failed to sync catalog (status ${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.error) errMsg = errData.error;
    } catch {}
    return { success: false, error: errMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while syncing catalog' };
  }
}

/**
 * Updates a single product's image across the live cloud catalog in real time.
 */
export async function updateProductImageLive(
  productId: string,
  imageUrl: string
): Promise<{ success: boolean; version?: number; error?: string }> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'update-product-image',
        productId,
        imageUrl,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.books)) {
        broadcastLocalUpdate(data.books, data.version || Date.now());
        return { success: true, version: data.version };
      }
    }
  } catch {}

  // Fallback: fetch current, update locally, and push via server endpoint
  const current = await fetchCatalogFromCloud();
  if (current && Array.isArray(current.books)) {
    const nextBooks = current.books.map((b) => (b.id === productId ? { ...b, imageUrl } : b));
    return saveCatalogToCloud(nextBooks);
  }

  return { success: false, error: 'Could not update image in live catalog' };
}

/**
 * Checks for new catalog version in ~15ms without downloading the full catalog.
 */
export async function checkCatalogVersion(): Promise<number | null> {
  try {
    const res = await fetch(`/api/products?check=version&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.version === 'number') {
        return data.version;
      }
    }
  } catch {}
  return null;
}

/**
 * Fetches the latest live product catalog from Cloudflare Edge /api/products.
 */
export async function fetchCatalogFromCloud(): Promise<{
  books: Book[];
  examPaths?: ExamPath[];
  testimonials?: Testimonial[];
  catalogBanner?: CatalogBannerConfig;
  version?: number;
  updatedAt?: string;
} | null> {
  try {
    const res = await fetch(`/api/products?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.books) && data.books.length > 0) {
        return {
          books: data.books,
          examPaths: Array.isArray(data.examPaths) ? data.examPaths : undefined,
          testimonials: Array.isArray(data.testimonials) ? data.testimonials : undefined,
          catalogBanner: data.catalogBanner && typeof data.catalogBanner === 'object' ? data.catalogBanner : undefined,
          version: data.version,
          updatedAt: data.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch catalog from /api/products:', err);
  }

  return null;
}

/**
 * Instant multi-tab & multi-window synchronization helper using BroadcastChannel + localStorage event.
 */
export function broadcastLocalUpdate(
  books: Book[],
  version: number,
  examPaths?: ExamPath[],
  testimonials?: Testimonial[],
  catalogBanner?: CatalogBannerConfig
) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('xylem_books_data', JSON.stringify(books));
    localStorage.setItem('xylem_books_version', String(version));
    if (examPaths !== undefined) {
      localStorage.setItem('xylem_exam_paths_data', JSON.stringify(examPaths));
    }
    if (testimonials !== undefined) {
      localStorage.setItem('xylem_testimonials_data', JSON.stringify(testimonials));
    }
    if (catalogBanner !== undefined) {
      localStorage.setItem('xylem_catalog_banner_data', JSON.stringify(catalogBanner));
    }
  } catch {}

  if ('BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({
        type: 'CATALOG_UPDATED',
        books,
        examPaths,
        testimonials,
        catalogBanner,
        version,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }
}

/**
 * Subscribes to real-time updates broadcast across tabs and windows.
 */
export function subscribeToRealtimeBroadcast(
  onUpdate: (
    books: Book[],
    version: number,
    examPaths?: ExamPath[],
    testimonials?: Testimonial[],
    catalogBanner?: CatalogBannerConfig
  ) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const cleanups: (() => void)[] = [];

  // 1. BroadcastChannel listener (0ms latency between tabs)
  if ('BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'CATALOG_UPDATED' && Array.isArray(event.data.books)) {
          onUpdate(
            event.data.books,
            event.data.version || Date.now(),
            Array.isArray(event.data.examPaths) ? event.data.examPaths : undefined,
            Array.isArray(event.data.testimonials) ? event.data.testimonials : undefined,
            event.data.catalogBanner && typeof event.data.catalogBanner === 'object' ? event.data.catalogBanner : undefined
          );
        }
      };
      cleanups.push(() => bc.close());
    } catch (e) {
      console.warn('Could not initialize BroadcastChannel listener:', e);
    }
  }

  // 2. Storage event listener (fires instantly when another tab changes localStorage)
  const onStorage = (e: StorageEvent) => {
    if (
      (e.key === 'xylem_books_data' ||
        e.key === 'xylem_exam_paths_data' ||
        e.key === 'xylem_testimonials_data' ||
        e.key === 'xylem_catalog_banner_data') &&
      e.newValue
    ) {
      try {
        const rawBooks = localStorage.getItem('xylem_books_data');
        const parsedBooks = rawBooks ? JSON.parse(rawBooks) : [];
        const rawPaths = localStorage.getItem('xylem_exam_paths_data');
        const parsedPaths = rawPaths ? JSON.parse(rawPaths) : undefined;
        const rawTestis = localStorage.getItem('xylem_testimonials_data');
        const parsedTestis = rawTestis ? JSON.parse(rawTestis) : undefined;
        const rawBanner = localStorage.getItem('xylem_catalog_banner_data');
        const parsedBanner = rawBanner ? JSON.parse(rawBanner) : undefined;

        if (Array.isArray(parsedBooks) && parsedBooks.length > 0) {
          const v = Number(localStorage.getItem('xylem_books_version')) || Date.now();
          onUpdate(parsedBooks, v, parsedPaths, parsedTestis, parsedBanner);
        }
      } catch {}
    }
  };

  window.addEventListener('storage', onStorage);
  cleanups.push(() => window.removeEventListener('storage', onStorage));

  return () => {
    cleanups.forEach((c) => c());
  };
}
