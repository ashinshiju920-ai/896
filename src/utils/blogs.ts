import { BLOG_POSTS, BlogPost } from '../data/blogs';

export async function fetchPublishedBlogs(): Promise<BlogPost[]> {
  try {
    const res = await fetch('/api/blogs');
    if (!res.ok) return BLOG_POSTS;
    const data = await res.json();
    return Array.isArray(data.posts) && data.posts.length > 0 ? data.posts : BLOG_POSTS;
  } catch {
    return BLOG_POSTS;
  }
}
