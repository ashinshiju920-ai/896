import { getCorsHeaders, handleOptions } from '../utils/cors.js';

const BLOGS_KEY = 'aylem_blog_posts';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  try {
    const posts = await env.PRODUCTS_KV?.get(BLOGS_KEY, { type: 'json' });
    return new Response(
      JSON.stringify({ success: true, posts: Array.isArray(posts) ? posts.filter((p) => p.published !== false) : [] }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...cors } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, posts: [], error: err?.message || 'Failed to load blog posts.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
