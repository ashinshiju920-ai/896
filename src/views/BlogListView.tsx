import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Clock } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogs';
import { BackButton } from '../components/BackButton';

export const BlogListView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-10 space-y-8 sm:space-y-10">
      <div className="flex items-center justify-between">
        <BackButton to="/" label="Home" />
        <Link to="/books" className="hidden sm:inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-800">
          Shop Study Materials
        </Link>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-[#0a2540] via-[#0f3459] to-[#062033] text-white p-6 sm:p-10 lg:p-12 overflow-hidden relative">
        <div className="max-w-3xl space-y-4 relative z-10">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-emerald-300">
            <BookOpen className="w-4 h-4" />
            Aylem Learning Blog
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-tight">
            Exam preparation guides for Kerala and India learners
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Practical articles on IELTS books Kerala, OET mock test Kerala, PTE practice test India,
            German language study material Kerala, and online IELTS mock test preparation.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
        {BLOG_POSTS.map((post) => (
          <article
            key={post.slug}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between gap-5"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md">
                  {post.category}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  {post.keyword}
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] leading-snug">
                <Link to={`/blog/${post.slug}`} className="hover:text-emerald-700 transition-colors">
                  {post.title}
                </Link>
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{post.excerpt}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-slate-500">
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

              <Link
                to={`/blog/${post.slug}`}
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 group"
              >
                <span>Read guide</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
