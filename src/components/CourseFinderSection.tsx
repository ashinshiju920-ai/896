import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Star } from 'lucide-react';
import { BookCover } from './BookCover';
import { Book, BookFormat, ExamCategory, HomeSpotlightConfig } from '../types';

type DestinationCode = 'LHR' | 'DXB' | 'JFK' | 'SYD' | 'FRA' | 'COK';
type CourseCode = 'IELTS' | 'OET' | 'PTE' | 'German' | 'CBT' | 'Not sure yet';

interface Destination {
  code: DestinationCode;
  title: string;
  courses: CourseCode[];
}

export const COURSE_FINDER_DESTINATIONS: Destination[] = [
  { code: 'LHR', title: 'UK & Ireland', courses: ['OET', 'IELTS', 'CBT', 'Not sure yet'] },
  { code: 'DXB', title: 'Gulf countries', courses: ['OET', 'IELTS', 'PTE', 'Not sure yet'] },
  { code: 'JFK', title: 'USA & Canada', courses: ['IELTS', 'PTE', 'OET', 'Not sure yet'] },
  { code: 'SYD', title: 'Australia & NZ', courses: ['PTE', 'IELTS', 'OET', 'Not sure yet'] },
  { code: 'FRA', title: 'Germany', courses: ['German', 'IELTS', 'Not sure yet'] },
  { code: 'COK', title: 'Mock Test', courses: ['CBT'] },
];

export const COURSE_FINDER_COURSES: CourseCode[] = ['IELTS', 'OET', 'PTE', 'German', 'CBT', 'Not sure yet'];

const courseDescriptions: Record<CourseCode, string> = {
  IELTS: 'International English Language Testing System',
  OET: 'Occupational English Test',
  PTE: 'Pearson Test of English',
  German: 'German language pathway',
  CBT: 'Computer Based Test preparation route',
  'Not sure yet': 'Help me choose',
};

const courseToCategory: Partial<Record<CourseCode, ExamCategory>> = {
  IELTS: 'IELTS',
  OET: 'OET',
  PTE: 'PTE',
  German: 'German',
};

const getMockTestProduct = (books: Book[]) => {
  const published = books.filter((book) => book.active !== false);
  return (
    published.find((book) => book.title.toLowerCase().includes('mock test engine')) ||
    published.find((book) => book.id.includes('practice-tests')) ||
    published.find((book) => book.category === 'Mock Test' || book.type === 'Mock Tests') ||
    published[0]
  );
};

interface CourseFinderSectionProps {
  books: Book[];
  config?: HomeSpotlightConfig;
  buyNow: (book: Book, format?: BookFormat) => void;
  navigateToProduct: (id: string) => void;
}

const getRecommendedBooks = (
  books: Book[],
  course: CourseCode | null,
  destination: Destination | null,
  config?: HomeSpotlightConfig
) => {
  const published = books.filter((book) => book.active !== false);
  const mappedIds = course ? config?.courseFinderProductMap?.[course] || [] : [];
  const mappedBooks = mappedIds
    .map((id) => published.find((book) => book.id === id))
    .filter(Boolean) as Book[];

  if (mappedBooks.length > 0) return mappedBooks.slice(0, 4);

  if (!course || course === 'Not sure yet') {
    const destinationCategories = destination
      ? destination.courses.map((item) => courseToCategory[item]).filter(Boolean) as ExamCategory[]
      : [];

    return published
      .filter((book) => (
        book.id === 'select-your-path-guide' ||
        book.category === 'Mock Test' ||
        destinationCategories.includes(book.category)
      ))
      .slice(0, 4);
  }

  const category = courseToCategory[course];
  if (!category) return published.filter((book) => book.category === 'Mock Test' || book.type === 'Mock Tests').slice(0, 4);

  return published.filter((book) => book.category === category).slice(0, 4);
};

