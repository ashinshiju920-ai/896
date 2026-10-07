import { Book } from '../types';
import { BLOG_POSTS, findBlogBySlug } from '../data/blogs';
import { getBookSlug } from './productSlug';

export const SITE_URL =
  ((import.meta as any).env?.VITE_SITE_URL || 'https://aylemlearning.online').replace(/\/+$/, '');

export const DEFAULT_SEO_IMAGE = `${SITE_URL}/hero-books-showcase.jpg`;

export interface SeoConfig {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string[];
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: Array<Record<string, any>>;
}

const absoluteUrl = (pathOrUrl?: string): string => {
  if (!pathOrUrl) return DEFAULT_SEO_IMAGE;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
};

const trimText = (value: string, max = 155): string => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};

export const buildOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Aylem Learning',
  url: SITE_URL,
  logo: `${SITE_URL}/clean-emblem.png`,
  email: 'aylembookstore@gmail.com',
  telephone: '+91-6282377918',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '34/1000 Edappally Junction',
    addressLocality: 'Kochi',
    addressRegion: 'Kerala',
    postalCode: '682024',
    addressCountry: 'IN',
  },
  areaServed: ['Kerala', 'India'],
});

export const buildWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Aylem Learning',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/books?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const buildProductSchema = (book: Book) => {
  const price = Number(book.prices?.digital?.price) || 199;
  const image = absoluteUrl(book.coverImage || book.imageUrl || book.images?.[0]);
  const canonical = `${SITE_URL}/books/${getBookSlug(book)}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: book.title,
    description: trimText(book.description || book.longDescription, 300),
    image,
    brand: {
      '@type': 'Brand',
      name: 'Aylem Learning',
    },
    category: `${book.category} ${book.type}`,
    sku: book.id,
    url: canonical,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: Number(book.rating || 4.8).toFixed(1),
      reviewCount: Number(book.reviewCount || 1),
    },
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'INR',
      price,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      areaServed: ['Kerala', 'India'],
    },
  };
};

export const buildCourseSchema = (book: Book) => ({
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: book.title,
  description: trimText(book.longDescription || book.description, 300),
  provider: {
    '@type': 'Organization',
    name: 'Aylem Learning',
    sameAs: SITE_URL,
  },
  educationalLevel: 'Exam preparation',
  teaches: book.features,
  inLanguage: 'en',
  areaServed: ['Kerala', 'India'],
});

const buildBlogPostingSchema = (slug: string) => {
  const post = findBlogBySlug(slug);
  if (!post) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: {
      '@type': 'Organization',
      name: 'Aylem Learning',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Aylem Learning',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/clean-emblem.png`,
      },
    },
    about: post.keyword,
    articleSection: post.category,
  };
};

