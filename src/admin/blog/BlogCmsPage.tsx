import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { BlogPost } from '../../data/blogs';
import { Book } from '../../types';

type AdminBlogPost = BlogPost & {
  published?: boolean;
  updatedAt?: string;
};

interface BlogCmsPageProps {
  books: Book[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const emptyPost = (): AdminBlogPost => ({
  slug: '',
  title: '',
  metaTitle: '',
  metaDescription: '',
  keyword: '',
  category: 'IELTS',
  publishedAt: new Date().toISOString().slice(0, 10),
  readTime: '4 min read',
  excerpt: '',
  sections: [{ heading: '', paragraphs: [''] }],
  relatedProductIds: [],
  published: true,
});

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

const sectionsToText = (post: AdminBlogPost) =>
  post.sections
    .map((section) => [section.heading, ...section.paragraphs, ...(section.bullets || []).map((item) => `- ${item}`)].join('\n'))
    .join('\n---\n');

const textToSections = (value: string): BlogPost['sections'] =>
  value
    .split(/\n---\n/g)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const heading = lines.shift() || '';
      const bullets = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
      const paragraphs = lines.filter((line) => !line.startsWith('- '));
      return { heading, paragraphs, bullets: bullets.length ? bullets : undefined };
    })
    .filter((section) => section.heading && section.paragraphs.length > 0);

export const BlogCmsPage: React.FC<BlogCmsPageProps> = ({ books, showToast }) => {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [draft, setDraft] = useState<AdminBlogPost>(emptyPost);
  const [sectionsText, setSectionsText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedRelatedTitles = useMemo(
    () => draft.relatedProductIds.map((id) => books.find((book) => book.id === id)?.title || id).join(', '),
    [books, draft.relatedProductIds],
  );

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/blogs', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load blog posts.');
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load blog posts.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const selectPost = (post: AdminBlogPost) => {
    setDraft({ ...post, published: post.published !== false });
    setSectionsText(sectionsToText(post));
  };

  const startNewPost = () => {
    const next = emptyPost();
    setDraft(next);
    setSectionsText('');
  };

  const savePost = async () => {
    const sections = textToSections(sectionsText);
    const payload: AdminBlogPost = {
      ...draft,
      slug: slugify(draft.slug || draft.title),
      metaTitle: draft.metaTitle || draft.title,
      sections,
      relatedProductIds: draft.relatedProductIds.map((id) => id.trim()).filter(Boolean),
    };

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/blogs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save blog post.');
      setPosts(Array.isArray(data.posts) ? data.posts : posts);
      setDraft(data.post || payload);
      setSectionsText(sectionsToText(data.post || payload));
      showToast('Blog post saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save blog post.', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePost = async () => {
    if (!draft.slug) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/blogs?slug=${encodeURIComponent(draft.slug)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete blog post.');
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      startNewPost();
      showToast('Blog post deleted.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete blog post.', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <aside className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs h-fit">
        <button
          type="button"
          onClick={startNewPost}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          New Blog Post
        </button>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading posts...
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-xl">No CMS posts yet.</p>
          ) : (
            posts.map((post) => (
              <button
                key={post.slug}
                type="button"
                onClick={() => selectPost(post)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  draft.slug === post.slug
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold text-slate-900 line-clamp-2">{post.title}</span>
                <span className="mt-1 inline-flex text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {post.published === false ? 'Draft' : 'Published'} - {post.category}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              {draft.slug ? 'Edit Blog Post' : 'Create Blog Post'}
            </h2>
            <p className="text-sm text-slate-500">Published posts appear on the storefront blog after saving.</p>
          </div>
          <div className="flex items-center gap-2">
            {draft.slug && (
              <button
                type="button"
                onClick={deletePost}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={savePost}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Title</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value, slug: prev.slug || slugify(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Slug</span>
            <input
              value={draft.slug}
              onChange={(e) => setDraft((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Category</span>
            <select
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value as BlogPost['category'] }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            >
              {['IELTS', 'OET', 'PTE', 'German', 'Study Tips'].map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Published Date</span>
            <input
              type="date"
              value={draft.publishedAt}
              onChange={(e) => setDraft((prev) => ({ ...prev, publishedAt: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Keyword</span>
            <input
              value={draft.keyword}
              onChange={(e) => setDraft((prev) => ({ ...prev, keyword: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Read Time</span>
            <input
              value={draft.readTime}
              onChange={(e) => setDraft((prev) => ({ ...prev, readTime: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <input
            type="checkbox"
            checked={draft.published !== false}
            onChange={(e) => setDraft((prev) => ({ ...prev, published: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-bold text-slate-700">Publish this article on the customer blog</span>
        </label>

        <label className="space-y-1.5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Excerpt</span>
          <textarea
            value={draft.excerpt}
            onChange={(e) => setDraft((prev) => ({ ...prev, excerpt: e.target.value }))}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Meta Title</span>
            <input
              value={draft.metaTitle}
              onChange={(e) => setDraft((prev) => ({ ...prev, metaTitle: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Related Product IDs</span>
            <input
              value={draft.relatedProductIds.join(', ')}
              onChange={(e) => setDraft((prev) => ({ ...prev, relatedProductIds: e.target.value.split(',').map((id) => id.trim()) }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
              placeholder="ielts-full-prep, ielts-practice-tests"
            />
            {selectedRelatedTitles && <p className="text-xs text-slate-500 line-clamp-2">{selectedRelatedTitles}</p>}
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Meta Description</span>
          <textarea
            value={draft.metaDescription}
            onChange={(e) => setDraft((prev) => ({ ...prev, metaDescription: e.target.value }))}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Edit3 className="w-3.5 h-3.5" />
            Article Sections
          </span>
          <textarea
            value={sectionsText}
            onChange={(e) => setSectionsText(e.target.value)}
            rows={14}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-relaxed font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            placeholder={'Section heading\nFirst paragraph\nSecond paragraph\n- Optional bullet\n---\nNext section heading\nParagraph'}
          />
        </label>
      </section>
    </div>
  );
};
