import { requireAdmin } from '../../utils/auth.js';
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

const BLOGS_KEY = 'aylem_blog_posts';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

async function readPosts(env) {
  const posts = await env.PRODUCTS_KV?.get(BLOGS_KEY, { type: 'json' });
  return Array.isArray(posts) ? posts : [];
}

async function writePosts(env, posts) {
  await env.PRODUCTS_KV.put(BLOGS_KEY, JSON.stringify(posts));
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function cleanPost(raw) {
  const title = String(raw.title || '').trim().slice(0, 180);
  const slug = slugify(raw.slug || title);
  const category = ['IELTS', 'OET', 'PTE', 'German', 'Study Tips'].includes(raw.category) ? raw.category : 'Study Tips';
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((section) => ({
        heading: String(section.heading || '').trim().slice(0, 180),
        paragraphs: Array.isArray(section.paragraphs)
          ? section.paragraphs.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 12)
          : [],
        bullets: Array.isArray(section.bullets)
          ? section.bullets.map((b) => String(b || '').trim()).filter(Boolean).slice(0, 12)
          : undefined,
      })).filter((section) => section.heading && section.paragraphs.length > 0).slice(0, 12)
    : [];

  if (!title || !slug) throw new Error('Title and slug are required.');
  if (sections.length === 0) throw new Error('At least one section with paragraphs is required.');

  return {
    slug,
    title,
    metaTitle: String(raw.metaTitle || title).trim().slice(0, 180),
    metaDescription: String(raw.metaDescription || raw.excerpt || '').trim().slice(0, 260),
    keyword: String(raw.keyword || '').trim().slice(0, 100),
    category,
    publishedAt: raw.publishedAt || new Date().toISOString().slice(0, 10),
    readTime: String(raw.readTime || '4 min read').trim().slice(0, 40),
    excerpt: String(raw.excerpt || '').trim().slice(0, 500),
    sections,
    relatedProductIds: Array.isArray(raw.relatedProductIds)
      ? raw.relatedProductIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    published: raw.published !== false,
    updatedAt: new Date().toISOString(),
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const posts = await readPosts(env);
  return new Response(JSON.stringify({ success: true, posts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const post = cleanPost(body);
    const posts = await readPosts(env);
    const idx = posts.findIndex((p) => p.slug === post.slug);
    const next = idx >= 0 ? posts.map((p, i) => (i === idx ? post : p)) : [post, ...posts];
    await writePosts(env, next);
    return new Response(JSON.stringify({ success: true, post, posts: next }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Failed to save blog post.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const slug = slugify(url.searchParams.get('slug'));
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const posts = await readPosts(env);
  const next = posts.filter((p) => p.slug !== slug);
  await writePosts(env, next);
  return new Response(JSON.stringify({ success: true, posts: next }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