export const getSeoForRoute = ({
  pathname,
  search,
  books,
}: {
  pathname: string;
  search: string;
  books: Book[];
}): SeoConfig => {
  const params = new URLSearchParams(search);
  const category = params.get('category');
  const baseJsonLd = [buildOrganizationSchema(), buildWebsiteSchema()];

  if (pathname === '/') {
    return {
      title: 'Aylem Learning | IELTS, OET, PTE & German Study Materials in Kerala',
      description:
        'Buy IELTS books Kerala, OET mock tests, PTE practice tests India, and German language study material from Aylem Learning. Instant digital access for exam preparation.',
      canonicalPath: '/',
      keywords: [
        'IELTS books Kerala',
        'OET mock test Kerala',
        'PTE practice test India',
        'German language study material Kerala',
        'online IELTS mock test',
      ],
      jsonLd: baseJsonLd,
    };
  }

  if (pathname === '/books' || pathname === '/catalog') {
    const categoryName = category && category !== 'All' ? category : 'All Exams';
    const categoryText =
      categoryName === 'All Exams'
        ? 'IELTS, OET, PTE and German'
        : `${categoryName}`;
    const visibleBooks = books.filter(
      (book) => categoryName === 'All Exams' || book.category.toLowerCase() === categoryName.toLowerCase()
    );
    return {
      title: `${categoryText} Books & Mock Tests | Aylem Learning Kerala`,
      description: trimText(
        `Browse ${categoryText} digital books, mock tests and practice materials for students in Kerala and across India. Instant PDF access and secure checkout from Aylem Learning.`
      ),
      canonicalPath: category ? `/books?category=${encodeURIComponent(category)}` : '/books',
      keywords: [
        `${categoryText} study materials`,
        `${categoryText} books Kerala`,
        'exam preparation books India',
        'online mock test materials',
      ],
      jsonLd: [
        ...baseJsonLd,
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${categoryText} study materials`,
          itemListElement: visibleBooks.slice(0, 20).map((book, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${SITE_URL}/books/${getBookSlug(book)}`,
            name: book.title,
          })),
        },
      ],
    };
  }

  const productMatch = pathname.match(/^\/(?:books|product)\/([^/]+)/);
  if (productMatch) {
    const slug = decodeURIComponent(productMatch[1]).toLowerCase();
    const book = books.find(
      (item) =>
        item.id.toLowerCase() === slug ||
        getBookSlug(item).toLowerCase() === slug ||
        item.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') === slug
    );

    if (book) {
      const marketPhrase =
        book.category === 'IELTS'
          ? 'IELTS books Kerala and online IELTS mock test preparation'
          : book.category === 'OET'
          ? 'OET mock test Kerala and healthcare English preparation'
          : book.category === 'PTE'
          ? 'PTE practice test India and PTE Academic preparation'
          : book.category === 'German'
          ? 'German language study material Kerala'
          : 'exam preparation study material Kerala';

      return {
        title: `${book.title} | ${book.category} Study Material | Aylem Learning`,
        description: trimText(`${book.description} Useful for ${marketPhrase}. Buy securely with instant digital access in India.`),
        canonicalPath: `/books/${getBookSlug(book)}`,
        image: absoluteUrl(book.coverImage || book.imageUrl || book.images?.[0]),
        type: 'product',
        keywords: [marketPhrase, book.title, `${book.category} digital book`, `${book.category} mock tests India`],
        jsonLd: [...baseJsonLd, buildProductSchema(book), buildCourseSchema(book)],
      };
    }
  }

  if (pathname === '/about') {
    return {
      title: 'About Aylem Learning | Kerala Exam Preparation Publisher',
      description:
        'Learn about Aylem Learning, a Kerala-based exam preparation publisher for IELTS, OET, PTE and German digital study materials and mock tests.',
      canonicalPath: '/about',
      keywords: ['Aylem Learning Kerala', 'exam preparation publisher Kerala', 'IELTS OET PTE German study material'],
      jsonLd: baseJsonLd,
    };
  }

  if (pathname === '/blog') {
    return {
      title: 'Exam Preparation Blog | IELTS, OET, PTE & German | Aylem Learning',
      description:
        'Read practical exam preparation guides for IELTS books Kerala, OET mock test Kerala, PTE practice test India, German study material and online IELTS mock tests.',
      canonicalPath: '/blog',
      keywords: ['IELTS books Kerala', 'OET mock test Kerala', 'PTE practice test India', 'German language study material Kerala'],
      jsonLd: [
        ...baseJsonLd,
        {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Aylem Learning Exam Preparation Blog',
          url: `${SITE_URL}/blog`,
          blogPost: BLOG_POSTS.map((post) => ({
            '@type': 'BlogPosting',
            headline: post.title,
            url: `${SITE_URL}/blog/${post.slug}`,
            datePublished: post.publishedAt,
          })),
        },
      ],
    };
  }

  const blogMatch = pathname.match(/^\/blog\/([^/]+)/);
  if (blogMatch) {
    const slug = decodeURIComponent(blogMatch[1]);
    const post = findBlogBySlug(slug);
    if (post) {
      const blogSchema = buildBlogPostingSchema(slug);
      return {
        title: `${post.metaTitle} | Aylem Learning Blog`,
        description: post.metaDescription,
        canonicalPath: `/blog/${post.slug}`,
        type: 'article',
        keywords: [post.keyword, `${post.category} preparation Kerala`, `${post.category} study material India`],
        jsonLd: blogSchema ? [...baseJsonLd, blogSchema] : baseJsonLd,
      };
    }
  }

  if (pathname === '/cart') {
    return {
      title: 'Cart | Aylem Learning',
      description: 'Review selected Aylem Learning study materials before secure checkout.',
      canonicalPath: '/cart',
      noindex: true,
      jsonLd: baseJsonLd,
    };
  }

  if (pathname === '/checkout') {
    return {
      title: 'Secure Checkout | Aylem Learning',
      description: 'Secure checkout for Aylem Learning digital books and study materials.',
      canonicalPath: '/checkout',
      noindex: true,
      jsonLd: baseJsonLd,
    };
  }

  if (pathname === '/privacy-policy') {
    return {
      title: 'Privacy Policy | Aylem Learning',
      description: 'Read the Aylem Learning privacy policy for customer data, payments and digital study material access.',
      canonicalPath: '/privacy-policy',
      jsonLd: baseJsonLd,
    };
  }

  if (pathname === '/terms-and-conditions') {
    return {
      title: 'Terms and Conditions | Aylem Learning',
      description: 'Read the terms and conditions for buying Aylem Learning books, PDFs, mock tests and study materials.',
      canonicalPath: '/terms-and-conditions',
      jsonLd: baseJsonLd,
    };
  }

  if (pathname === '/shipping-returns-refund-policy') {
    return {
      title: 'Shipping, Returns and Refund Policy | Aylem Learning',
      description: 'Shipping, returns and refund policy for Aylem Learning digital and physical study materials in India.',
      canonicalPath: '/shipping-returns-refund-policy',
      jsonLd: baseJsonLd,
    };
  }

  const privateRoutes = ['/login', '/account', '/my-materials', '/orders', '/order-success'];
  if (privateRoutes.some((route) => pathname.startsWith(route)) || pathname.startsWith('/admin')) {
    return {
      title: 'Aylem Learning',
      description: 'Aylem Learning account and order access.',
      canonicalPath: pathname,
      noindex: true,
      jsonLd: baseJsonLd,
    };
  }

  return {
    title: 'Aylem Learning | Exam Preparation Books and Mock Tests',
    description:
      'Aylem Learning offers IELTS, OET, PTE and German study materials, digital books and mock tests for learners in Kerala and India.',
    canonicalPath: pathname,
    jsonLd: baseJsonLd,
  };
};
