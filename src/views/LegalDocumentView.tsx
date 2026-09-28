import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { LegalDocument } from '../data/legal';

interface LegalDocumentViewProps {
  document: LegalDocument;
}

export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({ document }) => {
  return (
    <div className="bg-slate-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-12">
        <div className="mb-6">
          <BackButton to="/" label="Home" />
        </div>

        <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <header className="bg-[#0a2540] text-white px-5 py-8 sm:px-10 sm:py-12">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300 mb-4">
              <ShieldCheck className="w-4 h-4" />
              <span>Aylem Learning PVT</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
              {document.title}
            </h1>
            <p className="mt-3 text-sm text-slate-300">Last Updated: {document.lastUpdated}</p>
          </header>

          <div className="px-5 py-7 sm:px-10 sm:py-10 space-y-8">
            <div className="space-y-3 text-sm sm:text-base text-slate-700 leading-relaxed">
              {document.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="space-y-8">
              {document.sections.map((section) => (
                <section key={section.title} className="border-t border-slate-200 pt-6">
                  <h2 className="text-lg sm:text-xl font-bold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
                    {section.title}
                  </h2>

                  {section.paragraphs && (
                    <div className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  )}

                  {section.items && (
                    <ul className="mt-3 grid gap-2 text-sm text-slate-700 leading-relaxed list-disc pl-5">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm">
              <p className="text-slate-500">Questions about this document?</p>
              <Link
                to="/about"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};
