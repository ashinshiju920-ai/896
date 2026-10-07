import React from 'react';
import { useLocation } from 'react-router-dom';
import { Book } from '../types';
import { DEFAULT_SEO_IMAGE, getSeoForRoute, SITE_URL } from '../utils/seo';

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
};

const upsertLink = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
};

export const SEO: React.FC<{ books: Book[] }> = ({ books }) => {
  const location = useLocation();

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const seo = getSeoForRoute({
      pathname: location.pathname,
      search: location.search,
      books,
    });

    const canonicalUrl = `${SITE_URL}${seo.canonicalPath}`;
    const image = seo.image || DEFAULT_SEO_IMAGE;
    const keywords = seo.keywords?.filter(Boolean).join(', ');

    document.title = seo.title;
    upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: seo.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    });
    if (keywords) {
      upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    }

    upsertLink('canonical', canonicalUrl);

    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Aylem Learning' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: seo.type === 'product' ? 'product' : 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'en_IN' });

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });

    document.querySelectorAll('script[data-seo-json-ld="true"]').forEach((node) => node.remove());
    (seo.jsonLd || []).forEach((schema, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoJsonLd = 'true';
      script.dataset.schemaIndex = String(index);
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    });
  }, [books, location.pathname, location.search]);

  return null;
};
