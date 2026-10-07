const CARD_WIDTHS = [360, 520, 720, 960];
const DEFAULT_EXAM_IMAGE = '/hero-books-showcase.webp';
const MISSING_LOCAL_EXAM_IMAGES = new Set([
  '/images/exams/ielts.jpg',
  '/images/exams/oet.jpg',
  '/images/exams/pte.jpg',
  '/images/exams/german.jpg',
]);

function isCloudinaryUrl(url: URL) {
  return url.hostname === 'res.cloudinary.com';
}

function withCloudinaryTransform(rawUrl: string, width: number) {
  try {
    const url = new URL(rawUrl);
    const marker = '/upload/';
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return rawUrl;

    const before = url.pathname.slice(0, idx + marker.length);
    const after = url.pathname.slice(idx + marker.length);
    url.pathname = `${before}f_auto,q_auto:eco,c_fill,g_auto,w_${width},h_${Math.round(width * 1.12)}/${after}`;
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function withUnsplashWidth(rawUrl: string, width: number) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('q', '70');
    url.searchParams.set('w', String(width));
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getOptimizedExamImage(rawUrl: string, width: number) {
  if (!rawUrl) return rawUrl;
  if (MISSING_LOCAL_EXAM_IMAGES.has(rawUrl)) return DEFAULT_EXAM_IMAGE;

  try {
    const url = new URL(rawUrl, window.location.origin);
    if (isCloudinaryUrl(url)) return withCloudinaryTransform(rawUrl, width);
    if (url.hostname.endsWith('unsplash.com')) return withUnsplashWidth(rawUrl, width);
  } catch {
    return rawUrl;
  }

  return rawUrl;
}

export function getExamImageSrcSet(rawUrl: string) {
  if (!rawUrl) return undefined;

  const entries = CARD_WIDTHS.map((width) => `${getOptimizedExamImage(rawUrl, width)} ${width}w`);
  return entries.join(', ');
}

export function getExamImagePreloadUrl(rawUrl: string) {
  return getOptimizedExamImage(rawUrl, 720);
}

export function getImageOrigin(rawUrl: string) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin) return url.origin;
  } catch {
    return null;
  }
  return null;
}
