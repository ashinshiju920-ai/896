import React, { useState, useMemo } from 'react';
import {
  Star,
  Check,
  FileText,
  DownloadCloud,
  BookOpen,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Users,
  Eye,
  Info,
} from 'lucide-react';
import { Book, ProductAddon } from '../types';
import { BookCover } from './BookCover';

interface ProductPurchasePreviewProps {
  book: Partial<Book>;
  className?: string;
  isSimulated?: boolean;
}

export const ProductPurchasePreview: React.FC<ProductPurchasePreviewProps> = ({
  book,
  className = '',
  isSimulated = true,
}) => {
  // Extract all active add-ons
  const rawAddons = Array.isArray(book.addOns)
    ? book.addOns
    : (Array.isArray(book.addons) ? book.addons : []);

  // Filter only active add-ons for the customer preview
  const activeAddons = useMemo(() => {
    return rawAddons.filter((a) => a.active !== false);
  }, [rawAddons]);

  // Local simulated selection state
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    // By default, select the first digital add-on if available
    const first = activeAddons.find((a) => a.id === 'digital' || a.deliveryOption === 'digital');
    return first ? [first.id] : (activeAddons[0] ? [activeAddons[0].id] : []);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const digitalPrice = Number(book.prices?.digital?.price) || 199;
  const digitalOrig = Number(book.prices?.digital?.originalPrice) || 599;

  // Calculate simulated display total
  const selectedAddonsList = activeAddons.filter((a) => selectedIds.includes(a.id));
  const hasFormatAddon = selectedAddonsList.some((a) => a.id === 'digital' || a.id === 'physical');

  const addOnsTotal = selectedAddonsList
    .filter((a) => (hasFormatAddon ? a.id !== 'digital' && a.id !== 'physical' : true))
    .reduce((sum, a) => sum + (Number(a.price) || 0), 0);

  const displayTotal = (hasFormatAddon ? 0 : digitalPrice) + selectedAddonsList.reduce((sum, a) => sum + (Number(a.price) || 0), 0);

  const title = book.title || 'Untitled Study Guide';
  const subtitle = book.subtitle || 'Complete Exam Preparation Material';
  const rating = book.rating || 4.8;
  const reviewCount = book.reviewCount || 127;
  const buyersCount = book.buyersCount || 2450;
  const category = book.category || 'IELTS';

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Top Preview Banner */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold tracking-wide">
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span className="uppercase text-[11px]">Live Storefront Customer Preview</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Real-time Sync</span>
      </div>

      <div className="p-5 sm:p-6 space-y-6 flex-1">
        {/* Product Visual Header */}
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Cover Art Visual */}
          <div className="w-32 sm:w-36 shrink-0 mx-auto sm:mx-0 shadow-md rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
            {book.imageUrl || book.coverImage ? (
              <img
                src={book.imageUrl || book.coverImage}
                alt={title}
                className="w-full h-auto object-cover aspect-[3/4]"
              />
            ) : (
              <BookCover book={book as Book} size="sm" />
            )}
          </div>

          {/* Core Info */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {category}
              </span>
              {book.isBestSeller && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Best Seller
                </span>
              )}
            </div>

            <h3 className="text-lg font-black text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] leading-tight">
              {title}
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
              {subtitle}
            </p>

            {/* Rating & Social Proof */}
            <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
              <div className="flex items-center text-amber-500 font-bold gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{rating}</span>
                <span className="text-slate-400 font-normal">({reviewCount})</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Users className="w-3.5 h-3.5" />
                <span>{buyersCount.toLocaleString()} learners enrolled</span>
              </div>
            </div>

            {/* Base Price Display */}
            <div className="pt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#0a2540]">
                ₹{digitalPrice}
              </span>
              {digitalOrig > digitalPrice && (
                <span className="text-xs line-through text-slate-400">
                  ₹{digitalOrig}
                </span>
              )}
              {digitalOrig > digitalPrice && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {Math.round(((digitalOrig - digitalPrice) / digitalOrig) * 100)}% OFF
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Optional Add-ons Section */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Optional Study Materials & Add-ons
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Customize your preparation pack with extra practice questions & mock tests.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {activeAddons.length} Available
            </span>
          </div>

          {activeAddons.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No active add-ons configured yet. Add one in the editor tabs to preview here.
            </div>
          ) : (
            <div className="space-y-2">
              {activeAddons.map((addon) => {
                const isChecked = selectedIds.includes(addon.id);
                const isPhysical = addon.deliveryOption === 'physical';

                return (
                  <div
                    key={addon.id}
                    onClick={() => toggleSelect(addon.id)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between select-none ${
                      isChecked
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 pr-3">
                      {/* Checkbox box */}
                      <div
                        className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-bold text-slate-900 truncate">
                            {addon.name}
                          </h5>
                          {addon.digitalFile?.filename && (
                            <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                              PDF
                            </span>
                          )}
                        </div>
                        {addon.description && (
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-1 mt-0.5">
                            {addon.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium mt-1">
                          {isPhysical ? <BookOpen className="w-3 h-3" /> : <DownloadCloud className="w-3 h-3" />}
                          <span>{isPhysical ? 'Printed Delivery' : 'Instant Digital Download'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-slate-900">
                        ₹{addon.price}
                      </div>
                      {addon.originalPrice > addon.price && (
                        <div className="text-[10px] line-through text-slate-400">
                          ₹{addon.originalPrice}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Total & CTA Summary */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Simulated Total Payable:</span>
            <span className="text-lg font-black text-[#0a2540]">
              ₹{displayTotal}
            </span>
          </div>

          <div className="w-full py-3 rounded-xl bg-[#00875a] text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 pointer-events-none opacity-90">
            <ShoppingBag className="w-4 h-4" />
            <span>Proceed to Buy Now • ₹{displayTotal}</span>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Customer view simulation only. Authoritative pricing calculated at checkout.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
