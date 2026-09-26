import React, { useState } from 'react';
import { X, Download, BookOpen, ChevronLeft, ChevronRight, CheckCircle2, Bookmark, Printer } from 'lucide-react';
import { useShop } from '../context/ShopContext';

export const PdfViewerModal: React.FC = () => {
  const { isPdfModalOpen, closePdfViewer, activePdfBook, showToast, shippingInfo } = useShop();
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 14;

  if (!isPdfModalOpen || !activePdfBook) return null;

  const handleDownload = () => {
    // Generate text blob for true file download
    const content = `XYLEM LEARNING - OFFICIAL DIGITAL STUDY GUIDE\n\nTitle: ${activePdfBook.title}\nSubtitle: ${activePdfBook.subtitle}\nCategory: ${activePdfBook.category}\n\nFeatures:\n${activePdfBook.features.map(f => `• ${f}`).join('\n')}\n\nWhat You Get:\n${activePdfBook.whatYouGet.map(w => `✓ ${w}`).join('\n')}\n\nTable of Contents:\n${activePdfBook.tableOfContents.map(t => `${t.chapter} ........... ${t.pages}`).join('\n')}\n\nThank you for choosing Xylem Learning!\nSupport: support@xylemlearning.com\nWebsite: https://xylemlearning.com`;
    
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activePdfBook.samplePdfName || `${activePdfBook.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Downloaded ${activePdfBook.samplePdfName}!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[90vh] bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <h3 className="text-sm font-bold truncate">{activePdfBook.title}</h3>
              <p className="text-xs text-slate-400 truncate">
                Digital Edition • Page {currentPage} of {totalPages}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => showToast('Sending document to printer...')}
              className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={closePdfViewer}
              className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reader Document Canvas */}
        <div className="flex-1 bg-slate-800 overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-lg shadow-xl p-6 sm:p-10 min-h-[700px] flex flex-col justify-between font-serif select-text border border-slate-200">
            {/* Page Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs text-slate-500 font-sans font-medium">
              <span className="font-bold text-emerald-700 uppercase tracking-wider">
                Xylem Learning • Official Material
              </span>
              <span>{activePdfBook.category} Exam Prep</span>
            </div>

            {/* Content varies by page */}
            {currentPage === 1 && (
              <div className="my-auto py-8 text-center">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest font-sans mb-4">
                  Official Digital Courseware
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold font-sans text-slate-950 mb-2">
                  {activePdfBook.title}
                </h1>
                <p className="text-sm text-slate-600 font-sans max-w-md mx-auto mb-8">
                  {activePdfBook.subtitle}
                </p>

                <div className="w-24 h-1 bg-emerald-600 mx-auto mb-8 rounded-full"></div>

                <div className="text-left max-w-md mx-auto bg-slate-50 p-5 rounded-xl border border-slate-200 font-sans text-xs space-y-2">
                  <div className="font-bold text-slate-900 mb-2 text-sm">Included in this Guide:</div>
                  {activePdfBook.whatYouGet.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPage === 2 && (
              <div className="my-auto py-4 font-sans">
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                  Table of Contents
                </h2>
                <div className="space-y-4">
                  {activePdfBook.tableOfContents.map((item, idx) => (
                    <div key={idx} className="flex items-baseline justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="text-sm font-medium text-slate-800 hover:text-emerald-700 cursor-pointer">
                        {item.chapter}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{item.pages}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPage >= 3 && (
              <div className="my-auto py-4 font-sans text-sm leading-relaxed text-slate-800 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Chapter {currentPage - 2}: {activePdfBook.tableOfContents[(currentPage - 3) % activePdfBook.tableOfContents.length]?.chapter || 'Diagnostic Strategy'}
                </h3>
                <p className="text-slate-600">
                  Welcome to the core instructional section of this guide. In this module, examiners evaluate candidates on precision, coherence, fluency, and grammatical accuracy.
                </p>
                <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-lg my-4">
                  <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider mb-1">
                    Examiner High-Score Tip
                  </h4>
                  <p className="text-xs text-emerald-900">
                    Always allocate 2-3 minutes at the conclusion of each test section to review spelling and grammatical agreements. In the listening sub-test, numbers and plural endings account for over 35% of lost marks.
                  </p>
                </div>
                <h4 className="font-bold text-slate-900 mt-4">Sample Practice Drill:</h4>
                <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-800">
                  Q1. Which method best mitigates timing pressure during academic reading skimming?<br />
                  A) Reading every paragraph thoroughly<br />
                  B) Identifying topic sentences and scanning for keywords<br />
                  C) Skipping passage 3 directly
                </div>
                <p className="text-xs text-slate-500 italic mt-2">
                  Answer: B — Topic sentences establish 80% of paragraph context.
                </p>
              </div>
            )}

            {/* Page Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-400 font-sans">
              <span>{shippingInfo.fullName ? `Licensed to: ${shippingInfo.fullName}` : 'Licensed Educational Preview • Xylem Learning'}</span>
              <span>Page {currentPage}</span>
            </div>
          </div>
        </div>

        {/* Bottom Navigation controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 text-white shrink-0">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 text-center bg-slate-800 text-white rounded border border-slate-700 py-0.5 text-xs"
            />
            <span>of {totalPages}</span>
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
