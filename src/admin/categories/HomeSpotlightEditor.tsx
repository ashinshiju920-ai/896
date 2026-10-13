import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Save, Search } from 'lucide-react';
import { COURSE_FINDER_COURSES, COURSE_FINDER_DESTINATIONS } from '../../components/CourseFinderSection';
import { Book, HomeSpotlightConfig } from '../../types';
import { DEFAULT_HOME_SPOTLIGHT } from '../../data/homeSpotlight';

interface HomeSpotlightEditorProps {
  books: Book[];
  homeSpotlight?: HomeSpotlightConfig;
  onUpdateHomeSpotlight: (updated: Partial<HomeSpotlightConfig>) => Promise<boolean> | void;
  onResetHomeSpotlight?: () => Promise<boolean> | void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const categoryForCourse: Record<string, string> = {
  IELTS: 'IELTS',
  OET: 'OET',
  PTE: 'PTE',
  German: 'German',
  CBT: 'Mock Test',
  'Not sure yet': 'Mock Test',
};

export const HomeSpotlightEditor: React.FC<HomeSpotlightEditorProps> = ({
  books,
  homeSpotlight,
  onUpdateHomeSpotlight,
  onResetHomeSpotlight,
  showToast,
}) => {
  const activeConfig = useMemo(() => ({ ...DEFAULT_HOME_SPOTLIGHT, ...(homeSpotlight || {}) }), [homeSpotlight]);
  const [enabled, setEnabled] = useState(activeConfig.enabled !== false);
  const [selectedCourse, setSelectedCourse] = useState<string>('IELTS');
  const [productMap, setProductMap] = useState<Record<string, string[]>>(activeConfig.courseFinderProductMap || {});
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEnabled(activeConfig.enabled !== false);
    setProductMap(activeConfig.courseFinderProductMap || {});
  }, [activeConfig]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books
      .filter((book) => book.active !== false)
      .filter((book) => {
        if (!normalized) return true;
        return `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(normalized);
      });
  }, [books, query]);

  const selectedIds = productMap[selectedCourse] || [];
  const selectedBooks = selectedIds
    .map((id) => books.find((book) => book.id === id))
    .filter(Boolean) as Book[];

  const toggleProduct = (bookId: string) => {
    setProductMap((prev) => {
      const current = prev[selectedCourse] || [];
      const next = current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId];
      return { ...prev, [selectedCourse]: next };
    });
  };

  const autoFillCourse = () => {
    const targetCategory = categoryForCourse[selectedCourse];
    const nextIds = books
      .filter((book) => book.active !== false)
      .filter((book) => (
        selectedCourse === 'Not sure yet'
          ? book.id === 'select-your-path-guide' || book.category === 'Mock Test'
          : book.category === targetCategory || book.type === 'Mock Tests'
      ))
      .slice(0, 4)
      .map((book) => book.id);

    setProductMap((prev) => ({ ...prev, [selectedCourse]: nextIds }));
    showToast(`Auto-filled ${selectedCourse} recommendations`, 'info');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateHomeSpotlight({
        enabled,
        courseFinderProductMap: productMap,
      });
      showToast('Course finder product connections saved', 'success');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (onResetHomeSpotlight) {
      await onResetHomeSpotlight();
      showToast('Course finder reset to automatic recommendations', 'info');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <form onSubmit={handleSave} className="xl:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              Homepage Course Finder
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Connect each course choice to products shown in the boarding-pass finder under the homepage hero.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#00875a]"
            />
            Enabled
          </label>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COURSE_FINDER_COURSES.map((course) => (
              <button
                key={course}
                type="button"
                onClick={() => setSelectedCourse(course)}
                className={`rounded-xl px-3 py-2 text-xs font-bold text-left transition-all ${
                  selectedCourse === course
                    ? 'bg-[#00875a] text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-200'
                }`}
              >
                {course}
                <span className="block text-[10px] opacity-75 mt-0.5">
                  {(productMap[course] || []).length} product{(productMap[course] || []).length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{selectedCourse} Products</h3>
            <p className="text-xs text-slate-500">Select products in the order you want customers to see them.</p>
          </div>
          <button
            type="button"
            onClick={autoFillCourse}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            Auto-fill
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Search products by title, subtitle, or category"
          />
        </div>

        <div className="max-h-[460px] overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {filteredBooks.map((book) => {
            const isSelected = selectedIds.includes(book.id);
            return (
              <button
                key={book.id}
                type="button"
                onClick={() => toggleProduct(book.id)}
                className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                  isSelected ? 'bg-emerald-50/70' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <span className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-[#00875a] border-[#00875a] text-white' : 'border-slate-300 bg-white'
                }`}>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 line-clamp-1">{book.title}</span>
                  <span className="block text-[11px] text-slate-500 line-clamp-1 mt-0.5">{book.subtitle}</span>
                  <span className="inline-flex mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{book.category}</span>
                </span>
                <span className="text-xs font-black text-slate-900 shrink-0">₹{book.prices?.digital?.price ?? 199}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875a] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Course Finder'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Automatic
          </button>
        </div>
      </form>

      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900">Preview Connections</h3>
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-[#171333] text-white p-4 flex items-center justify-between">
            <div>
              <div className="text-2xl font-black">COK</div>
              <div className="text-[11px]">Kerala</div>
            </div>
            <div className="text-xs text-yellow-300">- - - ✈ - - -</div>
            <div className="text-right">
              <div className="text-2xl font-black">•••</div>
              <div className="text-[11px]">Your destination</div>
            </div>
          </div>
          <div className="p-4 bg-white">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{selectedCourse}</p>
            <div className="mt-3 space-y-2">
              {selectedBooks.length > 0 ? selectedBooks.map((book) => (
                <div key={book.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1">{book.title}</span>
                  <span className="text-xs font-black text-[#00875a] shrink-0">₹{book.prices?.digital?.price ?? 199}</span>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No manual products selected. Storefront will use automatic recommendations.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
          <p className="text-xs font-bold text-blue-900">Destination logic</p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] text-blue-700">
            {COURSE_FINDER_DESTINATIONS.map((destination) => (
              <div key={destination.code}>
                <span className="font-black">{destination.code}</span> {destination.title}: {destination.courses.join(', ')}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
