import React from 'react';
import { Award, BookOpen, Users, CheckCircle2, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { XylemLogo } from '../components/XylemLogo';

export const AboutView: React.FC = () => {
  const { setCurrentView } = useShop();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Brand Hero */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="flex justify-center mb-4">
          <XylemLogo size="lg" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          LEARN BETTER. SCORE HIGHER.
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
          Empowering Learners Across Global Milestones
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          Xylem Learning is India's leading specialized academic and test-preparation publishing house, dedicated to helping students and professionals conquer IELTS, OET, PTE, and German language certifications.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">50,000+</div>
          <div className="text-xs font-semibold text-slate-500 mt-1 font-['DM_Sans',sans-serif]">Learners Prepared</div>
        </div>
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#00875a] font-['Plus_Jakarta_Sans',sans-serif]">8.0+</div>
          <div className="text-xs font-semibold text-slate-500 mt-1 font-['DM_Sans',sans-serif]">Average IELTS Score</div>
        </div>
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">100%</div>
          <div className="text-xs font-semibold text-slate-500 mt-1 font-['DM_Sans',sans-serif]">Verified Exam Formats</div>
        </div>
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#00875a] font-['Plus_Jakarta_Sans',sans-serif]">4.9/5</div>
          <div className="text-xs font-semibold text-slate-500 mt-1 font-['DM_Sans',sans-serif]">Learner Satisfaction</div>
        </div>
      </div>

      {/* Philosophy Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">Curated by Master Educators</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-['DM_Sans',sans-serif]">
            Every chapter, practice question, and model test in our digital guides is written and audited by certified trainers and former examiners.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">Simulated Mock Exams</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-['DM_Sans',sans-serif]">
            Realistic timing, high-probability prompts, and authentic question formats give you real exam stamina before your test day.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">Digital & Physical Harmony</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-['DM_Sans',sans-serif]">
            Instant digital access so you can start studying right away, backed by high-quality print editions with nationwide delivery.
          </p>
        </div>
      </div>

      {/* CTA Box */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0a2540] to-[#0d3356] text-white p-8 sm:p-12 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif]">
          Ready to achieve your target band?
        </h2>
        <p className="text-sm text-slate-300 max-w-xl mx-auto">
          Explore our complete study guides and start your preparation with Xylem Learning today.
        </p>
        <button
          onClick={() => setCurrentView('catalog')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00875a] hover:bg-[#00734c] text-white font-semibold text-sm shadow-md transition-colors"
        >
          <span>Explore Study Materials</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