export const CourseFinderSection: React.FC<CourseFinderSectionProps> = ({
  books,
  config,
  buyNow,
  navigateToProduct,
}) => {
  const [destination, setDestination] = React.useState<Destination | null>(null);
  const [course, setCourse] = React.useState<CourseCode | null>(null);
  const step = course ? 3 : destination ? 2 : 1;
  const recommendedBooks = React.useMemo(
    () => getRecommendedBooks(books, course, destination, config),
    [books, course, destination, config]
  );

  if (config?.enabled === false) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 -mt-4 sm:-mt-12">
      <div className="relative overflow-hidden rounded-[22px] sm:rounded-[28px] border border-[#09002f] bg-white shadow-[0_18px_45px_rgba(4,0,34,0.14)] sm:shadow-[0_24px_70px_rgba(4,0,34,0.16)]">
        <div className="bg-[#171333] px-4 sm:px-6 py-4 sm:py-5 text-white">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight">COK</div>
              <div className="mt-1 text-xs font-medium">Kerala</div>
            </div>
            <div className="course-plane-track relative mx-2 sm:mx-4 flex-1 h-7 sm:h-8 min-w-16 flex items-center overflow-hidden">
              <span className="block h-px w-full border-t border-dashed border-white/50" />
              <div className="course-plane-runner absolute top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-10">
                {/* Glowing jet contrail vapor behind tail */}
                <span className="h-[2px] w-6 sm:w-10 bg-gradient-to-l from-yellow-300/80 via-yellow-300/30 to-transparent -mr-1 rounded-full" />
                {/* Authentic commercial airliner silhouette - forward heading East */}
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-300 fill-current drop-shadow-[0_0_8px_rgba(253,224,71,0.65)] shrink-0"
                  viewBox="0 0 576 512"
                  aria-hidden="true"
                >
                  <path d="M482.3 192c34.2 0 93.7 29 93.7 64 0 36-59.5 64-93.7 64l-116.6 0-149.2 165.9c-7.4 8.3-18.1 13.1-29.3 13.1l-34.6 0c-8.6 0-15.1-7.7-13.7-16.2l30.9-182.8-105.1 0-38.3 47.9c-4.4 5.5-11.1 8.7-18.2 8.7L2.7 356.6c-4.2 0-7.3-4.1-6.1-8.1l20.4-68.5-20.4-68.5c-1.2-4 1.9-8.1 6.1-8.1l10.4 0c7.1 0 13.8 3.2 18.2 8.7l38.3 47.9 105.1 0-30.9-182.8c-1.4-8.5 5.1-16.2 13.7-16.2l34.6 0c11.2 0 21.9 4.8 29.3 13.1L365.7 192l116.6 0z" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight">{destination?.code || '...'}</div>
              <div className="mt-1 max-w-28 truncate text-xs font-medium sm:max-w-none">{destination?.title || 'Your destination'}</div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5 sm:py-7">
          <div className="mb-5 flex items-center gap-2">
            {[1, 2, 3, 4].map((item) => (
              <span key={item} className={`h-2.5 w-2.5 rounded-full ${item <= step ? 'bg-[#f1c900]' : 'bg-[#dddeeb]'}`} />
            ))}
          </div>

          {step === 1 && (
            <>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#00875a]">
                <Sparkles className="h-4 w-4" />
                Find your course
              </div>
              <h2 className="mt-2 text-[1.55rem] leading-tight sm:text-3xl font-black tracking-tight text-[#080066]">Where are you headed?</h2>
              <p className="mt-1 text-sm text-[#4f4a78]">We will show you the right exam and recommended books.</p>
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {COURSE_FINDER_DESTINATIONS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      if (item.code === 'COK') {
                        const mockTestProduct = getMockTestProduct(books);
                        if (mockTestProduct) navigateToProduct(mockTestProduct.id);
                        return;
                      }
                      setDestination(item);
                      setCourse(null);
                    }}
                    className="flex min-h-14 items-center gap-3 sm:gap-4 rounded-xl border border-[#d9d9ea] bg-white px-3.5 sm:px-4 py-3 text-left transition-all hover:border-[#080066] hover:shadow-md active:scale-[0.99]"
                  >
                    <span className="w-12 shrink-0 text-lg font-black text-[#080066]">{item.code}</span>
                    <span className="block text-sm font-black text-[#05001f]">{item.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && destination && (
            <>
              <h2 className="text-[1.55rem] leading-tight sm:text-3xl font-black tracking-tight text-[#080066]">Which course?</h2>
              <p className="mt-1 text-sm text-[#4f4a78]">Popular for {destination.title}.</p>
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-2">
                {destination.courses.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCourse(item)}
                    className="min-h-18 rounded-xl border border-[#d9d9ea] bg-white px-3.5 sm:px-4 py-3 text-left transition-all hover:border-[#080066] hover:shadow-md active:scale-[0.99]"
                  >
                    <span className="block text-base font-black text-[#080066]">{item}</span>
                    <span className="mt-1 block text-xs text-[#4f4a78]">{courseDescriptions[item]}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setDestination(null)} className="mt-5 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#171333] underline underline-offset-4">
                <ArrowLeft className="h-3.5 w-3.5" />
                Change destination
              </button>
            </>
          )}

          {step === 3 && destination && course && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-[1.55rem] leading-tight sm:text-3xl font-black tracking-tight text-[#080066]">Recommended books</h2>
                  <p className="mt-1 text-sm text-[#4f4a78]">
                    {course === 'Not sure yet' ? `Best starting points for ${destination.title}.` : `${course} materials picked for ${destination.title}.`}
                  </p>
                </div>
                <button type="button" onClick={() => setCourse(null)} className="self-start min-h-10 text-sm font-semibold text-[#171333] underline underline-offset-4">
                  Change course
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {recommendedBooks.map((book) => (
                  <article key={book.id} className="rounded-2xl border border-[#dedff0] bg-white p-3 shadow-sm">
                    <div className="flex gap-3">
                      <button type="button" onClick={() => navigateToProduct(book.id)} className="flex h-28 w-20 sm:h-32 sm:w-24 shrink-0 items-center justify-center rounded-xl bg-[#f6f7fb]">
                        <div className="scale-[0.68] sm:scale-75">
                          <BookCover book={book} size="sm" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400 shrink-0" />
                          {book.rating}
                          <span className="text-[#817da0]">({book.reviewCount})</span>
                        </div>
                        <button type="button" onClick={() => navigateToProduct(book.id)} className="mt-2 text-left w-full">
                          <h3 className="line-clamp-2 text-sm font-black leading-snug text-[#080066]">{book.title}</h3>
                          <p className="mt-1 line-clamp-1 text-xs text-[#625d88]">{book.subtitle}</p>
                        </button>
                        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-lg sm:text-xl font-black text-[#05001f]">₹{book.prices?.digital?.price ?? 199}</span>
                          <span className="text-xs font-semibold text-[#817da0] line-through">₹{book.prices?.digital?.originalPrice ?? 599}</span>
                        </div>
                        <button
                          type="button"
                          id={`buy-now-course-finder-${book.id}`}
                          onClick={() => buyNow(book, 'digital')}
                          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#00875a] px-3 sm:px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-900/10 transition-all hover:bg-[#00734c] active:scale-95"
                        >
                          <span>Buy Now • Checkout</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative border-t border-dashed border-[#dedff0] bg-[#f7f7ff] px-4 sm:px-6 py-4">
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-slate-50" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-slate-50" />
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-[11px] sm:text-xs">
            <div>
              <div className="text-[#625d88]">Destination</div>
              <div className="mt-1 font-black text-[#05001f]">{destination?.code || '-'}</div>
            </div>
            <div>
              <div className="text-[#625d88]">Course</div>
              <div className="mt-1 truncate font-black text-[#05001f]">{course || '-'}</div>
            </div>
            <div>
              <div className="text-[#625d88]">Checkout</div>
              <div className="mt-1 inline-flex items-center gap-1 font-black text-[#05001f]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#00875a] shrink-0" />
                Buy now
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
