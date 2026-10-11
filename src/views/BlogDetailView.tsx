import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, Clock } from 'lucide-react';
import { BLOG_POSTS, findBlogBySlug } from '../data/blogs';
import { BackButton } from '../components/BackButton';
import { NotFoundView } from './NotFoundView';
import { useShop } from '../context/ShopContext';

export const BlogDetailView: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const post = findBlogBySlug(slug);
  const { books, buyNow } = useShop();

  if (!post) {
    return (
      <NotFoundView
        title="Blog Not Found"
        message="This article may have moved. Browse the Aylem Learning blog for exam preparation guides."
      />
    );
  }

  const relatedProducts = post.relatedProductIds
    .map((id) => books.find((book) => book.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const relatedPosts = BLOG_POSTS.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-10 space-y-8 sm:space-y-10">
      <div className="flex items-center justify-between">
        <BackButton to="/blog" label="Blog" />
        <Link to="/books" className="hidden sm:inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-800">
          Browse Books
        </Link>
      </div>

      <article className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <header className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/70 px-5 py-8 sm:px-10 sm:py-12 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md">
              {post.category}
            </span>
            <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
              {post.keyword}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-tight">
            {post.title}
          </h1>
          <p className="text-base text-slate-600 leading-relaxed mt-4 max-w-3xl">
            {post.excerpt}
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-500 mt-5">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
              {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              {post.readTime}
            </span>
          </div>
        </header>

        <div className="px-5 py-8 sm:px-10 sm:py-10 space-y-9">
          {post.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="grid gap-2 pt-1">
                  {section.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      {relatedProducts.length > 0 && (
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Recommended material</span>
              <h2 className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] mt-1">
                Study resources related to this guide
              </h2>
            </div>
            <Link to="/books" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
              View all products
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedProducts.map((book) => (
              <div key={book!.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{book!.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{book!.subtitle}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-black text-[#0a2540]">₹{book!.prices.digital.price}</span>
                  <button
                    type="button"
                    onClick={() => buyNow(book!, 'digital')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00875a] text-white text-xs font-bold hover:bg-[#00734c]"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-slate-200 pt-7">
        <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] mb-4">
          More exam preparation articles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {relatedPosts.map((item) => (
            <Link
              key={item.slug}
              to={`/blog/${item.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-200 hover:shadow-sm transition-all group"
            >
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">{item.category}</span>
              <h3 className="text-sm font-bold text-slate-900 mt-2 group-hover:text-emerald-700 line-clamp-2">
                {item.title}
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 mt-3">
                Read article <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
