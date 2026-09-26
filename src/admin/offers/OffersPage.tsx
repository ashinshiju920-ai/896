import React from 'react';
import {
  Tag,
  ShieldCheck,
  Percent,
  CheckCircle2,
  Gift,
  AlertCircle,
  Copy,
  Info,
} from 'lucide-react';

interface OffersPageProps {
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const OffersPage: React.FC<OffersPageProps> = ({ showToast }) => {
  const verifiedCoupons = [
    {
      code: 'XYLEM20',
      description: 'Flat 20% discount on order subtotal for all exam study materials.',
      discountRule: '20% off subtotal',
      formula: 'Math.round(subtotal * 0.20)',
      scope: 'Global storefront checkout',
      status: 'Active',
    },
    {
      code: 'FIRST50',
      description: '₹50 flat discount for first-time learners on any study guide order.',
      discountRule: '₹50 off subtotal',
      formula: 'Math.min(50, subtotal)',
      scope: 'Global storefront checkout',
      status: 'Active',
    },
    {
      code: 'SPECIALOFFER',
      description: 'Special seasonal 15% discount for candidate test preparation.',
      discountRule: '15% off subtotal',
      formula: 'Math.round(subtotal * 0.15)',
      scope: 'Promotional campaigns',
      status: 'Active',
    },
    {
      code: 'OFFER67',
      description: 'Partner institutional candidate voucher awarding 15% discount.',
      discountRule: '15% off subtotal',
      formula: 'Math.round(subtotal * 0.15)',
      scope: 'Institutional enrollments',
      status: 'Active',
    },
  ];

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`Coupon code "${code}" copied to clipboard!`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
          Promotions, Coupons & Bundle Deals
        </h2>
        <p className="text-xs text-slate-500">
          Server-authoritative promotion codes and active add-on discount rules verified at checkout.
        </p>
      </div>

      {/* Security Architecture Callout */}
      <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-3xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wide">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Server-Authoritative Pricing Architecture (Phase 3 & 4 Hardened)</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
          To prevent client-side price tampering, all coupon discount calculations are verified directly inside the
          Cloudflare Pages Function edge engine (<code>functions/utils/pricing.js</code>). Client browsers cannot fabricate or alter coupon deductions.
        </p>
      </div>

      {/* Active Verified Coupons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Verified Server Promotion Codes
          </h3>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
            {verifiedCoupons.length} Active Codes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {verifiedCoupons.map((coupon) => (
            <div
              key={coupon.code}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl font-mono tracking-wider">
                      {coupon.code}
                    </span>
                    <button
                      onClick={() => copyCoupon(coupon.code)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Copy Code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{coupon.status}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {coupon.description}
                </p>

                <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 font-mono text-[11px] text-slate-700 border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rule:</span>
                    <strong className="text-slate-900">{coupon.discountRule}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Formula:</span>
                    <span className="text-emerald-700 font-semibold">{coupon.formula}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100">
                <span>Scope: {coupon.scope}</span>
                <span className="text-emerald-700 font-bold">Edge Verified</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bundle Deals Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Active Catalog Bundle Deal: "Buy 2 Get 3rd Add-on FREE"
          </h3>
        </div>

        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
          The application supports an automated bundle incentive on any study guide configured with <code>buy2Get3rdFree: true</code>.
          When a student adds 2 or more add-on items (such as Speaking Cue Cards, Writing Templates, or Mock Answer Keys) to their cart,
          the system automatically applies a 100% discount on the lowest priced add-on item directly on the checkout summary.
        </p>

        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-3">
          <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <p>
            You can enable or disable this deal for each individual study guide in the <strong>All Products → Edit Product → Add-ons & Deals</strong> tab.
          </p>
        </div>
      </div>
    </div>
  );
};
