import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Youtube, Facebook, Linkedin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { XylemLogo } from './XylemLogo';
import { useShop } from '../context/ShopContext';
import { ExamCategory } from '../types';

export const Footer: React.FC = () => {
  const { setIsContactModalOpen, showToast } = useShop();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const val = email.trim();
    if (!val) return;

    setSubscribed(true);
    showToast('Thank you for subscribing to Aylem Learning updates!');
    setEmail('');
  };

  return (
    <footer className="bg-[#0b1f33] text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          {/* Col 1: Brand & Bio */}
          <div className="lg:col-span-2 space-y-5">
            <Link to="/" className="inline-block bg-white/95 p-3 rounded-xl shadow-md hover:opacity-95 transition-opacity">
              <XylemLogo size="md" showTagline={true} />
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Aylem Learning is your dedicated preparation partner for global language and professional licensing examinations. Trusted by over 50,000+ learners across India and abroad.
            </p>
            <div className="pt-2 space-y-2">
              <div className="text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                Customer Care & Inquiries
              </div>
              <div className="space-y-0.5">
                <a
                  href="mailto:aylembookstore@gmail.com"
                  className="text-sm text-slate-300 hover:text-emerald-400 font-medium transition-colors block"
                >
                  aylembookstore@gmail.com
                </a>
                <a
                  href="tel:+916282377918"
                  className="text-xs text-slate-400 hover:text-emerald-400 transition-colors block"
                >
                  +91 6282377918 (Mon - Sat, 9 AM - 7 PM IST)
                </a>
              </div>
              <div className="pt-1.5 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Office Address
                </span>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5 max-w-sm">
                  Aylem Learning PVT, 34/1000 edappally junction, kochi, ernakulam, keralam 682024
                </p>
              </div>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="hover:text-emerald-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/books?category=IELTS" className="hover:text-emerald-400 transition-colors">
                  IELTS
                </Link>
              </li>
              <li>
                <Link to="/books?category=OET" className="hover:text-emerald-400 transition-colors">
                  OET
                </Link>
              </li>
              <li>
                <Link to="/books?category=PTE" className="hover:text-emerald-400 transition-colors">
                  PTE
                </Link>
              </li>
              <li>
                <Link to="/books?category=German" className="hover:text-emerald-400 transition-colors">
                  German
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Shop */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              Shop
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/books" className="hover:text-emerald-400 transition-colors">
                  Study Materials
                </Link>
              </li>
              <li>
                <Link to="/books" className="hover:text-emerald-400 transition-colors">
                  Books
                </Link>
              </li>
              <li>
                <Link to="/books" className="hover:text-emerald-400 transition-colors">
                  Bundle Offers
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-emerald-400 transition-colors">
                  Track Order / My PDFs
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: About & Join Community */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              About
            </h4>
            <ul className="space-y-2.5 text-sm mb-6">
              <li>
                <Link to="/about" className="hover:text-emerald-400 transition-colors">
                  Our Story
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-emerald-400 transition-colors">
                  Why Aylem
                </Link>
              </li>
              <li>
                <button
                  onClick={() => setIsContactModalOpen(true)}
                  className="hover:text-emerald-400 transition-colors cursor-pointer text-left"
                >
                  Contact Us
                </button>
              </li>
            </ul>

            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 font-['Plus_Jakarta_Sans',sans-serif]">
              Join Our Community
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Get updates, offers, and free exam tips.
            </p>

            {subscribed ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Subscribed! Check your inbox soon.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="px-3 py-2 bg-slate-900/90 text-xs rounded-l-lg border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 flex-1 min-w-0"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-r-lg transition-colors flex items-center justify-center shrink-0"
                  aria-label="Subscribe to newsletter"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            <div className="flex items-center space-x-3 pt-6">
              <a
                href="#instagram"
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#youtube"
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-600 transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="#facebook"
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-600 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#linkedin"
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-600 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright & policies bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div>
            © 2025 Aylem Learning. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link
              to="/privacy-policy"
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-and-conditions"
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Terms & Conditions
            </Link>
            <Link
              to="/shipping-returns-refund-policy"
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Shipping & Returns
            </Link>
            <Link
              to="/admin"
              className="hover:text-emerald-400 transition-colors text-slate-500 hover:underline"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
