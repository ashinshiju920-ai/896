import { Book } from '../types';

/**
 * Returns the canonical URL slug for a given book.
 */
export function getBookSlug(book: Book): string {
  if ((book as any).slug) {
    return (book as any).slug;
  }
  return book.id;
}

/**
 * Resolves a book from the catalog by its URL slug or ID.
 * Robust resolution handles:
 * 1. Direct book ID match
 * 2. Explicit slug property match (if present on remote KV items)
 * 3. Title-derived slug match
 * 4. Common exam guide aliases (e.g. oet-complete-guide -> oet-full-prep)
 * 5. Prefix/contains matching for resilient lookups
 */
export function findBookBySlug(slug: string | undefined, books: Book[]): Book | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();

  // 1. Direct ID match
  const byId = books.find((b) => b.id.toLowerCase() === normalized);
  if (byId) return byId;

  // 2. Explicit slug property
  const bySlug = books.find((b) => (b as any).slug && (b as any).slug.toLowerCase() === normalized);
  if (bySlug) return bySlug;

  // 3. Normalized title-derived slug
  const byTitleSlug = books.find((b) => {
    const titleSlug = b.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return titleSlug === normalized;
  });
  if (byTitleSlug) return byTitleSlug;

  // 4. Known aliases for exam full-prep guides
  const aliases: Record<string, string> = {
    'ielts-complete-guide': 'ielts-complete-guide',
    'oet-complete-guide': 'oet-full-prep',
    'pte-complete-guide': 'pte-full-prep',
    'german-complete-guide': 'german-full-prep',
  };
  const targetId = aliases[normalized];
  if (targetId) {
    const byAlias = books.find((b) => b.id.toLowerCase() === targetId);
    if (byAlias) return byAlias;
  }

  // 5. Prefix or substring matching
  const byPrefix = books.find(
    (b) => b.id.toLowerCase().startsWith(normalized) || normalized.startsWith(b.id.toLowerCase())
  );
  if (byPrefix) return byPrefix;

  return undefined;
}
